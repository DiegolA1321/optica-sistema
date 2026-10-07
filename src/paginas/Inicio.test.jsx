import React from "react"
import { describe, it, expect } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import Inicio from "./Inicio"
import { hoyISO } from "../utilidades/disponibilidad"

const hoy = hoyISO()
const base = {
  usuario: { id: "u1", rol: "admin", nombre: "Ana", opticaId: "o1" },
  nombreUsuario: "Ana",
  pacientes: [{ id: "p1", nombre: "Paciente Uno", fechaRegistro: hoy }, { id: "p2", nombre: "Paciente Dos", fechaRegistro: hoy }],
  citas: [
    { id: "c1", fecha: hoy, hora: "09:00 AM", estado: "Pendiente", paciente: "Paciente Uno", pacienteId: "p1" },
    { id: "c2", fecha: hoy, hora: "10:00 AM", estado: "En Espera", paciente: "Paciente Dos", pacienteId: "p2", asignadoA: "otra" },
    { id: "c3", fecha: hoy, hora: "11:00 AM", estado: "Atendida", paciente: "Paciente Uno", pacienteId: "p1" },
  ],
  consultas: [{ id: "k1", pacienteId: "p1", fecha: hoy, motivo: "Control" }],
  inventario: [{ id: "i1", nombre: "Montura A", stock: 1, stockMinimo: 5, precio: 50 }, { id: "i2", nombre: "Montura B", stock: 40, stockMinimo: 5, precio: 50 }],
  pases: [{ id: "s1", estado: "listo", pacienteId: "p1", consultaId: "k1", pasadaEn: new Date().toISOString(), proformaEntregadaEn: new Date().toISOString() }],
  facturasVenta: [{ id: "f1", estado: "pendiente_pago", montoTotal: 100, pacienteId: "p1" }],
  abonos: [{ id: "a1", facturaId: "f1", monto: 40 }],
  ordenesLab: [{ id: "o1", numero: 3, estado: "enviada", fechaPrometida: "2020-01-01", pacienteId: "p1", laboratorio: "Lab Norte" }],
}
const vistaRol = (inicio) => ({ id: "r", nombre: "Rol", tipo: "rol", inicio, permisos: {}, alcance: {} })

describe("Inicio por rol", () => {
  it("administrador: totales y desenlace con su período en el título, y el stock bajo dicho como productos, una sola vez", () => {
    render(<Inicio {...base} />)
    expect(screen.getByRole("region", { name: "Totales" })).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Desenlace de las citas · este mes" })).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Requiere tu atención" })).toBeInTheDocument()
    expect(screen.queryByText(/¡Bienvenido/)).not.toBeInTheDocument()
    expect(screen.queryByText("Módulo clínico activo")).not.toBeInTheDocument()
    expect(screen.getByText("Pacientes registrados")).toBeInTheDocument()
    expect(screen.getByText("Pacientes sin atender")).toBeInTheDocument()
    expect(screen.getAllByText(/1 producto con stock bajo/i)).toHaveLength(1)
    expect(screen.queryByText(/alertas? de stock bajo/i)).not.toBeInTheDocument()
  })

  it("optómetra: solo lo de hoy y sus citas (sin las asignadas a otra persona), sin totales ni stock", () => {
    render(<Inicio {...base} usuario={{ ...base.usuario, rol: "asistente" }} vista={vistaRol("optometra")} />)
    expect(screen.getByRole("region", { name: "Hoy" })).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Agenda de hoy" })).toBeInTheDocument()
    expect(screen.getByText("Mis citas de hoy")).toBeInTheDocument()
    expect(screen.getByText("Siguiente paciente")).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Totales" })).not.toBeInTheDocument()
    expect(screen.queryByText(/stock bajo/i)).not.toBeInTheDocument()
    expect(screen.getByLabelText("Resumen del día")).toHaveTextContent(/2 citas tuyas hoy/)
  })

  it("recepción: el movimiento del día y atajos para agendar y registrar", () => {
    render(<Inicio {...base} usuario={{ ...base.usuario, rol: "asistente" }} vista={vistaRol("recepcion")} />)
    expect(screen.getByText("Citas de hoy")).toBeInTheDocument()
    expect(screen.getByText("En sala de espera")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Agendar cita/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Registrar paciente/ })).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Totales" })).not.toBeInTheDocument()
  })

  it("ventas: lo que espera a quien vende, con la cola y las órdenes y el stock en un solo bloque de atención", () => {
    render(<Inicio {...base} usuario={{ ...base.usuario, rol: "asistente", permisosNivel: { ventas: ["ver", "crear"], inventario: ["ver"] } }} vista={vistaRol("ventas")} />)
    expect(screen.getByRole("region", { name: "Para vender" })).toBeInTheDocument()
    expect(screen.getByText("Listos para venta", { selector: "span" })).toBeInTheDocument()
    expect(screen.getByText("Saldos por cobrar")).toBeInTheDocument()
    expect(screen.getByText("$60.00")).toBeInTheDocument()
    expect(screen.getByRole("region", { name: "Pacientes por vender" })).toBeInTheDocument()
    const atencion = screen.getByRole("region", { name: "Requiere tu atención" })
    expect(atencion).toHaveTextContent(/1 orden atrasada/)
    expect(screen.queryByRole("region", { name: "Órdenes de laboratorio" })).not.toBeInTheDocument()
    expect(screen.getByText("Paciente Uno", { selector: "span" })).toBeInTheDocument()
    expect(screen.getAllByText(/1 producto con stock bajo/i)).toHaveLength(1)
  })

  it("rol propio: solo los bloques de los módulos que puede ver", () => {
    render(<Inicio {...base} usuario={{ ...base.usuario, rol: "asistente", permisosNivel: { ventas: ["ver"] } }} vista={vistaRol("general")} />)
    expect(screen.getByRole("region", { name: "Para vender" })).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Hoy" })).not.toBeInTheDocument()
    expect(screen.queryByText(/stock bajo/i)).not.toBeInTheDocument()
  })

  it("sin nada pendiente: una línea \"Todo en orden\" en el bloque y en el resumen", () => {
    render(<Inicio {...base} pacientes={[]} citas={[]} consultas={[]} inventario={[]} ordenesLab={[]} pases={[]} />)
    const bloque = screen.getByRole("region", { name: "Requiere tu atención" })
    expect(bloque).toHaveTextContent("Todo en orden")
    expect(screen.getByLabelText("Resumen del día")).toHaveTextContent("Todo en orden")
  })

  it("el desenlace cambia de período con el selector y lo dice en el título", () => {
    render(<Inicio {...base} />)
    fireEvent.click(screen.getByRole("button", { name: "Desde siempre" }))
    expect(screen.getByRole("region", { name: "Desenlace de las citas · desde siempre" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Desde siempre" })).toHaveAttribute("aria-pressed", "true")
  })

  it("cada tarjeta del desenlace manda su estado y su período a Citas", () => {
    const llamadas = []
    render(<Inicio {...base} onVerCitas={(...a) => llamadas.push(a)} />)
    fireEvent.click(screen.getByRole("button", { name: /^Atendidas:/ }))
    fireEvent.click(screen.getByRole("button", { name: "Desde siempre" }))
    fireEvent.click(screen.getByRole("button", { name: /^Canceladas:/ }))
    expect(llamadas).toEqual([["atendida", "mes"], ["cancelada", "siempre"]])
  })
})
