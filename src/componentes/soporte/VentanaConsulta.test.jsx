import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react"

// Una oferta de ayuda (la abrió el soporte) vista por el administrador de la óptica: ver la guía, responder o decir que no usan el módulo.
const datos = vi.hoisted(() => ({
  leerConversacion: vi.fn(), marcarConsultaLeida: vi.fn(), noUsamosModulo: vi.fn(), responderConsulta: vi.fn(),
  calificarConsulta: vi.fn(), cerrarConsulta: vi.fn(), escalarConsulta: vi.fn(), reabrirConsulta: vi.fn(),
}))
vi.mock("../../utilidades/soporteDatos", () => datos)
vi.mock("../../lib/supabaseClient", () => ({ supabase: { rpc: vi.fn() } }))

import VentanaConsulta from "./VentanaConsulta"
import { mapMensajeSoporte } from "../../utilidades/soporte"

const oferta = (extra = {}) => ({
  id: "c1", numero: 62, opticaId: "o1", autorId: "sup", autorNombre: "Diego Alarcón", autorRol: "Soporte", modulo: "ventas", tipo: "ayuda", urgencia: "normal",
  asunto: "Ayuda con Ventas", descripcion: "Vimos que no usaron Ventas.", estado: "respondida", contexto: {}, ultimoMensajeDe: "soporte", respuestaSinLeer: true,
  creadaEn: "2026-10-16T15:00:00Z", actualizadaEn: "2026-10-16T15:00:00Z", reabiertaVeces: 0, destino: "superadmin", iniciadaPor: "soporte", ayudaModulo: "ventas", ...extra,
})
const admin = { id: "adm", rol: "admin", opticaId: "o1", nombre: "Andrés Mora" }
const montar = (consulta = oferta(), { usuario = admin, puedeEscribir = true, ...extra } = {}) => {
  const props = { onCambio: vi.fn(), onCerrar: vi.fn(), onVerGuia: vi.fn(), ...extra }
  render(<VentanaConsulta consulta={consulta} usuario={usuario} puedeEscribir={puedeEscribir} {...props} />)
  return props
}

beforeEach(() => {
  Object.values(datos).forEach((f) => f.mockReset())
  datos.leerConversacion.mockResolvedValue({ datos: [mapMensajeSoporte({ id: "m1", consulta_id: "c1", autor_id: "sup", autor_nombre: "Diego Alarcón", de: "soporte", cuerpo: "Vimos que no usaron Ventas.", adjuntos: [], creado_en: "2026-10-16T15:00:00Z" })] })
  datos.marcarConsultaLeida.mockResolvedValue({ datos: true })
  datos.noUsamosModulo.mockResolvedValue({ datos: true })
})

describe("oferta de ayuda: el administrador de la óptica", () => {
  it("ve que la inició el soporte y las tres opciones; abrirla baja la campanita", async () => {
    const { onCambio } = montar()
    const v = await screen.findByRole("dialog")
    expect(within(v).getAllByText("Iniciada por el soporte").length).toBeGreaterThan(0)
    const opciones = within(v).getByRole("region", { name: "Qué quieres hacer con esta ayuda" })
    expect(within(opciones).getByRole("button", { name: /Ver la guía de Ventas/ })).toBeInTheDocument()
    expect(within(opciones).getByRole("button", { name: /Responder/ })).toBeInTheDocument()
    expect(within(opciones).getByRole("button", { name: "No usamos este módulo" })).toBeInTheDocument()
    expect(await screen.findByText("Vimos que no usaron Ventas.")).toBeInTheDocument()
    await waitFor(() => expect(datos.marcarConsultaLeida).toHaveBeenCalledWith("c1"))
    await waitFor(() => expect(onCambio).toHaveBeenCalled())
  })

  it("«Ver la guía de …» entrega el módulo para abrir la Ayuda en el sistema (sin ninguna dirección escrita)", async () => {
    const { onVerGuia } = montar()
    fireEvent.click(await screen.findByRole("button", { name: /Ver la guía de Ventas/ }))
    expect(onVerGuia).toHaveBeenCalledWith("ventas")
    expect(document.body.textContent).not.toMatch(/https?:|localhost|vercel/i)
  })

  it("«Ficha clínica» se llama como en el menú", async () => {
    montar(oferta({ ayudaModulo: "consultas", asunto: "Ayuda con Ficha clínica" }))
    expect(await screen.findByRole("button", { name: /Ver la guía de Ficha clínica/ })).toBeInTheDocument()
  })

  it("«Responder» lleva al cuadro de respuesta de la misma conversación", async () => {
    montar()
    fireEvent.click(await screen.findByRole("button", { name: /^Responder$/ }))
    expect(document.activeElement).toBe(screen.getByLabelText("Tu mensaje"))
  })

  it("«No usamos este módulo» pide confirmar, dice qué pasa y lo guarda", async () => {
    const { onCambio } = montar()
    fireEvent.click(await screen.findByRole("button", { name: "No usamos este módulo" }))
    const opciones = screen.getByRole("region", { name: "Qué quieres hacer con esta ayuda" })
    expect(opciones.textContent).toMatch(/el soporte no volverá a ofrecerte ayuda con él/)
    expect(opciones.textContent).toMatch(/Puedes deshacerlo en Configuración/)
    expect(datos.noUsamosModulo).not.toHaveBeenCalled()
    fireEvent.click(within(opciones).getByRole("button", { name: "Sí, no usamos este módulo" }))
    await waitFor(() => expect(datos.noUsamosModulo).toHaveBeenCalledWith("c1"))
    await waitFor(() => expect(onCambio).toHaveBeenCalled())
  })

  it("si no se pudo guardar, lo dice y no cierra la decisión", async () => {
    datos.noUsamosModulo.mockResolvedValue({ error: "No se pudo guardar tu respuesta. Vuelve a intentarlo." })
    montar()
    fireEvent.click(await screen.findByRole("button", { name: "No usamos este módulo" }))
    fireEvent.click(screen.getByRole("button", { name: "Sí, no usamos este módulo" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudo guardar tu respuesta")
  })

  it("cancelar la confirmación no guarda nada", async () => {
    montar()
    fireEvent.click(await screen.findByRole("button", { name: "No usamos este módulo" }))
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }))
    expect(datos.noUsamosModulo).not.toHaveBeenCalled()
    expect(screen.getByRole("button", { name: "No usamos este módulo" })).toBeInTheDocument()
  })

  it("una vez resuelta, la oferta dice cómo deshacerlo y no se califica ni se reabre", async () => {
    montar(oferta({ estado: "resuelta", resueltaEn: "2026-10-17T15:00:00Z", respuestaSinLeer: false }))
    const v = await screen.findByRole("dialog")
    expect(within(v).getByText(/Ayuda cerrada/)).toBeInTheDocument()
    expect(within(v).getByText(/puedes deshacerlo en Configuración/)).toBeInTheDocument()
    expect(within(v).queryByRole("button", { name: /reabrir/ })).toBeNull()
    expect(within(v).queryByText("¿Cómo fue la atención?")).toBeNull()
    expect(within(v).queryByRole("region", { name: "Qué quieres hacer con esta ayuda" })).toBeNull()
  })
})

describe("oferta de ayuda: quien no es el administrador", () => {
  it("no ve las opciones ni la marca como leída (la decisión es del administrador)", async () => {
    montar(oferta(), { usuario: { id: "asi", rol: "asistente", opticaId: "o1", nombre: "Lucía" } })
    await screen.findByRole("dialog")
    expect(screen.queryByRole("region", { name: "Qué quieres hacer con esta ayuda" })).toBeNull()
    expect(datos.marcarConsultaLeida).not.toHaveBeenCalled()
  })

  it("el superadmin dentro de la óptica (solo lectura) tampoco decide", async () => {
    montar(oferta(), { puedeEscribir: false })
    await screen.findByRole("dialog")
    expect(screen.queryByRole("region", { name: "Qué quieres hacer con esta ayuda" })).toBeNull()
  })
})

describe("una consulta de siempre", () => {
  it("no muestra nada de ayuda ofrecida", async () => {
    montar(oferta({ iniciadaPor: "optica", ayudaModulo: null, tipo: "pregunta", autorId: "adm", asunto: "No imprime", estado: "recibida" }))
    const v = await screen.findByRole("dialog")
    expect(within(v).queryByText("Iniciada por el soporte")).toBeNull()
    expect(within(v).queryByRole("region", { name: "Qué quieres hacer con esta ayuda" })).toBeNull()
  })
})
