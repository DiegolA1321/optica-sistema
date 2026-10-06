// Pases a venta ("Listo para venta"): motivos de "No compró" y ayudas para la
// cola. Lógica pura.
import { fechaAISO, isoAFechaLocal } from "./disponibilidad"

// Los valores son los que acepta descartar_pase() en la base (migración 0086).
export const MOTIVOS_NO_COMPRO = [
  { id: "precio", etiqueta: "Por el precio" },
  { id: "lo_pensara", etiqueta: "Lo pensará" },
  { id: "otro_lugar", etiqueta: "Comprará en otro lugar" },
  { id: "otro", etiqueta: "Otro" },
]

export function etiquetaMotivo(id, detalle) {
  if (id === "otro") return detalle ? `Otro: ${detalle}` : "Otro"
  return MOTIVOS_NO_COMPRO.find((m) => m.id === id)?.etiqueta || ""
}

export const pasesListos = (pases = []) => pases.filter((p) => p.estado === "listo")
export const pasesDescartados = (pases = []) => pases.filter((p) => p.estado === "descartado")

// Días que lleva en espera (0 = pasó hoy).
export function diasEnEspera(pase, hoy = new Date()) {
  if (!pase?.pasadaEn) return 0
  const desde = fechaAISO(new Date(pase.pasadaEn))
  return Math.max(0, Math.round((isoAFechaLocal(fechaAISO(hoy)) - isoAFechaLocal(desde)) / 86400000))
}

export function textoEspera(dias) {
  if (dias === 0) return "Pasó hoy"
  return `Espera desde hace ${dias} día${dias === 1 ? "" : "s"}`
}
