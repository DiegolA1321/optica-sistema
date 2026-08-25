"use client"

import { useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Clock } from "lucide-react"
import { fechaAISO, hoyISO, diaTieneCupo, slotsDisponibles } from "../utilidades/disponibilidad"

// ─── Paleta de firma (consistente con el resto del sistema) ───
const INK = "#0A1420"
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)"

const DIAS_CORTOS = ["L", "M", "X", "J", "V", "S", "D"]
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]

// Calendario + horarios reutilizable: solo deja elegir fechas con cupo real
// (según el horario del optómetra) y horas que aún no están ocupadas.
export default function SelectorFechaHora({ disponibilidad, citas = [], fecha, hora, onCambiarFecha, onCambiarHora, mesesAdelante = 2 }) {
  const hoy = hoyISO()
  const mesHoy = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const mesInicial = fecha ? new Date(Number(fecha.slice(0, 4)), Number(fecha.slice(5, 7)) - 1, 1) : mesHoy
  const [mesVista, setMesVista] = useState(mesInicial)
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
      const disponible = !pasado && diaTieneCupo(iso, disponibilidad, citas)
      arr.push({ numero: n, iso, disponible })
    }
    return arr
  }, [mesVista, disponibilidad, citas, hoy])

  const slots = useMemo(() => (fecha ? slotsDisponibles(fecha, disponibilidad, citas) : []), [fecha, disponibilidad, citas])

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
    <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2">
      {/* Calendario */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3">
        <div className="mb-2.5 flex items-center justify-between px-0.5">
          <span className="text-xs font-bold capitalize" style={{ color: INK }}>
            {MESES[mesVista.getMonth()]} {mesVista.getFullYear()}
          </span>
          <div className="flex gap-1 text-slate-500">
            <button
              type="button"
              onClick={irMesAnterior}
              disabled={!puedeAnterior}
              className={"rounded-md p-0.5 transition-colors " + (puedeAnterior ? "hover:bg-slate-200 hover:text-slate-700 cursor-pointer" : "cursor-not-allowed opacity-30")}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              onClick={irMesSiguiente}
              disabled={!puedeSiguiente}
              className={"rounded-md p-0.5 transition-colors " + (puedeSiguiente ? "hover:bg-slate-200 hover:text-slate-700 cursor-pointer" : "cursor-not-allowed opacity-30")}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        <div className="mb-1.5 grid grid-cols-7 gap-1 text-center text-[9px] font-bold text-slate-500">
          {DIAS_CORTOS.map((d, i) => (<span key={i}>{d}</span>))}
        </div>

        <div className="grid grid-cols-7 gap-1">
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
                  "grid h-7 w-full place-items-center rounded-lg border text-[11px] font-bold transition-all " +
                  (!dia.disponible
                    ? "cursor-not-allowed border-slate-100 bg-slate-50/60 text-slate-300"
                    : sel
                    ? "border-transparent text-white shadow-md"
                    : "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-400 cursor-pointer")
                }
                style={sel ? { background: GRAD, boxShadow: "0 8px 18px -8px rgba(37,99,235,0.5)" } : undefined}
              >
                {dia.numero}
              </button>
            )
          })}
        </div>

        <div className="mt-2.5 flex items-center gap-3 border-t border-slate-200/70 pt-2.5 text-[9px] text-slate-500">
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />Disponible</span>
          <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-slate-200" />No disponible</span>
        </div>
      </div>

      {/* Horarios */}
      <div>
        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
          {fecha ? `Horarios para el ${fecha.split("-").reverse().slice(0, 2).join("/")}` : "Horarios disponibles"}
        </label>

        {!fecha ? (
          <div className="flex h-36 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-4 text-center">
            <Clock size={20} className="mb-1.5 text-slate-300" />
            <p className="text-xs font-medium text-slate-500">Elige un día disponible en el calendario para ver sus horarios.</p>
          </div>
        ) : slots.length === 0 ? (
          <div className="flex h-36 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-4 text-center">
            <Clock size={20} className="mb-1.5 text-slate-300" />
            <p className="text-xs font-medium text-slate-500">No hay horarios disponibles para este día.</p>
          </div>
        ) : (
          <div className="grid max-h-36 grid-cols-3 gap-1.5 overflow-y-auto pr-0.5">
            {slots.map((s) => {
              const sel = hora === s.hora
              return (
                <button
                  key={s.hora}
                  type="button"
                  disabled={!s.libre}
                  onClick={() => onCambiarHora(s.hora)}
                  className={
                    "rounded-lg border py-2 text-[11px] font-bold transition-all " +
                    (!s.libre
                      ? "cursor-not-allowed border-transparent text-slate-300 line-through"
                      : sel
                      ? "border-transparent text-white shadow-md cursor-pointer"
                      : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 hover:bg-blue-50/40 cursor-pointer")
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
