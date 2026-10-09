import { describe, it, expect } from "vitest"
import { diasAtencionAbierta, atencionesAbiertasAntiguas, textoAtencionAbierta } from "./atencionAbierta"

const hoy = new Date(2026, 9, 6, 11, 0) // 6 oct 2026

describe("atención abierta antigua", () => {
  it("una cita En atención de un día anterior cuenta los días", () => {
    expect(diasAtencionAbierta({ estado: "En Atención", fecha: "2026-09-10" }, hoy)).toBe(26)
    expect(diasAtencionAbierta({ estado: "En Atención", fecha: "2026-10-05" }, hoy)).toBe(1)
  })
  it("la de hoy o de una fecha futura no es antigua", () => {
    expect(diasAtencionAbierta({ estado: "En Atención", fecha: "2026-10-06" }, hoy)).toBeNull()
    expect(diasAtencionAbierta({ estado: "En Atención", fecha: "2026-10-08" }, hoy)).toBeNull()
  })
  it("otros estados no cuentan", () => {
    expect(diasAtencionAbierta({ estado: "Pendiente", fecha: "2026-09-10" }, hoy)).toBeNull()
    expect(diasAtencionAbierta({ estado: "Atendida", fecha: "2026-09-10" }, hoy)).toBeNull()
    expect(diasAtencionAbierta(null, hoy)).toBeNull()
  })
  it("las lista de la más antigua a la más reciente", () => {
    const citas = [
      { id: 1, estado: "En Atención", fecha: "2026-10-03" },
      { id: 2, estado: "En Atención", fecha: "2026-09-10" },
      { id: 3, estado: "En Atención", fecha: "2026-10-06" },
      { id: 4, estado: "Pendiente", fecha: "2026-08-01" },
    ]
    expect(atencionesAbiertasAntiguas(citas, hoy).map((x) => x.cita.id)).toEqual([2, 1])
  })
  it("el texto va en singular y plural", () => {
    expect(textoAtencionAbierta(1)).toBe("Abierta hace 1 día")
    expect(textoAtencionAbierta(26)).toBe("Abierta hace 26 días")
  })
})
