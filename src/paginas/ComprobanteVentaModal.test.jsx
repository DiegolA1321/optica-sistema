import React from "react"
import { describe, it, expect } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import ComprobanteVentaModal from "./ComprobanteVentaModal"
import { ProveedorFidelidad, armarFidelidad } from "../componentes/FidelidadContexto"
import { PROGRAMA_POR_DEFECTO } from "../utilidades/programaFidelidad"

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

describe("ComprobanteVentaModal — descuentos y pagos divididos (Ventas v2)", () => {
  const servicio = [{ tipo: "servicio", descripcion: "Consulta", cantidad: 2, precioUnitario: 50 }]
  const abrir = (extra = {}) => render(<ComprobanteVentaModal usuario={{}} pacienteFijo={PACIENTES[0]} lineasIniciales={servicio} onCerrar={() => {}} {...extra} />)

  it("un descuento en porcentaje baja el total y deja ver el subtotal", () => {
    abrir()
    fireEvent.click(screen.getByRole("button", { name: /Aplicar descuento/i }))
    fireEvent.change(screen.getByLabelText("Valor del descuento de Consulta"), { target: { value: "10" } })
    expect(screen.getByText("$90.00", { selector: "span.font-mono.text-xl" })).toBeInTheDocument()
    expect(screen.getByText("Subtotal")).toBeInTheDocument()
    expect(screen.getByText("-$10.00", { selector: "span.font-mono" })).toBeInTheDocument()
  })
  it("el descuento exige su motivo antes de guardar", () => {
    abrir()
    fireEvent.click(screen.getByRole("button", { name: /Aplicar descuento/i }))
    fireEvent.change(screen.getByLabelText("Valor del descuento de Consulta"), { target: { value: "10" } })
    fireEvent.click(screen.getByRole("button", { name: /Guardar venta/i }))
    expect(screen.getByRole("alert")).toHaveTextContent(/motivo del descuento/i)
  })
  it("quien no puede editar Ventas no ve el descuento", () => {
    abrir({ usuario: { rol: "asistente", permisosNivel: { ventas: ["ver", "crear"] } } })
    expect(screen.queryByRole("button", { name: /Aplicar descuento/i })).not.toBeInTheDocument()
  })
  it("dividir el pago reparte el total y avisa si no cuadra", () => {
    abrir()
    expect(screen.getByLabelText("Método de pago")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Dividir el pago/i }))
    expect(screen.getByLabelText("Monto del pago 1")).toHaveValue(50)
    expect(screen.getByLabelText("Monto del pago 2")).toHaveValue(50)
    expect(screen.getByText("Todo repartido")).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Monto del pago 1"), { target: { value: "70" } })
    expect(screen.getByText("Se pasa $20.00")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Guardar venta/i }))
    expect(screen.getByRole("alert")).toHaveTextContent("Las formas de pago se pasan en $20.00.")
    fireEvent.change(screen.getByLabelText("Monto del pago 1"), { target: { value: "60" } })
    fireEvent.change(screen.getByLabelText("Monto del pago 2"), { target: { value: "30" } })
    expect(screen.getByText("Faltan $10.00")).toBeInTheDocument()
  })
  it("con abonos, el abono inicial también se puede dividir", () => {
    abrir()
    fireEvent.click(screen.getByRole("button", { name: "Abonos" }))
    fireEvent.change(screen.getByLabelText(/Abono inicial/i), { target: { value: "30" } })
    fireEvent.click(screen.getByRole("button", { name: /Dividir el pago/i }))
    expect(screen.getByLabelText("Monto del pago 1")).toHaveValue(15)
    expect(screen.getByLabelText("Monto del pago 2")).toHaveValue(15)
  })
})

describe("ComprobanteVentaModal — descuento sugerido por el nivel de fidelización", () => {
  const servicio = [{ tipo: "servicio", descripcion: "Consulta", cantidad: 2, precioUnitario: 50 }]
  // Cuatro consultas = 40 puntos: nivel Frecuente (desde 30) con 5 % de descuento sugerido.
  const consultas = [1, 2, 3, 4].map((n) => ({ id: "c" + n, pacienteId: "p1", fecha: "2026-0" + n + "-10" }))
  const fidelidad = armarFidelidad({ programa: PROGRAMA_POR_DEFECTO, pacientes: PACIENTES, consultas, facturas: [], abonos: [] })
  const abrir = (usuario) => render(<ProveedorFidelidad value={fidelidad}><ComprobanteVentaModal usuario={usuario} pacienteFijo={PACIENTES[0]} lineasIniciales={servicio} onCerrar={() => {}} /></ProveedorFidelidad>)

  it("quien puede hacer descuentos ve el nivel del cliente y lo aplica a todas las líneas, con su motivo", () => {
    abrir({})
    expect(screen.getByText(/Cliente Frecuente/)).toBeInTheDocument()
    expect(screen.getByText(/descuento sugerido de 5 %/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Aplicar a todas las líneas" }))
    expect(screen.getByText("$95.00", { selector: "span.font-mono.text-xl" })).toBeInTheDocument()
    expect(screen.getByDisplayValue("Fidelización: nivel Frecuente")).toBeInTheDocument()
    expect(screen.getByText("Ya hay descuentos en esta venta")).toBeInTheDocument()
  })

  it("quien no tiene permiso de descuentos en Ventas no ve la sugerencia", () => {
    abrir({ rol: "asistente", permisosNivel: { ventas: ["ver", "crear"] } })
    expect(screen.queryByText(/Cliente Frecuente/)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Aplicar a todas las líneas" })).not.toBeInTheDocument()
  })

  it("un cliente de nivel Nuevo (sin descuento) no ve ninguna sugerencia", () => {
    const poco = armarFidelidad({ programa: PROGRAMA_POR_DEFECTO, pacientes: PACIENTES, consultas: consultas.slice(0, 1), facturas: [], abonos: [] })
    render(<ProveedorFidelidad value={poco}><ComprobanteVentaModal usuario={{}} pacienteFijo={PACIENTES[0]} lineasIniciales={servicio} onCerrar={() => {}} /></ProveedorFidelidad>)
    expect(screen.queryByText(/descuento sugerido/)).not.toBeInTheDocument()
  })
})
