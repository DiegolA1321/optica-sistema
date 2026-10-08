import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Plus, CalendarClock, CalendarDays, X } from "lucide-react"
import { fechaAISO, isoAFechaLocal, hoyISO, minutosDesdeMedianoche, horaA12 } from "../utilidades/disponibilidad"
import { minutosAHHMM } from "../utilidades/calendarioSemana"
import { INK } from "@/lib/tema"
import { colorDe, useAlturaDisponible } from "./calendarioComun"
import { LeyendaEstados } from "./CalendarioSemanal"
import { nivelCarga, citasQueCuentan } from "../utilidades/cargaCitas"

// Calendario mensual (vista Mes de Citas). Presentacional, como la vista
// Semana: cada día muestra sus citas como etiquetas con la hora y el paciente,
// del color de su estado, y "+N más" cuando no caben. Un clic en el día lleva a
// esa semana; un clic en una etiqueta abre la misma tarjeta con acciones.

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
const ALTO_TITULO = 40
const ALTO_DIAS = 26
// Cada día muestra al menos 3 etiquetas: relleno (6) + cabecera con el número y "+N más" (22) + 3 etiquetas de 16 con 2 de separación (52).
const ALTO_ETIQUETA = 16
const SEPARACION = 2
const MIN_ETIQUETAS = 3
const ALTO_CABECERA = 22
const RELLENO_VERTICAL = 6
const ALTO_FILA_MIN = RELLENO_VERTICAL + ALTO_CABECERA + MIN_ETIQUETAS * ALTO_ETIQUETA + (MIN_ETIQUETAS - 1) * SEPARACION

const ANCHO_LISTA = 288
const CLAVE_MODO = "citas_mes_modo"

// Fondo de cada nivel de carga: el mismo tono de la marca, de más claro a más
// oscuro. El color queda para los estados; aquí solo cuenta la intensidad.
const FONDO_CARGA = ["transparent", "rgba(14,43,51,0.07)", "rgba(14,43,51,0.16)", "rgba(14,43,51,0.30)", "rgba(14,43,51,0.62)"]
const leerModo = () => { try { return localStorage.getItem(CLAVE_MODO) === "carga" ? "carga" : "citas" } catch { return "citas" } }

// "+N más": en vez de saltar a otra vista, se abre aquí mismo la lista completa
// del día, con cada cita a un clic. Se cierra con Escape, clic fuera o scroll.
function ListaDelDia({ iso, citas, ancla, onCerrar, onElegir, onVerSemana }) {
  const ref = useRef(null)
  useEffect(() => {
    const fuera = (e) => { if (ref.current && !ref.current.contains(e.target)) onCerrar() }
    const tecla = (e) => { if (e.key === "Escape") onCerrar() }
    document.addEventListener("mousedown", fuera)
    document.addEventListener("keydown", tecla)
    window.addEventListener("scroll", onCerrar, true)
    window.addEventListener("resize", onCerrar)
    return () => {
      document.removeEventListener("mousedown", fuera)
      document.removeEventListener("keydown", tecla)
      window.removeEventListener("scroll", onCerrar, true)
      window.removeEventListener("resize", onCerrar)
    }
  }, [onCerrar])
  const cabeDerecha = ancla.right + 6 + ANCHO_LISTA <= window.innerWidth - 8
  const left = cabeDerecha ? ancla.left : Math.max(8, ancla.right - ANCHO_LISTA)
  const top = Math.max(8, Math.min(ancla.top, window.innerHeight - 380))
  const fecha = isoAFechaLocal(iso)
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={`Citas del ${fecha.getDate()} de ${MESES[fecha.getMonth()]}`}
      className="fixed z-50 flex max-h-[360px] flex-col overflow-hidden rounded-xl border border-slate-200/60 bg-white shadow-xl"
      style={{ top, left, width: ANCHO_LISTA, animation: "menu-in 160ms ease-out" }}
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-3.5 py-2.5">
        <div>
          <p className="text-sm font-bold" style={{ color: INK }}>{fecha.getDate()} de {MESES[fecha.getMonth()]}</p>
          <p className="text-[11px] text-slate-500">{citas.length} {citas.length === 1 ? "cita" : "citas"}</p>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 cursor-pointer"><X size={14} /></button>
      </div>
      <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {citas.map((c) => {
          const color = colorDe(c.estado)
          return (
            <li key={c.id}>
              <button
                type="button"
                onClick={(e) => onElegir(c, e.currentTarget.getBoundingClientRect())}
                className="flex w-full items-center gap-2 rounded-lg border-l-4 px-2.5 py-1.5 text-left transition-shadow hover:shadow-md cursor-pointer"
                style={{ backgroundColor: color.fondo, borderLeftColor: color.linea, color: color.texto }}
              >
                <span className="shrink-0 text-xs font-bold tabular-nums">{horaA12(minutosAHHMM(minutosDesdeMedianoche(c.hora)))}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-bold">{c.paciente}</span>
                  <span className="block truncate text-[11px] opacity-80">{[color.etiqueta, c.motivo].filter(Boolean).join(" · ")}</span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      <button type="button" onClick={onVerSemana} className="flex items-center justify-center gap-1.5 border-t border-slate-100 px-3 py-2 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50 cursor-pointer">
        <CalendarDays size={13} aria-hidden="true" /> Ver esa semana
      </button>
    </div>,
    document.body,
  )
}

export default function CalendarioMes({ mes, citasPorFecha, coincide, onDiaClick, onAbrirDetalle, onAgendar }) {
  const refSeccion = useRef(null)
  const altoSeccion = useAlturaDisponible(refSeccion)
  const [lista, setLista] = useState(null) // { iso, ancla } | null
  const hoy = hoyISO()
  // "citas": cada cita como etiqueta de su estado. "carga": cada día sombreado
  // según cuántas citas tiene, para ver de un vistazo qué días hay más o menos
  // atención y planificar los siguientes.
  const [modo, setModoEstado] = useState(leerModo)
  const setModo = (m) => { setModoEstado(m); try { localStorage.setItem(CLAVE_MODO, m) } catch { /* sin almacenamiento: no se recuerda */ } }

  // Semanas completas (lunes a domingo) que cubren el mes; los días de los
  // meses vecinos se muestran atenuados.
  const semanas = useMemo(() => {
    const primero = new Date(mes.getFullYear(), mes.getMonth(), 1)
    const desfase = (primero.getDay() + 6) % 7
    const inicio = new Date(mes.getFullYear(), mes.getMonth(), 1 - desfase)
    const total = Math.ceil((desfase + new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate()) / 7)
    return Array.from({ length: total }, (_, s) =>
      Array.from({ length: 7 }, (_, d) => {
        const f = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + s * 7 + d)
        return { iso: fechaAISO(f), numero: f.getDate(), delMes: f.getMonth() === mes.getMonth() }
      }),
    )
  }, [mes])

  const cargaMaxima = Math.max(0, ...semanas.flat().filter((d) => d.delMes).map((d) => citasQueCuentan(citasPorFecha.get(d.iso)).length))
  const citasDelMes = semanas.flat().reduce((n, d) => n + (d.delMes ? (citasPorFecha.get(d.iso)?.length || 0) : 0), 0)
  const altoFila = Math.max(ALTO_FILA_MIN, Math.floor((altoSeccion - ALTO_TITULO - ALTO_DIAS) / semanas.length))
  const maxEtiquetas = Math.max(MIN_ETIQUETAS, Math.floor((altoFila - RELLENO_VERTICAL - ALTO_CABECERA + SEPARACION) / (ALTO_ETIQUETA + SEPARACION)))

  return (
    <section ref={refSeccion} aria-label="Calendario mensual" className="relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm" style={{ height: altoSeccion }}>
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5" style={{ height: ALTO_TITULO }}>
        <div className="flex items-center gap-4"><h2 className="sr-only">{MESES[mes.getMonth()].replace(/^./, (l) => l.toUpperCase())} de {mes.getFullYear()}</h2>{modo === "citas" ? <LeyendaEstados /> : (
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500" aria-label="Escala de carga">
            <span>Menos</span>
            {[1, 2, 3, 4].map((n) => <span key={n} className="h-3 w-5 rounded-sm border border-slate-200/60" style={{ backgroundColor: FONDO_CARGA[n] }} aria-hidden="true" />)}
            <span>Más{cargaMaxima > 0 ? ` (hasta ${cargaMaxima} al día)` : ""}</span>
          </div>
        )}</div>
        <div className="flex items-center gap-3">
          <div role="group" aria-label="Qué mostrar en el calendario" className="flex items-center gap-0.5 rounded-lg border border-slate-200/60 bg-white p-0.5">
            {[["citas", "Citas"], ["carga", "Carga"]].map(([id, etiqueta]) => (
              <button
                key={id}
                type="button"
                onClick={() => setModo(id)}
                aria-pressed={modo === id}
                className={"rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer " + (modo === id ? "text-white" : "text-slate-500 hover:bg-slate-100")}
                style={modo === id ? { backgroundColor: INK } : undefined}
              >
                {etiqueta}
              </button>
            ))}
          </div>
        <span className="text-xs text-slate-500">{citasDelMes === 0 ? "Sin citas este mes" : `${citasDelMes} ${citasDelMes === 1 ? "cita" : "citas"}`}</span>
        </div>
      </div>

      <div className="grid shrink-0 grid-cols-7 border-b border-slate-200/70 bg-white" style={{ height: ALTO_DIAS }}>
        {DIAS.map((d) => (
          <span key={d} className="flex items-center justify-center border-l border-slate-100 text-xs font-semibold uppercase tracking-wide text-slate-500 first:border-l-0">{d}</span>
        ))}
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto">
        {semanas.map((semana, s) => (
          <div key={s} className="grid grid-cols-7 border-b border-slate-100 last:border-b-0" style={{ height: altoFila }}>
            {semana.map(({ iso, numero, delMes }) => {
              const citas = citasPorFecha.get(iso) || []
              const ordenadas = [...citas].sort((a, b) => minutosDesdeMedianoche(a.hora) - minutosDesdeMedianoche(b.hora))
              const caben = Math.min(ordenadas.length, maxEtiquetas)
              const resto = ordenadas.length - caben
              const esHoy = iso === hoy
              const cuentan = citasQueCuentan(citas).length
              const nivel = nivelCarga(cuentan, cargaMaxima)
              return (
                <div
                  key={iso}
                  onClick={() => onDiaClick?.(iso)}
                  className={"min-w-0 overflow-hidden border-l border-slate-100 px-1 py-[3px] transition-colors first:border-l-0 cursor-pointer hover:bg-slate-50/80 " + (modo === "carga" ? "" : esHoy ? "bg-blue-50/40" : !delMes ? "bg-slate-50/60" : "")}
                  style={modo === "carga" ? { backgroundColor: delMes ? FONDO_CARGA[nivel] : undefined, boxShadow: esHoy ? "inset 0 0 0 2px #2563EB" : undefined } : undefined}
                  title={modo === "carga" ? `${cuentan} ${cuentan === 1 ? "cita" : "citas"}` : undefined}
                >
                  <div className="mb-0.5 flex h-5 items-center justify-between gap-1">
                    <span
                      className={"grid h-5 min-w-5 place-items-center rounded-full px-1 text-xs font-bold " + (esHoy ? "text-white" : delMes ? (modo === "carga" && nivel >= 4 ? "text-white" : "text-slate-700") : "text-slate-400")}
                      style={esHoy ? { background: "linear-gradient(135deg,#22D3EE,#2563EB)" } : undefined}
                    >
                      {numero}
                    </span>
                    {modo === "citas" && resto > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          const r = e.currentTarget.getBoundingClientRect()
                          setLista({ iso, ancla: { top: r.top, left: r.left, right: r.right } })
                        }}
                        title="Ver todas las citas del día"
                        className="rounded px-1 text-[11px] font-bold leading-4 text-blue-700 transition-colors hover:bg-blue-100 cursor-pointer"
                      >
                        +{resto} más
                      </button>
                    )}
                  </div>
                  {modo === "carga" && (
                    <p className={"mt-1 text-center font-serif text-2xl font-semibold leading-none " + (!delMes ? "text-slate-300" : nivel >= 4 ? "text-white" : "text-slate-700")}>
                      {cuentan > 0 ? cuentan : ""}
                      {cuentan > 0 && <span className={"mt-0.5 block text-[10px] font-sans font-semibold " + (nivel >= 4 ? "text-white/80" : "text-slate-500")}>{cuentan === 1 ? "cita" : "citas"}</span>}
                    </p>
                  )}
                  <div className="space-y-0.5">
                    {modo === "citas" && ordenadas.slice(0, caben).map((c) => {
                      const color = colorDe(c.estado)
                      const esCoincidencia = !!coincide && coincide(c)
                      return (
                        <button
                          type="button"
                          key={c.id}
                          onClick={(e) => {
                            // Mismo detalle de la cita que en la lista (todas las acciones viven ahí).
                            e.stopPropagation()
                            onAbrirDetalle?.(c)
                          }}
                          title={`${c.paciente} · ${c.hora}${c.estado ? ` · ${c.estado}` : ""}`}
                          className={"flex w-full min-w-0 items-center gap-1 rounded border-l-[3px] px-1.5 text-left text-[10.5px] leading-4 transition-shadow hover:shadow-md hover:brightness-[0.97] cursor-pointer " + (esCoincidencia ? "ring-2 ring-blue-500 " : "") + (c.estado === "Cancelada" ? "opacity-50" : "")}
                          style={{ height: ALTO_ETIQUETA, backgroundColor: color.fondo, borderLeftColor: color.linea, color: color.texto, opacity: coincide && !esCoincidencia ? 0.3 : undefined }}
                        >
                          <span className="shrink-0 font-bold tabular-nums">{horaA12(minutosAHHMM(minutosDesdeMedianoche(c.hora)))}</span>
                          <span className="min-w-0 flex-1 truncate font-semibold">{c.paciente}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {citasDelMes === 0 && onAgendar && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-center justify-center" style={{ top: ALTO_TITULO + ALTO_DIAS }}>
          <div role="status" className="pointer-events-auto flex flex-col items-center gap-3 rounded-2xl border border-slate-200/60 bg-white/95 px-8 py-6 text-center shadow-lg">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-slate-50 text-slate-400"><CalendarClock size={22} aria-hidden="true" /></span>
            <p className="text-sm font-bold" style={{ color: INK }}>No hay citas este mes</p>
            <button type="button" onClick={() => onAgendar()} className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-white transition-transform hover:-translate-y-0.5 cursor-pointer" style={{ background: "linear-gradient(135deg,#22D3EE,#2563EB)" }}>
              <Plus size={14} aria-hidden="true" /> Agendar cita
            </button>
          </div>
        </div>
      )}

      {lista && (
        <ListaDelDia
          iso={lista.iso}
          citas={[...(citasPorFecha.get(lista.iso) || [])].sort((a, b) => minutosDesdeMedianoche(a.hora) - minutosDesdeMedianoche(b.hora))}
          ancla={lista.ancla}
          onCerrar={() => setLista(null)}
          onElegir={(c) => { setLista(null); onAbrirDetalle?.(c) }}
          onVerSemana={() => { const iso = lista.iso; setLista(null); onDiaClick?.(iso) }}
        />
      )}

    </section>
  )
}
