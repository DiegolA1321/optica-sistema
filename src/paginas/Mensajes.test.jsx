import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react"

vi.mock("../lib/supabaseClient", () => ({ supabase: null }))
vi.mock("../utilidades/soporteDatos", () => ({
  EVENTO_SOPORTE_CAMBIADO: "soporte:cambiado",
  avisarCambioSoporte: vi.fn(),
  leerMisConsultas: vi.fn(),
  leerAvisos: vi.fn(),
  leerConversacion: vi.fn(),
  crearConsulta: vi.fn(),
  responderConsulta: vi.fn(),
  cerrarConsulta: vi.fn(),
  reabrirConsulta: vi.fn(),
  calificarConsulta: vi.fn(),
  marcarConsultaLeida: vi.fn(),
  marcarAvisosLeidos: vi.fn(),
  urlDeCaptura: vi.fn(() => Promise.resolve("")),
  leerAjustesSoporte: vi.fn(() => Promise.resolve({ datos: {} })),
}))

import Mensajes from "./Mensajes"
import * as datos from "../utilidades/soporteDatos"

const admin = { id: "u1", rol: "admin", nombre: "Ana Pérez", opticaId: "o1" }
const staff = (niveles) => ({ id: "u2", rol: "asistente", nombre: "Paula", opticaId: "o1", permisosNivel: { mensajes: niveles } })
const consulta = (extra = {}) => ({
  id: "c1", numero: 7, opticaId: "o1", autorId: "u1", autorNombre: "Ana Pérez", autorRol: "Administrador", modulo: "ventas", tipo: "problema", urgencia: "urgente",
  asunto: "No puedo cobrar un abono", descripcion: "Se queda cargando", estado: "recibida", contexto: {}, ultimoMensajeDe: "optica", respuestaSinLeer: false,
  calificacion: null, calificacionComentario: "", reabiertaVeces: 0, creadaEn: "2026-10-12T15:00:00Z", actualizadaEn: "2026-10-12T15:00:00Z", ...extra,
})

beforeEach(() => {
  vi.clearAllMocks()
  window.history.replaceState({}, "", "/")
  datos.leerMisConsultas.mockResolvedValue({ datos: [] })
  datos.leerAvisos.mockResolvedValue({ datos: [] })
  datos.leerConversacion.mockResolvedValue({ datos: [] })
  datos.marcarAvisosLeidos.mockResolvedValue({ datos: true })
  datos.marcarConsultaLeida.mockResolvedValue({ datos: true })
})

describe("Soporte: cabecera y pestañas", () => {
  it("se llama 'Soporte', no lleva subtítulo y su acción principal es 'Nueva consulta'", async () => {
    render(<Mensajes usuario={admin} />)
    expect(await screen.findByRole("heading", { level: 1, name: "Soporte" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Nueva consulta/ })).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/Escribe a el soporte|equipo de la óptica/i)
  })
  it("tiene las tres pestañas y abre en Ayuda: lo primero es encontrar la respuesta", async () => {
    render(<Mensajes usuario={admin} />)
    await screen.findByRole("heading", { level: 1, name: "Soporte" })
    expect(screen.getAllByRole("tab").map((t) => t.textContent.replace(/\d+/g, "").trim())).toEqual(["Ayuda", "Mis consultas", "Avisos del sistema"])
    expect(screen.getByRole("tab", { name: /Ayuda/ })).toHaveAttribute("aria-selected", "true")
  })
  it("sin permiso de 'crear' no hay botón para escribir, ni en la cabecera ni al pie de la ayuda", async () => {
    render(<Mensajes usuario={staff(["ver"])} />)
    await screen.findByRole("heading", { level: 1, name: "Soporte" })
    expect(screen.queryByRole("button", { name: /Nueva consulta/ })).toBeNull()
    expect(screen.queryByRole("button", { name: "Escribir al soporte" })).toBeNull()
  })
})

describe("Soporte: Ayuda", () => {
  it("organiza las preguntas por los nueve módulos", async () => {
    render(<Mensajes usuario={admin} />)
    for (const m of ["Citas", "Pacientes", "Ventas", "Inventario", "Reportes", "CRM", "Mi horario", "Usuarios y permisos", "Configuración"]) {
      expect(await screen.findByRole("region", { name: `Ayuda de ${m}` })).toBeInTheDocument()
    }
  })
  it("el buscador filtra por pregunta o respuesta, sin importar tildes", async () => {
    render(<Mensajes usuario={admin} />)
    fireEvent.change(await screen.findByLabelText("Buscar en la ayuda"), { target: { value: "conteo fisico" } })
    expect(await screen.findByText("¿Cómo hago el conteo físico?")).toBeInTheDocument()
    expect(screen.queryByText("¿Cómo agendo una cita?")).toBeNull()
  })
  it("si no encuentra nada, lo dice y ofrece escribir al soporte", async () => {
    render(<Mensajes usuario={admin} />)
    fireEvent.change(await screen.findByLabelText("Buscar en la ayuda"), { target: { value: "zzzzqq" } })
    expect(await screen.findByText(/No encontramos preguntas con «zzzzqq»/)).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Escribir al soporte" }).length).toBeGreaterThan(0)
  })
  it("al final: «¿No encontraste lo que buscabas?» con la acción de escribir", async () => {
    render(<Mensajes usuario={admin} />)
    expect(await screen.findByText("¿No encontraste lo que buscabas?")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Escribir al soporte" }))
    expect(await screen.findByRole("dialog", { name: "Nueva consulta" })).toBeInTheDocument()
  })
})

describe("Soporte: Mis consultas", () => {
  it("sin consultas dice qué pasa y ofrece escribir", async () => {
    render(<Mensajes usuario={admin} />)
    fireEvent.click(await screen.findByRole("tab", { name: /Mis consultas/ }))
    expect(await screen.findByText("Todavía no escribiste ninguna consulta")).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /Nueva consulta/ }).length).toBe(2)
  })
  it("cada consulta muestra su número, asunto, módulo, urgencia, fecha y estado", async () => {
    datos.leerMisConsultas.mockResolvedValue({ datos: [consulta()] })
    render(<Mensajes usuario={admin} />)
    fireEvent.click(await screen.findByRole("tab", { name: /Mis consultas/ }))
    const lista = await screen.findByRole("list", { name: "Mis consultas" })
    const fila = within(lista).getByRole("listitem")
    for (const t of ["SOP-0007", "No puedo cobrar un abono", "Ventas", "Urgente", "Recibida"]) expect(within(fila).getByText(t)).toBeInTheDocument()
    expect(within(fila).getByText(/12 oct 2026/)).toBeInTheDocument()
  })
  it("el contador de la pestaña coincide con las filas", async () => {
    datos.leerMisConsultas.mockResolvedValue({ datos: [consulta(), consulta({ id: "c2", numero: 8, asunto: "Otra" })] })
    render(<Mensajes usuario={admin} />)
    const tab = await screen.findByRole("tab", { name: /Mis consultas/ })
    await waitFor(() => expect(tab.textContent).toMatch(/2/))
    fireEvent.click(tab)
    expect(within(await screen.findByRole("list", { name: "Mis consultas" })).getAllByRole("listitem")).toHaveLength(2)
  })
  it("el administrador ve de quién es cada consulta del personal", async () => {
    datos.leerMisConsultas.mockResolvedValue({ datos: [consulta({ autorId: "u9", autorNombre: "Paula Optómetra", autorRol: "Optómetra" }), consulta({ id: "c2", numero: 8 })] })
    render(<Mensajes usuario={admin} />)
    fireEvent.click(await screen.findByRole("tab", { name: /Mis consultas/ }))
    expect(await screen.findByText("Escribió Paula Optómetra · Optómetra")).toBeInTheDocument()
  })
  it("una respuesta sin leer se destaca y la abre la conversación", async () => {
    datos.leerMisConsultas.mockResolvedValue({ datos: [consulta({ estado: "respondida", respuestaSinLeer: true })] })
    datos.leerConversacion.mockResolvedValue({ datos: [{ id: "m1", de: "soporte", autorNombre: "Soporte", cuerpo: "Prueba recargar la página", adjuntos: [], interna: false, creadoEn: "2026-10-12T16:00:00Z" }] })
    render(<Mensajes usuario={admin} />)
    fireEvent.click(await screen.findByRole("tab", { name: /Mis consultas/ }))
    expect(await screen.findByText("Respuesta nueva")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "No puedo cobrar un abono" }))
    const v = await screen.findByRole("dialog")
    expect(await within(v).findByText("Prueba recargar la página")).toBeInTheDocument()
    await waitFor(() => expect(datos.marcarConsultaLeida).toHaveBeenCalledWith("c1"))
  })
  it("una consulta resuelta pide calificar (de 1 a 5) y permite reabrirla", async () => {
    datos.leerMisConsultas.mockResolvedValue({ datos: [consulta({ estado: "resuelta", resueltaEn: "2026-10-13T10:00:00Z" })] })
    datos.calificarConsulta.mockResolvedValue({ datos: true })
    datos.reabrirConsulta.mockResolvedValue({ datos: true })
    render(<Mensajes usuario={admin} />)
    fireEvent.click(await screen.findByRole("tab", { name: /Mis consultas/ }))
    fireEvent.click(await screen.findByRole("button", { name: "No puedo cobrar un abono" }))
    const v = await screen.findByRole("dialog")
    fireEvent.click(within(v).getByRole("radio", { name: "4 estrellas" }))
    fireEvent.click(within(v).getByRole("button", { name: "Enviar calificación" }))
    await waitFor(() => expect(datos.calificarConsulta).toHaveBeenCalledWith("c1", 4, ""))
    fireEvent.click(within(v).getByRole("button", { name: /El problema sigue: reabrir/ }))
    fireEvent.change(within(v).getByLabelText("¿Qué sigue pasando?"), { target: { value: "Sigue igual" } })
    fireEvent.click(within(v).getByRole("button", { name: "Reabrir consulta" }))
    await waitFor(() => expect(datos.reabrirConsulta).toHaveBeenCalledWith("c1", "Sigue igual"))
  })
  it("el administrador no califica la consulta de otra persona", async () => {
    datos.leerMisConsultas.mockResolvedValue({ datos: [consulta({ estado: "resuelta", autorId: "u9", autorNombre: "Paula" })] })
    render(<Mensajes usuario={admin} />)
    fireEvent.click(await screen.findByRole("tab", { name: /Mis consultas/ }))
    fireEvent.click(await screen.findByRole("button", { name: "No puedo cobrar un abono" }))
    const v = await screen.findByRole("dialog")
    expect(within(v).queryByRole("button", { name: "Enviar calificación" })).toBeNull()
  })
  it("una consulta abierta permite responder y marcarla como resuelta", async () => {
    datos.leerMisConsultas.mockResolvedValue({ datos: [consulta({ estado: "respondida" })] })
    datos.responderConsulta.mockResolvedValue({ datos: true })
    render(<Mensajes usuario={admin} />)
    fireEvent.click(await screen.findByRole("tab", { name: /Mis consultas/ }))
    fireEvent.click(await screen.findByRole("button", { name: "No puedo cobrar un abono" }))
    const v = await screen.findByRole("dialog")
    fireEvent.change(within(v).getByLabelText("Tu mensaje"), { target: { value: "Ya probé y sigue igual" } })
    fireEvent.click(within(v).getByRole("button", { name: "Enviar" }))
    await waitFor(() => expect(datos.responderConsulta).toHaveBeenCalledWith(expect.objectContaining({ consultaId: "c1", cuerpo: "Ya probé y sigue igual", opticaId: "o1" })))
    expect(within(v).getByRole("button", { name: "Ya está resuelto" })).toBeInTheDocument()
  })
})

describe("Soporte: Avisos del sistema", () => {
  const avisos = [
    { id: "a1", asunto: "Mantenimiento el sábado", cuerpo: "De 2 a 4 am", creadoEn: "2026-10-14T12:00:00Z", general: true, leido: false },
    { id: "a2", asunto: "Nueva función", cuerpo: "Conteo físico", creadoEn: "2026-10-01T12:00:00Z", general: true, leido: true },
  ]
  it("destaca los no leídos, muestra la fecha y se marcan a mano", async () => {
    datos.leerAvisos.mockResolvedValue({ datos: avisos })
    render(<Mensajes usuario={admin} />)
    fireEvent.click(await screen.findByRole("tab", { name: /Avisos del sistema/ }))
    const lista = await screen.findByRole("list", { name: "Avisos del sistema" })
    const items = within(lista).getAllByRole("listitem")
    expect(items).toHaveLength(2)
    expect(within(items[0]).getByText("Nuevo")).toBeInTheDocument()
    expect(within(items[1]).queryByText("Nuevo")).toBeNull()
    expect(within(items[0]).getByText(/14 oct 2026/)).toBeInTheDocument()
    fireEvent.click(within(items[0]).getByRole("button", { name: "Marcar como leído" }))
    await waitFor(() => expect(datos.marcarAvisosLeidos).toHaveBeenCalledWith(["a1"]))
  })
  it("sin avisos lo dice y lleva a la ayuda", async () => {
    render(<Mensajes usuario={admin} />)
    fireEvent.click(await screen.findByRole("tab", { name: /Avisos del sistema/ }))
    expect(await screen.findByText("Todavía no hay avisos del sistema")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Ver la ayuda" }))
    expect(await screen.findByLabelText("Buscar en la ayuda")).toBeInTheDocument()
  })
})

describe("Soporte: Nueva consulta", () => {
  it("pide módulo, tipo, urgencia con su explicación, asunto, descripción y capturas, y manda el contexto solo", async () => {
    datos.crearConsulta.mockResolvedValue({ datos: { id: "c9", numero: 12 } })
    render(<Mensajes usuario={admin} pantallaOrigen="Citas médicas" moduloOrigen="citas" />)
    fireEvent.click(await screen.findByRole("button", { name: /Nueva consulta/ }))
    const v = await screen.findByRole("dialog", { name: "Nueva consulta" })
    expect(within(v).getByLabelText("¿De qué módulo es?")).toHaveValue("citas")
    for (const t of ["Problema", "Pregunta", "Sugerencia", "Normal", "Urgente"]) expect(within(v).getByText(t)).toBeInTheDocument()
    expect(within(v).getByText("Urgente: no puedo atender, vender o cobrar.")).toBeInTheDocument()
    expect(within(v).getByRole("button", { name: /Adjuntar captura/ })).toBeInTheDocument()
    expect(within(v).getByText("Citas médicas")).toBeInTheDocument() // la pantalla desde la que escribe
    expect(within(v).getByRole("button", { name: "Enviar consulta" })).toBeDisabled()
    fireEvent.click(within(v).getByLabelText(/^Urgente/))
    fireEvent.change(within(v).getByLabelText("Asunto"), { target: { value: "No puedo agendar" } })
    fireEvent.change(within(v).getByLabelText("Descripción"), { target: { value: "Al pulsar Agendar no pasa nada" } })
    fireEvent.click(within(v).getByRole("button", { name: "Enviar consulta" }))
    await waitFor(() => expect(datos.crearConsulta).toHaveBeenCalled())
    const args = datos.crearConsulta.mock.calls[0][0]
    expect(args).toMatchObject({ opticaId: "o1", modulo: "citas", tipo: "problema", urgencia: "urgente", asunto: "No puedo agendar", descripcion: "Al pulsar Agendar no pasa nada" })
    expect(args.contexto).toMatchObject({ quien: "Ana Pérez", rol: "Administrador", pantalla: "Citas médicas" })
    expect(await screen.findByText("SOP-0012")).toBeInTheDocument()
    expect(screen.getByText(/el mismo día hábil/)).toBeInTheDocument()
  })
  it("una consulta normal promete el tiempo normal", async () => {
    datos.crearConsulta.mockResolvedValue({ datos: { id: "c9", numero: 3 } })
    render(<Mensajes usuario={admin} />)
    fireEvent.click(await screen.findByRole("button", { name: /Nueva consulta/ }))
    const v = await screen.findByRole("dialog", { name: "Nueva consulta" })
    fireEvent.change(within(v).getByLabelText("Asunto"), { target: { value: "Una duda" } })
    fireEvent.change(within(v).getByLabelText("Descripción"), { target: { value: "¿Cómo se hace tal cosa?" } })
    fireEvent.click(within(v).getByRole("button", { name: "Enviar consulta" }))
    expect(await screen.findByText(/en un máximo de 1 día hábil/)).toBeInTheDocument()
  })
  it("si falla el envío lo dice y no pierde lo escrito", async () => {
    datos.crearConsulta.mockResolvedValue({ error: "No hay conexión con el servidor." })
    render(<Mensajes usuario={admin} />)
    fireEvent.click(await screen.findByRole("button", { name: /Nueva consulta/ }))
    const v = await screen.findByRole("dialog", { name: "Nueva consulta" })
    fireEvent.change(within(v).getByLabelText("Asunto"), { target: { value: "Una duda" } })
    fireEvent.change(within(v).getByLabelText("Descripción"), { target: { value: "¿Cómo se hace tal cosa?" } })
    fireEvent.click(within(v).getByRole("button", { name: "Enviar consulta" }))
    expect(await within(v).findByRole("alert")).toHaveTextContent("No hay conexión")
    expect(within(v).getByLabelText("Asunto")).toHaveValue("Una duda")
  })
  it("rechaza una captura que no es imagen", async () => {
    render(<Mensajes usuario={admin} />)
    fireEvent.click(await screen.findByRole("button", { name: /Nueva consulta/ }))
    const v = await screen.findByRole("dialog", { name: "Nueva consulta" })
    const entrada = v.querySelector('input[type="file"]')
    fireEvent.change(entrada, { target: { files: [new File(["x"], "nota.pdf", { type: "application/pdf" })] } })
    expect(await within(v).findByText(/no es una imagen/)).toBeInTheDocument()
  })
})
