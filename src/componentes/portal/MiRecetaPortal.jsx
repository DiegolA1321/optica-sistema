"use client"

import { FileText, CheckCircle2, Download } from "lucide-react"
import { formatoFecha, nombreMes } from "../../utilidades/formatoFecha"
import { Tarjeta, TituloTarjeta, TituloPagina, Esqueleto } from "./piezas"
import { VistaGraduacion } from "../graduacion/Graduacion"
import { BOTON_PRINCIPAL, BOTON_SECUNDARIO, ESTILO_PRINCIPAL } from "./estilos"

// Mi receta (diseño aprobado): la vista completa de la graduación (`VistaGraduacion`, la misma que usa la pestaña «Graduación» del perfil del paciente del personal) en palabras simples.
// Arriba, junto al título, el selector con la receta que se muestra (con todas las del paciente y el filtro por año), «Comparar dos recetas» y «Descargar receta»; al elegir otra receta
// cambia toda la página: los ojos, las explicaciones, el antes → ahora y las indicaciones. «Descargar receta» baja el PDF de la receta elegida.
export default function MiRecetaPortal({ cargando, ultimaReceta, todasLasRecetas = [], mostrarMedidas, descargar, control, medidasSolicitadas, enviandoMedidas, errorMedidas, onSolicitarMedidas, onAgendar }) {
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
  const subtitulo = (r) => {
    const lente = r.lenteRecomendado ? r.lenteRecomendado.charAt(0).toLowerCase() + r.lenteRecomendado.slice(1) : ""
    return [r.id === ultimaReceta.id && `Vigente desde el ${formatoFecha(r.fecha, "largoSinDia")}`, r.profesionalNombre && `${r.profesionalNombre}, optómetra`, lente && `Lente recomendado: ${lente}`].filter(Boolean).join(" · ")
  }
  const extra = control && !control.vencido ? [`Tu próximo control: ${nombreMes(Number(control.iso.slice(5, 7)) - 1)} de ${control.iso.slice(0, 4)}.`] : []
  // Medidas para los lentes: con la política encendida, las de la receta elegida; apagada, se pueden solicitar.
  const medidas = (r) => {
    const m = r.medidas || {}
    if (mostrarMedidas) {
      return (m.dp || m.alt) && (
        <Tarjeta aria-labelledby="medidas">
          <TituloTarjeta id="medidas">Medidas para tus lentes</TituloTarjeta>
          <dl className="mt-3 grid grid-cols-2 gap-3">
            {m.dp && <div><dt className="text-base text-pt-texto">Distancia pupilar</dt><dd className="font-heading text-2xl font-bold tabular-nums text-pt-marino">{m.dp}</dd></div>}
            {m.alt && <div><dt className="text-base text-pt-texto">Altura</dt><dd className="font-heading text-2xl font-bold tabular-nums text-pt-marino">{m.alt}</dd></div>}
          </dl>
        </Tarjeta>
      )
    }
    return (
      <Tarjeta aria-labelledby="medidas">
        <TituloTarjeta id="medidas">Medidas para tus lentes</TituloTarjeta>
        <p className="mt-3 text-base text-pt-texto">La distancia pupilar y las medidas de montaje las toma la óptica al armar tus lentes. Puedes solicitarlas aquí.</p>
        {errorMedidas && <p role="alert" className="mt-2 text-lg font-semibold text-red-600">{errorMedidas}</p>}
        {medidasSolicitadas
          ? <span className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#E3F4EA] px-4 text-lg font-semibold text-[#166534]"><CheckCircle2 size={20} aria-hidden="true" /> Solicitud enviada</span>
          : <button type="button" onClick={onSolicitarMedidas} disabled={enviandoMedidas} className={BOTON_SECUNDARIO + " mt-3 w-full"}>{enviandoMedidas ? "Enviando..." : "Solicitar distancia pupilar y medidas de montaje"}</button>}
      </Tarjeta>
    )
  }
  return (
    <VistaGraduacion recetas={todasLasRecetas} version="paciente" titulo="Mi receta" subtitulo={subtitulo} indicacionesExtra={extra} derecha={medidas}
      accion={{ texto: "Descargar receta", Icono: Download, onClick: descargar }} />
  )
}
