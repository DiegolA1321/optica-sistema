// Los datos de la ficha clínica de tres pasos (Anamnesis, Examen y Diagnóstico y receta): el formulario, cómo se arma la receta y lo que se guarda, el estado de cada paso y las validaciones. Todo en funciones puras: la pantalla solo dibuja.
// La receta que se ve en la vista previa, la que se imprime y los valores que se guardan salen TODOS de `recetaDesdeForm` y `datosClinicosDesdeForm`, nunca de copias aparte (regla 2).
import { aNumero, validarOjo, validarAdicion, textoOjoCompleto, formatoDioptria, dioptriaTexto } from "./refraccion"
import { estadoCorreccionDe, textoAgudeza } from "./agudeza"

export const PASOS = [
  { id: "anamnesis", n: 1, label: "Anamnesis" },
  { id: "examen", n: 2, label: "Examen" },
  { id: "diagnostico", n: 3, label: "Diagnóstico y receta" },
]

export const SINTOMAS = ["Borrosidad de lejos", "Borrosidad de cerca", "Dolor de cabeza", "Fatiga visual", "Ardor", "Lagrimeo", "Picazón", "Destellos", "Moscas volantes", "Visión doble"]
export const ANT_MEDICOS = ["Diabetes", "Hipertensión", "Tiroides", "Cirugía ocular", "Glaucoma", "Cataratas", "Uso de pantallas prolongado"]
export const ANT_FAMILIARES = ["Glaucoma", "Diabetes", "Miopía alta", "Estrabismo", "Queratocono", "Catarata", "Degeneración macular", "Ceguera"]
export const NINGUNO = { med: "Ninguno", fam: "Ninguno", alergias: "Ninguna conocida", medicamentos: "Ninguno" }
export const ALERGIAS_FRECUENTES = ["Penicilina", "Sulfas", "Polen", "Látex", "Anestésicos", "Gotas oculares"]
export const MEDICAMENTOS_FRECUENTES = ["Antihipertensivos", "Antidiabéticos", "Anticonceptivos", "Antihistamínicos", "Corticoides"]
export const TIPOS_LENTES = [["lentes", "Lentes (gafas)"], ["contacto", "Lentes de contacto"], ["ambos", "Ambos"]]
export const METODOS_OBJETIVA = [["retinoscopia", "Retinoscopía"], ["autorrefractometro", "Autorrefractómetro"]]
export const TIPOS_COVER = ["Ortoforia", "Endoforia", "Exoforia", "Hiperforia", "Endotropia", "Exotropia", "Hipertropia"]
export const DISTANCIAS_COVER = [["lejos", "Lejos"], ["cerca", "Cerca"], ["ambas", "Lejos y cerca"]]
export const BASES_PRISMA = ["Superior", "Inferior", "Nasal", "Temporal"]
export const METODOS_PIO = ["Tonómetro de aire (no contacto)", "Aplanación de Goldmann", "Tonómetro de rebote", "Otro"]
export const PRUEBAS_COLOR = ["Ishihara", "Farnsworth D-15", "Otra"]
export const INTERPRETACIONES_COLOR = ["Normal", "Alterado"]
export const SIN_HALLAZGOS = "Sin hallazgos"

// El formulario completo, vacío. Un campo vacío significa «no medido», nunca «normal».
export const crearForm = (hoy = "") => ({
  fechaConsulta: hoy, motivo: "", detalleConsulta: "",
  sintomas: [], sintomasOtros: "", antMedChips: [], antMedDetalle: "", antFamChips: [], antFamDetalle: "",
  alergiasChips: [], alergiasDetalle: "", medChips: [], medDetalle: "", usaLentes: "", usaLentesDesde: "", tipoLentes: "",
  // Paso 2
  avOdSc: "", avOdScF: "", avOdCc: "", avOdCcF: "", avOdRx: "", avOdRxF: "",
  avOiSc: "", avOiScF: "", avOiCc: "", avOiCcF: "", avOiRx: "", avOiRxF: "",
  avAmbSc: "", avAmbScF: "", avAmbCc: "", avAmbCcF: "", avAmbRx: "", avAmbRxF: "",
  cercaSc: "", cercaCc: "", cercaRx: "",
  actOdEsfera: "", actOdCilindro: "", actOdEje: "", actOiEsfera: "", actOiCilindro: "", actOiEje: "", actAdicion: "",
  dp: "", dpOd: "", dpOi: "", dpCerca: "", coverTipo: "", coverMagnitud: "", coverDistancia: "", testMotor: "",
  // Paso 3
  objMetodo: "", objOdEsfera: "", objOdCilindro: "", objOdEje: "", objOiEsfera: "", objOiCilindro: "", objOiEje: "",
  kOdK1: "", kOdK2: "", kOdEje: "", kOiK1: "", kOiK2: "", kOiEje: "",
  odEsfera: "", odCilindro: "", odEje: "", oiEsfera: "", oiCilindro: "", oiEje: "",
  odNoEval: false, odMotivoNoEval: "", oiNoEval: false, oiMotivoNoEval: "",
  adicionIgual: true, adicionOd: "", adicionOi: "",
  prismaOdCant: "", prismaOdBase: "", prismaOiCant: "", prismaOiBase: "",
  // Paso 4
  bioOdParpados: "", bioOdCornea: "", bioOdCamara: "", bioOiParpados: "", bioOiCornea: "", bioOiCamara: "", fondoOd: "", fondoOi: "",
  pioOd: "", pioOi: "", pioHora: "", pioMetodo: "", colorPrueba: "", colorResultado: "", colorInterpretacion: "",
  // Paso 5
  diagnosticoCategorias: [], diagnostico: "", recomendarLente: false, lenteRecomendado: "", indicaciones: "",
  proximoControlDias: 180, controlModo: "", controlFecha: "", controlHora: "", tratamientoFinalizado: false,
})

const t = (v) => String(v ?? "").trim()
// Una dioptría escrita como «1.5» o «-1,25» sale en la receta como «+1.50» y «-1.25»; lo que no es un número se deja tal cual (la validación lo señala).
const dioptria = (v) => { const n = aNumero(v); return n === null ? t(v) : formatoDioptria(n) }
const unir = (partes, sep = ", ") => partes.map(t).filter(Boolean).join(sep)
// Chips + detalle → el texto que se guarda en la columna de siempre (antecedentes, alergias, antecedentes familiares).
export const componerTexto = (chips, detalle) => unir([...(chips || []), detalle])

// ── La receta ──
// El ojo tal como va en la receta y se guarda: refracción FINAL (la que el optómetra confirmó, ya transpuesta si se transpuso) y las tres agudezas. Un ojo «no evaluado» no lleva medidas.
export function ojoDeForm(f, lado) {
  const p = lado === "od" ? "od" : "oi"
  const P = lado === "od" ? "Od" : "Oi"
  if (f[`${p}NoEval`]) return { esfera: "", cilindro: "", eje: "", avSc: "", avScF: "", avCc: "", avCcF: "", avRx: "", avRxF: "" }
  return {
    esfera: dioptria(f[`${p}Esfera`]), cilindro: dioptria(f[`${p}Cilindro`]), eje: t(f[`${p}Eje`]),
    avSc: f[`av${P}Sc`] || "", avScF: t(f[`av${P}ScF`]), avCc: f[`av${P}Cc`] || "", avCcF: t(f[`av${P}CcF`]), avRx: f[`av${P}Rx`] || "", avRxF: t(f[`av${P}RxF`]),
  }
}

export function medidasDeForm(f) {
  const adOd = dioptria(f.adicionOd)
  const adOi = f.adicionIgual ? adOd : dioptria(f.adicionOi)
  const dpOd = t(f.dpOd), dpOi = t(f.dpOi)
  const suma = aNumero(dpOd) !== null && aNumero(dpOi) !== null ? String(aNumero(dpOd) + aNumero(dpOi)) : ""
  return {
    adicion: adOd, adicionOd: adOd, adicionOi: adOi,
    dp: t(f.dp) || suma, dpOd, dpOi, dpCerca: t(f.dpCerca),
    avCerca: f.cercaCc || f.cercaSc || "", avCercaSc: f.cercaSc || "", avCercaCc: f.cercaCc || "", avCercaRx: f.cercaRx || "",
    prismaOdCant: t(f.prismaOdCant), prismaOdBase: f.prismaOdBase || "", prismaOiCant: t(f.prismaOiCant), prismaOiBase: f.prismaOiBase || "",
  }
}

export const ojoNoEvaluadoDeForm = (f) => ({ od: f.odNoEval ? t(f.odMotivoNoEval) : "", oi: f.oiNoEval ? t(f.oiMotivoNoEval) : "" })

// La «consulta» tal como la leen la hoja de la receta y el resto del sistema.
export function recetaDesdeForm(f, extra = {}) {
  return {
    fecha: f.fechaConsulta, od: ojoDeForm(f, "od"), oi: ojoDeForm(f, "oi"), ojoNoEvaluado: ojoNoEvaluadoDeForm(f), medidas: medidasDeForm(f),
    diagnosticoCategorias: f.diagnosticoCategorias, diagnostico: f.diagnostico, lenteRecomendado: f.recomendarLente ? f.lenteRecomendado : "", indicaciones: f.indicaciones,
    ...extra,
  }
}

// La consulta tal como la lee el documento del diagnóstico (HojaReceta con `completo`): la receta más el motivo, el examen y la ficha. Sirve para la vista previa antes de guardar.
export function consultaDesdeForm(f, extra = {}) {
  const d = datosClinicosDesdeForm(f)
  return { ...recetaDesdeForm(f, extra), motivo: f.motivo, detalleConsulta: f.detalleConsulta, retinoscopia: d.retinoscopia, examen: d.examen, ficha: d.ficha }
}

const ojoRetino = (e, c, x) => unir([e, c, x ? `x${x}` : ""], " ")
const porOjo = (od, oi) => (t(od) || t(oi) ? `OD: ${t(od) || "—"} · OI: ${t(oi) || "—"}` : "")

// Lo que se guarda en consultas.datos_clinicos (menos el control, que lo agrega quien guarda). Los campos de siempre (retinoscopia, od, oi, medidas, examen) se siguen llenando para que el perfil,
// los reportes y las fichas anteriores sigan funcionando; lo nuevo va en `ficha` (solo el personal: el portal solo recibe la receta).
export function datosClinicosDesdeForm(f) {
  const od = ojoDeForm(f, "od")
  const oi = ojoDeForm(f, "oi")
  const coverLejos = f.coverTipo && f.coverDistancia !== "cerca" ? f.coverTipo : ""
  const coverCerca = f.coverTipo && f.coverDistancia !== "lejos" ? f.coverTipo : ""
  const bio = (lado) => ({ parpados: t(f[`bio${lado}Parpados`]), cornea: t(f[`bio${lado}Cornea`]), camara: t(f[`bio${lado}Camara`]) })
  return {
    retinoscopia: { od: ojoRetino(f.objOdEsfera, f.objOdCilindro, f.objOdEje), oi: ojoRetino(f.objOiEsfera, f.objOiCilindro, f.objOiEje) },
    od, oi,
    medidas: medidasDeForm(f),
    examen: {
      testMotor: t(f.testMotor), coverTestLejos: coverLejos, coverTestCerca: coverCerca,
      oftalmoscopia: porOjo(f.fondoOd, f.fondoOi), testColor: f.colorInterpretacion === "Alterado" ? unir(["Alterado", f.colorResultado && `(${t(f.colorResultado)})`], " ") : f.colorInterpretacion === "Normal" ? "Normal" : "", pioOd: t(f.pioOd), pioOi: t(f.pioOi),
      biomicroscopia: {
        parpados: porOjo(bio("Od").parpados, bio("Oi").parpados), cornea: porOjo(bio("Od").cornea, bio("Oi").cornea), camara: porOjo(bio("Od").camara, bio("Oi").camara),
      },
    },
    ficha: {
      v: 2,
      anamnesis: {
        sintomas: f.sintomas, sintomasOtros: t(f.sintomasOtros),
        antMedicos: { chips: f.antMedChips, detalle: t(f.antMedDetalle) }, antFamiliares: { chips: f.antFamChips, detalle: t(f.antFamDetalle) },
        alergias: { chips: f.alergiasChips, detalle: t(f.alergiasDetalle) }, medicamentos: { chips: f.medChips, detalle: t(f.medDetalle) },
        usaLentes: f.usaLentes, usaLentesDesde: t(f.usaLentesDesde), tipoLentes: f.tipoLentes,
      },
      agudeza: {
        ambos: { sc: f.avAmbSc, scF: t(f.avAmbScF), cc: f.avAmbCc, ccF: t(f.avAmbCcF), rx: f.avAmbRx, rxF: t(f.avAmbRxF) },
      },
      lentesActuales: {
        od: { esfera: t(f.actOdEsfera), cilindro: t(f.actOdCilindro), eje: t(f.actOdEje) }, oi: { esfera: t(f.actOiEsfera), cilindro: t(f.actOiCilindro), eje: t(f.actOiEje) }, adicion: t(f.actAdicion),
      },
      coverTest: { tipo: f.coverTipo, magnitud: t(f.coverMagnitud), distancia: f.coverDistancia },
      objetiva: {
        metodo: f.objMetodo,
        od: { esfera: t(f.objOdEsfera), cilindro: t(f.objOdCilindro), eje: t(f.objOdEje) }, oi: { esfera: t(f.objOiEsfera), cilindro: t(f.objOiCilindro), eje: t(f.objOiEje) },
      },
      queratometria: { od: { k1: t(f.kOdK1), k2: t(f.kOdK2), eje: t(f.kOdEje) }, oi: { k1: t(f.kOiK1), k2: t(f.kOiK2), eje: t(f.kOiEje) } },
      salud: {
        biomicroscopia: { od: bio("Od"), oi: bio("Oi") }, fondo: { od: t(f.fondoOd), oi: t(f.fondoOi) },
        pio: { od: t(f.pioOd), oi: t(f.pioOi), hora: t(f.pioHora), metodo: f.pioMetodo }, color: { prueba: f.colorPrueba, resultado: t(f.colorResultado), interpretacion: f.colorInterpretacion },
      },
    },
  }
}

// Las columnas de texto de siempre.
export const columnasDeAnamnesis = (f) => ({
  antecedentes: componerTexto(f.antMedChips, f.antMedDetalle),
  alergias: componerTexto(f.alergiasChips, f.alergiasDetalle),
  antecedentesFamiliares: componerTexto(f.antFamChips, f.antFamDetalle),
  usaLentes: f.usaLentes === "si",
})

// El estado de corrección que se guarda con la ficha y en el paciente.
export const estadoCorreccionDeForm = (f) => estadoCorreccionDe(ojoDeForm(f, "od"), ojoDeForm(f, "oi"))

// Los antecedentes que el paciente ya tenía (de su última consulta), para precargarlos: solo se actualiza lo que cambió. Una ficha de cinco pasos devuelve sus opciones; una anterior, su texto.
// Medicamentos frecuentes por su grupo: «Losartán» marca «Antihipertensivos». El nombre se conserva en el detalle.
const GRUPOS_MEDICAMENTOS = {
  Antihipertensivos: /losart|enalapril|captopril|amlodipin|valsart|telmisart|hidroclorotiazid|atenolol|metoprolol|propranolol|carvedilol|nifedipin/,
  Antidiabéticos: /metformin|insulin|glibenclamid|glimepirid|sitagliptin|empagliflozin|dapagliflozin|linagliptin/,
  Antihistamínicos: /loratadin|cetirizin|desloratadin|clorfenamin|fexofenadin|difenhidramin/,
  Corticoides: /prednison|prednisolon|dexametason|betametason|hidrocortison|deflazacort/,
  Anticonceptivos: /anticonceptiv|levonorgestrel|etinilestradiol|drospirenon/,
}
const sinTildes = (x) => String(x ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()

// Un texto guardado («Diabetes, Hipertensión, tipo 2») se reparte en opciones (las que coinciden con una de las listas, sin importar mayúsculas ni tildes) y detalle (lo demás).
// Con `grupos`, un medicamento por nombre marca su grupo y además se queda en el detalle.
export function partirTexto(texto, opciones = [], grupos = null) {
  const chips = []
  const resto = []
  for (const trozo of String(texto ?? "").split(/[,;\n]/).map((x) => x.trim()).filter(Boolean)) {
    const igual = opciones.find((o) => sinTildes(o) === sinTildes(trozo))
    if (igual) { if (!chips.includes(igual)) chips.push(igual); continue }
    const grupo = grupos && Object.keys(grupos).find((g) => opciones.includes(g) && grupos[g].test(sinTildes(trozo)))
    if (grupo && !chips.includes(grupo)) chips.push(grupo)
    resto.push(trozo)
  }
  return { chips, detalle: resto.join(", ") }
}

// Los antecedentes que el paciente ya tenía (de su última consulta), para precargarlos: solo se actualiza lo que cambió. Una ficha de cinco pasos devuelve sus opciones; una anterior, su texto.
// En los dos casos, lo escrito que coincide con una opción la marca (hoy «Penicilina» queda marcada, no escrita en «Otra alergia»).
export function anamnesisDeConsulta(prev) {
  if (!prev) return null
  const a = prev.ficha?.anamnesis
  const completar = (chips, detalle, opciones, grupos) => {
    const p = partirTexto(detalle, opciones, grupos)
    return { chips: [...new Set([...(chips || []), ...p.chips])], detalle: p.detalle }
  }
  const med = completar(a?.antMedicos?.chips, a ? a.antMedicos?.detalle : prev.antecedentes, ANT_MEDICOS)
  const fam = completar(a?.antFamiliares?.chips, a ? a.antFamiliares?.detalle : prev.antecedentesFamiliares, ANT_FAMILIARES)
  const alerg = completar(a?.alergias?.chips, a ? a.alergias?.detalle : prev.alergias, ALERGIAS_FRECUENTES)
  const meds = completar(a?.medicamentos?.chips, a?.medicamentos?.detalle, MEDICAMENTOS_FRECUENTES, GRUPOS_MEDICAMENTOS)
  // «Ninguno» / «Ninguna conocida» escritos como texto también marcan su opción.
  const ninguno = (r, palabra) => (!r.chips.length && sinTildes(r.detalle) === sinTildes(palabra) ? { chips: [palabra], detalle: "" } : r)
  const m = ninguno(med, NINGUNO.med), f = ninguno(fam, NINGUNO.fam), al = ninguno(alerg, NINGUNO.alergias), md = ninguno(meds, NINGUNO.medicamentos)
  return {
    antMedChips: m.chips, antMedDetalle: m.detalle, antFamChips: f.chips, antFamDetalle: f.detalle,
    alergiasChips: al.chips, alergiasDetalle: al.detalle, medChips: md.chips, medDetalle: md.detalle,
    usaLentes: (a && a.usaLentes) || (prev.usaLentes === true || prev.usaLentes === "si" ? "si" : ""), usaLentesDesde: a?.usaLentesDesde || "", tipoLentes: a?.tipoLentes || "",
  }
}
export const hayAnamnesisPrevia = (a) => !!a && Boolean(a.antMedChips.length || a.antMedDetalle || a.antFamChips.length || a.antFamDetalle || a.alergiasChips.length || a.alergiasDetalle || a.medChips.length || a.medDetalle || a.usaLentes)

// ── Validaciones por paso ──
const medido = (e, c, x) => Boolean(t(e) || t(c) || t(x))
export function validarPasos(f) {
  const e = { anamnesis: {}, examen: {}, diagnostico: {} }
  if (!t(f.motivo)) e.anamnesis.motivo = "Selecciona el motivo de la consulta."
  else if (f.motivo === "Otros" && !t(f.detalleConsulta)) e.anamnesis.detalleConsulta = "Describe el motivo."
  // Todo el examen es opcional. Solo si se registra algo de la refracción final se exigen los dos ojos (o «Ojo no evaluado» con su motivo).
  if (hayRefraccionFinal(f)) {
    for (const [p, noEval, motivoNoEval, ojo] of [["od", f.odNoEval, f.odMotivoNoEval, [f.odEsfera, f.odCilindro, f.odEje]], ["oi", f.oiNoEval, f.oiMotivoNoEval, [f.oiEsfera, f.oiCilindro, f.oiEje]]]) {
      if (noEval) { if (t(motivoNoEval).length < 3) e.examen[`${p}_motivo`] = "Di por qué no se evaluó este ojo."; continue }
      const [esf, cil, eje] = ojo
      if (!t(esf) && !t(cil)) { e.examen[`${p}_esfera`] = "Ingresa la esfera o marca «Ojo no evaluado»"; continue }
      const v = validarOjo({ esfera: esf, cilindro: cil, eje })
      for (const k of ["esfera", "cilindro", "eje"]) if (v[k]) e.examen[`${p}_${k}`] = v[k]
      if (v.transponible) e.examen[`${p}_transponible`] = true
    }
  }
  // Lo que se escribió en la objetiva, los lentes actuales y la adición también se valida si está.
  for (const [p, ojo] of [["objOd", [f.objOdEsfera, f.objOdCilindro, f.objOdEje]], ["objOi", [f.objOiEsfera, f.objOiCilindro, f.objOiEje]]]) {
    if (!medido(...ojo)) continue
    const v = validarOjo({ esfera: ojo[0], cilindro: ojo[1], eje: ojo[2] })
    for (const k of ["esfera", "cilindro", "eje"]) if (v[k]) e.examen[`${p}_${k}`] = v[k]
  }
  const errAdOd = validarAdicion(f.adicionOd)
  if (errAdOd) e.examen.adicionOd = errAdOd
  if (!f.adicionIgual) { const errAdOi = validarAdicion(f.adicionOi); if (errAdOi) e.examen.adicionOi = errAdOi }
  if (!f.diagnosticoCategorias.length) e.diagnostico.diagnostico = "Selecciona al menos una categoría de diagnóstico."
  if (f.diagnosticoCategorias.includes("Otro") && !t(f.diagnostico)) e.diagnostico.diagnosticoDetalle = "Describe el diagnóstico en el detalle — con \"Otro\" no puede quedar vacío."
  if (!f.tratamientoFinalizado) {
    if (!f.controlModo) e.diagnostico.control = "Elige si el próximo control se agenda ahora o después."
    else if (f.controlModo === "ahora" && (!f.controlFecha || !f.controlHora)) e.diagnostico.control = "Elige la fecha y la hora del control, o marca \"Agendar después\"."
  }
  return e
}

export const pasoConErrores = (errs) => PASOS.map((p) => p.id).find((id) => Object.keys(errs[id] || {}).length > 0) || null

// ¿Se registró algo de la refracción final (un valor en cualquiera de los dos ojos, o un ojo marcado como no evaluado)?
export const hayRefraccionFinal = (f) => Boolean(f.odNoEval || f.oiNoEval || [f.odEsfera, f.odCilindro, f.odEje, f.oiEsfera, f.oiCilindro, f.oiEje].some(t))

// ¿Hay algo escrito en el bloque de salud ocular?
export const haySalud = (f) => Boolean(["bioOdParpados", "bioOdCornea", "bioOdCamara", "bioOiParpados", "bioOiCornea", "bioOiCamara", "fondoOd", "fondoOi", "pioOd", "pioOi", "pioHora", "pioMetodo", "colorPrueba", "colorResultado", "colorInterpretacion"].some((k) => t(f[k])))

// El estado de cada paso para la barra: «Completo»/«Incompleto» (anamnesis y diagnóstico), y el examen, que es opcional: «Opcional» si no se registró nada, «Registrado» o «Incompleto» (si lo que se registró de la refracción está a medias).
export function estadoDePasos(f) {
  const errs = validarPasos(f)
  const sinErrores = (id) => Object.keys(errs[id] || {}).length === 0
  return {
    anamnesis: sinErrores("anamnesis") ? "Completo" : "Incompleto",
    examen: !sinErrores("examen") ? "Incompleto" : bloquesDeExamen(f).some((b) => b.registrado) ? "Registrado" : "Opcional",
    diagnostico: sinErrores("diagnostico") ? "Completo" : "Incompleto",
  }
}

// Los cinco bloques plegados del Examen, cada uno con su estado y, si tiene algo, un resumen de una línea.
const unirB = (partes, sep) => unir(partes.filter(Boolean), sep)
const dosOjos = (od, oi) => (t(od) || t(oi) ? `OD ${t(od) || "—"} · OI ${t(oi) || "—"}` : "")
const rx = (e, c, x) => textoOjoCompleto({ esfera: e, cilindro: c, eje: x })
export function bloquesDeExamen(f) {
  const hay = (...campos) => campos.some((k) => (Array.isArray(f[k]) ? f[k].length > 0 : t(f[k])))
  const av = (c) => dosOjos(f[`avOd${c}`], f[`avOi${c}`])
  const agudeza = unirB([av("Sc") && `Sin corrección: ${av("Sc")}`, av("Cc") && `Con sus lentes: ${av("Cc")}`, hay("cercaSc", "cercaCc") && `De cerca: ${f.cercaSc || "—"}${f.cercaCc ? ` / ${f.cercaCc}` : ""}`, hay("avAmbSc", "avAmbCc") && `Ambos: ${f.avAmbSc || f.avAmbCc}`], " · ")
  const actuales = dosOjos(rx(f.actOdEsfera, f.actOdCilindro, f.actOdEje), rx(f.actOiEsfera, f.actOiCilindro, f.actOiEje))
  const dp = t(f.dp) || (aNumero(f.dpOd) !== null && aNumero(f.dpOi) !== null ? String(aNumero(f.dpOd) + aNumero(f.dpOi)) : "")
  const lentes = unirB([actuales && `Actuales: ${actuales}`, f.actAdicion && `adición ${dioptriaTexto(f.actAdicion) || t(f.actAdicion)}`, dp && `DP ${dp} mm`], " · ")
  const finalOd = f.odNoEval ? "no evaluado" : rx(f.odEsfera, f.odCilindro, f.odEje)
  const finalOi = f.oiNoEval ? "no evaluado" : rx(f.oiEsfera, f.oiCilindro, f.oiEje)
  const adicion = t(f.adicionOd) ? `adición ${dioptriaTexto(f.adicionOd) || t(f.adicionOd)}` : ""
  const hayRef = hayRefraccionFinal(f) || hay("objOdEsfera", "objOdCilindro", "objOiEsfera", "objOiCilindro", "kOdK1", "kOiK1", "adicionOd", "adicionOi", "prismaOdCant", "prismaOiCant", "avOdRx", "avOiRx", "avAmbRx", "cercaRx")
  const refraccion = unirB([dosOjos(finalOd, finalOi) && `Final: ${dosOjos(finalOd, finalOi)}`, adicion, !hayRefraccionFinal(f) && hayRef && "objetiva o medidas sin la refracción final"], " · ")
  const cover = unirB([f.coverTipo && `Cover test: ${f.coverTipo}${f.coverMagnitud ? ` ${t(f.coverMagnitud)} Δ` : ""}`, t(f.testMotor) && `Motilidad: ${t(f.testMotor)}`], " · ")
  const saludCampos = ["bioOdParpados", "bioOdCornea", "bioOdCamara", "bioOiParpados", "bioOiCornea", "bioOiCamara", "fondoOd", "fondoOi", "pioOd", "pioOi", "colorPrueba", "colorResultado", "colorInterpretacion"]
  const partesSalud = [hay("bioOdParpados", "bioOdCornea", "bioOdCamara", "bioOiParpados", "bioOiCornea", "bioOiCamara") && "Biomicroscopía", hay("fondoOd", "fondoOi") && "Fondo de ojo", hay("pioOd", "pioOi") && `PIO ${dosOjos(f.pioOd, f.pioOi).replace(/OD /, "").replace(/ · OI /, "/")} mmHg`, hay("colorPrueba", "colorResultado", "colorInterpretacion") && `Color: ${f.colorInterpretacion || f.colorPrueba || "registrado"}`]
  return [
    { id: "agudeza", label: "Agudeza visual", registrado: Boolean(agudeza), resumen: agudeza },
    { id: "lentes", label: "Lentes actuales y distancia pupilar", registrado: hay("actOdEsfera", "actOdCilindro", "actOiEsfera", "actOiCilindro", "actAdicion", "dp", "dpOd", "dpOi", "dpCerca"), resumen: lentes },
    { id: "refraccion", label: "Refracción", registrado: hayRef, resumen: refraccion },
    { id: "cover", label: "Cover test y motilidad", registrado: hay("coverTipo", "coverMagnitud", "coverDistancia", "testMotor"), resumen: cover },
    { id: "salud", label: "Salud ocular", registrado: saludCampos.some((k) => t(f[k])) || hay("pioHora", "pioMetodo"), resumen: unir(partesSalud.filter(Boolean), " · ") },
  ]
}

// ── Para mostrar ──
export const textoDeOjoReceta = textoOjoCompleto
export const agudezaConLetras = (linea, falladas) => textoAgudeza(linea, falladas)
