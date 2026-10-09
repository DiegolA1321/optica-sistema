import { describe, it, expect, beforeEach } from "vitest"
import { renderHook, act } from "@testing-library/react"
import { leerParam, escribirParam, useParamUrl } from "./urlEstado"

beforeEach(() => window.history.replaceState(null, "", "/?seccion=ventas"))

describe("urlEstado", () => {
  it("escribe y lee un parámetro sin tocar los demás", () => {
    escribirParam("tab", "saldos")
    expect(leerParam("tab")).toBe("saldos")
    expect(leerParam("seccion")).toBe("ventas")
  })

  it("quitar el parámetro lo borra de la URL", () => {
    escribirParam("tab", "saldos")
    escribirParam("tab", null)
    expect(window.location.search).toBe("?seccion=ventas")
  })

  it("empujar crea una entrada nueva y reemplazar no", () => {
    const antes = window.history.length
    escribirParam("tab", "a")
    expect(window.history.length).toBe(antes)
    escribirParam("paciente", "7", { empujar: true })
    expect(window.history.length).toBe(antes + 1)
  })

  it("useParamUrl empieza con el valor de la URL, y si es inválido usa el defecto", () => {
    escribirParam("tab", "ordenes")
    expect(renderHook(() => useParamUrl("tab", "cola", ["cola", "ordenes"])).result.current[0]).toBe("ordenes")
    escribirParam("tab", "inventada")
    expect(renderHook(() => useParamUrl("tab", "cola", ["cola", "ordenes"])).result.current[0]).toBe("cola")
  })

  it("useParamUrl guarda el cambio en la URL y el valor por defecto la deja limpia", () => {
    const { result } = renderHook(() => useParamUrl("tab", "cola", ["cola", "saldos"]))
    act(() => result.current[1]("saldos"))
    expect(leerParam("tab")).toBe("saldos")
    act(() => result.current[1]("cola"))
    expect(leerParam("tab")).toBeNull()
  })
})
