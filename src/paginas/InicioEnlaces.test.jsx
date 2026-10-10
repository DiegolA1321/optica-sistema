import React from "react"
import { describe, it, expect } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import Inicio from "./Inicio"
import { hoyISO } from "../utilidades/disponibilidad"
import { formatoFecha } from "../utilidades/formatoFecha"

// Regla 42: todo lo que se puede presionar lleva exactamente a lo que promete. Cada prueba es una pareja "lo que dice / lo que abre":
// el texto y el número que se ven antes son los que se piden al destino (período, filtro, número y vista del rol).
const hoy = hoyISO()
const dia = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` }
const base = {
  usuario: { id: "u1", rol: "admin", nombre: "Ana", opticaId: "o1" },
  nombreUsuario: "Ana", pacientes: [], citas: [], consultas: [], inventario: [], pases: [], facturasVenta: [], abonos: [], ordenesLab: [],
}
const optometra = { usuario: { ...base.usuario, rol: "asistente", permisosNivel: { citas: ["ver", "crear"], consultas: ["ver", "crear"] } }, vista: { id: "r", nombre: "Rol", tipo: "rol", inicio: "optometra", permisos: { citas: ["ver", "crear"], consultas: ["ver", "crear"] }, alcance: {} } }
const area = (nombre) => screen.getByRole("region", { name: `Requiere tu atención: ${nombre}` })
const cita = (id, estado, extra = {}) => ({ id, fecha: hoy, hora: "09:00 AM", estado, paciente: "Paciente " + id, pacienteId: "p" + id, ...extra })

describe("Totales: lo que dice la tarjeta y lo que abre", () => {
  const mesActual = new Date().toISOString()
  const mesPasado = new Date(new Date().getFullYear(), new Date().getMonth() - 2, 15).toISOString()
  const totalesDe = (props) => {
    const pedidos = []
    render(<Inicio {...base} {...props} onVerTotal={(...a) => pedidos.push(a)} />)
    return pedidos
  }
  // cada tarjeta abre una ventana con las dos opciones y cada opción lleva al módulo con el mismo número que se lee en ella
  const abrir = (tarjeta, opcion) => {
    fireEvent.click(within(screen.getByRole("region", { name: "Totales" })).getByRole("button", { name: new RegExp("^" + tarjeta + ":") }))
    const ventana = screen.getByRole("dialog", { name: tarjeta })
    fireEvent.click(within(ventana).getByRole("button", { name: opcion }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument() // la ventana se cierra al elegir
  }

  it("Pacientes: 'Todos (2)' y 'Nuevos este mes (1)', cada uno al módulo con ese número", () => {
    const pedidos = totalesDe({ pacientes: [{ id: "a", fechaRegistro: hoy }, { id: "b", fechaRegistro: "2026-01-02" }] })
    abrir("Pacientes", "Abrir en Pacientes · Todos los pacientes (2)")
    abrir("Pacientes", "Abrir en Pacientes · Nuevos este mes (1)")
    expect(pedidos).toEqual([["pacientes", "todos"], ["pacientes", "mes"]])
  })
  it("Citas: cuenta sin canceladas (igual que Citas 'Todas') y 'Agendadas este mes' cuenta las creadas este mes", () => {
    const citas = [{ ...cita("1", "Atendida"), creadoEn: mesActual }, { ...cita("2", "Pendiente"), creadoEn: mesPasado }, { ...cita("3", "Cancelada"), creadoEn: mesActual }]
    const pedidos = totalesDe({ citas })
    expect(within(screen.getByRole("region", { name: "Totales" })).getByRole("button", { name: /^Citas: 2./ })).toBeInTheDocument()
    abrir("Citas", "Abrir en Citas · Todas las citas (2)")
    abrir("Citas", "Abrir en Citas · Agendadas este mes (1)")
    expect(pedidos).toEqual([["citas", "todas"], ["citas", "mes"]])
  })
  it("Ventas: 'Todas las ventas' no cuenta anuladas y 'Vendidas este mes' cuenta las de este mes", () => {
    const facturasVenta = [
      { id: "f1", estado: "pagada", montoTotal: 100, pacienteId: "p1", creadoEn: mesActual },
      { id: "f2", estado: "pagada", montoTotal: 50, pacienteId: "p1", creadoEn: mesPasado },
      { id: "f3", estado: "anulada", montoTotal: 70, pacienteId: "p1", creadoEn: mesActual },
    ]
    const pedidos = totalesDe({ facturasVenta })
    abrir("Ventas", "Abrir en Ventas · Todas las ventas (2)")
    abrir("Ventas", "Abrir en Ventas · Vendidas este mes (1)")
    expect(pedidos).toEqual([["ventas", "todas"], ["ventas", "mes"]])
  })
  it("Productos: 'Todos (2)' y 'Nuevos este mes (1)'", () => {
    const pedidos = totalesDe({ inventario: [{ id: "i1", nombre: "M", stock: 9, stockMinimo: 1, creadoEn: mesActual }, { id: "i2", nombre: "N", stock: 9, stockMinimo: 1, creadoEn: mesPasado }] })
    abrir("Productos", "Abrir en Inventario · Todos los productos (2)")
    abrir("Productos", "Abrir en Inventario · Nuevos este mes (1)")
    expect(pedidos).toEqual([["inventario", "todos"], ["inventario", "mes"]])
  })
  it("se cierra con Escape y con Cerrar sin abrir nada", () => {
    const pedidos = totalesDe({ pacientes: [{ id: "a" }] })
    fireEvent.click(within(screen.getByRole("region", { name: "Totales" })).getByRole("button", { name: /^Pacientes:/ }))
    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    fireEvent.click(within(screen.getByRole("region", { name: "Totales" })).getByRole("button", { name: /^Pacientes:/ }))
    fireEvent.click(within(screen.getByRole("dialog")).getAllByRole("button", { name: "Cerrar" })[1])
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(pedidos).toEqual([])
  })
})

describe("Citas del día: lo que dice el enlace y lo que abre", () => {
  const citas = [cita("1", "Atendida"), cita("2", "No Asistió"), cita("3", "Pendiente"), cita("4", "En Espera"), cita("5", "Cancelada")]
  const casos = [
    [null, "Ver todas en Citas", ["todas", "hoy"]],
    [/^Atendidas:/, "Ver atendidas en Citas", ["atendida", "hoy"]],
    [/^No asistieron:/, "Ver no asistieron en Citas", ["noAsistio", "hoy"]],
    [/^Canceladas:/, "Ver canceladas en Citas", ["cancelada", "hoy"]],
    // Pendientes agrupa tres estados que Citas no tiene juntos: el enlace abre todas las del período y lo dice
    [/^Pendientes:/, "Ver todas las del período en Citas", ["todas", "hoy"]],
  ]
  for (const [tarjeta, texto, esperado] of casos) {
    it(`${tarjeta ? String(tarjeta).slice(2, -2) : "sin tarjeta"}: «${texto}» abre ${JSON.stringify(esperado)}`, () => {
      const llamadas = []
      render(<Inicio {...base} citas={citas} onVerCitas={(...a) => llamadas.push(a)} />)
      if (tarjeta) fireEvent.click(screen.getByRole("button", { name: tarjeta }))
      fireEvent.click(within(screen.getByRole("region", { name: /^Citas del día/ })).getByRole("button", { name: texto }))
      expect(llamadas).toEqual([esperado])
    })
  }
})

describe("Agenda del optómetra: lo que dice el enlace y lo que abre", () => {
  it("con citas hoy: 'Ver en Citas · hoy' abre Hoy", () => {
    const llamadas = []
    render(<Inicio {...base} citas={[cita("1", "Pendiente")]} {...optometra} onVerCitas={(...a) => llamadas.push(a)} />)
    fireEvent.click(screen.getByRole("button", { name: "Ver en Citas · hoy" }))
    expect(llamadas).toEqual([["todas", "hoy"]])
  })
  it("sin citas hoy: el enlace nombra la próxima jornada y abre ese día, no 'Todas'", () => {
    const llamadas = []
    const futura = dia(2)
    render(<Inicio {...base} citas={[cita("1", "Pendiente", { fecha: futura })]} {...optometra} onVerCitas={(...a) => llamadas.push(a)} />)
    fireEvent.click(screen.getByRole("button", { name: `Ver en Citas · ${formatoFecha(futura, "corto")}` }))
    expect(llamadas).toEqual([["todas", "dia", futura]])
  })
})

describe("Requiere tu atención: la ventana y sus enlaces", () => {
  const reag = (n) => Array.from({ length: n }, (_, i) => cita("r" + i, "No Asistió", { fecha: dia(-2) }))

  it("se abre desde el aviso, desde el encabezado y desde 'Ver todo'; se cierra con Escape y con Cerrar; es la ventana estándar", () => {
    render(<Inicio {...base} citas={reag(2)} />)
    const citas = area("Citas")
    for (const abrir of [() => within(citas).getByRole("button", { name: /2 citas por reagendar/ }), () => within(citas).getByRole("button", { name: "Abrir los avisos de Citas" }), () => within(citas).getByRole("button", { name: "Ver todo en Citas" })]) {
      fireEvent.click(abrir())
      const ventana = screen.getByRole("dialog", { name: "Citas · 2 avisos" })
      expect(ventana).toHaveAttribute("aria-modal", "true")
      expect(within(ventana).getByRole("heading", { level: 2, name: "Citas · 2 avisos" })).toBeInTheDocument()
      expect(within(ventana).getAllByRole("button", { name: "Cerrar" })).toHaveLength(2) // la X de la cabecera y el botón del pie
      fireEvent.keyDown(document, { key: "Escape" })
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    }
    fireEvent.click(within(citas).getByRole("button", { name: "Ver todo en Citas" }))
    fireEvent.click(within(screen.getByRole("dialog")).getAllByRole("button", { name: "Cerrar" })[1])
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("al resolver un caso la lista y los números del Inicio se actualizan", () => {
    const { rerender } = render(<Inicio {...base} citas={reag(3)} />)
    fireEvent.click(within(area("Citas")).getByRole("button", { name: /3 citas por reagendar/ }))
    expect(within(screen.getByRole("dialog")).getAllByRole("button", { name: "Reagendar" })).toHaveLength(3)
    rerender(<Inicio {...base} citas={reag(2)} /> ) // se resolvió un caso
    const ventana = screen.getByRole("dialog", { name: "Citas · 2 avisos" })
    expect(within(ventana).getAllByRole("button", { name: "Reagendar" })).toHaveLength(2)
    expect(area("Citas")).toHaveTextContent("2 citas por reagendar")
    rerender(<Inicio {...base} citas={[]} />) // se resolvieron todos
    expect(screen.getByRole("dialog")).toHaveTextContent("Todo en orden")
  })

  it("el número del enlace 'Abrir en …' es el que se verá en el destino, calculado como lo calcula ese módulo", () => {
    const citas = [cita("v1", "En Atención", { fecha: dia(-3), atendidoPor: "u1" }), cita("v2", "En Atención", { atendidoPor: "u1" })] // una abierta de un día anterior y otra de hoy
    const ordenesLab = [
      { id: "o1", numero: 1, estado: "lista", pacienteId: "p1", laboratorio: "Lab A", fechaPrometida: dia(3) },
      { id: "o2", numero: 2, estado: "lista", pacienteId: "p1", laboratorio: "Lab A", fechaPrometida: dia(3), pacienteAvisadoEn: "2026-10-01T10:00:00Z" },
    ]
    const facturasVenta = [{ id: "f1", estado: "pendiente_pago", montoTotal: 100, pacienteId: "p1" }, { id: "f2", estado: "pendiente_pago", montoTotal: 50, pacienteId: "p1" }]
    render(<Inicio {...base} citas={citas} ordenesLab={ordenesLab} facturasVenta={facturasVenta} pacientes={[{ id: "p1", nombre: "Paciente Uno", fechaRegistro: hoy }]} consultas={[{ id: "k", pacienteId: "p1", fecha: hoy }]} />)
    // Citas "En atención" muestra las dos citas en atención (la de hoy también), aunque el aviso cuente solo la de un día anterior
    fireEvent.click(within(area("Citas")).getByRole("button", { name: /1 atención abierta de un día anterior/ }))
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Abrir en Citas · En atención (2)" })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: "Escape" })
    // Ventas: "Órdenes listas" cuenta las dos listas (una ya avisada); el aviso, solo la que falta avisar. Saldos: por paciente
    fireEvent.click(within(area("Ventas")).getByRole("button", { name: "Abrir los avisos de Ventas" }))
    const ventas = screen.getByRole("dialog", { name: /^Ventas · / })
    expect(ventas).toHaveTextContent("1 orden de laboratorio lista sin avisar al paciente")
    expect(within(ventas).getByRole("button", { name: "Abrir en Ventas · Órdenes listas (2)" })).toBeInTheDocument()
    expect(ventas).toHaveTextContent("2 ventas con saldo pendiente")
    expect(within(ventas).getByRole("button", { name: "Abrir en Ventas · Saldos por cobrar (1 paciente)" })).toBeInTheDocument()
  })

  it("una cita sin paciente registrado no se puede reagendar desde la ventana: ofrece 'Ver cita', que abre su día", () => {
    const llamadas = []
    const sinPaciente = { id: "sp", fecha: dia(-1), hora: "09:00 AM", estado: "No Asistió", paciente: "Rafael Sin Registro", pacienteId: null }
    render(<Inicio {...base} citas={[sinPaciente]} onVerCitas={(...a) => llamadas.push(a)} />)
    fireEvent.click(within(area("Citas")).getByRole("button", { name: /1 cita por reagendar/ }))
    const ventana = screen.getByRole("dialog")
    expect(within(ventana).queryByRole("button", { name: "Reagendar" })).not.toBeInTheDocument()
    fireEvent.click(within(ventana).getByRole("button", { name: "Ver cita" }))
    expect(llamadas).toEqual([["todas", "dia", dia(-1)]])
  })
})

describe("Botón 'Requieren atención' de cada módulo", () => {
  const reag = (n) => Array.from({ length: n }, (_, i) => cita("r" + i, "No Asistió", { fecha: dia(-2) }))
  const sinPagina = () => {
    expect(screen.queryByRole("region", { name: "Totales" })).not.toBeInTheDocument() // en un módulo no se dibuja el Inicio, solo el botón
    expect(screen.queryByRole("region", { name: "Requiere tu atención" })).not.toBeInTheDocument()
  }

  it("Citas: un botón con el número de avisos del área que abre la misma ventana del Inicio", () => {
    render(<Inicio {...base} citas={reag(2)} soloAvisosDe="citas" />)
    sinPagina()
    fireEvent.click(screen.getByRole("button", { name: "Requieren atención: 2" }))
    const ventana = screen.getByRole("dialog", { name: "Citas · 2 avisos" })
    expect(within(ventana).getAllByRole("button", { name: "Reagendar" })).toHaveLength(2)
    expect(within(ventana).getByRole("button", { name: "Abrir en Citas · Para reagendar (2)" })).toBeInTheDocument()
    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("cada módulo muestra solo los avisos de su área, con el mismo número que la tarjeta del Inicio", () => {
    const datos = {
      citas: reag(2),
      inventario: [{ id: "i1", nombre: "Montura A", stock: 0, stockMinimo: 3 }],
      facturasVenta: [{ id: "f1", estado: "pendiente_pago", montoTotal: 100, pacienteId: "p1" }],
      pacientes: [{ id: "p1", nombre: "Paciente Uno", fechaRegistro: hoy }],
    }
    const { unmount } = render(<Inicio {...base} {...datos} />)
    const enInicio = {}
    for (const nombre of ["Citas", "Pacientes", "Ventas", "Inventario"]) enInicio[nombre] = Number(within(area(nombre)).getAllByText(/^\d+$/)[0].textContent)
    unmount()
    for (const [id, nombre] of [["citas", "Citas"], ["pacientes", "Pacientes"], ["ventas", "Ventas"], ["inventario", "Inventario"]]) {
      const { unmount: cerrar } = render(<Inicio {...base} {...datos} soloAvisosDe={id} />)
      if (enInicio[nombre] > 0) expect(screen.getByRole("button", { name: `Requieren atención: ${enInicio[nombre]}` })).toBeInTheDocument()
      cerrar()
    }
  })

  it("sin avisos queda en su sitio como 'Todo en orden', sin botón", () => {
    render(<Inicio {...base} soloAvisosDe="inventario" />)
    expect(screen.getByText("Todo en orden")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Requieren atención/ })).not.toBeInTheDocument()
  })
})

describe("Textos del estado de la cita", () => {
  it("'No asistió' se escribe igual en la lista de citas del día (no 'No Asistió')", () => {
    render(<Inicio {...base} citas={[cita("1", "No Asistió"), cita("2", "En Espera", { hora: "10:00 AM" })]} />)
    const lista = screen.getByRole("region", { name: /^Citas del día/ })
    expect(within(lista).getByText("No asistió")).toBeInTheDocument()
    expect(within(lista).getByText("En espera")).toBeInTheDocument()
    expect(lista.textContent).not.toMatch(/No Asistió|En Espera/)
  })
})
