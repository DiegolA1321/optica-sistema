// Comunicación interna por niveles (migración 0116): quién ve qué pestaña, a quién va una consulta y cómo se arman los avisos internos. Lógica pura, sin pantalla.
//
//   Nivel 1  Avisos internos        administrador → personal
//   Nivel 2  Consultas al administrador   personal → administrador (que responde, resuelve o escala)
//   Nivel 3  Soporte del sistema    administrador → superadmin
//   Nivel 4  Avisos del sistema     superadmin → ópticas
// El servidor decide a quién va cada consulta (destino); aquí solo se muestra.

export const esAdministrador = (usuario) => usuario?.rol === "admin"

// Las pestañas de Soporte de cada persona, en el orden en que se ven. "Ayuda" va al final.
export function pestanasDeSoporte(usuario) {
  if (esAdministrador(usuario)) return ["personal", "sistema", "avisos", "ayuda"]
  return ["consultas", "avisos", "ayuda"]
}
export const PESTANAS_SOPORTE = ["consultas", "personal", "sistema", "avisos", "ayuda"]
export const pestanaInicial = (usuario) => pestanasDeSoporte(usuario)[0]
// Una dirección guardada (?tab=consultas) que esta persona no tiene (el administrador no tiene "Mis consultas") cae en su primera pestaña.
export const pestanaValida = (usuario, tab) => (pestanasDeSoporte(usuario).includes(tab) ? tab : pestanaInicial(usuario))

// La pestaña donde vive una consulta para esta persona (para abrirla desde la campanita).
export const pestanaDeConsulta = (c, usuario) => (esAdministrador(usuario) ? (c?.autorId === usuario.id ? "sistema" : "personal") : "consultas")

// Cómo se llama cada pestaña de consultas.
export const NOMBRE_PESTANA_CONSULTAS = { consultas: "Mis consultas", personal: "Consultas del personal", sistema: "Soporte del sistema" }

// Las consultas de cada pestaña. El administrador ve las de su personal por un lado (aunque ya estén escaladas) y las suyas, que van al soporte del
// sistema, por otro. El resto del personal solo tiene las suyas.
export function consultasDePestana(consultas, usuario, pestana) {
  if (pestana === "personal") return consultas.filter((c) => c.autorId !== usuario.id)
  if (pestana === "sistema") return consultas.filter((c) => c.autorId === usuario.id)
  return consultas.filter((c) => c.autorId === usuario.id)
}

// A quién le toca la consulta ahora (lo que se muestra junto al estado).
export function dondeEsta(c, usuario = null) {
  if (c.destino === "superadmin" && c.escaladaEn) return "Escalada al soporte del sistema"
  if (c.destino === "admin") return usuario && c.autorId !== usuario.id ? "La atiendes tú" : "Con tu administrador"
  return "Con el soporte del sistema"
}
export const estaEscalada = (c) => c?.destino === "superadmin" && !!c?.escaladaEn
// Solo el administrador escala, y solo una consulta del personal que sigue con él y no está resuelta.
export const puedeEscalar = (c, usuario) => esAdministrador(usuario) && c?.destino === "admin" && c?.estado !== "resuelta" && c?.autorId !== usuario.id

// Lo que se le promete a quien escribe: el personal espera a su administrador; el administrador, al soporte del sistema.
export const textoDeEnvio = (usuario) => (esAdministrador(usuario)
  ? { titulo: "Nueva consulta", subtitulo: "Cuéntanos qué pasa y te respondemos por aquí", enviada: "Ya la tiene el soporte", cuando: "El soporte te responde" }
  : { titulo: "Nueva consulta", subtitulo: "Cuéntale a tu administrador qué pasa", enviada: "Ya la tiene tu administrador", cuando: "Tu administrador te responde" })

// ── Avisos internos
export const DESTINOS_AVISO = [
  { id: "todos", nombre: "Todo el personal" },
  { id: "rol", nombre: "Un rol" },
  { id: "persona", nombre: "Una persona" },
]

export const mapAvisoInterno = (r) => ({
  id: r.id, opticaId: r.optica_id, autorId: r.autor_id, autorNombre: r.autor_nombre, titulo: r.titulo, cuerpo: r.cuerpo,
  para: r.para, rolId: r.rol_id, perfilId: r.perfil_id, venceEl: r.vence_el || null, creadoEn: r.creado_en,
})

const c2ms = (v) => { const t = new Date(v).getTime(); return Number.isFinite(t) ? t : 0 }
export const estaVencido = (aviso, hoyISO) => !!aviso.venceEl && String(aviso.venceEl).slice(0, 10) < hoyISO

// A quién va, en una frase: "Todo el personal", "Rol Optómetra", "Vera Ventas".
export function destinoLegible(aviso, { roles = [], personas = [] } = {}) {
  if (aviso.para === "rol") return `Rol ${roles.find((r) => r.id === aviso.rolId)?.nombre || "(rol eliminado)"}`
  if (aviso.para === "persona") return personas.find((p) => p.id === aviso.perfilId)?.nombre || "Una persona"
  return "Todo el personal"
}

// Las lecturas (una fila por destinatario) de cada aviso: { avisoId: { total, leidos, personas: [{ id, nombre, leidoEn }] } }. "Leído por 3 de 5".
export function resumenDeLecturas(filas) {
  const porAviso = {}
  for (const f of filas || []) {
    const r = (porAviso[f.aviso_id] ||= { total: 0, leidos: 0, personas: [] })
    r.total += 1
    if (f.leido_en) r.leidos += 1
    r.personas.push({ id: f.perfil_id, nombre: f.nombre, leidoEn: f.leido_en || null })
  }
  for (const r of Object.values(porAviso)) r.personas.sort((a, b) => Number(!!b.leidoEn) - Number(!!a.leidoEn) || String(a.nombre).localeCompare(String(b.nombre)))
  return porAviso
}
export const textoLeidoPor = (r) => (r ? `Leído por ${r.leidos} de ${r.total}` : "Sin destinatarios")

// La lista de la pestaña Avisos: los del sistema y los internos juntos. Los no leídos primero y, dentro de cada grupo, los más recientes.
// Cada uno lleva `origen` ("sistema" | "interno") para mostrar de quién viene.
export function avisosUnificados({ sistema = [], internos = [], leidosInternos = [] } = {}) {
  const vistos = new Set(leidosInternos)
  const a = sistema.map((x) => ({ ...x, origen: "sistema", titulo: x.asunto }))
  const b = internos.map((x) => ({ id: x.id, titulo: x.titulo, cuerpo: x.cuerpo, creadoEn: x.creadoEn, origen: "interno", autorNombre: x.autorNombre, venceEl: x.venceEl, leido: vistos.has(x.id), aviso: x }))
  return [...a, ...b].sort((x, y) => Number(x.leido) - Number(y.leido) || c2ms(y.creadoEn) - c2ms(x.creadoEn))
}
