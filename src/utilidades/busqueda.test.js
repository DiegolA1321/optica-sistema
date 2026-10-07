import { describe, it, expect } from "vitest"
import { coincideTexto, normalizarTexto } from "./busqueda"

describe("coincideTexto", () => {
  it("sin texto no filtra", () => {
    expect(coincideTexto("", "Ana")).toBe(true)
    expect(coincideTexto("   ", "Ana")).toBe(true)
  })
  it("ignora tildes y mayúsculas y mira todos los campos", () => {
    expect(coincideTexto("parraga", "Karla Párraga Vera", "0102030405")).toBe(true)
    expect(coincideTexto("0102", "Karla", "0102030405")).toBe(true)
    expect(coincideTexto("zzz", "Karla", "0102030405")).toBe(false)
  })
  it("tolera campos vacíos", () => {
    expect(coincideTexto("ol-0011", null, undefined, "OL-0011")).toBe(true)
    expect(normalizarTexto(null)).toBe("")
  })
})
