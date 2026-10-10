"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCircle2, ArrowRight, ChevronRight, AlertCircle } from "lucide-react"
import { INK } from "@/lib/tema"
import { Cascaron } from "./AtencionPaciente"

// "Requiere tu atención" del Inicio: una tarjeta por área (Citas, Pacientes, Ventas, Inventario), nunca todo en una sola lista (I4).
// Las tarjetas van en una cuadrícula de dos columnas y las de una misma fila tienen la misma altura. Cada una lleva su ícono, su título y
// su número (el total de avisos del área); como máximo tres avisos (I5), una línea cada uno con su número, qué pasa y los nombres resumidos.
// Un aviso, el encabezado de la tarjeta y "Ver todo →" abren la ventana estándar del sistema (regla 43) encima del Inicio, con una sección por
// tipo de aviso, cada caso con su detalle y su acción, y el enlace "Abrir en …" que dice adónde lleva y con qué número (regla 42).
// Al resolver un caso la lista y los números se actualizan: la ventana lee siempre los avisos actuales. Un área sin avisos dice "Todo en orden".
//
// bloques: [{ id, titulo, modulo, icono, filas, onVerTodo }]; onVerTodo lleva al módulo (se usa en el área que está en orden).
// filas: [{ id, cantidad, texto, nombres?, tono?: "urgente", enlace?: { texto, onClick }, casos: [{ id, nombre, detalle?, insignia?: { texto, tono }, accion?: { etiqueta, onClick, navega? } }] }]
export const AVISOS_POR_TARJETA = 3
const INSIGNIA = { urgente: "border-red-200 bg-red-50 text-red-700", neutro: "border-slate-200 bg-slate-50 text-slate-600", aviso: "border-amber-200 bg-amber-50 text-amber-700" }
const iniciales = (nombre = "") => nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?"

function VentanaAvisos({ bloque, filaId, onCerrar }) {
  const total = bloque.filas.reduce((n, f) => n + (f.cantidad ?? 1), 0)
  const refs = useRef({})
  useEffect(() => {
    if (filaId && refs.current[filaId]) refs.current[filaId].scrollIntoView?.({ block: "start" })
  }, [filaId])
  const ejecutar = (accion) => {
    if (accion.navega) onCerrar()
    accion.onClick()
  }
  return (
    <Cascaron
      titulo={`${bloque.titulo} · ${total} ${total === 1 ? "aviso" : "avisos"}`}
      subtitulo="Lo que requiere tu atención en esta área"
      Icono={bloque.icono}
      onCerrar={onCerrar}
      pie={<>
        <span className="text-xs text-slate-500">Al resolver un caso, esta lista y los números del Inicio se actualizan.</span>
        <button type="button" onClick={onCerrar} className="rounded-lg border border-slate-200/60 px-3.5 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">Cerrar</button>
      </>}
    >
      {bloque.filas.length === 0 ? (
        <p className="flex items-center gap-2 px-5 py-8 text-sm font-medium text-slate-600"><CheckCircle2 size={18} className="shrink-0 text-emerald-600" aria-hidden="true" /> Todo en orden: no queda nada pendiente en esta área.</p>
      ) : bloque.filas.map((f) => (
        <section key={f.id} ref={(el) => { refs.current[f.id] = el }} aria-label={`${f.cantidad ?? 1} ${f.texto}`} className={"border-b border-slate-100 px-5 pb-2 pt-4 last:border-b-0 " + (f.id === filaId ? "bg-slate-50/70" : "")}>
          <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="text-sm font-bold" style={{ color: INK }}>{f.cantidad ?? 1} {f.texto}</h3>
            {f.enlace && (
              <button type="button" onClick={() => { onCerrar(); f.enlace.onClick() }} className="ml-auto flex items-center gap-1 text-sm font-bold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">
                {f.enlace.texto} <ArrowRight size={14} aria-hidden="true" />
              </button>
            )}
          </div>
          <ul>
            {f.casos.map((c) => (
              <li key={c.id} className="flex items-center gap-3 border-t border-slate-100 py-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-50 text-xs font-bold text-blue-600" aria-hidden="true">{iniciales(c.nombre)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold" style={{ color: INK }}>{c.nombre}</p>
                  <p className="text-sm text-slate-500">
                    {c.insignia && <span className={"mr-2 rounded-full border px-2 py-0.5 text-xs font-bold " + (INSIGNIA[c.insignia.tono] || INSIGNIA.neutro)}>{c.insignia.texto}</span>}
                    {c.detalle}
                  </p>
                </div>
                {c.accion && (
                  <button type="button" onClick={() => ejecutar(c.accion)} className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer">
                    {c.accion.etiqueta}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </Cascaron>
  )
}

// El botón "Requieren atención" de cada módulo (Citas, Pacientes, Ventas, Inventario): abre la MISMA ventana de avisos del Inicio, solo con
// los de esa área, con los mismos números y las mismas acciones. Siempre está en su sitio: con avisos es un botón con su número; sin avisos
// es una etiqueta "Todo en orden" (un control no aparece y desaparece, regla 1). bloque: el mismo { id, titulo, icono, filas } del Inicio.
export function BotonRequierenAtencion({ bloque }) {
  const [abierto, setAbierto] = useState(false)
  const total = bloque.filas.reduce((n, f) => n + (f.cantidad ?? 1), 0)
  return (
    <>
      {total > 0 ? (
        <button type="button" onClick={() => setAbierto(true)} aria-label={`Requieren atención: ${total}`} className="flex items-center gap-2 rounded-xl border border-amber-200/70 bg-amber-50 px-3.5 py-2.5 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100 cursor-pointer">
          <AlertCircle size={16} aria-hidden="true" /> Requieren atención
          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-amber-700">{total}</span>
        </button>
      ) : (
        <span className="flex items-center gap-2 rounded-xl border border-emerald-200/70 bg-emerald-50 px-3.5 py-2.5 text-sm font-semibold text-emerald-700"><CheckCircle2 size={16} aria-hidden="true" /> Todo en orden</span>
      )}
      {abierto && <VentanaAvisos bloque={bloque} filaId={null} onCerrar={() => setAbierto(false)} />}
    </>
  )
}

export default function RequiereAtencionPorArea({ bloques }) {
  const [abierto, setAbierto] = useState(null) // { bloqueId, filaId }
  if (bloques.length === 0) return null
  const bloqueAbierto = abierto ? bloques.find((b) => b.id === abierto.bloqueId) : null
  return (
    <section id="requiere-atencion" aria-label="Requiere tu atención" className="scroll-mt-4 space-y-2.5">
      <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Requiere tu atención</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:auto-rows-fr">
        {bloques.map((b) => {
          const Icono = b.icono
          const visibles = b.filas.slice(0, AVISOS_POR_TARJETA)
          const total = b.filas.reduce((n, f) => n + (f.cantidad ?? 1), 0)
          const ocultos = b.filas.slice(AVISOS_POR_TARJETA).reduce((n, f) => n + (f.cantidad ?? 1), 0)
          const abrir = (filaId = null) => setAbierto({ bloqueId: b.id, filaId })
          const encabezado = (
            <>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"><Icono size={18} aria-hidden="true" /></span>
              <span className="text-base font-bold" style={{ color: INK }}>{b.titulo}</span>
              {total > 0
                ? <span className="ml-auto rounded-full bg-amber-50 px-2.5 py-0.5 text-sm font-bold text-amber-700">{total}</span>
                : <span className="ml-auto rounded-full bg-emerald-50 px-2.5 py-0.5 text-sm font-bold text-emerald-700">Todo en orden</span>}
            </>
          )
          return (
            <section key={b.id} aria-label={`Requiere tu atención: ${b.titulo}`} className="flex flex-col rounded-2xl border border-slate-200/60 bg-white shadow-sm">
              {total > 0 ? (
                <button type="button" onClick={() => abrir()} aria-label={`Abrir los avisos de ${b.titulo}`} className="flex items-center gap-3 rounded-t-2xl border-b border-slate-100 px-4 py-3 text-left transition-colors hover:bg-slate-50 cursor-pointer">{encabezado}</button>
              ) : (
                <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">{encabezado}</div>
              )}
              {visibles.length > 0 ? (
                <ul className="flex-1 divide-y divide-slate-100">
                  {visibles.map((f) => (
                    <li key={f.id}>
                      <button type="button" onClick={() => abrir(f.id)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50 cursor-pointer">
                        <p className="min-w-0 flex-1 truncate text-sm text-slate-700">
                          <span className={"font-bold " + (f.tono === "urgente" ? "text-red-700" : "")} style={f.tono === "urgente" ? undefined : { color: INK }}>{f.cantidad ?? 1}</span> {f.texto}
                          {f.nombres && <span className="text-slate-500"> · {f.nombres}</span>}
                        </p>
                        <ChevronRight size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="flex flex-1 items-center gap-2 px-4 py-4 text-sm text-slate-600"><CheckCircle2 size={16} className="shrink-0 text-emerald-600" aria-hidden="true" /> Nada pendiente en esta área.</p>
              )}
              <footer className="flex items-center border-t border-slate-100 px-4 py-2.5 text-sm">
                {ocultos > 0 && <span className="text-slate-500">{ocultos === 1 ? "1 elemento más" : `${ocultos} elementos más`}</span>}
                {total > 0 ? (
                  <button type="button" onClick={() => abrir()} aria-label={`Ver todo en ${b.titulo}`} className="ml-auto flex items-center gap-1 font-bold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">
                    Ver todo <ArrowRight size={14} aria-hidden="true" />
                  </button>
                ) : (
                  <button type="button" onClick={b.onVerTodo} aria-label={`Abrir ${b.modulo || b.titulo}`} className="ml-auto flex items-center gap-1 font-bold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">
                    Abrir {b.modulo || b.titulo} <ArrowRight size={14} aria-hidden="true" />
                  </button>
                )}
              </footer>
            </section>
          )
        })}
      </div>
      {bloqueAbierto && <VentanaAvisos bloque={bloqueAbierto} filaId={abierto.filaId} onCerrar={() => setAbierto(null)} />}
    </section>
  )
}
