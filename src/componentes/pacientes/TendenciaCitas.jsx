"use client"

import { useMemo, useState } from "react"
import { INK } from "@/lib/tema"
import LineaTendencia from "../graficas/LineaTendencia"
import { ESCALAS_TENDENCIA, ESCALA_POR_DEFECTO, tendenciaDeCitas } from "../../utilidades/tendenciaCitas"
import { hoyISO } from "../../utilidades/disponibilidad"

// La tendencia de las citas del paciente: una línea con selector de semana, mes y año (por defecto, mes). Va junto a los conteos en la pestaña Citas del perfil.
export default function TendenciaCitas({ citas }) {
  const [escala, setEscala] = useState(ESCALA_POR_DEFECTO)
  const serie = useMemo(() => tendenciaDeCitas(citas, escala, hoyISO()), [citas, escala])
  const total = serie.reduce((a, p) => a + p.total, 0)
  const def = ESCALAS_TENDENCIA.find((e) => e.id === escala)
  return (
    <section aria-label="Tendencia de las citas" className="rounded-2xl border border-slate-200/60 bg-white p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold" style={{ color: INK }}>Citas por {escala === "semana" ? "semana" : escala === "anio" ? "año" : "mes"}</h3>
          <p className="text-xs text-slate-500">{def.ayuda} · sin contar las canceladas</p>
        </div>
        <div role="group" aria-label="Escala de la tendencia" className="flex items-center gap-0.5 rounded-lg border border-slate-200/60 bg-slate-50 p-0.5">
          {ESCALAS_TENDENCIA.map((e) => (
            <button key={e.id} type="button" aria-pressed={escala === e.id} onClick={() => setEscala(e.id)} className={"rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer " + (escala === e.id ? "bg-white text-blue-700 shadow-sm" : "text-slate-500 hover:text-slate-800")}>{e.etiqueta}</button>
          ))}
        </div>
      </div>
      {total === 0
        ? <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-center text-sm text-slate-500">Sin citas en este período. Prueba con otra escala.</p>
        : <LineaTendencia puntos={serie.map((p) => ({ clave: p.clave, etiqueta: p.etiqueta, valor: p.total, tip: p.larga }))} unidad="citas" titulo={`Citas por ${escala === "semana" ? "semana" : escala === "anio" ? "año" : "mes"}`} />}
    </section>
  )
}
