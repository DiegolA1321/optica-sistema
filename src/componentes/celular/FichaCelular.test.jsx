import React from "react"
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { BarraPasosCelular, CabeceraFichaCelular, PieFichaCelular } from "./FichaCelular"
import { Numero } from "../ficha/piezas"

const estados = { anamnesis: "Completo", examen: "Opcional", diagnostico: "Incompleto" }

describe("la barra de pasos del celular", () => {
  it("dice el paso en el que está con su estado y deja ir a cualquiera (mismos nombres accesibles que en la computadora)", async () => {
    const alIr = vi.fn()
    render(<BarraPasosCelular paso="examen" estados={estados} onIr={alIr} />)
    expect(screen.getByText(/Paso 2 de 3 · Examen/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Paso 2: Examen, Opcional" })).toHaveAttribute("aria-current", "step")
    await userEvent.click(screen.getByRole("button", { name: "Paso 3: Diagnóstico y receta, Incompleto" }))
    expect(alIr).toHaveBeenCalledWith("diagnostico")
  })
})

describe("la cabecera de la ficha en celular", () => {
  it("lleva el paciente, el motivo, cómo va el borrador y el botón de volver", async () => {
    const alVolver = vi.fn()
    render(<CabeceraFichaCelular nombre="Ana Pérez" motivo="Examen de control" guardado="Guardado ahora" onVolver={alVolver} etiquetaVolver="Volver a Citas médicas"><p>pasos</p></CabeceraFichaCelular>)
    expect(screen.getByText("Ana Pérez")).toBeInTheDocument()
    expect(screen.getByText(/Examen de control/)).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("Guardado ahora")
    await userEvent.click(screen.getByRole("button", { name: "Volver a Citas médicas" }))
    expect(alVolver).toHaveBeenCalled()
  })
})

describe("el pie fijo de la ficha en celular", () => {
  const props = { total: 3, fichaGuardada: false, formId: "ficha-form", onVerDocumento: vi.fn(), onAnterior: vi.fn(), onSiguiente: vi.fn(), onNueva: vi.fn() }
  it("en el primer paso: «Ver documento» y «Siguiente», sin «Anterior»", async () => {
    render(<PieFichaCelular {...props} indice={0} />)
    expect(screen.getByRole("button", { name: "Ver documento" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Anterior" })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }))
    expect(props.onSiguiente).toHaveBeenCalled()
  })
  it("en el paso del medio hay «Anterior» y «Siguiente»", () => {
    render(<PieFichaCelular {...props} indice={1} />)
    expect(screen.getByRole("button", { name: "Anterior" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeInTheDocument()
  })
  it("en el último paso «Terminar atención» envía el formulario de la ficha (no es «Siguiente»)", () => {
    render(<PieFichaCelular {...props} indice={2} />)
    const terminar = screen.getByRole("button", { name: /Terminar atención/ })
    expect(terminar).toHaveAttribute("type", "submit")
    expect(terminar).toHaveAttribute("form", "ficha-form")
    expect(screen.queryByRole("button", { name: "Siguiente" })).not.toBeInTheDocument()
  })
  it("con la atención ya terminada ofrece «Nueva consulta»", async () => {
    render(<PieFichaCelular {...props} indice={2} fichaGuardada />)
    expect(screen.queryByRole("button", { name: /Terminar atención/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: /Nueva consulta/ }))
    expect(props.onNueva).toHaveBeenCalled()
  })
})

describe("el teclado de los campos con signo", () => {
  const original = window.matchMedia
  afterEach(() => { window.matchMedia = original })
  const pantalla = (anchoMinimoCumple) => { window.matchMedia = vi.fn().mockImplementation((q) => ({ matches: anchoMinimoCumple, media: q, addEventListener: () => {}, removeEventListener: () => {} })) }

  it("en el celular, esfera y cilindro piden el teclado de texto (trae el «−» y el «.» en iPhone y Android)", () => {
    pantalla(false) // no se cumple min-width: 1093 → modo celular
    render(<><Numero id="esf" etiqueta="Esf." valor="" onCambiar={() => {}} signo /><Numero id="k1" etiqueta="K1" valor="" onCambiar={() => {}} /><Numero id="eje" etiqueta="Eje" valor="" onCambiar={() => {}} tipo="entero" signo /></>)
    expect(screen.getByLabelText("Esf.")).toHaveAttribute("inputmode", "text")
    expect(screen.getByLabelText("K1")).toHaveAttribute("inputmode", "decimal")
    expect(screen.getByLabelText("Eje")).toHaveAttribute("inputmode", "numeric")
  })
  it("en la computadora nada cambia: teclado numérico de siempre", () => {
    pantalla(true)
    render(<Numero id="esf" etiqueta="Esf." valor="" onCambiar={() => {}} signo />)
    expect(screen.getByLabelText("Esf.")).toHaveAttribute("inputmode", "decimal")
    expect(screen.getByLabelText("Esf.")).not.toHaveAttribute("autocapitalize")
  })
})
