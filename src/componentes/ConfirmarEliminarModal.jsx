"use client"

import { Trash2 } from "lucide-react"
import { Cascaron } from "./AtencionPaciente"

// Confirmación antes de eliminar, en la ventana estándar del sistema (regla 43):
// mismo patrón para cancelar una cita, quitar un rol, etc.
export default function ConfirmarEliminarModal({
  titulo = "¿Eliminar este elemento?",
  mensaje = "Esta acción no se puede deshacer.",
  onCancelar,
  onConfirmar,
  eliminando = false,
  etiquetaConfirmar = "Sí, eliminar",
}) {
  const cerrar = () => { if (!eliminando) onCancelar() }

  return (
    <Cascaron
      titulo={titulo}
      subtitulo="Confirma antes de continuar"
      Icono={Trash2}
      ancho="max-w-md"
      onCerrar={cerrar}
      pie={<>
        <span />
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={onCancelar} disabled={eliminando} className="rounded-lg border border-slate-200/60 px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50">Volver</button>
          <button type="button" onClick={onConfirmar} disabled={eliminando} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50">
            {eliminando ? "Eliminando..." : etiquetaConfirmar}
          </button>
        </div>
      </>}
    >
      <p className="p-6 text-sm text-slate-600">{mensaje}</p>
    </Cascaron>
  )
}
