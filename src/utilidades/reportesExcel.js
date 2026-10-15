// Reportes: los siete reportes que se pueden sacar, cada uno armado para un propósito. Aquí solo se arman los datos (modelos) y la
// hoja de Excel; la pantalla los pide desde "Exportar". Números y fechas salen como números y fechas (no como texto), con el ancho
// de columna que alcanza para que nada quede cortado y una fila de totales donde corresponde.
import { formatoFecha, hora, fechaLegible } from "./formatoFecha"
import { ahoraEcuador } from "./horaEcuador"
import { registrarLog } from "./logs"
import { numeroComprobante } from "./comprobantes"
import { numeroOrden, ETIQUETA_ESTADO, estaAtrasada, diasDeAtraso, ordenesAbiertas } from "./ordenesLaboratorio"
import { diasVencido } from "./fidelizacion"
import { pacientesQueNoCompraron } from "./pasesVenta"
import { pagosDeFacturas, nombreMetodo, saldoDeFactura } from "./reportesDatos"
import { cobradoDeFactura } from "./vendidoCobrado"
import { diaDe, enRango } from "./reportesPeriodo"
import { SIN_INDICAR, nombreMetodoCobro, textoPagos } from "./pagos"

const redondear = (n) => Math.round((Number(n) || 0) * 100) / 100

// Una fecha "AAAA-MM-DD" o un instante → un Date a medianoche UTC (Excel guarda días; así no se corre un día en ninguna zona).
export function fechaExcel(valor) {
  const d = diaDe(valor)
  if (!d) return null
  const [a, m, dd] = d.split("-").map(Number)
  return new Date(Date.UTC(a, m - 1, dd))
}

export const ENCABEZADO_FILAS = 7 // óptica, reporte, período, filtros, generado, nota (o vacía) y una fila en blanco

// ─── Los datos de cada reporte (modelos) ───
// ctx: { pacientes, abonos, rango }
const nombreDe = (pacientes, id, respaldo = "") => pacientes.find((p) => p.id === id)?.nombre || respaldo || ""
const cedulaDe = (pacientes, id) => pacientes.find((p) => p.id === id)?.cedula || ""

const estadoVenta = (f) => (f.estado === "anulada" ? "ANULADA" : f.estado === "pendiente_pago" ? "Con saldo" : "Pagada")

// 1. Ventas del período para el contador: todas las ventas (las anuladas marcadas), con totales por método de pago.
export function modeloVentasContador({ facturas, abonos, pacientes, rango }) {
  const delPeriodo = facturas.filter((f) => enRango(f.creadoEn, rango)).sort((a, b) => (a.numero ?? 0) - (b.numero ?? 0))
  const filas = delPeriodo.map((f) => {
    const cobrado = f.estado === "anulada" ? 0 : cobradoDeFactura(f, abonos)
    return {
      anulada: f.estado === "anulada",
      celdas: [numeroComprobante(f.numero), fechaExcel(f.creadoEn), nombreDe(pacientes, f.pacienteId), cedulaDe(pacientes, f.pacienteId), Number(f.montoTotal) || 0, cobrado, saldoDeFactura(f, cobrado), nombreMetodo(f.metodoPago), f.facturaElectronica || "", estadoVenta(f)],
    }
  })
  const vigentes = delPeriodo.filter((f) => f.estado !== "anulada")
  const porMetodo = new Map()
  for (const f of vigentes) {
    const clave = nombreMetodo(f.metodoPago)
    const x = porMetodo.get(clave) || { n: 0, total: 0, cobrado: 0 }
    x.n++; x.total += Number(f.montoTotal) || 0; x.cobrado += cobradoDeFactura(f, abonos)
    porMetodo.set(clave, x)
  }
  return {
    archivo: `ventas-contador-${rango.inicio}-a-${rango.fin}`, hoja: "Ventas", titulo: "Ventas del período, para el contador",
    nota: "Todas las ventas del período, sin importar los demás filtros. Las anuladas van marcadas y no suman en los totales.",
    columnas: [
      { titulo: "Comprobante", tipo: "texto" }, { titulo: "Fecha", tipo: "fecha" }, { titulo: "Paciente", tipo: "texto" }, { titulo: "Cédula", tipo: "texto" },
      { titulo: "Total", tipo: "dinero", suma: true }, { titulo: "Cobrado", tipo: "dinero", suma: true }, { titulo: "Saldo", tipo: "dinero", suma: true },
      { titulo: "Método de pago", tipo: "texto" }, { titulo: "Factura electrónica", tipo: "texto" }, { titulo: "Estado", tipo: "texto" },
    ],
    filas,
    bloques: [{
      titulo: "Totales por método de pago (sin anuladas)",
      columnas: [{ titulo: "Método de pago", tipo: "texto" }, { titulo: "Ventas", tipo: "entero" }, { titulo: "Total", tipo: "dinero" }, { titulo: "Cobrado", tipo: "dinero" }],
      filas: [...porMetodo.entries()].map(([m, x]) => [m, x.n, redondear(x.total), redondear(x.cobrado)]),
    }],
    personal: true,
  }
}

// 2. Ventas sin factura electrónica: para emitirlas antes de declarar.
export function modeloSinFacturaElectronica({ facturas, pacientes, rango }) {
  const filas = facturas
    .filter((f) => f.estado !== "anulada" && enRango(f.creadoEn, rango) && !String(f.facturaElectronica || "").trim())
    .sort((a, b) => (a.numero ?? 0) - (b.numero ?? 0))
    .map((f) => ({ celdas: [numeroComprobante(f.numero), fechaExcel(f.creadoEn), nombreDe(pacientes, f.pacienteId), cedulaDe(pacientes, f.pacienteId), pacientes.find((p) => p.id === f.pacienteId)?.correo || "", Number(f.montoTotal) || 0, nombreMetodo(f.metodoPago)] }))
  return {
    archivo: `ventas-sin-factura-electronica-${rango.inicio}-a-${rango.fin}`, hoja: "Sin factura electrónica", titulo: "Ventas sin factura electrónica",
    nota: "Ventas del período (sin anuladas) que todavía no tienen su factura electrónica registrada. Todas, sin importar los demás filtros.",
    columnas: [
      { titulo: "Comprobante", tipo: "texto" }, { titulo: "Fecha", tipo: "fecha" }, { titulo: "Paciente", tipo: "texto" }, { titulo: "Cédula", tipo: "texto" },
      { titulo: "Correo", tipo: "texto" }, { titulo: "Total", tipo: "dinero", suma: true }, { titulo: "Método de pago", tipo: "texto" },
    ],
    filas, bloques: [], personal: true,
  }
}

// 3. Cobros del período: el dinero que entró entre esas fechas (aunque sea de una venta anterior), para cuadrar la caja.
export function modeloCobros({ facturas, abonos, pacientes, rango }) {
  const pagos = pagosDeFacturas(facturas, abonos).filter((p) => enRango(p.fecha, rango))
  const porMetodo = new Map()
  // Cómo se pagó cada cobro (una o varias formas de pago). Lo anterior a las formas de pago dice lo que decía la venta ("Pago directo", "Abonos"…).
  const sinFormas = (p) => p.pagos.every((x) => x.metodo === SIN_INDICAR)
  const filas = pagos.map((p) => {
    const metodo = sinFormas(p) ? nombreMetodo(p.factura?.metodoPago) : textoPagos(p.pagos)
    for (const x of p.pagos) { const clave = x.metodo === SIN_INDICAR ? nombreMetodo(p.factura?.metodoPago) : nombreMetodoCobro(x.metodo); porMetodo.set(clave, redondear((porMetodo.get(clave) || 0) + x.monto)) }
    return { celdas: [fechaExcel(p.fecha), nombreDe(pacientes, p.factura?.pacienteId), numeroComprobante(p.factura?.numero), redondear(p.monto), metodo, p.esAbono ? "Abono" : "Pago de la venta"] }
  })
  return {
    archivo: `cobros-${rango.inicio}-a-${rango.fin}`, hoja: "Cobros", titulo: "Cobros del período",
    nota: "Dinero recibido entre esas fechas, incluso de ventas anteriores. No sigue los demás filtros.",
    columnas: [
      { titulo: "Fecha", tipo: "fecha" }, { titulo: "Paciente", tipo: "texto" }, { titulo: "Comprobante", tipo: "texto" },
      { titulo: "Monto", tipo: "dinero", suma: true }, { titulo: "Forma de pago", tipo: "texto" }, { titulo: "Concepto", tipo: "texto" },
    ],
    filas,
    bloques: [{ titulo: "Totales por método de pago", columnas: [{ titulo: "Método de pago", tipo: "texto" }, { titulo: "Cobrado", tipo: "dinero" }], filas: [...porMetodo.entries()] }],
    personal: true,
  }
}

// 4. Pacientes para campaña: con control vencido y, si se pide, los que consultaron y no compraron. Con su teléfono.
export function modeloCampana({ pacientes, historial, pases, facturas, incluirNoCompraron = false }) {
  const filas = []
  const yaEsta = new Set()
  for (const p of pacientes) {
    const dias = diasVencido(p, historial)
    if (dias == null || dias < 0) continue
    const ultima = historial.filter((c) => c.pacienteId === p.id).map((c) => c.fecha).sort().pop()
    yaEsta.add(p.id)
    filas.push({ celdas: [p.nombre, p.telefono || "", p.correo || "", `Control vencido hace ${dias} día${dias === 1 ? "" : "s"}`, fechaExcel(ultima || p.fechaRegistro), dias], orden: -dias })
  }
  if (incluirNoCompraron) {
    for (const [pacienteId, { motivo, fecha }] of pacientesQueNoCompraron(pases, facturas)) {
      if (yaEsta.has(pacienteId)) continue
      const p = pacientes.find((x) => x.id === pacienteId)
      if (!p) continue
      filas.push({ celdas: [p.nombre, p.telefono || "", p.correo || "", `Consultó y no compró: ${motivo.charAt(0).toLowerCase()}${motivo.slice(1)}`, fechaExcel(fecha), null], orden: 1 })
    }
  }
  filas.sort((a, b) => a.orden - b.orden || a.celdas[0].localeCompare(b.celdas[0]))
  return {
    archivo: `pacientes-para-campana`, hoja: "Campaña", titulo: incluirNoCompraron ? "Pacientes para campaña (control vencido y no compraron)" : "Pacientes para campaña (control vencido)",
    nota: "Estado de hoy. Sigue el motivo, el origen, la visita y el profesional elegidos.",
    columnas: [
      { titulo: "Paciente", tipo: "texto" }, { titulo: "Teléfono", tipo: "texto" }, { titulo: "Correo", tipo: "texto" }, { titulo: "Por qué contactarlo", tipo: "texto" },
      { titulo: "Última visita", tipo: "fecha" }, { titulo: "Días de retraso", tipo: "entero" },
    ],
    filas, bloques: [], personal: true, sinPeriodo: true, cuenta: "pacientes",
  }
}

// 5. Inventario actual: para el conteo físico.
export function modeloInventario({ inventario }) {
  const activos = inventario.filter((p) => p.activo !== false)
    .sort((a, b) => (a.categoria || "").localeCompare(b.categoria || "") || a.nombre.localeCompare(b.nombre))
  return {
    archivo: `inventario-actual`, hoja: "Inventario", titulo: "Inventario actual",
    nota: "Productos activos con su existencia de hoy, para el conteo físico.",
    columnas: [
      { titulo: "Producto", tipo: "texto" }, { titulo: "Categoría", tipo: "texto" }, { titulo: "Existencia", tipo: "entero", suma: true },
      { titulo: "Precio", tipo: "dinero" }, { titulo: "Valor", tipo: "dinero", suma: true },
    ],
    filas: activos.map((p) => ({ celdas: [p.nombre, p.categoria || "", Number(p.stock) || 0, Number(p.precio) || 0, redondear((Number(p.stock) || 0) * (Number(p.precio) || 0))] })),
    bloques: [], personal: false, sinPeriodo: true, sinFiltros: true, cuenta: "productos",
  }
}

// 6. Órdenes pendientes por laboratorio: para reclamar los atrasos.
export function modeloOrdenesPendientes({ ordenes, pacientes, hoy = ahoraEcuador() }) {
  const abiertas = ordenesAbiertas(ordenes)
  const filas = abiertas
    .map((o) => ({ o, atraso: diasDeAtraso(o, hoy) }))
    .sort((a, b) => (a.o.laboratorio || "~").localeCompare(b.o.laboratorio || "~") || b.atraso - a.atraso || (a.o.fechaPrometida || "").localeCompare(b.o.fechaPrometida || ""))
    .map(({ o, atraso }) => ({
      celdas: [o.laboratorio || "Sin laboratorio", numeroOrden(o.numero), nombreDe(pacientes, o.pacienteId), pacientes.find((p) => p.id === o.pacienteId)?.telefono || "", fechaExcel(o.creadaEn), fechaExcel(o.fechaPrometida), atraso, estaAtrasada(o, hoy) ? ETIQUETA_ESTADO.atrasada : ETIQUETA_ESTADO[o.estado] || o.estado],
    }))
  return {
    archivo: `ordenes-pendientes-laboratorio`, hoja: "Órdenes pendientes", titulo: "Órdenes pendientes por laboratorio",
    nota: "Órdenes enviadas o listas que aún no se entregan, con las atrasadas primero dentro de cada laboratorio. Estado de hoy.",
    columnas: [
      { titulo: "Laboratorio", tipo: "texto" }, { titulo: "Orden", tipo: "texto" }, { titulo: "Paciente", tipo: "texto" }, { titulo: "Teléfono", tipo: "texto" },
      { titulo: "Enviada", tipo: "fecha" }, { titulo: "Prometida", tipo: "fecha" }, { titulo: "Días de atraso", tipo: "entero" }, { titulo: "Estado", tipo: "texto" },
    ],
    filas, bloques: [], personal: true, sinPeriodo: true, sinFiltros: true, cuenta: "órdenes",
  }
}

// ─── De un modelo a la hoja de Excel ───
const FORMATO = { dinero: "[$$-409]#,##0.00", fecha: "dd/mm/yyyy", entero: "0", tasa: '0"%"', decimal: "0.0" }

// El texto con que se vería una celda, para calcular el ancho de la columna.
const textoDeCelda = (v, tipo) => {
  if (v == null) return ""
  if (tipo === "fecha") return "00/00/0000"
  if (tipo === "dinero") return `$${Number(v).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
  return String(v)
}

const celda = (v, tipo, extra = {}) => {
  if (v == null || v === "") return null
  if (tipo === "fecha") return { value: v, type: Date, format: FORMATO.fecha, align: "left", ...extra }
  if (tipo === "dinero") return { value: v, type: Number, format: FORMATO.dinero, align: "right", ...extra }
  if (tipo === "entero" || tipo === "tasa" || tipo === "decimal") return { value: v, type: Number, format: FORMATO[tipo], align: "right", ...extra }
  return { value: String(v), type: String, ...extra }
}

// ctx: { opticaNombre, usuarioNombre, rango, filtrosTexto, ahora }
export function modeloAHoja(modelo, ctx) {
  const ahora = ctx.ahora || ahoraEcuador()
  const generado = `${formatoFecha(ahora, "medio")}, ${hora(ahora)}`
  const encabezado = [
    [{ value: ctx.opticaNombre || "Óptica", type: String, fontWeight: "bold", fontSize: 14 }],
    [{ value: modelo.titulo, type: String, fontWeight: "bold", fontSize: 12 }],
    [{ value: modelo.sinPeriodo ? "Período: estado de hoy" : `Período: ${fechaLegible(ctx.rango.inicio)} a ${fechaLegible(ctx.rango.fin)}`, type: String }],
    [{ value: modelo.sinFiltros ? "Filtros: no aplica" : `Filtros: ${ctx.filtrosTexto || "ninguno"}`, type: String }],
    [{ value: `Generado: ${generado} · por ${ctx.usuarioNombre || "Usuario"}`, type: String }],
    modelo.nota ? [{ value: modelo.nota, type: String, textColor: "#475569" }] : [],
    [],
  ]
  const filaTitulos = modelo.columnas.map((c) => ({ value: c.titulo, type: String, fontWeight: "bold", backgroundColor: "#E2E8F0", align: c.tipo === "texto" || c.tipo === "fecha" || !c.tipo ? "left" : "right" }))
  const cuerpo = modelo.filas.map((f) => modelo.columnas.map((c, i) => celda(f.celdas[i], c.tipo, f.anulada ? { textColor: "#94A3B8", textDecoration: { strikethrough: true } } : {})))
  const filas = [...encabezado, filaTitulos, ...cuerpo]
  const hayTotales = modelo.columnas.some((c) => c.suma)
  if (hayTotales) {
    const vigentes = modelo.filas.filter((f) => !f.anulada)
    filas.push(modelo.columnas.map((c, i) => {
      if (i === 0) return { value: `Total (${vigentes.length} ${modelo.cuenta || "ventas"})`, type: String, fontWeight: "bold", topBorderStyle: "thin" }
      if (!c.suma) return { value: "", type: String, topBorderStyle: "thin" }
      return celda(redondear(vigentes.reduce((s, f) => s + (Number(f.celdas[i]) || 0), 0)), c.tipo, { fontWeight: "bold", topBorderStyle: "thin" })
    }))
  } else if (modelo.cuenta) {
    filas.push([{ value: `Total: ${modelo.filas.length} ${modelo.cuenta}`, type: String, fontWeight: "bold", topBorderStyle: "thin" }])
  }
  for (const b of modelo.bloques || []) {
    filas.push([], [{ value: b.titulo, type: String, fontWeight: "bold" }])
    filas.push(b.columnas.map((c) => ({ value: c.titulo, type: String, fontWeight: "bold", backgroundColor: "#E2E8F0", align: c.tipo === "texto" ? "left" : "right" })))
    for (const f of b.filas) filas.push(b.columnas.map((c, i) => celda(f[i], c.tipo)))
  }
  // Ancho: lo más largo de cada columna (título o contenido), sin pasar de 48 ni bajar de 10.
  const ancho = modelo.columnas.map((c, i) => {
    let max = c.titulo.length + 2
    for (const f of modelo.filas) max = Math.max(max, textoDeCelda(f.celdas[i], c.tipo).length + 2)
    for (const b of modelo.bloques || []) if (b.columnas[i]) { max = Math.max(max, b.columnas[i].titulo.length + 2); for (const f of b.filas) max = Math.max(max, textoDeCelda(f[i], b.columnas[i].tipo).length + 2) }
    return { width: Math.min(48, Math.max(10, max)) }
  })
  // La nota y el título del encabezado son largos: no deben ensanchar la primera columna (se desbordan a la derecha).
  return { data: filas, columns: ancho, stickyRowsCount: encabezado.length + 1 }
}

// Escribe el archivo y, si lleva datos de personas, deja el registro en la actividad (quién y cuándo).
export async function descargarModelo(modelo, ctx) {
  const { default: writeExcelFile } = await import("write-excel-file/browser")
  const { data, columns, stickyRowsCount } = modeloAHoja(modelo, ctx)
  await writeExcelFile(data, { sheet: modelo.hoja, columns, stickyRowsCount }).toFile(`${modelo.archivo}.xlsx`)
  if (modelo.personal && ctx.usuario) registrarLog(ctx.usuario, "reportes", "descargó un reporte con datos de pacientes", `${modelo.titulo} · ${modelo.filas.length} ${modelo.cuenta || "filas"}`)
}


// Cualquier lista de una ventana de detalle como reporte: las mismas columnas, con fechas, importes y cantidades como tales y los totales donde suman.
const quitarTildes = (t) => String(t).normalize("NFD").replace(/[̀-ͯ]/g, "")
export function modeloDeLista({ titulo, valor, columnas, filas, rango, personal = true }) {
  const cols = columnas.map((c) => ({ titulo: c.titulo, tipo: c.tipo || "texto", suma: c.tipo === "dinero" || c.tipo === "entero" }))
  return {
    archivo: `${quitarTildes(titulo).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60)}-${rango.inicio}-a-${rango.fin}`,
    hoja: titulo.slice(0, 31).replace(/[\\/?*[\]:]/g, " "),
    titulo: valor == null || valor === "" ? titulo : `${titulo} (${valor})`,
    columnas: cols,
    filas: filas.map((f) => ({ anulada: !!f.__anulada, celdas: columnas.map((c) => { const v = c.crudo ? c.crudo(f) : c.valor(f); return c.tipo === "fecha" ? fechaExcel(v) : v }) })),
    bloques: [], personal, cuenta: "filas",
  }
}
