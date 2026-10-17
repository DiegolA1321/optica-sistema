"use client"

import { useState } from "react"
import { Glasses, Download, FileText, CheckCircle2, Info, TrendingUp, History, ClipboardList, Stethoscope, ChevronRight, Ruler } from "lucide-react"
import { INK } from "@/lib/tema"
import { formatoFecha } from "../../utilidades/formatoFecha"
import { AYUDA_RECETA, resumenCambioGraduacion } from "../../utilidades/portalPaciente"
import { serieDeGraduacion } from "../../utilidades/portalVistas"
import { textoGraduacionOjo } from "../../utilidades/recetaTexto"
import { descargarPdfReceta } from "../../utilidades/recetaPdf"
import { Cascaron } from "../AtencionPaciente"
import { Bloque, TituloPagina, Esqueleto } from "./piezas"
import GraficaGraduacion from "./GraficaGraduacion"
import { BOTON_PRINCIPAL, BOTON_SECUNDARIO, ESTILO_PRINCIPAL } from "./estilos"

// La tabla grande de la receta: una fila por dato, con «Ojo derecho» y «Ojo izquierdo» en columnas. Tocar una fila explica el dato en palabras simples.
function TablaReceta({ receta }) {
  const [abierta, setAbierta] = useState("")
  const filas = [
    ["esfera", "Esfera", receta.od?.esfera, receta.oi?.esfera],
    ["cilindro", "Cilindro", receta.od?.cilindro, receta.oi?.cilindro],
    ["eje", "Eje", receta.od?.eje ? `${receta.od.eje}°` : "", receta.oi?.eje ? `${receta.oi.eje}°` : ""],
    ["adicion", "Adición", receta.medidas?.adicion, null],
    ["agudeza", "Agudeza visual", receta.od?.avCc || receta.od?.avSc, receta.oi?.avCc || receta.oi?.avSc],
  ].filter(([clave, , od]) => clave !== "adicion" || od)
  return (
    <div role="table" aria-label="Tu receta" className="overflow-hidden rounded-2xl border border-slate-200/70">
      <div role="row" className="grid grid-cols-[minmax(6.5rem,1fr)_1fr_1fr] items-end gap-2 bg-slate-50 px-4 py-3 sm:px-5">
        <span role="columnheader"><span className="sr-only">Dato</span></span>
        <span role="columnheader" className="text-lg font-bold text-blue-700">Ojo derecho</span>
        <span role="columnheader" className="text-lg font-bold text-cyan-800">Ojo izquierdo</span>
      </div>
      {filas.map(([clave, etiqueta, od, oi]) => (
        <div key={clave} role="row" className="border-t border-slate-200/70">
          <button type="button" onClick={() => setAbierta((a) => (a === clave ? "" : clave))} aria-expanded={abierta === clave} aria-label={`${etiqueta}: ${clave === "adicion" ? od : `ojo derecho ${od || "sin dato"}, ojo izquierdo ${oi || "sin dato"}`}. Toca para saber qué significa`}
            title={AYUDA_RECETA[clave]} className="grid min-h-16 w-full grid-cols-[minmax(6.5rem,1fr)_1fr_1fr] items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-slate-50 cursor-pointer sm:px-5">
            <span role="rowheader" className="flex items-center gap-1.5 text-lg text-slate-600">{etiqueta}<Info size={18} className="shrink-0 text-slate-400" aria-hidden="true" /></span>
            {clave === "adicion"
              ? <span role="cell" className="col-span-2 font-heading text-3xl font-bold tabular-nums" style={{ color: INK }}>{od}</span>
              : <><span role="cell" className="font-heading text-3xl font-bold tabular-nums" style={{ color: INK }}>{od || "—"}</span><span role="cell" className="font-heading text-3xl font-bold tabular-nums" style={{ color: INK }}>{oi || "—"}</span></>}
          </button>
          {abierta === clave && <p role="note" className="bg-slate-50 px-4 py-3 text-lg text-slate-700 sm:px-5">{AYUDA_RECETA[clave]}</p>}
        </div>
      ))}
    </div>
  )
}

const Dato = ({ titulo, children }) => <div><p className="text-base font-semibold text-slate-600">{titulo}</p><p className="text-lg text-slate-800">{children}</p></div>

// El detalle de una receta anterior (o la de una cita), en la ventana estándar.
function DetalleReceta({ receta, onCerrar, onDescargar }) {
  return (
    <Cascaron pantallaCompletaEnCelular titulo={`Receta del ${formatoFecha(receta.fecha, "medio")}`} subtitulo={receta.profesionalNombre ? `Emitida por ${receta.profesionalNombre}` : "Tu receta"} Icono={Glasses} ancho="max-w-xl" onCerrar={onCerrar}
      pie={<><button type="button" onClick={onDescargar} className={BOTON_SECUNDARIO}><Download size={20} aria-hidden="true" /> Descargar receta</button><button type="button" onClick={onCerrar} className={BOTON_SECUNDARIO}>Cerrar</button></>}>
      <div className="space-y-4 p-5">
        <TablaReceta receta={receta} />
        {receta.lenteRecomendado && <Dato titulo="Lente recomendado">{receta.lenteRecomendado}</Dato>}
        {receta.diagnostico && <Dato titulo="Diagnóstico">{receta.diagnostico}</Dato>}
        {receta.indicaciones && <Dato titulo="Indicaciones de tu optómetra">{receta.indicaciones}</Dato>}
      </div>
    </Cascaron>
  )
}

// Mi receta: la receta vigente en una tarjeta principal con una tabla grande («Ojo derecho» y «Ojo izquierdo»), las indicaciones del optómetra, cómo cambió la graduación
// (gráfica y frases) y las recetas anteriores, cada una con su detalle. «Descargar receta» baja el PDF.
export default function MiRecetaPortal({ cargando, ultimaReceta, recetasAnteriores, todasLasRecetas = [], recetaAbierta, onAbrirReceta, usuario, nombreOptica, mostrarMedidas, medidasSolicitadas, enviandoMedidas, errorMedidas, onSolicitarMedidas, onAgendar }) {
  if (cargando) return <div className="space-y-6" aria-busy="true" aria-label="Cargando tu receta"><TituloPagina>Mi receta</TituloPagina><Esqueleto alto="h-80" /></div>
  const descargar = (r) => descargarPdfReceta({ optica: nombreOptica, paciente: usuario, receta: r, mostrarMedidas })
  const cambio = resumenCambioGraduacion(todasLasRecetas)
  const puntos = serieDeGraduacion(todasLasRecetas)
  const abierta = todasLasRecetas.find((r) => r.id === recetaAbierta)

  if (!ultimaReceta) {
    return (
      <div className="space-y-6">
        <TituloPagina subtitulo="Tu graduación actual y lo que indicó tu optómetra.">Mi receta</TituloPagina>
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-slate-50 text-slate-400"><FileText size={26} aria-hidden="true" /></div>
          <p className="text-xl font-semibold text-slate-700">Todavía no tienes una receta</p>
          <p className="max-w-md text-lg text-slate-600">Aparece aquí después de tu primer examen visual.</p>
          <button type="button" onClick={() => onAgendar()} className={BOTON_PRINCIPAL + " mt-1"} style={ESTILO_PRINCIPAL}>Agendar cita</button>
        </div>
      </div>
    )
  }
  const m = ultimaReceta.medidas || {}
  return (
    <div className="space-y-6">
      <TituloPagina subtitulo="Tu graduación actual y lo que indicó tu optómetra.">Mi receta</TituloPagina>

      <div className="pt-fila pt-fila--8-4">
        <Bloque id="receta" titulo="Tu receta vigente" Icono={Glasses} tono="rosa">
          <div className="mb-4 space-y-1 text-lg text-slate-700">
            <p><span className="font-semibold text-slate-900">{formatoFecha(ultimaReceta.fecha, "medio")}</span>{ultimaReceta.profesionalNombre ? ` · ${ultimaReceta.profesionalNombre}` : ""}{ultimaReceta.profesionalRegistro ? ` · Reg. Prof. ${ultimaReceta.profesionalRegistro}` : ""}</p>
            {ultimaReceta.lenteRecomendado && <p className="flex items-center gap-2"><Stethoscope size={20} className="shrink-0 text-slate-500" aria-hidden="true" /> Lente recomendado: <span className="font-semibold text-slate-900">{ultimaReceta.lenteRecomendado}</span></p>}
          </div>
          <TablaReceta receta={ultimaReceta} />
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-base text-slate-600">Toca cada fila para saber qué significa.</p>
            <button type="button" onClick={() => descargar(ultimaReceta)} className={BOTON_SECUNDARIO}><Download size={20} aria-hidden="true" /> Descargar receta</button>
          </div>
        </Bloque>

        <div className="space-y-6">
          {(ultimaReceta.indicaciones || ultimaReceta.diagnostico) && (
            <Bloque id="indicaciones" titulo="Indicaciones de tu optómetra" Icono={ClipboardList} tono="verde">
              {ultimaReceta.indicaciones && <p className="text-lg leading-relaxed text-slate-800">{ultimaReceta.indicaciones}</p>}
              {ultimaReceta.diagnostico && <p className="mt-3 text-lg text-slate-700"><span className="font-semibold">Diagnóstico:</span> {ultimaReceta.diagnostico}</p>}
            </Bloque>
          )}
          {mostrarMedidas ? (
            (m.dp || m.alt) && (
              <Bloque id="medidas" titulo="Medidas para tus lentes" Icono={Ruler} tono="gris">
                <dl className="grid grid-cols-2 gap-3">
                  {m.dp && <div><dt className="text-base text-slate-600">Distancia pupilar</dt><dd className="font-heading text-2xl font-bold tabular-nums" style={{ color: INK }}>{m.dp}</dd></div>}
                  {m.alt && <div><dt className="text-base text-slate-600">Altura</dt><dd className="font-heading text-2xl font-bold tabular-nums" style={{ color: INK }}>{m.alt}</dd></div>}
                </dl>
              </Bloque>
            )
          ) : (
            <Bloque id="medidas" titulo="Medidas para tus lentes" Icono={Ruler} tono="gris">
              <p className="text-lg text-slate-700">La distancia pupilar y las medidas de montaje las toma la óptica al armar tus lentes. Puedes solicitarlas aquí.</p>
              {errorMedidas && <p role="alert" className="mt-2 text-lg font-semibold text-red-600">{errorMedidas}</p>}
              {medidasSolicitadas
                ? <span className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-xl bg-emerald-50 px-4 text-lg font-semibold text-emerald-700"><CheckCircle2 size={20} aria-hidden="true" /> Solicitud enviada</span>
                : <button type="button" onClick={onSolicitarMedidas} disabled={enviandoMedidas} className={BOTON_SECUNDARIO + " mt-3 w-full"}>{enviandoMedidas ? "Enviando..." : "Solicitar distancia pupilar y medidas de montaje"}</button>}
            </Bloque>
          )}
        </div>
      </div>

      {todasLasRecetas.length > 1 && (
        <div className="pt-fila pt-fila--7-5 pt-fila--arriba">
          <Bloque id="cambio" titulo="Cómo cambió tu graduación" Icono={TrendingUp} tono="azul">
            {cambio && (
              <div className="mb-4 space-y-2">
                <p className="text-xl font-semibold leading-snug" style={{ color: INK }}>{cambio.frase}</p>
                <ul className="space-y-1 text-lg text-slate-700">{cambio.frases.map((f) => <li key={f}>{f}</li>)}</ul>
              </div>
            )}
            <GraficaGraduacion puntos={puntos} />
          </Bloque>
          <Bloque id="anteriores" titulo="Tus recetas anteriores" Icono={History} tono="gris">
            <ul className="divide-y divide-slate-100">
              {recetasAnteriores.map((c, i) => {
                const vs = resumenCambioGraduacion([c, todasLasRecetas[i + 2]].filter(Boolean))
                return (
                  <li key={c.id}>
                    <button type="button" onClick={() => onAbrirReceta(c.id)} aria-label={`Ver la receta del ${formatoFecha(c.fecha, "medio")}`} className="flex min-h-16 w-full items-center gap-3 py-3 text-left transition-colors hover:bg-slate-50 cursor-pointer">
                      <span className="min-w-0 flex-1">
                        <span className="block text-lg font-semibold text-slate-800">{formatoFecha(c.fecha, "medio")} · {c.diagnostico || "Consulta registrada"}</span>
                        <span className="block text-base text-slate-700">Ojo derecho {textoGraduacionOjo(c.od)}</span>
                        <span className="block text-base text-slate-700">Ojo izquierdo {textoGraduacionOjo(c.oi)}</span>
                        {vs && <span className="block text-base text-slate-600">{vs.verdicto === "Sin cambios" ? "Igual que en el examen anterior." : vs.verdicto === "Aumentó" ? "Aumentó respecto al examen anterior." : "Disminuyó respecto al examen anterior."}</span>}
                      </span>
                      <ChevronRight size={22} className="shrink-0 text-slate-400" aria-hidden="true" />
                    </button>
                  </li>
                )
              })}
            </ul>
          </Bloque>
        </div>
      )}
      {abierta && <DetalleReceta receta={abierta} onCerrar={() => onAbrirReceta(null)} onDescargar={() => descargar(abierta)} />}
    </div>
  )
}
