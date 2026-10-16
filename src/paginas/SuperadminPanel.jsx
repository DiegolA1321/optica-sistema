"use client"

import { dinero } from "../utilidades/formatoMoneda"
import { ahoraEcuador } from "../utilidades/horaEcuador"

import { fechaLegible, fechaHoraLegible, tituloSemana } from "../utilidades/formatoFecha"
import { useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import {
  Building2,
  Plus,
  X,
  Eye,
  EyeOff,
  AlertTriangle,
  AlertCircle,
  LogOut,
  ShieldCheck,
  Search,
  CheckCircle2,
  Ban,
  Calendar,
  Mail,
  MoreVertical,
  Copy,
  Check,
  Info,
  History,
  Clock,
  Hash,
  User,
  Lock,
  Loader2,
  XCircle,
  Circle,
  LayoutDashboard,
  Menu,
  ChevronsLeft,
  ChevronsRight,
  UserPlus,
  Pencil,
  Trash2,
  ChevronDown,
  TrendingUp,
  Settings,
  MessageSquare,
  Megaphone,
  Send,
  Cake,
  IdCard,
  Receipt,
  Printer,
  Wallet,
  RefreshCw,
  Inbox,
  PhoneCall,
  Users,
  Stethoscope,
  Image as ImageIcon,
  LogIn,
} from "lucide-react"
import PersonalizacionLogin from "../componentes/PersonalizacionLogin"
import { supabase, crearClienteTemporal } from "../lib/supabaseClient"
import SeccionMfa from "./SeccionMfa"
import { fechaAISO, hoyISO } from "../utilidades/disponibilidad"
import { sumarDiasISO } from "../utilidades/controles"
import CampoFecha from "../componentes/CampoFecha"
import { imprimirDocumento, estilosImpresion } from "../utilidades/imprimir"
import { Cascaron } from "../componentes/AtencionPaciente"
import { filtrarSoloLetras, esNombreValido, esEmailValido, esCedulaValida, esClaveSegura, validarClaveNueva } from "../utilidades/validaciones"
import { NOMBRE_MODULO, moduloDeRegistro } from "../utilidades/logs"
import { mensajeErrorEdgeFunction } from "../utilidades/edgeFunctions"
import { INK, ACCION_VER, ACCION_ELIMINAR } from "@/lib/tema"

// ─── Paleta de firma (consistente con el resto del sistema) ───
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)" // cian → azul

const generarSlug = (texto) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

// Sexta Mirada (Panel superadministrador, punto 10): el slug NO debe
// derivarse del nombre de la óptica — si la óptica cambia de nombre después,
// la URL queda atada al nombre viejo. Se genera un código corto genérico en
// vez, independiente de lo que el admin escriba como nombre.
const generarCodigoOptica = () => Math.random().toString(36).slice(2, 8)

// Ventana de cumpleaños (-5 a +7 días) → diferencia en días o null. Mismo
// cálculo que ya usan Dashboard.jsx y CRM.jsx (que ya lo duplican entre sí
// para pacientes) — acá va sobre fecha_nacimiento de administradores.
// Días hasta una fecha "YYYY-MM-DD" (negativo si ya pasó). Mismo estilo de
// parseo que diasACumple, evita el corrimiento de zona horaria de pasarle el
// string directo a `new Date()`.
const diasHasta = (fechaISO) => {
  if (!fechaISO) return null
  const partes = String(fechaISO).split(/[-/T]/)
  const y = Number(partes[0]), m = Number(partes[1]), d = Number(partes[2])
  if (!y || !m || !d) return null
  const hoy0 = ahoraEcuador()
  hoy0.setHours(0, 0, 0, 0)
  const objetivo = new Date(y, m - 1, d)
  objetivo.setHours(0, 0, 0, 0)
  return Math.round((objetivo - hoy0) / 86400000)
}

const diasACumple = (fn) => {
  if (!fn) return null
  const partes = String(fn).split(/[-/T]/)
  const mes = Number(partes[1])
  const dia = Number(partes[2])
  if (!mes || !dia) return null
  const hoy0 = ahoraEcuador()
  hoy0.setHours(0, 0, 0, 0)
  const y = hoy0.getFullYear()
  let mejor = null
  for (const yr of [y - 1, y, y + 1]) {
    const c = new Date(yr, mes - 1, dia)
    c.setHours(0, 0, 0, 0)
    const d = Math.round((c - hoy0) / 86400000)
    if (d >= -5 && d <= 7 && (mejor === null || Math.abs(d) < Math.abs(mejor))) mejor = d
  }
  return mejor
}

const camposOpticaIniciales = { nombreOptica: "", slug: "", eslogan: "", colorAcento: "#2563EB", logoUrl: "", nombreAdmin: "", cedulaAdmin: "", emailAdmin: "", fechaNacimientoAdmin: "", clave: "", confirmarClave: "", esOptometra: true }
const camposCuentaIniciales = { nombre: "", cedula: "", email: "", clave: "", confirmarClave: "", esOptometra: true }

const formatearFecha = (fecha) => fechaLegible(fecha)
const formatearFechaHora = (fecha) =>
  fechaHoraLegible(fecha, { anio: true })

import SoporteSuperadmin from "../componentes/soporte/SoporteSuperadmin"
import ResumenNegocio from "../componentes/superadmin/ResumenNegocio"
import useDatosNegocio from "../componentes/superadmin/useDatosNegocio"
import { EtiquetaPrueba } from "../componentes/superadmin/piezas"
import { textoDeAccion, opticasDelNegocio, sinPruebas, saludDeLaRed, esDePrueba } from "../utilidades/superadminNegocio"
import { diaDe, enRango, rangoDePeriodo } from "../utilidades/reportesPeriodo"
import SelectorPeriodo from "../componentes/reportes/SelectorPeriodo"
import { SinResultados } from "../componentes/reportes/bloques"
import { ESTADOS_LEAD_LISTA } from "../componentes/superadmin/ResumenNegocio"
import { CabeceraSeccion, EtiquetasFiltros, InsigniaSalud, InterruptorPrueba } from "../componentes/superadmin/piezas"
import ActividadSuperadmin from "../componentes/superadmin/ActividadSuperadmin"
import { leerTodasLasConsultas } from "../utilidades/soporteDatos"

const NAV = [
  { id: "resumen", nombre: "Resumen", icono: LayoutDashboard },
  { id: "opticas", nombre: "Ópticas", icono: Building2 },
  { id: "leads", nombre: "Leads", icono: Inbox },
  { id: "mensajes", nombre: "Soporte", icono: MessageSquare },
  { id: "actividad", nombre: "Actividad", icono: History },
  { id: "superadmins", nombre: "Superadmins", icono: ShieldCheck },
]

export default function SuperadminPanel({ usuario, alSalir, alActualizarUsuario, alEntrarComo }) {
  const [seccion, setSeccion] = useState("resumen")
  // Las ópticas de prueba y de demostración no cuentan en las métricas del negocio ni en la actividad salvo que se pida verlas.
  const [incluirPrueba, setIncluirPrueba] = useState(false)
  const datosNegocio = useDatosNegocio()
  const [rolesOptica, setRolesOptica] = useState(null)
  const [restaurandoRoles, setRestaurandoRoles] = useState(false)
  const [confirmarRestaurarRoles, setConfirmarRestaurarRoles] = useState(false)
  const [motivoSuspension, setMotivoSuspension] = useState("")
  // A dónde llevó el último "Abrir en …" del Resumen: cada sección parte de ahí con el mismo período y los mismos filtros.
  const [destinoSoporte, setDestinoSoporte] = useState(null)
  const [destinoActividad, setDestinoActividad] = useState(null)
  const [filtrosOpticas, setFiltrosOpticas] = useState({ desde: "", hasta: "", pago: "" })
  const [periodoLeads, setPeriodoLeads] = useState("todo")
  const [personalizadoLeads, setPersonalizadoLeads] = useState({ inicio: "", fin: "" })
  const [leadAbierto, setLeadAbierto] = useState(null)
  const [colapsado, setColapsado] = useState(false)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [userMenuAbierto, setUserMenuAbierto] = useState(false)
  const userRef = useRef(null)
  useEffect(() => {
    if (!userMenuAbierto) return
    const onDown = (e) => { if (userRef.current && !userRef.current.contains(e.target)) setUserMenuAbierto(false) }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [userMenuAbierto])

  const [opticas, setOpticas] = useState([])
  const [admins, setAdmins] = useState([])
  const [superadmins, setSuperadmins] = useState([])
  const [accionesPorSuperadmin, setAccionesPorSuperadmin] = useState({})
  const [cargando, setCargando] = useState(true)
  // Solo optica_id: liviano, alcanza para contar por óptica y en total
  // (feedback del ing: reportes de usuarios administradores/asistentes/
  // pacientes, por óptica y del sistema completo).
  const [asistentesOpticaId, setAsistentesOpticaId] = useState([])
  const [pacientesOpticaId, setPacientesOpticaId] = useState([])

  // ─── Leads (formulario "Obtener sistema" de la página de venta) ───
  const [leads, setLeads] = useState([])
  const [leadEnCurso, setLeadEnCurso] = useState(null)
  const [procesandoLeadId, setProcesandoLeadId] = useState(null)
  // Búsqueda + filtro por estado — con pocos leads no hacía falta, pero
  // crece rápido y sin esto se vuelve una lista larga para revisar a mano.
  const [busquedaLeads, setBusquedaLeads] = useState("")
  const [filtroEstadoLeads, setFiltroEstadoLeads] = useState("todos")

  // ─── Auditoría (paginada + filtrable por grupo) ───
  const [auditoria, setAuditoria] = useState([])
  const [estadoServidor, setEstadoServidor] = useState({ estado: "verificando", latenciaMs: null })

  // ─── Mensajes (consultas de administradores + avisos generales) ───
  const [mensajes, setMensajes] = useState([])
  const [mensajesFiltro, setMensajesFiltro] = useState("anuncio") // anuncio | pago | cumpleanos
  const [mensajeAbierto, setMensajeAbierto] = useState(null)
  // Consultas de soporte (migración 0115): las lee el panel para que la insignia del menú y la bandeja cuenten lo mismo.
  const [consultasSoporte, setConsultasSoporte] = useState([])
  const [cargandoSoporte, setCargandoSoporte] = useState(true)
  const [errorSoporte, setErrorSoporte] = useState("")
  const [modalAvisoAbierto, setModalAvisoAbierto] = useState(false)
  const [avisoAsunto, setAvisoAsunto] = useState("")
  const [avisoCuerpo, setAvisoCuerpo] = useState("")
  const [avisoDestino, setAvisoDestino] = useState("todos")
  const [publicandoAviso, setPublicandoAviso] = useState(false)
  const [errorAviso, setErrorAviso] = useState("")

  // Hover de los gráficos del Resumen — controla tanto el efecto visual
  // (el punto/barra se agranda) como el tooltip propio que lo acompaña, en
  // vez de depender del tooltip nativo del navegador (lento y con estilo
  // inconsistente entre navegadores).
  const [cargaInicial, setCargaInicial] = useState(true)

  // Toast flotante compartido — antes "Agregar superadmin", "Nuevo aviso" y
  // "Mi cuenta" (guardar nombre/correo) cerraban su modal en silencio, sin
  // ninguna confirmación de que el guardado real ocurrió. Uno solo, flotante
  // (no el banner inline que usa el resto del sistema), para el estándar
  // SaaS que pidió Diego para este panel específicamente.
  const [toastGlobal, setToastGlobal] = useState(null) // { tipo: "exito" | "error", texto, saliendo }
  // Guarda el id del timeout activo — antes cada llamada agendaba uno nuevo
  // sin limpiar el anterior, así que dos toasts en menos de 3s corrían una
  // carrera: el primero podía cerrar el segundo antes de tiempo (audit UX,
  // Lote 2, punto 2c).
  const toastTimeoutRef = useRef(null)
  const mostrarToast = (tipo, texto) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current)
    setToastGlobal({ tipo, texto, saliendo: false })
    toastTimeoutRef.current = setTimeout(() => {
      // Entra animado (rise-in) pero antes se desmontaba de golpe al vencer
      // el timeout — ahora primero pasa por "saliendo" (dispara rise-out) y
      // recién después de esa animación se desmonta.
      setToastGlobal((actual) => (actual ? { ...actual, saliendo: true } : actual))
      toastTimeoutRef.current = setTimeout(() => setToastGlobal(null), 200)
    }, 3000)
  }
  useEffect(() => () => { if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current) }, [])

  // ─── Crear óptica ───
  const [modalAbierto, setModalAbierto] = useState(false)
  const [campos, setCampos] = useState(camposOpticaIniciales)
  const [slugEstado, setSlugEstado] = useState("idle") // idle | verificando | disponible | ocupado
  const [verClave, setVerClave] = useState(false)
  const [error, setError] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [subiendoLogoCreacion, setSubiendoLogoCreacion] = useState(false)
  const [errorLogoCreacion, setErrorLogoCreacion] = useState("")

  // ─── Búsqueda, filtro por estado y detalle de ópticas ───
  const [busqueda, setBusqueda] = useState("")
  const [filtroEstado, setFiltroEstado] = useState("Todas") // Todas | Activas | Suspendidas
  const [detalle, setDetalle] = useState(null)
  const [procesandoId, setProcesandoId] = useState(null)
  // Confirmación antes de suspender/reactivar — antes alternarActiva() se
  // llamaba directo desde el botón, sin ningún paso de "¿estás seguro?" (un
  // solo clic accidental en el menú de la tabla cortaba el acceso de una
  // óptica entera). Reactivar no es tan delicado, pero se confirma igual
  // por consistencia y para no tener dos comportamientos distintos según el
  // estado actual.
  const [opticaAConfirmar, setOpticaAConfirmar] = useState(null)
  const [slugCopiado, setSlugCopiado] = useState(false)

  // ─── Detalle: renombrar óptica ───
  const [renombrando, setRenombrando] = useState(false)
  const [nombreEditado, setNombreEditado] = useState("")
  const [guardandoNombre, setGuardandoNombre] = useState(false)

  // ─── Detalle: suscripción y facturación ───
  const [actualizandoPago, setActualizandoPago] = useState(false)
  const [campoMonto, setCampoMonto] = useState("")
  const [campoVencimiento, setCampoVencimiento] = useState("")
  const [guardandoSuscripcion, setGuardandoSuscripcion] = useState(false)
  const [facturasOptica, setFacturasOptica] = useState([])
  const [cargandoFacturas, setCargandoFacturas] = useState(false)

  // ─── Detalle: "Ver actividades" de esa óptica (logs_optica) — caso de la
  // Sexta Mirada, separado a propósito de la sección "Actividad" general del
  // superadmin (esa solo registra acciones del propio superadmin, ver
  // renderActividad). RLS: logs_optica_superadmin_all. ───
  const [mostrarActividadOptica, setMostrarActividadOptica] = useState(false)
  const [logsOptica, setLogsOptica] = useState([])
  const [cargandoLogsOptica, setCargandoLogsOptica] = useState(false)
  const [filtroUsuarioLogOptica, setFiltroUsuarioLogOptica] = useState("todos")
  const [generandoFactura, setGenerandoFactura] = useState(false)
  const [facturaImprimir, setFacturaImprimir] = useState(null)
  const [guardandoCumple, setGuardandoCumple] = useState(null) // id del admin en guardado
  // Cédula (migración 0082) — mismo patrón inline que fecha_nacimiento:
  // editable por el superadmin en una cuenta de admin ya existente.
  const [guardandoCedula, setGuardandoCedula] = useState(null) // id del admin en guardado
  const [errorCedulaAdmin, setErrorCedulaAdmin] = useState(null) // { id, mensaje }

  // ─── Detalle: agregar / quitar administrador ───
  const [agregarAdminAbierto, setAgregarAdminAbierto] = useState(false)
  const [camposAdminExtra, setCamposAdminExtra] = useState(camposCuentaIniciales)
  const [verClaveExtra, setVerClaveExtra] = useState(false)
  const [errorAdminExtra, setErrorAdminExtra] = useState("")
  const [guardandoAdminExtra, setGuardandoAdminExtra] = useState(false)
  const [adminAEliminar, setAdminAEliminar] = useState(null)
  const [eliminandoAdmin, setEliminandoAdmin] = useState(false)
  const [errorEliminarAdmin, setErrorEliminarAdmin] = useState("")

  // ─── Superadmins ───
  const [modalSuperadminAbierto, setModalSuperadminAbierto] = useState(false)
  const [camposSuperadmin, setCamposSuperadmin] = useState(camposCuentaIniciales)
  const [verClaveSuperadmin, setVerClaveSuperadmin] = useState(false)
  const [errorSuperadmin, setErrorSuperadmin] = useState("")
  const [guardandoSuperadmin, setGuardandoSuperadmin] = useState(false)
  const [superadminAEliminar, setSuperadminAEliminar] = useState(null)
  const [eliminandoSuperadmin, setEliminandoSuperadmin] = useState(false)
  const [errorEliminarSuperadmin, setErrorEliminarSuperadmin] = useState("")

  // ─── Mi cuenta (el propio superadmin logueado: nombre, correo, contraseña) ───
  const [modalMiCuentaAbierto, setModalMiCuentaAbierto] = useState(false)
  const [camposMiCuenta, setCamposMiCuenta] = useState({ nombre: "", email: "" })
  const [errorMiCuenta, setErrorMiCuenta] = useState("")
  const [guardandoMiCuenta, setGuardandoMiCuenta] = useState(false)
  const [avisoEmailPendiente, setAvisoEmailPendiente] = useState(false)
  const [claveNueva, setClaveNueva] = useState("")
  const [confirmarClaveNueva, setConfirmarClaveNueva] = useState("")
  const [verClaveNueva, setVerClaveNueva] = useState(false)
  const [errorClaveNueva, setErrorClaveNueva] = useState("")
  const [guardandoClaveNueva, setGuardandoClaveNueva] = useState(false)
  const [claveActualizada, setClaveActualizada] = useState(false)

  const abrirMiCuenta = async () => {
    setErrorMiCuenta("")
    setAvisoEmailPendiente(false)
    setErrorClaveNueva("")
    setClaveActualizada(false)
    setClaveNueva("")
    setConfirmarClaveNueva("")
    // perfiles.email puede estar vacío en cuentas dadas de alta a mano por
    // SQL (ver superadmins creados fuera del flujo normal) — el correo real
    // de acceso siempre vive en Supabase Auth, así que se precarga de ahí.
    const { data } = (await supabase?.auth.getUser()) || {}
    setCamposMiCuenta({ nombre: usuario?.nombre || "", email: data?.user?.email || "" })
    setModalMiCuentaAbierto(true)
  }

  const guardarMiCuenta = async (e) => {
    e.preventDefault()
    setErrorMiCuenta("")
    const { nombre, email } = camposMiCuenta
    if (!esNombreValido(nombre)) { setErrorMiCuenta("Ingresa un nombre válido (solo letras)."); return }
    if (!esEmailValido(email, false)) { setErrorMiCuenta("Ingresa un correo válido (ej. nombre@dominio.com)."); return }
    setGuardandoMiCuenta(true)

    const { data: authData } = (await supabase.auth.getUser()) || {}
    const emailCambio = email.trim() !== authData?.user?.email

    if (emailCambio) {
      const { error: errorAuth } = await supabase.auth.updateUser({ email: email.trim() })
      if (errorAuth) {
        setErrorMiCuenta(errorAuth.message)
        setGuardandoMiCuenta(false)
        return
      }
    }

    const { error: errorPerfil } = await supabase.from("perfiles").update({ nombre: nombre.trim(), email: email.trim() }).eq("id", usuario.id)
    if (errorPerfil) {
      setErrorMiCuenta(errorPerfil.message)
      setGuardandoMiCuenta(false)
      return
    }

    alActualizarUsuario?.({ nombre: nombre.trim() })
    setSuperadmins((prev) => prev.map((s) => (s.id === usuario.id ? { ...s, nombre: nombre.trim(), email: email.trim() } : s)))
    setAvisoEmailPendiente(emailCambio)
    setGuardandoMiCuenta(false)
    if (!emailCambio) {
      setModalMiCuentaAbierto(false)
      mostrarToast("exito", "Tus datos se guardaron correctamente.")
    }
  }

  const actualizarMiClave = async (e) => {
    e.preventDefault()
    setErrorClaveNueva("")
    const errorClaveSegura = validarClaveNueva(claveNueva)
    if (errorClaveSegura) { setErrorClaveNueva(errorClaveSegura); return }
    if (claveNueva !== confirmarClaveNueva) { setErrorClaveNueva("Las contraseñas no coinciden."); return }
    setGuardandoClaveNueva(true)
    const { error: errorClave } = await supabase.auth.updateUser({ password: claveNueva })
    setGuardandoClaveNueva(false)
    if (errorClave) { setErrorClaveNueva(errorClave.message); return }
    setClaveNueva("")
    setConfirmarClaveNueva("")
    setClaveActualizada(true)
  }

  // El menú "más acciones" de cada fila se renderiza en un portal a
  // document.body (position: fixed, posición calculada del botón) en vez de
  // quedar anidado en el contenedor de la tabla — ese contenedor scrollea
  // horizontalmente (overflow-x-auto), lo que en la mayoría de navegadores
  // también activa overflow-y:auto y corta/atraviesa el menú con su propio
  // scrollbar en vez de dejarlo flotar limpio encima del contenido.
  const [menuAccionesId, setMenuAccionesId] = useState(null)
  const [menuPos, setMenuPos] = useState(null)
  const menuAccionesRef = useRef(null)
  const abrirMenuAcciones = (id, e) => {
    if (menuAccionesId === id) { setMenuAccionesId(null); return }
    const rect = e.currentTarget.getBoundingClientRect()
    setMenuPos({ top: rect.bottom + 6, left: rect.right - 208 })
    setMenuAccionesId(id)
  }
  useEffect(() => {
    if (menuAccionesId == null) return
    const cerrar = (e) => { if (menuAccionesRef.current && !menuAccionesRef.current.contains(e.target)) setMenuAccionesId(null) }
    const cerrarYa = () => setMenuAccionesId(null)
    document.addEventListener("mousedown", cerrar)
    window.addEventListener("scroll", cerrarYa, true)
    window.addEventListener("resize", cerrarYa)
    return () => {
      document.removeEventListener("mousedown", cerrar)
      window.removeEventListener("scroll", cerrarYa, true)
      window.removeEventListener("resize", cerrarYa)
    }
  }, [menuAccionesId])

  // Las últimas acciones (para "última acción" de cada superadmin y para avisarle a Actividad que hay algo nuevo). La pantalla Actividad
  // lee por su cuenta, con sus filtros.
  const cargarAuditoria = async () => {
    const { data } = await supabase.from("auditoria").select("*").order("created_at", { ascending: false }).limit(200)
    setAuditoria(data || [])
  }

  useEffect(() => {
    cargarAuditoria()
  }, [])

  const cargarDatos = async () => {
    setCargando(true)
    const t0 = performance.now()
    let opticasData = null, adminsData = null, superadminsData = null, asistentesData = null, pacientesData = null
    try {
      const resultados = await Promise.all([
        supabase.from("opticas").select("*").order("created_at", { ascending: false }),
        supabase.from("perfiles").select("id, optica_id, nombre, email, fecha_nacimiento, es_optometra, cedula, created_at").eq("rol", "admin"),
        supabase.from("perfiles").select("id, nombre, email, created_at").eq("rol", "superadmin").order("created_at", { ascending: true }),
        supabase.from("perfiles").select("optica_id, created_at, activo").eq("rol", "asistente"),
        supabase.from("pacientes").select("optica_id, created_at"),
      ])
      opticasData = resultados[0].data
      adminsData = resultados[1].data
      superadminsData = resultados[2].data
      asistentesData = resultados[3].data
      pacientesData = resultados[4].data
      // Estado de servidor honesto: basado en la latencia real de esta misma
      // carga, no un badge decorativo fijo en "operativo". Los umbrales son
      // orientativos (no un SLA), solo para distinguir "normal" de "lento".
      const latenciaMs = Math.round(performance.now() - t0)
      setEstadoServidor({ estado: latenciaMs < 1200 ? "operativo" : latenciaMs < 3500 ? "lento" : "critico", latenciaMs })
    } catch {
      setEstadoServidor({ estado: "sin_conexion", latenciaMs: null })
    }
    setOpticas(opticasData || [])
    setAdmins(adminsData || [])
    setSuperadmins(superadminsData || [])
    // Solo cuentan quienes trabajan hoy: las desactivadas no son "asistentes en la red".
    setAsistentesOpticaId((asistentesData || []).filter((a) => a.activo !== false))
    setPacientesOpticaId(pacientesData || [])
    setCargando(false)
    setCargaInicial(false)
    cargarAuditoria(true)
    if (opticasData?.length) verificarVencimientosPago(opticasData)

    // Conteo real de acciones por superadmin — un COUNT liviano por cuenta
    // (son pocas) en vez de traer toda la auditoría al cliente para sumarla.
    if (superadminsData?.length) {
      const conteos = await Promise.all(
        superadminsData.map(async (s) => {
          const { count } = await supabase.from("auditoria").select("id", { count: "exact", head: true }).eq("actor_id", s.id)
          return [s.id, count || 0]
        }),
      )
      setAccionesPorSuperadmin(Object.fromEntries(conteos))
    } else {
      setAccionesPorSuperadmin({})
    }

    cargarMensajes()
    cargarSoporte()
    cargarLeads()
  }

  const cargarMensajes = async () => {
    const { data } = await supabase.from("mensajes").select("*").order("created_at", { ascending: false })
    setMensajes(data || [])
  }

  const cargarSoporte = async () => {
    const r = await leerTodasLasConsultas()
    setConsultasSoporte(r.datos)
    setErrorSoporte(r.error || "")
    setCargandoSoporte(false)
  }

  // Una consulta nueva (o la respuesta de la óptica) aparece sin recargar: al volver a la pestaña y cada 30 segundos mientras se mira.
  useEffect(() => {
    const alVolver = () => { if (document.visibilityState === "visible") cargarSoporte() }
    document.addEventListener("visibilitychange", alVolver)
    const reloj = setInterval(alVolver, 30_000)
    return () => { document.removeEventListener("visibilitychange", alVolver); clearInterval(reloj) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const cargarLeads = async () => {
    const { data } = await supabase.from("leads").select("*").order("created_at", { ascending: false })
    setLeads(data || [])
  }

  const marcarLead = async (id, estado) => {
    const lead = leads.find((l) => l.id === id)
    setProcesandoLeadId(id)
    const { error } = await supabase.from("leads").update({ estado }).eq("id", id)
    if (!error) {
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, estado } : l)))
      setLeadAbierto((prev) => (prev && prev.id === id ? { ...prev, estado } : prev))
      await registrarAuditoria("cambiar_estado_lead", { opticaNombre: lead?.nombre_optica || "Lead", detalle: lead?.nombre_optica || null, antes: lead?.estado || null, despues: estado })
      cargarAuditoria(true)
      mostrarToast("exito", estado === "contactado" ? "Lead marcado como contactado." : estado === "descartado" ? "Lead descartado." : "Lead actualizado.")
    } else mostrarToast("error", "No se pudo actualizar el lead. Vuelve a intentarlo.")
    setProcesandoLeadId(null)
  }

  // Contactar un lead — mismo patrón de limpieza de número (prefijo Ecuador)
  // que CRM.jsx. Cada botón abre directo la app correspondiente ya con el
  // destinatario puesto, en vez de solo mostrar el dato en texto plano.
  const contactarLeadWhatsApp = (l) => {
    let numeroLimpio = (l.telefono || "").replace(/\D/g, "")
    if (numeroLimpio.startsWith("0")) numeroLimpio = "593" + numeroLimpio.substring(1)
    if (!numeroLimpio.startsWith("593") && numeroLimpio.length === 9) numeroLimpio = "593" + numeroLimpio
    const texto = `Hola ${l.nombre_admin}, te escribimos de Diego Óptica por tu solicitud para "${l.nombre_optica}". ¿Tienes un momento para conversar sobre el sistema?`
    window.open(`https://api.whatsapp.com/send?phone=${numeroLimpio}&text=${encodeURIComponent(texto)}`, "_blank")
  }

  const contactarLeadGmail = (l) => {
    const asunto = `Tu solicitud del sistema para ${l.nombre_optica}`
    const cuerpo = `Hola ${l.nombre_admin},\n\nTe escribimos por tu solicitud para "${l.nombre_optica}". Nos gustaría mostrarte el sistema completo y armar tu plan.\n\nSaludos,\nDiego Óptica`
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(l.email_admin)}&su=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`
    window.open(url, "_blank")
  }

  const abrirCrearDesdeLead = (lead) => {
    setCampos({
      ...camposOpticaIniciales,
      nombreOptica: lead.nombre_optica || "",
      // slug_deseado es una elección explícita del lead (no una derivación
      // automática del nombre), así que se respeta si la mandó — si no, se
      // genera el mismo código corto genérico que en la creación manual.
      slug: lead.slug_deseado ? generarSlug(lead.slug_deseado) : generarCodigoOptica(),
      nombreAdmin: lead.nombre_admin || "",
      emailAdmin: lead.email_admin || "",
    })
    setSlugEstado("idle")
    setVerClave(false)
    setError("")
    setLeadEnCurso(lead.id)
    setModalAbierto(true)
  }

  const publicarAviso = async (e) => {
    e.preventDefault()
    setErrorAviso("")
    if (!avisoAsunto.trim() || !avisoCuerpo.trim()) { setErrorAviso("Completa el asunto y el mensaje."); return }
    const opticaDestino = avisoDestino === "todos" ? null : avisoDestino
    if (avisoDestino !== "todos" && !opticaDestino) { setErrorAviso("Elige a qué óptica va dirigido el aviso."); return }
    setPublicandoAviso(true)
    const { data, error } = await supabase
      .from("mensajes")
      .insert({ tipo: "anuncio", optica_id: opticaDestino, remitente_id: usuario?.id || null, remitente_nombre: usuario?.nombre || "Superadmin", asunto: avisoAsunto.trim(), cuerpo: avisoCuerpo.trim(), estado: "resuelto" })
      .select()
      .single()
    if (error) {
      setErrorAviso(error.message)
      setPublicandoAviso(false)
      return
    }
    setMensajes((prev) => [data, ...prev])
    await registrarAuditoria("publicar_anuncio", { opticaNombre: opticaDestino ? (opticas.find((o) => o.id === opticaDestino)?.nombre || "Óptica") : "Todas las ópticas", detalle: avisoAsunto.trim() })
    cargarAuditoria(true)
    setPublicandoAviso(false)
    setModalAvisoAbierto(false)
    setAvisoAsunto("")
    setAvisoCuerpo("")
    setAvisoDestino("todos")
    mostrarToast("exito", "Aviso publicado correctamente.")
  }

  // Best-effort: si la tabla auditoria aún no existe (falta correr las
  // migraciones) esto no debe tumbar el resto de los flujos.
  const registrarAuditoria = async (accion, { opticaId = null, opticaNombre, detalle: detalleTexto = null, antes = null, despues = null }) => {
    const { error: errorAuditoria } = await supabase.from("auditoria").insert({
      actor_id: usuario?.id || null,
      actor_nombre: usuario?.nombre || "Superadmin",
      accion,
      optica_id: opticaId,
      optica_nombre: opticaNombre,
      detalle: detalleTexto,
      antes,
      despues,
    })
    if (errorAuditoria) console.warn("[auditoria] no se pudo registrar:", errorAuditoria.message)
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  // Escape cierra el menú "Más acciones" — todos los modales de este panel
  // ya migraron a su propio Escape vía useModalAccesible (ver más arriba);
  // esto es lo único que le quedaba a gestionar al viejo handler global.
  useEffect(() => {
    if (menuAccionesId == null) return
    const onKey = (e) => { if (e.key === "Escape") setMenuAccionesId(null) }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [menuAccionesId])

  const adminsPorOptica = useMemo(() => {
    const mapa = new Map()
    for (const a of admins) {
      const arr = mapa.get(a.optica_id) || []
      arr.push(a)
      mapa.set(a.optica_id, arr)
    }
    return mapa
  }, [admins])

  // Conteo de asistentes/pacientes por óptica — feedback del ing: reportes
  // de usuarios (administradores/asistentes/pacientes) por óptica y en total.
  const contarPorOptica = (filas) => {
    const mapa = new Map()
    for (const f of filas) mapa.set(f.optica_id, (mapa.get(f.optica_id) || 0) + 1)
    return mapa
  }
  const asistentesPorOptica = useMemo(() => contarPorOptica(asistentesOpticaId), [asistentesOpticaId])
  const pacientesPorOptica = useMemo(() => contarPorOptica(pacientesOpticaId), [pacientesOpticaId])

  // Lo que espera al soporte: consultas abiertas cuyo último mensaje es de la óptica (la insignia del menú y la bandeja cuentan lo mismo).
  const consultasAbiertas = useMemo(() => sinPruebas(consultasSoporte, opticas, incluirPrueba, "opticaId").filter((c) => c.estado !== "resuelta" && c.ultimoMensajeDe === "optica").length, [consultasSoporte, opticas, incluirPrueba])
  const mensajesFiltrados = useMemo(() => mensajes.filter((m) => m.tipo === "anuncio"), [mensajes])
  const opticasConPagoProblema = useMemo(() => opticas.filter((o) => o.estado_pago && o.estado_pago !== "al_dia"), [opticas])
  const cumpleanosProximos = useMemo(() => {
    return admins
      .map((a) => ({ admin: a, dias: diasACumple(a.fecha_nacimiento) }))
      .filter((x) => x.dias !== null)
      .sort((a, b) => a.dias - b.dias)
  }, [admins])

  // Las ópticas que cuentan: las de prueba solo con el interruptor. Todos los números de las secciones salen de aquí.
  const opticasVisibles = useMemo(() => opticasDelNegocio(opticas, incluirPrueba), [opticas, incluirPrueba])
  const consultasVisibles = useMemo(() => sinPruebas(consultasSoporte, opticas, incluirPrueba, "opticaId"), [consultasSoporte, opticas, incluirPrueba])
  const saludPorOptica = useMemo(() => {
    const filas = saludDeLaRed({ opticas: opticasVisibles, personas: datosNegocio.personas, uso: datosNegocio.uso, facturas: datosNegocio.facturas, consultas: consultasVisibles, hoyISO: hoyISO() })
    return new Map(filas.map((f) => [f.optica.id, f.salud]))
  }, [opticasVisibles, datosNegocio.personas, datosNegocio.uso, datosNegocio.facturas, consultasVisibles])
  const usoPorOptica = useMemo(() => new Map(datosNegocio.uso.map((u) => [u.optica_id, u])), [datosNegocio.uso])

  const opticasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return opticasVisibles.filter((o) => {
      const listaAdmins = adminsPorOptica.get(o.id) || []
      if (filtroEstado === "Activas" && !o.activa) return false
      if (filtroEstado === "Suspendidas" && o.activa) return false
      if (filtrosOpticas.pago && (o.estado_pago || "al_dia") !== filtrosOpticas.pago) return false
      if (filtrosOpticas.desde && diaDe(o.created_at) < filtrosOpticas.desde) return false
      if (filtrosOpticas.hasta && diaDe(o.created_at) > filtrosOpticas.hasta) return false
      if (!q) return true
      return (
        o.nombre.toLowerCase().includes(q) ||
        o.slug.toLowerCase().includes(q) ||
        listaAdmins.some((a) => a.nombre.toLowerCase().includes(q) || (a.email || "").toLowerCase().includes(q))
      )
    })
  }, [opticasVisibles, adminsPorOptica, busqueda, filtroEstado, filtrosOpticas])

  const totalActivas = opticasVisibles.filter((o) => o.activa).length
  const totalSuspendidas = opticasVisibles.length - totalActivas
  const nPrueba = opticas.filter(esDePrueba).length

  const tarjetas = [
    { key: "Todas", label: "Todas", valor: opticasVisibles.length, fg: "#2563EB" },
    { key: "Activas", label: "Activas", valor: totalActivas, fg: "#059669" },
    { key: "Suspendidas", label: "Suspendidas", valor: totalSuspendidas, fg: "#E11D48" },
  ]

  // Los "Abrir en …" del Resumen: llegan a la sección con el mismo período y los mismos filtros que el número que se pulsó.
  const irA = (modulo, params = {}) => {
    if (params.incluirPrueba) setIncluirPrueba(true)
    if (modulo === "opticas") {
      setFiltroEstado(params.estado || "Todas")
      setBusqueda("")
      setFiltrosOpticas({ desde: params.desde || "", hasta: params.hasta || "", pago: params.pago || "" })
      setSeccion("opticas")
      const o = params.abrir ? opticas.find((x) => x.id === params.abrir) : null
      if (o) abrirDetalleOptica(o)
    } else if (modulo === "leads") {
      if (params.desde || params.hasta) { setPeriodoLeads("personalizado"); setPersonalizadoLeads({ inicio: params.desde || "", fin: params.hasta || "" }) } else setPeriodoLeads("todo")
      setFiltroEstadoLeads(params.estado || "todos")
      setBusquedaLeads("")
      setSeccion("leads")
    } else if (modulo === "soporte") {
      setDestinoSoporte({ ...params, clave: Date.now() })
      setSeccion("mensajes")
    } else if (modulo === "superadmins") {
      setSeccion("superadmins")
    } else if (modulo === "actividad") {
      setDestinoActividad({ ...params, clave: Date.now() })
      setSeccion("actividad")
    }
  }

  const abrirDetalleOptica = (o) => {
    setDetalle(o)
    setConfirmarRestaurarRoles(false)
    cargarRolesOptica(o.id)
    setCampoMonto(o.monto_mensual != null ? String(o.monto_mensual) : "")
    setCampoVencimiento(o.proximo_vencimiento || "")
    setFacturasOptica([])
    cargarFacturasOptica(o.id)
    setMostrarActividadOptica(false)
    setLogsOptica([])
    setFiltroUsuarioLogOptica("todos")
  }

  // Mismo botón de subir logo, pero para "Crear óptica" — acá todavía no
  // existe un detalle.id real (la óptica no se creó todavía), así que sube
  // a una carpeta temporal propia en vez de "{opticaId}/archivo". La policy
  // de storage.objects ya le da a es_superadmin() acceso sin condicionar al
  // path, así que esto no necesita esperar a que la óptica exista primero.
  const subirLogoCreacion = async (archivo) => {
    if (!archivo) return
    if (archivo.size > 2 * 1024 * 1024) {
      setErrorLogoCreacion("La imagen no puede pesar más de 2 MB.")
      return
    }
    setErrorLogoCreacion("")
    setSubiendoLogoCreacion(true)
    const extension = archivo.name.split(".").pop()?.toLowerCase() || "png"
    const ruta = `temp-${crypto.randomUUID()}/${Date.now()}.${extension}`
    const { error: errorSubida } = await supabase.storage.from("logos").upload(ruta, archivo)
    setSubiendoLogoCreacion(false)
    if (errorSubida) {
      setErrorLogoCreacion("No se pudo subir la imagen. Intenta de nuevo.")
      return
    }
    const { data } = supabase.storage.from("logos").getPublicUrl(ruta)
    actualizarCampo("logoUrl", data.publicUrl)
  }

  // Última acción real de cada superadmin (de lo que ya está cargado en
  // `auditoria`, que viene ordenada desc) — para que la lista de Superadmins
  // no sea solo nombre+correo, sino que cuente algo de lo que esa cuenta
  // efectivamente hizo.
  const ultimaAccionPorSuperadmin = useMemo(() => {
    const mapa = new Map()
    for (const a of auditoria) {
      if (!a.actor_id || mapa.has(a.actor_id)) continue
      mapa.set(a.actor_id, a)
    }
    return mapa
  }, [auditoria])

  // Sexta Mirada (Panel superadministrador, punto 10): el nombre de la óptica
  // sí debe validarse como único (a diferencia del slug, que ya no depende
  // de él) — si ya existe, se sugiere un sufijo numérico automático, ej.
  // "Carla Visión 01", en vez de solo rechazar el envío sin alternativa.
  const nombreOpticaOcupado = (nombre) => opticas.some((o) => o.nombre.trim().toLowerCase() === nombre.trim().toLowerCase())
  const sugerenciaNombreOptica = useMemo(() => {
    const nombre = campos.nombreOptica.trim()
    if (!nombre || !nombreOpticaOcupado(nombre)) return ""
    let i = 1
    let candidato = `${nombre} ${String(i).padStart(2, "0")}`
    while (nombreOpticaOcupado(candidato)) { i += 1; candidato = `${nombre} ${String(i).padStart(2, "0")}` }
    return candidato
  }, [campos.nombreOptica, opticas])

  const abrirCrear = () => {
    setCampos({ ...camposOpticaIniciales, slug: generarCodigoOptica() })
    setSlugEstado("idle")
    setVerClave(false)
    setError("")
    setLeadEnCurso(null)
    setModalAbierto(true)
  }

  // Verificación en vivo de disponibilidad del slug (debounced) — evita que
  // el admin llene todo el formulario para recién enterarse al enviar de que
  // el identificador ya estaba en uso.
  useEffect(() => {
    if (!modalAbierto) return
    const slug = campos.slug.trim()
    if (slug.length < 2) {
      setSlugEstado("idle")
      return
    }
    setSlugEstado("verificando")
    let vigente = true
    const timer = setTimeout(async () => {
      const { data } = await supabase.from("opticas").select("id").eq("slug", slug).maybeSingle()
      if (vigente) setSlugEstado(data ? "ocupado" : "disponible")
    }, 400)
    return () => { vigente = false; clearTimeout(timer) }
  }, [campos.slug, modalAbierto])

  const cerrarModal = () => {
    if (guardando) return
    setModalAbierto(false)
  }

  // Detalle de óptica: Escape cancela primero la confirmación de eliminar
  // admin si está abierta (mismo orden de dos pasos que ya tenía el handler
  // global de Escape), y solo en un segundo Escape cierra el modal entero.
  const cerrarDetalle = () => {
    if (adminAEliminar) { setAdminAEliminar(null); return }
    setDetalle(null)
    setRenombrando(false)
    setAgregarAdminAbierto(false)
    setAdminAEliminar(null)
  }

  const actualizarCampo = (clave, valor) => {
    setCampos((prev) => ({ ...prev, [clave]: valor }))
  }

  const guardar = async (e) => {
    e.preventDefault()
    setError("")
    const { nombreOptica, slug, eslogan, colorAcento, logoUrl, nombreAdmin, cedulaAdmin, emailAdmin, fechaNacimientoAdmin, clave, confirmarClave, esOptometra } = campos
    if (!nombreOptica.trim() || !slug.trim() || !clave) {
      setError("Completa todos los campos.")
      return
    }
    if (sugerenciaNombreOptica) {
      setError(`Ya existe una óptica con ese nombre. Prueba con "${sugerenciaNombreOptica}".`)
      return
    }
    if (!esNombreValido(nombreAdmin)) { setError("Ingresa un nombre válido para el administrador (solo letras)."); return }
    // Cédula obligatoria para cuentas nuevas (migración 0082) — evita que la
    // misma persona termine con dos cuentas de admin.
    const cedulaAdminLimpia = cedulaAdmin.trim()
    if (!cedulaAdminLimpia) { setError("Completa la cédula del administrador."); return }
    if (!esCedulaValida(cedulaAdminLimpia)) { setError("La cédula del administrador no es válida."); return }
    if (!esEmailValido(emailAdmin, false)) { setError("Ingresa un correo válido para el administrador (ej. nombre@dominio.com)."); return }
    const errorClaveSegura = validarClaveNueva(clave)
    if (errorClaveSegura) {
      setError(errorClaveSegura)
      return
    }
    if (clave !== confirmarClave) {
      setError("Las contraseñas no coinciden.")
      return
    }

    setGuardando(true)

    // Si un intento anterior creó la óptica pero falló al dar de alta el admin
    // (ver más abajo), reintentar con el mismo slug no debe chocar contra el
    // unique constraint — se reutiliza esa óptica huérfana en vez de fallar.
    const { data: existente } = await supabase.from("opticas").select("*").eq("slug", slug.trim()).maybeSingle()
    let nuevaOptica = existente

    if (existente) {
      const { data: perfilExistente } = await supabase
        .from("perfiles")
        .select("id")
        .eq("optica_id", existente.id)
        .maybeSingle()
      if (perfilExistente) {
        setError("Esa dirección de la página ya está en uso por otra óptica.")
        setGuardando(false)
        return
      }
    } else {
      // marca.nombreMarca explícito: la columna trae "Diego Óptica" como
      // valor por defecto (para no romper la óptica de referencia ya
      // creada) — sin esto, cada óptica nueva arrancaría mostrando el
      // nombre de otra empresa en su propio login hasta que alguien entrara
      // a cambiarlo a mano. Eslogan/color/logo son opcionales acá mismo
      // (antes solo se podían tocar después, entrando de nuevo al detalle
      // de la óptica ya creada — pedido explícito de Diego de poder
      // personalizarla desde el mismo paso de creación).
      const { data: creada, error: errorOptica } = await supabase
        .from("opticas")
        .insert({
          nombre: nombreOptica.trim(),
          slug: slug.trim(),
          logo_url: logoUrl.trim() || null,
          marca: {
            nombreMarca: nombreOptica.trim(),
            eslogan: eslogan.trim() || "Ve el mundo con claridad.",
            colorAcento: colorAcento || "#2563EB",
          },
        })
        .select()
        .single()
      if (errorOptica) {
        setError(errorOptica.message.includes("duplicate") ? "Esa dirección de la página ya está en uso por otra óptica." : errorOptica.message)
        setGuardando(false)
        return
      }
      nuevaOptica = creada
    }

    const temp = crearClienteTemporal()
    const { data: alta, error: errorAlta } = await temp.auth.signUp({
      email: emailAdmin.trim(),
      password: clave,
    })

    if (errorAlta || !alta?.user) {
      setError((errorAlta?.message || "No se pudo crear la cuenta del administrador") + " — la óptica ya quedó creada, puedes reintentar la cuenta de admin más tarde.")
      setGuardando(false)
      cargarDatos()
      return
    }

    // Ciberseguridad: el insert de perfiles va con la sesión del superadmin
    // (supabase), no con la del usuario recién creado (temp) — la policy de
    // auto-inserción para rol='admin' no restringe optica_id, así que
    // insertar autenticado como el usuario nuevo dejaría a cualquiera con la
    // anon key crear una cuenta y auto-asignarse admin de CUALQUIER óptica
    // llamando la API de Supabase directo, sin pasar por esta pantalla.
    // perfiles_superadmin_all sí permite esto, scoped a que quien llama sea
    // superadmin de verdad.
    const { error: errorPerfil } = await supabase
      .from("perfiles")
      .insert({ id: alta.user.id, optica_id: nuevaOptica.id, rol: "admin", nombre: nombreAdmin.trim(), cedula: cedulaAdminLimpia, email: emailAdmin.trim(), fecha_nacimiento: fechaNacimientoAdmin || null, es_optometra: esOptometra })

    await temp.auth.signOut()

    if (errorPerfil) {
      const cedulaDuplicada = errorPerfil.code === "23505" || /duplicate key|unique constraint/i.test(errorPerfil.message)
      setError((cedulaDuplicada ? "Esa cédula ya está registrada por otro administrador de esta óptica." : errorPerfil.message) + " — la óptica y la cuenta de correo ya quedaron creadas: revísala en la lista de ópticas.")
      setGuardando(false)
      cargarDatos()
      return
    }

    await registrarAuditoria("crear_optica", { opticaId: nuevaOptica.id, opticaNombre: nuevaOptica.nombre })

    if (leadEnCurso) {
      await supabase.from("leads").update({ estado: "convertido", optica_id: nuevaOptica.id }).eq("id", leadEnCurso)
      setLeadEnCurso(null)
    }

    setGuardando(false)
    setModalAbierto(false)
    mostrarToast("exito", `Óptica ${nuevaOptica.nombre} creada correctamente.`)
    await cargarDatos()
    // Feedback de Diego: al crear una óptica, de una vez ofrecer editar cómo
    // se ve su login (logo, marca, servicios) en vez de dejarlo para que lo
    // busque después entre la lista de ópticas. El detalle abre con scroll
    // arriba del todo (Estado/Admins/Suscripción/Facturación primero) — se
    // baja directo a esa sección para que sea lo primero que se vea, en vez
    // de obligar a scrollear pasando por datos de facturación que a esta
    // óptica recién creada ni le aplican todavía.
    setSeccion("opticas")
    abrirDetalleOptica(nuevaOptica)
    setTimeout(() => document.getElementById("personalizacion-login")?.scrollIntoView({ behavior: "smooth", block: "start" }), 100)
  }

  const alternarActiva = async (optica, motivo = "") => {
    setProcesandoId(optica.id)
    const { error: errorUpdate } = await supabase.from("opticas").update({ activa: !optica.activa }).eq("id", optica.id)
    if (!errorUpdate) {
      setOpticas((prev) => prev.map((o) => (o.id === optica.id ? { ...o, activa: !o.activa } : o)))
      setDetalle((prev) => (prev && prev.id === optica.id ? { ...prev, activa: !prev.activa } : prev))
      await registrarAuditoria(optica.activa ? "suspender_optica" : "reactivar_optica", { opticaId: optica.id, opticaNombre: optica.nombre, detalle: motivo.trim() || null, antes: optica.activa ? "Activa" : "Suspendida", despues: optica.activa ? "Suspendida" : "Activa" })
      // El administrador se entera por el canal de Mensajes (avisos del sistema), no solo porque de golpe no puede entrar.
      await supabase.from("mensajes").insert({
        tipo: "anuncio", optica_id: optica.id, remitente_id: usuario?.id || null, remitente_nombre: usuario?.nombre || "Superadmin",
        asunto: optica.activa ? "Tu óptica fue suspendida" : "Tu óptica fue reactivada",
        cuerpo: optica.activa ? `Se suspendió el acceso al sistema.${motivo.trim() ? ` Motivo: ${motivo.trim()}.` : ""} Escríbenos desde aquí para resolverlo.` : "Ya puedes volver a usar el sistema con normalidad.",
        estado: "resuelto",
      })
      cargarMensajes()
      cargarAuditoria(true)
      datosNegocio.recargar()
      mostrarToast("exito", optica.activa ? `${optica.nombre} quedó suspendida.` : `${optica.nombre} quedó activa.`)
    }
    else mostrarToast("error", "No se pudo cambiar el estado de la óptica. Vuelve a intentarlo.")
    setProcesandoId(null)
  }

  const copiarSlug = (slug) => {
    navigator.clipboard?.writeText(slug)
    setSlugCopiado(true)
    setTimeout(() => setSlugCopiado(false), 1500)
  }

  const iniciarRenombrar = () => {
    setNombreEditado(detalle.nombre)
    setRenombrando(true)
  }
  const guardarNombre = async () => {
    const nuevo = nombreEditado.trim()
    if (!nuevo || nuevo === detalle.nombre) { setRenombrando(false); return }
    setGuardandoNombre(true)
    // El nombre público que ve el cliente (marca.nombreMarca, mostrado en
    // Login.jsx) es un campo aparte del nombre interno de la óptica — a
    // propósito, para poder personalizarlo distinto más adelante desde
    // Personalización. Pero renombrar la óptica acá SIEMPRE lo arrastra
    // también, sin condición: una heurística de "solo si nunca se
    // personalizó" resultó frágil en la práctica (una sola vez que no
    // sincronizara dejaba el nombre público pegado para siempre, sin forma
    // de que un renombre futuro lo corrigiera solo) y no es lo que Diego
    // pidió — dijo explícitamente que el nombre debe reflejarse en todos
    // lados al cambiarlo. Si de verdad se quiere un nombre público distinto
    // del oficial, se edita aparte en "Personalización del login" después.
    const marcaActualizada = { ...(detalle.marca || {}), nombreMarca: nuevo }
    const cambios = { nombre: nuevo, marca: marcaActualizada }
    const { error: errorUpdate } = await supabase.from("opticas").update(cambios).eq("id", detalle.id)
    if (!errorUpdate) {
      const anterior = detalle.nombre
      setOpticas((prev) => prev.map((o) => (o.id === detalle.id ? { ...o, ...cambios } : o)))
      setDetalle((prev) => ({ ...prev, ...cambios }))
      await registrarAuditoria("renombrar_optica", { opticaId: detalle.id, opticaNombre: nuevo, detalle: anterior, antes: anterior, despues: nuevo })
      cargarAuditoria(true)
      setRenombrando(false)
    }
    setGuardandoNombre(false)
  }

  const cargarFacturasOptica = async (opticaId) => {
    setCargandoFacturas(true)
    const { data } = await supabase.from("facturas").select("*").eq("optica_id", opticaId).order("emitida_at", { ascending: false })
    setFacturasOptica(data || [])
    setCargandoFacturas(false)
  }

  const cargarActividadOptica = async (opticaId) => {
    setCargandoLogsOptica(true)
    const { data } = await supabase
      .from("logs_optica")
      .select("*")
      .eq("optica_id", opticaId)
      .order("created_at", { ascending: false })
      .limit(100)
    setLogsOptica(data || [])
    setCargandoLogsOptica(false)
  }

  const alternarActividadOptica = () => {
    const abrir = !mostrarActividadOptica
    setMostrarActividadOptica(abrir)
    if (abrir && logsOptica.length === 0 && detalle) cargarActividadOptica(detalle.id)
  }

  // Se corre después de cada cargarDatos() (o sea, cada vez que el superadmin
  // abre o refresca el panel): si a una óptica al día le quedan <=2 días para
  // el vencimiento, o si ya venció, la escala sola y le manda el aviso —
  // mismo mecanismo que actualizarEstadoPago, pero sin depender de que haya
  // un modal de detalle abierto. Nunca "desescala" automáticamente (eso solo
  // lo hace registrarPago): solo empeora el estado, nunca lo mejora solo.
  // Límite real: esto corre en el navegador de Diego, no hay un cron en el
  // servidor — si nadie abre el panel de superadmin, no se dispara.
  const verificarVencimientosPago = async (lista) => {
    const aEscalar = lista
      .map((o) => {
        const dias = diasHasta(o.proximo_vencimiento)
        if (dias === null) return null
        if (dias < 0 && o.estado_pago !== "vencido") return { optica: o, nuevoEstado: "vencido", dias }
        if (dias <= 2 && o.estado_pago === "al_dia") return { optica: o, nuevoEstado: "pendiente", dias }
        return null
      })
      .filter(Boolean)
    if (aEscalar.length === 0) return

    for (const { optica: o, nuevoEstado, dias } of aEscalar) {
      const { error } = await supabase.from("opticas").update({ estado_pago: nuevoEstado }).eq("id", o.id)
      if (error) continue
      const textoEstado =
        nuevoEstado === "vencido" ? "está vencido" : dias === 0 ? "vence hoy" : dias === 1 ? "vence mañana" : `vence en ${dias} días`
      await supabase.from("mensajes").insert({
        tipo: "anuncio",
        optica_id: o.id,
        remitente_id: usuario?.id || null,
        remitente_nombre: usuario?.nombre || "Superadmin",
        asunto: "Estado de tu suscripción",
        cuerpo: `El pago de tu suscripción ${textoEstado}. Si ya lo hiciste, escríbenos desde aquí para confirmarlo.`,
        estado: "resuelto",
      })
      await registrarAuditoria("actualizar_pago", { opticaId: o.id, opticaNombre: o.nombre, detalle: "Automático por la fecha de vencimiento", antes: o.estado_pago || "al_dia", despues: nuevoEstado })
    }

    setOpticas((prev) => prev.map((o) => {
      const encontrado = aEscalar.find((e) => e.optica.id === o.id)
      return encontrado ? { ...o, estado_pago: encontrado.nuevoEstado } : o
    }))
    cargarMensajes()
    cargarAuditoria(true)
  }

  const actualizarEstadoPago = async (nuevoEstado) => {
    if (!detalle || nuevoEstado === detalle.estado_pago) return
    setActualizandoPago(true)
    const { error } = await supabase.from("opticas").update({ estado_pago: nuevoEstado }).eq("id", detalle.id)
    if (!error) {
      setOpticas((prev) => prev.map((o) => (o.id === detalle.id ? { ...o, estado_pago: nuevoEstado } : o)))
      setDetalle((prev) => ({ ...prev, estado_pago: nuevoEstado }))
      // Aviso dirigido solo a esta óptica cuando el pago deja de estar al día —
      // reusa 'anuncio' con optica_id puntual (ver policy en la migración 0005,
      // ya la deja pasar) en vez de inventar un tipo de mensaje nuevo.
      if (nuevoEstado !== "al_dia") {
        const textoEstado = nuevoEstado === "vencido" ? "está vencido" : "está pendiente"
        await supabase.from("mensajes").insert({
          tipo: "anuncio",
          optica_id: detalle.id,
          remitente_id: usuario?.id || null,
          remitente_nombre: usuario?.nombre || "Superadmin",
          asunto: "Estado de tu suscripción",
          cuerpo: `El pago de tu suscripción ${textoEstado}. Si ya lo hiciste, escríbenos desde aquí para confirmarlo.`,
          estado: "resuelto",
        })
        cargarMensajes()
      }
      await registrarAuditoria("actualizar_pago", { opticaId: detalle.id, opticaNombre: detalle.nombre, antes: detalle.estado_pago || "al_dia", despues: nuevoEstado })
      datosNegocio.recargar()
      cargarAuditoria(true)
    }
    setActualizandoPago(false)
  }

  const textoSuscripcion = (monto, vence) => `${monto != null && monto !== "" ? `${dinero(Number(monto))} al mes` : "Sin precio"} · ${vence ? `vence el ${fechaLegible(vence)}` : "sin vencimiento"}`
  const suscripcionCambio = !!detalle && (campoMonto !== (detalle.monto_mensual != null ? String(detalle.monto_mensual) : "") || campoVencimiento !== (detalle.proximo_vencimiento || ""))
  const guardarSuscripcion = async () => {
    if (!detalle || !suscripcionCambio) return
    setGuardandoSuscripcion(true)
    const cambios = { monto_mensual: campoMonto ? Number(campoMonto) : null, proximo_vencimiento: campoVencimiento || null }
    const antes = textoSuscripcion(detalle.monto_mensual, detalle.proximo_vencimiento)
    const { error } = await supabase.from("opticas").update(cambios).eq("id", detalle.id)
    if (!error) {
      setOpticas((prev) => prev.map((o) => (o.id === detalle.id ? { ...o, ...cambios } : o)))
      setDetalle((prev) => ({ ...prev, ...cambios }))
      await registrarAuditoria("cambiar_suscripcion", { opticaId: detalle.id, opticaNombre: detalle.nombre, antes, despues: textoSuscripcion(cambios.monto_mensual, cambios.proximo_vencimiento) })
      cargarAuditoria(true)
      mostrarToast("exito", "Suscripción guardada.")
    } else mostrarToast("error", "No se pudo guardar la suscripción. Vuelve a intentarlo.")
    setGuardandoSuscripcion(false)
  }

  // Marcar una óptica como de prueba o de demostración: deja de contar en las métricas del negocio y en la actividad, salvo que se pida verlas.
  const marcarPrueba = async (valor) => {
    if (!detalle) return
    const { error } = await supabase.from("opticas").update({ es_de_prueba: valor }).eq("id", detalle.id)
    if (error) { mostrarToast("error", "No se pudo cambiar la marca de prueba. Vuelve a intentarlo."); return }
    setOpticas((prev) => prev.map((o) => (o.id === detalle.id ? { ...o, es_de_prueba: valor } : o)))
    setDetalle((prev) => ({ ...prev, es_de_prueba: valor }))
    await registrarAuditoria("marcar_optica_prueba", { opticaId: detalle.id, opticaNombre: detalle.nombre, antes: valor ? "Óptica real" : "Óptica de prueba", despues: valor ? "Óptica de prueba" : "Óptica real" })
    cargarAuditoria(true)
    mostrarToast("exito", valor ? `${detalle.nombre} ahora es una óptica de prueba.` : `${detalle.nombre} ahora cuenta en las métricas del negocio.`)
  }

  // Roles de la óptica (solo lectura) y su restauración a los predefinidos (Optómetra, Recepción y Ventas).
  const cargarRolesOptica = async (opticaId) => {
    setRolesOptica(null)
    const [{ data: roles }, { data: asignados }] = await Promise.all([
      supabase.from("roles").select("id, clave, nombre, es_predefinido, permisos").eq("optica_id", opticaId).order("es_predefinido", { ascending: false }).order("nombre"),
      supabase.from("perfil_roles").select("rol_id"),
    ])
    const porRol = new Map()
    for (const a of asignados || []) porRol.set(a.rol_id, (porRol.get(a.rol_id) || 0) + 1)
    setRolesOptica((roles || []).map((r) => ({ ...r, personas: porRol.get(r.id) || 0 })))
  }
  const restaurarRoles = async () => {
    if (!detalle) return
    setRestaurandoRoles(true)
    const { error } = await supabase.rpc("restaurar_roles_predefinidos", { p_optica_id: detalle.id })
    setRestaurandoRoles(false)
    setConfirmarRestaurarRoles(false)
    if (error) { mostrarToast("error", /rol propio/.test(error.message || "") ? error.message : "No se pudieron restaurar los roles. Vuelve a intentarlo."); return }
    mostrarToast("exito", "Los roles predefinidos volvieron a como los crea el sistema.")
    cargarRolesOptica(detalle.id)
  }

  const registrarPago = async () => {
    if (!detalle) return
    const estadoAntes = detalle.estado_pago || "al_dia"
    setActualizandoPago(true)
    const hoy = ahoraEcuador()
    // fechaAISO() arma la fecha con los componentes locales, no vía
    // toISOString() (convierte a UTC primero) — hoy no cambia el resultado
    // porque Ecuador está detrás de UTC, pero es el mismo patrón de bug de
    // zona horaria que sí se manifestó en Pacientes.jsx/Citas.jsx/
    // ConsultaMedica.jsx, y este panel es multi-óptica (podría no ser
    // siempre Ecuador).
    const siguienteVencimiento = fechaAISO(new Date(hoy.getFullYear(), hoy.getMonth() + 1, hoy.getDate()))
    const cambios = { estado_pago: "al_dia", proximo_vencimiento: siguienteVencimiento }
    const { error } = await supabase.from("opticas").update(cambios).eq("id", detalle.id)
    if (!error) {
      setOpticas((prev) => prev.map((o) => (o.id === detalle.id ? { ...o, ...cambios } : o)))
      setDetalle((prev) => ({ ...prev, ...cambios }))
      setCampoVencimiento(siguienteVencimiento)
      await registrarAuditoria("actualizar_pago", { opticaId: detalle.id, opticaNombre: detalle.nombre, antes: estadoAntes, despues: "al_dia" })
      datosNegocio.recargar()
      mostrarToast("exito", "Pago registrado: la óptica quedó al día.")
      cargarAuditoria(true)
    }
    setActualizandoPago(false)
  }

  const generarFactura = async () => {
    if (!detalle) return
    setGenerandoFactura(true)
    const hoy = ahoraEcuador()
    const periodo = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`
    const numero = `FACT-${detalle.slug.slice(0, 6).toUpperCase()}-${periodo.replace("-", "")}`
    const { data, error } = await supabase
      .from("facturas")
      .insert({ optica_id: detalle.id, numero, periodo, monto: detalle.monto_mensual || 0 })
      .select()
      .single()
    if (!error) {
      setFacturasOptica((prev) => [data, ...prev])
      await registrarAuditoria("generar_factura", { opticaId: detalle.id, opticaNombre: detalle.nombre, detalle: numero })
      datosNegocio.recargar()
      mostrarToast("exito", `Factura ${numero} generada.`)
      cargarAuditoria(true)
    }
    setGenerandoFactura(false)
  }

  const alternarEstadoFactura = async (factura) => {
    const nuevoEstado = factura.estado === "pagada" ? "pendiente" : "pagada"
    const cambios = { estado: nuevoEstado, pagada_at: nuevoEstado === "pagada" ? new Date().toISOString() : null }
    const { error } = await supabase.from("facturas").update(cambios).eq("id", factura.id)
    if (!error) {
      setFacturasOptica((prev) => prev.map((f) => (f.id === factura.id ? { ...f, ...cambios } : f)))
      await registrarAuditoria("pagar_factura", { opticaId: factura.optica_id, opticaNombre: opticas.find((o) => o.id === factura.optica_id)?.nombre || detalle?.nombre || "Óptica", detalle: factura.numero, antes: factura.estado === "pagada" ? "Pagada" : "Pendiente", despues: nuevoEstado === "pagada" ? "Pagada" : "Pendiente" })
      cargarAuditoria(true)
      datosNegocio.recargar()
      mostrarToast("exito", nuevoEstado === "pagada" ? `Factura ${factura.numero} marcada como pagada.` : `Factura ${factura.numero} devuelta a pendiente.`)
    } else mostrarToast("error", "No se pudo cambiar la factura. Vuelve a intentarlo.")
  }

  const guardarCumpleanos = async (adminId, fecha) => {
    setGuardandoCumple(adminId)
    const { error } = await supabase.from("perfiles").update({ fecha_nacimiento: fecha || null }).eq("id", adminId)
    if (!error) setAdmins((prev) => prev.map((a) => (a.id === adminId ? { ...a, fecha_nacimiento: fecha || null } : a)))
    setGuardandoCumple(null)
  }

  // ¿Es también el optómetra/licenciado? — caso "Usuarios y permisos" de la
  // reunión con el ing, punto 1: solo un dato informativo para saber si ese
  // admin va a administrar el sistema él mismo o va a delegarlo.
  // Con roles (migración 0090) "también atiende" es tener el rol Optómetra: se asigna o se quita ese rol
  // y la base recalcula es_optometra sola.
  const guardarEsOptometra = async (adminId, valor) => {
    const admin = admins.find((x) => x.id === adminId)
    if (!admin?.optica_id) return
    const { data: rol } = await supabase.from("roles").select("id").eq("optica_id", admin.optica_id).eq("clave", "optometra").maybeSingle()
    if (!rol) return
    const { error } = valor
      ? await supabase.from("perfil_roles").upsert({ perfil_id: adminId, rol_id: rol.id }, { onConflict: "perfil_id,rol_id", ignoreDuplicates: true })
      : await supabase.from("perfil_roles").delete().eq("perfil_id", adminId).eq("rol_id", rol.id)
    if (!error) setAdmins((prev) => prev.map((a) => (a.id === adminId ? { ...a, es_optometra: valor } : a)))
  }

  // Cédula (migración 0082): editable en una cuenta de admin ya existente —
  // igual que en Usuarios.jsx, vacío es válido (cuenta antigua sin cédula
  // registrada), pero si se escribe algo tiene que pasar el mismo chequeo de
  // formato y de duplicado por óptica que en la creación.
  const guardarCedula = async (adminId, valor) => {
    const limpia = valor.trim()
    if (limpia && !esCedulaValida(limpia)) {
      setErrorCedulaAdmin({ id: adminId, mensaje: "Cédula inválida." })
      return
    }
    setGuardandoCedula(adminId)
    setErrorCedulaAdmin(null)
    const { error } = await supabase.from("perfiles").update({ cedula: limpia || null }).eq("id", adminId)
    setGuardandoCedula(null)
    if (error) {
      setErrorCedulaAdmin({
        id: adminId,
        mensaje: error.code === "23505" || /duplicate key|unique constraint/i.test(error.message)
          ? "Esa cédula ya está registrada por otro administrador de esta óptica."
          : "No se pudo guardar. Intenta de nuevo.",
      })
      return
    }
    setAdmins((prev) => prev.map((a) => (a.id === adminId ? { ...a, cedula: limpia || null } : a)))
  }

  const abrirAgregarAdmin = () => {
    setCamposAdminExtra(camposCuentaIniciales)
    setVerClaveExtra(false)
    setErrorAdminExtra("")
    setAgregarAdminAbierto(true)
  }
  const actualizarCampoAdminExtra = (clave, valor) => setCamposAdminExtra((prev) => ({ ...prev, [clave]: valor }))
  const guardarAdminExtra = async (e) => {
    e.preventDefault()
    setErrorAdminExtra("")
    const { nombre, cedula, email, clave, confirmarClave, esOptometra } = camposAdminExtra
    if (!esNombreValido(nombre)) { setErrorAdminExtra("Ingresa un nombre válido (solo letras)."); return }
    const cedulaExtraLimpia = cedula.trim()
    if (!cedulaExtraLimpia) { setErrorAdminExtra("Completa la cédula."); return }
    if (!esCedulaValida(cedulaExtraLimpia)) { setErrorAdminExtra("La cédula ingresada no es válida."); return }
    if (!esEmailValido(email, false)) { setErrorAdminExtra("Ingresa un correo válido (ej. nombre@dominio.com)."); return }
    if (!clave) { setErrorAdminExtra("Completa la contraseña."); return }
    if (validarClaveNueva(clave)) { setErrorAdminExtra(validarClaveNueva(clave)); return }
    if (clave !== confirmarClave) { setErrorAdminExtra("Las contraseñas no coinciden."); return }
    setGuardandoAdminExtra(true)
    const temp = crearClienteTemporal()
    const { data: alta, error: errorAlta } = await temp.auth.signUp({ email: email.trim(), password: clave })
    if (errorAlta || !alta?.user) {
      // Mismo caso que Usuarios.jsx: eliminar un administrador solo borra su
      // fila de "perfiles", no la cuenta real de Supabase Auth (necesitaría
      // una clave de servicio que el cliente no debe tener) — ese correo
      // queda inservible para siempre desde acá. El mensaje genérico de
      // Supabase no lo explica.
      const yaRegistrado = /already registered|already exists|already in use/i.test(errorAlta?.message || "")
      setErrorAdminExtra(yaRegistrado
        ? "Ese correo ya tiene una cuenta en el sistema (puede ser de un administrador eliminado antes) — usa un correo distinto."
        : errorAlta?.message || "No se pudo crear la cuenta.")
      setGuardandoAdminExtra(false)
      return
    }
    // Ciberseguridad: insert con la sesión del superadmin (supabase), no con
    // la del usuario recién creado — ver nota igual en crearOptica más
    // arriba.
    const { error: errorPerfil } = await supabase.from("perfiles").insert({ id: alta.user.id, optica_id: detalle.id, rol: "admin", nombre: nombre.trim(), cedula: cedulaExtraLimpia, email: email.trim(), es_optometra: esOptometra })
    await temp.auth.signOut()
    if (errorPerfil) {
      const cedulaDuplicada = errorPerfil.code === "23505" || /duplicate key|unique constraint/i.test(errorPerfil.message)
      setErrorAdminExtra((cedulaDuplicada ? "Esa cédula ya está registrada por otro administrador de esta óptica." : errorPerfil.message) + " — la cuenta de correo ya quedó creada: vuelve a intentarlo o revísala en la lista.")
      setGuardandoAdminExtra(false)
      return
    }
    await registrarAuditoria("agregar_administrador", { opticaId: detalle.id, opticaNombre: detalle.nombre, detalle: nombre.trim() })
    setGuardandoAdminExtra(false)
    setAgregarAdminAbierto(false)
    cargarDatos()
  }
  // Punto 02 del Diagnóstico Maestro: antes esto solo borraba la fila de
  // "perfiles" — la cuenta de Supabase Auth quedaba huérfana para siempre
  // (su correo nunca podía volver a usarse). La Edge Function borra ambas
  // cosas, verificando del lado del servidor que quien llama es superadmin
  // antes de usar la service role. mensajeErrorEdgeFunction ahora vive en
  // utilidades/edgeFunctions.js, compartida con Usuarios.jsx desde que ese
  // módulo también empezó a usar esta misma Edge Function.
  const confirmarEliminarAdmin = async () => {
    if (!adminAEliminar) return
    setEliminandoAdmin(true)
    setErrorEliminarAdmin("")
    const { data, error: errorInvoke } = await supabase.functions.invoke("eliminar-cuenta-auth", { body: { perfilId: adminAEliminar.id } })
    const errorMensaje = await mensajeErrorEdgeFunction(errorInvoke, data)
    if (!errorMensaje) {
      await registrarAuditoria("eliminar_administrador", { opticaId: detalle.id, opticaNombre: detalle.nombre, detalle: adminAEliminar.nombre })
      setAdmins((prev) => prev.filter((a) => a.id !== adminAEliminar.id))
      cargarAuditoria(true)
      setAdminAEliminar(null)
    } else {
      setErrorEliminarAdmin(errorMensaje)
    }
    setEliminandoAdmin(false)
  }

  const abrirCrearSuperadmin = () => {
    setCamposSuperadmin(camposCuentaIniciales)
    setVerClaveSuperadmin(false)
    setErrorSuperadmin("")
    setModalSuperadminAbierto(true)
  }
  const actualizarCampoSuperadmin = (clave, valor) => setCamposSuperadmin((prev) => ({ ...prev, [clave]: valor }))
  const guardarSuperadmin = async (e) => {
    e.preventDefault()
    setErrorSuperadmin("")
    const { nombre, email, clave, confirmarClave } = camposSuperadmin
    if (!esNombreValido(nombre)) { setErrorSuperadmin("Ingresa un nombre válido (solo letras)."); return }
    if (!esEmailValido(email, false)) { setErrorSuperadmin("Ingresa un correo válido (ej. nombre@dominio.com)."); return }
    if (!clave) { setErrorSuperadmin("Completa la contraseña."); return }
    if (validarClaveNueva(clave)) { setErrorSuperadmin(validarClaveNueva(clave)); return }
    if (clave !== confirmarClave) { setErrorSuperadmin("Las contraseñas no coinciden."); return }
    setGuardandoSuperadmin(true)
    const temp = crearClienteTemporal()
    const { data: alta, error: errorAlta } = await temp.auth.signUp({ email: email.trim(), password: clave })
    await temp.auth.signOut()
    if (errorAlta || !alta?.user) {
      const yaRegistrado = /already registered|already exists|already in use/i.test(errorAlta?.message || "")
      setErrorSuperadmin(yaRegistrado
        ? "Ese correo ya tiene una cuenta en el sistema — usa un correo distinto."
        : errorAlta?.message || "No se pudo crear la cuenta.")
      setGuardandoSuperadmin(false)
      return
    }
    // El self-insert de perfiles solo permite rol='admin' (RLS, ver
    // migración 0001) — para rol='superadmin' hay que insertar con la
    // sesión del superadmin actual, que sí tiene permiso "for all" sobre
    // perfiles vía la policy perfiles_superadmin_all/es_superadmin().
    const { error: errorPerfil } = await supabase.from("perfiles").insert({ id: alta.user.id, rol: "superadmin", nombre: nombre.trim(), email: email.trim() })
    if (errorPerfil) {
      setErrorSuperadmin(errorPerfil.message + " — la cuenta de correo ya quedó creada: vuelve a intentarlo o revísala en la lista.")
      setGuardandoSuperadmin(false)
      return
    }
    await registrarAuditoria("crear_superadmin", { opticaNombre: nombre.trim() })
    setGuardandoSuperadmin(false)
    setModalSuperadminAbierto(false)
    mostrarToast("exito", `Superadmin ${nombre.trim()} creado correctamente.`)
    cargarDatos()
  }
  const confirmarEliminarSuperadmin = async () => {
    if (!superadminAEliminar) return
    setEliminandoSuperadmin(true)
    setErrorEliminarSuperadmin("")
    const { data, error: errorInvoke } = await supabase.functions.invoke("eliminar-cuenta-auth", { body: { perfilId: superadminAEliminar.id } })
    const errorMensaje = await mensajeErrorEdgeFunction(errorInvoke, data)
    if (!errorMensaje) {
      await registrarAuditoria("eliminar_superadmin", { opticaNombre: superadminAEliminar.nombre })
      setSuperadmins((prev) => prev.filter((s) => s.id !== superadminAEliminar.id))
      cargarAuditoria(true)
      setSuperadminAEliminar(null)
    } else {
      setErrorEliminarSuperadmin(errorMensaje)
    }
    setEliminandoSuperadmin(false)
  }

  // ─── Secciones ───


  // Solo se muestra en la primerísima carga (cargaInicial) — evita el "flash"
  // de tarjetas en 0 y gráficos vacíos antes de que responda Supabase, sin
  // tapar el panel de nuevo en cada refetch posterior a una acción.
  const Skeleton = ({ className }) => <div className={"animate-pulse rounded-2xl bg-slate-200/70 " + className} />

  const renderResumen = () => cargaInicial ? (
    <div className="space-y-4" aria-busy="true" aria-label="Cargando el resumen">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>
  ) : (
    <ResumenNegocio
      datos={datosNegocio} opticas={opticas} leads={leads} consultas={consultasSoporte} cargandoSoporte={cargandoSoporte} estadoServidor={estadoServidor}
      incluirPrueba={incluirPrueba} onIncluirPrueba={setIncluirPrueba} usuario={usuario}
      onAbrir={irA} onEntrarComo={(o) => alEntrarComo?.(o)} onAviso={(t) => mostrarToast("exito", t)} onCrearOptica={abrirCrear}
    />
  )

  const MENSAJES_FILTROS = [
    { key: "anuncio", label: "Avisos" },
    { key: "pago", label: "Pagos" },
    { key: "cumpleanos", label: "Cumpleaños" },
  ]

  // Los avisos del sistema, los pagos pendientes y los cumpleaños de los administradores: lo que ya existía, sin cambios, ahora en su pestaña de Soporte.
  const renderAvisos = () => (
    <div className="space-y-5">
      {/* ─── Panel de control: cada tarjeta es real y clickeable, mismo lenguaje visual que CRM.jsx (Dashboard) ─── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setMensajesFiltro(mensajesFiltro === "pago" ? "todas" : "pago")}
          className="flex items-center justify-between rounded-2xl border bg-white p-5 text-left transition-all hover:-translate-y-0.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
          style={{
            borderColor: mensajesFiltro === "pago" ? "#D97706" : opticasConPagoProblema.length > 0 ? "#D97706" : "rgba(14,43,51,0.08)",
            boxShadow: mensajesFiltro === "pago" ? "0 0 0 3px rgba(217,119,6,0.14)" : opticasConPagoProblema.length > 0 ? "0 0 0 3px rgba(217,119,6,0.14)" : "0 1px 2px rgba(14,43,51,0.04)",
          }}
        >
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Pago pendiente/vencido</p>
            <p className="mt-1 text-3xl font-serif font-semibold leading-none" style={{ color: INK }}>{opticasConPagoProblema.length}</p>
            <p className="mt-1.5 text-xs font-semibold" style={{ color: opticasConPagoProblema.length > 0 ? "#B45309" : "#94A3B8" }}>{opticasConPagoProblema.length > 0 ? "revisar suscripciones" : "ninguna"}</p>
          </div>
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ background: "#FFF7E6", color: "#B45309" }}>
            <Wallet size={22} />
          </div>
        </button>

        <button
          type="button"
          onClick={() => setMensajesFiltro(mensajesFiltro === "cumpleanos" ? "todas" : "cumpleanos")}
          className="flex items-center justify-between rounded-2xl border bg-white p-5 text-left transition-all hover:-translate-y-0.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
          style={{
            borderColor: mensajesFiltro === "cumpleanos" ? "#7C3AED" : "rgba(14,43,51,0.08)",
            boxShadow: mensajesFiltro === "cumpleanos" ? "0 0 0 3px rgba(124,58,237,0.14)" : "0 1px 2px rgba(14,43,51,0.04)",
          }}
        >
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Cumpleaños próximos</p>
            <p className="mt-1 text-3xl font-serif font-semibold leading-none" style={{ color: INK }}>{cumpleanosProximos.length}</p>
            <p className="mt-1.5 text-xs font-semibold" style={{ color: cumpleanosProximos.length > 0 ? "#7C3AED" : "#94A3B8" }}>{cumpleanosProximos.length > 0 ? "en los próximos días" : "ninguno"}</p>
          </div>
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ background: "#F1EAFE", color: "#7C3AED" }}>
            <Cake size={22} />
          </div>
        </button>
      </div>

      {/* ─── Bandeja ─── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/60 bg-slate-50/70 p-4">
          <div className="flex items-center gap-1 rounded-2xl border border-slate-200/60 bg-white p-1 shadow-inner">
            {MENSAJES_FILTROS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setMensajesFiltro(f.key)}
                className={"rounded-xl px-3.5 py-2 text-xs font-bold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 " + (mensajesFiltro === f.key ? "bg-slate-100 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                style={mensajesFiltro === f.key ? { color: INK } : undefined}
              >
                {f.label}
              </button>
            ))}
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {mensajesFiltro === "pago"
              ? `${opticasConPagoProblema.length} ${opticasConPagoProblema.length === 1 ? "óptica" : "ópticas"}`
              : mensajesFiltro === "cumpleanos"
                ? `${cumpleanosProximos.length} ${cumpleanosProximos.length === 1 ? "administrador" : "administradores"}`
                : `${mensajesFiltrados.length} ${mensajesFiltrados.length === 1 ? "mensaje" : "mensajes"}`}
          </span>
        </div>

        <div className="divide-y divide-slate-100">
          {mensajesFiltro === "pago" ? (
            opticasConPagoProblema.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-14 text-center">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-300"><Wallet size={24} /></div>
                <p className="text-sm font-medium text-slate-500">Ninguna óptica tiene el pago pendiente o vencido.</p>
              </div>
            ) : (
              opticasConPagoProblema.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => abrirDetalleOptica(o)}
                  className="flex w-full items-center gap-3.5 p-4 text-left transition hover:bg-slate-50/60 cursor-pointer"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white" style={{ background: o.estado_pago === "vencido" ? "linear-gradient(135deg,#fb7185,#be123c)" : "linear-gradient(135deg,#e0b64e,#b45309)" }}>
                    <Wallet size={17} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-slate-800">{o.nombre}</p>
                      <span
                        className="rounded-full px-2 py-0.5 text-xs font-extrabold uppercase tracking-wider"
                        style={o.estado_pago === "vencido" ? { backgroundColor: "#fee2e2", color: "#be123c", border: "1px solid #fecaca" } : { backgroundColor: "#fef3c7", color: "#92600f", border: "1px solid #fde68a" }}
                      >
                        {o.estado_pago === "vencido" ? "Vencido" : "Pendiente"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs font-medium text-slate-500">
                      {o.proximo_vencimiento ? <>Vencimiento: {formatearFecha(o.proximo_vencimiento)}</> : "Sin fecha de vencimiento cargada"}
                    </p>
                  </div>
                </button>
              ))
            )
          ) : mensajesFiltro === "cumpleanos" ? (
            cumpleanosProximos.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-14 text-center">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-300"><Cake size={24} /></div>
                <p className="text-sm font-medium text-slate-500">Ningún administrador cumple años en los próximos días.</p>
              </div>
            ) : (
              cumpleanosProximos.map(({ admin, dias }) => {
                const optica = opticas.find((o) => o.id === admin.optica_id)
                return (
                  <button
                    key={admin.id}
                    type="button"
                    onClick={() => optica && abrirDetalleOptica(optica)}
                    className="flex w-full items-center gap-3.5 p-4 text-left transition hover:bg-slate-50/60 cursor-pointer"
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white" style={{ background: "linear-gradient(135deg,#c4b5fd,#7c3aed)" }}>
                      <Cake size={17} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-bold text-slate-800">{admin.nombre}</p>
                        <span className="rounded-full px-2 py-0.5 text-xs font-extrabold uppercase tracking-wider" style={{ backgroundColor: "#f1eafe", color: "#7c3aed", border: "1px solid #ddd6fe" }}>
                          {dias === 0 ? "Hoy" : dias > 0 ? `En ${dias}d` : `Hace ${Math.abs(dias)}d`}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs font-medium text-slate-500">{optica?.nombre || "Óptica"}</p>
                    </div>
                  </button>
                )
              })
            )
          ) : mensajesFiltrados.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-300"><MessageSquare size={24} /></div>
              <p className="text-sm font-medium text-slate-500">
                {mensajesFiltro === "anuncio" ? "Todavía no publicaste ningún aviso." : mensajesFiltro === "consulta" ? "Ningún administrador te escribió todavía." : "Todavía no hay mensajes."}
              </p>
            </div>
          ) : (
            mensajesFiltrados.map((m) => {
              const esAnuncio = m.tipo === "anuncio"
              const optica = opticas.find((o) => o.id === m.optica_id)
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMensajeAbierto(m)}
                  className="flex w-full items-start gap-3.5 p-4 text-left transition hover:bg-slate-50/60 cursor-pointer"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white" style={{ background: esAnuncio ? "linear-gradient(135deg,#e0b64e,#b45309)" : GRAD }}>
                    {esAnuncio ? <Megaphone size={17} /> : <MessageSquare size={17} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-slate-800">{m.asunto}</p>
                      {esAnuncio ? (
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-extrabold uppercase tracking-wider"
                          style={m.optica_id ? { backgroundColor: "#eff6ff", color: "#1d4ed8", border: "1px solid #dbeafe" } : { backgroundColor: "#fef3c7", color: "#92600f", border: "1px solid #fde68a" }}
                        >
                          {m.optica_id ? "Puntual" : "General"}
                        </span>
                      ) : (
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-extrabold uppercase tracking-wider"
                          style={m.estado === "abierto" ? { backgroundColor: "#fef3c7", color: "#92600f", border: "1px solid #fde68a" } : { backgroundColor: "#d1fae5", color: "#065f46", border: "1px solid #a7f3d0" }}
                        >
                          {m.estado === "abierto" ? "Abierto" : "Resuelto"}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 truncate text-xs font-medium text-slate-500">
                      {esAnuncio ? (m.optica_id ? `Para: ${optica?.nombre || "una óptica"}` : "Aviso general a todos los administradores") : <>{m.remitente_nombre} · {optica?.nombre || "Óptica"}</>}
                    </p>
                    <p className="mt-1.5 line-clamp-1 text-xs text-slate-400">{m.cuerpo}</p>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">{formatearFecha(m.created_at)}</span>
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )

  const renderMensajes = () => (
    <div className="space-y-3" data-soporte>
      <CabeceraSeccion titulo="Soporte" pregunta="¿Qué óptica necesita ayuda y qué tan rápido la estamos atendiendo?">
        <InterruptorPrueba activo={incluirPrueba} onCambiar={setIncluirPrueba} cuantas={nPrueba} />
        <button
          type="button"
          onClick={() => { setErrorAviso(""); setAvisoAsunto(""); setAvisoCuerpo(""); setAvisoDestino("todos"); setModalAvisoAbierto(true) }}
          className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer"
          style={{ background: GRAD }}
        >
          <Megaphone size={15} aria-hidden="true" /> Nuevo aviso
        </button>
      </CabeceraSeccion>
      <SoporteSuperadmin ocultas={consultasSoporte.length - consultasVisibles.length} inicial={destinoSoporte} consultas={consultasVisibles} cargando={cargandoSoporte} error={errorSoporte} onRecargar={cargarSoporte} opticas={opticasVisibles}
        onAuditoria={async (accion, datos) => { await registrarAuditoria(accion, datos); cargarAuditoria(true) }} onToast={mostrarToast} avisos={renderAvisos()} />
    </div>
  )

  const PAGO_ETIQUETA = { al_dia: "Al día", pendiente: "Pendiente", vencido: "Vencido" }
  const etiquetasOpticas = [
    filtroEstado !== "Todas" && { id: "estado", texto: `Estado: ${filtroEstado === "Activas" ? "Activas" : "Suspendidas"}`, quitar: () => setFiltroEstado("Todas") },
    filtrosOpticas.pago && { id: "pago", texto: `Pago: ${PAGO_ETIQUETA[filtrosOpticas.pago]}`, quitar: () => setFiltrosOpticas((f) => ({ ...f, pago: "" })) },
    (filtrosOpticas.desde || filtrosOpticas.hasta) && { id: "creada", texto: `Creadas: ${filtrosOpticas.desde ? fechaLegible(filtrosOpticas.desde) : "…"} – ${filtrosOpticas.hasta ? fechaLegible(filtrosOpticas.hasta) : "…"}`, quitar: () => setFiltrosOpticas((f) => ({ ...f, desde: "", hasta: "" })) },
    busqueda.trim() && { id: "busqueda", texto: `Texto: «${busqueda.trim()}»`, quitar: () => setBusqueda("") },
    incluirPrueba && { id: "prueba", texto: "Con ópticas de prueba", quitar: () => setIncluirPrueba(false) },
  ].filter(Boolean)
  const limpiarOpticas = () => { setFiltroEstado("Todas"); setBusqueda(""); setFiltrosOpticas({ desde: "", hasta: "", pago: "" }); setIncluirPrueba(false) }
  const celdaTitulo = "px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-500"

  const renderOpticas = () => (
    <div className="space-y-3" data-opticas>
      <CabeceraSeccion titulo="Ópticas" pregunta="¿Qué ópticas tengo, cómo van y cuál necesita atención?">
        <button type="button" onClick={abrirCrear} className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer" style={{ background: GRAD }}><Plus size={15} aria-hidden="true" /> Crear óptica</button>
      </CabeceraSeccion>

      <div className="space-y-2 rounded-2xl border border-slate-200/60 bg-white px-3 py-2.5 shadow-sm" role="group" aria-label="Filtros">
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Estado" className="flex flex-wrap rounded-lg border border-slate-200/60 bg-white p-0.5">
            {tarjetas.map((t) => (
              <button key={t.key} type="button" aria-pressed={filtroEstado === t.key} onClick={() => setFiltroEstado(t.key)} className={"flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-semibold transition-colors cursor-pointer " + (filtroEstado === t.key ? "text-white" : "text-slate-600 hover:bg-slate-50")} style={filtroEstado === t.key ? { background: GRAD } : undefined}>
                {t.label} <span className={filtroEstado === t.key ? "text-white/85" : "text-slate-500"}>{t.valor}</span>
              </button>
            ))}
          </div>
          <InterruptorPrueba activo={incluirPrueba} onCambiar={setIncluirPrueba} cuantas={nPrueba} />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="relative min-w-[14rem] flex-1 text-xs font-semibold text-slate-500">Buscar
            <Search size={15} className="pointer-events-none absolute bottom-2.5 left-2.5 text-slate-500" aria-hidden="true" />
            <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Nombre, dirección de la página o administrador" aria-label="Buscar ópticas" className="mt-0.5 block h-9 w-full rounded-lg border border-slate-200/60 bg-white pl-8 pr-2 text-sm font-normal text-slate-700 outline-none focus-visible:border-blue-500 [&::-webkit-search-cancel-button]:hidden" />
          </label>
          <label className="text-xs font-semibold text-slate-500">Pago
            <select aria-label="Pago" value={filtrosOpticas.pago} onChange={(e) => setFiltrosOpticas((f) => ({ ...f, pago: e.target.value }))} className="mt-0.5 block h-9 w-40 rounded-lg border border-slate-200/60 bg-white px-2 text-sm font-normal text-slate-700 outline-none focus-visible:border-blue-500">
              <option value="">Todos</option>
              {Object.entries(PAGO_ETIQUETA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <EtiquetasFiltros etiquetas={etiquetasOpticas} onLimpiar={limpiarOpticas} />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
        <table className="w-full table-fixed text-left text-sm" aria-label="Ópticas">
          <thead>
            <tr className="border-b border-slate-200/60 bg-slate-50/70">
              <th scope="col" className={celdaTitulo + " w-[25%]"}>Óptica</th>
              <th scope="col" className={celdaTitulo + " w-[19%]"}>Administrador</th>
              <th scope="col" className={celdaTitulo + " w-[10%]"}>Estado</th>
              <th scope="col" className={celdaTitulo + " w-[10%]"}>Salud</th>
              <th scope="col" className={celdaTitulo + " w-[10%]"}>Pago</th>
              <th scope="col" className={celdaTitulo + " w-[10%] text-right"}>Uso 30 d</th>
              <th scope="col" className={celdaTitulo + " w-[11%]"}>Creada</th>
              <th scope="col" className={celdaTitulo + " w-[5%] text-center"}><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cargando ? (
              [0, 1, 2, 3].map((i) => <tr key={i}><td colSpan={8} className="px-4 py-3"><div className="h-9 animate-pulse rounded-lg bg-slate-200/70" /></td></tr>)
            ) : opticasFiltradas.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12">
                  <div role="status" className="mx-auto flex max-w-sm flex-col items-center gap-3 text-center">
                    <Building2 size={22} className="text-slate-400" aria-hidden="true" />
                    <p className="text-sm text-slate-600">{opticas.length === 0 ? "Aún no hay ópticas registradas." : etiquetasOpticas.length > 0 ? "Ninguna óptica coincide con estos filtros." : "Todas las ópticas son de prueba y no se muestran por defecto."}</p>
                    {opticas.length === 0 ? (
                      <button type="button" onClick={abrirCrear} className="rounded-lg border border-slate-200/60 bg-white px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 cursor-pointer">Crear la primera óptica</button>
                    ) : etiquetasOpticas.length > 0 ? null : (
                      <button type="button" onClick={() => setIncluirPrueba(true)} className="rounded-lg border border-slate-200/60 bg-white px-3 py-1.5 text-sm font-semibold text-blue-700 hover:bg-blue-50 cursor-pointer">Incluir ópticas de prueba</button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              opticasFiltradas.map((o) => {
                const listaAdmins = adminsPorOptica.get(o.id) || []
                const procesando = procesandoId === o.id
                const salud = saludPorOptica.get(o.id)
                const u = usoPorOptica.get(o.id)
                return (
                  <tr key={o.id} className="group cursor-pointer transition-colors hover:bg-slate-50/70" onClick={() => abrirDetalleOptica(o)}>
                    <td className="px-4 py-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold text-white" style={{ background: GRAD }}>{o.nombre.charAt(0).toUpperCase()}</div>
                        <div className="min-w-0">
                          <button type="button" onClick={(e) => { e.stopPropagation(); abrirDetalleOptica(o) }} aria-label={`Ver el detalle de ${o.nombre}`} className="block max-w-full truncate text-left font-semibold text-slate-800 transition-colors group-hover:text-blue-600 focus-visible:outline-none focus-visible:underline cursor-pointer" title={o.nombre}>{o.nombre}</button>
                          <p className="flex items-center gap-1.5 text-xs text-slate-500"><span className="truncate font-mono">{o.slug}</span>{esDePrueba(o) && <EtiquetaPrueba />}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {listaAdmins.length === 0 ? (
                        <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-700"><AlertTriangle size={13} aria-hidden="true" /> Sin administrador</span>
                      ) : (
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-700">{listaAdmins[0].nombre}{listaAdmins.length > 1 ? ` +${listaAdmins.length - 1}` : ""}</p>
                          <p className="truncate text-xs text-slate-500">{listaAdmins[0].email || "—"}</p>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={"inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-bold " + (o.activa ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700")}>{o.activa ? "Activa" : "Suspendida"}</span>
                    </td>
                    <td className="px-4 py-3">{o.activa && salud ? <InsigniaSalud estado={salud.estado} /> : <span className="text-slate-400">—</span>}</td>
                    <td className="px-4 py-3 text-slate-600">{PAGO_ETIQUETA[o.estado_pago || "al_dia"]}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700" title={u ? `${u.citas} citas · ${u.consultas} consultas · ${u.ventas} ventas` : undefined}>{u ? u.citas + u.consultas + u.ventas : <span className="text-slate-400">—</span>}</td>
                    <td className="px-4 py-3 text-slate-600">{fechaLegible(diaDe(o.created_at))}</td>
                    <td className="px-2 py-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={(e) => abrirMenuAcciones(o.id, e)}
                        title="Más acciones"
                        aria-label={`Más acciones para ${o.nombre}`}
                        disabled={procesando}
                        className={"rounded-lg p-2 transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 " + (menuAccionesId === o.id ? "bg-slate-100 text-slate-700" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700")}
                      >
                        <MoreVertical size={16} />
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      <p role="status" className="px-1 text-sm font-semibold text-slate-600">{opticasFiltradas.length} {opticasFiltradas.length === 1 ? "óptica" : "ópticas"}</p>
    </div>
  )

  const renderActividad = () => (
    <ActividadSuperadmin
      opticas={opticas} superadmins={superadmins} incluirPrueba={incluirPrueba} onIncluirPrueba={setIncluirPrueba} destino={destinoActividad}
      recarga={auditoria[0]?.id || ""} usuario={usuario} onAbrir={irA} onAviso={(t) => mostrarToast("exito", t)}
    />
  )

  const ESTADO_LEAD = {
    nuevo: { label: "Nuevo", bg: "bg-blue-50", fg: "text-blue-700" },
    contactado: { label: "Contactado", bg: "bg-amber-50", fg: "text-amber-700" },
    convertido: { label: "Convertido", bg: "bg-emerald-50", fg: "text-emerald-700" },
    descartado: { label: "Descartado", bg: "bg-slate-100", fg: "text-slate-500" },
  }

  const rangoLeadsActual = periodoLeads === "todo" ? null : rangoDePeriodo(periodoLeads, personalizadoLeads, ahoraEcuador())
  const leadsDelPeriodo = leads.filter((l) => !rangoLeadsActual || enRango(l.created_at, rangoLeadsActual))
  const leadsFiltrados = leadsDelPeriodo.filter((l) => {
    const q = busquedaLeads.trim().toLowerCase()
    const coincideTexto = !q || [l.nombre_optica, l.nombre_admin, l.email_admin, l.telefono, l.slug_deseado].some((v) => (v || "").toLowerCase().includes(q))
    const coincideEstado = filtroEstadoLeads === "todos" || l.estado === filtroEstadoLeads
    return coincideTexto && coincideEstado
  })
  const etiquetasLeads = [
    rangoLeadsActual && { id: "periodo", texto: `Recibidos: ${tituloSemana(rangoLeadsActual.inicio, rangoLeadsActual.fin)}`, quitar: () => setPeriodoLeads("todo") },
    filtroEstadoLeads !== "todos" && { id: "estado", texto: `Estado: ${ESTADO_LEAD[filtroEstadoLeads]?.label}`, quitar: () => setFiltroEstadoLeads("todos") },
    busquedaLeads.trim() && { id: "busqueda", texto: `Texto: «${busquedaLeads.trim()}»`, quitar: () => setBusquedaLeads("") },
  ].filter(Boolean)
  const limpiarLeads = () => { setPeriodoLeads("todo"); setFiltroEstadoLeads("todos"); setBusquedaLeads("") }

  const renderLeads = () => (
    <div className="space-y-3" data-leads>
      <CabeceraSeccion titulo="Leads" pregunta="¿Quién quiere el sistema y en qué paso va?" />

      {leads.length === 0 ? (
        <SinResultados texto="Todavía no llegó ninguna solicitud desde la página de venta. Cuando alguien escriba, aparecerá aquí." />
      ) : (
        <>
          <div className="space-y-2 rounded-2xl border border-slate-200/60 bg-white px-3 py-2.5 shadow-sm" role="group" aria-label="Filtros">
            <div className="flex flex-wrap items-center gap-2">
              <SelectorPeriodo periodo={periodoLeads} onPeriodo={setPeriodoLeads} personalizado={personalizadoLeads} onPersonalizado={setPersonalizadoLeads} rango={rangoLeadsActual || rangoDePeriodo("anio", {}, ahoraEcuador())} extra={[{ id: "todo", label: "Todo" }]} prefijo="lead" />
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <div role="group" aria-label="Estado" className="flex flex-wrap rounded-lg border border-slate-200/60 bg-white p-0.5">
                {[{ id: "todos", nombre: "Todos", n: leadsDelPeriodo.length }, ...ESTADOS_LEAD_LISTA.map((e) => ({ id: e.id, nombre: e.nombre, n: leadsDelPeriodo.filter((l) => l.estado === e.id).length }))].map((e) => (
                  <button key={e.id} type="button" aria-pressed={filtroEstadoLeads === e.id} onClick={() => setFiltroEstadoLeads(e.id)} className={"flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-semibold transition-colors cursor-pointer " + (filtroEstadoLeads === e.id ? "text-white" : "text-slate-600 hover:bg-slate-50")} style={filtroEstadoLeads === e.id ? { background: GRAD } : undefined}>
                    {e.nombre} <span className={filtroEstadoLeads === e.id ? "text-white/85" : "text-slate-500"}>{e.n}</span>
                  </button>
                ))}
              </div>
              <label className="relative min-w-[14rem] flex-1 text-xs font-semibold text-slate-500">Buscar
                <Search size={15} className="pointer-events-none absolute bottom-2.5 left-2.5 text-slate-500" aria-hidden="true" />
                <input type="search" value={busquedaLeads} onChange={(e) => setBusquedaLeads(e.target.value)} placeholder="Óptica, nombre, correo o teléfono" aria-label="Buscar leads" className="mt-0.5 block h-9 w-full rounded-lg border border-slate-200/60 bg-white pl-8 pr-2 text-sm font-normal text-slate-700 outline-none focus-visible:border-blue-500 [&::-webkit-search-cancel-button]:hidden" />
              </label>
              <EtiquetasFiltros etiquetas={etiquetasLeads} onLimpiar={limpiarLeads} />
            </div>
          </div>

          <p role="status" className="px-1 text-sm font-semibold text-slate-600">{leadsFiltrados.length} {leadsFiltrados.length === 1 ? "lead" : "leads"}</p>
          {leadsFiltrados.length === 0 ? (
            <SinResultados texto="Ningún lead coincide con estos filtros. Quita alguno con su «x» o con «Limpiar filtros»." />
          ) : (
            <ul role="list" className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
              {leadsFiltrados.map((l) => {
                const estado = ESTADO_LEAD[l.estado] || ESTADO_LEAD.nuevo
                return (
                  <li key={l.id}>
                    <button type="button" data-lista onClick={() => setLeadAbierto(l)} aria-label={`${l.nombre_optica}: ${estado.label}. Ver el detalle`} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 focus-visible:bg-slate-50 cursor-pointer">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold" style={{ color: INK }}>{l.nombre_optica}</span>
                        <span className="block truncate text-sm text-slate-600">{l.nombre_admin} · {l.email_admin}{l.telefono ? ` · ${l.telefono}` : ""}</span>
                      </span>
                      <span className={"shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold " + estado.bg + " " + estado.fg}>{estado.label}</span>
                      <span className="w-28 shrink-0 text-right text-sm text-slate-500">{fechaLegible(diaDe(l.created_at))}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </>
      )}

      {leadAbierto && (() => {
        const l = leads.find((x) => x.id === leadAbierto.id) || leadAbierto
        const estado = ESTADO_LEAD[l.estado] || ESTADO_LEAD.nuevo
        const procesando = procesandoLeadId === l.id
        const Dato = ({ etiqueta, children }) => (
          <div className="mt-2.5 first:mt-0">
            <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">{etiqueta}</dt>
            <dd className="mt-0.5 break-words text-sm font-semibold" style={{ color: INK }}>{children}</dd>
          </div>
        )
        return (
          <Cascaron
            titulo={l.nombre_optica}
            subtitulo={`Recibido el ${formatearFechaHora(l.created_at)}`}
            Icono={Inbox}
            ancho="max-w-2xl"
            onCerrar={() => setLeadAbierto(null)}
            derecha={<span className={"rounded-full px-2.5 py-0.5 text-xs font-bold " + estado.bg + " " + estado.fg}>{estado.label}</span>}
            pie={<>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => contactarLeadWhatsApp(l)} disabled={!l.telefono} title={l.telefono ? "Escribir por WhatsApp" : "Este lead no dejó teléfono"} className="flex items-center gap-1.5 rounded-lg border border-slate-200/60 px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"><MessageSquare size={14} aria-hidden="true" /> WhatsApp</button>
                <button type="button" onClick={() => contactarLeadGmail(l)} className="flex items-center gap-1.5 rounded-lg border border-slate-200/60 px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer"><Mail size={14} aria-hidden="true" /> Correo</button>
                {l.estado === "nuevo" && <button type="button" disabled={procesando} onClick={() => marcarLead(l.id, "contactado")} className="flex items-center gap-1.5 rounded-lg border border-slate-200/60 px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer disabled:opacity-50"><PhoneCall size={14} aria-hidden="true" /> Marcar contactado</button>}
                {(l.estado === "nuevo" || l.estado === "contactado") && <button type="button" disabled={procesando} onClick={() => marcarLead(l.id, "descartado")} className="flex items-center gap-1.5 rounded-lg border border-slate-200/60 px-3 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer disabled:opacity-50"><X size={14} aria-hidden="true" /> Descartar</button>}
              </div>
              <div className="flex items-center gap-2">
                {(l.estado === "nuevo" || l.estado === "contactado") && <button type="button" disabled={procesando} onClick={() => { setLeadAbierto(null); abrirCrearDesdeLead(l) }} className="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer disabled:opacity-50" style={{ background: GRAD }}><Plus size={14} aria-hidden="true" /> Crear cuenta</button>}
                <button type="button" onClick={() => setLeadAbierto(null)} className="rounded-lg border border-slate-200/60 px-3.5 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">Cerrar</button>
              </div>
            </>}
          >
            <div className="grid grid-cols-1 gap-x-8 gap-y-5 px-5 py-4 sm:grid-cols-2">
              <section>
                <h3 className="mb-2 border-b border-slate-200/60 pb-1.5 text-xs font-bold uppercase tracking-widest text-slate-500">La solicitud</h3>
                <dl>
                  <Dato etiqueta="Óptica">{l.nombre_optica}</Dato>
                  <Dato etiqueta="Dirección que pidió">{l.slug_deseado ? <span className="font-mono">{l.slug_deseado}</span> : <span className="font-normal text-slate-500">No indicó</span>}</Dato>
                  <Dato etiqueta="Mensaje">{l.mensaje ? <span className="font-normal italic">«{l.mensaje}»</span> : <span className="font-normal text-slate-500">Sin mensaje</span>}</Dato>
                </dl>
              </section>
              <section>
                <h3 className="mb-2 border-b border-slate-200/60 pb-1.5 text-xs font-bold uppercase tracking-widest text-slate-500">Contacto</h3>
                <dl>
                  <Dato etiqueta="Nombre">{l.nombre_admin}</Dato>
                  <Dato etiqueta="Correo">{l.email_admin}</Dato>
                  <Dato etiqueta="Teléfono">{l.telefono || <span className="font-normal text-slate-500">No dejó teléfono</span>}</Dato>
                </dl>
              </section>
            </div>
          </Cascaron>
        )
      })()}
    </div>
  )

  const renderSuperadminsSkeleton = () => (
    <div className="space-y-3" aria-busy="true" aria-label="Cargando los superadmins">
      <CabeceraSeccion titulo="Superadmins" pregunta="Cargando…" />
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
    </div>
  )

  const renderSuperadmins = () => cargaInicial ? renderSuperadminsSkeleton() : (
    <div className="space-y-3" data-superadmins>
      <CabeceraSeccion titulo="Superadmins" pregunta="Las cuentas con acceso total al sistema. Crea una de respaldo: no dependas de una sola.">
        <button type="button" onClick={abrirCrearSuperadmin} className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer" style={{ background: GRAD }}><UserPlus size={15} aria-hidden="true" /> Agregar superadmin</button>
      </CabeceraSeccion>

      <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
        <table className="w-full table-fixed text-left text-sm" aria-label="Superadmins">
          <thead>
            <tr className="border-b border-slate-200/60 bg-slate-50/70">
              <th scope="col" className={celdaTitulo + " w-[30%]"}>Persona</th>
              <th scope="col" className={celdaTitulo + " w-[13%]"}>Desde</th>
              <th scope="col" className={celdaTitulo + " w-[13%] text-right"}>Acciones</th>
              <th scope="col" className={celdaTitulo}>Última acción</th>
              <th scope="col" className={celdaTitulo + " w-[7%] text-center"}><span className="sr-only">Quitar</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {superadmins.map((s) => {
              const ultima = ultimaAccionPorSuperadmin.get(s.id)
              const esVos = s.id === usuario?.id
              const n = accionesPorSuperadmin[s.id] ?? 0
              return (
                <tr key={s.id} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => (esVos ? abrirMiCuenta() : irA("actividad", { actorId: s.id, desde: "2024-01-01" }))} title={esVos ? "Editar mi cuenta" : `Ver la actividad de ${s.nombre}`} className="group flex w-full min-w-0 items-center gap-3 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold text-white" style={{ background: GRAD }}>{s.nombre.charAt(0).toUpperCase()}</span>
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 font-semibold text-slate-800 transition-colors group-hover:text-blue-600"><span className="truncate">{s.nombre}</span>{esVos && <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">Tú</span>}</span>
                        <span className="block truncate text-xs text-slate-500">{s.email || "—"}</span>
                      </span>
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{fechaLegible(diaDe(s.created_at))}</td>
                  <td className="px-4 py-3 text-right">
                    {n > 0 ? (
                      <button type="button" data-lista onClick={() => irA("actividad", { actorId: s.id, desde: "2024-01-01" })} aria-label={`${n} ${n === 1 ? "acción" : "acciones"} de ${s.nombre}. Ver en Actividad`} className="rounded-md px-1.5 py-0.5 font-semibold tabular-nums transition-colors hover:bg-blue-50 hover:text-blue-700 cursor-pointer" style={{ color: INK }}>{n}</button>
                    ) : <span className="tabular-nums text-slate-400">0</span>}
                  </td>
                  <td className="px-4 py-3">
                    {ultima ? <p className="truncate text-slate-600" title={textoDeAccion(ultima)}>{textoDeAccion(ultima)} <span className="text-slate-500">· {formatearFechaHora(ultima.created_at)}</span></p> : <span className="text-slate-400">Todavía no hizo nada</span>}
                  </td>
                  <td className="px-2 py-3 text-center">
                    <button
                      type="button"
                      onClick={() => { setSuperadminAEliminar(s); setErrorEliminarSuperadmin("") }}
                      disabled={esVos || superadmins.length <= 1}
                      title={esVos ? "No puedes quitarte a ti mismo" : superadmins.length <= 1 ? "Debe quedar al menos un superadmin" : "Quitar superadmin"}
                      aria-label={esVos ? "No puedes quitarte a ti mismo" : superadmins.length <= 1 ? "Debe quedar al menos un superadmin" : `Quitar superadmin ${s.nombre || ""}`.trim()}
                      className={"rounded-lg p-2 transition-colors disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer " + ACCION_ELIMINAR}
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p role="status" className="px-1 text-sm font-semibold text-slate-600">{superadmins.length} {superadmins.length === 1 ? "superadmin" : "superadmins"}</p>
    </div>
  )

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      {menuAbierto && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMenuAbierto(false)} />}

      {/* ─── TOAST FLOTANTE ─── */}
      {toastGlobal && (
        <div
          role={toastGlobal.tipo === "error" ? "alert" : "status"}
          className="fixed right-5 top-5 z-[100] flex items-center gap-2.5 rounded-2xl border bg-white px-4 py-3 shadow-[0_8px_30px_rgba(15,23,42,0.16)]"
          style={{
            borderColor: toastGlobal.tipo === "error" ? "#FECDD3" : "#A7F3D0",
            animation: toastGlobal.saliendo
              ? "rise-out 180ms cubic-bezier(0.4,0,1,1) both"
              : "rise-in 220ms cubic-bezier(0.16,1,0.3,1) both",
          }}
        >
          {toastGlobal.tipo === "error" ? (
            <AlertCircle size={18} className="shrink-0 text-rose-500" />
          ) : (
            <CheckCircle2 size={18} className="shrink-0 text-emerald-500" />
          )}
          <p className="text-sm font-semibold" style={{ color: INK }}>{toastGlobal.texto}</p>
        </div>
      )}

      {/* ─── SIDEBAR ─── */}
      <aside
        className={
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col justify-between overflow-hidden border-r border-slate-200/70 bg-slate-50/80 transition-all duration-300 lg:static lg:translate-x-0 " +
          (colapsado ? "lg:w-20 " : "lg:w-72 ") +
          (menuAbierto ? "translate-x-0" : "-translate-x-full")
        }
      >
        <div className="pointer-events-none absolute -left-24 top-1/4 h-56 w-56 rounded-full blur-3xl" style={{ background: "radial-gradient(circle, rgba(37,99,235,0.06), transparent 70%)" }} />

        <div className="sidebar-scroll relative z-10 min-h-0 flex-1 overflow-y-auto">
          <div className={"flex items-center justify-between border-b border-slate-200/70 px-6 py-5 " + (colapsado ? "lg:justify-center lg:px-0" : "")}>
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white" style={{ background: GRAD, boxShadow: "0 10px 24px -8px rgba(34,211,238,0.6)" }}>
                <ShieldCheck size={22} strokeWidth={2.2} />
              </div>
              <div className={"leading-tight " + (colapsado ? "lg:hidden" : "")}>
                <p className="text-lg font-bold tracking-tight text-slate-900">
                  Diego <span className="text-blue-600">Óptica</span>
                </p>
                <p className="text-xs font-medium tracking-wide text-slate-500">SUPERADMIN</p>
              </div>
            </div>
            <button type="button" onClick={() => setMenuAbierto(false)} aria-label="Cerrar menú" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 lg:hidden cursor-pointer">
              <X size={20} />
            </button>
          </div>

          <nav className="space-y-1.5 px-4 py-6">
            <p className={"mb-2 px-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-400 " + (colapsado ? "lg:hidden" : "")}>Menú</p>
            {NAV.map((opcion) => {
              const Icono = opcion.icono
              const activo = seccion === opcion.id
              return (
                <button
                  key={opcion.id}
                  type="button"
                  onClick={() => { setSeccion(opcion.id); setMenuAbierto(false) }}
                  title={colapsado ? opcion.nombre : undefined}
                  aria-label={opcion.nombre}
                  className={"group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 " + (colapsado ? "lg:justify-center lg:px-0 " : "") + (activo ? "text-white shadow-md shadow-blue-500/20" : "bg-transparent text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm")}
                  style={activo ? { background: GRAD } : undefined}
                >
                  <Icono size={20} className={activo ? "text-white" : "text-slate-500 group-hover:text-slate-900"} />
                  <span className={colapsado ? "lg:hidden" : ""}>{opcion.nombre}</span>
                  {opcion.id === "mensajes" && consultasAbiertas > 0 ? (
                    <span className={"ml-auto grid h-5 min-w-5 place-items-center rounded-full px-1 text-xs font-bold " + (activo ? "bg-white/25 text-white" : "bg-amber-400 text-amber-950") + (colapsado ? " lg:hidden" : "")}>
                      {consultasAbiertas}
                    </span>
                  ) : (
                    activo && <span className={"ml-auto h-1.5 w-1.5 rounded-full bg-white/80 " + (colapsado ? "lg:hidden" : "")} />
                  )}
                </button>
              )
            })}
          </nav>
        </div>

        <div className={"relative z-10 space-y-3 border-t border-slate-200/70 p-4 " + (colapsado ? "lg:px-2" : "")}>
          {!colapsado && (
            <div className="hidden rounded-xl border border-slate-200/80 bg-white px-3.5 py-3 shadow-sm lg:block">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                <TrendingUp size={12} /> {opticas.length} óptica{opticas.length === 1 ? "" : "s"} · {superadmins.length} superadmin{superadmins.length === 1 ? "" : "s"}
              </p>
            </div>
          )}

          {/* Widget de perfil — tarjeta blanca nítida flotando sobre el fondo
              slate del sidebar (antes bg-slate-50/80 sobre bg-slate-50/80: se
              fundía con el fondo). Mismo criterio que Dashboard.jsx:
              iniciales, nombre y rol siempre visibles al pie, abre el mismo
              modal "Mi cuenta" que ya usa el menú de usuario de la barra
              superior. */}
          <button
            type="button"
            onClick={() => abrirMiCuenta()}
            title={colapsado ? `${usuario?.nombre || "Superadmin"} · Superadministrador` : undefined}
            className={"flex w-full items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 text-left shadow-sm transition-shadow hover:shadow-md cursor-pointer " + (colapsado ? "lg:justify-center lg:px-0" : "")}
          >
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white" style={{ background: GRAD }}>
              {(usuario?.nombre || "S").charAt(0).toUpperCase()}
            </div>
            <div className={"min-w-0 flex-1 " + (colapsado ? "lg:hidden" : "")}>
              <p className="truncate text-sm font-bold text-slate-800">{usuario?.nombre || "Superadmin"}</p>
              <p className="flex items-center gap-1.5 truncate text-xs font-medium text-slate-500">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" /> Superadministrador
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => alSalir()}
            className={"flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-100/80 hover:text-slate-900 cursor-pointer " + (colapsado ? "lg:justify-center lg:px-0" : "")}
          >
            <LogOut size={18} />
            <span className={colapsado ? "lg:hidden" : ""}>Salir</span>
          </button>
        </div>
      </aside>

      {/* ─── CONTENIDO ─── */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="relative z-30 flex items-center justify-between gap-4 border-b border-slate-200/60 bg-white/80 px-4 py-3 backdrop-blur-md sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={() => setMenuAbierto(true)} aria-label="Abrir menú" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden cursor-pointer">
              <Menu size={22} />
            </button>
            <button type="button" onClick={() => setColapsado((v) => !v)} className="hidden rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 lg:inline-flex cursor-pointer" title={colapsado ? "Expandir menú" : "Colapsar menú"} aria-label={colapsado ? "Expandir menú" : "Colapsar menú"}>
              {colapsado ? <ChevronsRight size={20} /> : <ChevronsLeft size={20} />}
            </button>
            <div className="min-w-0">
              <p className="truncate text-base font-bold tracking-tight" style={{ color: INK }}>
                {NAV.find((o) => o.id === seccion)?.nombre || "Panel de superadministrador"}
              </p>
              <p className="truncate text-xs text-slate-500">Panel de superadministrador</p>
            </div>
          </div>

          <div className="relative" ref={userRef}>
            <button
              type="button"
              onClick={() => setUserMenuAbierto((v) => !v)}
              className="flex items-center gap-2.5 rounded-xl border border-slate-200/60 bg-white py-1.5 pl-1.5 pr-2.5 transition-colors hover:bg-slate-50 cursor-pointer"
            >
              <div className="grid h-7 w-7 place-items-center rounded-lg text-xs font-bold text-white" style={{ background: GRAD }}>
                {(usuario?.nombre || "S").charAt(0).toUpperCase()}
              </div>
              <div className="hidden text-left leading-tight sm:block">
                <p className="text-sm font-semibold" style={{ color: INK }}>{usuario?.nombre || "Superadmin"}</p>
                <p className="text-xs text-slate-500">Superadministrador</p>
              </div>
              <ChevronDown size={16} className={"text-slate-500 transition-transform " + (userMenuAbierto ? "rotate-180" : "")} />
            </button>

            {userMenuAbierto && (
              <div className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-2xl">
                <div className="flex items-center gap-3 border-b border-slate-100 p-4">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: GRAD }}>
                    {(usuario?.nombre || "S").charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold" style={{ color: INK }}>{usuario?.nombre || "Superadmin"}</p>
                    <p className="flex items-center gap-1.5 text-xs text-slate-500">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Superadministrador
                    </p>
                  </div>
                </div>
                <div className="p-2">
                  <button
                    type="button"
                    onClick={() => { setUserMenuAbierto(false); abrirMiCuenta() }}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer"
                  >
                    <Settings size={17} />
                    Mi cuenta
                  </button>
                  <button
                    type="button"
                    onClick={() => alSalir()}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 cursor-pointer"
                  >
                    <LogOut size={17} />
                    Cerrar sesión
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="mx-auto w-full max-w-6xl">
            {seccion === "resumen" && renderResumen()}
            {seccion === "opticas" && renderOpticas()}
            {seccion === "leads" && renderLeads()}
            {seccion === "mensajes" && renderMensajes()}
            {seccion === "actividad" && renderActividad()}
            {seccion === "superadmins" && renderSuperadmins()}
          </div>
        </div>
      </main>

      {/* ─── MENÚ "MÁS ACCIONES" (portal, ver comentario junto a abrirMenuAcciones) ─── */}
      {menuAccionesId != null && menuPos && (() => {
        const o = opticas.find((x) => x.id === menuAccionesId)
        if (!o) return null
        return createPortal(
          <div
            ref={menuAccionesRef}
            className="fixed z-50 w-52 overflow-hidden rounded-xl border border-slate-200/60 bg-white py-1.5 text-left shadow-xl"
            style={{ top: menuPos.top, left: menuPos.left, animation: "menu-in 160ms ease-out", transformOrigin: "top right" }}
          >
            {/* Acceso rápido a impersonación desde la lista — antes solo
                vivía dentro del modal de detalle, un paso extra para la
                acción que Diego pidió tener como "acceso rápido" acá mismo. */}
            <button
              type="button"
              disabled={!o.activa}
              title={o.activa ? "Entra al panel de esta óptica con tus propios permisos de superadmin" : "No puedes entrar a una óptica suspendida"}
              onClick={() => { setMenuAccionesId(null); alEntrarComo?.(o) }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent cursor-pointer"
            >
              <LogIn size={15} /> Entrar como administrador
            </button>
            <button
              type="button"
              onClick={() => { setMenuAccionesId(null); setOpticaAConfirmar(o) }}
              className={"flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-medium transition-colors cursor-pointer " + (o.activa ? "text-rose-600 hover:bg-rose-50" : "text-emerald-600 hover:bg-emerald-50")}
            >
              {o.activa ? <Ban size={15} /> : <CheckCircle2 size={15} />}
              {o.activa ? "Suspender óptica" : "Reactivar óptica"}
            </button>
            <button
              type="button"
              onClick={() => { setMenuAccionesId(null); copiarSlug(o.slug) }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer"
            >
              <Copy size={15} /> Copiar dirección
            </button>
          </div>,
          document.body,
        )
      })()}

      {/* ─── MODAL DETALLE ÓPTICA ─── */}
      {detalle && (
        <Cascaron
          etiqueta={"Detalle de " + detalle.nombre}
          titulo={renombrando ? (
            <span className="flex items-center gap-1.5">
              <input
                autoFocus
                type="text"
                value={nombreEditado}
                onChange={(e) => setNombreEditado(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") guardarNombre(); if (e.key === "Escape") setRenombrando(false) }}
                className="w-44 rounded-lg border border-blue-300 px-2 py-1 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-blue-100"
              />
              <button type="button" onClick={guardarNombre} disabled={guardandoNombre} title="Guardar nombre" aria-label="Guardar nombre" className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 cursor-pointer"><Check size={16} /></button>
              <button type="button" onClick={() => setRenombrando(false)} title="Cancelar edición" aria-label="Cancelar edición" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer"><X size={16} /></button>
            </span>
          ) : (
            <span className="flex min-w-0 items-center gap-1.5" title={detalle.nombre}>
              <span className="truncate">{detalle.nombre}</span>
              <button type="button" onClick={iniciarRenombrar} title="Renombrar" aria-label="Renombrar" className="shrink-0 rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"><Pencil size={13} /></button>
            </span>
          )}
          subtitulo={<span className="flex items-center gap-2"><span className="font-mono">{detalle.slug}</span>{detalle.es_de_prueba && <EtiquetaPrueba />}</span>}
          marca={<div className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: GRAD }}>{detalle.nombre.charAt(0).toUpperCase()}</div>}
          ancho="max-w-lg"
          onCerrar={cerrarDetalle}
        >
          <div className="space-y-4 p-5">
          <div className="flex items-center justify-between rounded-xl border border-slate-200/60 bg-slate-50 p-3.5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Estado</p>
              <span className={"mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold " + (detalle.activa ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
                {detalle.activa ? <CheckCircle2 size={13} /> : <Ban size={13} />}
                {detalle.activa ? "Activa" : "Suspendida"}
              </span>
            </div>
            <button
              type="button"
              disabled={procesandoId === detalle.id}
              onClick={() => setOpticaAConfirmar(detalle)}
              className={"rounded-xl px-4 py-2.5 text-sm font-semibold transition cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 " + (detalle.activa ? "border border-rose-200/60 text-rose-600 hover:bg-rose-50 focus-visible:ring-rose-400/60" : "border border-emerald-200/60 text-emerald-600 hover:bg-emerald-50 focus-visible:ring-emerald-400/60")}
            >
              {procesandoId === detalle.id ? "Actualizando…" : detalle.activa ? "Suspender" : "Reactivar"}
            </button>
          </div>

          {/* ─── Entrar como administrador ("impersonación") — caso #8 de
              la reunión con el ing. Queda registrado en la actividad de
              la propia óptica: cualquier acción que se haga adentro se
              ve atribuida a "{nombre} (superadmin)", nunca disfrazada
              como el admin real. ─── */}
          <button
            type="button"
            disabled={!detalle.activa}
            title={detalle.activa ? "Entra al panel de esta óptica con tus propios permisos de superadmin" : "No puedes entrar a una óptica suspendida"}
            onClick={() => alEntrarComo?.(detalle)}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 cursor-pointer"
            style={{ background: GRAD }}
          >
            <LogIn size={16} /> Entrar como administrador
          </button>

          {/* ─── Óptica de prueba ─── */}
          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200/60 p-3.5">
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-800">Óptica de prueba</span>
              <span className="block text-xs text-slate-500">No cuenta en las métricas del negocio ni en la actividad, salvo que se pida verla. No se borra nada.</span>
            </span>
            <input type="checkbox" checked={!!detalle.es_de_prueba} onChange={(e) => marcarPrueba(e.target.checked)} className="h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-blue-600 focus-visible:ring-blue-500" />
          </label>

          {/* ─── Uso: lo registrado y lo de los últimos 30 días ─── */}
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Uso del sistema</p>
            {(() => {
              const u = datosNegocio.uso.find((x) => x.optica_id === detalle.id)
              const celdas = [
                { t: "Pacientes", v: u?.pacientes ?? pacientesPorOptica.get(detalle.id) ?? 0, i: Stethoscope, nota: "registrados" },
                { t: "Asistentes", v: u?.asistentes ?? asistentesPorOptica.get(detalle.id) ?? 0, i: Users, nota: "activos" },
                { t: "Personas activas", v: u ? u.personas_activas : "—", i: Users, nota: "en 30 días" },
                { t: "Citas", v: u ? u.citas : "—", i: Calendar, nota: "en 30 días" },
                { t: "Consultas", v: u ? u.consultas : "—", i: Stethoscope, nota: "en 30 días" },
                { t: "Ventas", v: u ? u.ventas : "—", i: Receipt, nota: "en 30 días" },
              ]
              return (
                <div className="grid grid-cols-3 gap-2">
                  {celdas.map((c) => (
                    <div key={c.t} className="rounded-xl border border-slate-200/60 bg-slate-50 p-3">
                      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><c.i size={12} aria-hidden="true" /> {c.t}</p>
                      <p className="mt-1 text-xl font-bold" style={{ color: INK }}>{c.v}</p>
                      <p className="text-xs text-slate-500">{c.nota}</p>
                    </div>
                  ))}
                </div>
              )
            })()}
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Administradores</p>
              <button type="button" onClick={() => (agregarAdminAbierto ? setAgregarAdminAbierto(false) : abrirAgregarAdmin())} className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">
                <UserPlus size={13} /> Agregar
              </button>
            </div>

            {(adminsPorOptica.get(detalle.id) || []).length === 0 ? (
              <div className="flex items-center gap-2 rounded-xl border border-amber-200/60 bg-amber-50 p-3.5 text-sm font-medium text-amber-700">
                <AlertTriangle size={16} /> Sin administrador vinculado.
              </div>
            ) : (
              <div className="space-y-2">
                {(adminsPorOptica.get(detalle.id) || []).map((a) => (
                  adminAEliminar?.id === a.id ? (
                    <div key={a.id} className="rounded-xl border border-rose-200/60 bg-rose-50 p-3 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-rose-700">¿Quitar a {a.nombre}?</span>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => { setAdminAEliminar(null); setErrorEliminarAdmin("") }} className="rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-white cursor-pointer">Cancelar</button>
                          <button type="button" onClick={confirmarEliminarAdmin} disabled={eliminandoAdmin} className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700 cursor-pointer disabled:opacity-60">
                            {eliminandoAdmin ? "Quitando…" : "Confirmar"}
                          </button>
                        </div>
                      </div>
                      <p className="mt-1.5 text-xs text-rose-600">Esto elimina también su cuenta de acceso — su correo ({a.email || "sin correo"}) queda libre para usarse de nuevo.</p>
                      {errorEliminarAdmin && (
                        <p role="alert" className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-rose-700"><AlertCircle size={12} /> {errorEliminarAdmin}</p>
                      )}
                    </div>
                  ) : (
                    <div key={a.id} className="rounded-xl border border-slate-200/60 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-slate-800">{a.nombre}</p>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500"><Mail size={12} /><span className="truncate">{a.email || "—"}</span></div>
                        </div>
                        <button type="button" onClick={() => { setAdminAEliminar(a); setErrorEliminarAdmin("") }} title="Quitar administrador" className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"><Trash2 size={15} /></button>
                      </div>
                      <div className="mt-2.5 flex items-center gap-1.5 border-t border-slate-100 pt-2.5">
                        <Cake size={13} className="shrink-0 text-slate-400" />
                        <label className="text-xs text-slate-500">Cumpleaños</label>
                        <span className="w-44"><CampoFecha id={`cumple-${a.id}`} etiqueta="Cumpleaños" valor={a.fecha_nacimiento || ""} onCambiar={(v) => { if (v !== (a.fecha_nacimiento || "")) guardarCumpleanos(a.id, v) }} placeholder="Elige la fecha" /></span>
                        {guardandoCumple === a.id && <Loader2 size={12} className="animate-spin text-slate-400" />}
                      </div>
                      <div className="mt-2 flex items-center gap-1.5 border-t border-slate-100 pt-2">
                        <IdCard size={13} className="shrink-0 text-slate-400" />
                        <label className="text-xs text-slate-500">Cédula</label>
                        <input
                          type="text" inputMode="numeric"
                          defaultValue={a.cedula || ""}
                          onBlur={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 10); if (v !== (a.cedula || "")) guardarCedula(a.id, v) }}
                          disabled={guardandoCedula === a.id}
                          placeholder="10 dígitos"
                          maxLength={10}
                          className="w-24 rounded-lg border border-slate-200/60 bg-slate-50 px-2 py-1 text-xs outline-none focus-visible:border-blue-500 focus-visible:bg-white disabled:opacity-60"
                        />
                        {guardandoCedula === a.id && <Loader2 size={12} className="animate-spin text-slate-400" />}
                      </div>
                      {errorCedulaAdmin?.id === a.id && (
                        <p role="alert" className="mt-1 text-xs font-semibold text-rose-600">{errorCedulaAdmin.mensaje}</p>
                      )}
                      <label className="mt-2 flex items-center gap-1.5 border-t border-slate-100 pt-2 text-xs text-slate-500">
                        <input
                          type="checkbox"
                          checked={!!a.es_optometra}
                          onChange={(e) => guardarEsOptometra(a.id, e.target.checked)}
                          className="h-3.5 w-3.5 cursor-pointer rounded border-slate-300 text-blue-600 focus-visible:ring-blue-500"
                        />
                        Es también el optómetra/licenciado
                      </label>
                    </div>
                  )
                ))}
              </div>
            )}

            {agregarAdminAbierto && (
              <form onSubmit={guardarAdminExtra} className="mt-3 space-y-3 rounded-xl border border-slate-200/60 bg-slate-50/60 p-3.5">
                {errorAdminExtra && (
                  <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200/60 bg-red-50 p-2.5 text-xs font-medium text-red-700">
                    <AlertCircle size={14} /> {errorAdminExtra}
                  </div>
                )}
                <input
                  type="text" placeholder="Nombre completo" value={camposAdminExtra.nombre} onChange={(e) => actualizarCampoAdminExtra("nombre", filtrarSoloLetras(e.target.value))}
                  className="w-full rounded-lg border border-slate-200/60 bg-white px-3 py-2 text-sm outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-50"
                />
                <input
                  type="text" inputMode="numeric" placeholder="Cédula (10 dígitos)" maxLength={10}
                  value={camposAdminExtra.cedula} onChange={(e) => actualizarCampoAdminExtra("cedula", e.target.value.replace(/\D/g, "").slice(0, 10))}
                  className="w-full rounded-lg border border-slate-200/60 bg-white px-3 py-2 text-sm outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-50"
                />
                <input
                  type="email" placeholder="Correo electrónico" value={camposAdminExtra.email} onChange={(e) => actualizarCampoAdminExtra("email", e.target.value)}
                  className="w-full rounded-lg border border-slate-200/60 bg-white px-3 py-2 text-sm outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-50"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div className="relative">
                    <input
                      type={verClaveExtra ? "text" : "password"} placeholder="Contraseña" value={camposAdminExtra.clave} onChange={(e) => actualizarCampoAdminExtra("clave", e.target.value)}
                      className="w-full rounded-lg border border-slate-200/60 bg-white px-3 py-2 pr-8 text-sm outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-50"
                    />
                    <button type="button" onClick={() => setVerClaveExtra((v) => !v)} aria-label={verClaveExtra ? "Ocultar contraseña" : "Mostrar contraseña"} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer">{verClaveExtra ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                  </div>
                  <input
                    type={verClaveExtra ? "text" : "password"} placeholder="Confirmar" value={camposAdminExtra.confirmarClave} onChange={(e) => actualizarCampoAdminExtra("confirmarClave", e.target.value)}
                    className="w-full rounded-lg border border-slate-200/60 bg-white px-3 py-2 text-sm outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-50"
                  />
                </div>
                <label className="flex items-start gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={camposAdminExtra.esOptometra}
                    onChange={(e) => actualizarCampoAdminExtra("esOptometra", e.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 cursor-pointer rounded border-slate-300 text-blue-600 focus-visible:ring-blue-500"
                  />
                  <span>Es también el optómetra/licenciado</span>
                </label>
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setAgregarAdminAbierto(false)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancelar</button>
                  <button type="submit" disabled={guardandoAdminExtra} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white cursor-pointer disabled:opacity-60" style={{ background: GRAD }}>
                    {guardandoAdminExtra ? "Creando…" : "Crear cuenta"}
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* ─── Suscripción ─── */}
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Suscripción</p>
            <div className="space-y-3 rounded-xl border border-slate-200/60 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1 rounded-2xl border border-slate-200/60 bg-slate-100 p-1 shadow-inner">
                  {[
                    { key: "al_dia", label: "Al día", fg: "#059669" },
                    { key: "pendiente", label: "Pendiente", fg: "#B45309" },
                    { key: "vencido", label: "Vencido", fg: "#E11D48" },
                  ].map((op) => (
                    <button
                      key={op.key}
                      type="button"
                      disabled={actualizandoPago}
                      onClick={() => actualizarEstadoPago(op.key)}
                      className={"rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer disabled:opacity-60 " + ((detalle.estado_pago || "al_dia") === op.key ? "bg-white shadow-sm" : "text-slate-500 hover:text-slate-700")}
                      style={(detalle.estado_pago || "al_dia") === op.key ? { color: op.fg } : undefined}
                    >
                      {op.label}
                    </button>
                  ))}
                </div>
                {(detalle.estado_pago || "al_dia") !== "al_dia" && (
                  <button type="button" onClick={registrarPago} disabled={actualizandoPago} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white cursor-pointer disabled:opacity-60" style={{ background: GRAD }}>
                    <Wallet size={13} /> Registrar pago
                  </button>
                )}
              </div>
              {detalle.estado_pago === "vencido" && detalle.activa && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200/60 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                  El pago está vencido y la óptica sigue activa.
                  <button type="button" onClick={() => setOpticaAConfirmar(detalle)} className="rounded-lg border border-rose-200/60 bg-white px-2.5 py-1 text-xs font-bold text-rose-600 hover:bg-rose-50 cursor-pointer">Suspender ahora</button>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label htmlFor="suscripcion-monto" className="mb-1 block text-xs text-slate-500">Monto mensual (USD)</label>
                  <input
                    id="suscripcion-monto" type="number" min="0" step="0.01" value={campoMonto} onChange={(e) => setCampoMonto(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-slate-200/60 bg-slate-50 px-2.5 py-1.5 text-sm outline-none focus-visible:border-blue-500 focus-visible:bg-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-500">Próximo vencimiento</label>
                  <CampoFecha id="suscripcion-vencimiento" etiqueta="Próximo vencimiento" valor={campoVencimiento} onCambiar={(v) => setCampoVencimiento(v)} max={sumarDiasISO(hoyISO(), 3650)} min={sumarDiasISO(hoyISO(), -3650)} placeholder="Elige la fecha" />
                </div>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500">{detalle.monto_mensual == null ? "Esta óptica todavía no tiene precio de suscripción." : suscripcionCambio ? "Hay cambios sin guardar." : "Guardado."}</span>
                <button type="button" onClick={guardarSuscripcion} disabled={!suscripcionCambio || guardandoSuscripcion} className="rounded-lg px-3.5 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer" style={{ background: GRAD }}>{guardandoSuscripcion ? "Guardando…" : "Guardar suscripción"}</button>
              </div>
            </div>
          </div>

          {/* ─── Roles de la óptica (solo lectura) ─── */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Roles</p>
              {confirmarRestaurarRoles ? (
                <span className="flex items-center gap-2 text-xs">
                  <span className="font-semibold text-slate-600">¿Devolver Optómetra, Recepción y Ventas a como los crea el sistema?</span>
                  <button type="button" onClick={() => setConfirmarRestaurarRoles(false)} className="rounded-lg px-2 py-1 font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer">Cancelar</button>
                  <button type="button" onClick={restaurarRoles} disabled={restaurandoRoles} className="rounded-lg bg-blue-600 px-2.5 py-1 font-semibold text-white hover:bg-blue-700 cursor-pointer disabled:opacity-60">{restaurandoRoles ? "Restaurando…" : "Restaurar"}</button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirmarRestaurarRoles(true)} className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer"><RefreshCw size={13} /> Restaurar los predefinidos</button>
              )}
            </div>
            {rolesOptica === null ? (
              <p className="py-3 text-center text-xs text-slate-500">Cargando…</p>
            ) : rolesOptica.length === 0 ? (
              <p className="rounded-xl border border-amber-200/60 bg-amber-50 p-3 text-xs font-semibold text-amber-800">Esta óptica no tiene roles. Pulsa «Restaurar los predefinidos» para crearlos.</p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200/60 text-sm">
                {rolesOptica.map((r) => {
                  const modulos = Object.keys(r.permisos || {}).map((m) => NOMBRE_MODULO[m] || m)
                  return (
                    <li key={r.id} className="px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate font-semibold text-slate-800">{r.nombre}</span>
                        <span className="shrink-0 text-xs text-slate-500">{r.es_predefinido ? "Predefinido" : "Propio"} · {r.personas} {r.personas === 1 ? "persona" : "personas"}</span>
                      </div>
                      <p className="truncate text-xs text-slate-500" title={modulos.join(", ")}>{modulos.length ? modulos.join(", ") : "Sin permisos"}</p>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* ─── Facturación ─── */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Facturación</p>
              <button type="button" onClick={generarFactura} disabled={generandoFactura} className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer disabled:opacity-60">
                <Receipt size={13} /> {generandoFactura ? "Generando…" : "Generar factura"}
              </button>
            </div>
            {cargandoFacturas ? (
              <p className="py-3 text-center text-xs text-slate-400">Cargando…</p>
            ) : facturasOptica.length === 0 ? (
              <p className="py-3 text-center text-xs text-slate-400">Todavía no se generó ninguna factura.</p>
            ) : (
              <div className="space-y-2">
                {facturasOptica.map((f) => (
                  <div key={f.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200/60 p-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs font-semibold text-slate-700">{f.numero}</p>
                      <p className="text-xs text-slate-500">{f.periodo} · {dinero(Number(f.monto))}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => alternarEstadoFactura(f)}
                        className={"rounded-full px-2.5 py-1 text-xs font-semibold cursor-pointer " + (f.estado === "pagada" ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-amber-50 text-amber-700 hover:bg-amber-100")}
                      >
                        {f.estado === "pagada" ? "Pagada" : "Pendiente"}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setFacturaImprimir(f); setTimeout(() => imprimirDocumento("factura-imprimible", "printing-factura"), 50) }}
                        title="Imprimir factura"
                        aria-label="Imprimir factura"
                        className={"rounded-lg p-1.5 cursor-pointer " + ACCION_VER}
                      >
                        <Printer size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Dirección de la página</p>
            <div className="flex items-center justify-between rounded-xl border border-slate-200/60 p-3.5">
              <span className="font-mono text-sm text-slate-700">{detalle.slug}</span>
              <button type="button" onClick={() => copiarSlug(detalle.slug)} className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">
                {slugCopiado ? <Check size={14} /> : <Copy size={14} />}
                {slugCopiado ? "Copiado" : "Copiar"}
              </button>
            </div>
          </div>

          {/* ─── Ver actividades de esta óptica (logs_optica) — separado de
              "Actividad" del panel general, que es solo del superadmin. ─── */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Actividad de esta óptica</p>
              <button type="button" onClick={alternarActividadOptica} className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">
                <History size={13} /> {mostrarActividadOptica ? "Ocultar" : "Ver actividades"}
              </button>
            </div>

            {mostrarActividadOptica && (
              <div className="rounded-xl border border-slate-200/60 p-3.5">
                {(() => {
                  const usuariosEnLogsOptica = [...new Set(logsOptica.map((l) => l.usuario_nombre))]
                  const logsFiltradosOptica = filtroUsuarioLogOptica === "todos" ? logsOptica : logsOptica.filter((l) => l.usuario_nombre === filtroUsuarioLogOptica)
                  return (
                    <>
                      {usuariosEnLogsOptica.length > 0 && (
                        <select
                          value={filtroUsuarioLogOptica}
                          onChange={(e) => setFiltroUsuarioLogOptica(e.target.value)}
                          className="mb-2.5 w-full rounded-lg border border-slate-200/60 bg-slate-50 px-2.5 py-1.5 text-xs outline-none focus-visible:border-blue-500 focus-visible:bg-white"
                        >
                          <option value="todos">Todos los usuarios</option>
                          {usuariosEnLogsOptica.map((n) => (<option key={n} value={n}>{n}</option>))}
                        </select>
                      )}
                      {cargandoLogsOptica ? (
                        <div className="flex items-center justify-center gap-2 py-6 text-xs text-slate-500">
                          <Loader2 size={14} className="animate-spin" /> Cargando actividad…
                        </div>
                      ) : logsFiltradosOptica.length === 0 ? (
                        <p className="py-4 text-center text-xs text-slate-400">Sin actividad registrada para esta óptica.</p>
                      ) : (
                        <div className="max-h-60 divide-y divide-slate-100 overflow-y-auto">
                          {logsFiltradosOptica.map((l) => (
                            <div key={l.id} className="py-2">
                              <p className="text-xs text-slate-700">
                                <span className="font-semibold text-slate-800">{l.usuario_nombre}</span> {l.accion.charAt(0).toLowerCase() + l.accion.slice(1)}
                                {l.detalle && <span className="text-slate-500"> — {l.detalle}</span>}
                              </p>
                              <p className="mt-0.5 text-xs text-slate-400">{NOMBRE_MODULO[moduloDeRegistro(l)] || l.modulo} · {fechaHoraLegible(l.created_at, { anio: true })}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            )}
          </div>

          {/* ─── Personalización del login (lo único que ve el cliente) — desde
              la migración 0052 el propio admin de esta óptica también puede
              editar esto desde su Configuración; PersonalizacionLogin.jsx es
              el mismo componente que usa ese lado. ─── */}
          <div id="personalizacion-login">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Personalización del login</p>
            <PersonalizacionLogin
              opticaId={detalle.id}
              marca={detalle.marca}
              logoUrl={detalle.logo_url}
              onGuardado={({ marca, logoUrl }) => {
                setDetalle((prev) => (prev ? { ...prev, marca, logo_url: logoUrl } : prev))
                setOpticas((prev) => prev.map((o) => (o.id === detalle.id ? { ...o, marca, logo_url: logoUrl } : o)))
              }}
            />
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Creada</p>
            <div className="flex items-center gap-1.5 rounded-xl border border-slate-200/60 p-3.5 text-sm text-slate-700">
              <Calendar size={14} className="text-slate-500" />
              {formatearFecha(detalle.created_at)}
            </div>
          </div>

          </div>
        </Cascaron>
      )}

      {/* ─── Factura imprimible (oculta salvo al imprimir — imprimirDocumento
          la clona a un portal fuera del árbol normal) ─── */}
      {facturaImprimir && (
        <div style={{ position: "fixed", left: "-9999px", top: 0 }}>
          <style>{estilosImpresion("printing-factura")}</style>
          <div id="factura-imprimible" className="w-[480px] bg-white p-8 text-sm text-slate-800">
            <div className="mb-6 flex items-center justify-between border-b border-slate-200/60 pb-4">
              <div>
                <p className="text-lg font-bold" style={{ color: INK }}>Diego Óptica</p>
                <p className="text-xs text-slate-500">Sistema multi-óptica</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Factura</p>
                <p className="font-mono text-sm font-bold">{facturaImprimir.numero}</p>
              </div>
            </div>
            <div className="mb-6 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Facturado a</p>
                <p className="font-semibold">{opticas.find((o) => o.id === facturaImprimir.optica_id)?.nombre || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Período</p>
                <p className="font-semibold">{facturaImprimir.periodo}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Emitida</p>
                <p className="font-semibold">{formatearFecha(facturaImprimir.emitida_at)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Estado</p>
                <p className="font-semibold">{facturaImprimir.estado === "pagada" ? "Pagada" : "Pendiente"}</p>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4">
              <p className="font-semibold">Suscripción mensual</p>
              <p className="text-lg font-bold" style={{ color: INK }}>{dinero(Number(facturaImprimir.monto))}</p>
            </div>
            <button type="button" onClick={() => setFacturaImprimir(null)} className="no-print mt-6 text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">Cerrar</button>
          </div>
        </div>
      )}

      {/* ─── MODAL DETALLE MENSAJE ─── */}
      {mensajeAbierto && (
        <Cascaron
          titulo={mensajeAbierto.asunto}
          subtitulo={mensajeAbierto.tipo === "anuncio" ? "Aviso general" : <>{mensajeAbierto.remitente_nombre} · {opticas.find((o) => o.id === mensajeAbierto.optica_id)?.nombre || "Óptica"}</>}
          marca={
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: mensajeAbierto.tipo === "anuncio" ? "#FFF7E6" : "#E8F0FF", color: mensajeAbierto.tipo === "anuncio" ? "#B45309" : "#2563EB" }}>
              {mensajeAbierto.tipo === "anuncio" ? <Megaphone size={20} /> : <MessageSquare size={20} />}
            </div>
          }
          ancho="max-w-lg"
          onCerrar={() => setMensajeAbierto(null)}
        >
          <div className="space-y-4 p-5">
          <div className="rounded-xl border border-slate-200/60 bg-slate-50 p-3.5 text-sm text-slate-700 whitespace-pre-wrap">{mensajeAbierto.cuerpo}</div>
          <p className="flex items-center gap-1.5 text-xs text-slate-400"><Clock size={11} /> {formatearFechaHora(mensajeAbierto.created_at)}</p>

          </div>
        </Cascaron>
      )}

      {/* ─── MODAL NUEVO AVISO GENERAL ─── */}
      {modalAvisoAbierto && (
        <Cascaron
          titulo="Nuevo aviso"
          subtitulo={avisoDestino === "todos" ? "Lo van a ver todos los administradores de óptica." : "Solo lo va a ver el administrador de esa óptica."}
          Icono={Megaphone}
          ancho="max-w-md"
          onCerrar={() => !publicandoAviso && setModalAvisoAbierto(false)}
          formulario={{ onSubmit: publicarAviso }}
          pie={<>
            <span />
            <div className="ml-auto flex items-center gap-2">
                  <button type="button" onClick={() => setModalAvisoAbierto(false)} disabled={publicandoAviso} className="rounded-lg border border-slate-200/60 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-50">
                    Cancelar
                  </button>
                  <button type="submit" disabled={publicandoAviso} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white cursor-pointer disabled:opacity-60" style={{ background: GRAD }}>
                    <Send size={15} /> {publicandoAviso ? "Publicando…" : "Publicar aviso"}
                  </button>
            </div>
          </>}
        >
          <div className="space-y-4 p-5">
            {errorAviso && (
              <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200/60 bg-red-50 p-3 text-sm font-medium text-red-700">
                <AlertCircle size={16} /> {errorAviso}
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Destinatario</label>
              <div className="flex items-center gap-1 rounded-2xl border border-slate-200/60 bg-slate-100 p-1 shadow-inner">
                <button
                  type="button"
                  onClick={() => setAvisoDestino("todos")}
                  className={"flex-1 rounded-xl px-3 py-2 text-xs font-bold transition-all cursor-pointer " + (avisoDestino === "todos" ? "bg-white shadow-sm" : "text-slate-500 hover:text-slate-700")}
                  style={avisoDestino === "todos" ? { color: INK } : undefined}
                >
                  Todos los administradores
                </button>
                <button
                  type="button"
                  onClick={() => setAvisoDestino(opticas[0]?.id || "")}
                  className={"flex-1 rounded-xl px-3 py-2 text-xs font-bold transition-all cursor-pointer " + (avisoDestino !== "todos" ? "bg-white shadow-sm" : "text-slate-500 hover:text-slate-700")}
                  style={avisoDestino !== "todos" ? { color: INK } : undefined}
                >
                  Una óptica puntual
                </button>
              </div>
              {avisoDestino !== "todos" && (
                <select
                  value={avisoDestino}
                  onChange={(e) => setAvisoDestino(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm outline-none focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50"
                >
                  {opticas.map((o) => (
                    <option key={o.id} value={o.id}>{o.nombre}</option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Asunto</label>
              <input
                type="text" value={avisoAsunto} onChange={(e) => setAvisoAsunto(e.target.value)}
                placeholder="Ej. Mantenimiento programado"
                className="w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm outline-none focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Mensaje</label>
              <textarea
                rows={5} value={avisoCuerpo} onChange={(e) => setAvisoCuerpo(e.target.value)}
                placeholder="Escribe el aviso…"
                className="w-full rounded-xl border border-slate-200/60 bg-slate-50 p-3 text-sm outline-none focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50"
              />
            </div>
          </div>
        </Cascaron>
      )}

      {/* ─── MODAL CREAR ÓPTICA ─── */}
      {modalAbierto && (
        <Cascaron
          titulo="Crear óptica"
          subtitulo="Se crea la óptica y la cuenta de su administrador en un solo paso."
          Icono={Building2}
          ancho="max-w-xl"
          onCerrar={cerrarModal}
          formulario={{ onSubmit: guardar }}
          pie={<>
            <span />
            <div className="ml-auto flex items-center gap-2">
                  <button type="button" onClick={cerrarModal} disabled={guardando} className="rounded-lg border border-slate-200/60 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50">
                    Cancelar
                  </button>
                  <button type="submit" disabled={guardando || slugEstado === "ocupado"} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer disabled:opacity-60 disabled:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2" style={{ background: GRAD, boxShadow: "0 12px 24px -12px rgba(37,99,235,0.6)" }}>
                    {guardando ? "Creando…" : "Crear óptica"}
                  </button>
            </div>
          </>}
        >
          <div className="space-y-5 p-5">
            {error && (
              <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200/60 bg-red-50 p-3 text-sm font-medium text-red-700">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            {/* ─── Sección: datos de la óptica ─── */}
            <div>
              <div className="mb-3 flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: "rgba(37,99,235,0.1)", color: "#2563EB" }}>
                  <Building2 size={14} />
                </div>
                <p className="text-sm font-bold text-slate-700">Datos de la óptica</p>
              </div>
              <div className="space-y-4 rounded-xl border border-slate-200/60 p-4">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Nombre de la óptica</label>
                  <div className="relative">
                    <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text" value={campos.nombreOptica} onChange={(e) => actualizarCampo("nombreOptica", e.target.value)}
                      placeholder="Ej. Óptica Visión Clara"
                      className="w-full rounded-xl border border-slate-200/60 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none transition focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50"
                    />
                  </div>
                  {sugerenciaNombreOptica && (
                    <p className="mt-1.5 text-xs font-medium text-amber-700">
                      Ya existe una óptica con ese nombre. Prueba con{" "}
                      <button type="button" onClick={() => actualizarCampo("nombreOptica", sugerenciaNombreOptica)} className="underline decoration-dotted underline-offset-2 hover:text-amber-800 cursor-pointer">
                        "{sugerenciaNombreOptica}"
                      </button>.
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Dirección de la página (código interno)</label>
                  <div className="relative">
                    <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text" value={campos.slug}
                      onChange={(e) => actualizarCampo("slug", generarSlug(e.target.value))}
                      placeholder="Ej. 4f9a2c"
                      className="w-full rounded-xl border border-slate-200/60 bg-slate-50 py-2.5 pl-10 pr-16 font-mono text-sm text-slate-800 outline-none transition focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50"
                    />
                    <div className="absolute right-2.5 top-1/2 flex -translate-y-1/2 items-center gap-1.5">
                      {slugEstado === "verificando" && <Loader2 size={15} className="animate-spin text-slate-400" />}
                      {slugEstado === "disponible" && <CheckCircle2 size={15} className="text-emerald-600" />}
                      {slugEstado === "ocupado" && <XCircle size={15} className="text-rose-600" />}
                      <button type="button" onClick={() => actualizarCampo("slug", generarCodigoOptica())} title="Generar otro código" aria-label="Generar otro código" className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 cursor-pointer">
                        <RefreshCw size={14} />
                      </button>
                    </div>
                  </div>
                  <p className={"mt-1.5 text-xs " + (slugEstado === "ocupado" ? "font-medium text-rose-600" : "text-slate-500")}>
                    {slugEstado === "ocupado"
                      ? "Ese código ya está en uso — genera otro."
                      : "Código genérico, independiente del nombre — así no queda atado si la óptica se renombra después."}
                  </p>
                </div>
              </div>
            </div>

            {/* ─── Sección: personalización del login (opcional) — se
                puede dejar en blanco y completar después desde el
                detalle de la óptica ya creada; acá mismo ahorra ese
                paso extra cuando ya se tienen los datos a mano. ─── */}
            <div>
              <div className="mb-3 flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: "rgba(37,99,235,0.1)", color: "#2563EB" }}>
                  <ImageIcon size={14} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-700">Personalización del login <span className="font-normal text-slate-400">(opcional)</span></p>
                  <p className="text-xs text-slate-500">Se puede completar ahora o después, desde el detalle de la óptica.</p>
                </div>
              </div>
              <div className="space-y-4 rounded-xl border border-slate-200/60 p-4">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Eslogan</label>
                  <input
                    type="text" value={campos.eslogan} onChange={(e) => actualizarCampo("eslogan", e.target.value)}
                    placeholder="Ej. Ve el mundo con claridad."
                    className="w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Color de acento</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color" value={campos.colorAcento} onChange={(e) => actualizarCampo("colorAcento", e.target.value)}
                        className="h-[42px] w-12 shrink-0 cursor-pointer rounded-lg border border-slate-200/60 bg-slate-50 p-0.5"
                      />
                      <input
                        type="text" value={campos.colorAcento} onChange={(e) => actualizarCampo("colorAcento", e.target.value)}
                        className="w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 font-mono text-xs text-slate-800 outline-none transition focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Logo</label>
                    <div className="flex items-center gap-2">
                      {campos.logoUrl && (
                        <img src={campos.logoUrl} alt="" className="h-9 w-9 shrink-0 rounded-lg border border-slate-200/60 object-contain bg-white" />
                      )}
                      <label className={"flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 " + (subiendoLogoCreacion ? "pointer-events-none opacity-60" : "")}>
                        <ImageIcon size={13} />
                        {subiendoLogoCreacion ? "Subiendo…" : "Subir imagen"}
                        <input
                          type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden"
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) subirLogoCreacion(f); e.target.value = "" }}
                        />
                      </label>
                    </div>
                    {errorLogoCreacion && <p className="mt-1 text-xs font-medium text-red-600">{errorLogoCreacion}</p>}
                    <p className="mt-1 text-xs text-slate-400">PNG, JPG, WEBP o SVG · máx. 2 MB. También puedes pegar una URL ya alojada:</p>
                    <input
                      type="text" value={campos.logoUrl} onChange={(e) => actualizarCampo("logoUrl", e.target.value)}
                      placeholder="https://…"
                      className="mt-1 w-full rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50"
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-400">Las tarjetas de servicios quedan disponibles después, ya con la óptica creada.</p>
              </div>
            </div>

            {/* ─── Sección: cuenta del administrador ─── */}
            <div>
              <div className="mb-3 flex items-center gap-2">
                <div className="grid h-7 w-7 place-items-center rounded-lg" style={{ background: "rgba(124,58,237,0.1)", color: "#7C3AED" }}>
                  <User size={14} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-700">Cuenta del administrador</p>
                  <p className="text-xs text-slate-500">Esta persona podrá iniciar sesión y gestionar la óptica.</p>
                </div>
              </div>
              <div className="space-y-4 rounded-xl border border-slate-200/60 bg-slate-50/60 p-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Nombre completo</label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="text" value={campos.nombreAdmin} onChange={(e) => actualizarCampo("nombreAdmin", filtrarSoloLetras(e.target.value))}
                        placeholder="Ej. Ana Torres" autoComplete="name"
                        className="w-full rounded-xl border border-slate-200/60 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none transition focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-50"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Correo electrónico</label>
                    <div className="relative">
                      <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="email" value={campos.emailAdmin} onChange={(e) => actualizarCampo("emailAdmin", e.target.value)}
                        placeholder="admin@vision-clara.com" autoComplete="email"
                        className="w-full rounded-xl border border-slate-200/60 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none transition focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-50"
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Cédula</label>
                    <div className="relative">
                      <IdCard className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="text" inputMode="numeric" value={campos.cedulaAdmin}
                        onChange={(e) => actualizarCampo("cedulaAdmin", e.target.value.replace(/\D/g, "").slice(0, 10))}
                        placeholder="10 dígitos" maxLength={10}
                        className="w-full rounded-xl border border-slate-200/60 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none transition focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-50"
                      />
                    </div>
                    <p className="mt-1 text-xs text-slate-500">Única por óptica — evita que la misma persona tenga dos cuentas.</p>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Fecha de nacimiento <span className="font-normal text-slate-400">(opcional)</span></label>
                    <CampoFecha id="admin-nacimiento" etiqueta="Fecha de nacimiento" valor={campos.fechaNacimientoAdmin} onCambiar={(v) => actualizarCampo("fechaNacimientoAdmin", v)} icono={Cake} placeholder="Elige la fecha" />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Contraseña</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type={verClave ? "text" : "password"} value={campos.clave} onChange={(e) => actualizarCampo("clave", e.target.value)}
                        placeholder="8 o más, con letra y número"
                        className="w-full rounded-xl border border-slate-200/60 bg-white py-2.5 pl-10 pr-9 text-sm text-slate-800 outline-none transition focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-50"
                      />
                      <button type="button" onClick={() => setVerClave((v) => !v)} aria-label={verClave ? "Ocultar contraseña" : "Mostrar contraseña"} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 cursor-pointer">
                        {verClave ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Confirmar contraseña</label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type={verClave ? "text" : "password"} value={campos.confirmarClave} onChange={(e) => actualizarCampo("confirmarClave", e.target.value)}
                        placeholder="Repetir contraseña"
                        className="w-full rounded-xl border border-slate-200/60 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none transition focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-50"
                      />
                    </div>
                  </div>
                </div>
                {(campos.clave || campos.confirmarClave) && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 pt-0.5">
                    <span className={"flex items-center gap-1.5 text-xs font-medium " + (esClaveSegura(campos.clave) ? "text-emerald-600" : "text-slate-400")}>
                      {esClaveSegura(campos.clave) ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                      8 o más caracteres, con letra y número
                    </span>
                    <span className={"flex items-center gap-1.5 text-xs font-medium " + (campos.confirmarClave && campos.clave === campos.confirmarClave ? "text-emerald-600" : "text-slate-400")}>
                      {campos.confirmarClave && campos.clave === campos.confirmarClave ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                      Las contraseñas coinciden
                    </span>
                  </div>
                )}
                <label className="flex items-start gap-2 rounded-lg border border-slate-200/60 bg-white p-2.5 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={campos.esOptometra}
                    onChange={(e) => actualizarCampo("esOptometra", e.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 cursor-pointer rounded border-slate-300 text-blue-600 focus-visible:ring-blue-500"
                  />
                  <span>¿Este administrador es también el optómetra/licenciado? Es solo informativo, para saber si va a administrar el sistema él mismo o a delegarlo.</span>
                </label>
              </div>
            </div>
          </div>
        </Cascaron>
      )}

      {/* ─── MODAL AGREGAR SUPERADMIN ─── */}
      {modalSuperadminAbierto && (
        <Cascaron
          titulo="Agregar superadmin"
          subtitulo="Tendrá el mismo acceso total que tú."
          Icono={ShieldCheck}
          ancho="max-w-md"
          onCerrar={() => !guardandoSuperadmin && setModalSuperadminAbierto(false)}
          formulario={{ onSubmit: guardarSuperadmin }}
          pie={<>
            <span />
            <div className="ml-auto flex items-center gap-2">
                  <button type="button" onClick={() => setModalSuperadminAbierto(false)} disabled={guardandoSuperadmin} className="rounded-lg border border-slate-200/60 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-50">
                    Cancelar
                  </button>
                  <button type="submit" disabled={guardandoSuperadmin} className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer disabled:opacity-60" style={{ background: GRAD, boxShadow: "0 12px 24px -12px rgba(37,99,235,0.6)" }}>
                    {guardandoSuperadmin ? "Creando…" : "Agregar superadmin"}
                  </button>
            </div>
          </>}
        >
          <div className="space-y-4 p-5">
            {errorSuperadmin && (
              <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200/60 bg-red-50 p-3 text-sm font-medium text-red-700">
                <AlertCircle size={16} />
                {errorSuperadmin}
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Nombre completo</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text" value={camposSuperadmin.nombre} onChange={(e) => actualizarCampoSuperadmin("nombre", filtrarSoloLetras(e.target.value))}
                  placeholder="Ej. María Fernanda Loor"
                  className="w-full rounded-xl border border-slate-200/60 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Correo electrónico</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="email" value={camposSuperadmin.email} onChange={(e) => actualizarCampoSuperadmin("email", e.target.value)}
                  placeholder="correo@ejemplo.com"
                  className="w-full rounded-xl border border-slate-200/60 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type={verClaveSuperadmin ? "text" : "password"} value={camposSuperadmin.clave} onChange={(e) => actualizarCampoSuperadmin("clave", e.target.value)}
                    placeholder="8 o más, con letra y número"
                    className="w-full rounded-xl border border-slate-200/60 bg-slate-50 py-2.5 pl-10 pr-9 text-sm outline-none focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50"
                  />
                  <button type="button" onClick={() => setVerClaveSuperadmin((v) => !v)} aria-label={verClaveSuperadmin ? "Ocultar contraseña" : "Mostrar contraseña"} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 cursor-pointer">{verClaveSuperadmin ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700">Confirmar</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type={verClaveSuperadmin ? "text" : "password"} value={camposSuperadmin.confirmarClave} onChange={(e) => actualizarCampoSuperadmin("confirmarClave", e.target.value)}
                    placeholder="Repetir contraseña"
                    className="w-full rounded-xl border border-slate-200/60 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50"
                  />
                </div>
              </div>
            </div>
          </div>
        </Cascaron>
      )}

      {/* ─── CONFIRMAR QUITAR SUPERADMIN ─── */}
      {superadminAEliminar && (
        <Cascaron titulo={"¿Quitar a " + superadminAEliminar.nombre + " como superadmin?"} subtitulo="Confirma antes de continuar" Icono={AlertTriangle} ancho="max-w-md" onCerrar={() => !eliminandoSuperadmin && setSuperadminAEliminar(null)}
          pie={<>
            <span />
            <div className="ml-auto flex items-center gap-2">
              <button type="button" onClick={() => { setSuperadminAEliminar(null); setErrorEliminarSuperadmin("") }} disabled={eliminandoSuperadmin} className="rounded-lg border border-slate-200/60 px-3.5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-60">Cancelar</button>
              <button type="button" onClick={confirmarEliminarSuperadmin} disabled={eliminandoSuperadmin} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 cursor-pointer disabled:opacity-60">
                {eliminandoSuperadmin ? "Quitando…" : "Quitar"}
              </button>
            </div>
          </>}
        >
          <div className="p-6">
            <p className="text-sm text-slate-600">Perderá acceso al panel y su cuenta de acceso se elimina — su correo queda libre para usarse de nuevo.</p>
            {errorEliminarSuperadmin && (
              <p role="alert" className="mt-2 flex items-center gap-1 text-xs font-semibold text-rose-700"><AlertCircle size={12} /> {errorEliminarSuperadmin}</p>
            )}
          </div>
        </Cascaron>
      )}

      {/* ─── MODAL MI CUENTA ─── */}
      {modalMiCuentaAbierto && (
        <Cascaron
          titulo="Mi cuenta"
          subtitulo="Tus datos y tu acceso a este panel."
          Icono={Settings}
          ancho="max-w-md"
          onCerrar={() => !guardandoMiCuenta && !guardandoClaveNueva && setModalMiCuentaAbierto(false)}
          pie={<>
            <span />
            <button type="button" onClick={() => setModalMiCuentaAbierto(false)} className="rounded-lg border border-slate-200/60 px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">Cerrar</button>
          </>}
        >
          <div className="space-y-5 p-5">
          {/* ─── Información personal ─── */}
          <form onSubmit={guardarMiCuenta} className="space-y-3">
            {errorMiCuenta && (
              <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200/60 bg-red-50 p-2.5 text-xs font-medium text-red-700">
                <AlertCircle size={14} /> {errorMiCuenta}
              </div>
            )}
            {avisoEmailPendiente && (
              <div className="flex items-center gap-2 rounded-lg border border-blue-200/60 bg-blue-50 p-2.5 text-xs font-medium text-blue-700">
                <Info size={14} className="shrink-0" /> Te enviamos un enlace a {camposMiCuenta.email} para confirmar el cambio de correo — hasta que lo confirmes, sigues entrando con el anterior.
              </div>
            )}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Nombre completo</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text" value={camposMiCuenta.nombre} onChange={(e) => setCamposMiCuenta((p) => ({ ...p, nombre: filtrarSoloLetras(e.target.value) }))}
                  className="w-full rounded-xl border border-slate-200/60 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Correo electrónico</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="email" value={camposMiCuenta.email} onChange={(e) => setCamposMiCuenta((p) => ({ ...p, email: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200/60 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50"
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-500">Es también tu usuario para iniciar sesión.</p>
            </div>
            <div className="flex justify-end">
              <button type="submit" disabled={guardandoMiCuenta} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white cursor-pointer disabled:opacity-60" style={{ background: GRAD }}>
                {guardandoMiCuenta ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </form>

          <div className="border-t border-slate-100 pt-5">
            <p className="mb-3 text-sm font-bold text-slate-700">Cambiar contraseña</p>
            <form onSubmit={actualizarMiClave} className="space-y-3">
              {errorClaveNueva && (
                <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200/60 bg-red-50 p-2.5 text-xs font-medium text-red-700">
                  <AlertCircle size={14} /> {errorClaveNueva}
                </div>
              )}
              {claveActualizada && (
                <div role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200/60 bg-emerald-50 p-2.5 text-xs font-medium text-emerald-700">
                  <CheckCircle2 size={14} /> Contraseña actualizada.
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input
                    type={verClaveNueva ? "text" : "password"} placeholder="Nueva contraseña" value={claveNueva} onChange={(e) => setClaveNueva(e.target.value)}
                    className="w-full rounded-xl border border-slate-200/60 bg-slate-50 py-2.5 pl-10 pr-9 text-sm outline-none focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50"
                  />
                  <button type="button" onClick={() => setVerClaveNueva((v) => !v)} aria-label={verClaveNueva ? "Ocultar contraseña" : "Mostrar contraseña"} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 cursor-pointer">
                    {verClaveNueva ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <input
                  type={verClaveNueva ? "text" : "password"} placeholder="Confirmar" value={confirmarClaveNueva} onChange={(e) => setConfirmarClaveNueva(e.target.value)}
                  className="w-full rounded-xl border border-slate-200/60 bg-slate-50 py-2.5 px-3 text-sm outline-none focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50"
                />
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={guardandoClaveNueva || !claveNueva} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer disabled:opacity-60 disabled:hover:translate-y-0">
                  {guardandoClaveNueva ? "Actualizando…" : "Actualizar contraseña"}
                </button>
              </div>
            </form>
          </div>

          <div className="border-t border-slate-100 pt-5">
            <SeccionMfa />
          </div>
          </div>
        </Cascaron>
      )}

      {/* ─── CONFIRMAR SUSPENDER/REACTIVAR ÓPTICA ───
          Antes esto pasaba con un solo clic, sin ningún paso de confirmación
          — el mismo menú de "⋮" que tiene "Copiar slug" al lado. */}
      {opticaAConfirmar && (
        <Cascaron
          titulo={opticaAConfirmar.activa ? "Suspender óptica" : "Reactivar óptica"}
          subtitulo={opticaAConfirmar.nombre}
          Icono={opticaAConfirmar.activa ? Ban : CheckCircle2}
          ancho="max-w-md"
          onCerrar={() => { setOpticaAConfirmar(null); setMotivoSuspension("") }}
          pie={<>
            <span />
            <div className="ml-auto flex items-center gap-2">
              <button type="button" onClick={() => { setOpticaAConfirmar(null); setMotivoSuspension("") }} className="rounded-lg border border-slate-200/60 px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">Cancelar</button>
              <button
                type="button"
                onClick={async () => { const o = opticaAConfirmar; const motivo = motivoSuspension; setOpticaAConfirmar(null); setMotivoSuspension(""); await alternarActiva(o, motivo) }}
                className={"rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors cursor-pointer " + (opticaAConfirmar.activa ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700")}
              >
                {opticaAConfirmar.activa ? "Suspender" : "Reactivar"}
              </button>
            </div>
          </>}
        >
          <div className="space-y-3 p-6">
          <p className="text-sm text-slate-600">
            {opticaAConfirmar.activa ? (
              <>¿Seguro que deseas suspender <span className="font-semibold text-slate-800">{opticaAConfirmar.nombre}</span>? Su administrador y todo su equipo pierden acceso al sistema de inmediato.</>
            ) : (
              <>¿Reactivar <span className="font-semibold text-slate-800">{opticaAConfirmar.nombre}</span>? Recupera el acceso al sistema de inmediato.</>
            )}
          </p>
          {opticaAConfirmar.activa && (
            <label className="block text-sm font-semibold text-slate-700">Motivo (opcional)
              <textarea rows={2} value={motivoSuspension} onChange={(e) => setMotivoSuspension(e.target.value)} placeholder="Ej. Pago vencido hace 40 días" className="mt-1 w-full rounded-xl border border-slate-200/60 bg-slate-50 p-3 text-sm font-normal outline-none focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50" />
              <span className="mt-1 block text-xs font-normal text-slate-500">Queda en la actividad y se le avisa al administrador por Mensajes.</span>
            </label>
          )}
          </div>
        </Cascaron>
      )}
    </div>
  )
}
