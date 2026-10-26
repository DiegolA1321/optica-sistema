"use client"

import { Monitor } from "lucide-react"
import { INK } from "@/lib/tema"

// Lo que se ve, dentro del sistema y con la barra de abajo visible, al entrar a un módulo que solo se usa desde la computadora (desde «Más», un enlace o un aviso).
// Nunca saca de la sesión: explica y ofrece los módulos que sí se pueden usar en el celular.
// botones: [{ id, nombre, onClick }].
export default function ModuloDeComputadora({ nombre, botones = [] }) {
  return (
    <section aria-label="Este módulo se usa desde la computadora" className="space-y-4">
      <div className="rounded-3xl border border-slate-200/80 bg-white px-5 py-6 text-center shadow-sm">
        <span className="mx-auto grid h-[52px] w-[52px] place-items-center rounded-2xl bg-blue-50 text-blue-600" aria-hidden="true"><Monitor size={26} /></span>
        <h2 className="mt-4 text-xl font-bold leading-snug" style={{ color: INK }}>Este módulo se usa desde la computadora</h2>
        <p className="mt-2 text-base leading-snug text-slate-600">
          {nombre} tiene tablas y formularios que necesitan una pantalla grande. Desde el celular puedes usar:
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {botones.map((b) => (
          <button key={b.id} type="button" onClick={b.onClick} className="min-h-12 cursor-pointer rounded-2xl border border-slate-200 bg-white px-3 py-3 text-base font-semibold shadow-sm" style={{ color: INK }}>
            {b.nombre}
          </button>
        ))}
      </div>
    </section>
  )
}
