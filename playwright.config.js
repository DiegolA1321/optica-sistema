// Pruebas de extremo a extremo contra la Óptica Demo. Las credenciales se leen de .env.test
// (excluido de git) y nunca se escriben en el código ni en reportes, trazas o capturas.
import { defineConfig } from '@playwright/test'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.test', quiet: true })
// Solo para las claves públicas VITE_SUPABASE_* (las pruebas de la base las necesitan).
dotenv.config({ path: '.env.local', quiet: true })

const PUERTO = process.env.E2E_PUERTO || '5174'
const BASE = `http://localhost:${PUERTO}`

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  workers: 1,
  fullyParallel: false,
  reporter: [['list']],
  // Sin trazas, videos ni capturas automáticas: podrían contener lo que se escribe en los campos de contraseña.
  use: {
    baseURL: BASE,
    viewport: { width: 1366, height: 768 },
    trace: 'off',
    video: 'off',
    screenshot: 'off',
    locale: 'es-EC',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: {
    // Con E2E_PREVIEW=1 se prueba la versión de producción (build + preview): sin StrictMode ni el servidor de desarrollo.
    command: process.env.E2E_PREVIEW ? `npm run build && npm run preview -- --port ${PUERTO} --strictPort` : `npm run dev -- --port ${PUERTO} --strictPort`,
    url: BASE,
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
