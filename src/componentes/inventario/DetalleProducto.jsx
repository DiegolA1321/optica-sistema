"use client"

import { useMemo } from "react"
import { AlertTriangle, Archive, ArrowDownToLine, Package, Pencil, RotateCcw, ShoppingCart, SlidersHorizontal, Users } from "lucide-react"
import { Cascaron } from "../AtencionPaciente"
import MiniaturaProducto from "../MiniaturaProducto"
import { INK } from "@/lib/tema"
import { dinero } from "../../utilidades/formatoMoneda"
import { fechaHoraLegible, fechaLegible } from "../../utilidades/formatoFecha"
import { numeroComprobante } from "../../utilidades/comprobantes"
import { resumenVentasProducto } from "../../utilidades/ventas"
import { esStockBajo, minimoDe } from "../../utilidades/inventario"
import { etiquetaMovimiento, margenDe, medidasTexto, tieneCosto } from "../../utilidades/inventarioKardex"
import { useMovimientos } from "./useMovimientos"

const TONO_TIPO = {
  venta: "bg-blue-50 text-blue-700", anulacion_venta: "bg-violet-50 text-violet-700", ingreso_compra: "bg-emerald-50 text-emerald-700",
  ajuste_conteo: "bg-amber-50 text-amber-700", merma: "bg-red-50 text-red-700", devolucion_proveedor: "bg-orange-50 text-orange-700",
  saldo_inicial: "bg-slate-100 text-slate-600", ajuste_directo: "bg-slate-100 text-slate-600",
}

function Dato({ etiqueta, children, vacio = false }) {
  return (
    <div className="mt-3 first:mt-0">
      <dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{etiqueta}</dt>
      <dd className={"mt-0.5 break-words text-sm " + (vacio ? "text-slate-400" : "font-semibold")} style={vacio ? undefined : { color: INK }}>{children}</dd>
    </div>
  )
}
const Columna = ({ titulo, children }) => (
  <section>
    <h3 className="mb-2 border-b border-slate-200/60 pb-1.5 text-xs font-bold uppercase tracking-widest text-slate-500">{titulo}</h3>
    <dl>{children}</dl>
  </section>
)

// El detalle de un producto, en la ventana estándar: todo lo que se sabe de él y todas sus acciones (la fila de la tabla solo resume).
// Tres pestañas: Resumen (sus datos, su existencia y su precio), Movimientos (el kárdex) y Ventas (lo que se ha vendido).
export default function DetalleProducto({
  producto, umbralStock, usuarioPuede, ventas = [], facturasVenta = [], pacientes = [], versionMovimientos = 0, pestana, onPestana, sinAnimarFondo = false,
  onIngreso, onAjustar, onEditar, onDescontinuar, onReactivar, onVerPerfil, onCerrar,
}) {
  const { movimientos, cargando, error, hayMas, recargar } = useMovimientos(producto.id, versionMovimientos)
  const reporte = useMemo(() => resumenVentasProducto(ventas, producto.id, facturasVenta), [ventas, facturasVenta, producto.id])
  const numeroDe = useMemo(() => new Map(facturasVenta.map((f) => [f.id, f.numero])), [facturasVenta])
  const nombrePaciente = (id) => pacientes.find((p) => p.id === id)?.nombre || "Paciente"
  const editar = usuarioPuede("editar")
  const stock = Number(producto.stock) || 0
  const bajo = esStockBajo(producto, umbralStock)
  const margen = margenDe(producto)
  const descontinuado = producto.activo === false
  const medidas = medidasTexto(producto)

  const pestanas = [
    { id: "resumen", etiqueta: "Resumen" },
    { id: "movimientos", etiqueta: "Movimientos" },
    { id: "ventas", etiqueta: `Ventas (${reporte.ventas.length})` },
  ]
  const boton = "flex items-center gap-1.5 rounded-lg border border-slate-200/60 px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer"

  return (
    <Cascaron
      titulo={producto.nombre}
      subtitulo={[producto.categoria, producto.codigo, descontinuado && "Descontinuado"].filter(Boolean).join(" · ")}
      marca={<MiniaturaProducto url={producto.imagen_url} alt="" size={44} />} etiqueta={`Producto ${producto.nombre}`}
      ancho="max-w-3xl" sinAnimarFondo={sinAnimarFondo} onCerrar={onCerrar}
      pie={<>
        <div className="flex items-center gap-2">
          {editar && (descontinuado
            ? <button type="button" onClick={onReactivar} className={boton}><RotateCcw size={15} aria-hidden="true" /> Reactivar</button>
            : <button type="button" onClick={onDescontinuar} className={boton + " hover:border-amber-300 hover:text-amber-700"}><Archive size={15} aria-hidden="true" /> Descontinuar</button>)}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {editar && <button type="button" onClick={onEditar} className={boton}><Pencil size={15} aria-hidden="true" /> Editar</button>}
          {editar && !descontinuado && <button type="button" onClick={onAjustar} className={boton}><SlidersHorizontal size={15} aria-hidden="true" /> Ajustar stock</button>}
          {editar && !descontinuado && (
            <button type="button" onClick={onIngreso} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer" style={{ background: "linear-gradient(135deg,#22D3EE,#2563EB)" }}>
              <ArrowDownToLine size={15} aria-hidden="true" /> Registrar ingreso
            </button>
          )}
          {!editar && <button type="button" onClick={onCerrar} className={boton}>Cerrar</button>}
        </div>
      </>}
    >
      <div role="tablist" aria-label="Detalle del producto" className="flex gap-1 border-b border-slate-200/70 px-5">
        {pestanas.map((p) => (
          <button key={p.id} type="button" role="tab" aria-selected={pestana === p.id} onClick={() => onPestana(p.id)}
            className={"-mb-px border-b-2 px-3.5 py-2.5 text-sm font-semibold transition-colors cursor-pointer " + (pestana === p.id ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700")}>{p.etiqueta}</button>
        ))}
      </div>

      {pestana === "resumen" && (
        <div className="grid gap-x-6 gap-y-5 px-5 py-4 sm:grid-cols-3">
          <Columna titulo="El producto">
            <Dato etiqueta="Marca" vacio={!producto.marca}>{producto.marca || "—"}</Dato>
            <Dato etiqueta="Modelo" vacio={!producto.modelo}>{producto.modelo || "—"}</Dato>
            <Dato etiqueta="Color" vacio={!producto.color}>{producto.color || "—"}</Dato>
            <Dato etiqueta="Medidas (calibre-puente-varilla)" vacio={!medidas}>{medidas ? `${medidas} mm` : "—"}</Dato>
            <Dato etiqueta="Proveedor" vacio={!producto.proveedor}>{producto.proveedor || "—"}</Dato>
            {producto.observacion && <Dato etiqueta="Observación">{producto.observacion}</Dato>}
          </Columna>
          <Columna titulo="Existencia">
            <Dato etiqueta="Unidades">
              <span className="font-serif text-2xl leading-none tabular-nums">{stock}</span> u.
              {bajo && <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700"><AlertTriangle size={12} aria-hidden="true" /> Stock bajo</span>}
            </Dato>
            <Dato etiqueta="Alerta desde">{minimoDe(producto, umbralStock)} u.</Dato>
            <Dato etiqueta="Vale en existencia (a precio)">{dinero(stock * (Number(producto.precio) || 0))}</Dato>
            {editar && tieneCosto(producto) && <Dato etiqueta="Vale en existencia (a costo)">{dinero(stock * Number(producto.costo))}</Dato>}
          </Columna>
          <Columna titulo="Precio y margen">
            <Dato etiqueta="Precio de venta">{dinero(Number(producto.precio) || 0)}</Dato>
            {editar && (tieneCosto(producto) ? (
              <>
                <Dato etiqueta="Costo">{dinero(Number(producto.costo))}</Dato>
                <Dato etiqueta="Margen por unidad">{dinero(margen.monto)}{margen.porcentaje !== null ? ` · ${margen.porcentaje}%` : ""}</Dato>
              </>
            ) : (
              <Dato etiqueta="Costo" vacio>Sin costo registrado. Con el costo se calcula el margen.</Dato>
            ))}
          </Columna>
        </div>
      )}

      {pestana === "movimientos" && (
        <div className="px-5 py-4">
          {cargando ? (
            <div className="space-y-2" aria-busy="true" aria-label="Cargando el historial">{[0, 1, 2, 3].map((i) => <div key={i} className="h-9 animate-pulse rounded-lg bg-slate-200/70" />)}</div>
          ) : error ? (
            <div role="alert" className="flex flex-col items-center gap-2 py-8 text-center">
              <p className="text-sm font-medium text-red-700">{error}</p>
              <button type="button" onClick={recargar} className="text-sm font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">Intentar de nuevo</button>
            </div>
          ) : movimientos.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 py-8 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-400"><Package size={22} aria-hidden="true" /></div>
              <p className="text-sm font-medium text-slate-600">Todavía no hay movimientos de este producto.</p>
              {editar && !descontinuado && <button type="button" onClick={onIngreso} className="text-sm font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">Registrar un ingreso</button>}
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-xl border border-slate-200/60">
                <table className="w-full table-fixed border-collapse text-left text-sm">
                  <caption className="sr-only">Movimientos de {producto.nombre}, del más reciente al más antiguo</caption>
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-bold uppercase tracking-wide text-slate-500">
                      <th scope="col" className="w-[150px] px-3 py-2">Fecha</th>
                      <th scope="col" className="w-[150px] px-3 py-2">Movimiento</th>
                      <th scope="col" className="w-[70px] px-3 py-2 text-right">Cantidad</th>
                      <th scope="col" className="w-[80px] px-3 py-2 text-right">Quedó</th>
                      <th scope="col" className="px-3 py-2">Motivo y quién</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {movimientos.map((m) => (
                      <tr key={m.id}>
                        <td className="px-3 py-2 align-top text-slate-600">{fechaHoraLegible(m.creadoEn, { anio: true })}</td>
                        <td className="px-3 py-2 align-top"><span className={"rounded-md px-2 py-0.5 text-xs font-semibold " + (TONO_TIPO[m.tipo] || TONO_TIPO.ajuste_directo)}>{etiquetaMovimiento(m.tipo)}</span></td>
                        <td className={"px-3 py-2 text-right align-top font-mono font-bold tabular-nums " + (m.tipo === "saldo_inicial" ? "text-slate-600" : m.cantidad > 0 ? "text-emerald-700" : "text-red-600")}>{m.tipo !== "saldo_inicial" && m.cantidad > 0 ? "+" : ""}{m.cantidad}</td>
                        <td className="px-3 py-2 text-right align-top font-mono font-bold tabular-nums text-slate-800">{m.stockResultante}</td>
                        <td className="px-3 py-2 align-top">
                          <span className="block break-words">{m.motivo || "—"}{m.referencia && numeroDe.get(m.referencia) != null ? ` · ${numeroComprobante(numeroDe.get(m.referencia))}` : ""}</span>
                          <span className="block text-xs text-slate-500">{m.usuarioNombre || "Sistema"}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {hayMas && <p className="mt-2 text-xs text-slate-500">Se muestran los {movimientos.length} movimientos más recientes.</p>}
            </>
          )}
        </div>
      )}

      {pestana === "ventas" && (
        <div className="px-5 py-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-200/60 bg-slate-50 p-3 text-center"><p className="font-serif text-xl font-semibold" style={{ color: INK }}>{reporte.unidades}</p><p className="mt-0.5 text-xs font-medium text-slate-500">Unidades vendidas</p></div>
            <div className="rounded-xl border border-slate-200/60 bg-slate-50 p-3 text-center"><p className="font-serif text-xl font-semibold" style={{ color: INK }}>{dinero(reporte.ingreso)}</p><p className="mt-0.5 text-xs font-medium text-slate-500">Ingreso generado</p></div>
            <div className="rounded-xl border border-slate-200/60 bg-slate-50 p-3 text-center"><p className="font-serif text-xl font-semibold" style={{ color: INK }}>{reporte.pendientes}</p><p className="mt-0.5 text-xs font-medium text-slate-500">Con pago pendiente</p></div>
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-600"><Users size={14} aria-hidden="true" /> {reporte.pacientes} paciente{reporte.pacientes === 1 ? "" : "s"} distinto{reporte.pacientes === 1 ? "" : "s"} lo ha{reporte.pacientes === 1 ? "" : "n"} comprado.</p>
          {reporte.ventas.length === 0 ? (
            <div className="mt-4 flex flex-col items-center gap-2 py-8 text-center">
              <div className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-400"><ShoppingCart size={20} aria-hidden="true" /></div>
              <p className="text-sm font-medium text-slate-600">Todavía no se ha vendido este producto.</p>
            </div>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200/60">
              {reporte.ventas.map((v) => (
                <li key={v.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                  <div className="min-w-0">
                    {onVerPerfil && v.pacienteId != null
                      ? <button type="button" onClick={() => onVerPerfil(v.pacienteId)} className="truncate text-sm font-semibold text-slate-700 underline-offset-2 hover:text-blue-600 hover:underline cursor-pointer">{nombrePaciente(v.pacienteId)}</button>
                      : <p className="truncate text-sm font-semibold text-slate-700">{nombrePaciente(v.pacienteId)}</p>}
                    <p className="text-xs text-slate-500">{v.cantidad} u. · {fechaLegible(v.creadoEn)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-mono text-sm font-bold text-slate-700">{dinero(Number(v.montoTotal))}</span>
                    <span className={"rounded-full px-2 py-0.5 text-xs font-bold " + (v.estado === "completado" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>{v.estado === "completado" ? "Pagado" : "Pendiente"}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Cascaron>
  )
}
