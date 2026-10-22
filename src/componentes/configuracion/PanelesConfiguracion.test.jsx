import React, { useState } from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react"

// Sin base de datos: no se leen los pedidos de la óptica (los nombres que ya usan se prueban con el catálogo y las funciones).
vi.mock("../../lib/supabaseClient", () => ({ supabase: null }))
import PanelVentasConfig from "./PanelVentasConfig"
import PanelInventarioConfig from "./PanelInventarioConfig"

// La parametrización como la guarda el sistema: setParametrizacion recibe una función y devuelve { error }.
const registro = { exitos: [], errores: [], set: null }
beforeEach(() => { registro.exitos = []; registro.errores = []; registro.set = null })
function Con({ Panel, inicial = {}, falla = false, ...props }) {
  const [param, setParam] = useState(inicial)
  const [set] = useState(() => vi.fn(async (f) => { if (falla) return { error: new Error("sin conexión") }; setParam((p) => f(p)); return { error: null } }))
  registro.set = set
  return <Panel usuario={{ opticaId: "o1" }} parametrizacion={param} setParametrizacion={set} onExito={(m) => registro.exitos.push(m)} onError={(m) => registro.errores.push(m)} {...props} />
}

describe("Configuración → Ventas", () => {
  it("muestra los días del pedido (7 si no se guardaron) y no deja guardar sin cambios", () => {
    render(<Con Panel={PanelVentasConfig} />)
    expect(screen.getByLabelText(/^Días por defecto/)).toHaveValue(7)
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled()
  })

  it("guarda los días sin pisar el resto de la parametrización y confirma", async () => {
    render(<Con Panel={PanelVentasConfig} inicial={{ diasPedido: 5, otra: 1 }} />)
    expect(screen.getByLabelText(/^Días por defecto/)).toHaveValue(5)
    fireEvent.change(screen.getByLabelText(/^Días por defecto/), { target: { value: "12" } })
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }))
    await waitFor(() => expect(registro.exitos).toEqual(["Días del pedido guardados correctamente."]))
    expect(registro.set.mock.calls[0][0]({ otra: 1 })).toEqual({ otra: 1, diasPedido: 12 })
  })

  it("los días deben estar entre 1 y 90", () => {
    render(<Con Panel={PanelVentasConfig} />)
    fireEvent.change(screen.getByLabelText(/^Días por defecto/), { target: { value: "0" } })
    expect(screen.getByRole("alert")).toHaveTextContent("Los días deben ser un número entre 1 y 90.")
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled()
  })

  it("el recordatorio del conteo es cada 30 días por defecto, se cambia, se apaga y se guarda con lo demás", async () => {
    render(<Con Panel={PanelInventarioConfig} />)
    expect(screen.getByLabelText("Recordar el conteo cada")).toHaveValue(30)
    expect(screen.getByRole("switch", { name: "Recordar el conteo" })).toHaveAttribute("aria-checked", "true")
    fireEvent.change(screen.getByLabelText("Recordar el conteo cada"), { target: { value: "15" } })
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }))
    await waitFor(() => expect(registro.exitos.length).toBe(1))
    expect(registro.set.mock.calls[0][0]({}).recordatorioConteo).toEqual({ activo: true, dias: 15 })
  })

  it("apagado, el recordatorio no pide días y se guarda desactivado; los días fuera de rango no dejan guardar", async () => {
    render(<Con Panel={PanelInventarioConfig} />)
    fireEvent.change(screen.getByLabelText("Recordar el conteo cada"), { target: { value: "0" } })
    expect(screen.getByRole("alert")).toHaveTextContent(/entre 1 y 365/)
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled()
    fireEvent.click(screen.getByRole("switch", { name: "Recordar el conteo" }))
    expect(screen.queryByRole("alert")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }))
    await waitFor(() => expect(registro.exitos.length).toBe(1))
    expect(registro.set.mock.calls[0][0]({}).recordatorioConteo.activo).toBe(false)
  })

  it("si no se pudo guardar lo dice con palabras del usuario", async () => {
    render(<Con Panel={PanelVentasConfig} falla />)
    fireEvent.change(screen.getByLabelText(/^Días por defecto/), { target: { value: "9" } })
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }))
    await waitFor(() => expect(registro.errores).toEqual(["No se pudo guardar los días del pedido. Revisa tu conexión e intenta de nuevo."]))
  })
})

describe("Configuración → Inventario", () => {
  it("muestra el mínimo y el máximo generales (los de siempre si no se guardaron) y no deja guardar sin cambios", () => {
    render(<Con Panel={PanelInventarioConfig} />)
    expect(screen.getByLabelText(/^Stock mínimo/)).toHaveValue(10)
    expect(screen.getByLabelText(/^Stock máximo/)).toHaveValue(30)
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled()
    expect(screen.getByText(/Solo avisa: no limita las ventas ni los ingresos/)).toBeInTheDocument()
  })

  it("guarda los dos juntos, sin pisar el resto de la parametrización, y confirma", async () => {
    render(<Con Panel={PanelInventarioConfig} inicial={{ stockMinimo: 5, stockMaximo: 40, otra: 1 }} />)
    expect(screen.getByLabelText(/^Stock mínimo/)).toHaveValue(5)
    fireEvent.change(screen.getByLabelText(/^Stock mínimo/), { target: { value: "8" } })
    fireEvent.change(screen.getByLabelText(/^Stock máximo/), { target: { value: "60" } })
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }))
    await waitFor(() => expect(registro.exitos).toEqual(["Configuración del inventario guardada correctamente."]))
    expect(registro.set.mock.calls[0][0]({ otra: 1 })).toEqual({ otra: 1, stockMinimo: 8, stockMaximo: 60, recordatorioConteo: { activo: true, dias: 30 } })
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled()
  })

  it("el máximo debe ser mayor que el mínimo y los dos deben ser números dentro del rango", () => {
    render(<Con Panel={PanelInventarioConfig} />)
    fireEvent.change(screen.getByLabelText(/^Stock máximo/), { target: { value: "10" } })
    expect(screen.getByRole("alert")).toHaveTextContent("El máximo debe ser mayor que el mínimo.")
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/^Stock máximo/), { target: { value: "0" } })
    expect(screen.getByRole("alert")).toHaveTextContent(/El máximo debe ser un número entre 1 y 9999/)
    fireEvent.change(screen.getByLabelText(/^Stock máximo/), { target: { value: "30" } })
    fireEvent.change(screen.getByLabelText(/^Stock mínimo/), { target: { value: "-1" } })
    expect(screen.getByRole("alert")).toHaveTextContent(/El mínimo debe ser un número entre 0 y 9999/)
  })

  it("si no se pudo guardar lo dice y deja lo escrito para reintentar", async () => {
    render(<Con Panel={PanelInventarioConfig} falla />)
    fireEvent.change(screen.getByLabelText(/^Stock máximo/), { target: { value: "50" } })
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }))
    await waitFor(() => expect(registro.errores).toEqual(["No se pudo guardar la configuración del inventario. Revisa tu conexión e intenta de nuevo."]))
    expect(screen.getByLabelText(/^Stock máximo/)).toHaveValue(50)
  })
})
