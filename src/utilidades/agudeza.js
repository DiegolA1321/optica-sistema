// Agudeza visual: las líneas de la cartilla, las letras falladas, la agudeza de cerca (Jaeger) y el estado de corrección. Un solo lugar para el sistema entero (ficha, perfil, Reportes y portal).

// Líneas de la cartilla de Snellen y, para quien no llega a leerla, las cuatro anotaciones habituales (de mejor a peor).
export const LINEAS_CARTILLA = ["20/20", "20/25", "20/30", "20/40", "20/50", "20/60", "20/70", "20/80", "20/100", "20/200", "20/400"]
export const SIN_CARTILLA = ["Cuenta dedos", "Movimiento de manos", "Percepción de luz", "No percibe luz"]
export const LISTA_AGUDEZA = [...LINEAS_CARTILLA, ...SIN_CARTILLA]
export const LISTA_JAEGER = ["J1", "J2", "J3", "J4", "J5", "J6", "J7", "J8", "J10", "J14"]

const ORDEN = Object.fromEntries(LISTA_AGUDEZA.map((v, i) => [v, i]))
// 20/20 y 20/25 son «buena agudeza»; cualquier otra línea (o una anotación sin cartilla) no lo es. Un valor que no está en la lista (fichas viejas) se compara por su denominador.
const esBuena = (av) => {
  if (!av) return false
  if (av in ORDEN) return ORDEN[av] <= 1
  const m = String(av).match(/^\s*20\s*\/\s*(\d+)/)
  return m ? Number(m[1]) <= 25 : false
}

// «20/25 −2»: la línea leída y, si falló letras, cuántas. Cuenta dedos y demás no llevan letras.
export const textoAgudeza = (linea, falladas = "") => {
  if (!linea) return ""
  const n = String(falladas ?? "").replace(/\D/g, "")
  return LINEAS_CARTILLA.includes(linea) && n && n !== "0" ? `${linea} −${n}` : linea
}

// Estado de corrección: ¿con la corrección que se le da logra buena agudeza (20/20–20/25) en los dos ojos?
//   · Con la agudeza «con la receta nueva» de los dos ojos, se calcula con ella (la ficha de cinco pasos).
//   · Si no la hay, con la «con lentes» (su corrección actual), como hacían las fichas anteriores: esas siguen igual.
// Sin los dos ojos de la misma agudeza: «Sin evaluar».
export function estadoCorreccionDe(od = {}, oi = {}) {
  const rx = od.avRx && oi.avRx
  const a = rx ? od.avRx : od.avCc
  const b = rx ? oi.avRx : oi.avCc
  if (!a || !b) return "Sin evaluar"
  return esBuena(a) && esBuena(b) ? "Bien corregido" : "Requiere ajuste"
}

// De qué agudeza sale el estado (para decirlo en pantalla): «con la receta nueva» o «con sus lentes actuales».
export const agudezaDelEstado = (od = {}, oi = {}) => (od.avRx && oi.avRx ? "receta" : od.avCc && oi.avCc ? "lentes" : null)

// La agudeza «con lentes» que se le muestra a quien la lee en el perfil o en el portal: la de la receta nueva si existe; si no, la de sus lentes y, al final, la de sin lentes.
export const agudezaConLentes = (ojo = {}) => ojo.avRx || ojo.avCc || ""
