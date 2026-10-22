import { describe, it, expect } from "vitest"
import { recordatorioDeConteo, conteoPendiente, diasEntre, textoConteo } from "./recordatorioConteo"

describe("recordatorio del conteo", () => {
  it("por defecto es cada 30 días y está activo", () => {
    expect(recordatorioDeConteo({})).toEqual({ activo: true, dias: 30 })
    expect(recordatorioDeConteo(undefined)).toEqual({ activo: true, dias: 30 })
  })
  it("respeta lo guardado y descarta valores inválidos", () => {
    expect(recordatorioDeConteo({ recordatorioConteo: { activo: true, dias: 15 } }).dias).toBe(15)
    expect(recordatorioDeConteo({ recordatorioConteo: { dias: 0 } }).dias).toBe(30)
    expect(recordatorioDeConteo({ recordatorioConteo: { dias: 9999 } }).dias).toBe(30)
    expect(recordatorioDeConteo({ recordatorioConteo: { activo: false } }).activo).toBe(false)
  })
  it("cuenta días calendario", () => {
    expect(diasEntre("2026-10-01", "2026-10-31")).toBe(30)
    expect(diasEntre("2026-02-28", "2026-03-01")).toBe(1)
  })
  it("toca al cumplirse los días desde la última hoja", () => {
    const p = { ultimoConteo: "2026-09-22" }
    expect(conteoPendiente({ parametrizacion: p, hoy: "2026-10-21" })).toMatchObject({ toca: false, dias: 29 })
    expect(conteoPendiente({ parametrizacion: p, hoy: "2026-10-22" })).toMatchObject({ toca: true, dias: 30, nunca: false })
  })
  it("al generar la hoja se reinicia: la fecha nueva apaga el aviso", () => {
    expect(conteoPendiente({ parametrizacion: { ultimoConteo: "2026-10-22" }, hoy: "2026-10-22" }).toca).toBe(false)
  })
  it("sin ningún conteo cuenta desde que se creó la óptica", () => {
    expect(conteoPendiente({ parametrizacion: {}, creadaEn: "2026-08-01T10:00:00Z", hoy: "2026-10-22" })).toMatchObject({ toca: true, nunca: true })
    expect(conteoPendiente({ parametrizacion: {}, creadaEn: "2026-10-10T10:00:00Z", hoy: "2026-10-22" }).toca).toBe(false)
  })
  it("desactivado no avisa nunca, y sin fecha de partida tampoco", () => {
    expect(conteoPendiente({ parametrizacion: { recordatorioConteo: { activo: false }, ultimoConteo: "2020-01-01" }, hoy: "2026-10-22" }).toca).toBe(false)
    expect(conteoPendiente({ parametrizacion: {}, hoy: "2026-10-22" }).toca).toBe(false)
  })
  it("el texto distingue si nunca se contó", () => {
    expect(textoConteo({ dias: 45, nunca: true })).toMatch(/Todavía no se hizo ningún conteo/)
    expect(textoConteo({ dias: 31, nunca: false })).toBe("Hace 31 días del último conteo")
  })
})
