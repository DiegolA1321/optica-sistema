"use client"

import React, { useState, useMemo, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import { supabase } from "../lib/supabaseClient"
import {
  Calendar,
  Clock,
  User,
  CheckCircle2,
  X,
  Search,
  CalendarDays,
  AlertTriangle,
  Stethoscope,
  CalendarClock,
  CalendarCheck,
  Sun,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  UserX,
  Activity,
  MessageCircle,
  Eye,
  UserPlus,
  IdCard,
  Phone,
  Mail,
  Cake,
  MoreVertical,
  Loader2,
  Globe,
  Building2,
  Zap,
  CalendarRange,
  Receipt,
  List,
} from "lucide-react"
import SelectorFechaHora from "../componentes/SelectorFechaHora"
import CalendarioSemanal from "../componentes/CalendarioSemanal"
import ConfirmarCitaModal from "../componentes/ConfirmarCitaModal"
import ConfirmarDatosPacienteModal from "../componentes/ConfirmarDatosPacienteModal"
import { isoAFechaLocal, esHoy, esFutura, etiquetaFecha, parseFechaFlexible, minutosDesdeMedianoche, hoyISO, horaA12, conflictoHorarioPersonalizado, fechaAISO, slotsDisponibles } from "../utilidades/disponibilidad"
import { filtrarSoloLetras, filtrarSoloNumeros } from "../utilidades/validaciones"
import { particionarAgenda, agruparPorDia, desplazarRango, ordenarCitas, yaPasoLaHora } from "../utilidades/agendaCitas"
import { lunesDeSemana, sumarDiasISO, minutosAHHMM, validarMovimiento } from "../utilidades/calendarioSemana"
import { registrarLog } from "../utilidades/logs"
import { cobrosPendientes, marcarCitaAtendidaDb } from "../utilidades/cobrosPendientes"
import { lineasCobroConsulta } from "../utilidades/costosConsulta"
import FacturaVentaModal from "./FacturaVentaModal"
import { crearRegistroPaciente, validarDatosPaciente } from "../utilidades/pacientes"
import { MENSAJE_SIN_PERMISO, esErrorSinPermiso, fueBloqueadoPorPermiso } from "../utilidades/permisos"
import { useModalAccesible } from "../utilidades/useModalAccesible"
import { INK, ACCION_VER } from "@/lib/tema"

// ─── Paleta de firma (consistente con el resto del sistema) ───
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
const SIN_MOTIVO = { badge: "bg-slate-100 text-slate-600 border-slate-200/60", punto: "#94a3b8" }

// Orden de los grupos por estado dentro del modal "Citas del día" (vista por
// mes) — lo más urgente de revisar primero.
const ORDEN_ESTADOS_MODAL = ["En Atención", "Pendiente", "Atendida", "No Asistió", "Cancelada"]

// La última vista elegida se recuerda en este navegador (solo una comodidad
// por persona: si el almacenamiento no está disponible, se abre en Lista).
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
const DIAS_CORTOS = ["L", "M", "X", "J", "V", "S", "D"]

const CLAVE_VISTA = "citas_vista"
const VISTAS = ["lista", "semana", "mes"]
const leerVistaGuardada = () => {
  try {
    const v = localStorage.getItem(CLAVE_VISTA)
    return VISTAS.includes(v) ? v : "lista"
  } catch {
    return "lista"
  }
}
// Debajo de este ancho el calendario semanal no cabe: se muestra la lista.
const CONSULTA_ANCHO_SEMANA = "(min-width: 1024px)"

// Cita sin paciente vinculado todavía y aún sin resolver — la web agenda sin
// ficha, y recepción la registra al atenderla.
const porRegistrar = (c) => !c.pacienteId && !["Atendida", "No Asistió", "Cancelada"].includes(c.estado)

const motivoInfo = (motivo = "", catalogo = []) => {
  const idx = catalogo.indexOf(motivo)
  return idx === -1 ? SIN_MOTIVO : PALETA_MOTIVOS[idx % PALETA_MOTIVOS.length]
}

function KpiBoton({ icono: Icono, valor, etiqueta, tono, activo, onClick, compacto }) {
  const map = {
    blue: { tile: GRAD, tileText: "#fff", ring: "#2563EB" },
    emerald: { tile: "#ecfdf5", tileText: "#059669", ring: "#059669" },
    amber: { tile: "#fffbeb", tileText: "#d97706", ring: "#d97706" },
    slate: { tile: "#f1f5f9", tileText: "#64748b", ring: "#475569" },
  }
  const c = map[tono] || map.slate

  // Compacto (vistas Semana y Mes): una sola línea — icono, cifra y etiqueta —
  // para que quepa en la fila de control y el calendario gane altura.
  if (compacto) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={activo}
        className="group flex items-center gap-2 rounded-xl border bg-white px-2.5 py-1.5 text-left transition hover:-translate-y-0.5 cursor-pointer"
        style={{
          borderColor: activo ? c.ring : "rgba(14,43,51,0.08)",
          boxShadow: activo ? `0 0 0 2px ${c.ring}22` : "0 1px 2px rgba(14,43,51,0.04)",
        }}
      >
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg" style={{ background: c.tile, color: c.tileText }}>
          <Icono size={13} />
        </span>
        <span className="font-serif text-base font-semibold leading-none" style={{ color: INK }}>{valor}</span>
        <span className="truncate text-xs font-semibold text-slate-500">{etiqueta}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex items-center gap-3 rounded-2xl border bg-white p-4 text-left transition hover:-translate-y-0.5 cursor-pointer"
      style={{
        borderColor: activo ? c.ring : "rgba(14,43,51,0.08)",
        boxShadow: activo ? `0 0 0 3px ${c.ring}22` : "0 1px 2px rgba(14,43,51,0.04)",
      }}
    >
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-transform group-hover:scale-105" style={{ background: c.tile, color: c.tileText }}>
        <Icono size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-serif font-semibold leading-none" style={{ color: INK }}>{valor}</p>
        <p className="mt-1 truncate text-xs font-semibold text-slate-500">{etiqueta}</p>
      </div>
    </button>
  )
}

// Tarjeta de cita — extraída de la lista agrupada por día para poder
// reutilizarla tal cual (mismo diseño, ya aprobado por el ing) dentro del
// modal de "Citas del día" de la vista por mes, sin mantener dos copias.
function TarjetaCita({ cita, motivosConsulta, fechaRealPorCitaId, marcandoEstadoId, menuAccionesId, cobroPendiente, onVerPerfil, onAtender, onCobrar, onAbrirMenuAcciones }) {
  const info = motivoInfo(cita.motivo, motivosConsulta)
  const resuelta = cita.estado === "Atendida" || cita.estado === "No Asistió" || cita.estado === "Cancelada"
  // "Atender" está disponible en toda cita que no esté ya Atendida o
  // Cancelada: pendiente, en atención, "No asistió" (la paciente llegó 12
  // minutos tarde) o de otro día (la de mañana que se atiende hoy). La fecha
  // agendada no cambia — la fecha real queda en la consulta (cita_id).
  const puedeAtender = cita.estado !== "Atendida" && cita.estado !== "Cancelada"
  // Fecha real de atención (punto 3, reunión 29 sept.) —
  // solo se muestra cuando difiere de la fecha agendada,
  // para no repetir el mismo dato en el caso común.
  const fechaReal = fechaRealPorCitaId.get(cita.id)?.fecha
  const fechaRealDistinta = fechaReal && fechaReal !== cita.fecha
  return (
    <div
      className={"relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md " + (resuelta ? "border-slate-100 opacity-80" : cita.estado === "En Atención" ? "border-blue-300 ring-2 ring-blue-100" : "border-slate-200/60 hover:border-blue-200/60")}
    >
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: info.punto }} aria-hidden="true" />

      <div className="p-5 pl-6">
        <div className="mb-4 flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={"rounded-md border px-2.5 py-1 text-xs font-semibold " + info.badge}>{cita.motivo}</span>
            {!cita.pacienteId && (
              <span className="rounded-md border border-amber-200/60 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">Primera vez</span>
            )}
            {/* Ícono compacto con tooltip en vez de texto siempre visible
                (ING9: "aunque sea un ícono ahí y ya cuando yo pase el mouse
                que se vea, ya estaría, no necesariamente tiene que ser un
                texto grande"). El nombre accesible vive en el contenedor
                (title + aria-label); el ícono queda aria-hidden para no
                duplicar el anuncio en lectores de pantalla. */}
            <span
              title={cita.origen === "paciente" ? "Agendado por el paciente (web)" : "Registrado por el staff (recepción)"}
              aria-label={cita.origen === "paciente" ? "Agendado por el paciente (web)" : "Registrado por el staff (recepción)"}
              className={"flex items-center justify-center rounded-md border p-1 " + (cita.origen === "paciente" ? "border-cyan-100 bg-cyan-50 text-cyan-700" : "border-slate-200/60 bg-slate-100 text-slate-500")}
            >
              {cita.origen === "paciente" ? <Globe size={13} aria-hidden="true" /> : <Building2 size={13} aria-hidden="true" />}
            </span>
          </div>
          {/* Dos acciones primarias a la vista + el resto (cambiar
              estado, editar, eliminar) bajo "Más acciones" — antes
              eran 5 íconos sueltos sin etiqueta en la misma fila,
              mismo patrón consolidado que ya quedó en Pacientes
              (Séptima Mirada, hallazgo #1). */}
          <div className="flex items-center gap-1">
            {/* "Atender ahora" se movió al pie de la tarjeta como botón
                con etiqueta (ver más abajo) — antes era un ícono suelto
                del mismo tamaño que "Ver perfil"/"Más acciones", fácil de
                pasar por alto (ING6: "está como que muy chiquito... tengo
                que revisar cada cosita"). Misma condición, mismo handler. */}
            {cita.pacienteId && (
              <button type="button" onClick={() => onVerPerfil?.(cita.pacienteId)} className={"rounded-md p-1.5 transition cursor-pointer " + ACCION_VER} title="Ver perfil del paciente" aria-label="Ver perfil del paciente">
                <Eye size={16} />
              </button>
            )}
            <button
              type="button"
              onClick={(e) => onAbrirMenuAcciones(cita.id, e)}
              className={"rounded-md p-1.5 transition cursor-pointer " + (menuAccionesId === cita.id ? "bg-slate-100 text-slate-700" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700")}
              title="Más acciones"
              aria-label="Más acciones"
            >
              <MoreVertical size={16} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: GRAD }}>
            {cita.iniciales || <User size={16} />}
          </div>
          <div className="min-w-0">
            <span className="flex min-w-0 items-center gap-1.5 text-base font-semibold text-slate-800">
              <span className="min-w-0 truncate">{cita.paciente}</span>
            </span>
            {cita.motivoPublico && (
              <span className="block truncate text-xs text-slate-500" title={cita.motivoPublico}>Motivo indicado en línea: {cita.motivoPublico}</span>
            )}
            {cita.codigo && (
              <span className="mt-0.5 block font-mono text-xs text-slate-400" title="Código que el paciente recibió al reservar en línea">{cita.codigo}</span>
            )}
            {cita.triage && (cita.triage.sintomas?.length > 0 || cita.triage.detalle) && (
              <span
                className="mt-1 flex items-center gap-1 text-xs font-semibold text-amber-700"
                title={[cita.triage.sintomas?.join(", "), cita.triage.desdeCuando, cita.triage.detalle].filter(Boolean).join(" · ")}
              >
                <AlertTriangle size={12} className="shrink-0" />
                Pre-triage: {[cita.triage.sintomas?.join(", "), cita.triage.desdeCuando].filter(Boolean).join(" · ") || "ver detalle"}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-3 pl-6">
        <div className="flex items-center gap-1.5 text-sm font-medium text-slate-600">
          <Clock size={14} className="text-slate-500" />
          <span>{cita.hora}</span>
        </div>
        <div className="flex items-center gap-2">
          {cita.estado === "Atendida" ? (
            <div className="flex flex-col items-end gap-0.5">
              <span className="flex items-center gap-1 rounded-full border border-emerald-200/60 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                <CheckCircle2 size={12} /> Atendida
              </span>
              {fechaRealDistinta && (
                <span className="text-[11px] font-medium text-slate-400">Atendida el {etiquetaFecha(fechaReal)}</span>
              )}
            </div>
          ) : cita.estado === "No Asistió" ? (
            <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
              <UserX size={12} /> No asistió
            </span>
          ) : cita.estado === "Cancelada" ? (
            <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
              <X size={12} /> {cita.canceladaPor === "recepcion" ? "Cancelada por recepción" : "Cancelada por el paciente"}
            </span>
          ) : (
            <span className={"flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold " + (cita.estado === "En Atención" ? "border-blue-200/60 bg-blue-50 text-blue-600" : "border-amber-200/60 bg-amber-50 text-amber-600")}>
              {cita.estado === "En Atención" ? <Activity size={12} /> : <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
              {cita.estado === "En Atención" ? "En atención" : "Pendiente"}
            </span>
          )}
          {cobroPendiente && (
            <span className="flex items-center gap-1 rounded-full border border-amber-300/70 bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
              <Receipt size={12} aria-hidden="true" /> Cobro pendiente
            </span>
          )}
          {/* Acción primaria de la tarjeta, con etiqueta visible y
              color sólido — antes era un ícono suelto arriba, del
              mismo tamaño que las acciones secundarias (ver más arriba). */}
          {cobroPendiente ? (
            // La ficha ya se guardó: "Atender" abriría otra consulta. Lo que
            // falta es cobrar.
            <button
              type="button"
              onClick={() => onCobrar(cita)}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 cursor-pointer"
            >
              <Receipt size={14} /> Cobrar
            </button>
          ) : puedeAtender && (
            <button
              type="button"
              onClick={() => onAtender(cita)}
              disabled={marcandoEstadoId === cita.id}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-transform hover:-translate-y-0.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
              style={{ background: GRAD, boxShadow: "0 6px 14px -6px rgba(37,99,235,0.5)" }}
            >
              {marcandoEstadoId === cita.id ? <Loader2 size={14} className="animate-spin" /> : <Stethoscope size={14} />}
              Atender
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Citas({ usuario, cargaInicial = false, citas = [], setCitas, pacientes = [], setPacientes, consultas = [], disponibilidad, abrirModalAlEntrar = false, onModalAlEntrarConsumido, motivosConsulta = [], inventario = [], setInventario, facturasVenta = [], setFacturasVenta, parametrizacion, onAtender, onVerPerfil }) {
  const opticaId = usuario?.opticaId
  const [modalAbierto, setModalAbierto] = useState(false)
  // Mismo modal que "Agendar cita" — en modo Gestionar la fecha arranca en
  // hoy y se habilita crear un paciente nuevo sin salir de aquí (feedback
  // del ing: un walk-in o alguien que llegó desde la web sin cuenta no debía
  // obligar a ir primero al módulo Pacientes).
  const [pacienteId, setPacienteId] = useState(null)
  const [busquedaPaciente, setBusquedaPaciente] = useState("")
  const [mostrarDropdown, setMostrarDropdown] = useState(false)
  const dropdownRef = useRef(null)
  const [fecha, setFecha] = useState("")
  const [hora, setHora] = useState("")
  const [motivo, setMotivo] = useState("")
  // Horario personalizado — el ing probó en vivo el caso de un paciente que
  // llega fuera de la grilla de horarios fijos ("¿qué pasa si te atiendo a
  // las 3:40?") y pidió una manera de registrar la hora real + cuánto va a
  // durar, en vez de forzar todo a los slots de 30/40 minutos por defecto.
  const [horaPersonalizada, setHoraPersonalizada] = useState(false)
  const [horaCustom, setHoraCustom] = useState("") // "HH:MM" 24h, del <input type="time">
  const [duracionCustom, setDuracionCustom] = useState(disponibilidad?.duracionCita || 40)
  const [errorHorarioCustom, setErrorHorarioCustom] = useState("")
  // "Atender ahora" — el paciente ya está físicamente en el local (walk-in o
  // llegó antes/después de su cita) y no tiene sentido hacerlo elegir un
  // bloque de la grilla de horarios: precarga la hora real y, al confirmar,
  // pasa la cita directo a "En Atención" y abre la ficha clínica, en vez de
  // quedar "Pendiente" esperando que alguien la atienda después.
  const [atenderInmediato, setAtenderInmediato] = useState(false)
  const [mensajeExito, setMensajeExito] = useState(null)
  const [error, setError] = useState("")
  const [bannerError, setBannerError] = useState("")
  const [marcandoEstadoId, setMarcandoEstadoId] = useState(null)
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
  // D4 (reunión 29 sept.): el optómetra que no es admin abre directo en "hoy"
  // — su agenda del día — en vez de "todas". El admin (sea o no también
  // optómetra) sigue viendo "todas" por defecto, como hoy.
  const [filtro, setFiltro] = useState(() => (usuario?.rol !== "admin" && usuario?.esOptometra ? "hoy" : "todas")) // todas | hoy | proximas | atendidas
  // Rango de fechas propio (reunión 29 sept.: "todas las de la siguiente
  // semana"), independiente de los KPIs. Sin rango, la lista abre en hoy y lo
  // próximo, y lo pasado queda plegado en "Anteriores". Con rango, se muestra
  // exactamente ese tramo — hacia atrás o hacia adelante.
  const [rangoDesde, setRangoDesde] = useState("")
  const [rangoHasta, setRangoHasta] = useState("")
  // Aviso "N por registrar": citas sin paciente vinculado todavía (la web
  // agenda sin ficha). Reemplaza al filtro Primera vez/Seguimiento.
  const [soloPorRegistrar, setSoloPorRegistrar] = useState(false)
  const [anterioresAbierto, setAnterioresAbierto] = useState(false)
  const [porCancelar, setPorCancelar] = useState(null)

  // ── "+ Añadir nuevo paciente" inline, dentro del modal en modo Gestionar ──
  const [mostrarNuevoPaciente, setMostrarNuevoPaciente] = useState(false)
  const [npNombre, setNpNombre] = useState("")
  const [npCedula, setNpCedula] = useState("")
  const [npTelefono, setNpTelefono] = useState("")
  const [npCorreo, setNpCorreo] = useState("")
  const [npFechaNacimiento, setNpFechaNacimiento] = useState("")
  const [npErrores, setNpErrores] = useState({})
  const [npGuardando, setNpGuardando] = useState(false)

  // ── Resumen previo a "Atender" (reunión 29 sept., punto 1 del plan):
  // antes de entrar a la ficha clínica (o al paso de confirmar datos de
  // D2), se muestra un resumen de la cita con "Ingresar a la ficha
  // clínica" / "Cerrar" — este último no cambia ningún estado. ──
  const [resumenPara, setResumenPara] = useState(null) // la cita, o null

  // ── Cobro pendiente (Ronda 4): una cita "En atención" cuya ficha ya se
  // guardó pero cuyo cobro quedó para después ("Más tarde"). Se cobra con el
  // mismo panel único que usa la ficha clínica. ──
  const pendientesPorCita = useMemo(() => {
    const m = new Map()
    for (const p of cobrosPendientes(consultas, facturasVenta, citas)) if (p.cita) m.set(p.cita.id, p.consulta)
    return m
  }, [consultas, facturasVenta, citas])
  const [cobrandoCita, setCobrandoCita] = useState(null) // la cita, o null
  const cobrarCita = (cita) => setCobrandoCita(cita)
  const alCobrarCita = async (factura) => {
    const cita = cobrandoCita
    setFacturasVenta?.((prev) => [factura, ...prev])
    if (cita) {
      const { error: errorAtendida } = await marcarCitaAtendidaDb(supabase, cita.id)
      if (errorAtendida) setBannerError("El cobro se registró, pero no se pudo marcar la cita como atendida.")
      else setCitas((prev) => prev.map((c) => (c.id === cita.id ? { ...c, estado: "Atendida" } : c)))
    }
    setMensajeExito("Cobro registrado · cita atendida.")
    setTimeout(() => setMensajeExito(null), 3000)
  }

  // ── "Atender" sobre una cita sin paciente vinculado todavía (primera cita
  // agendada desde la web pública, o registrada como visita rápida) — pide
  // completar el registro antes de abrir la ficha clínica ──
  const [completarPara, setCompletarPara] = useState(null) // la cita, o null
  const [cpNombre, setCpNombre] = useState("")
  const [cpCedula, setCpCedula] = useState("")
  const [cpTelefono, setCpTelefono] = useState("")
  const [cpCorreo, setCpCorreo] = useState("")
  const [cpFechaNacimiento, setCpFechaNacimiento] = useState("")
  const [cpErrores, setCpErrores] = useState({})
  const [cpGuardando, setCpGuardando] = useState(false)
  // D2 (reunión 29 sept.): paciente que YA existe (se registró/dedupe al
  // agendar por la web, migración 0067) y solo falta que recepción confirme o
  // corrija sus datos antes de abrir la ficha clínica — { cita, paciente } o
  // null. Reutiliza ConfirmarDatosPacienteModal (también usado desde
  // Pacientes.jsx al elegir una cita desde el perfil del paciente) en vez de
  // duplicar el formulario acá.
  const [confirmarDatosPara, setConfirmarDatosPara] = useState(null)
  // true cuando el registro se abrió desde "Crear paciente" (una cita futura
  // sin paciente vinculado, agendada en línea) en vez de "Atender ahora" —
  // en ese caso solo se crea y vincula al paciente, sin forzar la cita a
  // "En Atención" ni saltar a la ficha clínica (Diego: no había ninguna forma
  // de registrar a alguien con cita futura antes del día de su consulta).
  const [cpSoloRegistro, setCpSoloRegistro] = useState(false)

  // Inserta un paciente nuevo con el mismo shape que usa Pacientes.jsx —
  // reutilizado tanto por "+ Añadir nuevo paciente" (Gestionar) como por
  // "Completar registro" (Atender sobre una cita sin paciente vinculado).
  // La alta en sí (insert + shape) vive en utilidades/pacientes.js, compartida
  // con Pacientes.jsx, para no tener dos copias que puedan desincronizarse.
  const crearPacienteInline = async ({ nombre, cedula, telefono, correo, fechaNacimiento }) => {
    const { paciente: nuevoPaciente, error } = await crearRegistroPaciente(supabase, opticaId, { nombre, cedula, telefono, correo, fechaNacimiento })
    if (error) return { error }
    setPacientes?.([nuevoPaciente, ...pacientes])
    return { paciente: nuevoPaciente }
  }

  const validarDatosPacienteInline = (nombre, cedula, telefono, correo, idEnEdicion) =>
    validarDatosPaciente(pacientes, { nombre, cedula, telefono, correo }, idEnEdicion)

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

  // Menú "más acciones" por tarjeta de cita — portal a document.body con
  // posición calculada (no basta con position:absolute dentro de la
  // tarjeta: la tarjeta tiene overflow-hidden por la barra de color a la
  // izquierda, y con 5 ítems el menú ya no entra y se corta. Mismo patrón
  // que "más acciones" en Pacientes.jsx / SuperadminPanel.jsx).
  const [menuAccionesId, setMenuAccionesId] = useState(null)
  const [menuAccionesPos, setMenuAccionesPos] = useState(null)
  const menuAccionesRef = useRef(null)
  const abrirMenuAcciones = (id, e) => {
    if (menuAccionesId === id) { setMenuAccionesId(null); return }
    const rect = e.currentTarget.getBoundingClientRect()
    setMenuAccionesPos({ top: rect.bottom + 6, left: rect.right - 208 })
    setMenuAccionesId(id)
  }

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
    if (menuAccionesId == null) return
    const onDown = (e) => { if (menuAccionesRef.current && !menuAccionesRef.current.contains(e.target)) setMenuAccionesId(null) }
    const cerrarYa = () => setMenuAccionesId(null)
    document.addEventListener("mousedown", onDown)
    window.addEventListener("scroll", cerrarYa, true)
    window.addEventListener("resize", cerrarYa)
    return () => {
      document.removeEventListener("mousedown", onDown)
      window.removeEventListener("scroll", cerrarYa, true)
      window.removeEventListener("resize", cerrarYa)
    }
  }, [menuAccionesId])

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
    if (!fecha || (horaPersonalizada ? !horaCustom : !hora)) {
      setError(horaPersonalizada ? "Selecciona fecha y escribe la hora personalizada." : "Selecciona fecha y hora en el calendario.")
      return
    }
    if (horaPersonalizada) {
      const horaAMPM = horaA12(horaCustom)
      if (conflictoHorarioPersonalizado(fecha, horaAMPM, duracionCustom, disponibilidad, citas)) {
        setErrorHorarioCustom("Ese horario se cruza con otra cita que sigue en agenda — elige otra hora o duración.")
        return
      }
    }
    setErrorHorarioCustom("")
    setError("")
    // "Atender ahora": el formulario ya es la confirmación — se salta el
    // segundo diálogo y se entra directo a la ficha.
    if (atenderInmediato) {
      agendarCita()
      return
    }
    setConfirmando(true)
  }

  const agendarCita = async () => {
    const paciente = pacienteSeleccionado
    const partesNombre = paciente.nombre.trim().split(" ").filter(Boolean)
    const iniciales =
      partesNombre.length > 1
        ? (partesNombre[0][0] + partesNombre[1][0]).toUpperCase()
        : partesNombre[0][0].toUpperCase()

    const horaFinal = horaPersonalizada ? horaA12(horaCustom) : hora
    const nuevaCita = {
      pacienteId: paciente.id,
      paciente: paciente.nombre,
      cedula: paciente.cedula,
      telefono: paciente.telefono,
      fecha,
      hora: horaFinal,
      duracionMinutos: horaPersonalizada ? (Number(duracionCustom) || disponibilidad?.duracionCita || 40) : null,
      motivo,
      iniciales: iniciales || "P",
      estado: atenderInmediato ? "En Atención" : "Pendiente",
    }

    if (supabase && opticaId) {
      // Antes esta llamada descartaba el error (solo desestructuraba
      // `data`) — si el insert fallaba (red, RLS, o el índice único que
      // evita doble reserva, hallazgo E7), igual se mostraba "cita
      // guardada correctamente" con un id inventado en el cliente, sin que
      // nadie se enterara de que nunca llegó al servidor.
      const { data, error: errorInsert } = await supabase
        .from("citas")
        .insert({
          optica_id: opticaId,
          paciente_id: typeof paciente.id === "string" ? paciente.id : null,
          paciente: nuevaCita.paciente, cedula: nuevaCita.cedula, telefono: nuevaCita.telefono,
          fecha: nuevaCita.fecha, hora: nuevaCita.hora, duracion_minutos: nuevaCita.duracionMinutos, motivo: nuevaCita.motivo, estado: nuevaCita.estado,
        })
        .select()
        .single()
      if (errorInsert) {
        setError(
          errorInsert.code === "23505"
            ? "Ese horario ya no está disponible — alguien más lo acaba de reservar. Elige otro."
            : esErrorSinPermiso(errorInsert)
              ? MENSAJE_SIN_PERMISO
              : "No se pudo registrar la cita. Revisa tu conexión e intenta de nuevo."
        )
        setConfirmando(false)
        return
      }
      nuevaCita.id = data.id
    } else {
      nuevaCita.id = Date.now()
    }

    setCitas([...citas, nuevaCita])
    registrarLog(usuario, "citas", atenderInmediato ? "Atendió a un paciente de inmediato" : "Agendó una cita", `${nuevaCita.paciente} · ${nuevaCita.fecha}`)

    const irADeUnaALaFicha = atenderInmediato
    setConfirmando(false)
    cerrarModal()
    if (irADeUnaALaFicha) {
      onAtender?.(paciente, nuevaCita.id, nuevaCita.motivo)
    } else {
      setMensajeExito("Cita registrada y guardada correctamente.")
      setTimeout(() => setMensajeExito(null), 3000)
    }
  }

  const abrirModal = () => {
    setFecha(hoyISO())
    setModalAbierto(true)
  }

  // Clic en un espacio libre del calendario semanal: abre el mismo modal con
  // el día y la hora ya elegidos. Si la hora coincide con un horario de la
  // grilla de reserva, se elige ese; si no (la grilla visual es de 30 min y la
  // de reserva de `duracionCita`), se usa el horario personalizado.
  const abrirModalEn = (fechaISO, minutos) => {
    const hhmm = minutosAHHMM(minutos)
    const slot = slotsDisponibles(fechaISO, disponibilidad, citas).find((s) => s.hora === horaA12(hhmm) && s.libre)
    setFecha(fechaISO)
    if (slot) {
      setHora(slot.hora)
    } else {
      setHoraPersonalizada(true)
      setHoraCustom(hhmm)
      setDuracionCustom(disponibilidad?.duracionCita || 40)
    }
    setModalAbierto(true)
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
    setHoraPersonalizada(false)
    setHoraCustom("")
    setDuracionCustom(disponibilidad?.duracionCita || 40)
    setErrorHorarioCustom("")
    setAtenderInmediato(false)
    setMostrarNuevoPaciente(false)
    setNpNombre("")
    setNpCedula("")
    setNpTelefono("")
    setNpCorreo("")
    setNpFechaNacimiento("")
    setNpErrores({})
  }

  const guardarNuevoPacienteInline = async (e) => {
    e.preventDefault()
    const errs = validarDatosPacienteInline(npNombre, npCedula, npTelefono, npCorreo, null)
    setNpErrores(errs)
    if (Object.keys(errs).length > 0) return

    setNpGuardando(true)
    const { paciente: nuevoPaciente, error } = await crearPacienteInline({
      nombre: npNombre, cedula: npCedula, telefono: npTelefono, correo: npCorreo, fechaNacimiento: npFechaNacimiento,
    })
    setNpGuardando(false)
    if (error) {
      setNpErrores({ cedula: esErrorSinPermiso(error) ? MENSAJE_SIN_PERMISO : "No se pudo registrar al paciente. Revisa tu conexión e intenta de nuevo." })
      return
    }
    setPacienteId(nuevoPaciente.id)
    setBusquedaPaciente(nuevoPaciente.nombre)
    setMostrarNuevoPaciente(false)
    setNpNombre("")
    setNpCedula("")
    setNpTelefono("")
    setNpCorreo("")
    setNpFechaNacimiento("")
    setNpErrores({})
  }

  // No se elimina la cita (reunión 29 sept., punto 2 del plan: "no deberíamos
  // eliminar citas, sino reagendarlas") — se marca Cancelada, igual que
  // cuando cancela el propio paciente desde el portal, distinguiendo quién
  // canceló (cancelada_por, migración 0078) para que el badge no diga
  // "por el paciente" en una cita que canceló recepción.
  const confirmarCancelacion = async () => {
    if (porCancelar == null) return
    const cancelada = citas.find((c) => c.id === porCancelar)
    if (supabase && opticaId) {
      const { data: actualizadas, error: errorCancelar } = await supabase
        .from("citas")
        .update({ estado: "Cancelada", cancelada_por: "recepcion" })
        .eq("id", porCancelar)
        .select()
      if (fueBloqueadoPorPermiso({ error: errorCancelar, data: actualizadas })) {
        setBannerError(MENSAJE_SIN_PERMISO)
        setPorCancelar(null)
        return
      }
      if (errorCancelar) {
        setBannerError("No se pudo cancelar la cita. Revisa tu conexión e intenta de nuevo.")
        setPorCancelar(null)
        return
      }
    }
    setBannerError("")
    setCitas(citas.map((c) => (c.id === porCancelar ? { ...c, estado: "Cancelada", canceladaPor: "recepcion" } : c)))
    registrarLog(usuario, "citas", "Canceló una cita", cancelada ? `${cancelada.paciente} · ${cancelada.fecha}` : "")
    setPorCancelar(null)
  }

  // Marca el desenlace real de una cita — antes nada en todo el sistema volvía
  // a tocar cita.estado después de crearla, así que "Atendida" se inferÍa solo
  // por si la fecha ya había pasado (una cita de hace un mes con paciente que
  // nunca llegó se contaba igual como "atendida" que una que sí se realizó).
  const marcarEstado = async (citaId, nuevoEstado) => {
    setMarcandoEstadoId(citaId)
    try {
      if (supabase && opticaId) {
        const { data: actualizadas, error: errorEstado } = await supabase.from("citas").update({ estado: nuevoEstado }).eq("id", citaId).select()
        if (fueBloqueadoPorPermiso({ error: errorEstado, data: actualizadas })) {
          setBannerError(MENSAJE_SIN_PERMISO)
          return
        }
        if (errorEstado) {
          setBannerError("No se pudo actualizar el estado de la cita. Revisa tu conexión e intenta de nuevo.")
          return
        }
      }
      setBannerError("")
      setCitas(citas.map((c) => (c.id === citaId ? { ...c, estado: nuevoEstado } : c)))
    } finally {
      setMarcandoEstadoId(null)
    }
  }

  // ── "Atender": abre primero el resumen de la cita (punto 1, reunión 29
  // sept.) — la lógica real de entrar a la ficha vive en ingresarAFicha,
  // disparada recién cuando se confirma ese resumen. ──
  const atenderCita = (cita) => {
    setResumenPara(cita)
  }

  // ── Pasa la cita a "En Atención" y abre la ficha clínica del paciente ya
  // vinculado. Si la cita no tiene paciente vinculado (primera cita
  // agendada desde la web pública), pide completar su registro primero. Si
  // el paciente es web y no está confirmado por recepción (D2), pide
  // confirmar/completar sus datos antes de la ficha. ──
  const ingresarAFicha = (cita) => {
    if (cita.pacienteId) {
      const paciente = pacientes.find((p) => p.id === cita.pacienteId)
      if (!paciente) { setBannerError("No se encontró el paciente vinculado a esta cita."); return }
      // D2 (reunión 29 sept.): un paciente que se registró solo al agendar
      // por la web (origen='paciente') todavía no fue revisado por
      // recepción — antes de abrir la ficha, se confirma o corrige una vez
      // sus datos (ConfirmarDatosPacienteModal).
      if (paciente.origen === "paciente" && !paciente.confirmadoRecepcion) {
        setConfirmarDatosPara({ cita, paciente })
        return
      }
      marcarEstado(cita.id, "En Atención")
      onAtender?.(paciente, cita.id, cita.motivo)
      return
    }
    setCompletarPara(cita)
    setCpNombre(cita.paciente || "")
    setCpCedula(cita.cedula || "")
    setCpTelefono(cita.telefono || "")
    setCpCorreo(cita.correo || "")
    setCpFechaNacimiento("")
    setCpErrores({})
    setCpSoloRegistro(false)
  }

  // ── Crear paciente sin atender — para una cita sin paciente vinculado que
  // todavía no ocurre (agendada en línea para más adelante). Mismo formulario
  // y misma vinculación que "Atender ahora", solo que no fuerza el estado a
  // "En Atención" ni salta a la ficha clínica. ──
  const registrarPacienteParaCita = (cita) => {
    setCompletarPara(cita)
    setCpConfirmarPacienteId(null)
    setCpNombre(cita.paciente || "")
    setCpCedula(cita.cedula || "")
    setCpTelefono(cita.telefono || "")
    setCpCorreo(cita.correo || "")
    setCpFechaNacimiento("")
    setCpErrores({})
    setCpSoloRegistro(true)
  }

  const cerrarCompletarRegistro = () => {
    setCompletarPara(null)
    setCpNombre("")
    setCpCedula("")
    setCpTelefono("")
    setCpCorreo("")
    setCpFechaNacimiento("")
    setCpErrores({})
    setCpSoloRegistro(false)
  }

  const guardarCompletarRegistro = async (e) => {
    e.preventDefault()
    const errs = validarDatosPacienteInline(cpNombre, cpCedula, cpTelefono, cpCorreo, null)
    setCpErrores(errs)
    if (Object.keys(errs).length > 0) return

    setCpGuardando(true)

    const { paciente: nuevoPaciente, error } = await crearPacienteInline({
      nombre: cpNombre, cedula: cpCedula, telefono: cpTelefono, correo: cpCorreo, fechaNacimiento: cpFechaNacimiento,
    })
    if (error) {
      setCpGuardando(false)
      setBannerError(esErrorSinPermiso(error) ? MENSAJE_SIN_PERMISO : "No se pudo registrar al paciente. Revisa tu conexión e intenta de nuevo.")
      return
    }

    const citaId = completarPara.id
    const motivoCita = completarPara.motivo
    const soloRegistro = cpSoloRegistro
    const cambiosCita = soloRegistro
      ? { paciente_id: nuevoPaciente.id, cedula: nuevoPaciente.cedula }
      : { paciente_id: nuevoPaciente.id, cedula: nuevoPaciente.cedula, estado: "En Atención" }
    if (supabase && opticaId) {
      const { data: citaVinculada, error: errorCita } = await supabase.from("citas").update(cambiosCita).eq("id", citaId).select()
      if (fueBloqueadoPorPermiso({ error: errorCita, data: citaVinculada })) {
        setCpGuardando(false)
        setBannerError(MENSAJE_SIN_PERMISO)
        return
      }
      if (errorCita) {
        setCpGuardando(false)
        setBannerError("El paciente se registró, pero no se pudo vincular a la cita. Revisa tu conexión e intenta de nuevo.")
        return
      }
    }
    setCitas(citas.map((c) => (c.id === citaId ? { ...c, pacienteId: nuevoPaciente.id, cedula: nuevoPaciente.cedula, ...(soloRegistro ? {} : { estado: "En Atención" }) } : c)))
    setCpGuardando(false)
    cerrarCompletarRegistro()
    if (soloRegistro) {
      setMensajeExito("Paciente registrado y vinculado a su cita.")
      setTimeout(() => setMensajeExito(null), 3000)
    } else {
      onAtender?.(nuevoPaciente, citaId, motivoCita)
    }
  }

  // ── Reagendar cita (solo el optómetra, desde aquí — no hay autoservicio del paciente) ──
  const [reagendando, setReagendando] = useState(null)
  const [nuevaFecha, setNuevaFecha] = useState("")
  const [nuevaHora, setNuevaHora] = useState("")
  const [nuevoMotivo, setNuevoMotivo] = useState("")
  const [errorReagendar, setErrorReagendar] = useState("")
  const [estadoCorregido, setEstadoCorregido] = useState("")
  const [reagendada, setReagendada] = useState(null) // cita ya guardada, para ofrecer avisar por WhatsApp

  const abrirReagendar = (cita) => {
    setReagendando(cita)
    setNuevaFecha("")
    setNuevaHora("")
    setNuevoMotivo(cita.motivo || "")
    setEstadoCorregido(cita.estado)
    setErrorReagendar("")
  }

  const cerrarReagendar = () => {
    setReagendando(null)
    setNuevaFecha("")
    setNuevaHora("")
    setNuevoMotivo("")
    setEstadoCorregido("")
    setErrorReagendar("")
  }

  const confirmarReagendar = async (e) => {
    e.preventDefault()
    if (!nuevoMotivo) {
      setErrorReagendar("Selecciona el motivo del examen.")
      return
    }
    // Los estados son automáticos; "Corregir estado" es la excepción manual
    // (deshacer un estado puesto por error). Si solo cambió eso (y/o el
    // motivo), no hace falta elegir una fecha nueva.
    const estadoCambiado = estadoCorregido && estadoCorregido !== reagendando.estado
    const sinNuevoHorario = !nuevaFecha && !nuevaHora
    if (sinNuevoHorario && (estadoCambiado || nuevoMotivo !== reagendando.motivo)) {
      const cambios = { motivo: nuevoMotivo, ...(estadoCambiado ? { estado: estadoCorregido } : {}) }
      if (supabase && opticaId) {
        const { data: actualizadas, error: errorUpdate } = await supabase.from("citas").update(cambios).eq("id", reagendando.id).select()
        if (fueBloqueadoPorPermiso({ error: errorUpdate, data: actualizadas })) {
          setErrorReagendar(MENSAJE_SIN_PERMISO)
          return
        }
        if (errorUpdate) {
          setErrorReagendar("No se pudo guardar el cambio. Revisa tu conexión e intenta de nuevo.")
          return
        }
      }
      setCitas(citas.map((c) => (c.id === reagendando.id ? { ...c, ...cambios } : c)))
      registrarLog(usuario, "citas", estadoCambiado ? "Corrigió el estado de una cita" : "Editó una cita", `${reagendando.paciente} · ${reagendando.fecha}`)
      cerrarReagendar()
      setMensajeExito(estadoCambiado ? "Estado de la cita corregido." : "Cita actualizada.")
      setTimeout(() => setMensajeExito(null), 3000)
      return
    }
    if (!nuevaFecha || !nuevaHora) {
      setErrorReagendar("Selecciona la nueva fecha y hora.")
      return
    }
    // Editar ya no está bloqueado para una cita resuelta (Atendida/No Asistió/
    // Cancelada) — se puede corregir motivo/fecha/hora de un registro pasado
    // sin que eso la reabra como "Pendiente" por accidente; ese cambio de
    // estado sigue siendo una acción aparte y explícita ("Cambiar estado").
    const resueltaAlEditar = ["Atendida", "No Asistió", "Cancelada"].includes(reagendando.estado)
    const nuevoEstado = estadoCambiado ? estadoCorregido : resueltaAlEditar ? reagendando.estado : "Pendiente"
    const citaActualizada = { ...reagendando, fecha: nuevaFecha, hora: nuevaHora, motivo: nuevoMotivo, estado: nuevoEstado }
    if (supabase && opticaId) {
      const { data: reagendadas, error: errorUpdate } = await supabase.from("citas").update({ fecha: nuevaFecha, hora: nuevaHora, motivo: nuevoMotivo, estado: nuevoEstado }).eq("id", reagendando.id).select()
      if (fueBloqueadoPorPermiso({ error: errorUpdate, data: reagendadas })) {
        setErrorReagendar(MENSAJE_SIN_PERMISO)
        return
      }
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

  // ── Reagendar arrastrando una cita pendiente en el calendario semanal: el
  // calendario ya validó el destino (sin cruces, dentro del horario, no en el
  // pasado); aquí se pide confirmación y se guarda con el mismo update de
  // fecha/hora que "Editar cita". La cita conserva su registro (mismo id). ──
  const [moviendo, setMoviendo] = useState(null) // { cita, fecha, hora } | null
  const [guardandoMovimiento, setGuardandoMovimiento] = useState(false)
  const pedirMovimiento = (cita, fechaISO, minutos) => setMoviendo({ cita, fecha: fechaISO, hora: horaA12(minutosAHHMM(minutos)) })
  const confirmarMovimiento = async () => {
    if (!moviendo || guardandoMovimiento) return
    const { cita, fecha: nuevaFecha, hora: nuevaHora } = moviendo
    // Se revalida: la agenda pudo cambiar mientras se confirmaba.
    const v = validarMovimiento(cita, nuevaFecha, minutosDesdeMedianoche(nuevaHora), disponibilidad, citas)
    if (!v.ok) {
      setBannerError(v.motivo)
      setMoviendo(null)
      return
    }
    setGuardandoMovimiento(true)
    try {
      if (supabase && opticaId) {
        const { data: reagendadas, error: errorUpdate } = await supabase.from("citas").update({ fecha: nuevaFecha, hora: nuevaHora }).eq("id", cita.id).select()
        if (fueBloqueadoPorPermiso({ error: errorUpdate, data: reagendadas })) {
          setBannerError(MENSAJE_SIN_PERMISO)
          setMoviendo(null)
          return
        }
        if (errorUpdate) {
          setBannerError(errorUpdate.code === "23505" ? "Ese horario ya no está disponible — alguien más lo acaba de reservar." : "No se pudo reagendar la cita. Revisa tu conexión e intenta de nuevo.")
          setMoviendo(null)
          return
        }
      }
      const citaActualizada = { ...cita, fecha: nuevaFecha, hora: nuevaHora }
      setCitas((prev) => prev.map((c) => (c.id === cita.id ? citaActualizada : c)))
      registrarLog(usuario, "citas", "Reagendó una cita (arrastrando en el calendario)", `${cita.paciente} · ${nuevaFecha}`)
      setBannerError("")
      setMoviendo(null)
      setReagendada(citaActualizada)
    } finally {
      setGuardandoMovimiento(false)
    }
  }

  // Semana visible en la vista Semana (lunes, ISO); la usa también el aviso de búsqueda.
  const [semanaLunes, setSemanaLunes] = useState(() => lunesDeSemana(hoyISO()))

  // Filtrado base (búsqueda + KPI de estado + "por registrar"). Lo comparten la
  // lista y la vista por mes; el rango de fechas solo recorta la lista.

  // Además del nombre, la búsqueda mira el código de cita (CIT-2026-ABC123)
  // que el paciente recibe al reservar en línea — así el personal puede
  // encontrar su cita si la dan por teléfono.
  const textoBusqueda = busqueda.trim().toLowerCase()
  const coincideBusqueda = (c) => c.paciente.toLowerCase().includes(textoBusqueda) || (c.codigo || "").toLowerCase().includes(textoBusqueda)

  // Solo los filtros de estado (indicadores de arriba + "por registrar"). La
  // vista Semana parte de aquí: la búsqueda no oculta citas, las resalta.
  const filtradasPorEstado = useMemo(() => citas.filter((c) => {
    if (soloPorRegistrar && !(porRegistrar(c))) return false
    if (filtro === "hoy") return esHoy(c.fecha)
    if (filtro === "proximas") return esFutura(c.fecha)
    if (filtro === "atendidas") return c.estado === "Atendida"
    return true
  }), [citas, filtro, soloPorRegistrar])

  const filtradasBase = useMemo(
    () => (textoBusqueda ? filtradasPorEstado.filter(coincideBusqueda) : filtradasPorEstado),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtradasPorEstado, textoBusqueda]
  )

  // Vista Semana: si lo buscado no está en la semana que se ve, ofrece ir a la
  // semana de la coincidencia más cercana (la próxima, o la última pasada).
  const avisoBusquedaSemana = useMemo(() => {
    if (!textoBusqueda) return null
    const coincidencias = filtradasPorEstado.filter(coincideBusqueda)
    if (coincidencias.length === 0) return { texto: "Ninguna cita coincide con la búsqueda." }
    const finSemana = sumarDiasISO(semanaLunes, 6)
    if (coincidencias.some((c) => c.fecha >= semanaLunes && c.fecha <= finSemana)) return null
    const hoy = hoyISO()
    const mejor = [...coincidencias].sort((a, b) => {
      const da = Math.abs(isoAFechaLocal(a.fecha) - isoAFechaLocal(semanaLunes))
      const db = Math.abs(isoAFechaLocal(b.fecha) - isoAFechaLocal(semanaLunes))
      return da - db || (a.fecha >= hoy ? -1 : 1)
    })[0]
    return {
      texto: `${mejor.paciente} tiene su cita el ${etiquetaFecha(mejor.fecha)}, en otra semana.`,
      irA: () => setSemanaLunes(lunesDeSemana(mejor.fecha)),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtradasPorEstado, textoBusqueda, semanaLunes])

  const hayRango = Boolean(rangoDesde || rangoHasta)

  // Lista: sin rango → hoy en adelante + "Anteriores" (más reciente primero).
  // Con rango → solo ese tramo, cronológico. "Ya atendidas" es por naturaleza
  // un historial, así que va de la más reciente a la más antigua.
  const { grupos, gruposAnteriores } = useMemo(() => {
    const hoy = hoyISO()
    if (hayRango) {
      const enRango = filtradasBase.filter((c) => (!rangoDesde || c.fecha >= rangoDesde) && (!rangoHasta || c.fecha <= rangoHasta))
      return { grupos: agruparPorDia(ordenarCitas(enRango)), gruposAnteriores: [] }
    }
    if (filtro === "atendidas") {
      return { grupos: agruparPorDia(ordenarCitas(filtradasBase, true)), gruposAnteriores: [] }
    }
    const { proximas, anteriores } = particionarAgenda(filtradasBase, hoy)
    return { grupos: agruparPorDia(proximas), gruposAnteriores: agruparPorDia(anteriores) }
  }, [filtradasBase, filtro, hayRango, rangoDesde, rangoHasta])

  const totalAnteriores = gruposAnteriores.reduce((n, [, cs]) => n + cs.length, 0)
  const totalPorRegistrar = useMemo(() => citas.filter(porRegistrar).length, [citas])

  const totalHoy = useMemo(() => citas.filter((c) => esHoy(c.fecha) && c.estado !== "Cancelada").length, [citas])
  const totalProximas = useMemo(() => citas.filter((c) => esFutura(c.fecha) && c.estado !== "Cancelada").length, [citas])
  const totalAtendidas = useMemo(() => citas.filter((c) => c.estado === "Atendida").length, [citas])

  // Fecha real de atención por cita (punto 3, reunión 29 sept.) — la cita
  // conserva su fecha/hora agendada; cita_id (migración 0079) vincula con
  // la consulta que sí guarda cuándo se atendió de verdad. Si hay más de
  // una consulta para la misma cita (caso raro), se toma la más reciente.
  const fechaRealPorCitaId = useMemo(() => {
    const mapa = new Map()
    for (const c of consultas) {
      if (!c.citaId) continue
      const previa = mapa.get(c.citaId)
      if (!previa || (c.creadoEn || "") > (previa.creadoEn || "")) mapa.set(c.citaId, { fecha: c.fecha, creadoEn: c.creadoEn })
    }
    return mapa
  }, [consultas])

  const tituloDia = (dia) => {
    const objFecha = parseFechaFlexible(dia)
    return {
      etiqueta: etiquetaFecha(dia),
      diaNum: objFecha ? String(objFecha.getDate()).padStart(2, "0") : "--",
      mes: objFecha ? objFecha.toLocaleDateString("es-EC", { month: "short" }).replace(".", "") : "DÍA",
    }
  }

  // ── Vista por día / por mes (reunión 29 sept., punto 12 del plan) — "día"
  // es la lista agrupada de siempre (grupos, de arriba), sin cambios. "mes"
  // es un calendario nuevo que reutiliza el mismo `grupos` (mismos filtros,
  // misma búsqueda) solo que indexado por fecha para pintar un contador por
  // día y abrir el detalle en un modal. ──
  const [vista, setVistaState] = useState(leerVistaGuardada) // lista | semana | mes
  const setVista = (v) => {
    setVistaState(v)
    try { localStorage.setItem(CLAVE_VISTA, v) } catch { /* sin almacenamiento: no se recuerda */ }
  }
  const [cabeSemana, setCabeSemana] = useState(() => (typeof window === "undefined" || !window.matchMedia ? true : window.matchMedia(CONSULTA_ANCHO_SEMANA).matches))
  useEffect(() => {
    if (!window.matchMedia) return
    const mq = window.matchMedia(CONSULTA_ANCHO_SEMANA)
    const alCambiar = () => setCabeSemana(mq.matches)
    mq.addEventListener("change", alCambiar)
    return () => mq.removeEventListener("change", alCambiar)
  }, [])
  // La preferencia guardada se respeta, pero en pantallas angostas la semana
  // se muestra como lista (sin pisar lo que la persona eligió).
  const vistaActiva = vista === "semana" && !cabeSemana ? "lista" : vista
  const [mesVista, setMesVista] = useState(() => { const h = new Date(); return new Date(h.getFullYear(), h.getMonth(), 1) })
  const [diaModalMes, setDiaModalMes] = useState(null) // fecha (iso) del día clickeado, o null

  // "Hoy" vuelve a la agenda de hoy: sin rango, sin filtros de estado ni
  // "por registrar", y lleva el periodo de la vista actual a hoy: la lista
  // vuelve a hoy, la semana a la semana actual, el mes al mes actual.
  const irAHoy = () => {
    setRangoDesde("")
    setRangoHasta("")
    setFiltro("todas")
    setSoloPorRegistrar(false)
    setBusqueda("")
    const h = new Date()
    setMesVista(new Date(h.getFullYear(), h.getMonth(), 1))
    setSemanaLunes(lunesDeSemana(hoyISO()))
  }
  const moverRango = (sentido) => {
    const r = desplazarRango(rangoDesde, rangoHasta, sentido, hoyISO())
    setRangoDesde(r.desde)
    setRangoHasta(r.hasta)
  }

  const gruposPorFecha = useMemo(() => new Map(agruparPorDia(filtradasBase)), [filtradasBase])

  const diasDelMes = useMemo(() => {
    const primerDia = new Date(mesVista.getFullYear(), mesVista.getMonth(), 1)
    const ultimoDia = new Date(mesVista.getFullYear(), mesVista.getMonth() + 1, 0)
    const offset = (primerDia.getDay() + 6) % 7 // semana empieza en lunes
    const arr = []
    for (let i = 0; i < offset; i++) arr.push(null)
    for (let n = 1; n <= ultimoDia.getDate(); n++) {
      arr.push(fechaAISO(new Date(mesVista.getFullYear(), mesVista.getMonth(), n)))
    }
    return arr
  }, [mesVista])

  const irMesAnterior = () => setMesVista((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
  const irMesSiguiente = () => setMesVista((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))

  const citasDelDiaModal = diaModalMes ? (gruposPorFecha.get(diaModalMes) || []) : []
  const gruposEstadoModal = ORDEN_ESTADOS_MODAL
    .map((estado) => [estado, citasDelDiaModal.filter((c) => c.estado === estado)])
    .filter(([, arr]) => arr.length > 0)

  // Accesibilidad de modales (audit UX, Lote 1, punto 1c) — un hook por
  // modal, cada uno gateado por el mismo booleano/valor que ya controla su
  // renderizado condicional más abajo.
  const refModalAgendar = useModalAccesible(modalAbierto, cerrarModal)
  const refModalCompletarRegistro = useModalAccesible(!!completarPara, cerrarCompletarRegistro)
  const refModalCancelar = useModalAccesible(porCancelar != null, () => setPorCancelar(null))
  const refModalReagendar = useModalAccesible(reagendando, cerrarReagendar)
  const refModalMover = useModalAccesible(!!moviendo, () => setMoviendo(null))
  const refModalReagendada = useModalAccesible(!!reagendada, () => setReagendada(null))
  const refModalDiaMes = useModalAccesible(!!diaModalMes, () => setDiaModalMes(null))

  // Los KPIs son también los filtros de estado. En Lista van en su propia fila;
  // en Semana y Mes, que necesitan toda la altura, se compactan dentro de la
  // fila de control.
  const kpiBotones = (
    <>
          <KpiBoton icono={CalendarDays} valor={citas.length} etiqueta={vistaActiva === "lista" ? "Total agendadas" : "Total"} tono="slate" activo={filtro === "todas"} compacto={vistaActiva !== "lista"} onClick={() => setFiltro("todas")} />
          <KpiBoton icono={Sun} valor={totalHoy} etiqueta={vistaActiva === "lista" ? "Citas de hoy" : "Hoy"} tono="blue" activo={filtro === "hoy"} compacto={vistaActiva !== "lista"} onClick={() => { setFiltro("hoy"); setMesVista(new Date(new Date().getFullYear(), new Date().getMonth(), 1)) }} />
          <KpiBoton icono={CalendarClock} valor={totalProximas} etiqueta={vistaActiva === "lista" ? "Próximas (futuras)" : "Próximas"} tono="amber" activo={filtro === "proximas"} compacto={vistaActiva !== "lista"} onClick={() => setFiltro("proximas")} />
          <KpiBoton icono={CalendarCheck} valor={totalAtendidas} etiqueta={vistaActiva === "lista" ? "Ya atendidas" : "Atendidas"} tono="emerald" activo={filtro === "atendidas"} compacto={vistaActiva !== "lista"} onClick={() => setFiltro("atendidas")} />
    </>
  )

  // Un día de la lista: rail con la fecha + sus tarjetas (colapsable).
  const renderDia = ([dia, citasDia]) => {
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
                  <span className="font-serif text-lg font-semibold leading-none">{t.diaNum}</span>
                  <span className={"mt-0.5 text-xs font-semibold uppercase " + (hoyDia ? "text-white/60" : "text-slate-500")}>{t.mes}</span>
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
                  {citasDia.map((cita) => (
                    <TarjetaCita
                      key={cita.id}
                      cita={cita}
                      motivosConsulta={motivosConsulta}
                      fechaRealPorCitaId={fechaRealPorCitaId}
                      marcandoEstadoId={marcandoEstadoId}
                      menuAccionesId={menuAccionesId}
                      onVerPerfil={onVerPerfil}
                      cobroPendiente={pendientesPorCita.has(cita.id)}
                        onCobrar={cobrarCita}
                        onAtender={atenderCita}
                      onAbrirMenuAcciones={abrirMenuAcciones}
                    />
                  ))}
                </div>
                )}
              </div>
            </div>
          )
  }

  // Hoy sin citas nunca deja la pantalla en blanco: se avisa y se muestra lo
  // más cercano (criterio 1 del ingeniero).
  const anterioresVisibles = anterioresAbierto || (grupos.length === 0 && totalAnteriores > 0)
  const avisoSinCitasHoy = hayRango || filtro !== "todas" || soloPorRegistrar || busqueda
    ? null
    : grupos.length === 0
      ? "No hay citas próximas. Debajo está lo último atendido."
      : grupos[0][0] !== hoyISO()
        ? `Hoy no hay citas. Lo próximo es ${etiquetaFecha(grupos[0][0])}.`
        : null

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
        <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row sm:items-center">
          {/* Buscar y crear son las dos entradas de la pantalla — juntas, en el
              encabezado (propuesta de flujo de atención, Ronda 1). */}
          <div className="relative w-full sm:w-72">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
            <label htmlFor="citas-busqueda" className="sr-only">Buscar paciente o código de cita</label>
            <input
              id="citas-busqueda"
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar paciente o código..."
              className="w-full rounded-xl border border-slate-200/60 bg-white py-3 pl-9 pr-3 text-sm text-slate-800 shadow-sm outline-none transition focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100"
            />
          </div>
          {/* "Agendar cita" existía como botón aparte, más limitado (fecha en
              blanco, y sin forma de crear un paciente nuevo si no había
              ninguno todavía) — "Gestionar" ya cubre ese caso y más, así que
              se quedó como el único punto de entrada (feedback de Diego). */}
          <button
            type="button"
            onClick={() => abrirModal()}
            className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            style={{ background: GRAD, boxShadow: "0 14px 28px -12px rgba(37,99,235,0.6)" }}
          >
            <UserPlus size={18} />
            Gestionar cita
          </button>
        </div>
      </div>

      {/* ─── KPIs / FILTROS ─── */}
      {vistaActiva === "lista" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {kpiBotones}
        </div>
      )}

      {/* ─── ÉXITO ─── */}
      {mensajeExito && (
        <div role="status" className="flex items-center gap-3 rounded-xl border border-emerald-200/60 bg-emerald-50 p-4 text-emerald-900">
          <CheckCircle2 className="text-emerald-500" size={20} />
          <p className="text-sm font-semibold">{mensajeExito}</p>
        </div>
      )}

      {/* ─── ERROR (cancelar / cambiar estado / reagendar) ─── */}
      {bannerError && (
        <div role="alert" className="flex items-center gap-3 rounded-xl border border-red-200/60 bg-red-50 p-4 text-red-900">
          <AlertTriangle className="text-red-500" size={20} />
          <p className="text-sm font-semibold">{bannerError}</p>
        </div>
      )}

      {/* ─── UNA SOLA FILA DE CONTROL: Hoy · Día|Mes · rango · por registrar ─── */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={irAHoy}
          className="rounded-xl border border-slate-200/60 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 cursor-pointer"
        >
          Hoy
        </button>
        {/* Selector de vista: la lista sirve para ejecutar el día (Atender,
            Cobrar) y la semana/el mes para planificar. Conviven sobre los
            mismos datos. La semana no se ofrece donde no cabe. */}
        <div className="flex items-center gap-1 rounded-xl border border-slate-200/60 bg-white p-1 shadow-sm" role="group" aria-label="Vista de citas">
          {[
            { key: "lista", label: "Lista", Icono: List },
            ...(cabeSemana ? [{ key: "semana", label: "Semana", Icono: Calendar }] : []),
            { key: "mes", label: "Mes", Icono: CalendarDays },
          ].map((op) => (
            <button
              key={op.key}
              type="button"
              onClick={() => setVista(op.key)}
              aria-pressed={vistaActiva === op.key}
              className={"flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer " + (vistaActiva === op.key ? "text-white" : "text-slate-500 hover:bg-slate-50")}
              style={vistaActiva === op.key ? { background: GRAD } : undefined}
            >
              <op.Icono size={14} aria-hidden="true" />
              {op.label}
            </button>
          ))}
        </div>
        {/* Flechas del periodo en la misma fila: semana o mes según la vista
            (la lista usa su propio rango de fechas, justo debajo). */}
        {(vistaActiva === "semana" || vistaActiva === "mes") && (
          <div className="flex items-center gap-1 rounded-xl border border-slate-200/60 bg-white p-1 shadow-sm">
            <button
              type="button"
              onClick={() => (vistaActiva === "semana" ? setSemanaLunes((l) => sumarDiasISO(l, -7)) : irMesAnterior())}
              aria-label={vistaActiva === "semana" ? "Semana anterior" : "Mes anterior"}
              title={vistaActiva === "semana" ? "Semana anterior" : "Mes anterior"}
              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => (vistaActiva === "semana" ? setSemanaLunes((l) => sumarDiasISO(l, 7)) : irMesSiguiente())}
              aria-label={vistaActiva === "semana" ? "Semana siguiente" : "Mes siguiente"}
              title={vistaActiva === "semana" ? "Semana siguiente" : "Mes siguiente"}
              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
        {/* Rango de fechas (pedido del 29 sept.) con flechas para ir a la
            semana anterior o siguiente sin escribir fechas. Hacia atrás y
            hacia adelante. Solo aplica a la vista Día. */}
        {vistaActiva === "lista" && (
          <div className="flex items-center gap-1 rounded-xl border border-slate-200/60 bg-white p-1 shadow-sm">
            <button type="button" onClick={() => moverRango(-1)} aria-label="Semana anterior" title="Semana anterior" className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer">
              <ChevronLeft size={16} />
            </button>
            <CalendarRange size={14} className="shrink-0 text-slate-400" aria-hidden="true" />
            <label htmlFor="rango-desde" className="sr-only">Desde</label>
            <input
              id="rango-desde"
              type="date"
              value={rangoDesde}
              onChange={(e) => setRangoDesde(e.target.value)}
              max={rangoHasta || undefined}
              className="rounded-lg bg-transparent px-1.5 py-1 text-xs font-semibold text-slate-600 outline-none"
            />
            <span className="text-xs text-slate-400">–</span>
            <label htmlFor="rango-hasta" className="sr-only">Hasta</label>
            <input
              id="rango-hasta"
              type="date"
              value={rangoHasta}
              onChange={(e) => setRangoHasta(e.target.value)}
              min={rangoDesde || undefined}
              className="rounded-lg bg-transparent px-1.5 py-1 text-xs font-semibold text-slate-600 outline-none"
            />
            {hayRango && (
              <button
                type="button"
                onClick={() => { setRangoDesde(""); setRangoHasta("") }}
                aria-label="Limpiar rango de fechas"
                title="Limpiar rango de fechas"
                className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 cursor-pointer"
              >
                <X size={13} />
              </button>
            )}
            <button type="button" onClick={() => moverRango(1)} aria-label="Semana siguiente" title="Semana siguiente" className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 cursor-pointer">
              <ChevronRight size={16} />
            </button>
          </div>
        )}
        {vistaActiva !== "lista" && <div className="ml-auto flex flex-wrap items-center gap-2">{kpiBotones}</div>}
        {totalPorRegistrar > 0 && (
          <button
            type="button"
            onClick={() => setSoloPorRegistrar((v) => !v)}
            aria-pressed={soloPorRegistrar}
            title="Citas agendadas en línea cuyo paciente aún no está registrado"
            className={"flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors cursor-pointer " + (soloPorRegistrar ? "border-amber-300 bg-amber-100 text-amber-800" : "border-amber-200/60 bg-amber-50 text-amber-700 hover:bg-amber-100")}
          >
            <UserPlus size={13} aria-hidden="true" />
            {totalPorRegistrar} por registrar
          </button>
        )}
      </div>

      {/* ─── LISTADO ─── */}
      {cargaInicial && citas.length === 0 ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="relative overflow-hidden rounded-2xl border border-slate-200/60 bg-white p-5 pl-6 shadow-sm">
              <div className="absolute inset-y-0 left-0 w-1.5 animate-pulse bg-slate-200/70" aria-hidden="true" />
              <div className="mb-4 h-5 w-24 animate-pulse rounded-md bg-slate-200/70" />
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-slate-200/70" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-2/3 animate-pulse rounded bg-slate-200/70" />
                  <div className="h-2.5 w-1/3 animate-pulse rounded bg-slate-200/60" />
                </div>
              </div>
              <div className="mt-4 h-5 w-20 animate-pulse rounded-full bg-slate-200/60" />
            </div>
          ))}
        </div>
      ) : vistaActiva === "semana" ? (
        <CalendarioSemanal
          lunes={semanaLunes}
          citas={citas}
          disponibilidad={disponibilidad}
          cobroPendienteIds={pendientesPorCita}
          citasVisibles={filtradasPorEstado}
          coincide={textoBusqueda ? coincideBusqueda : null}
          aviso={avisoBusquedaSemana}
          onDiaClick={(iso) => {
            // Un día de la semana → ese día en la lista.
            setRangoDesde(iso)
            setRangoHasta(iso)
            setFiltro("todas")
            setSoloPorRegistrar(false)
            setVista("lista")
          }}
          onAtender={atenderCita}
          onEditar={abrirReagendar}
          onCancelar={(cita) => setPorCancelar(cita.id)}
          onCobrar={cobrarCita}
          onHuecoLibre={abrirModalEn}
          onMover={pedirMovimiento}
        />
      ) : vistaActiva === "mes" ? (
        <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-bold capitalize" style={{ color: INK }}>{MESES[mesVista.getMonth()]} {mesVista.getFullYear()}</span>
          </div>
          <div className="mb-2 grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-500">
            {DIAS_CORTOS.map((d, i) => (<span key={i}>{d}</span>))}
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {diasDelMes.map((iso, i) => {
              if (!iso) return <span key={`vacio-${i}`} />
              const citasDia = gruposPorFecha.get(iso) || []
              const hoyDia = iso === hoyISO()
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => {
                    // Un día del mes → esa semana en la vista Semana (si la
                    // pantalla es angosta y no cabe, se conserva el detalle
                    // del día en el modal de siempre).
                    if (cabeSemana) { setSemanaLunes(lunesDeSemana(iso)); setVista("semana") } else setDiaModalMes(iso)
                  }}
                  title={citasDia.length > 0 ? `${citasDia.length} ${citasDia.length === 1 ? "cita" : "citas"}` : "Sin citas"}
                  className={
                    "relative flex h-16 flex-col items-center justify-center gap-1 rounded-xl border text-sm font-bold transition-all cursor-pointer " +
                    (citasDia.length > 0
                      ? "border-blue-200/60 bg-blue-50/50 text-slate-700 hover:border-blue-400"
                      : "border-slate-200/60 bg-white text-slate-400 hover:border-slate-300") +
                    (hoyDia ? " ring-2 ring-blue-500 ring-offset-1" : "")
                  }
                >
                  <span>{Number(iso.slice(-2))}</span>
                  {citasDia.length > 0 && (
                    <span className="rounded-full px-1.5 py-px text-[10px] font-bold text-white" style={{ background: GRAD }}>{citasDia.length}</span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ) : grupos.length === 0 && totalAnteriores === 0 ? (
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
          {avisoSinCitasHoy && (
            <p role="status" className="rounded-xl border border-slate-200/60 bg-white px-4 py-3 text-sm text-slate-600">
              {avisoSinCitasHoy}
            </p>
          )}
          {grupos.map(renderDia)}
          {totalAnteriores > 0 && (
            <section aria-label="Citas anteriores">
              <button
                type="button"
                onClick={() => setAnterioresAbierto((v) => !v)}
                aria-expanded={anterioresVisibles}
                className="flex w-full items-center gap-2 rounded-xl border border-slate-200/60 bg-white px-4 py-3 text-left transition-colors hover:bg-slate-50 cursor-pointer"
              >
                <ChevronDown size={16} className={"shrink-0 text-slate-500 transition-transform " + (anterioresVisibles ? "" : "-rotate-90")} aria-hidden="true" />
                <span className="text-sm font-bold" style={{ color: INK }}>Anteriores</span>
                <span className="text-xs text-slate-500">· {totalAnteriores} {totalAnteriores === 1 ? "cita" : "citas"}, de la más reciente a la más antigua</span>
              </button>
              {anterioresVisibles && <div className="mt-6 space-y-8">{gruposAnteriores.map(renderDia)}</div>}
            </section>
          )}
        </div>
      )}

      {/* ─── MODAL "CITAS DEL DÍA" (vista por mes) ─── */}
      {diaModalMes && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={() => setDiaModalMes(null)}>
          <div ref={refModalDiaMes} role="dialog" aria-modal="true" aria-labelledby="citas-modal-dia-titulo" className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-2xl" style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)", willChange: "transform, opacity" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h4 id="citas-modal-dia-titulo" className="text-lg font-bold capitalize" style={{ color: INK }}>{etiquetaFecha(diaModalMes)}</h4>
                <p className="text-xs text-slate-500">{citasDelDiaModal.length} {citasDelDiaModal.length === 1 ? "cita" : "citas"} registradas</p>
              </div>
              <button type="button" onClick={() => setDiaModalMes(null)} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              {citasDelDiaModal.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
                  <p className="text-sm font-medium text-slate-500">Sin citas registradas este día.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {gruposEstadoModal.map(([estado, citasEstado]) => (
                    <div key={estado}>
                      <h5 className="mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                        {estado === "Atendida" ? "Atendidas" : estado === "En Atención" ? "En atención" : estado === "No Asistió" ? "No asistió" : estado}
                        <span className="text-slate-400">· {citasEstado.length}</span>
                      </h5>
                      <div className="grid grid-cols-1 gap-4">
                        {citasEstado.map((cita) => (
                          <TarjetaCita
                            key={cita.id}
                            cita={cita}
                            motivosConsulta={motivosConsulta}
                            fechaRealPorCitaId={fechaRealPorCitaId}
                            marcandoEstadoId={marcandoEstadoId}
                            menuAccionesId={menuAccionesId}
                            onVerPerfil={onVerPerfil}
                            cobroPendiente={pendientesPorCita.has(cita.id)}
                        onCobrar={cobrarCita}
                        onAtender={atenderCita}
                            onAbrirMenuAcciones={abrirMenuAcciones}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* ─── MODAL AGENDAR ─── */}
      {modalAbierto && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={cerrarModal}>
          <div ref={refModalAgendar} role="dialog" aria-modal="true" aria-labelledby="citas-modal-agendar-titulo" className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-2xl" style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)", willChange: "transform, opacity" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: GRAD }}>
                  <UserPlus size={20} />
                </div>
                <div>
                  <h4 id="citas-modal-agendar-titulo" className="text-lg font-bold" style={{ color: INK }}>Gestionar cita</h4>
                  <p className="text-xs text-slate-500">Busca al paciente o regístralo si acaba de llegar.</p>
                </div>
              </div>
              <button type="button" onClick={cerrarModal} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={validarYPedirConfirmacion} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                {error && (
                  <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200/60 bg-red-50 p-3 text-sm font-medium text-red-700">
                    <AlertTriangle size={16} />
                    {error}
                  </div>
                )}

                <div className="relative" ref={dropdownRef}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <label className="block text-sm font-semibold text-slate-700">Paciente</label>
                      {!mostrarNuevoPaciente && (
                        <button
                          type="button"
                          onClick={() => { setMostrarNuevoPaciente(true); setPacienteId(null); setBusquedaPaciente("") }}
                          className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"
                        >
                          <UserPlus size={13} /> Añadir nuevo paciente
                        </button>
                      )}
                    </div>

                    {mostrarNuevoPaciente ? (
                      <div className="space-y-3 rounded-xl border border-blue-100 bg-blue-50/40 p-3.5">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-blue-700">Datos del paciente nuevo</p>
                          <button type="button" onClick={() => setMostrarNuevoPaciente(false)} className="text-xs font-semibold text-slate-500 hover:text-slate-700 cursor-pointer">Cancelar</button>
                        </div>
                        <div>
                          <input
                            type="text" placeholder="Nombre completo" value={npNombre}
                            onChange={(e) => setNpNombre(filtrarSoloLetras(e.target.value))}
                            className={"w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none transition focus-visible:ring-2 " + (npErrores.nombre ? "border-red-400 focus-visible:ring-red-100" : "border-slate-200/60 focus-visible:border-blue-500 focus-visible:ring-blue-50")}
                          />
                          {npErrores.nombre && <p className="mt-1 text-xs font-medium text-red-600">{npErrores.nombre}</p>}
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <div className="relative">
                              <IdCard size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                              <input
                                type="text" inputMode="numeric" maxLength={10} placeholder="Cédula" value={npCedula}
                                onChange={(e) => setNpCedula(filtrarSoloNumeros(e.target.value, 10))}
                                className={"w-full rounded-lg border bg-white py-2 pl-8 pr-2 font-mono text-sm outline-none transition focus-visible:ring-2 " + (npErrores.cedula ? "border-red-400 focus-visible:ring-red-100" : "border-slate-200/60 focus-visible:border-blue-500 focus-visible:ring-blue-50")}
                              />
                            </div>
                            {npErrores.cedula && <p className="mt-1 text-xs font-medium text-red-600">{npErrores.cedula}</p>}
                          </div>
                          <div>
                            <div className="relative">
                              <Phone size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                              <input
                                type="text" inputMode="numeric" maxLength={10} placeholder="Teléfono" value={npTelefono}
                                onChange={(e) => setNpTelefono(filtrarSoloNumeros(e.target.value, 10))}
                                className={"w-full rounded-lg border bg-white py-2 pl-8 pr-2 text-sm outline-none transition focus-visible:ring-2 " + (npErrores.telefono ? "border-red-400 focus-visible:ring-red-100" : "border-slate-200/60 focus-visible:border-blue-500 focus-visible:ring-blue-50")}
                              />
                            </div>
                            {npErrores.telefono && <p className="mt-1 text-xs font-medium text-red-600">{npErrores.telefono}</p>}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <div className="relative">
                              <Mail size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                              <input
                                type="email" placeholder="Correo (opcional)" value={npCorreo}
                                onChange={(e) => setNpCorreo(e.target.value)}
                                className={"w-full rounded-lg border bg-white py-2 pl-8 pr-2 text-sm outline-none transition focus-visible:ring-2 " + (npErrores.correo ? "border-red-400 focus-visible:ring-red-100" : "border-slate-200/60 focus-visible:border-blue-500 focus-visible:ring-blue-50")}
                              />
                            </div>
                            {npErrores.correo && <p className="mt-1 text-xs font-medium text-red-600">{npErrores.correo}</p>}
                          </div>
                          <div className="relative">
                            <Cake size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                              type="date" value={npFechaNacimiento}
                              onChange={(e) => setNpFechaNacimiento(e.target.value)}
                              className="w-full rounded-lg border border-slate-200/60 bg-white py-2 pl-8 pr-2 text-sm outline-none transition focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-50"
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={npGuardando}
                          onClick={guardarNuevoPacienteInline}
                          className="w-full rounded-lg bg-blue-600 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                        >
                          {npGuardando ? "Registrando…" : "Registrar y seleccionar"}
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="relative">
                          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                          <input
                            type="text"
                            value={busquedaPaciente}
                            onFocus={() => setMostrarDropdown(true)}
                            onChange={(e) => { setBusquedaPaciente(e.target.value); setPacienteId(null); setMostrarDropdown(true) }}
                            placeholder="Escriba para buscar por nombre o cédula..."
                            className="w-full rounded-xl border border-slate-200/60 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50"
                          />
                        </div>
                        {mostrarDropdown && pacientesFiltrados.length > 0 && (
                          <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200/60 bg-white shadow-lg">
                            {pacientesFiltrados.map((p) => (
                              <li
                                key={p.id}
                                className="flex items-center justify-between gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                              >
                                <button
                                  type="button"
                                  onClick={() => seleccionarPaciente(p)}
                                  className="flex min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 text-left"
                                >
                                  <span className="truncate font-semibold">{p.nombre}</span>
                                  {p.cedula && <span className="shrink-0 font-mono text-xs text-slate-500">{p.cedula}</span>}
                                </button>
                                {/* Ya está registrado — atajo directo a su perfil completo
                                    (ficha clínica, historial, etc.) sin tener que salir de
                                    acá, buscarlo de nuevo en Pacientes. */}
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); cerrarModal(); onVerPerfil?.(p.id) }}
                                  title="Ver perfil del paciente"
                                  aria-label="Ver perfil del paciente"
                                  className="shrink-0 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-blue-100 hover:text-blue-700 cursor-pointer"
                                >
                                  <Eye size={15} />
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </>
                    )}
                  </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Motivo del examen</label>
                  <select
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50"
                  >
                    <option value="" disabled>Seleccione el motivo del examen</option>
                    {motivosConsulta.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                {/* Atajo para un paciente que ya está en el local ahora mismo
                    (walk-in o llegó antes/después de su turno) — precarga la
                    hora real y marca la cita para pasar directo a "En
                    Atención" al confirmar, sin forzarlo a elegir un bloque de
                    la grilla de 30/40 min. Pedido explícito: "Atender Ahora /
                    Hora Actual", cero fricción cuando el paciente ya llegó. */}
                <button
                  type="button"
                  onClick={() => {
                    const ahora = new Date()
                    const hhmm = `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`
                    setFecha(hoyISO())
                    setHoraPersonalizada(true)
                    setHoraCustom(hhmm)
                    setAtenderInmediato(true)
                    setErrorHorarioCustom("")
                  }}
                  className={"flex w-full items-center gap-2.5 rounded-xl border p-3.5 text-left transition cursor-pointer " + (atenderInmediato ? "border-blue-300 bg-blue-50/60" : "border-slate-200/60 bg-white hover:border-blue-200/60 hover:bg-blue-50/30")}
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white" style={{ background: GRAD }}>
                    <Zap size={16} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-bold" style={{ color: INK }}>Atender ahora (hora actual)</span>
                    <span className="block text-xs text-slate-500">El paciente ya está aquí — usa la hora de este momento y pasa directo a la ficha clínica al confirmar.</span>
                  </span>
                </button>

                <SelectorFechaHora
                  disponibilidad={disponibilidad}
                  citas={citas}
                  fecha={fecha}
                  hora={horaPersonalizada ? "" : hora}
                  onCambiarFecha={setFecha}
                  onCambiarHora={(h) => { setHora(h); setAtenderInmediato(false) }}
                />

                {/* Horario personalizado — para un paciente que llega fuera de
                    la grilla de horarios fijos (walk-in, o alguien a quien se
                    decide atender antes/después de su turno). El ing lo probó
                    en vivo preguntando "¿qué pasa si te atiendo a las 3:40?". */}
                <div className="rounded-xl border border-slate-200/60 bg-slate-50/60 p-3.5">
                  <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={horaPersonalizada}
                      onChange={(e) => { setHoraPersonalizada(e.target.checked); setErrorHorarioCustom(""); if (!e.target.checked) setAtenderInmediato(false) }}
                      className="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus-visible:ring-blue-500"
                    />
                    Llegó en un horario diferente al de la grilla
                  </label>
                  {horaPersonalizada && (
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-500">Hora real</label>
                        <input
                          type="time"
                          value={horaCustom}
                          onChange={(e) => { setHoraCustom(e.target.value); setErrorHorarioCustom("") }}
                          className="w-full rounded-lg border border-slate-200/60 bg-white px-2.5 py-2 text-sm outline-none transition focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-50"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-500">Duración estimada (min)</label>
                        <input
                          type="number"
                          min={5}
                          step={5}
                          value={duracionCustom}
                          onChange={(e) => { setDuracionCustom(e.target.value); setErrorHorarioCustom("") }}
                          className="w-full rounded-lg border border-slate-200/60 bg-white px-2.5 py-2 text-sm outline-none transition focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-50"
                        />
                      </div>
                      {errorHorarioCustom && (
                        <p className="col-span-2 text-xs font-medium text-red-600">{errorHorarioCustom}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-5 py-4">
                <button type="button" onClick={cerrarModal} className="rounded-xl border border-slate-200/60 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 cursor-pointer" style={{ background: GRAD, boxShadow: "0 12px 24px -12px rgba(37,99,235,0.6)" }}>
                  {atenderInmediato ? "Atender ahora" : "Confirmar cita"}
                  <ChevronRight size={16} />
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ─── CONFIRMACIÓN DE AGENDAMIENTO ─── */}
      {confirmando && (
        <ConfirmarCitaModal
          paciente={pacienteSeleccionado?.nombre}
          motivo={motivo}
          fecha={fecha ? isoAFechaLocal(fecha).toLocaleDateString("es-EC", { day: "numeric", month: "long", year: "numeric" }) : ""}
          hora={horaPersonalizada ? `${horaA12(horaCustom)}${atenderInmediato ? " (ahora)" : ` (personalizada, ~${duracionCustom} min)`}` : hora}
          onCancelar={() => setConfirmando(false)}
          onConfirmar={agendarCita}
          etiquetaConfirmar={atenderInmediato ? "Atender ahora" : "Confirmar"}
        />
      )}

      {/* ─── RESUMEN PREVIO A "ATENDER" (punto 1, reunión 29 sept.) ─── */}
      {resumenPara && (
        <ConfirmarCitaModal
          titulo="Resumen de la cita"
          subtitulo={
            resumenPara.fecha !== hoyISO()
              ? `Esta cita está agendada para ${etiquetaFecha(resumenPara.fecha)}. Se atenderá hoy y la fecha agendada no cambia.`
              : "Revisa los datos antes de entrar a la ficha clínica."
          }
          paciente={resumenPara.paciente}
          motivo={resumenPara.motivo}
          fecha={etiquetaFecha(resumenPara.fecha)}
          hora={resumenPara.hora}
          onCancelar={() => setResumenPara(null)}
          onConfirmar={() => { const cita = resumenPara; setResumenPara(null); ingresarAFicha(cita) }}
          etiquetaCancelar="Cerrar"
          etiquetaConfirmar={resumenPara.fecha !== hoyISO() ? "Atender hoy" : "Ingresar a la ficha clínica"}
        />
      )}

      {/* ─── PANEL DE COBRO (cobro pendiente de una cita en atención) ─── */}
      {cobrandoCita && (() => {
        const paciente = pacientes.find((p) => p.id === cobrandoCita.pacienteId)
        const consulta = pendientesPorCita.get(cobrandoCita.id)
        if (!paciente || !consulta) return null
        return (
          <FacturaVentaModal
            usuario={usuario}
            inventario={inventario}
            setInventario={setInventario}
            pacienteFijo={paciente}
            titulo={`Cobrar la atención de ${paciente.nombre}`}
            subtitulo={`Consulta${consulta.motivo ? ` · ${consulta.motivo}` : ""}`}
            etiquetaGuardar="Cobrar y finalizar"
            lineasIniciales={lineasCobroConsulta(consulta, parametrizacion)}
            consultaId={consulta.id}
            citaId={cobrandoCita.id}
            onGuardado={alCobrarCita}
            onCerrar={() => setCobrandoCita(null)}
          />
        )
      })()}

      {/* ─── COMPLETAR REGISTRO DEL PACIENTE (Atender sobre una cita sin paciente vinculado) ─── */}
      {completarPara && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={cerrarCompletarRegistro}>
          <div ref={refModalCompletarRegistro} role="dialog" aria-modal="true" aria-labelledby="citas-modal-completar-titulo" className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-2xl" style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)", willChange: "transform, opacity" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: GRAD }}>
                  <UserPlus size={20} />
                </div>
                <div>
                  <h4 id="citas-modal-completar-titulo" className="text-lg font-bold" style={{ color: INK }}>{cpSoloRegistro ? "Crear paciente" : "Completar registro"}</h4>
                  <p className="text-xs text-slate-500">
                    {cpSoloRegistro ? "Regístralo con los datos de su cita para dejarlo vinculado." : "Antes de abrir la ficha clínica, confirma sus datos."}
                  </p>
                </div>
              </div>
              <button type="button" onClick={cerrarCompletarRegistro} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={guardarCompletarRegistro} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto p-5">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Nombre completo</label>
                  <input
                    type="text" value={cpNombre} onChange={(e) => setCpNombre(filtrarSoloLetras(e.target.value))}
                    className={"w-full rounded-xl border bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus-visible:bg-white focus-visible:ring-2 " + (cpErrores.nombre ? "border-red-400 focus-visible:ring-red-100" : "border-slate-200/60 focus-visible:border-blue-500 focus-visible:ring-blue-50")}
                  />
                  {cpErrores.nombre && <p className="mt-1 text-xs font-medium text-red-600">{cpErrores.nombre}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Cédula</label>
                    <div className="relative">
                      <IdCard size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text" inputMode="numeric" maxLength={10} value={cpCedula}
                        onChange={(e) => setCpCedula(filtrarSoloNumeros(e.target.value, 10))}
                        className={"w-full rounded-xl border bg-slate-50 py-2.5 pl-9 pr-3 font-mono text-sm outline-none transition focus-visible:bg-white focus-visible:ring-2 " + (cpErrores.cedula ? "border-red-400 focus-visible:ring-red-100" : "border-slate-200/60 focus-visible:border-blue-500 focus-visible:ring-blue-50")}
                      />
                    </div>
                    {cpErrores.cedula && <p className="mt-1 text-xs font-medium text-red-600">{cpErrores.cedula}</p>}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Teléfono</label>
                    <div className="relative">
                      <Phone size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text" inputMode="numeric" maxLength={10} value={cpTelefono}
                        onChange={(e) => setCpTelefono(filtrarSoloNumeros(e.target.value, 10))}
                        className={"w-full rounded-xl border bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus-visible:bg-white focus-visible:ring-2 " + (cpErrores.telefono ? "border-red-400 focus-visible:ring-red-100" : "border-slate-200/60 focus-visible:border-blue-500 focus-visible:ring-blue-50")}
                      />
                    </div>
                    {cpErrores.telefono && <p className="mt-1 text-xs font-medium text-red-600">{cpErrores.telefono}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Correo <span className="normal-case text-slate-500">(opcional)</span></label>
                    <div className="relative">
                      <Mail size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="email" value={cpCorreo} onChange={(e) => setCpCorreo(e.target.value)}
                        className={"w-full rounded-xl border bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus-visible:bg-white focus-visible:ring-2 " + (cpErrores.correo ? "border-red-400 focus-visible:ring-red-100" : "border-slate-200/60 focus-visible:border-blue-500 focus-visible:ring-blue-50")}
                      />
                    </div>
                    {cpErrores.correo && <p className="mt-1 text-xs font-medium text-red-600">{cpErrores.correo}</p>}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Nacimiento <span className="normal-case text-slate-500">(opcional)</span></label>
                    <div className="relative">
                      <Cake size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="date" value={cpFechaNacimiento} onChange={(e) => setCpFechaNacimiento(e.target.value)}
                        className="w-full rounded-xl border border-slate-200/60 bg-slate-50 py-2.5 pl-9 pr-3 text-sm outline-none transition focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-5 py-4">
                <button type="button" onClick={cerrarCompletarRegistro} className="rounded-xl border border-slate-200/60 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" disabled={cpGuardando} className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer" style={{ background: GRAD, boxShadow: "0 12px 24px -12px rgba(37,99,235,0.6)" }}>
                  {cpGuardando ? "Guardando…" : cpSoloRegistro ? "Crear paciente" : "Registrar y atender"}
                  <ChevronRight size={16} />
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ─── CONFIRMAR DATOS DEL PACIENTE (D2, reunión 29 sept.) ─── */}
      {confirmarDatosPara && (
        <ConfirmarDatosPacienteModal
          usuario={usuario}
          paciente={confirmarDatosPara.paciente}
          pacientes={pacientes}
          setPacientes={setPacientes}
          onConfirmado={(pacienteConfirmado) => {
            const { cita } = confirmarDatosPara
            setConfirmarDatosPara(null)
            marcarEstado(cita.id, "En Atención")
            onAtender?.(pacienteConfirmado, cita.id, cita.motivo)
          }}
          onCerrar={() => setConfirmarDatosPara(null)}
        />
      )}

      {/* ─── MODAL CANCELAR ─── */}
      {porCancelar != null && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={() => setPorCancelar(null)}>
          <div ref={refModalCancelar} role="dialog" aria-modal="true" aria-labelledby="citas-modal-cancelar-titulo" className="w-full max-w-sm rounded-2xl border border-slate-200/60 bg-white p-6 shadow-2xl" style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)", willChange: "transform, opacity" }} onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-red-50">
              <AlertTriangle size={24} className="text-red-500" />
            </div>
            <h4 id="citas-modal-cancelar-titulo" className="text-center text-lg font-bold" style={{ color: INK }}>¿Cancelar esta cita?</h4>
            <p className="mt-1.5 text-center text-sm text-slate-500">La cita queda marcada como Cancelada — el registro no se borra y se puede reagendar cuando quieras.</p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setPorCancelar(null)} className="flex-1 rounded-xl border border-slate-200/60 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer">
                Volver
              </button>
              <button type="button" onClick={confirmarCancelacion} className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 cursor-pointer">
                Sí, cancelar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ─── CONFIRMAR MOVIMIENTO (arrastrar y soltar en el calendario) ─── */}
      {moviendo && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={() => setMoviendo(null)}>
          <div ref={refModalMover} role="dialog" aria-modal="true" aria-labelledby="citas-modal-mover-titulo" className="w-full max-w-sm rounded-2xl border border-slate-200/60 bg-white p-6 shadow-2xl" style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)", willChange: "transform, opacity" }} onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-blue-50">
              <CalendarClock size={24} className="text-blue-600" />
            </div>
            <h4 id="citas-modal-mover-titulo" className="text-center text-lg font-bold" style={{ color: INK }}>
              ¿Mover la cita de {moviendo.cita.paciente} al {isoAFechaLocal(moviendo.fecha).toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long" })} a las {moviendo.hora}?
            </h4>
            <p className="mt-1.5 text-center text-sm text-slate-500">
              Ahora está {moviendo.cita.fecha === moviendo.fecha ? "ese mismo día" : "el " + isoAFechaLocal(moviendo.cita.fecha).toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long" })} a las {moviendo.cita.hora}. La cita se reagenda, no se crea otra.
            </p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setMoviendo(null)} className="flex-1 rounded-xl border border-slate-200/60 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer">
                Volver
              </button>
              <button type="button" onClick={confirmarMovimiento} disabled={guardandoMovimiento} className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60" style={{ background: GRAD }}>
                {guardandoMovimiento && <Loader2 size={14} className="animate-spin" />}
                Sí, mover
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ─── MODAL REAGENDAR ─── */}
      {reagendando && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={cerrarReagendar}>
          <div ref={refModalReagendar} role="dialog" aria-modal="true" aria-labelledby="citas-modal-reagendar-titulo" className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-2xl" style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)", willChange: "transform, opacity" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: GRAD }}>
                  <CalendarClock size={20} />
                </div>
                <div>
                  <h4 id="citas-modal-reagendar-titulo" className="text-lg font-bold" style={{ color: INK }}>Editar cita</h4>
                  <p className="text-xs text-slate-500">{reagendando.paciente}</p>
                </div>
              </div>
              <button type="button" onClick={cerrarReagendar} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={confirmarReagendar} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                {errorReagendar && (
                  <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200/60 bg-red-50 p-3 text-sm font-medium text-red-700">
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
                    className="w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50"
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

                {/* Excepción, no flujo normal: el estado lo deduce el sistema
                    (En atención al abrir la ficha, Atendida al cobrar, No
                    asistió a los 10 minutos). Esto solo sirve para deshacer un
                    estado puesto por error. */}
                <details className="rounded-xl border border-slate-200/60 bg-slate-50/60 p-3.5">
                  <summary className="cursor-pointer text-sm font-semibold text-slate-600">Corregir estado (excepción)</summary>
                  <p className="mt-2 text-xs text-slate-500">El estado cambia solo según lo que ocurre en la visita. Úsalo únicamente para deshacer un estado puesto por error.</p>
                  <label htmlFor="citas-estado-corregido" className="sr-only">Estado de la cita</label>
                  <select
                    id="citas-estado-corregido"
                    value={estadoCorregido}
                    onChange={(e) => setEstadoCorregido(e.target.value)}
                    className="mt-2 w-full rounded-xl border border-slate-200/60 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-50"
                  >
                    {ORDEN_ESTADOS_MODAL.map((e) => (
                      <option key={e} value={e}>{e === "En Atención" ? "En atención" : e === "No Asistió" ? "No asistió" : e}</option>
                    ))}
                  </select>
                </details>
              </div>

              <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-5 py-4">
                <button type="button" onClick={cerrarReagendar} className="rounded-xl border border-slate-200/60 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 cursor-pointer" style={{ background: GRAD, boxShadow: "0 12px 24px -12px rgba(37,99,235,0.6)" }}>
                  Guardar cambios
                  <ChevronRight size={16} />
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ─── CITA REAGENDADA: ofrecer avisar al paciente ─── */}
      {reagendada && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={() => setReagendada(null)}>
          <div ref={refModalReagendada} role="dialog" aria-modal="true" aria-labelledby="citas-modal-reagendada-titulo" className="w-full max-w-sm rounded-2xl border border-slate-200/60 bg-white p-6 shadow-2xl" style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)", willChange: "transform, opacity" }} onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-emerald-50">
              <CheckCircle2 size={24} className="text-emerald-600" />
            </div>
            <h4 id="citas-modal-reagendada-titulo" className="text-center text-lg font-bold" style={{ color: INK }}>Cita reagendada</h4>
            <p className="mt-1.5 text-center text-sm text-slate-500">
              {reagendada.paciente} ahora tiene su cita el <span className="font-semibold text-slate-700">{etiquetaFecha(reagendada.fecha)} a las {reagendada.hora}</span>. Ya se actualizó en su portal — ¿quieres avisarle también por WhatsApp?
            </p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setReagendada(null)} className="flex-1 rounded-xl border border-slate-200/60 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer">
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
        </div>,
        document.body
      )}

      {/* ─── MENÚ "MÁS ACCIONES" (portal, ver comentario junto a abrirMenuAcciones) — va al
          final del árbol a propósito: puede abrirse desde una tarjeta dentro del modal
          "Citas del día" (vista por mes), y como ambos son portales a document.body, el que
          se monta después queda visualmente encima. ─── */}
      {menuAccionesId != null && menuAccionesPos && (() => {
        const cita = citas.find((c) => c.id === menuAccionesId)
        if (!cita) return null
        // "No asistió" lo marca solo el sistema a los 10 minutos; a mano se
        // ofrece únicamente mientras la cita sigue pendiente y ya pasó su hora.
        const puedeMarcarNoAsistio = cita.estado === "Pendiente" && yaPasoLaHora(cita)
        return createPortal(
          <div
            ref={menuAccionesRef}
            className="fixed z-50 w-52 overflow-hidden rounded-xl border border-slate-200/60 bg-white py-1.5 text-left shadow-xl"
            style={{ top: menuAccionesPos.top, left: menuAccionesPos.left, animation: "menu-in 160ms ease-out", transformOrigin: "top right" }}
          >
            {!cita.pacienteId && (
              <>
                <button
                  type="button"
                  onClick={() => { setMenuAccionesId(null); registrarPacienteParaCita(cita) }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 cursor-pointer"
                >
                  <UserPlus size={15} /> Crear paciente
                </button>
                <div className="my-1 border-t border-slate-100" />
              </>
            )}
            {puedeMarcarNoAsistio && (
              <>
                <button
                  type="button"
                  onClick={() => { setMenuAccionesId(null); marcarEstado(cita.id, "No Asistió") }}
                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 cursor-pointer"
                >
                  <UserX size={15} /> No asistió
                </button>
                <div className="my-1 border-t border-slate-100" />
              </>
            )}
            <button
              type="button"
              onClick={() => { setMenuAccionesId(null); abrirReagendar(cita) }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer"
            >
              <CalendarClock size={15} /> Editar cita
            </button>
            <button
              type="button"
              onClick={() => { setMenuAccionesId(null); setPorCancelar(cita.id) }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 cursor-pointer"
            >
              <X size={15} /> Cancelar cita
            </button>
          </div>,
          document.body,
        )
      })()}
    </div>
  )
}