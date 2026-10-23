import React from "react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, within, fireEvent, waitFor, cleanup } from "@testing-library/react"

// La base del CRM es de mentira: devuelve las filas que cada prueba pone y anota las llamadas a las funciones del servidor.
const base = vi.hoisted(() => ({ filas: { crm_contactos: [], crm_campanas: [], crm_plantillas: [] }, rpc: null }))
vi.mock("../lib/supabaseClient", () => ({
  supabase: {
    from: (tabla) => { const q = { select: () => q, eq: () => q, order: () => q, limit: () => q, then: (res, rej) => Promise.resolve({ data: base.filas[tabla] || [], error: null }).then(res, rej) }; return q },
    rpc: (...a) => base.rpc(...a),
  },
}))

import CRM from "./CRM"
import { ProveedorEscribirPorWhatsApp } from "../componentes/EscribirPorWhatsApp"
import { useContactar } from "../componentes/useContactar"
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
  const { escribir, ventana } = useContactar({ plantillas: crm.plantillas, opticaNombre: props.usuario?.opticaNombre, consultas: props.consultas, contactarDeAviso: crm.contactarDeAviso, contactarManual: crm.contactarManual, avisar: props.onAviso })
  return <ProveedorEscribirPorWhatsApp value={escribir}><CRM {...props} crm={crm} />{ventana}</ProveedorEscribirPorWhatsApp>
}
const montar = (extra = {}) => render(<Montaje usuario={admin} pacientes={pacientes} consultas={[]} citas={[]} ordenesLab={[]} onAviso={aviso} onPacienteActualizado={cambioPermisos} {...extra} />)
const tab = (nombre) => screen.getByRole("tab", { name: new RegExp(nombre) })
// Los nombres también salen en los datos rápidos de arriba: las listas se buscan dentro de su pestaña.
const panel = () => screen.getByRole("tabpanel")
const enPanel = async (texto) => within(await screen.findByRole("tabpanel")).findByText(texto)
const fila = (nombre) => within(panel()).getByText(nombre).closest("li")

beforeEach(() => {
  n = 0
  base.filas = { crm_contactos: [], crm_campanas: [], crm_plantillas: [] }
  base.rpc = vi.fn(async (nombre) => ({ data: nombre === "registrar_contacto_crm" || nombre === "crear_campana_crm" ? `id-${++n}` : null, error: null }))
  aviso.mockReset(); cambioPermisos.mockReset()
  vi.spyOn(window, "open").mockImplementation(() => null)
})
afterEach(() => { vi.restoreAllMocks() })

describe("CRM: Para contactar", () => {
  it("la cabecera es la de los demás módulos y hay cuatro pestañas (Plantillas ya es un botón)", async () => {
    montar()
    expect(await screen.findByRole("heading", { level: 1, name: "CRM y fidelización" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Nueva campaña/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Plantillas$/ })).toBeInTheDocument()
    expect(tab("Para contactar")).toHaveTextContent("3") // Ana (vencido), Beto (cumple) y Carla (próximo); Eva no acepta mensajes
    for (const t of ["Historial de contactos", "Campañas", "Fidelización"]) expect(tab(t)).toBeInTheDocument()
  })

  it("una fila por paciente con su motivo, y cada filtro trae exactamente los que dice su número", async () => {
    montar()
    await enPanel("Ana Vencida")
    const filtros = within(screen.getByRole("group", { name: "Filtrar por motivo" }))
    expect(filtros.getByRole("button", { name: /Todos \(3\)/ })).toBeInTheDocument()
    expect(filtros.getByRole("button", { name: /Control vencido \(1\)/ })).toBeInTheDocument()
    expect(filtros.getByRole("button", { name: /Control próximo \(1\)/ })).toBeInTheDocument()
    expect(filtros.getByRole("button", { name: /Cumpleaños \(1\)/ })).toBeInTheDocument()
    expect(filtros.getByRole("button", { name: /Sin visitar \+12 meses \(0\)/ })).toBeInTheDocument()
    fireEvent.click(filtros.getByRole("button", { name: /Control próximo/ }))
    expect(within(panel()).getByText("Carla Próxima")).toBeInTheDocument()
    expect(within(panel()).queryByText("Ana Vencida")).not.toBeInTheDocument()
    expect(screen.getByText("1 paciente · control que vence pronto")).toBeInTheDocument()
  })

  it("quien no aceptó recordatorios no aparece y se dice; ya no hay botón para incluir a los que no se contactan", async () => {
    montar()
    await enPanel("Ana Vencida")
    expect(within(panel()).queryByText("Eva Sin Mensajes")).not.toBeInTheDocument()
    expect(screen.getByText(/1 paciente tiene un motivo que no se muestra porque no aceptó ese tipo de mensaje/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Incluir a quienes/ })).not.toBeInTheDocument()
  })

  it("Beto cumple años pero no aceptó 'Promociones y saludos': su cumpleaños no se ofrece", async () => {
    montar({ pacientes: pacientes.map((p) => (p.id === "p2" ? { ...p, aceptaPromociones: false } : p)) })
    await enPanel("Ana Vencida")
    expect(within(panel()).queryByText("Beto Cumpleañero")).not.toBeInTheDocument()
    expect(tab("Para contactar")).toHaveTextContent("2")
  })

  it("Contactar abre WhatsApp con el mensaje del motivo ya escrito y anota el contacto, que queda en el Historial de contactos", async () => {
    montar()
    await enPanel("Ana Vencida")
    fireEvent.click(within(fila("Ana Vencida")).getByRole("button", { name: /Contactar a Ana Vencida/ }))
    // la ventana de Contactar trae el mensaje del motivo ya escrito y nada se abre ni se anota hasta enviarlo
    const ventana = await screen.findByRole("dialog", { name: "Contactar" })
    expect(within(ventana).getByLabelText(/Mensaje/).value).toContain("Hola Ana Vencida")
    expect(window.open).not.toHaveBeenCalled()
    fireEvent.click(within(ventana).getByRole("button", { name: "Enviar por WhatsApp" }))
    await waitFor(() => expect(base.rpc).toHaveBeenCalledWith("registrar_contacto_crm", expect.objectContaining({ p_paciente_id: "p1", p_motivo: "control_vencido", p_canal: "whatsapp" })))
    expect(window.open).toHaveBeenCalledTimes(1)
    const url = decodeURIComponent(window.open.mock.calls[0][0])
    expect(url).toContain("phone=593990000000")
    expect(url).toContain("Hola Ana Vencida")
    expect(url).toContain("Óptica Solna")
    await waitFor(() => expect(aviso).toHaveBeenCalledWith(expect.stringContaining("Contacto con Ana Vencida registrado")))
    // en la fila: contactado hoy y falta anotar el resultado
    await waitFor(() => expect(within(fila("Ana Vencida")).getByText(/Hoy · WhatsApp/)).toBeInTheDocument())
    fireEvent.click(tab("Historial de contactos"))
    const franja = await screen.findByRole("list", { name: "Resumen del historial de contactos" })
    expect(within(franja).getByRole("button", { name: /^Contactados/ })).toHaveTextContent("1")
    expect(within(screen.getByRole("list", { name: "Contactos" })).getByText("Ana Vencida")).toBeInTheDocument()
  })

  it("el servidor rechaza el contacto: se avisa con sus palabras", async () => {
    base.rpc = vi.fn(async () => ({ data: null, error: { message: "Este paciente no desea recibir mensajes." } }))
    montar()
    await enPanel("Ana Vencida")
    fireEvent.click(within(fila("Ana Vencida")).getByRole("button", { name: /Contactar a Ana Vencida/ }))
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Contactar" })).getByRole("button", { name: "Enviar por WhatsApp" }))
    await waitFor(() => expect(aviso).toHaveBeenCalledWith("Este paciente no desea recibir mensajes."))
  })

  it("registrar 'volver a contactar en 3 días' saca al paciente de la lista y vuelve en esa fecha", async () => {
    montar()
    await enPanel("Ana Vencida")
    fireEvent.click(within(fila("Ana Vencida")).getByRole("button", { name: /Registrar resultado de Ana Vencida/ }))
    const ventana = await screen.findByRole("dialog", { name: "Registrar resultado" })
    expect(within(ventana).getByRole("button", { name: "Guardar resultado" })).toBeDisabled()
    fireEvent.click(within(ventana).getByLabelText(/Volver a contactar/))
    expect(within(ventana).getByRole("button", { name: "Guardar resultado" })).toBeDisabled() // falta la fecha
    fireEvent.click(within(ventana).getByRole("button", { name: "3 días" }))
    fireEvent.click(within(ventana).getByRole("button", { name: "Guardar resultado" }))
    await waitFor(() => expect(base.rpc).toHaveBeenCalledWith("registrar_contacto_crm", expect.objectContaining({ p_paciente_id: "p1", p_resultado: "volver_a_contactar", p_volver_el: dia(3) })))
    await waitFor(() => expect(within(panel()).queryByText("Ana Vencida")).not.toBeInTheDocument())
    expect(aviso).toHaveBeenCalledWith(expect.stringMatching(/Ana Vencida reaparecerá en la lista el/))
  })

  it("un contacto que pidió volver hoy reaparece solo, primero en la lista", async () => {
    base.filas.crm_contactos = [{ id: "c1", paciente_id: "p3", motivo: "control_proximo", canal: "whatsapp", mensaje: "Hola", resultado: "volver_a_contactar", volver_el: dia(0), creado_en: marca(-3), creado_por_nombre: "Ana Admin", resultado_en: marca(-3) }]
    montar()
    await enPanel("Carla Próxima")
    const filas = screen.getAllByRole("listitem").filter((li) => li.textContent.includes("Contactar"))
    expect(filas[0]).toHaveTextContent("Carla Próxima")
    expect(within(filas[0]).getByText("Volver a contactar")).toBeInTheDocument()
  })

  it("si el paciente agenda una cita después del contacto, queda resuelto sin que nadie lo anote", async () => {
    base.filas.crm_contactos = [{ id: "c1", paciente_id: "p1", motivo: "control_vencido", canal: "whatsapp", mensaje: "Hola", resultado: null, creado_en: marca(-1), creado_por_nombre: "Ana Admin" }]
    montar({ citas: [{ id: "k1", pacienteId: "p1", estado: "Pendiente", fecha: dia(4), creadoEn: marca(0) }] })
    await screen.findByText("Dani Al Día", {}, { timeout: 200 }).catch(() => {})
    await waitFor(() => expect(tab("Para contactar")).toHaveTextContent("2"))
    expect(within(panel()).queryByText("Ana Vencida")).not.toBeInTheDocument()
  })

  it("'No desea recibir mensajes' lo saca de la lista y avisa para que se desactiven sus permisos", async () => {
    montar()
    await enPanel("Ana Vencida")
    fireEvent.click(within(fila("Ana Vencida")).getByRole("button", { name: /Registrar resultado de Ana Vencida/ }))
    const ventana = await screen.findByRole("dialog", { name: "Registrar resultado" })
    fireEvent.click(within(ventana).getByLabelText(/No desea recibir mensajes/))
    fireEvent.click(within(ventana).getByRole("button", { name: "Guardar resultado" }))
    await waitFor(() => expect(cambioPermisos).toHaveBeenCalledWith("p1", { aceptaRecordatorios: false, aceptaPromociones: false }))
    await waitFor(() => expect(within(panel()).queryByText("Ana Vencida")).not.toBeInTheDocument())
  })

  it("el paciente sin teléfono no se puede contactar por WhatsApp", async () => {
    montar({ pacientes: [paciente("p1", "Ana Vencida", { fechaRegistro: dia(-200), telefono: "" })] })
    const f = await enPanel("Ana Vencida")
    expect(within(f.closest("li")).getByRole("button", { name: /Contactar a Ana Vencida/ })).toBeDisabled()
    expect(within(f.closest("li")).getByText("Sin teléfono")).toBeInTheDocument()
  })

  it("quien solo puede ver el CRM ve la lista pero ninguna acción", async () => {
    montar({ usuario: soloVer })
    await enPanel("Ana Vencida")
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

describe("CRM: Historial de contactos", () => {
  const contactos = [
    { id: "c1", paciente_id: "p1", motivo: "control_vencido", canal: "whatsapp", mensaje: "Hola Ana", resultado: "agendo", creado_en: marca(-1), creado_por_nombre: "Ana Admin", resultado_en: marca(-1) },
    { id: "c2", paciente_id: "p3", motivo: "control_proximo", canal: "llamada", mensaje: "", resultado: "no_respondio", creado_en: marca(-2), creado_por_nombre: "Vera", resultado_en: marca(-2) },
    { id: "c3", paciente_id: "p2", motivo: "cumpleanos", canal: "whatsapp", mensaje: "Feliz cumple", resultado: null, creado_en: marca(0), creado_por_nombre: "Ana Admin" },
  ]
  const abrir = async (extra) => { base.filas.crm_contactos = contactos; montar(extra); fireEvent.click(await screen.findByRole("tab", { name: /Historial de contactos/ })); return screen.findByRole("list", { name: "Resumen del historial de contactos" }) }
  const dato = (franja, nombre) => within(franja).getByRole("button", { name: new RegExp(`^${nombre}`) })

  it("se llama «Historial de contactos» (con su número) y ya no tiene el selector de mes con flechas ni «Lo que se ve en la lista»", async () => {
    await abrir()
    expect(tab("Historial de contactos")).toHaveTextContent("3")
    expect(screen.queryByRole("tab", { name: /^Seguimiento/ })).toBeNull()
    expect(screen.queryByText("Lo que se ve en la lista")).toBeNull()
    expect(screen.queryByRole("button", { name: "Periodo anterior" })).toBeNull()
    expect(screen.getByRole("button", { name: "Período del historial" })).toHaveTextContent("Este mes")
    expect(screen.getByRole("button", { name: /^Filtrar/ })).toBeInTheDocument()
  })

  it("la franja cuenta contactados, agendaron (con su %), respondieron sin agendar, sin respuesta y falta el resultado", async () => {
    const franja = await abrir()
    expect(dato(franja, "Contactados")).toHaveTextContent("3")
    expect(dato(franja, "Agendaron una cita")).toHaveTextContent("1")
    expect(dato(franja, "Agendaron una cita")).toHaveTextContent("33 % de los contactados")
    expect(dato(franja, "Respondieron sin agendar")).toHaveTextContent("0")
    expect(dato(franja, "Sin respuesta")).toHaveTextContent("1")
    expect(dato(franja, "Falta registrar el resultado")).toHaveTextContent("1")
  })

  it("los números coinciden con «Este mes» del panel de arriba", async () => {
    const franja = await abrir()
    const mes = within(screen.getByRole("region", { name: "Resumen del CRM" })).getByRole("region", { name: "Este mes" })
    expect(mes).toHaveTextContent("3 contactados")
    expect(mes).toHaveTextContent("1 volvió a agendar")
    expect(dato(franja, "Contactados")).toHaveTextContent("3")
    expect(dato(franja, "Agendaron una cita")).toHaveTextContent("1")
  })

  it("cada dato filtra la lista al pulsarlo y se quita al volver a pulsarlo", async () => {
    const franja = await abrir()
    fireEvent.click(dato(franja, "Agendaron una cita"))
    const lista = screen.getByRole("list", { name: "Contactos" })
    expect(within(lista).getAllByRole("listitem")).toHaveLength(1)
    expect(within(lista).getByText("Ana Vencida")).toBeInTheDocument()
    fireEvent.click(dato(franja, "Falta registrar el resultado"))
    expect(within(screen.getByRole("list", { name: "Contactos" })).getByText("Beto Cumpleañero")).toBeInTheDocument()
    fireEvent.click(dato(franja, "Falta registrar el resultado"))
    expect(within(screen.getByRole("list", { name: "Contactos" })).getAllByRole("listitem")).toHaveLength(3)
  })

  it("la fila trae el paciente con quién lo contactó y por dónde, el motivo, el resultado y la acción que corresponde", async () => {
    await abrir()
    const lista = screen.getByRole("list", { name: "Contactos" })
    const ana = within(lista).getByText("Ana Vencida").closest("li")
    expect(ana).toHaveTextContent("WhatsApp · Ana Admin")
    expect(ana).toHaveTextContent("Control vencido")
    expect(ana).toHaveTextContent("Agendó")
    const carla = within(lista).getByText("Carla Próxima").closest("li")
    expect(carla).toHaveTextContent("Llamada · Vera")
    expect(carla).toHaveTextContent("Sin respuesta")
    expect(within(carla).getByRole("button", { name: "Volver a contactar a Carla Próxima" })).toBeInTheDocument()
    const beto = within(lista).getByText("Beto Cumpleañero").closest("li")
    expect(beto).toHaveTextContent("Falta el resultado")
    expect(within(beto).getByRole("button", { name: "Registrar resultado" })).toBeInTheDocument()
    expect(within(ana).queryByRole("button", { name: /Registrar resultado|Volver a contactar/ })).toBeNull()
  })

  it("«Volver a contactar» abre la ventana de Contactar con el mismo motivo", async () => {
    await abrir()
    fireEvent.click(within(screen.getByRole("list", { name: "Contactos" })).getByRole("button", { name: "Volver a contactar a Carla Próxima" }))
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
  })

  it("si el paciente agenda una cita en los 15 días siguientes, el resultado cambia solo a «Agendó» con la fecha de la cita", async () => {
    const cita = { id: "ct1", pacienteId: "p2", estado: "Pendiente", fecha: dia(6), creadoEn: `${dia(0)}T22:00:00-05:00` }
    await abrir({ citas: [cita] })
    const beto = within(screen.getByRole("list", { name: "Contactos" })).getByText("Beto Cumpleañero").closest("li")
    expect(beto).toHaveTextContent(/Agendó · \d+ \w+/)
    expect(beto).not.toHaveTextContent("Falta el resultado")
  })

  it("un contacto se abre en la ventana estándar con su mensaje, quién lo hizo y los otros contactos de ese paciente", async () => {
    base.filas.crm_contactos = [...contactos, { id: "c4", paciente_id: "p1", motivo: "sin_visitar", canal: "whatsapp", mensaje: "Te extrañamos", resultado: "no_respondio", creado_en: marca(-9), creado_por_nombre: "Vera" }]
    montar()
    fireEvent.click(await screen.findByRole("tab", { name: /Historial de contactos/ }))
    fireEvent.click((await screen.findAllByRole("button", { name: /Ver el contacto con Ana Vencida/ }))[0])
    const v = await screen.findByRole("dialog", { name: "Contacto con el paciente" })
    expect(within(v).getByText("Hola Ana")).toBeInTheDocument()
    expect(within(v).getByText("Ana Admin")).toBeInTheDocument()
    expect(within(within(v).getByRole("list", { name: "Otros contactos del paciente" })).getAllByRole("listitem")).toHaveLength(1)
  })

  it("sin contactos explica para qué sirve y lleva a la lista de trabajo", async () => {
    montar()
    fireEvent.click(await screen.findByRole("tab", { name: /Historial de contactos/ }))
    expect(await screen.findByText("Todavía no hay contactos registrados")).toBeInTheDocument()
    expect(screen.getByText(/Así sabes a quién volver a escribir y cuántos vuelven a la óptica/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Ir a Para contactar/ }))
    expect(await enPanel("Ana Vencida")).toBeInTheDocument()
  })

  it("sin contactos en el período la franja dice «Sin contactos en este período» en vez de «—»", async () => {
    base.filas.crm_contactos = [{ id: "v1", paciente_id: "p1", motivo: "control_vencido", canal: "whatsapp", mensaje: "x", resultado: "agendo", creado_en: marca(-90), creado_por_nombre: "Ana Admin" }]
    montar()
    fireEvent.click(await screen.findByRole("tab", { name: /Historial de contactos/ }))
    await waitFor(() => expect(within(screen.getByRole("list", { name: "Resumen del historial de contactos" })).getAllByText("Sin contactos en este período").length).toBeGreaterThan(0))
    expect(within(screen.getByRole("list", { name: "Resumen del historial de contactos" })).queryByText("—")).toBeNull()
  })
})

describe("CRM: Campañas", () => {
  it("crea una campaña de control vencido y envía a cada paciente, que queda marcado y en el Historial de contactos", async () => {
    montar()
    fireEvent.click(await screen.findByRole("button", { name: /Nueva campaña/ }))
    const v = await screen.findByRole("dialog", { name: "Nueva campaña" })
    expect(within(v).getByLabelText(/Control vencido \(1\)/)).toBeChecked()
    expect(within(v).getByLabelText(/Quienes aceptan promociones y saludos \(1\)/)).toBeInTheDocument()
    expect(within(v).getByText(/No se incluyen 1 paciente: no aceptó recordatorios de salud/)).toBeInTheDocument() // Eva
    expect(within(within(v).getByRole("list", { name: "Destinatarios" })).getByText("Ana Vencida")).toBeInTheDocument()
    fireEvent.click(within(v).getByRole("button", { name: "Ver quiénes" }))
    expect(within(within(v).getByRole("list", { name: "Pacientes que no se incluyen" })).getByText("Eva Sin Mensajes")).toBeInTheDocument()
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
  it("se puede quitar a alguien de la campaña: no se le envía y la campaña lo guarda", async () => {
    montar({ pacientes: [paciente("p1", "Ana Acepta", { aceptaPromociones: true }), paciente("p2", "Beto Acepta", { aceptaPromociones: true })] })
    fireEvent.click(await screen.findByRole("button", { name: /Nueva campaña/ }))
    const v = await screen.findByRole("dialog", { name: "Nueva campaña" })
    fireEvent.click(within(v).getByLabelText(/Quienes aceptan promociones y saludos \(2\)/))
    expect(within(v).getByText("Se enviará a 2 pacientes")).toBeInTheDocument()
    fireEvent.click(within(v).getByRole("button", { name: "Quitar a Beto Acepta de la campaña" }))
    expect(within(v).getByText("Se enviará a 1 paciente")).toBeInTheDocument()
    expect(within(v).getByRole("button", { name: "Volver a incluir a Beto Acepta" })).toBeInTheDocument()
    fireEvent.click(within(v).getByRole("button", { name: "Crear campaña" }))
    await waitFor(() => expect(base.rpc).toHaveBeenCalledWith("crear_campana_crm", expect.objectContaining({ p_grupo: "promociones", p_excluidos: ["p2"] })))
    const lista = await screen.findByRole("dialog", { name: /Quienes aceptan promociones/ })
    expect(within(lista).getByText("Ana Acepta")).toBeInTheDocument()
    expect(within(lista).queryByText("Beto Acepta")).toBeNull()
    expect(lista).toHaveTextContent("0 de 1 enviados")
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
})

describe("CRM: Plantillas", () => {
  const abrir = async (extra) => { montar(extra); fireEvent.click(await screen.findByRole("button", { name: /^Plantillas$/ })); const v = await screen.findByRole("dialog", { name: "Plantillas de mensajes" }); return { v, nav: within(v).getByRole("navigation", { name: "Motivos" }) } }
  const motivos = (nav) => within(nav).getAllByRole("button").map((b) => b.textContent.replace("Sin guardar", ""))

  it("es un botón junto a «Nueva campaña» (ya no una pestaña) que abre todos los motivos con su vista previa", async () => {
    const { v, nav } = await abrir()
    expect(screen.queryByRole("tab", { name: /Plantillas/ })).toBeNull()
    expect(motivos(nav).slice(0, 7)).toEqual(["Control vencido", "Control que vence pronto", "Cita no efectuada", "Cita reagendada", "Pedido listo (retira)", "Pedido listo (envío)", "Cumpleaños"])
    expect(motivos(nav)).toHaveLength(12)
    expect(motivos(nav)).toContain("Promoción")
    expect(within(v).getByRole("region", { name: "Vista previa" })).toHaveTextContent("Con un paciente de ejemplo")
    expect(within(v).getByText(/Cada motivo tiene su mensaje/)).toBeInTheDocument()
  })

  it("cada motivo se ve con sus datos automáticos y su vista previa con «Ana»", async () => {
    const { v, nav } = await abrir()
    fireEvent.click(within(nav).getByRole("button", { name: "Cita no efectuada" }))
    const editor = within(v).getByRole("region", { name: "Plantilla: Cita no efectuada" })
    expect(within(editor).getByRole("textbox").value).toContain("no pudiste venir a tu cita del {fecha_cita}")
    for (const d of ["{nombre}", "{fecha_cita}", "{optica}", "{telefono_optica}"]) expect(within(editor).getByRole("button", { name: new RegExp(`Insertar ${d.replace(/[{}]/g, "\\$&")}`) })).toBeInTheDocument()
    expect(within(editor).queryByRole("button", { name: /Insertar {medidas}/ })).toBeNull()
    const vista = within(v).getByRole("region", { name: "Vista previa" })
    expect(vista).toHaveTextContent("Hola Ana, notamos que no pudiste venir a tu cita del martes 20 de octubre")
    expect(vista).toHaveTextContent("llámanos al 042 345 678. — Óptica")
  })

  it("el saludo automático vive en el motivo Cumpleaños, apagado mientras no haya correo", async () => {
    const { v, nav } = await abrir()
    expect(within(v).queryByRole("switch")).toBeNull()
    fireEvent.click(within(nav).getByRole("button", { name: "Cumpleaños" }))
    const sw = within(v).getByRole("switch", { name: /saludo de cumpleaños/i })
    expect(sw).toBeDisabled()
    expect(sw).toHaveAttribute("aria-checked", "false")
    expect(within(v).getByText("Requiere el correo configurado.")).toBeInTheDocument()
  })

  it("un dato automático se inserta donde está el cursor", async () => {
    const { v, nav } = await abrir()
    fireEvent.click(within(nav).getByRole("button", { name: "Cumpleaños" }))
    const editor = within(v).getByRole("region", { name: "Plantilla: Cumpleaños" })
    const campo = within(editor).getByRole("textbox")
    fireEvent.change(campo, { target: { value: "Feliz cumple, !" } })
    campo.setSelectionRange(14, 14)
    fireEvent.click(within(editor).getByRole("button", { name: /Insertar {nombre}/ }))
    await waitFor(() => expect(campo.value).toBe("Feliz cumple, {nombre}!"))
  })

  it("se edita y se guarda por motivo; «Volver al original» devuelve el texto de fábrica y lo guardado vuelve a seguirlo", async () => {
    const { v, nav } = await abrir()
    fireEvent.click(within(nav).getByRole("button", { name: "Cumpleaños" }))
    const editor = within(v).getByRole("region", { name: "Plantilla: Cumpleaños" })
    expect(within(v).getByRole("button", { name: "Guardar" })).toBeDisabled()
    expect(within(v).getByRole("button", { name: /Volver al original/ })).toBeDisabled()
    fireEvent.change(within(editor).getByRole("textbox"), { target: { value: "¡Feliz cumple, {nombre}! De {optica}." } })
    expect(within(nav).getByRole("button", { name: /Cumpleaños/ })).toHaveTextContent("Sin guardar")
    fireEvent.click(within(v).getByRole("button", { name: "Guardar" }))
    await waitFor(() => expect(base.rpc).toHaveBeenCalledWith("guardar_plantilla_crm", { p_motivo: "cumpleanos", p_texto: "¡Feliz cumple, {nombre}! De {optica}." }))
    await waitFor(() => expect(aviso).toHaveBeenCalledWith("Plantilla «Cumpleaños» guardada."))
    fireEvent.click(within(v).getByRole("button", { name: /Volver al original/ }))
    expect(within(editor).getByRole("textbox").value).toMatch(/^¡Feliz cumpleaños, \{nombre\}!/)
    fireEvent.click(within(v).getByRole("button", { name: "Guardar" }))
    await waitFor(() => expect(base.rpc).toHaveBeenCalledWith("guardar_plantilla_crm", { p_motivo: "cumpleanos", p_texto: "" }))
  })

  it("lo escrito y sin guardar se conserva al cambiar de motivo, y el motivo dice que está sin guardar", async () => {
    const { v, nav } = await abrir()
    fireEvent.click(within(nav).getByRole("button", { name: "Medidas pedidas" }))
    fireEvent.change(within(v).getByRole("textbox"), { target: { value: "Estas son tus medidas:\n{medidas}" } })
    fireEvent.click(within(nav).getByRole("button", { name: "Control vencido" }))
    expect(within(v).getByRole("textbox").value).toContain("control visual")
    fireEvent.click(within(nav).getByRole("button", { name: /Medidas pedidas/ }))
    expect(within(v).getByRole("textbox").value).toBe("Estas son tus medidas:\n{medidas}")
  })

  it("un mensaje muy corto no se puede guardar, y quien no edita el CRM solo lo lee; se cierra con «Cerrar»", async () => {
    const { v } = await abrir()
    fireEvent.change(within(v).getByRole("textbox"), { target: { value: "Hola" } })
    expect(within(v).getByRole("button", { name: "Guardar" })).toBeDisabled()
    fireEvent.click(within(v).getAllByRole("button", { name: "Cerrar" }).at(-1))
    expect(screen.queryByRole("dialog", { name: "Plantillas de mensajes" })).toBeNull()
    cleanup()
    const { v: leer } = await abrir({ usuario: soloVer })
    expect(within(leer).getByText(/Solo quien tiene permiso de editar el CRM puede cambiar las plantillas/)).toBeInTheDocument()
    expect(within(leer).queryByRole("button", { name: "Guardar" })).toBeNull()
  })
})

describe("CRM: el panel de arriba", () => {
  it("cuatro listas (cumpleaños próximos, más fieles, más refieren, este mes); ya no están «Controles vencidos» ni «Todo en orden»", async () => {
    montar({ consultas: [1, 2, 3].map((k) => ({ id: `k${k}`, pacienteId: "p4", fecha: dia(-k) })) })
    const panelArriba = await screen.findByRole("region", { name: "Resumen del CRM" })
    for (const t of ["Cumpleaños próximos", "Más fieles", "Más refieren", "Este mes"]) expect(within(panelArriba).getByRole("heading", { name: t })).toBeInTheDocument()
    expect(within(within(panelArriba).getByRole("region", { name: "Más fieles" })).getByText("Dani Al Día")).toBeInTheDocument()
    expect(within(panelArriba).getByText("Beto Cumpleañero")).toBeInTheDocument()
    expect(within(panelArriba).queryByText(/Controles vencidos/)).toBeNull()
    expect(screen.queryByRole("button", { name: /Todo en orden/ })).toBeNull()
  })

  it("«Este mes» cuenta contactados, quienes volvieron a agendar y campañas enviadas; cada lista lleva a su pestaña", async () => {
    base.filas.crm_contactos = [
      { id: "c1", paciente_id: "p1", motivo: "control_vencido", canal: "whatsapp", mensaje: "Hola", resultado: "agendo", creado_en: marca(0), creado_por_nombre: "Ana Admin", campana_id: "k1" },
      { id: "c2", paciente_id: "p3", motivo: "control_proximo", canal: "whatsapp", mensaje: "Hola", resultado: null, creado_en: marca(0), creado_por_nombre: "Ana Admin", campana_id: "k1" },
    ]
    montar()
    const panelArriba = await screen.findByRole("region", { name: "Resumen del CRM" })
    const mes = within(panelArriba).getByRole("region", { name: "Este mes" })
    expect(mes).toHaveTextContent("2 contactados")
    expect(mes).toHaveTextContent("1 volvió a agendar")
    expect(mes).toHaveTextContent("1 campaña enviada")
    fireEvent.click(within(mes).getByRole("button", { name: /Ver el historial/ }))
    expect(tab("Historial de contactos")).toHaveAttribute("aria-selected", "true")
    fireEvent.click(within(within(panelArriba).getByRole("region", { name: "Cumpleaños próximos" })).getByRole("button", { name: /Ver/ }))
    expect(tab("Fidelización")).toHaveAttribute("aria-selected", "true")
  })

  it("los más refieren se abren completos en una ventana, con empates en el mismo puesto", async () => {
    montar({ pacientes: [...pacientes, paciente("r1", "Ref Uno", {}), paciente("r2", "Ref Dos", {}), paciente("n1", "Nuevo A", { referidoPorId: "r1" }), paciente("n2", "Nuevo B", { referidoPorId: "r2" })] })
    const panelArriba = await screen.findByRole("region", { name: "Resumen del CRM" })
    fireEvent.click(within(within(panelArriba).getByRole("region", { name: "Más refieren" })).getByRole("button", { name: /Ver todos/ }))
    const v = await screen.findByRole("dialog", { name: "Quienes más refieren" })
    const filas = within(v).getAllByRole("listitem")
    expect(filas.map((f) => f.textContent)).toEqual(["1Ref Dos1 referido", "1Ref Uno1 referido"])
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
    expect(screen.getAllByText(/Con empates, comparten el mismo puesto/).length).toBeGreaterThan(0)
  })
  it("los rankings no tienen botones de contacto: no son una lista de tareas", async () => {
    montar({ consultas: [1, 2, 3].map((k) => ({ id: `k${k}`, pacienteId: "p4", fecha: dia(-k) })) })
    fireEvent.click(await screen.findByRole("tab", { name: /Fidelización/ }))
    await enPanel("Dani Al Día")
    const ranking = within(panel()).getByRole("list", { name: "Puntaje de fidelidad" })
    expect(within(ranking).queryByRole("button", { name: /Contactar|WhatsApp|Saludar/ })).toBeNull()
  })

  it("Cumpleaños: esta semana, con la fecha, la edad que cumple y «Saludar» (abre la ventana de Contactar)", async () => {
    montar()
    fireEvent.click(await screen.findByRole("tab", { name: /Fidelización/ }))
    const seccion = await within(panel()).findByRole("region", { name: "Cumpleaños" })
    expect(within(seccion).getByRole("group", { name: "Mes de los cumpleaños" })).toBeInTheDocument()
    const hoyFila = within(seccion).getByText("Beto Cumpleañero").closest("li")
    expect(hoyFila).toHaveTextContent(/Cumple \d+/)
    expect(within(seccion).getByRole("list", { name: "Esta semana" })).toContainElement(hoyFila)
    fireEvent.click(within(hoyFila).getByRole("button", { name: "Saludar a Beto Cumpleañero" }))
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
  })

  it("Cumpleaños: quien no aceptó saludos lo dice y no deja enviar; a quien ya se le saludó este año se le marca", async () => {
    base.filas.crm_contactos = [{ id: "c9", paciente_id: "p2", motivo: "cumpleanos", canal: "whatsapp", mensaje: "Feliz cumple", resultado: null, creado_en: marca(0), creado_por_nombre: "Ana Admin" }]
    montar()
    fireEvent.click(await screen.findByRole("tab", { name: /Fidelización/ }))
    const seccion = await within(panel()).findByRole("region", { name: "Cumpleaños" })
    expect(within(within(seccion).getByText("Beto Cumpleañero").closest("li")).getByText("Saludado")).toBeInTheDocument()
    cleanup()
    base.filas.crm_contactos = []
    montar({ pacientes: pacientes.map((p) => (p.id === "p2" ? { ...p, aceptaPromociones: false } : p)) })
    fireEvent.click(await screen.findByRole("tab", { name: /Fidelización/ }))
    const sinPermiso = await within(panel()).findByRole("region", { name: "Cumpleaños" })
    const f = within(sinPermiso).getByText("Beto Cumpleañero").closest("li")
    expect(within(f).getByText("No acepta saludos")).toBeInTheDocument()
    expect(within(f).queryByRole("button", { name: /Saludar/ })).toBeNull()
  })

  it("Cumpleaños: el selector pasa de «Este mes» a «Próximo mes»", async () => {
    montar({ pacientes: [...pacientes, paciente("s1", "Siguiente Mes", { fechaNacimiento: `1992-${String(((Number(hoy.slice(5, 7)) % 12) + 1)).padStart(2, "0")}-15` })] })
    fireEvent.click(await screen.findByRole("tab", { name: /Fidelización/ }))
    const seccion = await within(panel()).findByRole("region", { name: "Cumpleaños" })
    expect(within(seccion).queryByText("Siguiente Mes")).toBeNull()
    fireEvent.click(within(seccion).getByRole("button", { name: "Próximo mes" }))
    expect(within(seccion).getByText("Siguiente Mes")).toBeInTheDocument()
    expect(within(seccion).queryByText("Beto Cumpleañero")).toBeNull()
  })
})
