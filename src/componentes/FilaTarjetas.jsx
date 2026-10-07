"use client"

import { ArrowRight } from "lucide-react"
import { INK } from "@/lib/tema"

const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)"
const COLORES = {
  slate: { tile: "#F1F5F9", texto: "#475569" },
  blue: { tile: GRAD, texto: "#fff" },
  green: { tile: "#DCFCE7", texto: "#15803D" },
  amber: { tile: "#FEF3C7", texto: "#D97706" },
  red: { tile: "#FEE2E2", texto: "#DC2626" },
}

// Una fila de tarjetas del Inicio (R52): todas hablan de lo mismo y el título de la fila lo dice
// ("Totales", "Hoy", "Este mes"...). Cada tarjeta puede llevar a su módulo y tener un atajo que abre la acción.
export default function FilaTarjetas({ titulo, descripcion, tarjetas, acciones }) {
  if (!tarjetas || tarjetas.length === 0) return null
  const columnas = tarjetas.length >= 4 ? "lg:grid-cols-4" : tarjetas.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2"
  return (
    <section aria-label={titulo} className="space-y-2.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{titulo}</h2>
        {descripcion && <p className="text-xs text-slate-400">{descripcion}</p>}
        {acciones && <div className="ml-auto">{acciones}</div>}
      </div>
      <div className={"grid grid-cols-1 gap-3 sm:grid-cols-2 " + columnas}>
        {tarjetas.map((t) => {
          const Icono = t.icono
          const c = COLORES[t.color || "slate"]
          const accionable = typeof t.onClick === "function"
          const Contenedor = accionable ? "button" : "div"
          return (
            <div key={t.id} className="flex flex-col justify-between rounded-2xl border border-slate-200/60 bg-white p-4 text-left shadow-sm transition-colors hover:border-slate-300">
              <Contenedor
                type={accionable ? "button" : undefined}
                onClick={accionable ? t.onClick : undefined}
                className={"flex w-full items-start justify-between gap-3 text-left " + (accionable ? "cursor-pointer" : "")}
                aria-label={accionable ? `${t.titulo}: ${t.valor}. ${t.desc || ""}` : undefined}
              >
                <span className="min-w-0 space-y-0.5">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">{t.titulo}</span>
                  <span className="block font-serif text-3xl font-semibold leading-tight" style={{ color: INK }}>{t.valor}</span>
                  {t.desc && <span className="block text-xs text-slate-500">{t.desc}</span>}
                </span>
                {Icono && <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: c.tile, color: c.texto }}><Icono size={21} aria-hidden="true" /></span>}
              </Contenedor>
              {t.cta && t.onCta && (
                <button type="button" onClick={t.onCta} className="mt-3 flex items-center gap-1 border-t border-slate-100 pt-2.5 text-xs font-bold text-blue-600 transition-colors hover:text-blue-700 hover:underline cursor-pointer">
                  {t.cta} <ArrowRight size={13} aria-hidden="true" />
                </button>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
