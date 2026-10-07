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

// Diagnóstico de una consulta en una línea: categorías y detalle, sin repetir lo
// que ya dice la categoría ("Miopía" y "Miopía" es "Miopía").
export function textoDiagnostico(consulta) {
  const partes = [consulta?.diagnosticoCategorias?.join(", "), consulta?.diagnostico].map((x) => (x || "").trim()).filter(Boolean)
  // Sin repetir: se descarta una parte si otra la contiene (sin importar mayúsculas ni tildes)
  const norm = (t) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  return partes.filter((p, i) => !partes.some((q, j) => j !== i && (norm(q).includes(norm(p)) && (norm(q) !== norm(p) || j < i)))).join(" · ")
}

// Pacientes que consultaron y no compraron (N4): el último pase de cada paciente está descartado
// ("No compró") y después no hubo un comprobante vigente suyo. Devuelve Map(pacienteId → { motivo, fecha }).
// "Lo pensará" sigue contando: no compró todavía.
export function pacientesQueNoCompraron(pases = [], facturas = []) {
  const ultimo = new Map()
  for (const p of pases) {
    if (!p.pacienteId) continue
    const fecha = p.cerradaEn || p.pasadaEn || ""
    const previo = ultimo.get(p.pacienteId)
    if (!previo || fecha > previo.fecha) ultimo.set(p.pacienteId, { pase: p, fecha })
  }
  const res = new Map()
  for (const [pacienteId, { pase, fecha }] of ultimo) {
    if (pase.estado !== "descartado") continue
    const compro = facturas.some((f) => f.pacienteId === pacienteId && f.estado !== "anulada" && (f.creadoEn || "") > fecha)
    if (compro) continue
    res.set(pacienteId, { motivo: etiquetaMotivo(pase.motivoDescarte, pase.detalleDescarte) || "Sin motivo indicado", fecha })
  }
  return res
}
