"use client"

import { useMemo } from "react"
import { DollarSign, Package, Percent, RefreshCw, Archive } from "lucide-react"
import { Seccion, Caja, SinResultados, REJILLA_TARJETAS_4 } from "./bloques"
import { BarrasLista } from "./Graficas"
import { crearDestinos } from "./destinos"
import { col } from "./listas"
import { dinero } from "../../utilidades/formatoMoneda"
import { fechaLegible, formatoFecha } from "../../utilidades/formatoFecha"
import { numeroComprobante } from "../../utilidades/comprobantes"
import { metricasInventario } from "../../utilidades/reportesInventario"
import { puede } from "../../utilidades/permisosUi"
import { DIAS_SIN_VENDER } from "../../utilidades/inventarioKardex"

const DINERO = { baseMinima: 100, formato: dinero }
const veces = (n) => (n == null ? "—" : `${n} ${n === 1 ? "vez" : "veces"}`)
const pct = (n) => (n == null ? "—" : `${n}%`)

// Las columnas de las listas que abre cada número (solo lo esencial: lo demás va en "Exportar").
const COL_EXISTENCIA = [
  { titulo: "Producto", valor: (f) => f.producto.nombre },
  { titulo: "Existencia", ancho: 104, derecha: true, valor: (f) => f.existencia, tipo: "entero", crudo: (f) => f.existencia },
  { titulo: "Costo", ancho: 100, derecha: true, valor: (f) => dinero(f.producto.costo), tipo: "dinero", crudo: (f) => Number(f.producto.costo) || 0 },
  { titulo: "Valor a costo", ancho: 124, derecha: true, valor: (f) => dinero(f.valor), tipo: "dinero", crudo: (f) => f.valor },
]
const COL_SIN_VENDER = [
  { titulo: "Monturas", valor: (f) => f.producto.nombre },
  { titulo: "Existencia", ancho: 104, derecha: true, valor: (f) => f.existencia, tipo: "entero", crudo: (f) => f.existencia },
  { titulo: "Última venta", ancho: 132, valor: (f) => (f.ultimaVenta ? fechaLegible(f.ultimaVenta) : "Nunca"), tipo: "fecha", crudo: (f) => f.ultimaVenta || "" },
  { titulo: "Valor a precio", ancho: 124, derecha: true, valor: (f) => dinero(f.valor), tipo: "dinero", crudo: (f) => f.valor },
]
const colLineas = (verCosto) => [
  { titulo: "Comprobante", ancho: 128, valor: (f) => numeroComprobante(f.factura.numero) },
  { titulo: "Producto", valor: (f) => f.producto?.nombre || f.linea.descripcion || "—" },
  { titulo: "Cantidad", ancho: 84, derecha: true, valor: (f) => f.cantidad, tipo: "entero", crudo: (f) => f.cantidad },
  { titulo: "Ingreso", ancho: 100, derecha: true, valor: (f) => dinero(f.ingreso), tipo: "dinero", crudo: (f) => f.ingreso },
  ...(verCosto ? [
    { titulo: "Costo", ancho: 100, derecha: true, valor: (f) => (f.costo === null ? "Sin costo" : dinero(f.costo)), tipo: "dinero", crudo: (f) => f.costo ?? 0 },
    { titulo: "Ganancia", ancho: 104, derecha: true, valor: (f) => (f.costo === null ? "—" : dinero(f.ingreso - f.costo)), tipo: "dinero", crudo: (f) => (f.costo === null ? 0 : Math.round((f.ingreso - f.costo) * 100) / 100) },
  ] : []),
]

// Inventario — "¿Cuánto vale lo que tenemos y qué se mueve?": el valor a costo, el margen de lo vendido, la rotación, las monturas
// que no se venden y las más vendidas. Mismas reglas que las demás pestañas: cada número abre su lista, se compara con el período anterior
// y cada bloque se exporta. Todo sale de los productos activos, de las ventas vigentes (las mismas que cuenta Ventas) y del kárdex.
export default function PestanaInventario({ r }) {
  const { rango, previo, datos, inventario, abrir, tarjeta, usuario, movimientos, kardex } = r
  const verCosto = puede(usuario, "inventario", "editar")
  const d = crearDestinos(r)
  const m = useMemo(() => metricasInventario({ productos: inventario, facturas: datos.facturas, movimientos, rango, previo }), [inventario, datos.facturas, movimientos, rango, previo])
  const { act, ant } = m
  const activos = inventario.filter((p) => p.activo !== false)
  const abrirEn = d.inventario()
  const lineas = colLineas(verCosto)

  if (kardex.cargando) return <div className="space-y-3" aria-busy="true" aria-label="Cargando el inventario">{[0, 1].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200/70" />)}</div>
  if (kardex.error) {
    return <SinResultados texto={kardex.error} acciones={[{ etiqueta: "Intentar de nuevo", onClick: kardex.recargar }]} />
  }
  if (activos.length === 0) {
    return <SinResultados texto="Todavía no hay productos activos en el inventario: aquí aparecerán su valor, su rotación y lo que más se vende." acciones={r.onAbrirModulo ? [{ etiqueta: "Ir a Inventario", onClick: () => r.onAbrirModulo("inventario", {}) }] : []} />
  }

  const sinCostoFin = act.final.sinCosto
  const ayudaValor = `Lo que costó lo que hay en existencia al cierre del período (existencia × costo de cada producto activo). La lista son esos productos.${sinCostoFin > 0 ? ` ${sinCostoFin} producto${sinCostoFin === 1 ? "" : "s"} con existencia no tiene costo registrado y no suma.` : ""}`
  const lineasMargen = act.margen.lineas
  const desdeKardex = m.kardexDesde

  return (
    <>
      {r.hay && <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">Los filtros de motivo, origen, visita y profesional no cambian esta pestaña: el inventario y sus ventas no dependen de ellos.</p>}
      {desdeKardex && rango.inicio < desdeKardex && (
        <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">El historial de movimientos empezó el {formatoFecha(desdeKardex, "medio")}. Antes de esa fecha la existencia se calcula con lo que había ese día, no con cada movimiento.</p>
      )}
      {kardex.truncado && <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">Hay muchísimos movimientos: se leyeron los más recientes. Las fechas muy antiguas pueden no ser exactas.</p>}

      <Seccion titulo="En el período">
        <div className={REJILLA_TARJETAS_4}>
          {verCosto && tarjeta({
            titulo: "Valor del inventario a costo", valor: dinero(act.final.valor), ayuda: ayudaValor,
            onClick: () => abrir({ titulo: `Inventario a costo al ${formatoFecha(rango.fin, "medio")}: ${act.final.filas.length} producto${act.final.filas.length === 1 ? "" : "s"}`, valor: dinero(act.final.valor), icono: DollarSign, columnas: COL_EXISTENCIA, filas: act.final.filas, abrirEn }),
          }, act.final.valor, ant.final.valor, DINERO)}
          {verCosto && tarjeta({
            titulo: "Margen promedio", valor: pct(act.margen.porcentaje),
            ayuda: `Lo que dejó lo vendido en el período: (ingreso − costo) ÷ ingreso de las líneas de monturas y accesorios de los comprobantes vigentes, con sus descuentos. Cuenta solo los productos con costo registrado${act.margen.sinCosto ? ` (${act.margen.sinCosto} línea${act.margen.sinCosto === 1 ? "" : "s"} sin costo no cuenta${act.margen.sinCosto === 1 ? "" : "n"})` : ""}.`,
            onClick: () => abrir({ titulo: `Margen: ${dinero(act.margen.ganancia)} de ganancia sobre ${dinero(act.margen.ingreso)}`, valor: pct(act.margen.porcentaje), icono: Percent, columnas: lineas, filas: lineasMargen, abrirEn: d.ventas() }),
          }, act.margen.porcentaje ?? undefined, ant.margen.porcentaje ?? null, { puntos: true })}
          {verCosto && tarjeta({
            titulo: "Rotación", valor: veces(act.rotacion.valor),
            ayuda: "Cuántas veces se renovó el inventario en el período: el costo de lo vendido dividido entre el inventario promedio a costo (el promedio entre lo que había al empezar y al terminar). Más veces = el dinero en mercadería se mueve más rápido.",
            onClick: () => abrir({ titulo: `Costo de lo vendido ÷ inventario promedio: ${dinero(act.margen.costo)} ÷ ${dinero(act.rotacion.promedio)}`, valor: veces(act.rotacion.valor), icono: RefreshCw, columnas: lineas, filas: lineasMargen, abrirEn: d.ventas() }),
          }, act.rotacion.valor ?? undefined, ant.rotacion.valor ?? null, { baseMinima: 1, formato: (n) => String(n) })}
          {tarjeta({
            titulo: `Monturas sin venderse en ${DIAS_SIN_VENDER} días`, valor: act.sinVender.length,
            ayuda: `Monturas activas con existencia al cierre del período que no se venden desde hace ${DIAS_SIN_VENDER} días o más, o que nunca se vendieron (las registradas hace menos de ${DIAS_SIN_VENDER} días no cuentan). Conviene ofrecerlas o rebajarlas.`,
            onClick: () => abrir({ titulo: `Monturas sin venderse en ${DIAS_SIN_VENDER} días: ${act.sinVender.length}`, valor: act.sinVender.length, icono: Archive, columnas: COL_SIN_VENDER, filas: act.sinVender, abrirEn }),
          }, act.sinVender.length, ant.sinVender.length, { buenoSiSube: false, baseMinima: 5 })}
        </div>
      </Seccion>

      <Seccion titulo="Qué se vende">
        <Caja titulo="Productos más vendidos" ayuda="Monturas y accesorios con más unidades vendidas en el período, sin los comprobantes anulados. Los nombres son los del inventario."
          exportar={r.bloque("Productos más vendidos (inventario)",
            () => ({ columnas: [col("Producto", (p) => p.nombre), col("Unidades", (p) => p.unidades, "entero"), col("Ingreso", (p) => p.ingreso, "dinero"), ...(verCosto ? [col("Ganancia", (p) => p.ganancia ?? 0, "dinero")] : [])], filas: act.masVendidas }),
            () => ({ columnas: lineas, filas: act.filas }))}>
          {act.masVendidas.length === 0 ? (
            <SinResultados texto="No se vendieron monturas ni accesorios en este período. Prueba con otro período." acciones={[{ etiqueta: "Ver este año", onClick: () => r.setPeriodo("anio") }]} />
          ) : (
            <BarrasLista ancho="w-56" anchoValor="w-44"
              filas={act.masVendidas.map((p) => ({ id: p.id, etiqueta: p.nombre, valor: p.unidades, texto: `${p.unidades} u. · ${dinero(p.ingreso)}`, tip: `${p.nombre}: ${p.unidades} unidad${p.unidades === 1 ? "" : "es"} por ${dinero(p.ingreso)}`, p }))}
              onElegir={(x) => abrir({ titulo: `Producto · ${x.p.nombre}`, valor: x.p.unidades, icono: Package, columnas: lineas, filas: x.p.filas, abrirEn: d.ventas() })} />
          )}
        </Caja>
      </Seccion>
    </>
  )
}
