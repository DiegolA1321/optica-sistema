// Dominios propios del sistema (no de un cliente) — cuando el hostname es
// exactamente uno de estos (sin subdominio), estamos en la página de venta.
// Se completa el día que Diego compre un dominio real; mientras tanto no
// hace nada por sí solo, el query param de desarrollo cubre las pruebas.
const DOMINIOS_RAIZ = []

// Decide en qué "sitio" está la app: la página de venta del sistema, el
// login directo del superadministrador, o el sitio público de una óptica
// cliente (con o sin slug resuelto). Se evalúa en este orden:
//   1. Query param de desarrollo (?sitio=venta|admin, ?optica=<slug>) — para
//      probar los 3 modos en local sin tener un dominio real todavía.
//   2. Subdominio real del hostname, una vez exista un dominio configurado.
//   3. Fallback: modo 'optica' sin slug — el comportamiento de siempre.
export function resolverSitio() {
  const params = new URLSearchParams(window.location.search)
  const sitioParam = params.get('sitio')
  if (sitioParam === 'venta') return { modo: 'venta', slug: null }
  if (sitioParam === 'admin') return { modo: 'admin_sistema', slug: null }
  const opticaParam = params.get('optica')
  if (opticaParam) return { modo: 'optica', slug: opticaParam }

  const host = window.location.hostname
  const raiz = DOMINIOS_RAIZ.find((d) => host === d || host.endsWith('.' + d))
  if (raiz) {
    if (host === raiz) return { modo: 'venta', slug: null }
    const sub = host.slice(0, -(raiz.length + 1))
    if (sub === 'admin') return { modo: 'admin_sistema', slug: null }
    return { modo: 'optica', slug: sub }
  }

  return { modo: 'optica', slug: null }
}

// Navega a la política de privacidad/términos (App.jsx la muestra si detecta
// ?legal=...) conservando el resto de la query string (?sitio=..., ?optica=...)
// — un href estático la reemplazaría entera y perdería el contexto de la óptica.
export function irALegal(vista) {
  const url = new URL(window.location)
  url.searchParams.set('legal', vista)
  window.location.href = url.toString()
}
