import React from "react"
import { describe, it, expect } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
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

describe("Inventario: sus ventanas son la ventana estándar", () => {
  it("'Agregar producto' abre la ventana estándar con Cancelar y Guardar producto, y se cierra con Escape", () => {
    render(<Inventario usuario={admin} inventario={[producto("a", "Montura 1", 5)]} />)
    fireEvent.click(screen.getByRole("button", { name: /Agregar producto/ }))
    const ventana = screen.getByRole("dialog", { name: "Agregar producto" })
    expect(ventana.tagName).toBe("FORM")
    expect(within(ventana).getByRole("button", { name: "Cancelar" })).toBeInTheDocument()
    expect(within(ventana).getByRole("button", { name: "Guardar producto" })).toHaveAttribute("type", "submit")
    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("el reporte de ventas de un producto usa la misma ventana, con el nombre del producto y un solo 'Cerrar' de pie", () => {
    render(<Inventario usuario={admin} inventario={[producto("a", "Montura 1", 5)]} ventas={[]} facturasVenta={[]} />)
    fireEvent.click(screen.getByRole("button", { name: /Ver ventas de Montura 1|Reporte/i }))
    const ventana = screen.getByRole("dialog", { name: "Reporte de ventas" })
    expect(within(ventana).getByText("Montura 1")).toBeInTheDocument()
    expect(within(ventana).getAllByRole("button", { name: "Cerrar" })).toHaveLength(2) // la X y el del pie
  })
})
