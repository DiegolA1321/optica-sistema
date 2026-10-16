import React, { useState } from "react"
import { describe, it, expect } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import PermisosAlRegistrar from "./PermisosAlRegistrar"

function Prueba({ persona }) {
  const [p, setP] = useState({ recordatorios: true, promociones: false })
  return <PermisosAlRegistrar persona={persona} recordatorios={p.recordatorios} promociones={p.promociones} onCambiar={(c) => setP((x) => ({ ...x, ...c }))} />
}

describe("permisos al registrar", () => {
  it("'Recordatorios de salud' viene marcado y 'Promociones y saludos' desmarcado, cada uno con su texto", () => {
    render(<Prueba />)
    expect(screen.getByRole("checkbox", { name: /Recordatorios de salud/ })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: /Promociones y saludos/ })).not.toBeChecked()
    expect(screen.getByText(/Avisos de su control, de sus citas/)).toBeInTheDocument()
    expect(screen.getByText(/un saludo en su cumpleaños/)).toBeInTheDocument()
  })
  it("se marcan y desmarcan por separado", () => {
    render(<Prueba />)
    fireEvent.click(screen.getByRole("checkbox", { name: /Promociones y saludos/ }))
    fireEvent.click(screen.getByRole("checkbox", { name: /Recordatorios de salud/ }))
    expect(screen.getByRole("checkbox", { name: /Promociones y saludos/ })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: /Recordatorios de salud/ })).not.toBeChecked()
  })
  it("el paciente que reserva por la web lo lee en segunda persona", () => {
    render(<Prueba persona="yo" />)
    expect(screen.getByText("Mensajes que quieres recibir")).toBeInTheDocument()
    expect(screen.getByText(/Te escribimos con ofertas/)).toBeInTheDocument()
  })
})
