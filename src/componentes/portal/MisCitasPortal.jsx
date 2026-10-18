"use client"

import { useState } from "react"
import { ChevronRight, Search } from "lucide-react"
import { formatoFecha } from "../../utilidades/formatoFecha"
import { agruparPorAnio, filtrarVisitas } from "../../utilidades/portalVistas"
import CampoFecha from "../CampoFecha"
import { Tarjeta, TituloTarjeta, TituloPagina, FilaCita, Esqueleto, EstadoCita } from "./piezas"
import BoletoCita from "./BoletoCita"
import { BOTON_PRINCIPAL, BOTON_SECUNDARIO, ESTILO_PRINCIPAL } from "./estilos"

const DE_A = 10
const PERIODOS = [["ano", "Último año"], ["todas", "Todas"], ["fechas", "Elegir fechas"]]
const ESTADOS = [["Atendida", "Atendidas"], ["No Asistió", "No asistió"], ["Cancelada", "Canceladas"]]
const CHIP = (activo) => "inline-flex min-h-11 items-center rounded-full px-5 text-base font-semibold transition-colors cursor-pointer " + (activo ? "bg-pt-azul text-white" : "border border-pt-borde bg-white text-pt-marino hover:bg-pt-fondo")

// Mis citas (diseño aprobado): la próxima en estilo boleto, y «Tus visitas anteriores» agrupadas por año (cada fila abre su detalle) con los mismos estados y colores del módulo de Citas.
export default function MisCitasPortal({ cargando, proximas, historial, citaProps, onAgendar, detalle, direccion, onConfirmar, onAbrir, recetaActualId = null, primeraRecetaId = null }) {
  const [vistas, setVistas] = useState(DE_A)
  const [texto, setTexto] = useState("")
  const [periodo, setPeriodo] = useState("ano")
  const [desde, setDesde] = useState("")
  const [hasta, setHasta] = useState("")
  const [estado, setEstado] = useState("")
  const setAbierta = (c) => onAbrir({ tipo: "cita", id: c.id })
  if (cargando) return <div className="space-y-6" aria-busy="true" aria-label="Cargando tus citas"><TituloPagina>Mis citas</TituloPagina><Esqueleto alto="h-64" /></div>
  const det = (id) => detalle.porCita[id]
  const filtradas = filtrarVisitas(historial, { periodo, desde, hasta, estado, texto, profesional: (c) => det(c.id)?.profesional })
  const grupos = agruparPorAnio(filtradas.slice(0, vistas))
  const hayFiltros = texto.trim() !== "" || estado !== "" || periodo !== "ano"
  const quitarFiltros = () => { setTexto(""); setEstado(""); setPeriodo("ano"); setDesde(""); setHasta(""); setVistas(DE_A) }
  const cambiar = (poner) => (v) => { poner(v); setVistas(DE_A) }
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

      <BoletoCita variante="citas" conBoton={false} cita={proximas[0] || null} detalle={det(proximas[0]?.id)} detalleDisponible={detalle.disponible} direccion={direccion} citaProps={citaProps} onConfirmar={onConfirmar} onAbrir={setAbierta} onAgendar={onAgendar} />

      {proximas.length > 1 && (
        <Tarjeta aria-labelledby="proximas">
          <TituloTarjeta id="proximas">Otras citas próximas</TituloTarjeta>
          <ul className="mt-2 divide-y divide-pt-borde [&>li:last-child]:pb-0">{proximas.slice(1).map((c) => <FilaCita key={c.id} cita={c} onAbrir={setAbierta} {...citaProps} />)}</ul>
        </Tarjeta>
      )}

      <Tarjeta aria-labelledby="historial" className="sm:px-[30px] sm:py-7">
        <div className="flex items-baseline justify-between gap-3">
          <TituloTarjeta id="historial">Tus visitas anteriores</TituloTarjeta>
          {historial.length > 0 && <p className="text-base text-pt-texto" aria-live="polite">{filtradas.length} {filtradas.length === 1 ? "visita" : "visitas"}</p>}
        </div>
        {historial.length > 0 && (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
              <label className="relative block w-full @[900px]/portal:w-[20rem] @[900px]/portal:flex-none">
                <span className="sr-only">Buscar por motivo o profesional</span>
                <Search size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                <input type="search" value={texto} onChange={(e) => cambiar(setTexto)(e.target.value)} placeholder="Buscar por motivo o profesional" className="min-h-12 w-full rounded-xl border border-pt-borde bg-white pl-11 pr-3 text-base text-pt-marino outline-none transition-colors placeholder:text-slate-500 focus-visible:border-pt-azul focus-visible:ring-2 focus-visible:ring-blue-100" />
              </label>
              <div role="group" aria-label="Período" className="flex flex-wrap gap-2">
                {PERIODOS.map(([id, nombre]) => <button key={id} type="button" aria-pressed={periodo === id} onClick={() => cambiar(setPeriodo)(id)} className={CHIP(periodo === id)}>{nombre}</button>)}
              </div>
              <div role="group" aria-label="Estado" className="flex flex-wrap gap-2">
                {ESTADOS.map(([id, nombre]) => <button key={id} type="button" aria-pressed={estado === id} onClick={() => cambiar(setEstado)(estado === id ? "" : id)} className={CHIP(estado === id)}>{nombre}</button>)}
              </div>
            </div>
            {periodo === "fechas" && (
              <div className="grid max-w-xl gap-3 sm:grid-cols-2">
                <div><p className="mb-1 text-base font-semibold text-pt-marino">Desde</p><CampoFecha grande etiqueta="Desde" valor={desde} onCambiar={cambiar(setDesde)} max={hasta || undefined} placeholder="Primera fecha" /></div>
                <div><p className="mb-1 text-base font-semibold text-pt-marino">Hasta</p><CampoFecha grande etiqueta="Hasta" valor={hasta} onCambiar={cambiar(setHasta)} min={desde} placeholder="Última fecha" /></div>
              </div>
            )}
          </div>
        )}
        {historial.length === 0 ? (
          <p className="mt-3 text-base text-pt-texto">Aquí aparecen tus citas atendidas, las que no asististe y las canceladas.</p>
        ) : (
          <div className="mt-4 space-y-5">
            {filtradas.length === 0 && (
              <div role="status" className="rounded-2xl bg-pt-fondo px-5 py-6 text-center">
                <p className="text-lg font-semibold text-pt-marino">Ninguna visita coincide con lo que buscas.</p>
                {hayFiltros && <button type="button" onClick={quitarFiltros} className={BOTON_SECUNDARIO + " mt-3"}>Quitar los filtros</button>}
              </div>
            )}
            {grupos.map((g) => (
              <div key={g.anio}>
                <h3 className="mb-1 text-base font-medium text-pt-texto">{g.anio}</h3>
                <ul className="divide-y divide-pt-borde">
                  {g.citas.map((c) => {
                    const d = det(c.id)
                    const resumen = resumenVisita(c)
                    return (
                      <li key={c.id} className="pt-abrible relative grid grid-cols-1 pr-8 sm:pr-0 items-center gap-y-1 py-4 transition-colors hover:bg-pt-fondo/60 sm:grid-cols-[137px_minmax(0,1fr)_auto_auto] sm:gap-x-0">
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
                        <ChevronRight size={22} className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-500 sm:static sm:ml-5 sm:translate-y-0" aria-hidden="true" />
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
            {filtradas.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-base text-pt-texto">Mostrando {Math.min(vistas, filtradas.length)} de {filtradas.length}</p>
                {filtradas.length > vistas && <button type="button" onClick={() => setVistas((v) => v + DE_A)} className={BOTON_SECUNDARIO + " w-full sm:w-auto"}>Ver más visitas</button>}
              </div>
            )}
          </div>
        )}
      </Tarjeta>

    </div>
  )
}
