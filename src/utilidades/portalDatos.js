// Lo que el portal le pide a la base sobre los lentes, el control y el detalle de las citas del paciente (migraciones 0123 y 0125). Mismo token de sesión que las demás
// funciones del portal. Si una función todavía no existe o algo falla, simplemente no hay ese dato que mostrar: el resto del portal sigue igual.
import { supabase } from "../lib/supabaseClient"
import { mapOrdenPaciente } from "./portalPaciente"

// Con ?_muestra=detalle (solo en desarrollo) el detalle de las citas es de ejemplo, para revisar la pantalla antes de aplicar la migración 0125.
export const modoMuestraPortal = () => {
  if (!import.meta.env?.DEV || typeof window === "undefined") return null
  const v = new URLSearchParams(window.location.search).get("_muestra")
  return v === "detalle" ? v : null
}

export async function misOrdenes(pacienteId, token) {
  if (!supabase) return { ordenes: [], disponible: false }
  const { data, error } = await supabase.rpc("mis_ordenes_paciente", { p_paciente_id: pacienteId, p_token: token })
  if (error || !Array.isArray(data)) return { ordenes: [], disponible: false }
  return { ordenes: data.map(mapOrdenPaciente), disponible: true }
}

export async function miControl(pacienteId, token) {
  if (!supabase) return null
  const { data, error } = await supabase.rpc("mi_control_paciente", { p_paciente_id: pacienteId, p_token: token })
  return error || !data ? null : data
}

// { [citaId]: { profesional, confirmadaAt, consultaId, calificacion } } y si la base ya lo entrega.
export async function misCitasDetalle(pacienteId, token, citas = []) {
  if (modoMuestraPortal()) {
    return { disponible: true, porCita: Object.fromEntries(citas.map((c, i) => [c.id, { profesional: "Paula Optómetra Demo", confirmadaAt: null, consultaId: c.estado === "Atendida" ? "muestra-" + i : null, calificacion: null }])) }
  }
  if (!supabase) return { disponible: false, porCita: {} }
  const { data, error } = await supabase.rpc("mis_citas_detalle_paciente", { p_paciente_id: pacienteId, p_token: token })
  if (error || !Array.isArray(data)) return { disponible: false, porCita: {} }
  return { disponible: true, porCita: Object.fromEntries(data.map((d) => [d.cita_id, { profesional: d.profesional || "", confirmadaAt: d.confirmada_at, consultaId: d.consulta_id, calificacion: d.calificacion, enCalendarioAt: d.en_calendario_at || null }])) }
}

export async function confirmarAsistencia(pacienteId, token, citaId) {
  if (modoMuestraPortal()) return { ok: true }
  if (!supabase) return { ok: false, error: "Sin conexión." }
  const { data, error } = await supabase.rpc("confirmar_asistencia_paciente", { p_paciente_id: pacienteId, p_token: token, p_cita_id: citaId })
  return error || data !== true ? { ok: false, error: "No pudimos confirmar tu asistencia. Intenta de nuevo en un momento." } : { ok: true }
}

export async function calificarAtencion(pacienteId, token, citaId, puntaje, comentario) {
  if (modoMuestraPortal()) return { ok: true }
  if (!supabase) return { ok: false, error: "Sin conexión." }
  const { data, error } = await supabase.rpc("calificar_atencion_paciente", { p_paciente_id: pacienteId, p_token: token, p_cita_id: citaId, p_puntaje: puntaje, p_comentario: comentario || null })
  return error || data !== true ? { ok: false, error: "No pudimos guardar tu calificación. Es posible que ya la hayas enviado." } : { ok: true }
}

// Cuántos pacientes refirió este paciente (migración 0128): el único dato de sus puntos que el portal no puede contar solo. Sin la función, 0: los puntos salen solo de sus consultas.
export async function misReferidos(pacienteId, token) {
  if (!supabase) return 0
  const { data, error } = await supabase.rpc("mis_referidos_paciente", { p_paciente_id: pacienteId, p_token: token })
  return error || typeof data !== "number" ? 0 : data
}

// «Solicitar lentes nuevos» (migración 0129). Sin la función, simplemente no se ofrece.
export async function misSolicitudesLentes(pacienteId, token) {
  if (!supabase) return { disponible: false, lista: [] }
  const { data, error } = await supabase.rpc("mis_solicitudes_lentes_paciente", { p_paciente_id: pacienteId, p_token: token })
  if (error || !Array.isArray(data)) return { disponible: false, lista: [] }
  return { disponible: true, lista: data }
}
export async function solicitarLentes(pacienteId, token, interes, comentario) {
  if (!supabase) return { ok: false, error: "Sin conexión." }
  const { error } = await supabase.rpc("solicitar_lentes_paciente", { p_paciente_id: pacienteId, p_token: token, p_interes: interes, p_comentario: comentario || null })
  if (!error) return { ok: true }
  return { ok: false, error: error.code === "P0001" ? error.message : "No pudimos enviar tu solicitud. Intenta de nuevo en un momento." }
}

// Derecho de acceso (ley de protección de datos): el servidor arma el archivo con los datos personales y clínicos del paciente, sin campos internos, y se baja como JSON.
// Lo usan el menú de la cuenta (laptop) y «Mis datos» (celular, que no tiene ese menú). Devuelve { ok, error }.
export async function descargarMisDatosPaciente({ usuario, citas = [], consultas = [], hoy }) {
  let datos
  if (supabase) {
    const { data, error } = await supabase.rpc("exportar_mis_datos_paciente", { p_paciente_id: typeof usuario?.id === "string" ? usuario.id : null, p_token: usuario?.token })
    if (error || !data) return { ok: false, error: "No pudimos preparar tus datos. Intenta de nuevo en un momento." }
    datos = data
  } else {
    datos = { perfil: { nombre: usuario?.nombre, cedula: usuario?.cedula }, citas, consultas, exportado_en: hoy }
  }
  const url = URL.createObjectURL(new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" }))
  const enlace = document.createElement("a")
  enlace.href = url
  enlace.download = "mis-datos-" + hoy + ".json"
  enlace.click()
  URL.revokeObjectURL(url)
  return { ok: true }
}

// Pagar por transferencia (migración 0131): los datos bancarios de la óptica y los pagos que el paciente ya reportó. Sin la función (o sin datos bancarios), no se ofrece.
export async function misDatosTransferencia(pacienteId, token) {
  if (!supabase) return { disponible: false, datos: null, pagos: [] }
  const { data, error } = await supabase.rpc("datos_transferencia_paciente", { p_paciente_id: pacienteId, p_token: token })
  if (error || !data) return { disponible: false, datos: null, pagos: [] }
  return { disponible: Boolean(data.datos_bancarios), datos: data.datos_bancarios || null, pagos: Array.isArray(data.pagos) ? data.pagos.map((p) => ({ id: p.id, facturaId: p.factura_id, monto: Number(p.monto), estado: p.estado, motivoRechazo: p.motivo_rechazo || "", creadoEn: p.creado_en, revisadoEn: p.revisado_en || null })) : [] }
}
export async function reportarPagoTransferencia(pacienteId, token, { facturaId, monto, archivo }) {
  if (!supabase) return { ok: false, error: "Sin conexión." }
  const { error } = await supabase.rpc("reportar_pago_transferencia", { p_paciente_id: pacienteId, p_token: token, p_factura_id: facturaId, p_monto: monto, p_archivo_nombre: archivo.nombre, p_archivo_tipo: archivo.tipo, p_archivo_base64: archivo.base64 })
  if (!error) return { ok: true }
  return { ok: false, error: error.code === "P0001" ? error.message : "No pudimos enviar tu comprobante. Revisa tu conexión e intenta de nuevo." }
}

// Marca en la base que el paciente agregó la cita a su calendario (migración 0127): así vale en todos sus aparatos. Devuelve { ok }.
export async function marcarCitaEnCalendario(pacienteId, token, citaId) {
  if (!supabase) return { ok: false }
  const { data, error } = await supabase.rpc("marcar_cita_en_calendario_paciente", { p_paciente_id: pacienteId, p_token: token, p_cita_id: citaId })
  return { ok: !error && data === true }
}
