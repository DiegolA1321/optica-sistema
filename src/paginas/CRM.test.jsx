import React from "react"
import { describe, it, expect } from "vitest"
import { render, screen, within } from "@testing-library/react"
import CRM from "./CRM"
import { ahoraEcuador } from "../utilidades/horaEcuador"

const iso = (f) => `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, "0")}-${String(f.getDate()).padStart(2, "0")}`
const haceDias = (n) => { const d = ahoraEcuador(); d.setDate(d.getDate() - n); return iso(d) }
const usuario = { id: "u1", rol: "admin", nombre: "Ana", opticaId: "o1" }
const hoy = ahoraEcuador()
const nacimientoHoy = `1980-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`
const lista = (nombre) => screen.getByText(nombre, { selector: "h4" }).closest("div[class*='overflow-hidden']")

describe("CRM", () => {
  const pacientes = [
    { id: "p1", nombre: "Ana Vencida", fechaRegistro: haceDias(500), fechaNacimiento: "1990-02-02" },
    { id: "p2", nombre: "Beto Vencido y Cumpleañero", fechaRegistro: haceDias(500), fechaNacimiento: nacimientoHoy },
    { id: "p3", nombre: "Carla Al Día", fechaRegistro: haceDias(10), fechaNacimiento: "1990-03-03" },
  ]

  it("el control vencido cuenta a los mismos que el Inicio y Reportes, aunque también cumplan años", () => {
    render(<CRM usuario={usuario} pacientes={pacientes} consultas={[]} />)
    const vencido = lista("Control vencido")
    expect(within(vencido).getByText("2 en total")).toBeInTheDocument()
    expect(within(vencido).getByText("Ana Vencida")).toBeInTheDocument()
    expect(within(vencido).getByText("Beto Vencido y Cumpleañero")).toBeInTheDocument()
    expect(within(lista("Cumpleaños próximos")).getByText("Beto Vencido y Cumpleañero")).toBeInTheDocument() // y en cumpleaños también
  })

  it("no repite arriba los números de las listas: ya no hay tarjetas de resumen", () => {
    render(<CRM usuario={usuario} pacientes={pacientes} consultas={[]} />)
    expect(screen.queryByText("Total de pacientes")).not.toBeInTheDocument()
    expect(screen.queryByText("Cumpleaños cercanos")).not.toBeInTheDocument()
    expect(screen.queryByText("Sin visitar hace tiempo")).not.toBeInTheDocument()
    expect(screen.queryByText("Pacientes frecuentes")).not.toBeInTheDocument()
  })
})

describe("CRM sin pacientes", () => {
  it("lo dice y lleva a registrar el primero", () => {
    const pedidos = []
    render(<CRM usuario={usuario} pacientes={[]} consultas={[]} onRegistrarPaciente={() => pedidos.push("crear")} />)
    expect(screen.getByText("Todavía no hay pacientes a quienes escribir")).toBeInTheDocument()
    screen.getByRole("button", { name: /Registrar el primer paciente/ }).click()
    expect(pedidos).toEqual(["crear"])
  })
  it("sin permiso para crear pacientes no ofrece la acción", () => {
    render(<CRM usuario={usuario} pacientes={[]} consultas={[]} />)
    expect(screen.queryByRole("button", { name: /Registrar el primer paciente/ })).not.toBeInTheDocument()
  })
})
