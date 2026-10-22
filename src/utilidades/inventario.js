// Umbral único de "stock bajo" para todo el inventario: lo fija el administrador en Configuración → Inventario
// (parametrizacion.stockMinimo) y por defecto es 10, como pidió el ingeniero en la reunión del 29 de
// septiembre ("el stock mínimo va a ser 10: cualquiera de 10 para abajo es de stock bajo").
// Un producto puede tener su propio mínimo (campo opcional "critico"): si lo tiene, reemplaza al general solo para ese producto.
//
// El stock máximo es lo mismo del otro lado (reunión del 20 de octubre): un valor general en Configuración → Inventario (para no hacerlo producto por producto) y, en cada producto,
// «usar el general» o uno propio (`maximo`). El máximo NO limita nada: solo avisa «tienes bastante de esto» (sobrestock) en la lista, en el Inicio y al registrar un ingreso.
export const UMBRAL_STOCK_BAJO = 10
export const UMBRAL_STOCK_MAXIMO = 30
export const TOPE_STOCK = 9999

export function umbralStock(parametrizacion) {
  const n = Number(parametrizacion?.stockMinimo)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : UMBRAL_STOCK_BAJO
}

// El máximo general de la óptica; sin guardar, el de siempre.
export function umbralMaximo(parametrizacion) {
  const n = Number(parametrizacion?.stockMaximo)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : UMBRAL_STOCK_MAXIMO
}

// Mínimo que vale para un producto: el suyo si lo definió; si no, el general.
export function minimoDe(producto, umbral = UMBRAL_STOCK_BAJO) {
  const propio = producto?.critico
  if (propio === null || propio === undefined || propio === "") return umbral
  const n = Number(propio)
  return Number.isFinite(n) && n >= 0 ? n : umbral
}

// Máximo que vale para un producto: el suyo si lo definió; si no, el general.
export function maximoDe(producto, maximoGeneral = UMBRAL_STOCK_MAXIMO) {
  const propio = producto?.maximo
  if (propio === null || propio === undefined || propio === "") return maximoGeneral
  const n = Number(propio)
  return Number.isFinite(n) && n > 0 ? n : maximoGeneral
}

export function esStockBajo(producto, umbral = UMBRAL_STOCK_BAJO) {
  const stock = Number(producto?.stock) || 0
  return stock <= minimoDe(producto, umbral)
}

// Sobrestock: más unidades que su máximo. Un producto que ya está en stock bajo no puede estar en sobrestock (si el máximo propio quedó por debajo del mínimo, manda el bajo).
export function esSobrestock(producto, maximoGeneral = UMBRAL_STOCK_MAXIMO, umbral = UMBRAL_STOCK_BAJO) {
  const stock = Number(producto?.stock) || 0
  return !esStockBajo(producto, umbral) && stock > maximoDe(producto, maximoGeneral)
}

// El estado de una existencia: «bajo», «sobre» o «normal». Una sola cuenta para la lista, la franja, el Inicio y el detalle (regla 2).
export function estadoDeStock(producto, umbral = UMBRAL_STOCK_BAJO, maximoGeneral = UMBRAL_STOCK_MAXIMO) {
  if (esStockBajo(producto, umbral)) return "bajo"
  return esSobrestock(producto, maximoGeneral, umbral) ? "sobre" : "normal"
}

// Cuánto de su máximo llena la existencia, de 0 a 1 (la barrita de la lista).
export const proporcionDeStock = (producto, maximoGeneral = UMBRAL_STOCK_MAXIMO) => {
  const max = maximoDe(producto, maximoGeneral)
  return Math.min(1, Math.max(0, (Number(producto?.stock) || 0) / max))
}

// El aviso de un ingreso que pasa del máximo (antes de registrarlo, sin bloquear): «Quedarías con 58 u., casi el doble de tu máximo (30). Puedes registrarlo igual.»
// Devuelve "" si con el ingreso no se pasa del máximo.
export function avisoDeSobrestock({ existencia = 0, ingreso = 0, maximo }) {
  const quedaria = (Number(existencia) || 0) + (Number(ingreso) || 0)
  const max = Number(maximo)
  if (!(max > 0) || !(Number(ingreso) > 0) || quedaria <= max) return ""
  const veces = quedaria / max
  const cuanto = veces >= 2.05 ? `más del doble de tu máximo (${max})` : veces >= 1.8 ? `casi el doble de tu máximo (${max})` : `más de tu máximo (${max})`
  return `Quedarías con ${quedaria} u., ${cuanto}. Puedes registrarlo igual.`
}

const sinTildes = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim()

// El producto de la óptica (activo o descontinuado) que ya se llama así, para avisar en el momento de escribir el nombre: «Ya existe «Estuche rígido» en Descontinuados».
export function productoExistente(productos = [], nombre, excluirId = null) {
  const clave = sinTildes(nombre)
  if (!clave) return null
  return productos.find((p) => p.id !== excluirId && sinTildes(p.nombre) === clave) || null
}
