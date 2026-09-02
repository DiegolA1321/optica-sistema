"use client"

import React, { useState, useMemo, useEffect, useRef } from "react"
import {
  LayoutDashboard,
  Calendar,
  Clock,
  Plus,
  User,
  CheckCircle2,
  AlertCircle,
  FileText,
  LogOut,
  Stethoscope,
  ChevronRight,
  ChevronDown,
  X,
  CalendarDays,
  CalendarClock,
  Glasses,
  KeyRound,
  Lock,
  Printer,
  Menu,
  Phone,
  Mail,
  Cake,
  IdCard,
  ChevronsLeft,
  ChevronsRight,
  Activity,
  Download,
  ShieldAlert,
  Loader2,
} from "lucide-react"
import SelectorFechaHora from "../componentes/SelectorFechaHora"
import ConfirmarCitaModal from "../componentes/ConfirmarCitaModal"
import { isoAFechaLocal, minutosDesdeMedianoche, etiquetaFecha } from "../utilidades/disponibilidad"
import { supabase } from "../lib/supabaseClient"

// ─── Paleta de firma (consistente con todo el sistema) ───
const INK = "#0E2B33"
const GOLD = "#C8A24E"
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)"
const OD_COLOR = "#2563EB"
const OI_COLOR = "#06b6d4"

const OPCIONES = [
  { id: "resumen", nombre: "Resumen", icono: LayoutDashboard },
  { id: "citas", nombre: "Mis citas", icono: Calendar },
  { id: "receta", nombre: "Mi receta", icono: Glasses },
  { id: "perfil", nombre: "Mi perfil", icono: User },
]

export default function PortalPaciente({ usuario, citas = [], setCitas, consultas = [], disponibilidad, opticaId, opticaPublica, parametrizacion, motivosConsulta = [], onCerrarSesion }) {
  const nombreOptica = opticaPublica?.marca?.nombreMarca || opticaPublica?.nombre || "tu óptica"
  // Política de la óptica (configurable en Configuración > Políticas hacia el paciente)
  const mostrarMedidas = parametrizacion?.mostrarMedidasPaciente === true
  const [seccion, setSeccion] = useState("resumen")
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [colapsado, setColapsado] = useState(false)
  const [userMenu, setUserMenu] = useState(false)
  const userRef = useRef(null)

  // Agendar
  const [modalAgendar, setModalAgendar] = useState(false)
  const [fecha, setFecha] = useState("")
  const [hora, setHora] = useState("")
  const [motivo, setMotivo] = useState(motivosConsulta[0] || "")
  const [exito, setExito] = useState(false)
  const [error, setError] = useState("")
  const [confirmandoCita, setConfirmandoCita] = useState(false)
  const [guardandoCita, setGuardandoCita] = useState(false)
  const [errorCita, setErrorCita] = useState("")

  // Reagendar — solo si el admin lo habilitó en Configuración, y solo dentro
  // de la ventana de anticipación que él mismo define (feedback del ing).
  const [reagendando, setReagendando] = useState(null)
  const [fechaReagenda, setFechaReagenda] = useState(null)
  const [horaReagenda, setHoraReagenda] = useState("")
  const [guardandoReagenda, setGuardandoReagenda] = useState(false)
  const [errorReagenda, setErrorReagenda] = useState("")

  const horasAntesPermitidas = parametrizacion?.horasAntesReagendar ?? 2
  const puedeReagendar = (cita) => {
    if (!parametrizacion?.permitirReagendarPaciente) return false
    if (cita.estado !== "Pendiente") return false
    const fechaHora = new Date(`${cita.fecha}T${(cita.hora || "00:00").padStart(5, "0")}:00`)
    if (isNaN(fechaHora.getTime())) return false
    const horasRestantes = (fechaHora.getTime() - Date.now()) / 3600000
    return horasRestantes >= horasAntesPermitidas
  }
  const abrirReagendar = (cita) => {
    setReagendando(cita)
    setFechaReagenda(null)
    setHoraReagenda("")
    setErrorReagenda("")
  }

  // Cancelar — misma ventana de anticipación y permiso que reagendar (feedback
  // de Diego: "el paciente podía cambiar el horario de la cita o hasta
  // cancelarla hasta con 2 horas de anticipación").
  const [cancelando, setCancelando] = useState(null)
  const [guardandoCancelar, setGuardandoCancelar] = useState(false)
  const [errorCancelar, setErrorCancelar] = useState("")
  const confirmarCancelar = async () => {
    if (!cancelando) return
    setGuardandoCancelar(true)
    setErrorCancelar("")
    if (supabase && opticaId) {
      const { data, error: errorRpc } = await supabase.rpc("cancelar_cita_publica", {
        p_cita_id: cancelando.id,
        p_paciente_id: typeof usuario?.id === "string" ? usuario.id : null,
        p_token: usuario?.token,
      })
      if (errorRpc || data !== true) {
        setGuardandoCancelar(false)
        setErrorCancelar("No pudimos cancelar tu cita. Intenta de nuevo en un momento.")
        return
      }
    }
    setCitas(citas.map((c) => (c.id === cancelando.id ? { ...c, estado: "Cancelada" } : c)))
    setGuardandoCancelar(false)
    setCancelando(null)
  }
  // Privacidad y datos — exportar (autoservicio, sin riesgo) y solicitar
  // eliminación (deja una solicitud para que la óptica la resuelva, ver
  // migración 0045: un historial clínico puede tener obligaciones de
  // retención que el propio paciente no puede saltarse borrando solo).
  const [exportando, setExportando] = useState(false)
  const [modalEliminarAbierto, setModalEliminarAbierto] = useState(false)
  const [motivoEliminar, setMotivoEliminar] = useState("")
  const [enviandoEliminar, setEnviandoEliminar] = useState(false)
  const [solicitudEliminarEnviada, setSolicitudEliminarEnviada] = useState(false)
  const [errorPrivacidad, setErrorPrivacidad] = useState("")

  const exportarMisDatos = async () => {
    if (!supabase || exportando) return
    setExportando(true)
    setErrorPrivacidad("")
    const { data, error } = await supabase.rpc("exportar_mis_datos_paciente", {
      p_paciente_id: typeof usuario?.id === "string" ? usuario.id : null,
      p_token: usuario?.token,
    })
    setExportando(false)
    if (error || !data) { setErrorPrivacidad("No pudimos exportar tus datos. Intenta de nuevo."); return }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `mis-datos-${nombreOptica.toLowerCase().replace(/\s+/g, "-")}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const confirmarSolicitudEliminar = async () => {
    if (!supabase || enviandoEliminar) return
    setEnviandoEliminar(true)
    setErrorPrivacidad("")
    const { data, error } = await supabase.rpc("solicitar_eliminacion_paciente", {
      p_paciente_id: typeof usuario?.id === "string" ? usuario.id : null,
      p_token: usuario?.token,
      p_motivo: motivoEliminar.trim() || null,
    })
    setEnviandoEliminar(false)
    if (error || !data) { setErrorPrivacidad("No pudimos enviar tu solicitud. Intenta de nuevo."); return }
    setSolicitudEliminarEnviada(true)
  }

  const confirmarReagenda = async () => {
    if (!fechaReagenda || !horaReagenda) { setErrorReagenda("Selecciona fecha y hora."); return }
    setGuardandoReagenda(true)
    setErrorReagenda("")
    if (supabase && opticaId) {
      const { data, error: errorRpc } = await supabase.rpc("reagendar_cita_publica", {
        p_cita_id: reagendando.id,
        p_paciente_id: typeof usuario?.id === "string" ? usuario.id : null,
        p_fecha: fechaReagenda,
        p_hora: horaReagenda,
        p_token: usuario?.token,
      })
      if (errorRpc || data !== true) {
        setGuardandoReagenda(false)
        setErrorReagenda("No pudimos reagendar tu cita. Intenta de nuevo en un momento.")
        return
      }
    }
    setCitas(citas.map((c) => (c.id === reagendando.id ? { ...c, fecha: fechaReagenda, hora: horaReagenda, estado: "Pendiente" } : c)))
    setGuardandoReagenda(false)
    setReagendando(null)
  }

  // Contraseña
  const [modalClave, setModalClave] = useState(false)
  const [claveActual, setClaveActual] = useState("")
  const [nuevaClave, setNuevaClave] = useState("")
  const [confirmarClave, setConfirmarClave] = useState("")
  const [errorClave, setErrorClave] = useState("")
  const [guardandoClave, setGuardandoClave] = useState(false)

  useEffect(() => {
    const onDown = (e) => { if (userRef.current && !userRef.current.contains(e.target)) setUserMenu(false) }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [])

  // Recetas del paciente
  const misConsultas = useMemo(
    () =>
      consultas
        .filter((c) => (usuario?.id != null && c.pacienteId === usuario.id) || c.paciente === usuario?.nombre)
        .sort((a, b) => (a.fecha < b.fecha ? 1 : -1)),
    [consultas, usuario],
  )
  const ultimaReceta = misConsultas[0] || null
  const [medidasSolicitadas, setMedidasSolicitadas] = useState(false)

  const misCitas = useMemo(() => {
    if (!usuario?.id && !usuario?.cedula) return citas
    return citas.filter((c) => c.pacienteId === usuario.id || c.cedula === usuario.cedula || c.paciente === usuario.nombre)
  }, [citas, usuario])

  // Ordenadas por fecha+hora — antes "próxima cita" tomaba la primera que
  // encontraba en el array, no la cronológicamente más cercana.
  const citasPendientes = useMemo(
    () =>
      misCitas
        .filter((c) => c.estado !== "Atendida" && c.estado !== "No Asistió" && c.estado !== "Cancelada")
        .sort((a, b) => (a.fecha !== b.fecha ? (a.fecha < b.fecha ? -1 : 1) : minutosDesdeMedianoche(a.hora) - minutosDesdeMedianoche(b.hora))),
    [misCitas],
  )
  const citasPasadas = useMemo(
    () =>
      misCitas
        .filter((c) => c.estado === "Atendida" || c.estado === "No Asistió" || c.estado === "Cancelada")
        .sort((a, b) => (a.fecha !== b.fecha ? (a.fecha > b.fecha ? -1 : 1) : minutosDesdeMedianoche(b.hora) - minutosDesdeMedianoche(a.hora))),
    [misCitas],
  )
  const proximaCita = citasPendientes[0] || null

  const validarYPedirConfirmacion = (e) => {
    e.preventDefault()
    if (!fecha || !hora) { setError("Por favor selecciona fecha y hora."); return }
    setError("")
    setConfirmandoCita(true)
  }

  const handleAgendar = async () => {
    const nuevaCita = {
      pacienteId: usuario?.id,
      paciente: usuario?.nombre || "Paciente Registrado",
      cedula: usuario?.cedula || "",
      telefono: usuario?.telefono || "",
      fecha, hora, motivo, estado: "Pendiente",
    }

    setErrorCita("")
    setGuardandoCita(true)
    if (supabase && opticaId) {
      const { data, error: errorRpc } = await supabase.rpc("crear_cita_publica", {
        p_optica_id: opticaId,
        p_paciente: nuevaCita.paciente,
        p_fecha: nuevaCita.fecha,
        p_hora: nuevaCita.hora,
        p_paciente_id: typeof usuario?.id === "string" ? usuario.id : null,
        p_cedula: nuevaCita.cedula || null,
        p_telefono: nuevaCita.telefono || null,
        p_motivo: nuevaCita.motivo,
      })
      if (errorRpc) {
        setGuardandoCita(false)
        setErrorCita("No pudimos guardar tu cita. Intenta de nuevo en un momento.")
        return
      }
      nuevaCita.id = data
    } else {
      nuevaCita.id = Date.now()
    }

    setCitas([nuevaCita, ...citas])
    setGuardandoCita(false)
    setConfirmandoCita(false)
    setModalAgendar(false); setFecha(""); setHora(""); setMotivo(motivosConsulta[0] || ""); setError("")
    setExito(true); setTimeout(() => setExito(false), 4000)
  }

  const handleCambiarClave = async (e) => {
    e.preventDefault()
    if (!claveActual) { setErrorClave("Ingresa tu contraseña actual."); return }
    if (nuevaClave.length < 6) { setErrorClave("La nueva contraseña debe tener al menos 6 caracteres."); return }
    if (nuevaClave === usuario?.cedula) { setErrorClave("La nueva contraseña no puede ser tu número de cédula."); return }
    if (nuevaClave !== confirmarClave) { setErrorClave("Las contraseñas no coinciden."); return }

    // Ciberseguridad: el RPC ahora exige y verifica la contraseña actual
    // server-side (crypt()) antes de aceptar la nueva — antes bastaba con
    // conocer el id del paciente, sin probar que quien llama es dueño de la
    // cuenta. También repite ahí la política de contraseña (longitud,
    // distinta de la cédula) por si alguien salta esta validación de cliente
    // llamando al RPC directo.
    setGuardandoClave(true)
    if (supabase) {
      const { data: mensajeError, error } = await supabase.rpc("cambiar_clave_paciente", {
        p_paciente_id: usuario?.id,
        p_clave_actual: claveActual,
        p_clave_nueva: nuevaClave,
      })
      if (error || mensajeError) {
        setGuardandoClave(false)
        setErrorClave(mensajeError || "No pudimos guardar tu nueva contraseña. Intenta de nuevo en un momento.")
        return
      }
    }
    // El RPC invalida el token de sesión actual al cambiar la clave (fuerza
    // a re-loguearse en todos los dispositivos) — así que este también deja
    // de ser válido: no tiene sentido quedarse en el portal con un token
    // muerto, mejor cerrar sesión ya mismo y que vuelva a entrar con la
    // contraseña nueva.
    setGuardandoClave(false)
    setModalClave(false); setClaveActual(""); setNuevaClave(""); setConfirmarClave(""); setErrorClave("")
    onCerrarSesion("Contraseña actualizada. Vuelve a iniciar sesión con tu nueva contraseña.")
  }

  const navegar = (id) => { setSeccion(id); setMenuAbierto(false) }
  const primerNombre = usuario?.nombre?.split(" ")[0] || "Paciente"
  const hora24 = new Date().getHours()
  const saludo = hora24 < 12 ? "Buenos días" : hora24 < 19 ? "Buenas tardes" : "Buenas noches"
  const hoyFecha = new Date().toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })

  return (
    <div className="flex h-screen font-sans text-slate-800" style={{ backgroundColor: "#F7F5F0" }}>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #receta-paciente, #receta-paciente * { visibility: visible; }
          #receta-paciente { position: absolute; left: 0; top: 0; width: 100%; border: none !important; box-shadow: none !important; }
          .no-print { display: none !important; }
        }
      `}</style>

      {menuAbierto && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMenuAbierto(false)} />}

      {/* ─── SIDEBAR ─── */}
      <aside
        className={"fixed inset-y-0 left-0 z-50 flex w-72 flex-col justify-between overflow-hidden transition-all duration-300 lg:static lg:translate-x-0 " + (colapsado ? "lg:w-20 " : "lg:w-72 ") + (menuAbierto ? "translate-x-0" : "-translate-x-full")}
        style={{ backgroundColor: INK }}
      >
        <svg aria-hidden="true" className="pointer-events-none absolute -bottom-20 -right-20 h-80 w-80" viewBox="0 0 400 400" fill="none" stroke="#ffffff" style={{ opacity: 0.05 }}>
          {[70, 130, 190].map((r) => (<circle key={r} cx="200" cy="200" r={r} strokeWidth="1.4" />))}
        </svg>

        <div className="relative z-10 flex-1 overflow-y-auto">
          <div className={"flex items-center justify-between border-b border-white/10 px-6 py-5 " + (colapsado ? "lg:justify-center lg:px-0" : "")}>
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white" style={{ background: GRAD, boxShadow: "0 10px 24px -8px rgba(34,211,238,0.6)" }}>
                <Glasses size={22} />
              </div>
              <div className={"leading-tight " + (colapsado ? "lg:hidden" : "")}>
                <p className="text-lg font-bold tracking-tight text-white">Diego <span style={{ color: "#22D3EE" }}>Óptica</span></p>
                <p className="text-[11px] font-medium tracking-wide text-white/40">PORTAL DEL PACIENTE</p>
              </div>
            </div>
            <button type="button" onClick={() => setMenuAbierto(false)} aria-label="Cerrar menú" className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white lg:hidden cursor-pointer"><X size={20} /></button>
          </div>

          <nav className="space-y-1.5 px-4 py-6">
            <p className={"mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-white/30 " + (colapsado ? "lg:hidden" : "")}>Mi cuenta</p>
            {OPCIONES.map((o) => {
              const Icono = o.icono
              const activo = seccion === o.id
              return (
                <button key={o.id} type="button" onClick={() => navegar(o.id)}
                  title={colapsado ? o.nombre : undefined}
                  aria-label={o.nombre}
                  className={"group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all cursor-pointer " + (colapsado ? "lg:justify-center lg:px-0 " : "") + (activo ? "text-white" : "text-white/55 hover:bg-white/5 hover:text-white")}
                  style={activo ? { background: GRAD, boxShadow: "0 12px 24px -12px rgba(34,211,238,0.55)" } : undefined}>
                  <Icono size={20} className={activo ? "text-white" : "text-white/55 group-hover:text-white"} />
                  <span className={colapsado ? "lg:hidden" : ""}>{o.nombre}</span>
                  {activo && <span className={"ml-auto h-1.5 w-1.5 rounded-full bg-white/80 " + (colapsado ? "lg:hidden" : "")} />}
                </button>
              )
            })}
          </nav>
        </div>

        <div className="relative z-10 border-t border-white/10 p-4">
          {proximaCita ? (
            <div className={"rounded-xl bg-white/5 p-3 " + (colapsado ? "lg:flex lg:justify-center lg:bg-transparent lg:p-0" : "")}>
              <div className={"flex items-center gap-2 " + (colapsado ? "lg:hidden" : "")}>
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: GOLD }}>Próxima cita</span>
              </div>
              <p className={"mt-1 flex items-center gap-2 text-sm font-semibold text-white " + (colapsado ? "lg:hidden" : "")}>
                <Calendar size={14} style={{ color: "#22D3EE" }} /> {etiquetaFecha(proximaCita.fecha)} · {proximaCita.hora}
              </p>
              <span className="hidden lg:hidden" />
              {colapsado && <Calendar size={18} className="hidden text-white/60 lg:block" />}
            </div>
          ) : (
            <div className={"flex items-center gap-2 px-2 text-[11px] font-medium text-white/40 " + (colapsado ? "lg:justify-center lg:px-0" : "")}>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span className={colapsado ? "lg:hidden" : ""}>Portal seguro</span>
            </div>
          )}
        </div>
      </aside>

      {/* ─── CONTENIDO ─── */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Barra superior */}
        <header className="relative z-30 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur-md sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setMenuAbierto(true)} aria-label="Abrir menú" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden cursor-pointer"><Menu size={22} /></button>
            <button type="button" onClick={() => setColapsado((v) => !v)} className="hidden rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 lg:inline-flex cursor-pointer" title={colapsado ? "Expandir menú" : "Colapsar menú"} aria-label={colapsado ? "Expandir menú" : "Colapsar menú"}>
              {colapsado ? <ChevronsRight size={20} /> : <ChevronsLeft size={20} />}
            </button>
            <div className="min-w-0">
              <p className="truncate text-base font-bold tracking-tight" style={{ color: INK }}>{saludo}, {primerNombre}</p>
              <p className="truncate text-xs capitalize text-slate-500">{hoyFecha}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setModalAgendar(true)}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 cursor-pointer sm:px-4"
              style={{ background: GRAD, boxShadow: "0 12px 24px -12px rgba(34,211,238,0.6)" }}
            >
              <Plus size={18} />
              <span className="hidden sm:inline">Pedir cita</span>
            </button>

            <div className="relative" ref={userRef}>
              <button type="button" onClick={() => setUserMenu((v) => !v)} className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white py-1.5 pl-1.5 pr-2.5 transition-colors hover:bg-slate-50 cursor-pointer">
                <div className="grid h-7 w-7 place-items-center rounded-lg text-xs font-bold text-white" style={{ background: GRAD }}>{primerNombre[0]?.toUpperCase()}</div>
                <div className="hidden text-left leading-tight sm:block">
                  <p className="text-sm font-semibold" style={{ color: INK }}>{primerNombre}</p>
                  <p className="text-[10px] text-slate-500">Paciente</p>
                </div>
                <ChevronDown size={16} className={"text-slate-500 transition-transform " + (userMenu ? "rotate-180" : "")} />
              </button>

              {userMenu && (
                <div className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                  <div className="border-b border-slate-100 p-3">
                    <p className="truncate text-sm font-bold" style={{ color: INK }}>{usuario?.nombre || "Paciente"}</p>
                    <p className="truncate text-xs text-slate-500">{usuario?.correo || usuario?.cedula || ""}</p>
                  </div>
                  <div className="p-2">
                    <button type="button" onClick={() => { setUserMenu(false); setClaveActual(""); setNuevaClave(""); setConfirmarClave(""); setErrorClave(""); setModalClave(true) }} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">
                      <KeyRound size={16} /> Cambiar contraseña
                    </button>
                    {onCerrarSesion && (
                      <button type="button" onClick={() => onCerrarSesion()} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 cursor-pointer">
                        <LogOut size={16} /> Cerrar sesión
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Espacio de trabajo */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {/* Alertas */}
          {exito && (
            <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900">
              <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={20} />
              <div>
                <p className="text-sm font-semibold">Tu cita ha sido agendada con éxito. ¡Te esperamos!</p>
                {parametrizacion?.permitirReagendarPaciente && (
                  <p className="mt-0.5 text-xs text-emerald-800">
                    Puedes cambiar el horario o cancelarla hasta con {horasAntesPermitidas} hora{horasAntesPermitidas === 1 ? "" : "s"} de anticipación, desde "Mis citas".
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ── RESUMEN ── */}
          {seccion === "resumen" && (
            <div className="space-y-6">
              <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="pointer-events-none absolute -right-8 -top-8 h-48 w-48 rounded-full blur-3xl" style={{ background: "radial-gradient(circle, rgba(34,211,238,0.14), transparent 70%)" }} />
                <span className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: GOLD }} /> Portal del paciente
                </span>
                <h1 className="mt-2 font-serif text-2xl font-bold tracking-tight sm:text-3xl" style={{ color: INK }}>¡Hola, {primerNombre}!</h1>
                <p className="mt-1 max-w-xl text-sm text-slate-500">
                  {proximaCita
                    ? (() => {
                        const et = etiquetaFecha(proximaCita.fecha)
                        const dia = ["Hoy", "Mañana", "Ayer"].includes(et) ? et : `el ${et}`
                        return `Tu próxima cita es ${dia} a las ${proximaCita.hora}.`
                      })()
                    : "No tienes citas pendientes. ¿Quieres agendar una?"}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TarjetaResumen label="Próxima visita" valor={proximaCita ? etiquetaFecha(proximaCita.fecha) : "Sin citas"} sub={proximaCita ? proximaCita.hora : "Agenda una cita"} icon={Clock} tile={GRAD} tileText="#fff" />
                <TarjetaResumen label="Total de citas" valor={String(misCitas.length)} sub={misCitas.length === 1 ? "cita" : "citas"} icon={CalendarDays} tile="#eef2ff" tileText="#2563eb" />
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-base font-bold" style={{ color: INK }}>Próximas citas</h2>
                    <button onClick={() => setSeccion("citas")} className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">Ver todas <ChevronRight size={14} /></button>
                  </div>
                  {citasPendientes.length === 0 ? (
                    <p className="py-6 text-center text-sm text-slate-500">No tienes citas pendientes.</p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {citasPendientes.slice(0, 3).map((c) => <FilaCita key={c.id} cita={c} puedeReagendar={puedeReagendar} onReagendar={abrirReagendar} onCancelar={setCancelando} />)}
                    </div>
                  )}
                </div>

                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-base font-bold" style={{ color: INK }}>Mi última receta</h2>
                    <button onClick={() => setSeccion("receta")} className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">Ver receta <ChevronRight size={14} /></button>
                  </div>
                  {!ultimaReceta ? (
                    <p className="py-6 text-center text-sm text-slate-500">Aún no tienes una receta registrada.</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <OjoReceta sigla="OD" titulo="Ojo derecho" ojo={ultimaReceta.od} color={OD_COLOR} mostrarMedidas={mostrarMedidas} />
                      <OjoReceta sigla="OI" titulo="Ojo izquierdo" ojo={ultimaReceta.oi} color={OI_COLOR} mostrarMedidas={mostrarMedidas} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── MIS CITAS ── */}
          {seccion === "citas" && (
            <div className="space-y-6">
              <div>
                <h1 className="font-serif text-2xl font-bold tracking-tight" style={{ color: INK }}>Mis citas</h1>
                <p className="text-sm text-slate-500">Consulta tus citas y agenda nuevas desde el botón "Pedir cita".</p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Pendientes</h2>
                {citasPendientes.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center">
                    <p className="text-sm font-medium text-slate-500">No tienes citas pendientes.</p>
                    <button onClick={() => setModalAgendar(true)} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline cursor-pointer">Agendar ahora <ChevronRight size={15} /></button>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">{citasPendientes.map((c) => <FilaCita key={c.id} cita={c} puedeReagendar={puedeReagendar} onReagendar={abrirReagendar} onCancelar={setCancelando} />)}</div>
                )}
              </div>

              {citasPasadas.length > 0 && (
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Historial</h2>
                  <div className="divide-y divide-slate-100">{citasPasadas.map((c) => <FilaCita key={c.id} cita={c} />)}</div>
                </div>
              )}
            </div>
          )}

          {/* ── MI RECETA ── */}
          {seccion === "receta" && (
            <div className="space-y-6">
              <div>
                <h1 className="font-serif text-2xl font-bold tracking-tight" style={{ color: INK }}>Mi receta visual</h1>
                <p className="text-sm text-slate-500">Tu graduación actual y tratamientos indicados.</p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm" id="receta-paciente">
                <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-xl text-white" style={{ background: GRAD }}><Glasses size={18} /></div>
                    <div>
                      <h2 className="text-base font-bold" style={{ color: INK }}>Receta óptica</h2>
                      <p className="text-xs text-slate-500">{ultimaReceta ? `Última actualización · ${etiquetaFecha(ultimaReceta.fecha)}` : "Se genera tras tu consulta"}</p>
                    </div>
                  </div>
                  {ultimaReceta && (
                    <button onClick={() => window.print()} className="no-print flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer"><Printer size={14} /> Imprimir</button>
                  )}
                </div>

                {!ultimaReceta ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <div className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-300"><FileText size={24} /></div>
                    <p className="text-sm font-medium text-slate-500">Todavía no tienes una receta registrada.</p>
                    <p className="text-xs text-slate-500">Aparecerá aquí después de tu primer examen visual.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <OjoReceta sigla="OD" titulo="Ojo derecho" ojo={ultimaReceta.od} color={OD_COLOR} mostrarMedidas={mostrarMedidas} />
                      <OjoReceta sigla="OI" titulo="Ojo izquierdo" ojo={ultimaReceta.oi} color={OI_COLOR} mostrarMedidas={mostrarMedidas} />
                    </div>
                    {!mostrarMedidas && (
                      <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-3.5 sm:flex-row sm:items-center">
                        <p className="flex-1 text-xs leading-relaxed text-slate-500">
                          Por política de tu óptica, las medidas exactas de tu receta no se muestran en el portal. Si las necesitas para otro proveedor, puedes solicitarlas — tienen un costo adicional por la toma y entrega del examen.
                        </p>
                        {medidasSolicitadas ? (
                          <span className="flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700"><CheckCircle2 size={14} /> Solicitud enviada</span>
                        ) : (
                          <button type="button" onClick={() => setMedidasSolicitadas(true)} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer">
                            <Lock size={14} /> Solicitar mis medidas completas
                          </button>
                        )}
                      </div>
                    )}
                    {ultimaReceta.lenteRecomendado && (
                      <div className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: "rgba(200,162,78,0.35)", backgroundColor: "rgba(200,162,78,0.08)" }}>
                        <Glasses size={18} style={{ color: GOLD }} className="shrink-0" />
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#7c5e14" }}>Lente recomendado</p>
                          <p className="text-sm font-semibold text-slate-800">{ultimaReceta.lenteRecomendado}</p>
                        </div>
                      </div>
                    )}
                    {(ultimaReceta.diagnostico || ultimaReceta.indicaciones || ultimaReceta.usaLentes) && (
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {ultimaReceta.diagnostico && (<div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Diagnóstico</p><p className="mt-0.5 text-sm font-semibold text-slate-700">{ultimaReceta.diagnostico}</p></div>)}
                        {ultimaReceta.indicaciones && (<div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Indicaciones</p><p className="mt-0.5 text-sm text-slate-600">{ultimaReceta.indicaciones}</p></div>)}
                        {ultimaReceta.usaLentes && (<div className="rounded-xl border border-slate-100 bg-slate-50/60 p-3"><p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">¿Usa lentes?</p><p className="mt-0.5 text-sm font-semibold text-slate-700">{ultimaReceta.usaLentes === "si" ? "Sí" : "No"}</p></div>)}
                      </div>
                    )}
                    <p className="flex items-center gap-1.5 border-t border-slate-100 pt-3 text-xs text-slate-500"><Stethoscope size={13} /> Emitida por {ultimaReceta.profesionalNombre || "el equipo"} · {nombreOptica}</p>
                  </div>
                )}
              </div>

              {misConsultas.length > 1 && (
                <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                  <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Recetas anteriores</h2>
                  <div className="divide-y divide-slate-100">
                    {misConsultas.slice(1).map((c) => (
                      <div key={c.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                        <div className="min-w-0">
                          <span className="font-mono text-xs text-slate-500">{c.fecha}</span>
                          <p className="truncate font-medium text-slate-700">{c.diagnostico || "Consulta registrada"}</p>
                        </div>
                        {!mostrarMedidas && (
                          <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-slate-500"><Lock size={12} /> Medidas protegidas</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── MI PERFIL ── */}
          {seccion === "perfil" && (
            <div className="space-y-6">
              <div>
                <h1 className="font-serif text-2xl font-bold tracking-tight" style={{ color: INK }}>Mi perfil</h1>
                <p className="text-sm text-slate-500">Tus datos personales y de acceso.</p>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-4 border-b border-slate-100 pb-5">
                  <div className="grid h-16 w-16 place-items-center rounded-2xl text-2xl font-bold text-white" style={{ background: GRAD }}>{primerNombre[0]?.toUpperCase()}</div>
                  <div>
                    <h2 className="text-lg font-bold" style={{ color: INK }}>{usuario?.nombre || "Paciente"}</h2>
                    <p className="text-sm text-slate-500">Paciente de {nombreOptica}</p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <DatoPerfil icon={IdCard} label="Cédula" valor={usuario?.cedula} />
                  <DatoPerfil icon={Phone} label="Teléfono" valor={usuario?.telefono} />
                  <DatoPerfil icon={Mail} label="Correo" valor={usuario?.correo} />
                  <DatoPerfil icon={Cake} label="Nacimiento" valor={usuario?.fecha_nacimiento || usuario?.fechaNacimiento} />
                </div>

                <div className="mt-6 flex flex-col items-start justify-between gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: INK }}>Contraseña</p>
                    <p className="text-xs text-slate-500">Cámbiala cuando quieras por seguridad.</p>
                  </div>
                  <button onClick={() => { setClaveActual(""); setNuevaClave(""); setConfirmarClave(""); setErrorClave(""); setModalClave(true) }} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer"><KeyRound size={16} /> Cambiar contraseña</button>
                </div>
              </div>

              {/* ─── PRIVACIDAD Y DATOS ─── */}
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold" style={{ color: INK }}>Privacidad y tus datos</h2>
                <p className="mt-1 text-sm text-slate-500">Tus datos son tuyos — puedes llevártelos o pedir que los eliminemos.</p>

                {errorPrivacidad && (
                  <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs font-medium text-red-700">
                    <AlertCircle size={14} className="shrink-0" /> {errorPrivacidad}
                  </div>
                )}

                <div className="mt-4 flex flex-col items-start justify-between gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: INK }}>Exportar mis datos</p>
                    <p className="text-xs text-slate-500">Descarga tu perfil, citas e historial clínico en un archivo.</p>
                  </div>
                  <button onClick={exportarMisDatos} disabled={exportando} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer disabled:opacity-60">
                    {exportando ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} {exportando ? "Exportando…" : "Exportar"}
                  </button>
                </div>

                <div className="mt-4 flex flex-col items-start justify-between gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center">
                  <div>
                    <p className="text-sm font-semibold text-red-600">Eliminar mi cuenta</p>
                    <p className="text-xs text-slate-500">Le pedimos a {nombreOptica} que elimine tu cuenta y tus datos.</p>
                  </div>
                  <button onClick={() => { setMotivoEliminar(""); setSolicitudEliminarEnviada(false); setErrorPrivacidad(""); setModalEliminarAbierto(true) }} className="flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 cursor-pointer">
                    <ShieldAlert size={16} /> Solicitar eliminación
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ─── MODAL SOLICITAR ELIMINACIÓN ─── */}
      {modalEliminarAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={() => !enviandoEliminar && setModalEliminarAbierto(false)}>
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl" style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)" }} onClick={(e) => e.stopPropagation()}>
            {solicitudEliminarEnviada ? (
              <>
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 size={24} /></div>
                <h3 className="mt-3 text-center text-lg font-bold" style={{ color: INK }}>Solicitud enviada</h3>
                <p className="mt-2 text-center text-sm text-slate-500">{nombreOptica} revisará tu pedido y se pondrá en contacto contigo.</p>
                <button type="button" onClick={() => setModalEliminarAbierto(false)} className="mt-5 w-full rounded-xl bg-slate-100 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-200 cursor-pointer">Cerrar</button>
              </>
            ) : (
              <>
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-600"><ShieldAlert size={24} /></div>
                <h3 className="mt-3 text-center text-lg font-bold" style={{ color: INK }}>¿Eliminar tu cuenta?</h3>
                <p className="mt-2 text-center text-sm text-slate-500">Le avisamos a {nombreOptica} para que elimine tu cuenta y tus datos. Esto no borra nada al instante — la óptica te contactará.</p>
                {errorPrivacidad && (
                  <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs font-medium text-red-700">
                    <AlertCircle size={14} className="shrink-0" /> {errorPrivacidad}
                  </div>
                )}
                <textarea
                  rows={2} value={motivoEliminar} onChange={(e) => setMotivoEliminar(e.target.value)}
                  placeholder="¿Por qué quieres eliminar tu cuenta? (opcional)"
                  className="mt-4 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-red-400 focus:bg-white"
                />
                <div className="mt-4 flex gap-2">
                  <button type="button" onClick={() => setModalEliminarAbierto(false)} disabled={enviandoEliminar} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer disabled:opacity-60">Cancelar</button>
                  <button type="button" onClick={confirmarSolicitudEliminar} disabled={enviandoEliminar} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 cursor-pointer disabled:opacity-60">
                    {enviandoEliminar ? "Enviando…" : "Sí, solicitar"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL AGENDAR ─── */}
      {modalAgendar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={() => setModalAgendar(false)}>
          <div className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: GRAD }}><Stethoscope size={20} /></div>
                <div>
                  <h3 className="text-lg font-bold" style={{ color: INK }}>Agendar cita</h3>
                  <p className="text-xs text-slate-500">Elige el motivo y un horario disponible.</p>
                </div>
              </div>
              <button onClick={() => setModalAgendar(false)} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-600 cursor-pointer"><X size={20} /></button>
            </div>
            <form onSubmit={validarYPedirConfirmacion} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                {error && <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700"><AlertCircle size={16} /> {error}</div>}
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-600">Paciente</label>
                  <input type="text" disabled value={usuario?.nombre || "Paciente autenticado"} className="w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm font-medium text-slate-500" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-600">Motivo de consulta</label>
                  <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-50">
                    {motivosConsulta.map((m) => (<option key={m} value={m}>{m}</option>))}
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
                <button type="button" onClick={() => setModalAgendar(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer">Cancelar</button>
                <button type="submit" className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 cursor-pointer" style={{ background: GRAD, boxShadow: "0 12px 24px -12px rgba(37,99,235,0.6)" }}>Confirmar cita <ChevronRight size={16} /></button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL REAGENDAR ─── */}
      {reagendando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={() => !guardandoReagenda && setReagendando(null)}>
          <div className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: GRAD }}><CalendarClock size={20} /></div>
                <div>
                  <h3 className="text-lg font-bold" style={{ color: INK }}>Reagendar cita</h3>
                  <p className="text-xs text-slate-500">Tenías: {etiquetaFecha(reagendando.fecha)} · {reagendando.hora}</p>
                </div>
              </div>
              <button onClick={() => !guardandoReagenda && setReagendando(null)} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-600 cursor-pointer"><X size={20} /></button>
            </div>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
              {errorReagenda && <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700"><AlertCircle size={16} /> {errorReagenda}</div>}
              <SelectorFechaHora
                disponibilidad={disponibilidad}
                citas={citas.filter((c) => c.id !== reagendando.id)}
                fecha={fechaReagenda}
                hora={horaReagenda}
                onCambiarFecha={setFechaReagenda}
                onCambiarHora={setHoraReagenda}
              />
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button type="button" disabled={guardandoReagenda} onClick={() => setReagendando(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer disabled:opacity-50">Cancelar</button>
              <button
                type="button"
                disabled={guardandoReagenda || !fechaReagenda || !horaReagenda}
                onClick={confirmarReagenda}
                className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: GRAD, boxShadow: "0 12px 24px -12px rgba(37,99,235,0.6)" }}
              >
                {guardandoReagenda ? "Guardando..." : "Confirmar nuevo horario"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL CANCELAR CITA ─── */}
      {cancelando && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={() => !guardandoCancelar && setCancelando(null)}>
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl" style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)" }} onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5">
              <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-600">
                <AlertCircle size={22} />
              </div>
              <h2 className="text-lg font-bold" style={{ color: INK }}>¿Cancelar esta cita?</h2>
              <p className="mt-1.5 text-sm text-slate-500">
                {etiquetaFecha(cancelando.fecha)} · {cancelando.hora}. Esta acción no se puede deshacer — si cambias de opinión tendrás que agendar una cita nueva.
              </p>
              {errorCancelar && <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">{errorCancelar}</p>}
            </div>
            <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
              <button type="button" disabled={guardandoCancelar} onClick={() => setCancelando(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer disabled:opacity-50">
                Volver
              </button>
              <button type="button" disabled={guardandoCancelar} onClick={confirmarCancelar} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 cursor-pointer disabled:opacity-50">
                {guardandoCancelar ? "Cancelando..." : "Sí, cancelar cita"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── CONFIRMACIÓN DE AGENDAMIENTO ─── */}
      {confirmandoCita && (
        <ConfirmarCitaModal
          paciente={usuario?.nombre || "Paciente Registrado"}
          motivo={motivo}
          fecha={fecha ? isoAFechaLocal(fecha).toLocaleDateString("es-EC", { day: "numeric", month: "long", year: "numeric" }) : ""}
          hora={hora}
          onCancelar={() => setConfirmandoCita(false)}
          onConfirmar={handleAgendar}
          guardando={guardandoCita}
          error={errorCita}
        />
      )}

      {/* ─── MODAL CAMBIAR CONTRASEÑA ─── */}
      {modalClave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={() => setModalClave(false)}>
          <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: GRAD }}><KeyRound size={20} /></div>
                <div>
                  <h3 className="text-lg font-bold" style={{ color: INK }}>Cambiar contraseña</h3>
                  <p className="text-xs text-slate-500">Usa una que no hayas usado antes.</p>
                </div>
              </div>
              <button onClick={() => setModalClave(false)} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-600 cursor-pointer"><X size={20} /></button>
            </div>
            <form onSubmit={handleCambiarClave} className="space-y-4 p-5">
              <p className="text-sm text-slate-500">Elige una contraseña nueva para reemplazar la temporal.</p>
              {errorClave && <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700"><AlertCircle size={16} /> {errorClave}</div>}
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-600">Contraseña actual</label>
                <div className="relative"><Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input type="password" value={claveActual} onChange={(e) => setClaveActual(e.target.value)} placeholder="Tu contraseña actual" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50" /></div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-600">Nueva contraseña</label>
                <div className="relative"><Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input type="password" value={nuevaClave} onChange={(e) => setNuevaClave(e.target.value)} placeholder="Mínimo 6 caracteres" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50" /></div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-600">Confirmar contraseña</label>
                <div className="relative"><Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input type="password" value={confirmarClave} onChange={(e) => setConfirmarClave(e.target.value)} placeholder="Repite la contraseña" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50" /></div>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button type="button" disabled={guardandoClave} onClick={() => setModalClave(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer disabled:opacity-50">Cancelar</button>
                <button type="submit" disabled={guardandoClave} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60" style={{ background: GRAD, boxShadow: "0 12px 24px -12px rgba(37,99,235,0.6)" }}>{guardandoClave ? "Guardando..." : "Guardar contraseña"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Subcomponentes ── */
function TarjetaResumen({ label, valor, sub, icon: Icon, tile, tileText }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span>
        <div className="grid h-9 w-9 place-items-center rounded-xl" style={{ background: tile, color: tileText }}><Icon size={18} /></div>
      </div>
      <p className="mt-2 truncate text-2xl font-bold" style={{ color: INK }}>{valor}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

function FilaCita({ cita, puedeReagendar, onReagendar, onCancelar }) {
  const atendida = cita.estado === "Atendida"
  const noAsistio = cita.estado === "No Asistió"
  const cancelada = cita.estado === "Cancelada"
  const enAtencion = cita.estado === "En Atención"
  const resuelta = atendida || noAsistio || cancelada
  const reagendable = puedeReagendar?.(cita)
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 py-3.5">
      <div className="flex items-center gap-3.5">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: resuelta ? "#f1f5f9" : "#eef2ff", color: resuelta ? "#64748b" : "#2563eb" }}><Calendar size={18} /></div>
        <div className="space-y-1">
          <span className="inline-block rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">{cita.motivo}</span>
          <div className="flex items-center gap-3 text-sm font-semibold text-slate-800">
            <span className="flex items-center gap-1"><Calendar size={13} className="text-slate-500" /> {etiquetaFecha(cita.fecha)}</span>
            <span className="flex items-center gap-1"><Clock size={13} className="text-slate-500" /> {cita.hora}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {reagendable && (
          <button
            type="button"
            onClick={() => onReagendar?.(cita)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer"
          >
            <CalendarClock size={13} /> Reagendar
          </button>
        )}
        {reagendable && (
          <button
            type="button"
            onClick={() => onCancelar?.(cita)}
            className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 cursor-pointer"
          >
            <X size={13} /> Cancelar
          </button>
        )}
        {atendida ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"><CheckCircle2 size={12} /> Atendida</span>
        ) : noAsistio ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-600"><AlertCircle size={12} /> No asistió</span>
        ) : cancelada ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500"><X size={12} /> Cancelada</span>
        ) : enAtencion ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-600"><Activity size={12} /> Te están atendiendo</span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Pendiente</span>
        )}
      </div>
    </div>
  )
}

function OjoReceta({ sigla, titulo, ojo = {}, color, mostrarMedidas }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="grid h-6 w-6 place-items-center rounded-md font-mono text-xs font-bold text-white" style={{ backgroundColor: color }}>{sigla}</span>
        <span className="text-xs font-semibold text-slate-600">{titulo}</span>
      </div>
      {mostrarMedidas ? (
        <div className="rounded-lg border border-slate-200 bg-white py-3.5 text-center">
          <p className="font-mono text-sm font-bold" style={{ color: INK }}>
            {ojo.esfera ?? "—"} {ojo.cilindro ?? ""} {ojo.eje != null ? `x${ojo.eje}` : ""}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500">Esfera · Cilindro · Eje</p>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-slate-200 bg-white py-3.5 text-slate-500">
          <Lock size={13} />
          <span className="text-xs font-semibold">Medidas protegidas</span>
        </div>
      )}
      <p className="mt-2 border-t border-slate-200 pt-2 text-center text-[11px] text-slate-500">Agudeza: <span className="font-semibold text-slate-600">{ojo.avCc || ojo.avSc || "—"}</span></p>
    </div>
  )
}

function DatoPerfil({ icon: Icon, label, valor }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-slate-500"><Icon size={16} /></div>
      <div className="min-w-0"><p className="text-[11px] font-medium uppercase text-slate-500">{label}</p><p className="truncate text-sm font-semibold text-slate-700">{valor || "No registrado"}</p></div>
    </div>
  )
}

