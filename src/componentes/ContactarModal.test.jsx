import React from "react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react"
import { ProveedorEscribirPorWhatsApp, useEscribirPorWhatsApp } from "./EscribirPorWhatsApp"
import { useContactar } from "./useContactar"

const registrar = vi.fn(async () => ({ ok: true }))
const avisar = vi.fn()
const ana = { id: "p1", nombre: "Ana Ruiz", telefono: "0991112233" }
const cita = { id: "c1", fecha: "2026-10-21", hora: "10:00 AM" }

function Boton({ extra = {}, paciente = ana }) {
  const escribir = useEscribirPorWhatsApp()
  return <button type="button" onClick={() => escribir({ paciente, motivo: "cita_no_efectuada", contexto: { cita }, ...extra })}>Contactar</button>
}
function Montaje(props) {
  const { escribir, ventana } = useContactar({ plantillas: {}, opticaNombre: "Óptica Demo", consultas: [], contactarDeAviso: registrar, avisar })
  return <ProveedorEscribirPorWhatsApp value={escribir}><Boton {...props} />{ventana}</ProveedorEscribirPorWhatsApp>
}
beforeEach(() => { registrar.mockClear(); avisar.mockClear(); vi.spyOn(window, "open").mockImplementation(() => null) })
afterEach(() => vi.restoreAllMocks())

describe("La ventana de Contactar (una sola para todo el sistema)", () => {
  it("trae el mensaje de la plantilla del motivo con el nombre y la fecha de la cita, y no abre nada hasta enviarlo", () => {
    render(<Montaje />)
    fireEvent.click(screen.getByRole("button", { name: "Contactar" }))
    const v = screen.getByRole("dialog", { name: "Contactar" })
    const texto = within(v).getByLabelText(/Mensaje/).value
    expect(texto).toContain("Hola Ana Ruiz")
    expect(texto).toContain("Óptica Demo")
    expect(texto).toMatch(/21 de octubre/)
    expect(window.open).not.toHaveBeenCalled()
    expect(registrar).not.toHaveBeenCalled()
  })
  it("el mensaje se edita antes de enviar; «Enviar por WhatsApp» lo abre listo, registra el contacto y corre lo del aviso", async () => {
    const alEnviar = vi.fn()
    render(<Montaje extra={{ alEnviar }} />)
    fireEvent.click(screen.getByRole("button", { name: "Contactar" }))
    const v = screen.getByRole("dialog", { name: "Contactar" })
    fireEvent.change(within(v).getByLabelText(/Mensaje/), { target: { value: "Hola Ana, ¿te agendamos?" } })
    fireEvent.click(within(v).getByRole("button", { name: "Enviar por WhatsApp" }))
    expect(window.open).toHaveBeenCalledTimes(1)
    expect(decodeURIComponent(window.open.mock.calls[0][0])).toContain("Hola Ana, ¿te agendamos?")
    expect(window.open.mock.calls[0][0]).toContain("phone=593991112233")
    expect(alEnviar).toHaveBeenCalledWith("Hola Ana, ¿te agendamos?")
    await waitFor(() => expect(registrar).toHaveBeenCalledWith({ paciente: ana, motivo: "cita_no_efectuada", mensaje: "Hola Ana, ¿te agendamos?" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
  it("cerrarla sin enviar no abre WhatsApp ni registra nada; un mensaje vacío no se envía", () => {
    const alEnviar = vi.fn()
    render(<Montaje extra={{ alEnviar }} />)
    fireEvent.click(screen.getByRole("button", { name: "Contactar" }))
    const v = screen.getByRole("dialog", { name: "Contactar" })
    fireEvent.change(within(v).getByLabelText(/Mensaje/), { target: { value: "  " } })
    expect(within(v).getByRole("button", { name: "Enviar por WhatsApp" })).toBeDisabled()
    fireEvent.click(within(v).getByRole("button", { name: "Cancelar" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(window.open).not.toHaveBeenCalled()
    expect(alEnviar).not.toHaveBeenCalled()
  })
  it("sin teléfono no abre la ventana y lo dice", () => {
    render(<Montaje paciente={{ ...ana, telefono: "Sin Teléfono" }} />)
    fireEvent.click(screen.getByRole("button", { name: "Contactar" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    expect(avisar).toHaveBeenCalledWith("Ana Ruiz no tiene teléfono registrado.")
  })
})
