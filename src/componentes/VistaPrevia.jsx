"use client"

import { Eye } from "lucide-react"

// Una vista previa se ve claramente como una MUESTRA, no como la pantalla real: fondo y borde distintos (punteado), la etiqueta «Vista previa» y, si trae
// botones, atenuados, sin efecto al pasar el cursor y con un texto que dice quién podrá usarlos. Es la misma regla para toda vista previa del sistema
// (lo que verá el administrador al recibir una ayuda, lo que verá una persona con sus roles, lo que verá con un rol…).
//   nombre: el nombre accesible de la sección (por defecto «Vista previa»); leyenda: qué se está mostrando («Así lo verá el administrador»).
export default function VistaPrevia({ nombre = "Vista previa", leyenda, children, as: Raiz = "section", className = "" }) {
  return (
    <Raiz aria-label={nombre} className={"rounded-2xl border-2 border-dashed border-slate-300 bg-slate-100/80 p-3.5 " + className}>
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 rounded-md bg-slate-200 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-slate-600"><Eye size={12} aria-hidden="true" /> Vista previa</span>
        {leyenda && <span className="text-xs font-semibold text-slate-600">{leyenda}</span>}
      </div>
      {children}
    </Raiz>
  )
}

export const textoBotonDeMuestra = (quien = "El administrador") => `${quien} podrá usar este botón`

// Un botón de muestra: se ve como el real pero atenuado; no se pulsa, no reacciona al cursor y su texto dice quién podrá usarlo.
export function BotonDeMuestra({ children, principal = false, quien = "El administrador" }) {
  return (
    <span aria-disabled="true" title={textoBotonDeMuestra(quien)} className={"inline-flex cursor-default select-none items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold opacity-50 " + (principal ? "bg-blue-600 text-white" : "border border-slate-300 bg-white text-slate-700")}>
      {children}
    </span>
  )
}

// Un elemento de menú o una etiqueta de una muestra (lo que se verá en el menú): atenuado y sin sombra, para que no parezca un control real.
export function EtiquetaDeMuestra({ children }) {
  return <span title="Así se verá en el menú" className="cursor-default select-none rounded-full border border-dashed border-slate-300 bg-white/60 px-2.5 py-1 text-xs font-semibold text-slate-600 opacity-80">{children}</span>
}
