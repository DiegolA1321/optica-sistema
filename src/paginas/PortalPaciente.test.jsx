import React from "react"
import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react"
import PortalPaciente from "./PortalPaciente"

// Lo que el portal pide a la base (compras, lentes y control): cada prueba lo fija a su gusto.
const datos = vi.hoisted(() => ({
  misCompras: vi.fn(async () => ({ compras: [], error: null })),
  misOrdenes: vi.fn(async () => ({ ordenes: [], disponible: true })),
  miControl: vi.fn(async () => null),
}))
vi.mock("../utilidades/facturaElectronicaApi", () => ({ misCompras: datos.misCompras, urlDeDescargaPaciente: vi.fn() }))
vi.mock("../utilidades/portalDatos", () => ({ misOrdenes: datos.misOrdenes, miControl: datos.miControl }))

const usuario = { id: "p1", nombre: "Rosa Bravo", cedula: "0900000011", rol: "paciente", token: "tok", opticaId: "o1" }
const consulta = (extra = {}) => ({
  id: "c1", fecha: "2026-10-01", pacienteId: "p1", paciente: "Rosa Bravo", diagnostico: "Miopía", indicaciones: "Uso permanente", lenteRecomendado: "Monofocal",
  profesionalNombre: "Dra. Prueba", profesionalRegistro: "REG-1", usaLentes: true,
  od: { esfera: "-1.50", cilindro: "-0.50", eje: "90", avSc: "20/40", avCc: "20/20" },
  oi: { esfera: "-1.25", cilindro: "-0.75", eje: "80", avSc: "20/50", avCc: "20/25" },
  medidas: { adicion: "+1.00", dp: "62", alt: "18" },
  ...extra,
})
const cita = (extra = {}) => ({ id: "ci1", pacienteId: "p1", paciente: "Rosa Bravo", cedula: "0900000011", fecha: "2099-03-10", hora: "03:00 PM", motivo: "Consulta General", estado: "Pendiente", ...extra })
const base = { usuario, citas: [], setCitas: () => {}, consultas: [consulta()], disponibilidad: null, opticaId: "o1", opticaPublica: { nombre: "Óptica Prueba" }, parametrizacion: {}, motivosConsulta: ["Consulta General", "Examen de Control"], onCerrarSesion: () => {} }
const irA = (nombre) => fireEvent.click(screen.getAllByRole("button", { name: new RegExp("^" + nombre) })[0])
const resumen = async () => { await screen.findByRole("heading", { name: "Resumen" }); await waitFor(() => expect(screen.queryByLabelText("Cargando tu resumen")).not.toBeInTheDocument()) }

beforeEach(() => {
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))
  datos.misCompras.mockResolvedValue({ compras: [], error: null })
  datos.misOrdenes.mockResolvedValue({ ordenes: [], disponible: true })
  datos.miControl.mockResolvedValue(null)
})

describe("Portal del paciente — Resumen", () => {
  it("saluda una sola vez, en la cabecera", async () => {
    render(<PortalPaciente {...base} citas={[cita()]} />)
    await resumen()
    expect(screen.getAllByText(/Rosa/).length).toBeGreaterThan(0)
    expect(document.body.textContent).not.toMatch(/¡Hola, Rosa!/)
    expect(screen.getAllByText(/(Buenos días|Buenas tardes|Buenas noches)/)).toHaveLength(1)
  })

  it("con una próxima cita muestra fecha, hora, motivo y estado, y no vuelve a decir «Próxima cita» ni «Total de citas»", async () => {
    render(<PortalPaciente {...base} citas={[cita()]} />)
    await resumen()
    const bloque = screen.getByRole("region", { name: "Lo próximo" })
    expect(bloque).toHaveTextContent("Martes, 10 de marzo de 2099")
    expect(bloque).toHaveTextContent("03:00 PM")
    expect(bloque).toHaveTextContent("Consulta General")
    expect(within(bloque).getByRole("status")).toHaveTextContent("Pendiente")
    expect(screen.queryByText(/Total de citas/)).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Pedir cita|Pedir una cita|Agendar ahora/ })).not.toBeInTheDocument()
  })

  it("sin cita, pero con historial, un solo botón: «Agendar cita»", async () => {
    render(<PortalPaciente {...base} />)
    await resumen()
    expect(screen.getByRole("region", { name: "Lo próximo" })).toHaveTextContent("No tienes ninguna cita agendada")
    expect(screen.getAllByRole("button", { name: "Agendar cita" })).toHaveLength(1)
  })

  it("un paciente nuevo ve una bienvenida con un solo botón para agendar su primera cita", async () => {
    render(<PortalPaciente {...base} consultas={[]} />)
    await resumen()
    expect(screen.getByRole("heading", { name: /Te damos la bienvenida a Óptica Prueba/ })).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: /Agendar/ })).toHaveLength(1)
    expect(screen.queryByRole("region", { name: "Mis lentes" })).not.toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Mi saldo" })).not.toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Mi próximo control" })).not.toBeInTheDocument()
  })

  it("mientras llegan los datos muestra esqueletos, no la bienvenida de un paciente nuevo", () => {
    render(<PortalPaciente {...base} consultas={[]} cargandoDatos />)
    expect(screen.getByLabelText("Cargando tu resumen")).toBeInTheDocument()
    expect(screen.queryByText(/Te damos la bienvenida/)).not.toBeInTheDocument()
  })

  it("«Mis lentes» dice el estado de la orden con la fecha estimada", async () => {
    datos.misOrdenes.mockResolvedValue({ ordenes: [{ id: "o1", numero: 3, estado: "enviada", fechaPrometida: "2099-01-20", tipoLente: "progresivo", montura: "Ray-Ban", facturaId: "f1", listaEl: null, entregadaEl: null }], disponible: true })
    render(<PortalPaciente {...base} />)
    const bloque = await screen.findByRole("region", { name: "Mis lentes" })
    expect(bloque).toHaveTextContent("En el laboratorio")
    expect(bloque).toHaveTextContent("Fecha estimada: 20 ene 2099.")
  })

  it("cuando los lentes están listos lo dice con claridad", async () => {
    datos.misOrdenes.mockResolvedValue({ ordenes: [{ id: "o1", numero: 3, estado: "lista", fechaPrometida: "2026-10-01", tipoLente: "monofocal", montura: "", facturaId: "f1", listaEl: "2026-10-16T14:00:00Z", entregadaEl: null }], disponible: true })
    render(<PortalPaciente {...base} />)
    expect(await screen.findByRole("region", { name: "Mis lentes" })).toHaveTextContent("Listos para retirar")
  })

  it("las órdenes ya entregadas no aparecen en el Resumen", async () => {
    datos.misOrdenes.mockResolvedValue({ ordenes: [{ id: "o1", numero: 3, estado: "entregada", fechaPrometida: "2026-09-01", tipoLente: "monofocal", montura: "", facturaId: "f1", listaEl: null, entregadaEl: "2026-09-03T14:00:00Z" }], disponible: true })
    render(<PortalPaciente {...base} />)
    await resumen()
    expect(screen.queryByRole("region", { name: "Mis lentes" })).not.toBeInTheDocument()
  })

  it("«Mi próximo control» muestra la fecha y, sin cita, el botón para agendarlo", async () => {
    datos.miControl.mockResolvedValue({ ultima_consulta: "2099-01-01", proximo_control_dias: 90, de_alta: false })
    render(<PortalPaciente {...base} />)
    const bloque = await screen.findByRole("region", { name: "Mi próximo control" })
    expect(bloque).toHaveTextContent("1 abr 2099")
    expect(within(bloque).getByRole("button", { name: "Agendar mi control" })).toBeInTheDocument()
  })

  it("con una cita ya agendada, el control no ofrece agendar otra", async () => {
    datos.miControl.mockResolvedValue({ ultima_consulta: "2099-01-01", proximo_control_dias: 90, de_alta: false })
    render(<PortalPaciente {...base} citas={[cita()]} />)
    const bloque = await screen.findByRole("region", { name: "Mi próximo control" })
    expect(within(bloque).queryByRole("button")).not.toBeInTheDocument()
  })

  it("«Mi saldo» muestra cuánto debe y lleva a Mis compras", async () => {
    datos.misCompras.mockResolvedValue({ compras: [{ id: "f1", numero: 6, fecha: "2026-10-04T17:00:00Z", total: 60, estado: "pendiente_pago", abonado: 20, saldo: 40, lineas: [], factura_electronica: null }], error: null })
    render(<PortalPaciente {...base} />)
    const bloque = await screen.findByRole("region", { name: "Mi saldo" })
    expect(bloque).toHaveTextContent("$40.00")
    fireEvent.click(within(bloque).getByRole("button", { name: /Ver mis compras/ }))
    expect(await screen.findByRole("list", { name: "Mis compras" })).toHaveTextContent("Debes $40.00")
  })

  it("sin deuda no hay bloque de saldo", async () => {
    render(<PortalPaciente {...base} />)
    await resumen()
    expect(screen.queryByRole("region", { name: "Mi saldo" })).not.toBeInTheDocument()
  })

  it("«La óptica» muestra dirección, horario, teléfono y WhatsApp, solo si están cargados", async () => {
    const disponibilidad = { horarioSemanal: { lunes: { manana: { activo: true, inicio: "09:00", fin: "13:00" } } } }
    const { unmount } = render(<PortalPaciente {...base} disponibilidad={disponibilidad} parametrizacion={{ opticaDireccion: "Av. 9 de Octubre 123", opticaTelefono: "0991234567" }} />)
    const bloque = await screen.findByRole("region", { name: "La óptica" })
    expect(bloque).toHaveTextContent("Av. 9 de Octubre 123")
    expect(bloque).not.toHaveTextContent("Lunes · ") // el horario completo, solo al expandir
    fireEvent.click(within(bloque).getByRole("button", { name: /Ver el horario completo/ }))
    expect(bloque).toHaveTextContent("Lunes · ")
    expect(within(bloque).getByRole("link", { name: /Llamar/ })).toHaveAttribute("href", "tel:+593991234567")
    expect(within(bloque).getByRole("link", { name: /WhatsApp/ }).getAttribute("href")).toContain("phone=593991234567")
    expect(within(bloque).getByRole("link", { name: /Cómo llegar/ }).getAttribute("href")).toContain("google.com/maps")
    unmount()
    render(<PortalPaciente {...base} />)
    await resumen()
    expect(screen.queryByRole("region", { name: "La óptica" })).not.toBeInTheDocument()
  })
})

describe("Portal del paciente — agendar", () => {
  it("la ventana de agendar no pide el paciente y el motivo se elige con el selector del sistema (no la lista nativa)", async () => {
    render(<PortalPaciente {...base} />)
    await resumen()
    fireEvent.click(screen.getByRole("button", { name: "Agendar cita" }))
    const ventana = await screen.findByRole("dialog", { name: "Agendar cita" })
    expect(within(ventana).queryByText("Paciente")).not.toBeInTheDocument()
    expect(ventana.querySelector("select")).toBeNull()
    const selector = within(ventana).getByRole("combobox", { name: /Motivo de la cita/ })
    expect(selector).toHaveTextContent("Consulta General")
    fireEvent.click(selector)
    fireEvent.click(within(ventana).getByRole("option", { name: "Examen de Control" }))
    expect(within(ventana).getByRole("combobox", { name: /Motivo de la cita/ })).toHaveTextContent("Examen de Control")
  })

  it("«Agendar mi control» abre la ventana con el motivo de control ya elegido", async () => {
    datos.miControl.mockResolvedValue({ ultima_consulta: "2099-01-01", proximo_control_dias: 90, de_alta: false })
    render(<PortalPaciente {...base} />)
    fireEvent.click(await screen.findByRole("button", { name: "Agendar mi control" }))
    const ventana = await screen.findByRole("dialog", { name: "Agendar cita" })
    expect(within(ventana).getByRole("combobox", { name: /Motivo de la cita/ })).toHaveTextContent("Examen de Control")
  })
})

describe("Portal del paciente — Mis citas", () => {
  const citas = [
    cita({ id: "a", fecha: "2099-03-10", hora: "03:00 PM" }),
    cita({ id: "b", fecha: "2026-09-01", hora: "09:00 AM", estado: "Atendida" }),
    cita({ id: "c", fecha: "2026-08-01", hora: "09:00 AM", estado: "No Asistió" }),
    cita({ id: "d", fecha: "2026-07-01", hora: "09:00 AM", estado: "Cancelada" }),
    cita({ id: "e", fecha: "2099-02-01", hora: "10:00 AM", estado: "En Espera" }),
  ]
  it("separa las próximas del historial, con los estados y colores del sistema", async () => {
    render(<PortalPaciente {...base} citas={citas} />)
    await resumen()
    irA("Mis citas")
    const destacada = screen.getByRole("region", { name: "Lo próximo" })
    expect(destacada).toHaveTextContent("Domingo, 1 de febrero de 2099") // la próxima, en grande
    expect(within(destacada).getByRole("status", { name: "Estado: En espera" }).className).toMatch(/violet/)
    const otras = screen.getByRole("region", { name: "Otras citas próximas" })
    expect(within(otras).getAllByRole("listitem")).toHaveLength(1)
    expect(within(otras).getByRole("status", { name: "Estado: Pendiente" }).className).toMatch(/amber/)
    const historial = screen.getByRole("region", { name: "Historial" })
    expect(within(historial).getByRole("status", { name: "Estado: Atendida" }).className).toMatch(/emerald/)
    expect(within(historial).getByRole("status", { name: "Estado: No asistió" }).className).toMatch(/red/)
    expect(within(historial).getByRole("status", { name: "Estado: Cancelada" }).className).toMatch(/slate/)
  })
  it("Reagendar y Cancelar aparecen solo en la cita pendiente y cuando la política lo permite", async () => {
    const soloPendiente = [citas[0], citas[1]]
    const { unmount } = render(<PortalPaciente {...base} citas={soloPendiente} parametrizacion={{ permitirReagendarPaciente: true, horasAntesReagendar: 2 }} />)
    await resumen()
    irA("Mis citas")
    const destacada = screen.getByRole("region", { name: "Lo próximo" })
    expect(within(destacada).getAllByRole("button", { name: "Reagendar" })).toHaveLength(1)
    expect(within(destacada).getAllByRole("button", { name: /Cancelar cita/ })).toHaveLength(1)
    unmount()
    render(<PortalPaciente {...base} citas={soloPendiente} parametrizacion={{ permitirReagendarPaciente: false }} />)
    await resumen()
    irA("Mis citas")
    expect(screen.queryByRole("button", { name: "Reagendar" })).not.toBeInTheDocument()
  })
  it("sin citas próximas, la tarjeta destacada invita a agendar con un solo botón", async () => {
    render(<PortalPaciente {...base} />)
    await resumen()
    irA("Mis citas")
    expect(screen.getByRole("region", { name: "Lo próximo" })).toHaveTextContent("No tienes ninguna cita agendada")
    expect(screen.getAllByRole("button", { name: "Agendar cita" })).toHaveLength(1)
  })
})

describe("Portal del paciente — receta", () => {
  it("dice «Ojo derecho» y «Ojo izquierdo» (nunca OD ni OI), con cada valor por separado", async () => {
    render(<PortalPaciente {...base} parametrizacion={{ mostrarMedidasPaciente: false }} />)
    await resumen()
    irA("Mi receta")
    expect(screen.getByRole("heading", { name: "Ojo derecho" })).toBeInTheDocument()
    expect(screen.getByRole("heading", { name: "Ojo izquierdo" })).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/\bOD\b|\bOI\b/)
    const derecho = screen.getByRole("heading", { name: "Ojo derecho" }).parentElement
    expect(derecho).toHaveTextContent("-1.50")
    expect(derecho).toHaveTextContent("-0.50")
    expect(derecho).toHaveTextContent("90°")
    expect(derecho).toHaveTextContent("20/20")
    expect(screen.getByText("+1.00")).toBeInTheDocument()
  })

  it("cada valor tiene su explicación al pasar el cursor y al tocar el botón", async () => {
    render(<PortalPaciente {...base} />)
    await resumen()
    irA("Mi receta")
    const derecho = screen.getByRole("heading", { name: "Ojo derecho" }).parentElement
    const boton = within(derecho).getByRole("button", { name: "¿Qué es esfera?" })
    expect(boton).toHaveAttribute("title", expect.stringMatching(/Cuánto necesita corregirse el ojo/))
    expect(within(derecho).queryByRole("note")).not.toBeInTheDocument()
    fireEvent.click(boton)
    expect(within(derecho).getByRole("note")).toHaveTextContent(/Cuánto necesita corregirse el ojo/)
    fireEvent.click(boton)
    expect(within(derecho).queryByRole("note")).not.toBeInTheDocument()
  })

  it("ofrece «Descargar receta» (PDF) y ya no «Imprimir»", async () => {
    render(<PortalPaciente {...base} />)
    await resumen()
    irA("Mi receta")
    expect(screen.getByRole("button", { name: /Descargar receta/ })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Imprimir/ })).not.toBeInTheDocument()
  })

  it("con la política apagada muestra la receta completa y no la distancia pupilar ni la altura", async () => {
    render(<PortalPaciente {...base} parametrizacion={{ mostrarMedidasPaciente: false }} />)
    await resumen()
    irA("Mi receta")
    expect(screen.queryByText("Distancia pupilar")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Solicitar distancia pupilar y medidas de montaje/ })).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/costo adicional/i)
  })

  it("con la política encendida muestra también la distancia pupilar y la altura, sin botón de solicitud", async () => {
    render(<PortalPaciente {...base} parametrizacion={{ mostrarMedidasPaciente: true }} />)
    await resumen()
    irA("Mi receta")
    expect(screen.getByText("Distancia pupilar")).toBeInTheDocument()
    expect(screen.getByText("62")).toBeInTheDocument()
    expect(screen.getByText("Altura")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Solicitar distancia pupilar/ })).not.toBeInTheDocument()
  })

  it("si el servidor no manda medidas (sin adición, sin distancia pupilar) no hay errores ni huecos", async () => {
    render(<PortalPaciente {...base} consultas={[consulta({ medidas: undefined })]} parametrizacion={{ mostrarMedidasPaciente: true }} />)
    await resumen()
    irA("Mi receta")
    expect(screen.getAllByText("-1.50").length).toBeGreaterThan(0)
    expect(screen.queryByText("Adición")).not.toBeInTheDocument()
    expect(screen.queryByText("Distancia pupilar")).not.toBeInTheDocument()
  })

  it("las recetas anteriores muestran su graduación por ojo", async () => {
    const vieja = consulta({ id: "c0", fecha: "2025-05-02", od: { esfera: "-1.00" }, oi: { esfera: "-0.75" } })
    render(<PortalPaciente {...base} consultas={[consulta(), vieja]} />)
    await resumen()
    irA("Mi receta")
    const lista = screen.getByRole("region", { name: "Tus recetas anteriores" })
    expect(within(lista).getByText(/Ojo derecho -1\.00/)).toBeInTheDocument()
    expect(within(lista).getByText(/Ojo izquierdo -0\.75/)).toBeInTheDocument()
  })

  it("sin receta dice qué pasa y ofrece «Agendar cita»", async () => {
    render(<PortalPaciente {...base} consultas={[]} />)
    await resumen()
    irA("Mi receta")
    expect(screen.getByText("Todavía no tienes una receta")).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Agendar cita" })).toHaveLength(1)
  })
})

describe("Portal del paciente — Mis datos", () => {
  it("ofrece 'Descargar mis datos' junto a la eliminación de la cuenta", async () => {
    render(<PortalPaciente {...base} />)
    await resumen()
    irA("Mis datos")
    expect(screen.getByRole("button", { name: /Descargar mis datos/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Solicitar eliminación/ })).toBeInTheDocument()
  })
})

describe("Portal del paciente — menú", () => {
  it("tiene las cinco secciones en el menú de laptop y en la barra de abajo del celular", async () => {
    render(<PortalPaciente {...base} />)
    await resumen()
    const menus = screen.getAllByRole("navigation", { name: "Menú del portal" })
    expect(menus).toHaveLength(2)
    for (const m of menus) for (const n of ["Resumen", "Mis citas", "Mi receta", "Mis compras", "Mis datos"]) expect(within(m).getByRole("button", { name: n })).toBeInTheDocument()
  })
})

describe("Portal del paciente — diseño nuevo", () => {
  it("«Mis lentes» muestra la línea de pasos con el paso actual marcado y la fecha estimada", async () => {
    datos.misOrdenes.mockResolvedValue({ ordenes: [{ id: "o1", numero: 3, estado: "enviada", fechaPrometida: "2099-01-20", tipoLente: "progresivo", montura: "Ray-Ban", facturaId: "f1", listaEl: null, entregadaEl: null }], disponibilidad: true })
    render(<PortalPaciente {...base} />)
    const pasos = await screen.findByRole("list", { name: "Seguimiento de tus lentes" })
    const items = within(pasos).getAllByRole("listitem")
    expect(items.map((i) => i.textContent.replace(/^\d+/, ""))).toEqual(["Pedido", "En el laboratorio", "Listos para retirar", "Entregados"])
    expect(items[1]).toHaveAttribute("aria-current", "step")
    expect(items[0]).not.toHaveAttribute("aria-current")
    expect(screen.getByRole("region", { name: "Mis lentes" })).toHaveTextContent("Fecha estimada: 20 ene 2099.")
  })

  it("el botón de la cuenta muestra el nombre del paciente, no solo una inicial", async () => {
    render(<PortalPaciente {...base} />)
    await resumen()
    expect(screen.getByRole("button", { name: "Mi cuenta" })).toHaveTextContent("Rosa Bravo")
  })

  it("con dos recetas cuenta en palabras simples cómo cambió la graduación, con el mismo veredicto que el personal", async () => {
    const anterior = consulta({ id: "c0", fecha: "2026-04-01", od: { esfera: "-1.00", cilindro: "-0.50" }, oi: { esfera: "-1.00", cilindro: "-0.75" } })
    render(<PortalPaciente {...base} consultas={[consulta(), anterior]} />)
    await resumen()
    irA("Mi receta")
    const cambio = screen.getByRole("region", { name: "Cómo cambió tu graduación" })
    expect(cambio).toHaveTextContent("Tu graduación aumentó un poco desde tu examen del 1 abr 2026")
    expect(cambio).toHaveTextContent("Ojo derecho: aumentó 0,50 D")
    expect(screen.getByRole("region", { name: "Tus recetas anteriores" })).toHaveTextContent("1 abr 2026")
  })

  it("con una sola receta no hay bloque de cambio ni de recetas anteriores", async () => {
    render(<PortalPaciente {...base} />)
    await resumen()
    irA("Mi receta")
    expect(screen.queryByRole("region", { name: "Cómo cambió tu graduación" })).not.toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Tus recetas anteriores" })).not.toBeInTheDocument()
  })

  it("el portal se viste con el color de la óptica", async () => {
    render(<PortalPaciente {...base} opticaPublica={{ nombre: "Óptica Prueba", marca: { colorAcento: "#7C3AED" } }} />)
    await resumen()
    expect(document.documentElement.style.getPropertyValue("--portal-acento")).toBe("#7C3AED")
  })
})
