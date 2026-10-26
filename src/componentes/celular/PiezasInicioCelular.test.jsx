import React from "react"
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Calendar } from "lucide-react"
import { RequiereAtencionCelular, TotalesCelular, ProximaCitaCelular } from "./PiezasInicioCelular"

describe("piezas del Inicio en celular", () => {
  const bloques = [
    { id: "citas", titulo: "Citas", modulo: "Citas", icono: Calendar, onVerTodo: () => {}, filas: [{ id: "a", tono: "pendiente", cantidad: 6, texto: "pacientes con el control vencido", corto: "con control vencido", casos: [{ id: "x", nombre: "Ana Pérez", detalle: "Control vencido hace 5 días", accion: { etiqueta: "Agendar control", onClick: () => {} } }] }, { id: "b", tono: "urgente", cantidad: 1, texto: "atención abierta de un día anterior", corto: "atención abierta", casos: [] }] },
  ]
  it("«Requiere tu atención»: una fila por tipo de aviso, primero la urgente; al tocarla abre la misma ventana con sus casos y acciones", async () => {
    render(<RequiereAtencionCelular bloques={bloques} />)
    const filas = screen.getAllByRole("button")
    expect(filas.map((f) => f.getAttribute("aria-label"))).toEqual(["1 atención abierta de un día anterior", "6 pacientes con el control vencido"])
    await userEvent.click(filas[1])
    expect(await screen.findByRole("dialog")).toHaveTextContent("Ana Pérez")
    expect(screen.getByRole("button", { name: "Agendar control" })).toBeInTheDocument()
  })
  it("sin avisos dice «Todo en orden»", () => {
    render(<RequiereAtencionCelular bloques={[{ ...bloques[0], filas: [] }]} />)
    expect(screen.getByText("Todo en orden")).toBeInTheDocument()
  })
  it("los totales en dos columnas y la próxima cita con su enlace a la agenda", async () => {
    const alAgenda = vi.fn()
    render(<><TotalesCelular tarjetas={[{ id: "c", titulo: "Citas hoy", valor: 8, desc: "3 atendidas", onClick: () => {} }]} /><ProximaCitaCelular cita={{ paciente: "Ana Pérez", motivo: "Examen de control", estado: "Pendiente" }} hora="10:40 AM" alVerAgenda={alAgenda} /></>)
    expect(screen.getByRole("button", { name: /Citas hoy: 8/ })).toBeInTheDocument()
    expect(screen.getByText("Examen de control")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Ver agenda" }))
    expect(alAgenda).toHaveBeenCalled()
  })
  it("sin citas por atender, la próxima cita lo dice", () => {
    render(<ProximaCitaCelular cita={null} hora="" alVerAgenda={() => {}} />)
    expect(screen.getByText("No queda nadie por atender hoy.")).toBeInTheDocument()
  })
})
