// Enlace de Google Maps de la óptica: la óptica solo pega el enlace de «Compartir» y la página pública muestra el mapa y «Cómo llegar».
// Un enlace corto (maps.app.goo.gl/…) no se puede leer desde el navegador: /api/resolver-mapa lo abre en el servidor y devuelve la dirección larga,
// de la que salen el nombre del lugar y las coordenadas. Lo guardado en la parametrización: opticaMapaUrl (el enlace pegado), opticaMapaNombre, opticaMapaLat y opticaMapaLng.

const HOSTS_CORTOS = ["maps.app.goo.gl", "goo.gl"]
const HOSTS_LARGOS = ["www.google.com", "google.com", "maps.google.com"]

function comoUrl(texto) {
  try {
    const u = new URL(String(texto || "").trim())
    return u.protocol === "https:" ? u : null
  } catch {
    return null
  }
}

// ¿Es un enlace de Google Maps (corto o largo)? Solo https y solo esos dominios.
export function esEnlaceMapa(texto) {
  const u = comoUrl(texto)
  if (!u) return false
  if (HOSTS_CORTOS.includes(u.hostname)) return u.hostname === "maps.app.goo.gl" || u.pathname.startsWith("/maps")
  return HOSTS_LARGOS.includes(u.hostname) && u.pathname.startsWith("/maps")
}

export const esEnlaceMapaCorto = (texto) => HOSTS_CORTOS.includes(comoUrl(texto)?.hostname)

const numero = (v) => (Number.isFinite(Number(v)) ? Number(v) : null)
const coordenadasValidas = (lat, lng) => lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180

// De una dirección larga de Google Maps: { nombre, lat, lng } (o null si no trae coordenadas).
// Prefiere las coordenadas exactas del lugar (!3d…!4d…) a las del centro de la vista (@lat,lng).
export function datosDeEnlaceMapa(texto) {
  const u = comoUrl(texto)
  if (!u || !HOSTS_LARGOS.includes(u.hostname)) return null
  const ruta = decodeURIComponent(u.pathname.replace(/\+/g, " "))
  const exacta = /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/.exec(u.pathname + u.search + (u.hash || ""))
  const vista = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/.exec(ruta)
  const consulta = /^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/.exec(u.searchParams.get("q") || u.searchParams.get("query") || "")
  const par = exacta || vista || consulta
  const lat = numero(par?.[1]), lng = numero(par?.[2])
  if (!coordenadasValidas(lat, lng)) return null
  const lugar = /\/maps\/place\/([^/@]+)/.exec(ruta)
  return { nombre: lugar ? lugar[1].trim() : "", lat, lng }
}

// Lo que se guarda en la parametrización (vacío = sin mapa por enlace).
export const MAPA_VACIO = { opticaMapaUrl: "", opticaMapaNombre: "", opticaMapaLat: null, opticaMapaLng: null }

// Lee lo guardado: { url, nombre, lat, lng } o null si no hay un enlace con coordenadas.
export function mapaGuardado(settings) {
  const url = typeof settings?.opticaMapaUrl === "string" ? settings.opticaMapaUrl.trim() : ""
  const lat = numero(settings?.opticaMapaLat), lng = numero(settings?.opticaMapaLng)
  if (!url || !coordenadasValidas(lat, lng) || !esEnlaceMapa(url)) return null
  return { url, nombre: typeof settings.opticaMapaNombre === "string" ? settings.opticaMapaNombre.trim() : "", lat, lng }
}

export const urlMapaIncrustado = ({ lat, lng }) => `https://www.google.com/maps?q=${lat},${lng}&z=17&output=embed`

// Resuelve el enlace pegado a lo que se guarda. Lanza Error con un mensaje para mostrar a la persona.
// `resolver(url)` devuelve la dirección larga (por defecto, /api/resolver-mapa); se puede inyectar en las pruebas.
export async function resolverEnlaceMapa(texto, resolver = resolverEnElServidor) {
  const pegado = String(texto || "").trim()
  if (!esEnlaceMapa(pegado)) throw new Error("Ese no parece un enlace de Google Maps. En Google Maps toca «Compartir» y copia el enlace.")
  let larga = pegado
  if (esEnlaceMapaCorto(pegado)) {
    try { larga = await resolver(pegado) } catch { throw new Error("No se pudo abrir el enlace. Revisa tu conexión e intenta de nuevo.") }
  }
  const datos = datosDeEnlaceMapa(larga)
  if (!datos) throw new Error("No se pudo ubicar el lugar con ese enlace. Busca tu óptica en Google Maps y copia el enlace de «Compartir».")
  return { opticaMapaUrl: pegado, opticaMapaNombre: datos.nombre, opticaMapaLat: datos.lat, opticaMapaLng: datos.lng }
}

async function resolverEnElServidor(url) {
  const r = await fetch(`/api/resolver-mapa?url=${encodeURIComponent(url)}`)
  if (!r.ok) throw new Error("resolver-mapa " + r.status)
  const { url: larga } = await r.json()
  if (typeof larga !== "string") throw new Error("respuesta sin dirección")
  return larga
}
