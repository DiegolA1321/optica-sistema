import { useEffect, useMemo, useRef, useState } from "react"
import { Receipt } from "lucide-react"
import { isoAFechaLocal, hoyISO } from "../utilidades/disponibilidad"
import { diasDeSemana, rangoHoras, franjasSombreadas, bloquesDelDia, minutosAHHMM, PASO_MINUTOS } from "../utilidades/calendarioSemana"
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

export default function CalendarioSemanal({ lunes, citas, disponibilidad, cobroPendienteIds }) {
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
            return (
              <div key={iso} className={"relative border-l border-slate-100 " + (iso === hoy ? "bg-blue-50/30" : "")} style={{ height: alto, ...fondoLineas }}>
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
                    <div
                      key={b.cita.id}
                      className="absolute overflow-hidden rounded-md border-l-[3px] px-2 py-1 text-left"
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
                    </div>
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
    </section>
  )
}

