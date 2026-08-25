"use client"

import { ClipboardCheck, User, Stethoscope, Glasses, CheckCircle2 } from "lucide-react"

// ─── Paleta de firma (consistente con el resto del sistema) ───
const INK = "#0E2B33"
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)"

// Paso de confirmación explícita antes de guardar una ficha clínica, para evitar
// guardados accidentales (la ficha queda fija en el historial del paciente y,
// si hay un producto vinculado, descuenta stock del inventario).
// Se monta por encima del formulario (no lo reemplaza), así que "Cancelar"
// solo cierra este paso y deja los datos ya escritos intactos.
export default function ConfirmarFichaModal({ paciente, diagnostico, lenteRecomendado, usaLentes, onCancelar, onConfirmar }) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 backdrop-blur-sm"
      style={{ backgroundColor: "rgba(14,43,51,0.55)" }}
      onClick={onCancelar}
    >
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-full text-white" style={{ background: GRAD }}>
          <ClipboardCheck size={22} />
        </div>
        <h2 className="text-lg font-bold" style={{ color: INK }}>¿Guardar esta ficha clínica?</h2>
        <p className="mt-1.5 text-sm text-slate-500">Revisa los datos antes de guardar. Quedará registrada en el historial del paciente.</p>

        <div className="mt-4 space-y-2.5 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
          {paciente && <FilaDato icon={User} label="Paciente" valor={paciente} />}
          <FilaDato icon={Stethoscope} label="Diagnóstico" valor={diagnostico} />
          {lenteRecomendado && <FilaDato icon={Glasses} label="Lente" valor={lenteRecomendado} />}
          {usaLentes && <FilaDato icon={CheckCircle2} label="¿Usa lentes?" valor={usaLentes === "si" ? "Sí" : "No"} />}
        </div>

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancelar}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirmar}
            className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer"
            style={{ background: GRAD }}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  )
}

function FilaDato({ icon: Icon, label, valor }) {
  return (
    <div className="flex items-center gap-2.5 text-sm">
      <Icon size={14} className="shrink-0 text-slate-500" />
      <span className="text-slate-500">{label}:</span>
      <span className="ml-auto truncate font-semibold" style={{ color: INK }}>{valor}</span>
    </div>
  )
}
