import React from "react"
import { describe, it, expect } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import AgendarCitaPublica from "./AgendarCitaPublica"

const base = { onVolver: () => {}, citas: [], setCitas: () => {}, disponibilidad: null, opticaId: "o1", opticaPublica: { nombre: "Óptica Prueba" }, parametrizacion: {} }

describe("Agendar cita pública — motivos", () => {
  it("ofrece los motivos configurados en la óptica, no una lista aparte", () => {
    render(<AgendarCitaPublica {...base} motivosConsulta={["Consulta General", "Control de miopía infantil"]} />)
    expect(screen.getByRole("button", { name: /Consulta General/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Control de miopía infantil/ })).toBeInTheDocument()
    expect(screen.queryByText("Medición y examen visual")).not.toBeInTheDocument()
    expect(screen.queryByText("Compra de lentes o monturas")).not.toBeInTheDocument()
    expect(screen.queryByText("Atención por molestia o enfermedad")).not.toBeInTheDocument()
  })

  it("sin motivos cargados usa los cuatro de la agenda interna", () => {
    render(<AgendarCitaPublica {...base} />)
    for (const m of ["Consulta General", "Examen de Control", "Adaptación de Lentes", "Garantía / Ajuste"]) expect(screen.getByRole("button", { name: new RegExp(m.replace("/", "\/")) })).toBeInTheDocument()
  })

  it("contar una molestia es opcional y se abre aparte del motivo", () => {
    render(<AgendarCitaPublica {...base} />)
    expect(screen.queryByText("¿Qué síntomas tienes?")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /¿Tienes alguna molestia\?/ }))
    expect(screen.getByText("¿Qué síntomas tienes?")).toBeInTheDocument()
  })
})
