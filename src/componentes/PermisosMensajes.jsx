"use client"

import { useState } from "react"
import { Check } from "lucide-react"
import { INK, GRAD_MARCA } from "@/lib/tema"
import { ETIQUETA_PERMISO } from "../utilidades/permisosMensajes"
import { fechaHoraLegible } from "../utilidades/formatoFecha"

// Textos de las casillas del portal (diseño aprobado).
const AYUDA_CASILLA = { recordatorios: "Tus citas, tu control y cómo te va con tus lentes", promociones: "Ofertas de la óptica y tu saludo de cumpleaños" }

// Los dos permisos para recibir mensajes, como dos interruptores. Es la misma pieza en el perfil del paciente (el personal) y en "Mis datos"
// del portal (el paciente): se ven y se comportan igual (regla 18). `onCambiar` recibe { recordatorios } o { promociones } y devuelve { ok, error? };
// sin `onCambiar` solo se muestran. `casilla`: el portal del paciente los dibuja como casillas de verificación (diseño aprobado), sin cambiar lo que hacen. `actualizadoPor` / `actualizadoEn`: quién y cuándo los cambió por última vez (si alguna vez se cambiaron).
export default function PermisosMensajes({ recordatorios, promociones, actualizadoPor = "", actualizadoEn = null, onCambiar = null, quien = "personal", grande = false, casilla = false }) {
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

  if (casilla) {
    return (
      <div className="space-y-5">
        {["recordatorios", "promociones"].map((id) => (
          <div key={id} className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p id={`permiso-${id}`} className="text-base font-bold text-pt-marino">{ETIQUETA_PERMISO[id].titulo}</p>
              <p className="text-base text-pt-texto">{AYUDA_CASILLA[id]}</p>
            </div>
            <button type="button" role="checkbox" aria-checked={Boolean(valores[id])} aria-labelledby={`permiso-${id}`} disabled={Boolean(guardando)} onClick={() => cambiar(id, !valores[id])} className="grid h-11 w-11 shrink-0 place-items-center cursor-pointer disabled:opacity-60">
              <span className={"grid h-[26px] w-[26px] place-items-center rounded-md border-2 transition-colors " + (valores[id] ? "border-pt-azul bg-pt-azul text-white" : "border-slate-400 bg-white")}>{valores[id] && <Check size={18} strokeWidth={3} aria-hidden="true" />}</span>
            </button>
          </div>
        ))}
        {error && <p role="alert" className="text-base font-semibold text-red-600">{error}</p>}
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {["recordatorios", "promociones"].map((id) => {
        const valor = valores[id]
        return (
          <div key={id} className={"flex items-center justify-between gap-3 rounded-xl border border-slate-200/60 bg-white px-3.5 py-2.5 " + (grande ? "min-h-16 gap-4 py-3" : "")}>
            <div className="min-w-0">
              <p id={`permiso-${id}`} className={(grande ? "text-lg" : "text-sm") + " font-bold"} style={{ color: INK }}>{ETIQUETA_PERMISO[id].titulo}</p>
              <p className={grande ? "text-base text-slate-600" : "text-xs text-slate-500"}>{quien === "yo" ? (ETIQUETA_PERMISO[id].ayudaYo || ETIQUETA_PERMISO[id].ayuda) : ETIQUETA_PERMISO[id].ayuda}</p>
            </div>
            {onCambiar ? (
              <button type="button" role="switch" aria-checked={valor} aria-labelledby={`permiso-${id}`} disabled={Boolean(guardando)} onClick={() => cambiar(id, !valor)}
                className={"relative shrink-0 rounded-full transition-colors cursor-pointer disabled:opacity-60 " + (grande ? "h-11 w-[4.5rem] " : "h-7 w-12 ") + (valor ? "" : "bg-slate-200")} style={valor ? { background: GRAD_MARCA } : undefined}>
                <span className={"absolute left-1 top-1 rounded-full bg-white shadow transition-transform " + (grande ? "h-9 w-9 " + (valor ? "translate-x-7" : "translate-x-0") : "h-5 w-5 " + (valor ? "translate-x-5" : "translate-x-0"))} />
              </button>
            ) : (
              <span className={"shrink-0 font-semibold " + (grande ? "text-lg " : "text-sm ") + (valor ? "text-emerald-700" : "text-slate-500")}>{valor ? "Sí" : "No"}</span>
            )}
          </div>
        )
      })}
      <p className={grande ? "text-base text-slate-600" : "text-xs text-slate-500"}>
        {actualizadoEn
          ? `Último cambio${actualizadoPor ? ` de ${actualizadoPor}` : ""}: ${fechaHoraLegible(actualizadoEn, { anio: true })}.`
          : `${quien === "yo" ? "Aún no has cambiado tus permisos" : "Aún no se han cambiado sus permisos"}: los recordatorios de salud están activos y las promociones y saludos, no.`}
      </p>
      {error && <p role="alert" className={(grande ? "text-base " : "text-xs ") + "font-semibold text-red-600"}>{error}</p>}
    </div>
  )
}
