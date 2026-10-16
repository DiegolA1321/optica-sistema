import React from "react"
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import NotaAlcance from "./NotaAlcance"

describe("NotaAlcance", () => {
  it("con alcance propio avisa que las cifras son de sus pacientes y sus citas", () => {
    render(<NotaAlcance alcancePropio />)
    expect(screen.getByRole("note")).toHaveTextContent(/de tus pacientes y de tus citas, no de toda la óptica/)
  })
  it("con alcance de toda la óptica no dice nada", () => {
    const { container } = render(<NotaAlcance alcancePropio={false} />)
    expect(container).toBeEmptyDOMElement()
  })
})
