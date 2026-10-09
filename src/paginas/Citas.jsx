"use client"

import { fechaLegible, fechaCorta, formatoFecha, tituloSemana } from "../utilidades/formatoFecha"
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
  Loader2,
  Zap,
  Receipt,
  List,
} from "lucide-react"
import SelectorFechaHora from "../componentes/SelectorFechaHora"
import { diaHabilMasCercano } from "../utilidades/controles"
import CalendarioSemanal from "../componentes/CalendarioSemanal"
import CalendarioMes from "../componentes/CalendarioMes"
import ConfirmarCitaModal from "../componentes/ConfirmarCitaModal"
import ConfirmarDatosPacienteModal from "../componentes/ConfirmarDatosPacienteModal"
import DetalleCitaModal from "../componentes/DetalleCitaModal"
import DiaCitasModal from "../componentes/DiaCitasModal"
import { BarraBusquedaFiltros, PeriodoLista, NavegadorPeriodo, ConteoCitas } from "../componentes/FiltrosCitas"
import { colorDe } from "../componentes/calendarioComun"
import { etiquetaMiembro, miembrosActivos } from "../utilidades/equipo"
import { puedeReasignar, ausenteEnHorario } from "../utilidades/reasignacion"
import { lineaProfesional as textoProfesional, mostrarProfesional } from "../utilidades/profesionalCita"
import SelectorAsignado from "../componentes/SelectorAsignado"
import { esErrorHoraInvalida, MENSAJE_HORA_INVALIDA } from "../utilidades/erroresCitas"
import { puede } from "../utilidades/permisosUi"
import { diasAtencionAbierta, textoAtencionAbierta } from "../utilidades/atencionAbierta"
import ConfirmarDejarDeAtender from "../componentes/ConfirmarDejarDeAtender"
import { isoAFechaLocal, fechaAISO, esHoy, etiquetaFecha, parseFechaFlexible, minutosDesdeMedianoche, hoyISO, horaA12, conflictoHorarioPersonalizado, slotsDisponibles } from "../utilidades/disponibilidad"
import { filtrarSoloLetras, filtrarSoloNumeros } from "../utilidades/validaciones"
import { particionarAgenda, agruparPorDia, desplazarRango, ordenarCitas } from "../utilidades/agendaCitas"
import { citasParaReagendar } from "../utilidades/controles"
import { ESTADOS_FILTRO, periodosFiltro, tareasFiltro, proximoDiaDeAtencion, ORIGENES_FILTRO, SEGUIMIENTO_FILTRO, ESTADOS_DE_HISTORIAL, citaPasaFiltros, totalDelAlcance, puedeAtenderCita, requiereConfirmarOtroDia, esPrimeraVez } from "../utilidades/filtrosCitas"
import { lunesDeSemana, sumarDiasISO, minutosAHHMM, validarMovimiento } from "../utilidades/calendarioSemana"
import { registrarLog } from "../utilidades/logs"
import { cobrosPendientes, marcarCitaAtendidaDb } from "../utilidades/cobrosPendientes"
import { lineasCobroConsulta } from "../utilidades/costosConsulta"
import ComprobanteVentaModal from "./ComprobanteVentaModal"
import { crearRegistroPaciente, validarDatosPaciente } from "../utilidades/pacientes"
import { MENSAJE_SIN_PERMISO, esErrorSinPermiso, fueBloqueadoPorPermiso } from "../utilidades/permisos"
import { useModalAccesible } from "../utilidades/useModalAccesible"
import { INK } from "@/lib/tema"

// ─── Paleta de firma (consistente con el resto del sistema) ───
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)" // cian → azul

// Orden de los grupos por estado dentro del modal "Citas del día" (vista por
// mes) — lo más urgente de revisar primero.
const ORDEN_ESTADOS_MODAL = ["En Atención", "Pendiente", "Atendida", "No Asistió", "Cancelada"]

// La última vista elegida se recuerda en este navegador (solo una comodidad
// por persona: si el almacenamiento no está disponible, se abre en Lista).
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



// Tarjeta de cita, simplificada (reunión 7 oct., C12-C13): solo lo que hace falta para decidir de un vistazo. El motivo, el
// código, el origen, "Ver perfil", "Agendar otra cita" y el resto de las acciones viven en el detalle (clic en la
// tarjeta). La barra de color del borde sigue el estado, con los mismos colores del calendario.
function TarjetaCita({ cita, equipo, vistaPropia = false, primeraVez, onAbrirDetalle, fechaRealPorCitaId, marcandoEstadoId, cobroPendiente, onAtender, onCobrar }) {
  const resuelta = cita.estado === "Atendida" || cita.estado === "No Asistió" || cita.estado === "Cancelada"
  // "Atender" está disponible en toda cita que no esté ya Atendida o
  // Cancelada: pendiente, en espera, en atención, "No asistió" (la paciente llegó 12
  // minutos tarde) o de otro día (la de mañana que se atiende hoy). La fecha
  // agendada no cambia — la fecha real queda en la consulta (cita_id).
  // Sin onAtender (rol sin permiso para crear fichas clínicas) no se ofrece el botón.
  const puedeAtender = puedeAtenderCita(cita) && !!onAtender
  // Fecha real de atención (punto 3, reunión 29 sept.) —
  // solo se muestra cuando difiere de la fecha agendada,
  // para no repetir el mismo dato en el caso común.
  const fechaReal = fechaRealPorCitaId.get(cita.id)?.fecha
  const fechaRealDistinta = fechaReal && fechaReal !== cita.fecha
  // Una sola etiqueta: primera vez o seguimiento (o "Por registrar" si la cita aún no tiene paciente vinculado).
  const etiquetaVisita = !cita.pacienteId
    ? { texto: "Por registrar", clase: "border-amber-200/60 bg-amber-50 text-amber-700", ayuda: "Cita sin paciente vinculado todavía" }
    : primeraVez
      ? { texto: "Primera vez", clase: "border-sky-200/60 bg-sky-50 text-sky-700", ayuda: "El paciente no tenía atenciones anteriores" }
      : { texto: "Seguimiento", clase: "border-slate-200/60 bg-slate-50 text-slate-600", ayuda: "El paciente ya tenía atenciones anteriores" }
  // Un solo profesional por cita: quien la atiende o atendió y, si todavía no, a quien está asignada.
  // Con alcance propio el nombre sería siempre el suyo: solo se avisa de las citas que nadie tiene.
  const lineaProfesional = !mostrarProfesional(cita, vistaPropia) ? null
    : vistaPropia ? (["Pendiente", "En Espera"].includes(cita.estado) ? "Sin asignar" : null)
    : textoProfesional(cita, equipo)
  const triage = cita.triage && (cita.triage.sintomas?.length > 0 || cita.triage.detalle)
    ? [cita.triage.sintomas?.join(", "), cita.triage.desdeCuando, cita.triage.detalle].filter(Boolean).join(" · ")
    : null
  return (
    <div
      className={"relative flex flex-col justify-between overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md " + (resuelta ? "border-slate-100 opacity-80" : cita.estado === "En Atención" ? "border-blue-300 ring-2 ring-blue-100" : "border-slate-200/60 hover:border-blue-200/60")}
    >
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: colorDe(cita.estado).linea }} aria-hidden="true" />

      <div
        className="p-5 pl-6 cursor-pointer"
        onClick={(e) => { if (!e.target.closest("button, a")) onAbrirDetalle?.(cita) }}
      >
        <span title={etiquetaVisita.ayuda} className={"mb-3 inline-block rounded-md border px-2.5 py-1 text-xs font-semibold " + etiquetaVisita.clase}>{etiquetaVisita.texto}</span>

        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: GRAD }}>
            {cita.iniciales || <User size={16} />}
          </div>
          <div className="min-w-0">
            <span className="flex min-w-0 items-center gap-1.5 text-base font-semibold text-slate-800">
              <button type="button" onClick={() => onAbrirDetalle?.(cita)} title="Ver el detalle de la cita" className="min-w-0 truncate text-left transition-colors hover:text-blue-700 cursor-pointer">{cita.paciente}</button>
              {triage && <span title={`Pre-triage: ${triage}`} aria-label={`Pre-triage: ${triage}`} className="shrink-0 text-amber-600"><AlertTriangle size={14} aria-hidden="true" /></span>}
            </span>
            {lineaProfesional && <span className="mt-0.5 block truncate text-xs text-slate-500">{lineaProfesional}</span>}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-5 py-3 pl-6">
        <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-sm font-medium text-slate-600">
          <Clock size={14} className="text-slate-500" />
          <span>{cita.hora}</span>
          {cita.confirmadaAt && !resuelta && <span title="Asistencia confirmada (por el paciente o por recepción)" aria-label="Asistencia confirmada" className="text-emerald-600"><CheckCircle2 size={14} aria-hidden="true" /></span>}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {cita.estado === "Atendida" ? (
            <div className="flex flex-col items-end gap-0.5">
              <span className="flex items-center gap-1 whitespace-nowrap rounded-full border border-emerald-200/60 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-600">
                <CheckCircle2 size={12} /> Atendida
              </span>
              {fechaRealDistinta && (
                <span className="text-[11px] font-medium text-slate-400">Atendida el {etiquetaFecha(fechaReal)}</span>
              )}
            </div>
          ) : cita.estado === "No Asistió" ? (
            <span className="flex items-center gap-1 whitespace-nowrap rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">
              <UserX size={12} /> No asistió
            </span>
          ) : cita.estado === "Cancelada" ? (
            <span className="flex items-center gap-1 whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
              <X size={12} /> {cita.canceladaPor === "recepcion" ? "Cancelada por recepción" : cita.canceladaPor === "paciente" ? "Cancelada por el paciente" : "Cancelada"}
            </span>
          ) : cita.estado === "En Espera" ? (
            <span className="flex items-center gap-1 whitespace-nowrap rounded-full border border-violet-200/60 bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-500" /> En espera
            </span>
          ) : (
            <span className={"flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold " + (cita.estado === "En Atención" ? "border-blue-200/60 bg-blue-50 text-blue-600" : "border-amber-200/60 bg-amber-50 text-amber-600")}>
              {cita.estado === "En Atención" ? <Activity size={12} /> : <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
              {cita.estado === "En Atención" ? "En atención" : "Pendiente"}
            </span>
          )}
          {diasAtencionAbierta(cita) !== null && (
            <span title={textoAtencionAbierta(diasAtencionAbierta(cita))} className="flex items-center gap-1 whitespace-nowrap rounded-full border border-amber-300/70 bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
              <AlertTriangle size={11} aria-hidden="true" /> Abierta hace {diasAtencionAbierta(cita)} d
            </span>
          )}
          {cobroPendiente && (
            <span className="flex items-center gap-1 whitespace-nowrap rounded-full border border-amber-300/70 bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
              <Receipt size={12} aria-hidden="true" /> Cobro pendiente
            </span>
          )}
          {cobroPendiente ? (
            // La ficha ya se guardó: "Atender" abriría otra consulta. Lo que falta es cobrar.
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
              {cita.estado === "En Atención" ? "Retomar" : "Atender"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const FILTRO_POR_DEFECTO = "hoy"
const PAGINA_LISTA = 30

export default function Citas({ usuario, onAviso, estadoInicial = null, onEstadoInicialConsumido, atenderCitaId = null, onAtenderCitaConsumido, equipo = [], vistaPropia = false, cargaInicial = false, citas = [], setCitas, pacientes = [], setPacientes, consultas = [], disponibilidad, abrirModalAlEntrar = false, onModalAlEntrarConsumido, overlaySolo = false, onOverlayCerrado, controlParaAgendar = null, motivosConsulta = [], inventario = [], setInventario, facturasVenta = [], setFacturasVenta, parametrizacion, onAtender, onVerPerfil }) {
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
  const [asignadoA, setAsignadoA] = useState("")
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
  // Con overlaySolo (formulario abierto sobre Inicio) el aviso sale como toast del panel: esta vista queda oculta.
  const mostrarExito = (mensaje) => {
    if (overlaySolo) { onAviso?.(mensaje); return }
    setMensajeExito(mensaje)
    setTimeout(() => setMensajeExito(null), 3000)
  }
  const [error, setError] = useState("")
  const [bannerError, setBannerError] = useState("")
  const [marcandoEstadoId, setMarcandoEstadoId] = useState(null)
  const [confirmando, setConfirmando] = useState(false)

  // Acceso directo desde "Agendar cita" en Inicio: abre este modal sin pasar
  // primero por la vista de agenda (feedback del asesor: si una "opción rápida"
  // exige dos clics extra ya no es rápida).
  useEffect(() => {
    if (abrirModalAlEntrar) {
      if (controlParaAgendar) {
        // Desde el aviso "Control sin agendar": paciente y motivo puestos, y la fecha recomendada (o el día hábil más cercano).
        const paciente = pacientes.find((p) => p.id === controlParaAgendar.pacienteId)
        if (paciente) seleccionarPaciente(paciente)
        setFecha(diaHabilMasCercano(controlParaAgendar.fecha, disponibilidad, citas) || hoyISO())
        setMotivo(controlParaAgendar.motivo ?? (motivosConsulta.find((m) => /control/i.test(m)) || ""))
        setAsignadoA(controlParaAgendar.asignadoA || "")
      }
      setModalAbierto(true)
      onModalAlEntrarConsumido?.()
    }
  }, [abrirModalAlEntrar])

  // Abierto sobre Inicio: al cerrarse el formulario se avisa para desmontar esta vista oculta.
  const abrioSobreInicio = useRef(false)
  useEffect(() => {
    if (!overlaySolo) return
    if (modalAbierto) abrioSobreInicio.current = true
    else if (abrioSobreInicio.current) onOverlayCerrado?.()
  }, [modalAbierto]) // eslint-disable-line react-hooks/exhaustive-deps

  // Desde una tarjeta del Inicio ("Atendidas", "No asistieron"...): abre la lista ya filtrada por ese estado.
  // estadoInicial es el estado ("atendida"...) o { estado, periodo }: con periodo "mes" la lista se acota a este mes
  // (igual que la tarjeta del Inicio) y con "siempre" no se acota por fecha.
  useEffect(() => {
    if (estadoInicial) {
      const { estado, periodo } = typeof estadoInicial === "string" ? { estado: estadoInicial, periodo: null } : estadoInicial
      setEstadoFiltro(estado)
      setFiltro("todas")
      setVistaState("lista") // la tarjeta promete una lista filtrada; no se pisa la vista guardada
      if (periodo === "mes") { setFiltro("mes"); setRefLista(hoyISO()); setRangoDesde(""); setRangoHasta("") }
      else if (periodo === "hoy") { setFiltro("hoy"); setRefLista(hoyISO()); setRangoDesde(""); setRangoHasta("") } // las tarjetas de "Hoy" de Inicio
      else if (periodo === "siempre") { setRangoDesde(""); setRangoHasta("") }
      else if (periodo === "reagendar") { setFiltro("reagendar"); setRangoDesde(""); setRangoHasta("") } // el atajo "Para reagendar" de la Lista
      onEstadoInicialConsumido?.()
    }
  }, [estadoInicial]) // eslint-disable-line react-hooks/exhaustive-deps

  // Desde "Atender" del Inicio (Siguiente paciente): entra a la ficha igual que el botón "Atender" de esta pantalla.
  useEffect(() => {
    if (!atenderCitaId) return
    const cita = citas.find((c) => c.id === atenderCitaId)
    if (cita) atenderCita(cita)
    onAtenderCitaConsumido?.()
  }, [atenderCitaId]) // eslint-disable-line react-hooks/exhaustive-deps

  const [busqueda, setBusqueda] = useState("")
  // Todos los roles abren en Lista, periodo "Hoy": recepción ve quién viene, el optómetra su agenda y el
  // administrador lo que pasa hoy. Si hoy no hay citas se avisa y se ofrece "Ver esta semana".
  // La Lista muestra de a 30 citas y ofrece "Ver más": con miles de citas no se dibujan todas de golpe.
  const [limiteLista, setLimiteLista] = useState(PAGINA_LISTA)
  // Día que se está viendo en la Lista: el periodo (Hoy · Semana · Mes) se calcula a partir de él y las flechas lo mueven.
  const [refLista, setRefLista] = useState(() => hoyISO())
  const [filtro, setFiltro] = useState(FILTRO_POR_DEFECTO) // hoy | semana | mes | confirmar | reagendar | todas
  // Bloque de filtros (R3): estado, origen y primera vez/seguimiento. Se
  // combinan entre sí y con el indicador de arriba.
  const [estadoFiltro, setEstadoFiltro] = useState("todas")
  const [origenFiltro, setOrigenFiltro] = useState("todos")
  const [seguimientoFiltro, setSeguimientoFiltro] = useState("todos")
  // Solo el administrador: filtrar por quién estaba a cargo (R18).
  const [responsableFiltro, setResponsableFiltro] = useState("todos") // todos | ninguno | id (asignada o atendida por)
  // Rango de fechas propio (reunión 29 sept.: "todas las de la siguiente
  // semana"), independiente de los KPIs. Sin rango, la lista abre en hoy y lo
  // próximo, y lo pasado queda plegado en "Anteriores". Con rango, se muestra
  // exactamente ese tramo — hacia atrás o hacia adelante.
  const [rangoDesde, setRangoDesde] = useState("")
  const [rangoHasta, setRangoHasta] = useState("")
  // Al cambiar de periodo, filtro o búsqueda, la Lista vuelve a mostrar solo las primeras citas.
  useEffect(() => { setLimiteLista(PAGINA_LISTA) }, [refLista, filtro, estadoFiltro, origenFiltro, seguimientoFiltro, responsableFiltro, busqueda, rangoDesde, rangoHasta])
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

  // Detalle de la cita (R12-R13): se abre al hacer clic en la cita. Se guarda
  // el id y no la cita, para que el modal refleje los cambios de estado.
  const [detalleCitaId, setDetalleCitaId] = useState(null)
  const [preguntarOtroDia, setPreguntarOtroDia] = useState(false) // el detalle se abre con "¿Atenderla hoy?" ya planteado
  // Atención abierta de un día anterior que se quiere dejar de atender (desde el menú o el detalle).
  const [dejarCita, setDejarCita] = useState(null)
  const abrirDetalle = (cita) => { setPreguntarOtroDia(false); setDetalleCitaId(cita.id) }
  const alCobrarCita = async (factura) => {
    const cita = cobrandoCita
    setFacturasVenta?.((prev) => [factura, ...prev])
    if (cita) {
      const { error: errorAtendida } = await marcarCitaAtendidaDb(supabase, cita.id)
      if (errorAtendida) setBannerError("El cobro se registró, pero no se pudo marcar la cita como atendida.")
      else setCitas((prev) => prev.map((c) => (c.id === cita.id ? { ...c, estado: "Atendida" } : c)))
    }
    mostrarExito("Cobro registrado · cita atendida.")
  }

  // ── "Atender" sobre una cita sin paciente vinculado todavía (primera cita
  // agendada desde la web pública, o registrada como visita rápida) — pide
  // completar el registro antes de abrir la ficha clínica ──
  const [completarPara, setCompletarPara] = useState(null) // la cita, o null
  const [cpSolo, setCpSolo] = useState(false) // true: solo registrar y vincular al paciente (desde el detalle), sin atender ni cambiar el estado
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
      asignadoA: asignadoA || null,
      atendidoPor: null,
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
          asignado_a: nuevaCita.asignadoA,
        })
        .select()
        .single()
      if (errorInsert) {
        setError(
          errorInsert.code === "23505"
            ? "Ese horario ya no está disponible — alguien más lo acaba de reservar. Elige otro."
            : esErrorHoraInvalida(errorInsert)
              ? MENSAJE_HORA_INVALIDA
            : esErrorSinPermiso(errorInsert)
              ? MENSAJE_SIN_PERMISO
              : "No se pudo registrar la cita. Revisa tu conexión e intenta de nuevo."
        )
        setConfirmando(false)
        return
      }
      nuevaCita.id = data.id
      nuevaCita.creadoEn = data.created_at
    } else {
      nuevaCita.id = Date.now()
    }

    setCitas([...citas, nuevaCita])
    registrarLog(usuario, "citas", atenderInmediato ? "Atendió a un paciente de inmediato" : "Agendó una cita", `${nuevaCita.paciente} · ${fechaLegible(nuevaCita.fecha)}`)

    const irADeUnaALaFicha = atenderInmediato
    setConfirmando(false)
    cerrarModal()
    if (irADeUnaALaFicha) {
      onAtender?.(paciente, nuevaCita.id, nuevaCita.motivo)
    } else {
      mostrarExito("Cita registrada y guardada correctamente.")
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

  // "Agendar otra cita" para quien no asistió: abre el mismo modal de agendar con el paciente ya elegido.
  const agendarOtraCita = (cita) => {
    const paciente = cita.pacienteId ? pacientes.find((p) => p.id === cita.pacienteId) : null
    abrirModal()
    if (paciente) seleccionarPaciente(paciente)
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
    setAsignadoA("")
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
    registrarLog(usuario, "citas", "Canceló una cita", cancelada ? `${cancelada.paciente} · ${fechaLegible(cancelada.fecha)}` : "")
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
          return false
        }
        if (errorEstado) {
          setBannerError("No se pudo actualizar el estado de la cita. Revisa tu conexión e intenta de nuevo.")
          return false
        }
      }
      setBannerError("")
      setCitas(citas.map((c) => (c.id === citaId ? { ...c, estado: nuevoEstado } : c)))
      return true
    } finally {
      setMarcandoEstadoId(null)
    }
  }

  // Recepción registra que el paciente confirmó su asistencia (por teléfono, WhatsApp o en persona); el paciente
  // que usa el enlace del recordatorio por correo la confirma solo. Misma columna: confirmada_at.
  const marcarConfirmada = async (citaId) => {
    const confirmadaAt = new Date().toISOString()
    try {
      if (supabase && opticaId) {
        const { data: actualizadas, error: errorConfirmar } = await supabase.from("citas").update({ confirmada_at: confirmadaAt }).eq("id", citaId).select()
        if (fueBloqueadoPorPermiso({ error: errorConfirmar, data: actualizadas })) {
          setBannerError(MENSAJE_SIN_PERMISO)
          return
        }
        if (errorConfirmar) {
          setBannerError("No se pudo marcar la cita como confirmada. Revisa tu conexión e intenta de nuevo.")
          return
        }
      }
      setBannerError("")
      setCitas(citas.map((c) => (c.id === citaId ? { ...c, confirmadaAt } : c)))
      if (detalleCitaId) onAviso?.("Cita marcada como confirmada."); else mostrarExito("Cita marcada como confirmada.")
    } catch {
      setBannerError("No se pudo marcar la cita como confirmada. Revisa tu conexión e intenta de nuevo.")
    }
  }

  // ── "Atender" y "Retomar" van directo a la ficha clínica (reunión 7 oct., C16): el detalle de la cita ya
  // reúne los datos, así que no hay un resumen intermedio. La lógica de entrar vive en ingresarAFicha. ──
  // Atender exige poder crear fichas clínicas (consultas: crear). Los botones ya no se muestran sin ese
  // permiso; esto es la red de seguridad para que ningún camino quede en un clic mudo.
  const puedeAtenderPacientes = puede(usuario, "consultas", "crear")
  const avisarSinPermisoAtender = () => onAviso?.("No tienes permiso para atender pacientes.")
  const atenderCita = (cita) => {
    if (!puedeAtenderPacientes) { avisarSinPermisoAtender(); return }
    // Una cita de otro día abre su detalle ya con la pregunta "¿Atenderla hoy?"; las de hoy entran directo a la ficha.
    if (requiereConfirmarOtroDia(cita, hoyISO())) { setPreguntarOtroDia(true); setDetalleCitaId(cita.id); return }
    ingresarAFicha(cita)
  }

  // ── Cambios de estado desde el detalle de la cita (la recepción). El detalle queda abierto y muestra el estado
  // nuevo; el aviso es flotante porque el banner de la página queda detrás del modal. "Llegó" = "En espera": el
  // optómetra lo ve en su Inicio y cuenta en "En sala de espera"; el proceso automático de "No asistió" solo toca
  // las citas "Pendiente", así que una cita en espera no se marca sola. ──
  const cambiarEstadoDesdeDetalle = async (cita, nuevoEstado, mensaje) => {
    const ok = await marcarEstado(cita.id, nuevoEstado)
    onAviso?.(ok ? mensaje : "No se pudo actualizar el estado de la cita. Intenta de nuevo.")
  }
  const marcarLlego = (cita) => cambiarEstadoDesdeDetalle(cita, "En Espera", `${cita.paciente} llegó: la cita pasa a "En espera".`)
  const marcarNoLlego = (cita) => cambiarEstadoDesdeDetalle(cita, "Pendiente", `La cita de ${cita.paciente} vuelve a "Pendiente".`)
  const marcarNoAsistio = (cita) => cambiarEstadoDesdeDetalle(cita, "No Asistió", `La cita de ${cita.paciente} se marcó como "No asistió".`)

  // ── Pasa la cita a "En Atención" y abre la ficha clínica del paciente ya
  // vinculado. Si la cita no tiene paciente vinculado (primera cita
  // agendada desde la web pública), pide completar su registro primero. Si
  // el paciente es web y no está confirmado por recepción (D2), pide
  // confirmar/completar sus datos antes de la ficha. ──
  const ingresarAFicha = (cita) => {
    if (!puedeAtenderPacientes) { avisarSinPermisoAtender(); return }
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
  }

  // Desde el detalle: registrar al paciente de una cita "Por registrar" y vincularlo, sin atenderla ni tocar su estado.
  const registrarPacienteDeCita = (cita) => {
    setDetalleCitaId(null)
    setCpSolo(true)
    setCompletarPara(cita)
    setCpNombre(cita.paciente || "")
    setCpCedula(cita.cedula || "")
    setCpTelefono(cita.telefono || "")
    setCpCorreo(cita.correo && cita.correo !== "Sin Correo" ? cita.correo : "")
    setCpFechaNacimiento("")
    setCpErrores({})
  }

  const cerrarCompletarRegistro = () => {
    setCompletarPara(null)
    setCpSolo(false)
    setCpNombre("")
    setCpCedula("")
    setCpTelefono("")
    setCpCorreo("")
    setCpFechaNacimiento("")
    setCpErrores({})
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
    const cambiosCita = { paciente_id: nuevoPaciente.id, cedula: nuevoPaciente.cedula, ...(cpSolo ? {} : { estado: "En Atención" }) }
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
    setCitas(citas.map((c) => (c.id === citaId ? { ...c, pacienteId: nuevoPaciente.id, cedula: nuevoPaciente.cedula, ...(cpSolo ? {} : { estado: "En Atención" }) } : c)))
    setCpGuardando(false)
    const soloRegistro = cpSolo
    cerrarCompletarRegistro()
    if (soloRegistro) {
      registrarLog(usuario, "citas", "Registró al paciente de una cita", `${nuevoPaciente.nombre || cpNombre} · ${fechaLegible(completarPara.fecha)}`)
      onAviso?.(`Paciente registrado y vinculado a la cita.`)
      return
    }
    onAtender?.(nuevoPaciente, citaId, motivoCita)
  }

  // ── Reasignar y tomar (reunión del 7 oct., R18) ──
  // Reasignar pasa por la función reasignar_cita (0100): valida permiso y alcance en la base y deja el registro en la actividad.
  // Cada reasignación ofrece "Deshacer", que es la misma llamada de vuelta a quien la tenía.
  const personasAsignables = miembrosActivos(equipo).filter((m) => m.esOptometra)
  const reasignarCita = async (cita, nuevoId, { esDeshacer = false } = {}) => {
    if (!supabase || !opticaId) return
    const anterior = cita.asignadoA || null
    const { data, error } = await supabase.rpc("reasignar_cita", { p_cita_id: cita.id, p_nuevo: nuevoId })
    if (error) {
      onAviso?.(esErrorSinPermiso(error) ? MENSAJE_SIN_PERMISO : (error.message || "No se pudo reasignar la cita. Revisa tu conexión e intenta de nuevo."))
      return
    }
    const fila = Array.isArray(data) ? data[0] : data
    setCitas((previas) => previas.map((c) => (c.id === cita.id ? { ...c, asignadoA: fila?.nuevo_asignado ?? nuevoId, asignadoOriginal: fila?.nuevo_original ?? c.asignadoOriginal } : c)))
    setDetalleCitaId(null)
    const destino = nuevoId ? etiquetaMiembro(equipo, nuevoId) : "nadie (sin asignar)"
    onAviso?.(esDeshacer
      ? { texto: "Reasignación deshecha." }
      : { texto: `Cita de ${cita.paciente} pasada a ${destino}.`, accion: { etiqueta: "Deshacer", onClick: () => reasignarCita({ ...cita, asignadoA: nuevoId }, anterior, { esDeshacer: true }) } })
  }

  // "Tomar esta cita": solo si sigue sin responsable y abierta. La condición va en la propia actualización, así que si otra
  // persona la tomó un segundo antes no se pisa: no cambia ninguna fila y se avisa.
  const tomarCita = async (cita) => {
    if (!supabase || !opticaId || !usuario?.id) return
    const { data, error } = await supabase.from("citas").update({ asignado_a: usuario.id })
      .eq("id", cita.id).is("asignado_a", null).is("atendido_por", null).in("estado", ["Pendiente", "En Espera"]).select()
    if (fueBloqueadoPorPermiso({ error, data })) { onAviso?.(MENSAJE_SIN_PERMISO); return }
    if (error) { onAviso?.("No se pudo tomar la cita. Revisa tu conexión e intenta de nuevo."); return }
    if (!data || data.length === 0) {
      onAviso?.("Ya la tomó otra persona.")
      setDetalleCitaId(null)
      return
    }
    setCitas((previas) => previas.map((c) => (c.id === cita.id ? { ...c, asignadoA: usuario.id } : c)))
    registrarLog(usuario, "citas", "Tomó una cita", `${cita.paciente} · ${fechaLegible(cita.fecha)}`)
    setDetalleCitaId(null)
    onAviso?.(`Tomaste la cita de ${cita.paciente}.`)
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
      const cancelaAhora = estadoCambiado && estadoCorregido === "Cancelada"
      const cambios = { motivo: nuevoMotivo, ...(estadoCambiado ? { estado: estadoCorregido } : {}), ...(cancelaAhora ? { cancelada_por: "recepcion" } : {}) }
      if (supabase && opticaId) {
        const { data: actualizadas, error: errorUpdate } = await supabase.from("citas").update(cambios).eq("id", reagendando.id).select()
        if (fueBloqueadoPorPermiso({ error: errorUpdate, data: actualizadas })) {
          setErrorReagendar(MENSAJE_SIN_PERMISO)
          return
        }
        if (errorUpdate) {
          setErrorReagendar(esErrorHoraInvalida(errorUpdate) ? MENSAJE_HORA_INVALIDA : "No se pudo guardar el cambio. Revisa tu conexión e intenta de nuevo.")
          return
        }
      }
      const { cancelada_por: canceladaPorNuevo, ...cambiosLocales } = cambios
      setCitas(citas.map((c) => (c.id === reagendando.id ? { ...c, ...cambiosLocales, ...(canceladaPorNuevo ? { canceladaPor: canceladaPorNuevo } : {}) } : c)))
      registrarLog(usuario, "citas", estadoCambiado ? "Corrigió el estado de una cita" : "Editó una cita", `${reagendando.paciente} · ${fechaLegible(reagendando.fecha)}`)
      cerrarReagendar()
      mostrarExito(estadoCambiado ? "Estado de la cita corregido." : "Cita actualizada.")
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
    const seCancela = nuevoEstado === "Cancelada" && reagendando.estado !== "Cancelada"
    const citaActualizada = { ...reagendando, fecha: nuevaFecha, hora: nuevaHora, motivo: nuevoMotivo, estado: nuevoEstado, ...(seCancela ? { canceladaPor: "recepcion" } : {}) }
    if (supabase && opticaId) {
      const { data: reagendadas, error: errorUpdate } = await supabase.from("citas").update({ fecha: nuevaFecha, hora: nuevaHora, motivo: nuevoMotivo, estado: nuevoEstado, ...(seCancela ? { cancelada_por: "recepcion" } : {}) }).eq("id", reagendando.id).select()
      if (fueBloqueadoPorPermiso({ error: errorUpdate, data: reagendadas })) {
        setErrorReagendar(MENSAJE_SIN_PERMISO)
        return
      }
      if (errorUpdate) {
        setErrorReagendar(esErrorHoraInvalida(errorUpdate) ? MENSAJE_HORA_INVALIDA : "No se pudo reagendar la cita. Revisa tu conexión e intenta de nuevo.")
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
    const texto = `Hola ${cita.paciente}, te escribimos de ${usuario?.opticaNombre || "tu óptica"} para avisarte que tu cita fue reagendada. Nueva fecha: ${fechaLegible(cita.fecha)} a las ${cita.hora}. Cualquier duda, contáctanos por aquí.`
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
          setBannerError(errorUpdate.code === "23505" ? "Ese horario ya no está disponible — alguien más lo acaba de reservar." : esErrorHoraInvalida(errorUpdate) ? MENSAJE_HORA_INVALIDA : "No se pudo reagendar la cita. Revisa tu conexión e intenta de nuevo.")
          setMoviendo(null)
          return
        }
      }
      const citaActualizada = { ...cita, fecha: nuevaFecha, hora: nuevaHora }
      setCitas((prev) => prev.map((c) => (c.id === cita.id ? citaActualizada : c)))
      registrarLog(usuario, "citas", "Reagendó una cita (arrastrando en el calendario)", `${cita.paciente} · ${fechaLegible(nuevaFecha)}`)
      setBannerError("")
      setMoviendo(null)
      setReagendada(citaActualizada)
    } finally {
      setGuardandoMovimiento(false)
    }
  }

  // ── Vista por día / por mes (reunión 29 sept., punto 12 del plan) — "día"
  // es la lista agrupada de siempre (grupos, de arriba), sin cambios. "mes"
  // es un calendario nuevo que reutiliza el mismo `grupos` (mismos filtros,
  // misma búsqueda) solo que indexado por fecha para pintar un contador por
  // día y abrir el detalle en un modal. ──
  const [vista, setVistaState] = useState(leerVistaGuardada) // lista | semana | mes
  const setVista = (v) => {
    // El rango libre solo existe en la Lista: al pasar a Semana o Mes se quita (no se vería reflejado).
    if (v !== "lista") { setRangoDesde(""); setRangoHasta("") }
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

  // Semana visible en la vista Semana (lunes, ISO); la usa también el aviso de búsqueda.
  const [semanaLunes, setSemanaLunes] = useState(() => lunesDeSemana(hoyISO()))

  // ── Filtros combinados (lógica en utilidades/filtrosCitas). En Semana y Mes el
  // periodo visible hace de ventana; en Lista el periodo (Hoy · Esta semana · Este mes · Rango)
  // es un filtro más. La búsqueda mira el nombre y el código de cita (CIT-2026-ABC123)
  // que el paciente recibe al reservar en línea. ──
  const hayRango = Boolean(rangoDesde || rangoHasta)
  // Periodos de la Lista, los mismos de las vistas Semana y Mes, a partir del día de referencia.
  const rangos = useMemo(() => {
    const lunes = lunesDeSemana(refLista)
    const d = isoAFechaLocal(refLista)
    return {
      hoy: { desde: refLista, hasta: refLista },
      semana: { desde: lunes, hasta: sumarDiasISO(lunes, 6) },
      mes: { desde: fechaAISO(new Date(d.getFullYear(), d.getMonth(), 1)), hasta: fechaAISO(new Date(d.getFullYear(), d.getMonth() + 1, 0)) },
    }
  }, [refLista])
  const diaConfirmar = useMemo(() => proximoDiaDeAtencion(disponibilidad, hoyISO()), [disponibilidad])
  const idsReagendar = useMemo(() => new Set(citasParaReagendar(citas).map((c) => c.id)), [citas])
  const periodos = useMemo(() => periodosFiltro(filtro), [filtro])
  const tareaActiva = filtro === "confirmar" || filtro === "reagendar" ? filtro : "ninguna"
  const ventana = useMemo(() => {
    if (vistaActiva === "semana") return { desde: semanaLunes, hasta: sumarDiasISO(semanaLunes, 6) }
    if (vistaActiva === "mes") {
      return { desde: fechaAISO(mesVista), hasta: fechaAISO(new Date(mesVista.getFullYear(), mesVista.getMonth() + 1, 0)) }
    }
    return null
  }, [vistaActiva, semanaLunes, mesVista])
  const filtros = useMemo(
    () => ({ estado: estadoFiltro, origen: origenFiltro, seguimiento: seguimientoFiltro, responsable: responsableFiltro, texto: busqueda, periodo: { filtro, desde: rangoDesde, hasta: rangoHasta }, ventana, rangos, diaConfirmar, idsReagendar }),
    [estadoFiltro, origenFiltro, seguimientoFiltro, responsableFiltro, busqueda, filtro, rangoDesde, rangoHasta, ventana, rangos, diaConfirmar, idsReagendar],
  )
  const resultado = useMemo(() => citas.filter((c) => citaPasaFiltros(c, filtros, consultas)), [citas, filtros, consultas])
  const totalAlcance = useMemo(() => totalDelAlcance(citas, filtros), [citas, filtros])

  // Vista Semana: si lo buscado no está en la semana que se ve, ofrece ir a la
  // semana de la coincidencia más cercana (la próxima, o la última pasada).
  const avisoBusquedaSemana = useMemo(() => {
    if (!busqueda.trim() || vistaActiva !== "semana") return null
    const coincidencias = citas.filter((c) => citaPasaFiltros(c, { ...filtros, ventana: null, periodo: null }, consultas))
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
  }, [citas, filtros, consultas, busqueda, vistaActiva, semanaLunes])

  // Lista: sin rango → hoy en adelante + "Anteriores" (más reciente primero).
  // Con rango → solo ese tramo, cronológico. "Ya atendidas" es por naturaleza
  // un historial, así que va de la más reciente a la más antigua.
  const { grupos, gruposAnteriores } = useMemo(() => {
    const hoy = hoyISO()
    if (hayRango || (["hoy", "semana", "mes", "confirmar", "reagendar"].includes(filtro) && !busqueda.trim())) return { grupos: agruparPorDia(ordenarCitas(resultado)), gruposAnteriores: [] }
    // Atendidas, canceladas y No asistió son historial: de la más reciente a la
    // más antigua, todas a la vista, sin esconder lo pasado en "Anteriores".
    if (ESTADOS_DE_HISTORIAL.includes(estadoFiltro)) {
      return { grupos: agruparPorDia(ordenarCitas(resultado, true)), gruposAnteriores: [] }
    }
    const { proximas, anteriores } = particionarAgenda(resultado, hoy)
    return { grupos: agruparPorDia(proximas), gruposAnteriores: agruparPorDia(anteriores) }
  }, [resultado, estadoFiltro, hayRango, filtro, busqueda])

  const totalAnteriores = gruposAnteriores.reduce((n, [, cs]) => n + cs.length, 0)

  // Primera vez = sin atenciones anteriores (ver esPrimeraVez). Se calcula una
  // vez para todas las citas y las tarjetas solo consultan el conjunto.
  const idsPrimeraVez = useMemo(() => new Set(citas.filter((c) => esPrimeraVez(c, consultas)).map((c) => c.id)), [citas, consultas])
  const filtrosActivos = (estadoFiltro !== "todas") + (origenFiltro !== "todos") + (seguimientoFiltro !== "todos") + (responsableFiltro !== "todos")

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
      diaNum: objFecha ? formatoFecha(objFecha, "dia") : "--",
      mes: objFecha ? formatoFecha(objFecha, "mes") : "DÍA",
    }
  }

  const [diaModal, setDiaModal] = useState(null) // { iso, minutos } del día clicado (minutos: la hora libre sobre la que se hizo clic, o null)

  // Flechas de la Lista: mueven el día, la semana o el mes que se ve (o el rango libre, de a una semana).
  const moverLista = (sentido) => {
    if (hayRango) return moverRango(sentido)
    if (filtro === "hoy") setRefLista((r) => sumarDiasISO(r, sentido))
    else if (filtro === "semana") setRefLista((r) => sumarDiasISO(r, 7 * sentido))
    else if (filtro === "mes") setRefLista((r) => { const d = isoAFechaLocal(r); return fechaAISO(new Date(d.getFullYear(), d.getMonth() + sentido, 1)) })
  }
  const moverRango = (sentido) => {
    const r = desplazarRango(rangoDesde, rangoHasta, sentido, hoyISO())
    setRangoDesde(r.desde)
    setRangoHasta(r.hasta)
  }

  // Las canceladas se ven solo con el estado "Canceladas", igual en Lista, Semana y Mes (y no ocupan horario).
  const gruposCalendario = useMemo(() => new Map(agruparPorDia(resultado)), [resultado])

  const diasSemanaVisible = Array.from({ length: 7 }, (_, i) => sumarDiasISO(semanaLunes, i))
  // Títulos de periodo (formato "corto" del módulo de fechas): "Hoy · jue 8 oct 2026", "5 – 11 oct 2026", "oct 2026".
  const tituloLista = (() => {
    if (hayRango) return rangoDesde && rangoHasta ? tituloSemana(rangoDesde, rangoHasta) : rangoDesde ? `Desde el ${formatoFecha(rangoDesde, "medio")}` : `Hasta el ${formatoFecha(rangoHasta, "medio")}`
    if (filtro === "hoy") return `${refLista === hoyISO() ? "Hoy · " : ""}${formatoFecha(refLista, "corto")}`
    if (filtro === "semana") return tituloSemana(rangos.semana.desde, rangos.semana.hasta)
    if (filtro === "mes") return formatoFecha(refLista, "mesAnioCorto")
    return ""
  })()
  // Selector de fecha del título del periodo: lleva directo a un día, una semana o un mes según la vista.
  const selectorPeriodo = (() => {
    if (vistaActiva === "semana") {
      return { unidad: "semana", visible: { desde: semanaLunes, hasta: sumarDiasISO(semanaLunes, 6) }, onElegir: (iso) => setSemanaLunes(lunesDeSemana(iso)) }
    }
    if (vistaActiva === "mes") {
      return { unidad: "mes", visible: { desde: fechaAISO(mesVista), hasta: fechaAISO(new Date(mesVista.getFullYear(), mesVista.getMonth() + 1, 0)) }, onElegir: (iso) => { const d = isoAFechaLocal(iso); setMesVista(new Date(d.getFullYear(), d.getMonth(), 1)) } }
    }
    const unidad = hayRango ? "dia" : filtro === "semana" ? "semana" : filtro === "mes" ? "mes" : "dia"
    const visible = hayRango ? { desde: rangoDesde || rangoHasta, hasta: rangoHasta || rangoDesde } : rangos[filtro] || rangos.hoy
    return {
      unidad, visible,
      onElegir: (iso, tipo) => {
        setRangoDesde(""); setRangoHasta("")
        if (tipo === "mes") { setFiltro("mes"); setRefLista(iso) }
        else { if (hayRango || !["hoy", "semana", "mes"].includes(filtro)) setFiltro("hoy"); setRefLista(iso) }
      },
    }
  })()
  const irMesAnterior = () => setMesVista((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
  const irMesSiguiente = () => setMesVista((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))

  // "Agendar" desde el modal del día: el formulario se abre con ese día (y la hora libre sobre la que se hizo clic, si la hubo).
  const agendarDesdeDia = (iso, minutos) => {
    setDiaModal(null)
    if (minutos != null) { abrirModalEn(iso, minutos); return }
    abrirModal()
    setFecha(iso)
  }

  // Accesibilidad de modales (audit UX, Lote 1, punto 1c) — un hook por
  // modal, cada uno gateado por el mismo booleano/valor que ya controla su
  // renderizado condicional más abajo.
  const refModalAgendar = useModalAccesible(modalAbierto, cerrarModal)
  const refModalCompletarRegistro = useModalAccesible(!!completarPara, cerrarCompletarRegistro)
  const refModalCancelar = useModalAccesible(porCancelar != null, () => setPorCancelar(null))
  const refModalReagendar = useModalAccesible(reagendando, cerrarReagendar)
  const refModalMover = useModalAccesible(!!moviendo, () => setMoviendo(null))
  const refModalReagendada = useModalAccesible(!!reagendada, () => setReagendada(null))

  // Filtros elegidos en el panel "Filtrar", como etiquetas con su "x" dentro de la barra. El periodo (Hoy, Esta semana, Este mes…)
  // se ve en sus propios atajos y la búsqueda en su campo, así que no llevan etiqueta.
  const nombreResponsableFiltro = (valor) => (valor === "ninguno" ? "Nadie" : etiquetaMiembro(equipo, valor) || "—")
  const etiquetasActivas = [
    estadoFiltro !== "todas" && { id: "estado", texto: `Estado: ${ESTADOS_FILTRO.find((e) => e.id === estadoFiltro)?.etiqueta}`, quitar: () => setEstadoFiltro("todas") },
    origenFiltro !== "todos" && { id: "origen", texto: `Origen: ${ORIGENES_FILTRO.find((o) => o.id === origenFiltro)?.etiqueta}`, quitar: () => setOrigenFiltro("todos") },
    seguimientoFiltro !== "todos" && { id: "visita", texto: `Visita: ${SEGUIMIENTO_FILTRO.find((o) => o.id === seguimientoFiltro)?.etiqueta}`, quitar: () => setSeguimientoFiltro("todos") },
    tareaActiva !== "ninguna" && { id: "tarea", texto: `Tarea: ${tareasFiltro(diaConfirmar).find((t) => t.id === tareaActiva)?.etiqueta}`, quitar: () => elegirPeriodo("hoy") },
    responsableFiltro !== "todos" && { id: "responsable", texto: `Profesional: ${nombreResponsableFiltro(responsableFiltro)}`, quitar: () => setResponsableFiltro("todos") },
    vistaActiva === "lista" && hayRango && { id: "fechas", texto: `Fechas: ${rangoDesde ? fechaCorta(rangoDesde) : "…"} – ${rangoHasta ? fechaCorta(rangoHasta) : "…"}`, quitar: () => { setRangoDesde(""); setRangoHasta("") } },
  ].filter(Boolean)

  // "89 citas" sin filtros; "Mostrando 5 de 89 citas" cuando hay menos que el total (en Semana y Mes, del periodo visible).
  const mostradas = resultado.length
  const buscando = busqueda.trim() !== ""
  const hayFiltros = etiquetasActivas.length > 0 || buscando
  // Igual en las tres vistas: "16 citas en la semana", "27 citas en el mes", "3 citas hoy"; con búsqueda (todas las fechas), sin sufijo.
  const periodoDeLaVista = vistaActiva !== "lista" ? vistaActiva : buscando ? null : hayRango ? "rango" : filtro
  const sufijoPeriodo = { semana: " en la semana", mes: " en el mes", rango: " en el rango", hoy: refLista === hoyISO() ? " hoy" : " ese día" }[periodoDeLaVista] || ""
  // Hoy sin citas (y sin otros filtros): nunca una lista vacía, se avisa y se ofrece ver lo que viene.
  const hoySinCitas = vistaActiva === "lista" && filtro === "hoy" && refLista === hoyISO() && !hayRango && !hayFiltros && mostradas === 0
  const textoResumen = `${mostradas} ${mostradas === 1 ? "cita" : "citas"}${sufijoPeriodo}`
  const elegirPeriodo = (id) => { setFiltro(id); setRefLista(hoyISO()); setRangoDesde(""); setRangoHasta("") }
  const opcionesResponsable = [{ id: "todos", etiqueta: "Todos" }, { id: "ninguno", etiqueta: "Nadie" }, ...equipo.map((m) => ({ id: m.id, etiqueta: m.nombre }))]
  // Un rango libre solo se puede mostrar como lista (Semana y Mes son una semana o un mes): al elegirlo desde otra vista, pasa a Lista.
  // (El salto se hace cuando el rango está completo, para no cerrar el calendario después del primer clic.)
  const elegirDesde = (v) => setRangoDesde(v)
  const elegirHasta = (v) => { setRangoHasta(v); if (v && vistaActiva !== "lista") setVista("lista") }
  const seccionesFiltro = [
    { id: "estado", titulo: "Estado", valor: estadoFiltro, onChange: setEstadoFiltro, opciones: ESTADOS_FILTRO },
    { id: "origen", titulo: "Origen", valor: origenFiltro, onChange: setOrigenFiltro, opciones: ORIGENES_FILTRO },
    { id: "tarea", titulo: "Tarea", valor: tareaActiva, onChange: (id) => (id === "ninguna" ? elegirPeriodo("hoy") : (setFiltro(id), setRangoDesde(""), setRangoHasta(""))), opciones: tareasFiltro(diaConfirmar) },
    { id: "visita", titulo: "Visita", valor: seguimientoFiltro, onChange: setSeguimientoFiltro, opciones: SEGUIMIENTO_FILTRO.map((o) => (o.id === "todos" ? { ...o, etiqueta: "Todas" } : o)) },
    { id: "fechas", titulo: "Fechas", tipo: "rango", rango: { desde: rangoDesde, hasta: rangoHasta, onDesde: elegirDesde, onHasta: elegirHasta } },
    ...(usuario?.rol === "admin" ? [
      { id: "responsable", titulo: "Profesional", tipo: "lista", valor: responsableFiltro, onChange: setResponsableFiltro, opciones: opcionesResponsable },
    ] : []),
  ]
  // Limpiar quita los filtros del panel y la búsqueda; el periodo se cambia con sus atajos.
  const limpiarFiltrosPanel = () => { setEstadoFiltro("todas"); setOrigenFiltro("todos"); setSeguimientoFiltro("todos"); setResponsableFiltro("todos"); setBusqueda(""); setRangoDesde(""); setRangoHasta(""); if (tareaActiva !== "ninguna") elegirPeriodo("hoy") }

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
                  <h4 className="text-sm font-bold" style={{ color: INK }}>{t.etiqueta}</h4>
                  {hoyDia && <span className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ background: GRAD }}>Hoy</span>}
                  <span className="text-xs text-slate-500">· {citasDia.length} {citasDia.length === 1 ? "cita" : "citas"}</span>
                </button>

                {!diasColapsados.has(dia) && (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {citasDia.map((cita) => (
                    <TarjetaCita
                      key={cita.id}
                      cita={cita}
                      primeraVez={idsPrimeraVez.has(cita.id)}
                      equipo={equipo}
                      vistaPropia={vistaPropia}
                      fechaRealPorCitaId={fechaRealPorCitaId}
                      marcandoEstadoId={marcandoEstadoId}
                      cobroPendiente={pendientesPorCita.has(cita.id)}
                      onAbrirDetalle={abrirDetalle}
                      onCobrar={cobrarCita}
                      onAtender={puedeAtenderPacientes ? atenderCita : undefined}
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
  // "Ver más": se dibujan las primeras `limiteLista` citas (primero las del listado y luego, si están abiertas, las
  // anteriores); el conteo de arriba sigue diciendo el total real.
  const recortarGrupos = (gs, max) => {
    const salida = []
    let n = 0
    for (const [dia, cs] of gs) {
      if (n >= max) break
      const tomadas = cs.slice(0, max - n)
      salida.push([dia, tomadas])
      n += tomadas.length
    }
    return { grupos: salida, n }
  }
  const cuantas = (gs) => gs.reduce((n, [, cs]) => n + cs.length, 0)
  const recorteListado = recortarGrupos(grupos, limiteLista)
  const recorteAnteriores = recortarGrupos(anterioresVisibles ? gruposAnteriores : [], limiteLista - recorteListado.n)
  const faltanListado = cuantas(grupos) - recorteListado.n
  const faltanAnteriores = anterioresVisibles ? totalAnteriores - recorteAnteriores.n : 0
  const botonVerMas = (faltan) => (
    <button type="button" onClick={() => setLimiteLista((l) => l + PAGINA_LISTA)} className="mx-auto flex items-center gap-2 rounded-xl border border-slate-200/60 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 cursor-pointer">
      Ver {Math.min(PAGINA_LISTA, faltan)} más <span className="font-normal text-slate-500">· quedan {faltan}</span>
    </button>
  )
  const avisoSinCitasHoy = hayRango || filtro !== "todas" || filtrosActivos > 0 || busqueda
    ? null
    : grupos.length === 0
      ? "No hay citas próximas. Debajo está lo último atendido."
      : grupos[0][0] !== hoyISO()
        ? `Hoy no hay citas. Lo próximo es ${etiquetaFecha(grupos[0][0])}.`
        : null

  return (
    <div className={"w-full space-y-6 text-left" + (overlaySolo ? " hidden" : "")} style={{ animation: "rise-in 320ms ease-out both" }}>
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
          {/* "Agendar cita" existía como botón aparte, más limitado (fecha en
              blanco, y sin forma de crear un paciente nuevo si no había
              ninguno todavía) — "Gestionar" ya cubre ese caso y más, así que
              se quedó como el único punto de entrada (feedback de Diego). */}
          {puede(usuario, "citas", "crear") && <button
            type="button"
            onClick={() => abrirModal()}
            className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
            style={{ background: GRAD, boxShadow: "0 14px 28px -12px rgba(37,99,235,0.6)" }}
          >
            <UserPlus size={18} />
            Gestionar cita
          </button>}
        </div>
      </div>

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

      {/* ─── BARRA SUPERIOR ───
          Fila 1 (igual en las tres vistas): el selector de vista y, a su derecha, una sola barra de búsqueda y filtros.
          Fila 2 (misma altura): en la Lista, los atajos por tarea; en Semana y Mes, "‹ Hoy ›" con el rango visible.
          A la derecha de la fila 2, cuántas citas se ven. ─── */}
      <div className="space-y-2.5">
        <div className="flex items-start gap-3">
          {/* Selector de vista: la lista sirve para ejecutar el día (Atender,
              Cobrar) y la semana/el mes para planificar. Conviven sobre los
              mismos datos. La semana no se ofrece donde no cabe. */}
          <div className="flex h-[38px] shrink-0 items-center gap-1 rounded-xl border border-slate-200/60 bg-white p-1 shadow-sm" role="group" aria-label="Vista de citas">
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
          <BarraBusquedaFiltros texto={busqueda} onTexto={setBusqueda} secciones={seccionesFiltro} etiquetas={etiquetasActivas} onLimpiar={limpiarFiltrosPanel} />
        </div>

        {/* Fila 2, igual en las tres vistas: a la izquierda cuántas citas se ven; a la derecha, el periodo (en la Lista,
            Hoy · Semana · Mes) y las flechas ‹ › con su título. */}
        <div className="flex h-12 items-center justify-between gap-3 px-2 pt-2.5">
          <div className="flex min-w-0 items-center gap-3">
            {vistaActiva === "lista" && buscando && (
              <p className="flex items-center gap-2 text-xs font-semibold text-slate-600"><Search size={14} aria-hidden="true" /> Buscando en todas las fechas</p>
            )}
            <ConteoCitas texto={textoResumen} />
          </div>
          {vistaActiva === "lista" ? (
            !buscando && (
              <div className="flex min-w-0 items-center gap-3">
                <PeriodoLista valor={filtro} onChange={elegirPeriodo} opciones={periodos} sinActivo={hayRango} />
                {(hayRango || ["hoy", "semana", "mes"].includes(filtro)) && (
                  <NavegadorPeriodo titulo={tituloLista} onAnterior={() => moverLista(-1)} onSiguiente={() => moverLista(1)} etiquetaAnterior="Periodo anterior" etiquetaSiguiente="Periodo siguiente" selector={selectorPeriodo} />
                )}
              </div>
            )
          ) : (
            <NavegadorPeriodo
              titulo={vistaActiva === "semana" ? tituloSemana(diasSemanaVisible[0], diasSemanaVisible[6]) : formatoFecha(mesVista, "mesAnioCorto")}
              onAnterior={() => (vistaActiva === "semana" ? setSemanaLunes((l) => sumarDiasISO(l, -7)) : irMesAnterior())}
              onSiguiente={() => (vistaActiva === "semana" ? setSemanaLunes((l) => sumarDiasISO(l, 7)) : irMesSiguiente())}
              etiquetaAnterior={vistaActiva === "semana" ? "Semana anterior" : "Mes anterior"}
              etiquetaSiguiente={vistaActiva === "semana" ? "Semana siguiente" : "Mes siguiente"}
              selector={selectorPeriodo}
            />
          )}
        </div>
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
          citasVisibles={resultado}
          aviso={avisoBusquedaSemana}
          onDiaClick={(iso) => setDiaModal({ iso, minutos: null })}
          onAbrirDetalle={abrirDetalle}
          onHuecoLibre={(iso, minutos) => setDiaModal({ iso, minutos })}
          onMover={pedirMovimiento}
          onAgendar={() => abrirModal()}
        />
      ) : vistaActiva === "mes" ? (
        <CalendarioMes
          mes={mesVista}
          citasPorFecha={gruposCalendario}
          onDiaClick={(iso) => setDiaModal({ iso, minutos: null })}
          onAbrirDetalle={abrirDetalle}
          onAgendar={() => abrirModal()}
        />
      ) : grupos.length === 0 && totalAnteriores === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-slate-50 text-slate-300">
            <Calendar size={30} />
          </div>
          <p className="mt-4 text-base font-semibold text-slate-600">{hoySinCitas ? "Hoy no hay citas" : hayFiltros ? "Ninguna cita coincide con estos filtros" : totalAlcance > 0 ? "Ninguna cita en este periodo" : "Todavía no hay citas"}</p>
          {hoySinCitas ? (
            <button type="button" onClick={() => setFiltro("semana")} className="mt-3 rounded-xl px-4 py-2 text-xs font-semibold text-white transition-transform hover:-translate-y-0.5 cursor-pointer" style={{ background: GRAD }}>Ver esta semana</button>
          ) : hayFiltros ? (
            <button type="button" onClick={limpiarFiltrosPanel} className="mt-3 rounded-xl border border-slate-200/60 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 cursor-pointer">Limpiar filtros</button>
          ) : (
            <p className="mt-1 text-sm text-slate-500">Agenda una nueva cita para empezar.</p>
          )}
        </div>
      ) : (
        <div className="space-y-8">
          {avisoSinCitasHoy && (
            <p role="status" className="rounded-xl border border-slate-200/60 bg-white px-4 py-3 text-sm text-slate-600">
              {avisoSinCitasHoy}
            </p>
          )}
          {recorteListado.grupos.map(renderDia)}
          {faltanListado > 0 && botonVerMas(faltanListado)}
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
              {anterioresVisibles && (
                <div className="mt-6 space-y-8">
                  {recorteAnteriores.grupos.map(renderDia)}
                  {faltanAnteriores > 0 && botonVerMas(faltanAnteriores)}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* ─── MODAL "CITAS DEL DÍA" (clic en un día de Semana o Mes) ─── */}
      {diaModal && (
        <DiaCitasModal
          iso={diaModal.iso}
          minutos={diaModal.minutos}
          citas={gruposCalendario.get(diaModal.iso) || []}
          equipo={equipo}
          vistaPropia={vistaPropia}
          filtrado={hayFiltros}
          onCerrar={() => setDiaModal(null)}
          onAbrirDetalle={(c) => { setDiaModal(null); abrirDetalle(c) }}
          onAgendar={puede(usuario, "citas", "crear") ? agendarDesdeDia : undefined}
          onVerSemana={cabeSemana && vistaActiva !== "semana" ? () => { setSemanaLunes(lunesDeSemana(diaModal.iso)); setDiaModal(null); setVista("semana") } : undefined}
        />
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

                <SelectorAsignado id="citas-asignado" valor={asignadoA} onChange={setAsignadoA} equipo={equipo} />

                {/* Atajo para un paciente que ya está en el local ahora mismo
                    (walk-in o llegó antes/después de su turno) — precarga la
                    hora real y marca la cita para pasar directo a "En
                    Atención" al confirmar, sin forzarlo a elegir un bloque de
                    la grilla de 30/40 min. Pedido explícito: "Atender Ahora /
                    Hora Actual", cero fricción cuando el paciente ya llegó. */}
                {puedeAtenderPacientes && (
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
                )}

                <SelectorFechaHora
                  disponibilidad={disponibilidad}
                  citas={citas}
                  fecha={fecha}
                  hora={horaPersonalizada ? "" : hora}
                  onCambiarFecha={setFecha}
                  onCambiarHora={(h) => { setHora(h); setAtenderInmediato(false) }}
                  mesesAdelante={14}
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
          fecha={fecha ? formatoFecha(fecha, "largoSinDia") : ""}
          hora={horaPersonalizada ? `${horaA12(horaCustom)}${atenderInmediato ? " (ahora)" : ` (personalizada, ~${duracionCustom} min)`}` : hora}
          onCancelar={() => setConfirmando(false)}
          onConfirmar={agendarCita}
          etiquetaConfirmar={atenderInmediato ? "Atender ahora" : "Confirmar"}
        />
      )}

      {/* ─── PANEL DE COBRO (cobro pendiente de una cita en atención) ─── */}
      {cobrandoCita && (() => {
        const paciente = pacientes.find((p) => p.id === cobrandoCita.pacienteId)
        const consulta = pendientesPorCita.get(cobrandoCita.id)
        if (!paciente || !consulta) return null
        return (
          <ComprobanteVentaModal
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
                  <h4 id="citas-modal-completar-titulo" className="text-lg font-bold" style={{ color: INK }}>{cpSolo ? "Registrar paciente" : "Completar registro"}</h4>
                  <p className="text-xs text-slate-500">
                    {cpSolo ? "Quedará vinculado a esta cita." : "Antes de abrir la ficha clínica, confirma sus datos."}
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
                  {cpGuardando ? "Guardando…" : cpSolo ? "Registrar paciente" : "Registrar y atender"}
                  {!cpSolo && <ChevronRight size={16} />}
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
              ¿Mover la cita de {moviendo.cita.paciente} al {formatoFecha(moviendo.fecha, "calendario", { enFrase: true })} a las {moviendo.hora}?
            </h4>
            <p className="mt-1.5 text-center text-sm text-slate-500">
              Ahora está {moviendo.cita.fecha === moviendo.fecha ? "ese mismo día" : "el " + formatoFecha(moviendo.cita.fecha, "calendario", { enFrase: true })} a las {moviendo.cita.hora}. La cita se reagenda, no se crea otra.
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

      {dejarCita && (
        <ConfirmarDejarDeAtender
          cita={dejarCita}
          usuario={usuario}
          setCitas={setCitas}
          onCancelar={() => setDejarCita(null)}
          onHecho={(mensaje) => { setDejarCita(null); onAviso?.(mensaje) }}
        />
      )}

      {/* ─── DETALLE DE LA CITA (clic en una cita de la lista o del modal "Citas del día") ─── */}
      {(() => {
        const cita = detalleCitaId ? citas.find((c) => c.id === detalleCitaId) : null
        if (!cita) return null
        return (
          <DetalleCitaModal
            cita={cita}
            paciente={pacientes.find((p) => p.id === cita.pacienteId) || null}
            vistaPropia={vistaPropia}
            equipo={equipo}
            fechaAtencionReal={fechaRealPorCitaId.get(cita.id)?.fecha}
            cobroPendiente={pendientesPorCita.has(cita.id)}
            onCerrar={() => setDetalleCitaId(null)}
            onIngresar={puedeAtenderPacientes ? (c) => { setDetalleCitaId(null); ingresarAFicha(c) } : undefined}
            preguntarOtroDia={preguntarOtroDia}
            onAgendarOtra={(c) => { setDetalleCitaId(null); agendarOtraCita(c) }}
            onCobrar={(c) => { setDetalleCitaId(null); cobrarCita(c) }}
            onEditar={(c) => { setDetalleCitaId(null); abrirReagendar(c) }}
            onCancelar={(c) => { setDetalleCitaId(null); setPorCancelar(c.id) }}
            onDejarDeAtender={(c) => { setDetalleCitaId(null); setDejarCita(c) }}
            marcandoEstado={marcandoEstadoId === cita.id}
            onLlego={puede(usuario, "citas", "editar") ? marcarLlego : undefined}
            onNoLlego={puede(usuario, "citas", "editar") ? marcarNoLlego : undefined}
            onNoAsistio={marcarNoAsistio}
            onConfirmar={puede(usuario, "citas", "editar") ? (c) => marcarConfirmada(c.id) : undefined}
            personasAsignables={personasAsignables}
            ausenteEnLaHora={(id, c) => ausenteEnHorario(disponibilidad, id, c.fecha, c.hora)}
            onReasignar={puedeReasignar(usuario, vistaPropia ? "propio" : "todo") ? reasignarCita : undefined}
            onTomar={puede(usuario, "citas", "editar") ? tomarCita : undefined}
            onRegistrarPaciente={puede(usuario, "pacientes", "crear") && puede(usuario, "citas", "editar") ? registrarPacienteDeCita : undefined}
          />
        )
      })()}

    </div>
  )
}