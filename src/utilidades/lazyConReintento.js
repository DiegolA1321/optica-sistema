import { lazy } from "react"

// Cada redeploy en Vercel borra los archivos JS de la build anterior. Una
// pestaña que ya estaba abierta (o que carga justo durante el corte) sigue
// teniendo el index.html viejo, que apunta a los nombres de archivo de esa
// build — el import() de un módulo lazy() falla con un 404 real, sin
// relación con un bug de la app, y el ErrorBoundary de Sentry lo atrapaba
// como cualquier otro crash: pantalla de "Algo salió mal" en vez de
// simplemente refrescar con la versión nueva. Reintentar una sola vez con
// una recarga completa (marcada en sessionStorage para no entrar en loop si
// el error sí es real) resuelve el caso común sin esconder errores genuinos.
export function lazyConReintento(importador, nombre) {
  return lazy(async () => {
    try {
      return await importador()
    } catch (error) {
      const clave = `chunk-reintento-${nombre}`
      if (!sessionStorage.getItem(clave)) {
        sessionStorage.setItem(clave, "1")
        window.location.reload()
        return new Promise(() => {}) // se queda "cargando" — la página ya se está recargando
      }
      throw error
    }
  })
}
