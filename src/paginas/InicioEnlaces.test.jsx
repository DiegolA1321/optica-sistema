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
  it("cada tarjeta abre su módulo con la lista que tiene ese número", () => {
    const vistas = []
    const citasPedidas = []
    let comprobantes = 0
    const citas = [cita("1", "Atendida"), cita("2", "Pendiente"), cita("3", "Cancelada"), cita("4", "Cancelada", { fecha: dia(1) })]
    render(<Inicio {...base} citas={citas} pacientes={[{ id: "a" }, { id: "b" }]} inventario={[{ id: "i1", nombre: "M", stock: 9, stockMinimo: 1 }]} setVista={(v) => vistas.push(v)} onVerCitas={(...a) => citasPedidas.push(a)} onVerComprobantes={() => { comprobantes++ }} />)
    const totales = screen.getByRole("region", { name: "Totales" })
    // Citas cuenta lo mismo que Citas "Todas": sin las canceladas (4 citas registradas, 2 canceladas → 2)
    expect(within(totales).getByRole("button", { name: /^Citas: 2\./ })).toBeInTheDocument()
    fireEvent.click(within(totales).getByRole("button", { name: /^Citas:/ }))
    expect(citasPedidas).toEqual([["todas", "siempre"]])
    fireEvent.click(within(totales).getByRole("button", { name: /^Pacientes: 2\./ }))
    fireEvent.click(within(totales).getByRole("button", { name: /^Productos: 1\./ }))
    expect(vistas).toEqual(["pacientes", "inventario"])
    fireEvent.click(within(totales).getByRole("button", { name: /^Ventas:/ }))
    expect(comprobantes).toBe(1) // la tarjeta de Ventas abre los comprobantes, no la cola de pacientes por vender
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
