"use client"

import { createPortal } from "react-dom"
import { Plus } from "lucide-react"

// El botón «+» flotante del celular: arriba de la barra de abajo y de la barra del iPhone, a la derecha (y fuera de la muesca en horizontal).
// Va al <body> para que ningún contenedor con animación lo mueva; las ventanas (z-50) quedan encima.
export default function BotonFlotanteCelular({ etiqueta, onClick }) {
  return createPortal(
    <button type="button" onClick={onClick} aria-label={etiqueta} title={etiqueta}
      className="fixed z-40 grid h-14 w-14 cursor-pointer place-items-center rounded-full text-white shadow-lg"
      style={{ background: "linear-gradient(135deg,#22D3EE,#2563EB)", bottom: "calc(env(safe-area-inset-bottom) + 84px)", right: "max(1rem, env(safe-area-inset-right))", boxShadow: "0 12px 24px -8px rgba(37,99,235,0.55)" }}>
      <Plus size={28} aria-hidden="true" />
    </button>,
    document.body,
  )
}
