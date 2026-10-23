"use client"

import { useState } from "react"
import { AlertTriangle } from "lucide-react"
import { Cascaron } from "./AtencionPaciente"
import { dejarDeAtenderCita, cambiosAlDejarDeAtender, destinoAlDejarDeAtender } from "../utilidades/atencionAbierta"
import { fechaLegible, horaSinCero } from "../utilidades/formatoFecha"
import { esErrorSinPermiso, MENSAJE_SIN_PERMISO } from "../utilidades/permisos"

// «Dejar de atender» una atención abierta (la usan el perfil del paciente, Citas, el Inicio y la ficha). La ventana dice lo que va a pasar, porque depende del día:
//   · el mismo día de la cita: vuelve a «En espera» (el paciente puede seguir ahí) y el borrador de la ficha se conserva;
//   · si el día ya pasó: queda «No efectuada» con el motivo «La atención se interrumpió» y pasa a «Contactar al paciente»; el borrador se conserva y la cita nueva lo hereda.
// Queda en el seguimiento de la cita (lo escribe el servidor). `alHecho(estado)` antes de cerrar (la ficha usa esto para salir).
export default function ConfirmarDejarDeAtender({ cita, setCitas, onCancelar, onHecho }) {
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState("")
  const destino = destinoAlDejarDeAtender(cita)
  const mismoDia = destino === "En Espera"

  const confirmar = async () => {
    setTrabajando(true)
    setError("")
    const r = await dejarDeAtenderCita(cita)
    if (r.error) {
      setError(esErrorSinPermiso(r.error) ? MENSAJE_SIN_PERMISO : "No se pudo dejar de atender. Revisa tu conexión e intenta de nuevo.")
      setTrabajando(false)
      return
    }
    if (r.yaNoEstaba) {
      setError("Esta cita ya no estaba en atención: alguien la cerró antes. Se actualizó la lista.")
      setCitas?.((prev) => prev.map((c) => (c.id === cita.id ? { ...c, estado: r.estado } : c)))
      setTrabajando(false)
      return
    }
    setCitas?.((prev) => prev.map((c) => (c.id === cita.id ? { ...c, ...cambiosAlDejarDeAtender(r.estado) } : c)))
    setTrabajando(false)
    onHecho?.(
      r.estado === "En Espera"
        ? `Dejaste de atender a ${cita.paciente}. Su cita vuelve a «En espera» y el borrador de la ficha se conserva.`
        : `Dejaste de atender a ${cita.paciente}. Su cita quedó «No efectuada» y pasó a «Contactar al paciente»; el borrador de la ficha se conserva.`,
      r.estado,
    )
  }

  return (
    <Cascaron
      titulo="¿Dejar de atender?"
      subtitulo={`${cita.paciente} · cita del ${fechaLegible(cita.fecha) || "—"}${cita.hora ? `, ${horaSinCero(cita.hora)}` : ""}`}
      Icono={AlertTriangle}
      ancho="max-w-md"
      onCerrar={() => { if (!trabajando) onCancelar() }}
      pie={<>
        <span />
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={onCancelar} disabled={trabajando} className="rounded-lg border border-slate-200/60 px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50">Seguir atendiendo</button>
          <button type="button" onClick={confirmar} disabled={trabajando} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-900 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50">
            {trabajando ? "Guardando…" : "Sí, dejar de atender"}
          </button>
        </div>
      </>}
    >
      <div className="space-y-3 p-6 text-sm text-slate-600">
        <p className="font-semibold text-slate-800">Esto es lo que va a pasar:</p>
        {mismoDia ? (
          <ul className="list-disc space-y-1.5 pl-5">
            <li>La cita vuelve a <strong>«En espera»</strong>: el paciente puede seguir en la sala.</li>
            <li>El <strong>borrador de la ficha se conserva</strong>: puedes retomarlo con «Seguir atendiendo» o «Atender».</li>
            <li>Queda anotado en el seguimiento de la cita.</li>
          </ul>
        ) : (
          <ul className="list-disc space-y-1.5 pl-5">
            <li>La cita ya es de un día anterior, así que queda <strong>«No efectuada»</strong> con el motivo «La atención se interrumpió».</li>
            <li>Pasa a <strong>«Contactar al paciente»</strong> (Inicio y Citas) para reagendarla; la cita nueva hereda el borrador de la ficha.</li>
            <li>Queda anotado en el seguimiento de la cita.</li>
          </ul>
        )}
        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-semibold text-red-700">{error}</p>}
      </div>
    </Cascaron>
  )
}
