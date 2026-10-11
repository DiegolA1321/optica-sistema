"use client"

import { CalendarCheck, User, Stethoscope, CalendarDays, Clock } from "lucide-react"
import FilaDato from "./FilaDato"
import { Cascaron } from "./AtencionPaciente"

const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)"

// Paso de confirmación explícita antes de guardar una cita, para evitar
// agendamientos accidentales por un clic de más sobre fecha/hora ya elegidas.
// Se monta por encima del formulario de agendar (no lo reemplaza), así que
// "Cancelar" solo cierra este paso y deja los datos ya escritos intactos.
// Usa la ventana estándar (regla 43); `capa` z-[70] la deja sobre el formulario.
export default function ConfirmarCitaModal({ paciente, motivo, fecha, hora, onCancelar, onConfirmar, guardando = false, error = "", etiquetaConfirmar = "Confirmar", etiquetaCancelar = "Cancelar", titulo = "¿Confirmar esta cita?", subtitulo = "Revisa los datos antes de agendar." }) {
  const cerrar = () => { if (!guardando) onCancelar() }

  return (
    <Cascaron
      titulo={titulo}
      subtitulo={subtitulo}
      Icono={CalendarCheck}
      ancho="max-w-md"
      capa="z-[70]"
      onCerrar={cerrar}
      pie={<>
        <span />
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={onCancelar} disabled={guardando} className="rounded-lg border border-slate-200/60 px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50">{etiquetaCancelar}</button>
          <button type="button" onClick={onConfirmar} disabled={guardando} className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer disabled:cursor-not-allowed disabled:opacity-70" style={{ background: GRAD }}>
            {guardando ? "Guardando..." : etiquetaConfirmar}
          </button>
        </div>
      </>}
    >
      <div className="p-6">
        <div className="space-y-2.5 rounded-xl border border-slate-100 bg-slate-50/60 p-3.5">
          {paciente && <FilaDato icon={User} label="Paciente" valor={paciente} />}
          <FilaDato icon={Stethoscope} label="Motivo" valor={motivo} />
          <FilaDato icon={CalendarDays} label="Fecha" valor={fecha} />
          <FilaDato icon={Clock} label="Hora" valor={hora} />
        </div>
        {error && (
          <p role="alert" className="mt-3 rounded-lg border border-red-200/60 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{error}</p>
        )}
      </div>
    </Cascaron>
  )
}
