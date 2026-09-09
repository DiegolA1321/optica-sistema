// Fuente única de la marca. Antes INK/PORCELAIN/GOLD estaban copy-pasteados
// como constantes locales en 32 lugares de 27 archivos distintos — cambiar
// un color de marca implicaba tocar cada uno a mano. Ahora todo lo importa
// de acá.

export const INK = "#0E2B33"       // navy profundo — texto principal, fondos oscuros, hero
export const PORCELAIN = "#F7F5F0" // fondo cálido claro — texto sobre INK, secciones claras
export const GOLD = "#C8A24E"      // dorado — acento óptico premium, usar con moderación

// Tonos canónicos para acciones de fila (ver, editar, confirmar/agendar,
// eliminar) — extraídos del patrón real ya mayoritario en Usuarios.jsx,
// Inventario.jsx, Pacientes.jsx, etc. (no inventados): "ver" y "editar"
// comparten azul porque así ya se usaban en la práctica, no hay un tercer
// matiz para "editar" en ningún lugar del código real. Antes esto se repetía
// suelto por archivo con pequeñas variaciones (hover:text-blue-600 en unos,
// hover:text-blue-700 en otros) — usar estos en vez de un tono nuevo.
export const ACCION_VER = "text-slate-500 hover:bg-blue-50 hover:text-blue-600"
export const ACCION_EDITAR = ACCION_VER
export const ACCION_CONFIRMAR = "text-slate-500 hover:bg-emerald-50 hover:text-emerald-600"
export const ACCION_ELIMINAR = "text-slate-500 hover:bg-red-50 hover:text-red-600"

// Clase de heading de marca (Sora, declarada en index.css). Usar en h1/h2 de
// sección — hoy solo 3 archivos la usan, el resto mezcla font-serif itálica
// sin criterio.
export const FUENTE_TITULO = "font-heading"
