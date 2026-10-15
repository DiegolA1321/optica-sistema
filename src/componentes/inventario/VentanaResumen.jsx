"use client"

import { useMemo } from "react"
import { Boxes, DollarSign } from "lucide-react"
import { Cascaron } from "../AtencionPaciente"
import { dinero } from "../../utilidades/formatoMoneda"
import { tieneCosto, valorInventario } from "../../utilidades/inventarioKardex"
import { INK } from "@/lib/tema"

const BOTON = "rounded-lg border border-slate-200/60 px-3 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50 cursor-pointer"

// El detalle de las dos tarjetas de números del resumen de Inventario, en la ventana estándar: por categoría, y cada fila lleva a la tabla filtrada.
// `verCosto`: quien puede editar el inventario ve también el costo y la ganancia (el costo no se muestra a quien solo mira).
export default function VentanaResumen({ modo, productos, categorias, verCosto, onVerCategoria, onCerrar }) {
  const esValor = modo === "valor"
  const grupos = useMemo(() => categorias.map((c) => {
    const lista = productos.filter((p) => p.categoria === c)
    return { categoria: c, lista, unidades: lista.reduce((s, p) => s + (Number(p.stock) || 0), 0), ...valorInventario(lista) }
  }).filter((g) => g.lista.length > 0), [productos, categorias])
  const total = useMemo(() => valorInventario(productos), [productos])
  const unidades = productos.reduce((s, p) => s + (Number(p.stock) || 0), 0)
  const ganancia = useMemo(() => productos.filter(tieneCosto).reduce((s, p) => s + (Number(p.stock) || 0) * ((Number(p.precio) || 0) - Number(p.costo)), 0), [productos])
  const conCosto = verCosto && total.hayCosto

  return (
    <Cascaron
      titulo={esValor ? "Valor del inventario" : "Unidades en stock"} subtitulo={esValor ? "Lo que hay en existencia, valorado" : "Cuántas unidades hay de cada categoría"}
      Icono={esValor ? DollarSign : Boxes} ancho="max-w-xl" onCerrar={onCerrar}
      pie={<><span className="text-xs text-slate-500">Solo productos activos. Los descontinuados no cuentan.</span><button type="button" onClick={onCerrar} className="rounded-lg border border-slate-200/60 px-3.5 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">Cerrar</button></>}
    >
      <div className="space-y-4 px-5 py-4">
        {esValor ? (
          <>
            <div className={"grid gap-3 " + (conCosto ? "grid-cols-3" : "grid-cols-1")}>
              <div className="rounded-xl border border-slate-200/60 bg-slate-50 p-3 text-center"><p className="font-serif text-xl font-semibold" style={{ color: INK }}>{dinero(total.aPrecio)}</p><p className="mt-0.5 text-xs font-medium text-slate-500">A precio de venta</p></div>
              {conCosto && <div className="rounded-xl border border-slate-200/60 bg-slate-50 p-3 text-center"><p className="font-serif text-xl font-semibold" style={{ color: INK }}>{dinero(total.aCosto)}</p><p className="mt-0.5 text-xs font-medium text-slate-500">A costo</p></div>}
              {conCosto && <div className="rounded-xl border border-slate-200/60 bg-slate-50 p-3 text-center"><p className="font-serif text-xl font-semibold" style={{ color: INK }}>{dinero(ganancia)}</p><p className="mt-0.5 text-xs font-medium text-slate-500">Ganancia posible</p></div>}
            </div>
            <p className="text-sm text-slate-600">
              <strong>A precio de venta</strong> es la existencia de cada producto por su precio.
              {verCosto && (total.hayCosto
                ? <> <strong>A costo</strong> es la existencia por lo que costó{total.sinCosto > 0 ? `; ${total.sinCosto} producto${total.sinCosto === 1 ? "" : "s"} sin costo registrado no ${total.sinCosto === 1 ? "suma" : "suman"} ahí` : ""}. La ganancia posible es lo que dejaría vender todo lo que tiene costo.</>
                : " Todavía ningún producto tiene costo registrado: al registrarlo (en Editar) se ve también el valor a costo y el margen.")}
            </p>
          </>
        ) : (
          <div className="rounded-xl border border-slate-200/60 bg-slate-50 p-3 text-center"><p className="font-serif text-xl font-semibold" style={{ color: INK }}>{unidades}</p><p className="mt-0.5 text-xs font-medium text-slate-500">Unidades en {productos.length} producto{productos.length === 1 ? "" : "s"}</p></div>
        )}

        {grupos.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No hay productos todavía.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200/60">
            <table className="w-full table-fixed border-collapse text-left text-sm">
              <caption className="sr-only">{esValor ? "Valor por categoría" : "Unidades por categoría"}</caption>
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <th scope="col" className="px-3 py-2">Categoría</th>
                  <th scope="col" className="w-[90px] px-3 py-2 text-right">Productos</th>
                  <th scope="col" className="w-[110px] px-3 py-2 text-right">{esValor ? "A precio" : "Unidades"}</th>
                  {esValor && conCosto && <th scope="col" className="w-[110px] px-3 py-2 text-right">A costo</th>}
                  <th scope="col" className="w-[70px] px-3 py-2"><span className="sr-only">Ver</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {grupos.map((g) => (
                  <tr key={g.categoria}>
                    <th scope="row" className="truncate px-3 py-2 text-left font-semibold text-slate-800">{g.categoria}</th>
                    <td className="px-3 py-2 text-right tabular-nums">{g.lista.length}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold tabular-nums">{esValor ? dinero(g.aPrecio) : g.unidades}</td>
                    {esValor && conCosto && <td className="px-3 py-2 text-right font-mono font-bold tabular-nums">{g.hayCosto ? dinero(g.aCosto) : "—"}</td>}
                    <td className="px-3 py-2 text-right"><button type="button" onClick={() => onVerCategoria(g.categoria)} aria-label={`Ver los productos de ${g.categoria} en la tabla`} className={BOTON}>Ver</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Cascaron>
  )
}
