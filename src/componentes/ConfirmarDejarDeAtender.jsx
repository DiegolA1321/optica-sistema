"use client"

import { useState } from "react"
import ConfirmarEliminarModal from "./ConfirmarEliminarModal"
import { dejarDeAtenderCita, diasAtencionAbierta } from "../utilidades/atencionAbierta"
import { registrarLog } from "../utilidades/logs"

// Confirmación para dejar de atender una cita que quedó "En atención" (sin
// tener abierta su ficha): la cita vuelve a Pendiente. La usan el perfil del
// paciente, Citas e Inicio.
export default function ConfirmarDejarDeAtender({ cita, usuario, setCitas, onCancelar, onHecho }) {
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState("")
  const antigua = diasAtencionAbierta(cita) !== null

  const confirmar = async () => {
    setTrabajando(true)
    setError("")
    const { error: errorUpdate } = await dejarDeAtenderCita(cita)
    if (errorUpdate) {
      setError("No se pudo dejar de atender. Revisa tu conexión e intenta de nuevo.")
      setTrabajando(false)
      return
    }
    setCitas?.((prev) => prev.map((c) => (c.id === cita.id ? { ...c, estado: "Pendiente", atendidoPor: null } : c)))
    registrarLog(usuario, "citas", "Dejó de atender una cita abierta", cita.paciente)
    setTrabajando(false)
    onHecho?.(antigua ? `La cita de ${cita.paciente} volvió a pendiente; como su fecha ya pasó, el sistema la marcará como No asistió.` : `Dejaste de atender a ${cita.paciente}. La cita sigue agendada.`)
  }

  return (
    <ConfirmarEliminarModal
      titulo="¿Dejar de atender?"
      mensaje={`La cita de ${cita.paciente} vuelve a pendiente y deja de figurar como en atención.${antigua ? " Como su fecha ya pasó, el sistema la marcará como No asistió." : ""}${error ? " " + error : ""}`}
      etiquetaConfirmar="Sí, dejar de atender"
      eliminando={trabajando}
      onCancelar={onCancelar}
      onConfirmar={confirmar}
    />
  )
}
