import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react"

const rpc = vi.fn()
vi.mock("../lib/supabaseClient", () => ({ supabase: { rpc: (...a) => rpc(...a), from: () => ({ upsert: () => Promise.resolve({ error: null }), select: () => Promise.resolve({ data: [], error: null }) }) } }))

import Horario from "./Horario"

const dia = () => ({ manana: { activo: true, inicio: "09:00", fin: "13:00" }, tarde: { activo: true, inicio: "14:00", fin: "18:00" } })
const disponibilidad = (excepciones = {}) => ({
  horarioSemanal: { lunes: dia(), martes: dia(), miercoles: dia(), jueves: dia(), viernes: dia(), sabado: { manana: { activo: false }, tarde: { activo: false } }, domingo: { manana: { activo: false }, tarde: { activo: false } } },
  excepciones, duracionCita: 40,
})
const paula = { id: "u-paula", rol: "asistente", nombre: "Paula", opticaId: "o1", permisosNivel: { horario: ["ver"], horario_optica: ["ver"] } }
const admin = { id: "u-admin", rol: "admin", nombre: "Ana", opticaId: "o1" }
const FUTURO = "2099-01-05" // un lunes lejano
// Un día a 45 días de hoy: la ausencia se elige con el calendario del sistema (no hay un campo de fecha del navegador).
const en45 = (() => { const d = new Date(); d.setDate(d.getDate() + 45); return { iso: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`, anio: d.getFullYear(), mes: d.getMonth(), dia: d.getDate() } })()
const elegirFecha = (dialogo, { anio, mes, dia }) => {
  fireEvent.click(dialogo.querySelector("#ausencia-fecha"))
  fireEvent.change(within(dialogo).getByLabelText("Año"), { target: { value: String(anio) } })
  fireEvent.change(within(dialogo).getByLabelText("Mes"), { target: { value: String(mes) } })
  fireEvent.click(within(dialogo).getAllByRole("button", { name: String(dia), pressed: false }).find((b) => b.textContent === String(dia)))
}
const props = (usuario, extra = {}) => ({ usuario, disponibilidad: disponibilidad(), setDisponibilidad: vi.fn(() => Promise.resolve({ error: null })), reemplazarExcepcionLocal: vi.fn(), horarioPersonal: { horarioSemanal: {}, ausencias: {} }, setHorarioPersonal: vi.fn(() => Promise.resolve({ error: null })), citas: [], equipo: [], ...extra })

beforeEach(() => { rpc.mockReset(); window.history.replaceState({}, "", "/") })

describe("Horario: 'Mi horario' (el propio) y 'Horario de la óptica' (el general)", () => {
  it("quien no edita el horario de la óptica abre en el suyo y ve el general solo como referencia", () => {
    render(<Horario {...props(paula)} />)
    expect(screen.getByRole("heading", { level: 1, name: "Mi horario" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Horario de la óptica" }))
    expect(screen.getByRole("heading", { level: 1, name: "Horario de la óptica" })).toBeInTheDocument()
    expect(screen.getByText(/Solo el administrador, o quien tenga delegado el horario de la óptica, puede editarlo/)).toBeInTheDocument()
    expect(screen.queryByText(/Excepciones puntuales/)).not.toBeInTheDocument() // sin el calendario donde se cierran o abren días
  })

  it("el administrador, y quien tiene el horario de la óptica delegado, abre en el general y lo edita", () => {
    const delegada = { ...paula, id: "u-leo", permisosNivel: { horario: ["ver"], horario_optica: ["ver", "editar"] } }
    for (const u of [admin, delegada]) {
      const { unmount } = render(<Horario {...props(u)} />)
      expect(screen.getByRole("heading", { level: 1, name: "Horario de la óptica" })).toBeInTheDocument()
      expect(screen.getAllByText(/Excepciones puntuales/).length).toBeGreaterThan(0)
      unmount()
    }
  })
})

describe("Horario: las ausencias de cada persona", () => {
  const abrirFormulario = () => {
    fireEvent.click(screen.getByRole("button", { name: /Registrar/ }))
    return screen.getByRole("dialog")
  }

  it("registrar una ausencia usa la función de la base (no reescribe el horario general) y actualiza la pantalla con lo que devuelve", async () => {
    const devuelta = { manana: { activo: true, inicio: "09:00", fin: "13:00" }, tarde: { activo: true, inicio: "14:00", fin: "18:00" }, ausencias: [{ inicio: "10:00", fin: "11:00", motivo: "Cita médica", usuarioId: "u-paula", usuarioNombre: "Paula" }] }
    rpc.mockResolvedValue({ data: devuelta, error: null })
    const p = props(paula)
    render(<Horario {...p} />)
    const dialogo = abrirFormulario()
    elegirFecha(dialogo, en45)
    const horas = dialogo.querySelectorAll("input[type=time]")
    fireEvent.change(horas[0], { target: { value: "10:00" } })
    fireEvent.change(horas[1], { target: { value: "11:00" } })
    fireEvent.change(dialogo.querySelector("textarea"), { target: { value: "Cita médica" } })
    fireEvent.submit(dialogo) // la ventana estándar ES el formulario
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("registrar_ausencia", { p_fecha: en45.iso, p_inicio: "10:00", p_fin: "11:00", p_motivo: "Cita médica" }))
    await waitFor(() => expect(p.reemplazarExcepcionLocal).toHaveBeenCalledWith(en45.iso, devuelta))
    expect(p.setDisponibilidad).not.toHaveBeenCalled() // el horario general no se toca
  })

  it("solo se ven y se quitan las propias; quitar usa la función con la fecha y las horas", async () => {
    const excepciones = {
      [FUTURO]: { ...dia(), ausencias: [
        { inicio: "10:00", fin: "11:00", motivo: "Mía", usuarioId: "u-paula", usuarioNombre: "Paula" },
        { inicio: "15:00", fin: "16:00", motivo: "De Rosa", usuarioId: "u-rosa", usuarioNombre: "Rosa" },
      ] },
    }
    rpc.mockResolvedValue({ data: { ...dia(), ausencias: [{ inicio: "15:00", fin: "16:00", motivo: "De Rosa", usuarioId: "u-rosa", usuarioNombre: "Rosa" }] }, error: null })
    const p = props(paula, { disponibilidad: disponibilidad(excepciones) })
    render(<Horario {...p} />)
    expect(screen.getByText("Mía")).toBeInTheDocument()
    expect(screen.queryByText("De Rosa")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: `Quitar ausencia del ${FUTURO}` }))
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("quitar_ausencia", { p_fecha: FUTURO, p_inicio: "10:00", p_fin: "11:00" }))
    await waitFor(() => expect(p.reemplazarExcepcionLocal).toHaveBeenCalled())
  })

  it("quien edita el horario de la óptica ve las de todos, con el nombre de su autor", () => {
    const excepciones = { [FUTURO]: { ...dia(), ausencias: [{ inicio: "15:00", fin: "16:00", motivo: "De Rosa", usuarioId: "u-rosa", usuarioNombre: "Rosa" }] } }
    render(<Horario {...props(admin, { disponibilidad: disponibilidad(excepciones) })} />)
    fireEvent.click(screen.getByRole("button", { name: "Mi horario" }))
    const lista = screen.getByText("De Rosa").closest("div")
    expect(within(lista.parentElement).getByText("Rosa")).toBeInTheDocument()
  })

  it("si la base no deja quitarla, lo dice con su mensaje", async () => {
    const excepciones = { [FUTURO]: { ...dia(), ausencias: [{ inicio: "10:00", fin: "11:00", usuarioId: "u-paula", usuarioNombre: "Paula" }] } }
    rpc.mockResolvedValue({ data: null, error: { message: "Solo puedes quitar tus propias ausencias." } })
    render(<Horario {...props(paula, { disponibilidad: disponibilidad(excepciones) })} />)
    fireEvent.click(screen.getByRole("button", { name: `Quitar ausencia del ${FUTURO}` }))
    expect(await screen.findByText("Solo puedes quitar tus propias ausencias.")).toBeInTheDocument()
  })
})
