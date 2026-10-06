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
})
