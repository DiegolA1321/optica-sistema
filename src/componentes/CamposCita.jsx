"use client"

import { ahoraEcuador } from "../utilidades/horaEcuador"
import { hoyISO } from "../utilidades/disponibilidad"
import SelectorAsignado from "./SelectorAsignado"
import SelectorFechaHora from "./SelectorFechaHora"

// Campos de una cita (motivo, asignado, fecha y hora, y "Llegó en un horario diferente"), compartidos por
// "Gestionar cita" en Citas y "Agendar cita" en el perfil del paciente. El estado lo lleva quien lo usa.
export default function CamposCita({ prefijoId, motivosConsulta = [], equipo = [], disponibilidad, citas = [], atenderInmediato = false, valores, cambiar, errorHorarioCustom = "" }) {
  const { motivo, asignadoA, fecha, hora, horaPersonalizada, horaCustom, duracionCustom } = valores
  const { setMotivo, setAsignadoA, setFecha, setHora, setHoraPersonalizada, setHoraCustom, setDuracionCustom, limpiarErrorHorario } = cambiar
  return (
    <>
      <div>
        <label htmlFor={prefijoId + "-motivo"} className="mb-1.5 block text-sm font-semibold text-slate-700">Motivo del examen</label>
        <select
          id={prefijoId + "-motivo"}
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          required
          className="w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50"
        >
          <option value="" disabled>Seleccione el motivo del examen</option>
          {motivosConsulta.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      <SelectorAsignado id={prefijoId + "-asignado"} valor={asignadoA} onChange={setAsignadoA} equipo={equipo} />

      <SelectorFechaHora
        disponibilidad={disponibilidad}
        citas={citas}
        fecha={fecha}
        hora={horaPersonalizada ? "" : hora}
        onCambiarFecha={setFecha}
        onCambiarHora={(h) => { setHora(h); setHoraPersonalizada(false) }}
        mesesAdelante={14}
      />

      {/* Horario personalizado — para un paciente que llega fuera de la grilla de horarios fijos
          (walk-in, o alguien a quien se decide atender antes/después de su turno). */}
      <div className="rounded-xl border border-slate-200/60 bg-slate-50/60 p-3.5">
        <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-slate-700">
          <input
            type="checkbox"
            checked={horaPersonalizada}
            onChange={(e) => {
              setHoraPersonalizada(e.target.checked)
              limpiarErrorHorario()
              if (e.target.checked) {
                const ahora = ahoraEcuador()
                if (!fecha) setFecha(hoyISO())
                if (!horaCustom) setHoraCustom(`${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`)
              }
            }}
            className="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus-visible:ring-blue-500"
          />
          Llegó en un horario diferente al de la grilla
        </label>
        {atenderInmediato && <p className="mt-1.5 pl-[1.625rem] text-xs text-slate-500">Es de hoy: al confirmar pasa directo a la ficha clínica.</p>}
        {horaPersonalizada && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={prefijoId + "-hora-real"} className="mb-1 block text-xs font-semibold text-slate-500">Hora real</label>
              <input
                id={prefijoId + "-hora-real"}
                type="time"
                value={horaCustom}
                onChange={(e) => { setHoraCustom(e.target.value); limpiarErrorHorario() }}
                className="w-full rounded-lg border border-slate-200/60 bg-white px-2.5 py-2 text-sm outline-none transition focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-50"
              />
            </div>
            <div>
              <label htmlFor={prefijoId + "-duracion"} className="mb-1 block text-xs font-semibold text-slate-500">Duración estimada (min)</label>
              <input
                id={prefijoId + "-duracion"}
                type="number"
                min={5}
                step={5}
                value={duracionCustom}
                onChange={(e) => { setDuracionCustom(e.target.value); limpiarErrorHorario() }}
                className="w-full rounded-lg border border-slate-200/60 bg-white px-2.5 py-2 text-sm outline-none transition focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-50"
              />
            </div>
            {errorHorarioCustom && (
              <p className="col-span-2 text-xs font-medium text-red-600">{errorHorarioCustom}</p>
            )}
          </div>
        )}
      </div>
    </>
  )
}
