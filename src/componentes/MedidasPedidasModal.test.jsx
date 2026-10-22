import React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import MedidasPedidasModal from "./MedidasPedidasModal"

const montar = (medidas, extra = {}) => {
  const fn = { onWhatsApp: vi.fn(), onMarcarEnviadas: vi.fn(), onAgendar: vi.fn(), onCerrar: vi.fn() }
  render(<MedidasPedidasModal paciente={{ nombre: "Ana Pérez" }} solicitadaEn="2026-10-18T10:00:00Z" medidas={medidas} puedeEscribirWhatsApp {...fn} {...extra} />)
  return fn
}

describe("Atender las medidas que pidió el paciente", () => {
  it("con las dos medidas: el detalle y las dos opciones de enviarlas", () => {
    const fn = montar({ dp: "62", altura: "18", hayAlgo: true, faltan: false })
    const d = screen.getByRole("dialog", { name: /Medidas de montaje pedidas/ })
    expect(d).toHaveTextContent("62 mm")
    expect(d).toHaveTextContent("18 mm")
    fireEvent.click(screen.getByRole("button", { name: "Enviar por WhatsApp" })); expect(fn.onWhatsApp).toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Marcar como enviadas" })); expect(fn.onMarcarEnviadas).toHaveBeenCalled()
    expect(screen.queryByRole("button", { name: "Agendar toma de medidas" })).not.toBeInTheDocument() // no falta nada
  })

  it("si falta algo dice qué y ofrece agendar la toma de medidas", () => {
    const fn = montar({ dp: "62", altura: "", hayAlgo: true, faltan: true })
    const d = screen.getByRole("dialog", { name: /Medidas de montaje pedidas/ })
    expect(d).toHaveTextContent("No registrada")
    expect(d).toHaveTextContent("Lo que falta se toma en la óptica")
    fireEvent.click(screen.getByRole("button", { name: "Agendar toma de medidas" })); expect(fn.onAgendar).toHaveBeenCalled()
  })

  it("sin ninguna medida solo queda agendar; sin teléfono no se ofrece WhatsApp", () => {
    montar({ dp: "", altura: "", hayAlgo: false, faltan: true }, { puedeEscribirWhatsApp: false })
    expect(screen.queryByRole("button", { name: "Enviar por WhatsApp" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Marcar como enviadas" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Agendar toma de medidas" })).toBeInTheDocument()
  })
})
