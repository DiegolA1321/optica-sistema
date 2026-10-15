import React from "react"
import { describe, it, expect, beforeEach } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import Ventas from "./Ventas"
import { hoyISO } from "../utilidades/disponibilidad"

const pacientes = [{ id: "p1", nombre: "Ana Prueba", cedula: "0101010101" }, { id: "p2", nombre: "Luis Mora", cedula: "0202020202" }]
const base = { usuario: { rol: "admin", opticaId: "o1", nombre: "Admin" }, pacientes, pases: [], ordenesLab: [], equipo: [] }
const ir = (tab) => ({ accionInicial: { tab }, onAccionInicialConsumida: () => {} })
beforeEach(() => { window.history.replaceState({}, "", "/") })

describe("Ventas: abonos anulados y rango de fechas", () => {
  const hoyIso = `${hoyISO()}T15:00:00Z`
  const facturas = [{ id: "b", numero: 2, pacienteId: "p2", estado: "pendiente_pago", metodoPago: "abonos", montoTotal: 100, creadoEn: hoyIso, lineas: [{ id: "l", tipo: "luna", descripcion: "Luna", cantidad: 1, precioUnitario: 100 }], facturaElectronica: "" }]
  const vigente = { id: "x", facturaId: "b", monto: 30, fecha: hoyISO(), creadoEn: hoyIso, pagos: [{ metodo: "efectivo", monto: 30 }] }
  const anulado = { id: "y", facturaId: "b", monto: 50, fecha: hoyISO(), creadoEn: hoyIso, pagos: [{ metodo: "tarjeta", monto: 50 }], anuladoEn: hoyIso, anuladoPor: "u9", anuladoMotivo: "Se registró dos veces" }

  it("un abono anulado no suma en Cobrado hoy ni en el saldo, pero se ve aparte con su motivo", () => {
    render(<Ventas {...base} facturasVenta={facturas} abonos={[vigente]} abonosAnulados={[anulado]} {...ir("cobros")} />)
    expect(screen.getByLabelText("Total cobrado: $30.00")).toBeInTheDocument()
    const lista = screen.getByRole("list", { name: "Abonos anulados de ese día" })
    expect(lista).toHaveTextContent("$50.00")
    expect(lista).toHaveTextContent("Se registró dos veces")
    expect(screen.getAllByText("$70.00").length).toBeGreaterThan(0) // el saldo es 100 − 30
  })

  it("el detalle del comprobante lista el abono anulado, con quién, cuándo y por qué, y el saldo lo ignora", () => {
    render(<Ventas {...base} equipo={[{ id: "u9", nombre: "Vera Ventas" }]} facturasVenta={facturas} abonos={[vigente]} abonosAnulados={[anulado]} {...ir("comprobantes")} />)
    fireEvent.click(screen.getByRole("button", { name: /Ver el comprobante CV-0002/ }))
    const d = screen.getByRole("dialog", { name: "Comprobante CV-0002" })
    expect(within(d).getByText(/Abono anulado el .* por Vera Ventas/)).toBeInTheDocument()
    expect(within(d).getByText("Motivo: Se registró dos veces")).toBeInTheDocument()
    expect(within(d).getByText("Saldo").closest("div")).toHaveTextContent("$70.00")
  })

  it("un abono corregido muestra su valor original", () => {
    render(<Ventas {...base} facturasVenta={facturas} abonos={[{ ...vigente, montoOriginal: 40 }]} {...ir("comprobantes")} />)
    fireEvent.click(screen.getByRole("button", { name: /Ver el comprobante CV-0002/ }))
    expect(within(screen.getByRole("dialog", { name: "Comprobante CV-0002" })).getByText("Corregido · antes $40.00")).toBeInTheDocument()
  })

  it("las fechas se eligen en UN solo lugar: el rango es una opción del selector de período", () => {
    render(<Ventas {...base} facturasVenta={facturas} abonos={[vigente]} {...ir("comprobantes")} />)
    expect(screen.getByRole("button", { name: "Rango" })).toBeInTheDocument()
    expect(screen.queryByText("Todas las fechas")).not.toBeInTheDocument() // sin un segundo botón de fechas
    fireEvent.click(screen.getByRole("button", { name: /Filtrar/ }))
    const panel = screen.getByRole("dialog", { name: /Filtrar los comprobantes/ })
    expect(within(panel).queryByText("Fechas")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Rango" }))
    expect(screen.getByRole("button", { name: /Elegir rango de fechas/ })).toBeInTheDocument()
  })

  it("Nueva venta ya no dice 'un solo pago'", () => {
    render(<Ventas {...base} />)
    fireEvent.click(screen.getAllByRole("button", { name: /Nueva venta/i })[0])
    expect(screen.queryByText(/un solo pago/i)).not.toBeInTheDocument()
    expect(screen.getByText(/pago completo, en cuotas o con abonos/i)).toBeInTheDocument()
  })
})
