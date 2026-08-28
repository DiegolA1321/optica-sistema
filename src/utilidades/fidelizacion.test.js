import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  ultimaVisita,
  diasDesdeUltimaVisita,
  fechaProximoControl,
  diasVencido,
  esInactivo,
  contarConsultas,
  esClienteFrecuente,
  obtenerReferidos,
  UMBRAL_INACTIVO_DIAS,
} from "./fidelizacion"

describe("fidelizacion (con fecha fija: 10 de marzo de 2026)", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 2, 10, 12, 0, 0))
  })
  afterEach(() => vi.useRealTimers())

  describe("ultimaVisita / diasDesdeUltimaVisita", () => {
    it("usa la fecha de la consulta más reciente, emparejando por pacienteId", () => {
      const paciente = { id: 1, nombre: "Ana", fechaRegistro: "2020-01-01" }
      const consultas = [
        { pacienteId: 1, fecha: "2026-01-10" },
        { pacienteId: 1, fecha: "2026-02-15" }, // la más reciente
        { pacienteId: 2, fecha: "2026-03-09" }, // de otro paciente, no cuenta
      ]
      expect(diasDesdeUltimaVisita(paciente, consultas)).toBe(23) // 15 feb -> 10 mar
    })

    it("empareja por nombre solo si no hay pacienteId (fichas legado)", () => {
      const paciente = { id: null, nombre: "Beto Ruiz", fechaRegistro: "2020-01-01" }
      const consultas = [{ pacienteId: null, paciente: "Beto Ruiz", fecha: "2026-03-01" }]
      expect(diasDesdeUltimaVisita(paciente, consultas)).toBe(9)
    })

    it("sin consultas, cae a la fecha de registro", () => {
      const paciente = { id: 1, nombre: "Ana", fechaRegistro: "2026-02-08" }
      expect(diasDesdeUltimaVisita(paciente, [])).toBe(30)
    })

    it("sin registro ni consultas, devuelve null", () => {
      expect(diasDesdeUltimaVisita({ id: 1, nombre: "Ana" }, [])).toBeNull()
    })
  })

  describe("fechaProximoControl / diasVencido / esInactivo", () => {
    it("respeta proximoControlDias de la consulta más reciente", () => {
      const paciente = { id: 1, nombre: "Ana", fechaRegistro: "2020-01-01" }
      const consultas = [{ pacienteId: 1, fecha: "2026-01-01", proximoControlDias: 30 }]
      // objetivo: 2026-01-01 + 30 días = 2026-01-31; hoy 2026-03-10 => bien vencido
      expect(esInactivo(paciente, consultas)).toBe(true)
      expect(diasVencido(paciente, consultas)).toBeGreaterThan(0)
    })

    it("dentro del intervalo recomendado, no está inactivo", () => {
      const paciente = { id: 1, nombre: "Ana", fechaRegistro: "2020-01-01" }
      const consultas = [{ pacienteId: 1, fecha: "2026-03-05", proximoControlDias: 180 }]
      expect(esInactivo(paciente, consultas)).toBe(false)
    })

    it("sin consultas, usa el umbral genérico desde el registro", () => {
      const paciente = { id: 1, nombre: "Ana", fechaRegistro: "2025-01-01" }
      const objetivo = fechaProximoControl(paciente, [])
      const esperado = new Date(2025, 0, 1)
      esperado.setDate(esperado.getDate() + UMBRAL_INACTIVO_DIAS)
      expect(objetivo.getTime()).toBe(esperado.getTime())
    })
  })

  describe("contarConsultas / esClienteFrecuente", () => {
    it("cuenta solo las consultas del paciente indicado", () => {
      const paciente = { id: 1, nombre: "Ana" }
      const consultas = [
        { pacienteId: 1, fecha: "2026-01-01" },
        { pacienteId: 1, fecha: "2026-02-01" },
        { pacienteId: 2, fecha: "2026-02-01" },
      ]
      expect(contarConsultas(paciente, consultas)).toBe(2)
    })

    it("es cliente frecuente al llegar al mínimo (default 3)", () => {
      const paciente = { id: 1, nombre: "Ana" }
      const dosConsultas = [{ pacienteId: 1, fecha: "2026-01-01" }, { pacienteId: 1, fecha: "2026-02-01" }]
      const tresConsultas = [...dosConsultas, { pacienteId: 1, fecha: "2026-02-15" }]
      expect(esClienteFrecuente(paciente, dosConsultas)).toBe(false)
      expect(esClienteFrecuente(paciente, tresConsultas)).toBe(true)
    })

    it("acepta un mínimo custom", () => {
      const paciente = { id: 1, nombre: "Ana" }
      const unaConsulta = [{ pacienteId: 1, fecha: "2026-01-01" }]
      expect(esClienteFrecuente(paciente, unaConsulta, 1)).toBe(true)
    })
  })

  describe("obtenerReferidos", () => {
    it("agrupa pacientes por quién los refirió", () => {
      const pacientes = [
        { id: 1, nombre: "Ana", referidoPor: "Carlos" },
        { id: 2, nombre: "Beto", referidoPor: "Carlos" },
        { id: 3, nombre: "Diana", referidoPor: null },
      ]
      const mapa = obtenerReferidos(pacientes)
      expect(mapa.get("Carlos")).toHaveLength(2)
      expect(mapa.has(null)).toBe(false)
    })

    it("mapa vacío sin pacientes", () => {
      expect(obtenerReferidos([]).size).toBe(0)
    })
  })

  it("ultimaVisita ignora fechas no reconocibles y cae al registro", () => {
    const paciente = { id: 1, nombre: "Ana", fechaRegistro: "2026-01-01" }
    const consultas = [{ pacienteId: 1, fecha: "fecha-invalida" }]
    expect(ultimaVisita(paciente, consultas).getTime()).toBe(new Date(2026, 0, 1).getTime())
  })
})
