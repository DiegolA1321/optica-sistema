"use client"

import { createPortal } from "react-dom"
import { AlertTriangle } from "lucide-react"
import { INK } from "@/lib/tema"
import { useModalAccesible } from "../utilidades/useModalAccesible"

// Modal de confirmación antes de eliminar, extraído del patrón que ya
// usaba Citas.jsx para cancelar una cita — mismo diseño (ícono rojo,
// "Volver"/"Sí, eliminar") en vez de reinventarlo por archivo (audit UX,
// Lote 2, punto 2a).
export default function ConfirmarEliminarModal({
  titulo = "¿Eliminar este elemento?",
  mensaje = "Esta acción no se puede deshacer.",
  onCancelar,
  onConfirmar,
  eliminando = false,
  etiquetaConfirmar = "Sí, eliminar",
}) {
  const cerrar = () => { if (!eliminando) onCancelar() }
  const refModal = useModalAccesible(true, cerrar)

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }}
      onClick={cerrar}
    >
      <div
        ref={refModal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirmar-eliminar-titulo"
        className="w-full max-w-sm rounded-2xl border border-slate-200/60 bg-white p-6 shadow-2xl"
        style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)", willChange: "transform, opacity" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-red-50">
          <AlertTriangle size={24} className="text-red-500" />
        </div>
        <h4 id="confirmar-eliminar-titulo" className="text-center text-lg font-bold" style={{ color: INK }}>{titulo}</h4>
        <p className="mt-1.5 text-center text-sm text-slate-500">{mensaje}</p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancelar}
            disabled={eliminando}
            className="flex-1 rounded-xl border border-slate-200/60 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
          >
            Volver
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            disabled={eliminando}
            className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
          >
            {eliminando ? "Eliminando..." : etiquetaConfirmar}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
