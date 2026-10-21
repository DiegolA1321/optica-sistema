// Filtros de la agenda de Citas (reunión 29 sept., R3-R6): estado, origen y
// primera vez/seguimiento. Lógica pura, sin React, para probarla aparte.
import { esHoy } from "./disponibilidad"
import { esDeEsteMes } from "./inicio"

export const ESTADOS_FILTRO = [
  { id: "todas", etiqueta: "Todas" },
  { id: "pendiente", etiqueta: "Pendientes" },
  { id: "enEspera", etiqueta: "En espera" },
  { id: "enAtencion", etiqueta: "En atención" },
  { id: "atendida", etiqueta: "Atendidas" },
  { id: "noAsistio", etiqueta: "No efectuadas" },
  { id: "cancelada", etiqueta: "Canceladas" },
]

// Periodos de la Lista, los mismos que las vistas Semana y Mes: un día, una semana (de lunes a domingo) o un mes, que se
// mueven con las flechas de la barra. El rango libre de fechas es un filtro del panel "Filtrar". "Todas" está
// siempre, en su lugar: un control no aparece y desaparece según el periodo elegido (regla 1). Con "Todas" no hay flechas: no hay periodo que mover.
export const periodosFiltro = () => [
  { id: "hoy", etiqueta: "Hoy" },
  { id: "semana", etiqueta: "Esta semana" },
  { id: "mes", etiqueta: "Este mes" },
  { id: "todas", etiqueta: "Todas" },
]

// Grupo "Tarea" del panel Filtrar: el atajo por tarea de recepción. "Para reagendar" = las citas no efectuadas o canceladas por el paciente, sin cita nueva.
// Elegirlo reemplaza al periodo de la Lista; "Todas" (la primera opción) vuelve al periodo. (La confirmación de la cita por el paciente ya no existe: no hay "por confirmar".)
export const tareasFiltro = () => [
  { id: "ninguna", etiqueta: "Todas" },
  { id: "reagendar", etiqueta: "Para reagendar" },
]

export const ORIGENES_FILTRO = [
  { id: "todos", etiqueta: "Todos" },
  { id: "paciente", etiqueta: "Web" },
  { id: "staff", etiqueta: "Recepción" },
]

export const SEGUIMIENTO_FILTRO = [
  { id: "todos", etiqueta: "Todos" },
  { id: "primera", etiqueta: "Primera vez" },
  { id: "seguimiento", etiqueta: "Seguimiento" },
]

// Estados cuyo historial interesa de la más reciente a la más antigua, sin
// esconder lo pasado en "Anteriores".
export const ESTADOS_DE_HISTORIAL = ["atendida", "cancelada", "noAsistio"]

// Primera vez = el paciente no tenía ninguna atención registrada antes de esta
// cita. La consulta de la propia cita no cuenta, así que la etiqueta no
// desaparece cuando la cita se atiende ni cuando se agenda otra después. Una
// cita sin paciente vinculado no tiene historial: es primera vez.
export function esPrimeraVez(cita, consultas = []) {
  if (!cita.pacienteId) return true
  return !consultas.some(
    (c) => c.pacienteId === cita.pacienteId && c.citaId !== cita.id && c.fecha && c.fecha <= cita.fecha,
  )
}

// Solo se cancela lo que todavía no empezó: no lo atendido, ni lo cancelado, ni lo no efectuado (queda como registro
// de cita no efectuada), ni lo que está en atención (ahí se "deja de atender").
export const puedeCancelarCita = (cita) => ["Pendiente", "En Espera"].includes(cita.estado)

// Qué acciones ofrece cada estado. Atender solo tiene sentido en lo que sigue abierto; una cita ya atendida o
// cancelada no se edita; una no efectuada solo muestra su estado y ofrece agendar otra.
export const puedeAtenderCita = (cita) => ["Pendiente", "En Espera", "En Atención"].includes(cita.estado)
// «Atender» (o «Seguir atendiendo») aparece en TODA cita abierta: la de hoy entra directo; la de otro día (el paciente llegó antes, o una pendiente de un día
// anterior) pide confirmación y se mueve a hoy. La misma regla en la Agenda, el perfil del paciente (cabecera y pestaña Citas), el detalle de la cita y el Inicio.
// El segundo parámetro (hoy) ya no cambia el resultado; se conserva para no tocar a quien llama.
export const puedeIngresarCita = (cita) => puedeAtenderCita(cita)
// Una cita de otro día (la de mañana que se atiende hoy, o una de ayer) pide una confirmación antes de entrar a la ficha: «Esta cita es del 24 de octubre.
// ¿Atenderla hoy?» y, al confirmar, se mueve a hoy a la hora actual. Las de hoy entran directo, y seguir una atención abierta no pregunta.
export const requiereConfirmarOtroDia = (cita, hoy) => cita.estado !== "En Atención" && Boolean(cita.fecha) && cita.fecha !== hoy
export const puedeEditarCita = (cita) => !["Atendida", "Cancelada", "No Asistió"].includes(cita.estado)
export const puedeAgendarOtraCita = (cita) => ["No Asistió", "Atendida"].includes(cita.estado)

export function coincideEstado(cita, estado) {
  switch (estado) {
    case "pendiente": return cita.estado === "Pendiente"
    case "enEspera": return cita.estado === "En Espera"
    case "enAtencion": return cita.estado === "En Atención"
    case "atendida": return cita.estado === "Atendida"
    case "cancelada": return cita.estado === "Cancelada"
    case "noAsistio": return cita.estado === "No Asistió"
    // Lo que sigue por atender (pendiente, en espera y en atención): solo se llega desde Reportes, no es una opción del panel.
    case "abiertas": return ["Pendiente", "En Espera", "En Atención"].includes(cita.estado)
    default: return true
  }
}

export const coincideOrigen = (cita, origen) => origen === "todos" || cita.origen === origen

export function coincideSeguimiento(cita, seguimiento, consultas = []) {
  if (seguimiento === "todos") return true
  return esPrimeraVez(cita, consultas) === (seguimiento === "primera")
}

// Responsable de una cita: quien la atendió y, mientras no se atiende, a quien está asignada (lo mismo que dice la
// tarjeta: "Atendió: …" o "Asignada a: …"). Cada cita tiene uno solo, así que los resultados por persona no se repiten.
export const responsableDeCita = (cita) => cita.atendidoPor || cita.asignadoA || null

// Filtro por responsable (solo el administrador lo usa): "todos", "ninguno" (la cita no tiene a nadie) o el id de
// una persona del equipo.
export function coincideResponsable(cita, valor) {
  if (valor === "todos") return true
  const responsable = responsableDeCita(cita)
  return valor === "ninguno" ? responsable === null : responsable === valor
}

// ── Filtros combinados y conteos que los reflejan ──
// Una cita cancelada NO desaparece (reunión del 20 oct.): "Todas" las incluye, atenuadas y tachadas, en Lista, Semana y Mes, y "Canceladas" las deja solas.
// Los conteos las dicen aparte («16 citas · 2 canceladas»): no suman a las citas del periodo.
export const coincideEstadoVisible = (cita, estado) => (estado === "todas" ? true : coincideEstado(cita, estado))

// Búsqueda por nombre del paciente o código de la cita (el que recibe al reservar en línea).
export function coincideTexto(cita, texto) {
  const t = (texto || "").trim().toLowerCase()
  return !t || (cita.paciente || "").toLowerCase().includes(t) || (cita.codigo || "").toLowerCase().includes(t)
}

// f = { estado, origen, seguimiento, responsable, texto, periodo, ventana, rangos, idsReagendar }
//   rangos: { hoy, semana, mes } — cada uno { desde, hasta }: el día, la semana y el mes que se están viendo en la Lista.
//   periodo: { filtro: "hoy" | "semana" | "mes" | "reagendar" | "todas", desde, hasta } — solo la Lista; un rango (desde/hasta) manda sobre `filtro`.
//   ventana: { desde, hasta } — el periodo visible de Semana y Mes; en Lista es null.
// Cuándo se agendó la cita (no cuándo es): lo que cuenta el "+N este mes" de la tarjeta Citas del Inicio.
export const ALTA_FILTRO = [
  { id: "todas", etiqueta: "Todas" },
  { id: "mes", etiqueta: "Este mes" },
]

export function citaPasaFiltros(cita, f, consultas = []) {
  if (f.ventana && (cita.fecha < f.ventana.desde || cita.fecha > f.ventana.hasta)) return false
  const p = f.periodo
  const buscando = Boolean((f.texto || "").trim())
  // "Para reagendar" incluye canceladas y no asistidas aunque el estado esté en "Todas"; con búsqueda no rige el periodo.
  const paraReagendar = !f.ventana && !buscando && p && !p.desde && !p.hasta && p.filtro === "reagendar"
  if (!paraReagendar && !coincideEstadoVisible(cita, f.estado)) return false
  if (f.alta === "mes" && !esDeEsteMes(cita.creadoEn)) return false
  if (f.motivo && (cita.motivo || "").trim() !== f.motivo) return false
  if (!coincideOrigen(cita, f.origen)) return false
  if (!coincideSeguimiento(cita, f.seguimiento, consultas)) return false
  if (!coincideResponsable(cita, f.responsable)) return false
  if (!coincideTexto(cita, f.texto)) return false
  // La búsqueda mira todas las fechas: el periodo elegido no la limita (al borrarla, vuelve).
  if (!f.ventana && p && !buscando) {
    const { filtro, desde, hasta } = p
    if (desde || hasta) return (!desde || cita.fecha >= desde) && (!hasta || cita.fecha <= hasta)
    if (filtro === "hoy" && !f.rangos?.hoy) return esHoy(cita.fecha)
    if (filtro === "hoy" || filtro === "semana" || filtro === "mes") { const r = f.rangos?.[filtro]; return Boolean(r) && cita.fecha >= r.desde && cita.fecha <= r.hasta }
    if (filtro === "reagendar") return Boolean(f.idsReagendar?.has(cita.id))
  }
  return true
}

// Cuántas citas habría si se cambiara un filtro (`cambios`), con todos los demás aplicados.
export const contarCon = (citas, f, consultas, cambios) => {
  const g = { ...f, ...cambios }
  return citas.reduce((n, c) => n + (citaPasaFiltros(c, g, consultas) ? 1 : 0), 0)
}

// Denominador de "Mostrando X de Y": las citas del alcance sin ningún filtro del usuario (en Semana y Mes, las del
// periodo visible), canceladas incluidas.
export const totalDelAlcance = (citas, f) =>
  citas.reduce((n, c) => (f.ventana && (c.fecha < f.ventana.desde || c.fecha > f.ventana.hasta) ? n : n + 1), 0)

// «16 citas» y, si las hay, « · 2 canceladas»: las canceladas se cuentan aparte, nunca dentro de las citas.
export function textoConteoCitas(lista, sufijo = "") {
  const canceladas = lista.filter((c) => c.estado === "Cancelada").length
  const citas = lista.length - canceladas
  return `${citas} ${citas === 1 ? "cita" : "citas"}${sufijo}${canceladas > 0 ? ` · ${canceladas} ${canceladas === 1 ? "cancelada" : "canceladas"}` : ""}`
}
