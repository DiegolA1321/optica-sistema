"use client"

import { useCallback, useEffect, useState } from "react"
import { INK } from "@/lib/tema"
import { CLASE_ACCION_SECUNDARIA } from "../ventas/estilos"
import { leerModulosNoUsados, volverAUsarModulo } from "../../utilidades/soporteDatos"
import { fechaLegible } from "../../utilidades/formatoFecha"
import { diaDe } from "../../utilidades/reportesPeriodo"
import { nombreModuloDeUso as nombreDe } from "../../utilidades/soporteAyuda"

// Configuración › «Módulos que no usamos»: los que el administrador marcó con «No usamos este módulo» cuando el soporte le ofreció ayuda. El soporte no
// vuelve a ofrecérsela con ellos; aquí se deshace si empiezan a usarlos.
export default function ModulosNoUsados({ onExito, onError }) {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState("")
  const [deshaciendo, setDeshaciendo] = useState("")

  const cargar = useCallback(async () => {
    const r = await leerModulosNoUsados()
    setError(r.error || "")
    setDatos(r.datos)
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const deshacer = async (m) => {
    setDeshaciendo(m.modulo)
    const r = await volverAUsarModulo(m.modulo)
    setDeshaciendo("")
    if (r.error) { onError?.(r.error); return }
    onExito?.(`${nombreDe(m.modulo)} vuelve a contarse como un módulo que usan.`)
    await cargar()
  }

  return (
    <section aria-label="Módulos que no usamos" className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold" style={{ color: INK }}>Módulos que no usamos</h2>
      <p className="mt-1 text-sm text-slate-600">Los que marcaste con «No usamos este módulo» cuando el soporte te ofreció ayuda. El soporte no vuelve a ofrecértela con ellos. Si empiezan a usarlos, vuelve a contarlos aquí.</p>
      {error ? (
        <p role="alert" className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}<button type="button" onClick={cargar} className={CLASE_ACCION_SECUNDARIA}>Reintentar</button></p>
      ) : datos === null ? (
        <div className="mt-3 h-12 animate-pulse rounded-xl bg-slate-100" aria-label="Cargando los módulos" />
      ) : datos.length === 0 ? (
        <p className="mt-3 rounded-xl bg-slate-50 px-3 py-3 text-sm text-slate-600">Todavía no marcaste ningún módulo como no usado. Si el soporte te ofrece ayuda con uno que no usan, puedes decirlo desde esa conversación en Soporte.</p>
      ) : (
        <ul role="list" className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200/60">
          {datos.map((m) => (
            <li key={m.modulo} className="flex flex-wrap items-center gap-3 px-3.5 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold" style={{ color: INK }}>{nombreDe(m.modulo)}</span>
                <span className="block text-xs text-slate-500">Marcado el {fechaLegible(diaDe(m.marcado_en))}{m.marcado_nombre ? ` por ${m.marcado_nombre}` : ""}</span>
              </span>
              <button type="button" onClick={() => deshacer(m)} disabled={deshaciendo === m.modulo} aria-label={`Volver a usar ${nombreDe(m.modulo)}`} className={CLASE_ACCION_SECUNDARIA}>
                {deshaciendo === m.modulo ? "Guardando…" : "Volver a usarlo"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
