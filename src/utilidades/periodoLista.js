// El período de una lista (Hoy · Esta semana · Este mes · Todas, o un rango de fechas) con sus flechas ‹ ›: el mismo de la Lista de Citas,
// ahora también en los comprobantes y en "Cobrado hoy". Lógica pura; los días son de Ecuador.
import { fechaAISO, isoAFechaLocal, hoyISO } from "./disponibilidad"
import { sumarDiasISO } from "./controles"
import { lunesDeSemana } from "./calendarioSemana"
import { formatoFecha, tituloSemana } from "./formatoFecha"
import { aEcuador } from "./horaEcuador"

export const PERIODO_INICIAL = { filtro: "todas", ref: "", desde: "", hasta: "" } // ref "" = hoy

export const hayRango = (p) => Boolean(p.desde || p.hasta)
const refDe = (p, hoy) => p.ref || hoy

// Los días que abarca el período, o null si abarca todas las fechas.
export function rangoDelPeriodo(p, hoy = hoyISO()) {
  if (hayRango(p)) return { desde: p.desde || p.hasta, hasta: p.hasta || p.desde }
  const ref = refDe(p, hoy)
  if (p.filtro === "hoy") return { desde: ref, hasta: ref }
  if (p.filtro === "semana") { const l = lunesDeSemana(ref); return { desde: l, hasta: sumarDiasISO(l, 6) } }
  if (p.filtro === "mes") { const d = isoAFechaLocal(ref); return { desde: fechaAISO(new Date(d.getFullYear(), d.getMonth(), 1)), hasta: fechaAISO(new Date(d.getFullYear(), d.getMonth() + 1, 0)) } }
  return null
}

// El día (de Ecuador) al que pertenece un registro: una fecha sola se queda tal cual; un instante se pasa a la hora de Ecuador.
export function diaDeRegistro(valor) {
  if (!valor) return ""
  const s = String(valor)
  if (!s.includes("T")) return s.slice(0, 10)
  const f = aEcuador(valor)
  return f ? fechaAISO(f) : ""
}

export function enPeriodo(valor, p, hoy = hoyISO()) {
  const rango = rangoDelPeriodo(p, hoy)
  if (!rango) return true
  const dia = diaDeRegistro(valor)
  return Boolean(dia) && dia >= rango.desde && dia <= rango.hasta
}

// Las flechas: un día, una semana o un mes; un rango libre se mueve de a una semana. Con todas las fechas no hay nada que mover.
export function moverPeriodo(p, sentido, hoy = hoyISO()) {
  if (hayRango(p)) {
    const desde = p.desde || p.hasta
    const hasta = p.hasta || sumarDiasISO(desde, 6)
    return { ...p, desde: sumarDiasISO(desde, 7 * sentido), hasta: sumarDiasISO(hasta, 7 * sentido) }
  }
  const ref = refDe(p, hoy)
  if (p.filtro === "hoy") return { ...p, ref: sumarDiasISO(ref, sentido) }
  if (p.filtro === "semana") return { ...p, ref: sumarDiasISO(ref, 7 * sentido) }
  if (p.filtro === "mes") { const d = isoAFechaLocal(ref); return { ...p, ref: fechaAISO(new Date(d.getFullYear(), d.getMonth() + sentido, 1)) } }
  return p
}

// "Hoy · jue 8 oct 2026", "5 – 11 oct 2026", "Octubre 2026" o "Todas las fechas".
export function tituloDelPeriodo(p, hoy = hoyISO()) {
  if (hayRango(p)) return p.desde && p.hasta ? tituloSemana(p.desde, p.hasta) : p.desde ? `Desde el ${formatoFecha(p.desde, "medio")}` : `Hasta el ${formatoFecha(p.hasta, "medio")}`
  const ref = refDe(p, hoy)
  if (p.filtro === "hoy") return `${ref === hoy ? "Hoy · " : ""}${formatoFecha(ref, "corto")}`
  if (p.filtro === "semana") { const r = rangoDelPeriodo(p, hoy); return tituloSemana(r.desde, r.hasta) }
  if (p.filtro === "mes") return formatoFecha(ref, "mesAnio")
  return "Todas las fechas"
}

// Lo que necesita el calendario del título (NavegadorPeriodo): qué se resalta y qué pasa al elegir una fecha.
export function selectorDelPeriodo(p, cambiar, hoy = hoyISO()) {
  const rango = rangoDelPeriodo(p, hoy)
  const unidad = hayRango(p) ? "dia" : p.filtro === "semana" ? "semana" : p.filtro === "mes" ? "mes" : "dia"
  return {
    unidad,
    visible: rango || { desde: hoy, hasta: hoy },
    onElegir: (iso, tipo) => cambiar({ filtro: tipo === "mes" ? "mes" : hayRango(p) || !["hoy", "semana", "mes"].includes(p.filtro) ? "hoy" : p.filtro, ref: iso, desde: "", hasta: "" }),
  }
}

// Un período que llega de otro módulo: un rango de fechas (Reportes), "mes" (Inicio) o nada.
export function periodoDeDestino({ periodo, desde, hasta } = {}) {
  if (desde || hasta) return { filtro: "todas", ref: "", desde: desde || "", hasta: hasta || "" }
  if (periodo === "mes") return { filtro: "mes", ref: "", desde: "", hasta: "" }
  return PERIODO_INICIAL
}
