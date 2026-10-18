"use client"

import { Fragment, useState } from "react"
import { Glasses, Download, FileText, CheckCircle2, Info, ChevronRight } from "lucide-react"
import { formatoFecha, nombreMes } from "../../utilidades/formatoFecha"
import { AYUDA_RECETA, resumenCambioGraduacion } from "../../utilidades/portalPaciente"
import { serieDeGraduacion, valorD } from "../../utilidades/portalVistas"
import { descargarPdfReceta } from "../../utilidades/recetaPdf"
import { Cascaron } from "../AtencionPaciente"
import { Tarjeta, TituloTarjeta, TituloPagina, Esqueleto, Circulo } from "./piezas"
import GraficaGraduacion from "./GraficaGraduacion"
import { BOTON_PRINCIPAL, BOTON_SECUNDARIO, ESTILO_PRINCIPAL } from "./estilos"

const agudeza = (o = {}) => o.avCc || o.avSc || ""
const textoAgudeza = (o = {}) => (o.avCc || !o.avSc ? "Agudeza con lentes" : "Agudeza sin lentes")

// La tabla de la receta de una receta anterior (en la ventana de detalle): una fila por dato, con «Ojo derecho» y «Ojo izquierdo» en columnas. Tocar una fila explica el dato.
function TablaReceta({ receta }) {
  const [abierta, setAbierta] = useState("")
  const filas = [
    ["esfera", "Esfera", valorD(receta.od?.esfera), valorD(receta.oi?.esfera)],
    ["cilindro", "Cilindro", valorD(receta.od?.cilindro), valorD(receta.oi?.cilindro)],
    ["eje", "Eje", receta.od?.eje ? `${receta.od.eje}°` : "", receta.oi?.eje ? `${receta.oi.eje}°` : ""],
    ["adicion", "Adición", valorD(receta.medidas?.adicion), null],
    ["agudeza", "Agudeza visual", agudeza(receta.od), agudeza(receta.oi)],
  ].filter(([clave, , od]) => clave !== "adicion" || od)
  return (
    <div role="table" aria-label="Tu receta" className="overflow-hidden rounded-2xl border border-pt-borde">
      <div role="row" className="grid grid-cols-[minmax(5.5rem,0.9fr)_1fr_1fr] items-end gap-2 bg-pt-fondo px-4 py-3 sm:px-5">
        <span role="columnheader"><span className="sr-only">Dato</span></span>
        <span role="columnheader" className="text-lg font-bold text-pt-azul">Ojo derecho</span>
        <span role="columnheader" className="text-lg font-bold text-pt-ambar">Ojo izquierdo</span>
      </div>
      {filas.map(([clave, etiqueta, od, oi]) => (
        <div key={clave} role="row" className="border-t border-pt-borde">
          <button type="button" onClick={() => setAbierta((a) => (a === clave ? "" : clave))} aria-expanded={abierta === clave} aria-label={`${etiqueta}: ${clave === "adicion" ? od : `ojo derecho ${od || "sin dato"}, ojo izquierdo ${oi || "sin dato"}`}. Toca para saber qué significa`}
            title={AYUDA_RECETA[clave]} className="grid min-h-16 w-full grid-cols-[minmax(5.5rem,0.9fr)_1fr_1fr] items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-pt-fondo cursor-pointer sm:px-5">
            <span role="rowheader" className="flex items-center gap-1.5 text-lg text-pt-texto">{etiqueta}<Info size={18} className="shrink-0 text-slate-400" aria-hidden="true" /></span>
            {clave === "adicion"
              ? <span role="cell" className="col-span-2 font-heading text-2xl font-bold tabular-nums text-pt-marino">{od}</span>
              : <><span role="cell" className="font-heading text-2xl font-bold tabular-nums text-pt-marino">{od || "—"}</span><span role="cell" className="font-heading text-2xl font-bold tabular-nums text-pt-marino">{oi || "—"}</span></>}
          </button>
          {abierta === clave && <p role="note" className="bg-pt-fondo px-4 py-3 text-lg text-slate-700 sm:px-5">{AYUDA_RECETA[clave]}</p>}
        </div>
      ))}
    </div>
  )
}

const Dato = ({ titulo, children }) => <div><p className="text-base font-semibold text-pt-texto">{titulo}</p><p className="text-lg text-slate-800">{children}</p></div>

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

// Un ojo de la receta vigente: el círculo con la esfera en grande y, al lado (o debajo en el celular), cilindro, eje, adición y agudeza.
function OjoReceta({ titulo, ojo = {}, adicion }) {
  const filas = [["Cilindro", valorD(ojo.cilindro)], ["Eje", ojo.eje ? `${ojo.eje}°` : ""], ["Adición", valorD(adicion)], [textoAgudeza(ojo), agudeza(ojo)]].filter(([, v]) => v)
  return (
    <div className="flex min-w-0 flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-7">
      <Circulo className="h-[168px] w-[168px] border-[12px] sm:h-[200px] sm:w-[200px] sm:border-[14px]">
        <span className="text-base text-pt-texto">{titulo}</span>
        <span className="font-heading text-[40px] font-bold leading-tight tabular-nums text-pt-marino sm:text-[44px]">{valorD(ojo.esfera) || "—"}</span>
        <span className="text-base text-pt-texto">esfera</span>
      </Circulo>
      <dl className="grid w-full min-w-0 grid-cols-[max-content_1fr] items-baseline gap-x-8 gap-y-2.5 text-base sm:w-auto sm:flex-1">
        {filas.map(([etiqueta, valor]) => <Fragment key={etiqueta}><dt className="text-pt-texto">{etiqueta}</dt><dd className="text-right font-bold tabular-nums text-pt-marino sm:text-left">{valor}</dd></Fragment>)}
        {filas.length === 0 && <dd className="col-span-2 text-pt-texto">Sin más datos en este ojo.</dd>}
      </dl>
    </div>
  )
}

const Significado = ({ titulo, children }) => (
  <li className="rounded-2xl border border-pt-borde bg-white p-5">
    <h3 className="text-base font-bold text-pt-marino">{titulo}</h3>
    <p className="mt-2 text-base leading-relaxed text-pt-texto">{children}</p>
  </li>
)

// Las indicaciones del optómetra en viñetas: una por línea o por frase.
const viñetas = (texto = "") => texto.split(/\n+|(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ])/).map((s) => s.trim()).filter(Boolean)

// Mi receta (diseño aprobado): la receta vigente con un círculo por ojo y sus datos, «Qué significa cada valor» en cuatro tarjetas, cómo cambió la graduación (frase y gráfica), lo que
// indicó el optómetra y las recetas anteriores. «Descargar receta» baja el PDF.
export default function MiRecetaPortal({ cargando, ultimaReceta, recetasAnteriores, todasLasRecetas = [], recetaAbierta, onAbrirReceta, usuario, nombreOptica, mostrarMedidas, control, medidasSolicitadas, enviandoMedidas, errorMedidas, onSolicitarMedidas, onAgendar }) {
  if (cargando) return <div className="space-y-6" aria-busy="true" aria-label="Cargando tu receta"><TituloPagina>Mi receta</TituloPagina><Esqueleto alto="h-80" /></div>
  const descargar = (r) => descargarPdfReceta({ optica: nombreOptica, paciente: usuario, receta: r, mostrarMedidas })
  const cambio = resumenCambioGraduacion(todasLasRecetas)
  const puntos = serieDeGraduacion(todasLasRecetas)
  const abierta = todasLasRecetas.find((r) => r.id === recetaAbierta)

  if (!ultimaReceta) {
    return (
      <div className="space-y-5 sm:space-y-6">
        <TituloPagina subtitulo="Tu graduación actual y lo que indicó tu optómetra.">Mi receta</TituloPagina>
        <div className="flex flex-col items-center gap-3 rounded-[20px] border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-pt-fondo text-slate-400"><FileText size={26} aria-hidden="true" /></div>
          <p className="text-xl font-semibold text-slate-700">Todavía no tienes una receta</p>
          <p className="max-w-md text-lg text-pt-texto">Aparece aquí después de tu primer examen visual.</p>
          <button type="button" onClick={() => onAgendar()} className={BOTON_PRINCIPAL + " mt-1"} style={ESTILO_PRINCIPAL}>Agendar cita</button>
        </div>
      </div>
    )
  }
  const m = ultimaReceta.medidas || {}
  const hayCilindro = Boolean(ultimaReceta.od?.cilindro || ultimaReceta.oi?.cilindro)
  const esferaNegativa = parseFloat(String(ultimaReceta.od?.esfera ?? ultimaReceta.oi?.esfera ?? "").replace(",", ".")) < 0
  const lentes = `${ultimaReceta.lenteRecomendado || ""}`
  const indicaciones = viñetas(ultimaReceta.indicaciones)
  if (control && !control.vencido && !indicaciones.some((i) => /control/i.test(i))) indicaciones.push(`Vuelve a tu control en ${nombreMes(Number(control.iso.slice(5, 7)) - 1)} de ${control.iso.slice(0, 4)}.`)
  const subtitulo = `Vigente desde el ${formatoFecha(ultimaReceta.fecha, "largoSinDia")}${ultimaReceta.profesionalNombre ? ` · ${ultimaReceta.profesionalNombre}, optómetra` : ""}`
  return (
    <div className="space-y-5 sm:space-y-6">
      <TituloPagina subtitulo={subtitulo} accion={<button type="button" onClick={() => descargar(ultimaReceta)} className={BOTON_PRINCIPAL + " w-full sm:w-auto"} style={ESTILO_PRINCIPAL}><Download size={20} aria-hidden="true" /> Descargar receta</button>}>Mi receta</TituloPagina>

      <Tarjeta aria-label="Tu receta vigente" className="sm:px-[38px] sm:py-8">
        <div className="grid gap-x-10 gap-y-8 min-[900px]:grid-cols-2">
          <OjoReceta titulo="Ojo derecho" ojo={ultimaReceta.od} adicion={m.adicion} />
          <OjoReceta titulo="Ojo izquierdo" ojo={ultimaReceta.oi} adicion={m.adicion} />
        </div>
      </Tarjeta>

      <section aria-labelledby="significado" className="space-y-4">
        <h2 id="significado" className="font-heading text-xl font-bold text-pt-marino">Qué significa cada valor</h2>
        <ul className="pt-fila pt-fila--cuatro">
          <Significado titulo="Esfera">Cuánto necesitas para ver bien. {esferaNegativa ? "Si es negativa, ves mal de lejos (miopía)." : "Si es positiva, te cuesta ver de cerca."}</Significado>
          {hayCilindro && <Significado titulo="Cilindro y eje">Corrigen el astigmatismo: que las cosas se vean un poco estiradas o borrosas.</Significado>}
          {m.adicion && <Significado titulo="Adición">La ayuda extra para leer de cerca.{/progres/i.test(lentes) ? " Por eso tus lentes son progresivos." : /bifocal/i.test(lentes) ? " Por eso tus lentes son bifocales." : ""}</Significado>}
          <Significado titulo="Agudeza">Qué tan bien ves con tus lentes. 20/20 es una visión completa.</Significado>
        </ul>
      </section>

      <div className="pt-fila pt-fila--7-5 pt-fila--arriba">
        {todasLasRecetas.length > 1 ? (
          <Tarjeta aria-labelledby="cambio">
            <TituloTarjeta id="cambio">Cómo cambió tu graduación</TituloTarjeta>
            {cambio && <p className="mt-4 text-base leading-relaxed text-pt-marino">{cambio.frase}</p>}
            <div className="mt-5"><GraficaGraduacion puntos={puntos} /></div>
          </Tarjeta>
        ) : <span />}
        <div className="space-y-5 sm:space-y-6">
          {indicaciones.length > 0 && (
            <Tarjeta aria-labelledby="indicaciones">
              <TituloTarjeta id="indicaciones">Lo que te indicó tu optómetra</TituloTarjeta>
              <ul className="mt-4 list-disc space-y-2.5 pl-5 text-base leading-relaxed text-pt-marino marker:text-pt-marino">{indicaciones.map((i) => <li key={i}>{i}</li>)}</ul>
            </Tarjeta>
          )}
          {recetasAnteriores.length > 0 && (
            <Tarjeta aria-labelledby="anteriores">
              <TituloTarjeta id="anteriores">Recetas anteriores</TituloTarjeta>
              <ul className="mt-3 divide-y divide-pt-borde">
                {recetasAnteriores.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => onAbrirReceta(c.id)} aria-label={`Ver la receta del ${formatoFecha(c.fecha, "medio")}`} className="flex min-h-16 w-full items-center gap-3 py-3 text-left transition-colors hover:bg-pt-fondo cursor-pointer">
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-semibold leading-snug text-pt-marino">{formatoFecha(c.fecha, "largoSinDia")}</span>
                        <span className="block text-base text-pt-texto">{[valorD(c.od?.esfera), valorD(c.oi?.esfera)].filter(Boolean).join(" · ") || "Consulta registrada"}</span>
                      </span>
                      <ChevronRight size={22} className="shrink-0 text-slate-500" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </Tarjeta>
          )}
          {mostrarMedidas ? (
            (m.dp || m.alt) && (
              <Tarjeta aria-labelledby="medidas">
                <TituloTarjeta id="medidas">Medidas para tus lentes</TituloTarjeta>
                <dl className="mt-3 grid grid-cols-2 gap-3">
                  {m.dp && <div><dt className="text-base text-pt-texto">Distancia pupilar</dt><dd className="font-heading text-2xl font-bold tabular-nums text-pt-marino">{m.dp}</dd></div>}
                  {m.alt && <div><dt className="text-base text-pt-texto">Altura</dt><dd className="font-heading text-2xl font-bold tabular-nums text-pt-marino">{m.alt}</dd></div>}
                </dl>
              </Tarjeta>
            )
          ) : (
            <Tarjeta aria-labelledby="medidas">
              <TituloTarjeta id="medidas">Medidas para tus lentes</TituloTarjeta>
              <p className="mt-3 text-base text-pt-texto">La distancia pupilar y las medidas de montaje las toma la óptica al armar tus lentes. Puedes solicitarlas aquí.</p>
              {errorMedidas && <p role="alert" className="mt-2 text-lg font-semibold text-red-600">{errorMedidas}</p>}
              {medidasSolicitadas
                ? <span className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#E3F4EA] px-4 text-lg font-semibold text-[#166534]"><CheckCircle2 size={20} aria-hidden="true" /> Solicitud enviada</span>
                : <button type="button" onClick={onSolicitarMedidas} disabled={enviandoMedidas} className={BOTON_SECUNDARIO + " mt-3 w-full"}>{enviandoMedidas ? "Enviando..." : "Solicitar distancia pupilar y medidas de montaje"}</button>}
            </Tarjeta>
          )}
        </div>
      </div>
      {abierta && <DetalleReceta receta={abierta} onCerrar={() => onAbrirReceta(null)} onDescargar={() => descargar(abierta)} />}
    </div>
  )
}
