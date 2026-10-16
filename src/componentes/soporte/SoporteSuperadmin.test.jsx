import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react"

vi.mock("@/lib/config", () => ({ MODO_SAAS_VISIBLE: true }))
vi.mock("../../lib/supabaseClient", () => ({ supabase: null }))
vi.mock("../../utilidades/soporteDatos", () => ({
  EVENTO_SOPORTE_CAMBIADO: "soporte:cambiado",
  avisarCambioSoporte: vi.fn(),
  leerConversacionSoporte: vi.fn(),
  responderSoporte: vi.fn(),
  cambiarEstadoSoporte: vi.fn(),
  leerRespuestasGuardadas: vi.fn(),
  guardarRespuestaGuardada: vi.fn(),
  borrarRespuestaGuardada: vi.fn(),
  leerAjustesSoporte: vi.fn(),
  guardarAjustesSoporte: vi.fn(),
  urlDeCaptura: vi.fn(() => Promise.resolve("")),
}))

import SoporteSuperadmin from "./SoporteSuperadmin"
import * as datos from "../../utilidades/soporteDatos"

const opticas = [{ id: "o1", nombre: "Óptica Solna" }, { id: "o2", nombre: "Visión Norte" }]
const c = (extra) => ({
  id: "x", numero: 1, opticaId: "o1", autorId: "u1", autorNombre: "Ana", autorRol: "Administrador", modulo: "citas", tipo: "problema", urgencia: "normal", asunto: "Algo", descripcion: "d",
  estado: "recibida", contexto: { pantalla: "Citas médicas", navegador: "Chrome 141 · Windows" }, ultimoMensajeDe: "optica", respuestaSinLeer: false, calificacion: null, calificacionComentario: "",
  primeraRespuestaEn: null, resueltaEn: null, reabiertaVeces: 0, creadaEn: "2026-10-10T10:00:00Z", actualizadaEn: "2026-10-10T10:00:00Z", ...extra,
})
const lista = [
  c({ id: "n1", numero: 1, asunto: "Duda normal", creadaEn: "2026-10-09T10:00:00Z", actualizadaEn: "2026-10-09T10:00:00Z" }),
  c({ id: "u1", numero: 2, asunto: "No puedo cobrar", urgencia: "urgente", modulo: "ventas", opticaId: "o2", creadaEn: "2026-10-12T10:00:00Z", actualizadaEn: "2026-10-12T10:00:00Z" }),
  c({ id: "r1", numero: 3, asunto: "Ya resuelta", estado: "resuelta", calificacion: 5, primeraRespuestaEn: "2026-10-08T10:30:00Z", resueltaEn: "2026-10-08T12:00:00Z", creadaEn: "2026-10-08T10:00:00Z", actualizadaEn: "2026-10-08T12:00:00Z" }),
]

const montar = (consultas = lista, extra = {}) => render(<SoporteSuperadmin consultas={consultas} cargando={false} error="" onRecargar={vi.fn()} opticas={opticas} onAuditoria={vi.fn()} onToast={vi.fn()} avisos={<p>CONTENIDO DE AVISOS</p>} {...extra} />)

beforeEach(() => {
  vi.clearAllMocks()
  datos.leerAjustesSoporte.mockResolvedValue({ datos: {} })
  datos.leerRespuestasGuardadas.mockResolvedValue({ datos: [{ id: "g1", titulo: "Restablecer clave", texto: "Entra a Usuarios y permisos y usa Restablecer clave." }] })
  datos.leerConversacionSoporte.mockResolvedValue({ datos: [
    { id: "m1", de: "optica", autorNombre: "Ana", cuerpo: "No puedo cobrar", adjuntos: [], interna: false, creadoEn: "2026-10-12T10:00:00Z" },
    { id: "m2", de: "soporte", autorNombre: "Soporte", cuerpo: "Nota: revisar el abono", adjuntos: [], interna: true, creadoEn: "2026-10-12T10:30:00Z" },
  ] })
})

describe("Soporte del superadmin: bandeja", () => {
  it("muestra las abiertas con la urgente primero y deja fuera la resuelta", async () => {
    montar()
    const filas = within(await screen.findByRole("list", { name: "Consultas de soporte" })).getAllByRole("listitem")
    expect(filas).toHaveLength(2)
    expect(within(filas[0]).getByText("SOP-0002")).toBeInTheDocument()
    expect(within(filas[0]).getByText("Urgente")).toBeInTheDocument()
    expect(within(filas[1]).getByText("SOP-0001")).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("2 consultas abiertas")
  })
  it("el contador de la pestaña coincide con las abiertas de la lista", async () => {
    montar()
    expect(screen.getByRole("tab", { name: /Consultas/ })).toHaveTextContent("2")
  })
  it("filtra por estado, urgencia, módulo y óptica, y 'Limpiar' los quita", async () => {
    montar()
    fireEvent.change(screen.getByLabelText("Filtrar por estado"), { target: { value: "todas" } })
    expect(within(screen.getByRole("list", { name: "Consultas de soporte" })).getAllByRole("listitem")).toHaveLength(3)
    fireEvent.change(screen.getByLabelText("Filtrar por urgencia"), { target: { value: "urgente" } })
    expect(within(screen.getByRole("list", { name: "Consultas de soporte" })).getAllByRole("listitem")).toHaveLength(1)
    fireEvent.change(screen.getByLabelText("Filtrar por urgencia"), { target: { value: "" } })
    fireEvent.change(screen.getByLabelText("Filtrar por módulo"), { target: { value: "citas" } })
    expect(within(screen.getByRole("list", { name: "Consultas de soporte" })).getAllByRole("listitem")).toHaveLength(2)
    fireEvent.change(screen.getByLabelText("Filtrar por óptica"), { target: { value: "o2" } })
    expect(screen.getByText("Ninguna consulta coincide")).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole("button", { name: /Limpiar/ })[0])
    expect(within(screen.getByRole("list", { name: "Consultas de soporte" })).getAllByRole("listitem")).toHaveLength(2)
  })
  it("busca por número", async () => {
    montar()
    fireEvent.change(screen.getByLabelText("Buscar consultas"), { target: { value: "SOP-0001" } })
    const filas = within(screen.getByRole("list", { name: "Consultas de soporte" })).getAllByRole("listitem")
    expect(filas).toHaveLength(1)
    expect(filas[0]).toHaveTextContent("Duda normal")
  })
  it("sin consultas lo dice con su mensaje", async () => {
    montar([])
    expect(await screen.findByText("Todavía no hay consultas")).toBeInTheDocument()
  })
  it("una consulta que espera respuesta del soporte lo dice", async () => {
    montar()
    expect(screen.getAllByText("Espera tu respuesta").length).toBe(2)
  })
})

describe("Soporte del superadmin: la conversación", () => {
  const abrir = async () => {
    montar()
    fireEvent.click(await screen.findByRole("button", { name: "No puedo cobrar" }))
    return await screen.findByRole("dialog")
  }
  it("muestra el contexto que envió el sistema y las notas internas marcadas", async () => {
    const v = await abrir()
    expect(within(v).getByText("Contexto que envió el sistema")).toBeInTheDocument()
    expect(within(v).getByText("Chrome 141 · Windows")).toBeInTheDocument()
    expect(within(v).getByText("Citas médicas")).toBeInTheDocument()
    expect(within(v).getByText("Visión Norte")).toBeInTheDocument()
    expect(await within(v).findByText("Nota: revisar el abono")).toBeInTheDocument()
    expect(within(v).getByText("Nota interna: la óptica no la ve")).toBeInTheDocument()
  })
  it("responde a la óptica y deja constancia en la actividad", async () => {
    datos.responderSoporte.mockResolvedValue({ datos: true })
    const onAuditoria = vi.fn()
    montar(lista, { onAuditoria })
    fireEvent.click(await screen.findByRole("button", { name: "No puedo cobrar" }))
    const v = await screen.findByRole("dialog")
    fireEvent.change(within(v).getByLabelText("Tu respuesta"), { target: { value: "Ya lo revisamos" } })
    fireEvent.click(within(v).getByRole("button", { name: "Enviar respuesta" }))
    await waitFor(() => expect(datos.responderSoporte).toHaveBeenCalledWith(expect.objectContaining({ consultaId: "u1", opticaId: "o2", cuerpo: "Ya lo revisamos", interna: false })))
    expect(onAuditoria).toHaveBeenCalledWith("responder_mensaje", expect.objectContaining({ opticaId: "o2" }))
  })
  it("una nota interna no queda en la actividad de la óptica ni se manda como respuesta", async () => {
    datos.responderSoporte.mockResolvedValue({ datos: true })
    const onAuditoria = vi.fn()
    montar(lista, { onAuditoria })
    fireEvent.click(await screen.findByRole("button", { name: "No puedo cobrar" }))
    const v = await screen.findByRole("dialog")
    fireEvent.click(within(v).getByLabelText(/Nota interna/))
    fireEvent.change(within(v).getByLabelText("Nota interna", { selector: "textarea" }), { target: { value: "Parece el horario" } })
    fireEvent.click(within(v).getByRole("button", { name: "Guardar nota interna" }))
    await waitFor(() => expect(datos.responderSoporte).toHaveBeenCalledWith(expect.objectContaining({ interna: true, cuerpo: "Parece el horario" })))
    expect(onAuditoria).not.toHaveBeenCalled()
  })
  it("inserta una respuesta guardada y se puede editar antes de enviar", async () => {
    const v = await abrir()
    fireEvent.change(within(v).getByLabelText("Insertar una respuesta guardada"), { target: { value: "g1" } })
    expect(within(v).getByLabelText("Tu respuesta")).toHaveValue("Entra a Usuarios y permisos y usa Restablecer clave.")
  })
  it("cambia el estado de la consulta", async () => {
    datos.cambiarEstadoSoporte.mockResolvedValue({ datos: true })
    const v = await abrir()
    fireEvent.change(within(v).getByLabelText("Estado"), { target: { value: "resuelta" } })
    await waitFor(() => expect(datos.cambiarEstadoSoporte).toHaveBeenCalledWith("u1", "resuelta"))
  })
  it("muestra la calificación que dio la óptica", async () => {
    montar()
    fireEvent.change(screen.getByLabelText("Filtrar por estado"), { target: { value: "resuelta" } })
    fireEvent.click(await screen.findByRole("button", { name: "Ya resuelta" }))
    const v = await screen.findByRole("dialog")
    expect(within(v).getByText(/La óptica calificó la atención: 5 de 5/)).toBeInTheDocument()
  })
})

describe("Soporte del superadmin: indicadores", () => {
  it("muestra los tiempos, la satisfacción y los módulos con más consultas, y cada número lleva a su lista", async () => {
    montar()
    fireEvent.click(screen.getByRole("tab", { name: /Indicadores/ }))
    expect(await screen.findByText("Tiempo de primera respuesta")).toBeInTheDocument()
    expect(screen.getByText("30 min")).toBeInTheDocument() // primera respuesta
    expect(screen.getByText("2 h")).toBeInTheDocument() // resolución
    expect(screen.getByText("5 de 5")).toBeInTheDocument()
    const modulos = within(screen.getByRole("region", { name: "Módulos con más consultas" }))
    fireEvent.click(modulos.getByRole("button", { name: "Ver las 2 consultas de Citas" }))
    expect(await screen.findByRole("list", { name: "Consultas de soporte" })).toBeInTheDocument()
    expect(within(screen.getByRole("list", { name: "Consultas de soporte" })).getAllByRole("listitem")).toHaveLength(2)
  })
  it("sin datos no inventa números", async () => {
    montar([])
    fireEvent.click(screen.getByRole("tab", { name: /Indicadores/ }))
    expect(await screen.findByText("Aún no hay consultas respondidas")).toBeInTheDocument()
    expect(screen.getByText("Todavía no hay consultas en este período.")).toBeInTheDocument()
  })
})

describe("Soporte del superadmin: respuestas guardadas y avisos", () => {
  it("lista, crea y borra respuestas guardadas", async () => {
    datos.guardarRespuestaGuardada.mockResolvedValue({ datos: true })
    datos.borrarRespuestaGuardada.mockResolvedValue({ datos: true })
    montar()
    fireEvent.click(screen.getByRole("tab", { name: /Respuestas guardadas/ }))
    expect(await screen.findByText("Restablecer clave")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Nueva respuesta/ }))
    const v = await screen.findByRole("dialog", { name: "Nueva respuesta guardada" })
    fireEvent.change(within(v).getByLabelText("Título"), { target: { value: "Ver reportes" } })
    fireEvent.change(within(v).getByLabelText("Texto"), { target: { value: "Entra a Reportes y elige el período." } })
    fireEvent.click(within(v).getByRole("button", { name: "Guardar" }))
    await waitFor(() => expect(datos.guardarRespuestaGuardada).toHaveBeenCalledWith({ id: undefined, titulo: "Ver reportes", texto: "Entra a Reportes y elige el período." }))
    fireEvent.click(await screen.findByRole("button", { name: "Borrar Restablecer clave" }))
    fireEvent.click(screen.getByRole("button", { name: "Borrar" }))
    await waitFor(() => expect(datos.borrarRespuestaGuardada).toHaveBeenCalledWith("g1"))
  })
  it("sin respuestas guardadas ofrece crear la primera", async () => {
    datos.leerRespuestasGuardadas.mockResolvedValue({ datos: [] })
    montar()
    fireEvent.click(screen.getByRole("tab", { name: /Respuestas guardadas/ }))
    expect(await screen.findByText("Todavía no hay respuestas guardadas")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Crear la primera respuesta" })).toBeInTheDocument()
  })
  it("los tiempos de respuesta se editan desde aquí, con los textos acordados por defecto", async () => {
    datos.guardarAjustesSoporte.mockResolvedValue({ datos: true })
    montar()
    fireEvent.click(screen.getByRole("tab", { name: /Tiempos de respuesta/ }))
    expect(await screen.findByLabelText("Consulta normal")).toHaveValue("en un máximo de 1 día hábil")
    expect(screen.getByLabelText("Consulta urgente")).toHaveValue("el mismo día hábil")
    fireEvent.change(screen.getByLabelText("Consulta urgente"), { target: { value: "en unas 4 horas hábiles" } })
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }))
    await waitFor(() => expect(datos.guardarAjustesSoporte).toHaveBeenCalledWith({ tiempo_normal: "en un máximo de 1 día hábil", tiempo_urgente: "en unas 4 horas hábiles" }))
  })
  it("los avisos, pagos y cumpleaños siguen en su pestaña", async () => {
    montar()
    fireEvent.click(screen.getByRole("tab", { name: /Avisos, pagos y cumpleaños/ }))
    expect(await screen.findByText("CONTENIDO DE AVISOS")).toBeInTheDocument()
  })
})
