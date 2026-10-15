"use client"

import { useMemo } from "react"
import { Archive, Boxes, DollarSign, Package } from "lucide-react"
import { Cascaron } from "../AtencionPaciente"
import { dinero } from "../../utilidades/formatoMoneda"
import { fechaLegible } from "../../utilidades/formatoFecha"
import { DIAS_SIN_VENDER, tieneCosto, valorInventario } from "../../utilidades/inventarioKardex"
import { esDeEsteMes } from "../../utilidades/inicio"
import { INK } from "@/lib/tema"

const BOTON = "rounded-lg border border-slate-200/60 px-3 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50 cursor-pointer"
const CAJA = "rounded-xl border border-slate-200/60 bg-slate-50 p-3 text-center"
const Numero = ({ valor, etiqueta }) => (<div className={CAJA}><p className="font-serif text-xl font-semibold" style={{ color: INK }}>{valor}</p><p className="mt-0.5 text-xs font-medium text-slate-500">{etiqueta}</p></div>)

const TEXTOS = {
  productos: { titulo: "Productos", subtitulo: "Cuántos hay, por categoría", Icono: Package },
  unidades: { titulo: "Unidades en stock", subtitulo: "Cuántas unidades hay de cada categoría", Icono: Boxes },
  valor: { titulo: "Valor del inventario", subtitulo: "Lo que hay en existencia, valorado", Icono: DollarSign },
  sinvender: { titulo: `Sin venderse en ${DIAS_SIN_VENDER} días`, subtitulo: "Monturas con existencia que no se mueven", Icono: Archive },
}

// El desglose de cada tarjeta de números del resumen de Inventario, en la ventana estándar; todas funcionan igual: un resumen arriba y debajo
// cada fila lleva a la tabla filtrada (o al producto). `verCosto`: quien puede editar el inventario ve también el costo y la ganancia.
export default function VentanaResumen({ modo, productos, descontinuados = [], categorias, sinVender = [], verCosto, onVer, onVerProducto, onCerrar }) {
  const { titulo, subtitulo, Icono } = TEXTOS[modo]
  const grupos = useMemo(() => categorias.map((c) => {
    const lista = productos.filter((p) => p.categoria === c)
    return { categoria: c, lista, unidades: lista.reduce((s, p) => s + (Number(p.stock) || 0), 0), ...valorInventario(lista) }
  }).filter((g) => g.lista.length > 0), [productos, categorias])
  const total = useMemo(() => valorInventario(productos), [productos])
  const unidades = productos.reduce((s, p) => s + (Number(p.stock) || 0), 0)
  const ganancia = useMemo(() => productos.filter(tieneCosto).reduce((s, p) => s + (Number(p.stock) || 0) * ((Number(p.precio) || 0) - Number(p.costo)), 0), [productos])
  const nuevos = productos.filter((p) => esDeEsteMes(p.creadoEn)).length
  const conCosto = verCosto && total.hayCosto
  const encabezado = "border-b border-slate-100 bg-slate-50/70 text-xs font-bold uppercase tracking-wide text-slate-500"

  // Lo que representan en dinero las monturas que no se mueven (a precio de venta y, si hay costo, a costo).
  const parado = useMemo(() => {
    const aPrecio = sinVender.reduce((s, f) => s + f.valor, 0)
    const conCostoFilas = sinVender.filter((f) => tieneCosto(f.producto))
    return { aPrecio, aCosto: conCostoFilas.reduce((s, f) => s + f.existencia * Number(f.producto.costo), 0), hayCosto: conCostoFilas.length > 0, unidades: sinVender.reduce((s, f) => s + f.existencia, 0) }
  }, [sinVender])

  return (
    <Cascaron
      titulo={titulo} subtitulo={subtitulo} Icono={Icono} ancho="max-w-xl" onCerrar={onCerrar}
      pie={<><span className="text-xs text-slate-500">{modo === "sinvender" ? `Monturas activas con existencia, sin ventas desde hace ${DIAS_SIN_VENDER} días o más (o nunca vendidas).` : "Solo productos activos. Los descontinuados no cuentan."}</span><button type="button" onClick={onCerrar} className="rounded-lg border border-slate-200/60 px-3.5 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">Cerrar</button></>}
    >
      <div className="space-y-4 px-5 py-4">
        {modo === "valor" && (
          <>
            <div className={"grid gap-3 " + (conCosto ? "grid-cols-3" : "grid-cols-1")}>
              <Numero valor={dinero(total.aPrecio)} etiqueta="A precio de venta" />
              {conCosto && <Numero valor={dinero(total.aCosto)} etiqueta="A costo" />}
              {conCosto && <Numero valor={dinero(ganancia)} etiqueta="Ganancia posible" />}
            </div>
            {verCosto && <p className="text-sm text-slate-600">
              {total.hayCosto
                ? <><strong>A costo</strong> es la existencia por lo que costó{total.sinCosto > 0 ? `; ${total.sinCosto} producto${total.sinCosto === 1 ? "" : "s"} sin costo registrado no ${total.sinCosto === 1 ? "suma" : "suman"} ahí` : ""}. La ganancia posible es lo que dejaría vender todo lo que tiene costo.</>
                : "Todavía ningún producto tiene costo registrado: al registrarlo (en Editar) se ve también el valor a costo y el margen."}
            </p>}
          </>
        )}
        {modo === "unidades" && <Numero valor={unidades} etiqueta={`Unidades en ${productos.length} producto${productos.length === 1 ? "" : "s"}`} />}
        {modo === "productos" && <Numero valor={productos.length} etiqueta={`Producto${productos.length === 1 ? "" : "s"} activo${productos.length === 1 ? "" : "s"}`} />}
        {modo === "sinvender" && (
          <div className={"grid gap-3 " + (parado.hayCosto && verCosto ? "grid-cols-3" : "grid-cols-2")}>
            <Numero valor={sinVender.length} etiqueta={`Montura${sinVender.length === 1 ? "" : "s"} · ${parado.unidades} u.`} />
            <Numero valor={dinero(parado.aPrecio)} etiqueta="Parado a precio de venta" />
            {parado.hayCosto && verCosto && <Numero valor={dinero(parado.aCosto)} etiqueta="Parado a costo" />}
          </div>
        )}

        {modo === "sinvender" ? (
          sinVender.length === 0 ? (
            <p className="py-6 text-center text-sm font-medium text-slate-600">Ninguna montura lleva {DIAS_SIN_VENDER} días sin venderse. Todo se está moviendo.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200/60">
              <table className="w-full table-fixed border-collapse text-left text-sm">
                <caption className="sr-only">Monturas sin venderse en {DIAS_SIN_VENDER} días</caption>
                <thead><tr className={encabezado}>
                  <th scope="col" className="px-3 py-2">Montura</th>
                  <th scope="col" className="w-[64px] px-3 py-2 text-right">Stock</th>
                  <th scope="col" className="w-[110px] px-3 py-2">Última venta</th>
                  <th scope="col" className="w-[96px] px-3 py-2 text-right">Valor</th>
                  <th scope="col" className="w-[64px] px-3 py-2"><span className="sr-only">Ver</span></th>
                </tr></thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {sinVender.map((f) => (
                    <tr key={f.producto.id}>
                      <th scope="row" className="truncate px-3 py-2 text-left font-semibold text-slate-800" title={f.producto.nombre}>{f.producto.nombre}</th>
                      <td className="px-3 py-2 text-right tabular-nums">{f.existencia}</td>
                      <td className="px-3 py-2 text-slate-600">{f.ultimaVenta ? fechaLegible(f.ultimaVenta) : "Nunca"}</td>
                      <td className="px-3 py-2 text-right font-mono font-bold tabular-nums">{dinero(f.valor)}</td>
                      <td className="px-3 py-2 text-right"><button type="button" onClick={() => onVerProducto(f.producto)} aria-label={`Ver ${f.producto.nombre}`} className={BOTON}>Ver</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : grupos.length === 0 && modo !== "productos" ? (
          <p className="py-6 text-center text-sm text-slate-500">No hay productos todavía.</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200/60">
            <table className="w-full table-fixed border-collapse text-left text-sm">
              <caption className="sr-only">{modo === "valor" ? "Valor por categoría" : modo === "unidades" ? "Unidades por categoría" : "Productos por categoría"}</caption>
              <thead><tr className={encabezado}>
                <th scope="col" className="px-3 py-2">{modo === "productos" ? "Desglose" : "Categoría"}</th>
                {modo !== "productos" && <th scope="col" className="w-[90px] px-3 py-2 text-right">Productos</th>}
                <th scope="col" className="w-[110px] px-3 py-2 text-right">{modo === "valor" ? "A precio" : modo === "unidades" ? "Unidades" : "Productos"}</th>
                {modo === "valor" && conCosto && <th scope="col" className="w-[110px] px-3 py-2 text-right">A costo</th>}
                <th scope="col" className="w-[70px] px-3 py-2"><span className="sr-only">Ver</span></th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {grupos.map((g) => (
                  <tr key={g.categoria}>
                    <th scope="row" className="truncate px-3 py-2 text-left font-semibold text-slate-800">{g.categoria}</th>
                    {modo !== "productos" && <td className="px-3 py-2 text-right tabular-nums">{g.lista.length}</td>}
                    <td className="px-3 py-2 text-right font-mono font-bold tabular-nums">{modo === "valor" ? dinero(g.aPrecio) : modo === "unidades" ? g.unidades : g.lista.length}</td>
                    {modo === "valor" && conCosto && <td className="px-3 py-2 text-right font-mono font-bold tabular-nums">{g.hayCosto ? dinero(g.aCosto) : "—"}</td>}
                    <td className="px-3 py-2 text-right"><button type="button" onClick={() => onVer({ categoria: g.categoria })} aria-label={`Ver los productos de ${g.categoria} en la tabla`} className={BOTON}>Ver</button></td>
                  </tr>
                ))}
                {modo === "productos" && (
                  <>
                    <tr>
                      <th scope="row" className="px-3 py-2 text-left font-semibold text-slate-800">Nuevos este mes</th>
                      <td className="px-3 py-2 text-right font-mono font-bold tabular-nums">{nuevos}</td>
                      <td className="px-3 py-2 text-right">{nuevos > 0 && <button type="button" onClick={() => onVer({ nuevos: true })} aria-label="Ver los productos nuevos de este mes en la tabla" className={BOTON}>Ver</button>}</td>
                    </tr>
                    <tr>
                      <th scope="row" className="px-3 py-2 text-left font-semibold text-slate-800">Descontinuados</th>
                      <td className="px-3 py-2 text-right font-mono font-bold tabular-nums">{descontinuados.length}</td>
                      <td className="px-3 py-2 text-right">{descontinuados.length > 0 && <button type="button" onClick={() => onVer({ descontinuados: true })} aria-label="Ver los productos descontinuados en la tabla" className={BOTON}>Ver</button>}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Cascaron>
  )
}
