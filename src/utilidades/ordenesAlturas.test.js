import { describe, it, expect } from "vitest"
import { alturasDeTexto, textoDeAlturas, datosInicialesOrden } from "./ordenesLaboratorio"

describe("altura de montaje por ojo (se toma en la orden, no en la ficha)", () => {
  it("se guarda como «OD 18 · OI 17» y se lee de vuelta", () => {
    expect(textoDeAlturas("18", "17")).toBe("OD 18 · OI 17")
    expect(alturasDeTexto("OD 18 · OI 17")).toEqual({ od: "18", oi: "17" })
    expect(textoDeAlturas("", "")).toBe("")
    expect(alturasDeTexto("OD 18")).toEqual({ od: "18", oi: "" })
  })
  it("una altura escrita de la forma antigua vale para los dos ojos", () => {
    expect(alturasDeTexto("18")).toEqual({ od: "18", oi: "18" })
    expect(alturasDeTexto("")).toEqual({ od: "", oi: "" })
  })
})

describe("la orden arranca con lo de la ficha", () => {
  const consulta = {
    od: { esfera: "-1.75", cilindro: "-0.75", eje: "10" }, oi: { esfera: "-1.00", cilindro: "-0.50", eje: "180" }, lenteRecomendado: "Progresivo",
    medidas: { adicionOd: "+1.50", adicionOi: "+1.75", dp: "62", dpCerca: "59", prismaOdCant: "2", prismaOdBase: "Nasal" },
  }
  it("adición por ojo, DP de lejos y de cerca, y el prisma en las observaciones; la altura NO viene de la ficha", () => {
    const d = datosInicialesOrden(consulta)
    expect(d.recetaOd.adicion).toBe("+1.50")
    expect(d.recetaOi.adicion).toBe("+1.75")
    expect(d.dpLejos).toBe("62")
    expect(d.dpCerca).toBe("59")
    expect(d.alturaMontaje).toBe("")
    expect(d.observaciones).toBe("Prisma: OD 2Δ base nasal")
  })
  it("una ficha anterior (una sola adición y su altura) se sigue precargando", () => {
    const d = datosInicialesOrden({ od: { esfera: "-1" }, oi: { esfera: "-1" }, medidas: { adicion: "+1.00", dp: "60", alt: "18" } })
    expect(d.recetaOd.adicion).toBe("+1.00")
    expect(d.recetaOi.adicion).toBe("+1.00")
    expect(d.alturaMontaje).toBe("18")
    expect(d.observaciones).toBe("")
  })
})
