"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  Clock,
  CalendarClock,
  Sun,
  Moon,
  CalendarDays,
  CheckCircle2,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Info,
  AlertTriangle,
  User,
  UserCog,
  Building2,
  CalendarX,
  Plus,
  Trash2,
  Lock,
} from "lucide-react"
import {
  DIAS_SEMANA, ETIQUETAS_DIA, fechaAISO, hoyISO, horarioEfectivo, diaAbierto, horaA12,
  parseFechaFlexible, esHoy as esFechaHoy, esFutura, minutosDesdeMedianoche, minutosDesde24h,
} from "../utilidades/disponibilidad"

// ─── Paleta de firma (consistente con el resto del sistema) ───
const INK = "#0E2B33"
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)"
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
const DIAS_CORTOS = ["L", "M", "X", "J", "V", "S", "D"]
const ORDEN_LV = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]

// Texto legible de un horario de dos sesiones — reemplaza al viejo "inicio–fin"
// plano ahora que cada día puede tener mañana y tarde por separado.
const resumenHorario = (horario) => {
  const partes = []
  if (horario?.manana?.activo) partes.push(`${horaA12(horario.manana.inicio)} – ${horaA12(horario.manana.fin)}`)
  if (horario?.tarde?.activo) partes.push(`${horaA12(horario.tarde.inicio)} – ${horaA12(horario.tarde.fin)}`)
  return partes.length ? partes.join(" y ") : "Cerrado"
}

// Horario personal vacío por defecto — un usuario que nunca tocó "Mi
// horario" arranca sin nada configurado, no heredando el horario general
// (caso de la reunión con el ing: son dos cosas distintas a propósito).
const DIA_PERSONAL_VACIO = () => ({ manana: { activo: false, inicio: "09:00", fin: "13:00" }, tarde: { activo: false, inicio: "14:00", fin: "18:00" } })
const SEMANA_PERSONAL_VACIA = () => Object.fromEntries(ORDEN_LV.map((d) => [d, DIA_PERSONAL_VACIO()]))

export default function Horario({ usuario, disponibilidad, setDisponibilidad, horarioPersonal, setHorarioPersonal, citas = [] }) {
  const hoy = hoyISO()
  const esAdmin = usuario?.rol === "admin"
  const [tab, setTab] = useState("general")
  const [mesVista, setMesVista] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [fechaEditando, setFechaEditando] = useState(null)
  // Citas que quedarían fuera del horario si se aplica un cambio pendiente —
  // antes cerrar un día o acortar el horario no avisaba nada, el paciente
  // seguía "agendado" pero esa cita ya no cabía en ningún horario real.
  const [avisoConflicto, setAvisoConflicto] = useState(null)

  // Confirmación visual breve tras guardar (horario semanal con su botón, o
  // una excepción puntual que sigue aplicándose al instante desde su modal).
  // Antes esto era un useEffect atado a `disponibilidad` completo: se disparaba
  // también cuando ese objeto llegaba/cambiaba por la carga inicial desde
  // Supabase (sin que el admin hubiera tocado nada), mostrando "Cambios
  // guardados" al simple abrir la pantalla. Ahora se dispara explícitamente
  // solo desde las funciones que de verdad guardan (aplicarHorarioSemanal,
  // aplicarExcepcion, quitarExcepcion).
  const [guardadoVisible, setGuardadoVisible] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState("")
  const [guardando, setGuardando] = useState(false)
  const timeoutGuardadoRef = useRef(null)
  const mostrarGuardado = () => {
    setGuardadoVisible(true)
    clearTimeout(timeoutGuardadoRef.current)
    timeoutGuardadoRef.current = setTimeout(() => setGuardadoVisible(false), 2600)
  }
  useEffect(() => () => clearTimeout(timeoutGuardadoRef.current), [])

  // El horario semanal habitual ya NO se guarda solo al tocar un switch u
  // hora — se edita en un borrador local y solo se aplica (persiste en
  // Supabase) al presionar "Guardar cambios". Evita escribir en la base de
  // datos en cada clic mientras el administrador todavía está decidiendo.
  const [borradorHorario, setBorradorHorario] = useState(disponibilidad.horarioSemanal)
  useEffect(() => {
    setBorradorHorario(disponibilidad.horarioSemanal)
  }, [disponibilidad.horarioSemanal])
  const hayCambiosSinGuardar = useMemo(
    () => JSON.stringify(borradorHorario) !== JSON.stringify(disponibilidad.horarioSemanal),
    [borradorHorario, disponibilidad.horarioSemanal],
  )
  const actualizarBorrador = (dia, sesion, cambios) => {
    setBorradorHorario((prev) => ({
      ...prev,
      [dia]: { ...prev[dia], [sesion]: { ...prev[dia][sesion], ...cambios } },
    }))
  }
  const descartarCambiosHorario = () => setBorradorHorario(disponibilidad.horarioSemanal)

  // Cada día del horario semanal es colapsable — por defecto solo el día de
  // hoy aparece expandido, así los otros 6 no ocupan pantalla mientras no se
  // están editando. Qué días quedaron abiertos se recuerda entre recargas
  // (mismo patrón que 'optica_seccion_activa' en Dashboard.jsx).
  const [diasAbiertos, setDiasAbiertos] = useState(() => {
    try {
      const guardado = JSON.parse(localStorage.getItem("optica_horario_dias_abiertos"))
      if (Array.isArray(guardado)) return new Set(guardado)
    } catch {}
    return new Set([DIAS_SEMANA[new Date().getDay()]])
  })
  useEffect(() => {
    localStorage.setItem("optica_horario_dias_abiertos", JSON.stringify([...diasAbiertos]))
  }, [diasAbiertos])
  const alternarDiaAbierto = (dia) => setDiasAbiertos((prev) => {
    const siguiente = new Set(prev)
    if (siguiente.has(dia)) siguiente.delete(dia)
    else siguiente.add(dia)
    return siguiente
  })

  // Citas de hoy en adelante que todavía necesitan atenderse (no canceladas del
  // sistema, no ya resueltas), agrupadas por día de la semana.
  const citasActivasPorDiaSemana = useMemo(() => {
    const mapa = {}
    DIAS_SEMANA.forEach((d) => { mapa[d] = [] })
    citas.forEach((c) => {
      if (!c.fecha) return
      if (c.estado === "Atendida" || c.estado === "No Asistió" || c.estado === "Cancelada") return
      if (!(esFechaHoy(c.fecha) || esFutura(c.fecha))) return
      const fechaObj = parseFechaFlexible(c.fecha)
      if (!fechaObj) return
      mapa[DIAS_SEMANA[fechaObj.getDay()]].push(c)
    })
    return mapa
  }, [citas])

  const citaFueraDeHorario = (cita, horario) => {
    const min = minutosDesdeMedianoche(cita.hora)
    const dentroDeSesion = (sesion) => sesion?.activo && min >= minutosDesde24h(sesion.inicio) && min < minutosDesde24h(sesion.fin)
    return !(dentroDeSesion(horario.manana) || dentroDeSesion(horario.tarde))
  }

  // Al presionar "Guardar cambios": revisa TODOS los días que cambiaron en el
  // borrador (no solo el último tocado) contra las citas ya agendadas, y
  // recién ahí persiste — mismo chequeo que antes hacía por cada clic, pero
  // una sola vez para el conjunto completo de cambios pendientes.
  const guardarHorarioSemanal = () => {
    const afectadas = []
    ORDEN_LV.forEach((dia) => {
      if (JSON.stringify(borradorHorario[dia]) === JSON.stringify(disponibilidad.horarioSemanal[dia])) return
      ;(citasActivasPorDiaSemana[dia] || [])
        .filter((c) => !disponibilidad.excepciones?.[c.fecha])
        .filter((c) => citaFueraDeHorario(c, borradorHorario[dia]))
        .forEach((c) => afectadas.push(c))
    })
    if (afectadas.length > 0) {
      setAvisoConflicto({ citas: afectadas, aplicar: aplicarHorarioSemanal })
      return
    }
    aplicarHorarioSemanal()
  }
  const aplicarHorarioSemanal = async () => {
    setGuardando(true)
    const { error } = await setDisponibilidad((prev) => ({ ...prev, horarioSemanal: borradorHorario }))
    setGuardando(false)
    if (error) {
      setErrorGuardar("No se pudo guardar el horario. Revisa tu conexión e intenta de nuevo.")
      return
    }
    setErrorGuardar("")
    mostrarGuardado()
  }

  const dias = useMemo(() => {
    const primerDia = new Date(mesVista.getFullYear(), mesVista.getMonth(), 1)
    const ultimoDia = new Date(mesVista.getFullYear(), mesVista.getMonth() + 1, 0)
    const offset = (primerDia.getDay() + 6) % 7
    const arr = []
    for (let i = 0; i < offset; i++) arr.push(null)
    for (let n = 1; n <= ultimoDia.getDate(); n++) {
      const d = new Date(mesVista.getFullYear(), mesVista.getMonth(), n)
      const iso = fechaAISO(d)
      arr.push({ numero: n, iso, pasado: iso < hoy })
    }
    return arr
  }, [mesVista, hoy])

  const excepcionesOrdenadas = useMemo(() => {
    return Object.entries(disponibilidad.excepciones || {})
      .filter(([iso]) => iso >= hoy)
      .sort(([a], [b]) => (a < b ? -1 : 1))
  }, [disponibilidad.excepciones, hoy])

  const excepcionActual = fechaEditando ? disponibilidad.excepciones?.[fechaEditando] : null
  const horarioBaseFecha = fechaEditando
    ? disponibilidad.horarioSemanal[DIAS_SEMANA[new Date(fechaEditando + "T00:00:00").getDay()]]
    : null

  const aplicarExcepcion = (fecha, cambios) => {
    setDisponibilidad((prev) => ({ ...prev, excepciones: { ...prev.excepciones, [fecha]: cambios } }))
    setFechaEditando(null)
    mostrarGuardado()
  }

  const guardarExcepcion = (cambios) => {
    const afectadas = citas.filter((c) => {
      if (c.fecha !== fechaEditando) return false
      if (c.estado === "Atendida" || c.estado === "No Asistió" || c.estado === "Cancelada") return false
      return citaFueraDeHorario(c, cambios)
    })
    if (afectadas.length > 0) {
      setAvisoConflicto({ citas: afectadas, aplicar: () => aplicarExcepcion(fechaEditando, cambios) })
      return
    }
    aplicarExcepcion(fechaEditando, cambios)
  }

  const quitarExcepcion = () => {
    setDisponibilidad((prev) => {
      const n = { ...prev.excepciones }
      delete n[fechaEditando]
      return { ...prev, excepciones: n }
    })
    setFechaEditando(null)
    mostrarGuardado()
  }

  const irMesAnterior = () => setMesVista((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
  const irMesSiguiente = () => setMesVista((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))

  return (
    <div className="w-full space-y-6 text-left">
      {/* ─── HEADER ─── */}
      <div className="flex items-start gap-3.5">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white" style={{ background: GRAD, boxShadow: "0 12px 24px -10px rgba(37,99,235,0.6)" }}>
          <CalendarClock size={24} />
        </div>
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight" style={{ color: INK }}>Horario</h1>
          <p className="text-sm text-slate-500">
            {tab === "general"
              ? "El horario de atención de la óptica: pacientes y portal solo verán espacios reales, sincronizados con esto."
              : "Tu horario personal — separado del horario general de la óptica, solo lo ves y lo editas tú."}
          </p>
        </div>
      </div>

      {/* ─── TABS: general vs. personal ─── */}
      <div className="flex gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm">
        <button
          type="button"
          onClick={() => setTab("general")}
          className={"flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition cursor-pointer " + (tab === "general" ? "text-white" : "text-slate-500 hover:bg-slate-50")}
          style={tab === "general" ? { background: GRAD } : undefined}
        >
          <Building2 size={16} /> Horario general de la óptica
        </button>
        <button
          type="button"
          onClick={() => setTab("personal")}
          className={"flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold transition cursor-pointer " + (tab === "personal" ? "text-white" : "text-slate-500 hover:bg-slate-50")}
          style={tab === "personal" ? { background: GRAD } : undefined}
        >
          <UserCog size={16} /> Mi horario
        </button>
      </div>

      {/* ─── CONFIRMACIÓN DE GUARDADO (aparece brevemente tras cada cambio) ─── */}
      {guardadoVisible && (
        <div role="status" className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-emerald-900">
          <CheckCircle2 className="shrink-0 text-emerald-600" size={18} />
          <p className="text-sm font-semibold">Cambios guardados.</p>
        </div>
      )}

      {tab === "personal" ? (
        <MiHorarioPersonal horarioPersonal={horarioPersonal} setHorarioPersonal={setHorarioPersonal} />
      ) : !esAdmin ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-blue-100 bg-blue-50 p-3.5 text-blue-800">
            <Lock size={16} className="shrink-0" />
            <p className="text-xs leading-relaxed">Solo el administrador puede editar el horario general de la óptica. Esto es de referencia.</p>
          </div>
          <h4 className="mb-3 text-sm font-bold" style={{ color: INK }}>Horario semanal habitual</h4>
          <div className="space-y-2">
            {ORDEN_LV.map((dia) => (
              <div key={dia} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
                <span className="text-sm font-semibold text-slate-700">{ETIQUETAS_DIA[dia]}</span>
                <span className="text-xs text-slate-500">{resumenHorario(disponibilidad.horarioSemanal[dia])}</span>
              </div>
            ))}
          </div>
          {excepcionesOrdenadas.length > 0 && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <h4 className="mb-3 text-sm font-bold" style={{ color: INK }}>Próximos cambios sobre el horario habitual</h4>
              <div className="divide-y divide-slate-100">
                {excepcionesOrdenadas.map(([iso, exc]) => {
                  const abierta = diaAbierto(exc)
                  return (
                    <div key={iso} className="flex items-center gap-2.5 py-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: abierta ? "#059669" : "#dc2626" }} />
                      <span className="text-sm font-semibold text-slate-700">{iso.split("-").reverse().join("/")}</span>
                      <span className="text-xs text-slate-500">{abierta ? `Abre ${resumenHorario(exc)}` : "Cerrado todo el día"}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* ─── HORARIO SEMANAL + PARÁMETROS ─── */}
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h4 className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 text-sm font-bold" style={{ color: INK }}>
              <span className="grid h-8 w-8 place-items-center rounded-lg text-white" style={{ background: GRAD }}><Sun size={16} /></span>
              Horario semanal habitual
              {hayCambiosSinGuardar && (
                <span className="ml-auto rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">Sin guardar</span>
              )}
            </h4>
            <p className="-mt-2 mb-3 text-xs text-slate-500">
              Esto define la regla general: si apagas "Lunes" aquí, cierras <span className="font-semibold">todos</span> los lunes.
              Para cerrar solo un día puntual (ej. un lunes feriado) sin tocar el resto, usa "Excepciones puntuales" en el calendario de al lado.
            </p>
            <div className="space-y-2.5">
              {ORDEN_LV.map((dia) => {
                const d = borradorHorario[dia]
                const abierto = diaAbierto(d)
                const expandido = diasAbiertos.has(dia)
                return (
                  <div key={dia} className={"overflow-hidden rounded-xl border transition-colors " + (abierto ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50/60")}>
                    <button
                      type="button"
                      onClick={() => alternarDiaAbierto(dia)}
                      aria-expanded={expandido}
                      className="flex w-full items-center justify-between gap-2 p-3 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                    >
                      <div className="min-w-0">
                        <p className={"text-sm font-semibold " + (abierto ? "text-slate-800" : "text-slate-500")}>{ETIQUETAS_DIA[dia]}</p>
                        {!expandido && <p className="mt-0.5 truncate text-xs text-slate-500">{resumenHorario(d)}</p>}
                      </div>
                      <ChevronDown size={16} className={"shrink-0 text-slate-400 transition-transform " + (expandido ? "rotate-180" : "")} />
                    </button>
                    {expandido && (
                      <div className="space-y-2 px-3 pb-3">
                        {[["manana", "Mañana", Sun], ["tarde", "Tarde", Moon]].map(([clave, etiqueta, Icono]) => {
                          const s = d[clave]
                          return (
                            <div key={clave} className="rounded-lg bg-slate-50/70 p-2">
                              <div className="flex items-center justify-between">
                                <span className={"flex items-center gap-1.5 text-xs font-semibold " + (s.activo ? "text-slate-700" : "text-slate-400")}>
                                  <Icono size={12} /> {etiqueta}
                                </span>
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={s.activo}
                                  onClick={() => actualizarBorrador(dia, clave, { activo: !s.activo })}
                                  className="relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors"
                                  style={{ backgroundColor: s.activo ? "#2563EB" : "#e2e8f0" }}
                                  title={s.activo ? `Cerrar la ${etiqueta.toLowerCase()}` : `Abrir la ${etiqueta.toLowerCase()}`}
                                  aria-label={s.activo ? `Cerrar la ${etiqueta.toLowerCase()}` : `Abrir la ${etiqueta.toLowerCase()}`}
                                >
                                  <span className={"absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform " + (s.activo ? "translate-x-[16px]" : "translate-x-0")} />
                                </button>
                              </div>
                              {s.activo && (
                                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                                  <input
                                    type="time" value={s.inicio} onChange={(e) => actualizarBorrador(dia, clave, { inicio: e.target.value })}
                                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500"
                                  />
                                  <input
                                    type="time" value={s.fin} onChange={(e) => actualizarBorrador(dia, clave, { fin: e.target.value })}
                                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500"
                                  />
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {errorGuardar && (
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs font-medium text-red-700">
                <AlertTriangle size={14} /> {errorGuardar}
              </div>
            )}
            {hayCambiosSinGuardar && (
              <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  disabled={guardando}
                  onClick={descartarCambiosHorario}
                  className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                >
                  Descartar
                </button>
                <button
                  type="button"
                  disabled={guardando}
                  onClick={guardarHorarioSemanal}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 cursor-pointer disabled:opacity-50"
                  style={{ background: GRAD }}
                >
                  <CheckCircle2 size={15} /> {guardando ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h4 className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 text-sm font-bold" style={{ color: INK }}>
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-600"><Clock size={16} /></span>
              Duración de cada cita
            </h4>
            <div className="flex items-center gap-2">
              <input
                type="number" min={10} step={5} value={disponibilidad.duracionCita}
                onChange={(e) => setDisponibilidad((prev) => ({ ...prev, duracionCita: Math.max(10, Number(e.target.value) || 10) }))}
                className="w-24 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-blue-500"
              />
              <span className="text-sm text-slate-500">minutos por paciente</span>
            </div>
          </div>
        </div>

        {/* ─── EXCEPCIONES PUNTUALES ─── */}
        <div className="space-y-6 lg:col-span-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="flex items-center gap-2 text-sm font-bold" style={{ color: INK }}>
                <span className="grid h-8 w-8 place-items-center rounded-lg text-white" style={{ background: GRAD }}><CalendarDays size={16} /></span>
                Excepciones puntuales
              </h4>
              <span className="flex items-center gap-1 text-[11px] text-slate-500"><Info size={12} /> Toca un día para cerrarlo o abrirlo</span>
            </div>

            <div className="mb-3 flex items-center justify-between px-1">
              <span className="text-sm font-bold capitalize" style={{ color: INK }}>{MESES[mesVista.getMonth()]} {mesVista.getFullYear()}</span>
              <div className="flex gap-1 text-slate-500">
                <button type="button" onClick={irMesAnterior} aria-label="Mes anterior" className="rounded-md p-1 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"><ChevronLeft size={16} /></button>
                <button type="button" onClick={irMesSiguiente} aria-label="Mes siguiente" className="rounded-md p-1 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"><ChevronRight size={16} /></button>
              </div>
            </div>

            <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-500">
              {DIAS_CORTOS.map((d, i) => (<span key={i}>{d}</span>))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {dias.map((dia, i) => {
                if (!dia) return <span key={`e${i}`} />
                const efectivo = horarioEfectivo(dia.iso, disponibilidad)
                const efectivoAbierto = diaAbierto(efectivo)
                const excepcion = disponibilidad.excepciones?.[dia.iso]
                const excepcionAbierta = excepcion ? diaAbierto(excepcion) : null
                const esHoy = dia.iso === hoy
                return (
                  <button
                    key={dia.iso}
                    type="button"
                    disabled={dia.pasado}
                    onClick={() => setFechaEditando(dia.iso)}
                    title={efectivoAbierto ? `Abierto ${resumenHorario(efectivo)}` : "Cerrado"}
                    className={
                      "relative grid h-10 w-full place-items-center rounded-xl text-xs font-bold transition-all " +
                      (dia.pasado
                        ? "cursor-not-allowed text-slate-300"
                        : excepcion
                        ? (excepcionAbierta
                            ? "border-2 border-dashed border-emerald-400 bg-emerald-50 text-emerald-700 hover:border-emerald-500 cursor-pointer"
                            : "border-2 border-dashed border-red-400 bg-red-50 text-red-700 hover:border-red-500 cursor-pointer")
                        : efectivoAbierto
                        ? "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-400 cursor-pointer"
                        : "border border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 cursor-pointer") +
                      (esHoy ? " ring-2 ring-blue-500 ring-offset-1" : "")
                    }
                  >
                    {dia.numero}
                    {excepcion && (
                      <span
                        className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white"
                        style={{ backgroundColor: excepcionAbierta ? "#059669" : "#dc2626" }}
                      />
                    )}
                  </button>
                )
              })}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-slate-200/70 pt-3 text-[10px] text-slate-500">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" />Abierto</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-300" />Cerrado</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-600" />Excepción: abre extra</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-600" />Excepción: cierra</span>
            </div>
          </div>

          {excepcionesOrdenadas.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h4 className="mb-3 text-sm font-bold" style={{ color: INK }}>Próximos cambios sobre tu horario habitual</h4>
              <div className="divide-y divide-slate-100">
                {excepcionesOrdenadas.map(([iso, exc]) => {
                  const abierta = diaAbierto(exc)
                  return (
                    <div key={iso} className="flex items-center justify-between py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: abierta ? "#059669" : "#dc2626" }} />
                        <span className="text-sm font-semibold text-slate-700">{iso.split("-").reverse().join("/")}</span>
                        <span className="text-xs text-slate-500">{abierta ? `Abre ${resumenHorario(exc)}` : "Cerrado todo el día"}</span>
                      </div>
                      <button type="button" onClick={() => setFechaEditando(iso)} className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">Editar</button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      )}

      {/* ─── MODAL EDITAR FECHA (solo tab general, solo admin) ─── */}
      {fechaEditando && (
        <EditorExcepcion
          fecha={fechaEditando}
          excepcion={excepcionActual}
          horarioBase={horarioBaseFecha}
          onGuardar={guardarExcepcion}
          onQuitar={excepcionActual ? quitarExcepcion : null}
          onCerrar={() => setFechaEditando(null)}
        />
      )}

      {/* ─── AVISO: EL CAMBIO DEJA CITAS YA AGENDADAS FUERA DE HORARIO ─── */}
      {avisoConflicto && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={() => setAvisoConflicto(null)}>
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl" style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)", willChange: "transform, opacity" }} onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5">
              <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-amber-50 text-amber-600">
                <AlertTriangle size={22} />
              </div>
              <h2 className="text-lg font-bold" style={{ color: INK }}>Hay citas fuera de este horario</h2>
              <p className="mt-1.5 text-sm text-slate-500">
                {avisoConflicto.citas.length === 1
                  ? "Esta cita ya agendada quedaría fuera del horario si aplicas el cambio:"
                  : `Estas ${avisoConflicto.citas.length} citas ya agendadas quedarían fuera del horario si aplicas el cambio:`}
              </p>
              <div className="mt-3 max-h-40 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
                {avisoConflicto.citas.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <User size={13} className="shrink-0 text-slate-500" />
                    <span className="truncate font-semibold text-slate-700">{c.paciente}</span>
                    <span className="ml-auto shrink-0 font-mono text-xs text-slate-500">{c.fecha} · {c.hora}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-500">Puedes aplicar el cambio igual y reprogramarlas tú mismo después, o cancelar y dejarlas como están.</p>
            </div>
            <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
              <button type="button" onClick={() => setAvisoConflicto(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => { avisoConflicto.aplicar(); setAvisoConflicto(null) }}
                className="flex-1 rounded-xl bg-amber-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-700 cursor-pointer"
              >
                Aplicar de todas formas
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// ─── MI HORARIO (personal) ───
// Caso de la reunión con el ing: horario propio de cada usuario, separado
// del horario general de la óptica, más la posibilidad de marcar un día que
// no podrá asistir (hoy eso solo se avisa por WhatsApp, informal).
function MiHorarioPersonal({ horarioPersonal, setHorarioPersonal }) {
  const cargando = horarioPersonal === null
  const semanaGuardada = horarioPersonal?.horarioSemanal || {}
  const ausencias = horarioPersonal?.ausencias || {}

  const [borrador, setBorrador] = useState(SEMANA_PERSONAL_VACIA())
  useEffect(() => {
    if (!cargando) setBorrador({ ...SEMANA_PERSONAL_VACIA(), ...semanaGuardada })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargando])

  const hayCambios = useMemo(() => JSON.stringify(borrador) !== JSON.stringify({ ...SEMANA_PERSONAL_VACIA(), ...semanaGuardada }), [borrador, semanaGuardada])
  const actualizarBorrador = (dia, sesion, cambios) => {
    setBorrador((prev) => ({ ...prev, [dia]: { ...prev[dia], [sesion]: { ...prev[dia][sesion], ...cambios } } }))
  }

  const [diasAbiertos, setDiasAbiertos] = useState(() => new Set([DIAS_SEMANA[new Date().getDay()]]))
  const alternarDiaAbierto = (dia) => setDiasAbiertos((prev) => {
    const s = new Set(prev)
    s.has(dia) ? s.delete(dia) : s.add(dia)
    return s
  })

  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  const [guardadoOk, setGuardadoOk] = useState(false)

  const guardarHorario = async () => {
    setGuardando(true)
    const { error: err } = await setHorarioPersonal((prev) => ({ ...(prev || { ausencias: {} }), horarioSemanal: borrador }))
    setGuardando(false)
    if (err) { setError("No se pudo guardar. Revisa tu conexión e intenta de nuevo."); return }
    setError("")
    setGuardadoOk(true)
    setTimeout(() => setGuardadoOk(false), 2600)
  }
  const descartar = () => setBorrador({ ...SEMANA_PERSONAL_VACIA(), ...semanaGuardada })

  // Ausencias — se aplican al instante (mismo criterio que las excepciones
  // puntuales del horario general).
  const [modalAusenciaAbierto, setModalAusenciaAbierto] = useState(false)
  const [fechaAusencia, setFechaAusencia] = useState(hoyISO())
  const [motivoAusencia, setMotivoAusencia] = useState("")

  const ausenciasOrdenadas = useMemo(
    () => Object.entries(ausencias).filter(([iso]) => iso >= hoyISO()).sort(([a], [b]) => (a < b ? -1 : 1)),
    [ausencias],
  )

  const registrarAusencia = async (e) => {
    e.preventDefault()
    if (!fechaAusencia) return
    await setHorarioPersonal((prev) => ({ ...(prev || { horarioSemanal: SEMANA_PERSONAL_VACIA() }), ausencias: { ...(prev?.ausencias || {}), [fechaAusencia]: motivoAusencia.trim() } }))
    setModalAusenciaAbierto(false)
    setFechaAusencia(hoyISO())
    setMotivoAusencia("")
  }

  const quitarAusencia = (iso) => {
    setHorarioPersonal((prev) => {
      const n = { ...(prev?.ausencias || {}) }
      delete n[iso]
      return { ...(prev || { horarioSemanal: SEMANA_PERSONAL_VACIA() }), ausencias: n }
    })
  }

  if (cargando) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-sm">Cargando tu horario...</div>
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* ─── HORARIO SEMANAL PROPIO ─── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h4 className="mb-1 flex items-center gap-2 border-b border-slate-100 pb-3 text-sm font-bold" style={{ color: INK }}>
          <span className="grid h-8 w-8 place-items-center rounded-lg text-white" style={{ background: GRAD }}><UserCog size={16} /></span>
          Mi horario habitual
          {hayCambios && <span className="ml-auto rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700">Sin guardar</span>}
        </h4>
        <p className="-mt-1 mb-3 mt-2 text-xs text-slate-500">Es solo tuyo — no afecta el horario general de la óptica ni lo que ve un paciente.</p>

        <div className="space-y-2.5">
          {ORDEN_LV.map((dia) => {
            const d = borrador[dia]
            const abierto = diaAbierto(d)
            const expandido = diasAbiertos.has(dia)
            return (
              <div key={dia} className={"overflow-hidden rounded-xl border transition-colors " + (abierto ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50/60")}>
                <button type="button" onClick={() => alternarDiaAbierto(dia)} aria-expanded={expandido} className="flex w-full items-center justify-between gap-2 p-3 text-left cursor-pointer">
                  <div className="min-w-0">
                    <p className={"text-sm font-semibold " + (abierto ? "text-slate-800" : "text-slate-500")}>{ETIQUETAS_DIA[dia]}</p>
                    {!expandido && <p className="mt-0.5 truncate text-xs text-slate-500">{resumenHorario(d)}</p>}
                  </div>
                  <ChevronDown size={16} className={"shrink-0 text-slate-400 transition-transform " + (expandido ? "rotate-180" : "")} />
                </button>
                {expandido && (
                  <div className="space-y-2 px-3 pb-3">
                    {[["manana", "Mañana", Sun], ["tarde", "Tarde", Moon]].map(([clave, etiqueta, Icono]) => {
                      const s = d[clave]
                      return (
                        <div key={clave} className="rounded-lg bg-slate-50/70 p-2">
                          <div className="flex items-center justify-between">
                            <span className={"flex items-center gap-1.5 text-xs font-semibold " + (s.activo ? "text-slate-700" : "text-slate-400")}><Icono size={12} /> {etiqueta}</span>
                            <button
                              type="button" role="switch" aria-checked={s.activo}
                              onClick={() => actualizarBorrador(dia, clave, { activo: !s.activo })}
                              className="relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors"
                              style={{ backgroundColor: s.activo ? "#2563EB" : "#e2e8f0" }}
                              aria-label={s.activo ? `Cerrar la ${etiqueta.toLowerCase()}` : `Abrir la ${etiqueta.toLowerCase()}`}
                            >
                              <span className={"absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform " + (s.activo ? "translate-x-[16px]" : "translate-x-0")} />
                            </button>
                          </div>
                          {s.activo && (
                            <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                              <input type="time" value={s.inicio} onChange={(e) => actualizarBorrador(dia, clave, { inicio: e.target.value })} className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500" />
                              <input type="time" value={s.fin} onChange={(e) => actualizarBorrador(dia, clave, { fin: e.target.value })} className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500" />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs font-medium text-red-700">
            <AlertTriangle size={14} /> {error}
          </div>
        )}
        {guardadoOk && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs font-semibold text-emerald-700">
            <CheckCircle2 size={14} /> Guardado.
          </div>
        )}
        {hayCambios && (
          <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
            <button type="button" disabled={guardando} onClick={descartar} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer disabled:opacity-50">Descartar</button>
            <button type="button" disabled={guardando} onClick={guardarHorario} className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 cursor-pointer disabled:opacity-50" style={{ background: GRAD }}>
              <CheckCircle2 size={15} /> {guardando ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        )}
      </div>

      {/* ─── AUSENCIAS ─── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
          <h4 className="flex items-center gap-2 text-sm font-bold" style={{ color: INK }}>
            <span className="grid h-8 w-8 place-items-center rounded-lg text-white" style={{ background: "linear-gradient(135deg,#f87171,#dc2626)" }}><CalendarX size={16} /></span>
            No podré asistir
          </h4>
          <button type="button" onClick={() => setModalAusenciaAbierto(true)} className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 transition hover:bg-red-100 cursor-pointer">
            <Plus size={13} /> Registrar
          </button>
        </div>
        <p className="-mt-1 mb-3 text-xs text-slate-500">Deja constancia en el sistema en vez de avisar solo por WhatsApp.</p>

        {ausenciasOrdenadas.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <div className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-300"><CalendarX size={20} /></div>
            <p className="text-sm font-medium text-slate-500">No tienes ausencias registradas.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {ausenciasOrdenadas.map(([iso, motivo]) => (
              <div key={iso} className="flex items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-700">{iso.split("-").reverse().join("/")}</p>
                  {motivo && <p className="truncate text-xs text-slate-500">{motivo}</p>}
                </div>
                <button type="button" onClick={() => quitarAusencia(iso)} title="Quitar" aria-label={`Quitar ausencia del ${iso}`} className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600 cursor-pointer">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── MODAL REGISTRAR AUSENCIA ─── */}
      {modalAusenciaAbierto && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={() => setModalAusenciaAbierto(false)}>
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl" style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)", willChange: "transform, opacity" }} onClick={(e) => e.stopPropagation()}>
            <div className="border-b border-slate-100 px-6 py-4">
              <h2 className="text-lg font-bold" style={{ color: INK }}>No podré asistir</h2>
              <p className="mt-1 text-xs text-slate-500">Queda registrado en el sistema como constancia.</p>
            </div>
            <form onSubmit={registrarAusencia} className="space-y-3.5 px-6 py-5">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Fecha</label>
                <input type="date" required min={hoyISO()} value={fechaAusencia} onChange={(e) => setFechaAusencia(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:bg-white" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Motivo <span className="normal-case text-slate-500">(opcional)</span></label>
                <textarea rows={2} value={motivoAusencia} onChange={(e) => setMotivoAusencia(e.target.value)} placeholder="Ej. Cita médica" className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:bg-white" />
              </div>
              <div className="flex gap-3 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setModalAusenciaAbierto(false)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer">Cancelar</button>
                <button type="submit" className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 cursor-pointer" style={{ background: "linear-gradient(135deg,#f87171,#dc2626)" }}>Registrar</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

function EditorExcepcion({ fecha, excepcion, horarioBase, onGuardar, onQuitar, onCerrar }) {
  const base = excepcion || horarioBase
  const [manana, setManana] = useState({ ...horarioBase.manana, ...base.manana })
  const [tarde, setTarde] = useState({ ...horarioBase.tarde, ...base.tarde })

  const fechaLegible = new Date(fecha + "T00:00:00").toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long" })

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={onCerrar}>
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl" style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)", willChange: "transform, opacity" }} onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-100 px-6 py-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Excepción de horario</p>
          <h2 className="text-lg font-bold capitalize" style={{ color: INK }}>{fechaLegible}</h2>
          <p className="mt-1 text-xs text-slate-500">
            Normalmente este día: <span className="font-semibold">{resumenHorario(horarioBase)}</span>.
          </p>
        </div>

        <div className="space-y-3 px-6 py-5">
          {[["manana", "Mañana", Sun, manana, setManana], ["tarde", "Tarde", Moon, tarde, setTarde]].map(([clave, etiqueta, Icono, valor, setValor]) => (
            <div key={clave} className="rounded-xl border border-slate-200 p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700"><Icono size={14} /> {etiqueta}</span>
                <button
                  type="button" onClick={() => setValor((v) => ({ ...v, activo: !v.activo }))}
                  role="switch"
                  aria-checked={valor.activo}
                  aria-label={valor.activo ? `Cerrar la ${etiqueta.toLowerCase()}` : `Abrir la ${etiqueta.toLowerCase()}`}
                  className="relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors"
                  style={{ backgroundColor: valor.activo ? "#059669" : "#e2e8f0" }}
                >
                  <span className={"absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform " + (valor.activo ? "translate-x-[22px]" : "translate-x-0")} />
                </button>
              </div>
              {valor.activo && (
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <input type="time" value={valor.inicio || ""} onChange={(e) => setValor((v) => ({ ...v, inicio: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500" />
                  <input type="time" value={valor.fin || ""} onChange={(e) => setValor((v) => ({ ...v, fin: e.target.value }))}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500" />
                </div>
              )}
            </div>
          ))}

          <div className="flex gap-3 border-t border-slate-100 pt-4">
            {onQuitar && (
              <button type="button" onClick={onQuitar} title="Volver al horario habitual" aria-label="Volver al horario habitual" className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-50 cursor-pointer">
                <RotateCcw size={14} />
              </button>
            )}
            <button type="button" onClick={onCerrar} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">Cancelar</button>
            <button type="button" onClick={() => onGuardar({ manana, tarde })} className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 cursor-pointer" style={{ background: GRAD }}>
              <span className="flex items-center justify-center gap-1.5"><CheckCircle2 size={15} /> Guardar</span>
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
