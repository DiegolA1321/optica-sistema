import React from "react"
import { AlertTriangle, RotateCw } from "lucide-react"

const INK = "#0E2B33"
const PORCELAIN = "#F7F5F0"
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)"

// Fallback del Sentry.ErrorBoundary que envuelve <App /> (ver main.jsx) — sin
// esto, un error de render sin manejar dejaba al usuario con una pantalla en
// blanco, sin ninguna pista de qué pasó ni qué hacer.
export default function PantallaError() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6" style={{ backgroundColor: PORCELAIN }}>
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-100 text-red-600">
          <AlertTriangle size={28} />
        </div>
        <h1 className="mt-4 font-serif text-xl font-bold" style={{ color: INK }}>Algo salió mal</h1>
        <p className="mt-2 text-sm text-slate-500">
          Encontramos un error inesperado. Ya quedó registrado para revisarlo — intenta recargar la página.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 cursor-pointer"
          style={{ background: GRAD, boxShadow: "0 14px 28px -12px rgba(37,99,235,0.6)" }}
        >
          <RotateCw size={16} /> Recargar página
        </button>
      </div>
    </div>
  )
}
