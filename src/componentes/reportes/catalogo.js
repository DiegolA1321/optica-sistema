// Todo lo que se puede exportar de Reportes, ordenado por módulo (la pestaña a la que pertenece). Cada reporte sabe para qué sirve, si es
// "a hoy" (no sigue las fechas) y cómo armar su archivo. Las fechas elegidas en la ventana Exportar mandan sobre los reportes del período.
import { col } from "./listas"
import { puede } from "../../utilidades/permisosUi"
import { etiquetaEstadoCita } from "../../utilidades/estadosCita"
import { coincideSeguimiento, responsableDeCita } from "../../utilidades/filtrosCitas"
import { nombreDeMiembro } from "../../utilidades/equipo"
import { diagnosticosPorMes } from "../../utilidades/reportesDiagnosticos"
import { nombreMes } from "../../utilidades/formatoFecha"
import { enRango, mesesDelRango } from "../../utilidades/reportesPeriodo"
import { metricasDelPeriodo, resumenLaboratorios } from "../../utilidades/reportesDatos"
import { movimientosDelRango } from "../../utilidades/reportesInventario"
import { etiquetaOrigenCita } from "../../utilidades/filtrosCitas"
import { lineasDeProducto, masVendidas, monturasSinVender, DIAS_SIN_VENDER } from "../../utilidades/inventarioKardex"
import { modeloDeLista, modeloVentasContador, modeloSinFacturaElectronica, modeloCobros, modeloCampana, modeloInventario, modeloOrdenesPendientes } from "../../utilidades/reportesExcel"

export const MODULOS = [
  { id: "resumen", etiqueta: "Resumen" },
  { id: "citas", etiqueta: "Citas" },
  { id: "clinico", etiqueta: "Clínico" },
  { id: "ventas", etiqueta: "Ventas" },
  { id: "laboratorios", etiqueta: "Laboratorios" },
  { id: "inventario", etiqueta: "Inventario" },
]

const MESES = Array.from({ length: 12 }, (_, i) => i)

// r: el contexto de Reportes. rango: las fechas de la exportación. opciones: { incluirNoCompraron }.
export function catalogoExportaciones(r, rango, { incluirNoCompraron = false } = {}) {
  const { datos, f, cols, ocultarMontos, propio, usuario, equipo, historial } = r
  const montos = !ocultarMontos
  const verInventario = !propio && !ocultarMontos && puede(usuario, "inventario", "ver")
  const verCosto = puede(usuario, "inventario", "editar")
  const delRango = (m) => metricasDelPeriodo(f, datos, m)
  const lista = (titulo, columnas, filas, personal = true) => modeloDeLista({ titulo, columnas, filas, rango, personal })
  const profesional = (c) => (responsableDeCita(c) ? nombreDeMiembro(equipo, responsableDeCita(c)) || "Persona que ya no está en el equipo" : "Sin asignar")
  const citasEnRango = f.citas.filter((c) => enRango(c.fecha, rango))
  const meses = mesesDelRango(rango)
  const pdf = (modulo, nombre) => ({ id: `pdf-${modulo}`, modulo, nombre: "Esta pestaña en PDF", linea: `La pestaña ${nombre} tal como se ve, con el período y los filtros en el encabezado, para presentar el desempeño. Se abre la impresión: elige “Guardar como PDF”.`, formato: "PDF", pdf: true })

  const items = [
    // ── Resumen ──
    { id: "resumen-meses", modulo: "resumen", nombre: "Resumen mes a mes", linea: "Consultas, pacientes nuevos, citas, citas no efectuadas y lo vendido y cobrado de cada mes del período.",
      modelo: () => lista("Resumen mes a mes", [col("Mes", (m) => m.etiqueta), col("Consultas", (m) => m.m.cons.length, "entero"), col("Pacientes nuevos", (m) => m.m.nuevos.length, "entero"), col("Citas", (m) => m.m.programadas.length, "entero"), col("No efectuadas", (m) => m.m.noAsistio.length, "entero"), col("Tasa de citas no efectuadas", (m) => m.m.tasaInasist, "tasa"), ...(montos ? [col("Vendido", (m) => m.m.vc.vendido, "dinero"), col("Cobrado", (m) => m.m.vc.cobrado, "dinero")] : [])], meses.map((x) => ({ ...x, m: delRango(x) })), false) },
    pdf("resumen", "Resumen"),

    // ── Citas ──
    { id: "citas-detalle", modulo: "citas", nombre: "Citas del período", linea: "Todas las citas con su paciente, motivo, origen, visita, profesional y estado.",
      modelo: () => lista("Citas del período", [
        col("Fecha", (c) => c.fecha, "fecha"), col("Hora", (c) => c.hora), col("Paciente", (c) => c.paciente), col("Cédula", (c) => c.cedula), col("Teléfono", (c) => c.telefono), col("Motivo", (c) => c.motivo),
        col("Origen", (c) => etiquetaOrigenCita(c.origen)), col("Visita", (c) => (coincideSeguimiento(c, "primera", historial) ? "Primera vez" : "Seguimiento")),
        col("Profesional", profesional), col("Estado", (c) => etiquetaEstadoCita(c.estado)), col("Cancelada por", (c) => (c.estado !== "Cancelada" ? "" : c.canceladaPor === "paciente" ? "El paciente" : "La óptica")),
      ], [...citasEnRango].sort((a, b) => (a.fecha + a.hora < b.fecha + b.hora ? -1 : 1))) },
    { id: "citas-inasistencias", modulo: "citas", nombre: "Citas no efectuadas para reagendar", linea: "Las citas que no se efectuaron, con el teléfono del paciente, para contactarlo.",
      modelo: () => lista("Citas no efectuadas del período", [col("Fecha", (c) => c.fecha, "fecha"), col("Hora", (c) => c.hora), col("Paciente", (c) => c.paciente), col("Teléfono", (c) => c.telefono), col("Motivo", (c) => c.motivo), col("Profesional", profesional)], citasEnRango.filter((c) => c.estado === "No Asistió")) },
    { id: "citas-tasa-mes", modulo: "citas", nombre: "Citas no efectuadas mes a mes", linea: "Cuántas citas hubo cada mes y qué porcentaje no se efectuó.",
      modelo: () => lista("Citas no efectuadas mes a mes", [col("Mes", (x) => x.etiqueta), col("Citas", (x) => x.m.programadas.length, "entero"), col("Atendidas", (x) => x.m.atendidas.length, "entero"), col("No efectuadas", (x) => x.m.noAsistio.length, "entero"), col("Canceladas", (x) => x.m.canceladas.length, "entero"), col("Tasa de citas no efectuadas", (x) => x.m.tasaInasist, "tasa")], meses.map((x) => ({ ...x, m: delRango(x) })), false) },
    pdf("citas", "Citas"),

    // ── Clínico ──
    { id: "consultas-detalle", modulo: "clinico", nombre: "Consultas del período", linea: "Cada consulta con su paciente, motivo, diagnóstico y profesional.",
      modelo: () => lista("Consultas del período", [col("Fecha", (c) => c.fecha, "fecha"), col("Paciente", (c) => cols.nombre(c.pacienteId, c.paciente)), col("Cédula", (c) => datos.pacientes.find((p) => p.id === c.pacienteId)?.cedula || ""), ...cols.consulta.slice(2), col("Profesional", (c) => c.profesionalNombre || ""), col("Próximo control (días)", (c) => c.proximoControlDias || null, "entero")], f.consultas.filter((c) => enRango(c.fecha, rango))) },
    { id: "diagnosticos-mes", modulo: "clinico", nombre: "Diagnósticos por mes", linea: `Pacientes con cada diagnóstico, mes a mes, del año ${rango.fin.slice(0, 4)}.`,
      modelo: () => { const anio = Number(rango.fin.slice(0, 4)); return { ...lista(`Diagnósticos por mes en ${anio}`, [col("Diagnóstico", (x) => x.diagnostico), ...MESES.map((m) => col(nombreMes(m, "corto"), (x) => x.meses[m], "entero")), col("Año", (x) => x.anio, "entero")], diagnosticosPorMes(f.consultas, anio).filas, false), archivo: `diagnosticos-por-mes-${anio}` } } },
    { id: "campana", modulo: "clinico", nombre: "Pacientes para campaña", linea: "Los pacientes con control vencido y su teléfono, para contactarlos.", aHoy: true, opcion: montos ? "noCompraron" : null,
      modelo: () => modeloCampana({ pacientes: f.pacientes, historial, pases: datos.pases, facturas: datos.facturas, incluirNoCompraron: incluirNoCompraron && montos }) },
    pdf("clinico", "Clínico"),

    // ── Ventas ──
    { id: "contador", modulo: "ventas", nombre: "Ventas para el contador", linea: "Todas las ventas con lo cobrado, el método de pago y la factura electrónica, y los totales por método. Para el IVA y el anexo de ventas.", visible: montos,
      modelo: () => modeloVentasContador({ facturas: datos.facturas, abonos: datos.abonos, pacientes: datos.pacientes, rango }) },
    { id: "sinfe", modulo: "ventas", nombre: "Ventas sin factura electrónica", linea: "Las ventas que todavía no tienen su factura electrónica, para emitirlas antes de declarar.", visible: montos,
      modelo: () => modeloSinFacturaElectronica({ facturas: datos.facturas, pacientes: datos.pacientes, rango }) },
    { id: "cobros", modulo: "ventas", nombre: "Cobros del período", linea: "El dinero que entró, con su método y la venta a la que corresponde. Para cuadrar la caja.", visible: montos,
      modelo: () => modeloCobros({ facturas: datos.facturas, abonos: datos.abonos, pacientes: datos.pacientes, rango }) },
    { ...pdf("ventas", "Ventas"), visible: montos },

    // ── Laboratorios ──
    { id: "ordenes", modulo: "laboratorios", nombre: "Órdenes pendientes por laboratorio", linea: "Las órdenes abiertas de cada laboratorio, con las atrasadas primero. Para reclamar los atrasos.", aHoy: true, visible: montos,
      modelo: () => modeloOrdenesPendientes({ ordenes: datos.ordenes, pacientes: datos.pacientes, hoy: r.hoy }) },
    { id: "labs-desempeno", modulo: "laboratorios", nombre: "Desempeño de cada laboratorio", linea: "Órdenes abiertas y atrasadas, entregadas a tiempo y tiempo promedio de entrega.", visible: montos,
      modelo: () => lista("Desempeño de los laboratorios", [col("Laboratorio", (l) => l.laboratorio), col("Abiertas (hoy)", (l) => l.abiertas, "entero"), col("Atrasadas (hoy)", (l) => l.atrasadas, "entero"), col("Entregadas en el período", (l) => l.entregadas, "entero"), col("Entregadas a tiempo", (l) => l.pctATiempo, "tasa"), col("Promedio de entrega (días)", (l) => (l.promedioDias == null ? null : Math.round(l.promedioDias * 10) / 10), "decimal")], resumenLaboratorios(datos.ordenes, rango, r.hoy), false) },
    pdf("laboratorios", "Laboratorios"),

    // ── Inventario ──
    { id: "inventario", modulo: "inventario", nombre: "Inventario actual", linea: "Producto, categoría, código, existencia, precio y valor (a costo si lo puedes ver), con una columna «Contado» en blanco. Para el conteo físico.", aHoy: true, visible: verInventario,
      modelo: () => modeloInventario({ inventario: r.inventario, conCosto: verCosto }) },
    { id: "inventario-movimientos", modulo: "inventario", nombre: "Movimientos del período", linea: "Cada ingreso, venta, anulación, ajuste, merma, devolución y conteo, con su cantidad, lo que quedó, el motivo y quién lo hizo.", visible: verInventario,
      modelo: () => lista("Movimientos de inventario", [col("Fecha", (m) => m.creadoEn, "fecha"), col("Producto", (m) => m.producto), col("Categoría", (m) => m.categoria), col("Movimiento", (m) => m.etiqueta), col("Cantidad", (m) => m.cantidad, "entero"), col("Quedó", (m) => m.stockResultante, "entero"), col("Motivo", (m) => m.motivo), col("Quién", (m) => m.usuarioNombre || "Sistema")],
        movimientosDelRango(r.movimientos || [], r.inventario, rango).filter((m) => m.tipo !== "saldo_inicial")) },
    { id: "inventario-ventas", modulo: "inventario", nombre: "Ventas y margen por producto", linea: "Unidades, ingreso, costo y ganancia de cada producto vendido en el período, con la existencia de hoy. Para decidir qué comprar.", visible: verInventario && verCosto,
      modelo: () => lista("Ventas y margen por producto", [col("Producto", (p) => p.nombre), col("Categoría", (p) => p.producto?.categoria || ""), col("Unidades vendidas", (p) => p.unidades, "entero"), col("Ingreso", (p) => p.ingreso, "dinero"), col("Costo", (p) => (p.conCosto ? p.costo : null), "dinero"), col("Ganancia", (p) => p.ganancia, "dinero"), col("Existencia hoy", (p) => Number(p.producto?.stock) || 0, "entero")],
        masVendidas(lineasDeProducto(datos.facturas, rango, r.inventario), 100000), false) },
    { id: "inventario-sinventa", modulo: "inventario", nombre: "Monturas sin venderse", linea: `Las monturas con existencia que no se venden desde hace ${DIAS_SIN_VENDER} días (hasta el último día de las fechas), con su última venta. Para ofrecerlas o rebajarlas.`, visible: verInventario,
      modelo: () => lista(`Monturas sin venderse en ${DIAS_SIN_VENDER} días`, [col("Monturas", (f) => f.producto.nombre), col("Código", (f) => f.producto.codigo || ""), col("Existencia", (f) => f.existencia, "entero"), col("Última venta", (f) => f.ultimaVenta || "", "fecha"), col("Precio", (f) => Number(f.producto.precio) || 0, "dinero"), col("Valor a precio", (f) => f.valor, "dinero")],
        monturasSinVender({ productos: r.inventario, facturas: datos.facturas, movimientos: r.movimientos || [], fechaISO: rango.fin }), false) },
    { ...pdf("inventario", "Inventario"), visible: verInventario },
  ]
  return items.filter((x) => x.visible !== false)
}

