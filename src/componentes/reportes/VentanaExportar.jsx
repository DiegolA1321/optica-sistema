"use client"

import { useMemo, useState } from "react"
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react"
import { Cascaron } from "../AtencionPaciente"
import CampoFecha from "../CampoFecha"
import { INK, GRAD_MARCA } from "@/lib/tema"
import { formatoFecha } from "../../utilidades/formatoFecha"
import { descargarModelo } from "../../utilidades/reportesExcel"
import { imprimirReporte } from "../../utilidades/reportesPdf"
import { catalogoExportaciones, MODULOS } from "./catalogo"

const NOMBRE_PESTANA = Object.fromEntries(MODULOS.map((m) => [m.id, m.etiqueta]))
const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms))

// "Exportar", ordenado por módulo (las mismas pestañas de Reportes): se elige un módulo, se marcan uno o varios de sus reportes (la
// selección sigue al cambiar de módulo) y se pulsa Exportar. Arriba se eligen las fechas: las de la pantalla u otras. Los reportes
// "a hoy" (inventario, órdenes pendientes, campaña) no siguen fechas. Cada rol ve solo lo que puede usar.
export default function VentanaExportar({ r, pestana, onCerrar }) {
  const { usuario, rango: rangoPantalla, onAviso } = r
  const [modo, setModo] = useState("pantalla") // pantalla | otras
  const [otras, setOtras] = useState({ inicio: rangoPantalla.inicio, fin: rangoPantalla.fin })
  const [modulo, setModulo] = useState(pestana)
  const [elegidos, setElegidos] = useState(() => new Set())
  const [incluirNoCompraron, setIncluirNoCompraron] = useState(false)
  const [ocupado, setOcupado] = useState(false)

  const rango = modo === "pantalla" ? rangoPantalla : { inicio: otras.inicio || rangoPantalla.inicio, fin: otras.fin || rangoPantalla.fin }
  const catalogo = useMemo(() => catalogoExportaciones(r, rango, { incluirNoCompraron }), [r, rango.inicio, rango.fin, incluirNoCompraron]) // eslint-disable-line react-hooks/exhaustive-deps
  const modulos = MODULOS.filter((m) => catalogo.some((x) => x.modulo === m.id))
  const actual = modulos.find((m) => m.id === modulo) || modulos[0]
  const delModulo = catalogo.filter((x) => x.modulo === actual.id)
  const marcadosEn = (id) => catalogo.filter((x) => x.modulo === id && elegidos.has(x.id)).length
  const total = catalogo.filter((x) => elegidos.has(x.id)).length

  // Solo un PDF a la vez (cada uno es una pestaña distinta que se imprime).
  const alternar = (x) => setElegidos((e) => {
    const n = new Set(e)
    if (n.has(x.id)) n.delete(x.id)
    else { if (x.pdf) for (const o of catalogo) if (o.pdf) n.delete(o.id); n.add(x.id) }
    return n
  })
  const todosDelModulo = delModulo.every((x) => elegidos.has(x.id))
  const marcarModulo = () => setElegidos((e) => {
    const n = new Set(e)
    for (const x of delModulo) { if (todosDelModulo) n.delete(x.id); else if (!x.pdf || !catalogo.some((o) => o.pdf && n.has(o.id))) n.add(x.id) }
    return n
  })

  const ctx = { usuario, opticaNombre: usuario?.opticaNombre, usuarioNombre: usuario?.nombre, rango, filtrosTexto: r.filtrosActivosTexto }
  const exportar = async () => {
    const lista = catalogo.filter((x) => elegidos.has(x.id)).sort((a, b) => Number(!!a.pdf) - Number(!!b.pdf))
    if (lista.length === 0) return
    setOcupado(true)
    let bien = true
    let pdf = null
    try {
      for (const x of lista) {
        if (x.pdf) { pdf = x; continue }
        const modelo = x.modelo()
        if (modelo.filas.length === 0) { onAviso?.(`No hay datos para «${x.nombre}» con estos filtros y fechas: no se descargó nada.`); continue }
        await descargarModelo(modelo, ctx)
        onAviso?.(`Se descargó «${modelo.titulo}» (${modelo.filas.length} ${modelo.cuenta || "filas"}).`)
      }
    } catch {
      bien = false
      onAviso?.("No se pudo descargar uno de los reportes. Vuelve a intentarlo.")
    } finally {
      setOcupado(false)
    }
    if (!bien) return
    onCerrar()
    if (pdf) {
      // El PDF es la pestaña tal como se ve: se pasa a esa pestaña y se imprime cuando ya está dibujada.
      r.setPestana(pdf.modulo)
      await esperar(500)
      if (!imprimirReporte({ panelId: "rep-panel", opticaNombre: usuario?.opticaNombre, pestana: NOMBRE_PESTANA[pdf.modulo], rango: rangoPantalla, filtros: r.filtrosActivosTexto, usuarioNombre: usuario?.nombre })) onAviso?.("No se pudo preparar el reporte para imprimir. Vuelve a intentarlo.")
    }
  }

  return (
    <Cascaron
      titulo="Exportar"
      subtitulo="Elige las fechas, el módulo y los reportes que necesitas"
      Icono={FileSpreadsheet}
      ancho="max-w-3xl"
      onCerrar={onCerrar}
      pie={<>
        <span className="text-xs text-slate-500">Cada archivo lleva la óptica, las fechas, los filtros, el día y quién lo generó.</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onCerrar} className="rounded-lg border border-slate-200/60 px-3.5 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">Cerrar</button>
          <button type="button" onClick={exportar} disabled={ocupado || total === 0 || !!r.kardex?.cargando} className="flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer" style={{ background: GRAD_MARCA }}>
            {ocupado ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Download size={14} aria-hidden="true" />}
            {ocupado || r.kardex?.cargando ? "Preparando…" : total > 1 ? `Exportar (${total})` : "Exportar"}
          </button>
        </div>
      </>}
    >
      <div className="space-y-3 px-5 py-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2" role="group" aria-label="Fechas del reporte">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Fechas</span>
          <div className="flex rounded-lg border border-slate-200/60 p-0.5">
            <button type="button" aria-pressed={modo === "pantalla"} onClick={() => setModo("pantalla")} className={"rounded-md px-3 py-1.5 text-sm font-semibold transition-colors cursor-pointer " + (modo === "pantalla" ? "text-white" : "text-slate-600 hover:bg-slate-50")} style={modo === "pantalla" ? { background: GRAD_MARCA } : undefined}>Las de la pantalla · {formatoFecha(rangoPantalla.inicio, "medioSinAnio")} a {formatoFecha(rangoPantalla.fin, "medio")}</button>
            <button type="button" aria-pressed={modo === "otras"} onClick={() => setModo("otras")} className={"rounded-md px-3 py-1.5 text-sm font-semibold transition-colors cursor-pointer " + (modo === "otras" ? "text-white" : "text-slate-600 hover:bg-slate-50")} style={modo === "otras" ? { background: GRAD_MARCA } : undefined}>Elegir otras fechas</button>
          </div>
          {modo === "otras" && (
            <div className="flex items-start gap-2">
              <div className="w-44"><CampoFecha id="exp-desde" etiqueta="Exportar desde" valor={otras.inicio} onCambiar={(v) => setOtras((o) => ({ ...o, inicio: v }))} max={otras.fin || rangoPantalla.fin} /></div>
              <div className="w-44"><CampoFecha id="exp-hasta" etiqueta="Exportar hasta" valor={otras.fin} onCambiar={(v) => setOtras((o) => ({ ...o, fin: v }))} min={otras.inicio} /></div>
            </div>
          )}
        </div>

        <div role="tablist" aria-label="Módulos" className="flex gap-1 border-b border-slate-200/70">
          {modulos.map((m) => (
            <button key={m.id} type="button" role="tab" aria-selected={actual.id === m.id} onClick={() => setModulo(m.id)} className={"-mb-px flex items-center gap-1.5 border-b-2 px-3.5 py-2 text-sm font-semibold transition-colors cursor-pointer " + (actual.id === m.id ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700")}>
              {m.etiqueta}
              {marcadosEn(m.id) > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-blue-600 px-1 text-xs font-bold text-white">{marcadosEn(m.id)}</span>}
            </button>
          ))}
        </div>

        <ul className="grid gap-2.5 sm:grid-cols-2" aria-label={`Reportes de ${actual.etiqueta}`}>
          {delModulo.map((x) => {
            const marcado = elegidos.has(x.id)
            return (
              <li key={x.id} className={"rounded-xl border p-3 transition-colors " + (marcado ? "border-blue-300 bg-blue-50/50" : "border-slate-200/60 bg-white hover:border-slate-300")}>
                <label className="flex cursor-pointer items-start gap-2.5">
                  <input type="checkbox" checked={marcado} onChange={() => alternar(x)} aria-label={x.nombre} className="mt-0.5 h-4 w-4 shrink-0 accent-blue-600" />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm font-bold" style={{ color: INK }}>
                      {x.nombre}
                      <span className="flex items-center gap-1 text-xs font-semibold text-slate-500">{x.pdf ? <FileText size={12} aria-hidden="true" /> : <FileSpreadsheet size={12} aria-hidden="true" />}{x.formato || "Excel"}</span>
                      {x.aHoy && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-bold uppercase tracking-wider text-slate-500">A hoy</span>}
                    </span>
                    <span className="mt-0.5 block text-sm text-slate-500">{x.linea}</span>
                  </span>
                </label>
                {x.opcion === "noCompraron" && marcado && (
                  <label className="ml-6 mt-2 flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" checked={incluirNoCompraron} onChange={(e) => setIncluirNoCompraron(e.target.checked)} className="accent-blue-600" /> Incluir a los que consultaron y no compraron
                  </label>
                )}
              </li>
            )
          })}
        </ul>
        <button type="button" onClick={marcarModulo} className="text-sm font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">{todosDelModulo ? `Quitar los de ${actual.etiqueta}` : `Marcar todos los de ${actual.etiqueta}`}</button>
      </div>
    </Cascaron>
  )
}
