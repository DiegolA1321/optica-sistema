import { describe, it, expect } from "vitest"
import { etiquetaCorreccion } from "./correccion"

describe("etiquetaCorreccion", () => {
  it("renombra los dos estados sin evaluar para distinguirlos", () => {
    expect(etiquetaCorreccion("Sin evaluar")).toBe("AV sin evaluar")
    expect(etiquetaCorreccion("Sin evaluación")).toBe("Sin consulta")
    expect(etiquetaCorreccion(undefined)).toBe("Sin consulta")
  })
  it("deja igual los estados evaluados", () => {
    expect(etiquetaCorreccion("Bien corregido")).toBe("Bien corregido")
  })
})
