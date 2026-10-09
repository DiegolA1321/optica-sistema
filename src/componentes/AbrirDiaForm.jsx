"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { INK, GRAD_MARCA } from "@/lib/tema"
import { horaA12, horarioPropuestoParaAbrir, minutosDesde24h } from "../utilidades/disponibilidad"

// Horas del selector: cada 30 minutos, de 5:00 AM a 10:00 PM, siempre en formato de 12 h.
const HORAS = Array.from({ length: 35 }, (_, i) => {
  const m = 5 * 60 + i * 30
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`
})

function Sesion({ nombre, valor, onChange }) {
  const select = "rounded-lg border border-slate-200/60 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-700 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-blue-100 disabled:opacity-40"
  const opciones = (actual) => (HORAS.includes(actual) ? HORAS : [...HORAS, actual].sort())
  return (
    <div className={"flex flex-wrap items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-colors " + (valor.activo ? "border-blue-300 bg-blue-50/60" : "border-slate-200/60 bg-white")}>
      <label className="flex min-w-[6rem] cursor-pointer items-center gap-2.5 text-sm font-bold text-slate-700">
        <input type="checkbox" checked={valor.activo} onChange={(e) => onChange({ ...valor, activo: e.target.checked })} className="h-4 w-4 cursor-pointer accent-blue-600" />
        {nombre}
      </label>
      <select aria-label={`${nombre}: desde`} disabled={!valor.activo} value={valor.inicio} onChange={(e) => onChange({ ...valor, inicio: e.target.value })} className={select}>
        {opciones(valor.inicio).map((h) => <option key={h} value={h}>{horaA12(h)}</option>)}
      </select>
      <span className="text-sm text-slate-500">a</span>
      <select aria-label={`${nombre}: hasta`} disabled={!valor.activo} value={valor.fin} onChange={(e) => onChange({ ...valor, fin: e.target.value })} className={select}>
        {opciones(valor.fin).map((h) => <option key={h} value={h}>{horaA12(h)}</option>)}
      </select>
    </div>
  )
}

// Abrir un día cerrado: qué sesiones (mañana y/o tarde) y si también admite reservas por la web. Parte de las horas del horario
// habitual de la óptica. Un día abierto así es solo para el personal. onConfirmar({ manana, tarde }, agendar).
export default function AbrirDiaForm({ iso, disponibilidad, puedeAgendar = false, guardando = false, onConfirmar, onCancelar }) {
  const [sesiones, setSesiones] = useState(() => horarioPropuestoParaAbrir(iso, disponibilidad))
  const [error, setError] = useState("")

  const validar = () => {
    const { manana, tarde } = sesiones
    if (!manana.activo && !tarde.activo) return "Elige al menos la mañana o la tarde."
    for (const [nombre, s] of [["La mañana", manana], ["La tarde", tarde]]) {
      if (s.activo && minutosDesde24h(s.fin) <= minutosDesde24h(s.inicio)) return `${nombre} debe terminar después de la hora en que empieza.`
    }
    if (manana.activo && tarde.activo && minutosDesde24h(tarde.inicio) < minutosDesde24h(manana.fin)) return "La tarde debe empezar después de que termine la mañana."
    return ""
  }
  const confirmar = (agendar) => {
    const problema = validar()
    setError(problema)
    if (!problema) onConfirmar(sesiones, agendar)
  }

  return (
    <div className="px-5 py-5">
      <div className="space-y-2">
        <Sesion nombre="Mañana" valor={sesiones.manana} onChange={(manana) => setSesiones((s) => ({ ...s, manana }))} />
        <Sesion nombre="Tarde" valor={sesiones.tarde} onChange={(tarde) => setSesiones((s) => ({ ...s, tarde }))} />
      </div>
      <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl bg-slate-50 px-3.5 py-3">
        <input type="checkbox" checked={reservasWeb} onChange={(e) => setReservasWeb(e.target.checked)} className="mt-0.5 h-4 w-4 cursor-pointer accent-blue-600" />
        <span>
          <span className="block text-sm font-bold" style={{ color: INK }}>Permitir también reservas por la web</span>
          <span className="block text-xs text-slate-500">Desmarcado: solo el personal agenda ese día y los pacientes no lo ven en la página pública.</span>
        </span>
      </label>
      {error && <p role="alert" className="mt-3 text-sm font-medium text-red-600">{error}</p>}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <button type="button" onClick={onCancelar} disabled={guardando} className="rounded-xl border border-slate-200/60 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer disabled:opacity-60">Cancelar</button>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => confirmar(false)} disabled={guardando} className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200/70 bg-blue-50 px-3.5 py-2 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-100 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60">
            {guardando && <Loader2 size={14} className="animate-spin" aria-hidden="true" />} Solo abrir
          </button>
          {puedeAgendar && (
            <button type="button" onClick={() => confirmar(true)} disabled={guardando} className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60" style={{ background: GRAD_MARCA }}>
              Abrir y agendar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
