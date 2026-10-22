"use client"

import { useState } from "react"
import { createPortal } from "react-dom"
import { Cascaron } from "./AtencionPaciente"
import { Plus } from "lucide-react"

const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)" // cian → azul

// Selector de categoría con creación rápida inline — caso de la reunión con
// el ing: poder crear una categoría nueva sin salir del flujo de registrar
// (o editar) un producto, en vez de obligar a ir antes a Configuración.
// Compartido entre Inventario.jsx y ComprobanteVentaModal.jsx (alta rápida de
// producto desde el flujo de venta).
export default function CampoCategoria({ valor, onChange, categorias, setCategorias }) {
  const [creando, setCreando] = useState(false)
  const [nueva, setNueva] = useState("")
  const [error, setError] = useState("")


  const cerrar = () => { setCreando(false); setNueva(""); setError("") }
  const confirmar2 = () => {
    const v = nueva.trim()
    if (!v) { setError("Escribe el nombre de la categoría."); return }
    if (categorias.some((x) => x.toLowerCase() === v.toLowerCase())) { setError("Ya existe esa categoría."); return }
    setCategorias?.([...categorias, v])
    onChange(v)
    cerrar()
  }

  return (
    <div className="flex gap-2">
      <select value={valor} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus-visible:border-blue-500 focus-visible:bg-white">
        {categorias.map((c) => (<option key={c} value={c}>{c}</option>))}
      </select>
      {setCategorias && (
        <button type="button" onClick={() => setCreando(true)} title="Nueva categoría" aria-label="Nueva categoría"
          className="shrink-0 rounded-xl border border-slate-200/60 px-3 text-slate-500 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600 cursor-pointer">
          <Plus size={16} />
        </button>
      )}
      {/* Una ventanita propia (fuera del formulario del producto, para no anidar formularios ni empujar sus campos). */}
      {creando && createPortal(
        <Cascaron titulo="Nueva categoría" subtitulo="Aparece en el inventario y en las ventas" Icono={Plus} ancho="max-w-sm" capa="z-[60]" onCerrar={cerrar}
          pie={<><span /><div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={cerrar} className="rounded-xl border border-slate-200/60 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">Cancelar</button>
            <button type="button" onClick={confirmar2} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110 cursor-pointer" style={{ background: GRAD }}>Crear</button>
          </div></>}>
          <div className="p-6">
            <label htmlFor="categoria-nueva" className="mb-1.5 block text-sm font-semibold text-slate-600">Nombre de la categoría</label>
            <input id="categoria-nueva" autoFocus value={nueva} onChange={(e) => { setNueva(e.target.value); setError("") }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); confirmar2() } }}
              placeholder="Ej. Lentes de contacto" className="w-full rounded-xl border border-slate-200/60 bg-white px-3.5 py-2.5 text-sm outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100" />
            {error && <p role="alert" className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}
          </div>
        </Cascaron>, document.body)}
    </div>
  )
}
