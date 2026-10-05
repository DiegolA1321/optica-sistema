import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Receipt, Stethoscope, CalendarClock, X, Plus } from "lucide-react"
import { isoAFechaLocal, hoyISO, etiquetaFecha } from "../utilidades/disponibilidad"
import { diasDeSemana, rangoHoras, franjasSombreadas, bloquesDelDia, minutosAHHMM, celdaLibre, PASO_MINUTOS } from "../utilidades/calendarioSemana"
import { INK } from "@/lib/tema"

// Calendario semanal por horas (vista Semana de Citas). Presentacional: recibe
// las citas y la disponibilidad ya cargadas y avisa por callbacks; no consulta
// ni escribe datos. Cada día es una columna; el eje vertical son las horas del
// horario de la óptica, en filas de 30 minutos.

const PX_POR_MIN = 64 / 60 // 64 px por hora
const ANCHO_HORAS = 56
const ALTO_ENCABEZADO = 52
const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"]
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]

// Mismos colores de estado que la lista de citas: línea a la izquierda y
// fondo suave. Cualquier estado desconocido se trata como pendiente.
const COLOR_ESTADO = {
  "En Atención": { linea: "#2563eb", fondo: "#eff6ff" },
  Atendida: { linea: "#10b981", fondo: "#ecfdf5" },
  "No Asistió": { linea: "#ef4444", fondo: "#fef2f2" },
  Cancelada: { linea: "#94a3b8", fondo: "#f8fafc" },
}
const COLOR_PENDIENTE = { linea: "#f59e0b", fondo: "#fffbeb" }
const colorDe = (estado) => COLOR_ESTADO[estado] || COLOR_PENDIENTE

const ESTILO_FRANJA = {
  cerrado: { backgroundColor: "rgba(241,245,249,0.85)" },
  almuerzo: { backgroundImage: "repeating-linear-gradient(135deg, rgba(148,163,184,0.16) 0 6px, transparent 6px 12px)", backgroundColor: "rgba(248,250,252,0.9)" },
  ausencia: { backgroundImage: "repeating-linear-gradient(135deg, rgba(148,163,184,0.28) 0 4px, transparent 4px 9px)", backgroundColor: "rgba(241,245,249,0.9)" },
}
const TITULO_FRANJA = { cerrado: "Fuera del horario de atención", almuerzo: "Almuerzo / pausa", ausencia: "Ausencia" }

export function tituloSemana(dias) {
  const a = isoAFechaLocal(dias[0])
  const b = isoAFechaLocal(dias[dias.length - 1])
  if (a.getMonth() === b.getMonth()) return `${a.getDate()} al ${b.getDate()} de ${MESES[b.getMonth()]} de ${b.getFullYear()}`
  return `${a.getDate()} de ${MESES[a.getMonth()]} al ${b.getDate()} de ${MESES[b.getMonth()]} de ${b.getFullYear()}`
}

const BADGE_ESTADO = {
  "En Atención": "border-blue-200/60 bg-blue-50 text-blue-700",
  Atendida: "border-emerald-200/60 bg-emerald-50 text-emerald-700",
  "No Asistió": "border-red-200/60 bg-red-50 text-red-700",
  Cancelada: "border-slate-200/60 bg-slate-50 text-slate-600",
}
const BADGE_PENDIENTE = "border-amber-200/60 bg-amber-50 text-amber-700"
const ANCHO_TARJETA = 288

// Tarjeta flotante con los datos de la cita y las mismas acciones que tiene en
// la lista. Se ancla junto al bloque (a su derecha, o a su izquierda si no
// cabe) y se cierra con Escape, con un clic fuera o al desplazar.
function TarjetaFlotante({ cita, ancla, cobroPendiente, onCerrar, onAtender, onEditar, onCancelar, onCobrar }) {
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

  const cabeDerecha = ancla.right + 8 + ANCHO_TARJETA <= window.innerWidth - 8
  const left = cabeDerecha ? ancla.right + 8 : Math.max(8, ancla.left - 8 - ANCHO_TARJETA)
  const top = Math.max(8, Math.min(ancla.top, window.innerHeight - 300))

  const puedeAtender = cita.estado !== "Atendida" && cita.estado !== "Cancelada"
  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label={`Cita de ${cita.paciente}`}
      className="fixed z-50 rounded-xl border border-slate-200/60 bg-white p-4 text-left shadow-xl"
      style={{ top, left, width: ANCHO_TARJETA, animation: "menu-in 160ms ease-out" }}
    >
      <div className="flex items-start gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-slate-200/60 bg-slate-50 text-xs font-bold text-slate-600">
          {cita.iniciales || (cita.paciente || "P").slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold" style={{ color: INK }}>{cita.paciente}</p>
          <p className="truncate text-xs text-slate-500">{[cita.cedula, cita.telefono].filter(Boolean).join(" · ") || "Sin datos de contacto"}</p>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 cursor-pointer">
          <X size={14} />
        </button>
      </div>

      <dl className="mt-3 space-y-1.5 border-t border-slate-100 pt-3 text-xs">
        <div className="flex justify-between gap-3"><dt className="text-slate-500">Motivo</dt><dd className="truncate font-semibold text-slate-700">{cita.motivo || "Consulta general"}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-slate-500">Fecha y hora</dt><dd className="font-semibold text-slate-700">{etiquetaFecha(cita.fecha).replace(/^./, (c) => c.toUpperCase())} · {cita.hora}</dd></div>
      </dl>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className={"rounded-full border px-2 py-0.5 text-xs font-semibold " + (BADGE_ESTADO[cita.estado] || BADGE_PENDIENTE)}>{cita.estado || "Pendiente"}</span>
        {cobroPendiente && (
          <span className="flex items-center gap-1 rounded-full border border-amber-300/70 bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
            <Receipt size={11} aria-hidden="true" /> Cobro pendiente
          </span>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {cobroPendiente ? (
          <button type="button" onClick={() => onCobrar(cita)} className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 cursor-pointer">
            <Receipt size={14} /> Cobrar
          </button>
        ) : puedeAtender && (
          <button type="button" onClick={() => onAtender(cita)} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-transform hover:-translate-y-0.5 cursor-pointer" style={{ background: "linear-gradient(135deg,#22D3EE,#2563EB)" }}>
            <Stethoscope size={14} /> Atender
          </button>
        )}
        <button type="button" onClick={() => onEditar(cita)} className="flex items-center gap-1.5 rounded-lg border border-slate-200/60 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer">
          <CalendarClock size={14} /> Editar cita
        </button>
        {cita.estado !== "Cancelada" && (
          <button type="button" onClick={() => onCancelar(cita)} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 cursor-pointer">
            <X size={14} /> Cancelar cita
          </button>
        )}
      </div>
    </div>,
    document.body,
  )
}

export default function CalendarioSemanal({ lunes, citas, disponibilidad, cobroPendienteIds, onAtender, onEditar, onCancelar, onCobrar, onHuecoLibre }) {
  // Cita con la tarjeta abierta y dónde anclarla (rect del bloque clicado).
  const [abierta, setAbierta] = useState(null) // { id, ancla } | null
  const cerrarTarjeta = useRef(() => setAbierta(null)).current
  // Celda libre bajo el puntero: { iso, min } | null (fantasma "+ agendar").
  const [hover, setHover] = useState(null)
  const citaAbierta = abierta ? citas.find((c) => c.id === abierta.id) : null
  // Las acciones cierran la tarjeta y delegan en las funciones reales de Citas.
  const conCierre = (fn) => (cita) => { setAbierta(null); fn?.(cita) }

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
    // Solo al abrir o cambiar de semana, no en cada minuto del reloj.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lunes])

  const filasHora = []
  for (let t = rango.inicio; t < rango.fin; t += PASO_MINUTOS) filasHora.push(t)

  const columnas = `${ANCHO_HORAS}px repeat(${dias.length}, minmax(0, 1fr))`
  const fondoLineas = {
    backgroundImage: "linear-gradient(to bottom, #e2e8f0 1px, transparent 1px)",
    backgroundSize: `100% ${PASO_MINUTOS * PX_POR_MIN}px`,
  }

  return (
    <section aria-label="Calendario semanal" className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <h2 className="text-sm font-bold" style={{ color: INK }}>{tituloSemana(dias)}</h2>
      </div>

      <div ref={refScroll} className="relative overflow-y-auto" style={{ maxHeight: "min(70vh, 720px)" }}>
        {/* Encabezado de días (queda fijo al desplazar las horas) */}
        <div className="sticky top-0 z-20 grid border-b border-slate-200/70 bg-white" style={{ gridTemplateColumns: columnas, height: ALTO_ENCABEZADO }}>
          <div />
          {dias.map((iso) => {
            const f = isoAFechaLocal(iso)
            const esHoyCol = iso === hoy
            return (
              <div
                key={iso}
                className={"flex flex-col items-center justify-center border-l border-slate-100 text-xs font-semibold " + (esHoyCol ? "bg-blue-50 text-blue-700" : "text-slate-600")}
              >
                <span className="uppercase tracking-wide">{DIAS_CORTOS[f.getDay()]}</span>
                <span className={"text-base font-bold " + (esHoyCol ? "text-blue-700" : "")} style={esHoyCol ? undefined : { color: INK }}>{f.getDate()}</span>
              </div>
            )
          })}
        </div>

        <div className="grid" style={{ gridTemplateColumns: columnas }}>
          {/* Eje de horas */}
          <div className="relative" style={{ height: alto }}>
            {filasHora.map((t) => (
              <span
                key={t}
                className={"absolute right-2 text-[11px] tabular-nums " + (t % 60 === 0 ? "font-semibold text-slate-600" : "text-slate-400")}
                style={{ top: (t - rango.inicio) * PX_POR_MIN + 2 }}
              >
                {minutosAHHMM(t)}
              </span>
            ))}
          </div>

          {dias.map((iso) => {
            const franjas = franjasSombreadas(iso, disponibilidad, rango)
            const bloques = bloquesDelDia(citas, iso, duracionDefault)
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
                  const libre = min != null && celdaLibre(iso, min, disponibilidad, citas, new Date())
                  setHover((h) => (libre ? (h && h.iso === iso && h.min === min ? h : { iso, min }) : h ? null : h))
                }}
                onMouseLeave={() => setHover(null)}
                onClick={(e) => {
                  const min = minutoBajoPuntero(e)
                  if (min != null && celdaLibre(iso, min, disponibilidad, citas, new Date())) onHuecoLibre?.(iso, min)
                }}
              >
                {hover && hover.iso === iso && (
                  <div
                    className="pointer-events-none absolute inset-x-0.5 z-[1] flex items-center justify-center rounded-md border border-dashed border-blue-300 bg-blue-50/60 text-blue-600"
                    style={{ top: (hover.min - rango.inicio) * PX_POR_MIN + 1, height: PASO_MINUTOS * PX_POR_MIN - 2 }}
                    aria-hidden="true"
                  >
                    <Plus size={14} /> <span className="ml-1 text-[11px] font-semibold">{minutosAHHMM(hover.min)}</span>
                  </div>
                )}
                {franjas.map((f, i) => (
                  <div
                    key={i}
                    title={f.tipo === "ausencia" && f.motivo ? `Ausencia: ${f.motivo}` : TITULO_FRANJA[f.tipo]}
                    className="absolute inset-x-0"
                    style={{ top: (f.inicio - rango.inicio) * PX_POR_MIN, height: (f.fin - f.inicio) * PX_POR_MIN, ...ESTILO_FRANJA[f.tipo] }}
                  />
                ))}

                {bloques.map((b) => {
                  const color = colorDe(b.cita.estado)
                  const altoBloque = Math.max(22, (b.fin - b.inicio) * PX_POR_MIN - 2)
                  const ancho = 100 / b.cols
                  const cobro = cobroPendienteIds?.has(b.cita.id)
                  return (
                    <button
                      type="button"
                      key={b.cita.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        const r = e.currentTarget.getBoundingClientRect()
                        setHover(null)
                        setAbierta({ id: b.cita.id, ancla: { top: r.top, left: r.left, right: r.right } })
                      }}
                      title={`${b.cita.paciente} · ${b.cita.hora}`}
                      className={"absolute overflow-hidden rounded-md border-l-[3px] px-2 py-1 text-left transition-shadow hover:shadow-md cursor-pointer " + (abierta?.id === b.cita.id ? "ring-2 ring-blue-300" : "")}
                      style={{
                        top: (b.inicio - rango.inicio) * PX_POR_MIN + 1,
                        height: altoBloque,
                        left: `calc(${b.col * ancho}% + 2px)`,
                        width: `calc(${ancho}% - 4px)`,
                        backgroundColor: color.fondo,
                        borderLeftColor: color.linea,
                        opacity: b.cancelada ? 0.45 : 1,
                        zIndex: b.cancelada ? 1 : 2,
                      }}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <p className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-800">{b.cita.paciente}</p>
                        {cobro && <Receipt size={12} className="mt-px shrink-0 text-amber-600" aria-label="Cobro pendiente" />}
                      </div>
                      {altoBloque >= 46 && (
                        <p className="truncate text-[11px] text-slate-500">{[b.cita.hora, b.cita.motivo].filter(Boolean).join(" · ")}</p>
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

      {citaAbierta && (
        <TarjetaFlotante
          cita={citaAbierta}
          ancla={abierta.ancla}
          cobroPendiente={!!cobroPendienteIds?.has(citaAbierta.id)}
          onCerrar={cerrarTarjeta}
          onAtender={conCierre(onAtender)}
          onEditar={conCierre(onEditar)}
          onCancelar={conCierre(onCancelar)}
          onCobrar={conCierre(onCobrar)}
        />
      )}
    </section>
  )
}

