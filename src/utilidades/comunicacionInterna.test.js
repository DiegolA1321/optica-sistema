import { describe, it, expect } from "vitest"
import {
  pestanasDeSoporte, pestanaValida, consultasDePestana, dondeEsta, puedeEscalar, estaEscalada, destinoLegible, resumenDeLecturas, textoLeidoPor, avisosUnificados, estaVencido, mapAvisoInterno,
} from "./comunicacionInterna"

const admin = { id: "a1", rol: "admin" }
const rosa = { id: "r1", rol: "asistente" }
const consulta = (extra = {}) => ({ id: "c", autorId: "r1", destino: "admin", escaladaEn: null, estado: "recibida", ...extra })

describe("pestañas de Soporte por nivel", () => {
  it("el administrador: Consultas del personal, Soporte del sistema, Avisos y Ayuda al final", () => {
    expect(pestanasDeSoporte(admin)).toEqual(["personal", "sistema", "avisos", "ayuda"])
    expect(pestanasDeSoporte({ ...admin, impersonadoPor: { id: "s1" } })).toEqual(["personal", "avisos", "ayuda"])
  })
  it("el resto del personal: Mis consultas, Avisos y Ayuda al final", () => {
    expect(pestanasDeSoporte(rosa)).toEqual(["consultas", "avisos", "ayuda"])
  })
  it("una dirección con una pestaña que esa persona no tiene cae en su primera pestaña", () => {
    expect(pestanaValida(admin, "consultas")).toBe("personal")
    expect(pestanaValida(rosa, "personal")).toBe("consultas")
    expect(pestanaValida(rosa, "ayuda")).toBe("ayuda")
  })
})

describe("consultas de cada pestaña", () => {
  const todas = [consulta({ id: "1" }), consulta({ id: "2", autorId: "a1", destino: "superadmin" }), consulta({ id: "3", destino: "superadmin", escaladaEn: "2026-10-16T10:00:00Z" })]
  it("el administrador separa las de su personal (también las escaladas) de las suyas al soporte del sistema", () => {
    expect(consultasDePestana(todas, admin, "personal").map((c) => c.id)).toEqual(["1", "3"])
    expect(consultasDePestana(todas, admin, "sistema").map((c) => c.id)).toEqual(["2"])
  })
  it("el personal solo tiene las suyas", () => {
    expect(consultasDePestana([consulta({ id: "1" })], rosa, "consultas").map((c) => c.id)).toEqual(["1"])
  })
})

describe("a quién le toca y quién puede escalar", () => {
  it("dónde está la consulta", () => {
    expect(dondeEsta(consulta())).toBe("Con tu administrador")
    expect(dondeEsta(consulta(), rosa)).toBe("Con tu administrador")
    expect(dondeEsta(consulta(), admin)).toBe("La atiendes tú")
    expect(dondeEsta(consulta({ destino: "superadmin", escaladaEn: "2026-10-16T10:00:00Z" }))).toBe("Escalada al soporte del sistema")
    expect(dondeEsta(consulta({ destino: "superadmin", autorId: "a1" }))).toBe("Con el soporte del sistema")
    expect(estaEscalada(consulta({ destino: "superadmin", escaladaEn: "x" }))).toBe(true)
    expect(estaEscalada(consulta())).toBe(false)
  })
  it("solo el administrador escala, una consulta de su personal, abierta y todavía con él", () => {
    expect(puedeEscalar(consulta(), admin)).toBe(true)
    expect(puedeEscalar(consulta(), rosa)).toBe(false)
    expect(puedeEscalar(consulta({ estado: "resuelta" }), admin)).toBe(false)
    expect(puedeEscalar(consulta({ destino: "superadmin", escaladaEn: "x" }), admin)).toBe(false)
    expect(puedeEscalar(consulta({ autorId: "a1", destino: "superadmin" }), admin)).toBe(false)
  })
})

describe("avisos internos", () => {
  const roles = [{ id: "ro", nombre: "Optómetra" }]
  const personas = [{ id: "p1", nombre: "Vera Ventas" }]
  it("dice a quién va", () => {
    expect(destinoLegible({ para: "todos" })).toBe("Todo el personal")
    expect(destinoLegible({ para: "rol", rolId: "ro" }, { roles })).toBe("Rol Optómetra")
    expect(destinoLegible({ para: "persona", perfilId: "p1" }, { personas })).toBe("Vera Ventas")
    expect(destinoLegible({ para: "rol", rolId: "borrado" }, { roles })).toMatch(/eliminado/)
  })
  it("'Leído por 3 de 5' con quién lo leyó primero", () => {
    const r = resumenDeLecturas([
      { aviso_id: "a", perfil_id: "1", nombre: "Zoe", leido_en: null },
      { aviso_id: "a", perfil_id: "2", nombre: "Ana", leido_en: "2026-10-16T10:00:00Z" },
      { aviso_id: "a", perfil_id: "3", nombre: "Bea", leido_en: "2026-10-16T11:00:00Z" },
      { aviso_id: "b", perfil_id: "1", nombre: "Zoe", leido_en: null },
    ])
    expect(textoLeidoPor(r.a)).toBe("Leído por 2 de 3")
    expect(r.a.personas.map((p) => p.nombre)).toEqual(["Ana", "Bea", "Zoe"])
    expect(textoLeidoPor(r.b)).toBe("Leído por 0 de 1")
    expect(textoLeidoPor(undefined)).toBe("Sin destinatarios")
  })
  it("vence al día siguiente de su fecha", () => {
    expect(estaVencido({ venceEl: "2026-10-15" }, "2026-10-16")).toBe(true)
    expect(estaVencido({ venceEl: "2026-10-16" }, "2026-10-16")).toBe(false)
    expect(estaVencido({ venceEl: null }, "2026-10-16")).toBe(false)
  })
  it("une los del sistema y los internos: no leídos primero, luego los más recientes", () => {
    const lista = avisosUnificados({
      sistema: [{ id: "s1", asunto: "Mantenimiento", cuerpo: "x", creadoEn: "2026-10-10T10:00:00Z", leido: false }, { id: "s2", asunto: "Viejo", cuerpo: "x", creadoEn: "2026-10-01T10:00:00Z", leido: true }],
      internos: [mapAvisoInterno({ id: "i1", titulo: "Cierre", cuerpo: "x", creado_en: "2026-10-12T10:00:00Z", autor_nombre: "Ana", para: "todos" }), mapAvisoInterno({ id: "i2", titulo: "Leído", cuerpo: "x", creado_en: "2026-10-13T10:00:00Z", autor_nombre: "Ana", para: "todos" })],
      leidosInternos: ["i2"],
    })
    expect(lista.map((a) => a.id)).toEqual(["i1", "s1", "i2", "s2"])
    expect(lista.find((a) => a.id === "i1")).toMatchObject({ origen: "interno", titulo: "Cierre", leido: false })
    expect(lista.find((a) => a.id === "s1")).toMatchObject({ origen: "sistema", titulo: "Mantenimiento" })
  })
})
