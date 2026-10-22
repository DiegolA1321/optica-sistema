import React, { useState } from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react"

// Sin base de datos: no se leen los pedidos de la óptica (los nombres que ya usan se prueban con el catálogo y las funciones).
vi.mock("../../lib/supabaseClient", () => ({ supabase: null }))
import PanelLaboratorios from "./PanelLaboratorios"
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

describe("Configuración → Laboratorios", () => {
  const lista = () => screen.getByRole("list", { name: "Laboratorios de la óptica" })

  it("una óptica nueva empieza con el catálogo vacío y dice qué hacer", () => {
    render(<Con Panel={PanelLaboratorios} />)
    expect(within(lista()).getByText(/Todavía no hay laboratorios/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Agregar laboratorio/ })).toBeDisabled()
  })

  it("agrega un laboratorio: se guarda en la parametrización, aparece activo y confirma", async () => {
    render(<Con Panel={PanelLaboratorios} />)
    fireEvent.change(screen.getByLabelText("Nombre del laboratorio nuevo"), { target: { value: "  Visión Norte " } })
    fireEvent.click(screen.getByRole("button", { name: /Agregar laboratorio/ }))
    await waitFor(() => expect(within(lista()).getByText("Visión Norte")).toBeInTheDocument())
    expect(within(lista()).getByText("Activo")).toBeInTheDocument()
    expect(registro.exitos).toEqual(["«Visión Norte» agregado a los laboratorios."])
    expect(registro.set.mock.calls[0][0]({ otra: 1 })).toEqual({ otra: 1, laboratorios: [{ nombre: "Visión Norte", activo: true }] }) // no pisa el resto de la parametrización
    expect(screen.getByLabelText("Nombre del laboratorio nuevo")).toHaveValue("")
  })

  it("no acepta un nombre repetido (ni con otras mayúsculas o tildes) y lo dice", async () => {
    render(<Con Panel={PanelLaboratorios} inicial={{ laboratorios: [{ nombre: "Visión Norte", activo: false }] }} />)
    fireEvent.change(screen.getByLabelText("Nombre del laboratorio nuevo"), { target: { value: "vision NORTE" } })
    fireEvent.click(screen.getByRole("button", { name: /Agregar laboratorio/ }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Ya existe «Visión Norte» (desactivado).")
    expect(registro.set).not.toHaveBeenCalled()
  })

  it("edita el nombre, con su aviso de que los pedidos ya hechos conservan el anterior", async () => {
    render(<Con Panel={PanelLaboratorios} inicial={{ laboratorios: [{ nombre: "Visión", activo: true }, { nombre: "Óptica Lab", activo: true }] }} />)
    fireEvent.click(screen.getByRole("button", { name: "Editar Visión" }))
    fireEvent.change(screen.getByLabelText("Nuevo nombre de Visión"), { target: { value: "Óptica Lab" } })
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(/Ya existe «Óptica Lab»/)
    fireEvent.change(screen.getByLabelText("Nuevo nombre de Visión"), { target: { value: "Visión Norte" } })
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }))
    await waitFor(() => expect(within(lista()).getByText("Visión Norte")).toBeInTheDocument())
    expect(registro.exitos.at(-1)).toMatch(/renombrado a «Visión Norte».*conservan el nombre anterior/)
  })

  it("desactiva y vuelve a activar: no se elimina nunca", async () => {
    render(<Con Panel={PanelLaboratorios} inicial={{ laboratorios: [{ nombre: "Visión Norte", activo: true }] }} />)
    expect(screen.queryByRole("button", { name: /Eliminar/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Desactivar Visión Norte" }))
    await waitFor(() => expect(within(lista()).getByText("Desactivado")).toBeInTheDocument())
    expect(registro.exitos.at(-1)).toBe("«Visión Norte» desactivado: ya no se ofrece en los pedidos nuevos.")
    fireEvent.click(screen.getByRole("button", { name: "Activar Visión Norte" }))
    await waitFor(() => expect(within(lista()).getByText("Activo")).toBeInTheDocument())
    expect(registro.exitos.at(-1)).toMatch(/activado: vuelve a ofrecerse/)
  })

  it("avisa cuando dos del catálogo parecen el mismo laboratorio", () => {
    render(<Con Panel={PanelLaboratorios} inicial={{ laboratorios: [{ nombre: "Laboratorio Visión Norte", activo: true }, { nombre: "Laboratorio Visión", activo: true }, { nombre: "Óptica Lab", activo: true }] }} />)
    expect(screen.getByRole("status")).toHaveTextContent("«Laboratorio Visión» y «Laboratorio Visión Norte»")
    expect(screen.getByRole("status")).not.toHaveTextContent("Óptica Lab")
  })

  it("si no se pudo guardar lo dice con palabras del usuario y no cambia la lista", async () => {
    render(<Con Panel={PanelLaboratorios} falla />)
    fireEvent.change(screen.getByLabelText("Nombre del laboratorio nuevo"), { target: { value: "Lab Sur" } })
    fireEvent.click(screen.getByRole("button", { name: /Agregar laboratorio/ }))
    await waitFor(() => expect(registro.errores).toEqual(["No se pudo agregar «Lab Sur». Revisa tu conexión e intenta de nuevo."]))
    expect(within(lista()).queryByText("Lab Sur")).not.toBeInTheDocument()
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
    await waitFor(() => expect(registro.exitos).toEqual(["Stock mínimo y máximo guardados correctamente."]))
    expect(registro.set.mock.calls[0][0]({ otra: 1 })).toEqual({ otra: 1, stockMinimo: 8, stockMaximo: 60 })
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
    await waitFor(() => expect(registro.errores).toEqual(["No se pudo guardar el stock mínimo y máximo. Revisa tu conexión e intenta de nuevo."]))
    expect(screen.getByLabelText(/^Stock máximo/)).toHaveValue(50)
  })
})
