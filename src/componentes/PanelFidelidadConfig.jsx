"use client"

import { useState } from "react"
import { Gift, Plus, Trash2 } from "lucide-react"
import { INK, GRAD_MARCA } from "@/lib/tema"
import { PROGRAMA_POR_DEFECTO, programaDe, errorDePrograma } from "../utilidades/programaFidelidad"

// Configuración › Fidelización: para qué sirve el programa (premiar a quien vuelve y recomienda), cómo se ganan los puntos y qué beneficio da cada nivel. Solo el administrador (el módulo
// de Configuración ya lo exige). Se guarda en los ajustes de la óptica (`parametrizacion.fidelizacion`). El descuento de cada nivel se SUGIERE en «Nueva venta» a quien tiene permiso de
// descuentos en Ventas (editar); no se aplica solo.
const CAMPO = "w-24 rounded-lg border border-slate-200/60 bg-slate-50 px-2 py-1.5 text-center text-sm font-semibold text-slate-800 outline-none focus-visible:border-blue-500 focus-visible:bg-white"

export default function PanelFidelidadConfig({ parametrizacion, setParametrizacion, onExito, onError }) {
  const vigente = programaDe(parametrizacion)
  const [borrador, setBorrador] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const p = borrador ?? vigente
  const cambio = (campos) => setBorrador({ ...p, ...campos })
  const nivel = (i, campos) => cambio({ niveles: p.niveles.map((n, j) => (j === i ? { ...n, ...campos } : n)) })
  const error = borrador ? errorDePrograma(borrador) : ""
  const guardar = async () => {
    if (error) { onError?.(error); return }
    setGuardando(true)
    const limpio = { activo: p.activo, porConsulta: Number(p.porConsulta), porReferido: Number(p.porReferido), dolaresPorPunto: Number(p.dolaresPorPunto), niveles: p.niveles.map((n, i) => ({ id: n.id, nombre: String(n.nombre).trim(), desde: i === 0 ? 0 : Number(n.desde), descuento: Number(n.descuento) })) }
    const { error: e } = (await setParametrizacion((prev) => ({ ...prev, fidelizacion: limpio }))) || {}
    setGuardando(false)
    if (e) { onError?.("No se pudo guardar el programa de fidelización. Revisa tu conexión e intenta de nuevo."); return }
    setBorrador(null)
    onExito?.("Programa de fidelización guardado correctamente.")
  }
  const agregarNivel = () => { const ultimo = p.niveles[p.niveles.length - 1]; cambio({ niveles: [...p.niveles, { id: `nivel-${Date.now()}`, nombre: "", desde: Number(ultimo.desde) + 50, descuento: Number(ultimo.descuento) }] }) }
  const quitarNivel = (i) => cambio({ niveles: p.niveles.filter((_, j) => j !== i) })

  return (
    <section aria-label="Programa de fidelización" className="rounded-2xl border border-slate-200/60 bg-white p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"><Gift size={19} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold" style={{ color: INK }}>Programa de fidelización</h3>
          <p className="mt-0.5 text-sm text-slate-500">Premia a quien vuelve y recomienda tu óptica: gana puntos por cada consulta, por cada paciente que refiere y por lo que paga; según sus puntos tiene un nivel, y cada nivel puede dar un descuento que se sugiere al vender.</p>
        </div>
        <label className="flex shrink-0 items-center gap-2 text-sm font-semibold text-slate-700">
          <input type="checkbox" checked={p.activo} onChange={(e) => cambio({ activo: e.target.checked })} className="h-4 w-4 accent-blue-600" /> Activo
        </label>
      </div>

      <div className={"mt-4 space-y-5 " + (p.activo ? "" : "opacity-50")}>
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Cómo se ganan los puntos</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">Por cada consulta atendida
              <span className="mt-1.5 flex items-center gap-2"><input type="number" min={0} step={1} inputMode="numeric" aria-label="Puntos por consulta" value={p.porConsulta} onChange={(e) => cambio({ porConsulta: e.target.value })} className={CAMPO} /> puntos</span>
            </label>
            <label className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">Por cada paciente que refiere
              <span className="mt-1.5 flex items-center gap-2"><input type="number" min={0} step={1} inputMode="numeric" aria-label="Puntos por referido" value={p.porReferido} onChange={(e) => cambio({ porReferido: e.target.value })} className={CAMPO} /> puntos</span>
            </label>
            <label className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">Por lo que paga (1 punto cada…)
              <span className="mt-1.5 flex items-center gap-2">$<input type="number" min={1} step={1} inputMode="numeric" aria-label="Dólares por punto" value={p.dolaresPorPunto} onChange={(e) => cambio({ dolaresPorPunto: e.target.value })} className={CAMPO} /> pagados</span>
            </label>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Niveles y beneficios</p>
          <ul className="space-y-2">
            {p.niveles.map((n, i) => (
              <li key={n.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                <input type="text" maxLength={30} aria-label={`Nombre del nivel ${i + 1}`} value={n.nombre} placeholder="Nombre" onChange={(e) => nivel(i, { nombre: e.target.value })} className="w-36 rounded-lg border border-slate-200/60 bg-white px-2 py-1.5 text-sm font-semibold outline-none focus-visible:border-blue-500" />
                <span className="flex items-center gap-2">desde <input type="number" min={0} step={1} inputMode="numeric" aria-label={`Puntos desde del nivel ${n.nombre || i + 1}`} value={i === 0 ? 0 : n.desde} disabled={i === 0} onChange={(e) => nivel(i, { desde: e.target.value })} className={CAMPO + " disabled:opacity-60"} /> puntos</span>
                <span className="flex items-center gap-2">descuento sugerido <input type="number" min={0} max={100} step={1} inputMode="numeric" aria-label={`Descuento del nivel ${n.nombre || i + 1}`} value={n.descuento} onChange={(e) => nivel(i, { descuento: e.target.value })} className={CAMPO + " w-20"} /> %</span>
                {i > 0 && p.niveles.length > 1 && <button type="button" onClick={() => quitarNivel(i)} aria-label={`Quitar el nivel ${n.nombre || i + 1}`} className="ml-auto rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 cursor-pointer"><Trash2 size={15} aria-hidden="true" /></button>}
              </li>
            ))}
          </ul>
          <button type="button" onClick={agregarNivel} className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-700 transition-colors hover:text-blue-800 cursor-pointer"><Plus size={14} aria-hidden="true" /> Agregar un nivel</button>
          <p className="mt-2 text-xs text-slate-500">El descuento se sugiere en «Nueva venta»; solo lo aplica quien tiene permiso de descuentos en Ventas, y queda con su motivo.</p>
        </div>

        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={guardar} disabled={borrador === null || guardando || !!error} className="rounded-xl px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50" style={{ background: GRAD_MARCA }}>{guardando ? "Guardando…" : "Guardar"}</button>
          {borrador !== null && <button type="button" onClick={() => setBorrador(null)} className="text-sm font-semibold text-slate-500 hover:text-slate-800 cursor-pointer">Descartar cambios</button>}
          {JSON.stringify(vigente) !== JSON.stringify(PROGRAMA_POR_DEFECTO) && borrador === null && <button type="button" onClick={() => setBorrador(PROGRAMA_POR_DEFECTO)} className="text-sm font-semibold text-slate-500 hover:text-slate-800 cursor-pointer">Volver a los valores iniciales</button>}
        </div>
      </div>
    </section>
  )
}
