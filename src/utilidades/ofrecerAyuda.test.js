import { describe, it, expect } from "vitest"
import { esOfertaDeAyuda, mapConsulta, nombreTipo, indicadoresSoporte, TIPOS_CONSULTA } from "./soporte"
import { AYUDA_DE_MODULO, AYUDA_POR_MODULO, NOMBRE_MODULO_DE_USO, moduloDeAyuda, nombreModuloDeUso } from "./soporteAyuda"
import { consultasDePestana, pestanaDeConsulta, dondeEsta } from "./comunicacionInterna"
import { MODULOS_USO, PLAZO_AYUDA_DIAS, ayudaOfrecida, textoDeAccion, tiposVisibles } from "./superadminNegocio"
import { mensajeDeAyuda } from "../componentes/superadmin/VentanaOfrecerAyuda"

const fila = (extra = {}) => ({
  id: "c1", numero: 62, optica_id: "o1", autor_id: "sup", autor_nombre: "Diego", autor_rol: "Soporte", modulo: "ventas", tipo: "ayuda", urgencia: "normal", asunto: "Ayuda con Ventas",
  descripcion: "Hola", estado: "respondida", ultimo_mensaje_de: "soporte", respuesta_sin_leer: true, creada_en: "2026-10-16T15:00:00Z", actualizada_en: "2026-10-16T15:00:00Z",
  destino: "superadmin", iniciada_por: "soporte", ayuda_modulo: "ventas", ...extra,
})
const admin = { id: "adm", rol: "admin" }

describe("la consulta iniciada por el soporte", () => {
  it("el módulo viaja como dato y las consultas de siempre no son ofertas", () => {
    const c = mapConsulta(fila())
    expect(c).toMatchObject({ iniciadaPor: "soporte", ayudaModulo: "ventas" })
    expect(esOfertaDeAyuda(c)).toBe(true)
    const normal = mapConsulta(fila({ iniciada_por: undefined, ayuda_modulo: undefined, tipo: "pregunta" }))
    expect(normal).toMatchObject({ iniciadaPor: "optica", ayudaModulo: null })
    expect(esOfertaDeAyuda(normal)).toBe(false)
  })

  it("el tipo «ayuda» tiene nombre pero no se puede elegir al escribir una consulta", () => {
    expect(nombreTipo("ayuda")).toBe("Ayuda ofrecida")
    expect(nombreTipo("problema")).toBe("Problema")
    expect(TIPOS_CONSULTA.map((t) => t.id)).not.toContain("ayuda")
  })

  it("no altera los tiempos de atención: no espera una primera respuesta ni mide su resolución", () => {
    const oferta = mapConsulta(fila())
    const resuelta = mapConsulta(fila({ estado: "resuelta", resuelta_en: "2026-10-17T15:00:00Z" }))
    const propia = mapConsulta(fila({ id: "c2", iniciada_por: "optica", ayuda_modulo: null, tipo: "pregunta", estado: "recibida", ultimo_mensaje_de: "optica" }))
    const i = indicadoresSoporte([oferta, resuelta, propia])
    expect(i.sinResponder).toBe(1) // solo la que escribió la óptica
    expect(i.resolucionMin).toBeNull()
    expect(i.abiertas).toBe(2) // en Soporte sí cuentan como abiertas: los números coinciden con la lista
  })
})

describe("dónde ve el administrador una oferta de ayuda", () => {
  it("con las del soporte del sistema, no con las consultas de su personal", () => {
    const oferta = mapConsulta(fila())
    const delPersonal = mapConsulta(fila({ id: "c3", autor_id: "asi", iniciada_por: "optica", ayuda_modulo: null, tipo: "pregunta", destino: "admin" }))
    const propia = mapConsulta(fila({ id: "c4", autor_id: "adm", iniciada_por: "optica", ayuda_modulo: null, tipo: "pregunta" }))
    const todas = [oferta, delPersonal, propia]
    expect(pestanaDeConsulta(oferta, admin)).toBe("sistema")
    expect(consultasDePestana(todas, admin, "sistema").map((c) => c.id)).toEqual(["c1", "c4"])
    expect(consultasDePestana(todas, admin, "personal").map((c) => c.id)).toEqual(["c3"])
    expect(dondeEsta(oferta, admin)).toBe("Con el soporte del sistema")
  })
})

describe("la guía de cada módulo", () => {
  it("cada módulo de uso apunta a un módulo que existe en la Ayuda (la ficha clínica se explica en Pacientes)", () => {
    for (const m of MODULOS_USO) expect(AYUDA_POR_MODULO.some((g) => g.modulo === AYUDA_DE_MODULO[m.id])).toBe(true)
    expect(moduloDeAyuda("consultas")).toBe("pacientes")
    expect(moduloDeAyuda("inventado")).toBe("")
  })
  it("los módulos se llaman igual en la óptica y en el panel del superadmin", () => {
    for (const m of MODULOS_USO) expect(nombreModuloDeUso(m.id)).toBe(m.nombre)
    expect(Object.keys(NOMBRE_MODULO_DE_USO).sort()).toEqual(MODULOS_USO.map((m) => m.id).sort())
  })
})

describe("el límite de 30 días", () => {
  const ahora = new Date("2026-10-16T15:00:00Z").getTime()
  it("mientras no pasen 30 días no se vuelve a ofrecer, y dice desde cuándo", () => {
    expect(PLAZO_AYUDA_DIAS).toBe(30)
    const r = ayudaOfrecida("2026-10-10T15:00:00Z", ahora)
    expect(r.vigente).toBe(true)
    expect(r.desde.slice(0, 10)).toBe("2026-11-09")
  })
  it("pasados 30 días, sí; nunca ofrecida, sí", () => {
    expect(ayudaOfrecida("2026-09-10T15:00:00Z", ahora).vigente).toBe(false)
    expect(ayudaOfrecida("2026-09-16T15:00:00Z", ahora).vigente).toBe(false) // justo 30 días
    expect(ayudaOfrecida(null, ahora)).toEqual({ vigente: false, desde: "" })
  })
})

describe("el mensaje y la actividad", () => {
  it("el mensaje propuesto es corto, nombra el módulo y no escribe ninguna dirección", () => {
    const m = mensajeDeAyuda("Ventas")
    expect(m).toBe("Vimos que en los últimos 30 días no usaron Ventas. Te dejamos una guía paso a paso, y si tienes dudas, respóndenos aquí.")
    expect(m).not.toMatch(/https?:|localhost|\.app|\.com|www\./i)
    expect(m.length).toBeLessThan(200)
  })
  it("ofrecer ayuda queda en la actividad como una frase para personas, en el tipo Soporte", () => {
    expect(textoDeAccion({ accion: "ofrecer_ayuda", optica_nombre: "Óptica Solna Vision", detalle: "Ventas (SOP-0062)" }, false)).toBe("ofreció ayuda con Ventas (SOP-0062) a Óptica Solna Vision")
    expect(tiposVisibles(false).find((t) => t.id === "soporte").acciones).toContain("ofrecer_ayuda")
  })
})
