"use client"

import { useState } from "react"
import { CalendarDays, CalendarPlus, History, ChevronRight, FileText, UserRound, Stethoscope } from "lucide-react"
import { INK } from "@/lib/tema"
import { formatoFecha } from "../../utilidades/formatoFecha"
import { agruparPorAnio } from "../../utilidades/portalVistas"
import { NOTA_ESTADO_CITA } from "../../utilidades/portalPaciente"
import { Cascaron } from "../AtencionPaciente"
import { Bloque, TituloPagina, FilaCita, Esqueleto, EstadoCita, Estrellas } from "./piezas"
import BoletoCita from "./BoletoCita"
import { BOTON_PRINCIPAL, BOTON_SECUNDARIO, ESTILO_PRINCIPAL } from "./estilos"

const DE_A = 12

// El detalle de una cita pasada: qué se hizo, quién atendió, el enlace a la receta que salió de ella y, si fue atendida, «¿Cómo te atendimos?» (una sola vez por cita).
function DetalleCita({ cita, detalle, detalleDisponible, onCerrar, onVerReceta, onCalificar }) {
  const [puntaje, setPuntaje] = useState(0)
  const [comentario, setComentario] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState("")
  const cal = detalle?.calificacion
  const enviar = async () => {
    if (!puntaje) { setError("Elige de 1 a 5 estrellas."); return }
    setEnviando(true); setError("")
    const r = await onCalificar(cita.id, puntaje, comentario.trim())
    setEnviando(false)
    if (!r.ok) setError(r.error)
  }
  return (
    <Cascaron pantallaCompletaEnCelular titulo="Tu cita" subtitulo={formatoFecha(cita.fecha, "largo") + " · " + cita.hora} Icono={Stethoscope} ancho="max-w-xl" onCerrar={onCerrar}
      pie={<><span /><button type="button" onClick={onCerrar} className={BOTON_SECUNDARIO}>Cerrar</button></>}>
      <div className="space-y-5 p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2"><EstadoCita estado={cita.estado} /><span className="text-lg text-slate-700">{NOTA_ESTADO_CITA[cita.estado]}</span></div>
        <dl className="space-y-3 text-lg">
          <div><dt className="text-base font-semibold text-slate-600">Motivo</dt><dd className="text-slate-800">{cita.motivo || "Consulta"}</dd></div>
          {detalle?.profesional && <div><dt className="text-base font-semibold text-slate-600">{cita.estado === "Atendida" ? "Te atendió" : "Profesional"}</dt><dd className="flex items-center gap-2 text-slate-800"><UserRound size={20} className="text-slate-500" aria-hidden="true" /> {detalle.profesional}</dd></div>}
        </dl>
        {detalle?.consultaId && (
          <button type="button" onClick={() => onVerReceta(detalle.consultaId)} className={BOTON_SECUNDARIO + " w-full"}><FileText size={20} aria-hidden="true" /> Ver la receta de esta cita</button>
        )}
        {cita.estado === "Atendida" && detalleDisponible && (
          <section aria-label="¿Cómo te atendimos?" className="rounded-2xl bg-slate-50 p-4">
            <h3 className="text-lg font-bold" style={{ color: INK }}>¿Cómo te atendimos?</h3>
            {cal ? (
              <div className="mt-2">
                <Estrellas valor={cal.puntaje} etiqueta="Tu calificación" />
                <p className="text-lg text-slate-700">Gracias: calificaste esta atención con {cal.puntaje} de 5.{cal.comentario ? ` «${cal.comentario}»` : ""}</p>
              </div>
            ) : (
              <div className="mt-2 space-y-3">
                <Estrellas valor={puntaje} onCambiar={setPuntaje} />
                <label className="block text-base font-semibold text-slate-700">Un comentario (opcional)
                  <textarea rows={3} maxLength={500} value={comentario} onChange={(e) => setComentario(e.target.value)} className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-normal text-slate-800 outline-none transition focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100" />
                </label>
                {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-base font-medium text-red-700">{error}</p>}
                <button type="button" onClick={enviar} disabled={enviando} className={BOTON_PRINCIPAL + " w-full sm:w-auto"} style={ESTILO_PRINCIPAL}>{enviando ? "Enviando…" : "Enviar mi calificación"}</button>
                <p className="text-base text-slate-600">Puedes calificar cada cita una sola vez.</p>
              </div>
            )}
          </section>
        )}
      </div>
    </Cascaron>
  )
}

// Mis citas: la próxima en estilo boleto, y el historial agrupado por año (cada fila abre su detalle) con los mismos estados y colores del módulo de Citas.
export default function MisCitasPortal({ cargando, proximas, historial, citaProps, onAgendar, detalle, direccion, onConfirmar, onIcs, onVerReceta, onCalificar }) {
  const [vistas, setVistas] = useState(DE_A)
  const [abierta, setAbierta] = useState(null)
  if (cargando) return <div className="space-y-6" aria-busy="true" aria-label="Cargando tus citas"><TituloPagina>Mis citas</TituloPagina><Esqueleto alto="h-64" /></div>
  const grupos = agruparPorAnio(historial.slice(0, vistas))
  const det = (id) => detalle.porCita[id]
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <TituloPagina subtitulo="Tu próxima cita y todas las que ya pasaron.">Mis citas</TituloPagina>
        {proximas.length > 0 && <button type="button" onClick={() => onAgendar()} className={BOTON_PRINCIPAL + " w-full sm:w-auto"} style={ESTILO_PRINCIPAL}><CalendarPlus size={22} aria-hidden="true" /> Agendar cita</button>}
      </div>

      <BoletoCita cita={proximas[0] || null} detalle={det(proximas[0]?.id)} detalleDisponible={detalle.disponible} direccion={direccion} citaProps={citaProps} onConfirmar={onConfirmar} onIcs={onIcs} onAgendar={onAgendar} />

      {proximas.length > 1 && (
        <Bloque id="proximas" titulo="Otras citas próximas" Icono={CalendarDays} tono="azul">
          <ul className="divide-y divide-slate-100 [&>li:first-child]:pt-0 [&>li:last-child]:pb-0">{proximas.slice(1).map((c) => <FilaCita key={c.id} cita={c} {...citaProps} />)}</ul>
        </Bloque>
      )}

      <Bloque id="historial" titulo="Historial" Icono={History} tono="gris">
        {historial.length === 0 ? (
          <p className="text-lg text-slate-700">Aquí aparecen tus citas atendidas, las que no asististe y las canceladas.</p>
        ) : (
          <div className="space-y-6">
            {grupos.map((g) => (
              <div key={g.anio}>
                <h3 className="mb-1 text-lg font-bold text-slate-500">{g.anio}</h3>
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200/70">
                  {g.citas.map((c) => (
                    <li key={c.id}>
                      <button type="button" onClick={() => setAbierta(c)} aria-label={`Ver el detalle de tu cita del ${formatoFecha(c.fecha, "medio")}`} className="grid w-full min-h-16 grid-cols-1 items-center gap-x-4 gap-y-1 px-4 py-3 text-left transition-colors hover:bg-slate-50 cursor-pointer sm:grid-cols-[9rem_minmax(0,1fr)_auto_auto]">
                        <span className="text-lg font-bold" style={{ color: INK }}>{formatoFecha(c.fecha, "medio")}</span>
                        <span className="min-w-0 text-lg text-slate-700">{c.motivo || "Consulta"}{det(c.id)?.profesional ? <span className="text-slate-500"> · {det(c.id).profesional}</span> : null}</span>
                        <span><EstadoCita estado={c.estado} /></span>
                        <ChevronRight size={22} className="hidden text-slate-400 sm:block" aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {historial.length > vistas && <button type="button" onClick={() => setVistas((v) => v + DE_A)} className={BOTON_SECUNDARIO + " w-full sm:w-auto"}>Ver {Math.min(DE_A, historial.length - vistas)} más · quedan {historial.length - vistas}</button>}
          </div>
        )}
      </Bloque>

      {abierta && <DetalleCita cita={abierta} detalle={det(abierta.id)} detalleDisponible={detalle.disponible} onCerrar={() => setAbierta(null)} onVerReceta={(id) => { setAbierta(null); onVerReceta(id) }} onCalificar={onCalificar} />}
    </div>
  )
}
