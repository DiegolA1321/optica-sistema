import React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { Clock } from "lucide-react"
import ParaEmpezar from "./ParaEmpezar"

describe("ParaEmpezar", () => {
  it("lista los pasos numerados y cada uno lleva a su pantalla", () => {
    const ir = vi.fn()
    render(<ParaEmpezar pasos={[{ id: "a", titulo: "Revisa tu horario", texto: "Abre los espacios.", icono: Clock, onClick: ir }]} />)
    expect(screen.getByRole("heading", { name: "Para empezar" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /1\. Revisa tu horario/ }))
    expect(ir).toHaveBeenCalledTimes(1)
  })
  it("sin pasos no ocupa lugar", () => {
    const { container } = render(<ParaEmpezar pasos={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})
