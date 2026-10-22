import React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"

// La base nunca responde: se comprueba que el formulario aparece de inmediato, con un aviso de que sigue cargando la receta y la montura.
const pendiente = new Promise(() => {})
const consulta = { select() { return this }, eq() { return this }, in() { return pendiente }, maybeSingle() { return pendiente } }
vi.mock("../lib/supabaseClient", () => ({ supabase: { from: () => consulta, rpc: () => pendiente } }))
import OrdenLaboratorioModal from "./OrdenLaboratorioModal"

describe("Otro pedido: el formulario aparece de inmediato", () => {
  it("se ve el formulario completo y un indicador de carga mientras llegan la receta y la montura", () => {
    render(<OrdenLaboratorioModal paciente={{ nombre: "Ana" }} facturaId="f1" consultaId="c1" usuario={{}} onCerrar={() => {}} />)
    expect(screen.getByRole("status")).toHaveTextContent("Cargando la receta y la montura de la venta")
    expect(screen.getByLabelText("OD esfera")).toBeInTheDocument()
    expect(screen.getByLabelText("Entrega")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Crear orden/ })).toBeDisabled() // no se guarda con la receta a medio llegar
  })

  it("lo que la persona escribe mientras carga no se pierde", () => {
    render(<OrdenLaboratorioModal paciente={{ nombre: "Ana" }} facturaId="f1" consultaId="c1" usuario={{}} onCerrar={() => {}} />)
    fireEvent.change(screen.getByLabelText("OD esfera"), { target: { value: "-1.50" } })
    expect(screen.getByLabelText("OD esfera")).toHaveValue("-1.50")
  })
})
