"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCircle2, ArrowRight, AlertCircle } from "lucide-react"
import { INK } from "@/lib/tema"
import { Cascaron } from "./AtencionPaciente"

// «Requiere tu atención» del Inicio (reunión del 20 oct., ATN-1): una tarjeta por área (Citas, Pacientes, Ventas, Inventario), nunca todo en una sola lista (I4), y dentro de
// cada área, como máximo TRES tarjetitas: cada una con el número grande y debajo una leyenda corta («por contactar», «con stock bajo»), sin nombres de pacientes
// (nadie lee tanto texto). Pulsar una tarjetita abre SU lista en la ventana estándar del sistema (regla 43), con cada caso, su detalle y su acción, y el enlace
// «Abrir en …» que dice adónde lleva y con qué número (regla 42). «Ver todo» lleva al módulo (con el filtro del aviso cuando el área tiene un solo tipo de aviso).
// Si hay más de tres tipos, «N más» abre la ventana con todas las del área. Al resolver un caso la lista y los números se actualizan: la ventana lee siempre los
// avisos actuales. Un área sin avisos dice «Todo en orden» en una línea.
//
// bloques: [{ id, titulo, modulo, icono, filas, onVerTodo }]; onVerTodo lleva al módulo.
// filas: [{ id, cantidad, texto, corto?, tono?: "urgente", enlace?: { texto, onClick }, casos: [{ id, nombre, detalle?, icono?, insignia?: { texto, tono }, accion?: { etiqueta, onClick, navega? } }] }]
// `texto` es la frase completa (nombre accesible y título de la ventana); `corto` es la leyenda de la tarjetita.
export const AVISOS_POR_TARJETA = 3
const INSIGNIA = { urgente: "border-red-200 bg-red-50 text-red-700", neutro: "border-slate-200 bg-slate-50 text-slate-600", aviso: "border-amber-200 bg-amber-50 text-amber-700" }
const iniciales = (nombre = "") => nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "?"

function VentanaAvisos({ bloque: bloqueCompleto, filaId, soloFila = false, onCerrar }) {
  // Con soloFila la ventana es la lista de ESA tarjetita; sin ella, todas las del área (el botón «Requieren atención» de cada módulo, o «N más»).
  const bloque = soloFila && filaId ? { ...bloqueCompleto, filas: bloqueCompleto.filas.filter((f) => f.id === filaId) } : bloqueCompleto
  const total = bloque.filas.reduce((n, f) => n + (f.cantidad ?? 1), 0)
  const refs = useRef({})
  useEffect(() => {
    if (filaId && !soloFila && refs.current[filaId]) refs.current[filaId].scrollIntoView?.({ block: "start" })
  }, [filaId, soloFila])
  const ejecutar = (accion) => {
    if (accion.navega) onCerrar()
    accion.onClick()
  }
  const unica = soloFila ? bloque.filas[0] : null
  return (
    <Cascaron
      titulo={unica ? `${unica.cantidad ?? 1} ${unica.texto}` : `${bloque.titulo} · ${total} ${total === 1 ? "aviso" : "avisos"}`}
      subtitulo={unica ? `Requiere tu atención · ${bloque.titulo}` : "Lo que requiere tu atención en esta área"}
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
        <section key={f.id} ref={(el) => { refs.current[f.id] = el }} aria-label={`${f.cantidad ?? 1} ${f.texto}`} className={"border-b border-slate-100 px-5 pb-2 pt-4 last:border-b-0 " + (f.id === filaId && !soloFila ? "bg-slate-50/70" : "")}>
          <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {!unica && <h3 className="text-sm font-bold" style={{ color: INK }}>{f.cantidad ?? 1} {f.texto}</h3>}
            {f.enlace && (
              <button type="button" onClick={() => { onCerrar(); f.enlace.onClick() }} className="ml-auto flex items-center gap-1 text-sm font-bold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">
                {f.enlace.texto} <ArrowRight size={14} aria-hidden="true" />
              </button>
            )}
          </div>
          <ul>
            {f.casos.map((c) => (
              <li key={c.id} className="flex items-center gap-3 border-t border-slate-100 py-2.5">
                {c.icono
                  ? <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600" aria-hidden="true"><c.icono size={17} /></span>
                  : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blue-50 text-xs font-bold text-blue-600" aria-hidden="true">{iniciales(c.nombre)}</span>}
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
        <button type="button" onClick={() => setAbierto(true)} aria-label={`Requieren atención: ${total}`} className="flex items-center gap-2 rounded-xl border border-amber-200/70 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 transition-colors hover:bg-amber-100 cursor-pointer">
          <AlertCircle size={16} aria-hidden="true" /> Requieren atención
          <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-amber-700">{total}</span>
        </button>
      ) : (
        <span className="flex items-center gap-2 rounded-xl border border-emerald-200/70 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700"><CheckCircle2 size={16} aria-hidden="true" /> Todo en orden</span>
      )}
      {abierto && <VentanaAvisos bloque={bloque} filaId={null} onCerrar={() => setAbierto(false)} />}
    </>
  )
}

// columnas: 1, 2 (el Inicio de la óptica) o 3 (el Inicio del superadmin, que solo muestra las áreas con avisos). compacto: menos aire, para que
// todo quepa en una pantalla. lateral: lo que va a la derecha del título (por ejemplo, «Sistema y Soporte: todo en orden»).
const COLUMNAS = { 1: "grid-cols-1", 2: "grid-cols-1 md:grid-cols-2 md:auto-rows-fr", 3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3 md:auto-rows-fr" }
export default function RequiereAtencionPorArea({ bloques, columnas = 2, compacto = false, lateral = null }) {
  const [abierto, setAbierto] = useState(null) // { bloqueId, filaId, soloFila }
  if (bloques.length === 0) return null
  const bloqueAbierto = abierto ? bloques.find((b) => b.id === abierto.bloqueId) : null
  return (
    <section id="requiere-atencion" aria-label="Requiere tu atención" className="scroll-mt-4 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Requiere tu atención</h2>
        {lateral}
      </div>
      <div className={"grid " + (compacto ? "gap-3 " : "gap-4 ") + (COLUMNAS[columnas] || COLUMNAS[2])}>
        {bloques.map((b) => {
          const Icono = b.icono
          const visibles = b.filas.slice(0, AVISOS_POR_TARJETA)
          const total = b.filas.reduce((n, f) => n + (f.cantidad ?? 1), 0)
          const mas = b.filas.length - visibles.length
          // «Ver todo» lleva al módulo; si el área tiene un solo tipo de aviso con su filtro, lleva a esa lista filtrada.
          const verTodo = b.filas.length === 1 && b.filas[0].enlace ? b.filas[0].enlace.onClick : b.onVerTodo
          return (
            <section key={b.id} aria-label={`Requiere tu atención: ${b.titulo}`} className="flex flex-col rounded-2xl border border-slate-200/60 bg-white shadow-sm">
              <div className={"flex items-center gap-3 border-b border-slate-100 px-4 " + (compacto ? "py-2" : "py-3")}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"><Icono size={18} aria-hidden="true" /></span>
                <span className="text-base font-bold" style={{ color: INK }}>{b.titulo}</span>
                {total > 0
                  ? <span className="ml-auto rounded-full bg-amber-50 px-2.5 py-0.5 text-sm font-bold text-amber-700">{total}</span>
                  : <span className="ml-auto rounded-full bg-emerald-50 px-2.5 py-0.5 text-sm font-bold text-emerald-700">Todo en orden</span>}
              </div>
              {visibles.length > 0 ? (
                <ul className={"grid flex-1 gap-2.5 p-3 " + (visibles.length === 1 ? "grid-cols-1" : visibles.length === 2 ? "grid-cols-2" : "grid-cols-3")}>
                  {visibles.map((f) => {
                    const urgente = f.tono === "urgente"
                    return (
                      <li key={f.id} className="min-w-0">
                        <button
                          type="button"
                          onClick={() => setAbierto({ bloqueId: b.id, filaId: f.id, soloFila: true })}
                          aria-label={`${f.cantidad ?? 1} ${f.texto}`}
                          className={"flex h-full w-full flex-col justify-between rounded-xl border px-3 py-2.5 text-left transition-colors cursor-pointer " + (urgente ? "border-red-200/70 bg-red-50/60 hover:bg-red-50" : "border-slate-200/70 bg-slate-50/60 hover:border-slate-300 hover:bg-slate-50")}
                        >
                          <span className={"font-serif text-3xl font-semibold leading-none " + (urgente ? "text-red-700" : "")} style={urgente ? undefined : { color: INK }}>{f.cantidad ?? 1}</span>
                          <span className="mt-1.5 block text-sm leading-tight text-slate-600">{f.corto || f.texto}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="flex flex-1 items-center gap-2 px-4 py-4 text-sm font-medium text-slate-600"><CheckCircle2 size={16} className="shrink-0 text-emerald-600" aria-hidden="true" /> Todo en orden</p>
              )}
              <footer className={"flex items-center border-t border-slate-100 px-4 text-sm " + (compacto ? "py-1.5" : "py-2.5")}>
                {mas > 0 && (
                  <button type="button" onClick={() => setAbierto({ bloqueId: b.id, filaId: null, soloFila: false })} aria-label={`Ver los ${mas} avisos más de ${b.titulo}`} className="font-semibold text-slate-500 transition-colors hover:text-slate-700 cursor-pointer">
                    {mas === 1 ? "1 aviso más" : `${mas} avisos más`}
                  </button>
                )}
                <button type="button" onClick={verTodo} aria-label={`Ver todo en ${b.titulo}`} className="ml-auto flex items-center gap-1 font-bold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">
                  Ver todo <ArrowRight size={14} aria-hidden="true" />
                </button>
              </footer>
            </section>
          )
        })}
      </div>
      {bloqueAbierto && <VentanaAvisos bloque={bloqueAbierto} filaId={abierto.filaId} soloFila={abierto.soloFila} onCerrar={() => setAbierto(null)} />}
    </section>
  )
}
