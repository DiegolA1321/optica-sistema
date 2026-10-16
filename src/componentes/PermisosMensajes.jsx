"use client"

import { useState } from "react"
import { INK, GRAD_MARCA } from "@/lib/tema"
import { ETIQUETA_PERMISO } from "../utilidades/permisosMensajes"
import { fechaHoraLegible } from "../utilidades/formatoFecha"

// Los dos permisos para recibir mensajes, como dos interruptores. Es la misma pieza en el perfil del paciente (el personal) y en "Mis datos"
// del portal (el paciente): se ven y se comportan igual (regla 18). `onCambiar` recibe { recordatorios } o { promociones } y devuelve { ok, error? };
// sin `onCambiar` solo se muestran. `actualizadoPor` / `actualizadoEn`: quién y cuándo los cambió por última vez (si alguna vez se cambiaron).
export default function PermisosMensajes({ recordatorios, promociones, actualizadoPor = "", actualizadoEn = null, onCambiar = null, quien = "personal" }) {
  const [guardando, setGuardando] = useState("")
  const [error, setError] = useState("")

  const cambiar = async (id, valor) => {
    if (!onCambiar || guardando) return
    setGuardando(id)
    setError("")
    const r = await onCambiar({ [id]: valor })
    if (r && r.ok === false) setError(r.error || "No se pudo guardar.")
    setGuardando("")
  }
  const valores = { recordatorios, promociones }

  return (
    <div className="space-y-2.5">
      {["recordatorios", "promociones"].map((id) => {
        const valor = valores[id]
        return (
          <div key={id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/60 bg-white px-3.5 py-2.5">
            <div className="min-w-0">
              <p id={`permiso-${id}`} className="text-sm font-bold" style={{ color: INK }}>{ETIQUETA_PERMISO[id].titulo}</p>
              <p className="text-xs text-slate-500">{quien === "yo" ? (ETIQUETA_PERMISO[id].ayudaYo || ETIQUETA_PERMISO[id].ayuda) : ETIQUETA_PERMISO[id].ayuda}</p>
            </div>
            {onCambiar ? (
              <button type="button" role="switch" aria-checked={valor} aria-labelledby={`permiso-${id}`} disabled={Boolean(guardando)} onClick={() => cambiar(id, !valor)}
                className={"relative h-7 w-12 shrink-0 rounded-full transition-colors cursor-pointer disabled:opacity-60 " + (valor ? "" : "bg-slate-200")} style={valor ? { background: GRAD_MARCA } : undefined}>
                <span className={"absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform " + (valor ? "translate-x-5" : "translate-x-0")} />
              </button>
            ) : (
              <span className={"shrink-0 text-sm font-semibold " + (valor ? "text-emerald-700" : "text-slate-500")}>{valor ? "Sí" : "No"}</span>
            )}
          </div>
        )
      })}
      <p className="text-xs text-slate-500">
        {actualizadoEn
          ? `Último cambio${actualizadoPor ? ` de ${actualizadoPor}` : ""}: ${fechaHoraLegible(actualizadoEn, { anio: true })}.`
          : `${quien === "yo" ? "Aún no has cambiado tus permisos" : "Aún no se han cambiado sus permisos"}: los recordatorios de salud están activos y las promociones y saludos, no.`}
      </p>
      {error && <p role="alert" className="text-xs font-semibold text-red-600">{error}</p>}
    </div>
  )
}
