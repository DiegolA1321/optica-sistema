"use client"

import { useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { X, ShieldCheck, Glasses } from "lucide-react"
import { INK } from "@/lib/tema"
import { useModalAccesible } from "../utilidades/useModalAccesible"
import { unirPermisos, menuDePermisos, resumenPermisos } from "../utilidades/roles"

const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)"

// "Mis roles": el administrador principal elige con qué otros roles quiere trabajar (Optómetra, Recepción,
// Ventas…). Cada rol que se marque aparece como una "Vista" en el menú de la esquina superior. El administrador
// sigue viendo todo; los roles solo le dan sus vistas. `onGuardar(ids)` devuelve el mensaje de error o null.
export default function ModalMisRoles({ roles, elegidosIniciales, onGuardar, onCerrar }) {
  const [elegidos, setElegidos] = useState(elegidosIniciales)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  const cerrar = () => { if (!guardando) onCerrar() }
  const refModal = useModalAccesible(true, cerrar)

  const alternar = (id) => setElegidos((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  const seleccionados = roles.filter((r) => elegidos.includes(r.id))
  const vista = useMemo(() => {
    const p = unirPermisos(seleccionados.map((r) => r.permisos))
    return { menu: menuDePermisos(p), resumen: resumenPermisos(p) }
  }, [elegidos, roles]) // eslint-disable-line react-hooks/exhaustive-deps
  const sinCambios = elegidos.length === elegidosIniciales.length && elegidos.every((id) => elegidosIniciales.includes(id))

  const guardar = async (e) => {
    e.preventDefault()
    setError("")
    setGuardando(true)
    const mensaje = await onGuardar(elegidos)
    setGuardando(false)
    if (mensaje) setError(mensaje)
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={cerrar}>
      <div ref={refModal} role="dialog" aria-modal="true" aria-labelledby="mis-roles-titulo" className="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-2xl" style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: GRAD }}><ShieldCheck size={20} aria-hidden="true" /></div>
            <div>
              <h2 id="mis-roles-titulo" className="text-lg font-bold" style={{ color: INK }}>Mis roles</h2>
              <p className="text-xs text-slate-500">Cada rol que marques aparece como una vista en el menú de tu cuenta.</p>
            </div>
          </div>
          <button type="button" onClick={cerrar} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 cursor-pointer"><X size={20} /></button>
        </div>
        <form onSubmit={guardar} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
            {error && <p role="alert" className="rounded-lg border border-red-200/60 bg-red-50 p-3 text-sm font-medium text-red-700">{error}</p>}
            <p className="text-sm text-slate-600">Sigues siendo administrador y ves todos los módulos. Los roles te dan una vista enfocada, por ejemplo la de Optómetra con tu agenda del día.</p>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-slate-700">Roles disponibles <span className="font-normal text-slate-500">· puedes marcar varios</span></legend>
              {roles.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">No hay roles creados todavía. Créalos en la pestaña Roles.</p>
              ) : (
                <div className="space-y-2">
                  {roles.map((r) => {
                    const marcado = elegidos.includes(r.id)
                    return (
                      <label key={r.id} className={"flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors " + (marcado ? "border-blue-300 bg-blue-50/50" : "border-slate-200/60 bg-slate-50 hover:border-blue-200")}>
                        <input type="checkbox" checked={marcado} onChange={() => alternar(r.id)} className="mt-0.5 h-4 w-4 accent-blue-600" />
                        <span className="min-w-0 text-sm">
                          <span className="flex flex-wrap items-center gap-2 font-semibold text-slate-700">
                            {r.nombre}
                            {r.es_predefinido && <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">Predefinido</span>}
                            {r.atiende_pacientes && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700"><Glasses size={10} aria-hidden="true" /> Atiende pacientes</span>}
                          </span>
                          {r.descripcion && <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{r.descripcion}</span>}
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}
            </fieldset>
            {seleccionados.length > 0 && (
              <section aria-label="Vista previa de lo que verás" className="rounded-xl border border-slate-200/60 bg-slate-50 p-3.5">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Lo que verás con esos roles</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm">Inicio</span>
                  {vista.menu.map((m) => <span key={m} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm">{m}</span>)}
                </div>
                <ul className="mt-2 grid grid-cols-1 gap-x-4 gap-y-0.5 text-xs text-slate-600 sm:grid-cols-2">{vista.resumen.map((r) => <li key={r.modulo}><span className="font-semibold">{r.modulo}:</span> {r.texto}</li>)}</ul>
              </section>
            )}
          </div>
          <div className="flex shrink-0 gap-3 border-t border-slate-100 p-5">
            <button type="button" onClick={cerrar} disabled={guardando} className="flex-1 rounded-xl border border-slate-200/60 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer disabled:opacity-60">Cancelar</button>
            <button type="submit" disabled={guardando || sinCambios} className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60" style={{ background: GRAD }}>
              {guardando ? "Guardando…" : "Guardar mis roles"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  )
}
