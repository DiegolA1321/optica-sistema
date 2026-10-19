"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { Check, ChevronDown, Maximize2 } from "lucide-react"
import { INK } from "@/lib/tema"
import HojaReceta from "../HojaReceta"

// Piezas de la ficha clínica de una sola página: la barra de pasos que salta a cada sección, la sección con su estado, el bloque opcional plegable y la vista previa de la hoja que se imprime.
// Los estados son { texto, tono } con tono «ok» (completo), «pend» (falta algo) o «neutro» (opcional o sin empezar).
const TONOS = {
  ok: "bg-emerald-50 text-emerald-700",
  pend: "bg-amber-50 text-amber-800",
  neutro: "bg-slate-100 text-slate-600",
}

export function EstadoSeccion({ estado, className = "" }) {
  if (!estado?.texto) return null
  return <span className={"shrink-0 rounded-full px-3 py-1 text-sm font-semibold " + (TONOS[estado.tono] || TONOS.neutro) + " " + className}>{estado.texto}</span>
}

// Una sección de la ficha: número, título corto y su estado a la derecha. `id` es el mismo que usa la barra de pasos para saltar hasta aquí.
export function SeccionFicha({ id, n, titulo, estado, children, className = "" }) {
  return (
    <section id={`ficha-${id}`} aria-labelledby={`ficha-${id}-titulo`} className={"@container scroll-mt-[calc(var(--alto-cabecera-ficha,7rem)+0.75rem)] rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm " + className}>
      <h2 id={`ficha-${id}-titulo`} className="mb-4 flex items-center gap-3 font-serif text-lg font-bold" style={{ color: INK }}>
        <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 font-sans text-sm font-bold text-white">{n}</span>
        {titulo}
        <EstadoSeccion estado={estado} className="ml-auto font-sans" />
      </h2>
      {children}
    </section>
  )
}

// La barra de pasos: cada botón lleva a su sección. Nombres cortos, siempre completos (nunca «Anam…»); la sección en pantalla va resaltada y el ✓ aparece cuando el paso está completo.
export function BarraPasos({ pasos, activa, onIr }) {
  return (
    <nav aria-label="Pasos de la ficha" className="overflow-x-auto">
      <ol className="flex min-w-max gap-2 sm:min-w-0">
        {pasos.map((p, i) => {
          const ahora = activa === p.id
          const completo = p.estado?.tono === "ok"
          return (
            <li key={p.id} className="flex-1">
              <button type="button" onClick={() => onIr(p.id)} aria-current={ahora ? "step" : undefined}
                className={"flex min-h-11 w-full items-center justify-center gap-2 whitespace-nowrap rounded-xl border px-3 text-base font-semibold transition-colors cursor-pointer " + (ahora ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-700")}>
                <span aria-hidden="true" className={"grid h-6 w-6 shrink-0 place-items-center rounded-full text-sm font-bold " + (completo ? "bg-emerald-100 text-emerald-700" : ahora ? "bg-blue-600 text-white" : p.estado?.tono === "pend" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600")}>
                  {completo ? <Check size={14} /> : i + 1}
                </span>
                {p.label}
                {completo && <span className="sr-only"> (completo)</span>}
                {p.estado?.tono === "pend" && <span className="sr-only"> (falta algo)</span>}
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}

// Bloque opcional que se pliega (retinoscopía, examen físico, biomicroscopía…): lo opcional no estorba, y el distintivo dice a simple vista si ya tiene algo.
export function BloqueOpcional({ icono: Icono, titulo, nota, registrado, abierto, onAlternar, children }) {
  return (
    <div className="rounded-xl border border-slate-200/70 bg-slate-50/60 p-4">
      <button type="button" onClick={onAlternar} aria-expanded={Boolean(abierto)} className="flex w-full items-center gap-2 text-left text-base font-semibold cursor-pointer" style={{ color: INK }}>
        <Icono size={18} className="shrink-0 text-blue-600" aria-hidden="true" />
        <span className="min-w-0">{titulo}</span>
        <span className="ml-auto flex shrink-0 items-center gap-2 text-sm font-normal text-slate-500">
          {nota && <span className="hidden @[30rem]:inline">{nota}</span>}
          <span className={"rounded-full px-2.5 py-0.5 text-sm font-semibold " + (registrado ? TONOS.ok : TONOS.neutro)}>{registrado ? "Registrado" : "No registrado"}</span>
        </span>
        <ChevronDown size={18} aria-hidden="true" className={"shrink-0 text-slate-500 transition-transform " + (abierto ? "" : "-rotate-90")} />
      </button>
      {abierto && <div className="mt-3 space-y-3 border-t border-slate-200/70 pt-3">{children}</div>}
    </div>
  )
}

// La hoja de la receta tal como sale impresa (la misma HojaReceta), reducida al ancho del panel: el texto es el de la hoja, solo cambia la escala. «Ver a tamaño real» la abre completa.
const ANCHO_HOJA = 780
export function VistaPreviaHoja({ datos, onAmpliar }) {
  const caja = useRef(null)
  const hoja = useRef(null)
  const [escala, setEscala] = useState(0.45)
  const [alto, setAlto] = useState(null)
  useLayoutEffect(() => {
    const medir = () => {
      if (caja.current) setEscala(Math.min(1, caja.current.clientWidth / ANCHO_HOJA))
      if (hoja.current) setAlto(hoja.current.offsetHeight)
    }
    medir()
    if (typeof ResizeObserver === "undefined") return undefined
    const o = new ResizeObserver(medir)
    if (caja.current) o.observe(caja.current)
    if (hoja.current) o.observe(hoja.current)
    return () => o.disconnect()
  }, [])
  return (
    <div>
      <div ref={caja} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" style={alto ? { height: alto * escala } : undefined}>
        <div ref={hoja} style={{ width: ANCHO_HOJA, transform: `scale(${escala})`, transformOrigin: "top left" }}><HojaReceta {...datos} /></div>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2 text-sm text-slate-500">
        <span>Tal como se imprimirá · se actualiza al escribir</span>
        {onAmpliar && <button type="button" onClick={onAmpliar} className="inline-flex shrink-0 items-center gap-1 rounded-lg px-1 font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"><Maximize2 size={14} aria-hidden="true" /> Ver a tamaño real</button>}
      </div>
    </div>
  )
}

// Mide la cabecera fija (paciente + pasos) y publica su alto como --alto-cabecera-ficha, para que el panel de la receta y los saltos de sección queden justo debajo.
export function useAltoCabecera(ref) {
  useEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const poner = () => el.parentElement?.style.setProperty("--alto-cabecera-ficha", `${el.offsetHeight}px`)
    poner()
    if (typeof ResizeObserver === "undefined") return undefined
    const o = new ResizeObserver(poner)
    o.observe(el)
    return () => o.disconnect()
  }, [ref])
}

// Qué sección va a la vista mientras se desplaza: la última que cruza la franja bajo la cabecera.
export function useSeccionActiva(ids, activarDeNuevo) {
  const [activa, setActiva] = useState(ids[0])
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return undefined
    const visibles = new Set()
    const o = new IntersectionObserver((entradas) => {
      for (const e of entradas) { const id = e.target.id.replace("ficha-", ""); if (e.isIntersecting) visibles.add(id); else visibles.delete(id) }
      const ultima = [...ids].reverse().find((id) => visibles.has(id))
      if (ultima) setActiva(ultima)
    }, { rootMargin: "-170px 0px -55% 0px" })
    ids.forEach((id) => { const el = document.getElementById(`ficha-${id}`); if (el) o.observe(el) })
    return () => o.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activarDeNuevo])
  return [activa, setActiva]
}
