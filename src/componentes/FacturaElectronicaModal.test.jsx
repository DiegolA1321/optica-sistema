import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import FacturaElectronicaModal from "./FacturaElectronicaModal"
import { digitoVerificador } from "../utilidades/facturaElectronica"

const api = vi.hoisted(() => ({
  guardarFacturaElectronica: vi.fn(async () => ({ error: null })),
  leerFacturaElectronica: vi.fn(async () => ({ datos: null, archivos: { pdf: null, xml: null }, eventos: [] })),
}))
vi.mock("../utilidades/facturaElectronicaApi", () => api)

const base = "04102026" + "01" + "1790000000001" + "1" + "001001" + "000001216" + "12345678" + "1"
const clave = base + digitoVerificador(base)
const factura = { id: "f1", numero: 17, creadoEn: "2026-10-04T15:00:00Z", facturaElectronica: "" }
const archivo = (nombre, contenido, tipo) => new File([contenido], nombre, { type: tipo })

const abrir = (props = {}) => {
  const onGuardado = vi.fn(), onCerrar = vi.fn()
  render(<FacturaElectronicaModal factura={factura} paciente={{ nombre: "Rosa" }} usuario={{ opticaId: "o1" }} onGuardado={onGuardado} onCerrar={onCerrar} {...props} />)
  return { onGuardado, onCerrar }
}
const escribir = (etiqueta, valor) => fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } })

const listo = () => waitFor(() => expect(screen.getByRole("button", { name: "Guardar" })).toBeEnabled())
beforeEach(() => vi.clearAllMocks())

describe("Registrar la factura electrónica", () => {
  it("revisa la clave de acceso mientras se escribe: dígito verificador y cruce con el número", () => {
    abrir()
    escribir("Número de la factura", "001-001-000001216")
    escribir(/Clave de acceso/, clave.slice(0, 48) + "0")
    expect(screen.getByRole("alert")).toHaveTextContent("el dígito verificador debería ser")
    escribir(/Clave de acceso/, clave)
    expect(screen.getByText(/dígito verificador correcto · ✓ coincide con el número 001-001-000001216/)).toBeInTheDocument()
    escribir("Número de la factura", "001-001-000000999")
    expect(screen.getByRole("alert")).toHaveTextContent("es de la factura 001-001-000001216")
  })

  it("no guarda con una clave mala y dice por qué", async () => {
    const { onGuardado } = abrir()
    await listo()
    escribir("Número de la factura", "001-001-000001216")
    escribir(/Clave de acceso/, "123")
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }))
    expect(await screen.findAllByText(/49 dígitos/)).not.toHaveLength(0)
    expect(api.guardarFacturaElectronica).not.toHaveBeenCalled()
    expect(onGuardado).not.toHaveBeenCalled()
  })

  it("rechaza al elegir un archivo que no es lo que dice ser", async () => {
    abrir()
    fireEvent.change(screen.getByLabelText("RIDE (PDF)"), { target: { files: [archivo("factura.pdf", "esto no es un pdf", "application/pdf")] } })
    expect(await screen.findByText("Ese archivo no es un PDF válido.")).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText("XML autorizado"), { target: { files: [archivo("factura.txt", "<?xml version", "text/plain")] } })
    expect(await screen.findByText(/debe ser un archivo \.xml/)).toBeInTheDocument()
  })

  it("exige el número si hay clave o archivos, y guarda todo junto cuando está en regla", async () => {
    const { onGuardado, onCerrar } = abrir()
    await listo()
    escribir(/Clave de acceso/, clave)
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }))
    expect(await screen.findByText("Escribe el número de la factura electrónica.")).toBeInTheDocument()
    escribir("Número de la factura", "001-001-000001216")
    const pdf = archivo("ride.pdf", "%PDF-1.7 contenido", "application/pdf")
    fireEvent.change(screen.getByLabelText("RIDE (PDF)"), { target: { files: [pdf] } })
    await screen.findByText(/se guardará al pulsar Guardar/)
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }))
    await waitFor(() => expect(onGuardado).toHaveBeenCalledWith({ numero: "001-001-000001216", conArchivos: true }))
    expect(api.guardarFacturaElectronica).toHaveBeenCalledWith(expect.objectContaining({ opticaId: "o1", numero: "001-001-000001216", clave, pdf, xml: null }))
    expect(onCerrar).toHaveBeenCalled()
  })

  it("con solo el número (como antes) también se guarda, y un error de la base se muestra", async () => {
    api.guardarFacturaElectronica.mockResolvedValueOnce({ error: "Ese número de factura electrónica ya está registrado en otra venta." })
    const { onGuardado } = abrir()
    await listo()
    escribir("Número de la factura", "001-001-000000123")
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }))
    expect(await screen.findByText(/ya está registrado en otra venta/)).toBeInTheDocument()
    expect(onGuardado).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }))
    await waitFor(() => expect(onGuardado).toHaveBeenCalledWith({ numero: "001-001-000000123", conArchivos: false }))
  })
})
