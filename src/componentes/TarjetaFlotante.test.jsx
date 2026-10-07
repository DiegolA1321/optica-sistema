import React from "react"
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { TarjetaFlotante } from "./CalendarioSemanal"

const cita = (estado) => ({ id: "c1", paciente: "Paola Loor", cedula: "1106964396", telefono: "0963903420", motivo: "Adaptación de Lentes", origen: "staff", fecha: "2026-10-06", hora: "09:40 AM", estado, creadoEn: "2026-09-28T10:00:00Z" })
const acciones = { onCerrar: () => {}, onAtender: () => {}, onAgendarOtra: () => {}, onEditar: () => {}, onCancelar: () => {}, onCobrar: () => {} }
const ver = (estado) => render(<TarjetaFlotante cita={cita(estado)} ancla={{ top: 100, left: 100, right: 200 }} {...acciones} />)

describe("Tarjeta flotante de la cita — acciones según el estado", () => {
  it("una cita pendiente se atiende, se edita y se cancela", () => {
    ver("Pendiente")
    expect(screen.getByRole("button", { name: /Atender/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Editar cita/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Cancelar cita/ })).toBeInTheDocument()
  })

  it("una cita atendida no ofrece atender, editar ni cancelar", () => {
    ver("Atendida")
    expect(screen.queryByRole("button", { name: /Atender/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Editar cita/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Cancelar cita/ })).not.toBeInTheDocument()
  })

  it("una cita que no asistió muestra el estado y ofrece agendar otra, no atender", () => {
    ver("No Asistió")
    expect(screen.getByText("No Asistió")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Agendar otra cita/ })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /^Atender/ })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Editar cita/ })).toBeInTheDocument()
  })
})
