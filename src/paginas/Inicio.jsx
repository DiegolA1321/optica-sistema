"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Users,
  AlertTriangle,
  Calendar,
  Search,
  FileText,
  ArrowRight,
  Pencil,
  Trash2,
  Eye,
  Cake,
  MessageCircle,
  Clock,
} from "lucide-react"
import { diasDesdeUltimaVisita, esInactivo } from "../utilidades/fidelizacion"
import { esHoy, minutosDesdeMedianoche } from "../utilidades/disponibilidad"
import { esStockBajo } from "../utilidades/inventario"

// ─── Paleta de firma (consistente con login / agenda) ───
const INK = "#0E2B33"
const GOLD = "#C8A24E"
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)" // cian → azul

export default function Inicio({
  setVista,
  pacientes = [],
  citas = [],
  inventario = [],
  consultas = [],
  onAbrirPaciente,
  onAgendarRapido,
  nombreUsuario = "Diego",
}) {
  const [cumpleaneros, setCumpleaneros] = useState([])
  const [busqueda, setBusqueda] = useState("")

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
      `¡Hola, ${nombre}! Te saludamos de parte de Diego Óptica. Queremos desearte un feliz cumpleaños. Por ser tu mes especial, cuentas con un examen de control visual de cortesía.`
    )
    window.open(`https://wa.me/${numLimpio}?text=${mensaje}`, "_blank")
  }

  // Solo las alertas de inventario REALES (stock por debajo del mínimo), no el total de productos
  const productosBajoStock = useMemo(() => inventario.filter(esStockBajo), [inventario])

  // Top 5 de mayor/menor stock, con toggle (feedback del asesor: vista rápida
  // de existencias sin tener que entrar al módulo de inventario)
  const [vistaStock, setVistaStock] = useState("mayor") // "mayor" | "menor"
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
    () => citas.filter((c) => esHoy(c.fecha)).sort((a, b) => minutosDesdeMedianoche(a.hora) - minutosDesdeMedianoche(b.hora)),
    [citas]
  )

  // Prioridad de lo primero que ve el optómetra: pacientes totales, citas de hoy y alertas de inventario
  const estadisticas = [
    {
      id: 1,
      vistaDestino: "pacientes",
      titulo: "Pacientes totales",
      valor: pacientes.length.toString(),
      desc: "Registrados en la base de datos",
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

  const pacientesFiltrados = pacientes.filter((p) => {
    const q = busqueda.trim().toLowerCase()
    if (!q) return true
    const nombre = (p.nombre || "").toLowerCase()
    const id = (p.identificacion || p.cedula || "").toString().toLowerCase()
    return nombre.includes(q) || id.includes(q)
  })

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
            <h1 className="mt-2 font-serif text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: INK }}>
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
            <span className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3.5 py-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Módulo clínico activo</span>
            </span>
          </div>
        </div>
      </div>

      {/* ─── OPCIONES RÁPIDAS (arriba, para que "rápida" signifique algo) ─── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <AccionRapida icon={Calendar} titulo="Agendar cita" desc="Abre el turno directo, sin pasos extra" onClick={() => (onAgendarRapido ? onAgendarRapido() : setVista?.("citas"))} />
        <AccionRapida icon={FileText} titulo="Abrir ficha clínica" desc="Registrar refracción y diagnóstico" onClick={() => setVista?.("consultas")} />
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
                <h4 className="text-4xl font-black" style={{ color: c.valor }}>{est.valor}</h4>
                <p className="text-xs text-slate-500">{est.desc}</p>
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
                      className="flex items-center justify-center rounded-lg p-1 text-emerald-600 transition-colors hover:bg-emerald-50 hover:text-emerald-700 cursor-pointer"
                      title="Enviar felicitación por WhatsApp"
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
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Citas de hoy */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl text-white" style={{ background: GRAD }}>
                <Calendar size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold" style={{ color: INK }}>Pacientes citados para hoy</h4>
                <p className="text-[11px] text-slate-500">Orden cronológico</p>
              </div>
            </div>
            <button type="button" onClick={() => setVista?.("citas")} className="flex items-center gap-1 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">
              Ver agenda <ArrowRight size={14} />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {citasHoy.length === 0 ? (
              <EstadoVacio icon={Calendar} texto="No hay citas registradas para el día de hoy." />
            ) : (
              citasHoy.map((cita, idx) => (
                <div key={cita.id || idx} className="group flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                  <div className="flex items-center gap-3.5">
                    <div className="flex w-20 flex-col items-center justify-center rounded-xl border border-slate-100 bg-slate-50 px-2 py-1.5 font-mono text-xs font-bold text-slate-700 transition-colors group-hover:bg-blue-50 group-hover:text-blue-600">
                      <span>{cita.hora || "09:00 AM"}</span>
                      {cita.espera && <span className="font-sans text-[10px] font-medium text-amber-600">{cita.espera} esp</span>}
                    </div>
                    <div className={"flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 font-mono text-xs font-bold " + (cita.colorAvatar || "bg-blue-50 text-blue-600")}>
                      {cita.iniciales || (cita.paciente || cita.nombre || "P").substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h5 className="text-sm font-bold text-slate-800">{cita.paciente || cita.nombre}</h5>
                      <p className="text-[11px] text-slate-500">{cita.motivo || "Consulta general"}</p>
                    </div>
                  </div>
                  <span className={"rounded-full px-3 py-1 text-[11px] font-bold " + (
                    cita.estado === "En Espera" ? "border border-amber-200 bg-amber-50 text-amber-700"
                      : cita.estado === "En Atención" ? "border border-blue-200 bg-blue-50 text-blue-700"
                      : cita.estado === "Atendida" ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                      : cita.estado === "No Asistió" ? "border border-red-200 bg-red-50 text-red-700"
                      : "border border-slate-200 bg-slate-50 text-slate-600")}>
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

      {/* ─── BÚSQUEDA RÁPIDA DE PACIENTES (franja completa) ─── */}
      <div className="grid grid-cols-1 gap-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-100 text-slate-600">
                <Search size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold" style={{ color: INK }}>Búsqueda rápida de pacientes</h4>
                <p className="text-[11px] text-slate-500">
                  {pacientes.length} {pacientes.length === 1 ? "paciente registrado" : "pacientes registrados"} en total
                </p>
              </div>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre o cédula..."
                className="w-full rounded-xl border border-slate-200 py-2 pl-8 pr-3 text-xs outline-none transition-all focus:border-blue-500 focus:ring-2 focus:ring-blue-50"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2.5">Paciente</th>
                  <th className="px-3 py-2.5">Identificación</th>
                  <th className="px-3 py-2.5">Contacto</th>
                  <th className="px-3 py-2.5">Última consulta</th>
                  <th className="px-3 py-2.5">Cuenta</th>
                  <th className="px-3 py-2.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {pacientesFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-500">
                      {busqueda ? "No se encontraron coincidencias." : "No hay pacientes registrados."}
                    </td>
                  </tr>
                ) : (
                  pacientesFiltrados.slice(0, 5).map((paciente) => (
                    <tr key={paciente.id} className="group transition-colors hover:bg-slate-50/80">
                      <td className="px-3 py-3 font-bold text-slate-800 transition-colors group-hover:text-blue-600">{paciente.nombre}</td>
                      <td className="px-3 py-3 font-mono text-[11px] text-slate-500">{paciente.identificacion || paciente.cedula || "N/A"}</td>
                      <td className="px-3 py-3 text-slate-600">{paciente.contacto || paciente.telefono || paciente.celular || "Sin número"}</td>
                      <td className="px-3 py-3 text-slate-500">{paciente.ultimaConsulta || "Primera vez"}</td>
                      <td className="px-3 py-3">
                        <span className={"rounded-full px-2 py-0.5 text-[11px] font-semibold " + (paciente.tieneCuenta ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500")}>
                          {paciente.tieneCuenta ? "Con cuenta" : "Sin cuenta"}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex justify-center gap-1">
                          <button type="button" onClick={() => onAbrirPaciente?.(paciente, "historial")} className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-600 cursor-pointer" title="Ver historial clínico">
                            <Eye size={14} />
                          </button>
                          <button type="button" onClick={() => onAbrirPaciente?.(paciente, "editar")} className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-600 cursor-pointer" title="Editar paciente">
                            <Pencil size={14} />
                          </button>
                          <button type="button" onClick={() => onAbrirPaciente?.(paciente, "eliminar")} className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-red-50 hover:text-red-600 cursor-pointer" title="Eliminar paciente">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {pacientesFiltrados.length > 5 && (
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
              <p className="text-[11px] text-slate-500">Mostrando 5 de {pacientesFiltrados.length}</p>
              <button type="button" onClick={() => setVista?.("pacientes")} className="flex items-center gap-1 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">
                Ver todos <ArrowRight size={14} />
              </button>
            </div>
          )}
        </section>
      </div>
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
