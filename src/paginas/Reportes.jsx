"use client"

import { useMemo, useState } from "react"
import { Download, X } from "lucide-react"
import SinDatosAun from "../componentes/SinDatosAun"
import SelectorPeriodo from "../componentes/reportes/SelectorPeriodo"
import TarjetaReporte from "../componentes/reportes/TarjetaReporte"
import VentanaDetalle from "../componentes/reportes/VentanaDetalle"
import VentanaExportar from "../componentes/reportes/VentanaExportar"
import { crearColumnas } from "../componentes/reportes/listas"
import PestanaResumen from "../componentes/reportes/PestanaResumen"
import PestanaCitas from "../componentes/reportes/PestanaCitas"
import PestanaClinico from "../componentes/reportes/PestanaClinico"
import PestanaVentas from "../componentes/reportes/PestanaVentas"
import PestanaPedidos from "../componentes/reportes/PestanaPedidos"
import PestanaInventario from "../componentes/reportes/PestanaInventario"
import { useTodosLosMovimientos } from "../componentes/inventario/useMovimientos"
import { puede } from "../utilidades/permisosUi"
import { INK, GRAD_MARCA } from "@/lib/tema"
import { tituloSemana } from "../utilidades/formatoFecha"
import { ahoraEcuador } from "../utilidades/horaEcuador"
import { fechaAISO } from "../utilidades/disponibilidad"
import { motivosEnConsultas } from "../utilidades/reportesDiagnosticos"
import { responsableDeCita, ORIGENES_FILTRO, SEGUIMIENTO_FILTRO } from "../utilidades/filtrosCitas"
import { nombreDeMiembro } from "../utilidades/equipo"
import { rangoDePeriodo, rangoAnterior, etiquetaComparacion, variacion } from "../utilidades/reportesPeriodo"
import { FILTROS_VACIOS, hayFiltros, filtrarDatos, metricasDelPeriodo } from "../utilidades/reportesDatos"
import { modeloDeLista, descargarModelo } from "../utilidades/reportesExcel"
import { useParamUrl } from "../utilidades/urlEstado"

// Las pestañas siguen el recorrido del paciente (el mismo orden del menú). Cada una responde una pregunta del negocio.
const PESTANAS = [
  { id: "resumen", etiqueta: "Resumen", pregunta: "¿Cómo le fue a la óptica en este período?" },
  { id: "citas", etiqueta: "Citas", pregunta: "¿Cómo usamos la agenda y quién viene?" },
  { id: "clinico", etiqueta: "Clínico", pregunta: "¿Qué atendemos y cómo están nuestros pacientes?" },
  { id: "ventas", etiqueta: "Ventas", pregunta: "¿Cuánto vendemos, cuánto cobramos y por qué no compran?" },
  { id: "pedidos", etiqueta: "Pedidos", pregunta: "¿Se entregan a tiempo los pedidos?" },
  { id: "inventario", etiqueta: "Inventario", pregunta: "¿Cuánto vale lo que tenemos y qué se mueve?" },
]
const ETIQUETA_ORIGEN = Object.fromEntries(ORIGENES_FILTRO.map((o) => [o.id, o.etiqueta]))
const ETIQUETA_VISITA = Object.fromEntries(SEGUIMIENTO_FILTRO.map((o) => [o.id, o.etiqueta]))
const selector = "mt-0.5 block h-9 rounded-lg border border-slate-200/60 bg-white px-2 text-sm font-normal text-slate-700 outline-none focus-visible:border-blue-500"

export default function Reportes({ usuario, cargaInicial = false, pacientes = [], consultas: consultasTodas = [], consultasCompletas = null, citas: citasTodas = [], ventas = [], facturasVenta = [], pases = [], abonos = [], ordenesLab = [], inventario = [], equipo = [], soloLoPropio = false, verMontos = true, onAbrirModulo, onRegistrarPaciente, onAviso }) {
  const esAdmin = usuario?.rol === "admin" && !soloLoPropio
  const propio = soloLoPropio || (!!usuario?.esOptometra && usuario?.rol !== "admin")
  const ocultarMontos = propio || verMontos === false
  const historial = consultasCompletas || consultasTodas

  // Inventario trae costos y márgenes: lo ve quien ve montos y puede ver el inventario.
  const verInventario = !ocultarMontos && puede(usuario, "inventario", "ver")
  const pestanasVisibles = PESTANAS.filter((p) => !(p.id === "ventas" && ocultarMontos) && !(p.id === "inventario" && !verInventario))
  const [pestana, setPestana] = useParamUrl("tab", "resumen", pestanasVisibles.map((p) => p.id))
  const [periodo, setPeriodo] = useState("mes")
  const [personalizado, setPersonalizado] = useState({ inicio: "", fin: "" })
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  const [detalle, setDetalle] = useState(null)
  const [exportando, setExportando] = useState(false)
  const cambiarFiltro = (clave, valor) => setFiltros((f) => ({ ...f, [clave]: valor }))

  // El kárdex se pide solo cuando hace falta: al abrir la pestaña Inventario o la ventana Exportar (una sola vez).
  const kardex = useTodosLosMovimientos(verInventario && (pestana === "inventario" || exportando))

  const hoyClave = fechaAISO(ahoraEcuador())
  const hoy = useMemo(() => ahoraEcuador(), [hoyClave]) // eslint-disable-line react-hooks/exhaustive-deps
  const rango = useMemo(() => rangoDePeriodo(periodo, personalizado, hoy), [periodo, personalizado, hoy])
  const previo = useMemo(() => rangoAnterior(periodo, rango, hoy), [periodo, rango, hoy])

  const motivos = useMemo(() => motivosEnConsultas([...consultasTodas, ...citasTodas]), [consultasTodas, citasTodas])
  const profesionales = useMemo(() => {
    const m = new Map()
    for (const c of citasTodas) { const id = responsableDeCita(c); if (id && !m.has(id)) m.set(id, nombreDeMiembro(equipo, id)) }
    for (const c of consultasTodas) if (c.profesionalId && !m.has(c.profesionalId)) m.set(c.profesionalId, nombreDeMiembro(equipo, c.profesionalId))
    for (const [id, nombre] of m) if (!nombre) m.set(id, consultasTodas.find((c) => c.profesionalId === id)?.profesionalNombre || "Profesional")
    return [...m.entries()].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [consultasTodas, citasTodas, equipo])
  const nombreProfesional = profesionales.find((p) => p.id === filtros.profesional)?.nombre

  const datos = useMemo(() => ({ pacientes, consultas: consultasTodas, historial, citas: citasTodas, ventas, facturas: facturasVenta, pases, ordenes: ordenesLab, abonos }), [pacientes, consultasTodas, historial, citasTodas, ventas, facturasVenta, pases, ordenesLab, abonos])
  const f = useMemo(() => filtrarDatos(datos, filtros), [datos, filtros])
  const act = useMemo(() => metricasDelPeriodo(f, datos, rango), [f, datos, rango])
  const ant = useMemo(() => metricasDelPeriodo(f, datos, previo), [f, datos, previo])
  const cols = useMemo(() => crearColumnas({ pacientes, abonos, historial, equipo }), [pacientes, abonos, historial, equipo])

  const etiquetas = [
    { id: "periodo", texto: `Período: ${tituloSemana(rango.inicio, rango.fin)}` },
    filtros.motivo && { id: "motivo", texto: `Motivo: ${filtros.motivo}`, quitar: () => cambiarFiltro("motivo", "") },
    filtros.origen !== "todos" && { id: "origen", texto: `Origen: ${ETIQUETA_ORIGEN[filtros.origen]}`, quitar: () => cambiarFiltro("origen", "todos") },
    filtros.visita !== "todos" && { id: "visita", texto: `Visita: ${ETIQUETA_VISITA[filtros.visita]}`, quitar: () => cambiarFiltro("visita", "todos") },
    esAdmin && filtros.profesional && { id: "profesional", texto: `Profesional: ${nombreProfesional || "—"}`, quitar: () => cambiarFiltro("profesional", "") },
    propio && { id: "propio", texto: "Solo tus consultas y tus citas" },
  ].filter(Boolean)
  const filtrosTexto = etiquetas.map((e) => e.texto).join(" · ")
  // Los filtros sin el período (el período va aparte en el encabezado de cada archivo).
  const filtrosActivosTexto = etiquetas.filter((e) => e.id !== "periodo").map((e) => e.texto).join(" · ") || "ninguno"
  const hay = hayFiltros(filtros)

  // Una lista (la de una ventana o la de un bloque) como Excel, con el encabezado de siempre y registrada en la actividad si lleva personas.
  const exportarLista = async ({ titulo, valor, columnas, filas, personal = true }) => {
    if (filas.length === 0) { onAviso?.(`No hay datos para «${titulo}» con estos filtros: no se descargó nada.`); return }
    const modelo = modeloDeLista({ titulo, valor, columnas, filas, rango, personal })
    try { await descargarModelo(modelo, { usuario, opticaNombre: usuario?.opticaNombre, usuarioNombre: usuario?.nombre, rango, filtrosTexto: filtrosActivosTexto }); onAviso?.(`Se descargó «${titulo}» (${filas.length} filas).`) } catch { onAviso?.(`No se pudo descargar «${titulo}». Vuelve a intentarlo.`) }
  }
  // Las dos maneras de exportar un bloque: sus datos resumidos o todos los registros que lo componen. Cada una se arma al pulsarla.
  const bloque = (titulo, datos, detalle) => [
    { id: "datos", etiqueta: "Datos de la gráfica", descripcion: "Lo que se ve en el bloque, resumido.", ejecutar: () => exportarLista({ titulo: `${titulo} · datos`, personal: false, ...datos() }) },
    { id: "detalle", etiqueta: "Detalle completo", descripcion: "Todos los registros que lo componen.", ejecutar: () => exportarLista({ titulo: `${titulo} · detalle`, ...detalle() }) },
  ]

  // Lo que se pasa a cada pestaña: los números ya calculados y la manera de abrir su lista.
  const abrir = (spec) => setDetalle({
    filtros: filtrosTexto,
    ...spec,
    exportar: () => exportarLista({ titulo: spec.titulo, valor: spec.valor, columnas: spec.columnas, filas: spec.filas }),
    abrirEn: spec.abrirEn ? { etiqueta: spec.abrirEn.etiqueta, ir: () => onAbrirModulo?.(spec.abrirEn.modulo, spec.abrirEn.params) } : null,
    irAPestana: pestana === "resumen" && spec.pestana ? { etiqueta: `Ir a la pestaña ${PESTANAS.find((p) => p.id === spec.pestana).etiqueta}`, ir: () => setPestana(spec.pestana) } : null,
  })
  const paramsFiltros = { origen: filtros.origen, visita: filtros.visita, profesional: filtros.profesional, motivo: filtros.motivo }
  const etiquetaComp = etiquetaComparacion(previo, hoy)
  const r = {
    usuario, rango, previo, hoy, hay, bloque, exportarLista, f, datos, filtros, act, ant, cols, abrir, paramsFiltros, etiquetaComp, historial, equipo, inventario, movimientos: kardex.movimientos, kardex,
    ocultarMontos, esAdmin, propio, filtrosTexto, filtrosActivosTexto, onAbrirModulo, onAviso, setPestana, setPeriodo,
    quitarFiltros: () => setFiltros(FILTROS_VACIOS),
    // Una tarjeta del período: el número, cómo va frente al anterior y su lista.
    tarjeta: (props, a, b, opcionesVariacion) => <TarjetaReporte key={props.titulo} {...props} variacion={a === undefined ? undefined : variacion(a, b, opcionesVariacion)} comparacion={a === undefined ? undefined : etiquetaComp} />,
  }

  if (cargaInicial && pacientes.length === 0 && consultasTodas.length === 0 && citasTodas.length === 0) {
    return <div className="space-y-4" aria-busy="true" aria-label="Cargando reportes">{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200/70" />)}</div>
  }
  const sinNada = !cargaInicial && pacientes.length === 0 && consultasTodas.length === 0 && citasTodas.length === 0
  const actual = pestanasVisibles.find((p) => p.id === pestana) || pestanasVisibles[0]

  return (
    <div className="space-y-3" data-reportes>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="min-w-0">
          <h1 className="text-xl font-bold" style={{ color: INK }}>Reportes</h1>
          <p className="text-sm text-slate-500">{propio && actual.id === "resumen" ? "¿Cómo te fue en este período?" : actual.pregunta}</p>
        </div>
        <button type="button" onClick={() => setExportando(true)} className="ml-auto flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer" style={{ background: GRAD_MARCA }}><Download size={15} aria-hidden="true" /> Exportar</button>
      </div>

      {sinNada && actual.id === "resumen" && <SinDatosAun titulo="Todavía no hay datos para mostrar" texto="Los reportes se llenan con los pacientes, las consultas y las ventas que se registren." accion={onRegistrarPaciente ? { etiqueta: "Registrar el primer paciente", onClick: onRegistrarPaciente } : null} />}

      {/* Filtros: arriba, iguales y en el mismo lugar en todas las pestañas */}
      <div className="space-y-2 rounded-2xl border border-slate-200/60 bg-white px-3 py-2.5 shadow-sm" role="group" aria-label="Filtros">
        <div className="flex flex-wrap items-center gap-2">
          <SelectorPeriodo periodo={periodo} onPeriodo={setPeriodo} personalizado={personalizado} onPersonalizado={setPersonalizado} rango={rango} />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {!sinNada && <>
          <label className="text-xs font-semibold text-slate-500">Motivo de consulta
            <select aria-label="Motivo de consulta" value={filtros.motivo} onChange={(e) => cambiarFiltro("motivo", e.target.value)} className={selector + " w-52"}>
              <option value="">Todos</option>
              {motivos.map((m) => <option key={m.motivo} value={m.motivo}>{m.motivo}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-500">Origen
            <select aria-label="Origen" value={filtros.origen} onChange={(e) => cambiarFiltro("origen", e.target.value)} className={selector + " w-36"}>
              {ORIGENES_FILTRO.map((o) => <option key={o.id} value={o.id}>{o.etiqueta}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-slate-500">Visita
            <select aria-label="Visita" value={filtros.visita} onChange={(e) => cambiarFiltro("visita", e.target.value)} className={selector + " w-40"}>
              {SEGUIMIENTO_FILTRO.map((o) => <option key={o.id} value={o.id}>{o.etiqueta}</option>)}
            </select>
          </label>
          {esAdmin && (
            <label className="text-xs font-semibold text-slate-500">Profesional
              <select aria-label="Profesional" value={filtros.profesional} onChange={(e) => cambiarFiltro("profesional", e.target.value)} className={selector + " w-48"}>
                <option value="">Todos</option>
                {profesionales.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </label>
          )}
          </>}
          <ul className="ml-auto flex min-w-[160px] flex-1 flex-wrap items-center justify-end gap-1.5 self-center" aria-label="Filtros activos">
            {etiquetas.map((e) => (
              <li key={e.id} className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                {e.texto}
                {e.quitar && <button type="button" onClick={e.quitar} aria-label={`Quitar el filtro ${e.texto}`} className="rounded-full p-0.5 text-slate-500 hover:bg-slate-200 cursor-pointer"><X size={12} aria-hidden="true" /></button>}
              </li>
            ))}
            {hay && <li><button type="button" onClick={r.quitarFiltros} className="rounded-full px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50 cursor-pointer">Limpiar filtros</button></li>}
          </ul>
        </div>
      </div>

      <div role="tablist" aria-label="Reportes" className="flex gap-1 border-b border-slate-200/70">
        {pestanasVisibles.map((p) => (
          <button key={p.id} type="button" role="tab" id={`rep-tab-${p.id}`} aria-selected={actual.id === p.id} aria-controls="rep-panel" onClick={() => setPestana(p.id)} className={"-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors cursor-pointer " + (actual.id === p.id ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700")}>{p.etiqueta}</button>
        ))}
      </div>

      <div id="rep-panel" role="tabpanel" aria-labelledby={`rep-tab-${actual.id}`} className="space-y-4 pb-6">
        {actual.id === "resumen" && <PestanaResumen r={r} />}
        {actual.id === "citas" && <PestanaCitas r={r} />}
        {actual.id === "clinico" && <PestanaClinico r={r} />}
        {actual.id === "ventas" && <PestanaVentas r={r} />}
        {actual.id === "pedidos" && <PestanaPedidos r={r} />}
        {actual.id === "inventario" && <PestanaInventario r={r} />}
      </div>

      {detalle && <VentanaDetalle d={detalle} onCerrar={() => setDetalle(null)} />}
      {exportando && <VentanaExportar r={r} pestana={actual.id} onCerrar={() => setExportando(false)} />}
    </div>
  )
}
