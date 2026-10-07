import { describe, it, expect } from "vitest"
import { calcularEmbudo } from "./embudo"

const enRango = (f) => !!f && f.slice(0, 10) >= "2026-10-01" && f.slice(0, 10) <= "2026-10-31"
let n = 0
const pase = (estado, extra = {}) => ({ id: ++n, estado, consultaId: "c" + n, ...extra })

describe("calcularEmbudo", () => {
  it("cuenta consultas, pases, compras, no compras por motivo y proformas", () => {
    const e = calcularEmbudo({
      enRango,
      consultas: [
        { id: "c1", fecha: "2026-10-02" }, { id: "c2", fecha: "2026-10-03" }, { id: "c3", fecha: "2026-10-04" }, { id: "c4", fecha: "2026-10-05" },
        { id: "c5", fecha: "2026-10-06" }, { id: "c6", fecha: "2026-10-07" }, { id: "c7", fecha: "2026-10-08" }, { id: "cViejo", fecha: "2026-09-01" },
      ],
      pases: [
        pase("vendido", { proformaEntregadaEn: "2026-10-05T11:00:00Z" }),
        pase("vendido"),
        pase("descartado", { motivoDescarte: "precio", proformaEntregadaEn: "2026-10-05T11:00:00Z" }),
        pase("descartado", { motivoDescarte: "lo_pensara" }),
        pase("listo"),
        pase("vendido", { consultaId: "cViejo" }),
      ],
    })
    expect(e.consultaron).toBe(7)
    expect(e.pasaron).toBe(5)
    expect(e.compraron).toBe(2)
    expect(e.noCompraron).toBe(2)
    expect(e.enEspera).toBe(1)
    expect(e.pasaronSobreConsultaron).toBe(71)
    expect(e.compraronSobrePasaron).toBe(40)
    expect(e.motivos.find((m) => m.id === "precio").cantidad).toBe(1)
    expect(e.motivos.find((m) => m.id === "otro_lugar").cantidad).toBe(0)
    expect(e.proformas).toBe(2)
    expect(e.proformasEnVenta).toBe(1)
    expect(e.proformasSobreVenta).toBe(50)
  })
  it("sin datos no inventa porcentajes", () => {
    const e = calcularEmbudo({ enRango, consultas: [], pases: [] })
    expect(e.pasaronSobreConsultaron).toBeNull()
    expect(e.proformasSobreVenta).toBeNull()
  })

  describe("compras reales (comprobantes)", () => {
    const consultas = [
      { id: "a", fecha: "2026-10-02" }, { id: "b", fecha: "2026-10-03" }, { id: "c", fecha: "2026-10-04" }, { id: "d", fecha: "2026-10-05" },
    ]
    it("compró = comprobante no anulado; un comprobante anulado deja de contar aunque el pase siga 'vendido'", () => {
      const e = calcularEmbudo({
        enRango, consultas,
        pases: [{ id: 1, estado: "vendido", consultaId: "a" }, { id: 2, estado: "vendido", consultaId: "b" }],
        facturas: [{ consultaId: "a", estado: "pagada" }, { consultaId: "b", estado: "anulada" }, { consultaId: "c", estado: "pendiente_pago" }],
      })
      expect(e.compraron).toBe(2) // a (con pase) y c (comprobante sin pase)
      expect(e.pasaron).toBe(3) // a, b (tiene pase) y c
      expect(e.compraronSobreConsultaron).toBe(50)
    })
    it("sin comprobantes cargados sigue contando los pases vendidos", () => {
      const e = calcularEmbudo({ enRango, consultas, pases: [{ id: 1, estado: "vendido", consultaId: "a" }] })
      expect(e.compraron).toBe(1)
    })
  })
  describe("primera vez (R40)", () => {
    const consultas = [
      { id: "a", pacienteId: "p1", citaId: "k1", fecha: "2026-10-02" }, // nuevo, compró
      { id: "b", pacienteId: "p2", citaId: "k2", fecha: "2026-10-03" }, // nuevo, no compró
      { id: "c", pacienteId: "p3", citaId: "k3", fecha: "2026-10-04" }, // ya era paciente (viene del historial)
      { id: "d", pacienteId: "p4", citaId: null, fecha: "2026-10-05" }, // sin cita, nuevo
      { id: "h", pacienteId: "p3", citaId: "k0", fecha: "2026-08-10" }, // consulta vieja de p3
    ]
    const pases = [
      { id: 1, estado: "vendido", consultaId: "a" },
      { id: 2, estado: "descartado", consultaId: "b", motivoDescarte: "precio" },
      { id: 3, estado: "vendido", consultaId: "c" },
    ]
    it("separa primera vez de quienes ya eran pacientes y cuenta cuántos de los nuevos compraron", () => {
      const e = calcularEmbudo({ enRango, consultas, pases })
      expect(e.consultaron).toBe(4)
      expect(e.primeraVez).toBe(3)
      expect(e.yaEranPacientes).toBe(1)
      expect(e.compraronPrimeraVez).toBe(1)
      expect(e.compraronPrimeraVezSobrePrimeraVez).toBe(33)
      expect(e.compraron).toBe(2)
    })
    it("usa el historial completo: con un filtro por motivo no cambia quién es nuevo", () => {
      const filtradas = consultas.filter((c) => c.id === "c")
      const sinHistorial = calcularEmbudo({ enRango, consultas: filtradas, pases })
      expect(sinHistorial.primeraVez).toBe(1) // sin historial, el paciente antiguo parecería nuevo
      const conHistorial = calcularEmbudo({ enRango, consultas: filtradas, pases, historial: consultas })
      expect(conHistorial.primeraVez).toBe(0)
      expect(conHistorial.yaEranPacientes).toBe(1)
    })
    it("sin consultas no inventa porcentajes", () => {
      const e = calcularEmbudo({ enRango, consultas: [], pases: [] })
      expect(e.primeraVez).toBe(0)
      expect(e.compraronPrimeraVezSobrePrimeraVez).toBeNull()
    })
  })
})
