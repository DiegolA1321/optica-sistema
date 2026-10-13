"use client"

import { useMemo, useState } from "react"
import { ArrowRight, Download, Info, Inbox, Printer } from "lucide-react"
import { Cascaron } from "../componentes/AtencionPaciente"
import CampoFecha from "../componentes/CampoFecha"
import { INK, GRAD_MARCA } from "@/lib/tema"
import { dinero } from "../utilidades/formatoMoneda"
import { fechaLegible, formatoFecha } from "../utilidades/formatoFecha"
import { ahoraEcuador } from "../utilidades/horaEcuador"
import { filtrarPorMotivo, motivosEnConsultas, categoriasDeConsulta } from "../utilidades/reportesDiagnosticos"
import { calcularEmbudo } from "../utilidades/embudo"
import { vendidoYCobrado, cobradoDeFactura } from "../utilidades/vendidoCobrado"
import { numeroComprobante } from "../utilidades/comprobantes"
import { esInactivo, diasVencido } from "../utilidades/fidelizacion"
import { estaAtrasada, ordenesAbiertas, numeroOrden } from "../utilidades/ordenesLaboratorio"
import { resumenPorLaboratorio } from "../utilidades/reportesLaboratorio"
import { PERIODOS, rangoDePeriodo, rangoAnterior, enRango, variacion, porcentaje, descargarExcel, diaDe } from "../utilidades/reportesV2"

const PESTANAS = [
  { id: "resumen", label: "Resumen", pregunta: "¿Cómo le fue a la óptica en este período?" },
  { id: "clinico", label: "Clínico", pregunta: "¿Qué atendemos y cómo están nuestros pacientes?" },
  { id: "ventas", label: "Ventas", pregunta: "¿Cuánto vendemos, cuánto cobramos y por qué no compran?" },
  { id: "citas", label: "Citas", pregunta: "¿Cómo usamos la agenda?" },
  { id: "laboratorios", label: "Laboratorios", pregunta: "¿Cumplen los laboratorios?" },
]
const MODULO = { consultas: "Pacientes", pacientes: "Pacientes", ventas: "Ventas", citas: "Citas médicas", laboratorios: "Ventas" }
const PESTANA_DE = { consultas: "clinico", pacientes: "clinico", ventas: "ventas", citas: "citas", laboratorios: "laboratorios" }
const MODULO_ID = { consultas: "pacientes", pacientes: "pacientes", ventas: "ventas", citas: "citas", laboratorios: "ventas" }
const TONO = { bueno: "text-emerald-700", malo: "text-red-600", neutro: "text-slate-500" }
const ESTADO_PENDIENTE = ["Pendiente", "En Espera", "En Atención"]

const nombreEstado = (e) => (e === "No Asistió" ? "No asistió" : e === "Atendida" ? "Atendida" : e === "Cancelada" ? "Cancelada" : "Pendiente")

function Ayuda({ texto }) {
  return <Info size={12} className="shrink-0 cursor-help text-slate-400" title={texto} aria-label={texto} role="img" />
}

// Una tarjeta de número: el valor, su variación frente al período anterior (verde = bueno, rojo = malo) y, si es "a hoy", su etiqueta.
function Tarjeta({ titulo, valor, v, ayuda, aHoy = false, onClick, sub }) {
  return (
    <div className="flex flex-col justify-between rounded-2xl border border-slate-200/60 bg-white p-3 shadow-sm transition-colors hover:border-slate-300">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] font-bold uppercase leading-tight tracking-wider text-slate-500">{titulo}</span>
        <span className="flex shrink-0 items-center gap-1.5">
          {aHoy && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">A hoy</span>}
          {ayuda && <Ayuda texto={ayuda} />}
        </span>
      </div>
      <button type="button" onClick={onClick} disabled={!onClick} aria-label={`${titulo}: ${valor}. Ver el detalle`} className="mt-1 block w-full text-left enabled:cursor-pointer">
        <span className="block font-serif text-2xl font-semibold leading-none" style={{ color: INK }}>{valor}</span>
        <span className={"mt-1 block text-xs leading-tight " + (v ? TONO[v.tono] : "text-slate-500")}>
          {v ? <><span aria-hidden="true">{v.flecha}</span> {v.texto}</> : sub || " "}
        </span>
      </button>
    </div>
  )
}

// La ventana de detalle: el mismo número que se pulsó, los filtros aplicados, la lista exacta y su Excel.
function Detalle({ d, filtros, usuario, onAbrir, onIrAPestana, onCerrar }) {
  const [bajando, setBajando] = useState(false)
  const descargar = async () => {
    setBajando(true)
    try { await descargarExcel({ usuario, archivo: d.archivo, titulo: `${d.titulo}: ${d.valor}`, filtros, columnas: d.columnas, filas: d.filas }) } finally { setBajando(false) }
  }
  return (
    <Cascaron
      titulo={d.titulo}
      subtitulo={filtros}
      Icono={d.icono || Inbox}
      ancho="max-w-4xl"
      onCerrar={onCerrar}
      derecha={<span className="font-serif text-2xl font-semibold leading-none" style={{ color: INK }}>{d.valor}</span>}
      pie={<>
        <div className="flex flex-wrap items-center gap-4"><button type="button" onClick={() => { onCerrar(); onAbrir(d.modulo) }} className="flex items-center gap-1 text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">Abrir en {MODULO[d.modulo]} <ArrowRight size={14} aria-hidden="true" /></button>{d.desdeResumen && <button type="button" onClick={() => { onCerrar(); onIrAPestana(PESTANA_DE[d.modulo]) }} className="flex items-center gap-1 text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">Ir a la pestaña {PESTANAS.find((p) => p.id === PESTANA_DE[d.modulo]).label} <ArrowRight size={14} aria-hidden="true" /></button>}</div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={descargar} disabled={bajando || d.filas.length === 0} className="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold text-white transition-opacity disabled:opacity-50 cursor-pointer" style={{ background: GRAD_MARCA }}><Download size={14} aria-hidden="true" />{bajando ? "Preparando…" : "Descargar Excel"}</button>
          <button type="button" onClick={onCerrar} className="rounded-lg border border-slate-200/60 px-3.5 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">Cerrar</button>
        </div>
      </>}
    >
      {d.filas.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-slate-500">No hay registros con estos filtros. Prueba con otro período o quita el motivo o el profesional.</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-slate-50 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
            <tr>{d.columnas.map((c) => <th key={c.titulo} scope="col" className={"px-4 py-2 " + (c.derecha ? "text-right" : "")}>{c.titulo}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {d.filas.map((f, i) => (
              <tr key={i} className="hover:bg-slate-50/60">
                {d.columnas.map((c) => <td key={c.titulo} className={"px-4 py-2 " + (c.derecha ? "text-right tabular-nums" : "") + (f.__anulada ? " text-slate-400 line-through" : "")}>{c.ver ? c.ver(f) : c.valor(f)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Cascaron>
  )
}

function Barras({ datos, formato = (n) => n, onElegir }) {
  const max = Math.max(1, ...datos.map((d) => d.valor))
  return (
    <div className="flex h-36 items-end gap-3">
      {datos.map((d) => (
        <button key={d.etiqueta} type="button" onClick={onElegir ? () => onElegir(d) : undefined} title={`${d.etiqueta}: ${formato(d.valor)}`} aria-label={`${d.etiqueta}: ${formato(d.valor)}`} className="flex h-full flex-1 flex-col items-center justify-end gap-1 cursor-pointer">
          <span className="text-xs font-semibold tabular-nums text-slate-700">{formato(d.valor)}</span>
          <span className="w-full rounded-t-md bg-blue-500/80 transition-colors hover:bg-blue-600" style={{ height: `${Math.max(2, (d.valor / max) * 100)}%` }} />
          <span className="text-[11px] text-slate-500">{d.etiqueta}</span>
        </button>
      ))}
    </div>
  )
}

export default function ReportesV2({ usuario, cargaInicial = false, pacientes = [], consultas: consultasTodas = [], consultasCompletas = null, citas: citasTodas = [], ventas = [], facturasVenta = [], pases = [], abonos = [], ordenesLab = [], soloLoPropio = false, verMontos = true, onAbrirModulo }) {
  const esAdmin = usuario?.rol === "admin" && !soloLoPropio
  const propio = soloLoPropio || (!!usuario?.esOptometra && usuario?.rol !== "admin")
  const ocultarMontos = propio || verMontos === false
  const historial = consultasCompletas || consultasTodas

  const [pestana, setPestana] = useState("resumen")
  const [periodo, setPeriodo] = useState("mes")
  const [personalizado, setPersonalizado] = useState({ inicio: "", fin: "" })
  const [motivo, setMotivo] = useState("")
  const [profesional, setProfesional] = useState("")
  const [detalle, setDetalle] = useState(null)

  const hoy = ahoraEcuador()
  const rango = useMemo(() => rangoDePeriodo(periodo, personalizado, hoy), [periodo, personalizado]) // eslint-disable-line react-hooks/exhaustive-deps
  const previo = useMemo(() => rangoAnterior(periodo, rango, hoy), [periodo, rango]) // eslint-disable-line react-hooks/exhaustive-deps

  const motivos = useMemo(() => motivosEnConsultas(consultasTodas), [consultasTodas])
  const profesionales = useMemo(() => {
    const m = new Map()
    for (const c of consultasTodas) if (c.profesionalId && !m.has(c.profesionalId)) m.set(c.profesionalId, c.profesionalNombre || "Profesional")
    return [...m.entries()].map(([id, nombre]) => ({ id, nombre })).sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [consultasTodas])
  const nombreProf = profesionales.find((p) => p.id === profesional)?.nombre
  const hayFiltro = !!motivo || !!profesional

  const pacientePorId = useMemo(() => new Map(pacientes.map((p) => [p.id, p])), [pacientes])
  const nombreDe = (id, respaldo = "") => pacientePorId.get(id)?.nombre || respaldo || "—"
  const cedulaDe = (id) => pacientePorId.get(id)?.cedula || ""

  // Todo lo que se ve respeta los filtros de motivo y profesional.
  const consultas = useMemo(() => filtrarPorMotivo(consultasTodas, motivo).filter((c) => !profesional || c.profesionalId === profesional), [consultasTodas, motivo, profesional])
  const idsConsultas = useMemo(() => new Set(consultas.map((c) => c.id)), [consultas])
  const citas = useMemo(() => citasTodas.filter((c) => (!motivo || (c.motivo || "").trim() === motivo) && (!profesional || c.atendidoPor === profesional || (!c.atendidoPor && c.asignadoA === profesional))), [citasTodas, motivo, profesional])
  const facturas = useMemo(() => (hayFiltro ? facturasVenta.filter((f) => f.consultaId && idsConsultas.has(f.consultaId)) : facturasVenta), [facturasVenta, hayFiltro, idsConsultas])
  const pasesFiltrados = useMemo(() => (hayFiltro ? pases.filter((p) => idsConsultas.has(p.consultaId)) : pases), [pases, hayFiltro, idsConsultas])

  // Las métricas de un período, para compararlas con el anterior equivalente.
  const metricas = (r) => {
    const en = (f) => enRango(f, r)
    const cons = consultas.filter((c) => en(c.fecha))
    const idsConPeriodo = new Set(cons.map((c) => c.pacienteId))
    const nuevos = pacientes.filter((p) => en(p.fechaRegistro) && (!hayFiltro || idsConPeriodo.has(p.id)))
    const vc = vendidoYCobrado({ facturas, ventasViejas: hayFiltro ? [] : ventas, abonos, enPeriodo: en })
    const cs = citas.filter((c) => en(c.fecha))
    const programadas = cs.filter((c) => c.estado !== "Cancelada")
    const noAsistio = cs.filter((c) => c.estado === "No Asistió")
    const embudo = calcularEmbudo({ consultas, pases: pasesFiltrados, facturas, enRango: en, historial })
    return { cons, nuevos, vc, cs, noAsistio, programadas, embudo, tasaInasist: porcentaje(noAsistio.length, programadas.length), conversion: embudo.compraronSobreConsultaron }
  }
  const act = useMemo(() => metricas(rango), [consultas, citas, facturas, pasesFiltrados, pacientes, rango]) // eslint-disable-line react-hooks/exhaustive-deps
  const ant = useMemo(() => metricas(previo), [consultas, citas, facturas, pasesFiltrados, pacientes, previo]) // eslint-disable-line react-hooks/exhaustive-deps

  // Lo que es "a hoy": no cambia con el período.
  const controlVencido = useMemo(() => pacientes.filter((p) => esInactivo(p, historial)), [pacientes, historial])
  const deAlta = useMemo(() => pacientes.filter((p) => p.estadoClinico === "De alta"), [pacientes])
  const abiertas = useMemo(() => ordenesAbiertas(ordenesLab), [ordenesLab])
  const atrasadas = useMemo(() => ordenesLab.filter((o) => estaAtrasada(o)), [ordenesLab])
  const porLab = useMemo(() => resumenPorLaboratorio(ordenesLab, { enRango: (f) => enRango(f, rango) }), [ordenesLab, rango])

  // ─── Columnas y listas de la ventana de detalle ───
  const colConsulta = [
    { titulo: "Fecha", valor: (f) => fechaLegible(f.fecha) },
    { titulo: "Paciente", valor: (f) => nombreDe(f.pacienteId, f.paciente) },
    { titulo: "Cédula", valor: (f) => cedulaDe(f.pacienteId) },
    { titulo: "Motivo", valor: (f) => f.motivo || "—" },
    { titulo: "Diagnóstico", valor: (f) => categoriasDeConsulta(f).join(", ") || "—" },
  ]
  const colCita = [
    { titulo: "Fecha", valor: (f) => fechaLegible(f.fecha) },
    { titulo: "Hora", valor: (f) => f.hora },
    { titulo: "Paciente", valor: (f) => f.paciente },
    { titulo: "Motivo", valor: (f) => f.motivo || "—" },
    { titulo: "Estado", valor: (f) => nombreEstado(f.estado) },
  ]
  const saldoDe = (f) => (f.estado === "anulada" ? 0 : Math.max(0, f.montoTotal - cobradoDeFactura(f, abonos)))
  const colFactura = [
    { titulo: "Fecha", valor: (f) => diaDe(f.creadoEn), ver: (f) => fechaLegible(diaDe(f.creadoEn)) },
    { titulo: "Comprobante", valor: (f) => numeroComprobante(f.numero) },
    { titulo: "Paciente", valor: (f) => nombreDe(f.pacienteId) },
    { titulo: "Cédula", valor: (f) => cedulaDe(f.pacienteId) },
    { titulo: "Total", valor: (f) => f.montoTotal, ver: (f) => dinero(f.montoTotal), derecha: true },
    { titulo: "Cobrado", valor: (f) => (f.estado === "anulada" ? 0 : cobradoDeFactura(f, abonos)), ver: (f) => dinero(f.estado === "anulada" ? 0 : cobradoDeFactura(f, abonos)), derecha: true },
    { titulo: "Saldo", valor: (f) => saldoDe(f), ver: (f) => dinero(saldoDe(f)), derecha: true },
    { titulo: "Método de pago", valor: (f) => f.metodoPago || "—" },
    { titulo: "Factura electrónica", valor: (f) => f.facturaElectronica || "—" },
    { titulo: "Estado", valor: (f) => (f.estado === "anulada" ? "ANULADA" : f.estado === "pendiente_pago" ? "Con saldo" : "Pagada") },
  ]
  const facturasDelPeriodo = useMemo(() => facturas.filter((f) => enRango(f.creadoEn, rango)).sort((a, b) => (a.numero ?? 0) - (b.numero ?? 0)), [facturas, rango])
  const vigentes = facturasDelPeriodo.filter((f) => f.estado !== "anulada")

  const filtrosTexto = [
    `Período: ${formatoFecha(rango.inicio, "medio")} a ${formatoFecha(rango.fin, "medio")}`,
    motivo && `Motivo: ${motivo}`,
    nombreProf && `Profesional: ${nombreProf}`,
    propio && "Solo tus consultas y tus citas",
  ].filter(Boolean).join(" · ")

  const abrir = (titulo, valor, modulo, columnas, filas, archivo, icono) => setDetalle({ titulo, valor, modulo, columnas, filas, archivo, icono, desdeResumen: pestana === "resumen" })
  const aEcuadorTexto = (n) => String(n)

  // ─── Pestañas ───
  const vc = act.vc, vca = ant.vc
  const tarjetasResumen = [
    { titulo: "Consultas", valor: act.cons.length, v: variacion(act.cons.length, ant.cons.length), ayuda: "Fichas clínicas guardadas en el período.", onClick: () => abrir("Consultas", act.cons.length, "consultas", colConsulta, act.cons, "consultas") },
    { titulo: "Pacientes nuevos", valor: act.nuevos.length, v: variacion(act.nuevos.length, ant.nuevos.length), ayuda: "Pacientes registrados en el período.", onClick: () => abrir("Pacientes nuevos", act.nuevos.length, "pacientes", [
      { titulo: "Registro", valor: (f) => fechaLegible(f.fechaRegistro) }, { titulo: "Paciente", valor: (f) => f.nombre }, { titulo: "Cédula", valor: (f) => f.cedula || "—" }, { titulo: "Teléfono", valor: (f) => f.telefono || "—" },
    ], act.nuevos, "pacientes-nuevos") },
    !ocultarMontos && { titulo: "Vendido", valor: dinero(vc.vendido), v: variacion(vc.vendido, vca.vendido), ayuda: "Total de los comprobantes del período, sin los anulados.", onClick: () => abrir("Vendido", dinero(vc.vendido), "ventas", colFactura, vigentes, "vendido") },
    !ocultarMontos && { titulo: "Cobrado", valor: dinero(vc.cobrado), v: variacion(vc.cobrado, vca.cobrado), ayuda: "Lo que de lo vendido ya se pagó.", onClick: () => abrir("Cobrado", dinero(vc.cobrado), "ventas", colFactura, vigentes.filter((f) => cobradoDeFactura(f, abonos) > 0), "cobrado") },
    { titulo: "No asistió", valor: act.tasaInasist == null ? "—" : `${act.tasaInasist}%`, v: act.tasaInasist == null ? null : variacion(act.tasaInasist, ant.tasaInasist, { buenoSiSube: false, puntos: true }), sub: act.tasaInasist == null ? "Sin citas en el período" : undefined, ayuda: "Citas en que el paciente no llegó, sobre las citas que no se cancelaron.", onClick: () => abrir("No asistió", act.noAsistio.length, "citas", colCita, act.noAsistio, "no-asistio") },
    !ocultarMontos && { titulo: "Conversión a venta", valor: act.conversion == null ? "—" : `${act.conversion}%`, v: act.conversion == null ? null : variacion(act.conversion, ant.conversion, { puntos: true }), sub: act.conversion == null ? "Sin consultas en el período" : undefined, ayuda: "De los que consultaron en el período, cuántos terminaron comprando.", onClick: () => abrir("Consultaron y compraron", act.embudo.compraron, "ventas", colConsulta, act.cons.filter((c) => facturas.some((f) => f.consultaId === c.id && f.estado !== "anulada")), "conversion") },
  ].filter(Boolean)

  const meses = useMemo(() => {
    const out = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
      const ini = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
      const fin = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()).padStart(2, "0")}`
      const r = { inicio: ini, fin }
      out.push({ etiqueta: formatoFecha(ini, "medio").split(" ")[1] || ini, rango: r, consultas: consultas.filter((c) => enRango(c.fecha, r)), vendido: vendidoYCobrado({ facturas, ventasViejas: hayFiltro ? [] : ventas, abonos, enPeriodo: (f) => enRango(f, r) }).vendido })
    }
    return out
  }, [consultas, facturas, ventas, abonos, hayFiltro]) // eslint-disable-line react-hooks/exhaustive-deps

  const colPaciente = (extra) => [{ titulo: "Paciente", valor: (f) => f.nombre }, { titulo: "Cédula", valor: (f) => f.cedula || "—" }, { titulo: "Teléfono", valor: (f) => f.telefono || "—" }, ...(extra ? [extra] : [])]
  const colOrden = [
    { titulo: "Orden", valor: (f) => numeroOrden(f.numero) },
    { titulo: "Paciente", valor: (f) => nombreDe(f.pacienteId) },
    { titulo: "Laboratorio", valor: (f) => f.laboratorio || "Sin laboratorio" },
    { titulo: "Prometida", valor: (f) => (f.fechaPrometida ? fechaLegible(f.fechaPrometida) : "—") },
    { titulo: "Estado", valor: (f) => (estaAtrasada(f) ? "Atrasada" : f.estado === "lista" ? "Lista" : f.estado === "enviada" ? "Enviada" : f.estado) },
  ]

  const porEstado = [
    { id: "Atendida", etiqueta: "Atendidas", lista: act.cs.filter((c) => c.estado === "Atendida") },
    { id: "No Asistió", etiqueta: "No asistió", lista: act.noAsistio },
    { id: "Cancelada", etiqueta: "Canceladas", lista: act.cs.filter((c) => c.estado === "Cancelada") },
    { id: "Pendiente", etiqueta: "Pendientes", lista: act.cs.filter((c) => ESTADO_PENDIENTE.includes(c.estado)) },
  ]

  const exportarContador = () => descargarExcel({ usuario, archivo: `ventas-${rango.inicio}-a-${rango.fin}`, titulo: "Reporte de ventas para el contador (las anuladas van marcadas)", filtros: filtrosTexto, columnas: colFactura, filas: facturasDelPeriodo })

  if (cargaInicial && pacientes.length === 0 && consultasTodas.length === 0 && citasTodas.length === 0) {
    return <div className="space-y-4" aria-busy="true">{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200/70" />)}</div>
  }

  const cuadricula = "grid grid-cols-2 gap-2.5 lg:grid-cols-3 xl:grid-cols-6"
  const Seccion = ({ titulo, aHoy, children, derecha }) => (
    <section className="space-y-2" aria-label={titulo}>
      <div className="flex items-center gap-2">
        <h2 className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{titulo}</h2>
        {aHoy && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">A hoy</span>}
        {derecha && <div className="ml-auto">{derecha}</div>}
      </div>
      {children}
    </section>
  )
  const Caja = ({ children }) => <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm">{children}</div>

  return (
    <div className="space-y-4" data-reportes-v2>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div>
          <h1 className="text-xl font-bold" style={{ color: INK }}>Reportes</h1>
          <p className="text-xs text-slate-500">{PESTANAS.find((p) => p.id === pestana).pregunta}</p>
        </div>
        {propio && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Solo tus consultas y tus citas</span>}
        <button type="button" onClick={() => window.print()} className="ml-auto flex items-center gap-1.5 rounded-lg border border-slate-200/60 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer print:hidden"><Printer size={14} aria-hidden="true" /> Imprimir o guardar PDF</button>
      </div>

      {/* Filtros únicos: arriba y en el mismo lugar en todas las pestañas */}
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2 rounded-2xl border border-slate-200/60 bg-white px-3 py-2.5 shadow-sm print:border-0 print:shadow-none">
        <div role="group" aria-label="Período" className="flex flex-wrap rounded-lg border border-slate-200/60 bg-white p-0.5 print:hidden">
          {PERIODOS.map((p) => (
            <button key={p.id} type="button" aria-pressed={periodo === p.id} onClick={() => setPeriodo(p.id)} className={"rounded-md px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer " + (periodo === p.id ? "text-white" : "text-slate-600 hover:bg-slate-50")} style={periodo === p.id ? { background: GRAD_MARCA } : undefined}>{p.label}</button>
          ))}
        </div>
        {periodo === "personalizado" && (
          <div className="flex items-center gap-2 print:hidden">
            <div className="w-40"><CampoFecha id="rep-desde" etiqueta="Desde" valor={personalizado.inicio || rango.inicio} onCambiar={(v) => setPersonalizado((p) => ({ ...p, inicio: v }))} max={personalizado.fin || rango.fin} /></div>
            <div className="w-40"><CampoFecha id="rep-hasta" etiqueta="Hasta" valor={personalizado.fin || rango.fin} onCambiar={(v) => setPersonalizado((p) => ({ ...p, fin: v }))} min={personalizado.inicio || rango.inicio} /></div>
          </div>
        )}
        <label className="text-xs font-semibold text-slate-500 print:hidden">Motivo de consulta
          <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className="mt-0.5 block rounded-lg border border-slate-200/60 bg-white px-2 py-1.5 text-sm font-normal text-slate-700">
            <option value="">Todos</option>
            {motivos.map((m) => <option key={m.motivo} value={m.motivo}>{m.motivo}</option>)}
          </select>
        </label>
        {esAdmin && (
          <label className="text-xs font-semibold text-slate-500 print:hidden">Profesional
            <select value={profesional} onChange={(e) => setProfesional(e.target.value)} className="mt-0.5 block rounded-lg border border-slate-200/60 bg-white px-2 py-1.5 text-sm font-normal text-slate-700">
              <option value="">Todos</option>
              {profesionales.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </label>
        )}
        <p className="ml-auto self-center text-xs text-slate-500">{filtrosTexto}</p>
      </div>

      <div role="tablist" aria-label="Reportes" className="flex gap-1 border-b border-slate-200/70 print:hidden">
        {PESTANAS.map((p) => (
          <button key={p.id} type="button" role="tab" aria-selected={pestana === p.id} onClick={() => setPestana(p.id)} className={"-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors cursor-pointer " + (pestana === p.id ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-700")}>{p.label}</button>
        ))}
      </div>

      {pestana === "resumen" && (
        <div className="space-y-4" role="tabpanel" aria-label="Resumen">
          <div className={cuadricula}>{tarjetasResumen.map((t) => <Tarjeta key={t.titulo} {...t} />)}</div>
          <Seccion titulo="Últimos 6 meses">
            <div className={"grid gap-3 " + (ocultarMontos ? "" : "lg:grid-cols-2")}>
              <Caja>
                <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-700">Consultas por mes <Ayuda texto="Número de fichas clínicas guardadas cada mes. Pulsa una barra para ver las consultas." /></p>
                <Barras datos={meses.map((m) => ({ etiqueta: m.etiqueta, valor: m.consultas.length, m }))} onElegir={(d) => abrir(`Consultas · ${d.etiqueta}`, d.valor, "consultas", colConsulta, d.m.consultas, `consultas-${d.m.rango.inicio.slice(0, 7)}`)} />
              </Caja>
              {!ocultarMontos && (
                <Caja>
                  <p className="mb-2 flex items-center gap-1.5 text-sm font-bold text-slate-700">Vendido por mes <Ayuda texto="Total de los comprobantes de cada mes, sin los anulados. Pulsa una barra para ver los comprobantes." /></p>
                  <Barras datos={meses.map((m) => ({ etiqueta: m.etiqueta, valor: m.vendido, m }))} formato={(n) => dinero(n)} onElegir={(d) => abrir(`Vendido · ${d.etiqueta}`, dinero(d.valor), "ventas", colFactura, facturas.filter((f) => f.estado !== "anulada" && enRango(f.creadoEn, d.m.rango)), `vendido-${d.m.rango.inicio.slice(0, 7)}`)} />
                </Caja>
              )}
            </div>
          </Seccion>
        </div>
      )}

      {pestana === "clinico" && (
        <div className="space-y-4" role="tabpanel" aria-label="Clínico">
          <Seccion titulo="En el período">
            <div className={cuadricula}>
              <Tarjeta titulo="Consultas" valor={act.cons.length} v={variacion(act.cons.length, ant.cons.length)} ayuda="Fichas clínicas guardadas en el período." onClick={() => abrir("Consultas", act.cons.length, "consultas", colConsulta, act.cons, "consultas")} />
            </div>
          </Seccion>
          <Seccion titulo="Pacientes" aHoy>
            <div className={cuadricula}>
              <Tarjeta titulo="Control vencido" valor={controlVencido.length} aHoy ayuda="Pacientes cuyo próximo control recomendado ya pasó. No cambia con el período." onClick={() => abrir("Control vencido", controlVencido.length, "pacientes", colPaciente({ titulo: "Días de retraso", valor: (f) => diasVencido(f, historial) ?? "" }), controlVencido, "control-vencido")} />
              <Tarjeta titulo="Tratamientos finalizados" valor={deAlta.length} aHoy ayuda="Pacientes dados de alta desde la ficha clínica." onClick={() => abrir("Tratamientos finalizados", deAlta.length, "pacientes", colPaciente(), deAlta, "tratamientos-finalizados")} />
            </div>
          </Seccion>
          <p className="text-xs text-slate-500">Falta en esta maqueta: diagnósticos más frecuentes, diagnósticos por mes y año (R60) y estado de corrección.</p>
        </div>
      )}

      {pestana === "ventas" && (
        ocultarMontos ? (
          <Caja><p className="text-sm text-slate-600">Tu perfil no incluye los montos de ventas.</p></Caja>
        ) : (
          <div className="space-y-4" role="tabpanel" aria-label="Ventas">
            <Seccion titulo="En el período" derecha={<button type="button" onClick={exportarContador} className="flex items-center gap-1.5 rounded-lg border border-slate-200/60 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer"><Download size={14} aria-hidden="true" /> Reporte para el contador (Excel)</button>}>
              <div className={cuadricula}>
                <Tarjeta titulo="Vendido" valor={dinero(vc.vendido)} v={variacion(vc.vendido, vca.vendido)} ayuda="Total de los comprobantes del período, sin los anulados." onClick={() => abrir("Vendido", dinero(vc.vendido), "ventas", colFactura, vigentes, "vendido")} />
                <Tarjeta titulo="Cobrado" valor={dinero(vc.cobrado)} v={variacion(vc.cobrado, vca.cobrado)} ayuda="Lo que de lo vendido ya se pagó." onClick={() => abrir("Cobrado", dinero(vc.cobrado), "ventas", colFactura, vigentes.filter((f) => cobradoDeFactura(f, abonos) > 0), "cobrado")} />
                <Tarjeta titulo="Saldo pendiente" valor={dinero(Math.max(0, vc.vendido - vc.cobrado))} v={variacion(Math.max(0, vc.vendido - vc.cobrado), Math.max(0, vca.vendido - vca.cobrado), { buenoSiSube: false })} ayuda="Vendido menos cobrado." onClick={() => abrir("Saldo pendiente", dinero(Math.max(0, vc.vendido - vc.cobrado)), "ventas", colFactura, vigentes.filter((f) => saldoDe(f) > 0), "saldo-pendiente")} />
                <Tarjeta titulo="Conversión a venta" valor={act.conversion == null ? "—" : `${act.conversion}%`} v={act.conversion == null ? null : variacion(act.conversion, ant.conversion, { puntos: true })} sub={act.conversion == null ? "Sin consultas en el período" : undefined} ayuda="De los que consultaron en el período, cuántos terminaron comprando." />
              </div>
            </Seccion>
            <p className="text-xs text-slate-500">Falta en esta maqueta: embudo con motivos de no compra y proformas (R40), primera vez frente a pacientes de la óptica, ventas por tipo de luna y productos más vendidos.</p>
          </div>
        )
      )}

      {pestana === "citas" && (
        <div className="space-y-4" role="tabpanel" aria-label="Citas">
          <Seccion titulo="Citas del período">
            <div className={cuadricula}>
              {porEstado.map((e) => (
                <Tarjeta key={e.id} titulo={e.etiqueta} valor={e.lista.length} v={variacion(e.lista.length, ant.cs.filter((c) => (e.id === "Pendiente" ? ESTADO_PENDIENTE.includes(c.estado) : c.estado === e.id)).length, { buenoSiSube: e.id === "Atendida" })} onClick={() => abrir(e.etiqueta, e.lista.length, "citas", colCita, e.lista, `citas-${e.id.toLowerCase().replace(/\s|ó/g, "-")}`)} />
              ))}
              <Tarjeta titulo="Tasa de inasistencia" valor={act.tasaInasist == null ? "—" : `${act.tasaInasist}%`} v={act.tasaInasist == null ? null : variacion(act.tasaInasist, ant.tasaInasist, { buenoSiSube: false, puntos: true })} sub={act.tasaInasist == null ? "Sin citas en el período" : undefined} ayuda="No asistió sobre las citas que no se cancelaron." />
            </div>
          </Seccion>
          <p className="text-xs text-slate-500">Falta en esta maqueta: tendencia de inasistencia, por día de la semana y franja horaria, por origen y por profesional.</p>
        </div>
      )}

      {pestana === "laboratorios" && (
        <div className="space-y-4" role="tabpanel" aria-label="Laboratorios">
          <Seccion titulo="Órdenes" aHoy>
            <div className={cuadricula}>
              <Tarjeta titulo="Abiertas" valor={abiertas.length} aHoy ayuda="Órdenes enviadas o listas que aún no se entregan." onClick={() => abrir("Órdenes abiertas", abiertas.length, "laboratorios", colOrden, abiertas, "ordenes-abiertas")} />
              <Tarjeta titulo="Atrasadas" valor={atrasadas.length} aHoy ayuda="Enviadas cuya fecha prometida ya pasó." onClick={() => abrir("Órdenes atrasadas", atrasadas.length, "laboratorios", colOrden, atrasadas, "ordenes-atrasadas")} />
            </div>
          </Seccion>
          <Seccion titulo="Por laboratorio">
            {porLab.length === 0 ? (
              <Caja><p className="text-sm text-slate-600">Aún no hay órdenes de laboratorio. Se crean desde la ficha clínica o desde Ventas.</p></Caja>
            ) : (
              <Caja>
                <table className="w-full text-sm">
                  <thead className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500"><tr><th scope="col" className="py-1">Laboratorio</th><th scope="col" className="py-1 text-right">Abiertas</th><th scope="col" className="py-1 text-right">Atrasadas</th><th scope="col" className="py-1 text-right">Entregadas</th><th scope="col" className="py-1 text-right">Promedio de entrega</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {porLab.map((l) => (
                      <tr key={l.laboratorio}><th scope="row" className="py-1.5 text-left font-semibold text-slate-700">{l.laboratorio}</th><td className="text-right tabular-nums">{l.abiertas}</td><td className={"text-right tabular-nums " + (l.atrasadas > 0 ? "font-semibold text-red-600" : "")}>{l.atrasadas}</td><td className="text-right tabular-nums">{l.entregadas}</td><td className="text-right tabular-nums">{l.promedioDias == null ? "—" : `${aEcuadorTexto(Math.round(l.promedioDias * 10) / 10)} días`}</td></tr>
                    ))}
                  </tbody>
                </table>
              </Caja>
            )}
          </Seccion>
          <p className="text-xs text-slate-500">Falta en esta maqueta: porcentaje entregado a tiempo.</p>
        </div>
      )}

      {detalle && <Detalle d={detalle} filtros={filtrosTexto} usuario={usuario} onAbrir={(m) => onAbrirModulo?.(MODULO_ID[m])} onIrAPestana={setPestana} onCerrar={() => setDetalle(null)} />}
    </div>
  )
}
