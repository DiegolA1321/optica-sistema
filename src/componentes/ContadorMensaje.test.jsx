import React from "react"
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import ContadorMensaje from "./ContadorMensaje"

describe("ContadorMensaje", () => {
  it("no aparece mientras el mensaje está lejos del límite", () => {
    const { container, rerender } = render(<ContadorMensaje valor={"a".repeat(1799)} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<ContadorMensaje valor="" />)
    expect(container).toBeEmptyDOMElement()
  })
  it("aparece desde 1800 caracteres, como «N de 2000»", () => {
    render(<ContadorMensaje valor={"a".repeat(1800)} />)
    expect(screen.getByRole("status")).toHaveTextContent("1800 de 2000")
  })
  it("al llegar al límite se pone en rojo y lo dice", () => {
    render(<ContadorMensaje valor={"a".repeat(2000)} />)
    const c = screen.getByRole("status")
    expect(c).toHaveTextContent("2000 de 2000 · llegaste al límite")
    expect(c.className).toMatch(/text-red-600/)
  })
})
