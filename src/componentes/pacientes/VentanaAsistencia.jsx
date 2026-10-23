"use client"

import { useEffect, useState } from "react"
import { CalendarCheck } from "lucide-react"
import { Cascaron } from "../AtencionPaciente"
import { asistenciaDeCitas } from "../../utilidades/cicloCitas"
import { leerEventosDeCitas } from "../../utilidades/eventosCita"
import { motivoDeLaCita } from "../../utilidades/contactarPaciente"
import { useContactosDelPaciente } from "../../utilidades/contactosPaciente"
import { CANALES, ETIQUETA_MOTIVO } from "../../utilidades/crmContactos"
import { fechaLegible, horaSinCero } from "../../utilidades/formatoFecha"
import { diaDeRegistro } from "../../utilidades/periodoLista"
import { etiquetaMiembro } from "../../utilidades/equipo"

// El detalle de «Asistencia a sus citas»: sus citas agrupadas por estado (atendidas, no efectuadas, canceladas y pendientes), el motivo de cada no efectuada y de cada cancelación, los contactos que
// ya se le hicieron desde el CRM (fecha, quién y motivo) y «Contactar» (la misma ventana de todo el sistema).
const GRUPOS = [
  { id: "atendidas", titulo: "Atendidas", estados: ["Atendida"], punto: "bg-emerald-600" },
  { id: "noEfectuadas", titulo: "No efectuadas", estados: ["No Asistió"], punto: "bg-red-600", conMotivo: true },
  { id: "canceladas", titulo: "Canceladas", estados: ["Cancelada"], punto: "bg-slate-400", conMotivo: true },
  { id: "pendientes", titulo: "Pendientes", estados: ["Pendiente", "En Espera", "En Atención"], punto: "bg-amber-600" },
]
const porFechaDesc = (a, b) => (a.fecha !== b.fecha ? (a.fecha < b.fecha ? 1 : -1) : String(b.hora || "").localeCompare(String(a.hora || "")))

export default function VentanaAsistencia({ paciente, citas = [], equipo = [], onContactar, onCerrar }) {
  const resumen = asistenciaDeCitas(citas)
  const contactos = useContactosDelPaciente(paciente?.id)
  // El motivo de cada no efectuada y de cada cancelación sale del seguimiento de la cita (lo guarda la base); sin él, se dice lo que se sabe por su estado.
  const [seguimiento, setSeguimiento] = useState(() => new Map())
  const clave = citas.filter((c) => c.estado === "No Asistió" || c.estado === "Cancelada").map((c) => c.id).join(",")
  useEffect(() => {
    if (!clave) return undefined
    let vivo = true
    leerEventosDeCitas(clave.split(",")).then((eventos) => {
      if (!vivo) return
      const m = new Map()
      for (const e of eventos) if ((e.tipo === "no_efectuada" || e.tipo === "cancelada") && e.datos?.motivo) m.set(e.citaId, { motivo: e.datos.motivo })
      setSeguimiento(m)
    })
    return () => { vivo = false }
  }, [clave])
  return (
    <Cascaron titulo="Asistencia a sus citas" subtitulo={resumen.resueltas > 0 ? `${resumen.atendidas} de ${resumen.resueltas} citas atendidas (${resumen.porcentaje} %) · ${paciente?.nombre || ""}` : paciente?.nombre} Icono={CalendarCheck} ancho="max-w-2xl" onCerrar={onCerrar} etiqueta="Asistencia a sus citas"
      pie={<>{onContactar ? <button type="button" onClick={onContactar} aria-haspopup="dialog" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 cursor-pointer">Contactar</button> : <span />}<button type="button" onClick={onCerrar} className="rounded-lg border border-slate-200/60 px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">Cerrar</button></>}>
      <div className="space-y-5 px-5 py-4">
        {GRUPOS.map((g) => {
          const lista = citas.filter((c) => g.estados.includes(c.estado)).slice().sort(porFechaDesc)
          return (
            <section key={g.id} aria-label={g.titulo}>
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800"><span aria-hidden="true" className={"h-2 w-2 rounded-full " + g.punto} />{g.titulo} · {lista.length}</h3>
              {lista.length === 0 ? <p className="mt-1 pl-4 text-sm text-slate-500">Ninguna.</p> : (
                <ul className="mt-1.5 divide-y divide-slate-100 rounded-xl border border-slate-200/60">
                  {lista.map((c) => {
                    const quien = c.atendidoPor || c.asignadoA ? etiquetaMiembro(equipo, c.atendidoPor || c.asignadoA) : ""
                    return (
                      <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-3.5 py-2.5 text-[15px]">
                        <span className="text-slate-800">{fechaLegible(c.fecha)} · {horaSinCero(c.hora)}</span>
                        <span className="min-w-0 text-slate-600">{c.motivo || "Consulta general"}{quien ? ` · ${quien.split(" ")[0]}` : ""}</span>
                        {g.conMotivo && <span className="basis-full text-sm text-slate-500">{motivoDeLaCita(c, seguimiento)}</span>}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )
        })}

        <section aria-label="Contactos desde el CRM">
          <h3 className="text-sm font-bold text-slate-800">Contactos que ya se le hicieron · {contactos.length}</h3>
          {contactos.length === 0 ? <p className="mt-1 text-sm text-slate-500">Todavía no se le ha escrito desde el CRM.</p> : (
            <ul className="mt-1.5 divide-y divide-slate-100 rounded-xl border border-slate-200/60">
              {contactos.map((k) => (
                <li key={k.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-3.5 py-2.5 text-[15px]">
                  <span className="text-slate-800">{fechaLegible(diaDeRegistro(k.creado_en))}</span>
                  <span className="min-w-0 text-slate-600">{ETIQUETA_MOTIVO[k.motivo] || k.motivo} · {CANALES[k.canal] || k.canal}</span>
                  <span className="text-sm text-slate-500">{k.creado_por_nombre || "Equipo"}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Cascaron>
  )
}
