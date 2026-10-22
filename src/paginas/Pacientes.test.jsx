import React from "react"
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
// Sin base de datos: ninguna prueba toca una base real (aunque haya un .env.local).
vi.mock("../lib/supabaseClient", () => ({ supabase: null }))
import Pacientes from "./Pacientes"
import { ProveedorEscribirPorWhatsApp } from "../componentes/EscribirPorWhatsApp"
import { useContactar } from "../componentes/useContactar"

beforeAll(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-22T15:00:00-05:00")) })
afterAll(() => { vi.useRealTimers() })

const admin = { id: "u1", rol: "admin", nombre: "Ana", opticaId: "o1", opticaNombre: "Óptica Demo" }
const diego = { id: "p1", nombre: "Diego Alarcón", cedula: "1314160654", telefono: "0980525195", correo: "diego@gmail.com", fechaRegistro: "2025-04-10", fecha_nacimiento: "1989-10-07", estadoClinico: "Activo", tieneCuenta: true }
const consulta = { id: "k1", pacienteId: "p1", paciente: "Diego Alarcón", fecha: "2026-10-07", citaId: "c2", motivo: "Consulta general", diagnostico: "Astigmatismo", indicaciones: "usar lentes todo el día", profesionalNombre: "Paula Andrade", creadoEn: "2026-10-07T15:00:00Z", od: { esfera: "0.25", cilindro: "-0.75", eje: "10" }, oi: { esfera: "0.25", cilindro: "-1.00", eje: "170" }, proximoControlDias: 180 }
const citas = [
  { id: "c1", pacienteId: "p1", paciente: "Diego Alarcón", fecha: "2026-10-21", hora: "10:00 AM", estado: "No Asistió", motivo: "Examen de control" },
  { id: "c2", pacienteId: "p1", paciente: "Diego Alarcón", fecha: "2026-10-07", hora: "10:00 AM", estado: "Atendida", motivo: "Consulta general", atendidoPor: "u1" },
]
const factura = { id: "f1", numero: 21, pacienteId: "p1", estado: "pendiente_pago", montoTotal: 265, creadoEn: "2026-10-08T15:00:00Z", lineas: [{ descripcion: "Lentes progresivos" }, { descripcion: "Montura Ray-Ban" }] }

describe("Perfil del paciente (las cuatro pestañas, con la cabecera única)", () => {
  it("abre el perfil y recorre Resumen, Citas, Diagnóstico y Compras sin romperse", () => {
    render(<Pacientes usuario={admin} pacientes={[diego]} setPacientes={() => {}} consultas={[consulta]} setConsultas={() => {}} citas={citas} setCitas={() => {}} facturasVenta={[factura]} setFacturasVenta={() => {}} equipo={[{ id: "u1", nombre: "Ana" }]} abonos={[{ id: "a1", facturaId: "f1", monto: 120, fecha: "2026-10-09" }]} accionInicial={{ accion: "historial", pacienteId: "p1" }} />)
    return Promise.resolve().then(async () => {
      let abrir = screen.queryAllByRole("button", { name: /Ver perfil 360/ })[0]
      if (abrir) fireEvent.click(abrir)
      const cabecera = await screen.findByRole("banner", { name: "Perfil del paciente" })
      expect(cabecera).toHaveTextContent("Diego Alarcón")
      expect(cabecera).toHaveTextContent("37 años")
      expect(cabecera).toHaveTextContent("con acceso al portal")
      const panel = () => screen.getByRole("tabpanel")
      expect(within(panel()).getByRole("region", { name: "Datos del paciente" })).toHaveTextContent("Por su cuenta")
      expect(within(panel()).getByRole("region", { name: "Fidelización" })).toBeInTheDocument()
      fireEvent.click(screen.getByRole("tab", { name: /Citas/ }))
      expect(within(panel()).getByRole("region", { name: "Asistencia a sus citas" })).toHaveTextContent("1 de 2 citas atendidas (50 %)")
      expect(within(panel()).getByRole("region", { name: "Historial de citas" })).toHaveTextContent("Astigmatismo")
      fireEvent.click(screen.getByRole("tab", { name: /Diagnóstico/ }))
      expect(within(panel()).getByRole("region", { name: "Refracción final" })).toHaveTextContent("+0.25")
      fireEvent.click(screen.getByRole("tab", { name: /Compras/ }))
      expect(within(panel()).getByRole("region", { name: "Compras del paciente" })).toHaveTextContent("Saldo $145.00")
    })
  })
})

// Como en el Dashboard: la ventana de Contactar es una sola y la ofrece el contexto.
function ConContactar(props) {
  const { escribir, ventana } = useContactar({ plantillas: {}, opticaNombre: "Óptica Demo", consultas: props.consultas, contactarDeAviso: async () => ({ ok: true }), avisar: () => {} })
  return <ProveedorEscribirPorWhatsApp value={escribir}><Pacientes {...props} />{ventana}</ProveedorEscribirPorWhatsApp>
}

describe("Citas del perfil: asistencia, ciclo de control y Contactar", () => {
  const faltas = [
    { id: "c1", pacienteId: "p1", paciente: "Diego Alarcón", fecha: "2026-10-21", hora: "10:00 AM", estado: "No Asistió", motivo: "Examen de control" },
    { id: "c3", pacienteId: "p1", paciente: "Diego Alarcón", fecha: "2026-09-01", hora: "10:00 AM", estado: "No Asistió", motivo: "Examen de control" },
    { id: "c2", pacienteId: "p1", paciente: "Diego Alarcón", fecha: "2026-04-07", hora: "10:00 AM", estado: "Atendida", motivo: "Consulta general", atendidoPor: "u1" },
  ]
  const montar = () => render(<ConContactar usuario={admin} pacientes={[diego]} setPacientes={() => {}} consultas={[{ ...consulta, fecha: "2026-04-07" }]} setConsultas={() => {}} citas={faltas} setCitas={() => {}} facturasVenta={[]} setFacturasVenta={() => {}} equipo={[{ id: "u1", nombre: "Ana" }]} abonos={[]} accionInicial={{ accion: "historial", pacienteId: "p1" }} />)
  it("faltó a sus dos últimas citas: «Contactar» abre la ventana con el mensaje de la plantilla y al enviar abre WhatsApp", async () => {
    const abrir = vi.spyOn(window, "open").mockImplementation(() => null)
    montar()
    const abrirPerfil = screen.queryAllByRole("button", { name: /Ver perfil 360/ })[0]
    if (abrirPerfil) fireEvent.click(abrirPerfil)
    await screen.findByRole("banner", { name: "Perfil del paciente" })
    fireEvent.click(screen.getByRole("tab", { name: /Citas/ }))
    const tarjeta = screen.getByRole("region", { name: "Asistencia a sus citas" })
    expect(tarjeta).toHaveTextContent("1 de 3 citas atendidas (33 %)")
    expect(within(tarjeta).getByRole("alert")).toHaveTextContent("Faltó a sus 2 últimas citas.")
    fireEvent.click(within(tarjeta).getByRole("button", { name: "Contactar" }))
    const v = await screen.findByRole("dialog", { name: "Contactar" })
    const texto = within(v).getByLabelText(/Mensaje/).value
    expect(texto).toContain("Hola Diego Alarcón")
    expect(texto).toMatch(/21 de octubre/)
    expect(abrir).not.toHaveBeenCalled()
    fireEvent.click(within(v).getByRole("button", { name: "Enviar por WhatsApp" }))
    expect(abrir).toHaveBeenCalledTimes(1)
    abrir.mockRestore()
  })
  it("pulsar la tarjeta abre el detalle de su asistencia y los puntos de la leyenda filtran el historial", async () => {
    montar()
    const abrirPerfil = screen.queryAllByRole("button", { name: /Ver perfil 360/ })[0]
    if (abrirPerfil) fireEvent.click(abrirPerfil)
    await screen.findByRole("banner", { name: "Perfil del paciente" })
    fireEvent.click(screen.getByRole("tab", { name: /Citas/ }))
    fireEvent.click(screen.getByRole("button", { name: /Asistencia a sus citas: ver el detalle/ }))
    const v = await screen.findByRole("dialog", { name: "Asistencia a sus citas" })
    expect(v).toHaveTextContent("No efectuadas · 2")
    fireEvent.click(within(v).getAllByRole("button", { name: "Cerrar" }).at(-1))
    fireEvent.click(screen.getByRole("button", { name: "2 no efectuadas" }))
    const h = screen.getByRole("region", { name: "Historial de citas" })
    expect(h).toHaveTextContent("Historial de citas · 2 de 3")
    fireEvent.click(within(h).getByRole("button", { name: /Quitar el filtro No efectuadas/ }))
    expect(screen.getByRole("region", { name: "Historial de citas" })).toHaveTextContent("Historial de citas · 3")
  })
  it("sin consultas ni control: «Sin control recomendado»", async () => {
    render(<ConContactar usuario={admin} pacientes={[{ ...diego, estadoClinico: "De alta" }]} setPacientes={() => {}} consultas={[]} setConsultas={() => {}} citas={[{ id: "c9", pacienteId: "p1", paciente: "Diego Alarcón", fecha: "2026-10-01", hora: "10:00 AM", estado: "Cancelada", motivo: "Consulta general" }]} setCitas={() => {}} facturasVenta={[]} setFacturasVenta={() => {}} equipo={[]} abonos={[]} accionInicial={{ accion: "historial", pacienteId: "p1" }} />)
    const abrirPerfil = screen.queryAllByRole("button", { name: /Ver perfil 360/ })[0]
    if (abrirPerfil) fireEvent.click(abrirPerfil)
    await screen.findByRole("banner", { name: "Perfil del paciente" })
    fireEvent.click(screen.getByRole("tab", { name: /Citas/ }))
    expect(screen.getByRole("region", { name: "Su ciclo de control" })).toHaveTextContent("Sin control recomendado")
  })
})

describe("«Atender» no duplica la atención de hoy", () => {
  const hoy = "2026-10-22"
  const montar = (citasHoy, onIrAFichaClinica = vi.fn()) => {
    render(<Pacientes usuario={admin} pacientes={[diego]} setPacientes={() => {}} consultas={[]} setConsultas={() => {}} citas={citasHoy} setCitas={() => {}} facturasVenta={[]} setFacturasVenta={() => {}} equipo={[{ id: "u1", nombre: "Ana" }]} abonos={[]} onIrAFichaClinica={onIrAFichaClinica} accionInicial={{ accion: "historial", pacienteId: "p1" }} />)
    return onIrAFichaClinica
  }
  const abrirPerfil = async () => {
    const b = screen.queryAllByRole("button", { name: /Ver perfil 360/ })[0]
    if (b) fireEvent.click(b)
    await screen.findByRole("banner", { name: "Perfil del paciente" })
  }
  const cita = (id, estado, hora = "10:00 AM") => ({ id, pacienteId: "p1", paciente: "Diego Alarcón", fecha: hoy, hora, estado, motivo: "Consulta general" })

  it("si ya se atendió hoy, «Atender» pregunta antes de registrar otra consulta y cancelar no crea nada", async () => {
    const ficha = montar([cita("c1", "Atendida")])
    await abrirPerfil()
    fireEvent.click(screen.getByRole("button", { name: "Atender" }))
    const v = await screen.findByRole("dialog", { name: "Otra consulta hoy" })
    expect(v).toHaveTextContent("Este paciente ya se atendió hoy. ¿Registrar otra consulta?")
    fireEvent.click(within(v).getByRole("button", { name: "Cancelar" }))
    expect(screen.queryByRole("dialog", { name: "Otra consulta hoy" })).not.toBeInTheDocument()
    expect(ficha).not.toHaveBeenCalled()
  })
  it("con una atención de hoy en curso se continúa esa: sin preguntar y sin crear otra cita", async () => {
    montar([cita("c1", "En Atención")])
    await abrirPerfil()
    expect(screen.queryByRole("dialog", { name: "Otra consulta hoy" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Seguir atendiendo" })).toBeInTheDocument()
  })
  it("sin ninguna atención hoy no pregunta nada", async () => {
    montar([])
    await abrirPerfil()
    expect(screen.getByRole("button", { name: "Atender" })).toBeInTheDocument()
    expect(screen.queryByRole("dialog", { name: "Otra consulta hoy" })).not.toBeInTheDocument()
  })
})
