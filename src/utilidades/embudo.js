// Embudo de ventas (R40): cuántos consultaron, cuántos pasaron a venta, cuántos compraron,
// cuántos no compraron (y por qué) y qué pasó con las proformas entregadas.
// Cohorte: las consultas del período y los pases que salieron de ellas, así cada paso del embudo
// es un subconjunto del anterior (no hay más ventas que consultas).
// "Compró" sale de las ventas reales: una consulta cuyo comprobante de venta (facturas_venta) no está anulado,
// o cuyo pase quedó "vendido" sin que su comprobante se haya anulado. Así coincide con Ventas y con Ingresos.
import { MOTIVOS_NO_COMPRO } from "./pasesVenta"
import { esPrimeraVez } from "./filtrosCitas"

const pct = (parte, total) => (total > 0 ? Math.round((parte / total) * 100) : null)

// Primera vez (R40): la consulta no tiene otra anterior del mismo paciente. Se mira en `historial` (todas las
// consultas, sin el filtro por motivo) para que filtrar no convierta a un paciente antiguo en "primera vez".
// esPrimeraVez trabaja con citas: se le pasa la consulta con la forma de una (id de su cita, paciente, fecha).
const consultaEsPrimeraVez = (c, historial) =>
  esPrimeraVez({ id: c.citaId ?? `consulta:${c.id}`, pacienteId: c.pacienteId, fecha: c.fecha }, historial.filter((o) => o.id !== c.id))

export function calcularEmbudo({ consultas = [], pases = [], facturas = [], enRango, historial = consultas }) {
  const delPeriodo = consultas.filter((c) => enRango(c.fecha))
  const consultaron = delPeriodo.length
  const ids = new Set(delPeriodo.map((c) => c.id))
  const cohorte = pases.filter((p) => ids.has(p.consultaId))
  const conFactura = new Set(facturas.filter((f) => f.consultaId).map((f) => f.consultaId))
  const conFacturaVigente = new Set(facturas.filter((f) => f.consultaId && f.estado !== "anulada").map((f) => f.consultaId))
  const idsCompra = new Set()
  for (const id of ids) if (conFacturaVigente.has(id)) idsCompra.add(id)
  for (const p of cohorte) if (p.estado === "vendido" && (!conFactura.has(p.consultaId) || conFacturaVigente.has(p.consultaId))) idsCompra.add(p.consultaId)
  const compraron = idsCompra.size
  const idsPasaron = new Set([...cohorte.map((p) => p.consultaId), ...idsCompra])
  const descartados = cohorte.filter((p) => p.estado === "descartado" && !idsCompra.has(p.consultaId))
  const enEspera = cohorte.filter((p) => p.estado === "listo" && !idsCompra.has(p.consultaId)).length
  const proformas = cohorte.filter((p) => p.proformaEntregadaEn)
  const proformasEnVenta = proformas.filter((p) => idsCompra.has(p.consultaId)).length
  const idsPrimeraVez = new Set(delPeriodo.filter((c) => consultaEsPrimeraVez(c, historial)).map((c) => c.id))
  const primeraVez = idsPrimeraVez.size
  const compraronPrimeraVez = [...idsCompra].filter((id) => idsPrimeraVez.has(id)).length
  return {
    consultaron,
    primeraVez,
    yaEranPacientes: consultaron - primeraVez,
    compraronPrimeraVez,
    compraronPrimeraVezSobrePrimeraVez: pct(compraronPrimeraVez, primeraVez),
    pasaron: idsPasaron.size,
    compraron,
    compraronSobreConsultaron: pct(compraron, consultaron),
    noCompraron: descartados.length,
    enEspera,
    pasaronSobreConsultaron: pct(idsPasaron.size, consultaron),
    compraronSobrePasaron: pct(compraron, idsPasaron.size),
    motivos: MOTIVOS_NO_COMPRO.map((m) => ({ id: m.id, etiqueta: m.etiqueta, cantidad: descartados.filter((p) => p.motivoDescarte === m.id).length })),
    proformas: proformas.length,
    proformasEnVenta,
    proformasSobreVenta: pct(proformasEnVenta, proformas.length),
  }
}
