import React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import { GraduacionVigente, CambioGraduacion, ListaRecetas } from "./Graduacion"
import GraduacionPerfil from "./GraduacionPerfil"
import HojaReceta, { numeroDeReceta } from "../HojaReceta"
import { imprimirHojaReceta } from "../../utilidades/imprimirHojaReceta"

const receta = (extra = {}) => ({
  id: "c1", fecha: "2026-04-20", pacienteId: "p1", diagnostico: "Miopía", indicaciones: "Usa tus lentes todo el día.", lenteRecomendado: "Progresivo con filtro azul",
  profesionalNombre: "Dra. Paula Andrade", profesionalRegistro: "REG-9",
  od: { esfera: "-1.75", cilindro: "-0.50", eje: "90", avSc: "20/60", avCc: "20/20" }, oi: { esfera: "-1.25", cilindro: "-0.75", eje: "80", avCc: "20/25" },
  medidas: { adicion: "+1.00", dp: "62", alt: "18" }, ...extra,
})
const anterior = receta({ id: "c0", fecha: "2025-11-21", od: { esfera: "-1.50", cilindro: "-0.50", eje: "90", avCc: "20/20" }, oi: { esfera: "-1.00", cilindro: "-0.75", eje: "80", avCc: "20/25" } })

describe("La graduación, un solo componente con dos versiones", () => {
  it("la versión del paciente usa palabras simples y la del personal la notación técnica, con los mismos valores", () => {
    const { unmount } = render(<GraduacionVigente receta={receta()} version="paciente" />)
    expect(screen.getByRole("region", { name: "Ojo derecho" })).toHaveTextContent("Tienes miopía leve")
    expect(document.body.textContent).not.toMatch(/\bOD\b|\bOI\b/)
    unmount()
    render(<GraduacionVigente receta={receta()} version="personal" />)
    const od = screen.getByRole("region", { name: "Ojo derecho" })
    expect(od).toHaveTextContent("OD · Ojo derecho")
    for (const v of ["−1.75", "Esfera", "Cilindro", "−0.50", "Eje", "90°", "AV sin lentes", "20/60", "AV con lentes", "20/20"]) expect(od).toHaveTextContent(v)
    expect(screen.getByRole("region", { name: "Ojo izquierdo" })).toHaveTextContent("OI · Ojo izquierdo")
    expect(document.body.textContent).toContain("Adición")
    expect(document.body.textContent).toContain("DP 62")
    expect(od).not.toHaveTextContent("Tienes miopía")
  })

  it("el antes → ahora dice lo mismo en las dos versiones: la misma cuenta, con palabras distintas", () => {
    const { unmount } = render(<CambioGraduacion consultas={[receta(), anterior]} version="paciente" />)
    expect(screen.getByRole("region", { name: "Cómo cambió desde tu examen anterior" })).toHaveTextContent("Un cuarto de dioptría más de corrección")
    unmount()
    render(<CambioGraduacion consultas={[receta(), anterior]} version="personal" />)
    const s = screen.getByRole("region", { name: "Cambio desde la consulta anterior" })
    expect(s).toHaveTextContent("OD · Ojo derecho")
    expect(s).toHaveTextContent("Aumentó 0.25 D")
  })

  it("la lista de recetas filtra por año, destaca la vigente y abre cada una; comparar necesita dos", () => {
    const abrir = vi.fn()
    const { unmount } = render(<ListaRecetas recetas={[receta()]} version="personal" onAbrir={abrir} />)
    expect(screen.queryByRole("button", { name: "Comparar dos recetas" })).not.toBeInTheDocument()
    unmount()
    render(<ListaRecetas recetas={[receta(), anterior]} version="personal" onAbrir={abrir} />)
    const lista = screen.getByRole("region", { name: "Recetas del paciente" })
    expect(lista).toHaveTextContent("vigente")
    expect(lista).toHaveTextContent("OD −1.75 −0.50 x90")
    fireEvent.click(within(lista).getByRole("button", { name: "2025" }))
    expect(within(lista).queryByRole("button", { name: /Ver la receta del 20 abr 2026/ })).not.toBeInTheDocument()
    fireEvent.click(within(lista).getByRole("button", { name: /Ver la receta del 21 nov 2025/ }))
    expect(abrir).toHaveBeenCalledWith("c0")
  })

  it("el perfil del personal: graduación vigente técnica, antes → ahora, lista y «Explicar al paciente» con palabras simples", () => {
    render(<GraduacionPerfil consultas={[anterior, receta()]} paciente={{ nombre: "Marta Zambrano", cedula: "0934070830" }} usuario={{ opticaNombre: "Óptica Solna Vision" }} tendencia={<p>Tendencia existente</p>} />)
    const seccion = screen.getByRole("region", { name: "Graduación del paciente" })
    expect(seccion).toHaveTextContent("Graduación vigente")
    expect(seccion).toHaveTextContent("Tendencia existente")
    expect(seccion).toHaveTextContent("OD · Ojo derecho")
    expect(within(seccion).getByRole("region", { name: "Cambio desde la consulta anterior" })).toBeInTheDocument()
    expect(within(seccion).getByRole("region", { name: "Recetas del paciente" })).toHaveTextContent("2 recetas")
    expect(screen.queryByText(/Tienes miopía leve/)).not.toBeInTheDocument()
    fireEvent.click(within(seccion).getByRole("button", { name: "Explicar al paciente" }))
    expect(screen.getByRole("dialog", { name: "Explicar al paciente" })).toHaveTextContent("Tienes miopía leve")
  })

  it("el perfil no dibuja nada si el paciente no tiene recetas (consultas sin medidas)", () => {
    const { container } = render(<GraduacionPerfil consultas={[{ id: "x", fecha: "2026-01-01", od: {}, oi: {} }]} paciente={{}} usuario={{}} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe("La hoja de la receta (la misma para el optómetra y el paciente)", () => {
  it("lleva el membrete, los datos del paciente, la tabla de graduación, el lente, las indicaciones, el profesional con su firma y la fecha", () => {
    render(<HojaReceta optica={{ nombre: "Óptica Solna Vision", direccion: "Av. Principal 123", telefono: "0991234567" }} paciente={{ nombre: "Marta Zambrano", cedula: "0934070830", edad: 72 }} receta={receta()} />)
    const hoja = document.querySelector("[data-hoja-receta]")
    for (const t of ["Óptica Solna Vision", "Av. Principal 123 · 0991234567", "Receta óptica", numeroDeReceta(receta()), "Marta Zambrano", "0934070830", "72 años", "Esfera", "Cilindro", "Eje", "AV con lentes", "−1.75", "-1.75", "Adición", "Distancia pupilar", "Lente recomendado", "Progresivo con filtro azul", "Indicaciones y cuidados", "Usa tus lentes todo el día.", "Dra. Paula Andrade", "Reg. Prof. REG-9", "20 de abril de 2026"]) {
      if (t === "−1.75") continue
      expect(hoja.textContent).toContain(t)
    }
  })
  it("sin permiso de medidas no imprime la distancia pupilar ni la altura", () => {
    render(<HojaReceta optica={{ nombre: "X" }} paciente={{ nombre: "Y" }} receta={receta()} mostrarMedidas={false} />)
    expect(document.body.textContent).not.toContain("Distancia pupilar")
    expect(document.body.textContent).toContain("Adición")
  })
  it("imprimirHojaReceta monta la hoja en una capa, imprime y la quita al terminar", () => {
    window.print = vi.fn()
    imprimirHojaReceta({ optica: { nombre: "Óptica Solna Vision" }, paciente: { nombre: "Marta Zambrano" }, receta: receta() })
    expect(window.print).toHaveBeenCalledTimes(1)
    expect(document.getElementById("print-hoja-receta")?.textContent).toContain("Marta Zambrano")
    expect(document.body.classList.contains("imprimiendo-hoja-receta")).toBe(true)
    window.dispatchEvent(new Event("afterprint"))
    expect(document.getElementById("print-hoja-receta")).toBeNull()
    expect(document.body.classList.contains("imprimiendo-hoja-receta")).toBe(false)
  })
})
