import { describe, it, expect } from "vitest"
import { TIPOS_DOCUMENTO, tipoDeDocumento, etiquetaDocumento, filtrarDocumento, errorDeDocumento } from "./documento"

describe("documento del paciente", () => {
  it("la cédula pasa por el dígito verificador; el pasaporte y otros documentos, no", () => {
    expect(errorDeDocumento("cedula", "1715613222")).toMatch(/no es válida/)
    expect(errorDeDocumento("cedula", "")).toMatch(/Escribe/)
    expect(errorDeDocumento("pasaporte", "AB123456")).toBe("")
    expect(errorDeDocumento("otro", "RUC-99887")).toBe("")
    expect(errorDeDocumento("pasaporte", "AB1")).toMatch(/corto/)
    expect(errorDeDocumento("pasaporte", "AB 12$56")).toMatch(/letras, números/)
  })
  it("una cédula válida se acepta", () => {
    expect(errorDeDocumento("cedula", "0926687856")).toBe("")
  })
  it("el campo deja escribir lo que corresponde a cada tipo", () => {
    expect(filtrarDocumento("cedula", "17a1-5613222999")).toBe("1715613222")
    expect(filtrarDocumento("pasaporte", "ab-12 3$4")).toBe("AB-1234")
  })
  it("un paciente anterior (sin tipo) es de cédula", () => {
    expect(tipoDeDocumento({})).toBe("cedula")
    expect(etiquetaDocumento({ tipoDocumento: "pasaporte" })).toBe("Pasaporte")
    expect(TIPOS_DOCUMENTO.map((t) => t.id)).toEqual(["cedula", "pasaporte", "otro"])
  })
})
