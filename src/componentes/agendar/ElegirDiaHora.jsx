import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Clock } from "lucide-react"
import { fechaAISO, hoyISO, isoAFechaLocal, slotsDisponibles, minutosDesdeMedianoche } from "../../utilidades/disponibilidad"
import { formatoFecha, horaSinCero } from "../../utilidades/formatoFecha"
import { degradadoMarca } from "../../utilidades/marcaOptica"
import { INK } from "@/lib/tema"

const DIAS_VISIBLES = 7
const DIAS_MAXIMOS = 63 // hasta nueve semanas adelante

// «Elige el día»: los próximos siete días con cuántas horas libres tiene cada uno («Mié 29 · 5 libres») y «Ver más fechas» para avanzar de a siete.
// Debajo, las horas del día elegido en MAÑANA y TARDE (las ocupadas, tachadas). Las horas libres salen de LA regla única (slotsDisponibles):
// la misma que usa el portal y la que valida el servidor, con o sin profesional elegido.
export default function ElegirDiaHora({ disponibilidad, citas = [], profesionalId = null, fecha, hora, onCambiarFecha, onCambiarHora, color }) {
  const [desde, setDesde] = useState(0)
  const grad = degradadoMarca(color)
  const hoy = hoyISO()
  const opciones = { publico: true, porProfesional: true, profesionalId: profesionalId || null }

  const dias = useMemo(() => {
    const base = isoAFechaLocal(hoy)
    return Array.from({ length: DIAS_VISIBLES }, (_, i) => {
      const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + desde + i)
      const iso = fechaAISO(d)
      const slots = slotsDisponibles(iso, disponibilidad, citas, opciones)
      const libres = slots.filter((s) => s.libre).length
      const [semana, numero] = formatoFecha(iso, "diaNumero").split(" ")
      return { iso, semana: iso === hoy ? "Hoy" : semana, numero, libres, cerrado: slots.length === 0 }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desde, hoy, disponibilidad, citas, profesionalId])

  const slots = useMemo(() => (fecha ? slotsDisponibles(fecha, disponibilidad, citas, opciones) : []), [fecha, disponibilidad, citas, profesionalId]) // eslint-disable-line react-hooks/exhaustive-deps
  const manana = slots.filter((s) => minutosDesdeMedianoche(s.hora) < 12 * 60)
  const tarde = slots.filter((s) => minutosDesdeMedianoche(s.hora) >= 12 * 60)

  const botonHora = (s) => {
    const sel = hora === s.hora
    return (
      <button
        key={s.hora}
        type="button"
        disabled={!s.libre}
        aria-pressed={sel}
        onClick={() => onCambiarHora(s.hora)}
        className={"min-h-12 rounded-xl border text-base font-semibold transition-colors " +
          (!s.libre ? "cursor-not-allowed border-dashed border-slate-300 bg-transparent text-slate-400 line-through"
            : sel ? "border-transparent text-white shadow-md cursor-pointer"
            : "border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50 cursor-pointer")}
        style={sel ? { background: grad, boxShadow: "0 8px 18px -8px rgba(37,99,235,0.5)" } : undefined}
      >
        {horaSinCero(s.hora)}
      </button>
    )
  }
  const grupo = (titulo, lista) => (
    <div className="min-w-0" data-grupo-horas={titulo}>
      <p className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-600">{titulo}</p>
      {lista.length > 0
        ? <div className="grid grid-cols-2 gap-2 min-[480px]:grid-cols-3">{lista.map(botonHora)}</div>
        : <p className="text-sm text-slate-500">Sin horas en la {titulo.toLowerCase()}.</p>}
    </div>
  )

  const puedeAvanzar = desde + DIAS_VISIBLES < DIAS_MAXIMOS
  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-base font-bold" style={{ color: INK }}>Elige el día</p>
          <div className="flex items-center gap-1">
            {desde > 0 && (
              <button type="button" onClick={() => setDesde((d) => Math.max(0, d - DIAS_VISIBLES))} className="inline-flex min-h-11 cursor-pointer items-center gap-0.5 px-2 text-base font-semibold hover:underline" style={{ color }}>
                <ChevronLeft size={16} aria-hidden="true" /> Fechas anteriores
              </button>
            )}
            {puedeAvanzar && (
              <button type="button" onClick={() => setDesde((d) => d + DIAS_VISIBLES)} className="inline-flex min-h-11 cursor-pointer items-center gap-0.5 px-2 text-base font-semibold hover:underline" style={{ color }}>
                Ver más fechas <ChevronRight size={16} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2 md:grid-cols-7 md:gap-3" role="group" aria-label="Próximos días">
          {dias.map((d) => {
            const sel = fecha === d.iso
            const disponible = !d.cerrado && d.libres > 0
            return (
              <button
                key={d.iso}
                type="button"
                disabled={!disponible}
                aria-pressed={sel}
                aria-label={`${d.semana} ${d.numero}: ${d.cerrado ? "cerrado" : d.libres === 0 ? "sin horas" : d.libres === 1 ? "1 hora libre" : `${d.libres} horas libres`}`}
                onClick={() => { onCambiarFecha(d.iso); onCambiarHora("") }}
                className={"flex min-h-20 flex-col items-center justify-center rounded-xl border px-1 py-2 text-center transition-colors " +
                  (!disponible ? "cursor-not-allowed border-transparent bg-transparent text-slate-400"
                    : sel ? "border-transparent text-white shadow-md cursor-pointer"
                    : "border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50 cursor-pointer")}
                style={sel ? { background: grad, boxShadow: "0 8px 18px -8px rgba(37,99,235,0.5)" } : undefined}
              >
                <span className="text-sm">{d.semana}</span>
                <span className="text-2xl font-bold leading-tight">{d.numero}</span>
                <span className="text-sm">{d.cerrado ? "Cerrado" : d.libres === 0 ? "Sin horas" : `${d.libres} ${d.libres === 1 ? "libre" : "libres"}`}</span>
              </button>
            )
          })}
        </div>
      </div>

      {!fecha ? (
        <div className="flex min-h-28 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-4 text-center">
          <Clock size={20} className="mb-1.5 text-slate-400" aria-hidden="true" />
          <p className="text-base font-medium text-slate-600">Elige un día para ver sus horas.</p>
        </div>
      ) : slots.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-4 text-center text-base font-medium text-slate-600">Ese día no hay horas disponibles. Elige otro.</div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:gap-10">
          {grupo("Mañana", manana)}
          {grupo("Tarde", tarde)}
        </div>
      )}
    </div>
  )
}
