import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"
import { BarraBusquedaFiltros, PeriodoLista, NavegadorPeriodo, SelectorVistaCitas } from "./FiltrosCitas"

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

describe("NavegadorPeriodo inactivo (con 'Todas')", () => {
  it("deja la fecha y las flechas en su sitio, apagadas: no hay periodo que mover y nada salta", () => {
    const onAnterior = vi.fn()
    render(<NavegadorPeriodo inactivo titulo="Todas las fechas" onAnterior={onAnterior} etiquetaAnterior="Periodo anterior" etiquetaSiguiente="Periodo siguiente" />)
    expect(screen.getByText("Todas las fechas")).toBeInTheDocument()
    const anterior = screen.getByRole("button", { name: "Periodo anterior" })
    expect(anterior).toBeDisabled()
    expect(screen.getByRole("button", { name: "Periodo siguiente" })).toBeDisabled()
    fireEvent.click(anterior)
    expect(onAnterior).not.toHaveBeenCalled()
  })
})

describe("SelectorVistaCitas: Lista y Calendario (Semana o Mes)", () => {
  it("muestra «Lista» y «Calendario»; «Calendario» se despliega para elegir Semana o Mes", () => {
    const onChange = vi.fn()
    render(<SelectorVistaCitas vista="lista" onChange={onChange} />)
    expect(screen.getByRole("button", { name: /Lista/ })).toHaveAttribute("aria-pressed", "true")
    expect(screen.queryByRole("menu")).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /Calendario/ }))
    const menu = screen.getByRole("menu", { name: "Calendario" })
    expect(screen.getAllByRole("menuitemradio").map((b) => b.textContent.trim())).toEqual(["Semana", "Mes"])
    fireEvent.click(screen.getByRole("menuitemradio", { name: /Mes/ }))
    expect(onChange).toHaveBeenCalledWith("mes")
    expect(menu).not.toBeInTheDocument() // se cierra al elegir
  })
  it("con un calendario activo el mismo botón lo dice (sin mover nada) y marca la opción activa", () => {
    render(<SelectorVistaCitas vista="semana" onChange={() => {}} />)
    const boton = screen.getByRole("button", { name: /Calendario/ })
    expect(boton.textContent.trim()).toBe("Calendario") // compacto: sin hueco reservado para «Semana» o «Mes»
    expect(boton).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByRole("button", { name: /Lista/ })).toHaveAttribute("aria-pressed", "false")
    fireEvent.click(boton)
    expect(screen.getByRole("menuitemradio", { name: /Semana/ })).toHaveAttribute("aria-checked", "true")
  })
  it("donde la semana no cabe solo se ofrece el mes", () => {
    render(<SelectorVistaCitas vista="lista" onChange={() => {}} cabeSemana={false} />)
    fireEvent.click(screen.getByRole("button", { name: /Calendario/ }))
    expect(screen.getAllByRole("menuitemradio")).toHaveLength(1)
    expect(screen.getByRole("menuitemradio", { name: /Mes/ })).toBeInTheDocument()
  })
})

describe("PeriodoLista: el periodo vive en un solo lugar, con «Rango»", () => {
  const opciones = [{ id: "hoy", etiqueta: "Hoy" }, { id: "semana", etiqueta: "Esta semana" }, { id: "mes", etiqueta: "Este mes" }, { id: "todas", etiqueta: "Todas" }]
  it("«Rango» es la última opción; abre un calendario y, al marcar el segundo día, se cierra y queda dicho el rango", () => {
    const onDesde = vi.fn(), onHasta = vi.fn()
    render(<PeriodoLista valor="hoy" onChange={() => {}} opciones={opciones} rango={{ desde: "", hasta: "", onDesde, onHasta }} />)
    const botones = within(screen.getByRole("group", { name: "Periodo de las citas" })).getAllByRole("button")
    expect(botones.map((b) => b.textContent.trim())).toEqual(["Hoy", "Esta semana", "Este mes", "Todas", "Rango"])
    fireEvent.click(screen.getByRole("button", { name: /Rango/ }))
    const dialogo = screen.getByRole("dialog", { name: "Elegir rango de fechas" })
    const dia = within(dialogo).getAllByRole("button").find((b) => /^\d\d\/\d\d\/\d{4}$/.test(b.getAttribute("aria-label") || ""))
    fireEvent.click(dia)
    expect(onDesde).toHaveBeenCalled()
  })
  it("con un rango elegido es lo único marcado y el botón muestra las fechas", () => {
    render(<PeriodoLista valor="hoy" sinActivo onChange={() => {}} opciones={opciones} rango={{ desde: "2026-10-05", hasta: "2026-10-11", onDesde: () => {}, onHasta: () => {} }} />)
    expect(screen.getByRole("button", { name: "Hoy" })).toHaveAttribute("aria-pressed", "false")
    const rango = screen.getByRole("button", { name: /5 oct/ })
    expect(rango).toHaveAttribute("aria-pressed", "true")
    expect(rango).toHaveTextContent(/5 oct\s*–\s*11 oct/)
  })
})
