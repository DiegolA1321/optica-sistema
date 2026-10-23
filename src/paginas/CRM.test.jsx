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
  it("la cabecera es la de los demás módulos y las cuatro pestañas llevan su número", async () => {
    montar()
    expect(await screen.findByRole("heading", { level: 1, name: "CRM y fidelización" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Nueva campaña/ })).toBeInTheDocument()
    expect(tab("Para contactar")).toHaveTextContent("3") // Ana (vencido), Beto (cumple) y Carla (próximo); Eva no acepta mensajes
    for (const t of ["Seguimiento", "Campañas", "Fidelización"]) expect(tab(t)).toBeInTheDocument()
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
    expect(screen.getByText("Carla Próxima")).toBeInTheDocument()
    expect(screen.queryByText("Ana Vencida")).not.toBeInTheDocument()
    expect(screen.getByText("1 paciente · control que vence pronto")).toBeInTheDocument()
  })

  it("quien no aceptó recordatorios no aparece y se dice; ya no hay botón para incluir a los que no se contactan", async () => {
    montar()
    await enPanel("Ana Vencida")
    expect(screen.queryByText("Eva Sin Mensajes")).not.toBeInTheDocument()
    expect(screen.getByText(/1 paciente tiene un motivo que no se muestra porque no aceptó ese tipo de mensaje/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Incluir a quienes/ })).not.toBeInTheDocument()
  })

  it("Beto cumple años pero no aceptó 'Promociones y saludos': su cumpleaños no se ofrece", async () => {
    montar({ pacientes: pacientes.map((p) => (p.id === "p2" ? { ...p, aceptaPromociones: false } : p)) })
    await enPanel("Ana Vencida")
    expect(within(panel()).queryByText("Beto Cumpleañero")).not.toBeInTheDocument()
    expect(tab("Para contactar")).toHaveTextContent("2")
  })

  it("Contactar abre WhatsApp con el mensaje del motivo ya escrito y anota el contacto, que queda en Seguimiento", async () => {
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
    fireEvent.click(tab("Seguimiento"))
    expect(await screen.findByText("1 contacto en el mes")).toBeInTheDocument()
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
    await enPanel("Ana Vencida")
    fireEvent.click(within(fila("Ana Vencida")).getByRole("button", { name: /Registrar resultado de Ana Vencida/ }))
    const ventana = await screen.findByRole("dialog", { name: "Registrar resultado" })
    fireEvent.click(within(ventana).getByLabelText(/No desea recibir mensajes/))
    fireEvent.click(within(ventana).getByRole("button", { name: "Guardar resultado" }))
    await waitFor(() => expect(cambioPermisos).toHaveBeenCalledWith("p1", { aceptaRecordatorios: false, aceptaPromociones: false }))
    await waitFor(() => expect(screen.queryByText("Ana Vencida")).not.toBeInTheDocument())
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
    expect(await enPanel("Ana Vencida")).toBeInTheDocument()
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
})

describe("CRM: Plantillas", () => {
  const abrir = async () => { montar(); fireEvent.click(await screen.findByRole("tab", { name: /Plantillas/ })); return screen.findByRole("navigation", { name: "Motivos" }) }
  const motivos = (nav) => within(nav).getAllByRole("button").map((b) => b.textContent.replace("Sin guardar", ""))

  it("es una pestaña con todos los motivos (los nuevos de las rondas incluidos), su vista previa y sin la ventana de antes", async () => {
    const nav = await abrir()
    expect(tab("Plantillas")).toHaveTextContent("12")
    expect(motivos(nav).slice(0, 7)).toEqual(["Control vencido", "Cita no efectuada", "Pedido listo (retira)", "Pedido listo (envío)", "Cumpleaños", "Recibió su diagnóstico y no compró", "Medidas pedidas"])
    expect(motivos(nav)).toContain("Promoción")
    expect(screen.getByRole("region", { name: "Vista previa" })).toHaveTextContent("Con un paciente de ejemplo")
    fireEvent.click(await screen.findByRole("tab", { name: /Campañas/ }))
    expect(screen.queryByRole("button", { name: /Plantillas/ })).toBeNull() // un solo camino: ya no hay botón ni ventana en Campañas
  })

  it("cada motivo se ve con sus datos automáticos y su vista previa con «Ana»", async () => {
    const nav = await abrir()
    fireEvent.click(within(nav).getByRole("button", { name: "Cita no efectuada" }))
    const editor = screen.getByRole("region", { name: "Plantilla: Cita no efectuada" })
    expect(within(editor).getByRole("textbox").value).toContain("no pudiste venir a tu cita del {fecha_cita}")
    for (const v of ["{nombre}", "{fecha_cita}", "{optica}", "{telefono_optica}"]) expect(within(editor).getByRole("button", { name: new RegExp(`Insertar ${v.replace(/[{}]/g, "\\$&")}`) })).toBeInTheDocument()
    expect(within(editor).queryByRole("button", { name: /Insertar {medidas}/ })).toBeNull()
    const vista = screen.getByRole("region", { name: "Vista previa" })
    expect(vista).toHaveTextContent("Hola Ana, notamos que no pudiste venir a tu cita del martes 20 de octubre")
    expect(vista).toHaveTextContent("llámanos al 042 345 678. — Óptica")
  })

  it("el saludo automático vive en el motivo Cumpleaños, apagado mientras no haya correo", async () => {
    const nav = await abrir()
    expect(screen.queryByRole("switch")).toBeNull()
    fireEvent.click(within(nav).getByRole("button", { name: "Cumpleaños" }))
    const sw = screen.getByRole("switch", { name: /saludo de cumpleaños/i })
    expect(sw).toBeDisabled()
    expect(sw).toHaveAttribute("aria-checked", "false")
    expect(screen.getByText("Requiere el correo configurado.")).toBeInTheDocument()
  })

  it("un dato automático se inserta donde está el cursor", async () => {
    const nav = await abrir()
    fireEvent.click(within(nav).getByRole("button", { name: "Cumpleaños" }))
    const editor = screen.getByRole("region", { name: "Plantilla: Cumpleaños" })
    const campo = within(editor).getByRole("textbox")
    fireEvent.change(campo, { target: { value: "Feliz cumple, !" } })
    campo.setSelectionRange(14, 14)
    fireEvent.click(within(editor).getByRole("button", { name: /Insertar {nombre}/ }))
    await waitFor(() => expect(campo.value).toBe("Feliz cumple, {nombre}!"))
  })

  it("se edita y se guarda por motivo; «Volver al original» devuelve el texto de fábrica y lo guardado vuelve a seguirlo", async () => {
    const nav = await abrir()
    fireEvent.click(within(nav).getByRole("button", { name: "Cumpleaños" }))
    const editor = screen.getByRole("region", { name: "Plantilla: Cumpleaños" })
    expect(within(editor).getByRole("button", { name: "Guardar" })).toBeDisabled()
    expect(within(editor).getByRole("button", { name: /Volver al original/ })).toBeDisabled()
    fireEvent.change(within(editor).getByRole("textbox"), { target: { value: "¡Feliz cumple, {nombre}! De {optica}." } })
    expect(within(nav).getByRole("button", { name: /Cumpleaños/ })).toHaveTextContent("Sin guardar")
    fireEvent.click(within(editor).getByRole("button", { name: "Guardar" }))
    await waitFor(() => expect(base.rpc).toHaveBeenCalledWith("guardar_plantilla_crm", { p_motivo: "cumpleanos", p_texto: "¡Feliz cumple, {nombre}! De {optica}." }))
    await waitFor(() => expect(aviso).toHaveBeenCalledWith("Plantilla «Cumpleaños» guardada."))
    fireEvent.click(within(editor).getByRole("button", { name: /Volver al original/ }))
    expect(within(editor).getByRole("textbox").value).toMatch(/^¡Feliz cumpleaños, \{nombre\}!/)
    fireEvent.click(within(editor).getByRole("button", { name: "Guardar" }))
    await waitFor(() => expect(base.rpc).toHaveBeenCalledWith("guardar_plantilla_crm", { p_motivo: "cumpleanos", p_texto: "" }))
  })

  it("lo escrito y sin guardar se conserva al cambiar de motivo, y el motivo dice que está sin guardar", async () => {
    const nav = await abrir()
    fireEvent.click(within(nav).getByRole("button", { name: "Medidas pedidas" }))
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Estas son tus medidas:\n{medidas}" } })
    fireEvent.click(within(nav).getByRole("button", { name: "Control vencido" }))
    expect(screen.getByRole("textbox").value).toContain("control visual")
    fireEvent.click(within(nav).getByRole("button", { name: /Medidas pedidas/ }))
    expect(screen.getByRole("textbox").value).toBe("Estas son tus medidas:\n{medidas}")
  })

  it("un mensaje muy corto no se puede guardar, y quien no edita el CRM solo lo lee", async () => {
    const nav = await abrir()
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Hola" } })
    expect(screen.getByRole("button", { name: "Guardar" })).toBeDisabled()
    cleanup()
    montar({ usuario: soloVer })
    fireEvent.click(await screen.findByRole("tab", { name: /Plantillas/ }))
    expect(await screen.findByText(/Solo quien tiene permiso de editar el CRM puede cambiar las plantillas/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Guardar" })).toBeNull()
    expect(nav).toBeTruthy()
  })
})

describe("CRM: datos rápidos de arriba", () => {
  it("son cinco, cada uno con su dato, y abren la misma lista que cuenta", async () => {
    montar({ consultas: [1, 2, 3].map((k) => ({ id: `k${k}`, pacienteId: "p4", fecha: dia(-k) })) })
    const franja = await screen.findByRole("list", { name: "Datos rápidos del CRM" })
    const datos = within(franja).getAllByRole("button")
    expect(datos).toHaveLength(5)
    for (const t of ["Próximo cumpleaños", "Cliente más fiel", "Más referidos", "Controles vencidos", "Contactados este mes"]) expect(within(franja).getByText(t)).toBeInTheDocument()
    expect(within(franja).getByText("Cliente más fiel").closest("button")).toHaveTextContent("Dani Al Día")
    fireEvent.click(within(franja).getByText("Controles vencidos").closest("button"))
    expect(screen.getByRole("group", { name: "Filtrar por motivo" })).toBeInTheDocument() // Para contactar, filtrado por control vencido
    fireEvent.click(within(franja).getByText("Contactados este mes").closest("button"))
    expect(tab("Seguimiento")).toHaveAttribute("aria-selected", "true")
    fireEvent.click(within(franja).getByText("Cliente más fiel").closest("button"))
    expect(tab("Fidelización")).toHaveAttribute("aria-selected", "true")
  })

  it("el próximo cumpleaños abre la lista de los que vienen", async () => {
    montar()
    const franja = await screen.findByRole("list", { name: "Datos rápidos del CRM" })
    fireEvent.click(within(franja).getByText("Próximo cumpleaños").closest("button"))
    const v = await screen.findByRole("dialog", { name: "Próximos cumpleaños" })
    expect(within(v).getAllByRole("listitem").length).toBeGreaterThan(0)
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
    await enPanel("Dani Al Día")
    expect(screen.queryByRole("button", { name: /Contactar|WhatsApp/ })).not.toBeInTheDocument()
  })
})
