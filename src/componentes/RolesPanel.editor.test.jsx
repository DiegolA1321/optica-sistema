import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"

const insert = vi.fn()
const update = vi.fn()
vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    from: () => ({
      insert: (d) => { insert(d); return Promise.resolve({ error: null }) },
      update: (d) => ({ eq: () => { update(d); return Promise.resolve({ error: null }) } }),
    }),
    rpc: vi.fn(),
  },
}))

import RolesPanel from "./RolesPanel"

const optometra = { id: "r1", nombre: "Optómetra", descripcion: "", es_predefinido: true, atiende_pacientes: true, inicio: "optometra",
  permisos: { citas: ["ver", "crear", "editar"], consultas: ["ver", "crear", "editar"], pacientes: ["ver", "crear", "editar"], inventario: ["ver"], reportes: ["ver"] },
  alcance: { citas: "propio", consultas: "atiende", reportes: "propio" } }
const base = { usuario: { id: "u1", opticaId: "o1" }, asignaciones: [], onCambio: vi.fn(), onExito: vi.fn(), roles: [optometra] }
const abrir = () => { const { rerender } = render(<RolesPanel {...base} pedidoNuevoRol={0} />); rerender(<RolesPanel {...base} pedidoNuevoRol={1} />); return screen.getByRole("dialog", { name: "Crear rol" }) }
const interruptor = (v, nombre) => within(v).getByRole("switch", { name: nombre })

beforeEach(() => { insert.mockClear(); update.mockClear(); base.onExito.mockClear() })

describe("Crear rol (diseño de la Ronda 5)", () => {
  it("todo empieza apagado y la nota lo dice; solo administración no se puede activar", () => {
    const v = abrir()
    for (const s of within(v).getAllByRole("switch")) expect(s).toHaveAttribute("aria-checked", "false")
    expect(v).toHaveTextContent("Todo empieza apagado y con el alcance más restrictivo («Solo lo suyo»). Solo se activa lo que se marca.")
    expect(within(v).getByText("Usuarios y permisos")).toBeInTheDocument()
    expect(within(v).getByText("Solo administración")).toBeInTheDocument()
    expect(interruptor(v, "Usuarios y permisos: Ver (solo administración)")).toBeDisabled()
    expect(within(v).queryAllByRole("combobox", { name: /Qué datos ve/ })).toHaveLength(0) // sin módulo encendido, nada que acotar
  })

  it("«Borrar» solo existe donde el módulo lo tiene (las citas no se borran: se cancelan)", () => {
    const v = abrir()
    expect(within(v).queryByRole("switch", { name: "Citas médicas: Borrar" })).toBeNull()
    expect(interruptor(v, "Ventas: Borrar")).toBeInTheDocument()
    expect(interruptor(v, "Pacientes: Borrar")).toBeInTheDocument()
  })

  it("al encender un módulo con alcance, «Qué datos ve» parte de lo más restrictivo", () => {
    const v = abrir()
    fireEvent.click(interruptor(v, "Ficha clínica: Ver"))
    const alcance = within(v).getByRole("combobox", { name: "Qué datos ve en Ficha clínica" })
    expect(alcance).toHaveValue("propio")
    expect([...alcance.options].map((o) => o.textContent)).toEqual(["Solo las suyas", "Los que atiende", "Toda la óptica"])
    fireEvent.click(interruptor(v, "Citas médicas: Ver"))
    const citas = within(v).getByRole("combobox", { name: "Qué datos ve en Citas médicas" })
    expect(citas).toHaveValue("propio")
    expect([...citas.options].map((o) => o.textContent)).toEqual(["Solo las suyas", "Toda la óptica"])
    fireEvent.click(interruptor(v, "Reportes: Ver"))
    expect([...within(v).getByRole("combobox", { name: "Qué datos ve en Reportes" }).options].map((o) => o.textContent)).toEqual(["Solo lo suyo", "Toda la óptica"])
  })

  it("un nivel enciende «Ver» y quitar «Ver» apaga todo el módulo", () => {
    const v = abrir()
    fireEvent.click(interruptor(v, "Ventas: Editar"))
    expect(interruptor(v, "Ventas: Ver")).toHaveAttribute("aria-checked", "true")
    fireEvent.click(interruptor(v, "Ventas: Ver"))
    expect(interruptor(v, "Ventas: Editar")).toHaveAttribute("aria-checked", "false")
  })

  it("«Partir de» copia los permisos, el alcance y si atiende pacientes; «Ningún rol» lo apaga todo", () => {
    const v = abrir()
    fireEvent.change(within(v).getByLabelText("Partir de"), { target: { value: "r1" } })
    expect(interruptor(v, "Citas médicas: Editar")).toHaveAttribute("aria-checked", "true")
    expect(interruptor(v, "Ventas: Ver")).toHaveAttribute("aria-checked", "false")
    expect(within(v).getByRole("combobox", { name: "Qué datos ve en Ficha clínica" })).toHaveValue("atiende")
    expect(within(v).getByRole("combobox", { name: "Qué datos ve en Citas médicas" })).toHaveValue("propio")
    fireEvent.change(within(v).getByLabelText("Partir de"), { target: { value: "" } })
    for (const s of within(v).getAllByRole("switch")) expect(s).toHaveAttribute("aria-checked", "false")
  })

  it("guarda el rol con el alcance explícito de cada módulo que tiene y lo que partió del otro rol", async () => {
    const v = abrir()
    fireEvent.change(within(v).getByPlaceholderText("Ej. Optómetra principal"), { target: { value: "Optómetra de apoyo" } })
    fireEvent.change(within(v).getByLabelText("Partir de"), { target: { value: "r1" } })
    fireEvent.click(interruptor(v, "Citas médicas: Editar")) // lo apaga
    fireEvent.change(within(v).getByRole("combobox", { name: "Qué datos ve en Ficha clínica" }), { target: { value: "propio" } })
    fireEvent.click(within(v).getByRole("button", { name: "Crear rol" }))
    await waitFor(() => expect(insert).toHaveBeenCalledTimes(1))
    const d = insert.mock.calls[0][0]
    expect(d).toMatchObject({ nombre: "Optómetra de apoyo", atiende_pacientes: true, inicio: "optometra", optica_id: "o1" })
    expect(d.permisos.citas).toEqual(["ver", "crear"])
    expect(d.alcance).toEqual({ citas: "propio", consultas: "propio", reportes: "propio" })
    await waitFor(() => expect(base.onExito).toHaveBeenCalledWith("Rol «Optómetra de apoyo» creado."))
  })

  it("un rol sin alcance guardado se muestra como «Toda la óptica» (como la base) y al editarlo no cambia nada", async () => {
    const recepcion = { id: "r2", nombre: "Recepción", descripcion: "", es_predefinido: true, atiende_pacientes: false, inicio: "recepcion", permisos: { citas: ["ver", "editar"] }, alcance: {} }
    render(<RolesPanel {...base} roles={[recepcion]} />)
    fireEvent.click(screen.getByRole("button", { name: "Editar Recepción" }))
    const v = screen.getByRole("dialog", { name: /Editar rol: Recepción/ })
    expect(within(v).getByRole("combobox", { name: "Qué datos ve en Citas médicas" })).toHaveValue("todo")
    expect(within(v).queryByLabelText("Partir de")).toBeNull() // «Partir de» es de un rol nuevo
    fireEvent.click(within(v).getByRole("button", { name: "Guardar cambios" }))
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1))
    expect(update.mock.calls[0][0].alcance).toEqual({ citas: "todo" })
  })
})
