// Hoja de conteo físico: la hoja que se baja como PDF para contar en el estante. Lógica pura (qué productos entran, cómo se parten en páginas y los totales); el dibujo está en
// componentes/inventario/HojaConteo.jsx y el PDF se arma con el mismo armador de la receta (utilidades/descargarHojaConteo.jsx).
// Una sola hoja para todo el inventario: los productos activos por categoría y, al final, una sección con los descontinuados que todavía tienen unidades. Las diferencias se corrigen con «Ajustar stock».

export const ALTO_PAGINA = 1103 // A4 a 780 px de ancho
const ALTO_UTIL = ALTO_PAGINA - 80 // menos los márgenes
export const ALTO_FILA = 32
export const ALTO_TITULO = 44
export const ALTO_CABECERA_TABLA = 34
const ALTO_ENCABEZADO = 250 // logo, nombre, contacto, título, fecha y las líneas de quién contó y quién revisó
const ALTO_ENCABEZADO_CONTINUACION = 46
const ALTO_CIERRE = 190 // totales y firmas

const porNombre = (a, b) => (a.categoria || "").localeCompare(b.categoria || "", "es") || (a.nombre || "").localeCompare(b.nombre || "", "es")

// Las secciones de la hoja: una por categoría de los activos y, al final, «Descontinuados con unidades» (los descontinuados sin unidades no hay nada que contar).
export function seccionesDeConteo({ activos = [], descontinuados = [] }) {
  const grupos = new Map()
  for (const p of [...activos].sort(porNombre)) {
    const c = p.categoria || "Sin categoría"
    if (!grupos.has(c)) grupos.set(c, [])
    grupos.get(c).push(p)
  }
  const secciones = [...grupos.entries()].map(([titulo, productos]) => ({ titulo, productos }))
  const viejos = descontinuados.filter((p) => (Number(p.stock) || 0) > 0).sort(porNombre)
  if (viejos.length > 0) secciones.push({ titulo: "Descontinuados con unidades", productos: viejos, descontinuados: true })
  return secciones
}

export function totalesDeConteo(secciones) {
  const productos = secciones.flatMap((s) => s.productos)
  return { productos: productos.length, unidades: productos.reduce((t, p) => t + (Number(p.stock) || 0), 0) }
}

// La columna «Código» solo va si algún producto la tiene.
export const hayCodigos = (secciones) => secciones.some((s) => s.productos.some((p) => String(p.codigo || "").trim()))

// Parte las secciones en páginas: [{ elementos: [{ tipo: "titulo", texto } | { tipo: "fila", producto, alterna }], conEncabezado, conCierre }]. El título de una sección nunca queda solo al final de una página,
// y el cierre (totales y firmas) siempre cabe en la última (si no cabe, tiene su propia página).
export function paginarConteo(secciones) {
  const paginas = []
  let actual = null
  let usado = 0
  const abrir = () => {
    actual = { elementos: [], conEncabezado: paginas.length === 0, conCierre: false }
    usado = (actual.conEncabezado ? ALTO_ENCABEZADO : ALTO_ENCABEZADO_CONTINUACION) + ALTO_CABECERA_TABLA
    paginas.push(actual)
  }
  abrir()
  for (const s of secciones) {
    if (usado + ALTO_TITULO + ALTO_FILA > ALTO_UTIL) abrir()
    actual.elementos.push({ tipo: "titulo", texto: `${s.titulo} · ${s.productos.length} producto${s.productos.length === 1 ? "" : "s"}` })
    usado += ALTO_TITULO
    s.productos.forEach((producto, i) => {
      if (usado + ALTO_FILA > ALTO_UTIL) abrir()
      actual.elementos.push({ tipo: "fila", producto, alterna: i % 2 === 1 })
      usado += ALTO_FILA
    })
  }
  if (usado + ALTO_CIERRE > ALTO_UTIL) abrir()
  actual.conCierre = true
  return paginas
}
