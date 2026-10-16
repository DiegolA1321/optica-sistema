"use client"

import { useCallback, useEffect, useState } from "react"
import { ShieldCheck } from "lucide-react"
import { supabase } from "../../lib/supabaseClient"
import { INK, GRAD_MARCA } from "@/lib/tema"
import { fechaHoraLegible } from "../../utilidades/formatoFecha"

// "Permitir acceso del soporte": los datos de la óptica son suyos. El soporte del sistema solo puede entrar como administrador mientras su
// administrador lo permita, por un tiempo limitado, y cada entrada deja su motivo en la actividad y un aviso. Lo valida el servidor.
export const DURACIONES_ACCESO = [
  { horas: 1, etiqueta: "1 hora" },
  { horas: 24, etiqueta: "24 horas" },
  { horas: 72, etiqueta: "3 días" },
  { horas: 168, etiqueta: "7 días" },
]

export default function AccesoSoporte({ onExito, onError }) {
  const [estado, setEstado] = useState(null) // { activo, vence_en, origen, entradas }
  const [horas, setHoras] = useState(24)
  const [enviando, setEnviando] = useState(false)
  const [errorCarga, setErrorCarga] = useState("")

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.rpc("mi_acceso_soporte")
    if (error) { setErrorCarga("No se pudo leer el estado del acceso. Vuelve a intentarlo."); return }
    setErrorCarga("")
    setEstado(data)
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const permitir = async () => {
    setEnviando(true)
    const { error } = await supabase.rpc("permitir_acceso_soporte", { p_horas: horas, p_consulta: null })
    setEnviando(false)
    if (error) { onError?.("No se pudo permitir el acceso del soporte. Vuelve a intentarlo."); return }
    onExito?.("Acceso del soporte permitido.")
    cargar()
  }
  const quitar = async () => {
    setEnviando(true)
    const { error } = await supabase.rpc("revocar_acceso_soporte")
    setEnviando(false)
    if (error) { onError?.("No se pudo quitar el acceso. Vuelve a intentarlo."); return }
    onExito?.("Acceso del soporte retirado.")
    cargar()
  }

  return (
    <section aria-label="Acceso del soporte" className="space-y-3">
      <div className="rounded-xl border border-slate-200/60 bg-white p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"><ShieldCheck size={18} aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold" style={{ color: INK }}>Permitir acceso del soporte</p>
            <p className="mt-0.5 text-sm leading-relaxed text-slate-600">Los datos de tu óptica y de tus pacientes son tuyos. El soporte del sistema solo puede entrar como administrador si tú lo permites, por el tiempo que elijas. Cada entrada queda en tu actividad con su motivo y recibes un aviso con la fecha.</p>
            {errorCarga && <p role="alert" className="mt-2 text-sm font-semibold text-red-700">{errorCarga}</p>}
            {estado === null && !errorCarga && <div className="mt-3 h-10 animate-pulse rounded-lg bg-slate-200/70" aria-busy="true" aria-label="Cargando" />}
            {estado && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {estado.activo ? (
                  <>
                    <p className="text-sm font-semibold text-emerald-700">Permitido hasta el {fechaHoraLegible(estado.vence_en, { anio: true })}</p>
                    <button type="button" onClick={quitar} disabled={enviando} className="rounded-lg border border-slate-200/60 px-3.5 py-1.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60 cursor-pointer">{enviando ? "Quitando…" : "Quitar el acceso"}</button>
                  </>
                ) : (
                  <>
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">Por
                      <select value={horas} onChange={(e) => setHoras(Number(e.target.value))} aria-label="Tiempo del acceso" className="h-9 rounded-lg border border-slate-200/60 bg-white px-2 text-sm font-normal text-slate-700 outline-none focus-visible:border-blue-500">
                        {DURACIONES_ACCESO.map((d) => <option key={d.horas} value={d.horas}>{d.etiqueta}</option>)}
                      </select>
                    </label>
                    <button type="button" onClick={permitir} disabled={enviando} className="rounded-lg px-3.5 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 cursor-pointer" style={{ background: GRAD_MARCA }}>{enviando ? "Permitiendo…" : "Permitir acceso del soporte"}</button>
                    <span className="text-sm text-slate-500">Ahora mismo el soporte no puede entrar.</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {estado && estado.entradas?.length > 0 && (
        <div className="rounded-xl border border-slate-200/60 bg-white">
          <h3 className="border-b border-slate-100 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-500">Últimas entradas del soporte</h3>
          <ul role="list" className="divide-y divide-slate-100">
            {estado.entradas.map((e, i) => (
              <li key={i} className="px-4 py-2.5 text-sm text-slate-700">
                <span className="font-semibold" style={{ color: INK }}>{e.quien}</span> entró el {fechaHoraLegible(e.entrada_en, { anio: true })}{e.salida_en ? ` y salió el ${fechaHoraLegible(e.salida_en, { anio: true })}` : ""}.
                {e.motivo && <span className="block text-slate-600">Motivo: {e.motivo}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
