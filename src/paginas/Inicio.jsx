"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Users,
  AlertTriangle,
  Calendar,
  Package,
  ArrowRight,
  Cake,
  MessageCircle,
  Clock,
  History,
  TrendingUp,
} from "lucide-react"
import { diasDesdeUltimaVisita, esInactivo } from "../utilidades/fidelizacion"
import { esHoy, minutosDesdeMedianoche, parseFechaFlexible } from "../utilidades/disponibilidad"
import { esStockBajo } from "../utilidades/inventario"
import { supabase } from "../lib/supabaseClient"
import { NOMBRE_MODULO } from "../utilidades/logs"
import { INK, GOLD, ACCION_CONFIRMAR } from "@/lib/tema"

// ─── Paleta de firma (consistente con login / agenda) ───
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)" // cian → azul

export default function Inicio({
  setVista,
  usuario,
  opticaActiva = true,
  pacientes = [],
  citas = [],
  inventario = [],
  consultas = [],
  onAgendarRapido,
  onCrearPacienteRapido,
  onCrearProductoRapido,
  nombreUsuario = "Diego",
  opticaNombre,
}) {
  const [cumpleaneros, setCumpleaneros] = useState([])

  // "Actividad reciente" (sección 6 del pedido de UI: qué cambió, no solo
  // el número actual) — reusa logs_optica, la misma fuente que ya
  // alimenta "Actividad" en Usuarios.jsx. RLS solo la deja leer al admin
  // principal, así que además de pedirla solo para ese rol acá, el propio
  // RLS es la red de seguridad real si algún día cambia el gate del lado
  // del cliente.
  const esAdmin = usuario?.rol === "admin"
  const [actividadReciente, setActividadReciente] = useState([])
  useEffect(() => {
    if (!esAdmin || !supabase || !usuario?.opticaId) return
    supabase
      .from("logs_optica")
      .select("*")
      .eq("optica_id", usuario.opticaId)
      .order("created_at", { ascending: false })
      .limit(5)
      .then(({ data }) => setActividadReciente(data || []))
  }, [esAdmin, usuario?.opticaId])

  // Ventana de cumpleaños: -5 a +7 días, igual que CRM.jsx y el centro de
  // notificaciones de Dashboard.jsx (antes esta lista solo miraba 5 días
  // hacia atrás, así que un cumpleaños de HOY dejaba de listarse aquí en
  // cuanto pasaba la medianoche del día siguiente).
  useEffect(() => {
    const obtenerCumpleaneros = () => {
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)

      return pacientes
        .map((paciente) => {
          const fn = paciente.fecha_nacimiento || paciente.fechaNacimiento
          if (!fn) return null
          const partes = String(fn).split(/[-/T]/)
          if (partes.length < 3) return null
          const mesPac = Number.parseInt(partes[1], 10)
          const diaPac = Number.parseInt(partes[2], 10)
          if (!mesPac || !diaPac) return null

          let dias = null
          for (const yr of [hoy.getFullYear() - 1, hoy.getFullYear(), hoy.getFullYear() + 1]) {
            const candidato = new Date(yr, mesPac - 1, diaPac)
            candidato.setHours(0, 0, 0, 0)
            const diff = Math.round((candidato - hoy) / 86400000)
            if (diff >= -5 && diff <= 7 && (dias === null || Math.abs(diff) < Math.abs(dias))) dias = diff
          }
          if (dias === null) return null

          const nacimiento = new Date(fn)
          let edad = "N/A"
          if (!isNaN(nacimiento.getTime())) {
            let calc = hoy.getFullYear() - nacimiento.getFullYear()
            const m = hoy.getMonth() - nacimiento.getMonth()
            if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) calc--
            edad = calc
          }
          return { ...paciente, edad, diasCumple: dias, esHoy: dias === 0 }
        })
        .filter(Boolean)
        .sort((a, b) => a.diasCumple - b.diasCumple)
    }

    setCumpleaneros(obtenerCumpleaneros())
  }, [pacientes])

  // Pacientes que no visitan hace tiempo (adherencia a controles visuales)
  const inactivos = useMemo(() => {
    return pacientes
      .filter((p) => esInactivo(p, consultas))
      .map((p) => ({ paciente: p, dias: diasDesdeUltimaVisita(p, consultas) }))
      .sort((a, b) => (b.dias ?? 0) - (a.dias ?? 0))
      .slice(0, 5)
  }, [pacientes, consultas])

  const enviarFelicitacionWhatsApp = (nombre, celular) => {
    if (!celular) return
    const numLimpio = celular.toString().replace(/\D/g, "")
    const mensaje = encodeURIComponent(
      `¡Hola, ${nombre}! Te saludamos de parte de ${opticaNombre || "tu óptica"}. Queremos desearte un feliz cumpleaños. Por ser tu mes especial, cuentas con un examen de control visual de cortesía.`
    )
    window.open(`https://wa.me/${numLimpio}?text=${mensaje}`, "_blank")
  }

  // Solo las alertas de inventario REALES (stock por debajo del mínimo), no el total de productos
  const productosBajoStock = useMemo(() => inventario.filter(esStockBajo), [inventario])

  // Top 5 de mayor/menor stock, con toggle (feedback del asesor: vista rápida
  // de existencias sin tener que entrar al módulo de inventario). Default en
  // "menor": el ing probó el panel con inventario real y pidió explícitamente
  // que lo primero que se vea sean los productos con menos existencias, no
  // los que sobran — es la vista que de verdad importa para reabastecer.
  const [vistaStock, setVistaStock] = useState("menor") // "mayor" | "menor"
  const top5Mayor = useMemo(
    () => [...inventario].sort((a, b) => (Number(b.stock) || 0) - (Number(a.stock) || 0)).slice(0, 5),
    [inventario]
  )
  const top5Menor = useMemo(
    () => [...inventario].sort((a, b) => (Number(a.stock) || 0) - (Number(b.stock) || 0)).slice(0, 5),
    [inventario]
  )
  const productosVistaStock = vistaStock === "mayor" ? top5Mayor : top5Menor

  // Citas agendadas para la fecha de hoy (antes esto mostraba TODAS las citas
  // jamás agendadas — el primer número que ve el optómetra al entrar era falso
  // y crecía para siempre). Se ordenan por hora, más temprano primero.
  const citasHoy = useMemo(
    () => citas.filter((c) => esHoy(c.fecha) && c.estado !== "Cancelada").sort((a, b) => minutosDesdeMedianoche(a.hora) - minutosDesdeMedianoche(b.hora)),
    [citas]
  )

  // El ing probó este panel con la agenda vacía para el día y vio un hueco
  // en blanco ("Últimas citas... para evitar que se vea así vacío"). Si no
  // hay citas hoy, cae a las más recientes ya pasadas (más reciente primero)
  // como recordatorio de contexto, en vez de un estado vacío.
  const citasParaMostrar = useMemo(() => {
    if (citasHoy.length > 0) return citasHoy
    return [...citas]
      .filter((c) => c.estado !== "Cancelada")
      .sort((a, b) => {
        const fa = parseFechaFlexible(a.fecha)?.getTime() ?? 0
        const fb = parseFechaFlexible(b.fecha)?.getTime() ?? 0
        if (fb !== fa) return fb - fa
        return minutosDesdeMedianoche(b.hora) - minutosDesdeMedianoche(a.hora)
      })
      .slice(0, 5)
  }, [citas, citasHoy])
  const mostrandoHistorial = citasHoy.length === 0 && citasParaMostrar.length > 0

  // Señal de "qué cambió" en el KPI de pacientes (antes solo mostraba el
  // número del momento, sin ningún punto de comparación) — cuántos se
  // registraron este mes calendario, contra fechaRegistro real.
  const pacientesEsteMes = useMemo(() => {
    const hoy = new Date()
    return pacientes.filter((p) => {
      const f = parseFechaFlexible(p.fechaRegistro)
      return f && f.getFullYear() === hoy.getFullYear() && f.getMonth() === hoy.getMonth()
    }).length
  }, [pacientes])

  // Prioridad de lo primero que ve el optómetra: pacientes totales, citas de hoy y alertas de inventario
  const estadisticas = [
    {
      id: 1,
      vistaDestino: "pacientes",
      titulo: "Pacientes totales",
      valor: pacientes.length.toString(),
      desc: "Registrados en la base de datos",
      tendencia: pacientesEsteMes > 0 ? `+${pacientesEsteMes} este mes` : null,
      icono: Users,
      color: "slate",
    },
    {
      id: 2,
      vistaDestino: "citas",
      titulo: "Citas de hoy",
      valor: citasHoy.length.toString(),
      desc: "Agendadas para atención",
      icono: Calendar,
      color: "blue",
    },
    {
      id: 3,
      vistaDestino: "inventario",
      titulo: "Alertas de inventario",
      valor: productosBajoStock.length.toString(),
      desc: "Productos con stock bajo",
      icono: AlertTriangle,
      color: "amber",
    },
  ]

  // Estilo por KPI (tile del icono + acento)
  const kpi = {
    slate: { tile: "#F1F5F9", tileText: "#475569", hoverBorder: "hover:border-slate-300", valor: INK },
    blue: { tile: GRAD, tileText: "#fff", hoverBorder: "hover:border-blue-200", valor: INK },
    amber: { tile: "#FEF3C7", tileText: "#D97706", hoverBorder: "hover:border-amber-200", valor: INK },
  }

  const hoyFecha = new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <div className="w-full space-y-6 text-left">
      <style>{`
        @keyframes inRise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        .in-rise { animation: inRise .5s ease-out both; }
        @media (prefers-reduced-motion: reduce) { .in-rise { animation: none !important; } }
      `}</style>

      {/* ─── HERO / BIENVENIDA (claro) ─── */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <svg aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 text-blue-600" viewBox="0 0 400 400" fill="none" stroke="currentColor" style={{ opacity: 0.05 }}>
          {[70, 130, 190].map((r) => (<circle key={r} cx="200" cy="200" r={r} strokeWidth="1.4" />))}
        </svg>
        <div className="pointer-events-none absolute -right-8 -top-8 h-48 w-48 rounded-full blur-3xl" style={{ background: "radial-gradient(circle, rgba(34,211,238,0.14), transparent 70%)" }} />

        <div className="relative flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <span className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: GOLD }} />
              Panel principal
            </span>
            <h1 className="mt-2 font-serif text-2xl font-semibold italic tracking-tight sm:text-3xl" style={{ color: INK }}>
              ¡Bienvenido, {nombreUsuario}!
            </h1>
            <p className="mt-1 max-w-xl text-sm text-slate-500">
              {`Tienes ${citasHoy.length} ${citasHoy.length === 1 ? "cita" : "citas"} para hoy${cumpleaneros.length > 0 ? ` y ${cumpleaneros.length} de cumpleaños por saludar` : ""}. Aquí está tu resumen del día.`}
            </p>
          </div>

          <div className="flex flex-col items-start gap-2.5 md:items-end">
            <span className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold capitalize text-slate-600">
              {hoyFecha}
            </span>
            {/* Antes era texto fijo, sin relación con opticas.activa — decía
                "activo" aunque la óptica estuviera suspendida. Ahora refleja
                el estado real (ver App.jsx: hidratación + polling cada
                2.5 min contra opticas.activa). */}
            {opticaActiva ? (
              <span className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3.5 py-2">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Módulo clínico activo</span>
              </span>
            ) : (
              <span className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-red-700">Óptica suspendida</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ─── OPCIONES RÁPIDAS — un atajo por cada tarjeta de abajo (Pacientes,
          Citas, Inventario), en el mismo orden, y las tres entran directo al
          formulario de "nuevo", sin pasar primero por la lista completa (el
          ing probó esto en vivo: "vamos a registrar un nuevo paciente...
          ingresa aquí directamente"). ─── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <AccionRapida icon={Users} titulo="Gestionar pacientes" desc="Registra un paciente nuevo al instante" onClick={() => (onCrearPacienteRapido ? onCrearPacienteRapido() : setVista?.("pacientes"))} />
        <AccionRapida icon={Calendar} titulo="Gestionar citas" desc="Agenda una cita sin pasos extra" onClick={() => (onAgendarRapido ? onAgendarRapido() : setVista?.("citas"))} />
        <AccionRapida icon={Package} titulo="Gestionar inventario" desc="Añade un producto nuevo a bodega" onClick={() => (onCrearProductoRapido ? onCrearProductoRapido() : setVista?.("inventario"))} />
      </div>

      {/* ─── KPIs (prioridad: pacientes, citas de hoy, inventario) ─── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {estadisticas.map((est) => {
          const Icono = est.icono
          const c = kpi[est.color]
          return (
            <button
              key={est.id}
              type="button"
              onClick={() => setVista?.(est.vistaDestino)}
              className={"group flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white p-6 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/60 cursor-pointer " + c.hoverBorder}
            >
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{est.titulo}</p>
                <h4 className="text-4xl font-serif font-semibold" style={{ color: c.valor }}>{est.valor}</h4>
                <p className="text-xs text-slate-500">{est.desc}</p>
                {est.tendencia && (
                  <p className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                    <TrendingUp size={11} /> {est.tendencia}
                  </p>
                )}
              </div>
              <div className="grid h-14 w-14 place-items-center rounded-2xl transition-transform group-hover:scale-110" style={{ background: c.tile, color: c.tileText }}>
                <Icono size={26} />
              </div>
            </button>
          )
        })}
      </div>

      {/* ─── CUMPLEAÑEROS ─── */}
      {cumpleaneros.length > 0 && (
        <div className="rounded-2xl border p-5" style={{ borderColor: "rgba(200,162,78,0.35)", backgroundColor: "rgba(200,162,78,0.08)" }}>
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white" style={{ backgroundColor: GOLD, boxShadow: "0 10px 20px -8px rgba(200,162,78,0.6)" }}>
              <Cake size={20} />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold" style={{ color: "#7c5e14" }}>
                {cumpleaneros.some((c) => c.esHoy)
                  ? `¡${cumpleaneros.filter((c) => c.esHoy).length > 1 ? "Hoy cumplen años" : "Hoy cumple años"}!`
                  : "Cumpleaños cercanos"}
              </h4>
              <p className="mt-0.5 text-xs" style={{ color: "#96742a" }}>
                Una excelente oportunidad para saludarlos y fidelizarlos.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {cumpleaneros.map((c, i) => (
                  <span
                    key={c.id || i}
                    className={"flex items-center gap-2 rounded-xl border bg-white px-3 py-1.5 text-xs font-semibold shadow-sm " + (c.esHoy ? "ring-2 ring-offset-1" : "")}
                    style={{ borderColor: "rgba(200,162,78,0.3)", color: "#7c5e14", ...(c.esHoy ? { "--tw-ring-color": GOLD } : {}) }}
                  >
                    {c.esHoy && <span className="rounded-full px-1.5 py-0.5 text-[10px] font-extrabold uppercase text-white" style={{ backgroundColor: GOLD }}>Hoy</span>}
                    {c.nombre} ({c.edad} años)
                    <button
                      type="button"
                      onClick={() => enviarFelicitacionWhatsApp(c.nombre, c.contacto || c.telefono || c.celular)}
                      className={"flex items-center justify-center rounded-lg p-1 transition-colors cursor-pointer " + ACCION_CONFIRMAR}
                      title="Enviar felicitación por WhatsApp"
                      aria-label="Enviar felicitación por WhatsApp"
                    >
                      <MessageCircle size={15} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── PACIENTES POR RECONECTAR ─── */}
      {inactivos.length > 0 && (
        <div className="rounded-2xl border border-red-100 bg-red-50/60 p-5">
          <div className="flex items-start gap-4">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white" style={{ background: "linear-gradient(135deg,#f87171,#dc2626)", boxShadow: "0 10px 20px -8px rgba(220,38,38,0.5)" }}>
              <Clock size={20} />
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-bold text-red-800">Pacientes con el control vencido</h4>
              <p className="mt-0.5 text-xs text-red-600/80">
                Ya pasó la fecha de su próximo control recomendado. Un recordatorio ayuda a que no pierdan su seguimiento visual.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {inactivos.map(({ paciente, dias }) => (
                  <span key={paciente.id} className="rounded-xl border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 shadow-sm">
                    {paciente.nombre} · hace {dias} días
                  </span>
                ))}
              </div>
              <button type="button" onClick={() => setVista?.("crm")} className="mt-3 flex items-center gap-1 text-xs font-semibold text-red-700 hover:text-red-800 cursor-pointer">
                Gestionar en CRM <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CITAS DE HOY | INVENTARIO (mitad y mitad, mismo patrón de botón) ─── */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Citas de hoy */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl text-white" style={{ background: GRAD }}>
                <Calendar size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold" style={{ color: INK }}>Últimas citas</h4>
                <p className="text-[11px] text-slate-500">{mostrandoHistorial ? "Sin citas hoy — últimas registradas" : "Orden cronológico"}</p>
              </div>
            </div>
            <button type="button" onClick={() => setVista?.("citas")} className="flex items-center gap-1 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">
              Ver agenda <ArrowRight size={14} />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {citasParaMostrar.length === 0 ? (
              <EstadoVacio icon={Calendar} texto="Todavía no hay citas registradas." />
            ) : (
              citasParaMostrar.map((cita, idx) => (
                <div key={cita.id || idx} className="group flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3.5">
                    <div className="flex w-20 flex-col items-center justify-center rounded-xl border border-slate-100 bg-slate-50 px-2 py-1.5 font-mono text-xs font-bold text-slate-700 transition-colors group-hover:bg-blue-50 group-hover:text-blue-600">
                      <span>{cita.hora || "09:00 AM"}</span>
                      {mostrandoHistorial ? (
                        <span className="font-sans text-[10px] font-medium text-slate-500">
                          {(() => { const f = parseFechaFlexible(cita.fecha); return f ? f.toLocaleDateString("es-ES", { day: "2-digit", month: "short" }) : "" })()}
                        </span>
                      ) : (
                        cita.espera && <span className="font-sans text-[10px] font-medium text-amber-600">{cita.espera} esp</span>
                      )}
                    </div>
                    <div className={"flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 font-mono text-xs font-bold " + (cita.colorAvatar || "bg-blue-50 text-blue-600")}>
                      {cita.iniciales || (cita.paciente || cita.nombre || "P").substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h5 className="text-sm font-bold text-slate-800">{cita.paciente || cita.nombre}</h5>
                      <p className="text-[11px] text-slate-500">{cita.motivo || "Consulta general"}</p>
                    </div>
                  </div>
                  {/* Mismo criterio de color usado en Citas.jsx/Pacientes.jsx esta
                      sesión: Pendiente=ámbar (acá caía en gris por defecto,
                      cuarta repetición del mismo patrón encontrada en el sistema). */}
                  <span className={"rounded-full px-3 py-1 text-[11px] font-bold " + (
                    cita.estado === "En Espera" ? "border border-amber-200 bg-amber-50 text-amber-700"
                      : cita.estado === "En Atención" ? "border border-blue-200 bg-blue-50 text-blue-700"
                      : cita.estado === "Atendida" ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                      : cita.estado === "No Asistió" ? "border border-red-200 bg-red-50 text-red-700"
                      : cita.estado === "Cancelada" ? "border border-slate-200 bg-slate-50 text-slate-600"
                      : "border border-amber-200 bg-amber-50 text-amber-700")}>
                    {cita.estado || "Pendiente"}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Inventario: top 5 mayor/menor stock */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-amber-600">
                <AlertTriangle size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold" style={{ color: INK }}>Inventario</h4>
                <p className="text-[11px] text-slate-500">
                  {productosBajoStock.length} {productosBajoStock.length === 1 ? "alerta" : "alertas"} de stock bajo
                </p>
              </div>
            </div>
            <button type="button" onClick={() => setVista?.("inventario")} className="flex items-center gap-1 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">
              Ver inventario <ArrowRight size={14} />
            </button>
          </div>

          {/* Séptima Mirada, hallazgo #5: este selector no tiene nada que
              ordenar todavía cuando el inventario está vacío — para una
              óptica que recién se está dando de alta, es su primer vistazo
              al sistema, y un control que no hace nada solo suma ruido. */}
          {inventario.length > 0 && (
            <div className="mb-4 flex gap-1.5 rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setVistaStock("mayor")}
                className={"flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors cursor-pointer " + (vistaStock === "mayor" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700")}
              >
                Mayor stock
              </button>
              <button
                type="button"
                onClick={() => setVistaStock("menor")}
                className={"flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors cursor-pointer " + (vistaStock === "menor" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700")}
              >
                Menor stock
              </button>
            </div>
          )}

          <div className="space-y-4">
            {productosVistaStock.length === 0 ? (
              <p className="py-2 text-xs text-slate-500">No hay productos registrados en el inventario.</p>
            ) : (
              (() => {
                const maxVista = Math.max(1, ...productosVistaStock.map((p) => Number(p.stock) || 0))
                return productosVistaStock.map((prod, idx) => {
                  const stock = Number(prod.stock) || 0
                  const pct = Math.max(4, Math.round((stock / maxVista) * 100))
                  const bajo = esStockBajo(prod)
                  return (
                    <div key={prod.id || idx} className="group">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700 transition-colors group-hover:text-blue-600">{prod.nombre}</span>
                        <span className={"font-mono font-bold " + (bajo ? "text-amber-600" : "text-slate-700")}>{prod.stock}</span>
                      </div>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full transition-all" style={{ width: pct + "%", backgroundColor: bajo ? "#F59E0B" : "#2563EB" }} />
                      </div>
                    </div>
                  )
                })
              })()
            )}
          </div>
        </section>
      </div>

      {/* ─── ACTIVIDAD RECIENTE (solo admin principal, misma fuente que
          Usuarios.jsx — responde "qué cambió", que el resto del panel no
          contestaba) ─── */}
      {esAdmin && actividadReciente.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-600">
                <History size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold" style={{ color: INK }}>Actividad reciente</h4>
                <p className="text-[11px] text-slate-500">Últimas acciones del equipo</p>
              </div>
            </div>
            <button type="button" onClick={() => setVista?.("usuarios")} className="flex items-center gap-1 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">
              Ver todo <ArrowRight size={14} />
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {actividadReciente.map((l) => (
              <div key={l.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm text-slate-700">
                    <span className="font-semibold text-slate-800">{l.usuario_nombre}</span> {l.accion.charAt(0).toLowerCase() + l.accion.slice(1)}
                    {l.detalle && <span className="text-slate-500"> — {l.detalle}</span>}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">{NOMBRE_MODULO[l.modulo] || l.modulo}</p>
                </div>
                <span className="shrink-0 whitespace-nowrap text-[11px] text-slate-400">{new Date(l.created_at).toLocaleString("es-ES", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  )
}

// ─── Subcomponentes ───
function AccionRapida({ icon: Icon, titulo, desc, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-left transition-all hover:border-blue-400 hover:bg-blue-50/40 cursor-pointer"
    >
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-lg bg-blue-100/80 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
          <Icon size={16} />
        </div>
        <div>
          <h5 className="text-xs font-bold text-slate-800 transition-colors group-hover:text-blue-700">{titulo}</h5>
          <p className="text-[11px] text-slate-500">{desc}</p>
        </div>
      </div>
      <ArrowRight size={15} className="text-slate-500 transition-transform group-hover:translate-x-1" />
    </button>
  )
}

function EstadoVacio({ icon: Icon, texto }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <div className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-300">
        <Icon size={22} />
      </div>
      <p className="text-xs font-medium text-slate-500">{texto}</p>
    </div>
  )
}
