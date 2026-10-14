"use client"

import { useState } from "react"
import { Pencil } from "lucide-react"
import { supabase } from "../../lib/supabaseClient"
import CampoFecha from "../CampoFecha"
import { Cascaron } from "../AtencionPaciente"
import CamposPagos from "./CamposPagos"
import { dinero } from "../../utilidades/formatoMoneda"
import { hoyISO } from "../../utilidades/disponibilidad"
import { diaDeRegistro } from "../../utilidades/periodoLista"
import { MENSAJE_SIN_PERMISO, esErrorSinPermiso } from "../../utilidades/permisos"
import { registrarLog } from "../../utilidades/logs"
import { EVENTO_ABONO, EVENTO_ABONO_QUITADO, mapAbono, saldoTrasCorregir } from "../../utilidades/abonos"
import { filasParaTotal, revisarPagos, textoPagos, pagosDeAbono } from "../../utilidades/pagos"
import { numeroComprobante } from "../../utilidades/comprobantes"
import { GRAD_MARCA } from "@/lib/tema"

const CAMPO = "w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 outline-none transition-colors focus-visible:border-blue-500 focus-visible:bg-white"

// Corregir o anular un abono mal registrado. Solo con el nivel "editar" de Ventas (la base lo vuelve a exigir), con un motivo obligatorio:
// recalcula el saldo y el estado de la venta y queda en la actividad (y, en la base, con lo que había antes, quién lo cambió y cuándo).
export default function CorregirAbonoModal({ abono, factura, paciente, abonos, usuario, onCambiado, onCerrar }) {
  const conocidos = abono.pagos && abono.pagos.length > 0
  const [monto, setMonto] = useState(String(abono.monto))
  const [fecha, setFecha] = useState(abono.fecha)
  const [nota, setNota] = useState(abono.nota || "")
  // Un abono anterior a las formas de pago no tiene método: se pide ahora, para que la caja cuadre.
  const [filas, setFilas] = useState(() => (conocidos ? abono.pagos.map((p) => ({ metodo: p.metodo, monto: String(p.monto) })) : [{ metodo: "efectivo", monto: "" }]))
  const [motivo, setMotivo] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  const valor = Math.round((parseFloat(monto) || 0) * 100) / 100
  const fechaVenta = diaDeRegistro(factura.creadoEn)
  const saldoNuevo = saldoTrasCorregir(factura, abonos, abono.id, valor)

  const aplicar = async (anular) => {
    if (motivo.trim().length < 3) { setError(`Escribe el motivo de ${anular ? "la anulación" : "la corrección"}.`); return }
    let pagos = null
    if (!anular) {
      if (!(valor > 0)) { setError("Escribe un monto mayor que cero."); return }
      if (saldoTrasCorregir(factura, abonos, abono.id, valor) < 0 || valor > Number(factura.montoTotal)) { setError("El abono corregido no puede superar el total de la venta."); return }
      if (!fecha || fecha > hoyISO()) { setError("La fecha del abono no puede ser futura."); return }
      if (fechaVenta && fecha < fechaVenta) { setError("La fecha del abono no puede ser anterior a la de la venta."); return }
      const revision = revisarPagos(filasParaTotal(filas, valor), valor)
      if (revision.error) { setError(revision.error); return }
      pagos = revision.pagos
    }
    setGuardando(true)
    setError("")
    let estado = factura.estado, cuotasPagadas = factura.cuotasPagadas
    if (supabase) {
      const { error: errorRpc } = anular
        ? await supabase.rpc("anular_abono", { p_abono_id: abono.id, p_motivo: motivo.trim() }).single()
        : await supabase.rpc("corregir_abono", { p_abono_id: abono.id, p_motivo: motivo.trim(), p_monto: valor, p_fecha: fecha, p_nota: nota.trim() || null, p_pagos: pagos }).single()
      if (errorRpc) {
        setError(esErrorSinPermiso(errorRpc) ? MENSAJE_SIN_PERMISO : errorRpc.message || "No se pudo guardar. Revisa tu conexión e intenta de nuevo.")
        setGuardando(false)
        return
      }
      // Lo que cambió en la venta (estado y cuotas) y en sus abonos se vuelve a leer para que la pantalla muestre exactamente lo guardado.
      const { data: f } = await supabase.from("facturas_venta").select("estado, cuotas_pagadas").eq("id", factura.id).maybeSingle()
      if (f) { estado = f.estado; cuotasPagadas = f.cuotas_pagadas }
      if (anular) window.dispatchEvent(new CustomEvent(EVENTO_ABONO_QUITADO, { detail: abono.id }))
      else {
        const { data: fila } = await supabase.from("abonos_factura").select("*").eq("id", abono.id).maybeSingle()
        if (fila) window.dispatchEvent(new CustomEvent(EVENTO_ABONO, { detail: mapAbono(fila) }))
      }
    } else {
      estado = saldoNuevo > 0 ? "pendiente_pago" : "pagada"
      if (anular) window.dispatchEvent(new CustomEvent(EVENTO_ABONO_QUITADO, { detail: abono.id }))
    }
    registrarLog(
      usuario, "ventas", anular ? "Anuló un abono" : "Corrigió un abono",
      anular
        ? `${paciente?.nombre || ""} · ${numeroComprobante(factura.numero)} · ${dinero(abono.monto)} · ${motivo.trim()}`
        : `${paciente?.nombre || ""} · ${numeroComprobante(factura.numero)} · de ${dinero(abono.monto)} a ${dinero(valor)} · ${motivo.trim()}`,
    )
    setGuardando(false)
    onCambiado?.({ anulado: anular, estado, cuotasPagadas, saldo: saldoNuevo })
    onCerrar()
  }

  const antes = textoPagos(pagosDeAbono(abono))
  return (
    <Cascaron
      titulo="Corregir abono"
      subtitulo={`${paciente?.nombre || "Paciente"} · ${numeroComprobante(factura.numero)}`}
      Icono={Pencil}
      ancho="max-w-lg"
      onCerrar={() => { if (!guardando) onCerrar() }}
      formulario={{ onSubmit: (e) => { e.preventDefault(); aplicar(false) } }}
      pie={(
        <>
          <button type="button" onClick={() => aplicar(true)} disabled={guardando} className="rounded-lg border border-red-200/60 px-3.5 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-50 cursor-pointer disabled:opacity-60">Anular este abono</button>
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={onCerrar} disabled={guardando} className="rounded-lg border border-slate-200/60 px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer disabled:opacity-60">Cancelar</button>
            <button type="submit" disabled={guardando} className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer disabled:opacity-60" style={{ background: GRAD_MARCA }}>{guardando ? "Guardando…" : "Guardar corrección"}</button>
          </div>
        </>
      )}
    >
      <div className="space-y-4 px-5 py-4">
        <p className="rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Ahora dice: <span className="font-mono font-semibold text-slate-800">{dinero(abono.monto)}</span> el {abono.fecha ? abono.fecha.split("-").reverse().join("/") : "—"} · {antes}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Monto *</span>
            <input type="number" min="0.01" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} autoFocus className={CAMPO + " text-right font-mono"} />
          </label>
          <div className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Fecha *</span>
            <CampoFecha id="corregir-abono-fecha" etiqueta="Fecha del abono" valor={fecha} onCambiar={setFecha} min={fechaVenta || ""} max={hoyISO()} />
          </div>
        </div>
        <CamposPagos filas={filas} onChange={setFilas} total={valor} idBase="corregir" />
        {!conocidos && <p className="text-xs text-slate-500">Este abono se registró antes de las formas de pago: elige cómo se pagó para que la caja cuadre.</p>}
        <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Nota (opcional)</span>
          <input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={120} className={CAMPO} />
        </label>
        <label className="block"><span className="mb-1 block text-xs font-semibold text-slate-600">Motivo de la corrección *</span>
          <textarea rows={2} maxLength={200} value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej. se escribió mal el monto" className={CAMPO + " resize-none"} />
        </label>
        <p className="text-sm text-slate-600">Con este cambio el saldo de la venta queda en <span className="font-mono font-bold text-slate-800">{dinero(saldoNuevo)}</span>. Queda en la actividad con tu nombre.</p>
        {error && <p role="alert" className="rounded-lg border border-red-200/60 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
      </div>
    </Cascaron>
  )
}
