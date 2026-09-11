"use client"

import { useMemo, useState } from "react"
import {
  BarChart3,
  Stethoscope,
  UserPlus,
  CheckCircle2,
  AlertTriangle,
  CalendarClock,
  CalendarCheck,
  DollarSign,
  TrendingUp,
  Star,
  CalendarRange,
  Info,
} from "lucide-react"
import { esInactivo } from "../utilidades/fidelizacion"
import { fechaAISO } from "../utilidades/disponibilidad"
import { useAnchoElemento } from "../utilidades/graficos"
import { INK } from "@/lib/tema"

// ─── Paleta de firma (consistente con el resto del sistema) ───
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)" // cian → azul

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]

// Colores de estado — los mismos que usan Pacientes.jsx / PortalPaciente.jsx,
// para que un mismo estado se vea igual en todo el sistema.
const COLOR_CORRECCION = {
  "Bien corregido": "#059669",
  "Requiere ajuste": "#dc2626",
  "Sin evaluar": "#475569",
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

// Selector de período para los KPIs de flujo (consultas, pacientes nuevos,
// ingresos, conversión) — antes fijos siempre a "este mes", sin forma de
// comparar un trimestre o armar algo para el contador. Los KPIs de estado
// actual (Bien corregidos, Controles vencidos, Citas → atendidos) no
// cambian con el período: son una foto de ahora mismo, no un flujo.
// Fechas como texto "AAAA-MM-DD" a propósito — mismo formato que ya usan
// consultas.fecha/pacientes.fechaRegistro, comparar como texto alcanza
// porque el ISO ordena igual que el calendario, sin líos de zona horaria.
const fmtFecha = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

function calcularRango(periodo, inicioPersonalizado, finPersonalizado) {
  const hoy = new Date()
  const y = hoy.getFullYear(), m = hoy.getMonth()
  if (periodo === "personalizado") {
    return { inicio: inicioPersonalizado || fmtFecha(new Date(y, m, 1)), fin: finPersonalizado || fmtFecha(hoy), etiqueta: "el período elegido" }
  }
  if (periodo === "mesPasado") {
    return { inicio: fmtFecha(new Date(y, m - 1, 1)), fin: fmtFecha(new Date(y, m, 0)), etiqueta: "el mes pasado" }
  }
  if (periodo === "trimestre") {
    return { inicio: fmtFecha(new Date(y, m - 2, 1)), fin: fmtFecha(hoy), etiqueta: "los últimos 3 meses" }
  }
  if (periodo === "semestre") {
    return { inicio: fmtFecha(new Date(y, m - 5, 1)), fin: fmtFecha(hoy), etiqueta: "los últimos 6 meses" }
  }
  return { inicio: fmtFecha(new Date(y, m, 1)), fin: fmtFecha(hoy), etiqueta: "este mes" }
}

const PERIODOS = [
  { id: "mes", label: "Este mes" },
  { id: "mesPasado", label: "Mes pasado" },
  { id: "trimestre", label: "Últimos 3 meses" },
  { id: "semestre", label: "Últimos 6 meses" },
  { id: "personalizado", label: "Personalizado" },
]

export default function Reportes({ pacientes = [], consultas = [], citas = [], ventas = [], facturasVenta = [], respuestasSatisfaccion = [] }) {
  const [periodo, setPeriodo] = useState("mes")
  const [inicioPersonalizado, setInicioPersonalizado] = useState("")
  const [finPersonalizado, setFinPersonalizado] = useState("")
  const rango = useMemo(() => calcularRango(periodo, inicioPersonalizado, finPersonalizado), [periodo, inicioPersonalizado, finPersonalizado])
  // `consultas.fecha` y `pacientes.fechaRegistro` son columnas DATE puras
  // ("2026-09-09", sin hora ni zona) — comparar el string tal cual es
  // correcto. Pero `ventas.creadoEn` es un timestamp real (timestamptz,
  // siempre en UTC) — recortarlo tal cual desplazaba una venta hecha de
  // noche en Ecuador (UTC-5) al día calendario SIGUIENTE en "Ingresos" y
  // "Productos más vendidos". Si el valor trae hora ("T" en el string), se
  // convierte primero a la fecha calendario LOCAL real antes de comparar.
  const enRango = (fecha) => {
    if (!fecha) return false
    const f = fecha.includes("T") ? fechaAISO(new Date(fecha)) : fecha.slice(0, 10)
    return f >= rango.inicio && f <= rango.fin
  }

  const consultasEsteMes = useMemo(
    () => consultas.filter((c) => enRango(c.fecha)).length,
    [consultas, rango],
  )

  const pacientesNuevosEsteMes = useMemo(
    () => pacientes.filter((p) => enRango(p.fechaRegistro)).length,
    [pacientes, rango],
  )

  // Diagnóstico con Diego (2026-09-10): "AV con lentes" arrancaba en 20/20
  // por defecto en la ficha clínica, así que "Bien corregido" no distinguía
  // "evaluado y confirmado" de "nunca evaluado" — el campo ya no tiene ese
  // default (ver evaluarCorreccion en ConsultaMedica.jsx), y ahora puede
  // devolver "Sin evaluar" además de "Sin evaluación" (nunca tuvo consulta).
  // El % solo debe salir de pacientes con una evaluación real: ni los que
  // nunca tuvieron consulta ni los que la tuvieron pero dejaron el campo
  // vacío cuentan en el denominador — mismo criterio que antes, pero ahora
  // filtrando por los dos valores reales en vez de excluir solo uno.
  const tasaBienCorregido = useMemo(() => {
    const evaluados = pacientes.filter((p) => p.estadoCorreccion === "Bien corregido" || p.estadoCorreccion === "Requiere ajuste")
    if (evaluados.length === 0) return null
    const bien = evaluados.filter((p) => p.estadoCorreccion === "Bien corregido").length
    return Math.round((bien / evaluados.length) * 100)
  }, [pacientes])

  // Dato aparte que pidió Diego: cuántos pacientes tuvieron consulta pero
  // quedaron "Sin evaluar" — no se esconde ni se cuenta como mal corregido,
  // se muestra tal cual junto al KPI de arriba.
  const pacientesSinEvaluarCorreccion = useMemo(
    () => pacientes.filter((p) => p.estadoCorreccion === "Sin evaluar").length,
    [pacientes],
  )

  const controlesVencidos = useMemo(() => pacientes.filter((p) => esInactivo(p, consultas)).length, [pacientes, consultas])

  // Vínculo receta → venta (anteproyecto: "tasa de conversión de recetas a
  // ventas" e "ingresos" como indicadores de impacto operativo).
  // "Conversión" mide algo puntual: ¿la consulta terminó en una venta en el
  // mismo acto? — sigue viviendo en consultas.productoId; desde el Punto 06,
  // ConsultaMedica.jsx lo llena con la primera línea "producto" de la
  // factura de esa consulta (ya no con un selector de un solo producto),
  // para no dejar esta métrica en 0% al reemplazar ese mecanismo.
  // "Ingresos" tiene que ser la venta REAL total del mes, y ahora hay DOS
  // caminos que generan dinero real: `ventas` (Inventario/Pacientes →
  // "Vender producto", camino viejo, una venta = un producto) y
  // `facturas_venta` (Punto 06 — líneas múltiples, reemplaza el vínculo de
  // ConsultaMedica.jsx). Si solo se sumara uno de los dos, "Ingresos"
  // volvería a mostrar una fracción de las ventas reales — el mismo
  // hallazgo real #1 de la auditoría del 2026-09-08, repetido en el camino
  // nuevo si no se suman ambos. Una factura 'pendiente_pago' (cuotas) solo
  // aporta lo efectivamente cobrado hasta ahora (monto_total × cuotas_pagadas
  // / cuotas_totales), no el total — mismo bug que se encontró y se decidió
  // no repetir (ver Punto 09): 1 de 6 cuotas pagadas no es el ingreso
  // completo. Una factura 'anulada' no aporta nada.
  const consultasEsteMesArr = useMemo(() => consultas.filter((c) => enRango(c.fecha)), [consultas, rango])
  const ventasVinculadasEsteMes = useMemo(() => consultasEsteMesArr.filter((c) => c.productoId), [consultasEsteMesArr])
  const ventasRealesEsteMes = useMemo(() => ventas.filter((v) => enRango(v.creadoEn)), [ventas, rango])
  const facturasVentaEsteMes = useMemo(() => facturasVenta.filter((f) => enRango(f.creadoEn)), [facturasVenta, rango])
  const ingresoFacturaVenta = (f) => {
    if (f.estado === "pagada") return f.montoTotal
    if (f.estado === "pendiente_pago") return f.cuotasTotales ? f.montoTotal * (f.cuotasPagadas / f.cuotasTotales) : 0
    return 0
  }
  const ingresosEsteMes = useMemo(
    () => ventasRealesEsteMes.reduce((sum, v) => sum + (Number(v.montoTotal) || 0), 0)
      + facturasVentaEsteMes.reduce((sum, f) => sum + ingresoFacturaVenta(f), 0),
    [ventasRealesEsteMes, facturasVentaEsteMes],
  )
  const conversionVenta = useMemo(() => {
    if (consultasEsteMesArr.length === 0) return null
    return Math.round((ventasVinculadasEsteMes.length / consultasEsteMesArr.length) * 100)
  }, [consultasEsteMesArr, ventasVinculadasEsteMes])

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

  // H2: antes solo se veía el total acumulado de "No Asistió" (sin ningún
  // punto de comparación temporal) — con esto se puede ver si empeora o
  // mejora mes a mes, no solo el número frío de siempre.
  const noShowPorMes = useMemo(() => {
    const meses = ultimosNMeses(6)
    const mapa = new Map()
    citas.forEach((c) => {
      if (c.estado !== "No Asistió") return
      const clave = (c.fecha || "").slice(0, 7)
      mapa.set(clave, (mapa.get(clave) || 0) + 1)
    })
    return meses.map((m) => ({ ...m, valor: mapa.get(m.clave) || 0 }))
  }, [citas])
  const maxNoShowMes = Math.max(1, ...noShowPorMes.map((m) => m.valor))
  const [refGraficoNoShow, anchoGraficoNoShow] = useAnchoElemento()
  const [hoverMesNoShow, setHoverMesNoShow] = useState(null)
  const barrasNoShow = useMemo(() => {
    const w = anchoGraficoNoShow, base = 70, padTop = 8
    const n = noShowPorMes.length || 1
    const gap = 12
    const barW = (w - gap * (n + 1)) / n
    return noShowPorMes.map((m, i) => {
      const alto = maxNoShowMes > 0 ? Math.max(m.valor > 0 ? 5 : 2, (m.valor / maxNoShowMes) * (base - padTop)) : 2
      const x = gap + i * (barW + gap)
      return { ...m, x, w: barW, h: alto, y: base - alto, cx: x + barW / 2 }
    })
  }, [noShowPorMes, maxNoShowMes, anchoGraficoNoShow])

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

  // Cuenta por categoría de diagnóstico, no por el texto completo de la
  // ficha — caso de la reunión con el ing: "cuántos pacientes tengo con
  // miopía, cuántos con astigmatismo, cuántos con presbicia". Antes esto
  // agrupaba por el texto libre completo, así que dos fichas con la misma
  // categoría pero distinto detalle contaban como diagnósticos distintos.
  // Cae al texto completo solo para fichas viejas sin categorías guardadas.
  const diagnosticosTop = useMemo(() => {
    const mapa = new Map()
    consultas.forEach((c) => {
      const categorias = c.diagnosticoCategorias?.length > 0 ? c.diagnosticoCategorias : [(c.diagnostico || "").trim()].filter(Boolean)
      categorias.forEach((dx) => mapa.set(dx, (mapa.get(dx) || 0) + 1))
    })
    return Array.from(mapa.entries())
      .map(([label, valor]) => ({ label, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5)
  }, [consultas])

  const maxDiagnostico = Math.max(1, ...diagnosticosTop.map((d) => d.valor))

  // H3: rotación de inventario — qué se está vendiendo de verdad en el
  // período elegido arriba (mismo selector que ya usan ingresos/conversión),
  // no solo el stock estático que ya se ve en Inventario.jsx.
  const productosMasVendidos = useMemo(() => {
    const mapa = new Map()
    ventasRealesEsteMes.forEach((v) => {
      const nombre = v.productoNombre || "Producto sin nombre"
      mapa.set(nombre, (mapa.get(nombre) || 0) + (Number(v.cantidad) || 0))
    })
    return Array.from(mapa.entries())
      .map(([label, valor]) => ({ label, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 5)
  }, [ventasRealesEsteMes])
  const maxProductoVendido = Math.max(1, ...productosMasVendidos.map((p) => p.valor))
  const [hoverProducto, setHoverProducto] = useState(null)

  const distCorreccion = useMemo(() => {
    const base = { "Bien corregido": 0, "Requiere ajuste": 0, "Sin evaluar": 0, "Sin evaluación": 0 }
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

  // % de citas solicitadas que terminan en un paciente atendido — caso de
  // la reunión con el ing: "100 personas solicitan cita, 90 se atienden =
  // 90% de conversión". Sobre el total histórico de citas, mismo criterio
  // que el resto de las métricas de citas de este reporte (no solo del mes).
  const conversionCitas = useMemo(() => {
    if (citas.length === 0) return null
    return Math.round((citasAtendidas / citas.length) * 100)
  }, [citas, citasAtendidas])

  // Los 4 primeros KPIs "de flujo" siguen al selector de período (arriba);
  // los siguientes 4 son una foto del estado actual y no cambian con él
  // (no tendría sentido "Controles vencidos en marzo", por ejemplo).
  const kpis = [
    { key: "consultas", label: "Consultas", sub: rango.etiqueta, valor: consultasEsteMes, icon: Stethoscope, iconBg: GRAD, iconFg: "#fff" },
    { key: "nuevos", label: "Pacientes nuevos", sub: rango.etiqueta, valor: pacientesNuevosEsteMes, icon: UserPlus, iconBg: undefined, iconClass: "bg-blue-50 text-blue-600" },
    { key: "ingresos", label: "Ingresos", valor: `$${ingresosEsteMes.toFixed(2)}`, sub: `${ventasRealesEsteMes.length + facturasVentaEsteMes.length} venta${(ventasRealesEsteMes.length + facturasVentaEsteMes.length) === 1 ? "" : "s"} · ${rango.etiqueta}`, icon: DollarSign, iconClass: "bg-amber-50 text-amber-600" },
    { key: "conversion", label: "Conversión a venta", valor: conversionVenta === null ? "—" : `${conversionVenta}%`, sub: `de las consultas de ${rango.etiqueta}`, icon: TrendingUp, iconClass: "bg-violet-50 text-violet-600" },
    { key: "corregidos", label: "Bien corregidos", valor: tasaBienCorregido === null ? "—" : `${tasaBienCorregido}%`, sub: `de los pacientes evaluados, hoy · ${pacientesSinEvaluarCorreccion} sin evaluar`, icon: CheckCircle2, iconClass: "bg-emerald-50 text-emerald-600", tooltip: "% de pacientes con corrección al día, calculado con la fecha de hoy. Solo cuenta pacientes con una evaluación real (Bien corregido o Requiere ajuste) — los que tuvieron consulta pero no se les registró la agudeza visual con lentes quedan 'sin evaluar' y no afectan este porcentaje." },
    { key: "vencidos", label: "Controles vencidos", valor: controlesVencidos, sub: "a la fecha", icon: AlertTriangle, iconClass: "bg-red-50 text-red-600", tooltip: "Pacientes sin visita dentro del intervalo recomendado, calculado con la fecha de hoy — no cambia con el período seleccionado arriba." },
    { key: "conversionCitas", label: "Citas → pacientes atendidos", valor: conversionCitas === null ? "—" : `${conversionCitas}%`, sub: `${citasAtendidas} de ${citas.length} citas solicitadas`, icon: CalendarCheck, iconClass: "bg-cyan-50 text-cyan-600" },
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

      {/* ─── SELECTOR DE PERÍODO — solo afecta Consultas, Pacientes nuevos,
          Ingresos y Conversión a venta (los 4 KPIs "de flujo"); los demás
          son una foto de ahora mismo. ─── */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
        <span className="flex items-center gap-1.5 pl-1 text-xs font-bold uppercase tracking-wide text-slate-500">
          <CalendarRange size={14} /> Período
        </span>
        {PERIODOS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriodo(p.id)}
            className="rounded-full border px-3 py-1 text-xs font-semibold transition cursor-pointer"
            style={periodo === p.id ? { backgroundColor: "#2563EB", borderColor: "#2563EB", color: "#fff" } : { borderColor: "rgba(14,43,51,0.12)", color: "#64748b", backgroundColor: "#fff" }}
          >
            {p.label}
          </button>
        ))}
        {periodo === "personalizado" && (
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date" value={inicioPersonalizado} onChange={(e) => setInicioPersonalizado(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 outline-none focus:border-blue-500"
            />
            <span className="text-xs text-slate-400">a</span>
            <input
              type="date" value={finPersonalizado} onChange={(e) => setFinPersonalizado(e.target.value)}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 outline-none focus:border-blue-500"
            />
          </div>
        )}
      </div>

      {/* ─── KPIs ─── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k, i) => (
          <div
            key={k.key}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            style={{ animation: "rise-in 320ms ease-out both", animationDelay: `${i * 50}ms` }}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-slate-500">
                {k.label}
                {k.tooltip && (
                  <Info size={12} className="shrink-0 cursor-help text-slate-400" title={k.tooltip} aria-label={k.tooltip} />
                )}
              </span>
              <div className={"grid h-9 w-9 place-items-center rounded-xl " + (k.iconClass || "")} style={k.iconBg ? { background: k.iconBg, color: k.iconFg } : undefined}>
                <k.icon size={16} />
              </div>
            </div>
            <p className="mt-2 text-2xl font-serif font-semibold" style={{ color: INK }}>{k.valor}</p>
            {k.sub && <p className="mt-0.5 text-[11px] text-slate-500">{k.sub}</p>}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
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

        {/* ─── TENDENCIA DE INASISTENCIAS (H2) ─── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" style={{ animation: "rise-in 320ms ease-out both", animationDelay: "190ms" }}>
          <h3 className="mb-1 text-sm font-bold" style={{ color: INK }}>Tendencia de inasistencias</h3>
          <p className="mb-5 text-xs text-slate-500">Citas marcadas "No Asistió" · últimos 6 meses</p>
          {citasNoAsistio === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Ninguna cita marcada como no asistida todavía.</p>
          ) : (
            <div ref={refGraficoNoShow} className="relative mt-1">
              <svg viewBox={`0 0 ${anchoGraficoNoShow} 90`} className="w-full" style={{ height: 90 }} preserveAspectRatio="none">
                {barrasNoShow.map((b) => (
                  <g
                    key={b.clave}
                    className="cursor-default"
                    onMouseEnter={() => setHoverMesNoShow(b.clave)}
                    onMouseLeave={() => setHoverMesNoShow(null)}
                  >
                    <rect x={b.x} y="2" width={b.w} height="66" fill="transparent" />
                    <rect
                      x={b.x} y={b.y} width={b.w} height={b.h} rx="4"
                      fill={b.valor > 0 ? "#dc2626" : "#e2e8f0"}
                      className="transition-transform duration-150"
                      style={{ transformBox: "fill-box", transformOrigin: "bottom", transform: hoverMesNoShow === b.clave ? "scaleY(1.06)" : "scaleY(1)" }}
                    />
                    <text x={b.cx} y="82" textAnchor="middle" fontSize="11" fontWeight="700" fill="#94A3B8">{b.etiqueta}</text>
                  </g>
                ))}
              </svg>
              {hoverMesNoShow && (() => {
                const b = barrasNoShow.find((x) => x.clave === hoverMesNoShow)
                if (!b || !anchoGraficoNoShow) return null
                return (
                  <div
                    className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg"
                    style={{ left: `${(b.cx / anchoGraficoNoShow) * 100}%`, top: b.y - 8, background: INK }}
                  >
                    {b.valor} inasistencia{b.valor === 1 ? "" : "s"}
                  </div>
                )
              })()}
            </div>
          )}
        </div>

        {/* ─── PRODUCTOS MÁS VENDIDOS (H3, rotación de inventario) ─── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" style={{ animation: "rise-in 320ms ease-out both", animationDelay: "205ms" }}>
          <h3 className="mb-1 text-sm font-bold" style={{ color: INK }}>Productos más vendidos</h3>
          <p className="mb-5 text-xs text-slate-500">Top 5 por unidades · período seleccionado arriba</p>
          {productosMasVendidos.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Aún no hay ventas registradas en este período.</p>
          ) : (
            <div className="space-y-3.5">
              {productosMasVendidos.map((p) => (
                <div
                  key={p.label}
                  className="-mx-1.5 rounded-lg px-1.5 py-0.5 transition-colors"
                  style={{ backgroundColor: hoverProducto === p.label ? "#F0F9FF" : "transparent" }}
                  onMouseEnter={() => setHoverProducto(p.label)}
                  onMouseLeave={() => setHoverProducto(null)}
                >
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-semibold text-slate-700" title={p.label}>{p.label}</span>
                    <span className="shrink-0 font-mono font-bold text-slate-500">{p.valor} u.</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full transition-all duration-200"
                      style={{ width: `${Math.max(4, (p.valor / maxProductoVendido) * 100)}%`, background: GRAD, filter: hoverProducto === p.label ? "brightness(1.1)" : "none" }}
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
