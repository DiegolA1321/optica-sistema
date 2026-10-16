"use client"

import CampoFecha from "../CampoFecha"
import { GRAD_MARCA } from "@/lib/tema"
import { PERIODOS } from "../../utilidades/reportesPeriodo"

// El selector de período de Reportes (Este mes · Mes pasado · Últimos 3 meses · Últimos 6 meses · Este año · Personalizado) con sus dos fechas.
// Lo usan Reportes y el Resumen del superadmin: el mismo control, en el mismo lugar y con los mismos nombres.
export default function SelectorPeriodo({ periodo, onPeriodo, personalizado, onPersonalizado, rango, prefijo = "rep" }) {
  return (
    <>
      <div role="group" aria-label="Período" className="flex flex-wrap rounded-lg border border-slate-200/60 bg-white p-0.5">
        {PERIODOS.map((p) => (
          <button key={p.id} type="button" aria-pressed={periodo === p.id} onClick={() => onPeriodo(p.id)} className={"rounded-md px-2.5 py-1.5 text-sm font-semibold transition-colors cursor-pointer " + (periodo === p.id ? "text-white" : "text-slate-600 hover:bg-slate-50")} style={periodo === p.id ? { background: GRAD_MARCA } : undefined}>{p.label}</button>
        ))}
      </div>
      {periodo === "personalizado" && (
        <>
          <div className="w-44"><CampoFecha id={`${prefijo}-desde`} etiqueta="Desde" valor={personalizado.inicio || rango.inicio} onCambiar={(v) => onPersonalizado((p) => ({ ...p, inicio: v }))} max={personalizado.fin || rango.fin} /></div>
          <div className="w-44"><CampoFecha id={`${prefijo}-hasta`} etiqueta="Hasta" valor={personalizado.fin || rango.fin} onCambiar={(v) => onPersonalizado((p) => ({ ...p, fin: v }))} min={personalizado.inicio || rango.inicio} /></div>
        </>
      )}
    </>
  )
}
