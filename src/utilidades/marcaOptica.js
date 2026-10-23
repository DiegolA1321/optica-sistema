// Marca de la óptica: color principal, contraste y textos de la página pública con sus valores de ejemplo.
// Una sola fuente para la página pública, el ingreso, el agendamiento y el portal del paciente: cambiar el color o un texto
// en Configuración → Página pública lo cambia en todos. Todo vive en `opticas.marca` (jsonb), que el administrador ya edita
// y que la vista `opticas_publicas` ya expone; una óptica sin esas claves (existente o nueva) recibe los ejemplos de aquí.
import { ahoraEcuador } from "./horaEcuador"

export const COLOR_POR_DEFECTO = "#2563EB"
export const CONTRASTE_MINIMO = 4.5 // texto blanco sobre el color: WCAG AA para texto normal

export const PALETA_MARCA = [
  { nombre: "Azul", color: "#2563EB" },
  { nombre: "Verde", color: "#15803D" },
  { nombre: "Turquesa", color: "#0E7490" },
  { nombre: "Violeta", color: "#6D28D9" },
  { nombre: "Rojo", color: "#B91C1C" },
  { nombre: "Naranja", color: "#C2410C" },
  { nombre: "Grafito", color: "#334155" },
]

const HEX = /^#([0-9a-f]{6})$/i

export const esColorValido = (c) => typeof c === "string" && HEX.test(c.trim())

const canal = (v) => {
  const s = v / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

const luminancia = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255)
}

// Razón de contraste WCAG entre dos colores #RRGGBB (1 a 21).
export function contraste(a, b) {
  const la = luminancia(a)
  const lb = luminancia(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

const aHex = (r, g, b) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("").toUpperCase()

// Oscurece el color de a poco hasta que el texto blanco se lea sobre él. Devuelve el color final y si hubo que ajustarlo.
export function colorLegible(color) {
  const base = esColorValido(color) ? color.trim().toUpperCase() : COLOR_POR_DEFECTO
  if (contraste(base, "#FFFFFF") >= CONTRASTE_MINIMO) return { color: base, ajustado: false }
  const n = parseInt(base.slice(1), 16)
  let r = (n >> 16) & 255
  let g = (n >> 8) & 255
  let b = n & 255
  for (let i = 0; i < 40 && contraste(aHex(r, g, b), "#FFFFFF") < CONTRASTE_MINIMO; i++) {
    r *= 0.94
    g *= 0.94
    b *= 0.94
  }
  return { color: aHex(r, g, b), ajustado: true }
}

// Color principal ya validado y con contraste suficiente: lo que se pinta en pantalla.
export const colorMarca = (marca) => colorLegible(marca?.colorAcento).color

// Degradado de los botones y de la baldosa del logo (cian → color de la óptica, como en el diseño).
export const degradadoMarca = (color) => `linear-gradient(135deg,#22D3EE,${colorLegible(color).color})`

// ─── Textos de la página pública (ejemplos que la óptica reemplaza) ───
export const SERVICIOS_EJEMPLO = [
  { id: "s1", titulo: "Examen visual completo", texto: "Agudeza visual, refracción y salud de tus ojos. Unos 30 minutos.", motivo: "Consulta General" },
  { id: "s2", titulo: "Monturas y lentes", texto: "Te ayudamos a elegir según tu receta y tu estilo.", motivo: "Adaptación de Lentes" },
  { id: "s3", titulo: "Control y seguimiento", texto: "Te recordamos tu control y te acompañamos con tus lentes.", motivo: "Examen de Control" },
]

export const PREGUNTAS_EJEMPLO = [
  { id: "p1", p: "¿Necesito agendar o puedo llegar directamente?", r: "Puedes llegar, pero con cita te atendemos sin esperar." },
  { id: "p2", p: "¿Cuánto dura un examen visual?", r: "Entre 20 y 30 minutos, según sea tu primera consulta o un control." },
  { id: "p3", p: "¿Qué debo llevar a mi cita?", r: "Tus lentes actuales y tu receta anterior, si la tienes a mano." },
  { id: "p4", p: "¿Puedo ver mi receta en línea?", r: "Sí: pide en la óptica el acceso a tu portal y verás tus citas y tu receta cuando quieras." },
]

export const ESLOGAN_POR_DEFECTO = "Ve el mundo con claridad."
const MENSAJE_ANTIGUO = (n) => `En ${n} cuidamos tu salud visual de principio a fin: examen de precisión, lentes a tu medida y un acompañamiento cercano después de tu compra.`
export const TEXTO_INICIO_POR_DEFECTO = "Exámenes de la vista, lentes a tu medida y acompañamiento cercano después de tu compra."

const limpiarLista = (lista, ejemplo, campos) => {
  if (!Array.isArray(lista)) return ejemplo
  return lista
    .map((x, i) => ({ id: x?.id || `${ejemplo[0]?.id?.[0] || "x"}${i + 1}`, ...Object.fromEntries(campos.map((c) => [c, typeof x?.[c] === "string" ? x[c] : ""])) }))
    .filter((x) => campos.some((c) => x[c].trim()))
}

// Todo lo que la página pública necesita, con ejemplos donde la óptica no escribió nada.
export function paginaPublica(marca, nombre = "Tu óptica") {
  const m = marca || {}
  const q = m.quienesSomos || {}
  const esloganGuardado = typeof m.eslogan === "string" && m.eslogan.trim() ? m.eslogan.trim() : ESLOGAN_POR_DEFECTO
  const mensajeGuardado = typeof m.mensaje === "string" ? m.mensaje.trim() : ""
  const sinTextoPropio = !mensajeGuardado || mensajeGuardado === MENSAJE_ANTIGUO(nombre) || mensajeGuardado.startsWith("En Diego Óptica cuidamos")
  return {
    nombre: m.nombreMarca || nombre,
    eslogan: esloganGuardado,
    textoInicio: sinTextoPropio ? TEXTO_INICIO_POR_DEFECTO : mensajeGuardado,
    imagenPrincipal: m.imagenPrincipalUrl || "",
    color: colorMarca(m),
    quienesSomos: {
      historia: typeof q.historia === "string" && q.historia.trim() ? q.historia : "Somos una óptica que cuida tu salud visual con exámenes de precisión, lentes a tu medida y un trato cercano. Escribe aquí cómo empezó la óptica y a quién atiende.",
      mision: typeof q.mision === "string" && q.mision.trim() ? q.mision : "Que cada persona vea bien y se sienta bien atendida.",
      anoFundacion: Number.isInteger(q.anoFundacion) ? q.anoFundacion : null,
      mostrarAnos: q.mostrarAnos !== false,
      mostrarPacientes: q.mostrarPacientes !== false,
      mostrarOptometras: q.mostrarOptometras !== false,
    },
    servicios: limpiarLista(m.serviciosPagina, SERVICIOS_EJEMPLO, ["titulo", "texto", "motivo"]),
    preguntas: limpiarLista(m.preguntas, PREGUNTAS_EJEMPLO, ["p", "r"]),
  }
}

// ─── Números automáticos de «Quiénes somos» ───
export function anosAtendiendo(anoFundacion, hoy = ahoraEcuador()) {
  if (!Number.isInteger(anoFundacion)) return null
  const anos = hoy.getFullYear() - anoFundacion
  return anos >= 1 ? anos : null
}

// 287 → "250+", 1340 → "1.300+" (hacia abajo, para no prometer más de lo que hay); menos de 10 se muestra exacto.
export function pacientesRedondeado(n) {
  if (!Number.isFinite(n) || n <= 0) return null
  if (n < 10) return String(n)
  const paso = n < 100 ? 10 : n < 1000 ? 50 : 100
  const r = Math.floor(n / paso) * paso
  return r.toLocaleString("es-EC") + "+"
}

export const iniciales = (nombre = "") => nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase()
