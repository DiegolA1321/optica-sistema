import { describe, it, expect } from "vitest"
import { sugerirDiagnostico } from "./diagnosticoSugerido"
import { datosOpticaReceta } from "./datosReceta"

const catalogo = ["Miopía", "Hipermetropía", "Astigmatismo", "Presbicia", "Miopía y astigmatismo", "Hipermetropía y astigmatismo", "Sin alteración refractiva", "Otro"]
const ojo = (esfera, cilindro = "") => ({ esfera, cilindro, eje: cilindro ? "90" : "" })

describe("diagnóstico sugerido según la refracción", () => {
  it("esfera negativa con cilindro: «Miopía y astigmatismo» del catálogo", () => {
    const s = sugerirDiagnostico({ od: ojo("-1.75", "-0.75"), oi: ojo("-1.00", "-0.50"), medidas: {} }, catalogo)
    expect(s.categorias).toEqual(["Miopía y astigmatismo"])
    expect(s.motivo).toBe("Esfera negativa con cilindro")
    expect(s.presbicia).toBe(false)
  })
  it("solo esfera negativa: «Miopía»; positiva: «Hipermetropía»; solo cilindro: «Astigmatismo»", () => {
    expect(sugerirDiagnostico({ od: ojo("-2.00"), oi: ojo("-1.75"), medidas: {} }, catalogo).categorias).toEqual(["Miopía"])
    expect(sugerirDiagnostico({ od: ojo("+1.50"), oi: ojo("+1.25"), medidas: {} }, catalogo).categorias).toEqual(["Hipermetropía"])
    expect(sugerirDiagnostico({ od: ojo("0.00", "-1.00"), oi: ojo("0.00", "-0.75"), medidas: {} }, catalogo).categorias).toEqual(["Astigmatismo"])
  })
  it("sin defecto: «Sin alteración refractiva»", () => {
    expect(sugerirDiagnostico({ od: ojo("0.00"), oi: ojo("+0.25"), medidas: {} }, catalogo).categorias).toEqual(["Sin alteración refractiva"])
  })
  it("si el catálogo no trae la categoría combinada, sugiere las dos sueltas; nunca inventa una nueva", () => {
    const corto = ["Miopía", "Astigmatismo", "Otro"]
    expect(sugerirDiagnostico({ od: ojo("-1.75", "-0.75"), oi: ojo("-1.00"), medidas: {} }, corto).categorias).toEqual(["Miopía", "Astigmatismo"])
    expect(sugerirDiagnostico({ od: ojo("+2.00"), oi: ojo("+2.00"), medidas: {} }, ["Otro"])).toBeNull()
  })
  it("avisa si hay adición (presbicia)", () => {
    const s = sugerirDiagnostico({ od: ojo("-1.75", "-0.75"), oi: ojo("-1.00"), medidas: { adicionOd: "+1.50", adicionOi: "+1.75" } }, catalogo)
    expect(s.presbicia).toBe(true)
    expect(s.presbiciaCategoria).toBe("Presbicia")
  })
  it("un ojo miope y el otro hipermétrope no se decide solo", () => {
    const s = sugerirDiagnostico({ od: ojo("-1.50"), oi: ojo("+1.50"), medidas: {} }, catalogo)
    expect(s.categorias).toEqual(["Miopía", "Hipermetropía"])
    expect(s.motivo).toMatch(/miopía y el otro con hipermetropía/)
  })
  it("sin refracción no hay sugerencia", () => {
    expect(sugerirDiagnostico({ od: {}, oi: {}, medidas: {} }, catalogo)).toBeNull()
  })
})

describe("el encabezado de la receta", () => {
  it("lleva el logo, la dirección y el teléfono de la óptica (de Configuración), no solo el nombre", () => {
    const d = datosOpticaReceta({ opticaNombre: "Óptica Solna", opticaLogoUrl: "https://x/logo.png", opticaMarca: { correo: "a@b.com" } }, { opticaDireccion: " Av. 9 de Octubre 123 ", opticaTelefono: "0991234567" })
    expect(d).toEqual({ nombre: "Óptica Solna", logoUrl: "https://x/logo.png", direccion: "Av. 9 de Octubre 123", telefono: "0991234567", correo: "a@b.com" })
    expect(datosOpticaReceta({ opticaNombre: "X" }, {})).toMatchObject({ direccion: "", telefono: "" })
  })
})
