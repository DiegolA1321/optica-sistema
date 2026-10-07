import React from "react"
import { describe, it, expect } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import ComprobanteVentaModal from "./ComprobanteVentaModal"

const PACIENTES = [{ id: "p1", nombre: "Ana Prueba", cedula: "0101010101" }]
const PRODUCTO = { id: "x1", nombre: "Armazón Test", stock: 3, precio: 40 }

describe("ComprobanteVentaModal — panel de cobro único", () => {
  it("sin paciente fijo pide elegir uno, y la línea precargada del producto aparece", () => {
    render(
      <ComprobanteVentaModal
        usuario={{}}
        inventario={[PRODUCTO]}
        pacientes={PACIENTES}
        lineasIniciales={[{ tipo: "producto", productoId: "x1", cantidad: 1 }]}
        onCerrar={() => {}}
      />
    )
    expect(screen.getByText("Armazón Test")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: /Guardar venta/i }))
    expect(screen.getByText(/Selecciona el paciente de esta venta/i)).toBeInTheDocument()

    fireEvent.focus(screen.getByLabelText("Paciente"))
    fireEvent.click(screen.getByText("Ana Prueba"))
    expect(screen.getByRole("button", { name: /Cambiar paciente/i })).toBeInTheDocument()
  })

  it("con 'Más tarde' el botón secundario cambia y el precio del servicio es editable", () => {
    render(
      <ComprobanteVentaModal
        usuario={{}}
        pacienteFijo={PACIENTES[0]}
        lineasIniciales={[{ tipo: "servicio", descripcion: "Consulta", cantidad: 1, precioUnitario: 15 }]}
        etiquetaGuardar="Cobrar y finalizar"
        onMasTarde={() => {}}
        onCerrar={() => {}}
      />
    )
    expect(screen.getByRole("button", { name: "Más tarde" })).toBeInTheDocument()
    const precio = screen.getByLabelText(/Precio de Consulta/i)
    fireEvent.change(precio, { target: { value: "0" } })
    expect(precio).toHaveValue(0)
    expect(screen.getByText("$0.00", { selector: "span.font-mono.text-xl" })).toBeInTheDocument()
  })
})
