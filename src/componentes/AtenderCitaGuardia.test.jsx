import React from "react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import { useAtenderCita } from "./AtenderCitaGuardia"

// «Atender» es el mismo botón en la Agenda, el detalle, el perfil y el Inicio: esta guardia es la que decide si entra directo, si pregunta por una cita de otro día o si
// avisa de que la siguiente hora ya está agendada. El reloj se fija en la hora de Ecuador (UTC-5): las 16:49 de Ecuador son las 21:49 UTC.
const HOY = "2026-10-21"
const ecuador = (hh, mm) => new Date(Date.UTC(2026, 9, 21, hh + 5, mm))

function Probador({ cita, citas, alAtender, alReagendar }) {
  const { pedirAtender, dialogo } = useAtenderCita({ citas, duracionDefault: 50, alAtender, alReagendar })
  return <><button type="button" onClick={() => pedirAtender(cita)}>Atender</button>{dialogo}</>
}
const c = (id, hora, extra = {}) => ({ id, fecha: HOY, hora, estado: "Pendiente", paciente: "Paciente " + id, ...extra })

describe("«Atender»: la misma guardia en todas las pantallas", () => {
  beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }) })
  afterEach(() => { vi.useRealTimers() })
  const a = (hh, mm) => vi.setSystemTime(ecuador(hh, mm))
  const montar = (cita, citas, extra = {}) => {
    const alAtender = vi.fn()
    const alReagendar = vi.fn()
    render(<Probador cita={cita} citas={citas} alAtender={alAtender} alReagendar={extra.sinReagendar ? undefined : alReagendar} />)
    fireEvent.click(screen.getByRole("button", { name: "Atender" }))
    return { alAtender, alReagendar }
  }

  it("una cita de hoy, a su hora o antes, entra directo a la ficha sin preguntar", () => {
    a(15, 55)
    const cita = c("1", "04:00 PM")
    const { alAtender } = montar(cita, [cita, c("2", "04:50 PM")])
    expect(alAtender).toHaveBeenCalledWith(cita)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("una cita de otro día pregunta «Esta cita es del 24 de octubre. ¿Atenderla hoy?»; «No» no hace nada y «Atenderla hoy» entra", () => {
    a(10, 0)
    const cita = c("1", "09:00 AM", { fecha: "2026-10-24" })
    const { alAtender } = montar(cita, [cita])
    const ventana = screen.getByRole("dialog", { name: "Atender una cita de otro día" })
    expect(ventana).toHaveTextContent("Esta cita es del 24 de octubre. ¿Atenderla hoy?")
    expect(ventana).toHaveTextContent("La cita se moverá a hoy, a la hora actual.")
    fireEvent.click(within(ventana).getByRole("button", { name: "No" }))
    expect(alAtender).not.toHaveBeenCalled()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Atender" }))
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Atenderla hoy" }))
    expect(alAtender).toHaveBeenCalledWith(cita)
  })

  it("llegó a las 4:49 a la cita de las 4:00 y la de las 4:50 ya está agendada: avisa y ofrece «Atender igual» o «Reagendar»", () => {
    a(16, 49)
    const cita = c("1", "04:00 PM", { duracionMinutos: 50 })
    const { alAtender, alReagendar } = montar(cita, [cita, c("2", "04:50 PM")])
    expect(alAtender).not.toHaveBeenCalled()
    const ventana = screen.getByRole("dialog", { name: "Hay una cita justo después" })
    expect(ventana).toHaveTextContent("La siguiente cita (4:50 PM, Paciente 2) ya está agendada.")
    fireEvent.click(within(ventana).getByRole("button", { name: "Reagendar" }))
    expect(alReagendar).toHaveBeenCalledWith(cita)
    expect(alAtender).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Atender" }))
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Atender igual" }))
    expect(alAtender).toHaveBeenCalledWith(cita)
  })

  it("si nadie queda después, aunque llegue tarde se atiende sin avisar", () => {
    a(16, 49)
    const cita = c("1", "04:00 PM", { duracionMinutos: 50 })
    const { alAtender } = montar(cita, [cita, c("2", "02:00 PM")])
    expect(alAtender).toHaveBeenCalledWith(cita)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("«Seguir atendiendo» (la ficha ya abierta) entra directo aunque el horario esté vencido", () => {
    a(17, 30)
    const cita = c("1", "04:00 PM", { estado: "En Atención" })
    const { alAtender } = montar(cita, [cita, c("2", "05:40 PM")])
    expect(alAtender).toHaveBeenCalledWith(cita)
  })

  it("sin permiso para reagendar el aviso solo ofrece «Atender igual»", () => {
    a(16, 49)
    const cita = c("1", "04:00 PM", { duracionMinutos: 50 })
    montar(cita, [cita, c("2", "04:50 PM")], { sinReagendar: true })
    const ventana = screen.getByRole("dialog", { name: "Hay una cita justo después" })
    expect(within(ventana).queryByRole("button", { name: "Reagendar" })).not.toBeInTheDocument()
    expect(within(ventana).getByRole("button", { name: "Atender igual" })).toBeInTheDocument()
  })
})
