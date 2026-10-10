"use client"

import { useMemo, useRef, useState, useEffect } from "react"
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react"
import { fechaAISO, hoyISO } from "../utilidades/disponibilidad"
import { formatoFecha, MESES_LARGOS } from "../utilidades/formatoFecha"
import { INK } from "@/lib/tema"

const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)"
const DIAS_CORTOS = ["L", "M", "X", "J", "V", "S", "D"]

const aFecha = (iso) => new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, 1)

// Campo de fecha con el calendario del sistema (el mismo de SelectorFechaHora), para fechas que no dependen del horario:
// fecha de nacimiento, vencimientos... El mes y el año se eligen en listas, para llegar a 1950 sin pulsar 800 veces "anterior".
// El calendario se abre en línea debajo del campo (no flota) para que ningún modal con scroll lo recorte.
export default function CampoFecha({ id, valor, onCambiar, max = hoyISO(), min = "", error = false, placeholder = "Elige una fecha", icono: Icono = Calendar, requerido = false }) {
  const [abierto, setAbierto] = useState(false)
  const [mesVista, setMesVista] = useState(() => aFecha(valor || max))
  const raiz = useRef(null)

  useEffect(() => {
    if (!abierto) return undefined
    const fuera = (e) => { if (raiz.current && !raiz.current.contains(e.target)) setAbierto(false) }
    const tecla = (e) => { if (e.key === "Escape") { e.stopPropagation(); setAbierto(false) } }
    document.addEventListener("mousedown", fuera)
    document.addEventListener("keydown", tecla, true)
    return () => { document.removeEventListener("mousedown", fuera); document.removeEventListener("keydown", tecla, true) }
  }, [abierto])

  const anioMax = Number(max.slice(0, 4))
  const anioMin = min ? Number(min.slice(0, 4)) : anioMax - 110
  const anios = useMemo(() => Array.from({ length: anioMax - anioMin + 1 }, (_, i) => anioMax - i), [anioMax, anioMin])

  const dias = useMemo(() => {
    const y = mesVista.getFullYear()
    const m = mesVista.getMonth()
    const offset = (new Date(y, m, 1).getDay() + 6) % 7 // lunes = 0
    const arr = Array(offset).fill(null)
    for (let n = 1; n <= new Date(y, m + 1, 0).getDate(); n++) {
      const iso = fechaAISO(new Date(y, m, n))
      arr.push({ numero: n, iso, bloqueado: iso > max || (min && iso < min) })
    }
    return arr
  }, [mesVista, max, min])

  const moverMes = (d) => setMesVista((v) => new Date(v.getFullYear(), v.getMonth() + d, 1))
  const alcanzable = (d) => { const n = new Date(mesVista.getFullYear(), mesVista.getMonth() + d, 1); return n.getFullYear() <= anioMax && n.getFullYear() >= anioMin && fechaAISO(n) <= max }
  const alAbrir = () => { if (!abierto) setMesVista(aFecha(valor || max)); setAbierto((a) => !a) }
  const elegir = (iso) => { onCambiar(iso); setAbierto(false) }
  const lista = "rounded-lg border border-slate-200/60 bg-white px-2 py-1 text-xs font-bold outline-none transition-colors focus-visible:border-blue-500 cursor-pointer"

  return (
    <div ref={raiz}>
      <button
        id={id} type="button" onClick={alAbrir} aria-haspopup="dialog" aria-expanded={abierto} aria-required={requerido || undefined}
        className={"flex w-full items-center gap-2 rounded-xl border bg-slate-50 py-2.5 pl-3 pr-3 text-left text-sm outline-none transition-colors focus-visible:bg-white focus-visible:ring-2 cursor-pointer " + (error ? "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-100" : "border-slate-200/60 focus-visible:border-blue-500 focus-visible:ring-blue-50")}
      >
        <Icono size={15} className="shrink-0 text-slate-500" aria-hidden="true" />
        <span className={valor ? "text-slate-800" : "text-slate-400"}>{valor ? formatoFecha(valor, "medio") : placeholder}</span>
      </button>
      {abierto && (
        <div role="dialog" aria-label="Elegir fecha" className="mt-2 rounded-xl border border-slate-200/60 bg-slate-50/40 p-3" style={{ animation: "rise-in 180ms ease-out both" }}>
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <select aria-label="Mes" value={mesVista.getMonth()} onChange={(e) => setMesVista(new Date(mesVista.getFullYear(), Number(e.target.value), 1))} className={lista} style={{ color: INK }}>
                {MESES_LARGOS.map((nombre, i) => <option key={nombre} value={i} className="capitalize">{nombre.charAt(0).toUpperCase() + nombre.slice(1)}</option>)}
              </select>
              <select aria-label="Año" value={mesVista.getFullYear()} onChange={(e) => setMesVista(new Date(Number(e.target.value), mesVista.getMonth(), 1))} className={lista} style={{ color: INK }}>
                {anios.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="flex gap-1 text-slate-500">
              <button type="button" onClick={() => moverMes(-1)} disabled={!alcanzable(-1)} aria-label="Mes anterior" className={"rounded-md p-0.5 transition-colors " + (alcanzable(-1) ? "hover:bg-slate-200 hover:text-slate-700 cursor-pointer" : "cursor-not-allowed opacity-30")}><ChevronLeft size={14} /></button>
              <button type="button" onClick={() => moverMes(1)} disabled={!alcanzable(1)} aria-label="Mes siguiente" className={"rounded-md p-0.5 transition-colors " + (alcanzable(1) ? "hover:bg-slate-200 hover:text-slate-700 cursor-pointer" : "cursor-not-allowed opacity-30")}><ChevronRight size={14} /></button>
            </div>
          </div>
          <div className="mb-1.5 grid grid-cols-7 gap-1 text-center text-[9px] font-bold text-slate-500">
            {DIAS_CORTOS.map((d, i) => <span key={i}>{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {dias.map((dia, i) => {
              if (!dia) return <span key={"e" + i} />
              const sel = valor === dia.iso
              return (
                <button
                  key={dia.iso} type="button" disabled={dia.bloqueado} onClick={() => elegir(dia.iso)} aria-pressed={sel}
                  className={"grid h-7 w-full place-items-center rounded-lg border text-[11px] font-bold transition-colors " + (dia.bloqueado ? "cursor-not-allowed border-slate-100 bg-slate-50/60 text-slate-300" : sel ? "border-transparent text-white shadow-md" : "border-slate-200/60 bg-white text-slate-700 hover:border-blue-400 cursor-pointer")}
                  style={sel ? { background: GRAD } : undefined}
                >
                  {dia.numero}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
