import React, { useState } from "react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, within, fireEvent } from "@testing-library/react"

const ins = (d, h = "15:00:00") => `${d}T${h}Z`
const filas = [
  { id: "1", accion: "crear_optica", actor_id: "s1", actor_nombre: "Diego", optica_id: "o1", optica_nombre: "Óptica Real Uno", detalle: null, antes: null, despues: null, created_at: ins("2026-10-15") },
  { id: "2", accion: "entrar_como_optica", actor_id: "s1", actor_nombre: "Diego", optica_id: "o3", optica_nombre: "Óptica Demo", detalle: null, antes: null, despues: null, created_at: ins("2026-10-15", "16:00:00") },
  { id: "3", accion: "actualizar_pago", actor_id: "s2", actor_nombre: "Ana", optica_id: "o2", optica_nombre: "Óptica Real Dos", detalle: null, antes: "pendiente", despues: "vencido", created_at: ins("2026-10-14") },
  { id: "4", accion: "publicar_anuncio", actor_id: "s2", actor_nombre: "Ana", optica_id: null, optica_nombre: "Todas las ópticas", detalle: "Mantenimiento", antes: null, despues: null, created_at: ins("2026-10-14", "18:00:00") },
]
vi.mock("@/lib/config", () => ({ MODO_SAAS_VISIBLE: true }))
vi.mock("../../lib/supabaseClient", () => {
  const q = { select: () => q, gte: () => q, lte: () => q, order: () => q, limit: () => q, eq: () => q, then: (ok) => Promise.resolve({ data: filas, error: null }).then(ok) }
  return { supabase: { from: () => q } }
})

import ActividadSuperadmin from "./ActividadSuperadmin"

const opticas = [
  { id: "o1", nombre: "Óptica Real Uno" }, { id: "o2", nombre: "Óptica Real Dos" }, { id: "o3", nombre: "Óptica Demo", es_de_prueba: true },
]
const superadmins = [{ id: "s1", nombre: "Diego" }, { id: "s2", nombre: "Ana" }]

function Montado({ onAbrir = vi.fn() }) {
  const [incluir, setIncluir] = useState(false)
  return <ActividadSuperadmin opticas={opticas} superadmins={superadmins} incluirPrueba={incluir} onIncluirPrueba={setIncluir} destino={null} recarga="" usuario={{ nombre: "Diego" }} onAbrir={onAbrir} onAviso={vi.fn()} />
}

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-16T15:00:00Z")) })
afterEach(() => { vi.useRealTimers() })

const pestana = (nombre) => screen.getByRole("tab", { name: new RegExp(`^${nombre}`) })

describe("Actividad del superadmin", () => {
  it("se organiza en pestañas por tipo, cada una con su número, y las de prueba no cuentan por defecto", async () => {
    render(<Montado />)
    await screen.findByText("3 acciones")
    expect(pestana("Todas").textContent).toContain("3")
    expect(pestana("Ópticas").textContent).toContain("1")
    expect(pestana("Accesos").textContent).toContain("0") // la entrada a la Demo es de una óptica de prueba
    expect(pestana("Pagos").textContent).toContain("1")
    expect(pestana("Avisos del sistema").textContent).toContain("1")
    fireEvent.click(screen.getByRole("checkbox", { name: /Incluir ópticas de prueba/ }))
    expect(await screen.findByText("4 acciones")).toBeInTheDocument()
    expect(pestana("Accesos").textContent).toContain("1")
  })

  it("agrupa por día y cada acción dice quién, qué hizo y sobre qué", async () => {
    render(<Montado />)
    await screen.findByText("3 acciones")
    expect(screen.getAllByRole("region").length).toBe(2) // dos días con actividad
    expect(screen.getByText(/Diego/, { selector: "span" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Diego creó la óptica Óptica Real Uno/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Ana marcó el pago de Óptica Real Dos como vencido/ })).toBeInTheDocument()
  })

  it("filtra por tipo y los filtros activos se ven como etiquetas con su 'x'", async () => {
    render(<Montado />)
    await screen.findByText("3 acciones")
    fireEvent.click(pestana("Pagos"))
    expect(screen.getByText("1 acción")).toBeInTheDocument()
    const etiqueta = screen.getByText("Tipo: Pagos")
    fireEvent.click(within(etiqueta.closest("li")).getByRole("button", { name: /Quitar el filtro/ }))
    expect(screen.getByText("3 acciones")).toBeInTheDocument()
    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar en la actividad" }), { target: { value: "mantenimiento" } })
    expect(screen.getByText("1 acción")).toBeInTheDocument()
  })

  it("al pulsar una acción abre su detalle con antes y después y 'Abrir en …'", async () => {
    const onAbrir = vi.fn()
    render(<Montado onAbrir={onAbrir} />)
    await screen.findByText("3 acciones")
    fireEvent.click(screen.getByRole("button", { name: /Ana marcó el pago de Óptica Real Dos como vencido/ }))
    const ventana = await screen.findByRole("dialog")
    expect(within(ventana).getByText(/Antes · Estado del pago/)).toBeInTheDocument()
    expect(within(ventana).getByText("Pendiente")).toBeInTheDocument()
    expect(within(ventana).getByText("Vencido")).toBeInTheDocument()
    fireEvent.click(within(ventana).getByRole("button", { name: /Abrir en Ópticas/ }))
    expect(onAbrir).toHaveBeenCalledWith("opticas", expect.objectContaining({ abrir: "o2" }))
  })

  it("no ofrece editar ni borrar nada: es un registro", async () => {
    render(<Montado />)
    await screen.findByText("3 acciones")
    expect(screen.queryByRole("button", { name: /eliminar|borrar|editar/i })).toBeNull()
  })

  it("con filtros que no dejan nada, dice por qué y ofrece una acción", async () => {
    render(<Montado />)
    await screen.findByText("3 acciones")
    fireEvent.click(pestana("Leads"))
    expect(screen.getByText("Ninguna acción coincide con estos filtros.")).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Limpiar filtros" })).toHaveLength(1) // el de la barra de filtros; no se repite en el mensaje
  })
})
