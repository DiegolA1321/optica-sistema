// Cobro pendiente (Ronda 4 del flujo de atención): el panel de cobro tiene
// "Más tarde", que deja la ficha guardada y la cita "En atención". No hay
// columna propia — se deduce de los datos que ya existen:
//
//  • Una consulta ligada a una cita que sigue "En Atención" y sin factura
//    vinculada (consulta_id) tiene el cobro pendiente. (Cubre también el caso
//    de un cobro que falló.)
//  • Una consulta sin cita (ficha abierta desde el perfil) y sin factura
//    cuenta como pendiente solo si se creó desde INICIO_COBRO_PENDIENTE: las
//    fichas anteriores no tenían este flujo y no son "deuda" real.
export const INICIO_COBRO_PENDIENTE = "2026-09-30"

export function cobrosPendientes(consultas = [], facturasVenta = [], citas = []) {
  const conFactura = new Set(facturasVenta.filter((f) => f.consultaId && f.estado !== "anulada").map((f) => f.consultaId))
  const citaPorId = new Map(citas.map((c) => [c.id, c]))
  const out = []
  for (const consulta of consultas) {
    if (!consulta.id || conFactura.has(consulta.id)) continue
    if (consulta.citaId) {
      const cita = citaPorId.get(consulta.citaId)
      if (cita && cita.estado === "En Atención") out.push({ consulta, cita })
    } else if ((consulta.creadoEn || "").slice(0, 10) >= INICIO_COBRO_PENDIENTE) {
      out.push({ consulta, cita: null })
    }
  }
  return out
}

// Marca la cita como Atendida (regla: solo cuando el cobro tuvo éxito).
export async function marcarCitaAtendidaDb(supabase, citaId) {
  if (!supabase || !citaId) return { error: null }
  const { error } = await supabase.from("citas").update({ estado: "Atendida" }).eq("id", citaId)
  return { error }
}
