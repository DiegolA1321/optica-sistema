"use client"

import { FileText, CheckCircle2, Download } from "lucide-react"
import { formatoFecha, nombreMes } from "../../utilidades/formatoFecha"
import { Tarjeta, TituloTarjeta, TituloPagina, Esqueleto } from "./piezas"
import { GraduacionVigente, CambioGraduacion, ListaRecetas } from "../graduacion/Graduacion"
import { BOTON_PRINCIPAL, BOTON_SECUNDARIO, ESTILO_PRINCIPAL } from "./estilos"

// Las indicaciones del optómetra en viñetas: una por línea o por frase.
const viñetas = (texto = "") => texto.split(/\n+|(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ])/).map((s) => s.trim()).filter(Boolean)

// Mi receta (diseño aprobado): la receta vigente con un ojo ilustrado por ojo y la explicación de cada valor (la misma vista del perfil del paciente del personal, en palabras simples),
// cómo cambió desde el examen anterior, lo que indicó el optómetra y «Tus recetas» con filtros por año, el detalle de cada una y «Comparar dos recetas». «Descargar receta» abre la hoja de la receta.
export default function MiRecetaPortal({ cargando, ultimaReceta, todasLasRecetas = [], onAbrirReceta, mostrarMedidas, descargar, control, medidasSolicitadas, enviandoMedidas, errorMedidas, onSolicitarMedidas, onAgendar }) {
  if (cargando) return <div className="space-y-6" aria-busy="true" aria-label="Cargando tu receta"><TituloPagina>Mi receta</TituloPagina><Esqueleto alto="h-80" /></div>

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
  const indicaciones = viñetas(ultimaReceta.indicaciones)
  if (control && !control.vencido && !indicaciones.some((i) => /control/i.test(i))) indicaciones.push(`Tu próximo control: ${nombreMes(Number(control.iso.slice(5, 7)) - 1)} de ${control.iso.slice(0, 4)}.`)
  const lente = ultimaReceta.lenteRecomendado ? ultimaReceta.lenteRecomendado.charAt(0).toLowerCase() + ultimaReceta.lenteRecomendado.slice(1) : ""
  const subtitulo = [`Vigente desde el ${formatoFecha(ultimaReceta.fecha, "largoSinDia")}`, ultimaReceta.profesionalNombre && `${ultimaReceta.profesionalNombre}, optómetra`, lente && `Lente recomendado: ${lente}`].filter(Boolean).join(" · ")
  const hayCambio = todasLasRecetas.length > 1
  const medidas = mostrarMedidas
    ? (m.dp || m.alt) && (
      <Tarjeta aria-labelledby="medidas">
        <TituloTarjeta id="medidas">Medidas para tus lentes</TituloTarjeta>
        <dl className="mt-3 grid grid-cols-2 gap-3">
          {m.dp && <div><dt className="text-base text-pt-texto">Distancia pupilar</dt><dd className="font-heading text-2xl font-bold tabular-nums text-pt-marino">{m.dp}</dd></div>}
          {m.alt && <div><dt className="text-base text-pt-texto">Altura</dt><dd className="font-heading text-2xl font-bold tabular-nums text-pt-marino">{m.alt}</dd></div>}
        </dl>
      </Tarjeta>
    )
    : (
      <Tarjeta aria-labelledby="medidas">
        <TituloTarjeta id="medidas">Medidas para tus lentes</TituloTarjeta>
        <p className="mt-3 text-base text-pt-texto">La distancia pupilar y las medidas de montaje las toma la óptica al armar tus lentes. Puedes solicitarlas aquí.</p>
        {errorMedidas && <p role="alert" className="mt-2 text-lg font-semibold text-red-600">{errorMedidas}</p>}
        {medidasSolicitadas
          ? <span className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#E3F4EA] px-4 text-lg font-semibold text-[#166534]"><CheckCircle2 size={20} aria-hidden="true" /> Solicitud enviada</span>
          : <button type="button" onClick={onSolicitarMedidas} disabled={enviandoMedidas} className={BOTON_SECUNDARIO + " mt-3 w-full"}>{enviandoMedidas ? "Enviando..." : "Solicitar distancia pupilar y medidas de montaje"}</button>}
      </Tarjeta>
    )
  const izquierda = hayCambio || medidas
  return (
    <div className="space-y-5 sm:space-y-6">
      <TituloPagina subtitulo={subtitulo} accion={<button type="button" onClick={() => descargar(ultimaReceta)} className={BOTON_PRINCIPAL + " w-full sm:w-auto"} style={ESTILO_PRINCIPAL}><Download size={20} aria-hidden="true" /> Descargar receta</button>}>Mi receta</TituloPagina>

      <GraduacionVigente receta={ultimaReceta} version="paciente" />

      <div className={"pt-fila pt-fila--arriba " + (izquierda ? "pt-fila--7-5" : "pt-fila--solo")}>
        {izquierda && (
          <div className="space-y-5 sm:space-y-6">
            {hayCambio && <CambioGraduacion consultas={todasLasRecetas} version="paciente" />}
            {medidas}
          </div>
        )}
        <div className="space-y-5 sm:space-y-6">
          {indicaciones.length > 0 && (
            <Tarjeta aria-labelledby="indicaciones">
              <TituloTarjeta id="indicaciones">Lo que te indicó tu optómetra</TituloTarjeta>
              <ul className="mt-4 list-disc space-y-2.5 pl-5 text-base leading-relaxed text-pt-marino marker:text-pt-marino">{indicaciones.map((i) => <li key={i}>{i}</li>)}</ul>
            </Tarjeta>
          )}
          <ListaRecetas recetas={todasLasRecetas} version="paciente" onAbrir={onAbrirReceta} />
        </div>
      </div>
    </div>
  )
}
