"use client"

import { useEffect, useState } from "react"
import { History } from "lucide-react"
import { Cascaron } from "../AtencionPaciente"
import { supabase } from "../../lib/supabaseClient"
import { fechaHoraLegible } from "../../utilidades/formatoFecha"
import { dinero } from "../../utilidades/formatoMoneda"
import { mapActa } from "../../utilidades/conteoImpresion"

const dineroConSigno = (n) => (n < 0 ? `−${dinero(Math.abs(n))}` : dinero(n))

// Los conteos físicos ya registrados, del más reciente al más antiguo. Cada uno abre su acta.
export default function HistorialConteos({ onAbrirActa, onCerrar }) {
  const [estado, setEstado] = useState({ actas: [], cargando: !!supabase, error: "" })
  const [intento, setIntento] = useState(0)
  useEffect(() => {
    if (!supabase) { setEstado({ actas: [], cargando: false, error: "" }); return }
    let vivo = true
    setEstado((e) => ({ ...e, cargando: true, error: "" }))
    supabase.from("conteos_inventario").select("*").order("created_at", { ascending: false }).limit(100).then(({ data, error }) => {
      if (!vivo) return
      if (error) setEstado({ actas: [], cargando: false, error: "No se pudo cargar el historial de conteos. Revisa tu conexión e intenta de nuevo." })
      else setEstado({ actas: (data || []).map(mapActa), cargando: false, error: "" })
    })
    return () => { vivo = false }
  }, [intento])

  return (
    <Cascaron
      titulo="Historial de conteos" subtitulo="Cada conteo confirmado, con su acta" Icono={History} ancho="max-w-3xl" onCerrar={onCerrar}
      pie={<><span className="text-xs text-slate-500">Se muestran los 100 más recientes.</span><button type="button" onClick={onCerrar} className="rounded-lg border border-slate-200/60 px-3.5 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">Cerrar</button></>}
    >
      <div className="px-5 py-4">
        {estado.cargando ? (
          <div className="space-y-2" aria-busy="true" aria-label="Cargando los conteos">{[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-200/70" />)}</div>
        ) : estado.error ? (
          <div role="alert" className="flex flex-col items-center gap-2 py-8 text-center">
            <p className="text-sm font-medium text-red-700">{estado.error}</p>
            <button type="button" onClick={() => setIntento((n) => n + 1)} className="text-sm font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">Intentar de nuevo</button>
          </div>
        ) : estado.actas.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 py-8 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-400"><History size={22} aria-hidden="true" /></div>
            <p className="text-sm font-medium text-slate-600">Todavía no hay conteos registrados.</p>
            <p className="text-xs text-slate-500">Cuando confirmes un conteo físico, su acta queda aquí.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200/60">
            <table className="w-full table-fixed border-collapse text-left text-sm">
              <caption className="sr-only">Conteos físicos registrados</caption>
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <th scope="col" className="w-[170px] px-3 py-2">Fecha</th>
                  <th scope="col" className="px-3 py-2">Contó</th>
                  <th scope="col" className="w-[84px] px-3 py-2 text-right">Contados</th>
                  <th scope="col" className="w-[100px] px-3 py-2 text-right">Diferencias</th>
                  <th scope="col" className="w-[110px] px-3 py-2 text-right">Valor</th>
                  <th scope="col" className="w-[84px] px-3 py-2"><span className="sr-only">Acta</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {estado.actas.map((a) => (
                  <tr key={a.id}>
                    <td className="px-3 py-2">{fechaHoraLegible(a.creadoEn, { anio: true })}</td>
                    <td className="truncate px-3 py-2">{a.usuarioNombre || "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{a.contados}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{a.contados - a.iguales}</td>
                    <td className={"px-3 py-2 text-right font-mono tabular-nums " + (a.valorPrecio < 0 ? "text-red-600" : a.valorPrecio > 0 ? "text-emerald-700" : "text-slate-500")}>{dineroConSigno(a.valorPrecio)}</td>
                    <td className="px-3 py-2 text-right"><button type="button" onClick={() => onAbrirActa(a)} aria-label={`Ver el acta del ${fechaHoraLegible(a.creadoEn, { anio: true })}`} className="rounded-lg border border-slate-200/60 px-3 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50 cursor-pointer">Ver acta</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Cascaron>
  )
}
