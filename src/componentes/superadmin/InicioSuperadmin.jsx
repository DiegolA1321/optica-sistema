"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Activity, AlertTriangle, ArrowRight, Building2, CheckCircle2, ChevronRight, LifeBuoy, LogIn, Megaphone, RefreshCw, ShieldCheck, Users, XCircle, Loader2 } from "lucide-react"
import { supabase } from "../../lib/supabaseClient"
import { INK } from "@/lib/tema"
import RequiereAtencionPorArea from "../RequiereAtencionPorArea"
import { InterruptorPrueba } from "./piezas"
import { VentanaComponente } from "./EstadoDelSistema"
import { DetalleAccion } from "./ActividadSuperadmin"
import { ICONO_COMPONENTE, ICONO_MODULO } from "./iconos"
import { VentanaModulo, VentanaPersonal } from "./UsoDelSistema"
import VentanaOfrecerAyuda from "./VentanaOfrecerAyuda"
import useEstadoSistema, { modoMuestra } from "./useEstadoSistema"
import { leerAyudasDeLaOptica } from "../../utilidades/soporteDatos"
import { fechaAISO } from "../../utilidades/disponibilidad"
import { ahoraEcuador } from "../../utilidades/horaEcuador"
import { fechaHoraLegible } from "../../utilidades/formatoFecha"
import { variacion } from "../../utilidades/reportesPeriodo"
import { OPTICA_ID_DEFAULT } from "../../utilidades/opticaActual"
import { codigoConsulta, esAbierta } from "../../utilidades/soporte"
import { componentesConEstado, avisosDeSistema, estadoGeneral, verificacionAtrasada, rapidez, haceTiempo, ESTADOS, consultaDeMuestra, usoDeMuestra } from "../../utilidades/estadoSistema"
import { opticaDeLaTesis, soloLaOptica, usoDeLaRed, opticasDelNegocio, sinPruebas, frasesDeAccion, tiposVisibles, haceDias, textoUsoModulo, ayudaOfrecida, MODULOS_USO } from "../../utilidades/superadminNegocio"

const ATAJO = "flex items-center gap-1.5 rounded-lg border border-slate-200/60 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-white"
const TONO_VARIACION = { bueno: "text-emerald-700", malo: "text-red-600", neutro: "text-slate-500" }
export const ACTIVIDAD_EN_INICIO = 5

// El estado de un componente en una etiqueta corta: «✓ Rápido», «⚠ Lento», «✕ Con fallas», «⚠ No configurado».
export function etiquetaDeComponente(c) {
  const u = c.ultimo
  if (!u) return { simbolo: "–", texto: "Sin verificar", clase: "text-slate-500" }
  if (u.estado === "operativo") return { simbolo: "✓", texto: rapidez(c.id, u.latencia_ms)?.nombre || "Operativo", clase: ESTADOS.operativo.texto }
  if (u.estado === "con_fallas") return { simbolo: "✕", texto: ESTADOS.con_fallas.nombre, clase: ESTADOS.con_fallas.texto }
  return { simbolo: "⚠", texto: ESTADOS[u.estado].nombre, clase: ESTADOS[u.estado].texto }
}

// El estado general en una frase para personas. Si no se pudo verificar, nunca dice que todo está en orden.
export function frasesDeEstado(sistema, componentes, atrasada) {
  // Mientras se lee el estado no se afirma nada: ni «todo bien» ni «no se pudo».
  if (sistema.cargando) return { estado: "cargando", texto: "Verificando el estado…", Icono: Loader2, clase: "text-slate-600", gira: true }
  if (sistema.sinServidor || !sistema.datos) return { estado: "sin_verificar", texto: "No se pudo verificar el estado", Icono: AlertTriangle, clase: "text-amber-700" }
  const g = estadoGeneral(componentes)
  if (g.estado === null) return { estado: "sin_verificar", texto: "Todavía no hay verificaciones", Icono: AlertTriangle, clase: "text-amber-700" }
  if (g.estado === "con_fallas") return { estado: g.estado, texto: "Hay fallas", Icono: XCircle, clase: ESTADOS.con_fallas.texto }
  if (g.estado === "lento") return { estado: g.estado, texto: "Hay componentes lentos", Icono: AlertTriangle, clase: ESTADOS.lento.texto }
  if (atrasada) return { estado: "atrasado", texto: "La verificación está atrasada", Icono: AlertTriangle, clase: "text-amber-700" }
  return { estado: "operativo", texto: "Todo funciona correctamente", Icono: CheckCircle2, clase: ESTADOS.operativo.texto }
}

// El Inicio del superadmin en el modo de la tesis: el sistema de una sola óptica en una pantalla. Misma estructura que el Inicio de la óptica:
// atajos, el estado, «Requiere tu atención» por área (solo las que tienen avisos) y, abajo, el uso de la óptica y la actividad reciente.
export default function InicioSuperadmin({ opticas, datos: datosReales, consultas: consultasReales, actividad = [], incluirPrueba, onIncluirPrueba, onAbrir, onNuevoAviso, onEntrarComo, onAviso, onAuditoria }) {
  const sistema = useEstadoSistema(true)
  // Con ?_muestra=… (solo en desarrollo) el uso y las consultas también son de ejemplo, para revisar cada estado sin depender de los datos reales.
  const muestra = modoMuestra()
  const [componenteAbierto, setComponenteAbierto] = useState(null)
  const [moduloAbierto, setModuloAbierto] = useState(null)
  const [ofreciendo, setOfreciendo] = useState(null) // el módulo con el que se está ofreciendo ayuda
  const [ayudas, setAyudas] = useState({ ofrecidas: [], noUsan: [] }) // lo ofrecido y lo que la óptica decidió (0122)
  const [verPersonal, setVerPersonal] = useState(false)
  const [accionAbierta, setAccionAbierta] = useState(null)
  const [accesosSoporte, setAccesosSoporte] = useState([])
  const ahora = Date.now()
  const hoyClave = fechaAISO(ahoraEcuador())

  useEffect(() => {
    let vigente = true
    supabase.from("accesos_soporte").select("id, optica_id, concedido_nombre, vence_en").is("revocado_en", null).gt("vence_en", new Date().toISOString())
      .then(({ data }) => { if (vigente) setAccesosSoporte(data || []) })
    return () => { vigente = false }
  }, [])

  // ── La óptica y lo que cuenta (los entornos de prueba solo con el interruptor)
  const optica = opticaDeLaTesis(opticas, OPTICA_ID_DEFAULT)
  const cargarAyudas = useCallback(async () => { if (optica?.id) setAyudas(await leerAyudasDeLaOptica(optica.id)) }, [optica?.id])
  useEffect(() => { cargarAyudas() }, [cargarAyudas])
  const datos = muestra ? { ...datosReales, uso: usoDeMuestra(optica?.id), sinServidor: false } : datosReales
  const consultas = muestra ? [] : consultasReales
  const negocio = useMemo(() => opticasDelNegocio(opticas, incluirPrueba), [opticas, incluirPrueba])
  const opticaIds = negocio.filter((o) => o.activa !== false).map((o) => o.id)
  const uso = useMemo(() => usoDeLaRed(datos.uso, new Set(opticaIds)), [datos.uso, opticaIds.join(",")]) // eslint-disable-line react-hooks/exhaustive-deps
  const ids = useMemo(() => new Set(negocio.map((o) => o.id)), [negocio])
  const muestraSoporte = muestra === "lento"
  const consultasN = useMemo(() => [...consultas.filter((c) => ids.has(c.opticaId)), ...(muestraSoporte ? [consultaDeMuestra(optica?.id)] : [])], [consultas, ids, muestraSoporte, optica?.id])

  // ── El estado
  const componentes = componentesConEstado(sistema.datos)
  const atrasada = verificacionAtrasada(componentes, ahora)
  const estado = frasesDeEstado(sistema, componentes, atrasada)
  const ultima = sistema.datos?.ultimos?.map((u) => u.creado_at).sort().pop()
  const pruebaAcceso = incluirPrueba ? { incluirPrueba: true } : {}

  // ── «Requiere tu atención»: un bloque por área; las áreas sin avisos se resumen en una línea
  const urgentes = consultasN.filter((c) => esAbierta(c) && c.urgencia === "urgente")
  const esperan = consultasN.filter((c) => esAbierta(c) && c.ultimoMensajeDe === "optica")
  const irASoporte = (urgencia) => () => onAbrir("soporte", { tab: "consultas", estado: "abiertas", urgencia, ...pruebaAcceso })
  const casoConsulta = (c, insignia) => ({ id: c.id, icono: LifeBuoy, nombre: `${codigoConsulta(c.numero)} · ${c.asunto}`, detalle: c.urgencia === "urgente" ? "Urgente" : undefined, insignia, accion: { etiqueta: "Abrir", navega: true, onClick: irASoporte(c.urgencia === "urgente" ? "urgente" : "") } })
  const filasSoporte = [
    urgentes.length > 0 && { id: "urgentes", cantidad: urgentes.length, corto: "urgentes abiertas", texto: urgentes.length === 1 ? "consulta urgente abierta" : "consultas urgentes abiertas", tono: "urgente", enlace: { texto: "Abrir en Soporte", onClick: irASoporte("urgente") }, casos: urgentes.map((c) => casoConsulta(c, { texto: "Urgente", tono: "urgente" })) },
    esperan.length > 0 && { id: "esperan", cantidad: esperan.length, corto: "esperan respuesta", texto: esperan.length === 1 ? "consulta espera tu respuesta" : "consultas esperan tu respuesta", enlace: { texto: "Abrir las consultas abiertas", onClick: irASoporte("") }, casos: esperan.map((c) => casoConsulta(c, { texto: "Sin respuesta", tono: "aviso" })) },
  ].filter(Boolean)
  const cargandoUso = datos.cargando // mientras llega el uso no se afirma nada: ni «0 personas» ni «módulos sin uso»
  // Cada módulo con lo que la óptica decidió («No usamos este módulo») y lo que se le ofreció. Si lo usan, se cuenta como en uso aunque hayan dicho que no.
  const modulos = uso.porModulo.map((m) => ({ ...m, noUsan: m.ultima ? null : ayudas.noUsan.find((x) => x.modulo === m.id) || null, ofrecida: ayudas.ofrecidas.find((x) => x.modulo === m.id) || null }))
  const sinUsoModulos = cargandoUso ? [] : modulos.filter((m) => !m.ultima && !m.noUsan) // los que la óptica dijo que no usa salen de «Requiere tu atención»
  const fechaDe = (iso) => fechaHoraLegible(iso).split(",")[0]
  const accionDeModulo = (m) => (ayudaOfrecida(m.ofrecida?.ofrecidaEn).vigente
    ? { etiqueta: "Ver en Soporte", navega: true, onClick: () => onAbrir("soporte", { tab: "consultas", estado: "todas", ...pruebaAcceso }) }
    : { etiqueta: "Ofrecer ayuda", navega: true, onClick: () => setOfreciendo(m) })
  const detalleDeModulo = (m) => (ayudaOfrecida(m.ofrecida?.ofrecidaEn).vigente ? "Ayuda ofrecida el " + fechaDe(m.ofrecida.ofrecidaEn) : "Nadie lo usó en los últimos 30 días")
  const filasOptica = [
    sinUsoModulos.length > 0 && {
      id: "sin-uso", cantidad: sinUsoModulos.length, corto: "módulos sin uso", texto: sinUsoModulos.length === 1 ? "módulo sin uso en 30 días" : "módulos sin uso en 30 días", nombres: sinUsoModulos.map((m) => m.nombre).join(", "),
      casos: sinUsoModulos.map((m) => ({ id: m.id, icono: ICONO_MODULO[m.id], nombre: m.nombre, detalle: detalleDeModulo(m), insignia: { texto: "Sin uso", tono: "neutro" }, accion: accionDeModulo(m) })),
    },
    accesosSoporte.length > 0 && {
      id: "acceso-soporte", cantidad: accesosSoporte.length, corto: "accesos del soporte", texto: accesosSoporte.length === 1 ? "permiso de acceso del soporte activo" : "permisos de acceso del soporte activos",
      enlace: { texto: "Abrir en La óptica", onClick: () => onAbrir("opticas", { abrir: accesosSoporte[0].optica_id, estado: "Todas", ...pruebaAcceso }) },
      casos: accesosSoporte.map((x) => ({ id: x.id, icono: ShieldCheck, nombre: "Permiso para el soporte", detalle: `${x.concedido_nombre ? `Lo dio ${x.concedido_nombre} · ` : ""}vence ${fechaHoraLegible(x.vence_en)}`, insignia: { texto: "Activo", tono: "aviso" } })),
    },
  ].filter(Boolean)
  const sinEstado = sistema.cargando || sistema.sinServidor || !sistema.datos // la franja de arriba lo dice; aquí no se repite ni se da el Sistema por «en orden»
  const filasSistema = sinEstado ? [] : avisosDeSistema(componentes).map((f) => ({ ...f, casos: f.casos.map((c) => ({ ...c, icono: ICONO_COMPONENTE[c.accion.componente], accion: { etiqueta: "Ver detalle", navega: true, onClick: () => setComponenteAbierto(c.accion.componente) } })) }))
  const areas = [
    { id: "sistema", titulo: "Sistema", icono: Activity, filas: filasSistema, onVerTodo: () => setComponenteAbierto("datos") },
    { id: "soporte", titulo: "Soporte", icono: LifeBuoy, filas: filasSoporte, onVerTodo: irASoporte("") },
    { id: "optica", titulo: "La óptica", icono: ShieldCheck, filas: filasOptica, onVerTodo: () => onAbrir("opticas", { estado: "Todas", ...pruebaAcceso }) },
  ]
  const conAvisos = areas.filter((a) => a.filas.length > 0)
  const enOrden = areas.filter((a) => a.filas.length === 0 && !(a.id === "sistema" && sinEstado) && !(a.id === "optica" && cargandoUso)).map((a) => a.titulo)
  const lista = (nombres) => nombres.length < 2 ? nombres.join("") : `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`

  // ── Actividad reciente: sin los entornos de prueba (ni nada que no sea de la óptica) salvo que se active el interruptor
  const recientes = useMemo(() => {
    const dePersonas = tiposVisibles(false).flatMap((t) => t.acciones || [])
    return soloLaOptica(sinPruebas(actividad, opticas, incluirPrueba), optica?.id, incluirPrueba).filter((a) => dePersonas.includes(a.accion)).slice(0, ACTIVIDAD_EN_INICIO)
  }, [actividad, opticas, incluirPrueba, optica?.id])

  const puedeEntrar = !!optica && accesosSoporte.some((x) => x.optica_id === optica.id)
  const motivoNoEntrar = !optica ? "Todavía no hay una óptica." : "El administrador de la óptica debe permitir el acceso del soporte (Configuración › Privacidad) para poder entrar."
  const variacionPersonas = variacion(uso.personas, uso.personasPrevio) // la regla de Reportes: con una base menor de 10 se dice «antes N»
  const pocasPersonas = variacionPersonas.texto.startsWith("antes")

  if (datos.cargando && opticas.length === 0) {
    return <div className="space-y-3" aria-busy="true" aria-label="Cargando el inicio">{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200/70" />)}</div>
  }

  return (
    <div className="space-y-3" data-inicio-superadmin>
      {/* Atajos y el interruptor de los entornos de prueba */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Atajos">
          <button type="button" onClick={onNuevoAviso} className={ATAJO}><Megaphone size={14} aria-hidden="true" /> Nuevo aviso</button>
          <button type="button" onClick={irASoporte("")} className={ATAJO}><LifeBuoy size={14} aria-hidden="true" /> Ver consultas</button>
          <span title={puedeEntrar ? undefined : motivoNoEntrar}>
            <button type="button" disabled={!puedeEntrar} onClick={() => onEntrarComo(optica)} aria-describedby={puedeEntrar ? undefined : "motivo-entrar"} className={ATAJO + (puedeEntrar ? "" : " pointer-events-none")}><LogIn size={14} aria-hidden="true" /> Entrar a la óptica</button>
          </span>
          {!puedeEntrar && <span id="motivo-entrar" className="sr-only">{motivoNoEntrar}</span>}
        </div>
        <InterruptorPrueba activo={incluirPrueba} onCambiar={onIncluirPrueba} cuantas={opticas.filter((o) => o.es_de_prueba).length} />
      </div>

      {/* Franja de estado: el general y los cinco componentes, en dos líneas */}
      <section id="estado-sistema" aria-label="Estado del sistema" className="scroll-mt-4 rounded-2xl border border-slate-200/60 bg-white px-4 py-2.5 shadow-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <p className={"flex items-center gap-1.5 text-sm font-bold " + estado.clase} role="status"><estado.Icono size={16} className={estado.gira ? "animate-spin" : undefined} aria-hidden="true" /> {estado.texto}</p>
          <p className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
            {ultima && <span>Verificado {haceTiempo(ultima, ahora)}</span>}
            {ultima && <span aria-hidden="true">·</span>}
            <button type="button" onClick={sistema.verificarAhora} disabled={sistema.verificando || sistema.cargando} className="flex items-center gap-1 font-semibold text-blue-700 transition-colors hover:text-blue-800 cursor-pointer disabled:opacity-60">
              {sistema.verificando ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={12} aria-hidden="true" />} Verificar ahora
            </button>
          </p>
          {sistema.error && <p role="alert" className="text-xs font-semibold text-red-700">{sistema.error}</p>}
        </div>
        <ul role="list" aria-label="Componentes del sistema" className="mt-1.5 flex flex-wrap gap-1.5">
          {componentes.map((c) => {
            const e = etiquetaDeComponente(c)
            return (
              <li key={c.id}>
                <button type="button" onClick={() => setComponenteAbierto(c.id)} disabled={!sistema.datos} aria-label={`${c.nombre}: ${e.texto}. Ver el detalle`} className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 cursor-pointer disabled:cursor-default disabled:opacity-70">
                  {c.nombre} <span className={"font-bold " + e.clase} aria-hidden="true">{e.simbolo}</span><span className={e.clase}>{e.texto}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {/* Requiere tu atención: solo las áreas con avisos; las demás, en una línea */}
      {conAvisos.length > 0 ? (
        <RequiereAtencionPorArea
          bloques={conAvisos} columnas={Math.min(conAvisos.length, 3)} compacto
          lateral={enOrden.length > 0 && <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600"><CheckCircle2 size={14} className="text-emerald-600" aria-hidden="true" /> {lista(enOrden)}: todo en orden</span>}
        />
      ) : (
        <section id="requiere-atencion" aria-label="Requiere tu atención" className="space-y-2">
          <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Requiere tu atención</h2>
          <p className="flex items-center gap-2 rounded-2xl border border-slate-200/60 bg-white px-4 py-3 text-sm font-medium text-slate-600 shadow-sm"><CheckCircle2 size={18} className="shrink-0 text-emerald-600" aria-hidden="true" /> {enOrden.length > 0 ? `${lista(enOrden)}: todo en orden.` : "Sin avisos que atender."}</p>
        </section>
      )}

      {/* Abajo, dos columnas de la misma altura */}
      <div className="grid grid-cols-1 items-stretch gap-3 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-label="Uso de la óptica" className="flex min-w-0 flex-col rounded-2xl border border-slate-200/60 bg-white shadow-sm">
          <h2 className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5 text-base font-bold" style={{ color: INK }}><Building2 size={16} className="text-slate-500" aria-hidden="true" /> Uso de la óptica</h2>
          {cargandoUso ? (
            <div className="flex-1 space-y-2 px-4 py-3" aria-busy="true" aria-label="Cargando el uso de la óptica">{[0, 1, 2, 3].map((i) => <div key={i} className="h-6 animate-pulse rounded-lg bg-slate-200/70" />)}</div>
          ) : datos.sinServidor ? (
            <div className="flex flex-1 flex-col items-start gap-2 px-4 py-4 text-sm text-slate-600">
              <p>Todavía no se puede leer el uso de la óptica.</p>
              <button type="button" onClick={datos.recargar} className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer">Reintentar</button>
            </div>
          ) : (
            <>
              <button type="button" onClick={() => setVerPersonal(true)} aria-label={`Personas activas: ${uso.personas}. Ver el personal`} className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5 text-left transition-colors hover:bg-slate-50 cursor-pointer">
                <Users size={16} className="shrink-0 text-slate-500" aria-hidden="true" />
                <span className="text-sm text-slate-700">Personas activas en 30 días</span>
                <span className="ml-auto flex items-baseline gap-1.5" title="Comparado con los 30 días anteriores">
                  <span className="text-sm font-bold" style={{ color: INK }}>{uso.personas}</span>
                  {pocasPersonas
                    ? <span className="text-xs text-slate-500">({variacionPersonas.texto})</span>
                    : <span className={"text-xs font-semibold " + TONO_VARIACION[variacionPersonas.tono]}><span aria-hidden="true">{variacionPersonas.flecha}</span> {variacionPersonas.texto}</span>}
                </span>
                <ChevronRight size={16} className="shrink-0 text-slate-400" aria-hidden="true" />
              </button>
              <ul role="list" aria-label="Módulos" className="grid flex-1 grid-cols-1 content-start gap-x-2 px-2 py-1.5 sm:grid-cols-2">
                {modulos.map((m) => (
                  <li key={m.id}>
                    <button type="button" onClick={() => setModuloAbierto(m)} aria-label={m.nombre + ": " + (m.noUsan ? "No lo usan por decisión de la óptica" : textoUsoModulo(m.ultima, hoyClave)) + ". Ver el detalle"} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-slate-50 cursor-pointer">
                      <span aria-hidden="true" className={"h-2 w-2 shrink-0 rounded-full " + (m.ultima ? "bg-emerald-500" : m.noUsan ? "border border-slate-400 bg-white" : "bg-slate-300")} />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold" style={{ color: INK }}>{m.nombre}</span>
                      <span className="shrink-0 text-xs text-slate-500">{m.ultima ? haceDias(m.ultima, hoyClave) : m.noUsan ? "no lo usan por decisión de la óptica" : "sin uso en 30 días"}</span>
                      <ChevronRight size={14} className="shrink-0 text-slate-400" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
          <footer className="flex items-center border-t border-slate-100 px-4 py-1.5 text-sm">
            <button type="button" onClick={() => optica && onAbrir("opticas", { abrir: optica.id, estado: "Todas", ...pruebaAcceso })} disabled={!optica} aria-label="Ver todo el uso de la óptica" className="ml-auto flex items-center gap-1 font-bold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer disabled:opacity-50">Ver todo <ArrowRight size={14} aria-hidden="true" /></button>
          </footer>
        </section>

        <section aria-label="Actividad reciente" className="flex min-w-0 flex-col rounded-2xl border border-slate-200/60 bg-white shadow-sm">
          <h2 className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5 text-base font-bold" style={{ color: INK }}><Activity size={16} className="text-slate-500" aria-hidden="true" /> Actividad reciente</h2>
          {recientes.length === 0 ? (
            <p className="flex-1 px-4 py-4 text-sm text-slate-600">Todavía no hay acciones registradas.</p>
          ) : (
            <ul role="list" className="flex-1 divide-y divide-slate-100">
              {recientes.map((a) => (
                <li key={a.id}>
                  <button type="button" onClick={() => setAccionAbierta(a)} aria-label={`${a.actor_nombre} ${frasesDeAccion(a, false).map((x) => x.t).join("")}. Ver el detalle`} className="flex w-full items-center gap-3 px-4 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer">
                    <span className="min-w-0 flex-1 truncate"><span className="font-semibold" style={{ color: INK }}>{a.actor_nombre}</span> {frasesDeAccion(a, false).map((x) => x.t).join("")}</span>
                    <span className="shrink-0 text-xs tabular-nums text-slate-500">{fechaHoraLegible(a.created_at)}</span>
                    <ChevronRight size={14} className="shrink-0 text-slate-400" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <footer className="flex items-center border-t border-slate-100 px-4 py-1.5 text-sm">
            <button type="button" onClick={() => onAbrir("actividad", {})} aria-label="Ver toda la actividad" className="ml-auto flex items-center gap-1 font-bold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">Ver todo <ArrowRight size={14} aria-hidden="true" /></button>
          </footer>
        </section>
      </div>

      {componenteAbierto && sistema.datos && <VentanaComponente id={componenteAbierto} sistema={sistema} hoyClave={hoyClave} onCerrar={() => setComponenteAbierto(null)} />}
      {moduloAbierto && <VentanaModulo modulo={moduloAbierto} hoyClave={hoyClave} opticaIds={opticaIds} ayuda={{ ofrecida: moduloAbierto.ofrecida, noUsan: moduloAbierto.noUsan }}
        onOfrecerAyuda={() => setOfreciendo(moduloAbierto)} onCerrar={() => setModuloAbierto(null)} />}
      {ofreciendo && optica && (
        <VentanaOfrecerAyuda modulo={ofreciendo} optica={optica} onCerrar={() => setOfreciendo(null)}
          onEnviada={async ({ numero, modulo }) => {
            setOfreciendo(null)
            onAviso?.("Ayuda ofrecida con " + modulo.nombre + ": SOP-" + String(numero).padStart(4, "0") + " en Soporte.")
            await onAuditoria?.("ofrecer_ayuda", { opticaId: optica.id, opticaNombre: optica.nombre, detalle: modulo.nombre + " (SOP-" + String(numero).padStart(4, "0") + ")" })
            cargarAyudas()
          }} />
      )}
      {accionAbierta && <DetalleAccion a={accionAbierta} opticaPrueba={!!accionAbierta.optica_id && opticas.some((o) => o.id === accionAbierta.optica_id && o.es_de_prueba)} onCerrar={() => setAccionAbierta(null)} onAbrir={onAbrir} />}
      {verPersonal && optica && <VentanaPersonal opticaId={optica.id} hoyClave={hoyClave} onCerrar={() => setVerPersonal(false)} />}
    </div>
  )
}
