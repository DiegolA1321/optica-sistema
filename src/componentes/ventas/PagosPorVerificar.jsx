"use client"

import { useEffect, useState } from "react"
import { Landmark, ChevronRight, Check, X } from "lucide-react"
import { INK, GRAD_MARCA } from "@/lib/tema"
import { Cascaron } from "../AtencionPaciente"
import { Columna, Dato } from "./Detalle"
import { CLASE_ACCION_PRINCIPAL, CLASE_ACCION_SECUNDARIA, BOTON_CERRAR, plural } from "./estilos"
import { dinero } from "../../utilidades/formatoMoneda"
import { fechaLegible } from "../../utilidades/formatoFecha"
import { diaDeRegistro } from "../../utilidades/periodoLista"
import { numeroComprobante } from "../../utilidades/comprobantes"
import { archivoDelPago, confirmarPago, rechazarPago } from "../../utilidades/pagosTransferencia"

// «Pagos por verificar» (Cobros y saldos): lo que los pacientes dicen haber transferido desde su portal. Cada fila abre el comprobante; quien puede editar Ventas lo confirma (queda como un abono
// con el método «Transferencia») o lo rechaza con un motivo que el paciente lee en su portal.
const COLUMNAS = "lg:grid-cols-[minmax(0,1.4fr)_minmax(7rem,0.8fr)_7rem_minmax(8rem,0.8fr)_1rem]"

function VentanaRevision({ pago, puedeEditar, onCerrar, onConfirmado, onRechazado }) {
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

export default function PagosPorVerificar({ pagos = [], puedeEditar, onConfirmado, onRechazado }) {
  const [abierto, setAbierto] = useState(null)
  if (pagos.length === 0) return null
  return (
    <section aria-label="Pagos por verificar" className="min-w-0 rounded-2xl border border-blue-200/70 bg-blue-50/40 shadow-sm lg:col-span-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-blue-100 px-4 py-3">
        <h2 className="flex items-center gap-2 text-base font-bold" style={{ color: INK }}><Landmark size={16} aria-hidden="true" /> Pagos por verificar</h2>
        <p className="text-sm text-slate-600">{plural(pagos.length, "pago por transferencia", "pagos por transferencia")} que {pagos.length === 1 ? "espera" : "esperan"} tu revisión</p>
      </div>
      <div aria-hidden="true" className={"hidden gap-x-3 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-500 lg:grid " + COLUMNAS}><span>Paciente</span><span>Compra</span><span className="text-right">Monto</span><span>Enviado</span><span /></div>
      <ul data-lista="pagos-por-verificar" aria-label="Pagos por verificar" className="divide-y divide-blue-100/70">
        {pagos.map((p) => (
          <li key={p.id} data-fila className={"relative grid grid-cols-1 gap-x-3 gap-y-0.5 px-4 py-3 transition-colors hover:bg-white/70 lg:items-center " + COLUMNAS}>
            <button type="button" onClick={() => setAbierto(p)} aria-haspopup="dialog" aria-label={`Revisar el pago de ${p.pacienteNombre || "un paciente"} por ${dinero(p.monto)}`} className="absolute inset-0 cursor-pointer" />
            <p className="min-w-0 truncate text-sm font-bold" style={{ color: INK }} title={p.pacienteNombre}>{p.pacienteNombre || "Paciente"}</p>
            <p className="font-mono text-sm text-slate-600">{numeroComprobante(p.facturaNumero)}</p>
            <p data-col="monto" className="font-mono text-sm font-bold text-slate-800 lg:text-right">{dinero(p.monto)}</p>
            <p className="text-sm text-slate-600">{fechaLegible(diaDeRegistro(p.creadoEn)) || "—"}</p>
            <ChevronRight size={16} className="hidden text-slate-400 lg:block" aria-hidden="true" />
          </li>
        ))}
      </ul>
      {abierto && <VentanaRevision pago={abierto} puedeEditar={puedeEditar} onCerrar={() => setAbierto(null)} onConfirmado={(p, r) => { setAbierto(null); onConfirmado?.(p, r) }} onRechazado={(p) => { setAbierto(null); onRechazado?.(p) }} />}
    </section>
  )
}
