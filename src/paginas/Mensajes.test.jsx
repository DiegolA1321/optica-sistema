import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react"

vi.mock("../lib/supabaseClient", () => ({ supabase: null }))
vi.mock("../utilidades/soporteDatos", () => ({
  EVENTO_SOPORTE_CAMBIADO: "soporte:cambiado",
  avisarCambioSoporte: vi.fn(),
  leerMisConsultas: vi.fn(),
  leerAvisos: vi.fn(),
  leerAvisosInternos: vi.fn(),
  leerDestinatariosDeAvisos: vi.fn(),
  publicarAvisoInterno: vi.fn(),
  retirarAvisoInterno: vi.fn(),
  marcarAvisosInternosLeidos: vi.fn(),
  escalarConsulta: vi.fn(),
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
const staff = (niveles = ["ver", "crear"]) => ({ id: "u2", rol: "asistente", nombre: "Paula", opticaId: "o1", permisosNivel: { mensajes: niveles } })
const consulta = (extra = {}) => ({
  id: "c1", numero: 7, opticaId: "o1", autorId: "u1", autorNombre: "Ana Pérez", autorRol: "Administrador", modulo: "ventas", tipo: "problema", urgencia: "urgente",
  asunto: "No puedo cobrar un abono", descripcion: "Se queda cargando", estado: "recibida", contexto: {}, ultimoMensajeDe: "optica", respuestaSinLeer: false,
  calificacion: null, calificacionComentario: "", reabiertaVeces: 0, creadaEn: "2026-10-12T15:00:00Z", actualizadaEn: "2026-10-12T15:00:00Z",
  destino: "superadmin", escaladaEn: null, escaladaPor: "", ...extra,
})
// Una consulta del personal a su administrador.
const dePersonal = (extra = {}) => consulta({ autorId: "u9", autorNombre: "Paula Optómetra", autorRol: "Optómetra", destino: "admin", ...extra })
const interno = (extra = {}) => ({ id: "i1", opticaId: "o1", autorId: "u1", autorNombre: "Ana Pérez", titulo: "Mañana cerramos a las 5", cuerpo: "Por la reunión", para: "todos", rolId: null, perfilId: null, venceEl: null, creadoEn: "2026-10-15T12:00:00Z", ...extra })
const irA = (tab) => window.history.replaceState({}, "", `/?tab=${tab}`)

beforeEach(() => {
  vi.clearAllMocks()
  window.history.replaceState({}, "", "/")
  datos.leerMisConsultas.mockResolvedValue({ datos: [] })
  datos.leerAvisos.mockResolvedValue({ datos: [] })
  datos.leerAvisosInternos.mockResolvedValue({ datos: [], leidos: [], lecturas: [] })
  datos.leerDestinatariosDeAvisos.mockResolvedValue({ roles: [{ id: "ro1", nombre: "Optómetra" }], personas: [{ id: "u9", nombre: "Paula Optómetra" }] })
  datos.leerConversacion.mockResolvedValue({ datos: [] })
  datos.marcarAvisosLeidos.mockResolvedValue({ datos: true })
  datos.marcarAvisosInternosLeidos.mockResolvedValue({ datos: true })
  datos.marcarConsultaLeida.mockResolvedValue({ datos: true })
})

const nombresDeTabs = () => screen.getAllByRole("tab").map((t) => t.textContent.replace(/\d+|nuevas?/g, "").trim())

describe("Soporte: cabecera y pestañas por nivel", () => {
  it("el personal: Mis consultas, Avisos y Ayuda al final; abre en Mis consultas", async () => {
    render(<Mensajes usuario={staff()} />)
    expect(await screen.findByRole("heading", { level: 1, name: "Soporte" })).toBeInTheDocument()
    expect(nombresDeTabs()).toEqual(["Mis consultas", "Avisos", "Ayuda"])
    expect(screen.getByRole("tab", { name: /Mis consultas/ })).toHaveAttribute("aria-selected", "true")
    expect(screen.getAllByRole("button", { name: /Nueva consulta/ })[0]).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/Escribe a el soporte|equipo de la óptica/i)
  })
  it("el administrador: Consultas del personal, Soporte del sistema, Avisos y Ayuda al final; abre en Consultas del personal", async () => {
    render(<Mensajes usuario={admin} />)
    await screen.findByRole("heading", { level: 1, name: "Soporte" })
    expect(nombresDeTabs()).toEqual(["Consultas del personal", "Soporte del sistema", "Avisos", "Ayuda"])
    expect(screen.getByRole("tab", { name: /Consultas del personal/ })).toHaveAttribute("aria-selected", "true")
  })
  it("en Consultas del personal el administrador contesta: sin 'Nueva consulta' en la cabecera", async () => {
    render(<Mensajes usuario={admin} />)
    await screen.findByText("Tu personal todavía no te escribió")
    expect(screen.queryByRole("button", { name: /Nueva consulta/ })).toBeNull()
    expect(screen.getByRole("button", { name: "Publicar un aviso al personal" })).toBeInTheDocument()
  })
  it("una dirección con la pestaña 'Mis consultas' abre al administrador en su primera pestaña", async () => {
    irA("consultas")
    render(<Mensajes usuario={admin} />)
    expect(await screen.findByRole("tab", { name: /Consultas del personal/ })).toHaveAttribute("aria-selected", "true")
  })
  it("sin permiso de 'crear' no hay botón para escribir, ni en la cabecera ni al pie de la ayuda", async () => {
    render(<Mensajes usuario={staff(["ver"])} />)
    await screen.findByRole("heading", { level: 1, name: "Soporte" })
    expect(screen.queryByRole("button", { name: /Nueva consulta/ })).toBeNull()
    expect(screen.queryByRole("button", { name: /Escribir a/ })).toBeNull()
  })
})

describe("Soporte: Ayuda", () => {
  beforeEach(() => irA("ayuda"))
  it("organiza las preguntas por los nueve módulos", async () => {
    render(<Mensajes usuario={admin} />)
    for (const m of ["Citas", "Pacientes", "Ventas", "Inventario", "Reportes", "CRM", "Mi horario", "Usuarios y permisos", "Configuración"]) {
      expect(await screen.findByRole("group", { name: `Ayuda de ${m}` })).toBeInTheDocument()
    }
  })
  it("cada módulo empieza cerrado con su título y cuántas preguntas tiene; se abre al hacer clic", async () => {
    render(<Mensajes usuario={admin} />)
    const citas = await screen.findByRole("group", { name: "Ayuda de Citas" })
    expect(citas).not.toHaveAttribute("open")
    expect(within(citas).getByText("Citas · 6 preguntas")).toBeInTheDocument()
    expect(screen.getAllByRole("group").every((g) => !g.hasAttribute("open"))).toBe(true)
  })
  it("al buscar se abren solo los módulos con resultados", async () => {
    render(<Mensajes usuario={admin} />)
    fireEvent.change(await screen.findByLabelText("Buscar en la ayuda"), { target: { value: "conteo fisico" } })
    const inv = await screen.findByRole("group", { name: "Ayuda de Inventario" })
    expect(inv).toHaveAttribute("open")
    expect(screen.queryByRole("group", { name: "Ayuda de Citas" })).toBeNull()
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
  it("el personal escribe a su administrador, no al soporte", async () => {
    render(<Mensajes usuario={staff()} />)
    expect(await screen.findByText("¿No encontraste lo que buscabas?")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Escribir al soporte" })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Escribir a mi administrador" }))
    expect(await screen.findByRole("dialog", { name: "Nueva consulta" })).toBeInTheDocument()
  })
})

describe("Soporte: Mis consultas (personal → administrador)", () => {
  const mia = (extra = {}) => consulta({ autorId: "u2", autorNombre: "Paula", autorRol: "Optómetra", destino: "admin", ...extra })
  it("sin consultas dice qué pasa y ofrece escribir", async () => {
    render(<Mensajes usuario={staff()} />)
    expect(await screen.findByText("Todavía no escribiste ninguna consulta")).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /Nueva consulta/ }).length).toBe(2)
  })
  it("cada consulta muestra su número, asunto, módulo, urgencia, fecha y estado, y que está con su administrador", async () => {
    datos.leerMisConsultas.mockResolvedValue({ datos: [mia()] })
    render(<Mensajes usuario={staff()} />)
    const lista = await screen.findByRole("list", { name: "Mis consultas" })
    const fila = within(lista).getByRole("listitem")
    for (const t of ["SOP-0007", "No puedo cobrar un abono", "Ventas", "Urgente", "Recibida", "Con tu administrador"]) expect(within(fila).getByText(t)).toBeInTheDocument()
    expect(within(fila).getByText(/12 oct 2026/)).toBeInTheDocument()
  })
  it("el contador de la pestaña coincide con las filas", async () => {
    datos.leerMisConsultas.mockResolvedValue({ datos: [mia(), mia({ id: "c2", numero: 8, asunto: "Otra" })] })
    render(<Mensajes usuario={staff()} />)
    const tab = await screen.findByRole("tab", { name: /Mis consultas/ })
    await waitFor(() => expect(tab.textContent).toMatch(/2/))
    expect(within(await screen.findByRole("list", { name: "Mis consultas" })).getAllByRole("listitem")).toHaveLength(2)
  })
  it("una respuesta del administrador sin leer se destaca y la abre la conversación", async () => {
    datos.leerMisConsultas.mockResolvedValue({ datos: [mia({ estado: "respondida", respuestaSinLeer: true, ultimoMensajeDe: "admin" })] })
    datos.leerConversacion.mockResolvedValue({ datos: [{ id: "m1", autorId: "u1", de: "admin", autorNombre: "Ana Pérez", cuerpo: "Prueba recargar la página", adjuntos: [], interna: false, creadoEn: "2026-10-12T16:00:00Z" }] })
    render(<Mensajes usuario={staff()} />)
    expect(await screen.findByText("Respuesta nueva")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "No puedo cobrar un abono" }))
    const v = await screen.findByRole("dialog")
    expect(await within(v).findByText("Prueba recargar la página")).toBeInTheDocument()
    expect(within(v).getByText("Ana Pérez · Administrador")).toBeInTheDocument()
    await waitFor(() => expect(datos.marcarConsultaLeida).toHaveBeenCalledWith("c1"))
  })
  it("una consulta resuelta pide calificar (de 1 a 5) y permite reabrirla", async () => {
    datos.leerMisConsultas.mockResolvedValue({ datos: [mia({ estado: "resuelta", resueltaEn: "2026-10-13T10:00:00Z" })] })
    datos.calificarConsulta.mockResolvedValue({ datos: true })
    datos.reabrirConsulta.mockResolvedValue({ datos: true })
    render(<Mensajes usuario={staff()} />)
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
  it("una consulta abierta permite responder y marcarla como resuelta, pero el personal NO puede escalarla", async () => {
    datos.leerMisConsultas.mockResolvedValue({ datos: [mia({ estado: "respondida" })] })
    datos.responderConsulta.mockResolvedValue({ datos: true })
    render(<Mensajes usuario={staff()} />)
    fireEvent.click(await screen.findByRole("button", { name: "No puedo cobrar un abono" }))
    const v = await screen.findByRole("dialog")
    fireEvent.change(within(v).getByLabelText("Tu mensaje"), { target: { value: "Ya probé y sigue igual" } })
    fireEvent.click(within(v).getByRole("button", { name: "Enviar" }))
    await waitFor(() => expect(datos.responderConsulta).toHaveBeenCalledWith(expect.objectContaining({ consultaId: "c1", cuerpo: "Ya probé y sigue igual", opticaId: "o1" })))
    expect(within(v).getByRole("button", { name: "Ya está resuelto" })).toBeInTheDocument()
    expect(within(v).queryByRole("button", { name: /Escalar/ })).toBeNull()
  })
})

describe("Soporte: Consultas del personal (el administrador)", () => {
  it("ve de quién es cada consulta y cuáles esperan su respuesta", async () => {
    datos.leerMisConsultas.mockResolvedValue({ datos: [dePersonal(), dePersonal({ id: "c2", numero: 8, estado: "respondida", ultimoMensajeDe: "admin" }), consulta({ id: "c3", numero: 9 })] })
    render(<Mensajes usuario={admin} />)
    const lista = await screen.findByRole("list", { name: "Consultas del personal" })
    expect(within(lista).getAllByRole("listitem")).toHaveLength(2) // la del propio administrador va en «Soporte del sistema»
    expect(within(lista).getAllByText("Escribió Paula Optómetra · Optómetra")).toHaveLength(2)
    expect(await screen.findByText("1 espera tu respuesta")).toBeInTheDocument()
  })
  it("responde, y la consulta del personal se puede escalar con una nota", async () => {
    datos.leerMisConsultas.mockResolvedValue({ datos: [dePersonal()] })
    datos.escalarConsulta.mockResolvedValue({ datos: true })
    render(<Mensajes usuario={admin} />)
    fireEvent.click(await screen.findByRole("button", { name: "No puedo cobrar un abono" }))
    const v = await screen.findByRole("dialog")
    expect(within(v).getByText("La atiendes tú")).toBeInTheDocument()
    expect(within(v).queryByRole("button", { name: "Enviar calificación" })).toBeNull()
    fireEvent.click(within(v).getByRole("button", { name: /Escalar al soporte del sistema/ }))
    fireEvent.change(within(v).getByLabelText("Escalar al soporte del sistema"), { target: { value: "No logro reproducirlo" } })
    fireEvent.click(within(v).getByRole("button", { name: "Escalar consulta" }))
    await waitFor(() => expect(datos.escalarConsulta).toHaveBeenCalledWith("c1", "No logro reproducirlo"))
  })
  it("una consulta ya escalada lo dice y no se vuelve a escalar", async () => {
    datos.leerMisConsultas.mockResolvedValue({ datos: [dePersonal({ destino: "superadmin", escaladaEn: "2026-10-14T10:00:00Z", escaladaPor: "Ana Pérez" })] })
    render(<Mensajes usuario={admin} />)
    expect(await screen.findByText(/Escalada al soporte del sistema/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "No puedo cobrar un abono" }))
    const v = await screen.findByRole("dialog")
    expect(within(v).queryByRole("button", { name: /Escalar al soporte/ })).toBeNull()
  })
  it("no escala una consulta resuelta ni una propia", async () => {
    datos.leerMisConsultas.mockResolvedValue({ datos: [dePersonal({ estado: "resuelta" })] })
    render(<Mensajes usuario={admin} />)
    fireEvent.click(await screen.findByRole("button", { name: "No puedo cobrar un abono" }))
    const v = await screen.findByRole("dialog")
    expect(within(v).queryByRole("button", { name: /Escalar/ })).toBeNull()
  })
})

describe("Soporte: Soporte del sistema (el administrador)", () => {
  beforeEach(() => irA("sistema"))
  it("sin consultas ofrece escribir al soporte", async () => {
    render(<Mensajes usuario={admin} />)
    expect(await screen.findByText("Todavía no escribiste al soporte del sistema")).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /Nueva consulta/ }).length).toBe(2)
  })
  it("muestra sus consultas y le deja calificar la atención", async () => {
    datos.leerMisConsultas.mockResolvedValue({ datos: [consulta({ estado: "resuelta", resueltaEn: "2026-10-13T10:00:00Z" }), dePersonal({ id: "c9", numero: 9 })] })
    render(<Mensajes usuario={admin} />)
    const lista = await screen.findByRole("list", { name: "Soporte del sistema" })
    expect(within(lista).getAllByRole("listitem")).toHaveLength(1)
    fireEvent.click(within(lista).getByRole("button", { name: "No puedo cobrar un abono" }))
    const v = await screen.findByRole("dialog")
    expect(within(v).getByRole("button", { name: "Enviar calificación" })).toBeInTheDocument()
  })
})

describe("Soporte: Avisos", () => {
  const sistema = [
    { id: "a1", asunto: "Mantenimiento el sábado", cuerpo: "De 2 a 4 am", creadoEn: "2026-10-14T12:00:00Z", general: true, leido: false },
    { id: "a2", asunto: "Nueva función", cuerpo: "Conteo físico", creadoEn: "2026-10-01T12:00:00Z", general: true, leido: true },
  ]
  it("el personal ve los del sistema y los de su administrador juntos; los no leídos primero y se marcan a mano", async () => {
    irA("avisos")
    datos.leerAvisos.mockResolvedValue({ datos: sistema })
    datos.leerAvisosInternos.mockResolvedValue({ datos: [interno()], leidos: [], lecturas: [] })
    render(<Mensajes usuario={staff()} />)
    const lista = await screen.findByRole("list", { name: "Avisos" })
    const items = within(lista).getAllByRole("listitem")
    expect(items).toHaveLength(3)
    expect(within(items[0]).getByText("Mañana cerramos a las 5")).toBeInTheDocument()
    expect(within(items[0]).getByText("Nuevo")).toBeInTheDocument()
    expect(within(items[0]).getByText("De tu administrador")).toBeInTheDocument()
    expect(within(items[1]).getByText("Del sistema")).toBeInTheDocument()
    expect(within(items[2]).queryByText("Nuevo")).toBeNull()
    fireEvent.click(within(items[0]).getByRole("button", { name: "Marcar como leído" }))
    await waitFor(() => expect(datos.marcarAvisosInternosLeidos).toHaveBeenCalledWith(["i1"]))
    fireEvent.click(within(items[1]).getByRole("button", { name: "Marcar como leído" }))
    await waitFor(() => expect(datos.marcarAvisosLeidos).toHaveBeenCalledWith(["a1"]))
  })
  it("el personal no publica avisos", async () => {
    irA("avisos")
    render(<Mensajes usuario={staff()} />)
    expect(await screen.findByText("Todavía no hay avisos")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Nuevo aviso/ })).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Ver la ayuda" }))
    expect(await screen.findByLabelText("Buscar en la ayuda")).toBeInTheDocument()
  })
  it("el administrador ve a quién va cada aviso y 'Leído por 2 de 3' con quién lo leyó", async () => {
    irA("avisos")
    datos.leerAvisosInternos.mockResolvedValue({
      datos: [interno({ para: "rol", rolId: "ro1" })], leidos: [],
      lecturas: [
        { aviso_id: "i1", perfil_id: "u9", nombre: "Paula Optómetra", leido_en: "2026-10-15T14:00:00Z" },
        { aviso_id: "i1", perfil_id: "u3", nombre: "Omar Optómetra", leido_en: "2026-10-15T15:00:00Z" },
        { aviso_id: "i1", perfil_id: "u4", nombre: "Zoe Optómetra", leido_en: null },
      ],
    })
    render(<Mensajes usuario={admin} />)
    const item = within(await screen.findByRole("list", { name: "Avisos" })).getAllByRole("listitem")[0]
    expect(within(item).getByText("Para: Rol Optómetra")).toBeInTheDocument()
    expect(within(item).getByText("Leído por 2 de 3")).toBeInTheDocument()
    expect(within(item).queryByRole("button", { name: "Marcar como leído" })).toBeNull() // lo publicó él: no es "nuevo" para él
    const quien = within(item).getByRole("list", { name: "Quién leyó «Mañana cerramos a las 5»" })
    expect(within(quien).getAllByRole("listitem")).toHaveLength(3)
    expect(within(quien).getByText("Zoe Optómetra").closest("li")).toHaveTextContent("Sin leer")
  })
  it("el administrador publica un aviso para un rol, con vencimiento opcional", async () => {
    irA("avisos")
    datos.publicarAvisoInterno.mockResolvedValue({ datos: true })
    render(<Mensajes usuario={admin} />)
    fireEvent.click(await screen.findByRole("button", { name: /Nuevo aviso/ }))
    const v = await screen.findByRole("dialog", { name: "Nuevo aviso" })
    expect(within(v).getByRole("button", { name: "Publicar aviso" })).toBeDisabled()
    fireEvent.change(within(v).getByLabelText("Título"), { target: { value: "Reunión de optómetras" } })
    fireEvent.change(within(v).getByLabelText("Mensaje"), { target: { value: "El lunes a las 8" } })
    fireEvent.change(within(v).getByLabelText("Para"), { target: { value: "rol" } })
    expect(within(v).getByRole("button", { name: "Publicar aviso" })).toBeDisabled() // falta elegir el rol
    fireEvent.change(await within(v).findByLabelText("Rol"), { target: { value: "ro1" } })
    fireEvent.click(within(v).getByRole("button", { name: "Publicar aviso" }))
    await waitFor(() => expect(datos.publicarAvisoInterno).toHaveBeenCalledWith({ titulo: "Reunión de optómetras", cuerpo: "El lunes a las 8", para: "rol", rolId: "ro1", perfilId: null, venceEl: null }))
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Nuevo aviso" })).toBeNull())
  })
  it("si no se puede publicar lo dice y no pierde lo escrito", async () => {
    irA("avisos")
    datos.publicarAvisoInterno.mockResolvedValue({ error: "No hay conexión con el servidor." })
    render(<Mensajes usuario={admin} />)
    fireEvent.click(await screen.findByRole("button", { name: /Nuevo aviso/ }))
    const v = await screen.findByRole("dialog", { name: "Nuevo aviso" })
    fireEvent.change(within(v).getByLabelText("Título"), { target: { value: "Cierre" } })
    fireEvent.change(within(v).getByLabelText("Mensaje"), { target: { value: "Cerramos" } })
    fireEvent.click(within(v).getByRole("button", { name: "Publicar aviso" }))
    expect(await within(v).findByRole("alert")).toHaveTextContent("No hay conexión")
    expect(within(v).getByLabelText("Título")).toHaveValue("Cierre")
  })
  it("el administrador retira un aviso con confirmación", async () => {
    irA("avisos")
    datos.retirarAvisoInterno.mockResolvedValue({ datos: true })
    datos.leerAvisosInternos.mockResolvedValue({ datos: [interno()], leidos: [], lecturas: [] })
    render(<Mensajes usuario={admin} />)
    fireEvent.click(await screen.findByRole("button", { name: /Retirar aviso/ }))
    fireEvent.click(screen.getByRole("button", { name: "Sí, retirar" }))
    await waitFor(() => expect(datos.retirarAvisoInterno).toHaveBeenCalledWith("i1"))
  })
  it("sin avisos, el administrador puede publicar el primero", async () => {
    irA("avisos")
    render(<Mensajes usuario={admin} />)
    expect(await screen.findByText("Todavía no hay avisos")).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /Nuevo aviso/ }).length).toBe(2)
  })
})

describe("Soporte: Nueva consulta", () => {
  beforeEach(() => irA("sistema"))
  it("pide módulo, tipo, urgencia con su explicación, asunto, descripción y archivos, y manda el contexto solo", async () => {
    datos.crearConsulta.mockResolvedValue({ datos: { id: "c9", numero: 12 } })
    render(<Mensajes usuario={admin} pantallaOrigen="Citas médicas" moduloOrigen="citas" />)
    fireEvent.click((await screen.findAllByRole("button", { name: /Nueva consulta/ }))[0])
    const v = await screen.findByRole("dialog", { name: "Nueva consulta" })
    expect(within(v).getByLabelText("¿De qué módulo es?")).toHaveValue("citas")
    for (const t of ["Problema", "Pregunta", "Sugerencia", "Normal", "Urgente"]) expect(within(v).getByText(t)).toBeInTheDocument()
    expect(within(v).getByText("Urgente: no puedo atender, vender o cobrar.")).toBeInTheDocument()
    expect(within(v).getByRole("button", { name: /Adjuntar archivo/ })).toBeInTheDocument()
    expect(within(v).getByText(/Imágenes, PDF, Word \(\.docx\) o Excel \(\.xlsx\) de hasta 10 MB/)).toBeInTheDocument()
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
  it("«¿Ya buscaste en la ayuda?» abre la Ayuda con el buscador listo y con lo que ya escribió como búsqueda", async () => {
    render(<Mensajes usuario={admin} />)
    fireEvent.click((await screen.findAllByRole("button", { name: /Nueva consulta/ }))[0])
    const v = await screen.findByRole("dialog", { name: "Nueva consulta" })
    expect(within(v).getByText("¿Ya buscaste en la ayuda?")).toBeInTheDocument()
    fireEvent.change(within(v).getByLabelText("Asunto"), { target: { value: "abono" } })
    fireEvent.click(within(v).getByRole("button", { name: "Buscar en la ayuda" }))
    const buscador = await screen.findByLabelText("Buscar en la ayuda")
    expect(buscador).toHaveValue("abono")
    expect(buscador).toHaveFocus()
    expect(screen.queryByRole("dialog", { name: "Nueva consulta" })).toBeNull()
    expect(screen.getByRole("tab", { name: "Ayuda" })).toHaveAttribute("aria-selected", "true")
  })
  it("una consulta normal del administrador promete el tiempo normal del soporte", async () => {
    datos.crearConsulta.mockResolvedValue({ datos: { id: "c9", numero: 3 } })
    render(<Mensajes usuario={admin} />)
    fireEvent.click((await screen.findAllByRole("button", { name: /Nueva consulta/ }))[0])
    const v = await screen.findByRole("dialog", { name: "Nueva consulta" })
    fireEvent.change(within(v).getByLabelText("Asunto"), { target: { value: "Una duda" } })
    fireEvent.change(within(v).getByLabelText("Descripción"), { target: { value: "¿Cómo se hace tal cosa?" } })
    fireEvent.click(within(v).getByRole("button", { name: "Enviar consulta" }))
    expect(await screen.findByText(/en un máximo de 1 día hábil/)).toBeInTheDocument()
  })
  it("el personal escribe a su administrador: no se le promete el tiempo del soporte", async () => {
    window.history.replaceState({}, "", "/")
    datos.crearConsulta.mockResolvedValue({ datos: { id: "c9", numero: 4 } })
    render(<Mensajes usuario={staff()} />)
    fireEvent.click((await screen.findAllByRole("button", { name: /Nueva consulta/ }))[0])
    const v = await screen.findByRole("dialog", { name: "Nueva consulta" })
    expect(within(v).getByText("Cuéntale a tu administrador qué pasa")).toBeInTheDocument()
    fireEvent.change(within(v).getByLabelText("Asunto"), { target: { value: "Una duda" } })
    fireEvent.change(within(v).getByLabelText("Descripción"), { target: { value: "¿Cómo se hace tal cosa?" } })
    fireEvent.click(within(v).getByRole("button", { name: "Enviar consulta" }))
    expect(await screen.findByText(/Tu administrador la verá y te responderá/)).toBeInTheDocument()
    expect(screen.getByText("Ya la tiene tu administrador")).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/día hábil/)
  })
  it("si falla el envío lo dice y no pierde lo escrito", async () => {
    datos.crearConsulta.mockResolvedValue({ error: "No hay conexión con el servidor." })
    render(<Mensajes usuario={admin} />)
    fireEvent.click((await screen.findAllByRole("button", { name: /Nueva consulta/ }))[0])
    const v = await screen.findByRole("dialog", { name: "Nueva consulta" })
    fireEvent.change(within(v).getByLabelText("Asunto"), { target: { value: "Una duda" } })
    fireEvent.change(within(v).getByLabelText("Descripción"), { target: { value: "¿Cómo se hace tal cosa?" } })
    fireEvent.click(within(v).getByRole("button", { name: "Enviar consulta" }))
    expect(await within(v).findByRole("alert")).toHaveTextContent("No hay conexión")
    expect(within(v).getByLabelText("Asunto")).toHaveValue("Una duda")
  })
  it("acepta PDF, Word y Excel y rechaza los archivos con macros y los de otro tipo", async () => {
    render(<Mensajes usuario={admin} />)
    fireEvent.click((await screen.findAllByRole("button", { name: /Nueva consulta/ }))[0])
    const v = await screen.findByRole("dialog", { name: "Nueva consulta" })
    const entrada = v.querySelector('input[type="file"]')
    fireEvent.change(entrada, { target: { files: [new File(["x"], "informe.pdf", { type: "application/pdf" })] } })
    expect(await within(v).findByText("informe.pdf")).toBeInTheDocument()
    fireEvent.change(v.querySelector('input[type="file"]'), { target: { files: [new File(["x"], "macro.xlsm", { type: "application/vnd.ms-excel.sheet.macroEnabled.12" })] } })
    expect(await within(v).findByText(/tiene macros y no se acepta/)).toBeInTheDocument()
    fireEvent.change(v.querySelector('input[type="file"]'), { target: { files: [new File(["x"], "programa.exe", { type: "application/x-msdownload" })] } })
    expect(await within(v).findByText(/no se acepta: solo imágenes/)).toBeInTheDocument()
  })
})
