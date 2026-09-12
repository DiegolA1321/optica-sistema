"use client"

import { useRef, useState } from "react"
import { Upload, X } from "lucide-react"
import { supabase } from "../lib/supabaseClient"
import MiniaturaProducto from "./MiniaturaProducto"

// Subida de foto de producto (armazón/lente) — mismo patrón que subirLogo en
// PersonalizacionLogin.jsx (bucket público, path {optica_id}/{archivo}), acá
// reutilizado porque ahora hay tres formularios de alta de producto
// (Inventario, y las altas rápidas embebidas en Factura/Venta).
export default function CampoImagenProducto({ opticaId, valor, onCambio, label = "Foto del producto" }) {
  const inputRef = useRef(null)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState("")

  const subir = async (archivo) => {
    if (!archivo) return
    if (archivo.size > 3 * 1024 * 1024) { setError("La imagen no puede pesar más de 3 MB."); return }
    if (!supabase || !opticaId) { setError("No se pudo identificar la óptica para subir la imagen."); return }
    setError("")
    setSubiendo(true)
    const extension = archivo.name.split(".").pop()?.toLowerCase() || "jpg"
    const ruta = `${opticaId}/${Date.now()}.${extension}`
    const { error: errorSubida } = await supabase.storage.from("productos").upload(ruta, archivo, { upsert: true })
    if (errorSubida) {
      setSubiendo(false)
      setError("No se pudo subir la imagen. Intenta de nuevo.")
      return
    }
    const { data } = supabase.storage.from("productos").getPublicUrl(ruta)
    setSubiendo(false)
    onCambio(data.publicUrl)
  }

  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-slate-700">{label} <span className="normal-case text-slate-500">(opcional)</span></label>
      <div className="flex items-center gap-3">
        <MiniaturaProducto url={valor} size={56} />
        <div className="flex flex-1 flex-col gap-1">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={subiendo}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
            >
              <Upload size={13} /> {subiendo ? "Subiendo..." : valor ? "Cambiar foto" : "Subir foto"}
            </button>
            {valor && (
              <button
                type="button"
                onClick={() => onCambio(null)}
                aria-label="Quitar foto"
                className="flex items-center gap-1 rounded-lg border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
          </div>
          {error && <p className="text-[11px] font-medium text-red-600">{error}</p>}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => { subir(e.target.files?.[0]); e.target.value = "" }}
        />
      </div>
    </div>
  )
}
