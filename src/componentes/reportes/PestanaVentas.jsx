"use client"

import { useMemo } from "react"
import { Ban, DollarSign, Wallet, Scale, Receipt, FileWarning, Stethoscope, Glasses, Package, CreditCard } from "lucide-react"
import { Seccion, Caja, SinResultados, NumeroPulsable, TablaNumeros, REJILLA_TARJETAS_4 } from "./bloques"
import { BarrasLista } from "./Graficas"
import { crearDestinos } from "./destinos"
import { col } from "./listas"
import { dinero } from "../../utilidades/formatoMoneda"
import { TIPOS_LENTE } from "../../utilidades/ordenesLaboratorio"
import { tieneReceta } from "../../utilidades/embudo"
import { pagosDeFacturas, ventasPorMetodo, sinFacturaElectronica, lineasVendidas, rankingProductos, lunasPorTipo, comoFactura } from "../../utilidades/reportesDatos"
import { porcentaje } from "../../utilidades/reportesPeriodo"
import { saldoFactura } from "../../utilidades/abonos"
import { enRango } from "../../utilidades/reportesPeriodo"

const DINERO = { baseMinima: 100, formato: dinero }
const pct = (n) => (n == null ? "—" : `${n}%`)
const SIN_NOMBRE = "Producto sin nombre"
const tipoDeLuna = (l) => (TIPOS_LENTE.some((t) => t.id === l.detalle?.tipo_lente) ? l.detalle.tipo_lente : "otro")

// Ventas — "¿Cuánto vendemos, cuánto cobramos y por qué no compran?": lo vendido y lo cobrado, el embudo de captación (R40) con los
// motivos de no compra y las proformas, qué se vende y cómo se paga, y las ventas que faltan por facturar.
export default function PestanaVentas({ r }) {
  const { act, ant, cols, abrir, f, datos, rango, tarjeta } = r
  const d = crearDestinos(r)
  const { vc, embudo } = act

  const pagos = useMemo(() => pagosDeFacturas(act.facturasPeriodo, datos.abonos, act.viejasPeriodo), [act.facturasPeriodo, act.viejasPeriodo, datos.abonos])
  const conSaldo = useMemo(() => act.facturasPeriodo.filter((x) => saldoFactura(x, datos.abonos) > 0), [act.facturasPeriodo, datos.abonos])
  const sinFE = useMemo(() => sinFacturaElectronica(act.facturasPeriodo), [act.facturasPeriodo])
  const metodos = useMemo(() => ventasPorMetodo(act.ventasLista), [act.ventasLista])
  // Las ventas anuladas no aparecen en Ventas ni suman en ningún total: se consultan aquí, por la fecha en que se anularon.
  const anuladas = useMemo(() => f.facturas.filter((x) => x.estado === "anulada" && enRango(x.anuladaEn || x.creadoEn, rango)).sort((a, b) => String(b.anuladaEn || b.creadoEn).localeCompare(String(a.anuladaEn || a.creadoEn))), [f.facturas, rango])
  const montoAnulado = anuladas.reduce((s, x) => s + (Number(x.montoTotal) || 0), 0)
  const lunas = useMemo(() => lunasPorTipo(f.facturas, rango), [f.facturas, rango])
  const lineasLuna = useMemo(() => lineasVendidas(f.facturas, rango, "luna"), [f.facturas, rango])
  const productos = useMemo(() => rankingProductos(f.facturas, f.hay ? [] : datos.ventas, rango), [f.facturas, f.hay, datos.ventas, rango])
  const lineasProducto = useMemo(() => {
    const filas = lineasVendidas(f.facturas, rango, "producto").map((x) => ({ ...x, nombre: x.linea.descripcion || SIN_NOMBRE }))
    for (const v of act.viejasPeriodo) filas.push({ factura: comoFactura(v), linea: { descripcion: v.productoNombre || SIN_NOMBRE }, cantidad: Number(v.cantidad) || 1, nombre: v.productoNombre || SIN_NOMBRE })
    return filas
  }, [f.facturas, rango, act.viejasPeriodo])

  const conReceta = useMemo(() => act.cons.filter(tieneReceta), [act.cons])
  const delEmbudo = (ids) => conReceta.filter((c) => ids.has ? ids.has(c.id) : ids.includes(c.id))
  const colsCompra = cols.consultaCompra(embudo.ids.compraron)
  const abrirConsultas = (titulo, lista, valor = lista.length) => abrir({ titulo, valor, icono: Stethoscope, columnas: colsCompra, filas: lista })

  const idsPrimera = embudo.ids.primeraVez
  const esPrimera = (c) => idsPrimera.has(c.id)
  const compro = (c) => embudo.ids.compraron.has(c.id)
  const grupos = [
    { id: "primera", etiqueta: "Primera vez", atendidos: conReceta.filter(esPrimera) },
    { id: "ya", etiqueta: "Ya eran pacientes", atendidos: conReceta.filter((c) => !esPrimera(c)) },
  ].map((g) => ({ ...g, compraron: g.atendidos.filter(compro) }))

  const noCompraron = embudo.motivos.map((m) => ({ id: m.id, etiqueta: m.etiqueta, lista: delEmbudo(embudo.ids.noCompraronPorMotivo[m.id] || []) }))
  const proformas = delEmbudo(embudo.ids.proformas)
  const proformasCompraron = delEmbudo(embudo.ids.proformasEnVenta)
  const enEspera = delEmbudo(embudo.ids.enEspera)
  const hayEmbudo = embudo.consultaron > 0

  return (
    <>
      {r.hay && <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">Con motivo, origen, visita o profesional elegidos solo cuentan las ventas que salieron de una consulta.</p>}

      <Seccion titulo="En el período">
        <div className={REJILLA_TARJETAS_4}>
          {tarjeta({ titulo: "Vendido", valor: dinero(vc.vendido), ayuda: "Total de los comprobantes de venta del período, sin los anulados, aunque todavía tengan saldo.", onClick: () => abrir({ titulo: `Vendido: ${vc.cantidad} venta${vc.cantidad === 1 ? "" : "s"}`, valor: dinero(vc.vendido), icono: DollarSign, columnas: cols.factura, filas: act.ventasLista, abrirEn: d.ventas() }) }, vc.vendido, ant.vc.vendido, DINERO)}
          {tarjeta({ titulo: "Cobrado", valor: dinero(vc.cobrado), ayuda: "Lo que de lo vendido en el período ya se pagó: las ventas pagadas completas y los abonos de las que tienen saldo. La lista son los pagos.", onClick: () => abrir({ titulo: "Cobrado: los pagos de las ventas del período", valor: dinero(vc.cobrado), icono: Wallet, columnas: cols.pago, filas: pagos, abrirEn: { ...d.ventas(), etiqueta: `Abrir los comprobantes en Ventas${r.hay ? " (sin los filtros)" : ""}` } }) }, vc.cobrado, ant.vc.cobrado, DINERO)}
          {tarjeta({ titulo: "Saldo pendiente", valor: dinero(act.saldo), ayuda: "Lo vendido en el período que todavía no se ha cobrado: Vendido menos Cobrado.", onClick: () => abrir({ titulo: `Saldo pendiente: ${conSaldo.length} venta${conSaldo.length === 1 ? "" : "s"} con saldo`, valor: dinero(act.saldo), icono: Scale, columnas: cols.factura, filas: conSaldo, abrirEn: d.ventas({ estado: "saldo" }) }) }, act.saldo, ant.saldo, { ...DINERO, buenoSiSube: false })}
          {tarjeta({ titulo: "Ticket promedio", valor: act.ticket == null ? "—" : dinero(act.ticket), sub: act.ticket == null ? "Sin ventas en el período" : undefined, ayuda: "Lo vendido en el período dividido entre el número de ventas.", onClick: () => abrir({ titulo: `Vendido ÷ ventas: ${dinero(vc.vendido)} ÷ ${vc.cantidad}`, valor: act.ticket == null ? "—" : dinero(act.ticket), icono: Receipt, columnas: cols.factura, filas: act.ventasLista, abrirEn: d.ventas() }) }, act.ticket ?? undefined, ant.ticket, { baseMinima: 20, formato: dinero })}
        </div>
      </Seccion>

      <Seccion titulo="Embudo de captación" ayuda="De los pacientes atendidos con receta en el período: cuántos pasaron a venta (los dejó listos el optómetra) y cuántos compraron. Abajo, por qué no compraron.">
        {!hayEmbudo ? (
          <Caja><SinResultados texto="Ningún paciente fue atendido con receta en este período. Prueba con otro período o quita los filtros." acciones={[{ etiqueta: "Ver este año", onClick: () => r.setPeriodo("anio") }, ...(r.hay ? [{ etiqueta: "Limpiar filtros", onClick: r.quitarFiltros }] : [])]} /></Caja>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            <Caja titulo="De la receta a la compra" exportar={r.bloque("Embudo de captación",
              () => ({ columnas: [col("Paso", (x) => x.paso), col("Pacientes", (x) => x.n, "entero"), col("Sobre los atendidos", (x) => x.p, "tasa")], filas: [{ paso: "Atendidos con receta", n: embudo.consultaron, p: 100 }, { paso: "Pasaron a venta", n: embudo.pasaron, p: porcentaje(embudo.pasaron, embudo.consultaron) }, { paso: "Compraron", n: embudo.compraron, p: porcentaje(embudo.compraron, embudo.consultaron) }] }),
              () => ({ columnas: colsCompra, filas: conReceta }))}>
              <BarrasLista
                ancho="w-44" anchoValor="w-28"
                filas={[
                  { id: "consultaron", etiqueta: "Atendidos con receta", valor: embudo.consultaron, texto: String(embudo.consultaron), lista: conReceta },
                  { id: "pasaron", etiqueta: "Pasaron a venta", valor: embudo.pasaron, texto: `${embudo.pasaron} · ${pct(embudo.pasaronSobreConsultaron)}`, lista: delEmbudo(embudo.ids.pasaron) },
                  { id: "compraron", etiqueta: "Compraron", valor: embudo.compraron, texto: `${embudo.compraron} · ${pct(embudo.compraronSobreConsultaron)}`, lista: delEmbudo(embudo.ids.compraron) },
                ].map((x) => ({ ...x, tip: x.id === "consultaron" ? `${x.etiqueta}: ${x.valor}` : `${x.etiqueta}: ${x.valor} de ${embudo.consultaron} atendidos con receta (${pct(porcentaje(x.valor, embudo.consultaron))})` }))}
                onElegir={(x) => abrirConsultas(x.etiqueta, x.lista, x.valor)}
              />
            </Caja>
            <Caja titulo="Los que no compraron" exportar={r.bloque("Los que no compraron",
              () => ({ columnas: [col("Concepto", (x) => x.n), col("Pacientes", (x) => x.v, "entero")], filas: [...noCompraron.map((m) => ({ n: m.etiqueta, v: m.lista.length })), { n: "Todavía en espera", v: enEspera.length }, { n: "Proformas entregadas", v: proformas.length }, { n: "Proformas que terminaron en compra", v: proformasCompraron.length }] }),
              () => ({ columnas: [col("Concepto", (c) => c.__c), ...colsCompra], filas: [...noCompraron.flatMap((m) => m.lista.map((c) => ({ ...c, __c: m.etiqueta }))), ...enEspera.map((c) => ({ ...c, __c: "Todavía en espera" })), ...proformas.map((c) => ({ ...c, __c: "Proforma entregada" }))] }))}>
              <BarrasLista
                ancho="w-44" color="#d97706"
                filas={[
                  ...noCompraron.map((m) => ({ id: m.id, etiqueta: m.etiqueta, valor: m.lista.length, lista: m.lista, tip: `${m.etiqueta}: ${m.lista.length}` })),
                  { id: "espera", etiqueta: "Todavía en espera", valor: enEspera.length, lista: enEspera, tip: `Todavía en espera de decidir: ${enEspera.length}` },
                ]}
                onElegir={(x) => abrirConsultas(x.etiqueta, x.lista)}
              />
              <div className="mt-3 border-t border-slate-100 pt-3">
                <BarrasLista
                  ancho="w-44"
                  filas={[
                    { id: "proformas", etiqueta: "Proformas entregadas", valor: proformas.length, lista: proformas, tip: `Proformas entregadas: ${proformas.length}` },
                    { id: "proformasCompraron", etiqueta: "…y terminaron comprando", valor: proformasCompraron.length, lista: proformasCompraron, tip: `Proformas que terminaron en compra: ${proformasCompraron.length}` },
                  ]}
                  onElegir={(x) => abrirConsultas(x.etiqueta, x.lista)}
                />
              </div>
            </Caja>
            <Caja titulo="Primera vez frente a pacientes de la óptica" exportar={r.bloque("Primera vez frente a pacientes de la óptica",
              () => ({ columnas: [col("Paciente", (g) => g.etiqueta), col("Atendidos con receta", (g) => g.atendidos.length, "entero"), col("Compraron", (g) => g.compraron.length, "entero"), col("Captación", (g) => porcentaje(g.compraron.length, g.atendidos.length), "tasa")], filas: grupos }),
              () => ({ columnas: [col("Grupo", (c) => c.__g), ...colsCompra], filas: grupos.flatMap((g) => g.atendidos.map((c) => ({ ...c, __g: g.etiqueta }))) }))} className="lg:col-span-2" ayuda="Entre los atendidos con receta: los que nunca se habían atendido antes y los que ya eran pacientes, y cuántos de cada grupo compraron.">
              <TablaNumeros titulos={["Paciente", "Atendidos", "Compraron", "Captación"]} anchoNumeros={110} etiqueta="Primera vez frente a pacientes de la óptica">
                {grupos.map((g) => (
                  <tr key={g.id}>
                    <th scope="row" className="py-2 pr-2 text-left font-semibold text-slate-700">{g.etiqueta}</th>
                    <td className="px-1 text-right"><NumeroPulsable valor={g.atendidos.length} nombre={`${g.etiqueta}: ${g.atendidos.length} atendidos con receta. Ver la lista`} onClick={() => abrirConsultas(`${g.etiqueta} · atendidos con receta`, g.atendidos)} /></td>
                    <td className="px-1 text-right"><NumeroPulsable valor={g.compraron.length} nombre={`${g.etiqueta}: ${g.compraron.length} compraron. Ver la lista`} onClick={() => abrirConsultas(`${g.etiqueta} · compraron`, g.compraron)} /></td>
                    <td className="px-1 text-right"><NumeroPulsable valor={g.atendidos.length} texto={pct(porcentaje(g.compraron.length, g.atendidos.length))} nombre={`${g.etiqueta}: captación ${pct(porcentaje(g.compraron.length, g.atendidos.length))}. Ver la lista`} onClick={() => abrirConsultas(`${g.etiqueta} · ${g.compraron.length} de ${g.atendidos.length} compraron`, g.atendidos, pct(porcentaje(g.compraron.length, g.atendidos.length)))} /></td>
                  </tr>
                ))}
              </TablaNumeros>
            </Caja>
          </div>
        )}
      </Seccion>

      <Seccion titulo="Qué se vende y cómo se paga">
        <div className="grid gap-3 lg:grid-cols-2">
          <Caja titulo="Ventas por tipo de luna" exportar={r.bloque("Ventas por tipo de luna",
            () => ({ columnas: [col("Tipo de luna", (l) => l.etiqueta), col("Unidades", (l) => l.unidades, "entero"), col("Monto", (l) => l.monto, "dinero")], filas: lunas }),
            () => ({ columnas: [col("Tipo de luna", (x) => TIPOS_LENTE.find((t) => t.id === tipoDeLuna(x.linea))?.label || "Sin tipo indicado"), ...cols.linea], filas: lineasLuna }))} ayuda="Lunas vendidas en el período según el tipo que se anotó en la venta, sin los comprobantes anulados.">
            {lunas.length === 0 ? <SinResultados texto="No se vendieron lunas en este período. Prueba con otro período." acciones={[{ etiqueta: "Ver este año", onClick: () => r.setPeriodo("anio") }]} /> : (
              <BarrasLista ancho="w-36" anchoValor="w-36"
                filas={lunas.map((l) => ({ id: l.id, etiqueta: l.etiqueta, valor: l.unidades, texto: `${l.unidades} · ${dinero(l.monto)}`, tip: `${l.etiqueta}: ${l.unidades} unidad${l.unidades === 1 ? "" : "es"} por ${dinero(l.monto)}` }))}
                onElegir={(l) => abrir({ titulo: `Lunas · ${l.etiqueta}`, valor: l.valor, icono: Glasses, columnas: cols.linea, filas: lineasLuna.filter((x) => tipoDeLuna(x.linea) === l.id), abrirEn: d.ventas() })} />
            )}
          </Caja>
          <Caja titulo="Productos más vendidos" exportar={r.bloque("Productos más vendidos",
            () => ({ columnas: [col("Producto", (p) => p.label), col("Unidades", (p) => p.valor, "entero")], filas: productos }),
            () => ({ columnas: cols.linea, filas: lineasProducto }))} ayuda="Monturas y accesorios con más unidades vendidas en el período, sin los comprobantes anulados.">
            {productos.length === 0 ? <SinResultados texto="No se vendieron productos en este período. Prueba con otro período." acciones={[{ etiqueta: "Ver este año", onClick: () => r.setPeriodo("anio") }]} /> : (
              <BarrasLista ancho="w-44" anchoValor="w-24"
                filas={productos.map((p) => ({ id: p.label, etiqueta: p.label, valor: p.valor, texto: `${p.valor} u.`, tip: `${p.label}: ${p.valor} unidad${p.valor === 1 ? "" : "es"}` }))}
                onElegir={(p) => abrir({ titulo: `Producto · ${p.etiqueta}`, valor: p.valor, icono: Package, columnas: cols.linea, filas: lineasProducto.filter((x) => x.nombre === p.etiqueta), abrirEn: d.ventas() })} />
            )}
          </Caja>
          <Caja titulo="Ventas por método de pago" exportar={r.bloque("Ventas por método de pago",
            () => ({ columnas: [col("Método de pago", (m) => m.etiqueta), col("Ventas", (m) => m.facturas.length, "entero"), col("Monto", (m) => m.monto, "dinero")], filas: metodos }),
            () => ({ columnas: [col("Método de pago", (f) => f.__m), ...cols.factura], filas: metodos.flatMap((m) => m.facturas.map((f) => ({ ...f, __m: m.etiqueta }))) }))} className="lg:col-span-2" ayuda="Lo vendido en el período según cómo se pagó. Cada barra suma los comprobantes de ese método.">
            {metodos.length === 0 ? <SinResultados texto="No hay ventas en este período. Prueba con otro período." acciones={[{ etiqueta: "Ver este año", onClick: () => r.setPeriodo("anio") }]} /> : (
              <BarrasLista ancho="w-44" anchoValor="w-44"
                filas={metodos.map((m) => ({ id: m.id, etiqueta: m.etiqueta, valor: m.monto, texto: `${dinero(m.monto)} · ${m.facturas.length}`, tip: `${m.etiqueta}: ${dinero(m.monto)} en ${m.facturas.length} venta${m.facturas.length === 1 ? "" : "s"}`, m }))}
                onElegir={(x) => abrir({ titulo: `Pagadas con ${x.etiqueta.toLowerCase()}: ${x.m.facturas.length} venta${x.m.facturas.length === 1 ? "" : "s"}`, valor: dinero(x.m.monto), icono: CreditCard, columnas: cols.factura, filas: x.m.facturas, abrirEn: d.ventas() })} />
            )}
          </Caja>
        </div>
      </Seccion>

      <Seccion titulo="Ventas anuladas">
        <Caja titulo="Ventas anuladas del período" exportar={r.bloque("Ventas anuladas", () => ({ columnas: cols.facturaAnulada.map((c) => ({ ...c, titulo: c.titulo })), filas: anuladas }), () => ({ columnas: cols.facturaAnulada, filas: anuladas }))} ayuda="Las ventas que se anularon en el período (por la fecha de anulación). No aparecen en Ventas ni suman en ningún total; aquí se consultan con quién las anuló y el motivo.">
          {anuladas.length === 0 ? <SinResultados texto="No se anuló ninguna venta en este período." /> : (
            <div className="space-y-3">
              <p className="text-sm text-slate-600">{anuladas.length} {anuladas.length === 1 ? "venta anulada" : "ventas anuladas"} · {dinero(montoAnulado)}</p>
              <button type="button" onClick={() => abrir({ titulo: `Ventas anuladas: ${anuladas.length}`, valor: dinero(montoAnulado), icono: Ban, columnas: cols.facturaAnulada, filas: anuladas })} className="rounded-lg border border-slate-200/60 px-3.5 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer">Ver la lista</button>
            </div>
          )}
        </Caja>
      </Seccion>

      <Seccion titulo="Facturación">
        <div className={REJILLA_TARJETAS_4}>
          {tarjeta({ titulo: "Sin factura electrónica", valor: sinFE.length, sub: sinFE.length ? `${dinero(sinFE.reduce((s, x) => s + (Number(x.montoTotal) || 0), 0))} por facturar` : "Todo facturado", ayuda: "Ventas del período, sin las anuladas, que todavía no tienen su número de factura electrónica registrado. Conviene emitirlas antes de declarar.", onClick: () => abrir({ titulo: "Ventas sin factura electrónica", valor: sinFE.length, icono: FileWarning, columnas: cols.factura, filas: sinFE, abrirEn: d.ventas({ sinFE: true }) }) })}
        </div>
      </Seccion>
    </>
  )
}
