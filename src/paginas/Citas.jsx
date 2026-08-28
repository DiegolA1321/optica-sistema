"use client"

import React, { useState, useMemo, useEffect, useRef } from "react"
import { supabase } from "../lib/supabaseClient"
import {
  Calendar,
  Plus,
  Clock,
  User,
  CheckCircle2,
  Trash2,
  X,
  Search,
  CalendarDays,
  AlertTriangle,
  Stethoscope,
  CalendarClock,
  CalendarCheck,
  Sun,
  ChevronRight,
  ChevronDown,
  UserX,
  Activity,
  MessageCircle,
} from "lucide-react"
import SelectorFechaHora from "../componentes/SelectorFechaHora"
import ConfirmarCitaModal from "../componentes/ConfirmarCitaModal"
import { isoAFechaLocal, esHoy, esFutura, etiquetaFecha, parseFechaFlexible, minutosDesdeMedianoche } from "../utilidades/disponibilidad"

// ─── Paleta de firma (consistente con el resto del sistema) ───
const INK = "#0E2B33"
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)" // cian → azul

// Paleta de colores por motivo — se asigna por posición en el catálogo
// editable (Configuración), no por nombre fijo, porque el administrador
// puede agregar, renombrar o eliminar motivos libremente.
const PALETA_MOTIVOS = [
  { badge: "bg-blue-50 text-blue-700 border-blue-100", punto: "#3b82f6" },
  { badge: "bg-emerald-50 text-emerald-700 border-emerald-100", punto: "#10b981" },
  { badge: "bg-amber-50 text-amber-700 border-amber-100", punto: "#f59e0b" },
  { badge: "bg-purple-50 text-purple-700 border-purple-100", punto: "#a855f7" },
  { badge: "bg-pink-50 text-pink-700 border-pink-100", punto: "#ec4899" },
  { badge: "bg-cyan-50 text-cyan-700 border-cyan-100", punto: "#06b6d4" },
]
const SIN_MOTIVO = { badge: "bg-slate-100 text-slate-600 border-slate-200", punto: "#94a3b8" }

const motivoInfo = (motivo = "", catalogo = []) => {
  const idx = catalogo.indexOf(motivo)
  return idx === -1 ? SIN_MOTIVO : PALETA_MOTIVOS[idx % PALETA_MOTIVOS.length]
}

function KpiBoton({ icono: Icono, valor, etiqueta, tono, activo, onClick }) {
  const map = {
    blue: { tile: GRAD, tileText: "#fff", ring: "#2563EB" },
    emerald: { tile: "#ecfdf5", tileText: "#059669", ring: "#059669" },
    amber: { tile: "#fffbeb", tileText: "#d97706", ring: "#d97706" },
    slate: { tile: "#f1f5f9", tileText: "#64748b", ring: "#475569" },
  }
  const c = map[tono] || map.slate

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-3 rounded-2xl border bg-white p-4 text-left transition-all hover:-translate-y-0.5 cursor-pointer"
      style={{
        borderColor: activo ? c.ring : "rgba(14,43,51,0.08)",
        boxShadow: activo ? `0 0 0 3px ${c.ring}22` : "0 1px 2px rgba(14,43,51,0.04)",
      }}
    >
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-transform group-hover:scale-105" style={{ background: c.tile, color: c.tileText }}>
        <Icono size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-black leading-none" style={{ color: INK }}>{valor}</p>
        <p className="mt-1 truncate text-xs font-semibold text-slate-500">{etiqueta}</p>
      </div>
    </button>
  )
}

export default function Citas({ usuario, citas = [], setCitas, pacientes = [], disponibilidad, abrirModalAlEntrar = false, onModalAlEntrarConsumido, motivosConsulta = [] }) {
  const opticaId = usuario?.opticaId
  const [modalAbierto, setModalAbierto] = useState(false)
  const [pacienteId, setPacienteId] = useState(null)
  const [busquedaPaciente, setBusquedaPaciente] = useState("")
  const [mostrarDropdown, setMostrarDropdown] = useState(false)
  const dropdownRef = useRef(null)
  const [fecha, setFecha] = useState("")
  const [hora, setHora] = useState("")
  const [motivo, setMotivo] = useState("")
  const [guardadoExitoso, setGuardadoExitoso] = useState(false)
  const [error, setError] = useState("")
  const [bannerError, setBannerError] = useState("")
  const [confirmando, setConfirmando] = useState(false)

  // Acceso directo desde "Agendar cita" en Inicio: abre este modal sin pasar
  // primero por la vista de agenda (feedback del asesor: si una "opción rápida"
  // exige dos clics extra ya no es rápida).
  useEffect(() => {
    if (abrirModalAlEntrar) {
      setModalAbierto(true)
      onModalAlEntrarConsumido?.()
    }
  }, [abrirModalAlEntrar])

  const [busqueda, setBusqueda] = useState("")
  const [filtro, setFiltro] = useState("todas") // todas | hoy | proximas | atendidas
  const [porCancelar, setPorCancelar] = useState(null)

  // Días colapsados manualmente (feedback del asesor: si hay muchas citas en un
  // día, poder colapsarlo para ver el siguiente sin tener que hacer scroll).
  const [diasColapsados, setDiasColapsados] = useState(() => new Set())
  const alternarDia = (dia) => {
    setDiasColapsados((prev) => {
      const siguiente = new Set(prev)
      if (siguiente.has(dia)) siguiente.delete(dia)
      else siguiente.add(dia)
      return siguiente
    })
  }

  // Menú "cambiar estado" por tarjeta de cita (mismo patrón que el menú
  // "más acciones" de Pacientes.jsx)
  const [menuEstadoId, setMenuEstadoId] = useState(null)
  const menuEstadoRef = useRef(null)

  const pacientesFiltrados = useMemo(() => {
    const q = busquedaPaciente.trim().toLowerCase()
    if (!q) return pacientes
    return pacientes.filter((p) => p.nombre.toLowerCase().includes(q) || (p.cedula || "").includes(q))
  }, [pacientes, busquedaPaciente])

  useEffect(() => {
    const onDown = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setMostrarDropdown(false) }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [])

  useEffect(() => {
    if (menuEstadoId == null) return
    const onDown = (e) => { if (menuEstadoRef.current && !menuEstadoRef.current.contains(e.target)) setMenuEstadoId(null) }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [menuEstadoId])

  const seleccionarPaciente = (p) => {
    setPacienteId(p.id)
    setBusquedaPaciente(p.nombre)
    setMostrarDropdown(false)
    setError("")
  }

  const pacienteSeleccionado = pacientes.find((p) => p.id === pacienteId)

  const validarYPedirConfirmacion = (e) => {
    e.preventDefault()
    if (!pacienteSeleccionado) {
      setError("Selecciona un paciente registrado de la lista.")
      return
    }
    if (!motivo) {
      setError("Selecciona el motivo del examen.")
      return
    }
    if (!fecha || !hora) {
      setError("Selecciona fecha y hora en el calendario.")
      return
    }
    setError("")
    setConfirmando(true)
  }

  const agendarCita = async () => {
    const paciente = pacienteSeleccionado
    const partesNombre = paciente.nombre.trim().split(" ").filter(Boolean)
    const iniciales =
      partesNombre.length > 1
        ? (partesNombre[0][0] + partesNombre[1][0]).toUpperCase()
        : partesNombre[0][0].toUpperCase()

    const nuevaCita = {
      pacienteId: paciente.id,
      paciente: paciente.nombre,
      cedula: paciente.cedula,
      telefono: paciente.telefono,
      fecha,
      hora,
      motivo,
      iniciales: iniciales || "P",
      estado: "Pendiente",
    }

    if (supabase && opticaId) {
      const { data } = await supabase
        .from("citas")
        .insert({
          optica_id: opticaId,
          paciente_id: typeof paciente.id === "string" ? paciente.id : null,
          paciente: nuevaCita.paciente, cedula: nuevaCita.cedula, telefono: nuevaCita.telefono,
          fecha: nuevaCita.fecha, hora: nuevaCita.hora, motivo: nuevaCita.motivo, estado: nuevaCita.estado,
        })
        .select()
        .single()
      if (data) nuevaCita.id = data.id
    }
    if (nuevaCita.id == null) nuevaCita.id = Date.now()

    setCitas([...citas, nuevaCita])

    setConfirmando(false)
    cerrarModal()
    setGuardadoExitoso(true)
    setTimeout(() => setGuardadoExitoso(false), 3000)
  }

  const cerrarModal = () => {
    setModalAbierto(false)
    setConfirmando(false)
    setPacienteId(null)
    setBusquedaPaciente("")
    setMostrarDropdown(false)
    setFecha("")
    setHora("")
    setMotivo("")
    setError("")
  }

  const confirmarCancelacion = async () => {
    if (porCancelar == null) return
    if (supabase && opticaId) {
      const { error: errorCancelar } = await supabase.from("citas").delete().eq("id", porCancelar)
      if (errorCancelar) {
        setBannerError("No se pudo cancelar la cita. Revisa tu conexión e intenta de nuevo.")
        setPorCancelar(null)
        return
      }
    }
    setBannerError("")
    setCitas(citas.filter((c) => c.id !== porCancelar))
    setPorCancelar(null)
  }

  // Marca el desenlace real de una cita — antes nada en todo el sistema volvía
  // a tocar cita.estado después de crearla, así que "Atendida" se inferÍa solo
  // por si la fecha ya había pasado (una cita de hace un mes con paciente que
  // nunca llegó se contaba igual como "atendida" que una que sí se realizó).
  const marcarEstado = async (citaId, nuevoEstado) => {
    if (supabase && opticaId) {
      const { error: errorEstado } = await supabase.from("citas").update({ estado: nuevoEstado }).eq("id", citaId)
      if (errorEstado) {
        setBannerError("No se pudo actualizar el estado de la cita. Revisa tu conexión e intenta de nuevo.")
        return
      }
    }
    setBannerError("")
    setCitas(citas.map((c) => (c.id === citaId ? { ...c, estado: nuevoEstado } : c)))
  }

  // ── Reagendar cita (solo el optómetra, desde aquí — no hay autoservicio del paciente) ──
  const [reagendando, setReagendando] = useState(null)
  const [nuevaFecha, setNuevaFecha] = useState("")
  const [nuevaHora, setNuevaHora] = useState("")
  const [nuevoMotivo, setNuevoMotivo] = useState("")
  const [errorReagendar, setErrorReagendar] = useState("")
  const [reagendada, setReagendada] = useState(null) // cita ya guardada, para ofrecer avisar por WhatsApp

  const abrirReagendar = (cita) => {
    setReagendando(cita)
    setNuevaFecha("")
    setNuevaHora("")
    setNuevoMotivo(cita.motivo || "")
    setErrorReagendar("")
  }

  const cerrarReagendar = () => {
    setReagendando(null)
    setNuevaFecha("")
    setNuevaHora("")
    setNuevoMotivo("")
    setErrorReagendar("")
  }

  const confirmarReagendar = async (e) => {
    e.preventDefault()
    if (!nuevoMotivo) {
      setErrorReagendar("Selecciona el motivo del examen.")
      return
    }
    if (!nuevaFecha || !nuevaHora) {
      setErrorReagendar("Selecciona la nueva fecha y hora.")
      return
    }
    const citaActualizada = { ...reagendando, fecha: nuevaFecha, hora: nuevaHora, motivo: nuevoMotivo, estado: "Pendiente" }
    if (supabase && opticaId) {
      const { error: errorUpdate } = await supabase.from("citas").update({ fecha: nuevaFecha, hora: nuevaHora, motivo: nuevoMotivo, estado: "Pendiente" }).eq("id", reagendando.id)
      if (errorUpdate) {
        setErrorReagendar("No se pudo reagendar la cita. Revisa tu conexión e intenta de nuevo.")
        return
      }
    }
    setCitas(citas.map((c) => (c.id === reagendando.id ? citaActualizada : c)))
    cerrarReagendar()
    setReagendada(citaActualizada)
  }

  // Mismo formato de link (con prefijo +593) que ya usa CRM.jsx para sus avisos por WhatsApp
  const avisarReagendoWhatsApp = (cita) => {
    let numeroLimpio = (cita.telefono || "").replace(/\D/g, "")
    if (numeroLimpio.startsWith("0")) numeroLimpio = "593" + numeroLimpio.substring(1)
    if (!numeroLimpio.startsWith("593") && numeroLimpio.length === 9) numeroLimpio = "593" + numeroLimpio
    const texto = `Hola ${cita.paciente}, te escribimos de ${usuario?.opticaNombre || "tu óptica"} para avisarte que tu cita fue reagendada. Nueva fecha: ${cita.fecha} a las ${cita.hora}. Cualquier duda, contáctanos por aquí.`
    const url = `https://api.whatsapp.com/send?phone=${numeroLimpio}&text=${encodeURIComponent(texto)}`
    window.open(url, "_blank")
  }

  // Filtrado + orden cronológico
  const grupos = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    const filtradas = citas
      .filter((c) => {
        if (texto && !c.paciente.toLowerCase().includes(texto)) return false
        if (filtro === "hoy") return esHoy(c.fecha)
        if (filtro === "proximas") return esFutura(c.fecha)
        if (filtro === "atendidas") return c.estado === "Atendida"
        return true
      })
      .sort((a, b) => {
        if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1
        return minutosDesdeMedianoche(a.hora) - minutosDesdeMedianoche(b.hora)
      })

    const mapa = new Map()
    for (const c of filtradas) {
      if (!mapa.has(c.fecha)) mapa.set(c.fecha, [])
      mapa.get(c.fecha).push(c)
    }
    return Array.from(mapa.entries())
  }, [citas, busqueda, filtro])

  const totalHoy = useMemo(() => citas.filter((c) => esHoy(c.fecha)).length, [citas])
  const totalProximas = useMemo(() => citas.filter((c) => esFutura(c.fecha)).length, [citas])
  const totalAtendidas = useMemo(() => citas.filter((c) => c.estado === "Atendida").length, [citas])

  const tituloDia = (dia) => {
    const objFecha = parseFechaFlexible(dia)
    return {
      etiqueta: etiquetaFecha(dia),
      diaNum: objFecha ? String(objFecha.getDate()).padStart(2, "0") : "--",
      mes: objFecha ? objFecha.toLocaleDateString("es-EC", { month: "short" }).replace(".", "") : "DÍA",
    }
  }

  return (
    <div className="w-full space-y-6 text-left" style={{ animation: "rise-in 320ms ease-out both" }}>
      {/* ─── HEADER ─── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <div className="grid h-12 w-12 place-items-center rounded-2xl text-white" style={{ background: GRAD, boxShadow: "0 12px 24px -10px rgba(37,99,235,0.6)" }}>
            <CalendarDays size={24} />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold tracking-tight" style={{ color: INK }}>Citas médicas</h1>
            <p className="text-sm text-slate-500">Planificación y control de consultas de refracción.</p>
          </div>
        </div>
        <button
          onClick={() => setModalAbierto(true)}
          className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          style={{ background: GRAD, boxShadow: "0 14px 28px -12px rgba(37,99,235,0.6)" }}
        >
          <Plus size={18} />
          Agendar cita
        </button>
      </div>

      {/* ─── KPIs / FILTROS ─── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiBoton icono={CalendarDays} valor={citas.length} etiqueta="Total agendadas" tono="slate" activo={filtro === "todas"} onClick={() => setFiltro("todas")} />
        <KpiBoton icono={Sun} valor={totalHoy} etiqueta="Citas de hoy" tono="blue" activo={filtro === "hoy"} onClick={() => setFiltro("hoy")} />
        <KpiBoton icono={CalendarClock} valor={totalProximas} etiqueta="Próximas (futuras)" tono="amber" activo={filtro === "proximas"} onClick={() => setFiltro("proximas")} />
        <KpiBoton icono={CalendarCheck} valor={totalAtendidas} etiqueta="Ya atendidas" tono="emerald" activo={filtro === "atendidas"} onClick={() => setFiltro("atendidas")} />
      </div>

      {/* ─── ÉXITO ─── */}
      {guardadoExitoso && (
        <div role="status" className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
          <CheckCircle2 className="text-emerald-500" size={20} />
          <p className="text-sm font-semibold">Cita registrada y guardada correctamente.</p>
        </div>
      )}

      {/* ─── ERROR (cancelar / cambiar estado / reagendar) ─── */}
      {bannerError && (
        <div role="alert" className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-900">
          <AlertTriangle className="text-red-500" size={20} />
          <p className="text-sm font-semibold">{bannerError}</p>
        </div>
      )}

      {/* ─── BÚSQUEDA ─── */}
      <div className="flex justify-end">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar paciente por nombre..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />
        </div>
      </div>

      {/* ─── LISTADO ─── */}
      {grupos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-slate-50 text-slate-300">
            <Calendar size={30} />
          </div>
          <p className="mt-4 text-base font-semibold text-slate-600">No hay citas bajo este filtro</p>
          <p className="mt-1 text-sm text-slate-500">
            {busqueda ? "Ningún paciente coincide con la búsqueda." : "Selecciona otra tarjeta o agenda una nueva cita."}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {grupos.map(([dia, citasDia]) => {
            const t = tituloDia(dia)
            const hoyDia = esHoy(dia)
            return (
              <div key={dia} className="flex gap-4">
                {/* Rail de día */}
                <div className="flex w-14 shrink-0 flex-col items-center">
                  <div
                    className="flex w-full flex-col items-center rounded-xl border py-2"
                    style={hoyDia ? { backgroundColor: INK, borderColor: INK, color: "#fff" } : { backgroundColor: "#fff", borderColor: "rgba(14,43,51,0.1)", color: "#334155" }}
                  >
                    <span className="text-lg font-bold leading-none">{t.diaNum}</span>
                    <span className={"mt-0.5 text-[10px] font-semibold uppercase " + (hoyDia ? "text-white/60" : "text-slate-500")}>{t.mes}</span>
                  </div>
                  <div className="mt-2 w-px flex-1" style={{ backgroundColor: "rgba(14,43,51,0.1)" }} />
                </div>

                {/* Citas del día */}
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => alternarDia(dia)}
                    className="mb-3 flex w-full items-center gap-2 text-left cursor-pointer"
                    title={diasColapsados.has(dia) ? "Expandir este día" : "Colapsar este día"}
                  >
                    <ChevronDown size={15} className={"shrink-0 text-slate-500 transition-transform " + (diasColapsados.has(dia) ? "-rotate-90" : "")} />
                    <h4 className="text-sm font-bold capitalize" style={{ color: INK }}>{t.etiqueta}</h4>
                    {hoyDia && <span className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ background: GRAD }}>Hoy</span>}
                    <span className="text-xs text-slate-500">· {citasDia.length} {citasDia.length === 1 ? "cita" : "citas"}</span>
                  </button>

                  {!diasColapsados.has(dia) && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {citasDia.map((cita) => {
                      const info = motivoInfo(cita.motivo, motivosConsulta)
                      const resuelta = cita.estado === "Atendida" || cita.estado === "No Asistió"
                      // Sólo se puede marcar el desenlace de una cita que ya debió ocurrir —
                      // no tiene sentido registrar "atendida"/"no asistió" para el futuro.
                      const puedeMarcarse = !esFutura(cita.fecha) && !resuelta
                      return (
                        <div
                          key={cita.id}
                          className={"relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md " + (resuelta ? "border-slate-100 opacity-80" : cita.estado === "En Atención" ? "border-blue-300 ring-2 ring-blue-100" : "border-slate-200 hover:border-blue-200")}
                        >
                          <span className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: info.punto }} aria-hidden="true" />

                          <div className="p-5 pl-6">
                            <div className="mb-4 flex items-start justify-between gap-2">
                              <span className={"rounded-md border px-2.5 py-1 text-xs font-semibold " + info.badge}>{cita.motivo}</span>
                              <div className="flex items-center gap-1">
                                {puedeMarcarse && (
                                  <div className="relative" ref={menuEstadoId === cita.id ? menuEstadoRef : null}>
                                    <button
                                      type="button"
                                      onClick={() => setMenuEstadoId((prev) => (prev === cita.id ? null : cita.id))}
                                      className={"rounded-md p-1.5 transition cursor-pointer " + (menuEstadoId === cita.id ? "bg-slate-100 text-slate-700" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700")}
                                      title="Cambiar estado de la cita"
                                    >
                                      <Activity size={16} />
                                    </button>
                                    {menuEstadoId === cita.id && (
                                      <div className="absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 text-left shadow-xl">
                                        {cita.estado !== "En Atención" && (
                                          <button
                                            type="button"
                                            onClick={() => { setMenuEstadoId(null); marcarEstado(cita.id, "En Atención") }}
                                            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 cursor-pointer"
                                          >
                                            <Activity size={15} /> Paciente en atención
                                          </button>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => { setMenuEstadoId(null); marcarEstado(cita.id, "Atendida") }}
                                          className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-emerald-600 transition-colors hover:bg-emerald-50 cursor-pointer"
                                        >
                                          <CheckCircle2 size={15} /> Marcar atendida
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => { setMenuEstadoId(null); marcarEstado(cita.id, "No Asistió") }}
                                          className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 cursor-pointer"
                                        >
                                          <UserX size={15} /> No asistió
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {!resuelta && (
                                  <button type="button" onClick={() => abrirReagendar(cita)} className="rounded-md p-1.5 text-slate-500 transition hover:bg-blue-50 hover:text-blue-600 cursor-pointer" title="Editar cita (motivo, fecha u hora)">
                                    <CalendarClock size={16} />
                                  </button>
                                )}
                                <button type="button" onClick={() => setPorCancelar(cita.id)} className="rounded-md p-1.5 text-slate-500 transition hover:bg-red-50 hover:text-red-500 cursor-pointer" title="Cancelar cita">
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: GRAD }}>
                                {cita.iniciales || <User size={16} />}
                              </div>
                              <div className="min-w-0">
                                <span className="block truncate text-base font-semibold text-slate-800">{cita.paciente}</span>
                                {cita.motivoPublico && (
                                  <span className="block truncate text-xs text-slate-500" title={cita.motivoPublico}>Agendada en línea: {cita.motivoPublico}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 pl-6">
                            <div className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
                              <Clock size={14} className="text-slate-500" />
                              <span>{cita.hora}</span>
                            </div>
                            {cita.estado === "Atendida" ? (
                              <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                                <CheckCircle2 size={12} /> Atendida
                              </span>
                            ) : cita.estado === "No Asistió" ? (
                              <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
                                <UserX size={12} /> No asistió
                              </span>
                            ) : cita.estado === "En Atención" ? (
                              <span className="flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600">
                                <Activity size={12} /> En atención
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Pendiente
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ─── MODAL AGENDAR ─── */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)" }} onClick={cerrarModal}>
          <div className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: GRAD }}>
                  <Stethoscope size={20} />
                </div>
                <h4 className="text-lg font-bold" style={{ color: INK }}>Agendar cita</h4>
              </div>
              <button type="button" onClick={cerrarModal} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={validarYPedirConfirmacion} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                {error && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                    <AlertTriangle size={16} />
                    {error}
                  </div>
                )}

                {pacientes.length === 0 ? (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-800">
                    <AlertTriangle size={16} />
                    Aún no hay pacientes registrados. Crea uno primero en el módulo Pacientes.
                  </div>
                ) : (
                  <div className="relative" ref={dropdownRef}>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Paciente</label>
                    <div className="relative">
                      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        value={busquedaPaciente}
                        onFocus={() => setMostrarDropdown(true)}
                        onChange={(e) => { setBusquedaPaciente(e.target.value); setPacienteId(null); setMostrarDropdown(true) }}
                        placeholder="Escriba para buscar por nombre o cédula..."
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
                      />
                    </div>
                    {mostrarDropdown && pacientesFiltrados.length > 0 && (
                      <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                        {pacientesFiltrados.map((p) => (
                          <li
                            key={p.id}
                            onClick={() => seleccionarPaciente(p)}
                            className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                          >
                            <span className="font-semibold">{p.nombre}</span>
                            {p.cedula && <span className="font-mono text-xs text-slate-500">{p.cedula}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Motivo del examen</label>
                  <select
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
                  >
                    <option value="" disabled>Seleccione el motivo del examen</option>
                    {motivosConsulta.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <SelectorFechaHora
                  disponibilidad={disponibilidad}
                  citas={citas}
                  fecha={fecha}
                  hora={hora}
                  onCambiarFecha={setFecha}
                  onCambiarHora={setHora}
                />
              </div>

              <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-5 py-4">
                <button type="button" onClick={cerrarModal} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 cursor-pointer" style={{ background: GRAD, boxShadow: "0 12px 24px -12px rgba(37,99,235,0.6)" }}>
                  Confirmar cita
                  <ChevronRight size={16} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── CONFIRMACIÓN DE AGENDAMIENTO ─── */}
      {confirmando && (
        <ConfirmarCitaModal
          paciente={pacienteSeleccionado?.nombre}
          motivo={motivo}
          fecha={fecha ? isoAFechaLocal(fecha).toLocaleDateString("es-EC", { day: "numeric", month: "long", year: "numeric" }) : ""}
          hora={hora}
          onCancelar={() => setConfirmando(false)}
          onConfirmar={agendarCita}
        />
      )}

      {/* ─── MODAL CANCELAR ─── */}
      {porCancelar != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)" }} onClick={() => setPorCancelar(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-red-50">
              <AlertTriangle size={24} className="text-red-500" />
            </div>
            <h4 className="text-center text-lg font-bold" style={{ color: INK }}>¿Cancelar esta cita?</h4>
            <p className="mt-1.5 text-center text-sm text-slate-500">Esta acción quitará la cita de la agenda y no se puede deshacer.</p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setPorCancelar(null)} className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer">
                Volver
              </button>
              <button type="button" onClick={confirmarCancelacion} className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 cursor-pointer">
                Sí, cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL REAGENDAR ─── */}
      {reagendando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)" }} onClick={cerrarReagendar}>
          <div className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: GRAD }}>
                  <CalendarClock size={20} />
                </div>
                <div>
                  <h4 className="text-lg font-bold" style={{ color: INK }}>Editar cita</h4>
                  <p className="text-xs text-slate-500">{reagendando.paciente}</p>
                </div>
              </div>
              <button type="button" onClick={cerrarReagendar} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={confirmarReagendar} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                {errorReagendar && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                    <AlertTriangle size={16} />
                    {errorReagendar}
                  </div>
                )}

                <p className="rounded-lg bg-slate-50 p-2.5 text-center text-sm text-slate-600">
                  Horario actual: <span className="font-mono font-bold text-slate-800">{reagendando.fecha ? etiquetaFecha(reagendando.fecha) : "Sin fecha"} · {reagendando.hora}</span>
                </p>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Motivo del examen</label>
                  <select
                    value={nuevoMotivo}
                    onChange={(e) => setNuevoMotivo(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
                  >
                    <option value="" disabled>Seleccione el motivo del examen</option>
                    {motivosConsulta.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <SelectorFechaHora
                  disponibilidad={disponibilidad}
                  citas={citas.filter((c) => c.id !== reagendando.id)}
                  fecha={nuevaFecha}
                  hora={nuevaHora}
                  onCambiarFecha={setNuevaFecha}
                  onCambiarHora={setNuevaHora}
                />
              </div>

              <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-5 py-4">
                <button type="button" onClick={cerrarReagendar} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 cursor-pointer" style={{ background: GRAD, boxShadow: "0 12px 24px -12px rgba(37,99,235,0.6)" }}>
                  Guardar cambios
                  <ChevronRight size={16} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── CITA REAGENDADA: ofrecer avisar al paciente ─── */}
      {reagendada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)" }} onClick={() => setReagendada(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-emerald-50">
              <CheckCircle2 size={24} className="text-emerald-600" />
            </div>
            <h4 className="text-center text-lg font-bold" style={{ color: INK }}>Cita reagendada</h4>
            <p className="mt-1.5 text-center text-sm text-slate-500">
              {reagendada.paciente} ahora tiene su cita el <span className="font-semibold text-slate-700">{etiquetaFecha(reagendada.fecha)} a las {reagendada.hora}</span>. Ya se actualizó en su portal — ¿quieres avisarle también por WhatsApp?
            </p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setReagendada(null)} className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer">
                Ahora no
              </button>
              <button
                type="button"
                onClick={() => { avisarReagendoWhatsApp(reagendada); setReagendada(null) }}
                disabled={!reagendada.telefono}
                title={reagendada.telefono ? "Enviar por WhatsApp" : "Sin número registrado"}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <MessageCircle size={15} /> Avisar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}