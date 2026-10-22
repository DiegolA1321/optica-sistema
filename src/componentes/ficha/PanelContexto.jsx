"use client"

import { AlertCircle, History, Glasses, FileText } from "lucide-react"
import { fechaLegible } from "../../utilidades/formatoFecha"
import { dioptriaTexto } from "../../utilidades/refraccion"
import { textoAgudeza } from "../../utilidades/agudeza"
import { Etiqueta } from "./piezas"

const Seccion = ({ titulo, children }) => (
  <section className="border-b border-slate-100 pb-3 last:border-b-0 last:pb-0"><h4 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">{titulo}</h4>{children}</section>
)

// La receta resumida con los MISMOS valores que se guardan y se imprimen (`recetaDesdeForm`): refracción final de cada ojo (derecho arriba), adición, distancia pupilar, prisma, agudeza con la receta nueva y lente recomendado.
export function RecetaResumen({ receta, onVerHoja }) {
  const filas = [["OD", receta.od, receta.ojoNoEvaluado?.od], ["OI", receta.oi, receta.ojoNoEvaluado?.oi]]
  const m = receta.medidas || {}
  const adOd = dioptriaTexto(m.adicionOd), adOi = dioptriaTexto(m.adicionOi)
  const adicion = adOd || adOi ? (adOd === adOi ? adOd : `OD ${adOd || "—"} · OI ${adOi || "—"}`) : ""
  const dp = [m.dp && `${m.dp} mm`, (m.dpOd || m.dpOi) && `OD ${m.dpOd || "—"} · OI ${m.dpOi || "—"}`].filter(Boolean).join(" · ")
  const prisma = [m.prismaOdCant && `OD ${m.prismaOdCant}Δ ${(m.prismaOdBase || "").toLowerCase()}`, m.prismaOiCant && `OI ${m.prismaOiCant}Δ ${(m.prismaOiBase || "").toLowerCase()}`].filter(Boolean).join(" · ")
  return (
    <div data-receta-resumen className="rounded-xl border border-slate-200 bg-white p-2.5 text-xs">
      <table className="w-full border-collapse text-xs">
        <thead><tr className="text-slate-400"><th className="p-1 text-left font-semibold" /><th className="p-1 font-semibold">Esf.</th><th className="p-1 font-semibold">Cil.</th><th className="p-1 font-semibold">Eje</th><th className="p-1 font-semibold">AV</th></tr></thead>
        <tbody>
          {filas.map(([sigla, o, noEval]) => noEval
            ? <tr key={sigla} className="border-t border-slate-100"><th className="p-1 text-left">{sigla}</th><td colSpan={4} className="p-1 text-slate-500">Ojo no evaluado: {noEval}</td></tr>
            : <tr key={sigla} className="border-t border-slate-100 text-center font-mono tabular-nums"><th className="p-1 text-left font-sans font-bold">{sigla}</th><td className="p-1">{dioptriaTexto(o.esfera) || "—"}</td><td className="p-1">{dioptriaTexto(o.cilindro) || "—"}</td><td className="p-1">{o.eje ? `${o.eje}°` : "—"}</td><td className="p-1">{textoAgudeza(o.avRx, o.avRxF) || "—"}</td></tr>)}
        </tbody>
      </table>
      <dl className="mt-2 space-y-0.5 text-slate-700">
        {adicion && <div><dt className="inline font-semibold">Adición: </dt><dd className="inline">{adicion}</dd></div>}
        {dp && <div><dt className="inline font-semibold">Distancia pupilar: </dt><dd className="inline">{dp}</dd></div>}
        {prisma && <div><dt className="inline font-semibold">Prisma: </dt><dd className="inline">{prisma}</dd></div>}
        {receta.lenteRecomendado && <div><dt className="inline font-semibold">Lente recomendado: </dt><dd className="inline">{receta.lenteRecomendado}</dd></div>}
      </dl>
      {onVerHoja && <button type="button" onClick={onVerHoja} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 cursor-pointer"><FileText size={12} aria-hidden="true" /> Ver la hoja completa</button>}
    </div>
  )
}

// El panel fijo de la derecha: contexto del paciente (edad, alergias destacadas, última graduación, últimas visitas) y, en el paso 3, la vista previa del documento.
export default function PanelContexto({ paciente, edad, alergiaSignificativa, alergias, antecedentesAlerta, ultimaGraduacion, visitas, onAbrirVisita, onVerHistorial, totalVisitas, tendencia, hoja, onVerHoja, paso }) {
  return (
    <aside aria-label="Contexto del paciente" className="space-y-3 rounded-2xl border border-slate-200/70 bg-white p-3.5 text-sm shadow-sm lg:sticky lg:top-24">
      {paso === "diagnostico" && hoja && (
        <Seccion titulo="Vista previa del documento">
          {/* La hoja real, reducida: lo que se ve aquí es lo que sale al descargar o imprimir. */}
          <div data-vista-previa-documento className="overflow-hidden rounded-xl border border-slate-200 bg-white" style={{ zoom: 0.42 }} aria-label="Vista previa del documento">{hoja}</div>
          {onVerHoja && <button type="button" onClick={onVerHoja} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 cursor-pointer"><FileText size={12} aria-hidden="true" /> Ver en grande</button>}
        </Seccion>
      )}
      <Seccion titulo="Paciente">
        <p className="font-bold text-slate-900">{paciente.nombre}</p>
        <p className="text-xs text-slate-500">{[edad != null && `${edad} años`, paciente.cedula && `Cédula ${paciente.cedula}`].filter(Boolean).join(" · ")}</p>
      </Seccion>
      <Seccion titulo="Alergias">
        {alergiaSignificativa
          ? <span className="inline-flex max-w-full items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-bold text-red-700"><AlertCircle size={12} className="shrink-0" aria-hidden="true" /><span className="break-words">{alergias}</span></span>
          : <p className="text-xs text-slate-500">{alergias || "Sin alergias registradas"}</p>}
        {antecedentesAlerta && <p role="status" className="mt-1.5 rounded-lg border border-amber-300/70 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800">Importante: {antecedentesAlerta}</p>}
      </Seccion>
      <Seccion titulo={ultimaGraduacion ? `Última graduación · ${fechaLegible(ultimaGraduacion.fecha)}` : "Última graduación"}>
        {ultimaGraduacion ? (
          <div className="font-mono text-xs tabular-nums text-slate-700">
            <p><b className="font-sans text-blue-600">OD</b> {ultimaGraduacion.od}</p>
            <p><b className="font-sans text-cyan-600">OI</b> {ultimaGraduacion.oi}</p>
            {ultimaGraduacion.adicion && <p><b className="font-sans text-slate-500">Add</b> {ultimaGraduacion.adicion}</p>}
          </div>
        ) : <p className="text-xs text-slate-500">Primera consulta: sin graduación previa.</p>}
        {tendencia}
      </Seccion>
      <Seccion titulo="Últimas visitas">
        {visitas.length === 0 ? <p className="text-xs text-slate-500">Sin visitas anteriores.</p> : (
          <ul className="space-y-0.5">
            {visitas.map((v) => (
              <li key={v.id}><button type="button" onClick={() => onAbrirVisita(v)} className="flex w-full items-baseline justify-between gap-2 rounded-lg px-1.5 py-1 text-left text-xs transition-colors hover:bg-blue-50 cursor-pointer">
                <span className="min-w-0 truncate font-medium text-slate-700">{v.motivo || "Consulta"}</span><span className="shrink-0 text-slate-400">{fechaLegible(v.fecha)}</span></button></li>
            ))}
          </ul>
        )}
        {totalVisitas > 0 && <button type="button" onClick={onVerHistorial} className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 cursor-pointer"><History size={12} aria-hidden="true" /> Ver historial ({totalVisitas})</button>}
      </Seccion>
    </aside>
  )
}
