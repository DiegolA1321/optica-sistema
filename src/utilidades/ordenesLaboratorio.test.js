import { describe, it, expect } from "vitest"
import {
  numeroOrden, estaAtrasada, estadoVisible, diasDeAtraso, ordenesListasSinAvisar,
  datosInicialesOrden, datosParaRpc, validarOrden, armarHtmlOrdenLaboratorio, armarHtmlOrdenPaciente, observacionesParaLaboratorio,
} from "./ordenesLaboratorio"

const hoy = new Date(2026, 9, 6, 10)
const orden = (extra = {}) => ({
  id: "1", numero: 7, estado: "enviada", fechaPrometida: "2026-10-10", laboratorio: "Lab Norte", tipoLente: "progresivo", material: "Policarbonato",
  recetaOd: { esfera: "-1.00", cilindro: "-0.50", eje: "90", adicion: "+1.50" }, recetaOi: { esfera: "-1.25", cilindro: "", eje: "", adicion: "+1.50" },
  dpLejos: "62", dpCerca: "", alturaMontaje: "18", antirreflejo: true, filtroAzul: false, fotocromatico: false, otrosTratamientos: "",
  montura: "Ray-Ban RB123", monturaMedidas: "52-18-140", observaciones: "", creadaEn: "2026-10-01T12:00:00Z", ...extra,
})

describe("ordenesLaboratorio", () => {
  it("el número se muestra con ceros", () => expect(numeroOrden(7)).toBe("OL-0007"))

  it("atrasada = enviada con fecha prometida ya pasada", () => {
    expect(estaAtrasada(orden({ fechaPrometida: "2026-10-05" }), hoy)).toBe(true)
    expect(estaAtrasada(orden({ fechaPrometida: "2026-10-06" }), hoy)).toBe(false)
    expect(estaAtrasada(orden({ fechaPrometida: "2026-10-05", estado: "lista" }), hoy)).toBe(false)
    expect(estadoVisible(orden({ fechaPrometida: "2026-10-01" }), hoy)).toBe("atrasada")
    expect(diasDeAtraso(orden({ fechaPrometida: "2026-10-01" }), hoy)).toBe(5)
  })

  it("las listas sin avisar son las que piden aviso al paciente", () => {
    const l = [orden({ estado: "lista" }), orden({ id: "2", estado: "lista", pacienteAvisadoEn: "2026-10-06T10:00:00Z" }), orden({ id: "3" })]
    expect(ordenesListasSinAvisar(l).map((o) => o.id)).toEqual(["1"])
  })

  it("toma de la consulta lo que existe y deja el resto para la vendedora", () => {
    const d = datosInicialesOrden({ od: { esfera: "-2.00", cilindro: "-0.75", eje: "180" }, oi: { esfera: "-1.50" }, medidas: { adicion: "+2.00", dp: "63", alt: "20" }, lenteRecomendado: "Progresivo digital" }, { montura: "Montura X" })
    expect(d.recetaOd).toEqual({ esfera: "-2.00", cilindro: "-0.75", eje: "180", adicion: "+2.00" })
    expect(d.recetaOi.esfera).toBe("-1.50")
    expect(d.dpLejos).toBe("63")
    expect(d.dpCerca).toBe("")
    expect(d.alturaMontaje).toBe("20")
    expect(d.tipoLente).toBe("progresivo")
    expect(d.montura).toBe("Montura X")
    expect(d.fechaPrometida).toBe("")
  })

  it("exige tipo de lente y fecha prometida", () => {
    expect(validarOrden({ tipoLente: "monofocal", fechaPrometida: "" })).toMatch(/fecha/i)
    expect(validarOrden({ tipoLente: "monofocal", fechaPrometida: "2026-10-20" })).toBe("")
    expect(datosParaRpc(datosInicialesOrden(null)).tipo_lente).toBe("monofocal")
  })

  it("la copia del laboratorio lleva la receta completa y no lleva precios", () => {
    const h = armarHtmlOrdenLaboratorio({ opticaNombre: "Visión", opticaDatos: { telefono: "0999" }, paciente: { nombre: "Ana" }, orden: orden() })
    expect(h).toContain("OL-0007")
    expect(h).toContain("−1.00")
    expect(h).toContain("+1.50")
    expect(h).toContain("Antirreflejo")
    expect(h).toContain("52-18-140")
    expect(h).not.toContain("Lab Norte")
    expect(h).toContain("62 mm")
    expect(h).toContain("18 mm")
    expect(h).not.toContain("$")
  })

  it("la copia del paciente no lleva la graduación salvo que se pida", () => {
    const sin = armarHtmlOrdenPaciente({ opticaNombre: "Visión", opticaDatos: { telefono: "0999" }, paciente: { nombre: "Ana" }, orden: orden() })
    expect(sin).toContain("OL-0007")
    expect(sin).toContain("Presenta este comprobante")
    expect(sin).not.toContain("−1.00")
    const con = armarHtmlOrdenPaciente({ opticaNombre: "Visión", paciente: { nombre: "Ana" }, orden: orden(), incluirGraduacion: true })
    expect(con).toContain("−1.00")
  })
})

describe("medidas de la montura (Inventario v2)", () => {
  it("la orden trae escritas las medidas de la montura vendida (calibre-puente-varilla)", () => {
    expect(datosInicialesOrden(null, { montura: "Montura 1", monturaMedidas: "52-18-140" })).toMatchObject({ montura: "Montura 1", monturaMedidas: "52-18-140" })
  })
  it("sin medidas en el inventario queda vacío y se escribe a mano, como siempre", () => {
    expect(datosInicialesOrden(null, { montura: "Montura 1" }).monturaMedidas).toBe("")
  })
})

describe("luna de la venta (Bloque E)", () => {
  it("la luna de la venta precarga tipo, material y tratamientos de la orden", () => {
    const d = datosInicialesOrden({ lenteRecomendado: "Progresivo" }, { montura: "M1", luna: { tipoLente: "bifocal", material: "CR-39", filtroAzul: true, otrosTratamientos: undefined } })
    expect(d).toMatchObject({ tipoLente: "bifocal", material: "CR-39", filtroAzul: true, montura: "M1", otrosTratamientos: "" })
  })
  it("reconoce la línea de luna y las lunas viejas escritas como servicio", async () => {
    const { esLineaDeLente } = await import("./ordenesLaboratorio")
    expect(esLineaDeLente({ tipo: "luna", descripcion: "x" })).toBe(true)
    expect(esLineaDeLente({ tipo: "servicio", descripcion: "Luna: monofocal" })).toBe(true)
    expect(esLineaDeLente({ tipo: "servicio", descripcion: "Consulta" })).toBe(false)
    expect(esLineaDeLente({ tipo: "producto", descripcion: "Luna" })).toBe(false)
  })
})

describe("número del comprobante en las dos copias (R36)", () => {
  it("aparece en la copia del laboratorio y en la del paciente solo si existe", () => {
    const con = orden({ facturaNumero: "CV-0007" })
    expect(armarHtmlOrdenLaboratorio({ opticaNombre: "V", paciente: { nombre: "Ana" }, orden: con })).toContain("Comprobante de venta:</b> CV-0007")
    expect(armarHtmlOrdenPaciente({ opticaNombre: "V", paciente: { nombre: "Ana" }, orden: con })).toContain("CV-0007")
    expect(armarHtmlOrdenLaboratorio({ opticaNombre: "V", paciente: { nombre: "Ana" }, orden: orden() })).not.toContain("Comprobante de venta")
  })

  it("la orden nueva no copia el lente recomendado de la consulta a las observaciones", () => {
    expect(datosInicialesOrden({ lenteRecomendado: "Progresivo CR-39" }).observaciones).toBe("")
  })

  it("la copia del laboratorio imprime los datos de la orden, no la nota vieja copiada de la consulta", () => {
    const o = orden({ tipoLente: "monofocal", material: "CR-39", observaciones: "Lente recomendado: Monofocal Policarbonato" })
    const h = armarHtmlOrdenLaboratorio({ opticaNombre: "V", paciente: { nombre: "Ana" }, orden: o })
    expect(h).toContain("Material:</b> CR-39")
    expect(h).not.toContain("Policarbonato")
    expect(h).not.toContain("Observaciones")
  })

  it("una observación escrita por una persona sí se imprime", () => {
    expect(observacionesParaLaboratorio({ observaciones: "Biselar con cuidado" })).toBe("Biselar con cuidado")
    expect(armarHtmlOrdenLaboratorio({ opticaNombre: "V", paciente: {}, orden: orden({ observaciones: "Biselar con cuidado" }) })).toContain("Biselar con cuidado")
  })
})

import { estadoLentesDeCompra } from "./ordenesLaboratorio"
describe("estado de los lentes de una compra", () => {
  const o = (estado, facturaId = "f1") => ({ facturaId, estado })
  it("sin orden no hay lentes", () => { expect(estadoLentesDeCompra("f1", [o("enviada", "f2")])).toBeNull() })
  it("enviada es «En proceso»; lista, «Listo»; entregada, «Entregado»", () => {
    expect(estadoLentesDeCompra("f1", [o("enviada")]).etiqueta).toBe("En proceso")
    expect(estadoLentesDeCompra("f1", [o("lista")]).etiqueta).toBe("Listo")
    expect(estadoLentesDeCompra("f1", [o("entregada")]).etiqueta).toBe("Entregado")
  })
  it("con varias órdenes manda la que falta, y las canceladas no cuentan", () => {
    expect(estadoLentesDeCompra("f1", [o("entregada"), o("lista")]).id).toBe("listos")
    expect(estadoLentesDeCompra("f1", [o("lista"), o("enviada")]).id).toBe("proceso")
    expect(estadoLentesDeCompra("f1", [o("cancelada")])).toBeNull()
    expect(estadoLentesDeCompra("f1", [o("cancelada"), o("entregada")]).id).toBe("entregados")
  })
})

describe("logo de la óptica en las órdenes impresas", () => {
  const ordenBase = { numero: 3, creadaEn: "2026-10-20T10:00:00Z", fechaPrometida: "2026-10-30", tipoLente: "monofocal", recetaOd: {}, recetaOi: {} }
  const url = "https://x.supabase.co/storage/v1/object/public/logos/o1/logo.png"
  it("las dos copias llevan el logo entero (object-fit: contain) arriba del nombre", () => {
    for (const armar of [armarHtmlOrdenLaboratorio, armarHtmlOrdenPaciente]) {
      const h = armar({ opticaNombre: "Visión", opticaDatos: { logoUrl: url }, paciente: { nombre: "Ana" }, orden: ordenBase })
      expect(h).toContain(`src="${url}"`)
      expect(h).toContain("object-fit:contain")
      expect(h.indexOf("<img")).toBeLessThan(h.indexOf("<h1>"))
    }
  })
  it("sin logo no sale ninguna imagen", () => {
    expect(armarHtmlOrdenLaboratorio({ opticaNombre: "Visión", paciente: { nombre: "Ana" }, orden: ordenBase })).not.toContain("<img")
    expect(armarHtmlOrdenPaciente({ opticaNombre: "Visión", paciente: { nombre: "Ana" }, orden: ordenBase })).not.toContain("<img")
  })
})
