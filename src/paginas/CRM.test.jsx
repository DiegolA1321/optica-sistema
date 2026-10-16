import React from "react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react"

// La base del CRM es de mentira: devuelve las filas que cada prueba pone y anota las llamadas a las funciones del servidor.
const base = vi.hoisted(() => ({ filas: { crm_contactos: [], crm_campanas: [], crm_plantillas: [] }, rpc: null }))
vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    from: (tabla) => { const q = { select: () => q, eq: () => q, order: () => q, limit: () => q, then: (res, rej) => Promise.resolve({ data: base.filas[tabla] || [], error: null }).then(res, rej) }; return q },
    rpc: (...a) => base.rpc(...a),
  },
}))

import CRM from "./CRM"
import { useCrmDatos } from "../utilidades/crmDatos"
import { hoyISO } from "../utilidades/disponibilidad"
import { fechaEnDias } from "../utilidades/crmContactos"

const hoy = hoyISO()
const dia = (n) => fechaEnDias(n, hoy)
const marca = (n) => `${dia(n)}T12:00:00-05:00`
const admin = { id: "u1", rol: "admin", nombre: "Ana Admin", opticaId: "o1", opticaNombre: "Óptica Solna" }
const soloVer = { id: "u2", rol: "asistente", nombre: "Vera", opticaId: "o1", opticaNombre: "Óptica Solna", permisosNivel: { crm: ["ver"] } }
const paciente = (id, nombre, extra = {}) => ({ id, nombre, telefono: "0990000000", fechaRegistro: dia(-10), fechaNacimiento: "1990-02-02", ...extra })
const pacientes = [
  paciente("p1", "Ana Vencida", { fechaRegistro: dia(-200) }),
  paciente("p2", "Beto Cumpleañero", { fechaNacimiento: `1985${dia(0).slice(4)}`, aceptaPromociones: true }),
  paciente("p3", "Carla Próxima", { fechaRegistro: dia(-160) }),
  paciente("p4", "Dani Al Día"),
  paciente("p5", "Eva Sin Mensajes", { fechaRegistro: dia(-200), aceptaRecordatorios: false }),
]
let n = 0
const aviso = vi.fn()
const cambioPermisos = vi.fn()
// Como en Dashboard: los datos del CRM se cargan arriba y se le pasan al módulo.
function Montaje(props) {
  const crm = useCrmDatos({ usuario: props.usuario, alCambiarPermisos: props.onPacienteActualizado })
  return <CRM {...props} crm={crm} />
}
const montar = (extra = {}) => render(<Montaje usuario={admin} pacientes={pacientes} consultas={[]} citas={[]} ordenesLab={[]} onAviso={aviso} onPacienteActualizado={cambioPermisos} {...extra} />)
const tab = (nombre) => screen.getByRole("tab", { name: new RegExp(nombre) })
const fila = (nombre) => screen.getByText(nombre).closest("li")

beforeEach(() => {
  n = 0
  base.filas = { crm_contactos: [], crm_campanas: [], crm_plantillas: [] }
  base.rpc = vi.fn(async (nombre) => ({ data: nombre === "registrar_contacto_crm" || nombre === "crear_campana_crm" ? `id-${++n}` : null, error: null }))
  aviso.mockReset(); cambioPermisos.mockReset()
  vi.spyOn(window, "open").mockImplementation(() => null)
})
afterEach(() => { vi.restoreAllMocks() })

describe("CRM: Para contactar", () => {
  it("la cabecera es la de los demás módulos y las cuatro pestañas llevan su número", async () => {
    montar()
    expect(await screen.findByRole("heading", { level: 1, name: "CRM y fidelización" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Nueva campaña/ })).toBeInTheDocument()
    expect(tab("Para contactar")).toHaveTextContent("3") // Ana (vencido), Beto (cumple) y Carla (próximo); Eva no acepta mensajes
    for (const t of ["Seguimiento", "Campañas", "Fidelización"]) expect(tab(t)).toBeInTheDocument()
  })

  it("una fila por paciente con su motivo, y cada filtro trae exactamente los que dice su número", async () => {
    montar()
    await screen.findByText("Ana Vencida")
    const filtros = within(screen.getByRole("group", { name: "Filtrar por motivo" }))
    expect(filtros.getByRole("button", { name: /Todos \(3\)/ })).toBeInTheDocument()
    expect(filtros.getByRole("button", { name: /Control vencido \(1\)/ })).toBeInTheDocument()
    expect(filtros.getByRole("button", { name: /Control próximo \(1\)/ })).toBeInTheDocument()
    expect(filtros.getByRole("button", { name: /Cumpleaños \(1\)/ })).toBeInTheDocument()
    expect(filtros.getByRole("button", { name: /Sin visitar \+12 meses \(0\)/ })).toBeInTheDocument()
    fireEvent.click(filtros.getByRole("button", { name: /Control próximo/ }))
    expect(screen.getByText("Carla Próxima")).toBeInTheDocument()
    expect(screen.queryByText("Ana Vencida")).not.toBeInTheDocument()
    expect(screen.getByText("1 paciente · control que vence pronto")).toBeInTheDocument()
  })

  it("quien no aceptó recordatorios no aparece y se dice; ya no hay botón para incluir a los que no se contactan", async () => {
    montar()
    await screen.findByText("Ana Vencida")
    expect(screen.queryByText("Eva Sin Mensajes")).not.toBeInTheDocument()
    expect(screen.getByText(/1 paciente tiene un motivo que no se muestra porque no aceptó ese tipo de mensaje/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Incluir a quienes/ })).not.toBeInTheDocument()
  })

  it("Beto cumple años pero no aceptó 'Promociones y saludos': su cumpleaños no se ofrece", async () => {
    montar({ pacientes: pacientes.map((p) => (p.id === "p2" ? { ...p, aceptaPromociones: false } : p)) })
    await screen.findByText("Ana Vencida")
    expect(screen.queryByText("Beto Cumpleañero")).not.toBeInTheDocument()
    expect(tab("Para contactar")).toHaveTextContent("2")
  })

  it("Contactar abre WhatsApp con el mensaje del motivo ya escrito y anota el contacto, que queda en Seguimiento", async () => {
    montar()
    await screen.findByText("Ana Vencida")
    fireEvent.click(within(fila("Ana Vencida")).getByRole("button", { name: /Contactar a Ana Vencida/ }))
    await waitFor(() => expect(base.rpc).toHaveBeenCalledWith("registrar_contacto_crm", expect.objectContaining({ p_paciente_id: "p1", p_motivo: "control_vencido", p_canal: "whatsapp" })))
    expect(window.open).toHaveBeenCalledTimes(1)
    const url = decodeURIComponent(window.open.mock.calls[0][0])
    expect(url).toContain("phone=593990000000")
    expect(url).toContain("Hola Ana Vencida")
    expect(url).toContain("Óptica Solna")
    await waitFor(() => expect(aviso).toHaveBeenCalledWith(expect.stringContaining("Contacto con Ana Vencida registrado")))
    // en la fila: contactado hoy y falta anotar el resultado
    await waitFor(() => expect(within(fila("Ana Vencida")).getByText(/Hoy · WhatsApp/)).toBeInTheDocument())
    fireEvent.click(tab("Seguimiento"))
    expect(await screen.findByText("1 contacto en el mes")).toBeInTheDocument()
  })

  it("el servidor rechaza el contacto: se avisa con sus palabras", async () => {
    base.rpc = vi.fn(async () => ({ data: null, error: { message: "Este paciente no desea recibir mensajes." } }))
    montar()
    await screen.findByText("Ana Vencida")
    fireEvent.click(within(fila("Ana Vencida")).getByRole("button", { name: /Contactar a Ana Vencida/ }))
    await waitFor(() => expect(aviso).toHaveBeenCalledWith("Este paciente no desea recibir mensajes."))
  })

  it("registrar 'volver a contactar en 3 días' saca al paciente de la lista y vuelve en esa fecha", async () => {
    montar()
    await screen.findByText("Ana Vencida")
    fireEvent.click(within(fila("Ana Vencida")).getByRole("button", { name: /Registrar resultado de Ana Vencida/ }))
    const ventana = await screen.findByRole("dialog", { name: "Registrar resultado" })
    expect(within(ventana).getByRole("button", { name: "Guardar resultado" })).toBeDisabled()
    fireEvent.click(within(ventana).getByLabelText(/Volver a contactar/))
    expect(within(ventana).getByRole("button", { name: "Guardar resultado" })).toBeDisabled() // falta la fecha
    fireEvent.click(within(ventana).getByRole("button", { name: "3 días" }))
    fireEvent.click(within(ventana).getByRole("button", { name: "Guardar resultado" }))
    await waitFor(() => expect(base.rpc).toHaveBeenCalledWith("registrar_contacto_crm", expect.objectContaining({ p_paciente_id: "p1", p_resultado: "volver_a_contactar", p_volver_el: dia(3) })))
    await waitFor(() => expect(screen.queryByText("Ana Vencida")).not.toBeInTheDocument())
    expect(aviso).toHaveBeenCalledWith(expect.stringMatching(/Ana Vencida reaparecerá en la lista el/))
  })

  it("un contacto que pidió volver hoy reaparece solo, primero en la lista", async () => {
    base.filas.crm_contactos = [{ id: "c1", paciente_id: "p3", motivo: "control_proximo", canal: "whatsapp", mensaje: "Hola", resultado: "volver_a_contactar", volver_el: dia(0), creado_en: marca(-3), creado_por_nombre: "Ana Admin", resultado_en: marca(-3) }]
    montar()
    await screen.findByText("Carla Próxima")
    const filas = screen.getAllByRole("listitem").filter((li) => li.textContent.includes("Contactar"))
    expect(filas[0]).toHaveTextContent("Carla Próxima")
    expect(within(filas[0]).getByText("Volver a contactar")).toBeInTheDocument()
  })

  it("si el paciente agenda una cita después del contacto, queda resuelto sin que nadie lo anote", async () => {
    base.filas.crm_contactos = [{ id: "c1", paciente_id: "p1", motivo: "control_vencido", canal: "whatsapp", mensaje: "Hola", resultado: null, creado_en: marca(-1), creado_por_nombre: "Ana Admin" }]
    montar({ citas: [{ id: "k1", pacienteId: "p1", estado: "Pendiente", fecha: dia(4), creadoEn: marca(0) }] })
    await screen.findByText("Dani Al Día", {}, { timeout: 200 }).catch(() => {})
    await waitFor(() => expect(tab("Para contactar")).toHaveTextContent("2"))
    expect(screen.queryByText("Ana Vencida")).not.toBeInTheDocument()
  })

  it("'No desea recibir mensajes' lo saca de la lista y avisa para que se desactiven sus permisos", async () => {
    montar()
    await screen.findByText("Ana Vencida")
    fireEvent.click(within(fila("Ana Vencida")).getByRole("button", { name: /Registrar resultado de Ana Vencida/ }))
    const ventana = await screen.findByRole("dialog", { name: "Registrar resultado" })
    fireEvent.click(within(ventana).getByLabelText(/No desea recibir mensajes/))
    fireEvent.click(within(ventana).getByRole("button", { name: "Guardar resultado" }))
    await waitFor(() => expect(cambioPermisos).toHaveBeenCalledWith("p1", { aceptaRecordatorios: false, aceptaPromociones: false }))
    await waitFor(() => expect(screen.queryByText("Ana Vencida")).not.toBeInTheDocument())
  })

  it("el paciente sin teléfono no se puede contactar por WhatsApp", async () => {
    montar({ pacientes: [paciente("p1", "Ana Vencida", { fechaRegistro: dia(-200), telefono: "" })] })
    const f = await screen.findByText("Ana Vencida")
    expect(within(f.closest("li")).getByRole("button", { name: /Contactar a Ana Vencida/ })).toBeDisabled()
    expect(within(f.closest("li")).getByText("Sin teléfono")).toBeInTheDocument()
  })

  it("quien solo puede ver el CRM ve la lista pero ninguna acción", async () => {
    montar({ usuario: soloVer })
    await screen.findByText("Ana Vencida")
    expect(screen.queryByRole("button", { name: /Contactar a/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Registrar resultado de/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Nueva campaña/ })).not.toBeInTheDocument()
  })

  it("'Requieren atención' junta los cumpleaños de hoy y lo que toca retomar", async () => {
    montar()
    const boton = await screen.findByRole("button", { name: /Requieren atención: 1/ })
    fireEvent.click(boton)
    const ventana = await screen.findByRole("dialog")
    expect(within(ventana).getByText(/1 cumpleaños hoy sin saludar/)).toBeInTheDocument()
    expect(within(ventana).getByText("Beto Cumpleañero")).toBeInTheDocument()
  })

  it("sin nada que contactar lo dice y ofrece preparar una campaña", async () => {
    montar({ pacientes: [paciente("p4", "Dani Al Día")] })
    expect(await screen.findByText("Hoy no hay a quién contactar")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Preparar una campaña/ }))
    expect(await screen.findByText("Todavía no hay campañas")).toBeInTheDocument()
  })
})

describe("CRM sin pacientes", () => {
  it("lo dice y lleva a registrar el primero", async () => {
    const pedidos = []
    montar({ pacientes: [], onRegistrarPaciente: () => pedidos.push("crear") })
    expect(await screen.findByText("Todavía no hay pacientes a quienes escribir")).toBeInTheDocument()
    screen.getByRole("button", { name: /Registrar el primer paciente/ }).click()
    expect(pedidos).toEqual(["crear"])
  })
  it("sin permiso para crear pacientes no ofrece la acción", async () => {
    montar({ pacientes: [] })
    await screen.findByText("Todavía no hay pacientes a quienes escribir")
    expect(screen.queryByRole("button", { name: /Registrar el primer paciente/ })).not.toBeInTheDocument()
  })
})

describe("CRM: Seguimiento", () => {
  const contactos = [
    { id: "c1", paciente_id: "p1", motivo: "control_vencido", canal: "whatsapp", mensaje: "Hola Ana", resultado: "agendo", creado_en: marca(-1), creado_por_nombre: "Ana Admin", resultado_en: marca(-1) },
    { id: "c2", paciente_id: "p3", motivo: "control_proximo", canal: "llamada", mensaje: "", resultado: "no_respondio", creado_en: marca(-2), creado_por_nombre: "Vera", resultado_en: marca(-2) },
    { id: "c3", paciente_id: "p2", motivo: "cumpleanos", canal: "whatsapp", mensaje: "Feliz cumple", resultado: null, creado_en: marca(0), creado_por_nombre: "Ana Admin" },
  ]
  it("cuenta los contactados, los que agendaron y la tasa de respuesta de lo que se ve", async () => {
    base.filas.crm_contactos = contactos
    montar()
    fireEvent.click(await screen.findByRole("tab", { name: /Seguimiento/ }))
    expect(await screen.findByText("3 contactos en el mes")).toBeInTheDocument()
    const t = (titulo) => screen.getByText(titulo, { selector: "span" }).closest("div")
    expect(t("Contactados")).toHaveTextContent("3")
    expect(t("Agendaron")).toHaveTextContent("1")
    expect(t("Tasa de respuesta")).toHaveTextContent("33 %") // solo "agendó" respondió de 3 contactos
    expect(screen.getByText("1 de 3 respondieron")).toBeInTheDocument()
  })
  it("el filtro por resultado reduce la lista y los números a lo mismo", async () => {
    base.filas.crm_contactos = contactos
    montar()
    fireEvent.click(await screen.findByRole("tab", { name: /Seguimiento/ }))
    await screen.findByText("3 contactos en el mes")
    fireEvent.click(screen.getByRole("button", { name: /Agendaron:/ }))
    expect(await screen.findByText("1 contacto en el mes")).toBeInTheDocument()
    expect(screen.getByText("Ana Vencida")).toBeInTheDocument()
    expect(screen.queryByText("Carla Próxima")).not.toBeInTheDocument()
  })
  it("un contacto se abre en la ventana estándar con su mensaje y quién lo hizo", async () => {
    base.filas.crm_contactos = contactos
    montar()
    fireEvent.click(await screen.findByRole("tab", { name: /Seguimiento/ }))
    fireEvent.click(await screen.findByRole("button", { name: /Ver el contacto con Ana Vencida/ }))
    const v = await screen.findByRole("dialog", { name: "Contacto con el paciente" })
    expect(within(v).getByText("Hola Ana")).toBeInTheDocument()
    expect(within(v).getByText("Ana Admin")).toBeInTheDocument()
  })
  it("sin contactos lo dice y lleva a la lista de trabajo", async () => {
    montar()
    fireEvent.click(await screen.findByRole("tab", { name: /Seguimiento/ }))
    expect(await screen.findByText("Todavía no hay contactos registrados")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Ir a Para contactar/ }))
    expect(await screen.findByText("Ana Vencida")).toBeInTheDocument()
  })
})

describe("CRM: Campañas", () => {
  it("crea una campaña de control vencido y envía a cada paciente, que queda marcado y en Seguimiento", async () => {
    montar()
    fireEvent.click(await screen.findByRole("button", { name: /Nueva campaña/ }))
    const v = await screen.findByRole("dialog", { name: "Nueva campaña" })
    expect(within(v).getByLabelText(/Control vencido \(1\)/)).toBeChecked()
    expect(within(v).getByLabelText(/Quienes aceptan promociones y saludos \(1\)/)).toBeInTheDocument()
    expect(within(v).getByText(/1 paciente no se incluye: no aceptó recordatorios de salud/)).toBeInTheDocument() // Eva
    expect(within(v).getByLabelText("Mensaje").value).toContain("{nombre}")
    fireEvent.click(within(v).getByRole("button", { name: "Crear campaña" }))
    await waitFor(() => expect(base.rpc).toHaveBeenCalledWith("crear_campana_crm", expect.objectContaining({ p_grupo: "control_vencido" })))
    const lista = await screen.findByRole("dialog", { name: /Control vencido ·/ })
    fireEvent.click(within(lista).getByRole("button", { name: /Enviar por WhatsApp a Ana Vencida/ }))
    await waitFor(() => expect(within(lista).getByText("Enviado")).toBeInTheDocument())
    expect(base.rpc).toHaveBeenCalledWith("registrar_contacto_crm", expect.objectContaining({ p_paciente_id: "p1", p_campana_id: "id-1" }))
    expect(decodeURIComponent(window.open.mock.calls[0][0])).toContain("Hola Ana Vencida")
    expect(within(lista).getByText(/0 pacientes pendientes/)).toBeInTheDocument()
  })
  it("la campaña de promociones solo trae a quien las aceptó", async () => {
    montar({ pacientes: [paciente("p1", "Ana Acepta", { aceptaPromociones: true }), paciente("p2", "Beto No")] })
    fireEvent.click(await screen.findByRole("button", { name: /Nueva campaña/ }))
    const v = await screen.findByRole("dialog", { name: "Nueva campaña" })
    fireEvent.click(within(v).getByLabelText(/Quienes aceptan promociones y saludos \(1\)/))
    expect(within(v).getByText(/Así lo recibirá Ana Acepta/)).toBeInTheDocument()
  })
  it("sin campañas lo dice y ofrece crear la primera", async () => {
    montar()
    fireEvent.click(await screen.findByRole("tab", { name: /Campañas/ }))
    expect(await screen.findByText("Todavía no hay campañas")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Crear la primera campaña/ }))
    expect(await screen.findByRole("dialog", { name: "Nueva campaña" })).toBeInTheDocument()
  })
  it("el saludo automático vive en la ventana de mensajes, apagado mientras no haya correo", async () => {
    montar()
    fireEvent.click(await screen.findByRole("tab", { name: /Campañas/ }))
    expect(screen.queryByRole("switch")).toBeNull()
    fireEvent.click(await screen.findByRole("button", { name: /Plantillas/ }))
    const v = await screen.findByRole("dialog", { name: "Mensajes y envíos automáticos" })
    const sw = within(v).getByRole("switch", { name: /saludo de cumpleaños/i })
    expect(sw).toBeDisabled()
    expect(sw).toHaveAttribute("aria-checked", "false")
    expect(within(v).getByText("Requiere el correo configurado.")).toBeInTheDocument()
    expect(within(v).getAllByRole("switch")).toHaveLength(1)
  })
  it("una variable se inserta donde está el cursor", async () => {
    montar()
    fireEvent.click(await screen.findByRole("tab", { name: /Campañas/ }))
    fireEvent.click(await screen.findByRole("button", { name: /Plantillas/ }))
    const v = await screen.findByRole("dialog", { name: "Mensajes y envíos automáticos" })
    const campo = within(v).getByLabelText("Cumpleaños")
    fireEvent.change(campo, { target: { value: "Feliz cumple, !" } })
    campo.setSelectionRange(14, 14)
    fireEvent.click(within(campo.parentElement).getByRole("button", { name: /Insertar {nombre}/ }))
    await waitFor(() => expect(campo.value).toBe("Feliz cumple, {nombre}!"))
  })
  it("las plantillas se editan y se guardan por motivo", async () => {
    montar()
    fireEvent.click(await screen.findByRole("tab", { name: /Campañas/ }))
    fireEvent.click(await screen.findByRole("button", { name: /Plantillas/ }))
    const v = await screen.findByRole("dialog", { name: "Mensajes y envíos automáticos" })
    fireEvent.change(within(v).getByLabelText("Cumpleaños"), { target: { value: "¡Feliz cumple, {nombre}! De {óptica}." } })
    fireEvent.click(within(v).getByRole("button", { name: "Guardar" }))
    await waitFor(() => expect(base.rpc).toHaveBeenCalledWith("guardar_plantilla_crm", { p_motivo: "cumpleanos", p_texto: "¡Feliz cumple, {nombre}! De {óptica}." }))
  })
})

describe("CRM: Fidelización", () => {
  it("muestra a todos, no solo a cinco", async () => {
    const muchos = Array.from({ length: 12 }, (_, i) => paciente(`q${i}`, `Paciente ${String(i).padStart(2, "0")}`))
    const consultas = muchos.flatMap((p) => [1, 2, 3].map((k) => ({ id: `${p.id}-${k}`, pacienteId: p.id, fecha: dia(-k) })))
    montar({ pacientes: muchos, consultas })
    fireEvent.click(await screen.findByRole("tab", { name: /Fidelización/ }))
    expect(await screen.findByText("12 pacientes")).toBeInTheDocument()
    expect(screen.getByText("Paciente 11")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Más frecuentes \(12\)/ }))
    expect(screen.getByText("12 pacientes")).toBeInTheDocument()
  })
  it("no hay botones de contacto: no es una lista de tareas", async () => {
    montar({ consultas: [1, 2, 3].map((k) => ({ id: `k${k}`, pacienteId: "p4", fecha: dia(-k) })) })
    fireEvent.click(await screen.findByRole("tab", { name: /Fidelización/ }))
    await screen.findByText("Dani Al Día")
    expect(screen.queryByRole("button", { name: /Contactar|WhatsApp/ })).not.toBeInTheDocument()
  })
})
