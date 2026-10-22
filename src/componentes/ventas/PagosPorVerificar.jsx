"use client"

import { useEffect, useState } from "react"
import { Landmark, Check, X } from "lucide-react"
import { GRAD_MARCA } from "@/lib/tema"
import { Cascaron } from "../AtencionPaciente"
import { Columna, Dato } from "./Detalle"
import { CLASE_ACCION_PRINCIPAL, CLASE_ACCION_SECUNDARIA, BOTON_CERRAR } from "./estilos"
import { dinero } from "../../utilidades/formatoMoneda"
import { fechaLegible } from "../../utilidades/formatoFecha"
import { diaDeRegistro } from "../../utilidades/periodoLista"
import { numeroComprobante } from "../../utilidades/comprobantes"
import { archivoDelPago, confirmarPago, rechazarPago } from "../../utilidades/pagosTransferencia"

// La revisión de un pago por transferencia (el detalle de la venta la abre desde «Pago por verificar»): lo que el paciente dice haber transferido desde su portal. Quien puede editar Ventas lo confirma
// (queda como un abono con el método «Transferencia») o lo rechaza con un motivo que el paciente lee en su portal.
export function VentanaRevision({ pago, puedeEditar, onCerrar, onConfirmado, onRechazado }) {
  const [archivo, setArchivo] = useState(null)
  const [error, setError] = useState("")
  const [trabajando, setTrabajando] = useState(false)
  const [rechazando, setRechazando] = useState(false)
  const [motivo, setMotivo] = useState("")
  const [url, setUrl] = useState("")
  useEffect(() => {
    let vivo = true
    let objeto = ""
    archivoDelPago(pago.id).then((r) => {
      if (!vivo) return
      if (r.error) { setError(r.error); return }
      const bytes = Uint8Array.from(atob(r.archivo.base64), (c) => c.charCodeAt(0))
      objeto = URL.createObjectURL(new Blob([bytes], { type: r.archivo.tipo }))
      setArchivo(r.archivo); setUrl(objeto)
    })
    return () => { vivo = false; if (objeto) URL.revokeObjectURL(objeto) }
  }, [pago.id])
  const confirmar = async () => {
    setTrabajando(true); setError("")
    const r = await confirmarPago(pago.id, pago.facturaId)
    setTrabajando(false)
    if (r.error) { setError(r.error); return }
    onConfirmado(pago, r)
  }
  const rechazar = async () => {
    if (motivo.trim().length < 3) { setError("Escribe el motivo del rechazo: el paciente lo lee en su portal."); return }
    setTrabajando(true); setError("")
    const r = await rechazarPago(pago.id, motivo.trim())
    setTrabajando(false)
    if (r.error) { setError(r.error); return }
    onRechazado(pago)
  }
  return (
    <Cascaron titulo={`Pago de ${pago.pacienteNombre || "un paciente"}`} subtitulo={`Transferencia por ${dinero(pago.monto)}`} Icono={Landmark} ancho="max-w-3xl" etiqueta="Pago por verificar" onCerrar={() => { if (!trabajando) onCerrar() }}
      pie={puedeEditar ? (
        <>
          <button type="button" onClick={onCerrar} disabled={trabajando} className={BOTON_CERRAR}>Cerrar</button>
          <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
            {!rechazando && <button type="button" onClick={() => { setRechazando(true); setError("") }} disabled={trabajando} className={CLASE_ACCION_SECUNDARIA}><X size={14} aria-hidden="true" /> Rechazar</button>}
            {rechazando
              ? <button type="button" onClick={rechazar} disabled={trabajando} className={CLASE_ACCION_PRINCIPAL} style={{ background: "#dc2626" }}>{trabajando ? "Rechazando…" : "Rechazar pago"}</button>
              : <button type="button" onClick={confirmar} disabled={trabajando || !archivo} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}><Check size={14} aria-hidden="true" /> {trabajando ? "Confirmando…" : "Confirmar pago"}</button>}
          </div>
        </>
      ) : <><span /><button type="button" onClick={onCerrar} className={BOTON_CERRAR}>Cerrar</button></>}>
      <div className="grid grid-cols-1 gap-6 p-5 md:grid-cols-[minmax(0,1fr)_minmax(14rem,0.5fr)]">
        <section aria-label="Comprobante" className="min-w-0">
          {!archivo && !error && <div className="h-64 animate-pulse rounded-xl bg-slate-100" aria-label="Cargando el comprobante" />}
          {archivo?.tipo === "application/pdf" && <iframe title="Comprobante en PDF" src={url} className="h-[28rem] w-full rounded-xl border border-slate-200" />}
          {archivo && archivo.tipo !== "application/pdf" && <img src={url} alt={`Comprobante: ${archivo.nombre}`} className="max-h-[28rem] w-full rounded-xl border border-slate-200 bg-slate-50 object-contain" />}
        </section>
        <Columna titulo="El pago">
          <Dato etiqueta="Monto">{dinero(pago.monto)}</Dato>
          <Dato etiqueta="Compra">{numeroComprobante(pago.facturaNumero)}</Dato>
          <Dato etiqueta="Enviado">{fechaLegible(diaDeRegistro(pago.creadoEn)) || "—"}</Dato>
          <Dato etiqueta="Qué revisar">Que el monto y la fecha coincidan con tu banco. Al confirmar queda como un abono por transferencia.</Dato>
        </Columna>
      </div>
      {rechazando && (
        <div className="border-t border-slate-100 px-5 py-4">
          <label htmlFor="motivo-rechazo-pago" className="mb-1 block text-sm font-semibold text-slate-700">Motivo del rechazo (el paciente lo ve)</label>
          <textarea id="motivo-rechazo-pago" rows={2} maxLength={300} value={motivo} onChange={(e) => { setMotivo(e.target.value); setError("") }} placeholder="Por ejemplo: el monto no aparece en la cuenta" autoFocus
            className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-base outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100" />
        </div>
      )}
      {error && <p role="alert" className="mx-5 mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
    </Cascaron>
  )
}
