import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import { BarraBusquedaFiltros, PeriodoLista } from "./FiltrosCitas"

const etiquetas = (n, quitar = () => {}) => Array.from({ length: n }, (_, i) => ({ id: `f${i}`, texto: `Filtro ${i + 1}`, quitar: () => quitar(i) }))
const pintar = (n, quitar) => render(<BarraBusquedaFiltros texto="" onTexto={() => {}} secciones={[]} etiquetas={etiquetas(n, quitar)} onLimpiar={() => {}} />)

describe("BarraBusquedaFiltros", () => {
  it("cada filtro activo se ve desglosado, con su propia 'x', sin agruparse", () => {
    const quitar = vi.fn()
    pintar(4, quitar)
    expect(screen.getByText("Filtro 1")).toBeInTheDocument()
    expect(screen.getByText("Filtro 4")).toBeInTheDocument()
    expect(screen.queryByText(/4 filtros/)).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Quitar el filtro Filtro 2" }))
    expect(quitar).toHaveBeenCalledWith(1)
  })
  it("el buscador sigue visible con filtros activos", () => {
    pintar(4)
    expect(screen.getByLabelText("Buscar cita: paciente o código")).toBeInTheDocument()
  })
})

describe("chips del panel Filtrar", () => {
  it("un clic en la opción activa la quita (vuelve a la primera)", () => {
    const onChange = vi.fn()
    const secciones = [{ id: "estado", titulo: "Estado", valor: "pendiente", onChange, opciones: [{ id: "todas", etiqueta: "Todas" }, { id: "pendiente", etiqueta: "Pendientes" }] }]
    render(<BarraBusquedaFiltros texto="" onTexto={() => {}} secciones={secciones} etiquetas={[]} onLimpiar={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: /Filtrar/ }))
    fireEvent.click(screen.getByRole("button", { name: "Pendientes" }))
    expect(onChange).toHaveBeenCalledWith("todas")
  })
})

describe("rango de fechas como filtro del panel", () => {
  it("el primer clic marca el inicio y limpia el final", () => {
    const onDesde = vi.fn(), onHasta = vi.fn()
    const secciones = [{ id: "fechas", titulo: "Fechas", tipo: "rango", rango: { desde: "", hasta: "", onDesde, onHasta } }]
    render(<BarraBusquedaFiltros texto="" onTexto={() => {}} secciones={secciones} etiquetas={[]} onLimpiar={() => {}} />)
    fireEvent.click(screen.getByRole("button", { name: /Filtrar/ }))
    fireEvent.click(screen.getByRole("button", { name: /Elegir rango de fechas/ }))
    const dia = screen.getAllByRole("button").find((b) => /^\d\d\/\d\d\/\d{4}$/.test(b.getAttribute("aria-label") || ""))
    fireEvent.click(dia)
    expect(onDesde).toHaveBeenCalledWith(dia.getAttribute("aria-label").split("/").reverse().join("-"))
    expect(onHasta).toHaveBeenCalledWith("")
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
