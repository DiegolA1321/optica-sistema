import React from "react"
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from "vitest"
import { render, screen, within, fireEvent, cleanup } from "@testing-library/react"
// Sin base de datos: la pestaña Inventario pide el kárdex y las pruebas nunca deben tocar una base real (aunque haya un .env.local).
vi.mock("../lib/supabaseClient", () => ({ supabase: null }))
import Reportes from "./Reportes"

// 12 de octubre de 2026 por la noche en Ecuador (01:00 UTC del 13): "este mes" es octubre, el mes de Ecuador, sea cual sea la zona del equipo.
const INSTANTE = "2026-10-12T20:00:00-05:00"
beforeAll(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(INSTANTE)) })
afterAll(() => { vi.useRealTimers() })
afterEach(cleanup)

const admin = { id: "u1", rol: "admin", nombre: "Ana", opticaId: "o1", opticaNombre: "Óptica Demo" }
const paula = { id: "u2", rol: "asistente", nombre: "Paula", opticaId: "o1", esOptometra: true }
const pacientes = [
  { id: "p1", nombre: "Ana Pérez", cedula: "1700000001", telefono: "0991111111", fechaRegistro: "2026-10-02", fecha_nacimiento: "1990-01-01", estadoCorreccion: "Bien corregido" },
  { id: "p2", nombre: "Beto Ríos", cedula: "1700000002", telefono: "0992222222", fechaRegistro: "2026-10-05", fecha_nacimiento: "1950-01-01", estadoCorreccion: "Requiere ajuste" },
  { id: "p3", nombre: "Cris Vera", cedula: "1700000003", telefono: "0993333333", fechaRegistro: "2026-05-05", estadoCorreccion: "Sin evaluar", estadoClinico: "De alta" },
]
const consultas = [
  { id: "k1", pacienteId: "p1", fecha: "2026-10-02", motivo: "Consulta General", od: { esfera: "-1.00" }, oi: {}, diagnosticoCategorias: ["Miopía"], profesionalId: "u2", citaId: "c1", proximoControlDias: 90 },
  { id: "k2", pacienteId: "p2", fecha: "2026-10-05", motivo: "Examen de Control", od: { esfera: "-2.00" }, oi: {}, diagnosticoCategorias: ["Presbicia"], profesionalId: "u2", citaId: "c2", proximoControlDias: 90 },
  { id: "k3", pacienteId: "p1", fecha: "2026-09-04", motivo: "Consulta General", od: {}, oi: {}, diagnosticoCategorias: ["Miopía"], profesionalId: "u2", proximoControlDias: 30 },
]
const citas = [
  { id: "c1", pacienteId: "p1", paciente: "Ana Pérez", fecha: "2026-10-02", hora: "09:00 AM", estado: "Atendida", origen: "paciente", motivo: "Consulta General", asignadoA: "u2", atendidoPor: "u2" },
  { id: "c2", pacienteId: "p2", paciente: "Beto Ríos", fecha: "2026-10-05", hora: "10:00 AM", estado: "Atendida", origen: "staff", motivo: "Examen de Control", asignadoA: "u2", atendidoPor: "u2" },
  { id: "c3", pacienteId: "p3", paciente: "Cris Vera", fecha: "2026-10-06", hora: "10:00 AM", estado: "No Asistió", origen: "paciente", motivo: "Consulta General", asignadoA: "u2" },
  { id: "c4", pacienteId: "p3", paciente: "Cris Vera", fecha: "2026-10-07", hora: "10:00 AM", estado: "Cancelada", canceladaPor: "paciente", origen: "staff", motivo: "Consulta General", asignadoA: "u2" },
  { id: "c5", pacienteId: "p1", paciente: "Ana Pérez", fecha: "2026-09-08", hora: "09:00 AM", estado: "No Asistió", origen: "staff", motivo: "Consulta General", asignadoA: "u2" },
]
const facturasVenta = [
  { id: "f1", numero: 1, pacienteId: "p1", consultaId: "k1", estado: "pagada", montoTotal: 100, creadoEn: "2026-10-02T15:00:00-05:00", metodoPago: "tarjeta", facturaElectronica: "", lineas: [{ tipo: "luna", cantidad: 1, precioUnitario: 60, descripcion: "Luna", detalle: { tipo_lente: "monofocal" } }, { tipo: "producto", cantidad: 1, precioUnitario: 40, descripcion: "Montura A" }] },
  { id: "f2", numero: 2, pacienteId: "p2", consultaId: "k2", estado: "pendiente_pago", montoTotal: 223, creadoEn: "2026-10-12T19:30:00-05:00", metodoPago: "abonos", facturaElectronica: "001-001-000000009", lineas: [] }, // hoy por la noche en Ecuador (00:30 UTC del 13): es de hoy
  { id: "f3", numero: 3, pacienteId: "p2", estado: "pendiente_pago", montoTotal: 200, creadoEn: "2026-10-05T11:00:00-05:00", metodoPago: "abonos", facturaElectronica: "", lineas: [] },
]
const abonos = [{ id: "a1", facturaId: "f3", monto: 50, fecha: "2026-10-06", creadoEn: "2026-10-06T10:00:00Z" }]
const datos = { pacientes, consultas, citas, facturasVenta, abonos, pases: [], ordenesLab: [], inventario: [{ id: "i1", nombre: "Montura A", categoria: "Monturas", stock: 3, precio: 40 }], equipo: [{ id: "u2", nombre: "Paula" }] }

const botonesLista = () => screen.getAllByRole("button", { name: /\. Ver la lista$/ }).map((b) => b.getAttribute("aria-label"))
const tarjeta = (nombre) => screen.getByRole("button", { name: new RegExp(`^${nombre}: `) })
const ventana = () => screen.getByRole("dialog")
const pestana = (nombre) => fireEvent.click(screen.getByRole("tab", { name: nombre }))

describe("Reportes: el Resumen responde cómo le fue a la óptica", () => {
  it("tiene seis tarjetas en el orden del recorrido y compara con el mismo tramo del mes anterior", () => {
    render(<Reportes usuario={admin} {...datos} />)
    const nombres = botonesLista().slice(0, 6).map((t) => t.split(":")[0])
    expect(nombres).toEqual(["Consultas realizadas", "Pacientes nuevos", "Tasa de inasistencia", "Tasa de captación", "Vendido", "Ingreso por consulta"])
    expect(screen.getAllByText("vs. 1 al 12 sept").length).toBe(6)
  })

  it("el administrador ve lo vendido en octubre, con la venta de hoy por la noche incluida (día de Ecuador)", () => {
    render(<Reportes usuario={admin} {...datos} />)
    expect(tarjeta("Vendido")).toHaveAccessibleName("Vendido: $523.00. Ver la lista")
  })

  it("cada número abre su lista: la ventana muestra el mismo número y tantas filas como dice", () => {
    render(<Reportes usuario={admin} {...datos} />)
    fireEvent.click(tarjeta("Consultas realizadas"))
    expect(within(ventana()).getByText("2", { selector: "[data-detalle-valor]" })).toBeInTheDocument()
    expect(within(ventana()).getAllByRole("row")).toHaveLength(1 + 2) // títulos + 2 consultas de octubre
    fireEvent.keyDown(ventana(), { key: "Escape" })
    fireEvent.click(tarjeta("Vendido"))
    expect(within(ventana()).getByText("$523.00", { selector: "[data-detalle-valor]" })).toBeInTheDocument()
    expect(within(ventana()).getAllByRole("row")).toHaveLength(1 + 3)
    expect(within(ventana()).getByRole("columnheader", { name: "Comprobante" })).toBeInTheDocument()
    expect(within(ventana()).queryByRole("columnheader", { name: "Cédula" })).not.toBeInTheDocument() // solo lo esencial
  })

  it("desde el Resumen la ventana ofrece abrir el módulo con el mismo período y la pestaña que lo detalla", () => {
    const abrir = vi.fn()
    render(<Reportes usuario={admin} {...datos} onAbrirModulo={abrir} />)
    fireEvent.click(tarjeta("Vendido"))
    fireEvent.click(within(ventana()).getByRole("button", { name: /^Abrir en Ventas/ }))
    expect(abrir).toHaveBeenCalledWith("ventas", expect.objectContaining({ tab: "comprobantes", estado: "todos", desde: "2026-10-01", hasta: "2026-10-12" }))
    fireEvent.click(tarjeta("Vendido"))
    fireEvent.click(within(ventana()).getByRole("button", { name: /Ir a la pestaña Ventas/ }))
    expect(screen.getByRole("tab", { name: "Ventas" })).toHaveAttribute("aria-selected", "true")
  })

  it("cada indicador tiene su ⓘ con la definición y no hay párrafos dentro de las tarjetas", () => {
    render(<Reportes usuario={admin} {...datos} />)
    expect(screen.getByRole("button", { name: /^Qué es Tasa de captación: De los pacientes atendidos con receta/ })).toBeInTheDocument()
    expect(document.querySelectorAll("[data-reportes] p").length).toBeLessThan(4) // la pregunta de la pestaña y poco más
  })
})

describe("Reportes: Ventas", () => {
  it("'Cobrado' abre los pagos (no las ventas) y suma exactamente lo cobrado; 'Saldo pendiente' es lo que falta", () => {
    render(<Reportes usuario={admin} {...datos} />)
    pestana("Ventas")
    expect(tarjeta("Cobrado")).toHaveAccessibleName("Cobrado: $150.00. Ver la lista") // venta 1 pagada (100) + abono de la venta 3 (50); la venta 2 no tiene pagos todavía
    fireEvent.click(tarjeta("Cobrado"))
    const filas = within(ventana()).getAllByRole("row").slice(1)
    expect(filas).toHaveLength(2) // el pago de la venta 1 y el abono de la venta 3
    expect(within(ventana()).getByRole("columnheader", { name: "Monto" })).toBeInTheDocument()
    expect(within(ventana()).getByRole("columnheader", { name: "Método" })).toBeInTheDocument()
  })

  it("el embudo cuenta a los atendidos con receta y la tasa de captación de Resumen es la misma", () => {
    render(<Reportes usuario={admin} {...datos} />)
    expect(tarjeta("Tasa de captación")).toHaveAccessibleName("Tasa de captación: 100%. Ver la lista") // 2 atendidos con receta, 2 compraron (f1 y f2)
    pestana("Ventas")
    expect(screen.getByRole("button", { name: /^Compraron: 2 de 2 atendidos con receta \(100%\)/ })).toBeInTheDocument()
  })

  it("las ventas sin factura electrónica se pueden abrir y llevan a Ventas con ese filtro", () => {
    const abrir = vi.fn()
    render(<Reportes usuario={admin} {...datos} onAbrirModulo={abrir} />)
    pestana("Ventas")
    fireEvent.click(tarjeta("Sin factura electrónica"))
    expect(within(ventana()).getAllByRole("row")).toHaveLength(1 + 2) // f1 y f3
    fireEvent.click(within(ventana()).getByRole("button", { name: /^Abrir en Ventas/ }))
    expect(abrir).toHaveBeenCalledWith("ventas", expect.objectContaining({ sinFE: true, estado: "todos" }))
  })
})

describe("Reportes: Citas", () => {
  it("las citas se reparten en atendidas, no asistió y pendientes; las canceladas van aparte", () => {
    render(<Reportes usuario={admin} {...datos} />)
    pestana("Citas")
    expect(tarjeta("Citas")).toHaveAccessibleName("Citas: 3. Ver la lista")
    expect(tarjeta("Atendidas")).toHaveAccessibleName("Atendidas: 2. Ver la lista")
    expect(tarjeta("No asistió")).toHaveAccessibleName("No asistió: 1. Ver la lista")
    expect(tarjeta("Canceladas")).toHaveAccessibleName("Canceladas: 1. Ver la lista")
    expect(tarjeta("Tasa de inasistencia")).toHaveAccessibleName("Tasa de inasistencia: 33%. Ver la lista")
  })

  it("filtrar por origen Web cambia los números, se ve como etiqueta y 'Abrir en Citas' lleva el mismo filtro", () => {
    const abrir = vi.fn()
    render(<Reportes usuario={admin} {...datos} onAbrirModulo={abrir} />)
    pestana("Citas")
    fireEvent.change(screen.getByRole("combobox", { name: "Origen" }), { target: { value: "paciente" } })
    expect(screen.getByRole("list", { name: "Filtros activos" })).toHaveTextContent("Origen: Web")
    expect(tarjeta("Citas")).toHaveAccessibleName("Citas: 2. Ver la lista") // c1 y c3
    fireEvent.click(tarjeta("Citas"))
    fireEvent.click(within(ventana()).getByRole("button", { name: /^Abrir en Citas/ }))
    expect(abrir).toHaveBeenCalledWith("citas", expect.objectContaining({ estado: "todas", origen: "paciente", desde: "2026-10-01", hasta: "2026-10-12" }))
  })

  it("el administrador ve las citas por profesional; el optómetra no ve ese filtro ni esa tabla", () => {
    render(<Reportes usuario={admin} {...datos} />)
    pestana("Citas")
    expect(screen.getByRole("heading", { name: "Por profesional" })).toBeInTheDocument()
    expect(screen.getByRole("combobox", { name: "Profesional" })).toBeInTheDocument()
    cleanup()
    render(<Reportes usuario={paula} soloLoPropio verMontos={false} {...datos} />)
    pestana("Citas")
    expect(screen.queryByRole("heading", { name: "Por profesional" })).not.toBeInTheDocument()
    expect(screen.queryByRole("combobox", { name: "Profesional" })).not.toBeInTheDocument()
  })

  it("la cuadrícula día × hora muestra las inasistencias y se pulsa", () => {
    render(<Reportes usuario={admin} {...datos} />)
    pestana("Citas")
    fireEvent.click(screen.getByRole("button", { name: /Mar 10:00 AM: 1 no asistió de 1 cita/ }))
    expect(within(ventana()).getAllByRole("row")).toHaveLength(2)
  })
})

describe("Reportes: Clínico", () => {
  it("lo que es 'a hoy' lo dice y la lista de control vencido es la de Pacientes", () => {
    render(<Reportes usuario={admin} {...datos} />)
    pestana("Clínico")
    expect(screen.getAllByText("A hoy").length).toBeGreaterThanOrEqual(2)
    expect(tarjeta("Tratamientos finalizados")).toHaveAccessibleName("Tratamientos finalizados: 1. Ver la lista")
    // p1 consultó el 2 oct con control a 90 días; p2 el 5 oct: ninguno vencido hoy.
    expect(tarjeta("Control vencido")).toHaveAccessibleName("Control vencido: 0. Ver la lista")
  })

  it("los diagnósticos por mes dejan elegir el año y por edad reparten por grupo", () => {
    render(<Reportes usuario={admin} {...datos} />)
    pestana("Clínico")
    expect(screen.getByRole("combobox", { name: "Año de los diagnósticos" })).toHaveValue("2026")
    const tabla = screen.getByRole("table", { name: "Diagnósticos por mes en 2026" })
    expect(within(tabla).getByRole("columnheader", { name: "oct" })).toBeInTheDocument()
    expect(screen.getByRole("table", { name: "Diagnósticos por grupo de edad" })).toBeInTheDocument()
  })
})

describe("Reportes: roles, vacíos y filtros", () => {
  it("el optómetra ve solo lo suyo: sin pestaña Ventas y sin montos", () => {
    render(<Reportes usuario={paula} soloLoPropio facturasVenta={facturasVenta} abonos={abonos} />)
    expect(screen.queryByRole("tab", { name: "Ventas" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^Vendido: / })).not.toBeInTheDocument()
    expect(screen.getByRole("list", { name: "Filtros activos" })).toHaveTextContent("Solo tus consultas y tus citas")
  })
  it("el administrador no ve la etiqueta de 'solo lo tuyo'", () => {
    render(<Reportes usuario={admin} {...datos} />)
    expect(screen.queryByText("Solo tus consultas y tus citas")).not.toBeInTheDocument()
  })
  it("sin datos lo dice y lleva a registrar el primer paciente", () => {
    const pedidos = []
    render(<Reportes usuario={admin} onRegistrarPaciente={() => pedidos.push("crear")} />)
    expect(screen.getByText("Todavía no hay datos para mostrar")).toBeInTheDocument()
    screen.getByRole("button", { name: /Registrar el primer paciente/ }).click()
    expect(pedidos).toEqual(["crear"])
  })
  it("sin citas la pestaña lo dice y dice qué hacer, en lugar de quedar vacía", () => {
    render(<Reportes usuario={admin} pacientes={pacientes} />)
    pestana("Citas")
    expect(screen.getByRole("status")).toHaveTextContent(/Todavía no hay citas registradas/)
    expect(screen.getByRole("button", { name: "Ir a Citas médicas" })).toBeInTheDocument()
  })
  it("'Personalizado' ofrece dos fechas con el calendario del sistema, no los campos del navegador", () => {
    render(<Reportes usuario={admin} {...datos} />)
    fireEvent.click(screen.getByRole("button", { name: "Personalizado" }))
    expect(document.querySelector("input[type=date]")).toBeNull()
    expect(screen.getByRole("button", { name: /Desde/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Hasta/ })).toBeInTheDocument()
  })
  it("los filtros activos se quitan con su 'x' y con 'Limpiar filtros'", () => {
    render(<Reportes usuario={admin} {...datos} />)
    fireEvent.change(screen.getByRole("combobox", { name: "Motivo de consulta" }), { target: { value: "Examen de Control" } })
    const etiquetas = screen.getByRole("list", { name: "Filtros activos" })
    expect(etiquetas).toHaveTextContent("Motivo: Examen de Control")
    fireEvent.click(within(etiquetas).getByRole("button", { name: /Quitar el filtro Motivo/ }))
    expect(etiquetas).not.toHaveTextContent("Motivo:")
  })
  it("el motivo de consulta acota las consultas del período (R61)", () => {
    render(<Reportes usuario={admin} {...datos} />)
    expect(tarjeta("Consultas realizadas")).toHaveAccessibleName("Consultas realizadas: 2. Ver la lista")
    fireEvent.change(screen.getByRole("combobox", { name: "Motivo de consulta" }), { target: { value: "Examen de Control" } })
    expect(tarjeta("Consultas realizadas")).toHaveAccessibleName("Consultas realizadas: 1. Ver la lista")
  })
})

describe("Reportes: Exportar", () => {
  const abrirExportar = (usuario = admin, extra = {}) => { render(<Reportes usuario={usuario} {...datos} {...extra} />); fireEvent.click(screen.getByRole("button", { name: "Exportar" })); return within(ventana()) }
  const modulo = (v, nombre) => fireEvent.click(v.getByRole("tab", { name: new RegExp("^" + nombre) }))

  it("está ordenado por módulo, con las mismas pestañas de Reportes, y cada reporte dice para qué sirve", () => {
    const v = abrirExportar()
    expect(v.getAllByRole("tab").map((t) => t.textContent.replace(/\d+$/, ""))).toEqual(["Resumen", "Citas", "Clínico", "Ventas", "Laboratorios", "Inventario"])
    modulo(v, "Citas")
    for (const t of ["Citas del período", "Inasistencias para reagendar", "Inasistencia mes a mes", "Esta pestaña en PDF"]) expect(v.getByText(t)).toBeInTheDocument()
    modulo(v, "Clínico")
    for (const t of ["Consultas del período", "Diagnósticos por mes", "Pacientes para campaña"]) expect(v.getByText(t)).toBeInTheDocument()
    modulo(v, "Ventas")
    expect(v.getByText(/Para el IVA y el anexo de ventas/)).toBeInTheDocument()
    expect(v.getByText(/Para cuadrar la caja/)).toBeInTheDocument()
    expect(v.queryByText("Inventario actual")).not.toBeInTheDocument() // ya no está en Ventas
    modulo(v, "Laboratorios")
    expect(v.getByText("Órdenes pendientes por laboratorio")).toBeInTheDocument()
    modulo(v, "Inventario")
    for (const t of ["Inventario actual", "Movimientos del período", "Ventas y margen por producto", "Monturas sin venderse"]) expect(v.getByText(t)).toBeInTheDocument()
    expect(v.getByText(/Para el conteo físico/)).toBeInTheDocument()
  })

  it("se pueden marcar varios reportes, también de módulos distintos, y el botón dice cuántos", () => {
    const v = abrirExportar()
    expect(v.getByRole("button", { name: "Exportar" })).toBeDisabled() // nada marcado todavía
    modulo(v, "Citas")
    fireEvent.click(v.getByRole("checkbox", { name: "Citas del período" }))
    expect(v.getByRole("button", { name: "Exportar" })).toBeEnabled()
    fireEvent.click(v.getByRole("checkbox", { name: "Inasistencia mes a mes" }))
    modulo(v, "Ventas")
    fireEvent.click(v.getByRole("checkbox", { name: "Cobros del período" }))
    expect(v.getByRole("button", { name: "Exportar (3)" })).toBeEnabled()
    expect(v.getByRole("tab", { name: /^Citas2/ })).toBeInTheDocument() // cada módulo dice cuántos lleva marcados
    fireEvent.click(v.getByRole("button", { name: /^Marcar todos los de Ventas/ }))
    expect(v.getByRole("button", { name: /^Exportar \(/ })).toBeEnabled()
  })

  it("solo se puede marcar un PDF a la vez", () => {
    const v = abrirExportar()
    fireEvent.click(v.getByRole("checkbox", { name: "Esta pestaña en PDF" }))
    modulo(v, "Citas")
    fireEvent.click(v.getByRole("checkbox", { name: "Esta pestaña en PDF" }))
    expect(v.getByRole("button", { name: "Exportar" })).toBeEnabled() // quedó uno solo
  })

  it("se pueden elegir otras fechas, con el calendario del sistema", () => {
    const v = abrirExportar()
    expect(v.getByRole("button", { name: /Las de la pantalla · 1 oct a 12 oct 2026/ })).toBeInTheDocument()
    fireEvent.click(v.getByRole("button", { name: "Elegir otras fechas" }))
    expect(v.getByRole("button", { name: /Exportar desde/ })).toBeInTheDocument()
    expect(v.getByRole("button", { name: /Exportar hasta/ })).toBeInTheDocument()
  })

  it("quien no ve montos no ve los reportes de ventas ni cobros, pero sí los de citas y clínico", () => {
    const v = abrirExportar(paula, { soloLoPropio: true })
    expect(v.queryByRole("tab", { name: /^Ventas/ })).not.toBeInTheDocument()
    modulo(v, "Citas")
    expect(v.getByText("Citas del período")).toBeInTheDocument()
    modulo(v, "Clínico")
    expect(v.getByText("Pacientes para campaña")).toBeInTheDocument()
  })

  it("cada gráfica y tabla tiene su botón Exportar con dos opciones: los datos y el detalle completo", () => {
    render(<Reportes usuario={admin} {...datos} />)
    pestana("Citas")
    fireEvent.click(screen.getByRole("button", { name: "Exportar Inasistencia por mes" }))
    const menu = within(screen.getByRole("menu"))
    expect(menu.getByRole("menuitem", { name: /Datos de la gráfica/ })).toBeInTheDocument()
    expect(menu.getByRole("menuitem", { name: /Detalle completo/ })).toBeInTheDocument()
  })
})

describe("Reportes: la pestaña Inventario", () => {
  const admin = { id: "u1", rol: "admin", nombre: "Ana", opticaId: "o1", opticaNombre: "Óptica Demo" }
  const inv = [{ id: "i1", nombre: "Montura A", categoria: "Montura", stock: 3, precio: 40, costo: 10, creadoEn: "2026-01-05T15:00:00Z", activo: true }]
  const ventaDeI1 = { id: "f9", numero: 9, pacienteId: "p1", estado: "pagada", montoTotal: 40, creadoEn: "2026-10-02T15:00:00-05:00", metodoPago: "tarjeta", facturaElectronica: "", lineas: [{ tipo: "producto", productoId: "i1", cantidad: 1, precioUnitario: 40, descripcion: "Montura A" }] }
  const conInv = { ...datos, inventario: inv, facturasVenta: [ventaDeI1] }

  it("es la última pestaña y la ve quien puede ver el inventario", () => {
    render(<Reportes usuario={admin} {...conInv} />)
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual(["Resumen", "Citas", "Clínico", "Ventas", "Laboratorios", "Inventario"])
  })

  it("no la ve quien solo ve lo suyo ni quien no tiene permiso sobre el inventario", () => {
    cleanup()
    render(<Reportes usuario={paula} {...conInv} soloLoPropio />)
    expect(screen.queryByRole("tab", { name: "Inventario" })).not.toBeInTheDocument()
    cleanup()
    render(<Reportes usuario={{ id: "u3", rol: "asistente", nombre: "Vera", opticaId: "o1", permisosNivel: { reportes: ["ver"] } }} {...conInv} />)
    expect(screen.queryByRole("tab", { name: "Inventario" })).not.toBeInTheDocument()
  })

  it("trae el valor a costo, el margen, la rotación y las monturas sin venderse, cada uno con su ⓘ y comparado con el período anterior", () => {
    render(<Reportes usuario={admin} {...conInv} />)
    pestana("Inventario")
    expect(tarjeta("Valor del inventario a costo")).toHaveAccessibleName("Valor del inventario a costo: $30.00. Ver la lista") // 3 × $10
    expect(tarjeta("Margen promedio")).toHaveAccessibleName("Margen promedio: 75%. Ver la lista") // (40 − 10) ÷ 40
    expect(tarjeta("Rotación")).toHaveAccessibleName("Rotación: 0.33 veces. Ver la lista") // costo vendido 10 ÷ inventario promedio 30
    expect(tarjeta("Monturas sin venderse en 90 días")).toHaveAccessibleName("Monturas sin venderse en 90 días: 0. Ver la lista")
    for (const nombre of ["Valor del inventario a costo", "Margen promedio", "Rotación", "Monturas sin venderse en 90 días"]) expect(screen.getByRole("button", { name: new RegExp("^Qué es " + nombre) })).toBeInTheDocument()
    expect(screen.getAllByText("vs. 1 al 12 sept").length).toBeGreaterThanOrEqual(3)
  })

  it("cada número abre su lista en la ventana estándar, con el mismo número y tantas filas como dice", () => {
    render(<Reportes usuario={admin} {...conInv} />)
    pestana("Inventario")
    fireEvent.click(tarjeta("Valor del inventario a costo"))
    expect(within(ventana()).getByText("$30.00", { selector: "[data-detalle-valor]" })).toBeInTheDocument()
    expect(within(ventana()).getAllByRole("row")).toHaveLength(1 + 1)
    expect(within(ventana()).getByRole("button", { name: /^Abrir Inventario \(lista completa\)/ })).toBeInTheDocument() // el texto dice adónde lleva
    fireEvent.keyDown(ventana(), { key: "Escape" })
    fireEvent.click(tarjeta("Margen promedio"))
    expect(within(ventana()).getByText("75%", { selector: "[data-detalle-valor]" })).toBeInTheDocument()
    expect(within(ventana()).getAllByRole("row")).toHaveLength(1 + 1)
    expect(within(ventana()).getByRole("columnheader", { name: "Ganancia" })).toBeInTheDocument()
  })

  it("las más vendidas se ven con sus unidades y abren la lista de lo vendido", () => {
    render(<Reportes usuario={admin} {...conInv} />)
    pestana("Inventario")
    fireEvent.click(screen.getByRole("button", { name: /^Montura A: 1 unidad por \$40\.00/ }))
    expect(within(ventana()).getByText("1", { selector: "[data-detalle-valor]" })).toBeInTheDocument()
    expect(within(ventana()).getAllByRole("row")).toHaveLength(1 + 1)
  })

  it("quien puede ver el inventario pero no editarlo no ve costos ni márgenes", () => {
    render(<Reportes usuario={{ id: "u3", rol: "asistente", nombre: "Vera", opticaId: "o1", permisosNivel: { reportes: ["ver"], inventario: ["ver"], ventas: ["ver"] } }} {...conInv} />)
    pestana("Inventario")
    expect(screen.queryByRole("button", { name: /^Valor del inventario a costo: / })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^Margen promedio: / })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^Rotación: / })).not.toBeInTheDocument()
    expect(tarjeta("Monturas sin venderse en 90 días")).toBeInTheDocument()
  })

  it("sin productos lo dice y lleva a Inventario", () => {
    const ir = vi.fn()
    render(<Reportes usuario={admin} {...datos} inventario={[]} onAbrirModulo={ir} />)
    pestana("Inventario")
    expect(screen.getByText(/Todavía no hay productos activos/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Ir a Inventario" }))
    expect(ir).toHaveBeenCalledWith("inventario", {})
  })

  it("avisa que los filtros de consulta no cambian esta pestaña", () => {
    render(<Reportes usuario={admin} {...conInv} />)
    fireEvent.change(screen.getByRole("combobox", { name: "Motivo de consulta" }), { target: { value: "Examen de Control" } })
    pestana("Inventario")
    expect(screen.getByText(/no cambian esta pestaña/)).toBeInTheDocument()
    expect(tarjeta("Margen promedio")).toHaveAccessibleName("Margen promedio: 75%. Ver la lista")
  })
})
