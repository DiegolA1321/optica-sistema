import { dinero } from "./formatoMoneda"
import { useState } from "react"
import { supabase } from "../lib/supabaseClient"
import { MENSAJE_SIN_PERMISO, esErrorSinPermiso } from "./permisos"
import { saldoPacienteFacturas } from "./abonos"
import { saldoVenta, ventasPendientesPaciente } from "./ventas"
import { armarHtmlProforma, imprimirHtml, datosOpticaProforma } from "./proforma"
import { registrarLog } from "./logs"
import { EVENTO_FE_CAMBIADA } from "./facturaElectronicaApi"
import { numeroComprobante } from "./comprobantes"

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
  const [corregirAbonoPara, setCorregirAbonoPara] = useState(null) // { abono, factura, paciente }

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
    notificar?.(estado === "pagada" ? `Abono de ${dinero(monto)} registrado: la venta de ${paciente?.nombre || "el paciente"} quedó pagada.` : `Abono de ${dinero(monto)} registrado.`)
  }

  // Corregir o anular un abono: la base ya recalculó el saldo y el estado de la venta; aquí se refleja sin recargar.
  const alCorregirAbono = ({ anulado, estado, cuotasPagadas }) => {
    const { factura } = corregirAbonoPara
    setFacturasVenta?.((prev) => prev.map((f) => (f.id === factura.id ? { ...f, estado, cuotasPagadas } : f)))
    notificar?.(anulado ? "Abono anulado. El saldo de la venta se recalculó." : "Abono corregido. El saldo de la venta se recalculó.")
  }

  const alAnular = ({ motivo } = {}) => {
    const { factura } = anularPara
    setFacturasVenta?.((prev) => prev.map((f) => (f.id === factura.id ? { ...f, estado: "anulada", anuladaMotivo: motivo || "", anuladaEn: new Date().toISOString(), anuladaPor: usuario?.id || null } : f)))
    // La base repone el stock y cancela las órdenes sin entregar; se refleja aquí sin recargar.
    setInventario?.((prev) => prev.map((p) => {
      const linea = (factura.lineas || []).find((l) => l.tipo === "producto" && l.productoId === p.id)
      return linea ? { ...p, stock: (Number(p.stock) || 0) + linea.cantidad } : p
    }))
    setOrdenesLab?.((prev) => prev.map((o) => (o.facturaId === factura.id && (o.estado === "enviada" || o.estado === "lista") ? { ...o, estado: "cancelada" } : o)))
    notificar?.("Venta anulada.")
  }

  // La ventana de la factura electrónica ya guardó todo (número, clave, fecha y archivos) con la base; aquí se refleja y se anota (nivel "editar" de Ventas).
  const alGuardarFacturaElectronica = ({ numero, conArchivos }) => {
    const { factura } = facturaElectronicaPara
    setFacturasVenta?.((prev) => prev.map((f) => (f.id === factura.id ? { ...f, facturaElectronica: numero } : f)))
    registrarLog(usuario, "ventas", numero ? "Registró la factura electrónica de una venta" : "Quitó la factura electrónica de una venta", `${numeroComprobante(factura.numero)}${numero ? ` · ${numero}` : ""}${conArchivos ? " · con archivos" : ""}`)
    notificar?.(numero ? "Factura electrónica guardada." : "Se quitó el número de factura electrónica.")
    window.dispatchEvent(new CustomEvent(EVENTO_FE_CAMBIADA, { detail: factura.id })) // el detalle del comprobante vuelve a leer sus archivos
  }

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
      setPases?.((prev) => prev.map((p) => (p.id === item.pase.id ? { ...p, proformaEntregadaEn: data, proformaTotal: total, enAtencionEn: p.enAtencionEn || data } : p)))
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

  // Al usar el último diagnóstico como guía de una venta, una solicitud del portal se marca «En atención» (lo ve el paciente en su portal). Devuelve false si no se pudo.
  const tomarSolicitud = async (pase) => {
    if (!pase || pase.origen !== "portal" || pase.enAtencionEn || !supabase) return true
    const { data, error } = await supabase.rpc("tomar_solicitud_portal", { p_pase_id: pase.id })
    if (error) { avisarError?.(esErrorSinPermiso(error) ? MENSAJE_SIN_PERMISO : "No se pudo tomar la solicitud. Revisa tu conexión e intenta de nuevo."); return false }
    setPases?.((prev) => prev.map((p) => (p.id === pase.id ? { ...p, enAtencionEn: data } : p)))
    return true
  }

  const alVenderDesdeCola = (factura) => {
    registrarFactura(factura)
    notificar?.(`Venta registrada: ${ventaCola?.paciente?.nombre || "el paciente"} salió de la lista de espera.`)
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
    ordenParaVenta, setOrdenParaVenta, facturaElectronicaPara, setFacturaElectronicaPara, corregirAbonoPara, setCorregirAbonoPara,
    saldoDe,
    registrarFactura, alAbonar, alCorregirAbono, alAnular, alGuardarFacturaElectronica, imprimirProformaCola, tomarSolicitud, alVenderDesdeCola, alNoComprar,
  }
}
