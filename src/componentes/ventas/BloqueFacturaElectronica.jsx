"use client"

import { useState } from "react"
import { Copy, Download, FileText, MessageCircle, Printer, Send, Mail } from "lucide-react"
import { GRAD_MARCA } from "@/lib/tema"
import { Bloque, Dato } from "./Detalle"
import { CLASE_ACCION_PRINCIPAL, CLASE_ACCION_SECUNDARIA } from "./estilos"
import { fechaLegible, fechaHoraLegible } from "../../utilidades/formatoFecha"
import { numeroComprobante } from "../../utilidades/comprobantes"
import { registrarLog } from "../../utilidades/logs"
import { linkWhatsApp } from "../../utilidades/whatsapp"
import { claveEnGrupos, mensajeFacturaWhatsApp, nombreArchivoFactura, DIAS_ENLACE_FACTURA } from "../../utilidades/facturaElectronica"
import { CORREO_FACTURAS_ACTIVO, crearEnlaces, enviarPorCorreo, registrarEvento, urlDeDescarga } from "../../utilidades/facturaElectronicaApi"

const TEXTO_EVENTO = {
  registro: "registró la factura", reemplazo: "corrigió los datos", descarga_pdf: "descargó el PDF", descarga_xml: "descargó el XML", impresion: "imprimió el RIDE",
  envio_whatsapp: "la envió por WhatsApp", envio_correo: "la envió por correo", descarga_enlace: "El paciente la descargó con su enlace", descarga_paciente: "El paciente la descargó desde su portal",
}
const kb = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)

// El bloque "Factura electrónica" del detalle de un comprobante: el número, la clave de acceso y los archivos guardados, con "Descargar", "Imprimir RIDE" y
// "Enviar al paciente". Descargar es de quien puede ver Ventas; registrar, corregir y enviar, de quien puede editarla. Cada descarga y cada envío queda en la actividad.
export default function BloqueFacturaElectronica({ factura: f, paciente, usuario, equipo = [], fe, puedeEditar, onRegistrar, onAviso }) {
  const [abierto, setAbierto] = useState(false) // el panel "Enviar al paciente"
  const [trabajando, setTrabajando] = useState("")
  const anulada = f.estado === "anulada"
  const tiene = Boolean(f.facturaElectronica)
  const { pdf, xml } = fe.archivos
  const nombre = (id) => (id ? equipo.find((m) => m.id === id)?.nombre || (id === usuario?.id ? usuario?.nombre : null) || "El equipo" : null)
  const ultimo = fe.eventos.find((e) => e.accion !== "registro") || fe.eventos[0]
  const dePaciente = ultimo && (ultimo.accion === "descarga_enlace" || ultimo.accion === "descarga_paciente")
  const anotar = (accion, texto) => {
    registrarEvento(f.id, accion, null).then(() => fe.recargar())
    registrarLog(usuario, "ventas", texto, `${paciente?.nombre || ""} · ${numeroComprobante(f.numero)}`)
  }

  const descargar = async (tipo) => {
    const archivo = fe.archivos[tipo]
    if (!archivo) return
    setTrabajando(tipo)
    const { url, error } = await urlDeDescarga(archivo.ruta, nombreArchivoFactura(f.facturaElectronica, tipo))
    setTrabajando("")
    if (error) { onAviso?.(error, "error"); return }
    const a = document.createElement("a")
    a.href = url; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove()
    anotar(tipo === "pdf" ? "descarga_pdf" : "descarga_xml", `Descargó el ${tipo === "pdf" ? "PDF" : "XML"} de la factura electrónica`)
  }
  const imprimirRide = async () => {
    if (!pdf) return
    setTrabajando("imprimir")
    const { url, error } = await urlDeDescarga(pdf.ruta, "", { descargar: false })
    setTrabajando("")
    if (error) { onAviso?.(error, "error"); return }
    window.open(url, "_blank", "noopener")
    anotar("impresion", "Abrió el RIDE de una factura electrónica para imprimirlo")
  }
  const porWhatsApp = async () => {
    if (!paciente?.telefono) return
    setTrabajando("whatsapp")
    const { enlaces, error } = await crearEnlaces(f.id, DIAS_ENLACE_FACTURA)
    setTrabajando("")
    if (error) { onAviso?.(error, "error"); return }
    window.open(linkWhatsApp(paciente.telefono, mensajeFacturaWhatsApp({ paciente, opticaNombre: usuario?.opticaNombre, enlaces, numero: f.facturaElectronica })), "_blank", "noopener")
    registrarLog(usuario, "ventas", "Envió por WhatsApp la factura electrónica", `${paciente.nombre} · ${numeroComprobante(f.numero)}`)
    onAviso?.(`Factura de ${paciente.nombre} abierta en WhatsApp. Los enlaces vencen en ${DIAS_ENLACE_FACTURA} días.`)
    fe.recargar()
  }
  const porCorreo = async () => {
    setTrabajando("correo")
    const { error } = await enviarPorCorreo(f.id)
    setTrabajando("")
    if (error) { onAviso?.(error, "error"); return }
    anotar("envio_correo", "Envió por correo la factura electrónica")
    onAviso?.(`Factura enviada a ${paciente?.nombre || "el paciente"} por correo.`)
  }
  const copiar = async () => { try { await navigator.clipboard.writeText(fe.datos.claveAcceso); onAviso?.("Clave de acceso copiada.") } catch { onAviso?.("No se pudo copiar la clave de acceso.", "error") } }

  const derecha = puedeEditar && !anulada ? (
    <button type="button" onClick={onRegistrar} className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 transition-colors hover:text-blue-800 cursor-pointer">
      <FileText size={14} aria-hidden="true" /> {tiene ? "Corregir o reemplazar" : "Registrar la factura electrónica"}
    </button>
  ) : null

  return (
    <Bloque titulo="Factura electrónica" derecha={derecha}>
      {!tiene ? (
        <p className="text-sm text-slate-500">{anulada ? "Esta venta está anulada." : "Esta venta todavía no tiene su factura electrónica registrada."}</p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-3">
            <Dato etiqueta="Número"><span className="font-mono">{f.facturaElectronica}</span></Dato>
            <Dato etiqueta="Autorizada" vacio={!fe.datos?.autorizadaEl}>{fe.datos?.autorizadaEl ? fechaLegible(fe.datos.autorizadaEl) : "Sin fecha"}</Dato>
            <Dato etiqueta="Clave de acceso" vacio={!fe.datos?.claveAcceso}>
              {fe.datos?.claveAcceso
                ? <span className="flex items-center gap-1.5"><span className="truncate font-mono text-xs" title={claveEnGrupos(fe.datos.claveAcceso)}>{fe.datos.claveAcceso.slice(0, 10)}…{fe.datos.claveAcceso.slice(-6)}</span><button type="button" onClick={copiar} aria-label="Copiar la clave de acceso" className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800 cursor-pointer"><Copy size={12} aria-hidden="true" /> Copiar</button></span>
                : "Sin clave"}
            </Dato>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {pdf && <button type="button" onClick={() => descargar("pdf")} disabled={trabajando === "pdf"} className={CLASE_ACCION_SECUNDARIA}><Download size={14} aria-hidden="true" /> Descargar PDF (RIDE) · {kb(pdf.bytes)}</button>}
            {xml && <button type="button" onClick={() => descargar("xml")} disabled={trabajando === "xml"} className={CLASE_ACCION_SECUNDARIA}><Download size={14} aria-hidden="true" /> Descargar XML · {kb(xml.bytes)}</button>}
            {pdf && <button type="button" onClick={imprimirRide} disabled={trabajando === "imprimir"} className={CLASE_ACCION_SECUNDARIA}><Printer size={14} aria-hidden="true" /> Imprimir RIDE</button>}
            {(pdf || xml) && puedeEditar && !anulada && <button type="button" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}><Send size={14} aria-hidden="true" /> Enviar al paciente</button>}
            {!pdf && !xml && !fe.cargando && <span className="text-sm text-slate-500">Todavía no hay archivos adjuntos{puedeEditar && !anulada ? ": usa «Corregir o reemplazar» para adjuntar el PDF y el XML." : "."}</span>}
          </div>
          {abierto && (
            <div className="space-y-1.5 rounded-xl border border-slate-200/60 bg-slate-50/70 p-3" role="group" aria-label="Enviar al paciente">
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={porWhatsApp} disabled={!paciente?.telefono || trabajando === "whatsapp"} title={paciente?.telefono ? undefined : "El paciente no tiene teléfono registrado"} className={CLASE_ACCION_SECUNDARIA}><MessageCircle size={14} aria-hidden="true" /> Por WhatsApp (enlace que vence en {DIAS_ENLACE_FACTURA} días)</button>
                <button type="button" onClick={porCorreo} disabled={!CORREO_FACTURAS_ACTIVO || trabajando === "correo"} className={CLASE_ACCION_SECUNDARIA}><Mail size={14} aria-hidden="true" /> Por correo</button>
              </div>
              {!CORREO_FACTURAS_ACTIVO && <p className="text-xs text-slate-500">Correo: disponible cuando la óptica tenga su dominio de correo configurado en Resend.</p>}
              {!paciente?.telefono && <p className="text-xs text-slate-500">El paciente no tiene teléfono registrado: agrégalo en su perfil para enviarle el enlace por WhatsApp.</p>}
            </div>
          )}
          {ultimo && <p className="text-xs text-slate-500">Último movimiento: {dePaciente ? TEXTO_EVENTO[ultimo.accion] : `${nombre(ultimo.actor_perfil) || "El equipo"} ${TEXTO_EVENTO[ultimo.accion] || ultimo.accion}`}, {fechaHoraLegible(ultimo.creado_en, { anio: true })}.</p>}
        </div>
      )}
    </Bloque>
  )
}
