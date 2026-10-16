"use client"

import { INK } from "@/lib/tema"

// Los dos permisos para recibir mensajes, como casillas, en el momento de registrar a un paciente: el formulario del personal ("paciente") y la
// reserva por la web ("yo"). "Recordatorios de salud" viene marcado y "Promociones y saludos" desmarcado; cada uno lleva su texto corto.
const TEXTOS = {
  paciente: {
    recordatorios: ["Recordatorios de salud", "Avisos de su control, de sus citas y de cómo le fue con sus lentes."],
    promociones: ["Promociones y saludos", "Ofertas, novedades y un saludo en su cumpleaños. Solo si el paciente lo acepta."],
  },
  yo: {
    recordatorios: ["Recordatorios de salud", "Te avisamos de tu control, de tus citas y de cómo te va con tus lentes."],
    promociones: ["Promociones y saludos", "Te escribimos con ofertas, novedades y un saludo en tu cumpleaños."],
  },
}

export default function PermisosAlRegistrar({ recordatorios, promociones, onCambiar, persona = "paciente", idBase = "permisos" }) {
  const t = TEXTOS[persona]
  const casilla = (id, valor) => (
    <label key={id} htmlFor={`${idBase}-${id}`} className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200/60 bg-white px-3.5 py-2.5 transition-colors hover:bg-slate-50">
      <input id={`${idBase}-${id}`} type="checkbox" checked={valor} onChange={(e) => onCambiar({ [id]: e.target.checked })} className="mt-1 h-4 w-4 shrink-0 accent-blue-600" />
      <span className="min-w-0">
        <span className="block text-sm font-bold" style={{ color: INK }}>{t[id][0]}</span>
        <span className="block text-xs text-slate-500">{t[id][1]}</span>
      </span>
    </label>
  )
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-semibold text-slate-700">{persona === "yo" ? "Mensajes que quieres recibir" : "Mensajes que acepta recibir"}</legend>
      {casilla("recordatorios", recordatorios)}
      {casilla("promociones", promociones)}
      <p className="text-xs text-slate-500">{persona === "yo" ? "Puedes cambiarlo cuando quieras desde tu portal." : "Se puede cambiar después desde los datos del paciente."}</p>
    </fieldset>
  )
}
