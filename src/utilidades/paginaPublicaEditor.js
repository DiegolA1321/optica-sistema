// Lógica pura del editor «Página pública» (Configuración): del `marca` guardado al formulario, y del formulario de vuelta a un `marca` nuevo.
// Una sola fuente de lo que se escribe: la página pública, el ingreso, el agendamiento y el portal leen `opticas.marca` con paginaPublica() (marcaOptica.js).
// Al guardar se MEZCLA sobre la marca que ya existe: las claves que el editor no toca (las viejas: servicios de 3 con features, logoUrlClaro, colorSecundario,
// serviciosActivos…) se conservan tal cual.
import { colorLegible, esColorValido, COLOR_POR_DEFECTO, paginaPublica } from "./marcaOptica"
import { ahoraEcuador } from "./horaEcuador"

export const ANO_MINIMO_FUNDACION = 1900
export const TAMANO_MAXIMO_IMAGEN = 2 * 1024 * 1024
export const TIPOS_LOGO = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"]
export const TIPOS_IMAGEN_PRINCIPAL = ["image/png", "image/jpeg", "image/webp"]

let contador = 0
// Identificador nuevo para un servicio o una pregunta agregados en el editor (no choca con los que ya hay).
export const idNuevo = (prefijo, existentes = []) => {
  let id
  do { contador += 1; id = `${prefijo}${Date.now().toString(36)}${contador}` } while (existentes.some((x) => x.id === id))
  return id
}

// El formulario con lo que hoy ve el público: si la óptica no escribió algo (óptica nueva o clave que falta) aparece el texto de ejemplo, ya puesto y editable.
export function formularioDesdeMarca(marca, nombreOptica = "Tu óptica", logoUrl = "") {
  const p = paginaPublica(marca, nombreOptica)
  const m = marca || {}
  return {
    nombreMarca: typeof m.nombreMarca === "string" ? m.nombreMarca : "",
    eslogan: p.eslogan,
    mensaje: p.textoInicio,
    colorAcento: esColorValido(m.colorAcento) ? m.colorAcento.trim().toUpperCase() : COLOR_POR_DEFECTO,
    imagenPrincipalUrl: p.imagenPrincipal,
    logoUrl: logoUrl || "",
    historia: p.quienesSomos.historia,
    mision: p.quienesSomos.mision,
    anoFundacion: p.quienesSomos.anoFundacion == null ? "" : String(p.quienesSomos.anoFundacion),
    mostrarAnos: p.quienesSomos.mostrarAnos,
    mostrarPacientes: p.quienesSomos.mostrarPacientes,
    mostrarOptometras: p.quienesSomos.mostrarOptometras,
    servicios: p.servicios.map((s) => ({ id: s.id, titulo: s.titulo, texto: s.texto, motivo: s.motivo })),
    preguntas: p.preguntas.map((q) => ({ id: q.id, p: q.p, r: q.r })),
    razones: p.razones.map((r) => ({ id: r.id, titulo: r.titulo, texto: r.texto })),
    opiniones: p.opiniones.map((o) => ({ id: o.id, texto: o.texto, nombre: o.nombre })),
  }
}

// «Ese color es muy claro…»: null si el color elegido ya se lee con texto blanco; si no, el aviso y el color al que se ajusta.
export function avisoDeContraste(color) {
  if (!esColorValido(color)) return null
  const { color: ajustado, ajustado: hubo } = colorLegible(color)
  return hubo ? { ajustado, texto: `Ese color es muy claro: el texto no se leería bien. Lo ajustamos a ${ajustado}.` } : null
}

// Año de fundación: vacío vale (no se muestra); si se escribe, un entero entre 1900 y el año actual. Devuelve el mensaje de error o "".
export function errorDeAno(valor, hoy = ahoraEcuador()) {
  const t = String(valor ?? "").trim()
  if (!t) return ""
  const limite = hoy.getFullYear()
  if (!/^\d{4}$/.test(t)) return `Escribe el año con cuatro cifras, entre ${ANO_MINIMO_FUNDACION} y ${limite}.`
  const n = Number(t)
  return n < ANO_MINIMO_FUNDACION || n > limite ? `El año debe estar entre ${ANO_MINIMO_FUNDACION} y ${limite}.` : ""
}

// Tipo y peso de una imagen antes de subirla. Devuelve el mensaje de error o "".
export function errorDeArchivo(archivo, { tipos = TIPOS_LOGO, nombre = "La imagen" } = {}) {
  if (!archivo) return ""
  const tipo = String(archivo.type || "").toLowerCase()
  if (!tipos.includes(tipo)) return `${nombre} debe ser ${tipos.includes("image/svg+xml") ? "PNG, JPG, WEBP o SVG" : "PNG, JPG o WEBP"}.`
  if (archivo.size > TAMANO_MAXIMO_IMAGEN) return `${nombre} no puede pesar más de 2 MB.`
  return ""
}

const texto = (v) => (typeof v === "string" ? v.trim() : "")

// Servicios y preguntas: los completos se guardan; los totalmente vacíos se descartan sin avisar; los escritos a medias (hay algo escrito pero falta el título o el texto,
// la pregunta o la respuesta) se descartan también, pero se cuentan en `aMedias` para preguntar antes de perder lo escrito.
export function limpiarLista(lista, campos, obligatorios) {
  const guardar = []
  const aMedias = []
  for (const x of lista) {
    const limpio = { id: x.id, ...Object.fromEntries(campos.map((c) => [c, texto(x[c])])) }
    const escritos = campos.filter((c) => limpio[c] && c !== "motivo")
    if (obligatorios.every((c) => limpio[c])) guardar.push(limpio)
    else if (escritos.length) aMedias.push(limpio)
  }
  return { guardar, aMedias }
}

// El `marca` que se guardará: la marca existente mezclada con lo del formulario. El color va ya ajustado para que el texto blanco se lea.
export function construirMarca(form, marcaExistente) {
  const base = marcaExistente && typeof marcaExistente === "object" ? marcaExistente : {}
  const { guardar: servicios, aMedias: serviciosAMedias } = limpiarLista(form.servicios, ["titulo", "texto", "motivo"], ["titulo", "texto"])
  const { guardar: preguntas, aMedias: preguntasAMedias } = limpiarLista(form.preguntas, ["p", "r"], ["p", "r"])
  const { guardar: razones, aMedias: razonesAMedias } = limpiarLista(form.razones || [], ["titulo", "texto"], ["titulo", "texto"])
  const { guardar: opiniones, aMedias: opinionesAMedias } = limpiarLista(form.opiniones || [], ["texto", "nombre"], ["texto"])
  const { color, ajustado } = colorLegible(form.colorAcento)
  const ano = texto(form.anoFundacion)
  const quienes = { ...(base.quienesSomos || {}), historia: texto(form.historia), mision: texto(form.mision), mostrarAnos: !!form.mostrarAnos, mostrarPacientes: !!form.mostrarPacientes, mostrarOptometras: !!form.mostrarOptometras }
  if (ano) quienes.anoFundacion = Number(ano)
  else delete quienes.anoFundacion
  const marca = {
    ...base,
    nombreMarca: texto(form.nombreMarca),
    eslogan: texto(form.eslogan),
    mensaje: texto(form.mensaje),
    colorAcento: color,
    imagenPrincipalUrl: texto(form.imagenPrincipalUrl),
    quienesSomos: quienes,
    serviciosPagina: servicios,
    preguntas,
    razones,
    opiniones,
  }
  return { marca, colorAjustado: ajustado, serviciosAMedias, preguntasAMedias, razonesAMedias, opinionesAMedias }
}

// El formulario tal como queda después de guardar (listas ya limpias, color ya ajustado): es la nueva base para saber si hay cambios sin guardar.
export const formularioTrasGuardar = (form, marca) => ({
  ...form,
  nombreMarca: marca.nombreMarca,
  eslogan: marca.eslogan,
  mensaje: marca.mensaje,
  colorAcento: marca.colorAcento,
  historia: marca.quienesSomos.historia,
  mision: marca.quienesSomos.mision,
  servicios: marca.serviciosPagina,
  preguntas: marca.preguntas,
  razones: marca.razones,
  opiniones: marca.opiniones,
})

export const hayCambios = (a, b) => JSON.stringify(a) !== JSON.stringify(b)

// Mueve el elemento `i` una posición (-1 sube, +1 baja). Devuelve la misma lista si no se puede.
export function mover(lista, i, delta) {
  const j = i + delta
  if (j < 0 || j >= lista.length || i < 0 || i >= lista.length) return lista
  const copia = [...lista]
  ;[copia[i], copia[j]] = [copia[j], copia[i]]
  return copia
}
