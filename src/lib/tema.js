// Fuente única de la marca. Antes INK/PORCELAIN/GOLD estaban copy-pasteados
// como constantes locales en 32 lugares de 27 archivos distintos — cambiar
// un color de marca implicaba tocar cada uno a mano. Ahora todo lo importa
// de acá.

export const INK = "#0E2B33"       // navy profundo — texto principal, fondos oscuros, hero
export const PORCELAIN = "#F7F5F0" // fondo cálido claro — texto sobre INK, secciones claras
export const GOLD = "#C8A24E"      // dorado — acento óptico premium, usar con moderación

// Tonos canónicos para acciones/estados recurrentes (ver, confirmar, editar,
// eliminar). Antes cada tabla elegía su propio matiz de azul/verde/rojo
// (blue-600 en una página, blue-700 en otra) — usar estos en vez de un tono
// suelto nuevo.
export const ACCION_VER = "text-blue-600 hover:bg-blue-50 hover:text-blue-700"
export const ACCION_CONFIRMAR = "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
export const ACCION_EDITAR = "text-amber-600 hover:bg-amber-50 hover:text-amber-700"
export const ACCION_ELIMINAR = "text-red-600 hover:bg-red-50 hover:text-red-700"

// Clase de heading de marca (Sora, declarada en index.css). Usar en h1/h2 de
// sección — hoy solo 3 archivos la usan, el resto mezcla font-serif itálica
// sin criterio.
export const FUENTE_TITULO = "font-heading"
