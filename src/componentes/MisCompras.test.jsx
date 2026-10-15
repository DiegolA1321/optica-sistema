import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import MisCompras from "./MisCompras"

const api = vi.hoisted(() => ({
  misCompras: vi.fn(),
  urlDeDescargaPaciente: vi.fn(async () => ({ url: "https://storage/archivo", error: null })),
}))
vi.mock("../utilidades/facturaElectronicaApi", () => api)

const usuario = { id: "p1", token: "tok" }
const compra = (extra = {}) => ({ id: "f1", numero: 17, fecha: "2026-10-04T17:00:00Z", total: 138, estado: "pagada", abonado: 138, saldo: 0, lineas: [{ descripcion: "Montura 5", cantidad: 1, subtotal: 58 }, { descripcion: "Luna monofocal", cantidad: 1, subtotal: 80 }], factura_electronica: null, ...extra })

beforeEach(() => { vi.clearAllMocks(); window.HTMLAnchorElement.prototype.click = vi.fn() })

describe("Portal: Mis compras", () => {
  it("lista sus compras, y las que tienen saldo dicen lo abonado y lo que debe", async () => {
    api.misCompras.mockResolvedValue({ compras: [compra(), compra({ id: "f2", numero: 18, estado: "pendiente_pago", total: 200, abonado: 60, saldo: 140 })], error: null })
    render(<MisCompras usuario={usuario} />)
    const lista = await screen.findByRole("list", { name: "Mis compras" })
    const filas = within(lista).getAllByRole("listitem")
    expect(filas).toHaveLength(2)
    expect(filas[0]).toHaveTextContent("CV-0017")
    expect(filas[0]).toHaveTextContent("Pagada")
    expect(filas[0]).not.toHaveTextContent("Debes")
    expect(filas[1]).toHaveTextContent("Con saldo")
    expect(filas[1]).toHaveTextContent("Abonado $60.00")
    expect(filas[1]).toHaveTextContent("Debes $140.00")
    expect(api.misCompras).toHaveBeenCalledWith("p1", "tok")
  })

  it("las compras con factura electrónica ofrecen el PDF y el XML; las demás explican por qué no", async () => {
    api.misCompras.mockResolvedValue({ compras: [compra({ factura_electronica: { numero: "001-001-000001216", pdf: true, xml: true } }), compra({ id: "f2", numero: 18 }), compra({ id: "f3", numero: 19, factura_electronica: { numero: "001-001-000001217", pdf: false, xml: false } })], error: null })
    render(<MisCompras usuario={usuario} />)
    const filas = within(await screen.findByRole("list", { name: "Mis compras" })).getAllByRole("listitem")
    expect(within(filas[0]).getByRole("button", { name: /Factura \(PDF\)/ })).toBeInTheDocument()
    expect(within(filas[0]).getByRole("button", { name: /XML/ })).toBeInTheDocument()
    expect(filas[1]).toHaveTextContent("todavía no registró la factura electrónica")
    expect(filas[2]).toHaveTextContent("todavía no subió los archivos")
  })

  it("descargar pide el archivo con la sesión del paciente", async () => {
    api.misCompras.mockResolvedValue({ compras: [compra({ factura_electronica: { numero: "001-001-000001216", pdf: true, xml: false } })], error: null })
    render(<MisCompras usuario={usuario} />)
    fireEvent.click(await screen.findByRole("button", { name: /Factura \(PDF\)/ }))
    await waitFor(() => expect(api.urlDeDescargaPaciente).toHaveBeenCalledWith({ pacienteId: "p1", token: "tok", facturaId: "f1", tipo: "pdf" }))
  })

  it("si la descarga falla lo dice", async () => {
    api.misCompras.mockResolvedValue({ compras: [compra({ factura_electronica: { numero: "x", pdf: true, xml: false } })], error: null })
    api.urlDeDescargaPaciente.mockResolvedValueOnce({ url: null, error: "No se encontró ese archivo en tus compras." })
    render(<MisCompras usuario={usuario} />)
    fireEvent.click(await screen.findByRole("button", { name: /Factura \(PDF\)/ }))
    expect(await screen.findByRole("alert")).toHaveTextContent("No se encontró ese archivo en tus compras.")
  })

  it("sin compras dice qué pasa y ofrece pedir una cita", async () => {
    api.misCompras.mockResolvedValue({ compras: [], error: null })
    const pedir = vi.fn()
    render(<MisCompras usuario={usuario} onPedirCita={pedir} />)
    expect(await screen.findByText("Todavía no tienes compras registradas")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Pedir una cita" }))
    expect(pedir).toHaveBeenCalled()
  })

  it("si no se pueden cargar lo dice, sin dejar la pantalla vacía", async () => {
    api.misCompras.mockResolvedValue({ compras: [], error: "No se pudieron cargar tus compras. Revisa tu conexión e intenta de nuevo." })
    render(<MisCompras usuario={usuario} />)
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudieron cargar tus compras")
  })
})
