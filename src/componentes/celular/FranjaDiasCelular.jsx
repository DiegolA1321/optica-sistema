"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { GRAD_MARCA } from "@/lib/tema"
import { diaSemanaCorto, formatoFecha } from "../../utilidades/formatoFecha"
import { isoAFechaLocal } from "../../utilidades/disponibilidad"
import { lunesDeSemana, sumarDiasISO } from "../../utilidades/calendarioSemana"

// Los días de la semana, deslizables, arriba de la Agenda en el celular: tocar uno muestra las citas de ese día (el mismo «Hoy · día» de la Lista de la computadora).
// La franja va de lunes a domingo, semana tras semana (dos hacia atrás y ocho hacia adelante a partir de la que se abrió) y se ajusta si se llega más lejos.
// seleccionado: el día que se ve (o null si la lista abarca otro periodo); hoy: el día de hoy (se marca con un anillo).
const SEMANAS_ANTES = 2
const SEMANAS_DESPUES = 8
export default function FranjaDiasCelular({ seleccionado, hoy, onElegir }) {
  const [ancla, setAncla] = useState(() => sumarDiasISO(lunesDeSemana(seleccionado || hoy), -7 * SEMANAS_ANTES))
  const total = 7 * (SEMANAS_ANTES + SEMANAS_DESPUES)
  // Si se eligió un día fuera de la franja (desde «Filtrar»), se vuelve a centrar en su semana.
  useEffect(() => {
    if (!seleccionado) return
    if (seleccionado < ancla || seleccionado >= sumarDiasISO(ancla, total)) setAncla(sumarDiasISO(lunesDeSemana(seleccionado), -7 * SEMANAS_ANTES))
  }, [seleccionado, ancla, total])
  const dias = useMemo(() => Array.from({ length: total }, (_, i) => sumarDiasISO(ancla, i)), [ancla, total])
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current?.querySelector('[aria-pressed="true"]')
    el?.scrollIntoView?.({ inline: "center", block: "nearest" })
  }, [seleccionado, ancla])
  return (
    <div ref={ref} role="group" aria-label="Días" className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {dias.map((iso) => {
        const activo = iso === seleccionado
        const esHoy = iso === hoy
        const f = isoAFechaLocal(iso)
        return (
          <button key={iso} type="button" onClick={() => onElegir(iso)} aria-pressed={activo} aria-label={formatoFecha(iso, "largo")}
            className={"flex min-h-[64px] w-[52px] shrink-0 snap-start cursor-pointer flex-col items-center justify-center rounded-2xl border " + (activo ? "border-transparent text-white" : "border-slate-200 bg-white text-slate-800") + (esHoy && !activo ? " ring-2 ring-blue-300" : "")}
            style={activo ? { background: GRAD_MARCA, backgroundOrigin: "border-box" } : undefined}>
            <span className={"text-sm " + (activo ? "text-white/90" : "text-slate-600")}>{diaSemanaCorto(f.getDay())}</span>
            <span className="text-xl font-bold leading-tight">{f.getDate()}</span>
          </button>
        )
      })}
    </div>
  )
}
