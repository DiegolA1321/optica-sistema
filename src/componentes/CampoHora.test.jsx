import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import CampoHora from "./CampoHora"

describe("CampoHora: la hora en 12 horas", () => {
  it("muestra «02:00 PM» y no «14:00», y entrega «HH:MM» (24 h) al cambiar", () => {
    const alCambiar = vi.fn()
    render(<CampoHora value="14:00" onChange={alCambiar} aria-label="Hora" />)
    const campo = screen.getByRole("combobox", { name: "Hora" })
    expect(campo).toHaveValue("14:00")
    expect(screen.getByRole("option", { name: "02:00 PM" })).toBeInTheDocument()
    expect(screen.queryByText("14:00")).toBeNull()
    fireEvent.change(campo, { target: { value: "09:15" } })
    expect(alCambiar).toHaveBeenCalledWith("09:15")
    expect(screen.getByRole("option", { name: "09:15 AM" })).toBeInTheDocument()
  })
  it("conserva como opción una hora que no cae en la lista y pide una hora si no hay valor", () => {
    const { rerender } = render(<CampoHora value="09:07" onChange={() => {}} aria-label="Hora" />)
    expect(screen.getByRole("option", { name: "09:07 AM" })).toBeInTheDocument()
    rerender(<CampoHora value="" onChange={() => {}} aria-label="Hora" />)
    expect(screen.getByRole("option", { name: "Hora" })).toBeInTheDocument()
  })
})
