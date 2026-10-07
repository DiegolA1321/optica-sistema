import React from "react"
import { describe, it, expect } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import Ventas from "./Ventas"

const pacientes = [{ id: "p1", nombre: "Ana Prueba", cedula: "0101010101" }, { id: "p2", nombre: "Luis Mora", cedula: "0202020202" }]
const factura = (id, extra = {}) => ({ id, pacienteId: "p1", numero: 1, estado: "pagada", metodoPago: "directo", montoTotal: 80, creadoEn: "2026-10-05T10:00:00Z", lineas: [{ id: "l1", tipo: "luna", descripcion: "Luna: Monofocal", cantidad: 1, precioUnitario: 80 }], facturaElectronica: "", ...extra })
const base = {
  usuario: { rol: "admin", opticaId: "o1" }, pacientes, facturasVenta: [], pases: [], ordenesLab: [], abonos: [], equipo: [],
}

describe("Ventas — módulo propio (Bloque E)", () => {
  it("muestra las cuatro secciones con sus indicadores y la cola vacía", () => {
    render(<Ventas {...base} />)
    expect(screen.getByRole("tab", { name: /Por vender/i })).toHaveAttribute("aria-selected", "true")
    expect(screen.getByRole("tab", { name: /Ventas/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /Órdenes de laboratorio/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /Saldos por cobrar/i })).toBeInTheDocument()
    expect(screen.getByText(/No hay pacientes esperando para venta/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Nueva venta/i })).toBeInTheDocument()
  })

  it("lista los comprobantes con su número y busca por CV y por factura electrónica", () => {
    const facturas = [factura("a", { numero: 1, facturaElectronica: "001-001-000000123" }), factura("b", { numero: 2, pacienteId: "p2" })]
    render(<Ventas {...base} facturasVenta={facturas} />)
    fireEvent.click(screen.getByRole("tab", { name: /Ventas/i }))
    expect(screen.getByText("CV-0001")).toBeInTheDocument()
    expect(screen.getByText("CV-0002")).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("Buscar comprobante"), { target: { value: "000000123" } })
    expect(screen.getByText("CV-0001")).toBeInTheDocument()
    expect(screen.queryByText("CV-0002")).not.toBeInTheDocument()
    expect(screen.getByText(/Documento interno\. No es una factura electrónica autorizada por el SRI/i)).toBeInTheDocument()
  })

  it("el saldo por cobrar sale de los abonos y aparece en Saldos", () => {
    const facturas = [factura("a", { estado: "pendiente_pago", metodoPago: "abonos", montoTotal: 100 })]
    const abonos = [{ id: "x", facturaId: "a", monto: 30, fecha: "2026-10-06", creadoEn: "2026-10-06T10:00:00Z" }]
    render(<Ventas {...base} facturasVenta={facturas} abonos={abonos} />)
    fireEvent.click(screen.getByRole("tab", { name: /Saldos por cobrar/i }))
    expect(screen.getByText("Debe $70.00")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Abonar CV-0001/i })).toBeInTheDocument()
  })

  it("sin permiso de crear no ofrece 'Nueva venta' ni las acciones de la cola", () => {
    const usuario = { rol: "asistente", opticaId: "o1", permisosNivel: { ventas: ["ver"] } }
    render(<Ventas {...base} usuario={usuario} pases={[{ id: "ps1", pacienteId: "p1", consultaId: "c1", estado: "listo", pasadaEn: "2026-10-05T10:00:00Z" }]} consultas={[{ id: "c1", fecha: "2026-10-05" }]} />)
    expect(screen.queryByRole("button", { name: /Nueva venta/i })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Tomar datos del diagnóstico/i })).not.toBeInTheDocument()
    expect(screen.getByText("Ana Prueba")).toBeInTheDocument()
  })

  it("llega a la pestaña pedida desde el Inicio", () => {
    render(<Ventas {...base} accionInicial={{ tab: "ordenes", filtro: "atrasadas" }} onAccionInicialConsumida={() => {}} />)
    expect(screen.getByRole("tab", { name: /Órdenes de laboratorio/i })).toHaveAttribute("aria-selected", "true")
  })
})
