import { ChevronRight } from "lucide-react"
import BloqueProfesional from "./BloqueProfesional"
import ElegirDiaHora from "./ElegirDiaHora"
import { linkWhatsApp } from "../../utilidades/whatsapp"
import { INK } from "@/lib/tema"

// Paso 1 «Motivo, fecha y hora»: primero la disponibilidad. El motivo (con su duración), quién atiende, los próximos siete días y las horas libres.
// La hora elegida aquí NO se reserva hasta confirmar en el paso 2: si para entonces se ocupó, se avisa y se vuelve aquí con los horarios al día.
export default function PasoElegir({
  motivos, motivo, onMotivo, duracionMinutos, profesionales, profesionalId, onProfesional, aviso,
  disponibilidad, horasOcupadas, cargando, fecha, hora, onFecha, onHora, color, fondo, telefono, nombreOptica, onContinuar,
}) {
  return (
    <div className="ac-step space-y-6">
      <div>
        <p className="mb-2 text-base font-bold" style={{ color: INK }} id="agendar-motivo-titulo">¿Qué necesitas?</p>
        <div role="group" aria-labelledby="agendar-motivo-titulo" className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-2 lg:grid-cols-4">
          {motivos.map((m) => {
            const sel = motivo === m.titulo
            return (
              <button key={m.id} type="button" aria-pressed={sel} onClick={() => onMotivo(m.titulo)}
                className={"flex min-h-[4.5rem] flex-col justify-center rounded-xl border px-4 py-3 text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 " + (sel ? "bg-blue-50/70" : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50")}
                style={sel ? { borderColor: color, boxShadow: `0 0 0 1px ${color}` } : undefined}>
                <span className="text-base font-bold leading-snug" style={{ color: INK }}>{m.titulo}</span>
                <span className="mt-0.5 text-sm leading-snug text-slate-600">{[m.descripcion, duracionMinutos ? `${duracionMinutos} min` : ""].filter(Boolean).join(" · ")}</span>
              </button>
            )
          })}
        </div>
      </div>

      <BloqueProfesional profesionales={profesionales} valor={profesionalId} color={color} onCambiar={onProfesional} />

      {aviso && <p role="alert" className="rounded-xl bg-amber-50 px-4 py-3 text-base text-amber-900">{aviso}</p>}

      {cargando ? (
        <div className="animate-pulse space-y-4" aria-busy="true" aria-label="Cargando horarios">
          <div className="h-24 rounded-xl bg-slate-100" />
          <div className="h-36 rounded-xl bg-slate-100" />
        </div>
      ) : (
        <ElegirDiaHora disponibilidad={disponibilidad} citas={horasOcupadas} profesionalId={profesionalId || null} fecha={fecha} hora={hora} onCambiarFecha={onFecha} onCambiarHora={onHora} color={color} />
      )}

      <div className="flex flex-col-reverse gap-4 pt-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-base text-slate-600">
          {telefono && <>¿No encuentras una hora?{" "}
            <a href={linkWhatsApp(telefono, `Hola, no encuentro una hora disponible para una cita en ${nombreOptica}. ¿Me pueden ayudar?`)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center font-semibold hover:underline" style={{ color }}>Escríbenos por WhatsApp</a></>}
        </p>
        <button type="button" onClick={onContinuar} disabled={!fecha || !hora}
          className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-xl px-7 text-base font-bold text-white transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          style={{ background: fondo, boxShadow: "0 14px 28px -12px rgba(37,99,235,0.6)" }}>
          Continuar <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
