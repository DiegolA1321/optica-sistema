import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import BloqueFacturaElectronica from "./BloqueFacturaElectronica"

const api = vi.hoisted(() => ({
  urlDeDescarga: vi.fn(async () => ({ url: "https://storage/archivo", error: null })),
  registrarEvento: vi.fn(async () => {}),
  crearEnlaces: vi.fn(async () => ({ enlaces: [{ tipo: "pdf", url: "https://f/d?t=aaa" }, { tipo: "xml", url: "https://f/d?t=bbb" }], error: null })),
  enviarPorCorreo: vi.fn(async () => ({ error: null })),
}))
vi.mock("../../utilidades/facturaElectronicaApi", () => ({ ...api, CORREO_FACTURAS_ACTIVO: false, EVENTO_FE_CAMBIADA: "x", leerFacturaElectronica: vi.fn(), BUCKET_FACTURAS: "facturas-electronicas" }))
vi.mock("../../utilidades/logs", () => ({ registrarLog: vi.fn() }))
import { registrarLog } from "../../utilidades/logs"

const factura = { id: "f1", numero: 17, estado: "pagada", facturaElectronica: "001-001-000001216" }
const paciente = { id: "p1", nombre: "Rosa Bravo Cedeño", telefono: "0991234567" }
const usuario = { id: "u1", nombre: "Vera", opticaNombre: "Óptica Demo" }
const clave = "0410202601179000000000110010010000012161234567815"
const fe = (extra = {}) => ({ cargando: false, datos: { claveAcceso: clave, autorizadaEl: "2026-10-04" }, archivos: { pdf: { ruta: "o/f/ride.pdf", bytes: 184000 }, xml: { ruta: "o/f/factura.xml", bytes: 6000 } }, eventos: [], recargar: vi.fn(), ...extra })
const mostrar = (props = {}) => render(<BloqueFacturaElectronica factura={factura} paciente={paciente} usuario={usuario} equipo={[{ id: "u1", nombre: "Vera" }]} fe={fe()} puedeEditar onRegistrar={() => {}} onAviso={() => {}} {...props} />)

beforeEach(() => { vi.clearAllMocks(); window.open = vi.fn() })

describe("Bloque de la factura electrónica", () => {
  it("sin factura registrada lo dice y ofrece registrarla solo a quien puede editar", () => {
    const sin = { ...factura, facturaElectronica: "" }
    const { unmount } = mostrar({ factura: sin })
    expect(screen.getByText(/todavía no tiene su factura electrónica registrada/i)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Registrar la factura electrónica/ })).toBeInTheDocument()
    unmount()
    mostrar({ factura: sin, puedeEditar: false })
    expect(screen.queryByRole("button", { name: /Registrar la factura electrónica/ })).not.toBeInTheDocument()
  })

  it("muestra número, autorización y clave, y ofrece descargar el PDF y el XML", () => {
    mostrar()
    expect(screen.getByText("001-001-000001216")).toBeInTheDocument()
    expect(screen.getByText(/0410202601….*567815/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Descargar PDF \(RIDE\)/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Descargar XML/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Imprimir RIDE/ })).toBeInTheDocument()
  })

  it("quien solo puede ver descarga, pero no envía ni corrige", () => {
    mostrar({ puedeEditar: false })
    expect(screen.getByRole("button", { name: /Descargar PDF/ })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Enviar al paciente/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Corregir o reemplazar/ })).not.toBeInTheDocument()
  })

  it("cada descarga queda registrada en la base y en la actividad", async () => {
    mostrar()
    fireEvent.click(screen.getByRole("button", { name: /Descargar PDF/ }))
    await waitFor(() => expect(api.registrarEvento).toHaveBeenCalledWith("f1", "descarga_pdf", null))
    expect(api.urlDeDescarga).toHaveBeenCalledWith("o/f/ride.pdf", "factura-001-001-000001216.pdf")
    expect(registrarLog).toHaveBeenCalledWith(usuario, "ventas", "Descargó el PDF de la factura electrónica", expect.stringContaining("CV-0017"))
  })

  it("enviar por WhatsApp crea los enlaces que vencen y abre el mensaje con ellos; el correo dice por qué está apagado", async () => {
    mostrar()
    fireEvent.click(screen.getByRole("button", { name: /Enviar al paciente/ }))
    expect(screen.getByRole("button", { name: /Por correo/ })).toBeDisabled()
    expect(screen.getByText(/disponible cuando la óptica tenga su dominio de correo/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Por WhatsApp/ }))
    await waitFor(() => expect(window.open).toHaveBeenCalled())
    const enlace = decodeURIComponent(window.open.mock.calls[0][0])
    expect(enlace).toContain("https://f/d?t=aaa")
    expect(enlace).toContain("https://f/d?t=bbb")
    expect(enlace).toContain("vencen en 7 días")
    expect(registrarLog).toHaveBeenCalledWith(usuario, "ventas", "Envió por WhatsApp la factura electrónica", expect.stringContaining("Rosa Bravo Cedeño"))
  })

  it("sin teléfono no se puede enviar por WhatsApp y lo explica", () => {
    mostrar({ paciente: { ...paciente, telefono: "" } })
    fireEvent.click(screen.getByRole("button", { name: /Enviar al paciente/ }))
    expect(screen.getByRole("button", { name: /Por WhatsApp/ })).toBeDisabled()
    expect(screen.getByText(/no tiene teléfono registrado/i)).toBeInTheDocument()
  })

  it("sin archivos dice que faltan y cómo adjuntarlos", () => {
    mostrar({ fe: fe({ archivos: { pdf: null, xml: null } }) })
    expect(screen.getByText(/Todavía no hay archivos adjuntos/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Enviar al paciente/ })).not.toBeInTheDocument()
  })

  it("dice el último movimiento con su nombre", () => {
    mostrar({ fe: fe({ eventos: [{ accion: "descarga_pdf", actor_perfil: "u1", creado_en: "2026-10-12T15:00:00Z" }] }) })
    expect(screen.getByText(/Último movimiento: Vera descargó el PDF/)).toBeInTheDocument()
  })
})
