"use client"

import { useEffect, useMemo, useState } from "react"
import { FlaskConical, Pencil, Plus, Power } from "lucide-react"
import { INK, GRAD_MARCA } from "@/lib/tema"
import { supabase } from "../../lib/supabaseClient"
import { Insignia } from "../ventas/Lista"
import {
  laboratoriosDe, agregarLaboratorio, renombrarLaboratorio, cambiarActivoLaboratorio, errorDeNombreLaboratorio, gruposDeParecidos, claveDeNombre, MAX_NOMBRE_LABORATORIO,
} from "../../utilidades/laboratorios"

// Configuración → Laboratorios: el catálogo de laboratorios a los que la óptica manda sus lentes (agregar, editar y desactivar). Los pedidos de lentes y «Nueva venta» eligen de aquí.
// Un laboratorio no se elimina: se desactiva (deja de ofrecerse) y los pedidos ya hechos conservan el nombre con que se pidieron. Se guarda en la parametrización de la óptica.
export default function PanelLaboratorios({ usuario, parametrizacion, setParametrizacion, onExito, onError }) {
  const lista = laboratoriosDe(parametrizacion)
  const [nuevo, setNuevo] = useState("")
  const [errorNuevo, setErrorNuevo] = useState("")
  const [editando, setEditando] = useState(null) // el nombre que se está renombrando
  const [texto, setTexto] = useState("")
  const [errorEdicion, setErrorEdicion] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [usados, setUsados] = useState([]) // los nombres que ya usan los pedidos: [{ nombre, cuenta }]

  // Los laboratorios que ya aparecen en los pedidos de la óptica (de antes del catálogo), para ofrecer traerlos y para avisar de los repetidos.
  useEffect(() => {
    if (!supabase || !usuario?.opticaId) return
    let vivo = true
    supabase.from("ordenes_laboratorio").select("laboratorio").eq("optica_id", usuario.opticaId).not("laboratorio", "is", null).limit(1000).then(({ data }) => {
      if (!vivo || !data) return
      const cuenta = new Map()
      for (const o of data) { const n = String(o.laboratorio || "").trim(); if (n) cuenta.set(n, (cuenta.get(n) || 0) + 1) }
      setUsados([...cuenta.entries()].map(([nombre, n]) => ({ nombre, cuenta: n })))
    })
    return () => { vivo = false }
  }, [usuario?.opticaId])

  const guardar = async (nueva, exito, fallo) => {
    setGuardando(true)
    const { error } = (await setParametrizacion((prev) => ({ ...prev, laboratorios: nueva }))) || {}
    setGuardando(false)
    if (error) { onError?.(fallo); return false }
    onExito?.(exito)
    return true
  }

  const agregar = async () => {
    const mensaje = errorDeNombreLaboratorio(lista, nuevo)
    if (mensaje) { setErrorNuevo(mensaje); return }
    const nombre = nuevo.trim()
    if (await guardar(agregarLaboratorio(lista, nombre), `«${nombre}» agregado a los laboratorios.`, `No se pudo agregar «${nombre}». Revisa tu conexión e intenta de nuevo.`)) { setNuevo(""); setErrorNuevo("") }
  }
  const guardarEdicion = async () => {
    const viejo = editando
    const mensaje = errorDeNombreLaboratorio(lista, texto, viejo)
    if (mensaje) { setErrorEdicion(mensaje); return }
    const nombre = texto.trim()
    if (nombre === viejo) { setEditando(null); return }
    if (await guardar(renombrarLaboratorio(lista, viejo, nombre), `Laboratorio renombrado a «${nombre}». Los pedidos ya hechos conservan el nombre anterior.`, `No se pudo renombrar «${viejo}». Revisa tu conexión e intenta de nuevo.`)) { setEditando(null); setErrorEdicion("") }
  }
  const alternar = (l) => guardar(cambiarActivoLaboratorio(lista, l.nombre, !l.activo),
    l.activo ? `«${l.nombre}» desactivado: ya no se ofrece en los pedidos nuevos.` : `«${l.nombre}» activado: vuelve a ofrecerse.`,
    `No se pudo cambiar «${l.nombre}». Revisa tu conexión e intenta de nuevo.`)

  // Los laboratorios de los pedidos que todavía no están en el catálogo, ya unificados (de cada grupo de nombres parecidos, el más usado).
  const porTraer = useMemo(() => {
    const cuenta = new Map(usados.map((u) => [u.nombre, u.cuenta]))
    const enCatalogo = new Set(lista.map((l) => claveDeNombre(l.nombre)))
    const grupos = gruposDeParecidos(usados.map((u) => u.nombre), cuenta)
    const secundarios = new Set(grupos.flatMap((g) => g.slice(1)))
    return usados.filter((u) => !secundarios.has(u.nombre) && !enCatalogo.has(claveDeNombre(u.nombre))).sort((a, b) => b.cuenta - a.cuenta).map((u) => u.nombre)
  }, [usados, lista])
  // Los que ya se ven repetidos dentro del catálogo, y los nombres de los pedidos que se unifican al traerlos.
  const parecidos = useMemo(() => gruposDeParecidos(lista.map((l) => l.nombre), new Map(usados.map((u) => [u.nombre, u.cuenta]))), [lista, usados])
  const unificados = useMemo(() => gruposDeParecidos(usados.map((u) => u.nombre), new Map(usados.map((u) => [u.nombre, u.cuenta]))), [usados])
  const traer = () => guardar(porTraer.reduce((acc, n) => agregarLaboratorio(acc, n), lista), `${porTraer.length === 1 ? "Se agregó 1 laboratorio" : `Se agregaron ${porTraer.length} laboratorios`} de los que ya usas en tus pedidos.`, "No se pudieron agregar los laboratorios. Revisa tu conexión e intenta de nuevo.")

  return (
    <div className="rounded-xl border border-slate-200/60 bg-white p-4">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"><FlaskConical size={18} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold" style={{ color: INK }}>Laboratorios</p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">Los laboratorios a los que mandas tus lentes. Se eligen al guardar una venta con lunas y en cada pedido de lentes. Un laboratorio no se elimina: se desactiva y deja de ofrecerse.</p>

          {porTraer.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-blue-200/60 bg-blue-50 px-3 py-2.5 text-sm text-blue-900">
              <p className="min-w-0">Tus pedidos ya usan {porTraer.length === 1 ? "1 laboratorio" : `${porTraer.length} laboratorios`} que no están aquí: <span className="font-semibold">{porTraer.join(", ")}</span>.</p>
              {unificados.length > 0 && <p className="w-full text-xs text-blue-800">Los nombres parecidos se unifican: {unificados.map((g) => `${g.slice(1).map((n) => `«${n}»`).join(" y ")} se junta con «${g[0]}»`).join("; ")}. Los pedidos ya hechos conservan su nombre.</p>}
              <button type="button" onClick={traer} disabled={guardando} className="shrink-0 rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 cursor-pointer disabled:opacity-60">Agregarlos al catálogo</button>
            </div>
          )}
          {parecidos.length > 0 && (
            <div role="status" className="mt-3 rounded-lg border border-amber-200/60 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
              <p className="font-semibold">Parecen ser el mismo laboratorio:</p>
              <ul className="mt-1 list-disc pl-5">{parecidos.map((g) => <li key={g.join("|")}>{g.map((n) => `«${n}»`).join(" y ")}</li>)}</ul>
              <p className="mt-1 text-xs">Deja uno activo para los pedidos nuevos y desactiva el otro. Los pedidos ya hechos conservan el nombre con que se pidieron.</p>
            </div>
          )}

          <ul aria-label="Laboratorios de la óptica" className="mt-3 space-y-1.5">
            {lista.length === 0 && <li className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-center text-sm text-slate-500">Todavía no hay laboratorios. Agrega el primero abajo: así podrás elegirlo en cada venta con lunas.</li>}
            {lista.map((l) => (
              <li key={l.nombre} className={"flex flex-wrap items-center gap-2 rounded-lg border border-slate-200/60 px-3 py-2 " + (l.activo ? "bg-slate-50" : "bg-white")}>
                {editando === l.nombre ? (
                  <div className="min-w-0 flex-1">
                    <input autoFocus value={texto} maxLength={MAX_NOMBRE_LABORATORIO} aria-label={`Nuevo nombre de ${l.nombre}`} onChange={(e) => { setTexto(e.target.value); setErrorEdicion("") }}
                      onKeyDown={(e) => { if (e.key === "Enter") guardarEdicion(); if (e.key === "Escape") { setEditando(null); setErrorEdicion("") } }}
                      className="w-full rounded-md border border-blue-300 bg-white px-2 py-1 text-sm text-slate-800 outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-50" />
                    {errorEdicion && <p role="alert" className="mt-1 text-xs font-medium text-red-600">{errorEdicion}</p>}
                  </div>
                ) : (
                  <span className={"min-w-0 flex-1 truncate text-sm font-medium " + (l.activo ? "text-slate-800" : "text-slate-500")} title={l.nombre}>{l.nombre}</span>
                )}
                <Insignia tono={l.activo ? "verde" : "gris"}>{l.activo ? "Activo" : "Desactivado"}</Insignia>
                {editando === l.nombre ? (
                  <>
                    <button type="button" onClick={guardarEdicion} disabled={guardando} className="rounded-lg px-3 py-1 text-sm font-semibold text-white cursor-pointer disabled:opacity-60" style={{ background: GRAD_MARCA }}>Guardar</button>
                    <button type="button" onClick={() => { setEditando(null); setErrorEdicion("") }} className="rounded-lg border border-slate-200/60 px-3 py-1 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">Cancelar</button>
                  </>
                ) : (
                  <>
                    <button type="button" onClick={() => { setEditando(l.nombre); setTexto(l.nombre); setErrorEdicion("") }} aria-label={`Editar ${l.nombre}`} title="Editar el nombre" className="rounded p-1.5 text-slate-500 transition-colors hover:bg-white hover:text-blue-600 cursor-pointer"><Pencil size={15} aria-hidden="true" /></button>
                    <button type="button" onClick={() => alternar(l)} disabled={guardando} aria-label={`${l.activo ? "Desactivar" : "Activar"} ${l.nombre}`} title={l.activo ? "Desactivar: deja de ofrecerse" : "Activar: vuelve a ofrecerse"} className="rounded p-1.5 text-slate-500 transition-colors hover:bg-white hover:text-amber-700 cursor-pointer disabled:opacity-60"><Power size={15} aria-hidden="true" /></button>
                  </>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-2.5 flex gap-2">
            <div className="min-w-0 flex-1">
              <input value={nuevo} maxLength={MAX_NOMBRE_LABORATORIO} aria-label="Nombre del laboratorio nuevo" onChange={(e) => { setNuevo(e.target.value); setErrorNuevo("") }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregar() } }}
                placeholder="Ej. Laboratorio Visión Norte" className="w-full rounded-lg border border-slate-200/60 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition-colors focus-visible:border-blue-500" />
              {errorNuevo && <p role="alert" className="mt-1 text-xs font-medium text-red-600">{errorNuevo}</p>}
            </div>
            <button type="button" onClick={agregar} disabled={!nuevo.trim() || guardando} className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer" style={{ background: GRAD_MARCA }}>
              <Plus size={14} aria-hidden="true" /> Agregar laboratorio
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
