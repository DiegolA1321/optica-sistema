"use client"

import { useEffect, useRef, useState } from "react"
import { formatoFecha } from "../../utilidades/formatoFecha"
import { textoDioptrias } from "../../utilidades/tendenciaGraduacion"

const AZUL = "#2563EB"
const CIAN = "#0E7490"

// Mide el ancho disponible para dibujar con el tamaño real (así el texto de la gráfica nunca baja de 14 px, ni en el celular).
function useAncho(ref) {
  const [ancho, setAncho] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const medir = () => setAncho(Math.floor(el.getBoundingClientRect().width))
    medir()
    if (typeof ResizeObserver === "undefined") return undefined
    const obs = new ResizeObserver(medir)
    obs.observe(el)
    return () => obs.disconnect()
  }, [ref])
  return ancho
}

// La graduación de cada ojo en cada receta, como una línea sencilla (de la receta más antigua a la más reciente). Los puntos son los de la tendencia del perfil del paciente en el
// sistema del personal (equivalente esférico); más arriba = más corrección. Cada punto lleva su valor escrito, para no depender de adivinar la altura.
export default function GraficaGraduacion({ puntos }) {
  const caja = useRef(null)
  const ancho = useAncho(caja)
  const ALTO = 250
  const M = { izq: 16, der: 16, arriba: 34, abajo: 54 }
  const w = Math.max(ancho, 260)
  const valores = puntos.flatMap((p) => [p.od, p.oi]).filter((v) => v !== null).map(Math.abs)
  const max = Math.max(1, Math.ceil(Math.max(...valores) * 2) / 2 + 0.5)
  const x = (i) => (puntos.length === 1 ? w / 2 : M.izq + 28 + (i * (w - M.izq - M.der - 56)) / (puntos.length - 1))
  const y = (v) => M.arriba + (1 - Math.abs(v) / max) * (ALTO - M.arriba - M.abajo)
  const linea = (clave) => puntos.map((p, i) => (p[clave] === null ? null : `${x(i)},${y(p[clave])}`)).filter(Boolean).join(" ")
  const valorEn = (clave, i) => puntos[i][clave]
  return (
    <div ref={caja} className="w-full">
      <div className="mb-2 flex flex-wrap gap-x-5 gap-y-1 text-base font-semibold text-slate-700">
        <span className="flex items-center gap-2"><svg width="30" height="12" aria-hidden="true"><line x1="0" y1="6" x2="30" y2="6" stroke={AZUL} strokeWidth="3" /><circle cx="15" cy="6" r="4.5" fill="#fff" stroke={AZUL} strokeWidth="2.5" /></svg> Ojo derecho</span>
        <span className="flex items-center gap-2"><svg width="30" height="12" aria-hidden="true"><line x1="0" y1="6" x2="30" y2="6" stroke={CIAN} strokeWidth="3" strokeDasharray="5 4" /><rect x="10" y="1.5" width="9" height="9" fill="#fff" stroke={CIAN} strokeWidth="2.5" /></svg> Ojo izquierdo</span>
      </div>
      {ancho > 0 && (
        <svg role="img" width={w} height={ALTO} viewBox={`0 0 ${w} ${ALTO}`} aria-label={"Tu graduación en cada receta: " + puntos.map((p) => `${formatoFecha(p.fecha, "mesAnioCorto")}, ojo derecho ${textoDioptrias(p.od)}, ojo izquierdo ${textoDioptrias(p.oi)}`).join("; ")}>
          {[0, 0.5, 1].map((f) => <line key={f} x1={M.izq} x2={w - M.der} y1={M.arriba + f * (ALTO - M.arriba - M.abajo)} y2={M.arriba + f * (ALTO - M.arriba - M.abajo)} stroke="#E2E8F0" strokeWidth="1" />)}
          <polyline points={linea("od")} fill="none" stroke={AZUL} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" />
          <polyline points={linea("oi")} fill="none" stroke={CIAN} strokeWidth="3.5" strokeDasharray="7 6" strokeLinejoin="round" strokeLinecap="round" />
          {puntos.map((p, i) => (
            <g key={p.fecha + i}>
              {p.od !== null && <circle cx={x(i)} cy={y(p.od)} r="6" fill="#fff" stroke={AZUL} strokeWidth="3" />}
              {p.oi !== null && <rect x={x(i) - 6} y={y(p.oi) - 6} width="12" height="12" fill="#fff" stroke={CIAN} strokeWidth="3" />}
              {p.od !== null && <text x={x(i)} y={y(p.od) + (p.oi !== null && Math.abs(Math.abs(p.od) - Math.abs(p.oi)) < 0.2 ? -14 : -13)} textAnchor="middle" fontSize="16" fontWeight="700" fill={AZUL}>{textoDioptrias(valorEn("od", i)).replace(" D", "")}</text>}
              {p.oi !== null && <text x={x(i)} y={y(p.oi) + 26} textAnchor="middle" fontSize="16" fontWeight="700" fill={CIAN}>{textoDioptrias(valorEn("oi", i)).replace(" D", "")}</text>}
              <text x={x(i)} y={ALTO - 22} textAnchor="middle" fontSize="16" fill="#475569">{formatoFecha(p.fecha, "mesAnioCorto")}</text>
            </g>
          ))}
        </svg>
      )}
    </div>
  )
}
