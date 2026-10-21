import { useCallback, useEffect, useState } from "react"
import { misCompras } from "../../utilidades/facturaElectronicaApi"
import { misOrdenes, miControl, misCitasDetalle, calificarAtencion, misReferidos, marcarCitaEnCalendario, misSolicitudesLentes, solicitarLentes, misMedidas, misDatosTransferencia, reportarPagoTransferencia } from "../../utilidades/portalDatos"

// Compras (con su saldo), órdenes de laboratorio, control y detalle de las citas del paciente, pedidos una sola vez para todo el portal (Resumen, Mis citas y Mis compras
// leen lo mismo). `citas` son las citas del paciente: el detalle se pide cuando cambian. calificar actualiza la pantalla al instante.
export function usePortalDatos(usuario, citas = []) {
  const pacienteId = typeof usuario?.id === "string" ? usuario.id : null
  const token = usuario?.token
  const [estado, setEstado] = useState({ cargando: true, compras: [], errorCompras: "", ordenes: [], control: null, referidos: 0 })
  const [detalle, setDetalle] = useState({ disponible: false, porCita: {} })
  const [solicitudes, setSolicitudes] = useState({ disponible: false, lista: [] })
  const [medidas, setMedidas] = useState(null)
  const [transferencia, setTransferencia] = useState({ disponible: false, datos: null, pagos: [] })
  useEffect(() => {
    let vivo = true
    Promise.all([misCompras(pacienteId, token), misOrdenes(pacienteId, token), miControl(pacienteId, token), misReferidos(pacienteId, token), misSolicitudesLentes(pacienteId, token), misDatosTransferencia(pacienteId, token), misMedidas(pacienteId, token)]).then(([c, o, k, r, s, t, m]) => {
      if (!vivo) return
      setEstado({ cargando: false, compras: c.compras, errorCompras: c.error || "", ordenes: o.ordenes, control: k, referidos: r })
      setSolicitudes(s)
      setTransferencia(t)
      setMedidas(m)
    })
    return () => { vivo = false }
  }, [pacienteId, token])
  const clave = citas.map((c) => c.id + c.estado).join("|")
  useEffect(() => {
    let vivo = true
    misCitasDetalle(pacienteId, token, citas).then((d) => { if (vivo) setDetalle(d) })
    return () => { vivo = false }
  }, [pacienteId, token, clave]) // eslint-disable-line react-hooks/exhaustive-deps

  const calificar = useCallback(async (citaId, puntaje, comentario) => {
    const r = await calificarAtencion(pacienteId, token, citaId, puntaje, comentario)
    if (r.ok) setDetalle((d) => ({ ...d, porCita: { ...d.porCita, [citaId]: { ...(d.porCita[citaId] || {}), calificacion: { puntaje, comentario: comentario || null } } } }))
    return r
  }, [pacienteId, token])

  // «Agregada a tu calendario»: se guarda en la base por cita (vale en todos sus aparatos) y la pantalla cambia al instante.
  const agregarAlCalendario = useCallback(async (citaId) => {
    setDetalle((d) => ({ ...d, porCita: { ...d.porCita, [citaId]: { ...(d.porCita[citaId] || {}), enCalendarioAt: new Date().toISOString() } } }))
    const r = await marcarCitaEnCalendario(pacienteId, token, citaId)
    return r
  }, [pacienteId, token])

  // «Solicitar lentes nuevos»: se envía y la lista se vuelve a pedir (así aparece con su estado).
  const solicitar = useCallback(async (interes, comentario) => {
    const r = await solicitarLentes(pacienteId, token, interes, comentario)
    if (r.ok) setSolicitudes(await misSolicitudesLentes(pacienteId, token))
    return r
  }, [pacienteId, token])

  // «Pagar por transferencia»: se envía el comprobante y se vuelve a pedir la lista (así aparece «Pago en verificación»).
  const reportarPago = useCallback(async (datos) => {
    const r = await reportarPagoTransferencia(pacienteId, token, datos)
    if (r.ok) setTransferencia(await misDatosTransferencia(pacienteId, token))
    return r
  }, [pacienteId, token])

  // «Solicitar medidas»: tras pedirlas se vuelve a preguntar (así «Solicitud enviada» sale de la base, no solo de la memoria).
  const recargarMedidas = useCallback(async () => setMedidas(await misMedidas(pacienteId, token)), [pacienteId, token])

  return { ...estado, medidas, recargarMedidas, detalle, solicitudes, solicitar, transferencia, reportarPago, calificar, agregarAlCalendario }
}
