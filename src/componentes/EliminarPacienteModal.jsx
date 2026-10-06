"use client"

import { useState } from "react"
import { createPortal } from "react-dom"
import { Trash2 } from "lucide-react"
import { INK } from "@/lib/tema"
import { useModalAccesible } from "../utilidades/useModalAccesible"

// Eliminar un paciente lo ANONIMIZA (migración 0089): se borran sus datos personales y se
// conservan sus visitas, ventas y datos clínicos sin nombre. Es irreversible, así que el botón
// solo se habilita al escribir el nombre exacto del paciente.
export default function EliminarPacienteModal({ paciente, nCitas = 0, nConsultas = 0, nVentas = 0, eliminando = false, onConfirmar, onCancelar }) {
  const [escrito, setEscrito] = useState("")
  const cerrar = () => { if (!eliminando) onCancelar() }
  const refModal = useModalAccesible(true, cerrar)
  const coincide = escrito.trim() === paciente.nombre.trim()

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={cerrar}>
      <form
        ref={refModal}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="eliminar-paciente-titulo"
        onSubmit={(e) => { e.preventDefault(); if (coincide && !eliminando) onConfirmar() }}
        className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-600"><Trash2 size={22} aria-hidden="true" /></div>
          <h2 id="eliminar-paciente-titulo" className="text-lg font-bold" style={{ color: INK }}>Eliminar paciente</h2>
          <p className="mt-1.5 text-sm text-slate-600">
            Vas a eliminar a <span className="font-semibold text-slate-800">{paciente.nombre}</span>. <span className="font-semibold text-red-700">Esta acción es irreversible.</span>
          </p>
          <div className="mt-4 space-y-3 text-sm">
            <div className="rounded-xl border border-red-200/60 bg-red-50/60 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-red-700">Se borra</p>
              <p className="mt-1 text-slate-700">Su nombre, cédula, teléfono y correo, su acceso al portal, y cualquier dato personal escrito en notas, motivos y mensajes.</p>
            </div>
            <div className="rounded-xl border border-emerald-200/60 bg-emerald-50/60 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Se conserva, sin identificarlo</p>
              <p className="mt-1 text-slate-700">
                {nCitas > 0 ? `${nCitas} cita${nCitas === 1 ? "" : "s"}, ` : "Sus citas, "}
                {nConsultas > 0 ? `${nConsultas} consulta${nConsultas === 1 ? "" : "s"} clínica${nConsultas === 1 ? "" : "s"}` : "sus consultas clínicas"}
                {nVentas > 0 ? `, ${nVentas} venta${nVentas === 1 ? "" : "s"} con sus abonos y órdenes de laboratorio` : ", sus ventas, abonos y órdenes de laboratorio"}, para los reportes y las estadísticas. Quedan como "Paciente anonimizado".
              </p>
            </div>
          </div>
          <label htmlFor="eliminar-paciente-nombre" className="mt-4 block text-sm font-semibold text-slate-700">
            Para confirmar, escribe el nombre del paciente
          </label>
          <p className="mb-1.5 select-all font-mono text-xs text-slate-500">{paciente.nombre}</p>
          <input
            id="eliminar-paciente-nombre"
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={escrito}
            onChange={(e) => setEscrito(e.target.value)}
            disabled={eliminando}
            autoFocus
            className="w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm outline-none transition-colors focus-visible:border-red-400 focus-visible:bg-white"
          />
        </div>
        <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
          <button type="button" disabled={eliminando} onClick={onCancelar} className="flex-1 rounded-xl border border-slate-200/60 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer disabled:opacity-50">Cancelar</button>
          <button type="submit" disabled={!coincide || eliminando} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40">
            {eliminando ? "Eliminando…" : "Eliminar para siempre"}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  )
}
