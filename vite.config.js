import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Ciberseguridad: agrega el header Content-Security-Policy solo al build de
// producción (no en `vite dev`), porque el HMR de Vite/React Refresh en
// desarrollo depende de un <script> inline y de eval() que una CSP estricta
// bloquearía. El build de producción no tiene ninguno de los dos, así que
// puede ir sin 'unsafe-inline'/'unsafe-eval' en script-src.
function cspEnBuild() {
  return {
    name: 'csp-en-build',
    apply: 'build',
    transformIndexHtml(html) {
      // connect-src incluye *.sentry.io (todas las regiones de ingesta,
      // recomendación oficial de Sentry para CSP) — sin esto, el navegador
      // bloquea en silencio el envío de errores al monitoreo de Sentry.
      const csp = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.sentry.io; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self';"
      return html.replace(
        '<head>',
        `<head>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    cspEnBuild(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: false,
    // Con HORA_SIMULADA (una fecha ISO en UTC) el reloj de las pruebas se fija en ese instante: ver scripts/probar-zonas-y-horas.mjs.
    setupFiles: ['./src/test-setup.js', ...(process.env.HORA_SIMULADA ? ['./src/test-reloj.js'] : [])],
    // Las pruebas de pantalla (ConsultaMedica, Inicio, Ventas...) renderizan árboles grandes en jsdom: solas tardan 0,3-2,5 s,
    // pero con todos los archivos en paralelo (o con el servidor de desarrollo abierto) llegan a 7 s y el límite por defecto
    // de 5 s las marcaba como fallidas al azar. Una prueba síncrona no se interrumpe: el límite solo decide si falla al terminar.
    testTimeout: 20000,
    hookTimeout: 20000,
    // Las pruebas de e2e/ son de Playwright, no de Vitest.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
})