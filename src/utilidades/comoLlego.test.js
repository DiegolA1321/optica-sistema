import { describe, it, expect } from "vitest"
import { comoLlego, pacientesPorLlegada, llegadaPorMes } from "./comoLlego"

const ana = { id: "a", nombre: "Ana Ruiz", fechaRegistro: "2026-08-02", origen: "staff" }
const beto = { id: "b", nombre: "Beto Paz", fechaRegistro: "2026-09-10", origen: "paciente" }
const cris = { id: "c", nombre: "Cris Vera", fechaRegistro: "2026-09-20", origen: "staff", referidoPorId: "a", referidoPor: "Ana Ruiz" }
const dani = { id: "d", nombre: "Dani Mora", fechaRegistro: "2026-09-21", origen: "paciente", referidoPor: "ana ruiz" }
const todos = [ana, beto, cris, dani]

describe("comoLlego", () => {
  it("referido por otro paciente: el nombre y el perfil de quien lo refirió", () => {
    const r = comoLlego(cris, todos)
    expect(r.tipo).toBe("referido")
    expect(r.texto).toBe("Referido por Ana Ruiz")
    expect(r.referente).toBe(ana)
  })
  it("el referido gana sobre la web, y se empareja por nombre si no hay id", () => {
    const r = comoLlego(dani, todos)
    expect(r.tipo).toBe("referido")
    expect(r.referente).toBe(ana)
  })
  it("por la web si se registró él mismo; por su cuenta si no; nunca vacío", () => {
    expect(comoLlego(beto, todos).texto).toBe("Por la web")
    expect(comoLlego(ana, todos).texto).toBe("Por su cuenta")
    expect(comoLlego({}, []).texto).toBe("Por su cuenta")
  })
  it("un referente que ya no está en la lista conserva el nombre escrito", () => {
    expect(comoLlego({ referidoPor: "Zoe" }, []).texto).toBe("Referido por Zoe")
  })
})

describe("pacientesPorLlegada y llegadaPorMes", () => {
  it("reparte por tipo dentro del rango y la suma da el total", () => {
    const r = pacientesPorLlegada(todos, { inicio: "2026-09-01", fin: "2026-09-30" })
    expect(r.referido.map((p) => p.id)).toEqual(["c", "d"])
    expect(r.web.map((p) => p.id)).toEqual(["b"])
    expect(r.propio).toEqual([])
  })
  it("la tendencia por mes suma lo mismo que el reparto", () => {
    const meses = llegadaPorMes(pacientesPorLlegada(todos))
    expect(meses.map((m) => [m.clave, m.total])).toEqual([["2026-08", 1], ["2026-09", 3]])
    expect(meses.reduce((s, m) => s + m.referido, 0)).toBe(2)
  })
})

describe("llegadaPorMes con el período", () => {
  it("incluye los meses sin pacientes entre el inicio y el fin", () => {
    const meses = llegadaPorMes(pacientesPorLlegada([ana, beto]), { inicio: "2026-07-01", fin: "2026-10-22" })
    expect(meses.map((m) => [m.clave, m.total])).toEqual([["2026-07", 0], ["2026-08", 1], ["2026-09", 1], ["2026-10", 0]])
  })
})
