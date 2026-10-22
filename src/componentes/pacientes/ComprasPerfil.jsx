"use client"

import { ChevronRight } from "lucide-react"
import { INK } from "@/lib/tema"
import { Insignia } from "../ventas/Lista"
import ComprasBasicas from "../ComprasBasicas"
import { dinero } from "../../utilidades/formatoMoneda"
import { fechaLegible } from "../../utilidades/formatoFecha"
import { diaDeRegistro } from "../../utilidades/periodoLista"
import { numeroComprobante } from "../../utilidades/comprobantes"
import { estadoDeComprobante } from "../../utilidades/saldosVentas"
import { estadoLentesDeCompra } from "../../utilidades/ordenesLaboratorio"
import { saldoVenta, METODOS_PAGO } from "../../utilidades/ventas"

// La pestaña Compras del perfil: «Compras · N» con «+ Nueva venta» al lado y, a la derecha de la misma fila, el total comprado y el saldo; debajo, la lista en columnas (fecha, compra, estado de los lentes,
// total y estado del pago). Sin tarjetas grandes arriba. Pulsar una compra abre su detalle completo en la ventana estándar (productos, abonos con sus fechas, saldo, lentes, comprobante y factura).
const TONO_LENTES = { proceso: "azul", listos: "ambar", entregados: "verde" }
const COLUMNAS = "@[44rem]:grid-cols-[7.5rem_minmax(0,1.7fr)_minmax(0,1fr)_6.5rem_8.5rem_1rem]"

// El título y el subtítulo de una compra: la primera línea y, debajo, las demás («Montura Ray-Ban · lunas con filtro azul»).
function textoDeCompra(f) {
  const lineas = (f.lineas || []).map((l) => String(l.descripcion || "").trim()).filter(Boolean)
  return { titulo: `${lineas[0] || "Venta"} · ${numeroComprobante(f.numero)}`, detalle: lineas.slice(1).join(" · ") }
}

export default function ComprasPerfil({ comprobantes = [], abonos = [], ordenes = [], totales, puedeVender = false, basicas = [], cargandoBasicas = false, pase = null, onNuevaVenta, onVenderReceta, onAbrir, onRegistrarCuota, onMarcarPagada }) {
  const { sinMontos, n, comprado, saldo, anuladas } = totales
  return (
    <section aria-label="Compras del paciente" className="@container overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-4">
        <div className="flex flex-wrap items-center gap-3.5">
          <h2 className="text-xl font-bold" style={{ color: INK }}>Compras · {n}{anuladas > 0 ? <span className="text-base font-normal text-slate-500"> · {anuladas} anulada{anuladas === 1 ? "" : "s"}</span> : null}</h2>
          {puedeVender && <button type="button" onClick={onNuevaVenta} title="Venta sin receta o con ella: productos y servicios, con pago directo, tarjeta o cuotas" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700 cursor-pointer">+ Nueva venta</button>}
        </div>
        {!sinMontos && (
          <p className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-[15px] text-slate-500">
            <span>Total comprado <strong className="font-bold" style={{ color: INK }}>{dinero(comprado)}</strong></span>
            <span>Saldo <strong className={"font-bold " + (saldo > 0 ? "text-red-700" : "")} style={saldo > 0 ? undefined : { color: INK }}>{dinero(saldo)}</strong></span>
          </p>
        )}
      </div>

      {sinMontos ? (
        <div className="border-t border-slate-100 px-5 py-4"><ComprasBasicas lista={basicas} cargando={cargandoBasicas} /></div>
      ) : comprobantes.length === 0 ? (
        <div className="flex flex-col items-center gap-2 border-t border-slate-100 px-5 py-10 text-center">
          <p className="text-sm font-medium text-slate-500">Este paciente todavía no tiene compras registradas.</p>
          {pase && puedeVender && <button type="button" onClick={onVenderReceta} className="mt-1 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 cursor-pointer">Vender la receta</button>}
        </div>
      ) : (
        <>
          <div aria-hidden="true" className={"hidden gap-x-3 bg-slate-50 px-5 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-500 @[44rem]:grid " + COLUMNAS}><span>Fecha</span><span>Compra</span><span>Lentes</span><span className="text-right">Total</span><span>Pago</span><span /></div>
          <ul data-lista="compras-paciente" className="divide-y divide-slate-100 border-t border-slate-100">
            {comprobantes.map((c) => {
              if (c.factura) {
                const f = c.factura
                const estado = estadoDeComprobante(f, abonos)
                const lentes = estado.id === "anulada" ? null : estadoLentesDeCompra(f.id, ordenes)
                const { titulo, detalle } = textoDeCompra(f)
                return (
                  <li key={c.clave} data-fila className={"pt-abrible relative grid items-start gap-x-3 gap-y-1 px-5 py-3.5 transition-colors hover:bg-slate-50 @[44rem]:items-center " + COLUMNAS}>
                    <button type="button" onClick={() => onAbrir(f)} aria-haspopup="dialog" aria-label={`Ver la compra ${numeroComprobante(f.numero)}`} className="pt-abrir absolute inset-0 cursor-pointer" />
                    <p className="text-[15px] text-slate-800">{fechaLegible(diaDeRegistro(f.creadoEn)) || "—"}</p>
                    <div className="min-w-0"><p className={"text-[15px] leading-snug " + (estado.id === "anulada" ? "text-slate-400 line-through" : "text-slate-900")}>{titulo}</p>{detalle && <p className="text-sm leading-snug text-slate-500">{detalle}</p>}</div>
                    <div data-col="lentes" className="min-w-0">{lentes ? <Insignia tono={TONO_LENTES[lentes.id]}>{lentes.etiqueta}</Insignia> : <span className="text-[15px] text-slate-400" aria-label="Sin lentes">—</span>}</div>
                    <p data-col="monto" className={"font-mono text-[15px] @[44rem]:text-right " + (estado.id === "anulada" ? "text-slate-400 line-through" : "text-slate-900")}>{dinero(f.montoTotal)}</p>
                    <div data-col="estado" className="min-w-0"><Insignia tono={estado.id === "saldo" ? "rojo" : estado.id === "pagada" ? "verde" : "gris"}>{estado.id === "saldo" ? `Debe ${dinero(estado.saldo)}` : estado.etiqueta}</Insignia></div>
                    <ChevronRight size={16} className="hidden text-slate-400 @[44rem]:block" aria-hidden="true" />
                  </li>
                )
              }
              // Venta rápida de un producto (el mecanismo anterior a las facturas): se sigue cobrando en cuotas como siempre.
              const v = c.venta
              const debe = saldoVenta(v)
              const pagada = v.estado === "completado"
              return (
                <li key={c.clave} data-fila className={"grid items-start gap-x-3 gap-y-1 px-5 py-3.5 @[44rem]:items-center " + COLUMNAS}>
                  <p className="text-[15px] text-slate-800">{fechaLegible(diaDeRegistro(v.creadoEn)) || "—"}</p>
                  <div className="min-w-0">
                    <p className="text-[15px] leading-snug text-slate-900">{v.productoNombre}</p>
                    <p className="text-sm leading-snug text-slate-500">{v.cantidad} u. · {METODOS_PAGO[v.metodoPago] || v.metodoPago}{v.metodoPago === "cuotas" && v.cuotasTotales ? ` (${v.cuotasPagadas || 0}/${v.cuotasTotales})` : ""}</p>
                  </div>
                  <span className="text-[15px] text-slate-400" aria-label="Sin lentes">—</span>
                  <p data-col="monto" className="font-mono text-[15px] text-slate-900 @[44rem]:text-right">{dinero(Number(v.montoTotal))}</p>
                  <div data-col="estado" className="min-w-0"><Insignia tono={pagada ? "verde" : "rojo"}>{pagada ? "Pagada" : `Debe ${dinero(debe)}`}</Insignia></div>
                  <span aria-hidden="true" />
                  {!pagada && (
                    <div className="flex flex-wrap items-center gap-2 @[44rem]:col-span-6 @[44rem]:pl-[8.25rem]">
                      {v.metodoPago === "cuotas" && v.cuotasTotales ? <button type="button" onClick={() => onRegistrarCuota(v)} className="rounded-lg border border-slate-200/60 px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">Registrar cuota</button> : null}
                      <button type="button" onClick={() => onMarcarPagada(v)} className="rounded-lg border border-emerald-200/60 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 cursor-pointer">Marcar pagada</button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
