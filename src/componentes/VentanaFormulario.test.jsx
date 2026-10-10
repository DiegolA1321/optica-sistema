import React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { Cascaron, PieFormulario } from "./AtencionPaciente"

describe("Ventana estándar como formulario", () => {
  const abrir = (extra = {}) => {
    const enviar = vi.fn((e) => e.preventDefault())
    const cerrar = vi.fn()
    render(
      <Cascaron titulo="Agregar producto" subtitulo="Datos del producto" ancho="max-w-md" onCerrar={cerrar} formulario={{ onSubmit: enviar }}
        pie={<PieFormulario onCancelar={cerrar} etiquetaGuardar="Guardar producto" {...extra} />}>
        <div className="p-6"><input aria-label="Nombre" /></div>
      </Cascaron>,
    )
    return { enviar, cerrar }
  }

  it("es la ventana del sistema: diálogo con su título, cierre con la X y pie con Cancelar y la acción", () => {
    abrir()
    const ventana = screen.getByRole("dialog", { name: "Agregar producto" })
    expect(ventana.tagName).toBe("FORM")
    expect(ventana).toHaveAttribute("aria-modal", "true")
    expect(screen.getByRole("button", { name: "Cerrar" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Guardar producto" })).toHaveAttribute("type", "submit")
  })

  it("Guardar envía el formulario; Cancelar, la X y Escape lo cierran sin enviar", () => {
    const { enviar, cerrar } = abrir()
    fireEvent.click(screen.getByRole("button", { name: "Guardar producto" }))
    expect(enviar).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }))
    fireEvent.keyDown(document, { key: "Escape" })
    expect(cerrar).toHaveBeenCalledTimes(3)
    expect(enviar).toHaveBeenCalledTimes(1)
  })

  it("mientras guarda, la acción dice 'Guardando…' y no se puede pulsar otra vez", () => {
    abrir({ guardando: true })
    expect(screen.getByRole("button", { name: "Guardando…" })).toBeDisabled()
  })
})
