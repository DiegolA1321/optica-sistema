import React from "react"
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import Configuracion from "./Configuracion"

const admin = { id: "u1", rol: "admin", nombre: "Ana", opticaId: "o1" }
const props = { usuario: admin, parametrizacion: {}, setParametrizacion: () => Promise.resolve({ error: null }), motivosConsulta: ["Consulta General"], setMotivosConsulta: () => {} }

describe("Configuración", () => {
  it("no deja notas de versión pegadas ni repite que solo el administrador la ve", () => {
    render(<Configuracion {...props} />)
    expect(document.body.textContent).not.toMatch(/desde esta versión/i)
    expect(document.body.textContent).not.toMatch(/solo los ve y edita el administrador/i)
  })

  it("la página que ve el paciente se llama 'Página pública', no 'Página de login'", () => {
    render(<Configuracion {...props} />)
    expect(screen.getByRole("tab", { name: /Página pública/ })).toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: /Página de login/ })).not.toBeInTheDocument()
  })
})
