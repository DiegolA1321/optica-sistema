"use client"

import { ArrowRight } from "lucide-react"
import { INK, GRAD_MARCA } from "@/lib/tema"

const COLORES = {
  slate: { tile: "#F1F5F9", texto: "#475569" },
  blue: { tile: GRAD_MARCA, texto: "#fff" },
  green: { tile: "#DCFCE7", texto: "#15803D" },
  amber: { tile: "#FEF3C7", texto: "#D97706" },
  violet: { tile: "#EDE9FE", texto: "#6D28D9" },
  red: { tile: "#FEE2E2", texto: "#DC2626" },
}

// Una fila de tarjetas del Inicio (R52): todas hablan de lo mismo y el título de la fila lo dice
// ("Totales", "Hoy", "Este mes"...). Cada tarjeta puede llevar a su módulo y tener un atajo que abre la acción.
// - neutro: la baldosa del ícono es la misma (gris) en todas; el color queda para los estados (regla 14).
// - compacta: la fila ocupa poco alto, para que quepa en la primera pantalla junto al resto.
// - una tarjeta con `aparte: true` no suma en el total de la fila: se dibuja con borde punteado.
export default function FilaTarjetas({ titulo, descripcion, tarjetas, acciones, neutro = false, compacta = false, columnas: columnasFijas }) {
  if (!tarjetas || tarjetas.length === 0) return null
  const columnas = columnasFijas || (tarjetas.length >= 5 ? "lg:grid-cols-5" : tarjetas.length === 4 ? "lg:grid-cols-4" : tarjetas.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2")
  return (
    <section aria-label={titulo} className={compacta ? "space-y-2" : "space-y-2.5"}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{titulo}</h2>
        {descripcion && <p className="text-xs text-slate-500">{descripcion}</p>}
        {acciones && <div className="ml-auto">{acciones}</div>}
      </div>
      <div className={"grid grid-cols-1 sm:grid-cols-2 " + (compacta ? "gap-2.5 " : "gap-3 ") + columnas}>
        {tarjetas.map((t) => {
          const Icono = t.icono
          const c = COLORES[neutro ? "slate" : t.color || "slate"]
          const accionable = typeof t.onClick === "function"
          const Contenedor = accionable ? "button" : "div"
          return (
            <div key={t.id} className={"flex flex-col justify-between rounded-2xl border text-left transition-colors " + (compacta ? "p-3 " : "p-4 ") + (t.aparte ? "border-dashed border-slate-300 bg-slate-50/60 " : "bg-white shadow-sm ") + (t.seleccionada ? "border-blue-500 ring-1 ring-blue-500" : t.aparte ? "" : "border-slate-200/60 hover:border-slate-300")}>
              <Contenedor
                type={accionable ? "button" : undefined}
                onClick={accionable ? t.onClick : undefined}
                className={"flex w-full items-start justify-between gap-3 text-left " + (accionable ? "cursor-pointer" : "")}
                aria-label={accionable ? `${t.titulo}: ${t.valor}. ${t.desc || ""}` : undefined}
                aria-pressed={accionable && t.seleccionada !== undefined ? t.seleccionada : undefined}
              >
                {compacta ? (
                  // Compacta: el título ocupa todo el ancho (puede pasar a dos líneas) y debajo van el número y el ícono, para que ninguno tape al otro.
                  <span className="flex w-full flex-col gap-1">
                    <span className="block text-[11px] font-bold uppercase leading-tight tracking-wider text-slate-500">{t.titulo}</span>
                    <span className="flex items-end justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block font-serif text-2xl font-semibold leading-none" style={{ color: INK }}>{t.valor}</span>
                        {t.desc && <span className="mt-1 block text-xs leading-tight text-slate-500">{t.desc}</span>}
                      </span>
                      {Icono && <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: c.tile, color: c.texto }}><Icono size={16} aria-hidden="true" /></span>}
                    </span>
                  </span>
                ) : (
                  <>
                    <span className="min-w-0 space-y-0.5">
                      <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-500">{t.titulo}</span>
                      <span className="block font-serif text-3xl font-semibold leading-tight" style={{ color: INK }}>{t.valor}</span>
                      {t.desc && <span className="block text-xs text-slate-500">{t.desc}</span>}
                    </span>
                    {Icono && <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: c.tile, color: c.texto }}><Icono size={21} aria-hidden="true" /></span>}
                  </>
                )}
              </Contenedor>
              {t.cta && t.onCta && (
                <button type="button" onClick={t.onCta} className="mt-3 flex items-center gap-1 border-t border-slate-100 pt-2.5 text-xs font-bold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">
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
