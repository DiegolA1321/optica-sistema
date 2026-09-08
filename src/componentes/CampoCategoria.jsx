"use client"

import { useState } from "react"
import { Plus } from "lucide-react"

const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)" // cian → azul

// Selector de categoría con creación rápida inline — caso de la reunión con
// el ing: poder crear una categoría nueva sin salir del flujo de registrar
// (o editar) un producto, en vez de obligar a ir antes a Configuración.
// Compartido entre Inventario.jsx y VentaProductoModal.jsx (alta rápida de
// producto desde el flujo de venta).
export default function CampoCategoria({ valor, onChange, categorias, setCategorias }) {
  const [creando, setCreando] = useState(false)
  const [nueva, setNueva] = useState("")

  const confirmar = () => {
    const v = nueva.trim()
    if (!v) { setCreando(false); return }
    if (!categorias.includes(v)) setCategorias?.([...categorias, v])
    onChange(v)
    setNueva("")
    setCreando(false)
  }

  if (creando) {
    return (
      <div className="flex gap-2">
        <input
          autoFocus
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmar() } if (e.key === "Escape") setCreando(false) }}
          placeholder="Nombre de la categoría"
          className="flex-1 rounded-xl border border-blue-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500"
        />
        <button type="button" onClick={confirmar} className="shrink-0 rounded-xl px-3 text-sm font-semibold text-white cursor-pointer" style={{ background: GRAD }}>
          Crear
        </button>
        <button type="button" onClick={() => setCreando(false)} className="shrink-0 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-500 cursor-pointer">
          Cancelar
        </button>
      </div>
    )
  }

  return (
    <div className="flex gap-2">
      <select value={valor} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-500 focus:bg-white">
        {categorias.map((c) => (<option key={c} value={c}>{c}</option>))}
      </select>
      {setCategorias && (
        <button type="button" onClick={() => setCreando(true)} title="Nueva categoría" aria-label="Nueva categoría"
          className="shrink-0 rounded-xl border border-slate-200 px-3 text-slate-500 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 cursor-pointer">
          <Plus size={16} />
        </button>
      )}
    </div>
  )
}
