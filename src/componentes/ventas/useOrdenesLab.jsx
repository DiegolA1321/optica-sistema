"use client"

import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabaseClient"
import { useEscribirPorWhatsApp } from "../EscribirPorWhatsApp"
import { MENSAJE_SIN_PERMISO, esErrorSinPermiso } from "../../utilidades/permisos"
import { imprimirHtml, datosOpticaProforma } from "../../utilidades/proforma"
import { registrarLog } from "../../utilidades/logs"
import { puede } from "../../utilidades/permisosUi"
import { numeroComprobante } from "../../utilidades/comprobantes"
import { saldoFactura, saldoPacienteFacturas } from "../../utilidades/abonos"
import { ETIQUETA_ESTADO, numeroOrden, armarHtmlOrdenDosCopias } from "../../utilidades/ordenesLaboratorio"
import { siguienteAccionOrden, ESTADO_ANTERIOR } from "../../utilidades/ventasModulo"
import OrdenLaboratorioModal from "../OrdenLaboratorioModal"
import EntregaConSaldoModal from "../EntregaConSaldoModal"
import DetalleOrden from "./DetalleOrden"

// Todo lo que se hace con un pedido de lentes (marcarlo listo, contactar al paciente, entregarlo, imprimir las copias, corregirla, crear otra y
// volver al estado anterior) en un solo lugar (regla 18): lo usan la pestaña Órdenes de laboratorio del módulo, el detalle de un comprobante y
// la pestaña de órdenes del perfil del paciente. `ventanas` son las ventanas que abren esas acciones; quien llama las dibuja una sola vez.
export function useOrdenesLab({ ordenes, setOrdenes, pacientes = [], equipo = [], usuario, facturas = [], abonos = [], pacienteFijo = null, onAbonar, onAviso, onVerComprobante }) {
  const escribirPorWhatsApp = useEscribirPorWhatsApp()
  const puedeEditar = puede(usuario, "ventas", "editar")
  const puedeCrear = puede(usuario, "ventas", "crear")
  const [trabajando, setTrabajando] = useState(null)
  const [editando, setEditando] = useState(null)
  const [otraDe, setOtraDe] = useState(null)
  const [entregaConSaldo, setEntregaConSaldo] = useState(null)
  const [detalleId, setDetalleId] = useState(null)
  const [datosOptica, setDatosOptica] = useState(datosOpticaProforma({}))

  useEffect(() => {
    if (!supabase || !usuario?.opticaId) return
    let vivo = true
    supabase.from("opticas").select("settings").eq("id", usuario.opticaId).maybeSingle().then(({ data }) => { if (vivo && data) setDatosOptica(datosOpticaProforma(data.settings)) })
    return () => { vivo = false }
  }, [usuario?.opticaId])

  const pacienteDe = (o) => pacienteFijo || pacientes.find((p) => p.id === o.pacienteId) || null
  const facturaDe = (o) => facturas.find((f) => f.id === o.facturaId) || null
  const saldoDe = (o) => saldoFactura(facturaDe(o), abonos)
  const nombreDe = (id) => equipo.find((m) => m.id === id)?.nombre || (id === usuario?.id ? usuario?.nombre : null) || "Equipo"
  const reemplazar = (id, cambios) => setOrdenes?.((prev) => prev.map((o) => (o.id === id ? { ...o, ...cambios } : o)))
  const falla = (error, texto) => onAviso?.(esErrorSinPermiso(error) ? MENSAJE_SIN_PERMISO : texto, "error")

  const cambiarEstado = async (o, estado) => {
    setTrabajando(o.id)
    const { error } = supabase ? await supabase.rpc("cambiar_estado_orden", { p_orden_id: o.id, p_estado: estado }) : { error: null }
    setTrabajando(null)
    if (error) { falla(error, "No se pudo cambiar el estado. Revisa tu conexión e intenta de nuevo."); return }
    reemplazar(o.id, { estado, historial: [...(o.historial || []), { estado, cambiadoEn: new Date().toISOString() }], ...(estado === "enviada" || estado === "lista" ? { pacienteAvisadoEn: null, pacienteAvisadoPor: null } : {}) })
    registrarLog(usuario, "ventas", "Cambió el estado de un pedido de lentes", `${numeroOrden(o.numero)} → ${ETIQUETA_ESTADO[estado]}`)
    onAviso?.(estado === "lista" ? `${numeroOrden(o.numero)} listo para entregar. Contacta al paciente para avisarle.` : `${numeroOrden(o.numero)}: ${ETIQUETA_ESTADO[estado].toLowerCase()}.`)
  }

  // Entregar con saldo pendiente: antes de marcarla entregada se muestra lo que falta por cobrar.
  const pedirEstado = (o, estado) => {
    if (estado === "entregada" && saldoDe(o) > 0) { setEntregaConSaldo(o); return }
    cambiarEstado(o, estado)
  }

  const avisarPaciente = async (o) => {
    const p = pacienteDe(o)
    if (!p?.telefono) return
    // La plantilla «Lentes listos» del CRM en la ventana de Contactar; el aviso se registra al enviar (si se cierra la ventana no pasa nada) y el contacto queda en el Seguimiento del CRM.
    escribirPorWhatsApp({
      paciente: p, motivo: "lentes_listos", contexto: { orden: numeroOrden(o.numero) },
      alEnviar: async () => {
        setTrabajando(o.id)
        const { data, error } = supabase ? await supabase.rpc("registrar_aviso_paciente", { p_orden_id: o.id }) : { data: new Date().toISOString(), error: null }
        setTrabajando(null)
        if (error) { falla(error, "No se pudo registrar el aviso. Revisa tu conexión e intenta de nuevo."); return }
        reemplazar(o.id, { pacienteAvisadoEn: data, pacienteAvisadoPor: usuario?.id || null })
        registrarLog(usuario, "ventas", "Avisó al paciente que sus lentes están listos", `${p.nombre} · ${numeroOrden(o.numero)}`)
      },
    })
  }

  const imprimir = (o) => imprimirHtml(armarHtmlOrdenDosCopias({ opticaNombre: usuario?.opticaNombre, opticaDatos: datosOptica, paciente: pacienteDe(o) || {}, orden: { ...o, facturaNumero: facturaDe(o)?.numero != null ? numeroComprobante(facturaDe(o).numero) : "" } }))

  // La acción que lleva la fila (la siguiente del proceso) y cómo se ejecuta.
  const siguiente = (o) => siguienteAccionOrden(o, { puedeEditar, tieneTelefono: !!pacienteDe(o)?.telefono })
  const ejecutarSiguiente = (o) => {
    const s = siguiente(o)
    if (s?.id === "lista") cambiarEstado(o, "lista")
    else if (s?.id === "avisar") avisarPaciente(o)
    else if (s?.id === "entregar") pedirEstado(o, "entregada")
  }
  const volver = (o) => { const a = ESTADO_ANTERIOR[o.estado]; if (a) cambiarEstado(o, a) }

  const api = {
    puedeEditar, puedeCrear, trabajando, pacienteDe, facturaDe, saldoDe, nombreDe, siguiente, ejecutarSiguiente, cambiarEstado, pedirEstado, avisarPaciente, imprimir, volver,
    editar: setEditando, otraOrden: setOtraDe, verDetalle: (o) => setDetalleId(o.id),
  }

  const detalle = detalleId ? ordenes.find((o) => o.id === detalleId) || null : null
  const ventanas = (
    <>
      {detalle && (
        <DetalleOrden
          orden={detalle} paciente={pacienteDe(detalle)} factura={facturaDe(detalle)} saldo={saldoDe(detalle)} api={api}
          equipo={equipo} onCerrar={() => setDetalleId(null)} onVerComprobante={onVerComprobante ? (f) => { setDetalleId(null); onVerComprobante(f) } : null}
        />
      )}
      {entregaConSaldo && (
        <EntregaConSaldoModal
          orden={entregaConSaldo}
          paciente={pacienteDe(entregaConSaldo)}
          saldo={saldoDe(entregaConSaldo)}
          saldoTotal={saldoPacienteFacturas(entregaConSaldo.pacienteId, facturas, abonos)}
          puedeCobrar={!!onAbonar && !!facturaDe(entregaConSaldo) && puedeEditar}
          onCobrar={() => { const o = entregaConSaldo; setEntregaConSaldo(null); onAbonar(facturaDe(o), pacienteDe(o)) }}
          onEntregar={() => { const o = entregaConSaldo; setEntregaConSaldo(null); cambiarEstado(o, "entregada") }}
          onCancelar={() => setEntregaConSaldo(null)}
        />
      )}
      {otraDe && (
        <OrdenLaboratorioModal facturaId={otraDe.facturaId} consultaId={otraDe.consultaId} paciente={pacienteDe(otraDe)} usuario={usuario} opticaDatos={datosOptica} onCerrar={() => setOtraDe(null)} />
      )}
      {editando && (
        <OrdenLaboratorioModal orden={editando} paciente={pacienteDe(editando)} usuario={usuario} opticaDatos={datosOptica} onCerrar={() => setEditando(null)} />
      )}
    </>
  )

  return { ...api, ventanas }
}
