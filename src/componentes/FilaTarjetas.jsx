"use client"

import { ArrowRight } from "lucide-react"
import { INK, GRAD_MARCA } from "@/lib/tema"

const COLORES = {
  slate: { tile: "#F1F5F9", texto: "#475569" },
  azul: { tile: "#DBEAFE", texto: "#2563EB" },
  blue: { tile: GRAD_MARCA, texto: "#fff" },
  green: { tile: "#DCFCE7", texto: "#15803D" },
  amber: { tile: "#FEF3C7", texto: "#D97706" },
  violet: { tile: "#EDE9FE", texto: "#7C3AED" },
  red: { tile: "#FEE2E2", texto: "#DC2626" },
}

// Fondo blanco en todas: el color solo informa. El ícono de cada total lleva su propio color suave (pacientes azul, citas violeta, ventas verde, productos ámbar).
// Una fila de tarjetas del Inicio (R52): todas hablan de lo mismo y el título de la fila lo dice
// ("Totales", "Hoy", "Este mes"...). Cada tarjeta puede llevar a su módulo y tener un atajo que abre la acción.
// - neutro: la baldosa del ícono es la misma (gris) en todas; el color queda para los estados (regla 14).
// - compacta: la fila ocupa poco alto, para que quepa en la primera pantalla junto al resto.
// - una tarjeta con `aparte: true` no suma en el total de la fila: se dibuja con borde punteado.
// variante: «totales» (ícono de color a la izquierda, título, número grande y lo nuevo del mes; siempre en una sola fila desde 1024 px) o «desenlace» (punto de color, nombre y número a la derecha).
const PUNTOS = { green: "#15803D", red: "#DC2626", amber: "#B7791F", slate: "#94A3B8", blue: "#2563EB", azul: "#2563EB" }
export default function FilaTarjetas({ titulo, descripcion, tarjetas, acciones, neutro = false, compacta = false, columnas: columnasFijas, variante = null }) {
  if (!tarjetas || tarjetas.length === 0) return null
  const columnas = columnasFijas || (tarjetas.length >= 5 ? "lg:grid-cols-5" : tarjetas.length === 4 ? "lg:grid-cols-4" : tarjetas.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2")
  const conAire = variante === "totales" || variante === "desenlace"
  return (
    <section aria-label={titulo} className={compacta ? "space-y-2" : "space-y-2.5"}>
      <div className={"flex flex-wrap gap-x-3 gap-y-1 " + (conAire ? "items-center" : "items-baseline")}>
        <h2 className={conAire ? "text-[13px] font-bold uppercase tracking-[0.14em] text-slate-500" : "text-xs font-bold uppercase tracking-[0.14em] text-slate-500"}>
          {titulo}{conAire && descripcion ? <span className="font-normal normal-case tracking-normal"> · {descripcion}</span> : null}
        </h2>
        {!conAire && descripcion && <p className="text-xs text-slate-500">{descripcion}</p>}
        {acciones && <div className="ml-auto">{acciones}</div>}
      </div>
      <div className={"grid grid-cols-1 sm:grid-cols-2 " + (compacta ? "gap-2.5 " : "gap-3 ") + columnas}>
        {tarjetas.map((t) => {
          const Icono = t.icono
          const c = COLORES[neutro ? "slate" : t.color || "slate"]
          const accionable = typeof t.onClick === "function"
          const Contenedor = accionable ? "button" : "div"
          return (
            <div key={t.id} className={"flex flex-col justify-between rounded-2xl border text-left transition-colors " + (variante === "totales" ? "px-5 py-4 " : variante === "desenlace" ? "px-5 py-3.5 " : compacta ? "p-3 " : "p-4 ") + (t.aparte && !conAire ? "border-dashed border-slate-300 bg-slate-50/60 " : "bg-white shadow-sm ") + (t.seleccionada ? "border-blue-500 ring-1 ring-blue-500" : t.aparte && !conAire ? "" : "border-slate-200/70 hover:border-slate-300")}>
              <Contenedor
                type={accionable ? "button" : undefined}
                onClick={accionable ? t.onClick : undefined}
                className={"flex w-full items-start justify-between gap-3 text-left " + (accionable ? "cursor-pointer" : "")}
                aria-label={accionable ? `${t.titulo}: ${t.valor}. ${t.desc || ""}` : undefined}
                aria-pressed={accionable && t.seleccionada !== undefined ? t.seleccionada : undefined}
              >
                {variante === "desenlace" ? (
                  <span className="flex w-full items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: PUNTOS[t.color] || PUNTOS.slate }} />
                      <span className="truncate text-[15px] text-slate-600">{t.titulo}</span>
                    </span>
                    <span className="font-serif text-[28px] font-bold leading-none" style={{ color: INK }}>{t.valor}</span>
                  </span>
                ) : variante === "totales" ? (
                  <span className="flex w-full items-center gap-4">
                    {Icono && <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl" style={{ background: c.tile, color: c.texto }}><Icono size={22} aria-hidden="true" /></span>}
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500">{t.titulo}</span>
                      <span className="block truncate font-serif text-[30px] font-bold leading-tight" style={{ color: INK }}>{t.valor}</span>
                      {t.desc && <span className="block truncate text-sm text-slate-500">{t.desc}</span>}
                    </span>
                  </span>
                ) : compacta ? (
                  // Compacta: el título ocupa todo el ancho (puede pasar a dos líneas) y debajo van el número y el ícono, para que ninguno tape al otro.
                  <span className="flex w-full flex-col gap-1">
                    <span className="block text-xs font-bold uppercase leading-tight tracking-wider text-slate-500">{t.titulo}</span>
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
                      <span className="block text-xs font-bold uppercase tracking-wider text-slate-500">{t.titulo}</span>
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
