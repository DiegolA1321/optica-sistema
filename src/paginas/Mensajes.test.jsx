import React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

// Una consulta de Supabase de mentira: cada método devuelve la misma cadena y, al esperarla, entrega listas vacías.
const cadena = () => {
  const o = { select: () => o, eq: () => o, order: () => o, limit: () => o, single: () => Promise.resolve({ data: null, error: null }), maybeSingle: () => Promise.resolve({ data: null, error: null }), then: (res) => res({ data: [], error: null }) }
  return o
}
vi.mock("../lib/supabaseClient", () => ({ supabase: { from: () => cadena() } }))

import Mensajes from "./Mensajes"

const admin = { id: "u1", rol: "admin", nombre: "Ana", opticaId: "o1" }

describe("Soporte (antes Mensajes)", () => {
  it("se llama 'Soporte', dice a quién se escribe y no menciona 'el equipo de la óptica'", async () => {
    render(<Mensajes usuario={admin} />)
    expect(await screen.findByRole("heading", { level: 1, name: "Soporte" })).toBeInTheDocument()
    expect(screen.getByText(/Escribe a el soporte del sistema|Escribe a el soporte de/)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/equipo de la óptica/i)
  })

  it("sin mensajes no muestra dos tarjetas en cero: lo primero es el formulario", async () => {
    render(<Mensajes usuario={admin} />)
    await screen.findByRole("heading", { level: 1, name: "Soporte" })
    expect(screen.queryByText("Consultas abiertas")).not.toBeInTheDocument()
    expect(screen.queryByText("Avisos del sistema")).not.toBeInTheDocument()
    expect(screen.getByText("Escribir una consulta")).toBeInTheDocument()
  })
})
