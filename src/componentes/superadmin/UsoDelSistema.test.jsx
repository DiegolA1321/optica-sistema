import { describe, it, expect } from "vitest"
import { enlaceAyudaDeModulo, AYUDA_DE_MODULO } from "./UsoDelSistema"
import { AYUDA_POR_MODULO } from "../../utilidades/soporteAyuda"
import { MODULOS_USO } from "../../utilidades/superadminNegocio"

describe("el enlace a la Ayuda de un módulo", () => {
  it("lleva a Soporte → Ayuda de la óptica con el módulo ya elegido", () => {
    const url = new URL(enlaceAyudaDeModulo("citas", "qu7u2j", "https://optica-sistema-zeta.vercel.app"))
    expect(url.searchParams.get("optica")).toBe("qu7u2j")
    expect(url.searchParams.get("seccion")).toBe("mensajes")
    expect(url.searchParams.get("tab")).toBe("ayuda")
    expect(url.searchParams.get("modulo")).toBe("citas")
  })
  it("cada módulo de uso apunta a un módulo que existe en la Ayuda (la ficha clínica se explica en Pacientes)", () => {
    for (const m of MODULOS_USO) expect(AYUDA_POR_MODULO.some((g) => g.modulo === AYUDA_DE_MODULO[m.id])).toBe(true)
    expect(AYUDA_DE_MODULO.consultas).toBe("pacientes")
  })
})
