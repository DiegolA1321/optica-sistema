import React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import EliminarPacienteModal from "./EliminarPacienteModal"

const paciente = { id: "p1", nombre: "María Fernanda Quispe" }

describe("EliminarPacienteModal", () => {
  it("explica que es irreversible y qué se borra y qué se conserva", () => {
    render(<EliminarPacienteModal paciente={paciente} nCitas={2} nConsultas={1} nVentas={1} onConfirmar={() => {}} onCancelar={() => {}} />)
    expect(screen.getByText(/Esta acción es irreversible/i)).toBeInTheDocument()
    expect(screen.getByText(/Se borra/i)).toBeInTheDocument()
    expect(screen.getByText(/Se conserva, sin identificarlo/i)).toBeInTheDocument()
    expect(screen.getByText(/2 citas/)).toBeInTheDocument()
  })

  it("el botón solo se habilita al escribir el nombre exacto", () => {
    const onConfirmar = vi.fn()
    render(<EliminarPacienteModal paciente={paciente} onConfirmar={onConfirmar} onCancelar={() => {}} />)
    const boton = screen.getByRole("button", { name: /Eliminar para siempre/i })
    expect(boton).toBeDisabled()
    const campo = screen.getByLabelText(/escribe el nombre del paciente/i)
    fireEvent.change(campo, { target: { value: "María Fernanda" } })
    expect(boton).toBeDisabled()
    fireEvent.change(campo, { target: { value: "maría fernanda quispe" } })
    expect(boton).toBeDisabled()
    fireEvent.change(campo, { target: { value: "  María Fernanda Quispe " } })
    expect(boton).toBeEnabled()
    fireEvent.click(boton)
    expect(onConfirmar).toHaveBeenCalledTimes(1)
  })
})
