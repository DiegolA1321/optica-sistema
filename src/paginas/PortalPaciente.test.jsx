import React from "react"
import { describe, it, expect, beforeEach, vi } from "vitest"
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react"
import PortalPaciente from "./PortalPaciente"

// Lo que el portal pide a la base (compras, lentes, control y detalle de las citas): cada prueba lo fija a su gusto.
const datos = vi.hoisted(() => ({
  misCompras: vi.fn(async () => ({ compras: [], error: null })),
  misOrdenes: vi.fn(async () => ({ ordenes: [], disponible: true })),
  miControl: vi.fn(async () => null),
  misCitasDetalle: vi.fn(async () => ({ disponible: false, porCita: {} })),
  confirmarAsistencia: vi.fn(async () => ({ ok: true })),
  calificarAtencion: vi.fn(async () => ({ ok: true })),
}))
vi.mock("../utilidades/facturaElectronicaApi", () => ({ misCompras: datos.misCompras, urlDeDescargaPaciente: vi.fn() }))
vi.mock("../utilidades/portalDatos", () => ({ misOrdenes: datos.misOrdenes, miControl: datos.miControl, misCitasDetalle: datos.misCitasDetalle, confirmarAsistencia: datos.confirmarAsistencia, calificarAtencion: datos.calificarAtencion }))

const usuario = { id: "p1", nombre: "Rosa Bravo", cedula: "0900000011", rol: "paciente", token: "tok", opticaId: "o1" }
const consulta = (extra = {}) => ({
  id: "c1", fecha: "2026-10-01", pacienteId: "p1", paciente: "Rosa Bravo", diagnostico: "Miopía", indicaciones: "Haz una pausa cada 20 minutos.", lenteRecomendado: "Monofocal",
  profesionalNombre: "Dra. Prueba", profesionalRegistro: "REG-1", usaLentes: true,
  od: { esfera: "-1.50", cilindro: "-0.50", eje: "90", avSc: "20/40", avCc: "20/20" },
  oi: { esfera: "-1.25", cilindro: "-0.75", eje: "80", avSc: "20/50", avCc: "20/25" },
  medidas: { adicion: "+1.00", dp: "62", alt: "18" },
  ...extra,
})
const cita = (extra = {}) => ({ id: "ci1", pacienteId: "p1", paciente: "Rosa Bravo", cedula: "0900000011", fecha: "2099-03-10", hora: "03:00 PM", motivo: "Consulta General", estado: "Pendiente", ...extra })
const base = { usuario, citas: [], setCitas: () => {}, consultas: [consulta()], disponibilidad: null, opticaId: "o1", opticaPublica: { nombre: "Óptica Prueba" }, parametrizacion: {}, motivosConsulta: ["Consulta General", "Examen de Control", "Garantía / Ajuste"], onCerrarSesion: () => {} }
const irA = (nombre) => fireEvent.click(screen.getAllByRole("button", { name: new RegExp("^" + nombre) })[0])
const resumen = async () => { await screen.findByRole("heading", { name: "Resumen" }); await waitFor(() => expect(screen.queryByLabelText("Cargando tu resumen")).not.toBeInTheDocument()) }
const compraConSaldo = { id: "f1", numero: 21, fecha: "2026-10-08T16:00:00Z", total: 265, estado: "pendiente_pago", abonado: 120, saldo: 145, lineas: [{ descripcion: "Montura Ray-Ban", cantidad: 1, subtotal: 85 }], factura_electronica: null }
const orden = (extra = {}) => ({ id: "o1", numero: 3, estado: "enviada", fechaPrometida: "2099-01-20", tipoLente: "progresivo", montura: "Ray-Ban", facturaId: "f1", creadaEn: "2026-10-09T15:00:00Z", listaEl: null, entregadaEl: null, ...extra })

beforeEach(() => {
  window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))
  datos.misCompras.mockResolvedValue({ compras: [], error: null })
  datos.misOrdenes.mockResolvedValue({ ordenes: [], disponible: true })
  datos.miControl.mockResolvedValue(null)
  datos.misCitasDetalle.mockResolvedValue({ disponible: false, porCita: {} })
  datos.confirmarAsistencia.mockClear()
  datos.calificarAtencion.mockClear()
  document.documentElement.removeAttribute("style")
})

describe("Cabecera", () => {
  it("saluda una sola vez y el botón de la cuenta lleva el nombre del paciente, no solo una inicial", async () => {
    render(<PortalPaciente {...base} citas={[cita()]} />)
    await resumen()
    expect(screen.getAllByText(/(Buenos días|Buenas tardes|Buenas noches)/)).toHaveLength(1)
    expect(screen.getByRole("button", { name: "Mi cuenta" })).toHaveTextContent("Rosa Bravo")
    expect(document.body.textContent).not.toMatch(/¡Hola, Rosa!/)
  })
  it("el portal se viste con el color de la óptica", async () => {
    render(<PortalPaciente {...base} opticaPublica={{ nombre: "Óptica Prueba", marca: { colorAcento: "#7C3AED" } }} />)
    await resumen()
    expect(document.documentElement.style.getPropertyValue("--portal-acento")).toBe("#7C3AED")
  })
  it("la campanita avisa de los lentes listos y de la cita de mañana, y cada aviso lleva a su pantalla", async () => {
    const manana = new Date(); manana.setDate(manana.getDate() + 1)
    const fecha = `${manana.getFullYear()}-${String(manana.getMonth() + 1).padStart(2, "0")}-${String(manana.getDate()).padStart(2, "0")}`
    datos.misOrdenes.mockResolvedValue({ ordenes: [orden({ estado: "lista", listaEl: "2026-10-16T14:00:00Z" })], disponible: true })
    datos.misCompras.mockResolvedValue({ compras: [compraConSaldo], error: null })
    render(<PortalPaciente {...base} citas={[cita({ fecha })]} />)
    const campana = await screen.findByRole("button", { name: /Avisos: tienes 2/ })
    fireEvent.click(campana)
    const menu = screen.getByRole("menu", { name: "Avisos" })
    expect(menu).toHaveTextContent("Tus lentes están listos para retirar")
    expect(menu).toHaveTextContent("Mañana tienes cita a las 03:00 PM")
    fireEvent.click(within(menu).getByRole("menuitem", { name: /lentes están listos/ }))
    expect(await screen.findByRole("heading", { name: "Mis compras" })).toBeInTheDocument()
  })
  it("sin nada que avisar, la campanita lo dice", async () => {
    render(<PortalPaciente {...base} />)
    await resumen()
    fireEvent.click(screen.getByRole("button", { name: /Avisos: no tienes avisos/ }))
    expect(screen.getByRole("menu", { name: "Avisos" })).toHaveTextContent("No tienes avisos por ahora")
  })
})

describe("Resumen", () => {
  it("la próxima cita va en grande: día, hora, motivo y estado; sin «Total de citas»", async () => {
    render(<PortalPaciente {...base} citas={[cita()]} />)
    await resumen()
    const boleto = screen.getByRole("region", { name: "Tu próxima cita" })
    expect(boleto).toHaveTextContent("10")
    expect(boleto).toHaveTextContent("marzo")
    expect(boleto).toHaveTextContent("03:00 PM")
    expect(boleto).toHaveTextContent("Consulta General")
    expect(within(boleto).getByRole("status")).toHaveTextContent("Pendiente")
    expect(within(boleto).getByRole("button", { name: /Agregar a mi calendario/ })).toBeInTheDocument()
    expect(screen.queryByText(/Total de citas/)).not.toBeInTheDocument()
  })
  it("sin cita, la tarjeta invita a agendar con un solo botón", async () => {
    render(<PortalPaciente {...base} />)
    await resumen()
    expect(screen.getByRole("region", { name: "Tu próxima cita" })).toHaveTextContent("Aún no tienes una cita agendada")
    expect(screen.getAllByRole("button", { name: "Agendar cita" })).toHaveLength(1)
  })
  it("un paciente nuevo ve la bienvenida con un solo botón y tres pasos ilustrados", async () => {
    render(<PortalPaciente {...base} consultas={[]} />)
    await resumen()
    expect(screen.getByRole("region", { name: "Bienvenida" })).toHaveTextContent("Te damos la bienvenida a Óptica Prueba")
    expect(screen.getAllByRole("button", { name: /Agendar/ })).toHaveLength(1)
    const pasos = within(screen.getByRole("list", { name: "Cómo funciona" })).getAllByRole("listitem")
    expect(pasos.map((p) => p.textContent)).toEqual([expect.stringContaining("Agenda tu cita"), expect.stringContaining("Te atendemos"), expect.stringContaining("Sigue tus lentes aquí")])
    expect(screen.queryByRole("region", { name: "Mis lentes" })).not.toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Mi saldo" })).not.toBeInTheDocument()
  })
  it("mientras llegan los datos muestra esqueletos, no la bienvenida de un paciente nuevo", () => {
    render(<PortalPaciente {...base} consultas={[]} cargandoDatos />)
    expect(screen.getByLabelText("Cargando tu resumen")).toBeInTheDocument()
    expect(screen.queryByText(/Te damos la bienvenida/)).not.toBeInTheDocument()
  })
  it("«Mis lentes» es una línea de pasos vertical con la fecha de cada paso y la estimada", async () => {
    datos.misOrdenes.mockResolvedValue({ ordenes: [orden()], disponible: true })
    datos.misCompras.mockResolvedValue({ compras: [compraConSaldo], error: null })
    render(<PortalPaciente {...base} />)
    const tarjeta = await screen.findByRole("region", { name: "Mis lentes" })
    const items = within(within(tarjeta).getByRole("list", { name: "Seguimiento de tus lentes" })).getAllByRole("listitem")
    expect(items.map((i) => i.textContent.replace(/^\d+/, "").replace(/\s+/g, " ").trim())).toEqual(["Pedido 8 oct 2026", "En el laboratorio Fecha estimada: 20 ene 2099", "Listos para retirar", "Entregados"])
    expect(items[1]).toHaveAttribute("aria-current", "step")
  })
  it("cuando los lentes están listos dice «Ya puedes retirarlos»", async () => {
    datos.misOrdenes.mockResolvedValue({ ordenes: [orden({ estado: "lista", listaEl: "2026-10-16T14:00:00Z" })], disponible: true })
    render(<PortalPaciente {...base} />)
    expect(await screen.findByRole("region", { name: "Mis lentes" })).toHaveTextContent("Ya puedes retirarlos")
  })
  it("las órdenes ya entregadas no aparecen en el Resumen", async () => {
    datos.misOrdenes.mockResolvedValue({ ordenes: [orden({ estado: "entregada", entregadaEl: "2026-09-03T14:00:00Z" })], disponible: true })
    render(<PortalPaciente {...base} />)
    await resumen()
    expect(screen.queryByRole("region", { name: "Mis lentes" })).not.toBeInTheDocument()
  })
  it("«Mi próximo control» muestra la fecha, cuánto falta y, sin cita, «Agendar control»", async () => {
    datos.miControl.mockResolvedValue({ ultima_consulta: "2099-01-01", proximo_control_dias: 90, de_alta: false })
    render(<PortalPaciente {...base} />)
    const tarjeta = await screen.findByRole("region", { name: "Mi próximo control" })
    expect(tarjeta).toHaveTextContent("1 abr 2099")
    expect(tarjeta).toHaveTextContent("Tu último examen fue el 1 ene 2099")
    expect(within(tarjeta).getByRole("button", { name: "Agendar control" })).toBeInTheDocument()
  })
  it("con una cita ya agendada, el control no ofrece agendar otra", async () => {
    datos.miControl.mockResolvedValue({ ultima_consulta: "2099-01-01", proximo_control_dias: 90, de_alta: false })
    render(<PortalPaciente {...base} citas={[cita()]} />)
    expect(within(await screen.findByRole("region", { name: "Mi próximo control" })).queryByRole("button")).not.toBeInTheDocument()
  })
  it("«Mi saldo» muestra cuánto debe, la barra de lo abonado y lleva a Mis compras", async () => {
    datos.misCompras.mockResolvedValue({ compras: [compraConSaldo], error: null })
    render(<PortalPaciente {...base} />)
    const tarjeta = await screen.findByRole("region", { name: "Mi saldo" })
    expect(tarjeta).toHaveTextContent("$145.00")
    expect(tarjeta).toHaveTextContent("Abonaste $120.00 de $265.00")
    expect(within(tarjeta).getByRole("img", { name: /45 por ciento/ })).toBeInTheDocument()
    fireEvent.click(within(tarjeta).getByRole("button", { name: /Ver mis compras/ }))
    expect(await screen.findByRole("list", { name: "Mis compras" })).toHaveTextContent("Debes $145.00")
  })
  it("sin deuda no hay tarjeta de saldo", async () => {
    render(<PortalPaciente {...base} />)
    await resumen()
    expect(screen.queryByRole("region", { name: "Mi saldo" })).not.toBeInTheDocument()
  })
  it("«La óptica» dice si está abierta, la dirección y los botones; el horario completo, al expandir", async () => {
    const dia = { manana: { activo: true, inicio: "00:00", fin: "23:59" } }
    const horarioSemanal = Object.fromEntries(["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"].map((d) => [d, dia]))
    render(<PortalPaciente {...base} disponibilidad={{ horarioSemanal }} parametrizacion={{ opticaDireccion: "Av. 9 de Octubre 123", opticaTelefono: "0991234567" }} />)
    const tarjeta = await screen.findByRole("region", { name: "La óptica" })
    expect(tarjeta).toHaveTextContent("Abierto hoy hasta las")
    expect(tarjeta).toHaveTextContent("Av. 9 de Octubre 123")
    expect(tarjeta).not.toHaveTextContent("Lunes a Domingo")
    fireEvent.click(within(tarjeta).getByRole("button", { name: /Ver el horario completo/ }))
    expect(tarjeta).toHaveTextContent("Lunes a Domingo")
    expect(within(tarjeta).getByRole("link", { name: /Llamar/ })).toHaveAttribute("href", "tel:+593991234567")
    expect(within(tarjeta).getByRole("link", { name: /WhatsApp/ }).getAttribute("href")).toContain("phone=593991234567")
    expect(within(tarjeta).getByRole("link", { name: /Cómo llegar/ }).getAttribute("href")).toContain("google.com/maps")
  })
  it("sin datos de la óptica no hay tarjeta de la óptica", async () => {
    render(<PortalPaciente {...base} />)
    await resumen()
    expect(screen.queryByRole("region", { name: "La óptica" })).not.toBeInTheDocument()
  })
  it("tu última receta en resumen y los accesos rápidos (descargar, facturas y ajuste o garantía)", async () => {
    datos.misCompras.mockResolvedValue({ compras: [compraConSaldo], error: null })
    render(<PortalPaciente {...base} />)
    const receta = await screen.findByRole("region", { name: "Tu última receta" })
    expect(receta).toHaveTextContent("-1.50 -0.50 x90")
    expect(receta).toHaveTextContent("Agudeza visual 20/20")
    const accesos = screen.getByRole("region", { name: "Accesos rápidos" })
    for (const t of ["Descargar mi receta", "Mis facturas", "Solicitar ajuste o garantía"]) expect(within(accesos).getByRole("button", { name: t })).toBeInTheDocument()
  })
  it("«Solicitar ajuste o garantía» abre «Agendar cita» con el motivo y la compra relacionada", async () => {
    datos.misCompras.mockResolvedValue({ compras: [compraConSaldo], error: null })
    render(<PortalPaciente {...base} />)
    fireEvent.click(await screen.findByRole("button", { name: "Solicitar ajuste o garantía" }))
    const ventana = await screen.findByRole("dialog", { name: "Agendar cita" })
    expect(within(ventana).getByRole("combobox", { name: /Motivo de la cita/ })).toHaveTextContent("Garantía / Ajuste")
    expect(ventana).toHaveTextContent("Ajuste o garantía de tu compra CV-0021")
  })
})

describe("Agendar cita", () => {
  it("no pide el paciente y el motivo se elige con el selector del sistema (no la lista nativa)", async () => {
    render(<PortalPaciente {...base} />)
    await resumen()
    fireEvent.click(screen.getByRole("button", { name: "Agendar cita" }))
    const ventana = await screen.findByRole("dialog", { name: "Agendar cita" })
    expect(within(ventana).queryByText("Paciente")).not.toBeInTheDocument()
    expect(ventana.querySelector("select")).toBeNull()
    const selector = within(ventana).getByRole("combobox", { name: /Motivo de la cita/ })
    fireEvent.click(selector)
    fireEvent.click(within(ventana).getByRole("option", { name: "Examen de Control" }))
    expect(within(ventana).getByRole("combobox", { name: /Motivo de la cita/ })).toHaveTextContent("Examen de Control")
  })
  it("«Agendar control» abre la ventana con el motivo de control ya elegido", async () => {
    datos.miControl.mockResolvedValue({ ultima_consulta: "2099-01-01", proximo_control_dias: 90, de_alta: false })
    render(<PortalPaciente {...base} />)
    fireEvent.click(await screen.findByRole("button", { name: "Agendar control" }))
    expect(within(await screen.findByRole("dialog", { name: "Agendar cita" })).getByRole("combobox", { name: /Motivo de la cita/ })).toHaveTextContent("Examen de Control")
  })
})

describe("Mis citas", () => {
  const citas = [
    cita({ id: "a", fecha: "2099-03-10", hora: "03:00 PM" }),
    cita({ id: "b", fecha: "2026-09-01", hora: "09:00 AM", estado: "Atendida" }),
    cita({ id: "c", fecha: "2026-08-01", hora: "09:00 AM", estado: "No Asistió" }),
    cita({ id: "d", fecha: "2025-07-01", hora: "09:00 AM", estado: "Cancelada" }),
    cita({ id: "e", fecha: "2099-02-01", hora: "10:00 AM", estado: "En Espera" }),
  ]
  it("la próxima en estilo boleto, y el historial agrupado por año con los estados y colores del sistema", async () => {
    render(<PortalPaciente {...base} citas={citas} />)
    await resumen()
    irA("Mis citas")
    const boleto = screen.getByRole("region", { name: "Tu próxima cita" })
    expect(boleto).toHaveTextContent("febrero") // la próxima es la más cercana: la del 1 de febrero de 2099
    expect(within(boleto).getByRole("status", { name: "Estado: En espera" }).className).toMatch(/violet/)
    const otras = screen.getByRole("region", { name: "Otras citas próximas" })
    expect(within(otras).getByRole("status", { name: "Estado: Pendiente" }).className).toMatch(/amber/)
    const historial = screen.getByRole("region", { name: "Historial" })
    expect(within(historial).getByRole("heading", { name: "2026" })).toBeInTheDocument()
    expect(within(historial).getByRole("heading", { name: "2025" })).toBeInTheDocument()
    expect(within(historial).getByRole("status", { name: "Estado: Atendida" }).className).toMatch(/emerald/)
    expect(within(historial).getByRole("status", { name: "Estado: No asistió" }).className).toMatch(/red/)
    expect(within(historial).getByRole("status", { name: "Estado: Cancelada" }).className).toMatch(/slate/)
  })
  it("Reagendar y Cancelar aparecen solo en la cita pendiente y cuando la política lo permite", async () => {
    const { unmount } = render(<PortalPaciente {...base} citas={[citas[0], citas[1]]} parametrizacion={{ permitirReagendarPaciente: true, horasAntesReagendar: 2 }} />)
    await resumen()
    irA("Mis citas")
    const boleto = screen.getByRole("region", { name: "Tu próxima cita" })
    expect(within(boleto).getAllByRole("button", { name: "Reagendar" })).toHaveLength(1)
    expect(within(boleto).getAllByRole("button", { name: /Cancelar cita/ })).toHaveLength(1)
    unmount()
    render(<PortalPaciente {...base} citas={[citas[0], citas[1]]} parametrizacion={{ permitirReagendarPaciente: false }} />)
    await resumen()
    irA("Mis citas")
    expect(screen.queryByRole("button", { name: "Reagendar" })).not.toBeInTheDocument()
  })
  it("«Confirmar asistencia» aparece cuando la cita no está confirmada y la confirma", async () => {
    datos.misCitasDetalle.mockResolvedValue({ disponible: true, porCita: { a: { profesional: "Dra. Paula", confirmadaAt: null, consultaId: null, calificacion: null } } })
    render(<PortalPaciente {...base} citas={[citas[0]]} />)
    await resumen()
    const boleto = screen.getByRole("region", { name: "Tu próxima cita" })
    expect(await within(boleto).findByText(/Con Dra\. Paula/)).toBeInTheDocument()
    fireEvent.click(within(boleto).getByRole("button", { name: "Confirmar asistencia" }))
    expect(await within(boleto).findByText("Asistencia confirmada")).toBeInTheDocument()
    expect(datos.confirmarAsistencia).toHaveBeenCalledWith("p1", "tok", "a")
    expect(within(boleto).queryByRole("button", { name: "Confirmar asistencia" })).not.toBeInTheDocument()
  })
  it("una cita ya confirmada no ofrece confirmar", async () => {
    datos.misCitasDetalle.mockResolvedValue({ disponible: true, porCita: { a: { profesional: "", confirmadaAt: "2026-10-16T10:00:00Z", consultaId: null, calificacion: null } } })
    render(<PortalPaciente {...base} citas={[citas[0]]} />)
    await resumen()
    expect(await within(screen.getByRole("region", { name: "Tu próxima cita" })).findByText("Asistencia confirmada")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Confirmar asistencia" })).not.toBeInTheDocument()
  })
  it("cada fila del historial abre su detalle y, en una atendida, deja calificar una sola vez", async () => {
    datos.misCitasDetalle.mockResolvedValue({ disponible: true, porCita: { b: { profesional: "Dra. Paula", confirmadaAt: null, consultaId: "c1", calificacion: null } } })
    render(<PortalPaciente {...base} citas={citas} />)
    await resumen()
    irA("Mis citas")
    fireEvent.click(await screen.findByRole("button", { name: /Ver el detalle de tu cita del 1 sept 2026/ }))
    const ventana = await screen.findByRole("dialog", { name: "Tu cita" })
    expect(ventana).toHaveTextContent("Te atendió")
    expect(ventana).toHaveTextContent("Dra. Paula")
    expect(within(ventana).getByRole("button", { name: /Ver la receta de esta cita/ })).toBeInTheDocument()
    fireEvent.click(within(ventana).getByRole("button", { name: "Enviar mi calificación" }))
    expect(await within(ventana).findByRole("alert")).toHaveTextContent("Elige de 1 a 5 estrellas")
    fireEvent.click(within(ventana).getByRole("radio", { name: "4 de 5" }))
    fireEvent.change(within(ventana).getByLabelText(/Un comentario/), { target: { value: "Muy amable" } })
    fireEvent.click(within(ventana).getByRole("button", { name: "Enviar mi calificación" }))
    await waitFor(() => expect(datos.calificarAtencion).toHaveBeenCalledWith("p1", "tok", "b", 4, "Muy amable"))
    expect(await within(ventana).findByText(/calificaste esta atención con 4 de 5/)).toBeInTheDocument()
    expect(within(ventana).queryByRole("button", { name: "Enviar mi calificación" })).not.toBeInTheDocument()
  })
  it("el enlace de la cita lleva a la receta que salió de ella", async () => {
    datos.misCitasDetalle.mockResolvedValue({ disponible: true, porCita: { b: { profesional: "", confirmadaAt: null, consultaId: "c1", calificacion: null } } })
    render(<PortalPaciente {...base} citas={citas} />)
    await resumen()
    irA("Mis citas")
    fireEvent.click(await screen.findByRole("button", { name: /Ver el detalle de tu cita del 1 sept 2026/ }))
    fireEvent.click(within(await screen.findByRole("dialog", { name: "Tu cita" })).getByRole("button", { name: /Ver la receta de esta cita/ }))
    expect(await screen.findByRole("dialog", { name: /Receta del 1 oct 2026/ })).toBeInTheDocument()
  })
  it("una cita sin calificación disponible (sin la migración) no muestra «¿Cómo te atendimos?»", async () => {
    render(<PortalPaciente {...base} citas={citas} />)
    await resumen()
    irA("Mis citas")
    fireEvent.click(await screen.findByRole("button", { name: /Ver el detalle de tu cita del 1 sept 2026/ }))
    expect(screen.queryByText("¿Cómo te atendimos?")).not.toBeInTheDocument()
  })
  it("sin citas, la tarjeta destacada invita a agendar con un solo botón", async () => {
    render(<PortalPaciente {...base} />)
    await resumen()
    irA("Mis citas")
    expect(screen.getByRole("region", { name: "Tu próxima cita" })).toHaveTextContent("Aún no tienes una cita agendada")
    expect(screen.getAllByRole("button", { name: "Agendar cita" })).toHaveLength(1)
    expect(screen.getByRole("region", { name: "Historial" })).toHaveTextContent("Aquí aparecen tus citas atendidas")
  })
})

describe("Mi receta", () => {
  it("dice «Ojo derecho» y «Ojo izquierdo» (nunca OD ni OI) en una tabla grande, con la fecha y quién la hizo", async () => {
    render(<PortalPaciente {...base} />)
    await resumen()
    irA("Mi receta")
    const tabla = screen.getByRole("table", { name: "Tu receta" })
    expect(within(tabla).getByRole("columnheader", { name: "Ojo derecho" })).toBeInTheDocument()
    expect(within(tabla).getByRole("columnheader", { name: "Ojo izquierdo" })).toBeInTheDocument()
    for (const v of ["-1.50", "-0.50", "90°", "20/20", "-1.25", "-0.75", "80°", "20/25", "+1.00"]) expect(within(tabla).getByText(v)).toBeInTheDocument()
    const tarjeta = screen.getByRole("region", { name: "Tu receta vigente" })
    expect(tarjeta).toHaveTextContent("1 oct 2026")
    expect(tarjeta).toHaveTextContent("Dra. Prueba")
    expect(tarjeta).toHaveTextContent("Lente recomendado: Monofocal")
    expect(document.body.textContent).not.toMatch(/\bOD\b|\bOI\b/)
  })
  it("tocar una fila explica el dato en palabras simples", async () => {
    render(<PortalPaciente {...base} />)
    await resumen()
    irA("Mi receta")
    const fila = screen.getByRole("button", { name: /^Esfera: ojo derecho -1.50/ })
    expect(screen.queryByRole("note")).not.toBeInTheDocument()
    fireEvent.click(fila)
    expect(screen.getByRole("note")).toHaveTextContent(/Cuánto necesita corregirse el ojo/)
    fireEvent.click(fila)
    expect(screen.queryByRole("note")).not.toBeInTheDocument()
  })
  it("muestra las indicaciones del optómetra y ofrece «Descargar receta» (PDF)", async () => {
    render(<PortalPaciente {...base} />)
    await resumen()
    irA("Mi receta")
    expect(screen.getByRole("region", { name: "Indicaciones de tu optómetra" })).toHaveTextContent("Haz una pausa cada 20 minutos.")
    expect(screen.getByRole("button", { name: /Descargar receta/ })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Imprimir/ })).not.toBeInTheDocument()
  })
  it("con la política apagada no muestra la distancia pupilar ni la altura y deja solicitarlas; encendida, las muestra", async () => {
    const { unmount } = render(<PortalPaciente {...base} parametrizacion={{ mostrarMedidasPaciente: false }} />)
    await resumen()
    irA("Mi receta")
    expect(screen.queryByText("Distancia pupilar")).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Solicitar distancia pupilar y medidas de montaje/ })).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/costo adicional/i)
    unmount()
    render(<PortalPaciente {...base} parametrizacion={{ mostrarMedidasPaciente: true }} />)
    await resumen()
    irA("Mi receta")
    expect(screen.getByText("Distancia pupilar")).toBeInTheDocument()
    expect(screen.getByText("62")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Solicitar distancia pupilar/ })).not.toBeInTheDocument()
  })
  it("con dos o más recetas cuenta en palabras simples cómo cambió la graduación, con gráfica y lista de anteriores", async () => {
    const anterior = consulta({ id: "c0", fecha: "2026-03-01", od: { esfera: "-1.00", cilindro: "-0.50" }, oi: { esfera: "-1.25", cilindro: "-0.75" } })
    render(<PortalPaciente {...base} consultas={[consulta(), anterior]} />)
    await resumen()
    irA("Mi receta")
    const cambio = screen.getByRole("region", { name: "Cómo cambió tu graduación" })
    expect(cambio).toHaveTextContent("Tu graduación aumentó un poco desde tu examen del 1 mar 2026")
    expect(cambio).toHaveTextContent("Tu ojo derecho necesita un poco más de corrección que en marzo.")
    expect(cambio).toHaveTextContent("Tu ojo izquierdo se mantiene igual que en marzo.")
    const anteriores = screen.getByRole("region", { name: "Tus recetas anteriores" })
    fireEvent.click(within(anteriores).getByRole("button", { name: /Ver la receta del 1 mar 2026/ }))
    expect(await screen.findByRole("dialog", { name: /Receta del 1 mar 2026/ })).toBeInTheDocument()
  })
  it("con una sola receta no hay bloque de cambio ni de recetas anteriores", async () => {
    render(<PortalPaciente {...base} />)
    await resumen()
    irA("Mi receta")
    expect(screen.queryByRole("region", { name: "Cómo cambió tu graduación" })).not.toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Tus recetas anteriores" })).not.toBeInTheDocument()
  })
  it("sin receta dice qué pasa y ofrece «Agendar cita»", async () => {
    render(<PortalPaciente {...base} consultas={[]} />)
    await resumen()
    irA("Mi receta")
    expect(screen.getByText("Todavía no tienes una receta")).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Agendar cita" })).toHaveLength(1)
  })
})

describe("Mis datos y menú", () => {
  it("ofrece 'Descargar mis datos' junto a la eliminación de la cuenta", async () => {
    render(<PortalPaciente {...base} />)
    await resumen()
    irA("Mis datos")
    expect(screen.getByRole("button", { name: /Descargar mis datos/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Solicitar eliminación/ })).toBeInTheDocument()
  })
  it("tiene las cinco secciones en el menú de laptop y en la barra de abajo del celular", async () => {
    render(<PortalPaciente {...base} />)
    await resumen()
    const menus = screen.getAllByRole("navigation", { name: "Menú del portal" })
    expect(menus).toHaveLength(2)
    for (const m of menus) for (const n of ["Resumen", "Mis citas", "Mi receta", "Mis compras", "Mis datos"]) expect(within(m).getByRole("button", { name: n })).toBeInTheDocument()
  })
})
