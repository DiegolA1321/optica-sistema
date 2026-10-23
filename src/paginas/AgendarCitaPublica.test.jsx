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

describe("Agendar cita pública — paso 1: motivo, fecha y hora", () => {
  it("ofrece los motivos configurados en la óptica, no una lista aparte, con su duración", () => {
    render(<AgendarCitaPublica {...base} motivosConsulta={["Consulta General", "Control de miopía infantil"]} />)
    expect(screen.getByRole("button", { name: /Consulta General/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Control de miopía infantil.*40 min/ })).toBeInTheDocument()
    expect(screen.queryByText("Medición y examen visual")).not.toBeInTheDocument()
  })

  it("sin motivos cargados usa los cuatro de la agenda interna", () => {
    render(<AgendarCitaPublica {...base} />)
    for (const m of ["Consulta General", "Examen de Control", "Adaptación de Lentes", "Garantía / Ajuste"]) expect(screen.getByRole("button", { name: new RegExp(m.replace("/", "\/")) })).toBeInTheDocument()
  })

  it("el primer paso se llama «Motivo, fecha y hora» y no pide datos personales", async () => {
    falso.rpc.mockResolvedValue({ data: [], error: null })
    render(<AgendarCitaPublica {...base} />)
    expect(screen.getAllByText("Motivo, fecha y hora").length).toBeGreaterThan(0)
    expect(screen.queryByLabelText(/Nombres/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/Cédula/)).not.toBeInTheDocument()
    expect(await screen.findByText("Elige el día")).toBeInTheDocument()
  })

  it("«Continuar» no avanza hasta elegir fecha y hora", () => {
    render(<AgendarCitaPublica {...base} />)
    expect(screen.getByRole("button", { name: /Continuar/ })).toBeDisabled()
  })

  it("el resumen es una franja de cuatro casillas arriba del formulario, con «Por completar» en lo que falta", () => {
    render(<AgendarCitaPublica {...base} />)
    const franja = document.querySelector("[data-resumen-cita]")
    expect(franja).not.toBeNull()
    for (const e of ["Motivo", "Profesional", "Fecha y hora", "Paciente"]) expect(within(franja).getByText(e)).toBeInTheDocument()
    expect(within(franja).getAllByText("Por completar").length).toBeGreaterThan(0)
  })

  it("el WhatsApp de la óptica aparece arriba, flotante y como «¿No encuentras una hora?»", () => {
    render(<AgendarCitaPublica {...base} opticaPublica={{ nombre: "Óptica Prueba", settings: { opticaTelefono: "0987654321" } }} />)
    expect(screen.getByText("¿No encuentras una hora?", { exact: false })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /Escríbenos por WhatsApp/ })).toBeInTheDocument()
    expect(document.querySelector("[data-whatsapp-flotante]")).not.toBeNull()
    expect(screen.getAllByRole("link", { name: /WhatsApp/ }).length).toBeGreaterThanOrEqual(3)
  })

  it("sin teléfono configurado no hay WhatsApp en ningún lado", () => {
    render(<AgendarCitaPublica {...base} />)
    expect(document.querySelector("[data-whatsapp-flotante]")).toBeNull()
    expect(screen.queryByText("¿No encuentras una hora?", { exact: false })).toBeNull()
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
const datosPersona = { nombres: "Diego Andrés", apellidos: "Alarcón Cedeño", cedula: "1710034065", telefono: "0991234567" }
const borradorDatos = { paso: 2, ...datosPersona, fecha: FECHA, hora: HORA }

describe("Agendar cita pública — paso 2: tus datos", () => {
  beforeEach(() => { falso.rpc.mockReset(); window.sessionStorage.clear() })

  it("solo nombres, apellidos, cédula y teléfono son obligatorios; lo demás está plegado en «Más datos»", async () => {
    falso.rpc.mockResolvedValue({ data: [], error: null })
    guardarBorrador(CLAVE, borradorDatos)
    render(<AgendarCitaPublica {...base} disponibilidad={disponibilidadAbierta} />)
    expect(await screen.findByLabelText(/Nombres/)).toHaveValue("Diego Andrés")
    const mas = screen.getByText(/Más datos/).closest("details")
    expect(mas).not.toHaveAttribute("open")
    expect(within(mas).getByLabelText(/Correo/)).toBeInTheDocument()
    expect(within(mas).getByText(/Fecha de nacimiento/)).toBeInTheDocument()
    expect(within(mas).getByRole("checkbox", { name: /Recordatorios de salud/ })).toBeChecked()
    expect(within(mas).getByRole("checkbox", { name: /Promociones y saludos/ })).not.toBeChecked()
    expect(within(mas).getByRole("button", { name: /¿Tienes alguna molestia\?/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Soy extranjero · usar pasaporte/ })).toBeInTheDocument()
  })

  it("«Cambiar fecha u hora» vuelve al paso 1 sin perder lo escrito", async () => {
    falso.rpc.mockResolvedValue({ data: [], error: null })
    guardarBorrador(CLAVE, borradorDatos)
    render(<AgendarCitaPublica {...base} disponibilidad={disponibilidadAbierta} />)
    fireEvent.click(await screen.findByRole("button", { name: /Cambiar fecha u hora/ }))
    expect(await screen.findByText("Elige el día")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Continuar/ }))
    expect(await screen.findByLabelText(/Nombres/)).toHaveValue("Diego Andrés")
    expect(screen.getByLabelText(/Teléfono/)).toHaveValue("0991234567")
  })

  it("la base responde con un ARREGLO de una fila {id, codigo}: avanza al paso 3 sin ventana de confirmación y sin quedarse en «Guardando…»", async () => {
    guardarBorrador(CLAVE, borradorDatos)
    falso.rpc.mockImplementation((nombre) => {
      if (nombre === "horas_ocupadas_publicas") return Promise.resolve({ data: [], error: null })
      if (nombre === "crear_cita_publica") return Promise.resolve({ data: [{ id: "c1", codigo: "CIT-2026-7KQ2" }], error: null })
      // El cliente real devuelve { error } sin lanzar y su resultado no tiene .catch (esa llamada era la causa del «Guardando…» eterno).
      return { then: (res) => Promise.resolve({ error: null }).then(res) }
    })
    render(<AgendarCitaPublica {...base} disponibilidad={disponibilidadAbierta} />)
    fireEvent.click(await screen.findByRole("button", { name: /Confirmar mi cita/ }))
    expect(screen.queryByText("¿Confirmar esta cita?")).not.toBeInTheDocument() // se confirma una sola vez
    expect(await screen.findByText("¡Tu cita está agendada!")).toBeInTheDocument()
    expect(screen.getByText("CIT-2026-7KQ2")).toBeInTheDocument()
    expect(screen.queryByText(/Guardando/)).not.toBeInTheDocument()
    expect(leerBorrador(CLAVE)).toBeNull() // al terminar la reserva se borra lo recordado
    const llamada = falso.rpc.mock.calls.find(([n]) => n === "crear_cita_publica")[1]
    expect(llamada).not.toHaveProperty("p_profesional_id") // sin elegir a un profesional no se manda
    expect(llamada.p_fecha_nacimiento).toBeNull() // la fecha de nacimiento es opcional
  })

  it("con pasaporte manda el tipo de documento (también con 10 números)", async () => {
    guardarBorrador(CLAVE, { ...borradorDatos, cedula: "1234567890", esPasaporte: true })
    falso.rpc.mockImplementation((nombre) => {
      if (nombre === "crear_cita_publica") return Promise.resolve({ data: [{ id: "c1", codigo: "CIT-2026-PPPP" }], error: null })
      return Promise.resolve({ data: [], error: null })
    })
    render(<AgendarCitaPublica {...base} disponibilidad={disponibilidadAbierta} />)
    fireEvent.click(await screen.findByRole("button", { name: /Confirmar mi cita/ }))
    await screen.findByText("¡Tu cita está agendada!")
    const llamada = falso.rpc.mock.calls.find(([n]) => n === "crear_cita_publica")[1]
    expect(llamada.p_tipo_documento).toBe("pasaporte")
    expect(llamada.p_cedula).toBe("1234567890")
  })

  it("faltan datos obligatorios: avisa y no reserva", async () => {
    falso.rpc.mockResolvedValue({ data: [], error: null })
    guardarBorrador(CLAVE, { ...borradorDatos, nombres: "" })
    render(<AgendarCitaPublica {...base} disponibilidad={disponibilidadAbierta} />)
    fireEvent.click(await screen.findByRole("button", { name: /Confirmar mi cita/ }))
    expect(await screen.findByText("Escribe tus nombres.")).toBeInTheDocument()
    expect(falso.rpc.mock.calls.some(([n]) => n === "crear_cita_publica")).toBe(false)
  })

  it("dos confirmaciones a la vez: la primera se acepta, la segunda pierde, ve el aviso, vuelve al paso 1 con los datos intactos y los horarios actualizados", async () => {
    guardarBorrador(CLAVE, borradorDatos)
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
    const botonConfirmar = (vista) => within(vista.container).findByRole("button", { name: /Confirmar mi cita/ })
    fireEvent.click(await botonConfirmar(a))
    expect(await within(a.container).findByText("¡Tu cita está agendada!")).toBeInTheDocument()

    fireEvent.click(await botonConfirmar(b))
    expect(await within(b.container).findByRole("alert")).toHaveTextContent(/acaba de ocuparse/)
    expect(within(b.container).queryByText("¡Tu cita está agendada!")).not.toBeInTheDocument()
    expect(within(b.container).getByText("Elige el día")).toBeInTheDocument() // volvió al paso 1
    expect(within(b.container).getByRole("button", { name: /Continuar/ })).toBeDisabled() // la hora se limpió: hay que elegir otra
    await waitFor(() => expect(within(b.container).getByRole("button", { name: "9:00 AM" })).toBeDisabled()) // horarios al día: la hora ya está ocupada
    expect(within(b.container).getByRole("button", { name: "9:40 AM" })).not.toBeDisabled()
    // Lo escrito se conserva: al elegir otra hora y continuar, los datos siguen ahí.
    fireEvent.click(within(b.container).getByRole("button", { name: "9:40 AM" }))
    fireEvent.click(within(b.container).getByRole("button", { name: /Continuar/ }))
    expect(await within(b.container).findByLabelText(/Nombres/)).toHaveValue("Diego Andrés")
  })

  it("recargar deja el mismo paso con lo escrito, y volver al inicio borra el borrador", async () => {
    falso.rpc.mockResolvedValue({ data: [], error: null })
    guardarBorrador(CLAVE, { ...borradorDatos, nombres: "Ana", apellidos: "Loor" })
    const volver = vi.fn()
    render(<AgendarCitaPublica {...base} onVolver={volver} disponibilidad={disponibilidadAbierta} />)
    expect(await screen.findByLabelText(/Nombres/)).toHaveValue("Ana")
    fireEvent.click(screen.getByRole("button", { name: /Volver al inicio/ }))
    expect(volver).toHaveBeenCalled()
    expect(leerBorrador(CLAVE)).toBeNull()
  })

  it("«Agendar este servicio» llega con el motivo elegido", () => {
    render(<AgendarCitaPublica {...base} motivoInicial="Adaptación de Lentes" />)
    expect(screen.getByRole("button", { name: /Adaptación de Lentes/ })).toHaveAttribute("aria-pressed", "true")
  })
})
