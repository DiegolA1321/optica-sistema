import React from "react"
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import Inventario from "./Inventario"

const admin = { id: "u1", rol: "admin", nombre: "Ana", opticaId: "o1" }
const ahora = new Date().toISOString()
const producto = (id, nombre, stock) => ({ id, nombre, categoria: "Armazones", stock, precio: 10, creadoEn: ahora, activo: true })

describe("Inventario", () => {
  it("se llama 'Inventario', sus ítems son 'productos' y el botón es 'Agregar producto'", () => {
    render(<Inventario usuario={admin} inventario={[producto("a", "Montura 1", 5)]} />)
    expect(screen.getByRole("heading", { level: 1, name: "Inventario" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Agregar producto/ })).toBeInTheDocument()
    expect(screen.getByText("Valor del inventario")).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/bodega/i)
  })

  it("sin productos no ofrece el filtro 'Nuevos este mes' y dice que no hay productos en el inventario", () => {
    render(<Inventario usuario={admin} inventario={[]} />)
    expect(screen.queryByRole("button", { name: /Nuevos este mes/ })).not.toBeInTheDocument()
    expect(screen.getByText("No hay productos en el inventario.")).toBeInTheDocument()
  })

  it("con productos, el filtro de nuevos aparece con su número y el botón de vista compacta dice lo que hace", () => {
    render(<Inventario usuario={admin} inventario={[producto("a", "Montura 1", 5), producto("b", "Montura 2", 8)]} />)
    expect(screen.getByRole("button", { name: /Nuevos este mes \(2\)/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Vista compacta/ })).toBeInTheDocument()
  })
})
