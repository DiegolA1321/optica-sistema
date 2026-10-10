import React from "react"
import { describe, it, expect } from "vitest"
import { render, screen, within } from "@testing-library/react"
import Reportes from "./Reportes"

const ahora = new Date().toISOString()
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
