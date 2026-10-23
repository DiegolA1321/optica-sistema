import { Check } from "lucide-react"
import { INK } from "@/lib/tema"

const PASOS = ["Motivo, fecha y hora", "Tus datos", "Listo"]

// Los tres pasos del agendamiento: círculo numerado (✓ al completarse) unido por una línea del color de la óptica.
// En celular solo se lee el nombre del paso actual para que quepan los tres círculos.
export default function PasosAgendar({ paso, color }) {
  return (
    <ol className="flex items-center" aria-label="Pasos para solicitar tu cita">
      {PASOS.map((nombre, i) => {
        const num = i + 1
        const hecho = paso > num || paso === 3
        const actual = paso === num
        return (
          <li key={nombre} className={"flex items-center " + (i < PASOS.length - 1 ? "min-w-0 flex-1" : "")} aria-current={actual ? "step" : undefined}>
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold"
              style={hecho || actual ? { backgroundColor: color, color: "#fff" } : { backgroundColor: "#e2e8f0", color: "#64748b" }}
            >
              {hecho ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : num}
            </span>
            <span className={"ml-2.5 whitespace-nowrap text-sm font-semibold " + (actual ? "" : "hidden sm:inline ") + (hecho || actual ? "" : "text-slate-500")} style={hecho || actual ? { color: INK } : undefined}>
              {nombre}
            </span>
            {i < PASOS.length - 1 && (
              <span aria-hidden="true" className="mx-3 h-0.5 min-w-4 flex-1 rounded-full" style={{ backgroundColor: paso > num ? color : "rgba(14,43,51,0.12)" }} />
            )}
          </li>
        )
      })}
    </ol>
  )
}
