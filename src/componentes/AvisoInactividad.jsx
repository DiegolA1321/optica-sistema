import { Clock } from "lucide-react"
import { Cascaron } from "./AtencionPaciente"

// «¿Sigues ahí?»: un minuto antes de cerrar la sesión por inactividad (utilidades/sesionPestanas.js). Solo «Seguir conectado» reinicia el tiempo.
export default function AvisoInactividad({ segundos, onSeguir }) {
  const mm = String(Math.floor(segundos / 60)).padStart(2, "0")
  const ss = String(segundos % 60).padStart(2, "0")
  return (
    <Cascaron
      titulo="¿Sigues ahí?"
      subtitulo="Tu sesión se cerrará por seguridad"
      ancho="max-w-md"
      onCerrar={onSeguir}
      Icono={Clock}
      capa="z-[70]"
      pie={<button type="button" autoFocus onClick={onSeguir} className="h-10 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white transition-colors hover:bg-blue-700">Seguir conectado</button>}
    >
      <div role="alertdialog" aria-live="polite" className="px-6 py-5 text-center">
        <p className="text-4xl font-bold tabular-nums text-slate-900" aria-label={`Quedan ${segundos} segundos`}>{mm}:{ss}</p>
        <p className="mt-2 text-sm text-slate-600">Por tu seguridad, la sesión se cierra sola si no hay actividad. Si estás en una ficha clínica, tu borrador se guarda antes de cerrar.</p>
      </div>
    </Cascaron>
  )
}
