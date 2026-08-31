"use client"

import { useMemo, useState } from "react"
import {
  BarChart3,
  Stethoscope,
  UserPlus,
  CheckCircle2,
  AlertTriangle,
  CalendarClock,
  DollarSign,
  TrendingUp,
  Star,
} from "lucide-react"
import { esInactivo } from "../utilidades/fidelizacion"
import { useAnchoElemento } from "../utilidades/graficos"

// ─── Paleta de firma (consistente con el resto del sistema) ───
const INK = "#0E2B33"
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)" // cian → azul

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]

// Colores de estado — los mismos que usan Pacientes.jsx / PortalPaciente.jsx,
// para que un mismo estado se vea igual en todo el sistema.
const COLOR_CORRECCION = {
  "Bien corregido": "#059669",
  "Requiere ajuste": "#dc2626",
  "Sin evaluación": "#d97706",
}

function ultimosNMeses(n) {
  const hoy = new Date()
  const arr = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
    arr.push({ clave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, etiqueta: MESES_CORTOS[d.getMonth()] })
  }
  return arr
}

export default function Reportes({ pacientes = [], consultas = [], citas = [], respuestasSatisfaccion = [] }) {
  const mesActualClave = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  }, [])

  const consultasEsteMes = useMemo(
    () => consultas.filter((c) => (c.fecha || "").startsWith(mesActualClave)).length,
    [consultas, mesActualClave],
  )

  const pacientesNuevosEsteMes = useMemo(
    () => pacientes.filter((p) => (p.fechaRegistro || "").startsWith(mesActualClave)).length,
    [pacientes, mesActualClave],
  )

  const tasaBienCorregido = useMemo(() => {
    const evaluados = pacientes.filter((p) => p.estadoCorreccion && p.estadoCorreccion !== "Sin evaluación")
    if (evaluados.length === 0) return null
    const bien = evaluados.filter((p) => p.estadoCorreccion === "Bien corregido").length
    return Math.round((bien / evaluados.length) * 100)
  }, [pacientes])

  const controlesVencidos = useMemo(() => pacientes.filter((p) => esInactivo(p, consultas)).length, [pacientes, consultas])

  // Vínculo receta → venta (anteproyecto: "tasa de conversión de recetas a
  // ventas" e "ingresos" como indicadores de impacto operativo). Se apoya en
  // consultas.productoId/montoVenta, que ya cierran el ciclo clínico →
  // inventario (ver ConsultaMedica.jsx) — acá solo se agregan los números.
  const consultasEsteMesArr = useMemo(() => consultas.filter((c) => (c.fecha || "").startsWith(mesActualClave)), [consultas, mesActualClave])
  const ventasEsteMes = useMemo(() => consultasEsteMesArr.filter((c) => c.productoId), [consultasEsteMesArr])
  const ingresosEsteMes = useMemo(() => ventasEsteMes.reduce((sum, c) => sum + (Number(c.montoVenta) || 0), 0), [ventasEsteMes])
  const conversionVenta = useMemo(() => {
    if (consultasEsteMesArr.length === 0) return null
    return Math.round((ventasEsteMes.length / consultasEsteMesArr.length) * 100)
  }, [consultasEsteMesArr, ventasEsteMes])

  // Satisfacción de pacientes (CSAT, 1 a 5) — respuestas de la encuesta
  // automática enviada al marcar una cita "Atendida" (migración 0041).
  const promedioSatisfaccion = useMemo(() => {
    if (respuestasSatisfaccion.length === 0) return null
    const suma = respuestasSatisfaccion.reduce((s, r) => s + (Number(r.puntaje) || 0), 0)
    return suma / respuestasSatisfaccion.length
  }, [respuestasSatisfaccion])
  const distSatisfaccion = useMemo(() => {
    const base = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    respuestasSatisfaccion.forEach((r) => { if (base[r.puntaje] != null) base[r.puntaje]++ })
    return base
  }, [respuestasSatisfaccion])
  const maxSatisfaccion = Math.max(1, ...Object.values(distSatisfaccion))

  const consultasPorMes = useMemo(() => {
    const meses = ultimosNMeses(6)
    const mapa = new Map()
    consultas.forEach((c) => {
      const clave = (c.fecha || "").slice(0, 7)
      mapa.set(clave, (mapa.get(clave) || 0) + 1)
    })
    return meses.map((m) => ({ ...m, valor: mapa.get(m.clave) || 0 }))
  }, [consultas])

  const maxConsultasMes = Math.max(1, ...consultasPorMes.map((m) => m.valor))

  // Barras SVG con tooltip propio (no el `title` nativo del navegador, que
  // se ve genérico/lento) — mismo patrón que "Actividad por día" del Panel
  // Superadmin: el viewBox sigue el ancho real del contenedor vía
  // useAnchoElemento, así el gráfico nunca se ve estirado.
  const [refGraficoConsultas, anchoGraficoConsultas] = useAnchoElemento()
  const [hoverMesClave, setHoverMesClave] = useState(null)
  const barrasConsultas = useMemo(() => {
    const w = anchoGraficoConsultas, base = 108, padTop = 10
    const n = consultasPorMes.length || 1
    const gap = 14
    const barW = (w - gap * (n + 1)) / n
    return consultasPorMes.map((m, i) => {
      const alto = maxConsultasMes > 0 ? Math.max(m.valor > 0 ? 6 : 2, (m.valor / maxConsultasMes) * (base - padTop)) : 2
      const x = gap + i * (barW + gap)
      return { ...m, x, w: barW, h: alto, y: base - alto, cx: x + barW / 2 }
    })
  }, [consultasPorMes, maxConsultasMes, anchoGraficoConsultas])
  const [hoverDx, setHoverDx] = useState(null)
  const [hoverCorreccion, setHoverCorreccion] = useState(null)
  const [hoverCitaEstado, setHoverCitaEstado] = useState(null)

  const diagnosticosTop = useMemo(() => {
    const mapa = new Map()
    consultas.forEach((c) => {
      const dx = (c.diagnostico || "").trim()
      if (!dx) return
      mapa.set(dx, (mapa.get(dx) || 0) + 1)
    })
    return Array.from(mapa.entries())
      .map(([label, valor]) => ({ label, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5)
  }, [consultas])

  const maxDiagnostico = Math.max(1, ...diagnosticosTop.map((d) => d.valor))

  const distCorreccion = useMemo(() => {
    const base = { "Bien corregido": 0, "Requiere ajuste": 0, "Sin evaluación": 0 }
    pacientes.forEach((p) => {
      const k = p.estadoCorreccion || "Sin evaluación"
      base[k] = (base[k] ?? 0) + 1
    })
    return base
  }, [pacientes])

  const totalPacientesDist = Math.max(1, pacientes.length)

  // Se lee cita.estado (el desenlace real que el optómetra registra en Citas.jsx),
  // no la fecha — una cita de la semana pasada sin marcar sigue contando como
  // "pendiente" en vez de asumirse "atendida" solo porque el día ya pasó.
  const citasAtendidas = useMemo(() => citas.filter((c) => c.estado === "Atendida").length, [citas])
  const citasNoAsistio = useMemo(() => citas.filter((c) => c.estado === "No Asistió").length, [citas])
  const citasCanceladas = useMemo(() => citas.filter((c) => c.estado === "Cancelada").length, [citas])
  const citasPendientes = useMemo(() => citas.length - citasAtendidas - citasNoAsistio - citasCanceladas, [citas, citasAtendidas, citasNoAsistio, citasCanceladas])
  const totalCitasDist = Math.max(1, citas.length)

  const kpis = [
    { key: "consultas", label: "Consultas este mes", valor: consultasEsteMes, icon: Stethoscope, iconBg: GRAD, iconFg: "#fff" },
    { key: "nuevos", label: "Pacientes nuevos", valor: pacientesNuevosEsteMes, icon: UserPlus, iconBg: undefined, iconClass: "bg-blue-50 text-blue-600" },
    { key: "corregidos", label: "Bien corregidos", valor: tasaBienCorregido === null ? "—" : `${tasaBienCorregido}%`, sub: "de los pacientes evaluados", icon: CheckCircle2, iconClass: "bg-emerald-50 text-emerald-600" },
    { key: "vencidos", label: "Controles vencidos", valor: controlesVencidos, icon: AlertTriangle, iconClass: "bg-red-50 text-red-600" },
    { key: "ingresos", label: "Ingresos este mes", valor: `$${ingresosEsteMes.toFixed(2)}`, sub: `${ventasEsteMes.length} venta${ventasEsteMes.length === 1 ? "" : "s"} vinculada${ventasEsteMes.length === 1 ? "" : "s"} a receta`, icon: DollarSign, iconClass: "bg-amber-50 text-amber-600" },
    { key: "conversion", label: "Conversión a venta", valor: conversionVenta === null ? "—" : `${conversionVenta}%`, sub: "de las consultas de este mes", icon: TrendingUp, iconClass: "bg-violet-50 text-violet-600" },
    { key: "satisfaccion", label: "Satisfacción", valor: promedioSatisfaccion === null ? "—" : `${promedioSatisfaccion.toFixed(1)}/5`, sub: `${respuestasSatisfaccion.length} encuesta${respuestasSatisfaccion.length === 1 ? "" : "s"} respondida${respuestasSatisfaccion.length === 1 ? "" : "s"}`, icon: Star, iconClass: "bg-rose-50 text-rose-600" },
  ]

  return (
    <div className="w-full space-y-6 text-left" style={{ animation: "rise-in 320ms ease-out both" }}>
      {/* ─── HEADER ─── */}
      <div className="flex items-start gap-3.5">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white" style={{ background: GRAD, boxShadow: "0 12px 24px -10px rgba(37,99,235,0.6)" }}>
          <BarChart3 size={24} />
        </div>
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight" style={{ color: INK }}>Reportes y estadísticas</h1>
          <p className="text-sm text-slate-500">Panorama clínico y operativo a partir de los datos ya registrados en el sistema.</p>
        </div>
      </div>

      {/* ─── KPIs ─── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k, i) => (
          <div
            key={k.key}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            style={{ animation: "rise-in 320ms ease-out both", animationDelay: `${i * 50}ms` }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{k.label}</span>
              <div className={"grid h-9 w-9 place-items-center rounded-xl " + (k.iconClass || "")} style={k.iconBg ? { background: k.iconBg, color: k.iconFg } : undefined}>
                <k.icon size={16} />
              </div>
            </div>
            <p className="mt-2 text-2xl font-black" style={{ color: INK }}>{k.valor}</p>
            {k.sub && <p className="mt-0.5 text-[11px] text-slate-500">{k.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ─── CONSULTAS POR MES ─── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" style={{ animation: "rise-in 320ms ease-out both", animationDelay: "120ms" }}>
          <h3 className="mb-1 text-sm font-bold" style={{ color: INK }}>Consultas por mes</h3>
          <p className="mb-5 text-xs text-slate-500">Últimos 6 meses</p>
          {consultas.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Aún no hay consultas registradas.</p>
          ) : (
            <div ref={refGraficoConsultas} className="relative mt-1">
              <svg viewBox={`0 0 ${anchoGraficoConsultas} 130`} className="w-full" style={{ height: 130 }} preserveAspectRatio="none">
                <defs>
                  <linearGradient id="barraReportesConsultas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22D3EE" />
                    <stop offset="100%" stopColor="#2563EB" />
                  </linearGradient>
                </defs>
                {barrasConsultas.map((b) => (
                  <g
                    key={b.clave}
                    className="cursor-default"
                    onMouseEnter={() => setHoverMesClave(b.clave)}
                    onMouseLeave={() => setHoverMesClave(null)}
                  >
                    <rect x={b.x} y="4" width={b.w} height="104" fill="transparent" />
                    <rect
                      x={b.x} y={b.y} width={b.w} height={b.h} rx="5"
                      fill="url(#barraReportesConsultas)"
                      className="transition-transform duration-150"
                      style={{ transformBox: "fill-box", transformOrigin: "bottom", transform: hoverMesClave === b.clave ? "scaleY(1.06)" : "scaleY(1)" }}
                    />
                    <text x={b.cx} y="122" textAnchor="middle" fontSize="11" fontWeight="700" fill="#94A3B8">{b.etiqueta}</text>
                  </g>
                ))}
              </svg>
              {hoverMesClave && (() => {
                const b = barrasConsultas.find((x) => x.clave === hoverMesClave)
                if (!b || !anchoGraficoConsultas) return null
                return (
                  <div
                    className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg"
                    style={{ left: `${(b.cx / anchoGraficoConsultas) * 100}%`, top: b.y - 8, background: INK }}
                  >
                    {b.valor} consulta{b.valor === 1 ? "" : "s"}
                  </div>
                )
              })()}
            </div>
          )}
        </div>

        {/* ─── DIAGNÓSTICOS MÁS FRECUENTES ─── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" style={{ animation: "rise-in 320ms ease-out both", animationDelay: "170ms" }}>
          <h3 className="mb-1 text-sm font-bold" style={{ color: INK }}>Diagnósticos más frecuentes</h3>
          <p className="mb-5 text-xs text-slate-500">Top 5 registrados en fichas clínicas</p>
          {diagnosticosTop.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Aún no hay diagnósticos registrados.</p>
          ) : (
            <div className="space-y-3.5">
              {diagnosticosTop.map((d) => (
                <div
                  key={d.label}
                  className="-mx-1.5 rounded-lg px-1.5 py-0.5 transition-colors"
                  style={{ backgroundColor: hoverDx === d.label ? "#F0F9FF" : "transparent" }}
                  onMouseEnter={() => setHoverDx(d.label)}
                  onMouseLeave={() => setHoverDx(null)}
                >
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-semibold text-slate-700" title={d.label}>{d.label}</span>
                    <span className="shrink-0 font-mono font-bold text-slate-500">{d.valor}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full transition-all duration-200"
                      style={{ width: `${Math.max(4, (d.valor / maxDiagnostico) * 100)}%`, background: GRAD, filter: hoverDx === d.label ? "brightness(1.1)" : "none" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── ESTADO DE CORRECCIÓN ─── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" style={{ animation: "rise-in 320ms ease-out both", animationDelay: "220ms" }}>
          <h3 className="mb-1 text-sm font-bold" style={{ color: INK }}>Estado de corrección de pacientes</h3>
          <p className="mb-5 text-xs text-slate-500">{pacientes.length} paciente{pacientes.length === 1 ? "" : "s"} en total</p>
          {pacientes.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Aún no hay pacientes registrados.</p>
          ) : (
            <>
              <div className="relative">
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
                  {Object.entries(distCorreccion).map(([estado, valor]) =>
                    valor === 0 ? null : (
                      <div
                        key={estado}
                        className="transition-[filter] duration-150"
                        style={{ width: `${(valor / totalPacientesDist) * 100}%`, backgroundColor: COLOR_CORRECCION[estado], filter: hoverCorreccion === estado ? "brightness(1.12)" : "none" }}
                        onMouseEnter={() => setHoverCorreccion(estado)}
                        onMouseLeave={() => setHoverCorreccion(null)}
                      />
                    ),
                  )}
                </div>
                {hoverCorreccion && (
                  <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg" style={{ background: INK }}>
                    {hoverCorreccion}: {distCorreccion[hoverCorreccion]}
                  </div>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                {Object.entries(distCorreccion).map(([estado, valor]) => (
                  <span key={estado} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLOR_CORRECCION[estado] }} />
                    {estado} <span className="text-slate-500">({valor})</span>
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        {/* ─── CITAS: PENDIENTES / ATENDIDAS / NO ASISTIÓ ─── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" style={{ animation: "rise-in 320ms ease-out both", animationDelay: "270ms" }}>
          <h3 className="mb-1 text-sm font-bold" style={{ color: INK }}>Citas: pendientes, atendidas y no-shows</h3>
          <p className="mb-5 text-xs text-slate-500">{citas.length} cita{citas.length === 1 ? "" : "s"} en la agenda · desenlace marcado desde Citas médicas</p>
          {citas.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Aún no hay citas agendadas.</p>
          ) : (
            <>
              <div className="relative">
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
                  {citasPendientes > 0 && (
                    <div
                      className="transition-[filter] duration-150"
                      style={{ width: `${(citasPendientes / totalCitasDist) * 100}%`, background: GRAD, filter: hoverCitaEstado === "Pendientes" ? "brightness(1.12)" : "none" }}
                      onMouseEnter={() => setHoverCitaEstado("Pendientes")}
                      onMouseLeave={() => setHoverCitaEstado(null)}
                    />
                  )}
                  {citasAtendidas > 0 && (
                    <div
                      className="transition-[filter] duration-150"
                      style={{ width: `${(citasAtendidas / totalCitasDist) * 100}%`, backgroundColor: "#cbd5e1", filter: hoverCitaEstado === "Atendidas" ? "brightness(0.92)" : "none" }}
                      onMouseEnter={() => setHoverCitaEstado("Atendidas")}
                      onMouseLeave={() => setHoverCitaEstado(null)}
                    />
                  )}
                  {citasNoAsistio > 0 && (
                    <div
                      className="transition-[filter] duration-150"
                      style={{ width: `${(citasNoAsistio / totalCitasDist) * 100}%`, backgroundColor: "#dc2626", filter: hoverCitaEstado === "No asistió" ? "brightness(1.12)" : "none" }}
                      onMouseEnter={() => setHoverCitaEstado("No asistió")}
                      onMouseLeave={() => setHoverCitaEstado(null)}
                    />
                  )}
                  {citasCanceladas > 0 && (
                    <div
                      className="transition-[filter] duration-150"
                      style={{ width: `${(citasCanceladas / totalCitasDist) * 100}%`, backgroundColor: "#94a3b8", filter: hoverCitaEstado === "Canceladas" ? "brightness(1.12)" : "none" }}
                      onMouseEnter={() => setHoverCitaEstado("Canceladas")}
                      onMouseLeave={() => setHoverCitaEstado(null)}
                    />
                  )}
                </div>
                {hoverCitaEstado && (
                  <div className="pointer-events-none absolute left-1/2 top-full z-10 mt-2 -translate-x-1/2 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg" style={{ background: INK }}>
                    {hoverCitaEstado}: {hoverCitaEstado === "Pendientes" ? citasPendientes : hoverCitaEstado === "Atendidas" ? citasAtendidas : hoverCitaEstado === "No asistió" ? citasNoAsistio : citasCanceladas}
                  </div>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: GRAD }} />
                  Pendientes <span className="text-slate-500">({citasPendientes})</span>
                </span>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
                  Atendidas <span className="text-slate-500">({citasAtendidas})</span>
                </span>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-600" />
                  No asistió <span className="text-slate-500">({citasNoAsistio})</span>
                </span>
                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
                  Canceladas <span className="text-slate-500">({citasCanceladas})</span>
                </span>
              </div>
            </>
          )}
        </div>

        {/* ─── SATISFACCIÓN DE PACIENTES (CSAT) ─── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2" style={{ animation: "rise-in 320ms ease-out both", animationDelay: "320ms" }}>
          <h3 className="mb-1 text-sm font-bold" style={{ color: INK }}>Satisfacción de pacientes</h3>
          <p className="mb-5 text-xs text-slate-500">Encuesta enviada por correo al marcar una cita como atendida — {respuestasSatisfaccion.length} respuesta{respuestasSatisfaccion.length === 1 ? "" : "s"} hasta ahora</p>
          {respuestasSatisfaccion.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Aún no hay respuestas de la encuesta de satisfacción.</p>
          ) : (
            <div className="space-y-2.5">
              {[5, 4, 3, 2, 1].map((n) => (
                <div key={n} className="flex items-center gap-3">
                  <span className="flex w-14 shrink-0 items-center gap-1 text-xs font-semibold text-slate-600">
                    {n} <Star size={12} fill="#C8A24E" stroke="#C8A24E" />
                  </span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full transition-all duration-200"
                      style={{ width: `${Math.max(distSatisfaccion[n] > 0 ? 4 : 0, (distSatisfaccion[n] / maxSatisfaccion) * 100)}%`, background: GRAD }}
                    />
                  </div>
                  <span className="w-6 shrink-0 text-right font-mono text-xs font-bold text-slate-500">{distSatisfaccion[n]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <p className="flex items-center gap-2 rounded-xl bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-500">
        <CalendarClock size={14} className="shrink-0" />
        Estos reportes se calculan en vivo a partir de pacientes, consultas y citas ya registrados — no requieren configuración adicional.
      </p>
    </div>
  )
}
