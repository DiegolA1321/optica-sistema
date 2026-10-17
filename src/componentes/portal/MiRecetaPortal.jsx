"use client"

import { useState } from "react"
import { Glasses, Download, FileText, Stethoscope, CheckCircle2, Info } from "lucide-react"
import { INK, GOLD } from "@/lib/tema"
import { formatoFecha } from "../../utilidades/formatoFecha"
import { textoGraduacionOjo } from "../../utilidades/recetaTexto"
import { AYUDA_RECETA } from "../../utilidades/portalPaciente"
import { descargarPdfReceta } from "../../utilidades/recetaPdf"
import { Bloque, TituloPagina, Esqueleto } from "./piezas"
import { BOTON_PRINCIPAL, BOTON_SECUNDARIO, ESTILO_PRINCIPAL } from "./estilos"

// Un dato de la receta con su explicación: al pasar el cursor se ve como ayuda, y al tocar el botón «?» se lee debajo (en el celular no hay cursor).
function Dato({ etiqueta, valor, ayuda, abierto, alAlternar }) {
  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between gap-3">
        <dt className="flex items-center gap-1 text-lg text-slate-600">
          {etiqueta}
          <button type="button" onClick={alAlternar} aria-expanded={abierto} aria-label={`¿Qué es ${etiqueta.toLowerCase()}?`} title={ayuda} className="grid h-11 w-11 place-items-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 cursor-pointer"><Info size={20} aria-hidden="true" /></button>
        </dt>
        <dd className="text-xl font-bold tabular-nums" style={{ color: INK }}>{valor || "—"}</dd>
      </div>
      {abierto && <p role="note" className="rounded-xl bg-slate-50 px-4 py-3 text-lg text-slate-700">{ayuda}</p>}
    </div>
  )
}

function TarjetaOjo({ titulo, ojo = {}, abierto, alternar }) {
  const dato = (clave, etiqueta, valor) => <Dato etiqueta={etiqueta} valor={valor} ayuda={AYUDA_RECETA[clave]} abierto={abierto === `${titulo}-${clave}`} alAlternar={() => alternar(`${titulo}-${clave}`)} />
  return (
    <div className="rounded-2xl border border-slate-200/60 bg-slate-50/60 p-4 sm:p-5">
      <h3 className="mb-1 text-xl font-bold" style={{ color: INK }}>{titulo}</h3>
      <dl className="divide-y divide-slate-200/70">
        {dato("esfera", "Esfera", ojo.esfera)}
        {dato("cilindro", "Cilindro", ojo.cilindro)}
        {dato("eje", "Eje", ojo.eje ? `${ojo.eje}°` : "")}
        {dato("agudeza", "Agudeza visual", ojo.avCc || ojo.avSc)}
      </dl>
    </div>
  )
}

// Mi receta: «Ojo derecho» y «Ojo izquierdo» (nunca OD y OI), cada valor con su explicación, y la receta para descargar en PDF.
export default function MiRecetaPortal({ cargando, ultimaReceta, recetasAnteriores, usuario, nombreOptica, mostrarMedidas, medidasSolicitadas, enviandoMedidas, errorMedidas, onSolicitarMedidas, onAgendar }) {
  const [abierto, setAbierto] = useState("")
  const alternar = (id) => setAbierto((a) => (a === id ? "" : id))

  if (cargando) return <div className="space-y-5" aria-busy="true" aria-label="Cargando tu receta"><TituloPagina>Mi receta</TituloPagina><Esqueleto alto="h-72" /></div>

  return (
    <div className="space-y-5">
      <TituloPagina subtitulo="Tu graduación actual y lo que indicó tu optómetra.">Mi receta</TituloPagina>

      {!ultimaReceta ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-slate-50 text-slate-400"><FileText size={26} aria-hidden="true" /></div>
          <p className="text-xl font-semibold text-slate-700">Todavía no tienes una receta</p>
          <p className="max-w-md text-lg text-slate-600">Aparece aquí después de tu primer examen visual.</p>
          <button type="button" onClick={() => onAgendar()} className={BOTON_PRINCIPAL + " mt-1"} style={ESTILO_PRINCIPAL}>Agendar cita</button>
        </div>
      ) : (
        <Bloque id="receta" titulo="Receta óptica" Icono={Glasses}>
          <div className="-mt-2 mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-lg text-slate-600">Última actualización: {formatoFecha(ultimaReceta.fecha, "medio")}</p>
            <button type="button" onClick={() => descargarPdfReceta({ optica: nombreOptica, paciente: usuario, receta: ultimaReceta, mostrarMedidas })} className={BOTON_SECUNDARIO}><Download size={20} aria-hidden="true" /> Descargar receta</button>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <TarjetaOjo titulo="Ojo derecho" ojo={ultimaReceta.od} abierto={abierto} alternar={alternar} />
            <TarjetaOjo titulo="Ojo izquierdo" ojo={ultimaReceta.oi} abierto={abierto} alternar={alternar} />
          </div>

          <div className="mt-4 space-y-4">
            {ultimaReceta.medidas?.adicion && (
              <dl className="rounded-2xl border border-slate-200/60 bg-slate-50/60 px-4 py-1 sm:px-5">
                <Dato etiqueta="Adición" valor={ultimaReceta.medidas.adicion} ayuda={AYUDA_RECETA.adicion} abierto={abierto === "adicion"} alAlternar={() => alternar("adicion")} />
              </dl>
            )}
            {mostrarMedidas ? (
              (ultimaReceta.medidas?.dp || ultimaReceta.medidas?.alt) && (
                <dl className="grid gap-x-6 rounded-2xl border border-slate-200/60 bg-slate-50/60 px-4 py-2 sm:grid-cols-2 sm:px-5">
                  {ultimaReceta.medidas?.dp && <div className="py-2"><dt className="text-lg text-slate-600">Distancia pupilar</dt><dd className="text-xl font-bold tabular-nums" style={{ color: INK }}>{ultimaReceta.medidas.dp}</dd></div>}
                  {ultimaReceta.medidas?.alt && <div className="py-2"><dt className="text-lg text-slate-600">Altura</dt><dd className="text-xl font-bold tabular-nums" style={{ color: INK }}>{ultimaReceta.medidas.alt}</dd></div>}
                </dl>
              )
            ) : (
              <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-4 sm:flex-row sm:items-center sm:p-5">
                <div className="flex-1">
                  <p className="text-lg text-slate-700">La distancia pupilar y las medidas de montaje las toma la óptica al armar tus lentes. Puedes solicitarlas aquí.</p>
                  {errorMedidas && <p role="alert" className="mt-2 text-lg font-semibold text-red-600">{errorMedidas}</p>}
                </div>
                {medidasSolicitadas ? (
                  <span className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-emerald-50 px-4 text-lg font-semibold text-emerald-700"><CheckCircle2 size={20} aria-hidden="true" /> Solicitud enviada</span>
                ) : (
                  <button type="button" onClick={onSolicitarMedidas} disabled={enviandoMedidas} className={BOTON_SECUNDARIO}>{enviandoMedidas ? "Enviando..." : "Solicitar distancia pupilar y medidas de montaje"}</button>
                )}
              </div>
            )}

            {ultimaReceta.lenteRecomendado && (
              <div className="flex items-center gap-3 rounded-2xl border p-4 sm:p-5" style={{ borderColor: "rgba(200,162,78,0.35)", backgroundColor: "rgba(200,162,78,0.08)" }}>
                <Glasses size={24} style={{ color: GOLD }} className="shrink-0" aria-hidden="true" />
                <div>
                  <p className="text-lg font-semibold" style={{ color: "#7c5e14" }}>Lente recomendado</p>
                  <p className="text-xl font-bold text-slate-800">{ultimaReceta.lenteRecomendado}</p>
                </div>
              </div>
            )}

            {(ultimaReceta.diagnostico || ultimaReceta.indicaciones || ultimaReceta.usaLentes) && (
              <div className="grid gap-4 md:grid-cols-2">
                {ultimaReceta.diagnostico && <div className="rounded-2xl border border-slate-200/60 bg-slate-50/60 p-4 sm:p-5"><p className="text-lg font-semibold text-slate-600">Diagnóstico</p><p className="mt-1 text-lg text-slate-800">{ultimaReceta.diagnostico}</p></div>}
                {ultimaReceta.indicaciones && <div className="rounded-2xl border border-slate-200/60 bg-slate-50/60 p-4 sm:p-5"><p className="text-lg font-semibold text-slate-600">Indicaciones</p><p className="mt-1 text-lg text-slate-800">{ultimaReceta.indicaciones}</p></div>}
                {ultimaReceta.usaLentes && <div className="rounded-2xl border border-slate-200/60 bg-slate-50/60 p-4 sm:p-5"><p className="text-lg font-semibold text-slate-600">¿Usa lentes?</p><p className="mt-1 text-lg text-slate-800">{ultimaReceta.usaLentes === "si" || ultimaReceta.usaLentes === true ? "Sí" : "No"}</p></div>}
              </div>
            )}

            <p className="flex items-start gap-2 border-t border-slate-100 pt-4 text-base text-slate-600">
              <Stethoscope size={20} className="mt-0.5 shrink-0" aria-hidden="true" /> Emitida por {ultimaReceta.profesionalNombre || "el equipo"}{ultimaReceta.profesionalRegistro ? ` · Reg. Prof. ${ultimaReceta.profesionalRegistro}` : ""} · {nombreOptica}
            </p>
          </div>
        </Bloque>
      )}

      {recetasAnteriores.length > 0 && (
        <Bloque id="anteriores" titulo="Recetas anteriores">
          <ul className="divide-y divide-slate-100">
            {recetasAnteriores.map((c) => (
              <li key={c.id} className="py-3 first:pt-0 last:pb-0">
                <p className="text-lg font-semibold text-slate-800">{formatoFecha(c.fecha, "medio")} · {c.diagnostico || "Consulta registrada"}</p>
                <p className="text-lg text-slate-700">Ojo derecho {textoGraduacionOjo(c.od)}</p>
                <p className="text-lg text-slate-700">Ojo izquierdo {textoGraduacionOjo(c.oi)}</p>
              </li>
            ))}
          </ul>
        </Bloque>
      )}
    </div>
  )
}
