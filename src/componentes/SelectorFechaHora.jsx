"use client"

import { ahoraEcuador } from "../utilidades/horaEcuador"

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Clock } from "lucide-react"
import { fechaAISO, hoyISO, diaTieneCupo, slotsDisponibles } from "../utilidades/disponibilidad"
import { formatoFecha } from "../utilidades/formatoFecha"
import { INK } from "@/lib/tema"

// ─── Paleta de firma (consistente con el resto del sistema) ───
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)"

const DIAS_CORTOS = ["L", "M", "X", "J", "V", "S", "D"]

// Calendario + horarios reutilizable: solo deja elegir fechas con cupo real
// (según el horario del optómetra) y horas que aún no están ocupadas.
// mesInicial (ISO): mes que se muestra mientras todavía no hay fecha elegida (por ejemplo el de una fecha recomendada).
export default function SelectorFechaHora({ disponibilidad, citas = [], fecha, hora, onCambiarFecha, onCambiarHora, mesesAdelante = 2, mesInicial = "", publico = false, grande = false, profesionalId = null }) {
  // `grande`: números y horarios de 18 px y celdas de 48 px, para el portal del paciente (regla 48).
  const hoy = hoyISO()
  const mesHoy = new Date(ahoraEcuador().getFullYear(), ahoraEcuador().getMonth(), 1)
  const referencia = fecha || mesInicial
  const mesArranque = referencia ? new Date(Number(referencia.slice(0, 4)), Number(referencia.slice(5, 7)) - 1, 1) : mesHoy
  const [mesVista, setMesVista] = useState(mesArranque)
  const mesMax = new Date(mesHoy.getFullYear(), mesHoy.getMonth() + mesesAdelante, 1)

  const dias = useMemo(() => {
    const primerDia = new Date(mesVista.getFullYear(), mesVista.getMonth(), 1)
    const ultimoDia = new Date(mesVista.getFullYear(), mesVista.getMonth() + 1, 0)
    const offset = (primerDia.getDay() + 6) % 7 // lunes = 0
    const arr = []
    for (let i = 0; i < offset; i++) arr.push(null)
    for (let n = 1; n <= ultimoDia.getDate(); n++) {
      const d = new Date(mesVista.getFullYear(), mesVista.getMonth(), n)
      const iso = fechaAISO(d)
      const pasado = iso < hoy
      const disponible = !pasado && diaTieneCupo(iso, disponibilidad, citas, { publico, profesionalId })
      arr.push({ numero: n, iso, disponible })
    }
    return arr
  }, [mesVista, disponibilidad, citas, hoy, publico, profesionalId])

  const slots = useMemo(() => (fecha ? slotsDisponibles(fecha, disponibilidad, citas, { publico, profesionalId }) : []), [fecha, disponibilidad, citas, publico, profesionalId])

  const irMesAnterior = () => setMesVista((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
  const irMesSiguiente = () => setMesVista((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))
  const puedeAnterior = mesVista > mesHoy
  const puedeSiguiente = mesVista < mesMax

  const seleccionarDia = (dia) => {
    if (!dia || !dia.disponible) return
    onCambiarFecha(dia.iso)
    onCambiarHora("")
  }

  return (
    <div className={"grid grid-cols-1 items-start gap-4 " + (grande ? "md:grid-cols-[26rem_1fr]" : "md:grid-cols-2")}>
      {/* Calendario */}
      <div className={"rounded-xl border border-slate-200/60 bg-slate-50/40 " + (grande ? "p-2.5 sm:p-4" : "p-3")}>
        <div className="mb-2.5 flex items-center justify-between px-0.5">
          <span className={(grande ? "text-xl" : "text-xs") + " font-bold capitalize"} style={{ color: INK }}>
            {formatoFecha(mesVista, "mesAnio")}
          </span>
          <div className={"flex text-slate-500 " + (grande ? "gap-1.5" : "gap-1")}>
            <button
              type="button"
              onClick={irMesAnterior}
              disabled={!puedeAnterior}
              aria-label="Mes anterior"
              className={(grande ? "grid h-12 w-12 place-items-center rounded-lg " : "rounded-md p-0.5 ") + "transition-colors " + (puedeAnterior ? "hover:bg-slate-200 hover:text-slate-700 cursor-pointer" : "cursor-not-allowed opacity-30")}
            >
              <ChevronLeft size={grande ? 24 : 14} />
            </button>
            <button
              type="button"
              onClick={irMesSiguiente}
              disabled={!puedeSiguiente}
              aria-label="Mes siguiente"
              className={(grande ? "grid h-12 w-12 place-items-center rounded-lg " : "rounded-md p-0.5 ") + "transition-colors " + (puedeSiguiente ? "hover:bg-slate-200 hover:text-slate-700 cursor-pointer" : "cursor-not-allowed opacity-30")}
            >
              <ChevronRight size={grande ? 24 : 14} />
            </button>
          </div>
        </div>

        <div className={"mb-1.5 grid grid-cols-7 gap-x-0 text-center font-bold sm:gap-1 " + (grande ? "text-base text-slate-600" : "text-xs text-slate-500")}>
          {DIAS_CORTOS.map((d, i) => (<span key={i}>{d}</span>))}
        </div>

        <div className={"grid grid-cols-7 " + (grande ? "gap-x-0 gap-y-1 sm:gap-1.5" : "gap-1")}>
          {dias.map((dia, i) => {
            if (!dia) return <span key={`e${i}`} />
            const sel = fecha === dia.iso
            return (
              <button
                key={dia.iso}
                type="button"
                disabled={!dia.disponible}
                onClick={() => seleccionarDia(dia)}
                title={dia.disponible ? "Disponible" : "Sin cupos"}
                className={
                  "grid w-full place-items-center rounded-lg border font-bold transition-colors " + (grande ? "h-12 text-xl " : "h-7 text-xs ") +
                  (!dia.disponible
                    ? "cursor-not-allowed border-slate-100 bg-slate-50/60 text-slate-300"
                    : sel
                    ? "border-transparent text-white shadow-md"
                    : "border-emerald-200/60 bg-emerald-50 text-emerald-700 hover:border-emerald-400 cursor-pointer")
                }
                style={sel ? { background: GRAD, boxShadow: "0 8px 18px -8px rgba(37,99,235,0.5)" } : undefined}
              >
                {dia.numero}
              </button>
            )
          })}
        </div>

        <div className={"mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-200/70 pt-2.5 " + (grande ? "text-base text-slate-600" : "text-xs text-slate-500")}>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Disponible</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-slate-200" />No disponible</span>
        </div>
      </div>

      {/* Horarios */}
      <div>
        <label className={"mb-1.5 block font-bold " + (grande ? "text-lg text-slate-700" : "text-xs uppercase tracking-wider text-slate-500")}>
          {fecha ? `Horarios para el ${formatoFecha(fecha, "numericoCorto")}` : "Horarios disponibles"}
        </label>

        {!fecha ? (
          <div className="flex h-36 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-4 text-center">
            <Clock size={20} className="mb-1.5 text-slate-300" />
            <p className={(grande ? "text-lg text-slate-600" : "text-xs") + " font-medium text-slate-500"}>Elige un día disponible en el calendario para ver sus horarios.</p>
          </div>
        ) : slots.length === 0 ? (
          <div className="flex h-36 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-4 text-center">
            <Clock size={20} className="mb-1.5 text-slate-300" />
            <p className={(grande ? "text-lg text-slate-600" : "text-xs") + " font-medium text-slate-500"}>No hay horarios disponibles para este día.</p>
          </div>
        ) : (
          <div className={"grid gap-1.5 " + (grande ? "grid-cols-2" : "grid-cols-3")}>
            {slots.map((s) => {
              const sel = hora === s.hora
              return (
                <button
                  key={s.hora}
                  type="button"
                  disabled={!s.libre}
                  onClick={() => onCambiarHora(s.hora)}
                  className={
                    "rounded-lg border font-bold transition-colors " + (grande ? "min-h-12 py-3 text-lg " : "py-2 text-xs ") +
                    (!s.libre
                      ? "cursor-not-allowed border-transparent text-slate-300 line-through"
                      : sel
                      ? "border-transparent text-white shadow-md cursor-pointer"
                      : "border-slate-200/60 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/40 cursor-pointer")
                  }
                  style={sel ? { background: GRAD, boxShadow: "0 8px 18px -8px rgba(37,99,235,0.5)" } : !s.libre ? { backgroundColor: "#f1f0ec" } : undefined}
                >
                  {s.hora}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
