import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react"

const datos = vi.hoisted(() => ({ leerAvisosInternos: vi.fn(), marcarAvisosInternosLeidos: vi.fn(async () => ({})) }))
vi.mock("../utilidades/soporteDatos", async (original) => ({ ...(await original()), leerAvisosInternos: datos.leerAvisosInternos, marcarAvisosInternosLeidos: datos.marcarAvisosInternosLeidos }))

import AvisosInicio from "./AvisosInicio"

const usuario = { id: "u2", rol: "asistente", nombre: "Rosa", opticaId: "o1" }
const aviso = (id, extra = {}) => ({ id, opticaId: "o1", autorId: "u1", autorNombre: "Ana Admin", titulo: "Título " + id, cuerpo: "Cuerpo " + id, para: "todos", rolId: null, perfilId: null, venceEl: null, creadoEn: "2026-10-20T15:00:00Z", ...extra })

describe("Avisos del Inicio (lo que publica el administrador)", () => {
  beforeEach(() => { datos.leerAvisosInternos.mockReset(); datos.marcarAvisosInternosLeidos.mockClear() })

  it("sin avisos no se dibuja nada (ni un hueco ni «no hay avisos»)", async () => {
    datos.leerAvisosInternos.mockResolvedValue({ datos: [], leidos: [], lecturas: [] })
    const { container } = render(<AvisosInicio usuario={usuario} />)
    await waitFor(() => expect(datos.leerAvisosInternos).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it("los no leídos van primero y destacados, con «N nuevos»; cada uno se marca como leído a mano", async () => {
    datos.leerAvisosInternos.mockResolvedValue({ datos: [aviso("a"), aviso("b", { creadoEn: "2026-10-19T15:00:00Z" })], leidos: ["a"], lecturas: [] })
    render(<AvisosInicio usuario={usuario} />)
    const seccion = await screen.findByRole("region", { name: "Avisos" })
    expect(seccion).toHaveTextContent("1 nuevo")
    const items = within(seccion).getAllByRole("listitem")
    expect(items[0]).toHaveTextContent("Título b") // el no leído, aunque sea más viejo
    expect(items[0].className).toMatch(/border-blue-300/)
    expect(items[1]).toHaveTextContent("Título a")
    expect(within(items[1]).queryByRole("button", { name: /Leído/ })).toBeNull()
    fireEvent.click(within(items[0]).getByRole("button", { name: /Leído/ }))
    await waitFor(() => expect(datos.marcarAvisosInternosLeidos).toHaveBeenCalledWith(["b"]))
  })

  it("no muestra los vencidos ni los que escribió la misma persona", async () => {
    datos.leerAvisosInternos.mockResolvedValue({ datos: [aviso("a", { venceEl: "2020-01-01" }), aviso("b", { autorId: "u2" })], leidos: [], lecturas: [] })
    const { container } = render(<AvisosInicio usuario={usuario} />)
    await waitFor(() => expect(datos.leerAvisosInternos).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it("muestra los tres más recientes y «Ver todos» abre la ventana de avisos", async () => {
    datos.leerAvisosInternos.mockResolvedValue({ datos: ["a", "b", "c", "d"].map((i) => aviso(i)), leidos: [], lecturas: [] })
    render(<AvisosInicio usuario={usuario} />)
    const seccion = await screen.findByRole("region", { name: "Avisos" })
    expect(within(seccion).getAllByRole("listitem")).toHaveLength(3)
    fireEvent.click(within(seccion).getByRole("button", { name: "Ver todos los avisos" }))
    expect(await screen.findByRole("dialog", { name: "Avisos de tu administrador" })).toBeInTheDocument()
  })
})
