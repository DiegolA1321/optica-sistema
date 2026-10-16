import React, { useState } from "react"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, within, fireEvent } from "@testing-library/react"

// Las visitas se cuentan en el servidor: aquí devuelven 7 en el período y 4 en el anterior.
vi.mock("@/lib/config", () => ({ MODO_SAAS_VISIBLE: true }))
vi.mock("../../lib/supabaseClient", () => {
  let llamada = 0
  const consulta = () => {
    const q = { select: () => q, eq: () => q, gte: () => q, lte: () => Promise.resolve({ count: llamada++ % 2 === 0 ? 7 : 4, error: null }) }
    return q
  }
  return { supabase: { from: consulta } }
})

import ResumenNegocio from "./ResumenNegocio"
import { saludDeLaRed, opticasDelNegocio } from "../../utilidades/superadminNegocio"
import { indicadoresSoporte, filtrarBandeja } from "../../utilidades/soporte"
import { embudoLeads } from "../../utilidades/superadminNegocio"
import { rangoDePeriodo } from "../../utilidades/reportesPeriodo"

const ins = (d) => `${d}T15:00:00Z`
const opticas = [
  { id: "o1", nombre: "Óptica Real Uno", slug: "uno", activa: true, estado_pago: "al_dia", created_at: ins("2026-01-10") },
  { id: "o2", nombre: "Óptica Real Dos", slug: "dos", activa: true, estado_pago: "vencido", created_at: ins("2026-10-05") },
  { id: "o3", nombre: "Óptica Demo", slug: "demo", activa: true, estado_pago: "al_dia", created_at: ins("2026-02-01"), es_de_prueba: true },
  { id: "o4", nombre: "Óptica Cerrada", slug: "cerrada", activa: false, estado_pago: "al_dia", created_at: ins("2026-03-01") },
]
const facturas = [
  { id: "f1", optica_id: "o1", numero: "FACT-1", periodo: "2026-10", monto: "30", estado: "pagada", emitida_at: ins("2026-10-02"), pagada_at: ins("2026-10-05") },
  { id: "f2", optica_id: "o2", numero: "FACT-2", periodo: "2026-10", monto: "30", estado: "pendiente", emitida_at: ins("2026-10-06"), pagada_at: null },
  { id: "f3", optica_id: "o3", numero: "FACT-3", periodo: "2026-10", monto: "99", estado: "pagada", emitida_at: ins("2026-10-03"), pagada_at: ins("2026-10-04") },
]
const eventos = [{ id: "e1", optica_id: "o4", accion: "suspender_optica", created_at: ins("2026-10-10") }]
const personas = [{ optica_id: "o1", activo: true, ultimo_ingreso: ins("2026-10-15") }, { optica_id: "o2", activo: true, ultimo_ingreso: ins("2026-08-01") }]
const uso = [
  { optica_id: "o1", personas_activas: 3, previo: { personas_activas: 2, modulos_en_uso: 1 }, modulos: { citas: ins("2026-10-14"), ventas: ins("2026-10-10") } },
  { optica_id: "o2", personas_activas: 0, previo: {}, modulos: {} },
  { optica_id: "o3", personas_activas: 9, previo: {}, modulos: { citas: ins("2026-10-16") } },
]
const consultas = [
  { id: "c1", numero: 1, opticaId: "o1", asunto: "No carga", estado: "recibida", urgencia: "urgente", creadaEn: ins("2026-10-10"), primeraRespuestaEn: null, resueltaEn: null, calificacion: null },
  { id: "c2", numero: 2, opticaId: "o2", asunto: "Duda", estado: "recibida", urgencia: "normal", creadaEn: ins("2026-10-11"), primeraRespuestaEn: null, resueltaEn: null, calificacion: null },
  { id: "c3", numero: 3, opticaId: "o3", asunto: "Prueba", estado: "recibida", urgencia: "normal", creadaEn: ins("2026-10-12"), primeraRespuestaEn: null, resueltaEn: null, calificacion: null },
  { id: "c4", numero: 4, opticaId: "o1", asunto: "Resuelta", estado: "resuelta", urgencia: "normal", creadaEn: ins("2026-10-08"), primeraRespuestaEn: ins("2026-10-08"), resueltaEn: ins("2026-10-09"), calificacion: 5 },
]
const leads = [
  { id: 1, nombre_optica: "Visión Norte", nombre_admin: "Ana", estado: "nuevo", created_at: ins("2026-10-03") },
  { id: 2, nombre_optica: "Óptica Sur", nombre_admin: "Luis", estado: "convertido", created_at: ins("2026-10-04") },
  { id: 3, nombre_optica: "Óptica Vieja", nombre_admin: "Eva", estado: "convertido", created_at: ins("2026-09-04") },
]

const datos = { cargando: false, facturas, eventos, personas, uso, sinServidor: false, error: "", recargar: vi.fn() }

function Montado({ onAbrir = vi.fn() }) {
  const [incluir, setIncluir] = useState(false)
  return <ResumenNegocio datos={datos} opticas={opticas} leads={leads} consultas={consultas} cargandoSoporte={false} estadoServidor={{ estado: "operativo", latenciaMs: 420 }} incluirPrueba={incluir} onIncluirPrueba={setIncluir} usuario={{ nombre: "Diego" }} onAbrir={onAbrir} onEntrarComo={vi.fn()} onAviso={vi.fn()} onCrearOptica={vi.fn()} />
}

const valorDe = (titulo) => {
  const boton = screen.getByRole("button", { name: new RegExp(`^${titulo}: `) })
  return boton.textContent
}

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-16T15:00:00Z")) })
afterEach(() => { vi.useRealTimers() })

describe("Resumen del superadmin", () => {
  it("tiene las siete secciones en el orden pedido", () => {
    render(<Montado />)
    const titulos = [...document.querySelectorAll("section[aria-label] h2")].map((h) => h.textContent)
    expect(titulos).toEqual(["Ingresos", "Clientes", "Ópticas que necesitan atención", "Uso del sistema", "Soporte", "Leads", "Estado del sistema"])
  })

  it("no cuenta las ópticas de prueba salvo que se pida (ingresos, clientes, salud, uso y soporte)", () => {
    render(<Montado />)
    expect(valorDe("Facturado")).toContain("$60.00") // sin los $99 de la Demo
    expect(valorDe("Ópticas activas")).toContain("2") // Real Uno y Real Dos; la Demo y la cerrada no
    expect(screen.getByText("2 ópticas activas")).toBeInTheDocument()
    expect(valorDe("Consultas abiertas")).toContain("2") // c1 y c2; c3 es de la Demo
    fireEvent.click(screen.getByRole("checkbox", { name: /Incluir ópticas de prueba/ }))
    expect(valorDe("Facturado")).toContain("$159.00")
    expect(valorDe("Ópticas activas")).toContain("3")
    expect(valorDe("Consultas abiertas")).toContain("3")
  })

  it("cada número abre una lista con tantas filas como dice (y los números suman)", () => {
    render(<Montado />)
    fireEvent.click(screen.getByRole("button", { name: /^Ópticas activas: / }))
    let ventana = screen.getByRole("dialog")
    expect(within(ventana).getAllByRole("row")).toHaveLength(1 + 2) // títulos + las dos activas
    expect(within(ventana).getByText("Abrir en Ópticas")).toBeInTheDocument()
    fireEvent.click(within(ventana).getAllByRole("button", { name: "Cerrar" })[0])
    fireEvent.click(screen.getByRole("button", { name: /^Facturas pendientes: / }))
    ventana = screen.getByRole("dialog")
    expect(within(ventana).getAllByRole("row")).toHaveLength(1 + 1) // FACT-2
    expect(within(ventana).getByText("FACT-2")).toBeInTheDocument()
  })

  it("el uso no muestra volumen del negocio: personas activas y, por módulo, si se usa y cuándo fue la última vez", () => {
    render(<Montado />)
    expect(valorDe("Personas activas")).toContain("3")
    expect(valorDe("Módulos en uso")).toContain("2 de 7")
    for (const t of ["Citas registradas", "Consultas", "Ventas"]) expect(screen.queryByRole("button", { name: new RegExp(`^${t}: `) })).toBeNull()
    const tabla = screen.getByRole("table", { name: "Qué módulos se usan" })
    const fila = (m) => within(tabla).getByRole("row", { name: new RegExp(`^${m}`) })
    expect(within(fila("Citas médicas")).getByText("En uso · última vez hace 2 días")).toBeInTheDocument()
    expect(within(fila("Ventas")).getByText("En uso · última vez hace 6 días")).toBeInTheDocument()
    expect(within(fila("Inventario")).getAllByText("Sin uso en 30 días").length).toBeGreaterThan(0)
    expect(tabla.textContent).not.toMatch(/d+ (citas|consultas|ventas|pacientes)/i)
  })

  it("Soporte: las tarjetas coinciden con la bandeja (mismas funciones y mismo conteo)", () => {
    render(<Montado />)
    const visibles = consultas.filter((c) => c.opticaId !== "o3")
    const bandeja = filtrarBandeja(visibles, { estado: "abiertas" })
    expect(valorDe("Consultas abiertas")).toContain(String(bandeja.length))
    expect(valorDe("Urgentes abiertas")).toContain(String(indicadoresSoporte(visibles).urgentesAbiertas))
    expect(bandeja).toHaveLength(2)
  })

  it("Leads: interesados y convertidos coinciden con la sección Leads del mismo período", () => {
    render(<Montado />)
    const e = embudoLeads(leads, rangoDePeriodo("mes", {}, new Date(2026, 9, 16)))
    expect(valorDe("Interesados")).toContain(String(e.recibidos.length))
    expect(valorDe("Convertidos a cliente")).toContain(String(e.convertidos.length))
    expect(e.recibidos).toHaveLength(2)
  })

  it("la salud de la tabla es la de la función (en riesgo primero, con su motivo)", () => {
    render(<Montado />)
    const filas = saludDeLaRed({ opticas: opticasDelNegocio(opticas), personas, uso, facturas, consultas: consultas.filter((c) => c.opticaId !== "o3"), hoyISO: "2026-10-16" })
    const tabla = screen.getByRole("table", { name: "Salud de las ópticas" })
    const nombres = within(tabla).getAllByRole("row").slice(1).map((r) => within(r).getAllByRole("cell")[0].textContent)
    expect(nombres).toEqual(filas.map((f) => f.optica.nombre))
    expect(filas[0].optica.id).toBe("o2")
    expect(within(tabla).getByText(/Pago vencido/)).toBeInTheDocument()
  })

  it("al pulsar una óptica se abre su detalle con 'Entrar como administrador' y 'Abrir en Ópticas'", async () => {
    const onAbrir = vi.fn()
    render(<Montado onAbrir={onAbrir} />)
    fireEvent.click(screen.getByRole("button", { name: /Óptica Real Dos: En riesgo/ }))
    const ventana = await screen.findByRole("dialog")
    expect(within(ventana).getByRole("button", { name: /Entrar como administrador/ })).toBeInTheDocument()
    fireEvent.click(within(ventana).getByRole("button", { name: /Abrir en Ópticas/ }))
    expect(onAbrir).toHaveBeenCalledWith("opticas", expect.objectContaining({ abrir: "o2" }))
  })

  it("sin lo que entrega el servidor dice que no se puede leer, con una acción, y no inventa números", () => {
    render(<ResumenNegocio datos={{ ...datos, uso: [], personas: [], sinServidor: true }} opticas={opticas} leads={leads} consultas={consultas} cargandoSoporte={false} estadoServidor={{ estado: "operativo", latenciaMs: 1 }} incluirPrueba={false} onIncluirPrueba={vi.fn()} usuario={{}} onAbrir={vi.fn()} onEntrarComo={vi.fn()} onAviso={vi.fn()} onCrearOptica={vi.fn()} />)
    expect(screen.getByText(/Todavía no se puede leer el uso de las ópticas/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument()
  })
})
