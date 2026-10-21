import React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
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

describe("DetalleCitaModal: Paciente · Cita · Seguimiento", () => {
  const completa = { ...cita, cedula: "0912345678", telefono: "0991112233", correo: "ana@x.com", creadoEn: "2026-10-18T14:00:00Z", origen: "paciente" }
  it("las tres columnas van en ese orden, con «Ver perfil» abajo, junto a las demás acciones", () => {
    render(<DetalleCitaModal cita={completa} onCerrar={f()} />)
    const titulos = screen.getAllByRole("heading", { level: 5 }).map((h) => h.textContent)
    expect(titulos).toEqual(["Paciente", "Cita", "Seguimiento"])
    const paciente = screen.getByRole("region", { name: "Paciente" })
    expect(within(paciente).queryByRole("link", { name: /Ver perfil/ })).not.toBeInTheDocument()
    const acciones = screen.getByRole("group", { name: "Acciones de la cita" })
    expect(within(acciones).getByRole("link", { name: /Ver perfil/ })).toBeInTheDocument()
    expect(screen.getAllByRole("link", { name: /Ver perfil/ })).toHaveLength(1) // una sola vez, abajo
  })
  it("el seguimiento es una línea de tiempo: agendada y por dónde; con eventos guardados dice quién, cuándo y el motivo", () => {
    const eventos = [
      { id: "e1", tipo: "agendada", en: "2026-10-18T14:00:00Z", quien: "Paciente Web", datos: { origen: "portal" } },
      { id: "e2", tipo: "reagendada", en: "2026-10-19T15:00:00Z", quien: "Paciente Web", datos: { fecha_anterior: "2026-10-20", hora_anterior: "08:00 AM" } },
      { id: "e3", tipo: "cancelada", en: "2026-10-20T16:00:00Z", quien: "Rosa Recepción", datos: { motivo: "El paciente lo pidió por llamada o WhatsApp", detalle: "Llamó a las 9" } },
    ]
    render(<DetalleCitaModal cita={{ ...completa, estado: "Cancelada" }} eventos={eventos} onCerrar={f()} />)
    const linea = screen.getByRole("list", { name: "Línea de tiempo de la cita" })
    const items = within(linea).getAllByRole("listitem")
    expect(items).toHaveLength(3)
    expect(items[0]).toHaveTextContent("Agendada · Portal del paciente")
    expect(items[1]).toHaveTextContent("Reagendada")
    expect(items[1]).toHaveTextContent("Reagendada desde el martes, 20 de octubre a las 08:00 AM")
    expect(items[2]).toHaveTextContent("Cancelada")
    expect(items[2]).toHaveTextContent("por Rosa Recepción")
    expect(items[2]).toHaveTextContent("El paciente lo pidió por llamada o WhatsApp: Llamó a las 9")
  })
  it("sin eventos guardados arma lo que sabe: cuándo y por dónde se agendó, y cómo terminó", () => {
    render(<DetalleCitaModal cita={{ ...completa, estado: "Cancelada", canceladaPor: "paciente" }} onCerrar={f()} />)
    const items = within(screen.getByRole("list", { name: "Línea de tiempo de la cita" })).getAllByRole("listitem")
    expect(items[0]).toHaveTextContent("Agendada · Web")
    expect(items[1]).toHaveTextContent("Cancelada")
    expect(items[1]).toHaveTextContent("por El paciente")
  })
  it("ya no hay «Confirmada» ni «Marcar como confirmada»", () => {
    render(<DetalleCitaModal cita={{ ...completa, confirmadaAt: "2026-10-19T10:00:00Z" }} onCerrar={f()} onLlego={f()} onNoAsistio={f()} onIngresar={f()} />)
    expect(screen.queryByText(/Confirmada/i)).toBeNull()
    expect(screen.queryByRole("button", { name: /confirmada/i })).toBeNull()
  })
  it("ya no existe «Verificar datos (registro web)»: ni para el paciente que se registró por la web", () => {
    render(<DetalleCitaModal cita={completa} paciente={{ origen: "paciente", confirmadoRecepcion: false }} onCerrar={f()} />)
    expect(screen.queryByRole("button", { name: /Verificar datos/ })).toBeNull()
  })
  it("el botón principal dice «Atender»; con la ficha abierta, «Seguir atendiendo»", () => {
    const { rerender } = render(<DetalleCitaModal cita={completa} onIngresar={f()} onCerrar={f()} />)
    expect(screen.getByRole("button", { name: "Atender" })).toBeInTheDocument()
    rerender(<DetalleCitaModal cita={{ ...completa, estado: "En Atención" }} onIngresar={f()} onCerrar={f()} />)
    expect(screen.getByRole("button", { name: "Seguir atendiendo" })).toBeInTheDocument()
  })
  it("«Atender» aparece también en una cita de otro día (la guardia pregunta, no el detalle)", () => {
    render(<DetalleCitaModal cita={{ ...completa, fecha: "2099-01-01" }} onIngresar={f()} onCerrar={f()} />)
    expect(screen.getByRole("button", { name: "Atender" })).toBeInTheDocument()
  })
})
