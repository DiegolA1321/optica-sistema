"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, ClipboardCheck, Search } from "lucide-react"
import { Cascaron } from "../AtencionPaciente"
import MiniaturaProducto from "../MiniaturaProducto"
import { diferenciasConteo, resumenConteo } from "../../utilidades/inventarioKardex"
import { formatoFecha } from "../../utilidades/formatoFecha"
import { ahoraEcuador } from "../../utilidades/horaEcuador"
import { GRAD_MARCA } from "@/lib/tema"

const signo = (n) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0")
const TONO = (n) => (n > 0 ? "text-emerald-700" : n < 0 ? "text-red-600" : "text-slate-500")

// El conteo físico: se escribe cuántas unidades hay de cada producto, el sistema muestra las diferencias y, al confirmar, las registra
// como ajustes por conteo con el motivo «Conteo físico» (la fecha queda en cada movimiento). Lo que no se cuenta no cambia.
export default function ConteoFisico({ productos, categorias, onConfirmar, onCerrar }) {
  const [paso, setPaso] = useState("contar") // contar | revisar
  const [contados, setContados] = useState({})
  const [busqueda, setBusqueda] = useState("")
  const [categoria, setCategoria] = useState("Todas")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")

  const filas = useMemo(() => diferenciasConteo(productos, contados), [productos, contados])
  const resumen = useMemo(() => resumenConteo(filas), [filas])
  const porId = useMemo(() => new Map(filas.map((f) => [f.producto.id, f])), [filas])
  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return productos.filter((p) => (categoria === "Todas" || p.categoria === categoria) && (!q || `${p.nombre} ${p.codigo || ""} ${p.marca || ""}`.toLowerCase().includes(q)))
  }, [productos, busqueda, categoria])
  const hoy = formatoFecha(ahoraEcuador(), "largo")

  const confirmar = async () => {
    setGuardando(true)
    setError("")
    const mensaje = await onConfirmar(resumen.conDiferencia.map((f) => ({ producto_id: f.producto.id, contado: f.contado })))
    setGuardando(false)
    if (mensaje) setError(mensaje)
  }

  const boton = "rounded-lg border border-slate-200/60 px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer"

  return (
    <Cascaron
      titulo="Conteo físico" subtitulo={paso === "contar" ? `${hoy} · escribe lo que cuentas en el estante` : `${hoy} · revisa las diferencias antes de confirmar`}
      Icono={ClipboardCheck} ancho="max-w-3xl" onCerrar={() => !guardando && onCerrar()}
      pie={paso === "contar" ? (
        <>
          <span className="text-sm text-slate-600" aria-live="polite">
            {resumen.contados === 0 ? "Todavía no has contado ningún producto." : `${resumen.contados} contado${resumen.contados === 1 ? "" : "s"} · ${resumen.conDiferencia.length} con diferencia${resumen.invalidos ? ` · ${resumen.invalidos} sin sentido` : ""}`}
          </span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onCerrar} className={boton}>Cancelar</button>
            <button type="button" onClick={() => setPaso("revisar")} disabled={resumen.contados === 0 || resumen.invalidos > 0} className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50" style={{ background: GRAD_MARCA }}>Revisar diferencias</button>
          </div>
        </>
      ) : (
        <>
          <span className="text-sm text-slate-600">{resumen.conDiferencia.length === 0 ? "Todo coincide." : `${resumen.conDiferencia.length} ajuste${resumen.conDiferencia.length === 1 ? "" : "s"} por conteo`}</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => { setPaso("contar"); setError("") }} disabled={guardando} className={boton}>Volver a contar</button>
            {resumen.conDiferencia.length > 0
              ? <button type="button" onClick={confirmar} disabled={guardando} className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer disabled:opacity-60" style={{ background: GRAD_MARCA }}>{guardando ? "Registrando…" : "Confirmar conteo"}</button>
              : <button type="button" onClick={onCerrar} className={boton}>Cerrar</button>}
          </div>
        </>
      )}
    >
      {paso === "contar" ? (
        <div className="space-y-3 px-5 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} aria-hidden="true" />
              <input type="text" aria-label="Buscar producto para contar" placeholder="Buscar producto…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                className="w-full rounded-xl border border-slate-200/60 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none transition-colors focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50" />
            </div>
            <div role="group" aria-label="Categoría" className="flex flex-wrap gap-1.5">
              {["Todas", ...categorias].map((c) => (
                <button key={c} type="button" aria-pressed={categoria === c} onClick={() => setCategoria(c)}
                  className={"rounded-full border px-3 py-1 text-xs font-semibold transition-colors cursor-pointer " + (categoria === c ? "border-blue-600 text-white" : "border-slate-200 text-slate-600 hover:bg-slate-50")}
                  style={categoria === c ? { background: GRAD_MARCA } : undefined}>{c}</button>
              ))}
            </div>
          </div>
          {productos.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">No hay productos para contar.</p>
          ) : visibles.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Ningún producto coincide con la búsqueda.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200/60">
              <table className="w-full table-fixed border-collapse text-left text-sm">
                <caption className="sr-only">Productos para contar</caption>
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <th scope="col" className="px-3 py-2">Producto</th>
                    <th scope="col" className="w-[90px] px-3 py-2 text-right">Sistema</th>
                    <th scope="col" className="w-[120px] px-3 py-2 text-right">Contado</th>
                    <th scope="col" className="w-[100px] px-3 py-2 text-right">Diferencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {visibles.map((p) => {
                    const f = porId.get(p.id)
                    return (
                      <tr key={p.id}>
                        <td className="px-3 py-1.5">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <MiniaturaProducto url={p.imagen_url} alt="" size={28} />
                            <div className="min-w-0"><p className="truncate font-semibold text-slate-800">{p.nombre}</p><p className="truncate text-xs text-slate-500">{[p.categoria, p.codigo].filter(Boolean).join(" · ")}</p></div>
                          </div>
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono tabular-nums text-slate-600">{Number(p.stock) || 0}</td>
                        <td className="px-3 py-1.5 text-right">
                          <input type="number" min="0" step="1" inputMode="numeric" aria-label={`Contado de ${p.nombre}`} value={contados[p.id] ?? ""} onChange={(e) => setContados((c) => ({ ...c, [p.id]: e.target.value }))}
                            className={"w-20 rounded-lg border bg-white px-2 py-1.5 text-right font-mono text-sm outline-none transition-colors focus-visible:ring-2 " + (f && !f.valido ? "border-red-400 focus-visible:ring-red-100" : "border-slate-200 focus-visible:border-blue-500 focus-visible:ring-blue-50")} />
                        </td>
                        <td className={"px-3 py-1.5 text-right font-mono font-bold tabular-nums " + (f?.valido ? TONO(f.diferencia) : "text-slate-400")}>{f?.valido ? signo(f.diferencia) : "—"}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="text-xs text-slate-500">Solo se ajusta lo que cuentes. Un producto que no escribas queda como está.</p>
        </div>
      ) : (
        <div className="space-y-3 px-5 py-4">
          {resumen.conDiferencia.length === 0 ? (
            <div className="flex flex-col items-center gap-1.5 py-8 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-600"><ClipboardCheck size={22} aria-hidden="true" /></div>
              <p className="text-sm font-semibold text-slate-700">Lo contado coincide con el sistema: no hay nada que ajustar.</p>
              <p className="text-xs text-slate-500">{resumen.iguales} producto{resumen.iguales === 1 ? "" : "s"} contado{resumen.iguales === 1 ? "" : "s"}.</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-slate-600">Se registrarán estos ajustes como «Conteo físico» del {hoy.toLowerCase()}. {resumen.iguales > 0 ? `${resumen.iguales} producto${resumen.iguales === 1 ? "" : "s"} coincide${resumen.iguales === 1 ? "" : "n"} y no cambia${resumen.iguales === 1 ? "" : "n"}.` : ""}</p>
              <div className="overflow-hidden rounded-xl border border-slate-200/60">
                <table className="w-full table-fixed border-collapse text-left text-sm">
                  <caption className="sr-only">Diferencias del conteo</caption>
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/70 text-xs font-bold uppercase tracking-wide text-slate-500">
                      <th scope="col" className="px-3 py-2">Producto</th>
                      <th scope="col" className="w-[90px] px-3 py-2 text-right">Sistema</th>
                      <th scope="col" className="w-[90px] px-3 py-2 text-right">Contado</th>
                      <th scope="col" className="w-[100px] px-3 py-2 text-right">Diferencia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {resumen.conDiferencia.map((f) => (
                      <tr key={f.producto.id}>
                        <td className="truncate px-3 py-2 font-semibold text-slate-800">{f.producto.nombre}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-600">{f.esperado}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-800">{f.contado}</td>
                        <td className={"px-3 py-2 text-right font-mono font-bold tabular-nums " + TONO(f.diferencia)}>{signo(f.diferencia)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-slate-600">Sobran <strong className="text-emerald-700">{resumen.sobrantes}</strong> unidad{resumen.sobrantes === 1 ? "" : "es"} y faltan <strong className="text-red-600">{resumen.faltantes}</strong>.</p>
            </>
          )}
          {error && <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200/60 bg-red-50 p-2.5 text-xs font-medium text-red-700"><AlertTriangle size={14} aria-hidden="true" /> {error}</div>}
        </div>
      )}
    </Cascaron>
  )
}
