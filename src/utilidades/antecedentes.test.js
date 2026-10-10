import { describe, it, expect } from "vitest"
import { antecedentesRelevantes, textoAntecedentes } from "./antecedentes"

const txt = (f) => textoAntecedentes(antecedentesRelevantes(f))

describe("antecedentesRelevantes", () => {
  it("detecta personales y familiares, sin importar tildes ni mayúsculas", () => {
    expect(txt({ antecedentes: "Diabetes tipo 2, HIPERTENSIÓN", antecedentesFamiliares: "Madre con Glaucoma" })).toBe("Diabetes · Hipertensión · Glaucoma (familiar)")
  })
  it("reconoce variantes", () => {
    expect(txt({ antecedentes: "presión alta; operado de cataratas; ojo vago" })).toBe("Hipertensión · Cataratas · Ambliopía")
    expect(txt({ antecedentesFamiliares: "padre diabético, abuela con desprendimiento de retina" })).toBe("Diabetes (familiar) · Desprendimiento de retina (familiar)")
  })
  it("ignora lo negado", () => {
    expect(txt({ antecedentes: "Niega diabetes", antecedentesFamiliares: "Sin glaucoma" })).toBe("")
    expect(txt({ antecedentes: "No refiere hipertensión ni diabetes" })).toBe("")
    expect(txt({ antecedentes: "Ninguno" })).toBe("")
  })
  it("lo negado no apaga lo que sí está escrito", () => {
    expect(txt({ antecedentes: "diabetes pero no hipertensión" })).toBe("Diabetes")
    expect(txt({ antecedentes: "no glaucoma, uveítis crónica" })).toBe("Uveítis")
  })
  it("sin ficha o sin texto no devuelve nada", () => {
    expect(antecedentesRelevantes(null)).toEqual([])
    expect(antecedentesRelevantes({})).toEqual([])
  })
})
