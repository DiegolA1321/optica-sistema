import { useEffect, useMemo, useRef, useState } from "react"
import { Receipt, CalendarClock, Plus } from "lucide-react"
import { isoAFechaLocal, hoyISO, horaA12 } from "../utilidades/disponibilidad"
import { rangoLargo, diaSemanaCorto } from "../utilidades/formatoFecha"
import { diasDeSemana, rangoHoras, franjasSombreadas, bloquesDelDia, minutosAHHMM, celdaLibre, validarMovimiento, PASO_MINUTOS } from "../utilidades/calendarioSemana"
import { INK } from "@/lib/tema"
import { colorDe, useAlturaDisponible, LEYENDA_ESTADOS } from "./calendarioComun"

// Calendario semanal por horas (vista Semana de Citas). Presentacional: recibe
// las citas y la disponibilidad ya cargadas y avisa por callbacks; no consulta
// ni escribe datos. Cada día es una columna; el eje vertical son las horas del
// horario de la óptica, en filas de 30 minutos.

const PX_POR_MIN = 88 / 60 // 88 px por hora: las citas de 40 min caben con sus dos líneas y las horas no se pegan
const ANCHO_HORAS = 84
const ALTO_ENCABEZADO = 52

const ESTILO_FRANJA = {
  cerrado: { backgroundColor: "rgba(241,245,249,0.85)" },
  almuerzo: { backgroundImage: "repeating-linear-gradient(135deg, rgba(148,163,184,0.16) 0 6px, transparent 6px 12px)", backgroundColor: "rgba(248,250,252,0.9)" },
  ausencia: { backgroundImage: "repeating-linear-gradient(135deg, rgba(148,163,184,0.28) 0 4px, transparent 4px 9px)", backgroundColor: "rgba(241,245,249,0.9)" },
}
const ETIQUETA_FRANJA = { cerrado: "Cerrado", almuerzo: "Almuerzo", ausencia: "Ausencia" }
const TITULO_FRANJA = { cerrado: "Fuera del horario de atención", almuerzo: "Almuerzo / pausa", ausencia: "Ausencia" }

export function LeyendaEstados() {
  return (
    <ul className="hidden items-center gap-3 text-[11px] font-medium text-slate-500 xl:flex" aria-label="Leyenda de estados">
      {LEYENDA_ESTADOS.map((e) => (
        <li key={e.etiqueta} className="flex items-center gap-1.5">
          <span className="h-3 w-3.5 rounded-[3px] border-l-[3px]" style={{ backgroundColor: e.fondo, borderLeftColor: e.linea }} aria-hidden="true" />
          {e.etiqueta}
        </li>
      ))}
    </ul>
  )
}

export default function CalendarioSemanal({ lunes, citas, disponibilidad, cobroPendienteIds, citasVisibles, coincide, aviso, onDiaClick, onAbrirDetalle, onHuecoLibre, onMover, onAgendar }) {
  // Celda libre bajo el puntero: { iso, min } | null (fantasma "+ agendar").
  const [hover, setHover] = useState(null)
  // Arrastrar y soltar (solo citas pendientes): la cita que se lleva, dónde la
  // tomó la mano y el destino bajo el puntero ya validado.
  const [arrastre, setArrastre] = useState(null) // { id, offsetMin, dur }
  const [destino, setDestino] = useState(null) // { iso, min, ok, motivo }
  const terminarArrastre = () => { setArrastre(null); setDestino(null) }

  const refSeccion = useRef(null)
  const altoSeccion = useAlturaDisponible(refSeccion)
  const dias = useMemo(() => diasDeSemana(lunes, disponibilidad, citas), [lunes, disponibilidad, citas])
  const rango = useMemo(() => rangoHoras(dias, disponibilidad, citas), [dias, disponibilidad, citas])
  const duracionDefault = disponibilidad?.duracionCita || 40
  const alto = (rango.fin - rango.inicio) * PX_POR_MIN
  const hoy = hoyISO()

  // Reloj para la línea de la hora actual (se refresca cada minuto).
  const [ahora, setAhora] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setAhora(new Date()), 60000)
    return () => clearInterval(id)
  }, [])
  const minutosAhora = ahora.getHours() * 60 + ahora.getMinutes()

  // La vista se abre desplazada en la hora actual (si la semana es la de hoy
  // y la hora cae en el rango); en otra semana, desde el inicio.
  const refScroll = useRef(null)
  const sinCitas = !dias.some((iso) => (citasVisibles || citas).some((c) => c.fecha === iso))
  useEffect(() => {
    const el = refScroll.current
    if (!el) return
    const esSemanaActual = dias.includes(hoy)
    const m = new Date().getHours() * 60 + new Date().getMinutes()
    if (esSemanaActual && m >= rango.inicio && m <= rango.fin) {
      el.scrollTop = Math.max(0, (m - rango.inicio) * PX_POR_MIN - el.clientHeight / 3)
    } else {
      el.scrollTop = 0
    }
    // Al abrir, al cambiar de semana y cuando llega el horario o cambia el alto
    // disponible; no en cada minuto del reloj.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lunes, rango.inicio, rango.fin, altoSeccion])

  const filasHora = []
  for (let t = rango.inicio; t < rango.fin; t += PASO_MINUTOS) filasHora.push(t)

  const columnas = `${ANCHO_HORAS}px repeat(${dias.length}, minmax(0, 1fr))`
  const fondoLineas = {
    backgroundImage: "linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)",
    backgroundSize: `100% ${PASO_MINUTOS * PX_POR_MIN}px`,
  }

  return (
    <section ref={refSeccion} aria-label="Calendario semanal" className="relative flex flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm" style={{ height: altoSeccion }}>
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-3">
        <div className="flex min-w-0 items-center gap-4">
          <h2 className="sr-only">{rangoLargo(dias[0], dias[dias.length - 1])}</h2>
          <LeyendaEstados />
        </div>
        {aviso && (
          <p role="status" className="flex min-w-0 items-center gap-2 text-xs text-slate-600">
            <span className="truncate">{aviso.texto}</span>
            {aviso.irA && (
              <button type="button" onClick={aviso.irA} className="shrink-0 rounded-lg border border-blue-200/60 bg-blue-50 px-2.5 py-1 font-semibold text-blue-700 transition-colors hover:bg-blue-100 cursor-pointer">
                Ir a esa semana
              </button>
            )}
          </p>
        )}
      </div>

      <div ref={refScroll} className="relative min-h-0 flex-1 overflow-y-auto">
        {/* Encabezado de días (queda fijo al desplazar las horas) */}
        <div className="sticky top-0 z-20 grid border-b border-slate-200/70 bg-white" style={{ gridTemplateColumns: columnas, height: ALTO_ENCABEZADO }}>
          <div />
          {dias.map((iso) => {
            const f = isoAFechaLocal(iso)
            const esHoyCol = iso === hoy
            return (
              <button
                type="button"
                key={iso}
                onClick={() => onDiaClick?.(iso)}
                title="Ver este día en la lista"
                className={"flex flex-col items-center justify-center border-l border-slate-100 text-xs font-semibold transition-colors cursor-pointer " + (esHoyCol ? "bg-blue-50 text-blue-700 hover:bg-blue-100" : "text-slate-600 hover:bg-slate-50")}
              >
                <span className="uppercase tracking-wide">{diaSemanaCorto(f.getDay())}</span>
                <span className={"text-base font-bold " + (esHoyCol ? "text-blue-700" : "")} style={esHoyCol ? undefined : { color: INK }}>{f.getDate()}</span>
              </button>
            )
          })}
        </div>

        <div className="grid" style={{ gridTemplateColumns: columnas }}>
          {/* Eje de horas */}
          <div className="sticky left-0 z-10 bg-white" style={{ height: alto }}>
            {/* Solo las horas en punto llevan etiqueta; las medias horas quedan como una línea tenue de la grilla. */}
            {filasHora.filter((t) => t % 60 === 0).map((t) => (
              <span
                key={t}
                className="absolute right-3 -translate-y-1/2 text-xs font-semibold tabular-nums text-slate-600"
                style={{ top: (t - rango.inicio) * PX_POR_MIN + 8 }}
              >
                {horaA12(minutosAHHMM(t))}
              </span>
            ))}
          </div>

          {dias.map((iso) => {
            const franjas = franjasSombreadas(iso, disponibilidad, rango)
            const bloques = bloquesDelDia(citasVisibles || citas, iso, duracionDefault)
            // Minuto (alineado a la grilla de 30) bajo el puntero, o null.
            const minutoBajoPuntero = (e) => {
              const r = e.currentTarget.getBoundingClientRect()
              const min = rango.inicio + Math.floor((e.clientY - r.top) / PX_POR_MIN / PASO_MINUTOS) * PASO_MINUTOS
              return min >= rango.inicio && min < rango.fin ? min : null
            }
            return (
              <div
                key={iso}
                className={"relative border-l border-slate-100 " + (iso === hoy ? "bg-blue-50/30" : "")}
                style={{ height: alto, ...fondoLineas }}
                onMouseMove={(e) => {
                  const min = minutoBajoPuntero(e)
                  const libre = min != null && celdaLibre(iso, min, disponibilidad, citas, new Date()) && !bloques.some((b) => min < b.fin && min + PASO_MINUTOS > b.inicio)
                  setHover((h) => (libre ? (h && h.iso === iso && h.min === min ? h : { iso, min }) : h ? null : h))
                }}
                onMouseLeave={() => setHover(null)}
                onDragOver={(e) => {
                  if (!arrastre) return
                  const cita = citas.find((c) => c.id === arrastre.id)
                  if (!cita) return
                  const r = e.currentTarget.getBoundingClientRect()
                  const crudo = rango.inicio + (e.clientY - r.top) / PX_POR_MIN - arrastre.offsetMin
                  const min = Math.round(crudo / PASO_MINUTOS) * PASO_MINUTOS
                  const v = validarMovimiento(cita, iso, min, disponibilidad, citas, new Date())
                  setDestino((d) => (d && d.iso === iso && d.min === min && d.ok === v.ok ? d : { iso, min, ok: v.ok, motivo: v.motivo }))
                  if (v.ok) { e.preventDefault(); e.dataTransfer.dropEffect = "move" }
                }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDestino((d) => (d && d.iso === iso ? null : d)) }}
                onDrop={(e) => {
                  e.preventDefault()
                  const cita = arrastre && citas.find((c) => c.id === arrastre.id)
                  if (cita && destino?.ok && destino.iso === iso) onMover?.(cita, iso, destino.min)
                  terminarArrastre()
                }}
                onClick={(e) => {
                  const min = minutoBajoPuntero(e)
                  if (min != null && celdaLibre(iso, min, disponibilidad, citas, new Date()) && !bloques.some((b) => min < b.fin && min + PASO_MINUTOS > b.inicio)) onHuecoLibre?.(iso, min)
                }}
              >
                {hover && hover.iso === iso && (
                  <div
                    className="pointer-events-none absolute inset-x-0.5 z-[1] flex items-center justify-center rounded-md border border-dashed border-blue-300 bg-blue-50/60 text-blue-600"
                    style={{ top: (hover.min - rango.inicio) * PX_POR_MIN + 1, height: PASO_MINUTOS * PX_POR_MIN - 2 }}
                    aria-hidden="true"
                  >
                    <Plus size={14} /> <span className="ml-1 text-[11px] font-semibold">{horaA12(minutosAHHMM(hover.min))}</span>
                  </div>
                )}
                {franjas.map((f, i) => (
                  <div
                    key={i}
                    title={f.tipo === "ausencia" && f.motivo ? `Ausencia: ${f.motivo}` : TITULO_FRANJA[f.tipo]}
                    className="absolute inset-x-0"
                    style={{ top: (f.inicio - rango.inicio) * PX_POR_MIN, height: (f.fin - f.inicio) * PX_POR_MIN, ...ESTILO_FRANJA[f.tipo] }}
                  >
                    {/* Por qué está bloqueado: etiqueta discreta que se queda
                        pegada bajo el encabezado mientras la franja está a la vista. */}
                    {(f.fin - f.inicio) * PX_POR_MIN >= 18 && (
                      <span className="pointer-events-none sticky ml-1.5 inline-block max-w-[calc(100%-12px)] truncate rounded px-1 text-[10px] font-semibold uppercase leading-4 tracking-wide text-slate-400" style={{ top: ALTO_ENCABEZADO + 4 }}>
                        {ETIQUETA_FRANJA[f.tipo]}{f.tipo === "ausencia" && f.motivo ? ` · ${f.motivo}` : ""}
                      </span>
                    )}
                  </div>
                ))}

                {arrastre && destino && destino.iso === iso && (
                  <div
                    className={"pointer-events-none absolute inset-x-0.5 z-[4] rounded-md border-2 border-dashed px-2 py-1 text-[11px] font-semibold " + (destino.ok ? "border-blue-400 bg-blue-100/60 text-blue-700" : "border-red-300 bg-red-100/60 text-red-700")}
                    style={{ top: (destino.min - rango.inicio) * PX_POR_MIN, height: Math.max(22, arrastre.dur * PX_POR_MIN) }}
                    aria-hidden="true"
                  >
                    {destino.ok ? horaA12(minutosAHHMM(destino.min)) : destino.motivo}
                  </div>
                )}

                {bloques.map((b) => {
                  const color = colorDe(b.cita.estado)
                  const altoBloque = Math.max(22, (b.fin - b.inicio) * PX_POR_MIN - 2)
                  const ancho = 100 / b.cols
                  const cobro = cobroPendienteIds?.has(b.cita.id)
                  // Con búsqueda activa: la coincidencia se resalta y el resto se atenúa.
                  const esCoincidencia = !!coincide && coincide(b.cita)
                  const atenuada = !!coincide && !esCoincidencia
                  return (
                    <button
                      type="button"
                      key={b.cita.id}
                      onClick={(e) => {
                        // Mismo detalle de la cita que en la lista (todas las acciones viven ahí).
                        e.stopPropagation()
                        setHover(null)
                        onAbrirDetalle?.(b.cita)
                      }}
                      draggable={b.cita.estado === "Pendiente"}
                      onDragStart={(e) => {
                        const r = e.currentTarget.getBoundingClientRect()
                        e.dataTransfer.effectAllowed = "move"
                        e.dataTransfer.setData("text/plain", String(b.cita.id))
                        setHover(null)
                        setArrastre({ id: b.cita.id, offsetMin: Math.max(0, Math.min(b.fin - b.inicio - 1, (e.clientY - r.top) / PX_POR_MIN)), dur: b.fin - b.inicio })
                      }}
                      onDragEnd={terminarArrastre}
                      title={`${b.cita.paciente} · ${b.cita.hora}${b.cita.estado === "Pendiente" ? " — arrastra para reagendar" : ""}`}
                      className={"absolute overflow-hidden rounded-md border-l-4 px-2 py-1 text-left transition-shadow hover:shadow-lg hover:brightness-[0.97] cursor-pointer " + (esCoincidencia ? "ring-2 ring-blue-500 shadow-md" : "")}
                      style={{
                        top: (b.inicio - rango.inicio) * PX_POR_MIN + 1,
                        height: altoBloque,
                        left: `calc(${b.col * ancho}% + 2px)`,
                        width: `calc(${ancho}% - 4px)`,
                        backgroundColor: color.fondo,
                        borderLeftColor: color.linea,
                        opacity: arrastre?.id === b.cita.id ? 0.35 : atenuada ? 0.25 : b.cancelada ? 0.45 : 1,
                        zIndex: esCoincidencia ? 3 : b.cancelada ? 1 : 2,
                      }}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <p className="min-w-0 flex-1 truncate text-xs font-bold" style={{ color: color.texto }}>{b.cita.paciente}</p>
                        {cobro && <Receipt size={12} className="mt-px shrink-0 text-amber-600" aria-label="Cobro pendiente" />}
                      </div>
                      {altoBloque >= 38 && (
                        <p className="truncate text-[11px] font-medium" style={{ color: color.texto, opacity: 0.8 }}>{[b.cita.hora, b.cita.motivo].filter(Boolean).join(" · ")}</p>
                      )}
                    </button>
                  )
                })}

                {iso === hoy && minutosAhora >= rango.inicio && minutosAhora <= rango.fin && (
                  <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: (minutosAhora - rango.inicio) * PX_POR_MIN }} aria-hidden="true">
                    <div className="relative h-px bg-red-500">
                      <span className="absolute -left-1 -top-[3px] h-[7px] w-[7px] rounded-full bg-red-500" />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {sinCitas && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-center justify-center" style={{ top: ALTO_ENCABEZADO + 48 }}>
          <div role="status" className="pointer-events-auto flex flex-col items-center gap-3 rounded-2xl border border-slate-200/60 bg-white/95 px-8 py-6 text-center shadow-lg">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-slate-50 text-slate-400"><CalendarClock size={22} aria-hidden="true" /></span>
            <div>
              <p className="text-sm font-bold" style={{ color: INK }}>No hay citas esta semana</p>
              <p className="mt-0.5 text-xs text-slate-500">{coincide ? "Ninguna coincide con la búsqueda." : "Agenda una o haz clic en un hueco libre del calendario."}</p>
            </div>
            {onAgendar && (
              <button type="button" onClick={() => onAgendar()} className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold text-white transition-transform hover:-translate-y-0.5 cursor-pointer" style={{ background: "linear-gradient(135deg,#22D3EE,#2563EB)" }}>
                <Plus size={14} aria-hidden="true" /> Agendar cita
              </button>
            )}
          </div>
        </div>
      )}

    </section>
  )
}

