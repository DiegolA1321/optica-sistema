"use client"

import { hora, horaSinCero } from "../utilidades/formatoFecha"

// El campo de hora de todo el sistema: se elige y se lee en 12 horas («02:00 PM»), no en 24 («14:00»). El valor sigue siendo «HH:MM» (24 h) hacia dentro, así que nada más cambia.
// Un <input> de tipo hora muestra la hora según el navegador (a menudo en 24 h) y no se puede forzar: por eso es una lista.
// `sinCero`: «2:00 PM» (los horarios de trabajo) en vez de «02:00 PM». `paso` son los minutos entre una opción y la siguiente; un valor que no cae en la lista (p. ej. «09:07») se conserva como opción.
const DESDE = 5 * 60
const HASTA = 23 * 60 + 59
const dos = (n) => String(n).padStart(2, "0")
const HHMM = (min) => `${dos(Math.floor(min / 60))}:${dos(min % 60)}`

export default function CampoHora({ value = "", onChange, paso = 15, className = "", id, "aria-label": ariaLabel, "aria-invalid": ariaInvalid, disabled = false, sinCero = false }) {
  const texto = sinCero ? horaSinCero : hora
  const opciones = []
  for (let m = DESDE; m <= HASTA; m += paso) opciones.push(HHMM(m))
  const actual = typeof value === "string" ? value.slice(0, 5) : ""
  if (actual && !opciones.includes(actual)) { opciones.push(actual); opciones.sort() }
  return (
    <select id={id} value={actual} onChange={(e) => onChange?.(e.target.value)} aria-label={ariaLabel} aria-invalid={ariaInvalid} disabled={disabled} className={className + " cursor-pointer"}>
      {!actual && <option value="">Hora</option>}
      {opciones.map((v) => <option key={v} value={v}>{texto(v)}</option>)}
    </select>
  )
}
