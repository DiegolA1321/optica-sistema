import { Eye } from "lucide-react"
import { degradadoMarca } from "../utilidades/marcaOptica"

// El logo de la óptica en todo el sistema: siempre entero (object-contain: ni deformado ni cortado), con un tamaño máximo y
// sobre un fondo blanco para que un PNG con transparencia o un SVG se lean bien. Sin logo, el ojo de marca sobre el degradado
// del color de la óptica. Un solo componente: cambiar el logo en Configuración lo cambia en todos los lugares que lo usan.
//   tamano: alto del cuadro en px (el logo cabe dentro, sin pasarse). ancho: "cuadrado" (por defecto) o "ancho" (hasta 3,2 veces el alto,
//   para logos horizontales en cabeceras).
export default function LogoOptica({ url, nombre = "", color, tamano = 44, ancho = "cuadrado", className = "", sinFondo = false }) {
  const maxAncho = ancho === "ancho" ? Math.round(tamano * 3.2) : tamano
  if (!url) {
    return (
      <span
        className={"grid shrink-0 place-items-center rounded-xl text-white " + className}
        style={{ width: tamano, height: tamano, background: degradadoMarca(color), boxShadow: "0 8px 24px -10px rgba(37,99,235,0.55)" }}
        aria-hidden="true"
      >
        <Eye size={Math.round(tamano * 0.5)} strokeWidth={2.2} />
      </span>
    )
  }
  return (
    <span
      className={"inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl " + (sinFondo ? "" : "bg-white ring-1 ring-slate-200/70 ") + className}
      style={{ height: tamano, minWidth: tamano, maxWidth: maxAncho, padding: Math.max(3, Math.round(tamano * 0.08)) }}
    >
      <img src={url} alt={nombre ? `Logo de ${nombre}` : "Logo"} className="block h-full w-auto max-w-full object-contain" draggable={false} />
    </span>
  )
}
