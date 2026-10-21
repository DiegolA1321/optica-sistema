// La sesión de Supabase Auth es una sola por navegador, compartida por todas sus pestañas. Lo que debe ser igual de compartido:
//  * la inactividad (una pestaña olvidada no puede cerrar la sesión de la que se está usando),
//  * el aviso de por qué se cerró (para que todas las pestañas digan lo mismo),
//  * la detección de que la sesión se perdió (para no dejar la pantalla "dentro" con llamadas anónimas a la base).
export const MENSAJE_SESION_VENCIDA = 'Tu sesión venció, vuelve a ingresar'
export const MENSAJE_SESION_CERRADA_EN_OTRA_PESTANA = 'Cerraste sesión en otra pestaña. Vuelve a ingresar.'
export const LIMITE_INACTIVIDAD_MS = 30 * 60 * 1000
// Un minuto antes del cierre se pregunta «¿Sigues ahí?»; solo «Seguir conectado» reinicia el tiempo (mover el mouse ya no basta).
export const AVISO_INACTIVIDAD_MS = 60 * 1000
export const MENSAJE_CIERRE_POR_INACTIVIDAD = 'Tu sesión se cerró por inactividad. Vuelve a iniciar sesión.'
// Antes de cerrar, la ficha clínica abierta guarda su borrador al instante (ConsultaMedica escucha este evento).
export const EVENTO_GUARDAR_BORRADOR = 'optica:guardar-borrador'
export const EVENTO_SESION_PERDIDA = 'optica:sesion-perdida'

const CLAVE_ACTIVIDAD = 'optica_ultima_actividad'
const CLAVE_MOTIVO = 'optica_motivo_cierre'
const VIGENCIA_MOTIVO_MS = 30_000
const ESCRITURA_MINIMA_MS = 2_000

let ultimaEscritura = 0

function leer(clave) {
  try { return window.localStorage.getItem(clave) } catch { return null }
}
function escribir(clave, valor) {
  try { window.localStorage.setItem(clave, valor) } catch { /* sin almacenamiento: cada pestaña cuenta sola */ }
}

// Cualquier pestaña que registra actividad la registra para todas. Se escribe a lo más cada 2 s (mousedown/scroll son muy frecuentes).
export function registrarActividad(ahora = Date.now(), { forzar = false } = {}) {
  if (!forzar && ahora - ultimaEscritura < ESCRITURA_MINIMA_MS) return
  ultimaEscritura = ahora
  escribir(CLAVE_ACTIVIDAD, String(ahora))
}

// «Seguir conectado»: reinicia el tiempo en TODAS las pestañas (la actividad es un dato compartido).
export const seguirConectado = (ahora = Date.now()) => registrarActividad(ahora, { forzar: true })

// Segundos que faltan para el cierre, o null mientras no toca avisar. Se calcula con la actividad de cualquier pestaña, así que
// si se pulsa «Seguir conectado» en una, la cuenta desaparece en todas.
export function segundosParaCerrar(desde, ahora = Date.now()) {
  const sin = tiempoSinActividad(desde, ahora)
  if (sin < LIMITE_INACTIVIDAD_MS - AVISO_INACTIVIDAD_MS) return null
  return Math.max(0, Math.ceil((LIMITE_INACTIVIDAD_MS - sin) / 1000))
}

// Milisegundos sin actividad en CUALQUIER pestaña. Sin dato compartido, se cuenta desde `desde` (el último movimiento de esta pestaña).
export function tiempoSinActividad(desde, ahora = Date.now()) {
  const compartida = Number(leer(CLAVE_ACTIVIDAD))
  const ultima = Number.isFinite(compartida) && compartida > 0 ? Math.max(compartida, desde ?? 0) : (desde ?? ahora)
  return Math.max(0, ahora - ultima)
}

// La pestaña que cierra la sesión deja dicho por qué; las demás lo leen al enterarse (SIGNED_OUT) y dicen lo mismo.
export function guardarMotivoCierre(texto, ahora = Date.now()) {
  escribir(CLAVE_MOTIVO, JSON.stringify({ texto, en: ahora }))
}
export function leerMotivoCierre(ahora = Date.now()) {
  try {
    const m = JSON.parse(leer(CLAVE_MOTIVO) || 'null')
    if (m?.texto && ahora - m.en < VIGENCIA_MOTIVO_MS) return m.texto
  } catch { /* dato dañado: se ignora */ }
  return null
}

// Una llamada "anónima" lleva como token la clave pública de la aplicación (no el de una persona con sesión).
export function esLlamadaAnonima(authorization, claveAnonima) {
  const token = String(authorization || '').replace(/^Bearer\s+/i, '').trim()
  return !!claveAnonima && token === claveAnonima
}
