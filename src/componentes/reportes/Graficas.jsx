"use client"

import { INK } from "@/lib/tema"
import { hora } from "../../utilidades/formatoFecha"
import Sugerencia from "./Sugerencia"

// Gráficas del módulo Reportes: barras y una cuadrícula, siempre con su valor a la vista y el detalle al pasar el cursor.
// Todo se pulsa y abre la lista de lo que lo compone. Sin tortas, sin efectos, sin adorno: el color solo comunica estado.
const AZUL = "#2563eb"

// Filas con una barra horizontal: nombre a la izquierda, barra y valor. filas: [{ id, etiqueta, valor, texto, tip, color }]
export function BarrasLista({ filas, onElegir, color = AZUL, ancho = "w-44", anchoValor = "w-20" }) {
  const max = Math.max(1, ...filas.map((f) => f.valor || 0))
  return (
    <ul className="space-y-1.5">
      {filas.map((f) => (
        <li key={f.id}>
          <Sugerencia texto={f.tip} as="div">
            <button type="button" data-lista onClick={onElegir ? () => onElegir(f) : undefined} aria-label={f.tip || `${f.etiqueta}: ${f.texto ?? f.valor}`} className="flex w-full items-center gap-3 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 cursor-pointer">
              <span className={"truncate text-sm font-medium text-slate-700 " + ancho} title={f.etiqueta}>{f.etiqueta}</span>
              <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
                <span className="block h-full rounded-full" style={{ width: `${Math.max(f.valor > 0 ? 3 : 0, ((f.valor || 0) / max) * 100)}%`, background: f.color || color }} />
              </span>
              <span className={"shrink-0 text-right text-sm font-semibold tabular-nums " + anchoValor} style={{ color: INK }}>{f.texto ?? f.valor}</span>
            </button>
          </Sugerencia>
        </li>
      ))}
    </ul>
  )
}

// Una sola barra repartida en partes (un estado = un color) y debajo cada parte con su número. segmentos: [{ id, etiqueta, valor, color, tip }]
export function BarraRepartida({ segmentos, onElegir }) {
  const total = segmentos.reduce((s, x) => s + x.valor, 0)
  return (
    <div>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-slate-100">
        {segmentos.filter((s) => s.valor > 0).map((s) => (
          <Sugerencia key={s.id} texto={s.tip} as="span" className="block h-full" style={{ width: `${(s.valor / total) * 100}%` }}>
            <button type="button" data-lista onClick={onElegir ? () => onElegir(s) : undefined} aria-label={s.tip || `${s.etiqueta}: ${s.valor}`} className="block h-full w-full outline-none transition-[filter] hover:brightness-90 focus-visible:brightness-90 cursor-pointer" style={{ background: s.color }} />
          </Sugerencia>
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-4">
        {segmentos.map((s) => (
          <li key={s.id}>
            <button type="button" data-lista onClick={onElegir ? () => onElegir(s) : undefined} className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-sm transition-colors hover:bg-slate-50 cursor-pointer">
              <span className="h-3 w-3 shrink-0 rounded-sm" style={{ background: s.color }} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-slate-600" title={s.etiqueta}>{s.etiqueta}</span>
              <span className="font-semibold tabular-nums" style={{ color: INK }}>{s.valor}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

// Cuadrícula día × hora de las citas no efectuadas: cada celda dice cuántas hubo; más rojo = más citas no efectuadas.
export function CuadriculaDiaHora({ cuadricula, onElegir }) {
  const { dias, horas, celdas, max } = cuadricula
  return (
    <table className="w-full table-fixed border-separate border-spacing-1 text-sm">
      <caption className="sr-only">Citas no efectuadas por día de la semana y hora</caption>
      <thead>
        <tr>
          <th scope="col" className="w-12" />
          {horas.map((h) => <th key={h} scope="col" className="truncate text-xs font-semibold text-slate-500">{hora(`${h}:00`)}</th>)}
        </tr>
      </thead>
      <tbody>
        {dias.map((d) => (
          <tr key={d.id}>
            <th scope="row" className="pr-1 text-left text-xs font-semibold text-slate-600">{d.etiqueta}</th>
            {horas.map((h) => {
              const c = celdas.get(`${d.id}-${h}`)
              if (!c) return <td key={h} className="h-9 rounded-md bg-slate-50 text-center text-xs text-slate-300" aria-label="Sin citas">·</td>
              const n = c.noAsistio.length
              const intensidad = max > 0 ? n / max : 0
              const tip = `${d.etiqueta} ${hora(`${h}:00`)}: ${n} no efectuada${n === 1 ? "" : "s"} de ${c.citas.length} cita${c.citas.length === 1 ? "" : "s"}`
              return (
                <td key={h} className="p-0">
                  <Sugerencia texto={tip} as="div">
                    <button type="button" data-lista onClick={() => onElegir?.({ dia: d, hora: h, celda: c, tip })} aria-label={tip} className="h-9 w-full rounded-md text-center text-sm font-semibold tabular-nums outline-none transition-[filter] hover:brightness-95 focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer" style={{ background: n > 0 ? `rgba(220,38,38,${0.15 + 0.7 * intensidad})` : "#f1f5f9", color: n > 0 && intensidad > 0.55 ? "#fff" : n > 0 ? "#991b1b" : "#94a3b8" }}>{n}</button>
                  </Sugerencia>
                </td>
              )
            })}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
