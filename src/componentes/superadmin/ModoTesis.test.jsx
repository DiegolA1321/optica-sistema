import React from "react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"

// El modo de la tesis: la capa comercial (vender el sistema a otras ópticas) está oculta.
vi.mock("@/lib/config", () => ({ MODO_SAAS_VISIBLE: false }))
vi.mock("../../lib/supabaseClient", () => {
  const q = { select: () => q, eq: () => q, gte: () => q, lte: () => Promise.resolve({ count: 0, error: null }) }
  return { supabase: { from: () => q } }
})

import ResumenNegocio from "./ResumenNegocio"
import { filtrarActividad, contarPorTipo, tiposVisibles, textoDeAccion, nombreDestino, ACCIONES_COMERCIALES } from "../../utilidades/superadminNegocio"

const ins = (d) => `${d}T15:00:00Z`
const opticas = [
  { id: "o1", nombre: "Óptica Solna Vision", slug: "solna", activa: true, estado_pago: "al_dia", created_at: ins("2026-01-10") },
  { id: "o3", nombre: "Óptica Demo", slug: "demo", activa: true, estado_pago: "al_dia", created_at: ins("2026-02-01"), es_de_prueba: true },
]
const uso = [{ optica_id: "o1", citas: 10, consultas: 6, ventas: 4, personas_activas: 3, previo: {}, modulos: { citas: 9 } }]
const actividad = [
  { id: "a1", accion: "responder_mensaje", actor_nombre: "Diego", optica_id: "o1", optica_nombre: "Óptica Solna Vision", detalle: "SOP-0001", created_at: ins("2026-10-15") },
  { id: "a2", accion: "actualizar_pago", actor_nombre: "Diego", optica_id: "o1", optica_nombre: "Óptica Solna Vision", antes: "pendiente", despues: "vencido", created_at: ins("2026-10-14") },
]
const datos = { cargando: false, facturas: [{ id: "f", optica_id: "o1", numero: "F-1", periodo: "2026-10", monto: "30", estado: "pendiente", emitida_at: ins("2026-10-02") }], eventos: [], personas: [], uso, sinServidor: false, recargar: vi.fn() }

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-16T15:00:00Z")) })
afterEach(() => { vi.useRealTimers() })

describe("modo de la tesis (capa comercial oculta)", () => {
  it("un aviso general no habla de varias ópticas y las suscripciones son acciones comerciales", () => {
    const aviso = { accion: "publicar_anuncio", optica_id: null, optica_nombre: "Todas las ópticas", detalle: "Mantenimiento" }
    expect(textoDeAccion(aviso, false)).toBe("publicó un aviso general: Mantenimiento")
    expect(nombreDestino(aviso, false)).toBe("Todo el sistema")
    expect(textoDeAccion(aviso, true)).toBe("publicó un aviso para Todas las ópticas: Mantenimiento")
    expect(ACCIONES_COMERCIALES).toEqual(expect.arrayContaining(["cambiar_suscripcion", "actualizar_pago", "generar_factura", "pagar_factura", "cambiar_estado_lead"]))
  })

  const montar = () => render(<ResumenNegocio datos={datos} opticas={opticas} leads={[{ id: 1, estado: "nuevo", created_at: ins("2026-10-03") }]} consultas={[]} cargandoSoporte={false} estadoServidor={{ estado: "operativo", latenciaMs: 300 }} incluirPrueba={false} onIncluirPrueba={vi.fn()} usuario={{}} onAbrir={vi.fn()} onEntrarComo={vi.fn()} onAviso={vi.fn()} onCrearOptica={vi.fn()} actividad={actividad} />)

  it("el Resumen es la administración técnica: estado, uso, soporte y actividad reciente", () => {
    montar()
    const titulos = [...document.querySelectorAll("section[aria-label] h2")].map((h) => h.textContent)
    expect(titulos).toEqual(["Estado del sistema", "Uso del sistema", "Soporte", "Actividad reciente"])
  })

  it("no muestra ingresos, clientes, leads, pagos, salud ni 'Crear óptica'", () => {
    montar()
    for (const t of [/Ingresos/, /Clientes/, /Leads/, /Facturado/, /Salud de las ópticas/, /suscripci/i, /Incluir ópticas de prueba/]) expect(screen.queryByText(t)).toBeNull()
    expect(screen.getByText("Incluir entornos de prueba", { exact: false })).toBeInTheDocument()
  })

  it("sí deja crear una óptica (es administración técnica) y no habla de suscripciones", () => {
    montar()
    expect(screen.getByRole("button", { name: /Crear óptica/ })).toBeInTheDocument()
  })

  it("la actividad reciente no lleva acciones de pagos", () => {
    montar()
    expect(screen.getByText(/respondió una consulta/)).toBeInTheDocument()
    expect(screen.queryByText(/marcó el pago/)).toBeNull()
  })

  it("la actividad oculta los tipos Pagos y Leads y sus acciones, con el número de las demás", () => {
    expect(tiposVisibles(false).map((t) => t.id)).toEqual(["todas", "opticas", "accesos", "soporte", "avisos", "superadmins"])
    expect(filtrarActividad(actividad, { opticas, saas: false }).map((a) => a.id)).toEqual(["a1"])
    expect(filtrarActividad(actividad, { opticas, saas: true })).toHaveLength(2)
    const n = contarPorTipo(actividad, { opticas, saas: false })
    expect(n.pagos).toBeUndefined()
    expect(n.todas).toBe(1)
  })
})
