import React from "react"
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { render, screen, fireEvent, within, waitFor } from "@testing-library/react"
import PortalPaciente from "./PortalPaciente"
import { ahoraEcuador } from "../utilidades/horaEcuador"
import { fechaAISO } from "../utilidades/disponibilidad"

// Lo que el portal pide a la base (compras, lentes, control y detalle de las citas): cada prueba lo fija a su gusto.
const datos = vi.hoisted(() => ({
  misCompras: vi.fn(async () => ({ compras: [], error: null })),
  misOrdenes: vi.fn(async () => ({ ordenes: [], disponible: true })),
  miControl: vi.fn(async () => null),
  misCitasDetalle: vi.fn(async () => ({ disponible: false, porCita: {} })),
  confirmarAsistencia: vi.fn(async () => ({ ok: true })),
  calificarAtencion: vi.fn(async () => ({ ok: true })),
  misReferidos: vi.fn(async () => 0),
  marcarCitaEnCalendario: vi.fn(async () => ({ ok: true })),
  misMedidas: vi.fn(async () => null),
  misSolicitudesLentes: vi.fn(async () => ({ disponible: true, lista: [] })),
  solicitarLentes: vi.fn(async () => ({ ok: true })),
  descargarMisDatosPaciente: vi.fn(async () => ({ ok: true })),
  misDatosTransferencia: vi.fn(async () => ({ disponible: false, datos: null, pagos: [] })),
  reportarPagoTransferencia: vi.fn(async () => ({ ok: true })),
}))
vi.mock("../utilidades/facturaElectronicaApi", () => ({ misCompras: datos.misCompras, urlDeDescargaPaciente: vi.fn() }))
vi.mock("../utilidades/portalDatos", () => ({ misOrdenes: datos.misOrdenes, miControl: datos.miControl, misCitasDetalle: datos.misCitasDetalle, confirmarAsistencia: datos.confirmarAsistencia, calificarAtencion: datos.calificarAtencion, misReferidos: datos.misReferidos, marcarCitaEnCalendario: datos.marcarCitaEnCalendario, misMedidas: datos.misMedidas, misSolicitudesLentes: datos.misSolicitudesLentes, solicitarLentes: datos.solicitarLentes, descargarMisDatosPaciente: datos.descargarMisDatosPaciente, misDatosTransferencia: datos.misDatosTransferencia, reportarPagoTransferencia: datos.reportarPagoTransferencia }))

const descarga = vi.hoisted(() => ({ descargarHojaReceta: vi.fn(async () => true) }))
vi.mock("../utilidades/descargarHojaReceta", () => ({ descargarHojaReceta: descarga.descargarHojaReceta }))

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
const resumen = async () => { await screen.findByRole("heading", { name: "Inicio" }); await waitFor(() => expect(screen.queryByLabelText("Cargando tu resumen")).not.toBeInTheDocument()) }
const compraConSaldo = { id: "f1", numero: 21, fecha: "2026-10-08T16:00:00Z", total: 265, estado: "pendiente_pago", abonado: 120, saldo: 145, lineas: [{ descripcion: "Montura Ray-Ban", cantidad: 1, subtotal: 85 }], factura_electronica: null }
const orden = (extra = {}) => ({ id: "o1", numero: 3, estado: "enviada", fechaPrometida: "2099-01-20", tipoLente: "progresivo", montura: "Ray-Ban", facturaId: "f1", creadaEn: "2026-10-09T15:00:00Z", listaEl: null, entregadaEl: null, ...extra })

// El portal dibuja una sola versión según el ancho de la ventana: laptop (1024 px o más, con menú a la izquierda) o celular (barra abajo). Por defecto, laptop.
let anchoVentana = 1366
const ponerAncho = (px) => { anchoVentana = px }
beforeEach(() => {
  anchoVentana = 1366
  window.matchMedia = (q) => ({ matches: (() => { const m = /min-width:\s*(\d+)px/.exec(q); return m ? anchoVentana >= Number(m[1]) : false })(), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })
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
    expect(screen.getByRole("button", { name: /Mi cuenta/ })).toHaveTextContent("Rosa Bravo")
    expect(screen.getByText(/Buenos días, Rosa|Buenas tardes, Rosa|Buenas noches, Rosa/)).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/¡Hola, Rosa!/)
  })
  it("el portal se viste con el color de la óptica", async () => {
    render(<PortalPaciente {...base} opticaPublica={{ nombre: "Óptica Prueba", marca: { colorAcento: "#7C3AED" } }} />)
    await resumen()
    expect(document.documentElement.style.getPropertyValue("--portal-acento")).toBe("#7C3AED")
  })
  it("la campanita avisa de los lentes listos y de la cita de mañana, y cada aviso lleva a su pantalla", async () => {
    // «Mañana» según el reloj de Ecuador (como la app), no el del equipo: en el CI (UTC) entre las 19:00 y las 24:00 de Ecuador ya es otro día.
    const manana = ahoraEcuador(); manana.setDate(manana.getDate() + 1)
    const fecha = fechaAISO(manana)
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
  it("un paciente con una cita, lentes y saldo nunca ve la bienvenida de un paciente nuevo", async () => {
    datos.misOrdenes.mockResolvedValue({ ordenes: [orden()], disponible: true })
    datos.misCompras.mockResolvedValue({ compras: [compraConSaldo], error: null })
    render(<PortalPaciente {...base} citas={[cita()]} consultas={[]} />)
    await screen.findByRole("region", { name: "Tus lentes" })
    expect(screen.queryByRole("region", { name: "Bienvenida" })).not.toBeInTheDocument()
    expect(screen.queryByText(/Te damos la bienvenida/)).not.toBeInTheDocument()
    expect(screen.queryByText("Aún no tienes una cita agendada")).not.toBeInTheDocument()
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
  it("«Tus lentes» es una línea de pasos vertical con la fecha de cada paso y la estimada", async () => {
    datos.misOrdenes.mockResolvedValue({ ordenes: [orden()], disponible: true })
    datos.misCompras.mockResolvedValue({ compras: [compraConSaldo], error: null })
    render(<PortalPaciente {...base} />)
    const tarjeta = await screen.findByRole("region", { name: "Tus lentes" })
    expect(tarjeta).toHaveTextContent("Progresivos · montura Ray-Ban")
    const items = within(within(tarjeta).getByRole("list", { name: "Seguimiento de tus lentes" })).getAllByRole("listitem")
    expect(items.map((i) => i.textContent.replace(/^\d+/, "").replace(/\s+/g, " ").trim())).toEqual(["Pedido 8 de octubre", "En el laboratorio Desde el 9 de octubre", "Listos para retirar Estimado: 20 de enero", "Entregados"])
    expect(items[1]).toHaveAttribute("aria-current", "step")
  })
  it("cuando los lentes están listos dice «Ya puedes retirarlos»", async () => {
    datos.misOrdenes.mockResolvedValue({ ordenes: [orden({ estado: "lista", listaEl: "2026-10-16T14:00:00Z" })], disponible: true })
    render(<PortalPaciente {...base} />)
    expect(await screen.findByRole("region", { name: "Tus lentes" })).toHaveTextContent("Ya puedes retirarlos")
  })
  it("las órdenes ya entregadas no aparecen en el Resumen", async () => {
    datos.misOrdenes.mockResolvedValue({ ordenes: [orden({ estado: "entregada", entregadaEl: "2026-09-03T14:00:00Z" })], disponible: true })
    render(<PortalPaciente {...base} />)
    await resumen()
    expect(screen.queryByRole("region", { name: "Tus lentes" })).not.toBeInTheDocument()
  })
  it("«Tu próximo control» muestra la fecha, cuánto falta y, sin cita, «Agendar control»", async () => {
    datos.miControl.mockResolvedValue({ ultima_consulta: "2099-01-01", proximo_control_dias: 90, de_alta: false })
    render(<PortalPaciente {...base} />)
    const tarjeta = await screen.findByRole("region", { name: "Tu próximo control" })
    expect(tarjeta).toHaveTextContent("Abril de 2099")
    expect(tarjeta).toHaveTextContent("te avisaremos antes")
    expect(within(tarjeta).getByRole("button", { name: "Agendar control" })).toBeInTheDocument()
  })
  it("con una cita ya agendada, el control no ofrece agendar otra", async () => {
    datos.miControl.mockResolvedValue({ ultima_consulta: "2099-01-01", proximo_control_dias: 90, de_alta: false })
    render(<PortalPaciente {...base} citas={[cita()]} />)
    expect(within(await screen.findByRole("region", { name: "Tu próximo control" })).queryByRole("button", { name: /Agendar control/ })).not.toBeInTheDocument()
  })
  it("«Pendiente para ti» avisa del saldo, con lo que se debe, y lleva al detalle de sus abonos", async () => {
    datos.misCompras.mockResolvedValue({ compras: [compraConSaldo], error: null })
    render(<PortalPaciente {...base} />)
    const bloque = await screen.findByRole("region", { name: "Pendiente para ti" })
    expect(bloque).toHaveTextContent("Tienes $145.00 por pagar")
    expect(bloque).toHaveTextContent("Puedes pagarlo en la óptica.")
    expect(screen.queryByRole("region", { name: "Saldo por pagar" })).not.toBeInTheDocument()
    fireEvent.click(within(bloque).getByRole("button", { name: /Tienes \$145.00 por pagar/ }))
    expect(await screen.findByRole("dialog", { name: "Tu saldo por pagar" })).toHaveTextContent("Abonaste $120.00 de $265.00")
  })
  it("sin nada pendiente no hay bloque «Pendiente para ti»", async () => {
    render(<PortalPaciente {...base} />)
    await resumen()
    expect(screen.queryByRole("region", { name: "Pendiente para ti" })).not.toBeInTheDocument()
  })
  it("«Pendiente para ti» va por prioridad: lentes listos, confirmar la cita, pagar el saldo y calificar la visita", async () => {
    datos.misOrdenes.mockResolvedValue({ ordenes: [orden({ estado: "lista", listaEl: "2026-10-16T14:00:00Z" })], disponible: true })
    datos.misCompras.mockResolvedValue({ compras: [compraConSaldo], error: null })
    datos.misCitasDetalle.mockResolvedValue({ disponible: true, porCita: { ci1: { profesional: "Dra. Prueba", confirmadaAt: null, consultaId: null, calificacion: null }, ci0: { profesional: "Dra. Prueba", confirmadaAt: null, consultaId: "c1", calificacion: null } } })
    render(<PortalPaciente {...base} citas={[cita(), cita({ id: "ci0", fecha: "2026-04-20", hora: "11:40 AM", estado: "Atendida" })]} />)
    const bloque = await screen.findByRole("region", { name: "Pendiente para ti" })
    await waitFor(() => expect(within(bloque).getAllByRole("listitem")).toHaveLength(4))
    const titulos = within(bloque).getAllByRole("listitem").map((li) => li.textContent)
    expect(titulos[0]).toContain("Tus lentes están listos para retirar")
    expect(titulos[1]).toContain("Confirma tu cita del 10 de marzo")
    expect(titulos[2]).toContain("Tienes $145.00 por pagar")
    expect(titulos[3]).toContain("¿Cómo te atendimos el 20 de abril?")
    fireEvent.click(within(bloque).getByRole("button", { name: "Confirmar" }))
    await waitFor(() => expect(datos.confirmarAsistencia).toHaveBeenCalledWith("p1", "tok", "ci1"))
  })
  it("cada tarjeta del Inicio dice «Ver detalle» en texto", async () => {
    datos.misOrdenes.mockResolvedValue({ ordenes: [orden()], disponible: true })
    datos.misCompras.mockResolvedValue({ compras: [compraConSaldo], error: null })
    render(<PortalPaciente {...base} citas={[cita()]} />)
    await screen.findByRole("region", { name: "Tus lentes" })
    expect(within(screen.getByRole("region", { name: "Tu próxima cita" })).getByText("Ver detalle")).toBeInTheDocument()
    expect(within(screen.getByRole("region", { name: "Tus lentes" })).getByText("Ver detalle")).toBeInTheDocument()
  })
  it("«Tus puntos de cliente» cuenta 10 por consulta y dice cuánto falta para ser cliente frecuente", async () => {
    render(<PortalPaciente {...base} />)
    const tarjeta = await screen.findByRole("region", { name: "Tus puntos de cliente" })
    expect(tarjeta).toHaveTextContent("10 puntos")
    expect(tarjeta).toHaveTextContent("Te falta 2 consultas para ser cliente frecuente")
    fireEvent.click(within(tarjeta).getByRole("button", { name: /Ver cómo sumas tus puntos/ }))
    const ventanaPuntos = await screen.findByRole("dialog", { name: "Tus puntos de cliente" })
    expect(within(ventanaPuntos).getByRole("region", { name: "Historial de puntos" })).toHaveTextContent("Consulta · 1 oct 2026+10")
    expect(within(ventanaPuntos).getByRole("region", { name: "Siguiente nivel" })).toHaveTextContent("Te falta 2 consultas")
    expect(ventanaPuntos).toHaveTextContent("10 puntos por cada consulta y 15 por cada paciente que refieras")
  })
  it("sin deuda no hay tarjeta de saldo", async () => {
    render(<PortalPaciente {...base} />)
    await resumen()
    expect(screen.queryByRole("region", { name: "Saldo por pagar" })).not.toBeInTheDocument()
  })
  it("«La óptica» (la franja oscura) dice si está abierta, la dirección con el horario y los tres botones", async () => {
    const dia = { manana: { activo: true, inicio: "00:00", fin: "23:59" } }
    const horarioSemanal = Object.fromEntries(["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"].map((d) => [d, dia]))
    render(<PortalPaciente {...base} disponibilidad={{ horarioSemanal }} parametrizacion={{ opticaDireccion: "Av. 9 de Octubre 123", opticaTelefono: "0991234567" }} />)
    const tarjeta = await screen.findByRole("region", { name: "La óptica" })
    expect(tarjeta).toHaveTextContent("Abierto ahora · cierra a las")
    expect(tarjeta).toHaveTextContent("Av. 9 de Octubre 123 · ver horario y mapa")
    expect(within(tarjeta).getByRole("link", { name: /Llamar/ })).toHaveAttribute("href", "tel:+593991234567")
    expect(within(tarjeta).getByRole("link", { name: /WhatsApp/ }).getAttribute("href")).toContain("phone=593991234567")
    expect(within(tarjeta).getByRole("link", { name: /Cómo llegar/ }).getAttribute("href")).toContain("google.com/maps")
  })
  it("sin datos de la óptica no hay tarjeta de la óptica", async () => {
    render(<PortalPaciente {...base} />)
    await resumen()
    expect(screen.queryByRole("region", { name: "La óptica" })).not.toBeInTheDocument()
  })
  it("«Tu graduación» muestra los ojos ilustrados con la esfera, el cilindro y el eje, y lleva a la receta completa", async () => {
    render(<PortalPaciente {...base} />)
    const receta = await screen.findByRole("region", { name: "Tu graduación" })
    expect(receta).toHaveTextContent("−1.50")
    expect(receta).toHaveTextContent("cil −0.50 · eje 90°")
    expect(receta).toHaveTextContent("−1.25")
    expect(receta).toHaveTextContent("Ojo derecho")
    expect(receta).toHaveTextContent("Ojo izquierdo")
    expect(receta).toHaveTextContent("Receta del 1 de octubre de 2026")
    expect(receta.querySelectorAll("[data-ojo-ilustrado]")).toHaveLength(2)
    fireEvent.click(within(receta).getByRole("button", { name: "Ver mi receta" }))
    expect(await screen.findByRole("heading", { name: "Mi receta" })).toBeInTheDocument()
  })
  it("en el celular «Tu graduación» lleva el botón «Ver mi receta completa» debajo y sin la frase", async () => {
    ponerAncho(390)
    render(<PortalPaciente {...base} />)
    const receta = await screen.findByRole("region", { name: "Tu graduación" })
    expect(receta).toHaveTextContent("cil −0.50")
    expect(receta).not.toHaveTextContent("eje 90°")
    expect(within(receta).getByRole("button", { name: "Ver mi receta completa" })).toBeInTheDocument()
  })
  it("«Solicitar ajuste o garantía» (en Mis compras) abre «Agendar cita» con el motivo y la compra relacionada", async () => {
    datos.misCompras.mockResolvedValue({ compras: [{ ...compraConSaldo, estado: "pagada", abonado: 265, saldo: 0 }], error: null })
    render(<PortalPaciente {...base} />)
    await resumen()
    irA("Mis compras")
    fireEvent.click(await screen.findByRole("button", { name: /Historial de compras/ }))
    fireEvent.click(await screen.findByRole("button", { name: /Ver el detalle de tu compra CV-0021/ }))
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
    expect(within(boleto).getByRole("status", { name: "Estado: En espera" }).firstChild.className).toMatch(/violet/)
    const otras = screen.getByRole("region", { name: "Otras citas próximas" })
    expect(within(otras).getByRole("status", { name: "Estado: Pendiente" }).firstChild.className).toMatch(/ambar/)
    const historial = screen.getByRole("region", { name: "Tus visitas anteriores" })
    fireEvent.click(within(historial).getByRole("button", { name: "Todas" }))
    expect(within(historial).getByRole("heading", { name: "2026" })).toBeInTheDocument()
    expect(within(historial).getByRole("heading", { name: "2025" })).toBeInTheDocument()
    expect(within(historial).getByRole("status", { name: "Estado: Atendida" }).firstChild.className).toMatch(/166534/)
    expect(within(historial).getByRole("status", { name: "Estado: No asistió" }).firstChild.className).toMatch(/B42318/)
    expect(within(historial).getByRole("status", { name: "Estado: Cancelada" }).firstChild.className).toMatch(/slate/)
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
    irA("Mis citas")
    const boleto = screen.getByRole("region", { name: "Tu próxima cita" })
    expect(await within(boleto).findByText(/Dra\. Paula/)).toBeInTheDocument()
    fireEvent.click(within(boleto).getByRole("button", { name: "Confirmar asistencia" }))
    expect(await within(boleto).findByRole("status", { name: "Estado: Confirmada" })).toBeInTheDocument()
    expect(datos.confirmarAsistencia).toHaveBeenCalledWith("p1", "tok", "a")
    expect(within(boleto).queryByRole("button", { name: "Confirmar asistencia" })).not.toBeInTheDocument()
  })
  it("una cita ya confirmada no ofrece confirmar", async () => {
    datos.misCitasDetalle.mockResolvedValue({ disponible: true, porCita: { a: { profesional: "", confirmadaAt: "2026-10-16T10:00:00Z", consultaId: null, calificacion: null } } })
    render(<PortalPaciente {...base} citas={[citas[0]]} />)
    await resumen()
    expect(await within(screen.getByRole("region", { name: "Tu próxima cita" })).findByRole("status", { name: "Estado: Confirmada" })).toBeInTheDocument()
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
    expect(screen.getByRole("region", { name: "Tus visitas anteriores" })).toHaveTextContent("Aquí aparecen tus citas atendidas")
  })
})

describe("Mi receta", () => {
  it("dice «Ojo derecho» y «Ojo izquierdo» (nunca OD ni OI), un ojo ilustrado con la esfera por ojo y su astigmatismo, cerca y agudeza", async () => {
    render(<PortalPaciente {...base} />)
    await resumen()
    irA("Mi receta")
    expect(screen.getByRole("heading", { name: "Mi receta" })).toHaveTextContent("Mi receta")
    const derecho = screen.getByRole("region", { name: "Ojo derecho" })
    const izquierdo = screen.getByRole("region", { name: "Ojo izquierdo" })
    for (const v of ["−1.50", "−0.50 · 90°", "+1.00", "20/20"]) expect(derecho).toHaveTextContent(v)
    for (const v of ["−1.25", "−0.75 · 80°", "+1.00", "20/25"]) expect(izquierdo).toHaveTextContent(v)
    expect(derecho).toHaveTextContent("esfera")
    expect(derecho.querySelector("[data-ojo-ilustrado]")).not.toBeNull()
    expect(document.body.textContent).not.toMatch(/\bOD\b|\bOI\b/)
  })
  it("explica cada ojo con los valores de ese paciente, por rangos: miopía leve, astigmatismo, lo de cerca y cómo ve con sus lentes", async () => {
    render(<PortalPaciente {...base} consultas={[consulta({ lenteRecomendado: "Progresivo" })]} />)
    await resumen()
    irA("Mi receta")
    const derecho = screen.getByRole("region", { name: "Ojo derecho" })
    expect(derecho).toHaveTextContent("Tienes miopía leve: ves bien de cerca y un poco borroso de lejos.")
    expect(derecho).toHaveTextContent("Leve: algunas líneas se ven un poco estiradas. Tus lentes lo corrigen.")
    expect(derecho).toHaveTextContent("Es una ayuda pequeña que tus lentes progresivos dan en la parte de abajo para ver de cerca.")
    expect(derecho).toHaveTextContent("Ves con nitidez completa, como debe ser.")
    expect(screen.getByRole("region", { name: "Ojo izquierdo" })).toHaveTextContent("Tienes miopía leve, un poco menor que en el ojo derecho.")
  })
  it("en la receta (la ventana de «Tu graduación»), tocar una fila explica el dato en palabras simples", async () => {
    render(<PortalPaciente {...base} />)
    await resumen()
    fireEvent.click(await screen.findByRole("button", { name: "Ver tu receta completa" }))
    const fila = await screen.findByRole("button", { name: /^Esfera: ojo derecho −1.50/ })
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
    expect(screen.getByRole("region", { name: "Lo que te indicó tu optómetra" })).toHaveTextContent("Haz una pausa cada 20 minutos.")
    fireEvent.click(screen.getByRole("button", { name: /Descargar receta/ }))
    await waitFor(() => expect(descarga.descargarHojaReceta).toHaveBeenCalledWith(expect.objectContaining({ receta: expect.objectContaining({ id: "c1" }), paciente: expect.objectContaining({ nombre: "Rosa Bravo" }) })))
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
  it("cuando la óptica le envía las medidas, el paciente las ve; si lo cita para tomarlas, ve cuándo lo esperan; con la solicitud abierta lo dice", async () => {
    datos.misMedidas.mockResolvedValue({ abiertaDesde: null, ultima: { resultado: "enviadas", cerrada: "2026-10-19T15:00:00Z", dp: "62", altura: "18", citaFecha: null, citaHora: "" } })
    const { unmount } = render(<PortalPaciente {...base} parametrizacion={{ mostrarMedidasPaciente: false }} />)
    await resumen()
    irA("Mi receta")
    const enviadas = await screen.findByRole("region", { name: "Tu óptica te envió tus medidas" })
    expect(enviadas).toHaveTextContent("62 mm")
    expect(enviadas).toHaveTextContent("18 mm")
    unmount()
    datos.misMedidas.mockResolvedValue({ abiertaDesde: null, ultima: { resultado: "cita", cerrada: "2026-10-19T15:00:00Z", dp: "", altura: "", citaFecha: "2099-03-10", citaHora: "03:00 PM" } })
    const segundo = render(<PortalPaciente {...base} parametrizacion={{ mostrarMedidasPaciente: false }} />)
    await resumen()
    irA("Mi receta")
    expect(await screen.findByRole("region", { name: "Te esperamos para tomarlas" })).toHaveTextContent("03:00 PM")
    segundo.unmount()
    datos.misMedidas.mockResolvedValue({ abiertaDesde: "2026-10-19T15:00:00Z", ultima: null })
    render(<PortalPaciente {...base} parametrizacion={{ mostrarMedidasPaciente: false }} />)
    await resumen()
    irA("Mi receta")
    expect(await screen.findByText("Solicitud enviada")).toBeInTheDocument()
    datos.misMedidas.mockResolvedValue(null)
  })
  it("el ojo derecho va a la derecha y el izquierdo a la izquierda (perspectiva del paciente)", async () => {
    render(<PortalPaciente {...base} />)
    await resumen()
    irA("Mi receta")
    const orden = (el) => Number(getComputedStyle(el).order || 0)
    // En la hoja de estilos de las pruebas no hay clases de Tailwind: se comprueba la clase que las pone en ese orden.
    expect(screen.getByRole("region", { name: "Ojo derecho" }).className).toMatch(/order-2/)
    expect(screen.getByRole("region", { name: "Ojo izquierdo" }).className).toMatch(/order-1/)
    expect(orden).toBeTypeOf("function")
  })
  it("con dos o más recetas hay un selector con la receta mostrada y, al elegir otra, cambia toda la página (ojos, explicaciones, antes → ahora e indicaciones)", async () => {
    const anterior = consulta({ id: "c0", fecha: "2026-03-01", indicaciones: "Usa lentes solo para leer.", od: { esfera: "-1.00", cilindro: "-0.50", eje: "90", avCc: "20/20" }, oi: { esfera: "-1.25", cilindro: "-0.75", eje: "80", avCc: "20/25" } })
    const mas = consulta({ id: "c00", fecha: "2025-03-01", indicaciones: "Primera receta.", od: { esfera: "-0.50", cilindro: "-0.25" }, oi: { esfera: "-0.75" } })
    render(<PortalPaciente {...base} consultas={[consulta(), anterior, mas]} />)
    await resumen()
    irA("Mi receta")
    // la vigente
    const selector = screen.getByRole("button", { name: /Elegir otra receta/ })
    expect(selector).toHaveTextContent("Receta del 1 de octubre de 2026 · vigente")
    expect(screen.getByRole("region", { name: "Ojo derecho" })).toHaveTextContent("−1.50")
    expect(screen.getByRole("region", { name: "Cómo cambió desde tu examen anterior" })).toHaveTextContent("Mar 2026")
    expect(screen.getByRole("region", { name: "Cómo cambió desde tu examen anterior" })).toHaveTextContent("Media dioptría más de corrección")
    expect(screen.queryByRole("region", { name: "Tus recetas" })).not.toBeInTheDocument()
    // elige la del 1 de marzo de 2026
    fireEvent.click(selector)
    const lista = screen.getByRole("listbox", { name: "Recetas del paciente" })
    expect(within(lista).getAllByRole("option")).toHaveLength(3)
    fireEvent.click(within(lista).getByRole("option", { name: /1 de marzo de 2026/ }))
    expect(screen.getByRole("button", { name: /Elegir otra receta/ })).toHaveTextContent("Receta del 1 de marzo de 2026")
    expect(screen.getByRole("button", { name: /Elegir otra receta/ })).not.toHaveTextContent("vigente")
    expect(screen.getByRole("region", { name: "Ojo derecho" })).toHaveTextContent("−1.00")
    expect(screen.getByRole("region", { name: "Ojo derecho" })).not.toHaveTextContent("−1.50")
    expect(screen.getByRole("region", { name: "Lo que te indicó tu optómetra" })).toHaveTextContent("Usa lentes solo para leer.")
    const cambio = screen.getByRole("region", { name: "Cómo cambió desde tu examen anterior" })
    expect(cambio).toHaveTextContent("Mar 2025")
    expect(cambio).toHaveTextContent("Mar 2026")
    // «Descargar receta» baja la receta elegida
    fireEvent.click(screen.getByRole("button", { name: /Descargar receta/ }))
    await waitFor(() => expect(descarga.descargarHojaReceta).toHaveBeenLastCalledWith(expect.objectContaining({ receta: expect.objectContaining({ id: "c0" }) })))
  })
  it("el selector filtra por año y «Comparar dos recetas» compara la receta elegida, señalando lo que cambió", async () => {
    const anterior = consulta({ id: "c0", fecha: "2025-03-01", od: { esfera: "-1.00", cilindro: "-0.50", eje: "90", avCc: "20/20" }, oi: { esfera: "-1.25", cilindro: "-0.75", eje: "80", avCc: "20/25" } })
    render(<PortalPaciente {...base} consultas={[consulta(), anterior]} />)
    await resumen()
    irA("Mi receta")
    fireEvent.click(screen.getByRole("button", { name: /Elegir otra receta/ }))
    const menu = screen.getByRole("listbox", { name: "Recetas del paciente" })
    fireEvent.click(within(menu.parentElement).getByRole("button", { name: "2025" }))
    expect(within(menu).getAllByRole("option")).toHaveLength(1)
    fireEvent.click(within(menu.parentElement).getByRole("button", { name: "Todas" }))
    fireEvent.click(within(menu).getByRole("option", { name: /1 de octubre de 2026/ }))
    fireEvent.click(screen.getByRole("button", { name: "Comparar dos recetas" }))
    const ventana = await screen.findByRole("dialog", { name: "Comparar dos recetas" })
    expect(within(ventana).getByLabelText("Primera receta")).toHaveValue("c0")
    expect(within(ventana).getByLabelText("Segunda receta")).toHaveValue("c1")
    expect(ventana).toHaveTextContent("Cambiaron")
    expect(within(ventana).getByRole("region", { name: "Ojo derecho" })).toHaveTextContent("cambió (−0.50)")
    expect(within(ventana).getByRole("region", { name: "Ojo izquierdo" })).not.toHaveTextContent("cambió (−")
    fireEvent.change(within(ventana).getByLabelText("Primera receta"), { target: { value: "c1" } })
    expect(ventana).toHaveTextContent("Elige dos recetas distintas")
  })
  it("con una sola receta no hay selector, ni bloque de cambio, ni «Comparar dos recetas»", async () => {
    render(<PortalPaciente {...base} />)
    await resumen()
    irA("Mi receta")
    expect(screen.queryByRole("button", { name: /Elegir otra receta/ })).not.toBeInTheDocument()
    expect(screen.getByText("Receta del 1 de octubre de 2026 · vigente")).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Cómo cambió desde tu examen anterior" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Comparar dos recetas" })).not.toBeInTheDocument()
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
    expect(screen.getByRole("button", { name: "Descargar una copia de mis datos" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Pedir que eliminen mi cuenta" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Cambiar contraseña" })).toBeInTheDocument()
  })
  it("en laptop tiene el menú a la izquierda con las cinco pantallas y «Cerrar sesión»", async () => {
    render(<PortalPaciente {...base} />)
    await resumen()
    const menus = screen.getAllByRole("navigation", { name: "Menú del portal" })
    expect(menus).toHaveLength(1)
    for (const n of ["Inicio", "Mis citas", "Mi receta", "Mis compras", "Mis datos"]) expect(within(menus[0]).getByRole("button", { name: n })).toBeInTheDocument()
    expect(screen.getByText("Portal del paciente")).toBeInTheDocument()
    // «Cerrar sesión» ya no está en el pie del menú: está en el menú de la cuenta, con «Mis datos».
    expect(within(menus[0]).queryByRole("button", { name: /Cerrar sesión/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Mi cuenta/ }))
    const cuenta = screen.getByRole("menu", { name: "Mi cuenta" })
    expect(within(cuenta).getByRole("menuitem", { name: /Mis datos/ })).toBeInTheDocument()
    expect(within(cuenta).getByRole("menuitem", { name: /Cerrar sesión/ })).toBeInTheDocument()
  })
  it("el botón de la cabecera pliega el menú a una columna angosta con los íconos (cada uno con su nombre al pasar el cursor) y lo vuelve a abrir", async () => {
    render(<PortalPaciente {...base} />)
    await resumen()
    const nav = () => screen.getByRole("navigation", { name: "Menú del portal" })
    expect(within(nav()).getByText("Mis citas")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Ocultar el menú" }))
    // plegado: sigue la columna con las cinco pantallas, solo con íconos y su nombre en el título del botón
    for (const n of ["Inicio", "Mis citas", "Mi receta", "Mis compras", "Mis datos"]) expect(within(nav()).getByRole("button", { name: n })).toHaveAttribute("title", n)
    expect(within(nav()).queryByText("Mis citas")).not.toBeInTheDocument()
    expect(screen.queryByText("Portal del paciente")).not.toBeInTheDocument()
    expect(nav().closest("aside").className).toMatch(/w-20/)
    fireEvent.click(within(nav()).getByRole("button", { name: "Mis citas" }))
    expect(await screen.findByRole("heading", { name: "Mis citas" })).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Mostrar el menú" }))
    expect(within(nav()).getByText("Mis citas")).toBeInTheDocument()
    expect(screen.getByText("Portal del paciente")).toBeInTheDocument()
  })
  it("la cabecera lleva el saludo con la fecha completa, la campanita y la cuenta con su nombre", async () => {
    render(<PortalPaciente {...base} />)
    await resumen()
    expect(screen.getByText(/^(Buenos días|Buenas tardes|Buenas noches), Rosa$/)).toBeInTheDocument()
    expect(document.body.textContent).toMatch(/(Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo), \d{1,2} de \w+ de \d{4}/)
    expect(screen.getByRole("button", { name: /Mi cuenta: Rosa Bravo/ })).toBeInTheDocument()
  })
  it("en el celular la barra de navegación va abajo con las cinco pantallas y «Cerrar sesión» está en Mis datos", async () => {
    ponerAncho(390)
    render(<PortalPaciente {...base} />)
    await resumen()
    const menus = screen.getAllByRole("navigation", { name: "Menú del portal" })
    expect(menus).toHaveLength(1)
    for (const n of ["Inicio", "Mis citas", "Mi receta", "Mis compras", "Mis datos"]) expect(within(menus[0]).getByRole("button", { name: n })).toBeInTheDocument()
    expect(within(menus[0]).getByText("Citas")).toBeInTheDocument()
    expect(screen.getByText(/Hola, Rosa/)).toBeInTheDocument()
    fireEvent.click(within(menus[0]).getByRole("button", { name: "Mis datos" }))
    expect(await screen.findByRole("button", { name: /Cerrar sesión/ })).toBeInTheDocument()
  })
})

describe("Detalle de cada tarjeta, calendario y cambios de la cita (ronda 5)", () => {
  const detalleConfirmable = { disponible: true, porCita: { ci1: { profesional: "Dra. Prueba", confirmadaAt: null, consultaId: null, calificacion: null } } }
  beforeEach(() => { try { localStorage.clear() } catch { /* sin almacenamiento */ } window.HTMLAnchorElement.prototype.click = vi.fn(); URL.createObjectURL = vi.fn(() => "blob:x"); URL.revokeObjectURL = vi.fn() })

  it("el contenido ocupa todo el ancho disponible (menos los márgenes): sin ningún tope de ancho", async () => {
    render(<PortalPaciente {...base} />)
    await resumen()
    const zona = document.querySelector(".pt-zona")
    expect(zona.className).not.toMatch(/max-w-/)
  })

  it("antes de confirmar, el Inicio ofrece «Confirmar» y no el calendario; al confirmar, el aviso ofrece agregarla y se guarda en la base: el estado dice «en tu calendario»", async () => {
    datos.misCitasDetalle.mockResolvedValue(detalleConfirmable)
    render(<PortalPaciente {...base} citas={[cita()]} />)
    const boleto = await screen.findByRole("region", { name: "Tu próxima cita" })
    const pendiente = await screen.findByRole("region", { name: "Pendiente para ti" })
    expect(within(boleto).queryByRole("button", { name: /Agregar a mi calendario/ })).not.toBeInTheDocument()
    expect(within(boleto).queryByRole("button", { name: "Confirmar asistencia" })).not.toBeInTheDocument()
    fireEvent.click(within(pendiente).getByRole("button", { name: "Confirmar" }))
    const aviso = await screen.findByText("Confirmaste tu asistencia. ¡Te esperamos!")
    const botonAviso = within(aviso.closest("[role=status]")).getByRole("button", { name: "Agregar a mi calendario" })
    fireEvent.click(botonAviso)
    await waitFor(() => expect(within(screen.getByRole("region", { name: "Tu próxima cita" })).getByRole("status")).toHaveTextContent("Confirmada · en tu calendario"))
    expect(datos.marcarCitaEnCalendario).toHaveBeenCalledWith("p1", "tok", "ci1")
    expect(localStorage.getItem("portal-calendario-p1")).toBeNull()
  })

  it("lo agregado al calendario viene de la base (vale en todos sus aparatos) y en el detalle se ofrece volver a agregarla", async () => {
    datos.misCitasDetalle.mockResolvedValue({ disponible: true, porCita: { ci1: { profesional: "", confirmadaAt: null, consultaId: null, calificacion: null, enCalendarioAt: "2026-10-16T10:00:00Z" } } })
    render(<PortalPaciente {...base} citas={[cita()]} />)
    await resumen()
    fireEvent.click(await screen.findByRole("button", { name: "Ver el detalle de tu próxima cita" }))
    const ventana = await screen.findByRole("dialog", { name: "Tu cita" })
    expect(within(ventana).getByRole("status", { name: /en tu calendario/ })).toBeInTheDocument()
    fireEvent.click(within(ventana).getByRole("button", { name: "Volver a agregarla a mi calendario" }))
    expect(URL.createObjectURL).toHaveBeenCalled()
  })

  it("si la óptica no permite cambiar citas, la cita dice «¿Necesitas cambiarla?» con la salida por WhatsApp", async () => {
    render(<PortalPaciente {...base} citas={[cita()]} parametrizacion={{ permitirReagendarPaciente: false, opticaTelefono: "0991234567" }} />)
    await resumen()
    const boleto = screen.getByRole("region", { name: "Tu próxima cita" })
    expect(boleto).toHaveTextContent("¿Necesitas cambiarla?")
    expect(within(boleto).getByRole("link", { name: /Escríbenos por WhatsApp/ })).toHaveAttribute("href", expect.stringMatching(/wa.me|whatsapp/))
    expect(within(boleto).queryByRole("button", { name: "Reagendar" })).not.toBeInTheDocument()
  })

  it("si la óptica lo permite, «Reagendar» y «Cancelar» están en la cita, también en el celular y dentro de su detalle", async () => {
    ponerAncho(390)
    render(<PortalPaciente {...base} citas={[cita()]} parametrizacion={{ permitirReagendarPaciente: true, horasAntesReagendar: 2 }} />)
    await resumen()
    const boleto = screen.getByRole("region", { name: "Tu próxima cita" })
    expect(within(boleto).getByRole("button", { name: "Reagendar" })).toBeInTheDocument()
    expect(within(boleto).getByRole("button", { name: "Cancelar cita" })).toBeInTheDocument()
    fireEvent.click(within(boleto).getByRole("button", { name: "Ver el detalle de tu próxima cita" }))
    const ventana = await screen.findByRole("dialog", { name: "Tu cita" })
    expect(within(ventana).getByRole("button", { name: /Reagendar/ })).toBeInTheDocument()
    fireEvent.click(within(ventana).getByRole("button", { name: "Cancelar cita" }))
    expect(await screen.findByRole("dialog", { name: "¿Cancelar esta cita?" })).toBeInTheDocument()
  })

  it("la próxima cita abre su detalle completo: fecha, hora, motivo, profesional, dirección y si está confirmada", async () => {
    datos.misCitasDetalle.mockResolvedValue({ disponible: true, porCita: { ci1: { profesional: "Dra. Prueba", confirmadaAt: "2099-03-01T10:00:00Z", consultaId: null, calificacion: null } } })
    render(<PortalPaciente {...base} citas={[cita()]} parametrizacion={{ opticaDireccion: "Av. Principal 123" }} />)
    await resumen()
    fireEvent.click(await screen.findByRole("button", { name: "Ver el detalle de tu próxima cita" }))
    const ventana = await screen.findByRole("dialog", { name: "Tu cita" })
    for (const t of ["marzo de 2099", "03:00 PM", "Consulta General", "Dra. Prueba", "Av. Principal 123", "Confirmada"]) expect(ventana).toHaveTextContent(t)
  })

  it("«Tus lentes» abre el pedido: qué lentes, la montura, el comprobante, el saldo y cómo retirarlos", async () => {
    datos.misOrdenes.mockResolvedValue({ ordenes: [orden()], disponible: true })
    datos.misCompras.mockResolvedValue({ compras: [compraConSaldo], error: null })
    render(<PortalPaciente {...base} parametrizacion={{ opticaDireccion: "Av. Principal 123" }} />)
    fireEvent.click(await screen.findByRole("button", { name: /Ver el detalle del pedido/ }))
    const ventana = await screen.findByRole("dialog", { name: "Tu pedido de lentes" })
    for (const t of ["Lentes progresivos", "Ray-Ban", "CV-0021", "Debes $145.00", "Cómo retirarlos", "Av. Principal 123"]) expect(ventana).toHaveTextContent(t)
    expect(within(ventana).getByRole("list", { name: "Seguimiento de tus lentes" })).toBeInTheDocument()
  })

  it("«Tu graduación» abre la receta completa", async () => {
    render(<PortalPaciente {...base} />)
    await resumen()
    fireEvent.click(await screen.findByRole("button", { name: "Ver tu receta completa" }))
    const ventana = await screen.findByRole("dialog", { name: /Receta del/ })
    expect(ventana).toHaveTextContent("Ojo derecho")
    expect(ventana).toHaveTextContent("1.50")
  })

  it("el saldo abre las compras con saldo y el historial de abonos", async () => {
    datos.misCompras.mockResolvedValue({ compras: [{ ...compraConSaldo, abonos: [{ fecha: "2026-10-08", monto: 100 }, { fecha: "2026-10-12", monto: 20 }] }], error: null })
    render(<PortalPaciente {...base} />)
    fireEvent.click(await screen.findByRole("button", { name: /Tienes \$145.00 por pagar/ }))
    const ventana = await screen.findByRole("dialog", { name: "Tu saldo por pagar" })
    for (const t of ["CV-0021", "Debes $145.00", "Historial de abonos", "$100.00", "$20.00"]) expect(ventana).toHaveTextContent(t)
  })

  it("el próximo control abre por qué se recomienda y el botón para agendarlo", async () => {
    datos.miControl.mockResolvedValue({ ultima_consulta: "2099-01-01", proximo_control_dias: 90, de_alta: false })
    render(<PortalPaciente {...base} />)
    fireEvent.click(await screen.findByRole("button", { name: /Ver por qué se recomienda/ }))
    const ventana = await screen.findByRole("dialog", { name: "Tu próximo control" })
    expect(ventana).toHaveTextContent("¿Por qué se recomienda?")
    fireEvent.click(within(ventana).getByRole("button", { name: /Agendar control/ }))
    expect(await screen.findByRole("dialog", { name: "Agendar cita" })).toBeInTheDocument()
  })

  it("la franja de la óptica abre el horario completo, la dirección y el mapa", async () => {
    render(<PortalPaciente {...base} parametrizacion={{ opticaDireccion: "Av. Principal 123", opticaTelefono: "0991234567" }} disponibilidad={{ horarioSemanal: { lunes: { manana: { activo: true, inicio: "09:00", fin: "13:00" } } } }} />)
    await resumen()
    fireEvent.click(await screen.findByRole("button", { name: /Ver el horario completo/ }))
    const ventana = await screen.findByRole("dialog", { name: "Óptica Prueba" })
    expect(ventana).toHaveTextContent("Horario de atención")
    expect(ventana).toHaveTextContent("Av. Principal 123")
    expect(within(ventana).getByTitle(/Mapa de Óptica Prueba/)).toBeInTheDocument()
  })

  it("cada compra abre su detalle, y cada cita anterior y cada receta anterior abren el suyo", async () => {
    datos.misCompras.mockResolvedValue({ compras: [{ ...compraConSaldo, abonos: [{ fecha: "2026-10-08", monto: 120 }] }], error: null })
    render(<PortalPaciente {...base} citas={[cita({ id: "ci0", fecha: "2020-01-10", estado: "Atendida" })]} consultas={[consulta(), consulta({ id: "c0", fecha: "2025-04-01" })]} />)
    await resumen()
    irA("Mis compras")
    fireEvent.click((await screen.findAllByRole("button", { name: /Ver el detalle de tu compra CV-0021/ }))[0])
    expect(await screen.findByRole("dialog", { name: "Compra CV-0021" })).toHaveTextContent("Historial de abonos")
    fireEvent.click(screen.getAllByRole("button", { name: "Cerrar" }).pop())
    irA("Mis citas")
    fireEvent.click(await screen.findByRole("button", { name: "Todas" }))
    fireEvent.click(await screen.findByRole("button", { name: /Ver el detalle de tu cita del/ }))
    expect(await screen.findByRole("dialog", { name: "Tu cita" })).toBeInTheDocument()
    fireEvent.click(screen.getAllByRole("button", { name: "Cerrar" }).pop())
    irA("Mi receta")
    fireEvent.click(await screen.findByRole("button", { name: /Elegir otra receta/ }))
    fireEvent.click(within(screen.getByRole("listbox", { name: "Recetas del paciente" })).getByRole("option", { name: /1 de abril de 2025/ }))
    expect(screen.getByRole("button", { name: /Elegir otra receta/ })).toHaveTextContent("Receta del 1 de abril de 2025")
  })

  it("la campanita y la cuenta del paciente están en la cabecera de todas las pantallas (laptop)", async () => {
    render(<PortalPaciente {...base} />)
    await resumen()
    for (const pantalla of ["Mis citas", "Mi receta", "Mis compras", "Mis datos"]) {
      irA(pantalla)
      expect(await screen.findByRole("button", { name: /Mi cuenta/ })).toBeInTheDocument()
      expect(screen.getByRole("button", { name: /Avisos/ })).toBeInTheDocument()
    }
  })

  it("el motivo de la cita se abre como menú flotante encima del calendario, sin empujar el contenido", async () => {
    render(<PortalPaciente {...base} />)
    await resumen()
    fireEvent.click(screen.getAllByRole("button", { name: "Agendar cita" })[0])
    fireEvent.click(await screen.findByRole("combobox", { name: "Motivo de la cita" }))
    const lista = screen.getByRole("listbox", { name: "Motivo de la cita" })
    expect(lista.className).toMatch(/\babsolute\b/)
    expect(lista.className).toMatch(/\bz-30\b/)
  })
})

describe("Solicitar lentes nuevos (Mis compras)", () => {
  const solicitud = (extra = {}) => ({ id: "s1", interes: "montura_nueva", comentario: "Liviano", creada: "2026-10-18T15:00:00Z", cerrada: null, estado: "recibida", ...extra })
  afterEach(() => { datos.misSolicitudesLentes.mockImplementation(async () => ({ disponible: true, lista: [] })); datos.solicitarLentes.mockClear() })

  it("el paciente elige UNA opción, deja un comentario y envía; luego ve su solicitud «Recibida»", async () => {
    datos.misSolicitudesLentes.mockImplementationOnce(async () => ({ disponible: true, lista: [] })).mockImplementation(async () => ({ disponible: true, lista: [solicitud()] }))
    render(<PortalPaciente {...base} />)
    await resumen()
    irA("Mis compras")
    fireEvent.click(await screen.findByRole("button", { name: "Solicitar lentes nuevos" }))
    const ventana = await screen.findByRole("dialog", { name: "Solicitar lentes nuevos" })
    expect(within(ventana).getAllByRole("radio")).toHaveLength(4)
    fireEvent.click(within(ventana).getByRole("button", { name: "Enviar solicitud" }))
    expect(await within(ventana).findByRole("alert")).toHaveTextContent("Elige qué te interesa.")
    expect(datos.solicitarLentes).not.toHaveBeenCalled()
    fireEvent.click(within(ventana).getByRole("radio", { name: /Una montura nueva/ }))
    fireEvent.change(within(ventana).getByRole("textbox"), { target: { value: "Liviano" } })
    fireEvent.click(within(ventana).getByRole("button", { name: "Enviar solicitud" }))
    await waitFor(() => expect(datos.solicitarLentes).toHaveBeenCalledWith("p1", "tok", "montura_nueva", "Liviano"))
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Solicitar lentes nuevos" })).not.toBeInTheDocument())
    const fila = await screen.findByRole("button", { name: /Ver tu solicitud del .*Una montura nueva, Recibida/ })
    expect(fila).toBeInTheDocument()
    // con una solicitud en curso no se puede enviar otra
    expect(screen.getByRole("button", { name: "Solicitar lentes nuevos" })).toBeDisabled()
    fireEvent.click(fila)
    expect(await screen.findByRole("dialog", { name: "Tu solicitud" })).toHaveTextContent("La óptica recibió tu solicitud y te contactará pronto.")
  })

  it("los tres estados se dicen en palabras simples: Recibida, En atención y Atendida (y con la última cerrada se puede pedir otra)", async () => {
    datos.misSolicitudesLentes.mockImplementation(async () => ({ disponible: true, lista: [solicitud({ id: "s3", estado: "atendida", interes: "lentes_de_sol" }), solicitud({ id: "s2", estado: "en_atencion", interes: "lentes_de_contacto" })] }))
    render(<PortalPaciente {...base} />)
    await resumen()
    irA("Mis compras")
    const lista = await screen.findByRole("list", { name: "Tus solicitudes de lentes" })
    expect(within(lista).getByText("Atendida")).toBeInTheDocument()
    expect(within(lista).getByText("En atención")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Solicitar lentes nuevos" })).toBeDisabled() // una sigue «en atención»
  })

  it("si la base todavía no lo ofrece, la tarjeta no aparece", async () => {
    datos.misSolicitudesLentes.mockImplementation(async () => ({ disponible: false, lista: [] }))
    render(<PortalPaciente {...base} />)
    await resumen()
    irA("Mis compras")
    await screen.findByRole("heading", { name: "Mis compras" })
    expect(screen.queryByRole("button", { name: "Solicitar lentes nuevos" })).not.toBeInTheDocument()
  })
})

describe("«Qué llevar a tu cita» en el boleto de la próxima cita", () => {
  for (const ancho of [320, 390, 1366]) {
    it(`con una cita pendiente el Inicio se dibuja y dice qué llevar (${ancho} px)`, async () => {
      ponerAncho(ancho)
      render(<PortalPaciente {...base} citas={[cita()]} />)
      const boleto = await screen.findByRole("region", { name: "Tu próxima cita" })
      expect(within(boleto).getByRole("list", { name: "Qué llevar a tu cita" })).toHaveTextContent("Tus lentes actuales")
      expect(within(boleto).getByRole("list", { name: "Qué llevar a tu cita" })).toHaveTextContent("Llega 10 minutos antes")
    })
  }
  it("una cita que ya no está pendiente no pide llevar nada", async () => {
    ponerAncho(1366)
    render(<PortalPaciente {...base} citas={[cita({ estado: "Atendida", fecha: "2020-01-01" })]} />)
    await resumen()
    expect(screen.queryByRole("list", { name: "Qué llevar a tu cita" })).not.toBeInTheDocument()
  })
})

describe("Descargar mis datos está en el menú de la cuenta", () => {
  it("el menú de la cuenta (laptop) ofrece Mis datos, Descargar mis datos y Cerrar sesión, y descargar baja el archivo con la sesión del paciente", async () => {
    ponerAncho(1366)
    render(<PortalPaciente {...base} />)
    await resumen()
    fireEvent.click(screen.getByRole("button", { name: /Mi cuenta/ }))
    const menu = screen.getByRole("menu", { name: "Mi cuenta" })
    expect(within(menu).getAllByRole("menuitem").map((m) => m.textContent.trim())).toEqual(["Mis datos", "Descargar mis datos", "Cerrar sesión"])
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Descargar mis datos" }))
    await waitFor(() => expect(datos.descargarMisDatosPaciente).toHaveBeenCalledWith(expect.objectContaining({ usuario: expect.objectContaining({ id: "p1", token: "tok" }) })))
    expect(await screen.findByText("Descargamos tus datos en un archivo.")).toBeInTheDocument()
  })
})

describe("Pagar por transferencia", () => {
  const banco = { banco: "Banco Pruebas", tipo_cuenta: "Ahorros", numero: "1234567890", titular: "Óptica de pruebas", documento: "0999999999" }
  const conBanco = (pagos = []) => datos.misDatosTransferencia.mockImplementation(async () => ({ disponible: true, datos: banco, pagos }))
  afterEach(() => { datos.misDatosTransferencia.mockImplementation(async () => ({ disponible: false, datos: null, pagos: [] })); datos.reportarPagoTransferencia.mockClear() })

  it("el paciente ve los datos bancarios, sube su comprobante con el monto y queda «en verificación»", async () => {
    datos.misCompras.mockResolvedValue({ compras: [compraConSaldo], error: null })
    conBanco()
    render(<PortalPaciente {...base} />)
    await resumen()
    // desde «Pendiente para ti»
    fireEvent.click(await screen.findByRole("button", { name: "Pagar por transferencia" }))
    const ventana = await screen.findByRole("dialog", { name: "Pagar por transferencia" })
    expect(ventana).toHaveTextContent("Banco Pruebas")
    expect(ventana).toHaveTextContent("1234567890")
    // sin archivo no deja enviar
    fireEvent.click(within(ventana).getByRole("button", { name: "Enviar comprobante" }))
    expect(await within(ventana).findByRole("alert")).toHaveTextContent("Elige la foto o el PDF")
    // un monto mayor a lo que debe tampoco
    const monto = within(ventana).getByLabelText(/¿Cuánto transferiste\?/)
    fireEvent.change(monto, { target: { value: "500" } })
    fireEvent.click(within(ventana).getByRole("button", { name: "Enviar comprobante" }))
    expect(await within(ventana).findByRole("alert")).toHaveTextContent("no puede ser mayor a lo que debes")
    fireEvent.change(monto, { target: { value: "100" } })
    fireEvent.change(within(ventana).getByLabelText(/Elegir la foto o el PDF/), { target: { files: [new File(["%PDF-1.4 contenido de prueba"], "comprobante.pdf", { type: "application/pdf" })] } })
    fireEvent.click(within(ventana).getByRole("button", { name: "Enviar comprobante" }))
    await waitFor(() => expect(datos.reportarPagoTransferencia).toHaveBeenCalledWith("p1", "tok", expect.objectContaining({ facturaId: "f1", monto: 100, archivo: expect.objectContaining({ nombre: "comprobante.pdf", tipo: "application/pdf" }) })))
    expect(await within(ventana).findByRole("status")).toHaveTextContent("Recibimos tu comprobante")
  })

  it("el detalle del saldo muestra «Pago en verificación», «Pago confirmado» o el motivo del rechazo", async () => {
    datos.misCompras.mockResolvedValue({ compras: [compraConSaldo], error: null })
    conBanco([
      { id: "t1", facturaId: "f1", monto: 20, estado: "por_verificar", motivoRechazo: "", creadoEn: "2026-10-17T15:00:00Z", revisadoEn: null },
      { id: "t2", facturaId: "f1", monto: 30, estado: "rechazado", motivoRechazo: "No aparece en el banco", creadoEn: "2026-10-15T15:00:00Z", revisadoEn: "2026-10-16T15:00:00Z" },
      { id: "t3", facturaId: "f1", monto: 40, estado: "confirmado", motivoRechazo: "", creadoEn: "2026-10-10T15:00:00Z", revisadoEn: "2026-10-11T15:00:00Z" },
    ])
    render(<PortalPaciente {...base} />)
    await resumen()
    irA("Mis compras")
    fireEvent.click(await screen.findByRole("button", { name: /Por pagar.*|Ver tus compras con saldo/ }))
    const detalle = await screen.findByRole("dialog", { name: "Tu saldo por pagar" })
    const lista = within(detalle).getByRole("list", { name: "Pagos que reportaste por transferencia" })
    expect(lista).toHaveTextContent("Pago en verificación")
    expect(lista).toHaveTextContent("Pago confirmado")
    expect(lista).toHaveTextContent("Pago rechazado")
    expect(lista).toHaveTextContent("Motivo: No aparece en el banco")
  })

  it("sin datos bancarios de la óptica no se ofrece", async () => {
    datos.misCompras.mockResolvedValue({ compras: [compraConSaldo], error: null })
    render(<PortalPaciente {...base} />)
    await resumen()
    expect(screen.queryByRole("button", { name: "Pagar por transferencia" })).not.toBeInTheDocument()
  })
})
