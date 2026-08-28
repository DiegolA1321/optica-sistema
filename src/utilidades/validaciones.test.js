import { describe, it, expect } from "vitest"
import {
  filtrarSoloLetras,
  filtrarSoloNumeros,
  filtrarNumeroDecimalConSigno,
  filtrarNumeroDecimal,
  esNombreValido,
  esCedulaValida,
  esTelefonoValido,
  esEmailValido,
} from "./validaciones"

describe("filtrarSoloLetras", () => {
  it("quita dígitos y símbolos", () => {
    expect(filtrarSoloLetras("Diego123!")).toBe("Diego")
  })
  it("conserva tildes, ñ, espacios, guion y apóstrofe", () => {
    expect(filtrarSoloLetras("María José Peña-Zambrano O'Brien")).toBe("María José Peña-Zambrano O'Brien")
  })
  it("recorta a maxLen si se pasa", () => {
    expect(filtrarSoloLetras("Alejandro", 4)).toBe("Alej")
  })
  it("con valor vacío o null no revienta", () => {
    expect(filtrarSoloLetras("")).toBe("")
    expect(filtrarSoloLetras(null)).toBe("")
  })
})

describe("filtrarSoloNumeros", () => {
  it("quita todo lo que no sea dígito", () => {
    expect(filtrarSoloNumeros("abc-0999.123 def")).toBe("0999123")
  })
  it("respeta maxLen", () => {
    expect(filtrarSoloNumeros("12345678901234", 10)).toBe("1234567890")
  })
})

describe("filtrarNumeroDecimalConSigno", () => {
  it("permite un signo inicial y un solo punto decimal", () => {
    expect(filtrarNumeroDecimalConSigno("-2.75")).toBe("-2.75")
    expect(filtrarNumeroDecimalConSigno("+1.50")).toBe("+1.50")
  })
  it("descarta signos repetidos o fuera de la primera posición", () => {
    expect(filtrarNumeroDecimalConSigno("1-2+3")).toBe("123")
  })
  it("colapsa varios puntos en uno solo", () => {
    expect(filtrarNumeroDecimalConSigno("1.2.3.4")).toBe("1.234")
  })
})

describe("filtrarNumeroDecimal", () => {
  it("permite solo dígitos y un punto", () => {
    expect(filtrarNumeroDecimal("$145.50")).toBe("145.50")
  })
  it("colapsa varios puntos en uno solo", () => {
    expect(filtrarNumeroDecimal("1.2.3")).toBe("1.23")
  })
})

describe("esNombreValido", () => {
  it("acepta nombres con tildes y más de un caracter", () => {
    expect(esNombreValido("José")).toBe(true)
  })
  it("rechaza nombres con dígitos", () => {
    expect(esNombreValido("Diego1")).toBe(false)
  })
  it("rechaza vacío o un solo caracter", () => {
    expect(esNombreValido("")).toBe(false)
    expect(esNombreValido("D")).toBe(false)
  })
})

describe("esCedulaValida", () => {
  it("acepta una cédula ecuatoriana real (dígito verificador correcto)", () => {
    // Cédula de ejemplo con dígito verificador válido (algoritmo módulo 10, provincia 13 = Manabí).
    expect(esCedulaValida("1312345679")).toBe(true)
  })
  it("rechaza secuencias inventadas sin dígito verificador válido", () => {
    expect(esCedulaValida("0000000000")).toBe(false)
    expect(esCedulaValida("1234567890")).toBe(false)
  })
  it("rechaza longitudes distintas de 10", () => {
    expect(esCedulaValida("123")).toBe(false)
    expect(esCedulaValida("12345678901")).toBe(false)
  })
  it("rechaza código de provincia fuera de 01-24", () => {
    expect(esCedulaValida("9912345675")).toBe(false)
  })
})

describe("esTelefonoValido", () => {
  it("acepta entre 7 y 10 dígitos", () => {
    expect(esTelefonoValido("0991234567")).toBe(true)
    expect(esTelefonoValido("1234567")).toBe(true)
  })
  it("rechaza menos de 7 o más de 10 dígitos", () => {
    expect(esTelefonoValido("123456")).toBe(false)
    expect(esTelefonoValido("12345678901")).toBe(false)
  })
  it("vacío es válido si es opcional, inválido si no lo es", () => {
    expect(esTelefonoValido("", true)).toBe(true)
    expect(esTelefonoValido("", false)).toBe(false)
  })
})

describe("esEmailValido", () => {
  it("acepta un correo con forma válida", () => {
    expect(esEmailValido("nombre@dominio.com", false)).toBe(true)
  })
  it("rechaza formatos inválidos", () => {
    expect(esEmailValido("correo-sin-arroba", false)).toBe(false)
    expect(esEmailValido("@sin-usuario.com", false)).toBe(false)
    expect(esEmailValido("sin-dominio@", false)).toBe(false)
  })
  it("vacío es válido si es opcional (default), inválido si no lo es", () => {
    expect(esEmailValido("")).toBe(true)
    expect(esEmailValido("", false)).toBe(false)
  })
})
