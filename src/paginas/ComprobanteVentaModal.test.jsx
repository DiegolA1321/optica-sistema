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

describe("ComprobanteVentaModal — luna como texto y factura electrónica (Bloque E)", () => {
  it("agrega una línea de luna con su precio, sin tocar el inventario", () => {
    render(<ComprobanteVentaModal usuario={{}} inventario={[PRODUCTO]} pacienteFijo={PACIENTES[0]} onCerrar={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: "Luna" }))
    fireEvent.change(screen.getByLabelText("Material"), { target: { value: "CR-39" } })
    fireEvent.click(screen.getByLabelText("Antirreflejo"))
    fireEvent.change(screen.getByLabelText("Precio de la luna"), { target: { value: "55" } })
    fireEvent.click(screen.getByRole("button", { name: /Agregar luna/i }))
    expect(screen.getByText("Luna: Monofocal · CR-39 · antirreflejo")).toBeInTheDocument()
    expect(screen.getByText("$55.00", { selector: "span.font-mono.text-xl" })).toBeInTheDocument()
    // una luna sugiere la orden de laboratorio
    expect(screen.getByLabelText(/Esta venta incluye lentes/i)).toBeChecked()
  })

  it("avisa sin bloquear cuando la factura electrónica no tiene el formato del SRI", () => {
    render(<ComprobanteVentaModal usuario={{}} pacienteFijo={PACIENTES[0]} onCerrar={() => {}} />)
    const campo = screen.getByLabelText(/Factura electrónica \(SRI\)/i)
    fireEvent.change(campo, { target: { value: "FE-77" } })
    expect(screen.getByText(/No tiene el formato 001-001-000000123/i)).toBeInTheDocument()
    fireEvent.change(campo, { target: { value: "001001000000123" } })
    fireEvent.blur(campo)
    expect(campo).toHaveValue("001-001-000000123")
    expect(screen.getByText(/Documento interno\. No es una factura electrónica autorizada por el SRI/i)).toBeInTheDocument()
  })

  it("no ofrece un producto descontinuado", () => {
    render(<ComprobanteVentaModal usuario={{}} pacienteFijo={PACIENTES[0]} inventario={[{ ...PRODUCTO, activo: false }]} onCerrar={() => {}} />)
    fireEvent.focus(screen.getByPlaceholderText(/Buscar montura o accesorio/i))
    expect(screen.queryByText("Armazón Test")).not.toBeInTheDocument()
  })
})
