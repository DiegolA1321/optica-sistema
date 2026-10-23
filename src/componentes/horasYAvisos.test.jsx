import { describe, it, expect, vi, afterEach } from "vitest"
import fs from "node:fs"
import path from "node:path"
import { render, screen, act, renderHook } from "@testing-library/react"
import AvisoFlotante, { tipoDeAviso, useAvisoTemporal, DURACION_AVISO_MS } from "./AvisoFlotante"
import { horaSinCero } from "../utilidades/formatoFecha"

afterEach(() => { vi.useRealTimers() })

describe("el mensaje flotante de todo el sistema", () => {
  it("va arriba, centrado, del ancho de su texto y encima del contenido (no mueve nada), con su ícono", () => {
    render(<AvisoFlotante texto="Horario de Ana guardado." />)
    const aviso = screen.getByRole("status")
    expect(aviso).toHaveTextContent("Horario de Ana guardado.")
    for (const c of ["fixed", "top-4", "left-1/2", "-translate-x-1/2", "w-max"]) expect(aviso.className).toContain(c)
    expect(aviso.querySelector("svg")).not.toBeNull()
  })
  it("un aviso de error lleva el ícono y el rol de alerta; el texto lo deduce si no se le dice", () => {
    expect(tipoDeAviso("No se pudo guardar el horario.")).toBe("error")
    expect(tipoDeAviso("Horario de Ana guardado.")).toBe("exito")
    render(<AvisoFlotante texto="Algo falló" tipo="error" />)
    expect(screen.getByRole("alert")).toBeInTheDocument()
  })
  it("desaparece solo a los 3 segundos", () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useAvisoTemporal())
    act(() => result.current[1]("Guardado."))
    expect(result.current[0]).toBe("Guardado.")
    act(() => { vi.advanceTimersByTime(DURACION_AVISO_MS - 1) })
    expect(result.current[0]).toBe("Guardado.")
    act(() => { vi.advanceTimersByTime(2) })
    expect(result.current[0]).toBeNull()
    expect(DURACION_AVISO_MS).toBe(3000)
  })
})

describe("horas en formato del sistema", () => {
  it("«2:00 PM» en los horarios de trabajo", () => {
    expect([horaSinCero("14:00"), horaSinCero("09:30"), horaSinCero("00:15"), horaSinCero("12:00")]).toEqual(["2:00 PM", "9:30 AM", "12:15 AM", "12:00 PM"])
  })
  it("ningún campo de hora del sistema usa <input type=\"time\"> (muestra 24 h): todos usan CampoHora", () => {
    const raiz = path.resolve(__dirname, "..")
    const culpables = []
    const recorrer = (dir) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name)
        if (e.isDirectory()) recorrer(p)
        else if (/\.(jsx)$/.test(e.name) && !/\.test\./.test(e.name) && /<input[^>]*type=["']time["']/.test(fs.readFileSync(p, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1"))) culpables.push(path.relative(raiz, p))
      }
    }
    recorrer(raiz)
    expect(culpables).toEqual([])
  })
})
