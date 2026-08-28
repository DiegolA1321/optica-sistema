import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import App from './App.jsx'
import PantallaError from './paginas/PantallaError.jsx'
import './index.css' // <-- ¡Esta línea es la que activa la magia!

// Monitoreo de errores en producción — reporta excepciones no capturadas y
// promesas rechazadas sin manejar, con el stack trace completo, sin que un
// usuario tenga que avisar que algo se rompió. Solo error monitoring, sin
// tracing/session replay (no se activaron en el proyecto de Sentry, y no
// hace falta más para esto). Silenciosamente no hace nada si falta el DSN
// (VITE_SENTRY_DSN) o en desarrollo — mismo patrón que supabaseClient.js.
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: import.meta.env.MODE,
    enabled: import.meta.env.PROD,
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Sentry.ErrorBoundary fallback={<PantallaError />}>
      <App />
    </Sentry.ErrorBoundary>
  </React.StrictMode>,
)