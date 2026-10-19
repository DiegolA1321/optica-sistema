"use client"

import { useRef } from "react"
import { formatoFecha, nombreMes } from "../../utilidades/formatoFecha"
import { textoDioptrias } from "../../utilidades/tendenciaGraduacion"
import { valorD } from "../../utilidades/portalVistas"
import { useAnchoDe } from "./useAncho"

const AZUL = "#1D5FD6"
const NARANJA = "#B45309"

// «Sept 2025», «Marzo 2026»: el mes con su nombre (septiembre, el más largo, como "Sept") y el año, como en el diseño aprobado.
const etiquetaMes = (iso, corta = false) => { const [a, m] = String(iso).split("-").map(Number); if (corta) { const c = nombreMes(m - 1, "corto"); return `${c.charAt(0).toUpperCase()}${c.slice(1)} ${a}` } const n = nombreMes(m - 1); return `${n === "septiembre" ? "Sept" : n.charAt(0).toUpperCase() + n.slice(1)} ${a}` }

// La graduación de cada ojo en cada receta: una línea azul continua para el ojo derecho y una naranja punteada para el izquierdo, con su punto en cada receta, de la más antigua a
// la más reciente. El eje es el valor real de la tendencia del perfil del paciente en el sistema del personal (equivalente esférico: −2.25 está más abajo que −1.75).
export default function GraficaGraduacion({ puntos }) {
  const caja = useRef(null)
  const ancho = useAnchoDe(caja)
  const ALTO = 230
  const M = { izq: 62, der: 18, arriba: 16, abajo: 44 }
  const w = Math.max(ancho, 260)
  const valores = puntos.flatMap((p) => [p.od, p.oi]).filter((v) => v !== null)
  // Las marcas del eje van en múltiplos de 0.50 (de 1.00 si hay muchas): −1.50, −2.00, −2.50.
  let paso = 0.5
  let hasta = Math.ceil(Math.max(...valores) / paso) * paso
  let piso = Math.floor(Math.min(...valores) / paso) * paso
  if (hasta === piso) { hasta += paso; piso -= paso }
  if ((hasta - piso) / paso > 4) { paso = 1; hasta = Math.ceil(Math.max(...valores)); piso = Math.floor(Math.min(...valores)); if (hasta === piso) { hasta += 1; piso -= 1 } }
  const marcas = []
  for (let v = hasta; v >= piso - 1e-9; v -= paso) marcas.push(Math.round(v * 100) / 100)
  const x = (i) => (puntos.length === 1 ? (M.izq + w - M.der) / 2 : M.izq + 26 + (i * (w - M.izq - M.der - 52)) / (puntos.length - 1))
  const y = (v) => M.arriba + ((hasta - v) / (hasta - piso)) * (ALTO - M.arriba - M.abajo)
  const linea = (clave) => puntos.map((p, i) => (p[clave] === null ? null : `${x(i)},${y(p[clave])}`)).filter(Boolean).join(" ")
  return (
    <div ref={caja} className="w-full">
      {(

        <svg role="img" width={w} height={ALTO} viewBox={`0 0 ${w} ${ALTO}`} aria-label={"Tu graduación en cada receta: " + puntos.map((p) => `${formatoFecha(p.fecha, "mesAnioCorto")}, ojo derecho ${textoDioptrias(p.od)}, ojo izquierdo ${textoDioptrias(p.oi)}`).join("; ")}>
          {marcas.map((m) => (
            <g key={m}>
              <line x1={M.izq} x2={w - M.der} y1={y(m)} y2={y(m)} stroke="#E6ECF4" strokeWidth="1" />
              <text x={M.izq - 10} y={y(m) + 5} textAnchor="end" fontSize="16" fill="#334155">{valorD(m)}</text>
            </g>
          ))}
          <polyline points={linea("od")} fill="none" stroke={AZUL} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          <polyline points={linea("oi")} fill="none" stroke={NARANJA} strokeWidth="3" strokeDasharray="7 6" strokeLinejoin="round" strokeLinecap="round" />
          {puntos.map((p, i) => (
            <g key={p.fecha + i}>
              {p.od !== null && <circle cx={x(i)} cy={y(p.od)} r="6.5" fill={AZUL} />}
              {p.oi !== null && <circle cx={x(i)} cy={y(p.oi)} r="6.5" fill={NARANJA} />}
              <text x={x(i)} y={ALTO - 14} textAnchor={i === 0 && puntos.length > 1 ? "start" : i === puntos.length - 1 && puntos.length > 1 ? "end" : "middle"} dx={i === 0 && puntos.length > 1 ? -20 : i === puntos.length - 1 && puntos.length > 1 ? 20 : 0} fontSize="16" fill="#475569">{etiquetaMes(p.fecha, w < 460)}</text>
            </g>
          ))}
        </svg>
      )}
      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-base text-pt-texto">
        <span className="flex items-center gap-2"><svg width="26" height="8" aria-hidden="true"><line x1="0" y1="4" x2="26" y2="4" stroke={AZUL} strokeWidth="3" /></svg> Ojo derecho</span>
        <span className="flex items-center gap-2"><svg width="26" height="8" aria-hidden="true"><line x1="0" y1="4" x2="26" y2="4" stroke={NARANJA} strokeWidth="3" strokeDasharray="6 4" /></svg> Ojo izquierdo</span>
      </div>
    </div>
  )
}
