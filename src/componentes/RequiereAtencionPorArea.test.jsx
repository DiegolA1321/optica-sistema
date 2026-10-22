import { describe, it, expect } from "vitest"
import { render, screen, within } from "@testing-library/react"
import { Calendar } from "lucide-react"
import RequiereAtencionPorArea, { ordenarPorUrgencia } from "./RequiereAtencionPorArea"

const fila = (id, tono) => ({ id, tono, cantidad: 1, texto: `aviso ${id}`, corto: `aviso ${id}`, casos: [] })

describe("ordenarPorUrgencia", () => {
  it("primero los urgentes, luego los pendientes y al final los informativos; dentro de cada tono, el orden de siempre", () => {
    const filas = [fila("a", "info"), fila("b", "pendiente"), fila("c", "urgente"), fila("d", "info"), fila("e", undefined), fila("f", "urgente")]
    expect(ordenarPorUrgencia(filas).map((f) => f.id)).toEqual(["c", "f", "b", "e", "a", "d"])
  })
})

describe("Requiere tu atención: tres avisos por columna", () => {
  it("muestra los tres más urgentes y «+N más» con el resto", () => {
    const bloque = { id: "citas", titulo: "Citas", modulo: "Citas", icono: Calendar, onVerTodo: () => {}, filas: [fila("i1", "info"), fila("p1", "pendiente"), fila("u1", "urgente"), fila("i2", "info"), fila("p2", "pendiente")] }
    render(<RequiereAtencionPorArea bloques={[bloque]} />)
    const area = screen.getByRole("region", { name: "Requiere tu atención: Citas" })
    const botones = within(area).getAllByRole("button", { name: /^1 aviso / }).map((b) => b.getAttribute("aria-label"))
    expect(botones).toEqual(["1 aviso u1", "1 aviso p1", "1 aviso p2"])
    expect(within(area).getByRole("button", { name: "Ver los 2 avisos más de Citas" })).toHaveTextContent("+2 más")
  })
})
