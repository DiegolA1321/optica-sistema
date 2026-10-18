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
  it("arriba van tres resúmenes (por pagar, lentes en proceso y puntos) y el historial lista todas las compras con su estado", () => {
    render(<MisCompras usuario={usuario} puntos={{ puntos: 35, texto: "Te falta 1 consulta para ser cliente frecuente" }} ordenes={[orden({ facturaId: "f2" })]} compras={[compra(), compra({ id: "f2", numero: 18, estado: "pendiente_pago", total: 200, abonado: 60, saldo: 140 })]} />)
    const resumen = screen.getByRole("region", { name: "Resumen de tus compras" })
    expect(resumen).toHaveTextContent("Por pagar$140.00")
    expect(resumen).toHaveTextContent("Lentes en proceso1")
    expect(resumen).toHaveTextContent("Tus puntos35")
    const historial = within(screen.getByRole("region", { name: "Historial de compras" })).getByRole("list", { name: "Historial de compras" })
    const filas = [...historial.children]
    expect(filas).toHaveLength(2)
    expect(filas[0]).toHaveTextContent("CV-0017")
    expect(filas[0]).toHaveTextContent("Pagada")
    expect(filas[1]).toHaveTextContent("CV-0018")
    expect(filas[1]).toHaveTextContent("Con saldo")
    expect(screen.getByRole("region", { name: "Historial de compras" })).toHaveTextContent("2 compras · $338.00 en total")
  })

  it("las que tienen saldo o lentes en camino tienen su tarjeta, con lo abonado, lo que debe y el estado de sus lentes", () => {
    render(<MisCompras usuario={usuario} compras={[compra(), compra({ id: "f2", numero: 18, estado: "pendiente_pago", total: 200, abonado: 60, saldo: 140 })]} ordenes={[orden({ facturaId: "f2" })]} />)
    const tarjetas = [...screen.getByRole("list", { name: "Compras con saldo o lentes en camino" }).children]
    expect(tarjetas).toHaveLength(1)
    expect(tarjetas[0]).toHaveTextContent("Con saldo")
    expect(tarjetas[0]).toHaveTextContent("Abonaste $60.00 de $200.00")
    expect(tarjetas[0]).toHaveTextContent("Debes $140.00")
    expect(tarjetas[0]).toHaveTextContent("Estado de tus lentes")
    expect(tarjetas[0]).toHaveTextContent("En el laboratorio")
    expect(tarjetas[0]).toHaveTextContent("Listos para retirar · aprox. 20 ene")
    expect(tarjetas[0]).toHaveTextContent("Ver detalle")
  })

  it("el historial se filtra: con saldo, pagadas y por año, y dice cuántas compras suman", () => {
    render(<MisCompras usuario={usuario} compras={[compra({ id: "a", numero: 1, fecha: "2026-10-04T17:00:00Z" }), compra({ id: "b", numero: 2, fecha: "2025-04-04T17:00:00Z" }), compra({ id: "c", numero: 3, fecha: "2026-09-04T17:00:00Z", estado: "pendiente_pago", total: 200, abonado: 60, saldo: 140 })]} />)
    const historial = screen.getByRole("region", { name: "Historial de compras" })
    fireEvent.click(within(historial).getByRole("button", { name: "Con saldo" }))
    expect(historial).toHaveTextContent("1 compra · $200.00 en total")
    fireEvent.click(within(historial).getByRole("button", { name: "2025" }))
    expect(historial).toHaveTextContent("1 compra · $138.00 en total")
    expect(within(historial).getByRole("list", { name: "Historial de compras" })).toHaveTextContent("CV-0002")
    fireEvent.click(within(historial).getByRole("button", { name: "Pagadas" }))
    expect(historial).toHaveTextContent("2 compras")
  })

  it("cada compra abre su detalle, con su factura para descargar (PDF y XML) o por qué no la hay", () => {
    render(<MisCompras usuario={usuario} compras={[compra({ factura_electronica: { numero: "001-001-000001216", pdf: true, xml: true } }), compra({ id: "f2", numero: 18 }), compra({ id: "f3", numero: 19, factura_electronica: { numero: "001-001-000001217", pdf: false, xml: false } })]} />)
    fireEvent.click(screen.getByRole("button", { name: /Ver el detalle de tu compra CV-0017/ }))
    const v1 = screen.getByRole("dialog", { name: "Compra CV-0017" })
    expect(within(v1).getByRole("button", { name: "Descargar factura" })).toBeInTheDocument()
    expect(within(v1).getByRole("button", { name: "Descargar XML" })).toBeInTheDocument()
    fireEvent.click(within(v1).getAllByRole("button", { name: "Cerrar" }).pop())
    fireEvent.click(screen.getByRole("button", { name: /Ver el detalle de tu compra CV-0018/ }))
    expect(screen.getByRole("dialog", { name: "Compra CV-0018" })).toHaveTextContent("todavía no registró la factura electrónica")
    fireEvent.click(within(screen.getByRole("dialog", { name: "Compra CV-0018" })).getAllByRole("button", { name: "Cerrar" }).pop())
    fireEvent.click(screen.getByRole("button", { name: /Ver el detalle de tu compra CV-0019/ }))
    expect(screen.getByRole("dialog", { name: "Compra CV-0019" })).toHaveTextContent("todavía no subió los archivos")
  })

  it("el detalle de una compra no repite el estado: va una vez, en la cabecera de la ventana", () => {
    render(<MisCompras usuario={usuario} compras={[compra()]} />)
    fireEvent.click(screen.getByRole("button", { name: /Ver el detalle de tu compra CV-0017/ }))
    const ventana = screen.getByRole("dialog", { name: "Compra CV-0017" })
    expect(ventana.textContent.match(/Pagada|Pagaste/g)).toHaveLength(1)
  })

  it("cada compra con lentes dice su estado, con el nombre que entiende el paciente", () => {
    render(<MisCompras usuario={usuario} compras={[compra(), compra({ id: "f2", numero: 18 })]} ordenes={[orden(), orden({ id: "o2", facturaId: "f2", estado: "lista", listaEl: "2026-10-16T14:00:00Z" })]} />)
    const tarjetas = [...screen.getByRole("list", { name: "Compras con saldo o lentes en camino" }).children]
    expect(tarjetas[0]).toHaveTextContent("Lentes progresivos")
    expect(tarjetas[0]).toHaveTextContent("Estado de tus lentes")
    expect(tarjetas[0]).toHaveTextContent("En el laboratorio")
    expect(tarjetas[1]).toHaveTextContent("Listos para retirar · desde el 16 oct")
  })

  it("una compra sin orden de laboratorio no muestra nada de lentes", () => {
    render(<MisCompras usuario={usuario} compras={[compra()]} ordenes={[orden({ facturaId: "otra" })]} />)
    expect(screen.queryByText(/En el laboratorio/)).not.toBeInTheDocument()
  })

  it("descargar pide el archivo con la sesión del paciente", async () => {
    render(<MisCompras usuario={usuario} compras={[compra({ factura_electronica: { numero: "001-001-000001216", pdf: true, xml: false } })]} />)
    fireEvent.click(screen.getByRole("button", { name: /Ver el detalle de tu compra CV-0017/ }))
    fireEvent.click(screen.getByRole("button", { name: "Descargar factura" }))
    await waitFor(() => expect(api.urlDeDescargaPaciente).toHaveBeenCalledWith({ pacienteId: "p1", token: "tok", facturaId: "f1", tipo: "pdf" }))
  })

  it("si la descarga falla lo dice", async () => {
    api.urlDeDescargaPaciente.mockResolvedValueOnce({ url: null, error: "No se encontró ese archivo en tus compras." })
    render(<MisCompras usuario={usuario} compras={[compra({ factura_electronica: { numero: "x", pdf: true, xml: false } })]} />)
    fireEvent.click(screen.getByRole("button", { name: /Ver el detalle de tu compra CV-0017/ }))
    fireEvent.click(screen.getByRole("button", { name: "Descargar factura" }))
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
