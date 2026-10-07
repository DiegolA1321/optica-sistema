"use client"

import { opcionesAsignables } from "../utilidades/equipo"

// "Asignado a": quién debería atender la cita. Es opcional.
export default function SelectorAsignado({ id, valor, onChange, equipo }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-slate-700">
        Asignado a <span className="font-normal text-slate-500">(opcional)</span>
      </label>
      <select
        id={id}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100"
      >
        <option value="">Sin asignar</option>
        {/* Las personas desactivadas no se ofrecen; si la cita ya estaba asignada a una, se conserva su nombre como opción actual. */}
        {opcionesAsignables(equipo, valor).map((m) => (
          <option key={m.id} value={m.id}>{m.nombre}{m.esOptometra ? " · Optómetra" : ""}{m.activo === false ? " (desactivado)" : ""}</option>
        ))}
      </select>
    </div>
  )
}
