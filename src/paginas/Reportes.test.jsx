import React from "react"
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest"
import { render, screen, within, fireEvent } from "@testing-library/react"
import Reportes from "./Reportes"

// Último día del mes por la noche en Ecuador (21:00 del 31 de octubre = 02:00 UTC del 1 de noviembre): la venta debe contarse en
// octubre, el mes de Ecuador, sea cual sea la zona del equipo o la hora universal.
const INSTANTE = "2026-10-31T21:00:00-05:00"
const ahora = new Date(INSTANTE).toISOString()
beforeAll(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date(INSTANTE)) })
afterAll(() => { vi.useRealTimers() })
const admin = { id: "u1", rol: "admin", nombre: "Ana", opticaId: "o1" }
const facturasVenta = [{ id: "a", estado: "pendiente_pago", montoTotal: 223, creadoEn: ahora, pacienteId: "p1" }]
const abonos = [{ facturaId: "a", monto: 94.5 }]
const tarjeta = (nombre) => screen.getByText(nombre, { selector: "p, span, h3" }).closest("div[class*='rounded']")

describe("Reportes: Vendido y Cobrado, dos números con dos nombres", () => {
  it("el administrador ve lo vendido y lo cobrado de las mismas ventas, y cuánto es de cuánto", () => {
    render(<Reportes usuario={admin} facturasVenta={facturasVenta} abonos={abonos} />)
    const vendido = tarjeta("Vendido")
    const cobrado = tarjeta("Cobrado")
    expect(within(vendido).getByText("$223.00")).toBeInTheDocument()
    expect(within(vendido).getByText(/1 venta \(sin anuladas\)/)).toBeInTheDocument()
    expect(within(cobrado).getByText("$94.50")).toBeInTheDocument()
    expect(within(cobrado).getByText(/de esos \$223\.00 vendidos/)).toBeInTheDocument()
    expect(screen.queryByText("Ingresos")).not.toBeInTheDocument()
  })

  it("el optómetra no ve montos y sabe que ve solo lo suyo", () => {
    const paula = { id: "u2", rol: "asistente", nombre: "Paula", opticaId: "o1", esOptometra: true }
    render(<Reportes usuario={paula} soloLoPropio facturasVenta={facturasVenta} abonos={abonos} />)
    expect(screen.queryByText("Vendido")).not.toBeInTheDocument()
    expect(screen.queryByText("Cobrado")).not.toBeInTheDocument()
    expect(screen.getByText("Solo tus consultas y tus citas")).toBeInTheDocument()
  })

  it("el administrador no ve la etiqueta de 'solo lo tuyo'", () => {
    render(<Reportes usuario={admin} facturasVenta={facturasVenta} abonos={abonos} />)
    expect(screen.queryByText("Solo tus consultas y tus citas")).not.toBeInTheDocument()
  })
})

describe("Reportes: óptica nueva y números que se explican", () => {
  it("sin datos lo dice y lleva a registrar el primer paciente", () => {
    const pedidos = []
    render(<Reportes usuario={admin} onRegistrarPaciente={() => pedidos.push("crear")} />)
    expect(screen.getByText("Todavía no hay datos para mostrar")).toBeInTheDocument()
    screen.getByRole("button", { name: /Registrar el primer paciente/ }).click()
    expect(pedidos).toEqual(["crear"])
  })

  it("con pacientes no aparece ese aviso", () => {
    render(<Reportes usuario={admin} pacientes={[{ id: "p1", nombre: "Ana", fechaRegistro: "2026-01-01" }]} onRegistrarPaciente={() => {}} />)
    expect(screen.queryByText("Todavía no hay datos para mostrar")).not.toBeInTheDocument()
  })

  it("'Citas → pacientes atendidos' aclara cuántas son sin las canceladas", () => {
    const citas = [{ id: "1", estado: "Atendida", fecha: "2026-10-01" }, { id: "2", estado: "Cancelada", fecha: "2026-10-02" }, { id: "3", estado: "Pendiente", fecha: "2026-10-03" }]
    render(<Reportes usuario={admin} citas={citas} />)
    expect(screen.getByText("1 de 3 citas solicitadas (2 sin las canceladas)")).toBeInTheDocument()
  })
})

describe("Reportes: período personalizado con el calendario del sistema", () => {
  it("'Personalizado' ofrece dos fechas con el calendario del sistema, no los campos del navegador", () => {
    render(<Reportes usuario={admin} />)
    fireEvent.click(screen.getByRole("button", { name: "Personalizado" }))
    expect(document.querySelector("input[type=date]")).toBeNull()
    expect(screen.getByRole("button", { name: /Desde/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Hasta/ })).toBeInTheDocument()
  })
})
