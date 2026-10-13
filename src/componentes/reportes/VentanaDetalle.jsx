"use client"

import { useState } from "react"
import { ArrowRight, Download, Inbox } from "lucide-react"
import { Cascaron } from "../AtencionPaciente"
import { INK } from "@/lib/tema"

// La ventana estándar con la lista exacta de registros que componen un número. Solo las columnas esenciales (lo demás va en
// "Exportar"); los nombres ocupan una línea (se recortan y el nombre completo sale al pasar el cursor); los montos y las fechas
// nunca se parten; las columnas numéricas van a la derecha. Nunca hay desplazamiento horizontal; si la lista es larga se desplaza
// por dentro, con los títulos fijos arriba y el pie ("Abrir en…" y "Cerrar") siempre visible.
//
// d: { titulo, valor, filtros, icono, columnas: [{ titulo, valor(fila), ancho?: px, derecha?: bool }], filas,
//      abrirEn: { etiqueta, ir() } | null, irAPestana: { etiqueta, ir() } | null }
// La columna sin `ancho` es la elástica (la del nombre): ocupa lo que sobra y recorta con puntos suspensivos.
export default function VentanaDetalle({ d, onCerrar }) {
  const vacio = d.filas.length === 0
  const [bajando, setBajando] = useState(false)
  const exportar = async () => { setBajando(true); try { await d.exportar() } finally { setBajando(false) } }
  return (
    <Cascaron
      titulo={d.titulo}
      subtitulo={d.filtros}
      Icono={d.icono || Inbox}
      ancho="max-w-3xl"
      onCerrar={onCerrar}
      derecha={<span className="font-serif text-2xl font-semibold leading-none tabular-nums" style={{ color: INK }} data-detalle-valor>{d.valor}</span>}
      pie={<>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
          {d.abrirEn && <button type="button" onClick={() => { onCerrar(); d.abrirEn.ir() }} className="flex items-center gap-1 text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">{d.abrirEn.etiqueta} <ArrowRight size={14} aria-hidden="true" /></button>}
          {d.irAPestana && <button type="button" onClick={() => { onCerrar(); d.irAPestana.ir() }} className="flex items-center gap-1 text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">{d.irAPestana.etiqueta} <ArrowRight size={14} aria-hidden="true" /></button>}
        </div>
        <div className="flex items-center gap-2">
          {d.exportar && !vacio && <button type="button" onClick={exportar} disabled={bajando} className="flex items-center gap-1.5 rounded-lg border border-slate-200/60 px-3.5 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60 cursor-pointer"><Download size={14} aria-hidden="true" />{bajando ? "Preparando…" : "Exportar"}</button>}
        <button type="button" onClick={onCerrar} className="rounded-lg border border-slate-200/60 px-3.5 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">Cerrar</button>
        </div>
      </>}
    >
      <div className="overflow-x-hidden" data-detalle-cuerpo>
        {vacio ? (
          <p className="px-5 py-10 text-center text-sm text-slate-500">No hay registros con estos filtros. Prueba con otro período o quita algún filtro.</p>
        ) : (
          <table className="w-full table-fixed text-sm" data-detalle-tabla>
            <colgroup>{d.columnas.map((c) => <col key={c.titulo} style={c.ancho ? { width: c.ancho } : undefined} />)}</colgroup>
            <thead className="sticky top-0 z-10 bg-slate-50 text-xs font-bold uppercase tracking-wider text-slate-500 shadow-[0_1px_0_0_rgb(226,232,240)]">
              <tr>{d.columnas.map((c) => <th key={c.titulo} scope="col" className={"truncate px-4 py-2 " + (c.derecha ? "text-right" : "text-left")}>{c.titulo}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {d.filas.map((f, i) => (
                <tr key={i} className="hover:bg-slate-50/60">
                  {d.columnas.map((c) => {
                    const texto = String(c.valor(f) ?? "")
                    return <td key={c.titulo} title={texto} className={"truncate px-4 py-2 " + (c.derecha ? "text-right tabular-nums" : "text-left") + (f.__anulada ? " text-slate-400 line-through" : "")}>{texto}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Cascaron>
  )
}
