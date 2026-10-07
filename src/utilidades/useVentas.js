import { useMemo, useState } from "react"
import { supabase } from "../lib/supabaseClient"
import { MENSAJE_SIN_PERMISO, esErrorSinPermiso } from "./permisos"
import { saldoPacienteFacturas } from "./abonos"
import { saldoVenta, ventasPendientesPaciente } from "./ventas"
import { armarHtmlProforma, imprimirHtml, datosOpticaProforma } from "./proforma"
import { registrarLog } from "./logs"

// Manejadores de venta compartidos por el módulo de Ventas y por el perfil del paciente
// (abonar, anular, crear la orden, registrar la factura electrónica). Antes vivían dentro de
// Pacientes.jsx. El estado de datos (comprobantes, pases, órdenes, abonos) sigue en Dashboard/App
// y llega como props: este hook solo guarda qué modal está abierto y qué hacer al terminar cada uno.
export function useVentas({
  usuario, parametrizacion, pacientes = [], consultas = [], pases = [], setPases, setOrdenesLab,
  facturasVenta = [], setFacturasVenta, abonos = [], ventas = [], setInventario, notificar, avisarError,
}) {
  const [ventaCola, setVentaCola] = useState(null) // { pase, paciente, consulta }
  const [noComproPara, setNoComproPara] = useState(null)
  const [abonoPara, setAbonoPara] = useState(null) // { factura, paciente }
  const [anularPara, setAnularPara] = useState(null)
  const [ordenParaVenta, setOrdenParaVenta] = useState(null) // venta a la que se le crea una orden de laboratorio
  const [facturaElectronicaPara, setFacturaElectronicaPara] = useState(null) // { factura, paciente }
  const [reabriendoId, setReabriendoId] = useState(null)

  // Una venta nueva entra a la lista; si venía de la cola, el pase pasa a "vendido".
  const registrarFactura = (factura) => {
    setFacturasVenta?.((prev) => [factura, ...prev])
    if (factura.consultaId) {
      setPases?.((prev) => prev.map((p) => (p.consultaId === factura.consultaId && p.pacienteId === factura.pacienteId && (p.estado === "listo" || p.estado === "descartado") ? { ...p, estado: "vendido", facturaId: factura.id } : p)))
    }
  }

  const alAbonar = ({ monto, estado, cuotasPagadas }) => {
    const { factura, paciente } = abonoPara
    setFacturasVenta?.((prev) => prev.map((f) => (f.id === factura.id ? { ...f, estado, cuotasPagadas } : f)))
    notificar?.(estado === "pagada" ? `Abono de $${monto.toFixed(2)} registrado: la venta de ${paciente?.nombre || "el paciente"} quedó pagada.` : `Abono de $${monto.toFixed(2)} registrado.`)
  }

  const alAnular = () => {
    const { factura } = anularPara
    setFacturasVenta?.((prev) => prev.map((f) => (f.id === factura.id ? { ...f, estado: "anulada" } : f)))
    // La base repone el stock y cancela las órdenes sin entregar; se refleja aquí sin recargar.
    setInventario?.((prev) => prev.map((p) => {
      const linea = (factura.lineas || []).find((l) => l.tipo === "producto" && l.productoId === p.id)
      return linea ? { ...p, stock: (Number(p.stock) || 0) + linea.cantidad } : p
    }))
    setOrdenesLab?.((prev) => prev.map((o) => (o.facturaId === factura.id && (o.estado === "enviada" || o.estado === "lista") ? { ...o, estado: "cancelada" } : o)))
    notificar?.("Venta anulada.")
  }

  // Cargar, corregir o quitar el número de la factura electrónica emitida por fuera (nivel "editar" de Ventas).
  const guardarFacturaElectronica = async (factura, numero) => {
    if (supabase) {
      const { error } = await supabase.rpc("registrar_factura_electronica", { p_factura_id: factura.id, p_numero: numero })
      if (error) return { error: esErrorSinPermiso(error) ? MENSAJE_SIN_PERMISO : error.message || "No se pudo guardar el número. Revisa tu conexión e intenta de nuevo." }
    }
    setFacturasVenta?.((prev) => prev.map((f) => (f.id === factura.id ? { ...f, facturaElectronica: numero } : f)))
    registrarLog(usuario, "pacientes", numero ? "Registró la factura electrónica de una venta" : "Quitó la factura electrónica de una venta", numero || "")
    notificar?.(numero ? "Número de factura electrónica guardado." : "Se quitó el número de factura electrónica.")
    return { error: null }
  }

  const construirCola = (estado) => pases
    .filter((p) => p.estado === estado)
    .map((pase) => ({ pase, paciente: pacientes.find((x) => x.id === pase.pacienteId) || null, consulta: consultas.find((c) => c.id === pase.consultaId) || null }))
    .sort((a, b) => (estado === "listo" ? (a.pase.pasadaEn < b.pase.pasadaEn ? -1 : 1) : (a.pase.pasadaEn < b.pase.pasadaEn ? 1 : -1)))
  const colaListos = useMemo(() => construirCola("listo"), [pases, pacientes, consultas]) // eslint-disable-line react-hooks/exhaustive-deps
  const colaDescartados = useMemo(() => construirCola("descartado"), [pases, pacientes, consultas]) // eslint-disable-line react-hooks/exhaustive-deps

  // La proforma no se guarda como documento: el pase solo anota cuándo se entregó y por cuánto.
  const imprimirProformaCola = async ({ lineas, total, incluirMedidas }) => {
    const item = ventaCola
    if (!item) return
    if (supabase) {
      const { data, error } = await supabase.rpc("registrar_proforma", { p_pase_id: item.pase.id, p_total: total })
      if (error) {
        avisarError?.(esErrorSinPermiso(error) ? MENSAJE_SIN_PERMISO : "No se pudo registrar la proforma. Revisa tu conexión e intenta de nuevo.")
        return
      }
      setPases?.((prev) => prev.map((p) => (p.id === item.pase.id ? { ...p, proformaEntregadaEn: data, proformaTotal: total } : p)))
    }
    imprimirHtml(armarHtmlProforma({
      opticaNombre: usuario?.opticaNombre,
      opticaDatos: datosOpticaProforma(parametrizacion),
      paciente: item.paciente,
      diagnostico: item.consulta,
      lineas: lineas.map((l) => ({ descripcion: l.descripcion, cantidad: l.cantidad, precioUnitario: l.precioUnitario })),
      incluirMedidas,
    }))
    notificar?.("Proforma registrada e impresa.")
  }

  const alVenderDesdeCola = (factura) => {
    registrarFactura(factura)
    notificar?.(`Venta registrada: ${ventaCola?.paciente?.nombre || "el paciente"} salió de la lista de espera.`)
  }

  const reabrirPase = async ({ pase, paciente }) => {
    setReabriendoId(pase.id)
    const { error } = supabase ? await supabase.rpc("reabrir_pase", { p_pase_id: pase.id }) : { error: null }
    setReabriendoId(null)
    if (error) {
      avisarError?.(esErrorSinPermiso(error) ? MENSAJE_SIN_PERMISO : "No se pudo volver a la lista de espera. Revisa tu conexión e intenta de nuevo.")
      return
    }
    setPases?.((prev) => prev.map((p) => (p.id === pase.id ? { ...p, estado: "listo", motivoDescarte: null, detalleDescarte: null } : p)))
    notificar?.(`${paciente?.nombre || "El paciente"} volvió a la lista de espera.`)
  }

  const alNoComprar = ({ motivo, detalle }) => {
    const item = noComproPara
    setPases?.((prev) => prev.map((p) => (p.id === item.pase.id ? { ...p, estado: "descartado", motivoDescarte: motivo, detalleDescarte: detalle } : p)))
    setNoComproPara(null)
    notificar?.("Quedó registrado: el paciente no compró.")
  }

  // Deuda total de un paciente: comprobantes con saldo más las ventas viejas pendientes.
  const saldoDe = (pacienteId) => saldoPacienteFacturas(pacienteId, facturasVenta, abonos) + ventasPendientesPaciente(ventas, pacienteId).reduce((a, v) => a + saldoVenta(v), 0)

  return {
    ventaCola, setVentaCola, noComproPara, setNoComproPara, abonoPara, setAbonoPara, anularPara, setAnularPara,
    ordenParaVenta, setOrdenParaVenta, facturaElectronicaPara, setFacturaElectronicaPara, reabriendoId,
    colaListos, colaDescartados, saldoDe,
    registrarFactura, alAbonar, alAnular, guardarFacturaElectronica, imprimirProformaCola, alVenderDesdeCola, reabrirPase, alNoComprar,
  }
}
