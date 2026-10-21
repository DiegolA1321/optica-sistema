import React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import DetalleCitaModal from "./DetalleCitaModal"

const cita = { id: "c1", pacienteId: "p1", paciente: "Ana Pérez", fecha: "2026-10-20", hora: "09:00 AM", estado: "Pendiente", motivo: "Examen de Control", origen: "Recepción" }
const f = () => vi.fn()

// Cada acción del detalle solo aparece si Citas.jsx pasa su función, y la pasa según el permiso de quien mira.
describe("DetalleCitaModal: acciones según permisos", () => {
  it("sin funciones (solo ver) no ofrece editar, cancelar ni cambiar el estado", () => {
    render(<DetalleCitaModal cita={cita} onCerrar={f()} />)
    expect(screen.queryByRole("button", { name: /Editar cita/ })).toBeNull()
    expect(screen.queryByRole("button", { name: /Cancelar cita/ })).toBeNull()
    expect(screen.queryByRole("button", { name: /Atender/ })).toBeNull()
  })

  it("con las funciones de quien puede editar, las ofrece", () => {
    render(<DetalleCitaModal cita={cita} onCerrar={f()} onEditar={f()} onCancelar={f()} />)
    expect(screen.getByRole("button", { name: /Editar cita/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Cancelar cita/ })).toBeInTheDocument()
  })

  it("una atención abierta sin permiso de editar no ofrece 'Dejar de atender'", () => {
    render(<DetalleCitaModal cita={{ ...cita, estado: "En Atención" }} onCerrar={f()} />)
    expect(screen.queryByRole("button", { name: /Dejar de atender/ })).toBeNull()
  })

  it("con cobro pendiente, 'Cobrar' solo sale si quien mira puede vender, y no se ofrece 'Atender' en su lugar", () => {
    const atendida = { ...cita, estado: "Atendida" }
    const { rerender } = render(<DetalleCitaModal cita={atendida} cobroPendiente onCerrar={f()} onIngresar={f()} />)
    expect(screen.queryByRole("button", { name: /Cobrar/ })).toBeNull()
    expect(screen.queryByRole("button", { name: /Atender|Seguir atendiendo/ })).toBeNull()
    rerender(<DetalleCitaModal cita={atendida} cobroPendiente onCerrar={f()} onCobrar={f()} />)
    expect(screen.getByRole("button", { name: /Cobrar/ })).toBeInTheDocument()
  })
})
