import React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"

const logs = [
  { id: "1", usuario_nombre: "Vera Ventas", accion: "Cambió el estado de una orden de laboratorio", detalle: "OL-0040 → Entregada", modulo: "ventas", created_at: "2026-10-07T19:35:00Z" },
  { id: "2", usuario_nombre: "Ana Admin", accion: "Editó a un usuario", detalle: "Rosa Recepción", modulo: "usuarios", created_at: "2026-10-07T19:33:00Z" },
  { id: "3", usuario_nombre: "Ana Admin", accion: "Cambió la duración de cada cita", detalle: "40 min", modulo: "horario", created_at: "2026-10-07T19:32:00Z" },
]
const pedido = { limite: null }
vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    from: () => ({ select: () => ({ eq: () => ({ order: () => ({ limit: (n) => { pedido.limite = n; return Promise.resolve({ data: logs, error: null }) } }) }) }) }),
  },
}))

import VentanaActividad from "./VentanaActividad"

describe("Registro de actividad en la ventana estándar", () => {
  const abrir = async (onCerrar = () => {}) => {
    render(<VentanaActividad opticaId="o1" onCerrar={onCerrar} />)
    await screen.findByRole("list", { name: "Actividad" })
    return screen.getByRole("dialog", { name: "Registro de actividad" })
  }

  it("lista las acciones recientes y dice cuántas muestra de cuántas", async () => {
    const ventana = await abrir()
    expect(within(ventana).getAllByRole("listitem")).toHaveLength(3)
    expect(within(ventana).getByRole("status")).toHaveTextContent("Mostrando 3 de 3")
    expect(pedido.limite).toBe(200)
  })

  it("el buscador filtra por persona, acción o detalle", async () => {
    const ventana = await abrir()
    fireEvent.change(within(ventana).getByLabelText("Buscar en la actividad"), { target: { value: "orden" } })
    expect(within(ventana).getAllByRole("listitem")).toHaveLength(1)
    expect(within(ventana).getByRole("status")).toHaveTextContent("Mostrando 1 de 3")
  })

  it("filtra por usuario y por módulo; sin coincidencias ofrece quitar los filtros", async () => {
    const ventana = await abrir()
    fireEvent.change(within(ventana).getByLabelText("Filtrar actividad por usuario"), { target: { value: "Ana Admin" } })
    expect(within(ventana).getAllByRole("listitem")).toHaveLength(2)
    fireEvent.change(within(ventana).getByLabelText("Filtrar actividad por módulo"), { target: { value: "ventas" } })
    expect(within(ventana).queryByRole("listitem")).not.toBeInTheDocument()
    expect(within(ventana).getByText("Ninguna acción coincide con la búsqueda.")).toBeInTheDocument()
    fireEvent.click(within(ventana).getByRole("button", { name: "Quitar los filtros" }))
    expect(within(ventana).getAllByRole("listitem")).toHaveLength(3)
  })

  it("se cierra con la X, con Cerrar y con Escape", async () => {
    const cierres = []
    const ventana = await abrir(() => cierres.push("x"))
    const cerrar = within(ventana).getAllByRole("button", { name: "Cerrar" })
    expect(cerrar).toHaveLength(2)
    fireEvent.click(cerrar[0])
    fireEvent.click(cerrar[1])
    fireEvent.keyDown(document, { key: "Escape" })
    await waitFor(() => expect(cierres.length).toBeGreaterThanOrEqual(3))
  })
})
