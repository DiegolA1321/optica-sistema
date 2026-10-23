import { INK } from "@/lib/tema"

// Resumen de la cita: una franja horizontal arriba del formulario (motivo, profesional, fecha y hora, paciente). Lo que aún no se eligió dice «Por completar» en gris.
// En celular las cuatro casillas se apilan en dos columnas y luego en una.
export default function ResumenCita({ items }) {
  return (
    <dl className="grid grid-cols-1 overflow-hidden rounded-2xl border border-slate-200 bg-white min-[520px]:grid-cols-2 lg:grid-cols-4" style={{ boxShadow: "0 18px 40px -30px rgba(14,43,51,0.25)" }} aria-label="Resumen de tu cita" data-resumen-cita>
      {items.map(({ etiqueta, valor }) => (
        <div key={etiqueta} className="min-w-0 border-t border-slate-200 px-5 py-3.5 first:border-t-0 min-[520px]:[&:nth-child(2)]:border-t-0 lg:border-l lg:border-t-0 lg:first:border-l-0">
          <dt className="text-xs font-bold uppercase tracking-[0.12em] text-slate-600">{etiqueta}</dt>
          <dd className={"mt-0.5 break-words text-lg font-bold leading-snug " + (valor ? "" : "text-slate-400")} style={valor ? { color: INK } : undefined}>{valor || "Por completar"}</dd>
        </div>
      ))}
    </dl>
  )
}
