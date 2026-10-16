// Panel del superadmin: las cuentas del negocio de software por suscripción. Lógica pura (sin pantalla ni base de datos) para que el Resumen,
// Ópticas, Soporte, Leads y Actividad cuenten con las mismas funciones y los números coincidan entre secciones.
// Las filas llegan como las entrega la base (snake_case): opticas, facturas, leads, auditoria; el uso y el último ingreso, de `datos_negocio_superadmin()`.
import { diaDe, enRango, ultimosMeses, porcentaje } from "./reportesPeriodo"
import { sumarDiasISO } from "./controles"
import { fechaAISO } from "./disponibilidad"
import { esAbierta } from "./soporte"

const num = (v) => Number(v) || 0
const ms = (v) => new Date(v).getTime()

// ── Ópticas de prueba ────────────────────────────────────────────────────────────────────────────────────────────────
// Las de prueba y de demostración se marcan con `es_de_prueba` (la cambia el superadmin) y se excluyen de las métricas del negocio por defecto.
export const esDePrueba = (o) => !!o?.es_de_prueba
export const opticasDelNegocio = (opticas, incluirPrueba = false) => (incluirPrueba ? opticas : opticas.filter((o) => !esDePrueba(o)))
export const idsDePrueba = (opticas) => new Set(opticas.filter(esDePrueba).map((o) => o.id))
// Quita de una lista lo que pertenece a una óptica de prueba. Lo que no es de una óptica (un aviso general, un superadmin) se conserva.
export function sinPruebas(items, opticas, incluirPrueba = false, clave = "optica_id") {
  if (incluirPrueba) return items
  const pruebas = idsDePrueba(opticas)
  return items.filter((x) => !x[clave] || !pruebas.has(x[clave]))
}

// ── Ingresos por suscripciones ───────────────────────────────────────────────────────────────────────────────────────
export const DIAS_PARA_VENCER = 30
const emitidaDia = (f) => diaDe(f.emitida_at)
const pagadaDia = (f) => (f.estado === "pagada" && f.pagada_at ? diaDe(f.pagada_at) : "")

// Lo facturado (emitido en el período) y lo cobrado (pagado en el período), con las facturas que los componen.
export function ingresosDelPeriodo(facturas, rango) {
  const facturadas = facturas.filter((f) => enRango(f.emitida_at, rango))
  const cobradas = facturas.filter((f) => f.estado === "pagada" && f.pagada_at && enRango(f.pagada_at, rango))
  return { facturadas, cobradas, facturado: facturadas.reduce((s, f) => s + num(f.monto), 0), cobrado: cobradas.reduce((s, f) => s + num(f.monto), 0) }
}

// Las facturas por cobrar al cierre de un día: emitidas hasta ese día y no pagadas hasta ese día. Vencida = por cobrar hace más de 30 días.
export function porCobrarAl(facturas, fechaISO) {
  const pendientes = facturas.filter((f) => emitidaDia(f) <= fechaISO && !(pagadaDia(f) && pagadaDia(f) <= fechaISO))
  const limite = sumarDiasISO(fechaISO, -DIAS_PARA_VENCER)
  const vencidas = pendientes.filter((f) => emitidaDia(f) < limite)
  return { pendientes, vencidas, monto: pendientes.reduce((s, f) => s + num(f.monto), 0), montoVencido: vencidas.reduce((s, f) => s + num(f.monto), 0) }
}

// Los últimos 12 meses (o `n`) de lo facturado y lo cobrado, para la gráfica.
export function serieIngresos(facturas, hoy, n = 12) {
  return ultimosMeses(n, hoy).map((m) => {
    const r = ingresosDelPeriodo(facturas, { inicio: m.inicio, fin: m.fin })
    return { ...m, facturado: r.facturado, cobrado: r.cobrado, facturadas: r.facturadas, cobradas: r.cobradas }
  })
}

// ── Clientes (ópticas) ───────────────────────────────────────────────────────────────────────────────────────────────
// Cómo estaba una óptica al cierre de un día: se parte de su estado de hoy y se deshacen las suspensiones y reactivaciones posteriores
// (el registro de actividad las guarda con su fecha).
export function estadoAl(optica, fechaISO, eventos = []) {
  if (!optica.created_at || diaDe(optica.created_at) > fechaISO) return "inexistente"
  let activa = optica.activa !== false
  const posteriores = eventos
    .filter((e) => e.optica_id === optica.id && (e.accion === "suspender_optica" || e.accion === "reactivar_optica") && diaDe(e.created_at) > fechaISO)
    .sort((a, b) => ms(b.created_at) - ms(a.created_at))
  for (const e of posteriores) activa = e.accion === "suspender_optica"
  return activa ? "activa" : "suspendida"
}

export function clientesAl(opticas, fechaISO, eventos) {
  const por = { activa: [], suspendida: [] }
  for (const o of opticas) { const e = estadoAl(o, fechaISO, eventos); if (por[e]) por[e].push(o) }
  return { activas: por.activa, suspendidas: por.suspendida }
}

// Las cuatro cifras del período. Nuevas = creadas en el período. Dadas de baja = suspendidas durante el período y que siguen suspendidas al cierre.
export function clientesDelPeriodo(opticas, eventos, rango) {
  const cierre = clientesAl(opticas, rango.fin, eventos)
  const nuevas = opticas.filter((o) => o.created_at && enRango(o.created_at, rango))
  const suspendidasEnPeriodo = new Set(eventos.filter((e) => e.accion === "suspender_optica" && e.optica_id && enRango(e.created_at, rango)).map((e) => e.optica_id))
  const bajas = cierre.suspendidas.filter((o) => suspendidasEnPeriodo.has(o.id))
  return { activas: cierre.activas, suspendidas: cierre.suspendidas, nuevas, bajas }
}

export function serieClientes(opticas, eventos, hoy, n = 12) {
  const hoyISO = fechaAISO(hoy)
  return ultimosMeses(n, hoy).map((m) => ({ ...m, activas: clientesAl(opticas, m.fin > hoyISO ? hoyISO : m.fin, eventos).activas }))
}

// ── Salud de cada óptica ─────────────────────────────────────────────────────────────────────────────────────────────
export const SALUD = {
  riesgo: { id: "riesgo", nombre: "En riesgo", orden: 0, clase: "border-red-200 bg-red-50 text-red-700" },
  atencion: { id: "atencion", nombre: "Atención", orden: 1, clase: "border-amber-200 bg-amber-50 text-amber-800" },
  saludable: { id: "saludable", nombre: "Saludable", orden: 2, clase: "border-emerald-200 bg-emerald-50 text-emerald-700" },
}
export const AYUDA_SALUD = "Se mira cada óptica activa en cuatro cosas. Último ingreso de su personal: más de 7 días sin ingresar es Atención y más de 30 (o nunca) es En riesgo. Uso en los últimos 30 días (citas, consultas y ventas): menos de 5 en total es Atención y ninguno es En riesgo. Pago: pendiente es Atención y vencido es En riesgo. Soporte: una consulta abierta es Atención; una urgente o tres o más abiertas es En riesgo. La óptica toma el peor de los cuatro."

const diasEntre = (aISO, bISO) => Math.round((Date.UTC(...bISO.split("-").map((n, i) => (i === 1 ? n - 1 : +n))) - Date.UTC(...aISO.split("-").map((n, i) => (i === 1 ? n - 1 : +n)))) / 86400000)

// El último ingreso del personal de una óptica (el más reciente de su administrador y sus asistentes activos), como día "AAAA-MM-DD" o "".
export function ultimoIngresoDe(opticaId, personas = []) {
  let mejor = ""
  for (const p of personas) {
    if (p.optica_id !== opticaId || p.activo === false || !p.ultimo_ingreso) continue
    const d = diaDe(p.ultimo_ingreso)
    if (d > mejor) mejor = d
  }
  return mejor
}

const peor = (a, b) => (SALUD[a].orden <= SALUD[b].orden ? a : b)

// Devuelve { estado, motivos: [{ nivel, texto, area }], ultimoIngreso, usoTotal, ... }. Sin datos del servidor (aún sin la migración) no inventa: dice "sin dato".
export function saludDeOptica({ optica, personas = [], uso = null, facturas = [], consultas = [], hoyISO }) {
  const motivos = []
  const sube = (nivel, texto, area) => motivos.push({ nivel, texto, area })

  // 1. Último ingreso del personal
  const ultimo = ultimoIngresoDe(optica.id, personas)
  const dias = ultimo ? diasEntre(ultimo, hoyISO) : null
  const creada = optica.created_at ? diasEntre(diaDe(optica.created_at), hoyISO) : 0
  if (personas.length > 0) {
    if (dias === null) { if (creada > 7) sube("riesgo", "Nadie de su personal ha ingresado", "ingreso") }
    else if (dias > 30) sube("riesgo", `Nadie ingresa hace ${dias} días`, "ingreso")
    else if (dias > 7) sube("atencion", `Nadie ingresa hace ${dias} días`, "ingreso")
  }

  // 2. Uso de los últimos 30 días
  const usoTotal = uso ? num(uso.citas) + num(uso.consultas) + num(uso.ventas) : null
  if (uso && creada > 7) {
    if (usoTotal === 0) sube("riesgo", "Sin citas, consultas ni ventas en 30 días", "uso")
    else if (usoTotal < 5) sube("atencion", `Poco uso: ${usoTotal} registro${usoTotal === 1 ? "" : "s"} en 30 días`, "uso")
  }

  // 3. Pago al día
  if (optica.estado_pago === "vencido") sube("riesgo", "Pago vencido", "pago")
  else if (optica.estado_pago === "pendiente") sube("atencion", "Pago pendiente", "pago")

  // 4. Consultas de soporte abiertas
  const abiertas = consultas.filter((c) => c.opticaId === optica.id && esAbierta(c))
  const urgentes = abiertas.filter((c) => c.urgencia === "urgente").length
  if (urgentes > 0) sube("riesgo", `${urgentes} consulta${urgentes === 1 ? "" : "s"} urgente${urgentes === 1 ? "" : "s"} sin resolver`, "soporte")
  else if (abiertas.length >= 3) sube("riesgo", `${abiertas.length} consultas de soporte abiertas`, "soporte")
  else if (abiertas.length > 0) sube("atencion", `${abiertas.length} consulta${abiertas.length === 1 ? "" : "s"} de soporte abierta${abiertas.length === 1 ? "" : "s"}`, "soporte")

  const estado = motivos.reduce((e, m) => peor(e, m.nivel), "saludable")
  const porCobrar = facturas.filter((f) => f.optica_id === optica.id && f.estado === "pendiente")
  return { estado, motivos, ultimoIngreso: ultimo, diasSinIngresar: dias, usoTotal, abiertas: abiertas.length, urgentes, facturasPendientes: porCobrar.length }
}

// Las ópticas activas con su salud: en riesgo primero, luego atención, luego saludables; dentro de cada grupo, las de más motivos primero.
export function ordenarPorSalud(filas) {
  return [...filas].sort((a, b) => SALUD[a.salud.estado].orden - SALUD[b.salud.estado].orden || b.salud.motivos.length - a.salud.motivos.length || a.optica.nombre.localeCompare(b.optica.nombre))
}
export function saludDeLaRed({ opticas, personas, uso, facturas, consultas, hoyISO }) {
  const filas = opticas.filter((o) => o.activa !== false).map((optica) => ({
    optica,
    salud: saludDeOptica({ optica, personas, uso: (uso || []).find((u) => u.optica_id === optica.id) || null, facturas, consultas, hoyISO }),
  }))
  return ordenarPorSalud(filas)
}
export const contarSalud = (filas) => ({ riesgo: filas.filter((f) => f.salud.estado === "riesgo").length, atencion: filas.filter((f) => f.salud.estado === "atencion").length, saludable: filas.filter((f) => f.salud.estado === "saludable").length })

// ── Soporte ──────────────────────────────────────────────────────────────────────────────────────────────────────────
// Las consultas que estaban abiertas al cierre de un día (creadas hasta ese día y todavía no resueltas ese día), para comparar con hoy.
export function consultasAbiertasAl(consultas, fechaISO) {
  return consultas.filter((c) => diaDe(c.creadaEn) <= fechaISO && !(c.resueltaEn && diaDe(c.resueltaEn) <= fechaISO))
}
// Los instantes que abren y cierran un día de Ecuador (UTC-5 todo el año), para pedirle a `indicadoresSoporte` un período.
export const instanteInicio = (diaISO) => `${diaISO}T00:00:00-05:00`
export const instanteFin = (diaISO) => `${diaISO}T23:59:59.999-05:00`

// ── Uso del sistema ──────────────────────────────────────────────────────────────────────────────────────────────────
export const MODULOS_USO = [
  { id: "citas", nombre: "Citas médicas", corto: "Citas" },
  { id: "pacientes", nombre: "Pacientes", corto: "Pacientes" },
  { id: "consultas", nombre: "Ficha clínica", corto: "Fichas" },
  { id: "ventas", nombre: "Ventas", corto: "Ventas" },
  { id: "inventario", nombre: "Inventario", corto: "Inventario" },
  { id: "crm", nombre: "CRM y fidelización", corto: "CRM" },
  { id: "reportes", nombre: "Reportes", corto: "Reportes" },
]
// Personas que registraron alguna acción en 30 días y los 30 anteriores, sumando las ópticas dadas.
export function usoDeLaRed(uso, opticaIds) {
  const filas = (uso || []).filter((u) => opticaIds.has(u.optica_id))
  const sum = (k, de = "") => filas.reduce((s, u) => s + num(de ? u[de]?.[k] : u[k]), 0)
  const porModulo = MODULOS_USO.map((m) => ({ ...m, acciones: filas.reduce((s, u) => s + num(u.modulos?.[m.id]), 0), opticas: filas.filter((u) => num(u.modulos?.[m.id]) > 0) }))
  return {
    filas,
    personas: sum("personas_activas"), personasPrevio: sum("personas_activas", "previo"),
    citas: sum("citas"), citasPrevio: sum("citas", "previo"),
    consultas: sum("consultas"), consultasPrevio: sum("consultas", "previo"),
    ventas: sum("ventas"), ventasPrevio: sum("ventas", "previo"),
    porModulo,
  }
}
// Qué módulos usó una óptica en los 30 días (con al menos una acción).
export const modulosUsadosPor = (u) => MODULOS_USO.filter((m) => num(u?.modulos?.[m.id]) > 0)

// ── Leads: el embudo de interesados (los mismos números que la sección Leads) ─────────────────────────────────────────
export function embudoLeads(leads, rango) {
  const dentro = leads.filter((l) => enRango(l.created_at, rango))
  const convertidos = dentro.filter((l) => l.estado === "convertido")
  const nuevos = dentro.filter((l) => l.estado === "nuevo")
  const contactados = dentro.filter((l) => l.estado === "contactado")
  return { recibidos: dentro, convertidos, nuevos, contactados, tasa: porcentaje(convertidos.length, dentro.length) }
}

// ── Actividad (auditoría) ────────────────────────────────────────────────────────────────────────────────────────────
export const TIPOS_ACTIVIDAD = [
  { id: "todas", nombre: "Todas", acciones: null },
  { id: "opticas", nombre: "Ópticas", acciones: ["crear_optica", "renombrar_optica", "suspender_optica", "reactivar_optica", "agregar_administrador", "eliminar_administrador", "marcar_optica_prueba"] },
  { id: "accesos", nombre: "Accesos", acciones: ["entrar_como_optica", "salir_de_optica"] },
  { id: "soporte", nombre: "Soporte", acciones: ["responder_mensaje", "cambiar_estado_soporte"] },
  { id: "pagos", nombre: "Pagos", acciones: ["actualizar_pago", "cambiar_suscripcion", "generar_factura", "pagar_factura"] },
  { id: "avisos", nombre: "Avisos del sistema", acciones: ["publicar_anuncio"] },
  { id: "superadmins", nombre: "Superadmins", acciones: ["crear_superadmin", "eliminar_superadmin"] },
  { id: "leads", nombre: "Leads", acciones: ["cambiar_estado_lead"] },
]
// La capa comercial (vender el sistema a otras ópticas) queda oculta con el modo de la tesis: sus tipos y sus acciones no se muestran.
export const TIPOS_COMERCIALES = ["pagos", "leads"]
export const tiposVisibles = (saas = true) => TIPOS_ACTIVIDAD.filter((t) => saas || !TIPOS_COMERCIALES.includes(t.id))
const accionesComerciales = TIPOS_ACTIVIDAD.filter((t) => TIPOS_COMERCIALES.includes(t.id)).flatMap((t) => t.acciones)
export const ACCIONES_COMERCIALES = accionesComerciales
export const tipoDeAccion = (accion) => TIPOS_ACTIVIDAD.find((t) => t.acciones?.includes(accion))?.id || "otros"

const ETIQUETA_PAGO = { al_dia: "Al día", pendiente: "Pendiente", vencido: "Vencido" }
const ETIQUETA_LEAD = { nuevo: "Nuevo", contactado: "Contactado", convertido: "Convertido", descartado: "Descartado" }
const ETIQUETA_SOPORTE = { recibida: "Recibida", en_revision: "En revisión", respondida: "Respondida", resuelta: "Resuelta" }
const etiquetaDe = (mapa, v) => mapa[v] || v

// La frase de una acción en partes: { t: texto, b: negrita }. Quién la hizo va aparte (a.actor_nombre).
// `saas`: con el modo de la tesis (una sola óptica) no se habla de varias ópticas: un aviso general es "para todo el sistema".
export const nombreDestino = (a, saas = true) => (saas || a.optica_id || !/^Todas las ópticas$/i.test(a.optica_nombre || "") ? a.optica_nombre : "Todo el sistema")
export function frasesDeAccion(a, saas = true) {
  const o = nombreDestino(a, saas)
  const b = (t) => ({ t, b: true })
  const t = (x) => ({ t: x })
  switch (a.accion) {
    case "crear_optica": return [t("creó la óptica "), b(o)]
    case "suspender_optica": return [t("suspendió la óptica "), b(o)]
    case "reactivar_optica": return [t("reactivó la óptica "), b(o)]
    case "renombrar_optica": return [t("renombró "), b(a.antes || a.detalle || "la óptica"), t(" a "), b(o)]
    case "agregar_administrador": return [t("agregó a "), b(a.detalle), t(" como administrador de "), b(o)]
    case "eliminar_administrador": return [t("quitó a "), b(a.detalle), t(" como administrador de "), b(o)]
    case "marcar_optica_prueba": return [t(a.despues === "Óptica de prueba" ? "marcó como óptica de prueba a " : "quitó la marca de prueba a "), b(o)]
    case "entrar_como_optica": return [t("entró como administrador a la óptica "), b(o)]
    case "salir_de_optica": return [t("salió de la óptica "), b(o)]
    case "responder_mensaje": return [t("respondió una consulta de "), b(o), ...(a.detalle ? [t(" ("), b(a.detalle), t(")")] : [])]
    case "cambiar_estado_soporte": return [t("cambió la consulta "), b(a.detalle || ""), t(" de "), b(o), t(" a "), b(etiquetaDe(ETIQUETA_SOPORTE, a.despues))]
    case "actualizar_pago": return [t("marcó el pago de "), b(o), t(" como "), b(etiquetaDe(ETIQUETA_PAGO, a.despues || a.detalle).toLowerCase())]
    case "cambiar_suscripcion": return [t("cambió la suscripción de "), b(o)]
    case "generar_factura": return [t("generó la factura "), b(a.detalle), t(" para "), b(o)]
    case "pagar_factura": return a.despues === "Pendiente" ? [t("devolvió a pendiente la factura "), b(a.detalle), t(" de "), b(o)] : [t("marcó como pagada la factura "), b(a.detalle), t(" de "), b(o)]
    case "publicar_anuncio": return [t(!saas && !a.optica_id ? "publicó un aviso general" : "publicó un aviso para "), ...(!saas && !a.optica_id ? [] : [b(o)]), ...(a.detalle ? [t(": "), b(a.detalle)] : [])]
    case "crear_superadmin": return [t("agregó a "), b(o), t(" como superadministrador")]
    case "eliminar_superadmin": return [t("quitó a "), b(o), t(" como superadministrador")]
    case "cambiar_estado_lead": return [t("pasó el lead "), b(a.detalle || ""), t(" a "), b(etiquetaDe(ETIQUETA_LEAD, a.despues))]
    default: return [t(a.accion)]
  }
}
export const textoDeAccion = (a, saas = true) => frasesDeAccion(a, saas).map((x) => x.t).join("")

// Qué cambió: { antes, despues } cuando la acción lo guarda (o se deduce de su texto), si no null.
export function cambioDeAccion(a) {
  if (a.accion === "renombrar_optica") return { campo: "Nombre", antes: a.antes || a.detalle || "", despues: a.despues || a.optica_nombre || "" }
  if (a.antes || a.despues) {
    const campo = { actualizar_pago: "Estado del pago", cambiar_suscripcion: "Suscripción", cambiar_estado_soporte: "Estado de la consulta", cambiar_estado_lead: "Estado del lead", marcar_optica_prueba: "Óptica de prueba", suspender_optica: "Estado", reactivar_optica: "Estado" }[a.accion] || "Valor"
    const nombres = { actualizar_pago: ETIQUETA_PAGO, cambiar_estado_lead: ETIQUETA_LEAD, cambiar_estado_soporte: ETIQUETA_SOPORTE }[a.accion] || {}
    return { campo, antes: etiquetaDe(nombres, a.antes) || "", despues: etiquetaDe(nombres, a.despues) || "" }
  }
  if (a.accion === "suspender_optica") return { campo: "Estado", antes: "Activa", despues: "Suspendida" }
  if (a.accion === "reactivar_optica") return { campo: "Estado", antes: "Suspendida", despues: "Activa" }
  return null
}

// Aplica los filtros de la pantalla. `opticas` sirve para excluir las de prueba; el período es { inicio, fin } o null.
export function filtrarActividad(items, { tipo = "todas", rango = null, opticaId = "", actorId = "", busqueda = "", incluirPrueba = false, opticas = [], saas = true } = {}) {
  const pruebas = incluirPrueba ? new Set() : idsDePrueba(opticas)
  const q = String(busqueda || "").trim().toLowerCase()
  const acciones = TIPOS_ACTIVIDAD.find((x) => x.id === tipo)?.acciones || null
  return items.filter((a) => {
    if (a.optica_id && pruebas.has(a.optica_id)) return false
    if (!saas && accionesComerciales.includes(a.accion)) return false
    if (rango && !enRango(a.created_at, rango)) return false
    if (opticaId && a.optica_id !== opticaId) return false
    if (actorId && a.actor_id !== actorId) return false
    if (acciones && !acciones.includes(a.accion)) return false
    if (q && !`${a.actor_nombre} ${textoDeAccion(a, saas)} ${a.detalle || ""}`.toLowerCase().includes(q)) return false
    return true
  })
}
// Cuántas hay de cada tipo (con todos los filtros menos el tipo), para el número de cada pestaña.
export function contarPorTipo(items, filtros) {
  const sinTipo = filtrarActividad(items, { ...filtros, tipo: "todas" })
  return Object.fromEntries(tiposVisibles(filtros?.saas).map((t) => [t.id, t.acciones ? sinTipo.filter((a) => t.acciones.includes(a.accion)).length : sinTipo.length]))
}
