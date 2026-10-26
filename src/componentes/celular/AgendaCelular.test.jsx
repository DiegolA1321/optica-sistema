import React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import FranjaDiasCelular from "./FranjaDiasCelular"
import TarjetaCitaCelular from "./TarjetaCitaCelular"
import BarraCitasCelular from "./BarraCitasCelular"
import BotonFlotanteCelular from "./BotonFlotanteCelular"

describe("Días de la Agenda", () => {
  it("muestra los días de la semana, marca el elegido y avisa cuál se toca", async () => {
    const alElegir = vi.fn()
    render(<FranjaDiasCelular seleccionado="2026-10-26" hoy="2026-10-26" onElegir={alElegir} />)
    const dias = screen.getByRole("group", { name: "Días" })
    expect(within(dias).getAllByRole("button", { pressed: true })).toHaveLength(1)
    expect(within(dias).getByRole("button", { name: /lunes, 26 de octubre de 2026/i })).toHaveAttribute("aria-pressed", "true")
    await userEvent.click(within(dias).getByRole("button", { name: /martes, 27 de octubre de 2026/i }))
    expect(alElegir).toHaveBeenCalledWith("2026-10-27")
  })
  it("sin un día elegido (la lista abarca otro periodo) ninguno queda marcado", () => {
    render(<FranjaDiasCelular seleccionado={null} hoy="2026-10-26" onElegir={() => {}} />)
    expect(screen.queryAllByRole("button", { pressed: true })).toHaveLength(0)
  })
})

describe("Tarjeta de cita en el celular", () => {
  const base = { id: "c1", paciente: "Ana Pérez", hora: "09:40 AM", motivo: "Examen de control", estado: "Pendiente", fecha: "2026-10-26" }
  it("muestra la hora, el paciente, el motivo y el estado con su color, y abre el detalle al tocarla", async () => {
    const alAbrir = vi.fn()
    render(<TarjetaCitaCelular cita={base} onAbrir={alAbrir} />)
    const tarjeta = screen.getByRole("button", { name: /Ana Pérez, 9:40 AM, Pendiente/ })
    expect(tarjeta).toHaveTextContent("Examen de control")
    expect(within(tarjeta).getByText("Pendiente").className).toMatch(/amber/)
    await userEvent.click(tarjeta)
    expect(alAbrir).toHaveBeenCalledWith(base)
  })
  it("los estados usan los colores de siempre y las canceladas dicen quién las canceló", () => {
    const { rerender } = render(<TarjetaCitaCelular cita={{ ...base, estado: "En Atención" }} />)
    expect(screen.getByText("En atención").className).toMatch(/blue/)
    rerender(<TarjetaCitaCelular cita={{ ...base, estado: "No Asistió" }} />)
    expect(screen.getByText("No efectuada").className).toMatch(/red/)
    rerender(<TarjetaCitaCelular cita={{ ...base, estado: "Cancelada", canceladaPor: "paciente" }} />)
    expect(screen.getByText("Cancelada por el paciente")).toBeInTheDocument()
  })
  it("avisa el cobro pendiente igual que la tarjeta de la computadora", () => {
    render(<TarjetaCitaCelular cita={{ ...base, estado: "Atendida" }} cobroPendiente />)
    expect(screen.getByText("Cobro pendiente")).toBeInTheDocument()
  })
})

describe("Barra de la Agenda en el celular", () => {
  const p = (extra = {}) => ({
    mostrarDias: true, diaSeleccionado: "2026-10-26", hoy: "2026-10-26", onElegirDia: () => {}, etiquetas: [], texto: "", onTexto: () => {}, buscando: false, hayAlgo: false, onLimpiar: () => {},
    textoResumen: "3 citas hoy", cuantas: 3, esLista: true, periodos: [{ id: "hoy", etiqueta: "Hoy" }, { id: "semana", etiqueta: "Esta semana" }], filtro: "hoy", hayRango: false, onPeriodo: () => {}, textoRango: "Rango",
    rango: { desde: "", hasta: "", onDesde: () => {}, onHasta: () => {} }, onAnterior: () => {}, onSiguiente: () => {}, tituloPeriodo: "Hoy · lun 26 oct 2026",
    vista: "lista", onVista: () => {}, mostrarVistas: false, secciones: [{ id: "estado", titulo: "Estado", valor: "todas", onChange: () => {}, opciones: [{ id: "todas", etiqueta: "Todas" }, { id: "atendida", etiqueta: "Atendidas" }] }],
    ...extra,
  })
  it("«Filtrar» abre una ventana con la búsqueda, el periodo con sus flechas y los filtros de la computadora", async () => {
    const alPeriodo = vi.fn()
    render(<BarraCitasCelular p={p({ onPeriodo: alPeriodo })} />)
    await userEvent.click(screen.getByRole("button", { name: /^Filtrar/ }))
    const ventana = screen.getByRole("dialog", { name: "Filtrar citas" })
    expect(within(ventana).getByLabelText("Buscar")).toBeInTheDocument()
    expect(within(ventana).getByRole("button", { name: "Periodo siguiente" })).toBeInTheDocument()
    expect(within(ventana).getByRole("button", { name: "Atendidas" })).toBeInTheDocument()
    await userEvent.click(within(ventana).getByRole("button", { name: "Esta semana" }))
    expect(alPeriodo).toHaveBeenCalledWith("semana")
    expect(within(ventana).queryByRole("group", { name: "Vista de citas" })).not.toBeInTheDocument() // en el celular solo hay lista
  })
  it("en tablet la ventana ofrece Lista, Semana y Mes", async () => {
    const alVista = vi.fn()
    render(<BarraCitasCelular p={p({ mostrarVistas: true, onVista: alVista })} />)
    await userEvent.click(screen.getByRole("button", { name: /^Filtrar/ }))
    await userEvent.click(screen.getByRole("button", { name: "Semana" }))
    expect(alVista).toHaveBeenCalledWith("semana")
  })
  it("los filtros activos quedan como etiquetas con su «x» y el botón cuenta cuántos hay", async () => {
    const quitar = vi.fn()
    render(<BarraCitasCelular p={p({ etiquetas: [{ id: "estado", texto: "Estado: Atendidas", quitar }], hayAlgo: true })} />)
    expect(screen.getByRole("button", { name: /^Filtrar/ })).toHaveTextContent("1")
    await userEvent.click(screen.getByRole("button", { name: "Quitar el filtro Estado: Atendidas" }))
    expect(quitar).toHaveBeenCalled()
  })
  it("con una búsqueda activa lo dice (todas las fechas) y se puede quitar", async () => {
    const alTexto = vi.fn()
    render(<BarraCitasCelular p={p({ buscando: true, texto: "ana", onTexto: alTexto })} />)
    expect(screen.getByText(/todas las fechas/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Quitar la búsqueda" }))
    expect(alTexto).toHaveBeenCalledWith("")
  })
  it("muestra el botón «Requieren atención» que le pasa la Agenda", () => {
    render(<BarraCitasCelular p={p()} avisos={<span>Requieren atención 25</span>} />)
    expect(screen.getByText("Requieren atención 25")).toBeInTheDocument()
  })
})

describe("Botón «+» flotante", () => {
  it("lleva su nombre y llama a la acción", async () => {
    const alTocar = vi.fn()
    render(<BotonFlotanteCelular etiqueta="Agendar cita" onClick={alTocar} />)
    await userEvent.click(screen.getByRole("button", { name: "Agendar cita" }))
    expect(alTocar).toHaveBeenCalled()
  })
})
