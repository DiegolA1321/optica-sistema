"use client"

import { useState } from "react"
import { CalendarDays, CalendarPlus, History } from "lucide-react"
import { Bloque, TituloPagina, FilaCita, Esqueleto } from "./piezas"
import HeroCita from "./HeroCita"
import { BOTON_PRINCIPAL, BOTON_SECUNDARIO, ESTILO_PRINCIPAL } from "./estilos"

const DE_A = 10

// Mis citas: las próximas y el historial (atendidas, no asistió y canceladas), con los mismos estados y colores que el módulo de Citas.
export default function MisCitasPortal({ cargando, proximas, historial, citaProps, onAgendar, nombreOptica }) {
  const [vistas, setVistas] = useState(DE_A)
  if (cargando) return <div className="space-y-5" aria-busy="true" aria-label="Cargando tus citas"><TituloPagina>Mis citas</TituloPagina><Esqueleto alto="h-40" /></div>
  const visibles = historial.slice(0, vistas)
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <TituloPagina subtitulo="Tus próximas citas y las que ya pasaron.">Mis citas</TituloPagina>
        {proximas.length > 0 && <button type="button" onClick={() => onAgendar()} className={BOTON_PRINCIPAL + " w-full sm:w-auto"} style={ESTILO_PRINCIPAL}><CalendarPlus size={22} aria-hidden="true" /> Agendar cita</button>}
      </div>

      <div className="grid gap-5 lg:grid-cols-12 lg:items-start">
        <div className="space-y-5 lg:col-span-7">
          <HeroCita cita={proximas[0] || null} nombreOptica={nombreOptica} citaProps={citaProps} onAgendar={onAgendar} />
          {proximas.length > 1 && (
            <Bloque id="proximas" titulo="Otras citas próximas" Icono={CalendarDays}>
              <ul className="divide-y divide-slate-100 [&>li:first-child]:pt-0 [&>li:last-child]:pb-0">{proximas.slice(1).map((c) => <FilaCita key={c.id} cita={c} {...citaProps} />)}</ul>
            </Bloque>
          )}
        </div>
        <div className="lg:col-span-5">
      {historial.length > 0 ? (
        <Bloque id="historial" titulo="Historial" Icono={History}>
          <ul className="divide-y divide-slate-100 [&>li:first-child]:pt-0 [&>li:last-child]:pb-0">{visibles.map((c) => <FilaCita key={c.id} cita={c} />)}</ul>
          {historial.length > vistas && (
            <button type="button" onClick={() => setVistas((v) => v + DE_A)} className={BOTON_SECUNDARIO + " mt-4 w-full sm:w-auto"}>Ver {Math.min(DE_A, historial.length - vistas)} más · quedan {historial.length - vistas}</button>
          )}
        </Bloque>
      ) : (
        <Bloque id="historial" titulo="Historial" Icono={History}><p className="text-lg text-slate-700">Aquí aparecen tus citas atendidas, las que no asististe y las canceladas.</p></Bloque>
      )}
        </div>
      </div>
    </div>
  )
}
