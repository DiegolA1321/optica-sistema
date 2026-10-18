// Lógica pura de la graduación que comparten el portal del paciente y el perfil del paciente del sistema del personal: la explicación de cada ojo según sus valores, el
// antes → ahora, los años de las recetas y la comparación de dos recetas. Un solo lugar para las reglas: lo que el optómetra le explica al paciente en la consulta es
// exactamente lo que el paciente lee en su portal (regla 2 y 18). Las recetas son las consultas del paciente ({ id, fecha, od, oi, medidas, ... }).
import { nombreMes } from "./formatoFecha"
import { variacionEntre, verdictoPorVariacion, tendenciaEntreConsultas, equivalenteEsferico } from "./tendenciaGraduacion"

export const numero = (v) => {
  const n = parseFloat(String(v ?? "").replace(",", "."))
  return Number.isFinite(n) ? n : null
}

// ── Clasificación por rangos (las reglas, una sola vez) ──
// Esfera: de −0.25 a +0.25 no hay defecto de lejos. Miopía: leve hasta −3.00, moderada hasta −6.00 y alta más allá. Hipermetropía: leve hasta +2.00, moderada hasta +5.00 y alta más allá.
export function clasificarEsfera(valor) {
  const v = numero(valor)
  if (v === null) return null
  if (Math.abs(v) <= 0.25) return { tipo: "neutra", nivel: null }
  if (v < 0) return { tipo: "miopia", nivel: -v <= 3 ? "leve" : -v <= 6 ? "moderada" : "alta" }
  return { tipo: "hipermetropia", nivel: v <= 2 ? "leve" : v <= 5 ? "moderada" : "alta" }
}
// Cilindro (astigmatismo): menos de 0.25 no hay; leve hasta 1.00, moderado hasta 2.00 y alto más allá.
export function clasificarCilindro(valor) {
  const v = numero(valor)
  if (v === null || Math.abs(v) < 0.25) return null
  const a = Math.abs(v)
  return a <= 1 ? "leve" : a <= 2 ? "moderado" : "alto"
}
// Agudeza visual «20/25»: el denominador manda. Hasta 20/25 es visión completa; hasta 20/40, muy buena; hasta 20/70, buena sin ser completa; más allá, reducida.
export function clasificarAgudeza(av) {
  const m = String(av ?? "").match(/^\s*(\d+)\s*\/\s*(\d+)/)
  if (!m) return null
  const den = Number(m[2])
  if (!den) return null
  return den <= 25 ? "completa" : den <= 40 ? "muy buena" : den <= 70 ? "buena" : "reducida"
}

// Un texto con partes en negrita: [{ t, b }]. Se dibuja sin HTML.
const t = (texto, b = false) => ({ t: texto, b })
const NOMBRE_TIPO = { miopia: "miopía", hipermetropia: "hipermetropía" }
const DICE_ESFERA = {
  miopia: { leve: "ves bien de cerca y un poco borroso de lejos.", moderada: "de cerca ves bien y de lejos ves borroso sin tus lentes.", alta: "de cerca ves bien y de lejos ves muy borroso sin tus lentes." },
  hipermetropia: { leve: "ves bien de lejos, pero de cerca la vista se puede cansar.", moderada: "te cuesta enfocar de cerca y la vista se cansa con facilidad.", alta: "te cuesta ver bien de cerca y también de lejos sin tus lentes." },
}
const TAMANO = (d) => { const a = Math.abs(d); return a < 0.75 ? "un poco" : a < 1.5 ? "algo" : "bastante" }

// La explicación de la esfera de un ojo en palabras simples. `otro` es el otro ojo (para decir «un poco menor que en el ojo derecho») y `esIzquierdo` dice cuál es éste.
export function explicarEsfera(ojo, otro = null, esIzquierdo = false) {
  const c = clasificarEsfera(ojo?.esfera)
  if (!c) return [t("No hay una esfera registrada en este ojo.")]
  if (c.tipo === "neutra") return [t("Tu esfera es casi neutra: ", false), t("de lejos ves bien sin corrección", true), t(" en este ojo.")]
  const otroC = clasificarEsfera(otro?.esfera)
  if (esIzquierdo && otroC && otroC.tipo === c.tipo && otroC.nivel === c.nivel) {
    const dif = Math.abs(numero(ojo.esfera)) - Math.abs(numero(otro.esfera))
    const rel = Math.abs(dif) < 0.25 ? "igual que en el ojo derecho" : `${TAMANO(dif)} ${dif < 0 ? "menor" : "mayor"} que en el ojo derecho`
    return [t("Tienes "), t(`${NOMBRE_TIPO[c.tipo]} ${c.nivel}`, true), t(`, ${rel}.`)]
  }
  return [t("Tienes "), t(`${NOMBRE_TIPO[c.tipo]} ${c.nivel}`, true), t(`: ${DICE_ESFERA[c.tipo][c.nivel]}`)]
}

const CORRIGE = "Tus lentes lo corrigen."
export function explicarCilindro(ojo, otro = null, esIzquierdo = false) {
  const n = clasificarCilindro(ojo?.cilindro)
  if (!n) return "No tienes astigmatismo en este ojo."
  const otroN = clasificarCilindro(otro?.cilindro)
  if (esIzquierdo && otroN === n && Math.abs(Math.abs(numero(ojo.cilindro)) - Math.abs(numero(otro.cilindro))) < 0.5) return `${n === "leve" ? "Leve" : n === "moderado" ? "Moderado" : "Alto"}, parecido al del ojo derecho.`
  const base = { leve: "Leve: algunas líneas se ven un poco estiradas.", moderado: "Moderado: las líneas se ven estiradas o dobles sin tus lentes.", alto: "Alto: sin tus lentes las líneas se ven muy estiradas o dobles." }[n]
  return base + (clasificarAgudeza(ojo?.avCc) === "completa" && !esIzquierdo ? " " + CORRIGE : "")
}
export function explicarCerca(adicion, lente = "") {
  if (numero(adicion) === null) return ""
  return /progres/i.test(lente) ? "La ayuda extra que tus lentes progresivos dan en la parte de abajo." : /bifocal/i.test(lente) ? "La ayuda extra que tus lentes bifocales dan en la parte de abajo." : "La ayuda extra para leer de cerca."
}
const DICE_AGUDEZA = { completa: "Ves con nitidez completa, como debe ser.", "muy buena": "Ves con muy buena nitidez.", buena: "Ves bien, aunque todavía no con toda la nitidez.", reducida: "Aún no ves con toda la nitidez: coméntalo con tu optómetra." }
export function explicarAgudeza(av) {
  const c = clasificarAgudeza(av)
  return c ? DICE_AGUDEZA[c] : ""
}

// Todo lo que se dice de un ojo, listo para dibujar. `lado`: "od" | "oi". Con la agudeza con lentes; si no la hay, la de sin lentes (con su rótulo).
export function lecturaDeOjo(receta, lado) {
  const ojo = receta?.[lado] || {}
  const otro = receta?.[lado === "od" ? "oi" : "od"] || {}
  const izq = lado === "oi"
  const av = ojo.avCc || ojo.avSc || ""
  return {
    esfera: numero(ojo.esfera) === null ? "" : ojo.esfera,
    explicaEsfera: explicarEsfera(ojo, otro, izq),
    cilindro: numero(ojo.cilindro) === null ? "" : ojo.cilindro,
    eje: ojo.eje ? String(ojo.eje) : "",
    hayAstigmatismo: Boolean(clasificarCilindro(ojo.cilindro)),
    explicaCilindro: explicarCilindro(ojo, otro, izq),
    adicion: receta?.medidas?.adicion || "",
    explicaCerca: explicarCerca(receta?.medidas?.adicion, receta?.lenteRecomendado),
    agudeza: av,
    conLentes: Boolean(ojo.avCc) || !ojo.avSc,
    explicaAgudeza: explicarAgudeza(av),
  }
}

// ── Antes → ahora ──
const FRACCIONES = { 0.25: "un cuarto de dioptría", 0.5: "media dioptría", 0.75: "tres cuartos de dioptría", 1: "una dioptría" }
export function textoMagnitud(d) {
  const a = Math.round(Math.abs(d) * 100) / 100
  const paso = Math.round(a * 4) / 4
  if (FRACCIONES[paso] && Math.abs(a - paso) < 0.13) return FRACCIONES[paso]
  return `${a.toFixed(2).replace(/\.?0+$/, "")} dioptrías`
}
const mesAnio = (iso) => { const s = nombreMes(Number(String(iso).slice(5, 7)) - 1, "corto"); return s.charAt(0).toUpperCase() + s.slice(1) + " " + String(iso).slice(0, 4) }

// El cambio de cada ojo entre la receta de ahora y la anterior: { antes: { fecha, valor }, ahora: { fecha, valor }, texto } con la misma resta y el mismo umbral que la tendencia del perfil.
export function cambioPorOjo(consultasRecientePrimero = []) {
  if (consultasRecientePrimero.length < 2) return null
  const [reciente, previa] = consultasRecientePrimero
  const ojo = (nombre, lado) => {
    const v = variacionEntre({ od: reciente[lado] }, { od: previa[lado] })
    const texto = v === null ? "" : verdictoPorVariacion(v) === "Sin cambios" ? "Sin cambios" : v > 0 ? `${textoMagnitud(v).charAt(0).toUpperCase() + textoMagnitud(v).slice(1)} más de corrección` : `${textoMagnitud(v).charAt(0).toUpperCase() + textoMagnitud(v).slice(1)} menos de corrección`
    return { nombre, lado, antes: { fecha: mesAnio(previa.fecha), valor: previa[lado]?.esfera ?? "" }, ahora: { fecha: mesAnio(reciente.fecha), valor: reciente[lado]?.esfera ?? "" }, variacion: v, texto }
  }
  return [ojo("Ojo derecho", "od"), ojo("Ojo izquierdo", "oi")]
}

// La frase del Inicio: «Tu miopía aumentó un poco desde noviembre: un cuarto de dioptría más.» Usa la tendencia del perfil (misma cuenta y mismo umbral).
export function fraseDeCambio(consultasRecientePrimero = []) {
  const t2 = tendenciaEntreConsultas(consultasRecientePrimero)
  if (!t2) return ""
  const mes = nombreMes(Number(String(t2.fechaPrevia).slice(5, 7)) - 1)
  if (t2.verdicto === "Sin cambios") return `Tu graduación se mantiene igual que en ${mes}.`
  const c = clasificarEsfera(consultasRecientePrimero[0]?.od?.esfera ?? consultasRecientePrimero[0]?.oi?.esfera)
  const que = c && c.tipo !== "neutra" ? NOMBRE_TIPO[c.tipo] : "graduación"
  const m = textoMagnitud(t2.variacion)
  return t2.verdicto === "Aumentó" ? `Tu ${que} aumentó un poco desde ${mes}: ${m} más.` : `Tu ${que} disminuyó desde ${mes}: ${m} menos.`
}

// ── La lista de recetas ──
// Una receta es una consulta con alguna medida (esfera, cilindro o eje en algún ojo); una consulta sin medidas no es una receta. Recibe y devuelve de la más reciente a la más antigua.
export const recetasDe = (consultas = []) => consultas.filter((c) => ["od", "oi"].some((l) => c?.[l] && (numero(c[l].esfera) !== null || numero(c[l].cilindro) !== null || numero(c[l].eje) !== null)))
export const aniosDeRecetas = (recetas = []) => [...new Set(recetas.map((r) => String(r.fecha).slice(0, 4)))].sort((a, b) => b.localeCompare(a))
export const filtrarRecetasPorAnio = (recetas = [], anio = "todas") => (anio === "todas" ? recetas : recetas.filter((r) => String(r.fecha).slice(0, 4) === anio))

// Una línea con lo medido: «Derecho −1.75 · Izquierdo −1.25» (la esfera de cada ojo).
export function lineaDeEsferas(receta, formato) {
  const f = (o) => formato(o?.esfera)
  const partes = [["Derecho", f(receta.od)], ["Izquierdo", f(receta.oi)]].filter(([, v]) => v)
  return partes.map(([n, v]) => `${n} ${v}`).join(" · ")
}

// ── Comparar dos recetas ──
// Devuelve las filas de la comparación (de la más antigua `antes` a la más reciente `ahora`): por ojo, esfera, cilindro, eje y agudeza; y la adición. Cada fila dice si cambió y, en los
// valores numéricos, cuánto. `difiere` marca lo que hay que señalar.
export function compararRecetas(a, b) {
  const [antes, ahora] = String(a.fecha) <= String(b.fecha) ? [a, b] : [b, a]
  const filas = []
  const valor = (r, lado, campo) => (lado ? r?.[lado]?.[campo] : r?.medidas?.[campo]) ?? ""
  const agregar = (clave, etiqueta, lado, campo, numerico) => {
    const x = valor(antes, lado, campo)
    const y = valor(ahora, lado, campo)
    if (x === "" && y === "") return
    const nx = numerico ? numero(x) : null
    const ny = numerico ? numero(y) : null
    const delta = nx !== null && ny !== null ? Math.round((ny - nx) * 100) / 100 : null
    const difiere = numerico && nx !== null && ny !== null ? delta !== 0 : String(x) !== String(y)
    filas.push({ clave: `${lado || "medidas"}-${clave}`, etiqueta, lado, antes: x, ahora: y, difiere, delta })
  }
  for (const lado of ["od", "oi"]) {
    agregar("esfera", "Esfera", lado, "esfera", true)
    agregar("cilindro", "Cilindro", lado, "cilindro", true)
    agregar("eje", "Eje", lado, "eje", true)
    agregar("av", "Agudeza visual", lado, "avCc", false)
  }
  agregar("adicion", "Adición", null, "adicion", true)
  return { antes, ahora, filas, cambios: filas.filter((f) => f.difiere).length }
}

// El cambio de un valor entre dos recetas, con su signo: «+0.25», «−0.50».
export const textoDelta = (d) => (d > 0 ? "+" : "−") + Math.abs(d).toFixed(2)

export { equivalenteEsferico }
