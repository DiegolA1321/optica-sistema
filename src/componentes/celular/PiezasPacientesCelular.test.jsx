import { describe, it, expect, vi } from "vitest"
import { render, screen, fireEvent } from "@testing-library/react"
import TarjetaPacienteCelular from "./TarjetaPacienteCelular"
import BarraFiltrosCelular from "./BarraFiltrosCelular"

const paciente = { id: "p1", nombre: "Ana Pérez", cedula: "0912345678", telefono: "0999999999", correo: "ana@correo.com" }

describe("TarjetaPacienteCelular", () => {
  it("muestra los datos de la fila de la computadora y toda la tarjeta abre el perfil", () => {
    const onAbrir = vi.fn()
    render(<ul><TarjetaPacienteCelular paciente={paciente} color="#2563eb" insignias={<div>Activo</div>} visita="7 oct 2026" siguiente={{ fecha: "2026-11-02", hora: "09:00 AM" }} onAbrir={onAbrir} /></ul>)
    expect(screen.getByText("Ana Pérez")).toBeTruthy()
    expect(screen.getByText("0912345678")).toBeTruthy()
    expect(screen.getByText("0999999999")).toBeTruthy()
    expect(screen.getByText("7 oct 2026")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Ver el perfil de Ana Pérez" }))
    expect(onAbrir).toHaveBeenCalledWith(paciente)
  })
  it("sin cita ni consultas lo dice, y sin acciones no dibuja botones de más", () => {
    render(<ul><TarjetaPacienteCelular paciente={paciente} color="#000" insignias={null} visita={null} siguiente={null} onAbrir={() => {}} /></ul>)
    expect(screen.getByText("Sin consultas")).toBeTruthy()
    expect(screen.getByText("Sin cita")).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Más acciones" })).toBeNull()
  })
})

describe("BarraFiltrosCelular", () => {
  const secciones = [{ id: "mostrar", titulo: "Mostrar", valor: "Todos", onChange: vi.fn(), opciones: [{ id: "Todos", etiqueta: "Todos" }, { id: "SinConsulta", etiqueta: "Sin consulta" }] }]
  it("la búsqueda queda arriba y «Filtrar» abre las secciones", () => {
    const onTexto = vi.fn()
    render(<BarraFiltrosCelular texto="" onTexto={onTexto} secciones={secciones} etiquetas={[]} onLimpiar={() => {}} placeholder="Buscar paciente" inputId="b" titulo="Filtrar pacientes" />)
    fireEvent.change(screen.getByPlaceholderText("Buscar paciente"), { target: { value: "ana" } })
    expect(onTexto).toHaveBeenCalledWith("ana")
    fireEvent.click(screen.getByRole("button", { name: /Filtrar/ }))
    expect(screen.getByRole("dialog", { name: "Filtrar pacientes" })).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "Sin consulta" }))
    expect(secciones[0].onChange).toHaveBeenCalledWith("SinConsulta")
  })
  it("los filtros activos son etiquetas que se pueden quitar", () => {
    const quitar = vi.fn()
    render(<BarraFiltrosCelular texto="" onTexto={() => {}} secciones={secciones} etiquetas={[{ id: "e", texto: "Sin consulta", quitar }]} onLimpiar={() => {}} placeholder="Buscar" inputId="b" />)
    fireEvent.click(screen.getByRole("button", { name: "Quitar el filtro Sin consulta" }))
    expect(quitar).toHaveBeenCalled()
  })
})
