"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCircle2, ArrowRight, AlertCircle } from "lucide-react"
import { INK } from "@/lib/tema"
import { Cascaron } from "./AtencionPaciente"
import MotivoDeCancelacion from "./MotivoDeCancelacion"

// «Requiere tu atención» del Inicio (reunión del 20 oct., ATN-1): una tarjeta por área (Citas, Pacientes, Ventas, Inventario), nunca todo en una sola lista (I4), y dentro de
// cada área, como máximo TRES tarjetitas: cada una con el número grande y debajo una leyenda corta («por contactar», «con stock bajo»), sin nombres de pacientes
// (nadie lee tanto texto). Pulsar una tarjetita abre SU lista en la ventana estándar del sistema (regla 43), con cada caso, su detalle y su acción, y el enlace
// «Abrir en …» que dice adónde lleva y con qué número (regla 42). «Ver todo» lleva al módulo (con el filtro del aviso cuando el área tiene un solo tipo de aviso).
// Si hay más de tres tipos, «N más» abre la ventana con todas las del área. Al resolver un caso la lista y los números se actualizan: la ventana lee siempre los
// avisos actuales. Un área sin avisos dice «Todo en orden» en una línea.
//
// bloques: [{ id, titulo, modulo, icono, filas, onVerTodo }]; onVerTodo lleva al módulo.
// filas: [{ id, cantidad, texto, corto?, tono?: "urgente", enlace?: { texto, onClick }, casos: [{ id, nombre, detalle?, icono?, insignia?: { texto, tono }, accion?: { etiqueta, onClick, navega? }, acciones?: [...] }],
//   descartable?: { motivos: [texto], onDescartar(caso, motivo, detalle) → { error? } }, descartados?: [{ id, nombre, motivo, por, onRestaurar() }] }]
// Una fila descartable lleva «Descartar» en cada caso: pide el motivo (lista fija + detalle) y lo saca de la lista; lo descartado queda abajo, «Volver a mostrar» lo trae de vuelta.
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
  const [descartando, setDescartando] = useState(null) // { filaId, casoId }
  const [motivoDescarte, setMotivoDescarte] = useState("")
  const [detalleDescarte, setDetalleDescarte] = useState("")
  const [guardandoDescarte, setGuardandoDescarte] = useState(false)
  const [errorDescarte, setErrorDescarte] = useState("")
  const abrirDescarte = (filaId, casoId) => { setDescartando({ filaId, casoId }); setMotivoDescarte(""); setDetalleDescarte(""); setErrorDescarte("") }
  const confirmarDescarte = async (fila, caso) => {
    if (!motivoDescarte) { setErrorDescarte("Elige el motivo."); return }
    setGuardandoDescarte(true)
    setErrorDescarte("")
    const r = await fila.descartable.onDescartar(caso, motivoDescarte, detalleDescarte)
    setGuardandoDescarte(false)
    if (r?.error) { setErrorDescarte(r.error); return }
    setDescartando(null)
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
            {f.casos.map((c) => {
              const acciones = c.acciones || (c.accion ? [c.accion] : [])
              const abierto = descartando?.filaId === f.id && descartando?.casoId === c.id
              return (
                <li key={c.id} className="border-t border-slate-100 py-2.5">
                  <div className="flex items-center gap-3">
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
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                      {acciones.map((a) => (
                        <button key={a.etiqueta} type="button" onClick={() => ejecutar(a)} className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer">
                          {a.etiqueta}
                        </button>
                      ))}
                      {f.descartable && !abierto && (
                        <button type="button" onClick={() => abrirDescarte(f.id, c.id)} aria-label={`Descartar el aviso de ${c.nombre}`} className="rounded-lg px-2.5 py-1 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer">Descartar</button>
                      )}
                    </div>
                  </div>
                  {abierto && (
                    <div role="group" aria-label={`Descartar el aviso de ${c.nombre}`} className="mt-3 space-y-3 rounded-xl border border-slate-200/70 bg-slate-50/60 p-3.5">
                      <p className="text-sm font-semibold text-slate-700">¿Por qué se descarta? Queda registrado y se puede volver a mostrar.</p>
                      <MotivoDeCancelacion etiqueta="Motivo del descarte" motivos={f.descartable.motivos.map((t) => ({ id: t, texto: t }))} motivo={motivoDescarte} detalle={detalleDescarte} onMotivo={setMotivoDescarte} onDetalle={setDetalleDescarte} deshabilitado={guardandoDescarte} />
                      {errorDescarte && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{errorDescarte}</p>}
                      <div className="flex items-center justify-end gap-2">
                        <button type="button" disabled={guardandoDescarte} onClick={() => setDescartando(null)} className="rounded-lg border border-slate-200/60 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer disabled:opacity-60">Volver</button>
                        <button type="button" disabled={guardandoDescarte || !motivoDescarte} onClick={() => confirmarDescarte(f, c)} className="rounded-lg bg-slate-800 px-3.5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-slate-900 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50">Descartar el aviso</button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          {f.descartados?.length > 0 && (
            <details className="mt-2 rounded-xl border border-slate-200/60 bg-slate-50/50 px-3.5 py-2.5">
              <summary className="cursor-pointer text-sm font-semibold text-slate-600">Descartados ({f.descartados.length})</summary>
              <ul className="mt-2 divide-y divide-slate-100">
                {f.descartados.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold" style={{ color: INK }}>{d.nombre}</p>
                      <p className="text-sm text-slate-500">{d.motivo}{d.por ? ` · ${d.por}` : ""}</p>
                    </div>
                    <button type="button" onClick={d.onRestaurar} aria-label={`Volver a mostrar el aviso de ${d.nombre}`} className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer">Volver a mostrar</button>
                  </li>
                ))}
              </ul>
            </details>
          )}
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

// Un solo panel blanco con una columna por área (Citas, Pacientes, Ventas, Inventario), separadas por una línea fina. Cada columna: su título, sus avisos en filas pequeñas
// (punto de color, número y leyenda corta en una línea; toda la fila se pulsa y abre su lista en la ventana estándar) y, abajo, «Ver en [módulo]». Una columna sin avisos dice «Todo en orden».
// El color solo informa: el punto dice qué tan urgente es (rojo urgente, ámbar pendiente, azul informativo) y el número va en rojo solo si es urgente.
// lateral: lo que va a la derecha del título (por ejemplo, «Sistema y Soporte: todo en orden»). compacto: menos aire (Inicio del superadmin).
export const TONOS = {
  urgente: { punto: "#DC2626", numero: "#B91C1C", nombre: "Urgente" },
  pendiente: { punto: "#B7791F", numero: INK, nombre: "Pendiente" },
  info: { punto: "#2563EB", numero: INK, nombre: "Informativo" },
}
const COLUMNAS = { 1: "lg:grid-cols-1", 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4" }
export default function RequiereAtencionPorArea({ bloques, compacto = false, lateral = null }) {
  const [abierto, setAbierto] = useState(null) // { bloqueId, filaId, soloFila }
  if (bloques.length === 0) return null
  const bloqueAbierto = abierto ? bloques.find((b) => b.id === abierto.bloqueId) : null
  return (
    <section id="requiere-atencion" aria-label="Requiere tu atención" className="scroll-mt-4 space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 className="text-[13px] font-bold uppercase tracking-[0.14em] text-slate-500">Requiere tu atención</h2>
        {lateral}
      </div>
      <div className={"grid grid-cols-1 sm:grid-cols-2 rounded-2xl border border-slate-200/70 bg-white shadow-sm " + (COLUMNAS[Math.min(bloques.length, 4)] || COLUMNAS[4])}>
        {bloques.map((b, n) => {
          const Icono = b.icono
          const visibles = b.filas.slice(0, AVISOS_POR_TARJETA)
          const mas = b.filas.length - visibles.length
          // «Ver en [módulo]» lleva al módulo; si el área tiene un solo tipo de aviso con su filtro, lleva a esa lista filtrada.
          const verTodo = b.filas.length === 1 && b.filas[0].enlace ? b.filas[0].enlace.onClick : b.onVerTodo
          return (
            <section key={b.id} aria-label={`Requiere tu atención: ${b.titulo}`} className={"flex min-w-0 flex-col px-4 " + (compacto ? "py-3 " : "py-4 ") + (n > 0 ? "border-t border-slate-100 sm:border-t-0 sm:border-l sm:max-lg:odd:border-l-0 lg:border-l " : "")}>
              <h3 className="mb-1.5 flex items-center gap-2 text-[15px] font-bold" style={{ color: INK }}>
                <Icono size={16} aria-hidden="true" className="shrink-0 text-slate-500" /> {b.titulo}
              </h3>
              {visibles.length > 0 ? (
                <ul className="flex-1">
                  {visibles.map((f) => {
                    const tono = TONOS[f.tono] || TONOS.pendiente
                    return (
                      <li key={f.id}>
                        <button
                          type="button"
                          onClick={() => setAbierto({ bloqueId: b.id, filaId: f.id, soloFila: true })}
                          aria-label={`${f.cantidad ?? 1} ${f.texto}`}
                          title={`${tono.nombre}: ${f.texto}`}
                          className="grid w-full grid-cols-[0.4rem_1.75rem_minmax(0,1fr)] items-center gap-x-2 rounded-lg py-2 text-left transition-colors hover:bg-slate-50 cursor-pointer"
                        >
                          <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: tono.punto }} />
                          <span className="text-right font-serif text-[20px] font-bold leading-none" style={{ color: tono.numero }}>{f.cantidad ?? 1}</span>
                          <span className="truncate text-[13px] text-slate-700">{f.corto || f.texto}</span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="flex flex-1 items-start gap-2 py-1.5 text-[13px] text-slate-600"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" /> Todo en orden</p>
              )}
              <div className="mt-3 flex items-center gap-3 text-sm">
                <button type="button" onClick={verTodo} aria-label={`Ver todo en ${b.titulo}`} className="flex items-center gap-1 font-semibold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">
                  Ver en {b.modulo || b.titulo} <ArrowRight size={14} aria-hidden="true" />
                </button>
                {mas > 0 && (
                  <button type="button" onClick={() => setAbierto({ bloqueId: b.id, filaId: null, soloFila: false })} aria-label={`Ver los ${mas} avisos más de ${b.titulo}`} className="ml-auto text-slate-500 transition-colors hover:text-slate-700 cursor-pointer">
                    {mas === 1 ? "+1 más" : `+${mas} más`}
                  </button>
                )}
              </div>
            </section>
          )
        })}
      </div>
      {bloqueAbierto && <VentanaAvisos bloque={bloqueAbierto} filaId={abierto.filaId} soloFila={abierto.soloFila} onCerrar={() => setAbierto(null)} />}
    </section>
  )
}
