"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { BarChart3, Clock, Timer, Inbox, MessageSquareText, Pencil, Plus, Search, Trash2, X } from "lucide-react"
import { GRAD_MARCA, INK } from "@/lib/tema"
import { MODO_SAAS_VISIBLE } from "@/lib/config"
import { Cascaron, PieFormulario } from "../AtencionPaciente"
import { ContenedorLista, EncabezadoLista, Vacio } from "../ventas/Lista"
import { CLASE_ACCION_PRINCIPAL, CLASE_ACCION_SECUNDARIA, plural } from "../ventas/estilos"
import { InsigniaEstado, InsigniaUrgencia } from "./piezas"
import { NOMBRE_PRUEBA_PLURAL } from "../superadmin/piezas"
import VentanaConsultaSoporte from "./VentanaConsultaSoporte"
import {
  TIEMPO_ESTIMADO, ESTADOS_CONSULTA, MODULOS_SOPORTE, PERIODOS_SOPORTE, URGENCIAS, codigoConsulta, desdeDePeriodo, duracionLegible, filtrarBandeja, indicadoresSoporte, nombreModulo, ordenarBandeja,
} from "../../utilidades/soporte"
import { borrarRespuestaGuardada, guardarAjustesSoporte, guardarRespuestaGuardada, leerAjustesSoporte, leerRespuestasGuardadas } from "../../utilidades/soporteDatos"
import { fechaHoraLegible, fechaLegible, tituloSemana } from "../../utilidades/formatoFecha"
import { instanteInicio, instanteFin } from "../../utilidades/superadminNegocio"
import { diaDeRegistro } from "../../utilidades/periodoLista"

const COLUMNAS = "lg:grid-cols-[5.5rem_minmax(0,2fr)_minmax(0,1.2fr)_6rem_9rem_7rem]"
const ENCABEZADO = [{ texto: "Número" }, { texto: "Asunto" }, { texto: "Óptica" }, { texto: "Urgencia" }, { texto: "Estado" }, { texto: "Última actividad" }]
const SELECT = "rounded-xl border border-slate-200/60 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none transition-colors focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-50"
const FILTROS_INICIALES = { estado: "abiertas", urgencia: "", modulo: "", opticaId: "", busqueda: "" }
const TABS = [
  { id: "consultas", etiqueta: "Consultas", Icono: Inbox },
  { id: "indicadores", etiqueta: "Indicadores", Icono: BarChart3 },
  { id: "respuestas", etiqueta: "Respuestas guardadas", Icono: MessageSquareText },
  { id: "tiempos", etiqueta: "Tiempos de respuesta", Icono: Timer },
]

function Tarjeta({ titulo, valor, nota, onClick, alerta = false }) {
  const Cuerpo = (
    <>
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{titulo}</p>
      <p className="mt-1 font-serif text-3xl font-semibold leading-none" style={{ color: INK }}>{valor}</p>
      <p className="mt-1.5 text-xs font-semibold" style={{ color: alerta ? "#B45309" : "#64748B" }}>{nota}</p>
    </>
  )
  const base = "rounded-2xl border bg-white p-5 text-left shadow-sm " + (alerta ? "border-amber-300" : "border-slate-200/60")
  return onClick
    ? <button type="button" onClick={onClick} className={base + " transition-transform hover:-translate-y-0.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"}>{Cuerpo}</button>
    : <div className={base}>{Cuerpo}</div>
}

// ─── Respuestas guardadas ───
function VentanaRespuesta({ respuesta, onGuardar, onCerrar }) {
  const [titulo, setTitulo] = useState(respuesta?.titulo || "")
  const [texto, setTexto] = useState(respuesta?.texto || "")
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  const enviar = async (e) => {
    e.preventDefault()
    if (titulo.trim().length < 3 || texto.trim().length < 3) { setError("Escribe un título y el texto de la respuesta."); return }
    setGuardando(true)
    const r = await guardarRespuestaGuardada({ id: respuesta?.id, titulo: titulo.trim(), texto: texto.trim() })
    setGuardando(false)
    if (r.error) { setError(r.error); return }
    onGuardar()
  }
  const campo = "w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition-colors focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50"
  return (
    <Cascaron titulo={respuesta ? "Editar respuesta guardada" : "Nueva respuesta guardada"} subtitulo="Un texto listo para las preguntas comunes" Icono={MessageSquareText} onCerrar={onCerrar} ancho="max-w-lg" formulario={{ onSubmit: enviar }}
      pie={<PieFormulario onCancelar={onCerrar} etiquetaGuardar="Guardar" guardando={guardando} />}>
      <div className="space-y-4 px-5 py-4">
        <div>
          <label htmlFor="rg-titulo" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Título</label>
          <input id="rg-titulo" value={titulo} maxLength={80} onChange={(e) => setTitulo(e.target.value)} placeholder="Ej. Cómo restablecer una clave" className={campo} />
        </div>
        <div>
          <label htmlFor="rg-texto" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Texto</label>
          <textarea id="rg-texto" rows={6} value={texto} maxLength={2000} onChange={(e) => setTexto(e.target.value)} className={campo + " resize-none"} />
        </div>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
      </div>
    </Cascaron>
  )
}

function PestanaRespuestas({ respuestas, cargando, error, onRecargar, onToast }) {
  const [ventana, setVentana] = useState(null) // null | "nueva" | respuesta
  const [aBorrar, setABorrar] = useState(null)
  const borrar = async (r) => {
    const x = await borrarRespuestaGuardada(r.id)
    setABorrar(null)
    if (x.error) { onToast?.("error", x.error); return }
    onToast?.("exito", "Respuesta borrada.")
    onRecargar()
  }
  return (
    <div className="space-y-3">
      <div className="flex min-h-9 flex-wrap items-center justify-between gap-3 px-1">
        <p role="status" className="text-sm font-semibold text-slate-600">{plural(respuestas.length, "respuesta guardada", "respuestas guardadas")}</p>
        <button type="button" onClick={() => setVentana("nueva")} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}><Plus size={14} aria-hidden="true" /> Nueva respuesta</button>
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
      {cargando ? <div className="h-32 animate-pulse rounded-2xl bg-slate-100" /> : respuestas.length === 0 ? (
        <Vacio Icono={MessageSquareText} titulo="Todavía no hay respuestas guardadas" texto="Guarda aquí los textos que repites (cómo restablecer una clave, cómo ver un reporte) y insértalos con un clic al responder.">
          <button type="button" onClick={() => setVentana("nueva")} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}>Crear la primera respuesta</button>
        </Vacio>
      ) : (
        <ul role="list" aria-label="Respuestas guardadas" className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
          {respuestas.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-bold" style={{ color: INK }}>{r.titulo}</p>
                <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-sm text-slate-600">{r.texto}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button type="button" onClick={() => setVentana(r)} aria-label={`Editar ${r.titulo}`} title="Editar" className="rounded-lg p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-600 cursor-pointer"><Pencil size={15} aria-hidden="true" /></button>
                {aBorrar === r.id
                  ? <><button type="button" onClick={() => borrar(r)} className="rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-red-700 cursor-pointer">Borrar</button><button type="button" onClick={() => setABorrar(null)} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer">No</button></>
                  : <button type="button" onClick={() => setABorrar(r.id)} aria-label={`Borrar ${r.titulo}`} title="Borrar" className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 cursor-pointer"><Trash2 size={15} aria-hidden="true" /></button>}
              </div>
            </li>
          ))}
        </ul>
      )}
      {ventana && <VentanaRespuesta respuesta={ventana === "nueva" ? null : ventana} onCerrar={() => setVentana(null)} onGuardar={() => { setVentana(null); onToast?.("exito", "Respuesta guardada."); onRecargar() }} />}
    </div>
  )
}

// ─── Tiempos de respuesta que se le dicen al usuario ───
function PestanaTiempos({ onToast }) {
  const [valores, setValores] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => { leerAjustesSoporte().then((r) => setValores({ tiempo_normal: r.datos.tiempo_normal || TIEMPO_ESTIMADO.normal, tiempo_urgente: r.datos.tiempo_urgente || TIEMPO_ESTIMADO.urgente })) }, [])
  if (!valores) return <div className="h-32 animate-pulse rounded-2xl bg-slate-100" />
  const invalido = Object.values(valores).some((v) => v.trim().length < 3)
  const guardar = async (e) => {
    e.preventDefault()
    setGuardando(true); setError("")
    const r = await guardarAjustesSoporte(valores)
    setGuardando(false)
    if (r.error) { setError(r.error); return }
    onToast?.("exito", "Tiempos de respuesta guardados.")
  }
  const campo = "w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition-colors focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50"
  return (
    <form onSubmit={guardar} className="max-w-xl space-y-4 rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-600">Es lo que se le dice a quien envía una consulta: «Te respondemos <em>…</em>». Escribe solo lo que puedas cumplir.</p>
      <div>
        <label htmlFor="ts-normal" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Consulta normal</label>
        <input id="ts-normal" value={valores.tiempo_normal} maxLength={80} onChange={(e) => setValores((v) => ({ ...v, tiempo_normal: e.target.value }))} className={campo} />
      </div>
      <div>
        <label htmlFor="ts-urgente" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Consulta urgente</label>
        <input id="ts-urgente" value={valores.tiempo_urgente} maxLength={80} onChange={(e) => setValores((v) => ({ ...v, tiempo_urgente: e.target.value }))} className={campo} />
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
      <button type="submit" disabled={guardando || invalido} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}>{guardando ? "Guardando…" : "Guardar"}</button>
    </form>
  )
}

// ─── Indicadores ───
function PestanaIndicadores({ consultas, ventana, onVerConsultas }) {
  const i = useMemo(() => indicadoresSoporte(consultas, ventana), [consultas, ventana])
  const maxModulo = Math.max(1, ...i.porModulo.map((m) => m.total))
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tarjeta titulo="Tiempo de primera respuesta" valor={duracionLegible(i.primeraRespuestaMin)} nota={i.primeraRespuestaMin === null ? "Aún no hay consultas respondidas" : "Mediana desde que la óptica escribe"} />
        <Tarjeta titulo="Tiempo de resolución" valor={duracionLegible(i.resolucionMin)} nota={i.resolucionMin === null ? "Aún no hay consultas resueltas" : "Mediana hasta que se resuelve"} />
        <Tarjeta titulo="Satisfacción" valor={i.satisfaccion === null ? "—" : `${i.satisfaccion} de 5`} nota={i.calificadas === 0 ? "Aún nadie calificó" : `Promedio de ${plural(i.calificadas, "calificación", "calificaciones")}`} />
        <Tarjeta titulo="Consultas abiertas" valor={i.abiertas} nota={i.urgentesAbiertas > 0 ? `${plural(i.urgentesAbiertas, "urgente", "urgentes")}` : "Ninguna urgente"} alerta={i.urgentesAbiertas > 0} onClick={() => onVerConsultas({ estado: "abiertas" })} />
      </div>
      <section aria-label="Módulos con más consultas" className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
        <h2 className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5 text-sm font-bold" style={{ color: INK }}>
          Módulos con más consultas <span className="text-xs font-semibold text-slate-500">{plural(i.total, "consulta", "consultas")} en total</span>
        </h2>
        {i.porModulo.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-slate-500">Todavía no hay consultas en este período.</p>
        ) : (
          <ul role="list" className="divide-y divide-slate-100">
            {i.porModulo.map((m) => (
              <li key={m.modulo}>
                <button type="button" onClick={() => onVerConsultas({ modulo: m.modulo, estado: "" })} aria-label={`Ver las ${m.total} consultas de ${m.nombre}`} className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-slate-50 cursor-pointer">
                  <span className="w-40 shrink-0 truncate text-sm font-semibold text-slate-700">{m.nombre}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100" aria-hidden="true"><span className="block h-full rounded-full" style={{ width: `${Math.round((m.total / maxModulo) * 100)}%`, background: GRAD_MARCA }} /></span>
                  <span className="w-8 shrink-0 text-right text-sm font-bold tabular-nums text-slate-700">{m.total}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

// El soporte del superadmin: la bandeja de consultas, sus indicadores y las respuestas guardadas. `consultas` viene del panel (la insignia del menú
// usa los mismos datos). `avisos` es el contenido de los avisos del sistema, que sigue como hoy.
// `inicial`: a dónde llegó desde otra sección ("Abrir en Soporte" del Resumen): { tab, estado, urgencia, rango: { inicio, fin }, clave }.
export default function SoporteSuperadmin({ consultas, cargando, error, onRecargar, opticas, onAuditoria, onToast, avisos, inicial = null, ocultas = 0 }) {
  const [tab, setTab] = useState(inicial?.tab || "consultas")
  const [filtros, setFiltros] = useState(FILTROS_INICIALES)
  const [periodo, setPeriodo] = useState("todo")
  // El período del Resumen (inicio y fin en días), para que los indicadores sean exactamente los mismos números.
  const [rangoResumen, setRangoResumen] = useState(inicial?.rango || null)
  const ventana = useMemo(() => (rangoResumen ? { desde: instanteInicio(rangoResumen.inicio), hasta: instanteFin(rangoResumen.fin) } : { desde: desdeDePeriodo(periodo) }), [rangoResumen, periodo])
  useEffect(() => {
    if (!inicial) return
    if (inicial.tab) setTab(inicial.tab)
    setRangoResumen(inicial.rango || null)
    setPeriodo("todo")
    if (inicial.tab === "consultas") setFiltros({ ...FILTROS_INICIALES, estado: inicial.estado || "abiertas", urgencia: inicial.urgencia || "" })
  }, [inicial?.clave]) // eslint-disable-line react-hooks/exhaustive-deps
  const [abierta, setAbierta] = useState(null)
  const [respuestas, setRespuestas] = useState([])
  const [cargandoRespuestas, setCargandoRespuestas] = useState(true)
  const [errorRespuestas, setErrorRespuestas] = useState("")

  const nombreOptica = useCallback((id) => opticas.find((o) => o.id === id)?.nombre || "", [opticas])
  const cargarRespuestas = useCallback(async () => {
    const r = await leerRespuestasGuardadas()
    setRespuestas(r.datos)
    setErrorRespuestas(r.error || "")
    setCargandoRespuestas(false)
  }, [])
  useEffect(() => { cargarRespuestas() }, [cargarRespuestas])

  const filtradas = useMemo(
    () => ordenarBandeja(filtrarBandeja(consultas, { ...filtros, estado: filtros.estado === "todas" ? "" : filtros.estado, ...ventana }, nombreOptica)),
    [consultas, filtros, ventana, nombreOptica],
  )
  const abiertas = consultas.filter((c) => c.estado !== "resuelta").length
  const conFiltros = JSON.stringify(filtros) !== JSON.stringify(FILTROS_INICIALES) || periodo !== "todo" || !!rangoResumen
  const consultaAbierta = abierta ? consultas.find((c) => c.id === abierta) : null
  const verConsultas = (cambios) => { setFiltros({ ...FILTROS_INICIALES, estado: "todas", ...cambios }); setTab("consultas") }
  const ponerFiltro = (k) => (e) => setFiltros((f) => ({ ...f, [k]: e.target.value }))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Secciones de Soporte" className="flex w-fit max-w-full items-center gap-1.5 overflow-x-auto rounded-xl border border-slate-200/60 bg-white p-1 shadow-sm">
          {[...TABS, { id: "avisos", etiqueta: MODO_SAAS_VISIBLE ? "Avisos, pagos y cumpleaños" : "Avisos y cumpleaños", Icono: Clock }].map(({ id, etiqueta, Icono }) => {
            const activo = tab === id
            return (
              <button key={id} type="button" role="tab" id={`sa-tab-${id}`} aria-selected={activo} aria-controls="sa-panel" onClick={() => setTab(id)}
                className={"flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition-colors cursor-pointer " + (activo ? "text-white" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800")} style={activo ? { background: GRAD_MARCA } : undefined}>
                <Icono size={14} aria-hidden="true" /> {etiqueta}
                {id === "consultas" && <span className={"rounded-full px-1.5 py-0.5 text-xs font-bold " + (activo ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500")}>{abiertas}</span>}
                {id === "respuestas" && <span className={"rounded-full px-1.5 py-0.5 text-xs font-bold " + (activo ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500")}>{respuestas.length}</span>}
              </button>
            )
          })}
        </div>
        {(tab === "consultas" || tab === "indicadores") && (
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
            Período
            <select value={rangoResumen ? "resumen" : periodo} onChange={(e) => { setRangoResumen(null); setPeriodo(e.target.value === "resumen" ? "todo" : e.target.value) }} className={SELECT}>
              {rangoResumen && <option value="resumen">Período del Resumen · {tituloSemana(rangoResumen.inicio, rangoResumen.fin)}</option>}
              {PERIODOS_SOPORTE.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </label>
        )}
      </div>

      <div id="sa-panel" role="tabpanel" aria-labelledby={`sa-tab-${tab}`}>
        {error && <p role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}<button type="button" onClick={onRecargar} className={CLASE_ACCION_SECUNDARIA}>Reintentar</button></p>}

        {tab === "consultas" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[14rem] flex-1">
                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                <input type="search" value={filtros.busqueda} onChange={ponerFiltro("busqueda")} placeholder={MODO_SAAS_VISIBLE ? "Buscar: número, asunto, persona u óptica" : "Buscar: número, asunto o persona"} aria-label="Buscar consultas" className="w-full rounded-xl border border-slate-200/60 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-50 [&::-webkit-search-cancel-button]:hidden" />
              </div>
              <select value={filtros.estado} onChange={ponerFiltro("estado")} aria-label="Filtrar por estado" className={SELECT}>
                <option value="abiertas">Abiertas</option><option value="todas">Todos los estados</option>
                {ESTADOS_CONSULTA.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </select>
              <select value={filtros.urgencia} onChange={ponerFiltro("urgencia")} aria-label="Filtrar por urgencia" className={SELECT}><option value="">Toda urgencia</option>{URGENCIAS.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}</select>
              <select value={filtros.modulo} onChange={ponerFiltro("modulo")} aria-label="Filtrar por módulo" className={SELECT}><option value="">Todos los módulos</option>{MODULOS_SOPORTE.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}</select>
              {(MODO_SAAS_VISIBLE || opticas.length > 1) && <select value={filtros.opticaId} onChange={ponerFiltro("opticaId")} aria-label="Filtrar por óptica" className={SELECT + " max-w-[14rem]"}><option value="">Todas las ópticas</option>{opticas.map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}</select>}
              {conFiltros && <button type="button" onClick={() => { setFiltros(FILTROS_INICIALES); setPeriodo("todo"); setRangoResumen(null) }} className={CLASE_ACCION_SECUNDARIA}><X size={14} aria-hidden="true" /> Limpiar</button>}
            </div>
            <p role="status" className="px-1 text-sm font-semibold text-slate-600">{plural(filtradas.length, "consulta", "consultas")}{filtros.estado === "abiertas" && " abiertas"}</p>
            {cargando ? <div className="h-40 animate-pulse rounded-2xl bg-slate-100" /> : filtradas.length === 0 ? (
              <Vacio Icono={Inbox} titulo={consultas.length === 0 ? (ocultas > 0 ? (MODO_SAAS_VISIBLE ? "No hay consultas de ópticas reales" : "No hay consultas de la óptica") : "Todavía no hay consultas") : "Ninguna consulta coincide"} texto={consultas.length === 0 ? (ocultas > 0 ? `Hay ${ocultas} de ${NOMBRE_PRUEBA_PLURAL} que no se muestran por defecto: usa «Incluir ${NOMBRE_PRUEBA_PLURAL}» para verlas.` : "Cuando una óptica escriba al soporte, su consulta aparecerá aquí, con las urgentes primero.") : "Prueba con otros filtros."}>
                {conFiltros && <button type="button" onClick={() => { setFiltros(FILTROS_INICIALES); setPeriodo("todo"); setRangoResumen(null) }} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}>Limpiar los filtros</button>}
              </Vacio>
            ) : (
              <ContenedorLista etiqueta="Consultas de soporte" encabezado={<EncabezadoLista plantilla={COLUMNAS} etiquetas={ENCABEZADO} />}>
                {filtradas.map((c) => {
                  const espera = c.estado !== "resuelta" && c.ultimoMensajeDe === "optica"
                  return (
                    <li key={c.id} className={"grid grid-cols-1 items-center gap-x-3 gap-y-1 px-4 py-3 " + COLUMNAS + (c.urgencia === "urgente" && c.estado !== "resuelta" ? " bg-red-50/40" : "")}>
                      <span className="font-mono text-sm font-bold text-slate-700">{codigoConsulta(c.numero)}</span>
                      <div className="min-w-0">
                        <button type="button" onClick={() => setAbierta(c.id)} className="block max-w-full truncate text-left text-sm font-bold hover:text-blue-700 hover:underline underline-offset-2 cursor-pointer" style={{ color: INK }}>{c.asunto}</button>
                        <p className="truncate text-xs text-slate-500">{c.autorNombre} · {nombreModulo(c.modulo)}</p>
                      </div>
                      <p className="truncate text-sm text-slate-600">{nombreOptica(c.opticaId) || "—"}</p>
                      <div className="min-h-[1.5rem]"><InsigniaUrgencia urgencia={c.urgencia} /></div>
                      <div><InsigniaEstado estado={c.estado} />{espera && <p className="mt-0.5 text-xs font-semibold text-amber-700">Espera tu respuesta</p>}</div>
                      <p className="text-sm text-slate-600" title={fechaHoraLegible(c.actualizadaEn || c.creadaEn, { anio: true })}>{fechaLegible(diaDeRegistro(c.actualizadaEn || c.creadaEn))}</p>
                    </li>
                  )
                })}
              </ContenedorLista>
            )}
          </div>
        )}

        {tab === "indicadores" && (cargando ? <div className="h-40 animate-pulse rounded-2xl bg-slate-100" /> : <PestanaIndicadores consultas={consultas} ventana={ventana} onVerConsultas={verConsultas} />)}
        {tab === "respuestas" && <PestanaRespuestas respuestas={respuestas} cargando={cargandoRespuestas} error={errorRespuestas} onRecargar={cargarRespuestas} onToast={onToast} />}
        {tab === "tiempos" && <PestanaTiempos onToast={onToast} />}
        {tab === "avisos" && avisos}
      </div>

      {consultaAbierta && (
        <VentanaConsultaSoporte consulta={consultaAbierta} opticaNombre={nombreOptica(consultaAbierta.opticaId)} respuestasGuardadas={respuestas} onAuditoria={onAuditoria} onCambio={onRecargar} onCerrar={() => setAbierta(null)} />
      )}
    </div>
  )
}
