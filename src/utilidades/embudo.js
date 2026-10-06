// Embudo de ventas (R40): cuántos consultaron, cuántos pasaron a venta, cuántos compraron,
// cuántos no compraron (y por qué) y qué pasó con las proformas entregadas.
// Cohorte: las consultas del período y los pases que salieron de ellas, así cada paso del embudo
// es un subconjunto del anterior (no hay más ventas que consultas).
import { MOTIVOS_NO_COMPRO } from "./pasesVenta"

const pct = (parte, total) => (total > 0 ? Math.round((parte / total) * 100) : null)

export function calcularEmbudo({ consultas = [], pases = [], enRango }) {
  const delPeriodo = consultas.filter((c) => enRango(c.fecha))
  const consultaron = delPeriodo.length
  const ids = new Set(delPeriodo.map((c) => c.id))
  const cohorte = pases.filter((p) => ids.has(p.consultaId))
  const compraron = cohorte.filter((p) => p.estado === "vendido").length
  const descartados = cohorte.filter((p) => p.estado === "descartado")
  const enEspera = cohorte.filter((p) => p.estado === "listo").length
  const proformas = cohorte.filter((p) => p.proformaEntregadaEn)
  const proformasEnVenta = proformas.filter((p) => p.estado === "vendido").length
  return {
    consultaron,
    pasaron: cohorte.length,
    compraron,
    noCompraron: descartados.length,
    enEspera,
    pasaronSobreConsultaron: pct(cohorte.length, consultaron),
    compraronSobrePasaron: pct(compraron, cohorte.length),
    motivos: MOTIVOS_NO_COMPRO.map((m) => ({ id: m.id, etiqueta: m.etiqueta, cantidad: descartados.filter((p) => p.motivoDescarte === m.id).length })),
    proformas: proformas.length,
    proformasEnVenta,
    proformasSobreVenta: pct(proformasEnVenta, proformas.length),
  }
}
