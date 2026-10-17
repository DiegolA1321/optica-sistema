import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"
import MisCompras from "./MisCompras"

const api = vi.hoisted(() => ({
  urlDeDescargaPaciente: vi.fn(async () => ({ url: "https://storage/archivo", error: null })),
}))
vi.mock("../utilidades/facturaElectronicaApi", () => api)

const usuario = { id: "p1", token: "tok" }
const compra = (extra = {}) => ({ id: "f1", numero: 17, fecha: "2026-10-04T17:00:00Z", total: 138, estado: "pagada", abonado: 138, saldo: 0, lineas: [{ descripcion: "Montura 5", cantidad: 1, subtotal: 58 }, { descripcion: "Luna monofocal", cantidad: 1, subtotal: 80 }], factura_electronica: null, ...extra })
const orden = (extra = {}) => ({ id: "o1", numero: 3, estado: "enviada", fechaPrometida: "2099-01-20", tipoLente: "progresivo", montura: "Ray-Ban", facturaId: "f1", creadaEn: "2026-10-04T17:00:00Z", listaEl: null, entregadaEl: null, ...extra })

beforeEach(() => { vi.clearAllMocks(); window.HTMLAnchorElement.prototype.click = vi.fn() })

describe("Portal: Mis compras", () => {
  it("lista sus compras, y las que tienen saldo dicen lo abonado y lo que debe", () => {
    render(<MisCompras usuario={usuario} compras={[compra(), compra({ id: "f2", numero: 18, estado: "pendiente_pago", total: 200, abonado: 60, saldo: 140 })]} />)
    const filas = [...screen.getByRole("list", { name: "Mis compras" }).children]
    expect(filas).toHaveLength(2)
    expect(filas[0]).toHaveTextContent("CV-0017")
    expect(filas[0]).toHaveTextContent("Pagada")
    expect(filas[0]).not.toHaveTextContent("Debes")
    expect(filas[1]).toHaveTextContent("Con saldo")
    expect(filas[1]).toHaveTextContent("Abonado $60.00")
    expect(filas[1]).toHaveTextContent("Debes $140.00")
  })

  it("las compras con factura electrónica ofrecen el PDF y el XML; las demás explican por qué no", () => {
    render(<MisCompras usuario={usuario} compras={[compra({ factura_electronica: { numero: "001-001-000001216", pdf: true, xml: true } }), compra({ id: "f2", numero: 18 }), compra({ id: "f3", numero: 19, factura_electronica: { numero: "001-001-000001217", pdf: false, xml: false } })]} />)
    const filas = [...screen.getByRole("list", { name: "Mis compras" }).children]
    expect(within(filas[0]).getByRole("button", { name: /Factura \(PDF\)/ })).toBeInTheDocument()
    expect(within(filas[0]).getByRole("button", { name: /XML/ })).toBeInTheDocument()
    expect(filas[1]).toHaveTextContent("todavía no registró la factura electrónica")
    expect(filas[2]).toHaveTextContent("todavía no subió los archivos")
  })

  it("cada compra dice el estado de sus lentes, con el nombre que entiende el paciente", () => {
    render(<MisCompras usuario={usuario} compras={[compra(), compra({ id: "f2", numero: 18 })]} ordenes={[orden(), orden({ id: "o2", facturaId: "f2", estado: "lista", listaEl: "2026-10-16T14:00:00Z" })]} />)
    const filas = [...screen.getByRole("list", { name: "Mis compras" }).children]
    expect(filas[0]).toHaveTextContent("Lentes progresivos con la montura Ray-Ban")
    expect(filas[0]).toHaveTextContent("En el laboratorio")
    expect(filas[0]).toHaveTextContent("Fecha estimada: 20 ene 2099")
    expect(filas[1]).toHaveTextContent("Listos para retirar")
    expect(filas[1]).toHaveTextContent("16 oct 2026")
  })

  it("una compra sin orden de laboratorio no muestra nada de lentes", () => {
    render(<MisCompras usuario={usuario} compras={[compra()]} ordenes={[orden({ facturaId: "otra" })]} />)
    expect(screen.queryByText(/En el laboratorio/)).not.toBeInTheDocument()
  })

  it("descargar pide el archivo con la sesión del paciente", async () => {
    render(<MisCompras usuario={usuario} compras={[compra({ factura_electronica: { numero: "001-001-000001216", pdf: true, xml: false } })]} />)
    fireEvent.click(screen.getByRole("button", { name: /Factura \(PDF\)/ }))
    await waitFor(() => expect(api.urlDeDescargaPaciente).toHaveBeenCalledWith({ pacienteId: "p1", token: "tok", facturaId: "f1", tipo: "pdf" }))
  })

  it("si la descarga falla lo dice", async () => {
    api.urlDeDescargaPaciente.mockResolvedValueOnce({ url: null, error: "No se encontró ese archivo en tus compras." })
    render(<MisCompras usuario={usuario} compras={[compra({ factura_electronica: { numero: "x", pdf: true, xml: false } })]} />)
    fireEvent.click(screen.getByRole("button", { name: /Factura \(PDF\)/ }))
    expect(await screen.findByRole("alert")).toHaveTextContent("No se encontró ese archivo en tus compras.")
  })

  it("sin compras dice qué pasa y ofrece «Agendar cita» (el mismo verbo de todo el portal)", () => {
    const pedir = vi.fn()
    render(<MisCompras usuario={usuario} compras={[]} onPedirCita={pedir} />)
    expect(screen.getByText("Todavía no tienes compras registradas")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Agendar cita" }))
    expect(pedir).toHaveBeenCalled()
  })

  it("si no se pueden cargar lo dice, sin dejar la pantalla vacía", () => {
    render(<MisCompras usuario={usuario} error="No se pudieron cargar tus compras. Revisa tu conexión e intenta de nuevo." />)
    expect(screen.getByRole("alert")).toHaveTextContent("No se pudieron cargar tus compras")
  })

  it("mientras cargan muestra esqueletos, no una pantalla vacía", () => {
    render(<MisCompras usuario={usuario} cargando />)
    expect(screen.getByLabelText("Cargando tus compras")).toBeInTheDocument()
    expect(screen.queryByText("Todavía no tienes compras registradas")).not.toBeInTheDocument()
  })
})
