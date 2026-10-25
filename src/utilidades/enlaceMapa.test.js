import { describe, it, expect } from "vitest"
import { esEnlaceMapa, esEnlaceMapaCorto, datosDeEnlaceMapa, mapaGuardado, resolverEnlaceMapa, urlMapaIncrustado } from "./enlaceMapa"

const LARGA = "https://www.google.com/maps/place/%C3%92PTICA+SOLNA-VISI%C3%92N/@-0.7862055,-80.2372332,17z/data=!3m1!4b1!4m6!3m5!1s0x902ba5b9d802d589:0x9aadad7323268a0a!8m2!3d-0.7862109!4d-80.2346583!16s%2Fg%2F11ssjzcg36?entry=tts&g_ep=EgoyMDI2MTAyMC4wIPu8ASoASAFQAw%3D%3D"
const CORTA = "https://maps.app.goo.gl/ZMMY8KdKNcP67PAB7"

describe("enlace de Google Maps", () => {
  it("reconoce los enlaces de Google Maps y rechaza lo demás", () => {
    expect(esEnlaceMapa(CORTA)).toBe(true)
    expect(esEnlaceMapa(LARGA)).toBe(true)
    expect(esEnlaceMapaCorto(CORTA)).toBe(true)
    expect(esEnlaceMapaCorto(LARGA)).toBe(false)
    for (const malo of ["", "hola", "http://maps.app.goo.gl/x", "https://evil.com/maps/place/x", "https://www.google.com/search?q=maps", "javascript:alert(1)"]) expect(esEnlaceMapa(malo)).toBe(false)
  })

  it("saca el nombre y las coordenadas exactas del lugar (no las del centro de la vista)", () => {
    expect(datosDeEnlaceMapa(LARGA)).toEqual({ nombre: "ÒPTICA SOLNA-VISIÒN", lat: -0.7862109, lng: -80.2346583 })
  })

  it("sin coordenadas exactas usa las de la vista, y entiende ?q=lat,lng", () => {
    expect(datosDeEnlaceMapa("https://www.google.com/maps/place/Mi+Optica/@-2.1,-79.9,17z")).toEqual({ nombre: "Mi Optica", lat: -2.1, lng: -79.9 })
    expect(datosDeEnlaceMapa("https://www.google.com/maps?q=-2.2,-79.8")).toEqual({ nombre: "", lat: -2.2, lng: -79.8 })
    expect(datosDeEnlaceMapa("https://www.google.com/maps/place/Sin+coordenadas")).toBeNull()
  })

  it("resuelve un enlace corto con el servidor y guarda el enlace pegado", async () => {
    const llamadas = []
    const r = await resolverEnlaceMapa(CORTA, async (u) => { llamadas.push(u); return LARGA })
    expect(llamadas).toEqual([CORTA])
    expect(r).toEqual({ opticaMapaUrl: CORTA, opticaMapaNombre: "ÒPTICA SOLNA-VISIÒN", opticaMapaLat: -0.7862109, opticaMapaLng: -80.2346583 })
  })

  it("un enlace largo no necesita servidor", async () => {
    const r = await resolverEnlaceMapa(LARGA, async () => { throw new Error("no debe llamarse") })
    expect(r.opticaMapaLat).toBe(-0.7862109)
  })

  it("mensajes claros cuando falla", async () => {
    await expect(resolverEnlaceMapa("hola")).rejects.toThrow(/enlace de Google Maps/)
    await expect(resolverEnlaceMapa(CORTA, async () => { throw new Error("x") })).rejects.toThrow(/No se pudo abrir el enlace/)
    await expect(resolverEnlaceMapa(CORTA, async () => "https://www.google.com/maps/place/Sin+coordenadas")).rejects.toThrow(/No se pudo ubicar/)
  })

  it("lo guardado solo vale con enlace de Google Maps y coordenadas válidas", () => {
    expect(mapaGuardado({ opticaMapaUrl: CORTA, opticaMapaNombre: "X", opticaMapaLat: -0.78, opticaMapaLng: -80.23 })).toEqual({ url: CORTA, nombre: "X", lat: -0.78, lng: -80.23 })
    expect(mapaGuardado({})).toBeNull()
    expect(mapaGuardado({ opticaMapaUrl: CORTA, opticaMapaLat: 999, opticaMapaLng: 0 })).toBeNull()
    expect(mapaGuardado({ opticaMapaUrl: "https://evil.com", opticaMapaLat: 1, opticaMapaLng: 1 })).toBeNull()
    expect(urlMapaIncrustado({ lat: -0.78, lng: -80.23 })).toBe("https://www.google.com/maps?q=-0.78,-80.23&z=17&output=embed")
  })
})
