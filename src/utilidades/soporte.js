// Soporte v2: lo que la pantalla de la óptica y la bandeja del superadmin comparten (nombres, estados, orden, indicadores). Lógica pura, sin pantalla ni base de datos.
// Los textos de los estados, módulos y urgencias salen de aquí: ninguna pantalla los escribe por su cuenta (un concepto = un nombre).

export const MODULOS_SOPORTE = [
  { id: "citas", nombre: "Citas" },
  { id: "pacientes", nombre: "Pacientes" },
  { id: "ventas", nombre: "Ventas" },
  { id: "inventario", nombre: "Inventario" },
  { id: "reportes", nombre: "Reportes" },
  { id: "crm", nombre: "CRM" },
  { id: "horario", nombre: "Mi horario" },
  { id: "usuarios", nombre: "Usuarios y permisos" },
  { id: "configuracion", nombre: "Configuración" },
  { id: "inicio", nombre: "Inicio" },
  { id: "otro", nombre: "Otro" },
]
export const nombreModulo = (id) => MODULOS_SOPORTE.find((m) => m.id === id)?.nombre || "Otro"

export const TIPOS_CONSULTA = [
  { id: "problema", nombre: "Problema", ayuda: "Algo no funciona como debería." },
  { id: "pregunta", nombre: "Pregunta", ayuda: "No sé cómo hacer algo." },
  { id: "sugerencia", nombre: "Sugerencia", ayuda: "Una idea para mejorar el sistema." },
]
export const nombreTipo = (id) => TIPOS_CONSULTA.find((t) => t.id === id)?.nombre || "Pregunta"

export const URGENCIAS = [
  { id: "normal", nombre: "Normal", ayuda: "Puedo seguir trabajando mientras tanto." },
  { id: "urgente", nombre: "Urgente", ayuda: "Urgente: no puedo atender, vender o cobrar." },
]
export const nombreUrgencia = (id) => URGENCIAS.find((u) => u.id === id)?.nombre || "Normal"

// Un solo nombre y un solo color por estado, igual en las dos mitades (óptica y superadmin).
export const ESTADOS_CONSULTA = [
  { id: "recibida", nombre: "Recibida", clase: "border-slate-200 bg-slate-100 text-slate-700" },
  { id: "en_revision", nombre: "En revisión", clase: "border-blue-200 bg-blue-50 text-blue-700" },
  { id: "respondida", nombre: "Respondida", clase: "border-violet-200 bg-violet-50 text-violet-700" },
  { id: "resuelta", nombre: "Resuelta", clase: "border-emerald-200 bg-emerald-50 text-emerald-700" },
]
export const estadoDe = (id) => ESTADOS_CONSULTA.find((e) => e.id === id) || ESTADOS_CONSULTA[0]
export const esAbierta = (c) => c?.estado !== "resuelta"

// Lo que se le promete a quien escribe. Un compromiso del sistema: se cambia aquí y se ve igual en la confirmación y en la ayuda.
export const TIEMPO_ESTIMADO = { normal: "1 día hábil", urgente: "2 horas" }
export const tiempoEstimado = (urgencia) => TIEMPO_ESTIMADO[urgencia] || TIEMPO_ESTIMADO.normal

export const MAX_ADJUNTOS = 3
export const MAX_BYTES_ADJUNTO = 5 * 1024 * 1024
export const TIPOS_ADJUNTO = ["image/png", "image/jpeg", "image/webp", "image/gif"]

// SOP-0007
export const codigoConsulta = (numero) => `SOP-${String(Number(numero) || 0).padStart(4, "0")}`

// Valida una captura antes de subirla. Devuelve el texto del problema, o "" si está bien.
export function problemaDeCaptura(archivo) {
  if (!archivo) return "No se pudo leer el archivo."
  if (!TIPOS_ADJUNTO.includes(archivo.type)) return `«${archivo.name}» no es una imagen (PNG, JPG, WebP o GIF).`
  if (archivo.size > MAX_BYTES_ADJUNTO) return `«${archivo.name}» pesa más de 5 MB.`
  return ""
}

export const tamanoLegible = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`)

// Nombre de archivo seguro para guardar en el almacenamiento.
export function nombreSeguro(nombre) {
  const base = String(nombre || "captura").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "")
  return (base || "captura").slice(-60)
}

// El contexto que el sistema agrega solo: quién escribe, su rol, la pantalla desde la que escribió y el navegador.
export function contextoDeConsulta({ usuario, pantalla, agente } = {}) {
  const ua = String(agente ?? (typeof navigator !== "undefined" ? navigator.userAgent : "") ?? "")
  return {
    quien: usuario?.nombre || "",
    rol: usuario?.rol === "admin" ? "Administrador" : usuario?.etiquetaRol || usuario?.rolNombre || "Personal",
    pantalla: pantalla || "Soporte",
    navegador: navegadorLegible(ua),
    agente: ua.slice(0, 300),
  }
}

// "Chrome 141 · Windows" (lo justo para que soporte reproduzca el problema).
export function navegadorLegible(ua) {
  const s = String(ua || "")
  if (!s) return "No disponible"
  const sistema = /Windows/.test(s) ? "Windows" : /Android/.test(s) ? "Android" : /iPhone|iPad|iOS/.test(s) ? "iOS" : /Mac OS X|Macintosh/.test(s) ? "macOS" : /Linux/.test(s) ? "Linux" : "otro sistema"
  const buscar = (re, nombre) => { const m = s.match(re); return m ? `${nombre} ${m[1]}` : null }
  const navegador = buscar(/Edg\/(\d+)/, "Edge") || buscar(/OPR\/(\d+)/, "Opera") || buscar(/Firefox\/(\d+)/, "Firefox") || buscar(/Chrome\/(\d+)/, "Chrome") || buscar(/Version\/(\d+).*Safari/, "Safari") || "navegador desconocido"
  return `${navegador} · ${sistema}`
}

// ── Orden de la bandeja del superadmin: las urgentes primero, y dentro de cada grupo las que esperan al soporte antes que las que esperan a la óptica,
// y luego las más antiguas (las que llevan más esperando). Las resueltas van al final.
export function ordenarBandeja(consultas) {
  const peso = (c) => (c.estado === "resuelta" ? 4 : 0) + (c.urgencia === "urgente" ? 0 : 2) + (c.ultimoMensajeDe === "optica" ? 0 : 1)
  return [...consultas].sort((a, b) => peso(a) - peso(b) || (c2ms(a.actualizadaEn ?? a.creadaEn) - c2ms(b.actualizadaEn ?? b.creadaEn)) * (a.estado === "resuelta" ? -1 : 1))
}
const c2ms = (v) => { const t = new Date(v).getTime(); return Number.isFinite(t) ? t : 0 }

// Mis consultas (óptica): primero las que tienen respuesta sin leer, luego las abiertas, luego las resueltas; dentro de cada grupo, la más reciente primero.
export function ordenarMisConsultas(consultas) {
  const peso = (c) => (c.respuestaSinLeer ? 0 : c.estado === "resuelta" ? 2 : 1)
  return [...consultas].sort((a, b) => peso(a) - peso(b) || c2ms(b.actualizadaEn ?? b.creadaEn) - c2ms(a.actualizadaEn ?? a.creadaEn))
}

// Filtros de la bandeja. "" = sin filtrar.
export function filtrarBandeja(consultas, { estado = "", urgencia = "", modulo = "", opticaId = "", busqueda = "", desde = null } = {}, nombreOptica = () => "") {
  const q = String(busqueda || "").trim().toLowerCase()
  return consultas.filter((c) => {
    if (desde !== null && desde !== undefined && c2ms(c.creadaEn) < c2ms(desde)) return false
    if (estado === "abiertas" ? c.estado === "resuelta" : estado && c.estado !== estado) return false
    if (urgencia && c.urgencia !== urgencia) return false
    if (modulo && c.modulo !== modulo) return false
    if (opticaId && c.opticaId !== opticaId) return false
    if (q && !`${codigoConsulta(c.numero)} ${c.asunto} ${c.autorNombre} ${nombreOptica(c.opticaId)}`.toLowerCase().includes(q)) return false
    return true
  })
}

// El período de la bandeja y de los indicadores (el mismo en las dos pestañas, para que los números coincidan con la lista). Devuelve el instante desde el cual se cuenta, o null = todo.
export const PERIODOS_SOPORTE = [
  { id: "7", nombre: "Últimos 7 días", dias: 7 },
  { id: "30", nombre: "Últimos 30 días", dias: 30 },
  { id: "90", nombre: "Últimos 90 días", dias: 90 },
  { id: "todo", nombre: "Todo el tiempo", dias: null },
]
export function desdeDePeriodo(periodo, ahoraMs = Date.now()) {
  const p = PERIODOS_SOPORTE.find((x) => x.id === periodo)
  return p?.dias ? new Date(ahoraMs - p.dias * 86400000).toISOString() : null
}

// ── Indicadores del superadmin
const minutos = (desde, hasta) => Math.max(0, Math.round((c2ms(hasta) - c2ms(desde)) / 60000))
const mediana = (xs) => {
  if (xs.length === 0) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2)
}

export function indicadoresSoporte(consultas, { desde = null, hasta = null } = {}) {
  const dentro = consultas.filter((c) => (!desde || c2ms(c.creadaEn) >= c2ms(desde)) && (!hasta || c2ms(c.creadaEn) <= c2ms(hasta)))
  const primeras = dentro.filter((c) => c.primeraRespuestaEn).map((c) => minutos(c.creadaEn, c.primeraRespuestaEn))
  const resoluciones = dentro.filter((c) => c.resueltaEn && c.estado === "resuelta").map((c) => minutos(c.creadaEn, c.resueltaEn))
  const notas = dentro.filter((c) => c.calificacion).map((c) => c.calificacion)
  const porModulo = {}
  for (const c of dentro) porModulo[c.modulo] = (porModulo[c.modulo] || 0) + 1
  return {
    total: dentro.length,
    abiertas: dentro.filter(esAbierta).length,
    urgentesAbiertas: dentro.filter((c) => esAbierta(c) && c.urgencia === "urgente").length,
    sinResponder: dentro.filter((c) => !c.primeraRespuestaEn && esAbierta(c)).length,
    primeraRespuestaMin: mediana(primeras),
    resolucionMin: mediana(resoluciones),
    satisfaccion: notas.length ? Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10 : null,
    calificadas: notas.length,
    porModulo: Object.entries(porModulo).map(([modulo, total]) => ({ modulo, nombre: nombreModulo(modulo), total })).sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre)),
  }
}

// "35 min", "2 h 10 min", "3 días 4 h". null = "—".
export function duracionLegible(min) {
  if (min === null || min === undefined) return "—"
  if (min < 1) return "menos de 1 min"
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h < 24) return m ? `${h} h ${m} min` : `${h} h`
  const d = Math.floor(h / 24)
  const hh = h % 24
  return `${d} ${d === 1 ? "día" : "días"}${hh ? ` ${hh} h` : ""}`
}

// ── De la base a la pantalla (los nombres de las columnas, una sola vez)
export const mapConsulta = (r) => ({
  id: r.id, numero: r.numero, opticaId: r.optica_id, autorId: r.autor_id, autorNombre: r.autor_nombre, autorRol: r.autor_rol,
  modulo: r.modulo, tipo: r.tipo, urgencia: r.urgencia, asunto: r.asunto, descripcion: r.descripcion, estado: r.estado, contexto: r.contexto || {},
  ultimoMensajeDe: r.ultimo_mensaje_de, respuestaSinLeer: !!r.respuesta_sin_leer,
  calificacion: r.calificacion, calificacionComentario: r.calificacion_comentario || "", calificadaEn: r.calificada_en,
  primeraRespuestaEn: r.primera_respuesta_en, resueltaEn: r.resuelta_en, reabiertaVeces: r.reabierta_veces || 0,
  creadaEn: r.creada_en, actualizadaEn: r.actualizada_en,
})
export const mapMensajeSoporte = (r) => ({
  id: r.id, consultaId: r.consulta_id, autorNombre: r.autor_nombre, de: r.de, interna: !!r.interna, cuerpo: r.cuerpo, adjuntos: Array.isArray(r.adjuntos) ? r.adjuntos : [], creadoEn: r.creado_en,
})

// Los avisos del sistema (tabla `mensajes`, tipo "anuncio") con su "leído".
export function avisosConLeido(mensajes, leidos) {
  const vistos = new Set(leidos)
  return mensajes
    .filter((m) => m.tipo === "anuncio")
    .map((m) => ({ id: m.id, asunto: m.asunto, cuerpo: m.cuerpo, creadoEn: m.created_at, general: !m.optica_id, leido: vistos.has(m.id) }))
    .sort((a, b) => Number(a.leido) - Number(b.leido) || c2ms(b.creadoEn) - c2ms(a.creadoEn))
}
