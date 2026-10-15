"use client"

// Piezas que comparten las cuatro pestañas de Ventas, para que se vean y se comporten igual (regla 18): la insignia de estado, el
// mensaje de una lista vacía con su acción y el encabezado de las columnas.

// El color solo comunica estado (regla 14): verde = en orden o terminado, ámbar = falta algo, rojo = urgente, azul = en curso, gris = cerrado.
const TONOS = {
  azul: "border-blue-200/60 bg-blue-50 text-blue-700",
  verde: "border-emerald-200/60 bg-emerald-50 text-emerald-700",
  ambar: "border-amber-200/60 bg-amber-50 text-amber-700",
  rojo: "border-red-200/60 bg-red-50 text-red-700",
  gris: "border-slate-200/60 bg-slate-100 text-slate-600",
}

export function Insignia({ tono = "gris", children, title, className = "" }) {
  return <span title={title} className={`inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONOS[tono]} ${className}`}>{children}</span>
}

// Una lista sin nada: qué pasa y qué se puede hacer desde ahí (regla 17). `children` es la acción.
export function Vacio({ Icono, titulo, texto, children }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-full bg-slate-50 text-slate-400"><Icono size={26} aria-hidden="true" /></div>
      <p className="text-base font-semibold text-slate-600">{titulo}</p>
      {texto && <p className="max-w-md text-sm text-slate-500">{texto}</p>}
      {children && <div className="mt-1">{children}</div>}
    </div>
  )
}

// Encabezado de las columnas de una lista: mismas columnas que sus filas. `plantilla` es la clase de columnas del grid (solo en pantallas anchas).
export function EncabezadoLista({ plantilla, etiquetas }) {
  return (
    <div aria-hidden="true" className={`hidden gap-x-3 border-b border-slate-100 bg-slate-50/70 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-500 lg:grid ${plantilla}`}>
      {etiquetas.map((e, i) => <span key={i} className={e.derecha ? "text-right" : ""}>{e.texto}</span>)}
    </div>
  )
}

// El contenedor de las filas: una sola tarjeta, con su encabezado de columnas y las filas separadas por una línea.
export function ContenedorLista({ etiqueta, encabezado = null, children }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
      {encabezado}
      <ul role="list" aria-label={etiqueta} className="divide-y divide-slate-100">{children}</ul>
    </div>
  )
}
