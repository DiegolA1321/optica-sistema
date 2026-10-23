"use client"

import { ChevronRight } from "lucide-react"
import { INK } from "@/lib/tema"
import { asistenciaDeCitas } from "../../utilidades/cicloCitas"
import { fechaLegible } from "../../utilidades/formatoFecha"

// Las dos tarjetas de arriba de la pestaña Citas, lado a lado: «Asistencia a sus citas» y «Su ciclo de control». Lo que antes eran la franja de conteos, el control recomendado y la última consulta vive aquí dentro.
// Cada tarjeta se pulsa entera (un botón transparente la cubre); lo que se puede tocar adentro (la leyenda, «Contactar», «Agendar control») queda por encima y no activa la acción de la tarjeta.
const CARTA = "pt-abrible relative rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm transition-colors hover:bg-slate-50/60"
const plural = (n, uno, varios) => (n === 1 ? uno : varios)

const SEGMENTOS = [
  { id: "atendidas", clave: "atendidas", color: "bg-emerald-600", punto: "bg-emerald-600", uno: "atendida", varios: "atendidas" },
  { id: "noEfectuadas", clave: "noEfectuadas", color: "bg-red-600", punto: "bg-red-600", uno: "no efectuada", varios: "no efectuadas" },
  { id: "canceladas", clave: "canceladas", color: "bg-slate-400", punto: "bg-slate-400", uno: "cancelada", varios: "canceladas" },
  { id: "pendientes", clave: "pendientes", color: "bg-amber-500", punto: "bg-amber-600", uno: "pendiente", varios: "pendientes" },
]

// Pulsar la tarjeta abre el detalle de su asistencia (`onAbrir`); los puntos de la leyenda filtran el historial: `filtro` es el estado activo (o null) y `onFiltro(id)` lo cambia (pulsar el mismo lo quita). `faltas`: las citas de «Faltó a sus 2 últimas citas» (o []); `onContactar`: la acción (o undefined si no se puede).
export function AsistenciaCitas({ citas = [], filtro = null, onFiltro, onAbrir, faltas = [], onContactar }) {
  const a = asistenciaDeCitas(citas)
  return (
    <section aria-label="Asistencia a sus citas" data-resumen className={CARTA}>
      <button type="button" onClick={onAbrir} aria-haspopup="dialog" aria-label="Asistencia a sus citas: ver el detalle" className="pt-abrir absolute inset-0 rounded-2xl cursor-pointer" />
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold" style={{ color: INK }}>Asistencia a sus citas</h2>
        <ChevronRight size={16} className="text-slate-400" aria-hidden="true" />
      </div>
      {a.resueltas > 0 ? (
        <p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-sm text-slate-500"><span className="font-serif text-[30px] font-bold leading-none" style={{ color: INK }}>{a.atendidas} de {a.resueltas}</span> {plural(a.resueltas, "cita atendida", "citas atendidas")} ({a.porcentaje} %)</p>
      ) : (
        <p className="mt-2 text-sm text-slate-500"><span className="font-serif text-[30px] font-bold leading-none" style={{ color: INK }}>0 de 0</span> citas atendidas · todavía no se resuelve ninguna</p>
      )}
      <div aria-hidden="true" className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-slate-100">
        {SEGMENTOS.slice(0, 3).filter((s) => a[s.clave] > 0).map((s) => <div key={s.id} className={s.color} style={{ width: `${(a[s.clave] / a.resueltas) * 100}%` }} />)}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-slate-600">
        {SEGMENTOS.map((s) => (
          <li key={s.id}>
            <button type="button" onClick={() => onFiltro(s.id)} aria-pressed={filtro === s.id} className={"flex items-start gap-1.5 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-slate-100 cursor-pointer " + (filtro === s.id ? "bg-slate-100 font-semibold" : "")}>
              <span aria-hidden="true" className={"mt-1.5 h-2 w-2 shrink-0 rounded-full " + s.punto} />
              <span className="min-w-0 whitespace-nowrap">{a[s.clave]} {plural(a[s.clave], s.uno, s.varios)}</span>
            </button>
          </li>
        ))}
      </ul>
      {faltas.length > 0 && (
        <div role="alert" className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-800">
          <span>Faltó a sus {faltas.length} últimas citas.</span>
          {onContactar && <button type="button" onClick={onContactar} aria-haspopup="dialog" className="font-bold text-blue-700 transition-colors hover:text-blue-800 hover:underline cursor-pointer">Contactar</button>}
        </div>
      )}
    </section>
  )
}

// `ciclo`: { diasParaControl, avance, vencido } o null (sin control recomendado). `inicio`: { etiqueta, fecha } (la última consulta o, sin ella, el registro). `citaPendiente`: la cita ya agendada, si hay.
export function CicloControl({ ciclo, inicio, controlISO, citaPendiente, promedioMeses, onAbrir, onAgendar }) {
  const dias = ciclo ? Math.abs(ciclo.diasParaControl) : 0
  const abrir = !ciclo || citaPendiente || !onAgendar ? onAbrir : onAgendar
  return (
    <section aria-label="Su ciclo de control" data-resumen={abrir ? "" : undefined} className={CARTA}>
      {abrir && <button type="button" onClick={abrir} aria-haspopup="dialog" aria-label={citaPendiente ? "Su ciclo de control. Ver su cita agendada" : ciclo ? "Su ciclo de control. Agendar su control" : "Su ciclo de control. Ver su última consulta"} className="pt-abrir absolute inset-0 rounded-2xl cursor-pointer" />}
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-bold" style={{ color: INK }}>Su ciclo de control</h2>
        {abrir && <ChevronRight size={16} className="text-slate-400" aria-hidden="true" />}
      </div>
      {ciclo ? (
        <>
          <p className="mt-2 flex flex-wrap items-baseline gap-x-2 text-sm text-slate-500">
            {ciclo.vencido
              ? <><span className="font-serif text-[30px] font-bold leading-none text-red-700">{dias} {plural(dias, "día", "días")}</span> de retraso en su control</>
              : <><span className="font-serif text-[30px] font-bold leading-none" style={{ color: INK }}>{dias} {plural(dias, "día", "días")}</span> para su próximo control</>}
          </p>
          {/* «Hoy» va arriba de la barra, sobre su marca; las dos fechas, debajo y en los extremos (nunca en la misma línea que «Hoy»), así no se encimen esté donde esté la marca. */}
          <div className="relative mt-3 h-5">
            <span aria-hidden="true" className="absolute bottom-0 -translate-x-1/2 whitespace-nowrap text-sm font-semibold text-slate-700" style={{ left: `${ciclo.avance}%` }}>Hoy</span>
          </div>
          <div role="progressbar" aria-label="Dónde está hoy entre su última consulta y su control" aria-valuemin={0} aria-valuemax={100} aria-valuenow={ciclo.avance} className="relative h-2.5 rounded-full bg-slate-100">
            <div className={"h-full rounded-full " + (ciclo.vencido ? "bg-red-600" : "bg-blue-600")} style={{ width: `${ciclo.avance}%` }} />
            <div aria-hidden="true" className="absolute -top-1 w-0.5 rounded-full bg-slate-900" style={{ left: `calc(${ciclo.avance}% - 1px)`, height: "1.125rem" }} />
          </div>
          <div className="mt-1.5 flex flex-wrap justify-between gap-x-4 gap-y-0.5 text-sm text-slate-500">
            <span className="min-w-0">{inicio.etiqueta} · {fechaLegible(inicio.fecha)}</span>
            <span className="min-w-0 text-right">Control · {fechaLegible(controlISO)}</span>
          </div>
          <p className="mt-2 text-sm leading-snug text-slate-500">
            {promedioMeses ? `Viene en promedio cada ${promedioMeses} ${plural(promedioMeses, "mes", "meses")} · ` : ""}
            {citaPendiente ? `ya tiene cita agendada el ${fechaLegible(citaPendiente.fecha)}` : "aún sin cita agendada"}
            {!citaPendiente && onAgendar && <> · <button type="button" onClick={onAgendar} aria-haspopup="dialog" className="font-semibold text-blue-600 transition-colors hover:text-blue-700 hover:underline cursor-pointer">Agendar control</button></>}
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 font-serif text-[26px] font-bold leading-tight" style={{ color: INK }}>Sin control recomendado</p>
          <p className="mt-1 text-sm text-slate-500">{inicio.fecha ? `${inicio.etiqueta} · ${fechaLegible(inicio.fecha)}` : "Todavía no tiene consultas"}</p>
        </>
      )}
    </section>
  )
}
