import { INK } from "@/lib/tema"
import { iniciales } from "../../utilidades/marcaOptica"

export function Avatar({ nombre, foto, color, tamano = 48 }) {
  return foto ? (
    <img src={foto} alt="" className="shrink-0 rounded-full object-cover" style={{ width: tamano, height: tamano }} />
  ) : (
    <span className="grid shrink-0 place-items-center rounded-full text-base font-bold" aria-hidden="true" style={{ width: tamano, height: tamano, backgroundColor: color + "22", color }}>
      {iniciales(nombre) || "OP"}
    </span>
  )
}

// Quién atiende, en el paso «Fecha y hora»:
//   · 0 profesionales marcados → nada.
//   · 1 → franja «Te atiende {Nombre}» con su foto (iniciales si no hay) y «Optómetra · Reg. {registro}». Sin los datos del optómetra (no llegaron) no se muestra nada.
//   · 2 o más → fila «Profesional» con la lista («Cualquier optómetra disponible» y cada uno).
// `profesionales`: [{ id, nombre, registro, foto }] (el nombre puede faltar si los datos públicos no llegaron).
export default function BloqueProfesional({ profesionales, valor, onCambiar, color }) {
  if (profesionales.length === 0) return null
  if (profesionales.length === 1) {
    const p = profesionales[0]
    if (!p.nombre) return null
    return (
      <div className="flex items-center gap-4 rounded-2xl bg-slate-50 px-4 py-3.5" style={{ backgroundColor: color + "12" }}>
        <Avatar nombre={p.nombre} foto={p.foto} color={color} />
        <div className="min-w-0">
          <p className="truncate text-base font-bold" style={{ color: INK }}>Te atiende {p.nombre}</p>
          <p className="truncate text-sm text-slate-600">Optómetra{p.registro ? ` · Reg. ${p.registro}` : ""}</p>
        </div>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
      <label htmlFor="agendar-profesional" className="text-base font-bold" style={{ color: INK }}>Profesional</label>
      <select
        id="agendar-profesional"
        value={valor}
        onChange={(e) => onCambiar(e.target.value)}
        className="min-h-12 w-full cursor-pointer rounded-xl border border-slate-300 bg-white px-3.5 text-base outline-none transition-colors focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100 sm:w-auto sm:min-w-72"
        style={{ color: INK }}
      >
        <option value="">Cualquier optómetra disponible</option>
        {profesionales.map((p, i) => <option key={p.id} value={p.id}>{p.nombre || `Optómetra ${i + 1}`}</option>)}
      </select>
      <span className="text-sm text-slate-600">o elige a uno en particular</span>
    </div>
  )
}
