"use client"

import { useMemo } from "react"
import {
  BarChart3,
  Stethoscope,
  UserPlus,
  CheckCircle2,
  AlertTriangle,
  CalendarClock,
} from "lucide-react"
import { esInactivo } from "../utilidades/fidelizacion"

// ─── Paleta de firma (consistente con el resto del sistema) ───
const INK = "#0A1420"
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

export default function Reportes({ pacientes = [], consultas = [], citas = [] }) {
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
  const citasPendientes = useMemo(() => citas.length - citasAtendidas - citasNoAsistio, [citas, citasAtendidas, citasNoAsistio])
  const totalCitasDist = Math.max(1, citas.length)

  return (
    <div className="w-full space-y-6 text-left">
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
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Consultas este mes</span>
            <div className="grid h-9 w-9 place-items-center rounded-xl text-white" style={{ background: GRAD }}><Stethoscope size={16} /></div>
          </div>
          <p className="mt-2 text-2xl font-black" style={{ color: INK }}>{consultasEsteMes}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Pacientes nuevos</span>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-blue-50 text-blue-600"><UserPlus size={16} /></div>
          </div>
          <p className="mt-2 text-2xl font-black" style={{ color: INK }}>{pacientesNuevosEsteMes}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Bien corregidos</span>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-emerald-600"><CheckCircle2 size={16} /></div>
          </div>
          <p className="mt-2 text-2xl font-black" style={{ color: INK }}>{tasaBienCorregido === null ? "—" : `${tasaBienCorregido}%`}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">de los pacientes evaluados</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Controles vencidos</span>
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-red-50 text-red-600"><AlertTriangle size={16} /></div>
          </div>
          <p className="mt-2 text-2xl font-black" style={{ color: INK }}>{controlesVencidos}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ─── CONSULTAS POR MES ─── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-1 text-sm font-bold" style={{ color: INK }}>Consultas por mes</h3>
          <p className="mb-5 text-xs text-slate-500">Últimos 6 meses</p>
          {consultas.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Aún no hay consultas registradas.</p>
          ) : (
            <div className="flex h-40 items-end gap-3">
              {consultasPorMes.map((m) => (
                <div key={m.clave} className="flex flex-1 flex-col items-center gap-2">
                  <span className="text-xs font-bold text-slate-600">{m.valor}</span>
                  <div className="flex w-full flex-1 items-end overflow-hidden rounded-lg bg-slate-50">
                    <div
                      className="w-full rounded-lg transition-all"
                      style={{ height: `${Math.max(4, (m.valor / maxConsultasMes) * 100)}%`, background: GRAD }}
                      title={`${m.etiqueta}: ${m.valor} consulta${m.valor === 1 ? "" : "s"}`}
                    />
                  </div>
                  <span className="text-[11px] font-semibold uppercase text-slate-500">{m.etiqueta}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── DIAGNÓSTICOS MÁS FRECUENTES ─── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-1 text-sm font-bold" style={{ color: INK }}>Diagnósticos más frecuentes</h3>
          <p className="mb-5 text-xs text-slate-500">Top 5 registrados en fichas clínicas</p>
          {diagnosticosTop.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Aún no hay diagnósticos registrados.</p>
          ) : (
            <div className="space-y-3.5">
              {diagnosticosTop.map((d) => (
                <div key={d.label}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-semibold text-slate-700" title={d.label}>{d.label}</span>
                    <span className="shrink-0 font-mono font-bold text-slate-500">{d.valor}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(4, (d.valor / maxDiagnostico) * 100)}%`, background: GRAD }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ─── ESTADO DE CORRECCIÓN ─── */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-1 text-sm font-bold" style={{ color: INK }}>Estado de corrección de pacientes</h3>
          <p className="mb-5 text-xs text-slate-500">{pacientes.length} paciente{pacientes.length === 1 ? "" : "s"} en total</p>
          {pacientes.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Aún no hay pacientes registrados.</p>
          ) : (
            <>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
                {Object.entries(distCorreccion).map(([estado, valor]) =>
                  valor === 0 ? null : (
                    <div key={estado} style={{ width: `${(valor / totalPacientesDist) * 100}%`, backgroundColor: COLOR_CORRECCION[estado] }} title={`${estado}: ${valor}`} />
                  ),
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
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-1 text-sm font-bold" style={{ color: INK }}>Citas: pendientes, atendidas y no-shows</h3>
          <p className="mb-5 text-xs text-slate-500">{citas.length} cita{citas.length === 1 ? "" : "s"} en la agenda · desenlace marcado desde Citas médicas</p>
          {citas.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Aún no hay citas agendadas.</p>
          ) : (
            <>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100">
                {citasPendientes > 0 && <div style={{ width: `${(citasPendientes / totalCitasDist) * 100}%`, background: GRAD }} title={`Pendientes: ${citasPendientes}`} />}
                {citasAtendidas > 0 && <div style={{ width: `${(citasAtendidas / totalCitasDist) * 100}%`, backgroundColor: "#cbd5e1" }} title={`Atendidas: ${citasAtendidas}`} />}
                {citasNoAsistio > 0 && <div style={{ width: `${(citasNoAsistio / totalCitasDist) * 100}%`, backgroundColor: "#dc2626" }} title={`No asistió: ${citasNoAsistio}`} />}
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
              </div>
            </>
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
