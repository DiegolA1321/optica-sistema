"use client"

import { useEffect, useMemo, useState } from "react"
import { ArrowRight, Building2, ChevronDown, Download, History, Search } from "lucide-react"
import { supabase } from "../../lib/supabaseClient"
import { INK, GRAD_MARCA } from "@/lib/tema"
import { MODO_SAAS_VISIBLE } from "@/lib/config"
import { Cascaron } from "../AtencionPaciente"
import SelectorPeriodo from "../reportes/SelectorPeriodo"
import { SinResultados } from "../reportes/bloques"
import { CabeceraSeccion, EtiquetasFiltros, EtiquetaPrueba, InterruptorPrueba, NOMBRE_PRUEBA_PLURAL } from "./piezas"
import { ahoraEcuador } from "../../utilidades/horaEcuador"
import { etiquetaFecha, fechaAISO } from "../../utilidades/disponibilidad"
import { fechaHoraLegible, formatoFecha, hora, tituloSemana } from "../../utilidades/formatoFecha"
import { rangoDePeriodo, diaDe } from "../../utilidades/reportesPeriodo"
import { modeloDeLista, descargarModelo } from "../../utilidades/reportesExcel"
import {
  TIPOS_ACTIVIDAD, tiposVisibles, tipoDeAccion, frasesDeAccion, textoDeAccion, nombreDestino, cambioDeAccion, filtrarActividad, contarPorTipo, idsDePrueba, instanteInicio, instanteFin,
} from "../../utilidades/superadminNegocio"

const TOPE = 1000
const SELECT = "mt-0.5 block h-9 rounded-lg border border-slate-200/60 bg-white px-2 text-sm font-normal text-slate-700 outline-none focus-visible:border-blue-500"

function Frase({ a }) {
  return (
    <p className="text-sm leading-snug text-slate-700">
      <span className="font-semibold" style={{ color: INK }}>{a.actor_nombre}</span>{" "}
      {frasesDeAccion(a, MODO_SAAS_VISIBLE).map((x, i) => (x.b ? <span key={i} className="font-semibold" style={{ color: INK }}>{x.t}</span> : <span key={i}>{x.t}</span>))}
    </p>
  )
}

// A dónde lleva el "Abrir en …" de cada acción: a la sección donde se ve aquello sobre lo que se actuó.
function destinoDeAccion(a, esPrueba) {
  const prueba = esPrueba ? { incluirPrueba: true } : {}
  switch (tipoDeAccion(a.accion)) {
    case "opticas": case "accesos": case "pagos":
      return a.optica_id ? { modulo: "opticas", etiqueta: "Abrir en Ópticas", params: { abrir: a.optica_id, estado: "Todas", ...prueba } } : { modulo: "opticas", etiqueta: "Abrir en Ópticas", params: {} }
    case "soporte": return { modulo: "soporte", etiqueta: "Abrir en Soporte", params: { tab: "consultas", estado: "todas", ...prueba } }
    case "avisos": return { modulo: "soporte", etiqueta: "Abrir los avisos en Soporte", params: { tab: "avisos" } }
    case "leads": return { modulo: "leads", etiqueta: "Abrir en Leads", params: {} }
    case "superadmins": return { modulo: "superadmins", etiqueta: "Abrir en Superadmins", params: {} }
    default: return null
  }
}

export function DetalleAccion({ a, opticaPrueba, onCerrar, onAbrir }) {
  const cambio = cambioDeAccion(a)
  const destino = destinoDeAccion(a, opticaPrueba)
  const tipo = TIPOS_ACTIVIDAD.find((t) => t.id === tipoDeAccion(a.accion))?.nombre || "Otras"
  const Dato = ({ etiqueta, children }) => (
    <div className="mt-2.5 first:mt-0">
      <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">{etiqueta}</dt>
      <dd className="mt-0.5 break-words text-sm font-semibold" style={{ color: INK }}>{children}</dd>
    </div>
  )
  const Bloque = ({ titulo, children }) => (
    <section>
      <h3 className="mb-2 border-b border-slate-200/60 pb-1.5 text-xs font-bold uppercase tracking-widest text-slate-500">{titulo}</h3>
      {children}
    </section>
  )
  return (
    <Cascaron
      titulo={textoDeAccion({ ...a, actor_nombre: "" }, MODO_SAAS_VISIBLE).replace(/^./, (c) => c.toUpperCase())}
      subtitulo={`${a.actor_nombre} · ${fechaHoraLegible(a.created_at, { anio: true })}`}
      Icono={History}
      ancho="max-w-2xl"
      onCerrar={onCerrar}
      pie={<>
        {destino ? <button type="button" onClick={() => { onCerrar(); onAbrir(destino.modulo, destino.params) }} className="flex items-center gap-1 text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">{destino.etiqueta} <ArrowRight size={14} aria-hidden="true" /></button> : <span />}
        <button type="button" onClick={onCerrar} className="rounded-lg border border-slate-200/60 px-3.5 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">Cerrar</button>
      </>}
    >
      <div className="grid grid-cols-1 gap-x-8 gap-y-5 px-5 py-4 sm:grid-cols-2">
        <Bloque titulo="La acción">
          <dl>
            <Dato etiqueta="Qué se hizo"><Frase a={{ ...a, actor_nombre: "" }} /></Dato>
            <Dato etiqueta="Tipo">{tipo}</Dato>
            <Dato etiqueta="Cuándo">{fechaHoraLegible(a.created_at, { anio: true })}</Dato>
          </dl>
        </Bloque>
        <Bloque titulo="Quién y dónde">
          <dl>
            <Dato etiqueta="Quién lo hizo">{a.actor_nombre}</Dato>
            <Dato etiqueta="Óptica">{a.optica_id ? <span className="flex flex-wrap items-center gap-1.5">{a.optica_nombre}{opticaPrueba && <EtiquetaPrueba />}</span> : <span className="font-normal text-slate-500">{nombreDestino(a, MODO_SAAS_VISIBLE) || "Ninguna en particular"}</span>}</Dato>
          </dl>
        </Bloque>
        <div className="sm:col-span-2">
          <Bloque titulo="Qué cambió">
            {cambio ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
                <div className="rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Antes · {cambio.campo}</p><p className="text-sm font-semibold" style={{ color: INK }}>{cambio.antes || "—"}</p></div>
                <ArrowRight size={16} className="mx-auto text-slate-400" aria-hidden="true" />
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2"><p className="text-xs font-bold uppercase tracking-wide text-blue-700">Después · {cambio.campo}</p><p className="text-sm font-semibold" style={{ color: INK }}>{cambio.despues || "—"}</p></div>
              </div>
            ) : a.detalle ? (
              <p className="text-sm text-slate-700">{a.detalle}</p>
            ) : (
              <p className="text-sm text-slate-500">Esta acción no cambia un dato que se pueda comparar.</p>
            )}
          </Bloque>
        </div>
      </div>
    </Cascaron>
  )
}

// La Actividad del superadmin: un registro de auditoría. Nada se borra ni se edita (la base lo impide). Se organiza por tipo de acción, se filtra
// por período, óptica, persona y texto, se agrupa por día y cada acción abre su detalle en la ventana estándar.
export default function ActividadSuperadmin({ opticas, superadmins, incluirPrueba, onIncluirPrueba, destino, recarga, usuario, onAbrir, onAviso }) {
  const [periodo, setPeriodo] = useState("mes")
  const [personalizado, setPersonalizado] = useState({ inicio: "", fin: "" })
  const [tipo, setTipo] = useState("todas")
  const [opticaId, setOpticaId] = useState("")
  const [actorId, setActorId] = useState("")
  const [busqueda, setBusqueda] = useState("")
  const [filas, setFilas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState("")
  const [version, setVersion] = useState(0)
  const [colapsados, setColapsados] = useState(() => new Set())
  const [abierta, setAbierta] = useState(null)

  const hoyClave = fechaAISO(ahoraEcuador())
  const hoy = useMemo(() => ahoraEcuador(), [hoyClave]) // eslint-disable-line react-hooks/exhaustive-deps
  const rango = useMemo(() => rangoDePeriodo(periodo, personalizado, hoy), [periodo, personalizado, hoy])
  const pruebas = useMemo(() => idsDePrueba(opticas), [opticas])

  // Si llegó desde otra sección ("Abrir en Actividad"), parte con esos filtros.
  useEffect(() => {
    if (!destino) return
    if (destino.tipo) setTipo(destino.tipo)
    if (destino.opticaId !== undefined) setOpticaId(destino.opticaId || "")
    if (destino.actorId !== undefined) setActorId(destino.actorId || "")
    if (destino.dia) { setPeriodo("personalizado"); setPersonalizado({ inicio: destino.dia, fin: destino.dia }) }
    else if (destino.desde) { setPeriodo("personalizado"); setPersonalizado({ inicio: destino.desde, fin: destino.hasta || fechaAISO(ahoraEcuador()) }) }
  }, [destino?.clave]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    let vigente = true
    setCargando(true)
    ;(async () => {
      let q = supabase.from("auditoria").select("*").gte("created_at", instanteInicio(rango.inicio)).lte("created_at", instanteFin(rango.fin)).order("created_at", { ascending: false }).limit(TOPE)
      if (opticaId) q = q.eq("optica_id", opticaId)
      if (actorId) q = q.eq("actor_id", actorId)
      const { data, error: e } = await q
      if (!vigente) return
      setError(e ? "No se pudo leer el registro de actividad." : "")
      setFilas(data || [])
      setCargando(false)
    })()
    return () => { vigente = false }
  }, [rango.inicio, rango.fin, opticaId, actorId, version, recarga])

  const filtros = { rango, opticaId, actorId, busqueda, incluirPrueba, opticas, saas: MODO_SAAS_VISIBLE }
  const visibles = useMemo(() => filtrarActividad(filas, { ...filtros, tipo }), [filas, tipo, busqueda, incluirPrueba, opticas]) // eslint-disable-line react-hooks/exhaustive-deps
  const conteo = useMemo(() => contarPorTipo(filas, filtros), [filas, busqueda, incluirPrueba, opticas]) // eslint-disable-line react-hooks/exhaustive-deps
  const ocultasPorPrueba = useMemo(() => (incluirPrueba ? 0 : filas.filter((a) => a.optica_id && pruebas.has(a.optica_id)).length), [filas, incluirPrueba, pruebas])
  const dias = useMemo(() => {
    const mapa = new Map()
    for (const a of visibles) { const d = diaDe(a.created_at); if (!mapa.has(d)) mapa.set(d, []); mapa.get(d).push(a) }
    return [...mapa.entries()]
  }, [visibles])

  const nombreActor = superadmins.find((s) => s.id === actorId)?.nombre
  const nombreOptica = opticas.find((o) => o.id === opticaId)?.nombre
  const etiquetas = [
    { id: "periodo", texto: `Período: ${tituloSemana(rango.inicio, rango.fin)}` },
    tipo !== "todas" && { id: "tipo", texto: `Tipo: ${TIPOS_ACTIVIDAD.find((t) => t.id === tipo)?.nombre}`, quitar: () => setTipo("todas") },
    opticaId && { id: "optica", texto: `Óptica: ${nombreOptica || "—"}`, quitar: () => setOpticaId("") },
    actorId && { id: "persona", texto: `Persona: ${nombreActor || "—"}`, quitar: () => setActorId("") },
    busqueda.trim() && { id: "busqueda", texto: `Texto: «${busqueda.trim()}»`, quitar: () => setBusqueda("") },
    incluirPrueba && { id: "prueba", texto: "Con " + NOMBRE_PRUEBA_PLURAL, quitar: () => onIncluirPrueba(false) },
  ].filter(Boolean)
  const limpiar = () => { setTipo("todas"); setOpticaId(""); setActorId(""); setBusqueda(""); onIncluirPrueba(false) }

  const exportar = async () => {
    if (visibles.length === 0) { onAviso?.("No hay actividad con estos filtros: no se descargó nada."); return }
    const columnas = [
      { titulo: "Fecha y hora", tipo: "texto", valor: (a) => fechaHoraLegible(a.created_at, { anio: true }) },
      { titulo: "Quién", tipo: "texto", valor: (a) => a.actor_nombre },
      { titulo: "Qué hizo", tipo: "texto", valor: (a) => textoDeAccion(a, MODO_SAAS_VISIBLE) },
      { titulo: "Óptica", tipo: "texto", valor: (a) => a.optica_nombre || "" },
      { titulo: "Tipo", tipo: "texto", valor: (a) => TIPOS_ACTIVIDAD.find((t) => t.id === tipoDeAccion(a.accion))?.nombre || "Otras" },
      { titulo: "Antes", tipo: "texto", valor: (a) => cambioDeAccion(a)?.antes || "" },
      { titulo: "Después", tipo: "texto", valor: (a) => cambioDeAccion(a)?.despues || "" },
    ]
    try {
      await descargarModelo(modeloDeLista({ titulo: "Actividad del superadmin", valor: visibles.length, columnas, filas: visibles, rango, personal: false }), { usuario: null, opticaNombre: "Panel del superadmin", usuarioNombre: usuario?.nombre, rango, filtrosTexto: etiquetas.filter((e) => e.id !== "periodo").map((e) => e.texto).join(" · ") || "ninguno" })
      onAviso?.(`Se descargó la actividad (${visibles.length} filas).`)
    } catch { onAviso?.("No se pudo descargar la actividad. Vuelve a intentarlo.") }
  }

  const alternar = (d) => setColapsados((prev) => { const s = new Set(prev); if (s.has(d)) s.delete(d); else s.add(d); return s })

  return (
    <div className="space-y-3" data-actividad>
      <CabeceraSeccion titulo="Actividad" pregunta={(MODO_SAAS_VISIBLE ? "¿Quién hizo qué, sobre qué óptica y cuándo?" : "¿Quién hizo qué y cuándo?") + " Es un registro: nada se borra ni se edita."}>
        <button type="button" onClick={exportar} className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer" style={{ background: GRAD_MARCA }}><Download size={15} aria-hidden="true" /> Exportar</button>
      </CabeceraSeccion>

      <div className="space-y-2 rounded-2xl border border-slate-200/60 bg-white px-3 py-2.5 shadow-sm" role="group" aria-label="Filtros">
        <div className="flex flex-wrap items-center gap-2">
          <SelectorPeriodo periodo={periodo} onPeriodo={setPeriodo} personalizado={personalizado} onPersonalizado={setPersonalizado} rango={rango} prefijo="act" />
          <InterruptorPrueba activo={incluirPrueba} onCambiar={onIncluirPrueba} cuantas={pruebas.size} />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="relative min-w-[14rem] flex-1 text-xs font-semibold text-slate-500">Buscar
            <Search size={15} className="pointer-events-none absolute bottom-2.5 left-2.5 text-slate-500" aria-hidden="true" />
            <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder={MODO_SAAS_VISIBLE ? "Persona, óptica o lo que se hizo" : "Persona o lo que se hizo"} aria-label="Buscar en la actividad" className={SELECT + " mt-0.5 w-full pl-8 [&::-webkit-search-cancel-button]:hidden"} />
          </label>
          {(MODO_SAAS_VISIBLE || incluirPrueba) && <label className="text-xs font-semibold text-slate-500">Óptica
            <select aria-label="Óptica" value={opticaId} onChange={(e) => setOpticaId(e.target.value)} className={SELECT + " w-52"}>
              <option value="">Todas</option>
              {opticas.filter((o) => incluirPrueba || !pruebas.has(o.id) || o.id === opticaId).map((o) => <option key={o.id} value={o.id}>{o.nombre}</option>)}
            </select>
          </label>}
          <label className="text-xs font-semibold text-slate-500">Persona
            <select aria-label="Persona" value={actorId} onChange={(e) => setActorId(e.target.value)} className={SELECT + " w-48"}>
              <option value="">Todas</option>
              {superadmins.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
            </select>
          </label>
          <EtiquetasFiltros etiquetas={etiquetas} onLimpiar={limpiar} />
        </div>
      </div>

      <div role="tablist" aria-label="Tipos de actividad" className="flex flex-wrap gap-x-0.5 border-b border-slate-200/70">
        {tiposVisibles(MODO_SAAS_VISIBLE).map((t) => (
          <button key={t.id} type="button" role="tab" id={`act-tab-${t.id}`} aria-selected={tipo === t.id} aria-controls="act-panel" onClick={() => setTipo(t.id)} className={"-mb-px flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-semibold transition-colors cursor-pointer " + (tipo === t.id ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700")}>
            {t.nombre}
            <span className={"rounded-full px-1.5 py-0.5 text-xs font-bold tabular-nums " + (tipo === t.id ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500")}>{conteo[t.id]}</span>
          </button>
        ))}
      </div>

      <div id="act-panel" role="tabpanel" aria-labelledby={`act-tab-${tipo}`} className="space-y-3 pb-6">
        {error && <p role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}<button type="button" onClick={() => setVersion((v) => v + 1)} className="rounded-lg border border-red-200 bg-white px-3 py-1 text-sm font-semibold text-red-700 hover:bg-red-50 cursor-pointer">Reintentar</button></p>}
        <p role="status" className="px-1 text-sm font-semibold text-slate-600">
          {cargando ? "Cargando…" : `${visibles.length} ${visibles.length === 1 ? "acción" : "acciones"}`}
          {filas.length >= TOPE && !cargando && <span className="ml-2 font-normal text-slate-500">Se muestran las {TOPE} más recientes; acota el período para ver las demás.</span>}
        </p>
        {cargando ? (
          <div className="space-y-2" aria-busy="true" aria-label="Cargando la actividad">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-200/70" />)}</div>
        ) : visibles.length === 0 ? (
          <SinResultados
            texto={ocultasPorPrueba > 0 && filas.length === ocultasPorPrueba ? `Toda la actividad de este período es de ${NOMBRE_PRUEBA_PLURAL} (${ocultasPorPrueba}). No se muestra por defecto.` : filas.length === 0 ? "No hay actividad en este período. Prueba con un período más largo." : "Ninguna acción coincide con estos filtros."}
            acciones={[
              ...(ocultasPorPrueba > 0 ? [{ etiqueta: "Incluir " + NOMBRE_PRUEBA_PLURAL, onClick: () => onIncluirPrueba(true) }] : []),
              ...(periodo !== "anio" ? [{ etiqueta: "Ver este año", onClick: () => setPeriodo("anio") }] : []),
            ]}
          />
        ) : (
          dias.map(([dia, items]) => {
            const cerrado = colapsados.has(dia)
            return (
              <section key={dia} className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm" aria-label={etiquetaFecha(dia)}>
                <button type="button" onClick={() => alternar(dia)} aria-expanded={!cerrado} className="flex w-full items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500/50">
                  <ChevronDown size={15} className={"shrink-0 text-slate-500 transition-transform " + (cerrado ? "-rotate-90" : "")} aria-hidden="true" />
                  <h2 className="text-sm font-bold" style={{ color: INK }}>{etiquetaFecha(dia)}</h2>
                  <span className="text-xs text-slate-500">· {items.length} {items.length === 1 ? "acción" : "acciones"}</span>
                </button>
                {!cerrado && (
                  <ul role="list" className="divide-y divide-slate-100">
                    {items.map((a) => (
                      <li key={a.id}>
                        <button type="button" data-lista onClick={() => setAbierta(a)} aria-label={`${a.actor_nombre} ${textoDeAccion(a, MODO_SAAS_VISIBLE)}. Ver el detalle`} className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 cursor-pointer">
                          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-500" aria-hidden="true"><Building2 size={15} /></span>
                          <span className="min-w-0 flex-1"><Frase a={a} /></span>
                          <span className="flex shrink-0 items-center gap-2">
                            {a.optica_id && pruebas.has(a.optica_id) && <EtiquetaPrueba />}
                            <span className="text-xs tabular-nums text-slate-500" title={formatoFecha(a.created_at, "medio")}>{hora(a.created_at)}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )
          })
        )}
      </div>

      {abierta && <DetalleAccion a={abierta} opticaPrueba={!!abierta.optica_id && pruebas.has(abierta.optica_id)} onCerrar={() => setAbierta(null)} onAbrir={onAbrir} />}
    </div>
  )
}
