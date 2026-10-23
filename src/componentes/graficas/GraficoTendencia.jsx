"use client"

import { useMemo } from "react"
import { INK } from "@/lib/tema"
import Sugerencia from "../reportes/Sugerencia"
import { analizarTendencia, MIN_PERIODOS_TENDENCIA } from "../../utilidades/tendencia"

// El gráfico de tendencia de todo el sistema (decisión D10): barras por período, la línea del promedio de 3 períodos y la línea punteada de la tendencia.
// Arriba, el último valor con su cambio frente al período anterior y cuánto sube o baja por período según la tendencia; debajo, una frase que lo explica.
// Con menos de 3 períodos con datos no se dibuja la tendencia y la frase dice por qué.
// datos: [{ clave, etiqueta, valor, texto, tip }]. Cada barra se pulsa (onElegir) y abre la lista de lo que la compone.
const AZUL = "#2563eb"
const VERDE = "#15803d"
const ROJO = "#b91c1c"

const redondear = (v) => Math.round(v * 100) / 100
const num = (v) => String(Math.round(v * 10) / 10)

export default function GraficoTendencia({
  datos, onElegir, color = AZUL, alto = 150, periodo = "mes", plural = "registros", sujeto, buenoSiSube = true,
  formato = num, textoPendiente, nombre = "Tendencia",
}) {
  const a = useMemo(() => analizarTendencia(datos, { periodo, plural, sujeto, formato }), [datos, periodo, plural, sujeto, formato])
  const n = datos.length
  const maxValores = Math.max(1, ...a.valores, ...a.promedio, ...a.tendencia.map((v) => v ?? 0))
  const y = (v) => alto - (Math.max(0, v) / maxValores) * alto
  const x = (i) => i + 0.5
  const lineaPromedio = a.promedio.map((v, i) => `${i === 0 ? "M" : "L"}${x(i)},${redondear(y(v))}`).join(" ")
  const puntosTendencia = a.tendencia.map((v, i) => (v == null ? null : `${x(i)},${redondear(y(v))}`)).filter(Boolean)
  const lineaTendencia = puntosTendencia.length > 1 ? `M${puntosTendencia.join(" L")}` : ""
  const plurales = periodo === "mes" ? "meses" : `${periodo}s`

  const favorable = a.direccion === "estable" || a.direccion == null ? null : (a.direccion === "sube") === buenoSiSube
  const colorTendencia = favorable === false ? ROJO : VERDE
  const ultimo = a.valores[n - 1] ?? 0
  const ultimoTexto = datos[n - 1]?.texto ?? formato(ultimo)
  const cambioFavorable = a.cambio == null || a.cambio === 0 ? null : (a.cambio > 0) === buenoSiSube
  const pend = a.pendiente
  const pendienteTexto = pend == null ? "" : textoPendiente ? textoPendiente(pend > 0) : `${plural} ${pend > 0 ? "más" : "menos"} por ${periodo} (tendencia)`

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0 text-sm text-slate-500">Barras: cada {periodo} · línea: promedio de 3 {plurales} · punteada: tendencia</div>
        <div className="flex items-start gap-6">
          <div className="text-right">
            <div className="font-serif text-3xl font-bold leading-none tabular-nums" style={{ color: INK }}>{ultimoTexto}</div>
            <div className="mt-1 text-sm text-slate-500">
              {a.cambio == null ? <span>Sin {periodo} anterior con qué comparar</span> : a.cambio === 0 ? <span>Igual que el {periodo} anterior</span> : (
                <>
                  <span className="font-semibold" style={{ color: cambioFavorable ? VERDE : ROJO }}>{a.cambio > 0 ? "▲" : "▼"} {Math.abs(a.cambio)} %</span> vs. {periodo} anterior
                </>
              )}
            </div>
          </div>
          {pend != null && a.direccion !== "estable" && (
            <div className="max-w-[16rem] text-right">
              <div className="font-serif text-3xl font-bold leading-none tabular-nums" style={{ color: INK }}>{pend > 0 ? "+" : "−"}{formato(Math.abs(pend))}</div>
              <div className="mt-1 text-sm text-slate-500">{pendienteTexto}</div>
            </div>
          )}
        </div>
      </div>

      <figure className="mt-3" aria-label={`${nombre}: ${a.frase}`}>
        <div className="relative flex items-end" style={{ height: alto + 22 }}>
          {datos.map((d) => (
            <Sugerencia key={d.clave} texto={d.tip} className="flex h-full min-w-0 flex-1" as="div">
              <button type="button" data-lista onClick={onElegir ? () => onElegir(d) : undefined} aria-label={d.tip || `${d.etiqueta}: ${d.texto ?? d.valor}`} className="group flex h-full w-full min-w-0 flex-col items-center justify-end gap-1 px-1 outline-none cursor-pointer">
                <span className="max-w-full truncate text-xs font-semibold tabular-nums" style={{ color: INK }}>{d.texto ?? d.valor}</span>
                <span className="w-full rounded-t-md transition-colors group-hover:brightness-95 group-focus-visible:ring-2 group-focus-visible:ring-blue-500" style={{ height: `${Math.max(d.valor > 0 ? 3 : 1, ((d.valor || 0) / maxValores) * alto)}px`, background: d.color || color, opacity: d.valor > 0 ? 0.28 : 0.15 }} />
              </button>
            </Sugerencia>
          ))}
          <svg viewBox={`0 0 ${n} ${alto}`} preserveAspectRatio="none" aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0 w-full" style={{ height: alto }}>
            {lineaPromedio && <path d={lineaPromedio} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
            {lineaTendencia && <path d={lineaTendencia} fill="none" stroke={colorTendencia} strokeWidth="2" strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />}
          </svg>
        </div>
        <div className="flex">
          {datos.map((d) => <span key={d.clave} className="min-w-0 flex-1 truncate text-center text-xs text-slate-500">{d.etiqueta}</span>)}
        </div>
        <figcaption className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-600">
          <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm" style={{ background: color, opacity: 0.28 }} aria-hidden="true" />{plural.charAt(0).toUpperCase() + plural.slice(1)} del {periodo}</span>
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-5 rounded" style={{ background: color }} aria-hidden="true" />Promedio de 3 {plurales}</span>
          {a.hayTendencia && <span className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-dashed" style={{ borderColor: colorTendencia }} aria-hidden="true" />Tendencia</span>}
        </figcaption>
        <div className="mt-3 rounded-lg bg-slate-50 px-3.5 py-2.5 text-sm" style={{ color: INK }} data-frase-tendencia>{a.frase}</div>
        {!a.hayTendencia && a.conHistoria > 0 && <span className="sr-only">La tendencia necesita al menos {MIN_PERIODOS_TENDENCIA} {plurales} con datos.</span>}
      </figure>
    </div>
  )
}
