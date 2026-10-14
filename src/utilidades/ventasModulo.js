// Reglas del módulo de Ventas que no son de una sola pantalla: quién espera demasiado, qué filtra "Por vender" y cuál es la siguiente
// acción de una orden de laboratorio. Lógica pura; los números salen de las mismas funciones que usan el Inicio y Reportes.
import { diasEnEspera, textoDiagnostico } from "./pasesVenta"
import { ordenesAbiertas, ordenesAtrasadas, estadoVisible } from "./ordenesLaboratorio"

// Un paciente que lleva más de 30 días esperando su venta pasa a "Requieren atención" para contactarlo o cerrarlo. Nunca se cierra solo.
export const DIAS_PARA_SEGUIMIENTO = 30

export const FILTROS_POR_VENDER = [
  { id: "todos", etiqueta: "Todos" },
  { id: "con", etiqueta: "Con proforma" },
  { id: "sin", etiqueta: "Sin proforma" },
  { id: "nocompraron", etiqueta: "No compraron" },
]

export const llevaProforma = (item) => Boolean(item?.pase?.proformaEntregadaEn)
export const esperaDemasiado = (item, hoy) => diasEnEspera(item.pase, hoy) > DIAS_PARA_SEGUIMIENTO

// Los que ya pasaron el plazo, el que más lleva esperando primero.
export const pacientesParaSeguimiento = (listos = [], hoy) =>
  listos.filter((i) => esperaDemasiado(i, hoy)).sort((a, b) => diasEnEspera(b.pase, hoy) - diasEnEspera(a.pase, hoy))

// Lo que muestra "Por vender" según el filtro. `listos` y `descartados` son lo que arma useVentas ({ pase, paciente, consulta }).
export function listaPorVender(filtro, { listos = [], descartados = [] }) {
  if (filtro === "nocompraron") return descartados
  if (filtro === "con") return listos.filter(llevaProforma)
  if (filtro === "sin") return listos.filter((i) => !llevaProforma(i))
  return listos
}

// El diagnóstico y el lente recomendado en una sola línea: "Miopía · Lente: Monofocal antirreflejo".
// El diagnóstico sin la frase de plantilla "Corrección óptica indicada según refracción", que repite lo mismo en cada paciente (no decide nada).
export const diagnosticoCorto = (consulta) => textoDiagnostico(consulta).replace(/\s*[—–-]\s*Corrección óptica indicada según refracción\.?/gi, "").replace(/^Corrección óptica indicada según refracción\.?\s*·?\s*/i, "").trim()

export function lineaDiagnosticoYLente(consulta) {
  const d = diagnosticoCorto(consulta)
  const lente = String(consulta?.lenteRecomendado || "").trim()
  return [d, lente && `Lente: ${lente}`].filter(Boolean).join(" · ")
}

// ─── Órdenes de laboratorio ───
export const FILTROS_ORDENES = [
  { id: "abiertas", etiqueta: "Abiertas" },
  { id: "enviadas", etiqueta: "Enviadas" },
  { id: "atrasadas", etiqueta: "Atrasadas" },
  { id: "listas", etiqueta: "Listas" },
  { id: "entregadas", etiqueta: "Entregadas" },
  { id: "todas", etiqueta: "Todas" },
  { id: "canceladas", etiqueta: "Canceladas" },
]
const FILTROS_ORDENES_VALIDOS = FILTROS_ORDENES.map((f) => f.id)
export const filtroDeOrdenesValido = (id) => (FILTROS_ORDENES_VALIDOS.includes(id) ? id : "abiertas")

// "Todas" son las órdenes vivas: las canceladas (una venta anulada) se ven solo con su filtro, igual que las citas canceladas.
export function ordenesDelFiltro(ordenes = [], filtro) {
  if (filtro === "abiertas") return ordenesAbiertas(ordenes)
  if (filtro === "atrasadas") return ordenesAtrasadas(ordenes)
  if (filtro === "enviadas") return ordenes.filter((o) => o.estado === "enviada")
  if (filtro === "listas") return ordenes.filter((o) => o.estado === "lista")
  if (filtro === "entregadas") return ordenes.filter((o) => o.estado === "entregada")
  if (filtro === "canceladas") return ordenes.filter((o) => o.estado === "cancelada")
  return ordenes.filter((o) => o.estado !== "cancelada")
}

// La siguiente acción del proceso, la única que lleva la fila: Marcar lista → Avisar por WhatsApp → Entregar. Sin teléfono no se puede avisar:
// se pasa directo a entregar. Quien no puede editar Ventas no ve ninguna.
export function siguienteAccionOrden(orden, { puedeEditar = true, tieneTelefono = true } = {}) {
  if (!puedeEditar) return null
  if (orden.estado === "enviada") return { id: "lista", etiqueta: "Marcar lista" }
  if (orden.estado === "lista") return !orden.pacienteAvisadoEn && tieneTelefono ? { id: "avisar", etiqueta: "Avisar por WhatsApp" } : { id: "entregar", etiqueta: "Entregar" }
  return null
}

// A qué estado vuelve una orden con "Volver al estado anterior".
export const ESTADO_ANTERIOR = { lista: "enviada", entregada: "lista" }

// El estado que se lee en la fila: "Enviada", "Atrasada 3 d", "Lista", "Entregada".
export const NOMBRE_ESTADO_ORDEN = { enviada: "Enviada", atrasada: "Atrasada", lista: "Lista", entregada: "Entregada", cancelada: "Cancelada" }
export function textoEstadoOrden(orden, dias = 0, hoy) {
  const v = estadoVisible(orden, hoy)
  return v === "atrasada" ? `Atrasada ${dias} ${dias === 1 ? "día" : "días"}` : NOMBRE_ESTADO_ORDEN[v] || v
}

// Los días de espera como se leen en la fila: "Hoy", "1 día", "45 días".
export const textoDiasEspera = (dias) => (dias === 0 ? "Hoy" : `${dias} ${dias === 1 ? "día" : "días"}`)

// El mensaje de seguimiento a quien consultó y todavía no compra. El saludo usa el nombre tal como está guardado (regla 34).
export function mensajeSeguimientoVenta({ paciente, opticaNombre, conProforma }) {
  const nombre = String(paciente?.nombre || "").trim()
  const de = opticaNombre || "tu óptica"
  return `Hola${nombre ? `, ${nombre}` : ""}, te escribimos de ${de}. ${conProforma ? "Quedamos pendientes de la proforma de tus lentes que te entregamos: ¿pudiste revisarla? Si tienes alguna duda, con gusto te ayudamos." : "Quedamos pendientes de los lentes que te recomendó el optómetra: ¿quieres que te preparemos una proforma? Con gusto te ayudamos."}`
}
