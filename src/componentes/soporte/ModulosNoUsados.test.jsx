import React from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react"

const datos = vi.hoisted(() => ({ leerModulosNoUsados: vi.fn(), volverAUsarModulo: vi.fn() }))
vi.mock("../../utilidades/soporteDatos", () => datos)
vi.mock("../../lib/supabaseClient", () => ({ supabase: { rpc: vi.fn() } }))

import ModulosNoUsados from "./ModulosNoUsados"

beforeEach(() => { Object.values(datos).forEach((f) => f.mockReset()) })

describe("Configuración › Módulos que no usamos", () => {
  it("lista los módulos que la óptica marcó, con quién y cuándo, y deja volver a usarlos", async () => {
    datos.leerModulosNoUsados.mockResolvedValueOnce({ datos: [{ modulo: "ventas", marcado_nombre: "Andrés Mora", marcado_en: "2026-10-12T15:00:00Z" }] })
    datos.leerModulosNoUsados.mockResolvedValueOnce({ datos: [] })
    datos.volverAUsarModulo.mockResolvedValue({ datos: true })
    const onExito = vi.fn()
    render(<ModulosNoUsados onExito={onExito} onError={vi.fn()} />)
    const s = await screen.findByRole("region", { name: "Módulos que no usamos" })
    const fila = await within(s).findByText("Ventas")
    expect(fila.closest("li").textContent).toMatch(/Marcado el 12 oct( \d{4})? por Andrés Mora/)
    fireEvent.click(within(s).getByRole("button", { name: "Volver a usar Ventas" }))
    await waitFor(() => expect(datos.volverAUsarModulo).toHaveBeenCalledWith("ventas"))
    await waitFor(() => expect(onExito).toHaveBeenCalledWith("Ventas vuelve a contarse como un módulo que usan."))
    expect(await within(s).findByText(/Todavía no marcaste ningún módulo como no usado/)).toBeInTheDocument()
  })

  it("sin ninguno, lo dice y explica cómo se marca", async () => {
    datos.leerModulosNoUsados.mockResolvedValue({ datos: [] })
    render(<ModulosNoUsados />)
    expect(await screen.findByText(/Si el soporte te ofrece ayuda con uno que no usan, puedes decirlo desde esa conversación/)).toBeInTheDocument()
  })

  it("si no se pudo leer, lo dice y deja reintentar; si no se pudo deshacer, avisa", async () => {
    datos.leerModulosNoUsados.mockResolvedValueOnce({ error: "No se pudieron leer los módulos que no usan.", datos: [] })
    datos.leerModulosNoUsados.mockResolvedValueOnce({ datos: [{ modulo: "crm", marcado_nombre: "", marcado_en: "2026-10-12T15:00:00Z" }] })
    datos.volverAUsarModulo.mockResolvedValue({ error: "No se pudo deshacer. Vuelve a intentarlo." })
    const onError = vi.fn()
    render(<ModulosNoUsados onError={onError} />)
    expect(await screen.findByRole("alert")).toHaveTextContent("No se pudieron leer")
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }))
    fireEvent.click(await screen.findByRole("button", { name: "Volver a usar CRM y fidelización" }))
    await waitFor(() => expect(onError).toHaveBeenCalledWith("No se pudo deshacer. Vuelve a intentarlo."))
  })
})
