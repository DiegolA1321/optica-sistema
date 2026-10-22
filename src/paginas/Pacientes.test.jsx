import React from "react"
import { describe, it, expect, vi, beforeAll, afterAll } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
// Sin base de datos: ninguna prueba toca una base real (aunque haya un .env.local).
vi.mock("../lib/supabaseClient", () => ({ supabase: null }))
import Pacientes from "./Pacientes"

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
      expect(within(panel()).getByRole("region", { name: "Visitas por año" })).toBeInTheDocument()
      expect(within(panel()).getByRole("region", { name: "Historial de citas" })).toHaveTextContent("Astigmatismo")
      fireEvent.click(screen.getByRole("tab", { name: /Diagnóstico/ }))
      expect(within(panel()).getByRole("region", { name: "Refracción final" })).toHaveTextContent("+0.25")
      fireEvent.click(screen.getByRole("tab", { name: /Compras/ }))
      expect(within(panel()).getByRole("region", { name: "Compras del paciente" })).toHaveTextContent("Saldo $145.00")
    })
  })
})
