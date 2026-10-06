import { describe, it, expect } from "vitest"
import {
  numeroOrden, estaAtrasada, estadoVisible, diasDeAtraso, ordenesListasSinAvisar, atrasosPorLaboratorio, laboratoriosUsados,
  datosInicialesOrden, datosParaRpc, validarOrden, mensajeLentesListos, armarHtmlOrdenLaboratorio, armarHtmlOrdenPaciente,
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

  it("cuenta los atrasos por laboratorio y sugiere los más usados", () => {
    const todas = [
      orden({ id: "a", fechaPrometida: "2026-10-01" }),
      orden({ id: "b", fechaPrometida: "2026-10-02" }),
      orden({ id: "c", fechaPrometida: "2026-10-02", laboratorio: "Lab Sur" }),
      orden({ id: "d", fechaPrometida: "2026-10-02", laboratorio: "" }),
      orden({ id: "e", estado: "lista", fechaPrometida: "2026-10-01" }),
    ]
    expect(atrasosPorLaboratorio(todas, hoy)).toEqual([
      { laboratorio: "Lab Norte", atrasadas: 2 }, { laboratorio: "Lab Sur", atrasadas: 1 }, { laboratorio: "Sin laboratorio", atrasadas: 1 },
    ])
    expect(laboratoriosUsados(todas)).toEqual(["Lab Norte", "Lab Sur"])
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

  it("el mensaje de WhatsApp usa el nombre, la óptica y el número", () => {
    const m = mensajeLentesListos({ paciente: { nombre: "Ana Pérez" }, opticaNombre: "Visión", orden: orden() })
    expect(m).toContain("Hola Ana")
    expect(m).toContain("Visión")
    expect(m).toContain("OL-0007")
  })

  it("la copia del laboratorio lleva la receta completa y no lleva precios", () => {
    const h = armarHtmlOrdenLaboratorio({ opticaNombre: "Visión", opticaDatos: { telefono: "0999" }, paciente: { nombre: "Ana" }, orden: orden() })
    expect(h).toContain("OL-0007")
    expect(h).toContain("-1.00")
    expect(h).toContain("+1.50")
    expect(h).toContain("Antirreflejo")
    expect(h).toContain("52-18-140")
    expect(h).toContain("Lab Norte")
    expect(h).toContain("62 mm")
    expect(h).toContain("18 mm")
    expect(h).not.toContain("$")
  })

  it("la copia del paciente no lleva la graduación salvo que se pida", () => {
    const sin = armarHtmlOrdenPaciente({ opticaNombre: "Visión", opticaDatos: { telefono: "0999" }, paciente: { nombre: "Ana" }, orden: orden() })
    expect(sin).toContain("OL-0007")
    expect(sin).toContain("Presenta este comprobante")
    expect(sin).not.toContain("-1.00")
    const con = armarHtmlOrdenPaciente({ opticaNombre: "Visión", paciente: { nombre: "Ana" }, orden: orden(), incluirGraduacion: true })
    expect(con).toContain("-1.00")
  })
})
