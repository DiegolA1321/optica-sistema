import React, { useState } from "react"
import { describe, it, expect } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import CampoClaveTemporal from "./CampoClaveTemporal"
import { resolverClaveTemporal } from "../utilidades/validaciones"

function Prueba() {
  const [escribir, setEscribir] = useState(false)
  const [valor, setValor] = useState("")
  return <CampoClaveTemporal escribir={escribir} onEscribir={setEscribir} valor={valor} onValor={setValor} />
}

describe("CampoClaveTemporal", () => {
  it("por defecto la genera el sistema: no hay campo para escribirla", () => {
    render(<Prueba />)
    expect(screen.getByText(/la genera el sistema/)).toBeInTheDocument()
    expect(screen.queryByLabelText("Contraseña temporal")).toBeNull()
  })

  it("al elegir escribirla aparece el campo, sin autocompletar con datos del navegador", () => {
    render(<Prueba />)
    fireEvent.click(screen.getByLabelText("Escribir la contraseña temporal"))
    const campo = screen.getByLabelText("Contraseña temporal")
    expect(campo).toHaveAttribute("autocomplete", "new-password")
    expect(campo).toHaveAttribute("type", "password")
  })
})

describe("resolverClaveTemporal", () => {
  it("sin escribirla, genera una que cumple la regla", () => {
    const { clave, error } = resolverClaveTemporal(false, "")
    expect(error).toBeUndefined()
    expect(clave).toMatch(/^Opt-[A-Z]{4}\d{2}$/)
  })
  it("escrita, debe cumplir la regla de contraseñas del sistema", () => {
    expect(resolverClaveTemporal(true, "").error).toMatch(/Escribe la contraseña temporal/)
    expect(resolverClaveTemporal(true, "corta1").error).toBeTruthy()
    expect(resolverClaveTemporal(true, "sololetras").error).toBeTruthy()
    expect(resolverClaveTemporal(true, "Segura2026")).toEqual({ clave: "Segura2026" })
  })
})
