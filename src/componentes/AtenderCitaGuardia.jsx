"use client"

import { useState, useCallback } from "react"
import { Stethoscope, CalendarClock } from "lucide-react"
import { Cascaron } from "./AtencionPaciente"
import { hoyISO } from "../utilidades/disponibilidad"
import { formatoFecha } from "../utilidades/formatoFecha"
import { requiereConfirmarOtroDia } from "../utilidades/filtrosCitas"
import { siguienteCitaQueChoca } from "../utilidades/agendaCitas"

const BOTON_SECUNDARIO = "rounded-lg border border-slate-200/60 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer"
const BOTON_PRINCIPAL = "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer bg-gradient-to-br from-cyan-400 to-blue-600"

// «Atender» es el mismo botón en la Agenda, el detalle de la cita, el perfil del paciente y el Inicio, y se comporta igual en todos:
//   * cita de hoy → entra directo a la ficha;
//   * cita de otro día (el paciente llegó antes) → «Esta cita es del 24 de octubre. ¿Atenderla hoy?»; al confirmar, se mueve a hoy, a la hora actual;
//   * el paciente llegó tarde y la siguiente hora ya está agendada → «La siguiente cita (4:50 PM, Ana) ya está agendada» y se elige «Atender igual» o «Reagendar»;
//   * atención ya abierta («Seguir atendiendo») → directo.
// Uso: const { pedirAtender, dialogo } = useAtenderCita({ citas, duracionDefault, alAtender, alReagendar }); pedirAtender(cita) en el botón y {dialogo} en el árbol.
// `alReagendar` (opcional): abre la edición de esa cita; sin él, el aviso solo ofrece «Atender igual».
export function useAtenderCita({ citas = [], duracionDefault = 40, alAtender, alReagendar }) {
  const [paso, setPaso] = useState(null) // { tipo: "otroDia" | "choca", cita, siguiente? }

  const revisarChoque = useCallback((cita) => {
    const siguiente = siguienteCitaQueChoca(cita, citas, undefined, duracionDefault)
    if (siguiente) setPaso({ tipo: "choca", cita, siguiente })
    else { setPaso(null); alAtender(cita) }
  }, [citas, duracionDefault, alAtender])

  const pedirAtender = useCallback((cita) => {
    if (cita.estado === "En Atención") { alAtender(cita); return }
    if (requiereConfirmarOtroDia(cita, hoyISO())) { setPaso({ tipo: "otroDia", cita }); return }
    revisarChoque(cita)
  }, [alAtender, revisarChoque])

  const cerrar = () => setPaso(null)
  let dialogo = null
  if (paso?.tipo === "otroDia") {
    const dia = formatoFecha(paso.cita.fecha, "diaMes")
    dialogo = (
      <Cascaron titulo="Atender una cita de otro día" subtitulo={paso.cita.paciente} Icono={Stethoscope} ancho="max-w-md" capa="z-[70]" onCerrar={cerrar}
        pie={<>
          <span />
          <div className="ml-auto flex items-center gap-2">
            <button type="button" onClick={cerrar} className={BOTON_SECUNDARIO}>No</button>
            <button type="button" onClick={() => revisarChoque(paso.cita)} className={BOTON_PRINCIPAL}><Stethoscope size={14} aria-hidden="true" /> Atenderla hoy</button>
          </div>
        </>}
      >
        <div className="space-y-1 p-6 text-sm text-slate-600">
          <p className="font-semibold text-slate-800">Esta cita es del {dia}. ¿Atenderla hoy?</p>
          <p>La cita se moverá a hoy, a la hora actual.</p>
        </div>
      </Cascaron>
    )
  } else if (paso?.tipo === "choca") {
    const { siguiente, cita } = paso
    dialogo = (
      <Cascaron titulo="Hay una cita justo después" subtitulo={cita.paciente} Icono={CalendarClock} ancho="max-w-md" capa="z-[70]" onCerrar={cerrar}
        pie={<>
          <span />
          <div className="ml-auto flex items-center gap-2">
            {alReagendar && <button type="button" onClick={() => { cerrar(); alReagendar(cita) }} className={BOTON_SECUNDARIO}>Reagendar</button>}
            <button type="button" onClick={() => { cerrar(); alAtender(cita) }} className={BOTON_PRINCIPAL}><Stethoscope size={14} aria-hidden="true" /> Atender igual</button>
          </div>
        </>}
      >
        <div className="space-y-1 p-6 text-sm text-slate-600">
          <p className="font-semibold text-slate-800">La siguiente cita ({siguiente.hora}, {siguiente.paciente}) ya está agendada.</p>
          <p>Atender ahora a quien llegó tarde puede retrasarla.</p>
        </div>
      </Cascaron>
    )
  }
  return { pedirAtender, dialogo }
}
