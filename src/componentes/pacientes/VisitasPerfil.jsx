"use client"

import { useMemo, useState } from "react"
import { INK } from "@/lib/tema"
import { ESCALAS_VISITAS, visitasPorPeriodo } from "../../utilidades/tendenciaCitas"
import { hoyISO } from "../../utilidades/disponibilidad"
import { fechaLegible } from "../../utilidades/formatoFecha"
import { etiquetaEstadoCita } from "../../utilidades/estadosCita"

// Las dos gráficas de la pestaña Citas, lado a lado: «Visitas por año» (una línea limpia, con el número sobre cada punto y el año debajo) y «Línea de tiempo de sus visitas» (un punto por cita,
// de su color según el estado). Las dos salen de las mismas citas que los conteos de arriba.
const CARTA = "rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm"
const AZUL = "#2563eb"
const ANCHO = 440
const ALTO = 210

export function VisitasPorPeriodo({ citas = [] }) {
  const [escala, setEscala] = useState("anio")
  const serie = useMemo(() => visitasPorPeriodo(citas, escala, hoyISO()), [citas, escala])
  const max = Math.max(1, ...serie.map((p) => p.total))
  const izq = 44, der = 44, arriba = 38, abajo = 38
  const w = ANCHO - izq - der
  const h = ALTO - arriba - abajo
  const x = (i) => izq + (serie.length <= 1 ? w / 2 : (i / (serie.length - 1)) * w)
  const y = (v) => arriba + h - (v / max) * h
  const linea = serie.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.total).toFixed(1)}`).join(" ")
  const resumen = serie.map((p) => `${p.larga}: ${p.total}`).join(", ")
  return (
    <section aria-label="Visitas por año" className={CARTA}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold" style={{ color: INK }}>{escala === "anio" ? "Visitas por año" : "Visitas por trimestre"}</h2>
        <div role="group" aria-label="Agrupar las visitas" className="inline-flex rounded-lg bg-slate-100 p-0.5">
          {ESCALAS_VISITAS.map((e) => (
            <button key={e.id} type="button" aria-pressed={escala === e.id} onClick={() => setEscala(e.id)} className={"rounded-md px-3 py-1 text-sm font-semibold transition-colors cursor-pointer " + (escala === e.id ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800")}>{e.etiqueta}</button>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} role="img" aria-label={`Visitas: ${resumen}`} className="mt-2 block h-auto w-full">
        <path d={linea} fill="none" stroke={AZUL} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {serie.map((p, i) => (
          <g key={p.clave}>
            <circle cx={x(i)} cy={y(p.total)} r="4.5" fill={AZUL}><title>{`${p.larga}: ${p.total} visita${p.total === 1 ? "" : "s"}`}</title></circle>
            <text x={x(i)} y={y(p.total) - 11} textAnchor="middle" fontSize="13" fontWeight="600" fill={INK}>{p.total}</text>
            <text x={x(i)} y={ALTO - 12} textAnchor="middle" fontSize="12.5" fill="#64748b">{p.etiqueta}</text>
          </g>
        ))}
      </svg>
    </section>
  )
}

const COLOR_ESTADO = { Atendida: "bg-emerald-600", "No Asistió": "bg-red-600", Cancelada: "bg-slate-400", Pendiente: "bg-amber-500", "En Espera": "bg-amber-500", "En Atención": "bg-blue-600" }
const NOMBRE_COLOR = { Atendida: "verde atendida", "No Asistió": "rojo no efectuada", Cancelada: "gris cancelada", Pendiente: "ámbar pendiente", "En Espera": "ámbar pendiente", "En Atención": "azul en atención" }

export function LineaDeVisitas({ citas = [], onElegir }) {
  const validas = useMemo(() => citas.filter((c) => /^\d{4}-\d{2}-\d{2}/.test(c.fecha || "")).slice().sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0)), [citas])
  const ms = (f) => Date.UTC(Number(f.slice(0, 4)), Number(f.slice(5, 7)) - 1, Number(f.slice(8, 10)))
  const ini = validas.length ? ms(validas[0].fecha) : 0
  const span = validas.length ? ms(validas[validas.length - 1].fecha) - ini : 0
  const pct = (c) => (span === 0 ? 50 : 3 + ((ms(c.fecha) - ini) / span) * 94)
  const leyenda = [...new Set(validas.map((c) => NOMBRE_COLOR[c.estado]).filter(Boolean))]
  const primero = validas[0]?.fecha.slice(0, 4)
  const ultimo = validas[validas.length - 1]?.fecha.slice(0, 4)
  return (
    <section aria-label="Línea de tiempo de sus visitas" className={CARTA}>
      <h2 className="text-base font-bold" style={{ color: INK }}>Línea de tiempo de sus visitas</h2>
      <p className="mt-0.5 text-sm text-slate-500">Cada punto es una cita{leyenda.length ? `: ${leyenda.join(", ")}` : ""}</p>
      <div className="relative mx-2 mt-8 h-16">
        <div aria-hidden="true" className="absolute inset-x-0 top-3 h-0.5 rounded-full bg-slate-200" />
        {validas.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={onElegir ? () => onElegir(c) : undefined}
            title={`${fechaLegible(c.fecha)} · ${c.motivo || "Consulta general"} · ${etiquetaEstadoCita(c.estado)}`}
            aria-label={`${fechaLegible(c.fecha)}, ${c.motivo || "consulta general"}, ${etiquetaEstadoCita(c.estado)}. Ver la cita`}
            className={"absolute top-1 h-[18px] w-[18px] -translate-x-1/2 rounded-full ring-2 ring-white transition-transform hover:scale-125 focus-visible:scale-125 cursor-pointer " + (COLOR_ESTADO[c.estado] || "bg-slate-400")}
            style={{ left: `${pct(c)}%` }}
          />
        ))}
        {validas.length > 0 && (
          <div className="absolute inset-x-0 top-11 flex justify-between text-sm text-slate-500" aria-hidden="true">
            <span>{primero}</span>
            {ultimo !== primero && <span>{ultimo}</span>}
          </div>
        )}
      </div>
      {validas.length === 0 && <p className="mt-2 text-sm text-slate-500">Todavía no tiene citas: aparecen aquí cuando se agenda la primera.</p>}
    </section>
  )
}
