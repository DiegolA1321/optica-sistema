import { describe, it, expect, vi, beforeEach } from "vitest"
import { unzipSync, strFromU8 } from "fflate"
import writeExcelFile from "write-excel-file/node"
import { modeloVentasContador, modeloSinFacturaElectronica, modeloCobros, modeloCampana, modeloInventario, modeloOrdenesPendientes, modeloAHoja, modeloDeLista, descargarModelo, fechaExcel, ENCABEZADO_FILAS } from "./reportesExcel"
import { encabezadoPdf } from "./reportesPdf"

const registrarLog = vi.fn()
vi.mock("./logs", () => ({ registrarLog: (...a) => registrarLog(...a) }))
const toFile = vi.fn(async () => {})
const writeMock = vi.fn(() => ({ toFile }))
vi.mock("write-excel-file/browser", () => ({ default: (...a) => writeMock(...a) }))

const rango = { inicio: "2026-10-01", fin: "2026-10-31" }
const pacientes = [
  { id: "p1", nombre: "Ana Pérez", cedula: "1700000001", telefono: "0991111111", correo: "ana@x.com" },
  { id: "p2", nombre: "Beto Ríos", cedula: "1700000002", telefono: "0992222222", correo: "" },
]
const facturas = [
  { id: "f1", numero: 1, pacienteId: "p1", estado: "pagada", montoTotal: 100, creadoEn: "2026-10-02T10:00:00-05:00", metodoPago: "tarjeta", facturaElectronica: "001-001-000000001" },
  { id: "f2", numero: 2, pacienteId: "p2", estado: "pendiente_pago", montoTotal: 200, creadoEn: "2026-10-05T10:00:00-05:00", metodoPago: "abonos", facturaElectronica: "" },
  { id: "f3", numero: 3, pacienteId: "p1", estado: "anulada", montoTotal: 999, creadoEn: "2026-10-06T10:00:00-05:00", metodoPago: "directo", facturaElectronica: "" },
  { id: "f4", numero: 4, pacienteId: "p2", estado: "pagada", montoTotal: 50, creadoEn: "2026-09-20T10:00:00-05:00", metodoPago: "directo", facturaElectronica: "" }, // septiembre
]
const abonos = [
  { id: "a1", facturaId: "f2", monto: 60, fecha: "2026-10-05", creadoEn: "2026-10-05T10:00:00Z" },
  { id: "a2", facturaId: "f2", monto: 40, fecha: "2026-10-20", creadoEn: "2026-10-20T10:00:00Z" },
  { id: "a3", facturaId: "f4", monto: 10, fecha: "2026-10-03", creadoEn: "2026-10-03T10:00:00Z" }, // abono de octubre a una venta de septiembre
]
const ctx = { opticaNombre: "Óptica Demo", usuarioNombre: "Diego Alarcón", rango, filtrosTexto: "Origen: Web", ahora: new Date(2026, 9, 12, 20, 5), usuario: { id: "u1", opticaId: "o1", nombre: "Diego Alarcón" } }

beforeEach(() => { registrarLog.mockClear(); toFile.mockClear(); writeMock.mockClear() })

describe("Excel: ventas del período, para el contador", () => {
  const m = modeloVentasContador({ facturas, abonos, pacientes, rango })
  it("trae todas las ventas del período con las anuladas marcadas, y deja fuera las de otro mes", () => {
    expect(m.filas.map((f) => f.celdas[0])).toEqual(["CV-0001", "CV-0002", "CV-0003"])
    expect(m.filas.map((f) => f.anulada)).toEqual([false, false, true])
    expect(m.filas[2].celdas.at(-1)).toBe("ANULADA")
  })
  it("cada fila lleva comprobante, fecha, paciente, cédula, total, cobrado, saldo, método, factura electrónica y estado", () => {
    expect(m.columnas.map((c) => c.titulo)).toEqual(["Comprobante", "Fecha", "Paciente", "Cédula", "Total", "Cobrado", "Saldo", "Método de pago", "Factura electrónica", "Estado"])
    expect(m.filas[1].celdas).toEqual(["CV-0002", fechaExcel("2026-10-05"), "Beto Ríos", "1700000002", 200, 100, 100, "Abonos", "", "Con saldo"])
  })
  it("los totales por método de pago no suman las anuladas", () => {
    expect(m.bloques[0].filas).toEqual([["Tarjeta", 1, 100, 100], ["Abonos", 1, 200, 100]])
  })
  it("la hoja tiene el encabezado, números y fechas como tales, y una fila de totales sin las anuladas", () => {
    const h = modeloAHoja(m, ctx)
    expect(h.data[0][0].value).toBe("Óptica Demo")
    const texto = h.data.slice(0, ENCABEZADO_FILAS).flat().map((c) => c?.value)
    expect(texto).toContain("Ventas del período, para el contador")
    expect(texto).toContain("Período: 1 oct 2026 a 31 oct 2026")
    expect(texto).toContain("Filtros: Origen: Web")
    expect(texto).toContain("Generado: 12 oct 2026, 08:05 PM · por Diego Alarcón")
    const titulos = h.data[ENCABEZADO_FILAS]
    expect(titulos.map((c) => c.value)).toEqual(m.columnas.map((c) => c.titulo))
    const primera = h.data[ENCABEZADO_FILAS + 1]
    expect(primera[1]).toMatchObject({ type: Date, value: fechaExcel("2026-10-02"), format: "dd/mm/yyyy" })
    expect(primera[4]).toMatchObject({ type: Number, value: 100, format: "[$$-409]#,##0.00" })
    const totales = h.data[ENCABEZADO_FILAS + 1 + m.filas.length]
    expect(totales[0].value).toBe("Total (2 ventas)")
    expect(totales[4].value).toBe(300)
    expect(totales[5].value).toBe(200)
    expect(totales[6].value).toBe(100)
    expect(h.stickyRowsCount).toBe(ENCABEZADO_FILAS + 1)
  })
  it("el ancho de cada columna alcanza para su título y su contenido", () => {
    const h = modeloAHoja(m, ctx)
    m.columnas.forEach((c, i) => expect(h.columns[i].width).toBeGreaterThanOrEqual(c.titulo.length + 2))
    expect(h.columns[2].width).toBeGreaterThanOrEqual("Beto Ríos".length)
    expect(h.columns[8].width).toBeGreaterThanOrEqual("Factura electrónica".length)
  })
})

describe("Excel: el archivo de verdad", () => {
  it("las fechas y los importes quedan como fecha y número en el .xlsx, con las columnas anchas", async () => {
    const h = modeloAHoja(modeloVentasContador({ facturas, abonos, pacientes, rango }), ctx)
    const buffer = await writeExcelFile(h.data, { sheet: "Ventas", columns: h.columns, stickyRowsCount: h.stickyRowsCount }).toBuffer()
    const archivos = unzipSync(new Uint8Array(buffer))
    const hoja = strFromU8(archivos["xl/worksheets/sheet1.xml"])
    const estilos = strFromU8(archivos["xl/styles.xml"])
    expect(hoja).toMatch(/<col [^>]*width="/)
    expect(hoja).toContain("pane") // los títulos quedan fijos
    expect(estilos).toContain("dd/mm/yyyy")
    expect(hoja).not.toMatch(/t="s"[^>]*><v>\$/) // no hay importes como texto "$100.00"
    // La fecha 2026-10-02 es el número de serie 46297 de Excel (días desde 1900), no un texto.
    expect(hoja).toContain("<v>46297</v>")
    expect(hoja).toContain("<v>100</v>")
  })
})

describe("Excel: ventas sin factura electrónica", () => {
  it("solo las vigentes del período sin número de factura, con total", () => {
    const m = modeloSinFacturaElectronica({ facturas, pacientes, rango })
    expect(m.filas.map((f) => f.celdas[0])).toEqual(["CV-0002"])
    expect(m.filas[0].celdas).toContain("1700000002")
    const total = modeloAHoja(m, ctx).data.at(-1)
    expect(total[5].value).toBe(200)
  })
})

describe("Excel: cobros del período", () => {
  const m = modeloCobros({ facturas, abonos, pacientes, rango })
  it("trae el dinero que entró en octubre, incluso de una venta de septiembre, y deja fuera lo de otros meses", () => {
    const filas = m.filas.map((f) => [f.celdas[2], f.celdas[3], f.celdas[5]])
    expect(filas).toContainEqual(["CV-0001", 100, "Pago de la venta"])
    expect(filas).toContainEqual(["CV-0002", 60, "Abono"])
    expect(filas).toContainEqual(["CV-0002", 40, "Abono"])
    expect(filas).toContainEqual(["CV-0004", 10, "Abono"]) // venta de septiembre, abono de octubre
    expect(filas.some((f) => f[0] === "CV-0003")).toBe(false) // anulada
    expect(filas.find((f) => f[0] === "CV-0004" && f[2] === "Pago de la venta")).toBeUndefined() // el pago de septiembre no es de octubre
  })
  it("los totales por método de pago suman el total general", () => {
    const total = modeloAHoja(m, ctx).data.find((f) => f[0]?.value?.startsWith?.("Total ("))[3].value
    expect(total).toBe(210)
    expect(m.bloques[0].filas.reduce((s, [, v]) => s + v, 0)).toBe(total)
  })
})

describe("Excel: pacientes para campaña", () => {
  const consultas = [{ id: "c1", pacienteId: "p1", fecha: "2026-01-10", proximoControlDias: 60 }, { id: "c2", pacienteId: "p2", fecha: "2099-01-01", proximoControlDias: 90 }]
  const pases = [{ id: 1, pacienteId: "p2", estado: "descartado", motivoDescarte: "precio", cerradaEn: "2026-10-02T10:00:00Z" }]
  it("trae a los de control vencido con su teléfono", () => {
    const m = modeloCampana({ pacientes, historial: consultas, pases: [], facturas: [] })
    expect(m.filas.map((f) => [f.celdas[0], f.celdas[1]])).toEqual([["Ana Pérez", "0991111111"]])
    expect(m.filas[0].celdas[3]).toMatch(/^Control vencido hace \d+ días$/)
  })
  it("como opción, suma a los que consultaron y no compraron, con su motivo", () => {
    const m = modeloCampana({ pacientes, historial: consultas, pases, facturas: [], incluirNoCompraron: true })
    expect(m.filas.map((f) => f.celdas[0])).toEqual(["Ana Pérez", "Beto Ríos"])
    expect(m.filas[1].celdas[3]).toBe("Consultó y no compró: por el precio")
  })
})

describe("Excel: inventario y órdenes pendientes", () => {
  it("el inventario trae producto, categoría, código, existencia, precio y valor, con totales y una columna 'Contado' en blanco, y deja fuera lo inactivo", () => {
    const m = modeloInventario({ inventario: [{ nombre: "Montura B", categoria: "Monturas", stock: 3, precio: 40 }, { nombre: "Montura A", categoria: "Monturas", codigo: "A-1", stock: 2, precio: 25.5 }, { nombre: "Viejo", categoria: "Otros", stock: 9, precio: 1, activo: false }] })
    expect(m.columnas.map((c) => c.titulo)).toEqual(["Producto", "Categoría", "Código", "Existencia", "Precio", "Valor a precio", "Contado"])
    expect(m.filas.map((f) => f.celdas)).toEqual([["Montura A", "Monturas", "A-1", 2, 25.5, 51, ""], ["Montura B", "Monturas", "", 3, 40, 120, ""]])
    const total = modeloAHoja(m, ctx).data.find((f) => f[0]?.value?.startsWith?.("Total ("))
    expect([total[3].value, total[5].value]).toEqual([5, 171])
  })
  it("con permiso para ver el costo y algún costo registrado, trae el costo y el valor a costo; sin costo no agrega columnas", () => {
    const inventario = [{ nombre: "A", categoria: "Monturas", stock: 2, precio: 25, costo: 10 }, { nombre: "B", categoria: "Monturas", stock: 3, precio: 40 }]
    const m = modeloInventario({ inventario, conCosto: true })
    expect(m.columnas.map((c) => c.titulo)).toEqual(["Producto", "Categoría", "Código", "Existencia", "Precio", "Valor a precio", "Costo", "Valor a costo", "Contado"])
    expect(m.filas.map((f) => f.celdas.slice(6, 8))).toEqual([[10, 20], [null, null]])
    expect(modeloInventario({ inventario, conCosto: false }).columnas).toHaveLength(7)
    expect(modeloInventario({ inventario: [{ nombre: "B", stock: 3, precio: 40 }], conCosto: true }).columnas).toHaveLength(7)
  })
  it("los pedidos pendientes van con los atrasados primero, su entrega y los días de atraso", () => {
    const hoy = new Date(2026, 9, 12)
    const m = modeloOrdenesPendientes({
      pacientes, hoy,
      ordenes: [
        { id: 1, numero: 1, pacienteId: "p1", entrega: "envio", estado: "enviada", creadaEn: "2026-10-01T10:00:00-05:00", fechaPrometida: "2026-10-20" },
        { id: 2, numero: 2, pacienteId: "p2", estado: "enviada", creadaEn: "2026-10-01T10:00:00-05:00", fechaPrometida: "2026-10-08" },
        { id: 3, numero: 3, pacienteId: "p1", estado: "lista", creadaEn: "2026-10-01T10:00:00-05:00", fechaPrometida: "2026-10-30" },
        { id: 4, numero: 4, pacienteId: "p1", estado: "entregada", creadaEn: "2026-10-01T10:00:00-05:00", fechaPrometida: "2026-10-09" },
      ],
    })
    expect(m.filas.map((f) => [f.celdas[0], f.celdas[1], f.celdas[6], f.celdas[7]])).toEqual([["Retira en la óptica", "OL-0002", 4, "Atrasado"], ["Envío a domicilio", "OL-0001", 0, "En proceso"], ["Retira en la óptica", "OL-0003", 0, "Listo"]])
  })
})

describe("Excel: permisos y registro de la descarga", () => {
  it("un reporte con datos de pacientes queda registrado en la actividad; el inventario no", async () => {
    await descargarModelo(modeloVentasContador({ facturas, abonos, pacientes, rango }), ctx)
    expect(toFile).toHaveBeenCalledWith(expect.stringMatching(/^ventas-contador-2026-10-01-a-2026-10-31\.xlsx$/))
    expect(registrarLog).toHaveBeenCalledTimes(1)
    expect(registrarLog.mock.calls[0][1]).toBe("reportes")
    await descargarModelo(modeloInventario({ inventario: [{ nombre: "A", stock: 1, precio: 2 }] }), ctx)
    expect(registrarLog).toHaveBeenCalledTimes(1)
  })
})

describe("Excel: cualquier lista de una ventana", () => {
  it("lleva las mismas columnas, con fechas e importes como tales y totales donde suman", () => {
    const columnas = [
      { titulo: "Fecha", valor: () => "5 oct 2026", tipo: "fecha", crudo: (f) => f.fecha },
      { titulo: "Paciente", valor: (f) => f.n },
      { titulo: "Total", valor: () => "$10.00", tipo: "dinero", crudo: (f) => f.t },
    ]
    const m = modeloDeLista({ titulo: "Vendido: 2 ventas", valor: "$30.00", columnas, filas: [{ fecha: "2026-10-05", n: "Ana", t: 10 }, { fecha: "2026-10-06", n: "Beto", t: 20 }], rango })
    expect(m.archivo).toBe("vendido-2-ventas-2026-10-01-a-2026-10-31")
    expect(m.filas[0].celdas).toEqual([fechaExcel("2026-10-05"), "Ana", 10])
    const h = modeloAHoja(m, ctx)
    expect(h.data.at(-1)[2].value).toBe(30)
    expect(h.data[ENCABEZADO_FILAS + 1][0]).toMatchObject({ type: Date })
  })
})

describe("PDF del período", () => {
  it("el encabezado lleva la óptica, la pestaña, el período, los filtros y quién lo generó", () => {
    const e = encabezadoPdf({ opticaNombre: "Óptica Demo", pestana: "Ventas", rango, filtros: "Origen: Web", usuarioNombre: "Diego Alarcón", ahora: new Date(2026, 9, 12, 20, 5) })
    expect(e).toEqual({ optica: "Óptica Demo", titulo: "Reporte de Ventas", periodo: "Período: 1 oct 2026 a 31 oct 2026", filtros: "Filtros: Origen: Web", generado: "Generado: 12 oct 2026, 08:05 PM · por Diego Alarcón" })
  })
})
