import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react"
import AgendarCitaPublica from "./AgendarCitaPublica"
import { fechaAISO } from "../utilidades/disponibilidad"
import { ahoraEcuador } from "../utilidades/horaEcuador"
import { guardarBorrador, leerBorrador } from "../utilidades/agendarWeb"

// Cliente de base falso: cada prueba decide qué responde cada función.
const falso = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock("../lib/supabaseClient", () => ({ supabase: { rpc: (...a) => falso.rpc(...a) } }))

const base = { onVolver: () => {}, citas: [], setCitas: () => {}, disponibilidad: null, opticaId: "o1", opticaPublica: { nombre: "Óptica Prueba" }, parametrizacion: {} }

describe("Agendar cita pública — motivos", () => {
  it("ofrece los motivos configurados en la óptica, no una lista aparte", () => {
    render(<AgendarCitaPublica {...base} motivosConsulta={["Consulta General", "Control de miopía infantil"]} />)
    expect(screen.getByRole("button", { name: /Consulta General/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Control de miopía infantil/ })).toBeInTheDocument()
    expect(screen.queryByText("Medición y examen visual")).not.toBeInTheDocument()
    expect(screen.queryByText("Compra de lentes o monturas")).not.toBeInTheDocument()
    expect(screen.queryByText("Atención por molestia o enfermedad")).not.toBeInTheDocument()
  })

  it("sin motivos cargados usa los cuatro de la agenda interna", () => {
    render(<AgendarCitaPublica {...base} />)
    for (const m of ["Consulta General", "Examen de Control", "Adaptación de Lentes", "Garantía / Ajuste"]) expect(screen.getByRole("button", { name: new RegExp(m.replace("/", "\/")) })).toBeInTheDocument()
  })

  it("contar una molestia es opcional y se abre aparte del motivo", () => {
    render(<AgendarCitaPublica {...base} />)
    expect(screen.queryByText("¿Qué síntomas tienes?")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /¿Tienes alguna molestia\?/ }))
    expect(screen.getByText("¿Qué síntomas tienes?")).toBeInTheDocument()
  })
})

describe("Agendar cita pública — permisos para recibir mensajes", () => {
  it("el formulario pregunta por los dos: recordatorios marcado, promociones y saludos desmarcado", () => {
    render(<AgendarCitaPublica {...base} />)
    fireEvent.click(screen.getByRole("button", { name: /Continuar|Siguiente/ }))
    expect(screen.getByRole("checkbox", { name: /Recordatorios de salud/ })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: /Promociones y saludos/ })).not.toBeChecked()
  })
})

// ─── Confirmar la reserva ───
const sesion = (activo) => ({ activo, inicio: "09:00", fin: "12:00" })
const semana = Object.fromEntries(["domingo", "lunes", "martes", "miercoles", "jueves", "viernes", "sabado"].map((d) => [d, { manana: sesion(true), tarde: { activo: false } }]))
const disponibilidadAbierta = { horarioSemanal: semana, excepciones: {}, duracionCita: 40, profesionales: [] }
const FECHA = fechaAISO(new Date(ahoraEcuador().getTime() + 3 * 86400000))
const CLAVE = "o1"
const HORA = "09:00 AM"
const ocupada = { fecha: FECHA, hora: HORA, duracion_minutos: 40, estado: "Pendiente", asignado_a: null }
const borradorCompleto = { paso: 2, nombres: "Diego Andrés", apellidos: "Alarcón Cedeño", cedula: "1710034065", telefono: "0991234567", fecha: FECHA, hora: HORA }

describe("Agendar cita pública — confirmar", () => {
  beforeEach(() => { falso.rpc.mockReset(); window.sessionStorage.clear() })

  it("la base responde con un ARREGLO de una fila {id, codigo}: avanza al paso 3 y no se queda en «Guardando…»", async () => {
    guardarBorrador(CLAVE, borradorCompleto)
    falso.rpc.mockImplementation((nombre) => {
      if (nombre === "horas_ocupadas_publicas") return Promise.resolve({ data: [], error: null })
      if (nombre === "crear_cita_publica") return Promise.resolve({ data: [{ id: "c1", codigo: "CIT-2026-7KQ2" }], error: null })
      // El cliente real devuelve { error } sin lanzar y su resultado no tiene .catch (esa llamada era la causa del «Guardando…» eterno).
      return { then: (res) => Promise.resolve({ error: null }).then(res) }
    })
    render(<AgendarCitaPublica {...base} disponibilidad={disponibilidadAbierta} />)
    fireEvent.click(await screen.findByRole("button", { name: /Confirmar reserva/ }))
    fireEvent.click(await screen.findByRole("button", { name: /^Confirmar$/ }))
    expect(await screen.findByText("¡Tu cita está agendada!")).toBeInTheDocument()
    expect(screen.getByText("CIT-2026-7KQ2")).toBeInTheDocument()
    expect(screen.queryByText(/Guardando/)).not.toBeInTheDocument()
    expect(leerBorrador(CLAVE)).toBeNull() // al terminar la reserva se borra lo recordado
    const llamada = falso.rpc.mock.calls.find(([n]) => n === "crear_cita_publica")[1]
    expect(llamada).not.toHaveProperty("p_profesional_id") // sin elegir a un profesional no se manda
    expect(llamada.p_fecha_nacimiento).toBeNull() // la fecha de nacimiento es opcional
  })

  it("dos confirmaciones a la vez: la primera se acepta, la segunda pierde, ve el mensaje, queda en el paso 2 y los horarios se actualizan", async () => {
    guardarBorrador(CLAVE, borradorCompleto)
    let creadas = 0
    falso.rpc.mockImplementation((nombre) => {
      if (nombre === "horas_ocupadas_publicas") return Promise.resolve({ data: creadas > 0 ? [ocupada] : [], error: null })
      if (nombre === "crear_cita_publica") {
        creadas += 1
        return Promise.resolve(creadas === 1
          ? { data: [{ id: "c1", codigo: "CIT-2026-AAAA" }], error: null }
          : { data: null, error: { code: "23505", message: "Esa hora acaba de ocuparse. Elige otra." } })
      }
      return Promise.resolve({ error: null })
    })
    const a = render(<AgendarCitaPublica {...base} disponibilidad={disponibilidadAbierta} />)
    const b = render(<AgendarCitaPublica {...base} disponibilidad={disponibilidadAbierta} />)
    const botonConfirmar = (vista) => within(vista.container).findByRole("button", { name: /Confirmar reserva/ })
    fireEvent.click(await botonConfirmar(a))
    fireEvent.click(await screen.findByRole("button", { name: /^Confirmar$/ }))
    expect(await within(a.container).findByText("¡Tu cita está agendada!")).toBeInTheDocument()

    fireEvent.click(await botonConfirmar(b))
    fireEvent.click(await screen.findByRole("button", { name: /^Confirmar$/ }))
    expect(await within(b.container).findByRole("alert")).toHaveTextContent(/acaba de ocuparse/)
    expect(within(b.container).queryByText("¡Tu cita está agendada!")).not.toBeInTheDocument()
    expect(within(b.container).getByRole("button", { name: /Confirmar reserva/ })).toBeDisabled() // la hora se limpió: hay que elegir otra
    await waitFor(() => expect(within(b.container).getByRole("button", { name: HORA })).toBeDisabled()) // horarios al día: la hora ya está ocupada
    expect(within(b.container).getByRole("button", { name: "09:40 AM" })).not.toBeDisabled()
  })

  it("recargar deja el mismo paso con lo escrito, y volver al inicio borra el borrador", async () => {
    falso.rpc.mockResolvedValue({ data: [], error: null })
    guardarBorrador(CLAVE, { paso: 1, nombres: "Ana", apellidos: "Loor" })
    const volver = vi.fn()
    render(<AgendarCitaPublica {...base} onVolver={volver} />)
    expect(screen.getByLabelText(/Nombres/)).toHaveValue("Ana")
    fireEvent.click(screen.getByRole("button", { name: /Volver al inicio/ }))
    expect(volver).toHaveBeenCalled()
    expect(leerBorrador(CLAVE)).toBeNull()
  })
})
