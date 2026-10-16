"use client"

import { Check, Megaphone } from "lucide-react"
import { GRAD_MARCA, INK } from "@/lib/tema"
import { Insignia, Vacio } from "../ventas/Lista"
import { CLASE_ACCION_PRINCIPAL, CLASE_ACCION_SECUNDARIA, plural } from "../ventas/estilos"
import { fechaHoraLegible } from "../../utilidades/formatoFecha"

// Pestaña "Avisos del sistema": los anuncios del soporte, con su fecha. Los no leídos van primero y destacados; cada uno se marca como leído a mano,
// para que nadie pierda un aviso solo por haber abierto la pestaña.
export default function PestanaAvisos({ avisos, onMarcar, onMarcarTodos, onVerAyuda }) {
  const sinLeer = avisos.filter((a) => !a.leido).length
  if (avisos.length === 0) {
    return (
      <Vacio Icono={Megaphone} titulo="Todavía no hay avisos del sistema" texto="Aquí aparecen las novedades, los mantenimientos y los comunicados del soporte.">
        <button type="button" onClick={onVerAyuda} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}>Ver la ayuda</button>
      </Vacio>
    )
  }
  return (
    <div className="space-y-3">
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-3 px-1">
        <p role="status" className="text-sm font-semibold text-slate-600">{plural(avisos.length, "aviso", "avisos")}{sinLeer > 0 && <span className="ml-2 font-bold text-blue-700">{plural(sinLeer, "nuevo", "nuevos")}</span>}</p>
        {sinLeer > 1 && <button type="button" onClick={onMarcarTodos} className={CLASE_ACCION_SECUNDARIA}><Check size={14} aria-hidden="true" /> Marcar todos como leídos</button>}
      </div>
      <ul role="list" aria-label="Avisos del sistema" className="space-y-3">
        {avisos.map((a) => (
          <li key={a.id} className={"rounded-2xl border bg-white p-4 shadow-sm " + (a.leido ? "border-slate-200/60" : "border-blue-300 ring-2 ring-blue-50")}>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className={"text-sm " + (a.leido ? "font-semibold text-slate-700" : "font-bold")} style={a.leido ? undefined : { color: INK }}>{a.asunto}</h3>
              {!a.leido && <Insignia tono="azul">Nuevo</Insignia>}
              {!a.general && <Insignia tono="gris" title="Este aviso es solo para tu óptica">Para tu óptica</Insignia>}
              <span className="ml-auto text-xs text-slate-500">{fechaHoraLegible(a.creadoEn, { anio: true })}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{a.cuerpo}</p>
            {!a.leido && <button type="button" onClick={() => onMarcar(a.id)} className={CLASE_ACCION_SECUNDARIA + " mt-3"}><Check size={14} aria-hidden="true" /> Marcar como leído</button>}
          </li>
        ))}
      </ul>
    </div>
  )
}
