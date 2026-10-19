import { describe, it, expect } from "vitest"
import { transponer, validarOjo, validarAdicion, formatoDioptria } from "./refraccion"
import { estadoCorreccionDe, textoAgudeza, LISTA_AGUDEZA } from "./agudeza"
import { crearForm, recetaDesdeForm, datosClinicosDesdeForm, estadoDePasos, validarPasos, estadoCorreccionDeForm, anamnesisDeConsulta, componerTexto, medidasDeForm } from "./fichaDatos"

describe("transposición", () => {
  it("−1.50 +0.50 × 90 pasa a −1.00 −0.50 × 180 (la esfera cambia)", () => {
    expect(transponer({ esfera: "-1.50", cilindro: "+0.50", eje: "90" })).toEqual({ esfera: "-1.00", cilindro: "-0.50", eje: "180" })
  })
  it("el eje se mueve 90° dentro de 1–180", () => {
    expect(transponer({ esfera: "1.00", cilindro: "0.75", eje: "30" })).toMatchObject({ eje: "120", esfera: "+1.75", cilindro: "-0.75" })
    expect(transponer({ esfera: "0", cilindro: "0.25", eje: "180" })).toMatchObject({ eje: "90" })
  })
  it("sin los tres datos no transpone", () => {
    expect(transponer({ esfera: "-1", cilindro: "", eje: "90" })).toBeNull()
  })
  it("transponer dos veces devuelve el original", () => {
    const a = { esfera: "-1.50", cilindro: "+0.50", eje: "90" }
    expect(transponer(transponer(a))).toEqual({ esfera: "-1.50", cilindro: "+0.50", eje: "90" })
  })
})

describe("validaciones", () => {
  it("esfera −30..+30, pasos de 0.25", () => {
    expect(validarOjo({ esfera: "31" }).esfera).toBeTruthy()
    expect(validarOjo({ esfera: "-30.25" }).esfera).toBeTruthy()
    expect(validarOjo({ esfera: "-1.30" }).esfera).toMatch(/0.25/)
    expect(validarOjo({ esfera: "-1,25" }).esfera).toBeUndefined()
  })
  it("cilindro positivo es error y se puede transponer", () => {
    const v = validarOjo({ esfera: "-1", cilindro: "0.50", eje: "90" })
    expect(v.cilindro).toMatch(/negativo/)
    expect(v.transponible).toBe(true)
    expect(validarOjo({ esfera: "-1", cilindro: "-0.50", eje: "90" })).toEqual({})
  })
  it("eje de 1 a 180 y obligatorio con cilindro", () => {
    expect(validarOjo({ cilindro: "-1", eje: "0" }).eje).toBeTruthy()
    expect(validarOjo({ cilindro: "-1", eje: "181" }).eje).toBeTruthy()
    expect(validarOjo({ cilindro: "-1", eje: "" }).eje).toMatch(/eje/)
    expect(validarOjo({ cilindro: "-1", eje: "180" }).eje).toBeUndefined()
  })
  it("adición +0.50 a +4.00", () => {
    expect(validarAdicion("")).toBe("")
    expect(validarAdicion("0.25")).toBeTruthy()
    expect(validarAdicion("4.25")).toBeTruthy()
    expect(validarAdicion("1.30")).toBeTruthy()
    expect(validarAdicion("+1.50")).toBe("")
  })
  it("formatoDioptria", () => { expect(formatoDioptria(-1)).toBe("-1.00"); expect(formatoDioptria(0.5)).toBe("+0.50"); expect(formatoDioptria(0)).toBe("0.00") })
})

describe("agudeza y estado de corrección", () => {
  it("la lista trae las líneas y las cuatro anotaciones sin cartilla", () => {
    for (const v of ["20/20", "20/25", "20/30", "Cuenta dedos", "Movimiento de manos", "Percepción de luz", "No percibe luz"]) expect(LISTA_AGUDEZA).toContain(v)
  })
  it("«20/25 −2»", () => { expect(textoAgudeza("20/25", "2")).toBe("20/25 −2"); expect(textoAgudeza("20/25", "")).toBe("20/25"); expect(textoAgudeza("Cuenta dedos", "3")).toBe("Cuenta dedos") })
  it("con las tres agudezas se calcula con la de la receta nueva", () => {
    const od = { avSc: "20/100", avCc: "20/50", avRx: "20/20" }, oi = { avSc: "20/100", avCc: "20/50", avRx: "20/25" }
    expect(estadoCorreccionDe(od, oi)).toBe("Bien corregido")
    expect(estadoCorreccionDe({ ...od, avRx: "20/40" }, oi)).toBe("Requiere ajuste")
  })
  it("fichas anteriores (sin receta nueva) siguen con la agudeza con lentes", () => {
    expect(estadoCorreccionDe({ avCc: "20/20" }, { avCc: "20/25" })).toBe("Bien corregido")
    expect(estadoCorreccionDe({ avCc: "20/20" }, { avCc: "20/50" })).toBe("Requiere ajuste")
    expect(estadoCorreccionDe({ avCc: "20/20" }, {})).toBe("Sin evaluar")
  })
})

const formBase = () => ({ ...crearForm("2026-10-19"), motivo: "Consulta General", avOdSc: "20/50", avOiSc: "20/40", odEsfera: "-1.75", odCilindro: "-0.75", odEje: "10", oiEsfera: "-1.50", oiCilindro: "+0.50", oiEje: "90", diagnosticoCategorias: ["Miopía"], controlModo: "despues" })

describe("la receta sale de los valores finales", () => {
  it("tras transponer, vista previa, receta impresa y lo guardado muestran la misma refracción", () => {
    const f = formBase()
    expect(validarPasos(f).refraccion.oi_transponible).toBe(true)
    const t = transponer({ esfera: f.oiEsfera, cilindro: f.oiCilindro, eje: f.oiEje })
    Object.assign(f, { oiEsfera: t.esfera, oiCilindro: t.cilindro, oiEje: t.eje })
    const vistaPrevia = recetaDesdeForm(f)
    const impresa = recetaDesdeForm(f)
    const guardado = datosClinicosDesdeForm(f)
    expect(vistaPrevia.oi).toMatchObject({ esfera: "-1.00", cilindro: "-0.50", eje: "180" })
    expect(impresa.oi).toEqual(vistaPrevia.oi)
    expect(guardado.oi).toEqual(vistaPrevia.oi)
    expect(guardado.medidas).toEqual(vistaPrevia.medidas)
    expect(validarPasos(f).refraccion.oi_transponible).toBeUndefined()
  })
  it("un ojo no evaluado no lleva medidas ni agudezas", () => {
    const f = { ...formBase(), oiNoEval: true, oiMotivoNoEval: "prótesis", oiEsfera: "-3" }
    expect(recetaDesdeForm(f).oi.esfera).toBe("")
    expect(recetaDesdeForm(f).ojoNoEvaluado.oi).toBe("prótesis")
  })
  it("adición por ojo: «igual en ambos» copia, y distinta se respeta; la DP total se suma de las de cada ojo", () => {
    expect(medidasDeForm({ ...crearForm(), adicionIgual: true, adicionOd: "+1.50", adicionOi: "+2.00" })).toMatchObject({ adicionOd: "+1.50", adicionOi: "+1.50", adicion: "+1.50" })
    expect(medidasDeForm({ ...crearForm(), adicionIgual: false, adicionOd: "+1.50", adicionOi: "+2.00" })).toMatchObject({ adicionOi: "+2.00" })
    expect(medidasDeForm({ ...crearForm(), dpOd: "31", dpOi: "30.5" }).dp).toBe("61.5")
  })
  it("el estado de corrección del formulario usa la agudeza con la receta nueva", () => {
    const f = { ...formBase(), avOdCc: "20/50", avOiCc: "20/50", avOdRx: "20/20", avOiRx: "20/20" }
    expect(estadoCorreccionDeForm(f)).toBe("Bien corregido")
  })
})

describe("pasos", () => {
  it("estados: incompleto, completo, opcional y omitido", () => {
    const vacio = crearForm()
    expect(estadoDePasos(vacio, 1)).toMatchObject({ anamnesis: "Incompleto", agudeza: "Incompleto", refraccion: "Incompleto", salud: "Opcional", diagnostico: "Incompleto" })
    const f = { ...formBase(), oiCilindro: "-0.50", oiEje: "90" }
    expect(estadoDePasos(f, 3)).toMatchObject({ anamnesis: "Completo", agudeza: "Completo", refraccion: "Completo", salud: "Opcional", diagnostico: "Completo" })
    expect(estadoDePasos(f, 5).salud).toBe("Omitido")
    expect(estadoDePasos({ ...f, pioOd: "14" }, 5).salud).toBe("Completo")
  })
  it("obligatorios: motivo, agudeza sin corrección de cada ojo, los dos ojos", () => {
    const e = validarPasos(crearForm())
    expect(e.anamnesis.motivo).toBeTruthy()
    expect(e.agudeza.avOdSc).toBeTruthy()
    expect(e.agudeza.avOiSc).toBeTruthy()
    expect(e.refraccion.od_esfera).toBeTruthy()
  })
})

describe("antecedentes", () => {
  it("se precargan de la última consulta (texto o opciones) y se componen en el texto de siempre", () => {
    expect(anamnesisDeConsulta({ antecedentes: "Diabetes", alergias: "Penicilina", antecedentesFamiliares: "", usaLentes: true })).toMatchObject({ antMedDetalle: "Diabetes", alergiasDetalle: "Penicilina", usaLentes: "si" })
    const prev = { ficha: { anamnesis: { antMedicos: { chips: ["Diabetes"], detalle: "tipo 2" }, medicamentos: { chips: ["Ninguno"], detalle: "" } } } }
    expect(anamnesisDeConsulta(prev)).toMatchObject({ antMedChips: ["Diabetes"], antMedDetalle: "tipo 2", medChips: ["Ninguno"] })
    expect(componerTexto(["Diabetes", "Hipertensión"], "tipo 2")).toBe("Diabetes, Hipertensión, tipo 2")
    expect(anamnesisDeConsulta(null)).toBeNull()
  })
})

describe("escritura de las dioptrías en la receta", () => {
  it("«1.5» sale «+1.50» y «-1,25» sale «-1.25», en la vista previa y en lo guardado", () => {
    const f = { ...crearForm("2026-10-19"), odEsfera: "1.5", odCilindro: "-0,5", odEje: "90", oiEsfera: "0", adicionOd: "1.5" }
    const r = recetaDesdeForm(f)
    expect(r.od).toMatchObject({ esfera: "+1.50", cilindro: "-0.50", eje: "90" })
    expect(r.oi.esfera).toBe("0.00")
    expect(r.medidas.adicionOd).toBe("+1.50")
    expect(datosClinicosDesdeForm(f).od).toEqual(r.od)
  })
})
