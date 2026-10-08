import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { BuscadorCitas, BloqueFiltros, BotonRango, PeriodoLista } from "./FiltrosCitas"

const grupoChips = (valor = "todas", onChange = () => {}) => ({ id: "estado", titulo: "Estado", valor, onChange, opciones: [{ id: "todas", etiqueta: "Todas" }, { id: "pendiente", etiqueta: "Pendientes" }, { id: "enEspera", etiqueta: "En espera" }] })
const grupoLista = (valor = "todos", onChange = () => {}) => ({ id: "profesional", titulo: "Profesional", tipo: "lista", valor, onChange, opciones: [{ id: "todos", etiqueta: "Todos" }, { id: "u1", etiqueta: "Paula" }] })

describe("BuscadorCitas", () => {
  it("su 'x' borra solo el texto y solo aparece cuando hay texto", () => {
    const onTexto = vi.fn()
    const { rerender } = render(<BuscadorCitas texto="" onTexto={onTexto} />)
    expect(screen.queryByRole("button", { name: "Borrar la búsqueda" })).not.toBeInTheDocument()
    rerender(<BuscadorCitas texto="Paola" onTexto={onTexto} />)
    fireEvent.click(screen.getByRole("button", { name: "Borrar la búsqueda" }))
    expect(onTexto).toHaveBeenCalledWith("")
  })
  it("escribir llama a onTexto", () => {
    const onTexto = vi.fn()
    render(<BuscadorCitas texto="" onTexto={onTexto} />)
    fireEvent.change(screen.getByLabelText("Buscar cita: paciente o código"), { target: { value: "CIT-" } })
    expect(onTexto).toHaveBeenCalledWith("CIT-")
  })
})

describe("BloqueFiltros", () => {
  it("muestra todos los grupos a la vista, sin abrir nada y sin números por opción", () => {
    render(<BloqueFiltros filas={[[grupoChips()], [grupoLista()]]} hayFiltros={false} onLimpiar={() => {}} />)
    expect(screen.getByRole("group", { name: "Estado" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "En espera" })).toBeVisible()
    expect(screen.getByRole("combobox", { name: "Profesional" })).toBeVisible()
    expect(screen.queryByText(/\(\d+\)/)).not.toBeInTheDocument()
  })
  it("un clic en una opción la elige, y otro clic en la activa la quita", () => {
    const onChange = vi.fn()
    const { rerender } = render(<BloqueFiltros filas={[[grupoChips("todas", onChange)], []]} hayFiltros={false} onLimpiar={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: "Pendientes" }))
    expect(onChange).toHaveBeenLastCalledWith("pendiente")
    rerender(<BloqueFiltros filas={[[grupoChips("pendiente", onChange)], []]} hayFiltros onLimpiar={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: "Pendientes" }))
    expect(onChange).toHaveBeenLastCalledWith("todas")
  })
  it("'Limpiar filtros' siempre está, apagado sin filtros y activo con ellos", () => {
    const onLimpiar = vi.fn()
    const { rerender } = render(<BloqueFiltros filas={[[grupoChips()], []]} hayFiltros={false} onLimpiar={onLimpiar} />)
    const boton = screen.getByRole("button", { name: /Limpiar filtros/ })
    expect(boton).toBeDisabled()
    rerender(<BloqueFiltros filas={[[grupoChips()], []]} hayFiltros onLimpiar={onLimpiar} />)
    expect(screen.getByRole("button", { name: /Limpiar filtros/ })).toBeEnabled()
    fireEvent.click(screen.getByRole("button", { name: /Limpiar filtros/ }))
    expect(onLimpiar).toHaveBeenCalled()
  })
  it("la lista de profesionales llama a onChange con el id elegido", () => {
    const onChange = vi.fn()
    render(<BloqueFiltros filas={[[], [grupoLista("todos", onChange)]]} hayFiltros={false} onLimpiar={() => {}} />)
    fireEvent.change(screen.getByRole("combobox", { name: "Profesional" }), { target: { value: "u1" } })
    expect(onChange).toHaveBeenCalledWith("u1")
  })
})

describe("BotonRango", () => {
  it("abre el calendario; el primer clic marca el inicio y limpia el final", () => {
    const onDesde = vi.fn(), onHasta = vi.fn()
    render(<BotonRango rango={{ desde: "", hasta: "", onDesde, onHasta }} />)
    fireEvent.click(screen.getByRole("button", { name: /Rango/ }))
    const dia = screen.getAllByRole("button").find((b) => /^\d\d\/\d\d\/\d{4}$/.test(b.getAttribute("aria-label") || ""))
    fireEvent.click(dia)
    expect(onDesde).toHaveBeenCalledWith(dia.getAttribute("aria-label").split("/").reverse().join("-"))
    expect(onHasta).toHaveBeenCalledWith("")
  })
  it("con un rango elegido el botón muestra sus fechas", () => {
    render(<BotonRango rango={{ desde: "2026-10-03", hasta: "2026-10-20", onDesde: () => {}, onHasta: () => {} }} />)
    expect(screen.getByRole("button", { name: /3 oct – 20 oct/ })).toBeInTheDocument()
  })
})

describe("PeriodoLista", () => {
  it("marca el periodo activo, salvo con un rango de fechas elegido", () => {
    const opciones = [{ id: "hoy", etiqueta: "Hoy" }, { id: "semana", etiqueta: "Semana" }]
    const { rerender } = render(<PeriodoLista valor="semana" onChange={() => {}} opciones={opciones} />)
    expect(screen.getByRole("button", { name: "Semana" })).toHaveAttribute("aria-pressed", "true")
    rerender(<PeriodoLista valor="semana" onChange={() => {}} opciones={opciones} sinActivo />)
    expect(screen.getByRole("button", { name: "Semana" })).toHaveAttribute("aria-pressed", "false")
  })
})
