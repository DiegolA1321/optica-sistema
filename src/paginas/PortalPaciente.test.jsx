import React from "react"
import { describe, it, expect, beforeEach } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import PortalPaciente from "./PortalPaciente"

const usuario = { id: "p1", nombre: "Rosa Bravo", cedula: "0900000011", rol: "paciente", token: "tok", opticaId: "o1" }
const consulta = (extra = {}) => ({
  id: "c1", fecha: "2026-10-01", pacienteId: "p1", paciente: "Rosa Bravo", diagnostico: "Miopía", indicaciones: "Uso permanente", lenteRecomendado: "Monofocal",
  profesionalNombre: "Dra. Prueba", profesionalRegistro: "REG-1", usaLentes: true,
  od: { esfera: "-1.50", cilindro: "-0.50", eje: "90", avSc: "20/40", avCc: "20/20" },
  oi: { esfera: "-1.25", cilindro: "-0.75", eje: "80", avSc: "20/50", avCc: "20/25" },
  medidas: { adicion: "+1.00", dp: "62", alt: "18" },
  ...extra,
})
const base = { usuario, citas: [], setCitas: () => {}, consultas: [consulta()], disponibilidad: null, opticaId: "o1", opticaPublica: { nombre: "Óptica Prueba" }, parametrizacion: {}, motivosConsulta: [], onCerrarSesion: () => {} }
const irA = (nombre) => fireEvent.click(screen.getAllByRole("button", { name: new RegExp(nombre) })[0])

beforeEach(() => { window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })) })

describe("Portal del paciente — receta", () => {
  it("con la política apagada muestra la receta completa y no la distancia pupilar ni la altura", () => {
    render(<PortalPaciente {...base} parametrizacion={{ mostrarMedidasPaciente: false }} />)
    irA("Mi receta")
    expect(screen.getAllByText("-1.50 -0.50 x90").length).toBeGreaterThan(0)
    expect(screen.getAllByText("-1.25 -0.75 x80").length).toBeGreaterThan(0)
    expect(screen.getByText("+1.00")).toBeInTheDocument()
    expect(screen.queryByText("Medidas protegidas")).not.toBeInTheDocument()
    expect(screen.queryByText("Distancia pupilar")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Solicitar distancia pupilar y medidas de montaje/ })).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/costo adicional/i)
  })

  it("con la política encendida muestra también la distancia pupilar y la altura, sin botón de solicitud", () => {
    render(<PortalPaciente {...base} parametrizacion={{ mostrarMedidasPaciente: true }} />)
    irA("Mi receta")
    expect(screen.getByText("Distancia pupilar")).toBeInTheDocument()
    expect(screen.getByText("62")).toBeInTheDocument()
    expect(screen.getByText("Altura")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Solicitar distancia pupilar/ })).not.toBeInTheDocument()
  })

  it("si el servidor no manda medidas (sin adición, sin distancia pupilar) no hay errores ni huecos", () => {
    render(<PortalPaciente {...base} consultas={[consulta({ medidas: undefined })]} parametrizacion={{ mostrarMedidasPaciente: true }} />)
    irA("Mi receta")
    expect(screen.getAllByText("-1.50 -0.50 x90").length).toBeGreaterThan(0)
    expect(screen.queryByText("Adición")).not.toBeInTheDocument()
    expect(screen.queryByText("Distancia pupilar")).not.toBeInTheDocument()
  })

  it("las recetas anteriores muestran su graduación, no un candado", () => {
    const vieja = consulta({ id: "c0", fecha: "2025-05-02", od: { esfera: "-1.00" }, oi: { esfera: "-0.75" } })
    render(<PortalPaciente {...base} consultas={[consulta(), vieja]} />)
    irA("Mi receta")
    const lista = screen.getByText("Recetas anteriores").parentElement
    expect(within(lista).getByText(/OD -1\.00/)).toBeInTheDocument()
    expect(within(lista).queryByText("Medidas protegidas")).not.toBeInTheDocument()
  })
})

describe("Portal del paciente — Mis datos", () => {
  it("ofrece 'Descargar mis datos' junto a la eliminación de la cuenta", () => {
    render(<PortalPaciente {...base} />)
    irA("Mis datos")
    expect(screen.getByRole("button", { name: /Descargar mis datos/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Solicitar eliminación/ })).toBeInTheDocument()
  })
})
