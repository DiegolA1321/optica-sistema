"use client"

import { useState } from "react"
import { INK } from "@/lib/tema"

// Gráfica de tendencia (decisión D10 de la reunión del 20 oct.): una LÍNEA con su área suave y un punto por período, para ver de un vistazo cómo van las cosas. Sirve a todo el sistema
// (perfil del paciente, Reportes, superadmin). puntos: [{ clave, etiqueta, valor, tip }]; `unidad` va en el nombre accesible ("citas"). Cada punto muestra su valor y el detalle al pasar el cursor.
const AZUL = "#2563eb"
const ANCHO = 420
const ALTO = 190
const M = { izq: 26, der: 14, arr: 24, aba: 30 }

export default function LineaTendencia({ puntos = [], unidad = "citas", color = AZUL, titulo = "Tendencia" }) {
  const [activo, setActivo] = useState(null)
  const max = Math.max(1, ...puntos.map((p) => p.valor || 0))
  const tope = max <= 4 ? max + 1 : Math.ceil(max * 1.15)
  const w = ANCHO - M.izq - M.der
  const h = ALTO - M.arr - M.aba
  const x = (i) => M.izq + (puntos.length <= 1 ? w / 2 : (i / (puntos.length - 1)) * w)
  const y = (v) => M.arr + h - ((v || 0) / tope) * h
  const linea = puntos.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.valor).toFixed(1)}`).join(" ")
  const area = puntos.length ? `${linea} L${x(puntos.length - 1).toFixed(1)},${M.arr + h} L${x(0).toFixed(1)},${M.arr + h} Z` : ""
  const marcas = Array.from(new Set([0, Math.round(tope / 2), tope]))
  const salto = puntos.length > 8 ? 2 : 1
  const resumen = puntos.filter((p) => p.valor > 0).map((p) => `${p.tip || p.etiqueta}: ${p.valor}`).join(", ") || `Sin ${unidad}`
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${ANCHO} ${ALTO}`} role="img" aria-label={`${titulo}: ${resumen}`} className="block h-auto w-full">
        {marcas.map((m) => (
          <g key={m}>
            <line x1={M.izq} x2={ANCHO - M.der} y1={y(m)} y2={y(m)} stroke="#e2e8f0" strokeWidth="1" strokeDasharray={m === 0 ? undefined : "3 4"} />
            <text x={M.izq - 6} y={y(m) + 4} textAnchor="end" fontSize="12" fill="#64748b">{m}</text>
          </g>
        ))}
        {area && <path d={area} fill={color} opacity="0.1" />}
        {linea && <path d={linea} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />}
        {puntos.map((p, i) => (
          <g key={p.clave}>
            <circle cx={x(i)} cy={y(p.valor)} r={activo === i ? 5.5 : p.valor > 0 ? 4 : 2.5} fill={p.valor > 0 ? color : "#fff"} stroke={color} strokeWidth="2" />
            {p.valor > 0 && <text x={x(i)} y={y(p.valor) - 9} textAnchor="middle" fontSize="13" fontWeight="700" fill={INK}>{p.valor}</text>}
            {i % salto === 0 && <text x={x(i)} y={ALTO - 10} textAnchor="middle" fontSize="12" fill="#64748b">{p.etiqueta}</text>}
            <rect x={x(i) - w / Math.max(1, puntos.length) / 2} y={M.arr} width={w / Math.max(1, puntos.length)} height={h + 8} fill="transparent" onMouseEnter={() => setActivo(i)} onMouseLeave={() => setActivo(null)}>
              <title>{`${p.tip || p.etiqueta}: ${p.valor} ${unidad}`}</title>
            </rect>
          </g>
        ))}
      </svg>
    </div>
  )
}
