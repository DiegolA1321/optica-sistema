"use client"

import { Image as ImageIcon } from "lucide-react"

// Miniatura de producto reutilizada en Inventario, en el buscador de lente
// recomendado de la Ficha Clínica y en los ítems de Venta/Factura — un solo
// componente para no repetir el placeholder "sin foto" en cada lista.
export default function MiniaturaProducto({ url, alt = "", size = 32, className = "" }) {
  const dim = `${size}px`
  if (!url) {
    return (
      <span
        className={"grid shrink-0 place-items-center rounded-lg border border-slate-200 bg-slate-100 text-slate-300 " + className}
        style={{ width: dim, height: dim }}
      >
        <ImageIcon size={Math.round(size * 0.5)} />
      </span>
    )
  }
  return (
    <img
      src={url}
      alt={alt}
      className={"shrink-0 rounded-lg border border-slate-200 object-cover " + className}
      style={{ width: dim, height: dim }}
    />
  )
}
