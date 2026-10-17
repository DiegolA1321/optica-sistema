"use client"

import { useState } from "react"
import { CalendarDays, CalendarPlus, History } from "lucide-react"
import { Bloque, TituloPagina, FilaCita, Esqueleto } from "./piezas"
import { BOTON_PRINCIPAL, BOTON_SECUNDARIO, ESTILO_PRINCIPAL } from "./estilos"

const DE_A = 10

// Mis citas: las próximas y el historial (atendidas, no asistió y canceladas), con los mismos estados y colores que el módulo de Citas.
export default function MisCitasPortal({ cargando, proximas, historial, citaProps, onAgendar }) {
  const [vistas, setVistas] = useState(DE_A)
  if (cargando) return <div className="space-y-5" aria-busy="true" aria-label="Cargando tus citas"><TituloPagina>Mis citas</TituloPagina><Esqueleto alto="h-40" /></div>
  const visibles = historial.slice(0, vistas)
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <TituloPagina subtitulo="Tus próximas citas y las que ya pasaron.">Mis citas</TituloPagina>
        <button type="button" onClick={() => onAgendar()} className={BOTON_PRINCIPAL + " w-full sm:w-auto"} style={ESTILO_PRINCIPAL}><CalendarPlus size={22} aria-hidden="true" /> Agendar cita</button>
      </div>

      <Bloque id="proximas" titulo="Próximas" Icono={CalendarDays}>
        {proximas.length === 0 ? (
          <p className="text-lg text-slate-700">No tienes citas próximas. Cuando agendes una, aparece aquí.</p>
        ) : (
          <ul className="divide-y divide-slate-100 [&>li:first-child]:pt-0 [&>li:last-child]:pb-0">{proximas.map((c) => <FilaCita key={c.id} cita={c} {...citaProps} />)}</ul>
        )}
      </Bloque>

      {historial.length > 0 && (
        <Bloque id="historial" titulo="Historial" Icono={History}>
          <ul className="divide-y divide-slate-100 [&>li:first-child]:pt-0 [&>li:last-child]:pb-0">{visibles.map((c) => <FilaCita key={c.id} cita={c} />)}</ul>
          {historial.length > vistas && (
            <button type="button" onClick={() => setVistas((v) => v + DE_A)} className={BOTON_SECUNDARIO + " mt-4 w-full sm:w-auto"}>Ver {Math.min(DE_A, historial.length - vistas)} más · quedan {historial.length - vistas}</button>
          )}
        </Bloque>
      )}
    </div>
  )
}
