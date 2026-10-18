"use client"

import { useState } from "react"
import { ChevronRight, FileText, UserRound, Stethoscope } from "lucide-react"
import { formatoFecha } from "../../utilidades/formatoFecha"
import { agruparPorAnio } from "../../utilidades/portalVistas"
import { NOTA_ESTADO_CITA } from "../../utilidades/portalPaciente"
import { Cascaron } from "../AtencionPaciente"
import { Tarjeta, TituloTarjeta, TituloPagina, FilaCita, Esqueleto, EstadoCita, Estrellas } from "./piezas"
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
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2"><EstadoCita estado={cita.estado} confirmada={Boolean(detalle?.confirmadaAt)} /><span className="text-lg text-pt-texto">{NOTA_ESTADO_CITA[cita.estado]}</span></div>
        <dl className="space-y-3 text-lg">
          <div><dt className="text-base font-semibold text-pt-texto">Motivo</dt><dd className="text-slate-800">{cita.motivo || "Consulta"}</dd></div>
          {detalle?.profesional && <div><dt className="text-base font-semibold text-pt-texto">{cita.estado === "Atendida" ? "Te atendió" : "Profesional"}</dt><dd className="flex items-center gap-2 text-slate-800"><UserRound size={20} className="text-slate-500" aria-hidden="true" /> {detalle.profesional}</dd></div>}
        </dl>
        {detalle?.consultaId && (
          <button type="button" onClick={() => onVerReceta(detalle.consultaId)} className={BOTON_SECUNDARIO + " w-full"}><FileText size={20} aria-hidden="true" /> Ver la receta de esta cita</button>
        )}
        {cita.estado === "Atendida" && detalleDisponible && (
          <section aria-label="¿Cómo te atendimos?" className="rounded-2xl bg-pt-fondo p-4">
            <h3 className="font-heading text-lg font-bold text-pt-marino">¿Cómo te atendimos?</h3>
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
                <p className="text-base text-pt-texto">Puedes calificar cada cita una sola vez.</p>
              </div>
            )}
          </section>
        )}
      </div>
    </Cascaron>
  )
}

// Mis citas (diseño aprobado): la próxima en estilo boleto, y «Tus visitas anteriores» agrupadas por año (cada fila abre su detalle) con los mismos estados y colores del módulo de Citas.
export default function MisCitasPortal({ cargando, proximas, historial, citaProps, onAgendar, detalle, direccion, onConfirmar, onIcs, onVerReceta, onCalificar, recetaActualId = null, primeraRecetaId = null }) {
  const [vistas, setVistas] = useState(DE_A)
  const [abierta, setAbierta] = useState(null)
  if (cargando) return <div className="space-y-6" aria-busy="true" aria-label="Cargando tus citas"><TituloPagina>Mis citas</TituloPagina><Esqueleto alto="h-64" /></div>
  const grupos = agruparPorAnio(historial.slice(0, vistas))
  const det = (id) => detalle.porCita[id]
  // Lo que se lee bajo el motivo de una visita pasada: con quién y qué pasó.
  const resumenVisita = (c) => {
    const d = det(c.id)
    const quien = d?.profesional || ""
    if (c.estado === "No Asistió") return "No pudiste venir"
    if (c.estado === "Cancelada") return "Cancelaste esta cita"
    if (c.estado !== "Atendida") return quien
    if (detalle.disponible && !d?.calificacion) return null
    const receta = d?.consultaId ? (d.consultaId === recetaActualId ? "salió tu receta actual" : d.consultaId === primeraRecetaId ? "tu primera receta" : "con receta") : ""
    return [quien, receta].filter(Boolean).join(" · ")
  }
  return (
    <div className="space-y-5 sm:space-y-6">
      <TituloPagina subtitulo="Tu próxima visita y todas las anteriores" accion={<button type="button" onClick={() => onAgendar()} className={BOTON_PRINCIPAL + " w-full sm:w-auto"} style={ESTILO_PRINCIPAL}>Agendar cita</button>}>Mis citas</TituloPagina>

      <BoletoCita variante="citas" conBoton={false} cita={proximas[0] || null} detalle={det(proximas[0]?.id)} detalleDisponible={detalle.disponible} direccion={direccion} citaProps={citaProps} onConfirmar={onConfirmar} onIcs={onIcs} onAgendar={onAgendar} />

      {proximas.length > 1 && (
        <Tarjeta aria-labelledby="proximas">
          <TituloTarjeta id="proximas">Otras citas próximas</TituloTarjeta>
          <ul className="mt-2 divide-y divide-pt-borde [&>li:last-child]:pb-0">{proximas.slice(1).map((c) => <FilaCita key={c.id} cita={c} {...citaProps} />)}</ul>
        </Tarjeta>
      )}

      <Tarjeta aria-labelledby="historial" className="sm:px-[30px] sm:py-7">
        <TituloTarjeta id="historial">Tus visitas anteriores</TituloTarjeta>
        {historial.length === 0 ? (
          <p className="mt-3 text-base text-pt-texto">Aquí aparecen tus citas atendidas, las que no asististe y las canceladas.</p>
        ) : (
          <div className="mt-4 space-y-5">
            {grupos.map((g) => (
              <div key={g.anio}>
                <h3 className="mb-1 text-base font-medium text-pt-texto">{g.anio}</h3>
                <ul className="divide-y divide-pt-borde">
                  {g.citas.map((c) => {
                    const d = det(c.id)
                    const resumen = resumenVisita(c)
                    return (
                      <li key={c.id} className="relative grid grid-cols-1 items-center gap-y-1 py-4 transition-colors hover:bg-pt-fondo/60 sm:grid-cols-[137px_minmax(0,1fr)_auto_auto] sm:gap-x-0">
                        <div className="flex items-baseline gap-2 sm:block">
                          <p className="text-base font-semibold leading-snug text-pt-marino">{formatoFecha(c.fecha, "medioSinAnio")}</p>
                          <p className="text-base leading-snug text-pt-texto">{c.hora}</p>
                        </div>
                        <div className="min-w-0 sm:pr-4">
                          <button type="button" onClick={() => setAbierta(c)} aria-label={`Ver el detalle de tu cita del ${formatoFecha(c.fecha, "medio")}`} className="-my-3 block max-w-full py-3 text-left text-base font-semibold leading-snug text-pt-marino cursor-pointer after:absolute after:inset-0 after:content-['']">{c.motivo || "Consulta"}</button>
                          <p className="text-base leading-snug text-pt-texto">
                            {resumen === null
                              ? <>{[d?.profesional, "¿Cómo te atendimos?"].filter(Boolean).join(" · ")} <button type="button" onClick={() => setAbierta(c)} className="relative z-10 -my-3 inline-flex items-center py-3 font-semibold text-pt-azul hover:underline cursor-pointer">Calificar</button></>
                              : resumen}
                          </p>
                        </div>
                        <span className="mt-1 justify-self-start sm:mt-0 sm:justify-self-end"><EstadoCita estado={c.estado} confirmada={false} /></span>
                        <ChevronRight size={22} className="hidden text-slate-500 sm:ml-5 sm:block" aria-hidden="true" />
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
            {historial.length > vistas && <button type="button" onClick={() => setVistas((v) => v + DE_A)} className={BOTON_SECUNDARIO + " w-full sm:w-auto"}>Ver {Math.min(DE_A, historial.length - vistas)} más · quedan {historial.length - vistas}</button>}
          </div>
        )}
      </Tarjeta>

      {abierta && <DetalleCita cita={abierta} detalle={det(abierta.id)} detalleDisponible={detalle.disponible} onCerrar={() => setAbierta(null)} onVerReceta={(id) => { setAbierta(null); onVerReceta(id) }} onCalificar={onCalificar} />}
    </div>
  )
}
