"use client"

import { Eye } from "lucide-react"
import { Cascaron } from "../AtencionPaciente"
import { textoAgudeza } from "../../utilidades/agudeza"
import { fechaLegible } from "../../utilidades/formatoFecha"

// «Ver su evolución»: la agudeza visual de cada ojo en cada consulta, una fila por fecha (la más reciente arriba): sin corrección, con su corrección actual y con la receta nueva.
const tieneAgudeza = (k) => ["od", "oi"].some((l) => k[l]?.avSc || k[l]?.avCc || k[l]?.avRx)
const GRUPOS = [["Sin corrección", "avSc", "avScF"], ["Con su corrección actual", "avCc", "avCcF"], ["Con la receta nueva", "avRx", "avRxF"]]

export default function EvolucionAgudeza({ consultas = [], actualId, onCerrar }) {
  const filas = consultas.filter(tieneAgudeza)
  const visibles = GRUPOS.filter(([, v]) => filas.some((k) => k.od?.[v] || k.oi?.[v])) // una columna que nunca se registró no se dibuja
  return (
    <Cascaron titulo="Evolución de la agudeza visual" subtitulo="Cada ojo en cada consulta, de la más reciente a la más antigua." Icono={Eye} ancho="max-w-3xl" onCerrar={onCerrar} capa="z-[60]"
      pie={<><span /><button type="button" onClick={onCerrar} className="rounded-lg border border-slate-200/60 px-3.5 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">Cerrar</button></>}>
      {filas.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-slate-500">Ninguna consulta de este paciente tiene la agudeza visual registrada.</p>
      ) : (
        <div className="overflow-x-auto px-5 py-4">
          <table className="w-full min-w-[30rem] border-collapse text-[15px]" aria-label="Evolución de la agudeza visual">
            <thead>
              <tr className="text-left text-xs font-bold uppercase tracking-wide text-slate-500">
                <th rowSpan={2} scope="col" className="pb-2 pr-4 align-bottom">Fecha</th>
                {visibles.map(([titulo]) => <th key={titulo} colSpan={2} scope="colgroup" className="border-l border-slate-100 px-3 pb-1 text-center">{titulo}</th>)}
              </tr>
              <tr className="text-xs font-bold text-blue-600">
                {visibles.map(([titulo]) => ["OI", "OD"].map((o) => <th key={titulo + o} scope="col" className="border-l border-slate-100 px-3 pb-2 text-center first:border-l-0">{o}</th>))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filas.map((k) => (
                <tr key={k.id} aria-current={String(k.id) === String(actualId) ? "true" : undefined} className={String(k.id) === String(actualId) ? "bg-blue-50/60" : ""}>
                  <th scope="row" className="whitespace-nowrap py-2 pr-4 text-left font-semibold text-slate-800">{fechaLegible(k.fecha)}</th>
                  {visibles.map(([titulo, v, f]) => ["oi", "od"].map((l) => <td key={titulo + l} className="border-l border-slate-100 px-3 py-2 text-center tabular-nums">{textoAgudeza(k[l]?.[v], k[l]?.[f]) || "—"}</td>))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Cascaron>
  )
}
