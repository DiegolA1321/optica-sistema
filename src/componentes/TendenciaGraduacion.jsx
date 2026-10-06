"use client"

import { useEffect, useRef, useState } from "react"
import { INK } from "@/lib/tema"
import { fechaLegible, fechaCorta } from "../utilidades/formatoFecha"
import { puntosMedidos, cambio, textoDioptrias, textoCambio } from "../utilidades/tendenciaGraduacion"

const OD_COLOR = "#2563EB"
const OI_COLOR = "#0891b2"
const ALTO = 160
const MARGEN = { izq: 40, der: 14, arriba: 12, abajo: 24 }

// Mide el ancho disponible para dibujar el gráfico sin deformar el texto.
function useAncho(ref) {
  const [ancho, setAncho] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const medir = () => setAncho(Math.floor(el.getBoundingClientRect().width))
    medir()
    const obs = new ResizeObserver(medir)
    obs.observe(el)
    return () => obs.disconnect()
  }, [ref])
  return ancho
}

function Leyenda() {
  return (
    <div className="flex items-center gap-4 text-xs font-semibold text-slate-500">
      <span className="flex items-center gap-1.5">
        <svg width="26" height="10" aria-hidden="true"><line x1="0" y1="5" x2="26" y2="5" stroke={OD_COLOR} strokeWidth="2" /><circle cx="13" cy="5" r="3.5" fill="#fff" stroke={OD_COLOR} strokeWidth="2" /></svg>
        Ojo derecho
      </span>
      <span className="flex items-center gap-1.5">
        <svg width="26" height="10" aria-hidden="true"><line x1="0" y1="5" x2="26" y2="5" stroke={OI_COLOR} strokeWidth="2" strokeDasharray="4 3" /><rect x="9.5" y="1.5" width="7" height="7" fill="#fff" stroke={OI_COLOR} strokeWidth="2" /></svg>
        Ojo izquierdo
      </span>
      <span className="ml-auto font-normal text-slate-400">Equivalente esférico</span>
    </div>
  )
}

// Con menos de 3 consultas medidas un gráfico no dice nada: una línea compacta
// por consulta, con el cambio frente a la anterior.
function ListaCompacta({ puntos }) {
  return (
    <ul className="divide-y divide-slate-100 text-sm">
      {puntos.map((p, i) => {
        const prev = puntos[i - 1]
        return (
          <li key={p.fecha + i} className="flex flex-wrap items-baseline gap-x-5 gap-y-0.5 py-2">
            <span className="w-28 shrink-0 font-semibold text-slate-700">{fechaLegible(p.fecha)}</span>
            <span className="tabular-nums text-slate-600"><span className="font-bold" style={{ color: OD_COLOR }}>OD</span> {textoDioptrias(p.od)}</span>
            <span className="tabular-nums text-slate-600"><span className="font-bold" style={{ color: OI_COLOR }}>OI</span> {textoDioptrias(p.oi)}</span>
            <span className="ml-auto text-xs text-slate-500">
              {prev ? <>OD {textoCambio(cambio(prev.od, p.od))} · OI {textoCambio(cambio(prev.oi, p.oi))}</> : "Primera medición"}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

function GraficoPequeno({ puntos }) {
  const ref = useRef(null)
  const ancho = useAncho(ref)
  const [activo, setActivo] = useState(null)
  const valores = puntos.flatMap((p) => [p.od, p.oi]).filter((v) => v !== null)
  // Escala en pasos de 0,25 D y de amplitud múltiplo de 0,5 para que la marca
  // del medio también caiga en un valor "redondo".
  let min = Math.floor(Math.min(...valores) / 0.25) * 0.25
  let max = Math.ceil(Math.max(...valores) / 0.25) * 0.25
  if ((max - min) < 0.5) max = min + 0.5
  if (Math.round((max - min) / 0.25) % 2 === 1) max += 0.25
  const areaW = Math.max(0, ancho - MARGEN.izq - MARGEN.der)
  const areaH = ALTO - MARGEN.arriba - MARGEN.abajo
  const x = (i) => MARGEN.izq + (puntos.length === 1 ? areaW / 2 : (i * areaW) / (puntos.length - 1))
  const y = (v) => MARGEN.arriba + ((max - v) * areaH) / (max - min)
  const trazo = (clave) => {
    let d = ""
    puntos.forEach((p, i) => { if (p[clave] !== null) d += `${d ? "L" : "M"} ${x(i).toFixed(1)} ${y(p[clave]).toFixed(1)} ` })
    return d
  }
  const marcasY = [max, (max + min) / 2, min]
  // Si las consultas abarcan más de un año, la fecha lleva el año para no repetirse.
  const variosAnios = new Set(puntos.map((q) => String(q.fecha).slice(0, 4))).size > 1
  const etiquetaX = (fecha) => (variosAnios ? `${fechaCorta(fecha)} ’${String(fecha).slice(2, 4)}` : fechaCorta(fecha))
  const p = activo !== null ? puntos[activo] : null

  return (
    <div ref={ref} className="relative w-full" style={{ height: ALTO }}>
      {ancho > 0 && (
        <svg width={ancho} height={ALTO} role="img" aria-label="Tendencia de graduación: equivalente esférico de cada ojo por consulta" className="block">
          {marcasY.map((v, i) => (
            <g key={i}>
              <line x1={MARGEN.izq} x2={ancho - MARGEN.der} y1={y(v)} y2={y(v)} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 4" />
              <text x={MARGEN.izq - 6} y={y(v) + 3.5} textAnchor="end" className="fill-slate-400" style={{ fontSize: 11, fontFamily: "inherit" }}>{textoDioptrias(v).replace(" D", "")}</text>
            </g>
          ))}
          {puntos.map((q, i) => (
            <text key={i} x={x(i)} y={ALTO - 6} textAnchor="middle" className="fill-slate-400" style={{ fontSize: 11, fontFamily: "inherit" }}>{etiquetaX(q.fecha)}</text>
          ))}
          {activo !== null && <line x1={x(activo)} x2={x(activo)} y1={MARGEN.arriba} y2={ALTO - MARGEN.abajo} stroke="#94a3b8" strokeWidth="1" />}
          <path d={trazo("od")} fill="none" stroke={OD_COLOR} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d={trazo("oi")} fill="none" stroke={OI_COLOR} strokeWidth="2" strokeDasharray="5 4" strokeLinecap="round" strokeLinejoin="round" />
          {puntos.map((q, i) => q.od !== null && (
            <circle key={"od" + i} cx={x(i)} cy={y(q.od)} r="4" fill="#fff" stroke={OD_COLOR} strokeWidth="2"><title>{`OD ${textoDioptrias(q.od)} · ${fechaLegible(q.fecha)}`}</title></circle>
          ))}
          {puntos.map((q, i) => q.oi !== null && (
            <rect key={"oi" + i} x={x(i) - 3.5} y={y(q.oi) - 3.5} width="7" height="7" fill="#fff" stroke={OI_COLOR} strokeWidth="2"><title>{`OI ${textoDioptrias(q.oi)} · ${fechaLegible(q.fecha)}`}</title></rect>
          ))}
          {puntos.map((q, i) => (
            <rect
              key={"zona" + i}
              x={x(i) - (areaW / Math.max(1, puntos.length - 1)) / 2}
              y={MARGEN.arriba}
              width={areaW / Math.max(1, puntos.length - 1)}
              height={areaH}
              fill="transparent"
              onMouseEnter={() => setActivo(i)}
              onMouseLeave={() => setActivo(null)}
            />
          ))}
        </svg>
      )}
      {p && (
        <div
          role="status"
          className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg border border-slate-200/60 bg-white px-2.5 py-1.5 text-xs shadow-lg"
          style={{ top: 4, left: Math.min(Math.max(x(activo) + 10, 4), Math.max(4, ancho - 190)) }}
        >
          <p className="font-semibold" style={{ color: INK }}>{fechaLegible(p.fecha)}</p>
          <p className="tabular-nums text-slate-600"><span className="font-bold" style={{ color: OD_COLOR }}>OD</span> {textoDioptrias(p.od)} · <span className="font-bold" style={{ color: OI_COLOR }}>OI</span> {textoDioptrias(p.oi)}</p>
        </div>
      )}
    </div>
  )
}

// consultas: de la más antigua a la más reciente.
export default function TendenciaGraduacion({ consultas }) {
  const puntos = puntosMedidos(consultas)
  if (puntos.length === 0) {
    return <p className="py-4 text-sm text-slate-500">Todavía no hay graduación medida en las consultas de este paciente.</p>
  }
  return (
    <div className="space-y-3">
      <Leyenda />
      {puntos.length < 3 ? <ListaCompacta puntos={puntos} /> : <GraficoPequeno puntos={puntos} />}
    </div>
  )
}
