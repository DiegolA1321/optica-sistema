import React from "react"
import { describe, it, expect, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import ResolutionGuard from "./ResolutionGuard"

const ancho = (px) => Object.defineProperty(window, "innerWidth", { configurable: true, writable: true, value: px })
afterEach(() => ancho(1024))

describe("ResolutionGuard", () => {
  it("el personal, en una pantalla angosta, sigue viendo el aviso de tamaño no soportado", () => {
    ancho(390)
    render(<ResolutionGuard><p>contenido</p></ResolutionGuard>)
    expect(screen.getByRole("alert")).toHaveTextContent("Nivel de Zoom No Soportado")
    expect(screen.queryByText("contenido")).not.toBeInTheDocument()
  })
  it("las pantallas del paciente (desactivado) se muestran en el celular: se adaptan en vez de bloquearse", () => {
    ancho(390)
    render(<ResolutionGuard desactivado><p>contenido</p></ResolutionGuard>)
    expect(screen.getByText("contenido")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
  })
})
