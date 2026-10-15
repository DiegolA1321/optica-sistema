// Reportes › Inventario: los números de un período y del anterior, y las listas detrás de cada uno. Lógica pura, sin pantalla.
// Todo sale de los productos activos (los mismos que cuenta Inventario), de los comprobantes vigentes (los mismos que cuenta Ventas)
// y del kárdex (para saber cuánto había en una fecha).
import { sumarDiasISO } from "./controles"
import {
  valorACostoEn, lineasDeProducto, margenDeLoVendido, rotacion, masVendidas, monturasSinVender, inicioDelKardex, etiquetaMovimiento, DIAS_SIN_VENDER,
} from "./inventarioKardex"
import { enRango } from "./reportesPeriodo"

// Las métricas de UN tramo (el período o el anterior).
export function metricasInventarioDe({ productos, facturas, movimientos, tramo }) {
  const filas = lineasDeProducto(facturas, tramo, productos)
  const margen = margenDeLoVendido(filas)
  const inicial = valorACostoEn(productos, movimientos, sumarDiasISO(tramo.inicio, -1))
  const final = valorACostoEn(productos, movimientos, tramo.fin)
  return {
    filas, margen, inicial, final,
    rotacion: rotacion({ costoVendido: margen.costo, valorInicial: inicial.valor, valorFinal: final.valor }),
    sinVender: monturasSinVender({ productos, facturas, movimientos, fechaISO: tramo.fin }),
    masVendidas: masVendidas(filas),
    unidades: filas.reduce((s, x) => s + x.cantidad, 0),
  }
}

export function metricasInventario({ productos = [], facturas = [], movimientos = [], rango, previo }) {
  const activos = productos.filter((p) => p.activo !== false)
  const datos = { productos: activos, facturas, movimientos }
  return {
    act: metricasInventarioDe({ ...datos, tramo: rango }),
    ant: metricasInventarioDe({ ...datos, tramo: previo }),
    // Desde cuándo hay kárdex: antes de ese día la existencia es la que había al empezar (no se conocen los movimientos anteriores).
    kardexDesde: inicioDelKardex(movimientos),
    dias: DIAS_SIN_VENDER,
  }
}

// Los movimientos que caen en un rango, del más antiguo al más reciente, con el nombre del producto (para exportar).
export function movimientosDelRango(movimientos = [], productos = [], rango) {
  const nombre = new Map(productos.map((p) => [p.id, p]))
  return movimientos
    .filter((m) => enRango(m.creadoEn, rango))
    .sort((a, b) => (a.creadoEn === b.creadoEn ? (a.seq || 0) - (b.seq || 0) : a.creadoEn < b.creadoEn ? -1 : 1))
    .map((m) => ({ ...m, producto: nombre.get(m.productoId)?.nombre || "Producto eliminado", etiqueta: etiquetaMovimiento(m.tipo), categoria: nombre.get(m.productoId)?.categoria || "" }))
}
