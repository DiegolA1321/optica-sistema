import { UserPlus } from "lucide-react"
import { INK } from "@/lib/tema"

// Una pantalla que todavía no tiene con qué llenarse (óptica nueva): lo dice y lleva a donde nace el dato (regla 17 y 30).
// accion: { etiqueta, onClick } (se omite si la persona no puede crear lo que falta).
export default function SinDatosAun({ titulo, texto, accion }) {
  return (
    <div role="status" className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-slate-300 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-bold" style={{ color: INK }}>{titulo}</p>
        <p className="mt-0.5 text-sm text-slate-500">{texto}</p>
      </div>
      {accion && (
        <button type="button" onClick={accion.onClick} className="flex shrink-0 items-center gap-2 rounded-xl border border-slate-200/60 bg-white px-4 py-2.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 cursor-pointer">
          <UserPlus size={16} aria-hidden="true" /> {accion.etiqueta}
        </button>
      )}
    </div>
  )
}
