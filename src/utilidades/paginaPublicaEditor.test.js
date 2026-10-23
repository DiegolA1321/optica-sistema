import { describe, it, expect } from "vitest"
import {
  formularioDesdeMarca, construirMarca, avisoDeContraste, errorDeAno, errorDeArchivo, mover, formularioTrasGuardar, hayCambios,
} from "./paginaPublicaEditor"
import { SERVICIOS_EJEMPLO, TEXTO_INICIO_POR_DEFECTO } from "./marcaOptica"

const HOY = new Date(2026, 9, 23)

describe("formulario desde la marca", () => {
  it("una óptica recién creada (solo nombre, eslogan y color) recibe los textos de ejemplo ya puestos", () => {
    const f = formularioDesdeMarca({ nombreMarca: "Visión Norte", eslogan: "Ve el mundo con claridad.", colorAcento: "#2563eb" }, "Visión Norte")
    expect(f.mensaje).toBe(TEXTO_INICIO_POR_DEFECTO)
    expect(f.servicios).toHaveLength(SERVICIOS_EJEMPLO.length)
    expect(f.preguntas.length).toBeGreaterThan(0)
    expect(f.colorAcento).toBe("#2563EB")
    expect(f.mostrarAnos && f.mostrarPacientes && f.mostrarOptometras).toBe(true)
  })
  it("el mensaje antiguo por defecto no se muestra como si fuera de la óptica", () => {
    const antiguo = "En Mi Óptica cuidamos tu salud visual de principio a fin: examen de precisión, lentes a tu medida y un acompañamiento cercano después de tu compra."
    expect(formularioDesdeMarca({ mensaje: antiguo }, "Mi Óptica").mensaje).toBe(TEXTO_INICIO_POR_DEFECTO)
  })
})

describe("guardar con merge", () => {
  const form = () => formularioDesdeMarca({}, "X")
  it("conserva las claves viejas que el editor no toca", () => {
    const vieja = { servicios: [{ titulo: "a" }], logoUrlClaro: "https://x/c.png", colorSecundario: "#111111", serviciosActivos: false, quienesSomos: { otra: 1 } }
    const { marca } = construirMarca(form(), vieja)
    expect(marca.servicios).toEqual(vieja.servicios)
    expect(marca.logoUrlClaro).toBe("https://x/c.png")
    expect(marca.colorSecundario).toBe("#111111")
    expect(marca.serviciosActivos).toBe(false)
    expect(marca.quienesSomos.otra).toBe(1)
  })
  it("guarda el color ya ajustado y lo avisa", () => {
    const f = { ...form(), colorAcento: "#FDE047" }
    const r = construirMarca(f, {})
    expect(r.colorAjustado).toBe(true)
    expect(r.marca.colorAcento).not.toBe("#FDE047")
  })
  it("descarta los servicios y preguntas vacíos y cuenta los escritos a medias", () => {
    const f = { ...form(), servicios: [{ id: "a", titulo: "Ok", texto: "t", motivo: "" }, { id: "b", titulo: "", texto: "", motivo: "" }, { id: "c", titulo: "Solo título", texto: "", motivo: "" }], preguntas: [{ id: "p", p: "¿?", r: "" }] }
    const r = construirMarca(f, {})
    expect(r.marca.serviciosPagina.map((s) => s.id)).toEqual(["a"])
    expect(r.serviciosAMedias).toHaveLength(1)
    expect(r.preguntasAMedias).toHaveLength(1)
    expect(r.marca.preguntas).toEqual([])
  })
  it("año vacío borra la clave; con año la guarda como entero", () => {
    expect(construirMarca({ ...form(), anoFundacion: "" }, { quienesSomos: { anoFundacion: 2000 } }).marca.quienesSomos.anoFundacion).toBeUndefined()
    expect(construirMarca({ ...form(), anoFundacion: "2015" }, {}).marca.quienesSomos.anoFundacion).toBe(2015)
  })
  it("tras guardar no hay cambios pendientes", () => {
    const f = { ...form(), servicios: [{ id: "a", titulo: " Ok ", texto: "t", motivo: "" }] }
    const { marca } = construirMarca(f, {})
    const t = formularioTrasGuardar(f, marca)
    expect(hayCambios(t, formularioTrasGuardar(t, construirMarca(t, marca).marca))).toBe(false)
  })
})

describe("validaciones", () => {
  it("año entre 1900 y el actual", () => {
    expect(errorDeAno("", HOY)).toBe("")
    expect(errorDeAno("2015", HOY)).toBe("")
    expect(errorDeAno("1899", HOY)).toMatch(/1900/)
    expect(errorDeAno("2027", HOY)).toMatch(/2026/)
    expect(errorDeAno("20", HOY)).toMatch(/cuatro cifras/)
  })
  it("logo: tipo y peso", () => {
    expect(errorDeArchivo({ type: "image/svg+xml", size: 100 })).toBe("")
    expect(errorDeArchivo({ type: "image/gif", size: 100 })).toMatch(/PNG, JPG, WEBP o SVG/)
    expect(errorDeArchivo({ type: "image/png", size: 3 * 1024 * 1024 })).toMatch(/2 MB/)
  })
  it("contraste: avisa con el color ajustado", () => {
    expect(avisoDeContraste("#2563EB")).toBeNull()
    const a = avisoDeContraste("#FDE047")
    expect(a.texto).toContain(a.ajustado)
    expect(a.texto).toMatch(/muy claro/)
  })
  it("mover sube y baja sin salirse", () => {
    expect(mover([1, 2, 3], 1, -1)).toEqual([2, 1, 3])
    expect(mover([1, 2, 3], 2, 1)).toEqual([1, 2, 3])
  })
})
