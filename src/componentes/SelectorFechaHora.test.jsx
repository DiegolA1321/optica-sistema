import React from "react"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import SelectorFechaHora from "./SelectorFechaHora"

const SESION = (activo, inicio, fin) => ({ activo, inicio, fin })

// Solo abre los martes, 09:00–11:00, citas de 60 min -> dos horarios: 09:00 AM y 10:00 AM.
const disponibilidad = {
  horarioSemanal: {
    domingo: { manana: SESION(false), tarde: SESION(false) },
    lunes: { manana: SESION(false), tarde: SESION(false) },
    martes: { manana: SESION(true, "09:00", "11:00"), tarde: SESION(false) },
    miercoles: { manana: SESION(false), tarde: SESION(false) },
    jueves: { manana: SESION(false), tarde: SESION(false) },
    viernes: { manana: SESION(false), tarde: SESION(false) },
    sabado: { manana: SESION(false), tarde: SESION(false) },
  },
  excepciones: {},
  duracionCita: 60,
}

describe("SelectorFechaHora (hoy fijo: martes 10 de marzo de 2026)", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 10, 8, 0, 0)) // antes de las 9am, ningún slot de hoy "ya pasó"
  })
  afterEach(() => vi.useRealTimers())

  it("muestra el mes y año actuales", () => {
    render(<SelectorFechaHora disponibilidad={disponibilidad} fecha={null} hora="" onCambiarFecha={() => {}} onCambiarHora={() => {}} />)
    expect(screen.getByText(/marzo 2026/i)).toBeInTheDocument()
  })

  it("sin fecha elegida, muestra el placeholder en vez de horarios", () => {
    render(<SelectorFechaHora disponibilidad={disponibilidad} fecha={null} hora="" onCambiarFecha={() => {}} onCambiarHora={() => {}} />)
    expect(screen.getByText(/elige un día disponible/i)).toBeInTheDocument()
  })

  it("un día sin cupo (miércoles) aparece deshabilitado y no dispara onCambiarFecha al clickear", () => {
    const onCambiarFecha = vi.fn()
    render(<SelectorFechaHora disponibilidad={disponibilidad} fecha={null} hora="" onCambiarFecha={onCambiarFecha} onCambiarHora={() => {}} />)
    // 11 de marzo de 2026 es miércoles, cerrado.
    const boton11 = screen.getByRole("button", { name: "11" })
    expect(boton11).toBeDisabled()
    fireEvent.click(boton11)
    expect(onCambiarFecha).not.toHaveBeenCalled()
  })

  it("clickear un día disponible (martes 10) llama a onCambiarFecha con el ISO correcto y limpia la hora", () => {
    const onCambiarFecha = vi.fn()
    const onCambiarHora = vi.fn()
    render(<SelectorFechaHora disponibilidad={disponibilidad} fecha={null} hora="" onCambiarFecha={onCambiarFecha} onCambiarHora={onCambiarHora} />)
    const boton10 = screen.getByRole("button", { name: "10" })
    expect(boton10).not.toBeDisabled()
    fireEvent.click(boton10)
    expect(onCambiarFecha).toHaveBeenCalledWith("2026-03-10")
    expect(onCambiarHora).toHaveBeenCalledWith("")
  })

  it("con una fecha elegida, muestra exactamente los horarios generados (09:00 AM y 10:00 AM)", () => {
    render(<SelectorFechaHora disponibilidad={disponibilidad} fecha="2026-03-10" hora="" onCambiarFecha={() => {}} onCambiarHora={() => {}} />)
    expect(screen.getByRole("button", { name: "09:00 AM" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "10:00 AM" })).toBeInTheDocument()
  })

  it("un horario ya ocupado por una cita existente aparece deshabilitado", () => {
    const citas = [{ fecha: "2026-03-10", hora: "09:00 AM" }]
    render(<SelectorFechaHora disponibilidad={disponibilidad} citas={citas} fecha="2026-03-10" hora="" onCambiarFecha={() => {}} onCambiarHora={() => {}} />)
    expect(screen.getByRole("button", { name: "09:00 AM" })).toBeDisabled()
    expect(screen.getByRole("button", { name: "10:00 AM" })).not.toBeDisabled()
  })

  it("clickear un horario libre llama a onCambiarHora con ese horario", () => {
    const onCambiarHora = vi.fn()
    render(<SelectorFechaHora disponibilidad={disponibilidad} fecha="2026-03-10" hora="" onCambiarFecha={() => {}} onCambiarHora={onCambiarHora} />)
    fireEvent.click(screen.getByRole("button", { name: "10:00 AM" }))
    expect(onCambiarHora).toHaveBeenCalledWith("10:00 AM")
  })

  it("un día sin ningún cupo en toda la semana muestra el mensaje de 'sin horarios'", () => {
    const disponibilidadCerrada = { ...disponibilidad, horarioSemanal: { ...disponibilidad.horarioSemanal, martes: { manana: SESION(false), tarde: SESION(false) } } }
    render(<SelectorFechaHora disponibilidad={disponibilidadCerrada} fecha="2026-03-10" hora="" onCambiarFecha={() => {}} onCambiarHora={() => {}} />)
    expect(screen.getByText(/no hay horarios disponibles/i)).toBeInTheDocument()
  })
})
