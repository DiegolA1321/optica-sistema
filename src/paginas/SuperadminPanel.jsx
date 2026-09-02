"use client"

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
  ChevronRight,
  ChevronDown,
  TrendingUp,
  Settings,
  MessageSquare,
  Megaphone,
  Send,
  Cake,
  Receipt,
  Printer,
  Wallet,
  Inbox,
  PhoneCall,
  BarChart3,
  Users,
  Stethoscope,
  Image as ImageIcon,
  Save,
} from "lucide-react"
import { supabase, crearClienteTemporal } from "../lib/supabaseClient"
import SeccionMfa from "./SeccionMfa"
import { esHoy, etiquetaFecha } from "../utilidades/disponibilidad"
import { imprimirDocumento, estilosImpresion } from "../utilidades/imprimir"
import { useAnchoElemento } from "../utilidades/graficos"
import { filtrarSoloLetras, esNombreValido, esEmailValido } from "../utilidades/validaciones"

// ─── Paleta de firma (consistente con el resto del sistema) ───
const INK = "#0E2B33"
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)" // cian → azul

const generarSlug = (texto) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

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
  const hoy0 = new Date()
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
  const hoy0 = new Date()
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

const camposOpticaIniciales = { nombreOptica: "", slug: "", eslogan: "", colorAcento: "#2563EB", logoUrl: "", nombreAdmin: "", emailAdmin: "", fechaNacimientoAdmin: "", clave: "", confirmarClave: "" }
const camposCuentaIniciales = { nombre: "", email: "", clave: "", confirmarClave: "" }

const formatearFecha = (fecha) => new Date(fecha).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" })
const formatearFechaHora = (fecha) =>
  new Date(fecha).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })

const NAV = [
  { id: "resumen", nombre: "Resumen", icono: LayoutDashboard },
  { id: "opticas", nombre: "Ópticas", icono: Building2 },
  { id: "leads", nombre: "Leads", icono: Inbox },
  { id: "mensajes", nombre: "CRM", icono: MessageSquare },
  { id: "actividad", nombre: "Actividad", icono: History },
  { id: "superadmins", nombre: "Superadmins", icono: ShieldCheck },
]

const AUDITORIA_PAGINA = 20

const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
const DIAS_CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"]

function ultimosNMeses(n) {
  const hoy = new Date()
  const arr = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
    arr.push({ clave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, etiqueta: MESES_CORTOS[d.getMonth()] })
  }
  return arr
}

function ultimosNDias(n) {
  const hoy = new Date()
  const arr = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - i)
    const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    arr.push({ clave, etiqueta: DIAS_CORTOS[d.getDay()] })
  }
  return arr
}

// Curva suave (Bézier cúbica con punto de control en el punto medio de cada
// tramo) sobre coordenadas absolutas de un viewBox — a diferencia de un
// div con height:X%, esto no depende de que el ancestro tenga una altura
// definida, así que no puede caer en el bug de "altura 0 silenciosa" que
// tuvo el gráfico de barras original (ver memoria de la sesión anterior).
function construirCurva(valores, w, h, max, padTop = 10, padBottom = 8, padX = 24) {
  const n = valores.length
  if (n === 0) return { linea: "", area: "", puntos: [] }
  const anchoUtil = w - padX * 2
  const stepX = n > 1 ? anchoUtil / (n - 1) : 0
  const rango = h - padTop - padBottom
  const puntos = valores.map((v, i) => {
    const x = n > 1 ? padX + i * stepX : w / 2
    const y = padTop + rango - (max > 0 ? (v / max) * rango : 0)
    return [x, y]
  })
  let linea = `M ${puntos[0][0].toFixed(1)} ${puntos[0][1].toFixed(1)}`
  for (let i = 1; i < puntos.length; i++) {
    const [x0, y0] = puntos[i - 1]
    const [x1, y1] = puntos[i]
    const mx = (x0 + x1) / 2
    linea += ` C ${mx.toFixed(1)} ${y0.toFixed(1)}, ${mx.toFixed(1)} ${y1.toFixed(1)}, ${x1.toFixed(1)} ${y1.toFixed(1)}`
  }
  const area = `${linea} L ${puntos[puntos.length - 1][0].toFixed(1)} ${h - padBottom} L ${puntos[0][0].toFixed(1)} ${h - padBottom} Z`
  return { linea, area, puntos }
}

// ─── Registro de actividad (auditoría) ───
const AUDITORIA_INFO = {
  crear_optica: { grupo: "opticas", icon: Plus, bg: "#E8F0FF", fg: "#2563EB" },
  suspender_optica: { grupo: "opticas", icon: Ban, bg: "#FEEBEE", fg: "#E11D48" },
  reactivar_optica: { grupo: "opticas", icon: CheckCircle2, bg: "#E7F7EF", fg: "#059669" },
  renombrar_optica: { grupo: "opticas", icon: Pencil, bg: "#E8F0FF", fg: "#2563EB" },
  // Van agrupadas con "opticas" (no en su propio grupo "administradores") —
  // agregar/quitar un admin es parte del ciclo de vida de la óptica a la que
  // pertenece, y un filtro aparte para esto resultaba redundante (feedback
  // de Diego, igual que la tarjeta "Administradores" que se sacó de Resumen/Ópticas).
  agregar_administrador: { grupo: "opticas", icon: UserPlus, bg: "#F1EAFE", fg: "#7C3AED" },
  eliminar_administrador: { grupo: "opticas", icon: Trash2, bg: "#FEEBEE", fg: "#E11D48" },
  crear_superadmin: { grupo: "superadmins", icon: ShieldCheck, bg: "#F1EAFE", fg: "#7C3AED" },
  eliminar_superadmin: { grupo: "superadmins", icon: Trash2, bg: "#FEEBEE", fg: "#E11D48" },
  responder_mensaje: { grupo: "mensajes", icon: MessageSquare, bg: "#E8F0FF", fg: "#2563EB" },
  publicar_anuncio: { grupo: "mensajes", icon: Megaphone, bg: "#FFF7E6", fg: "#B45309" },
  actualizar_pago: { grupo: "opticas", icon: Wallet, bg: "#FFF7E6", fg: "#B45309" },
  generar_factura: { grupo: "opticas", icon: Receipt, bg: "#E7F7EF", fg: "#059669" },
}

const FILTROS_ACTIVIDAD = [
  { key: "todas", label: "Todas" },
  { key: "opticas", label: "Ópticas" },
  { key: "mensajes", label: "Mensajes" },
  { key: "superadmins", label: "Superadmins" },
]

function textoAuditoria(a) {
  switch (a.accion) {
    case "crear_optica": return <>creó la óptica <b>{a.optica_nombre}</b></>
    case "suspender_optica": return <>suspendió la óptica <b>{a.optica_nombre}</b></>
    case "reactivar_optica": return <>reactivó la óptica <b>{a.optica_nombre}</b></>
    case "renombrar_optica": return <>renombró <b>{a.detalle}</b> a <b>{a.optica_nombre}</b></>
    case "agregar_administrador": return <>agregó a <b>{a.detalle}</b> como administrador de <b>{a.optica_nombre}</b></>
    case "eliminar_administrador": return <>quitó a <b>{a.detalle}</b> como administrador de <b>{a.optica_nombre}</b></>
    case "crear_superadmin": return <>agregó a <b>{a.optica_nombre}</b> como superadministrador</>
    case "eliminar_superadmin": return <>quitó a <b>{a.optica_nombre}</b> como superadministrador</>
    case "responder_mensaje": return <>respondió una consulta de <b>{a.optica_nombre}</b></>
    case "publicar_anuncio": return <>publicó un aviso general: <b>{a.detalle}</b></>
    case "actualizar_pago": return <>marcó el pago de <b>{a.optica_nombre}</b> como <b>{a.detalle === "al_dia" ? "al día" : a.detalle}</b></>
    case "generar_factura": return <>generó la factura <b>{a.detalle}</b> para <b>{a.optica_nombre}</b></>
    default: return a.accion
  }
}

function ItemAuditoria({ a }) {
  const info = AUDITORIA_INFO[a.accion]
  if (!info) return null
  const Icono = info.icon
  return (
    <li className="flex items-start gap-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: info.bg, color: info.fg }}>
        <Icono size={15} />
      </div>
      <div className="min-w-0 flex-1 border-b border-slate-100 pb-3.5">
        <p className="text-[13.5px] leading-snug text-slate-700">
          <span className="font-semibold text-slate-900">{a.actor_nombre}</span> {textoAuditoria(a)}
        </p>
        <p className="mt-1 flex items-center gap-1 text-[11.5px] text-slate-400">
          <Clock size={11} />
          {formatearFechaHora(a.created_at)}
        </p>
      </div>
    </li>
  )
}

// ─── Estilos de tarjeta reutilizables (mismo look en toda la superficie) ───
// El hover-lift es a propósito parte de la base, no algo que cada pantalla
// agregue por separado — Diego pidió que todos los módulos del panel se
// "levanten" un poco al pasar el cursor, no solo los de Resumen.
const CARD = "rounded-[22px] border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_36px_-28px_rgba(15,23,42,0.35)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_1px_2px_rgba(15,23,42,0.06),0_24px_44px_-24px_rgba(15,23,42,0.45)]"
const CARD_PAD = CARD + " p-5 sm:p-6"

export default function SuperadminPanel({ usuario, alSalir, alActualizarUsuario }) {
  const [seccion, setSeccion] = useState("resumen")
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
  const [visitas, setVisitas] = useState([])

  // ─── Auditoría (paginada + filtrable por grupo) ───
  const [auditoria, setAuditoria] = useState([])
  const [auditoriaOffset, setAuditoriaOffset] = useState(0)
  const [auditoriaTieneMas, setAuditoriaTieneMas] = useState(true)
  const [auditoriaCargandoMas, setAuditoriaCargandoMas] = useState(false)
  const [auditoriaFiltro, setAuditoriaFiltro] = useState("todas")
  // Día colapsado manualmente (mismo patrón que Citas.jsx: si un día tiene
  // muchos eventos, poder colapsarlo — sobre todo "hoy" — para llegar a los
  // días anteriores sin tanto scroll) y filtro opcional a un solo día (se
  // activa al hacer clic en una barra del gráfico "Actividad por día").
  const [diasActividadColapsados, setDiasActividadColapsados] = useState(() => new Set())
  const alternarDiaActividad = (dia) => {
    setDiasActividadColapsados((prev) => {
      const siguiente = new Set(prev)
      if (siguiente.has(dia)) siguiente.delete(dia)
      else siguiente.add(dia)
      return siguiente
    })
  }
  const [filtroFechaActividad, setFiltroFechaActividad] = useState(null)
  // Filtro por autor — se activa al hacer clic en un superadmin desde la
  // pantalla de Superadmins, para poder ver justo lo que esa cuenta hizo.
  const [filtroActorActividad, setFiltroActorActividad] = useState(null) // { id, nombre } | null

  // ─── Mensajes (consultas de administradores + avisos generales) ───
  const [mensajes, setMensajes] = useState([])
  const [mensajesFiltro, setMensajesFiltro] = useState("todas") // todas | consulta | anuncio
  const [mensajeAbierto, setMensajeAbierto] = useState(null)
  const [respuestaTexto, setRespuestaTexto] = useState("")
  const [enviandoRespuesta, setEnviandoRespuesta] = useState(false)
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
  const [hoverMesIdx, setHoverMesIdx] = useState(null)
  const [hoverBarClave, setHoverBarClave] = useState(null)
  const [hoverVisitaIdx, setHoverVisitaIdx] = useState(null)

  // Solo true en la primerísima carga — evita que cada refetch posterior
  // (después de crear/editar algo) vuelva a tapar el panel con el estado de
  // carga; los datos ya visibles se quedan mientras se refrescan en segundo plano.
  const [cargaInicial, setCargaInicial] = useState(true)

  // ─── Crear óptica ───
  const [modalAbierto, setModalAbierto] = useState(false)
  const [campos, setCampos] = useState(camposOpticaIniciales)
  const [slugTocado, setSlugTocado] = useState(false)
  const [slugEstado, setSlugEstado] = useState("idle") // idle | verificando | disponible | ocupado
  const [verClave, setVerClave] = useState(false)
  const [error, setError] = useState("")
  const [guardando, setGuardando] = useState(false)

  // ─── Búsqueda, filtro por estado y detalle de ópticas ───
  const [busqueda, setBusqueda] = useState("")
  const [filtroEstado, setFiltroEstado] = useState("Todas") // Todas | Activas | Suspendidas
  const [detalle, setDetalle] = useState(null)
  const [procesandoId, setProcesandoId] = useState(null)
  const [slugCopiado, setSlugCopiado] = useState(false)

  // ─── Detalle: renombrar óptica ───
  const [renombrando, setRenombrando] = useState(false)
  const [nombreEditado, setNombreEditado] = useState("")
  const [guardandoNombre, setGuardandoNombre] = useState(false)

  // ─── Detalle: suscripción y facturación ───
  const [actualizandoPago, setActualizandoPago] = useState(false)
  const [campoMonto, setCampoMonto] = useState("")
  const [campoVencimiento, setCampoVencimiento] = useState("")
  const SERVICIOS_VACIOS = () => Array.from({ length: 3 }, () => ({ titulo: "", texto: "", features: ["", "", ""] }))
  const [campoMarca, setCampoMarca] = useState({ nombreMarca: "", eslogan: "", colorAcento: "#2563EB", mensaje: "", servicios: SERVICIOS_VACIOS() })
  const [campoLogoUrl, setCampoLogoUrl] = useState("")
  const [guardandoMarca, setGuardandoMarca] = useState(false)
  // Confirmación visible tras guardar la personalización — el autoguardado
  // al salir de cada campo (onBlur) es cómodo pero invisible: sin esto no
  // había ninguna señal de que sí se guardó, y parecía que faltaba un botón
  // de guardar (feedback de Diego). Se apaga sola a los 2.5s.
  const [marcaGuardadaOk, setMarcaGuardadaOk] = useState(false)
  const [subiendoLogo, setSubiendoLogo] = useState(false)
  const [errorLogo, setErrorLogo] = useState("")
  const [guardandoSuscripcion, setGuardandoSuscripcion] = useState(false)
  const [facturasOptica, setFacturasOptica] = useState([])
  const [cargandoFacturas, setCargandoFacturas] = useState(false)
  const [generandoFactura, setGenerandoFactura] = useState(false)
  const [facturaImprimir, setFacturaImprimir] = useState(null)
  const [guardandoCumple, setGuardandoCumple] = useState(null) // id del admin en guardado

  // ─── Detalle: agregar / quitar administrador ───
  const [agregarAdminAbierto, setAgregarAdminAbierto] = useState(false)
  const [camposAdminExtra, setCamposAdminExtra] = useState(camposCuentaIniciales)
  const [verClaveExtra, setVerClaveExtra] = useState(false)
  const [errorAdminExtra, setErrorAdminExtra] = useState("")
  const [guardandoAdminExtra, setGuardandoAdminExtra] = useState(false)
  const [adminAEliminar, setAdminAEliminar] = useState(null)
  const [eliminandoAdmin, setEliminandoAdmin] = useState(false)

  // ─── Superadmins ───
  const [modalSuperadminAbierto, setModalSuperadminAbierto] = useState(false)
  const [camposSuperadmin, setCamposSuperadmin] = useState(camposCuentaIniciales)
  const [verClaveSuperadmin, setVerClaveSuperadmin] = useState(false)
  const [errorSuperadmin, setErrorSuperadmin] = useState("")
  const [guardandoSuperadmin, setGuardandoSuperadmin] = useState(false)
  const [superadminAEliminar, setSuperadminAEliminar] = useState(null)
  const [eliminandoSuperadmin, setEliminandoSuperadmin] = useState(false)

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
    if (!emailCambio) setModalMiCuentaAbierto(false)
  }

  const actualizarMiClave = async (e) => {
    e.preventDefault()
    setErrorClaveNueva("")
    if (claveNueva.length < 6) { setErrorClaveNueva("La contraseña debe tener al menos 6 caracteres."); return }
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

  const cargarAuditoria = async (reset = true) => {
    const desde = reset ? 0 : auditoriaOffset
    if (!reset) setAuditoriaCargandoMas(true)
    let consulta = supabase.from("auditoria").select("*").order("created_at", { ascending: false }).range(desde, desde + AUDITORIA_PAGINA - 1)
    if (auditoriaFiltro !== "todas") {
      const acciones = Object.entries(AUDITORIA_INFO).filter(([, v]) => v.grupo === auditoriaFiltro).map(([k]) => k)
      consulta = consulta.in("accion", acciones)
    }
    const { data } = await consulta
    setAuditoria((prev) => (reset ? (data || []) : [...prev, ...(data || [])]))
    setAuditoriaOffset(desde + (data?.length || 0))
    setAuditoriaTieneMas((data?.length || 0) === AUDITORIA_PAGINA)
    setAuditoriaCargandoMas(false)
  }

  useEffect(() => {
    cargarAuditoria(true)
  }, [auditoriaFiltro])

  const cargarDatos = async () => {
    setCargando(true)
    const [{ data: opticasData }, { data: adminsData }, { data: superadminsData }, { data: asistentesData }, { data: pacientesData }] = await Promise.all([
      supabase.from("opticas").select("*").order("created_at", { ascending: false }),
      supabase.from("perfiles").select("id, optica_id, nombre, email, fecha_nacimiento").eq("rol", "admin"),
      supabase.from("perfiles").select("id, nombre, email, created_at").eq("rol", "superadmin").order("created_at", { ascending: true }),
      supabase.from("perfiles").select("optica_id").eq("rol", "asistente"),
      supabase.from("pacientes").select("optica_id"),
    ])
    setOpticas(opticasData || [])
    setAdmins(adminsData || [])
    setSuperadmins(superadminsData || [])
    setAsistentesOpticaId(asistentesData || [])
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
    cargarLeads()
    cargarVisitas()
  }

  const cargarMensajes = async () => {
    const { data } = await supabase.from("mensajes").select("*").order("created_at", { ascending: false })
    setMensajes(data || [])
  }

  const cargarLeads = async () => {
    const { data } = await supabase.from("leads").select("*").order("created_at", { ascending: false })
    setLeads(data || [])
  }

  // Últimos 90 días alcanza para el gráfico de Resumen (por día) sin traer
  // toda la tabla histórica al cliente.
  const cargarVisitas = async () => {
    const desde = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await supabase.from("visitas").select("tipo, created_at").gte("created_at", desde)
    setVisitas(data || [])
  }

  const marcarLead = async (id, estado) => {
    setProcesandoLeadId(id)
    const { error } = await supabase.from("leads").update({ estado }).eq("id", id)
    if (!error) setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, estado } : l)))
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
      nombreOptica: lead.nombre_optica || "",
      slug: lead.slug_deseado ? generarSlug(lead.slug_deseado) : generarSlug(lead.nombre_optica || ""),
      nombreAdmin: lead.nombre_admin || "",
      emailAdmin: lead.email_admin || "",
      fechaNacimientoAdmin: "",
      clave: "",
      confirmarClave: "",
    })
    setSlugTocado(true)
    setSlugEstado("idle")
    setVerClave(false)
    setError("")
    setLeadEnCurso(lead.id)
    setModalAbierto(true)
  }

  const responderMensaje = async (marcarResuelto) => {
    if (!mensajeAbierto) return
    setEnviandoRespuesta(true)
    const cambios = { respuesta: respuestaTexto.trim() || null, respondido_at: new Date().toISOString() }
    if (marcarResuelto) cambios.estado = "resuelto"
    const { error } = await supabase.from("mensajes").update(cambios).eq("id", mensajeAbierto.id)
    if (!error) {
      setMensajes((prev) => prev.map((m) => (m.id === mensajeAbierto.id ? { ...m, ...cambios } : m)))
      setMensajeAbierto((prev) => (prev ? { ...prev, ...cambios } : prev))
      await registrarAuditoria("responder_mensaje", { opticaId: mensajeAbierto.optica_id, opticaNombre: opticas.find((o) => o.id === mensajeAbierto.optica_id)?.nombre || "—" })
      cargarAuditoria(true)
      setRespuestaTexto("")
    }
    setEnviandoRespuesta(false)
  }

  const publicarAviso = async (e) => {
    e.preventDefault()
    setErrorAviso("")
    if (!avisoAsunto.trim() || !avisoCuerpo.trim()) { setErrorAviso("Completa el asunto y el mensaje."); return }
    const opticaDestino = avisoDestino === "todos" ? null : avisoDestino
    if (avisoDestino !== "todos" && !opticaDestino) { setErrorAviso("Elegí a qué óptica va dirigido el aviso."); return }
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
  }

  // Best-effort: si la tabla auditoria aún no existe (falta correr las
  // migraciones) esto no debe tumbar el resto de los flujos.
  const registrarAuditoria = async (accion, { opticaId = null, opticaNombre, detalle: detalleTexto = null }) => {
    const { error: errorAuditoria } = await supabase.from("auditoria").insert({
      actor_id: usuario?.id || null,
      actor_nombre: usuario?.nombre || "Superadmin",
      accion,
      optica_id: opticaId,
      optica_nombre: opticaNombre,
      detalle: detalleTexto,
    })
    if (errorAuditoria) console.warn("[auditoria] no se pudo registrar:", errorAuditoria.message)
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  // Escape cierra lo que esté abierto en ese momento, de más "encima" a menos
  // — mismo orden de prioridad que usarías cerrando a mano con la X de cada uno.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return
      if (superadminAEliminar) { setSuperadminAEliminar(null); return }
      if (adminAEliminar) { setAdminAEliminar(null); return }
      if (modalMiCuentaAbierto) { if (!guardandoMiCuenta && !guardandoClaveNueva) setModalMiCuentaAbierto(false); return }
      if (modalAvisoAbierto) { if (!publicandoAviso) setModalAvisoAbierto(false); return }
      if (mensajeAbierto) { if (!enviandoRespuesta) setMensajeAbierto(null); return }
      if (modalSuperadminAbierto) { if (!guardandoSuperadmin) setModalSuperadminAbierto(false); return }
      if (modalAbierto) { if (!guardando) setModalAbierto(false); return }
      if (detalle) { setDetalle(null); setRenombrando(false); setAgregarAdminAbierto(false); return }
      if (menuAccionesId != null) { setMenuAccionesId(null); return }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [superadminAEliminar, adminAEliminar, modalMiCuentaAbierto, guardandoMiCuenta, guardandoClaveNueva, modalAvisoAbierto, publicandoAviso, mensajeAbierto, enviandoRespuesta, modalSuperadminAbierto, guardandoSuperadmin, modalAbierto, guardando, detalle, menuAccionesId])

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
  const totalesUsuarios = useMemo(() => ({
    admins: admins.length,
    asistentes: asistentesOpticaId.length,
    pacientes: pacientesOpticaId.length,
  }), [admins, asistentesOpticaId, pacientesOpticaId])

  const consultasAbiertas = useMemo(() => mensajes.filter((m) => m.tipo === "consulta" && m.estado === "abierto").length, [mensajes])
  const mensajesFiltrados = useMemo(() => (mensajesFiltro === "todas" ? mensajes : mensajes.filter((m) => m.tipo === mensajesFiltro)), [mensajes, mensajesFiltro])
  const opticasConPagoProblema = useMemo(() => opticas.filter((o) => o.estado_pago && o.estado_pago !== "al_dia"), [opticas])
  const cumpleanosProximos = useMemo(() => {
    return admins
      .map((a) => ({ admin: a, dias: diasACumple(a.fecha_nacimiento) }))
      .filter((x) => x.dias !== null)
      .sort((a, b) => a.dias - b.dias)
  }, [admins])

  const opticasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return opticas.filter((o) => {
      const listaAdmins = adminsPorOptica.get(o.id) || []
      if (filtroEstado === "Activas" && !o.activa) return false
      if (filtroEstado === "Suspendidas" && o.activa) return false
      if (!q) return true
      return (
        o.nombre.toLowerCase().includes(q) ||
        o.slug.toLowerCase().includes(q) ||
        listaAdmins.some((a) => a.nombre.toLowerCase().includes(q) || (a.email || "").toLowerCase().includes(q))
      )
    })
  }, [opticas, adminsPorOptica, busqueda, filtroEstado])

  const totalActivas = opticas.filter((o) => o.activa).length
  const totalSuspendidas = opticas.length - totalActivas

  // Antes había una 4ta tarjeta "Administradores" — se sacó porque su número
  // (admins.length) casi siempre coincide con "Ópticas totales" (cada óptica
  // se crea junto con su admin) y el filtro que abría ("ópticas con al menos
  // un admin") no correspondía uno a uno con ese número cuando una óptica
  // tenía más de un admin — confuso y redundante (feedback de Diego).
  const tarjetas = [
    { key: "Todas", label: "Ópticas totales", valor: opticas.length, icon: Building2, bg: "#E8F0FF", fg: "#2563EB" },
    { key: "Activas", label: "Activas", valor: totalActivas, icon: CheckCircle2, bg: "#E7F7EF", fg: "#059669" },
    { key: "Suspendidas", label: "Suspendidas", valor: totalSuspendidas, icon: Ban, bg: "#FEEBEE", fg: "#E11D48" },
  ]

  const irAOpticasConFiltro = (key) => { setFiltroEstado(key); setSeccion("opticas") }

  const abrirDetalleOptica = (o) => {
    setDetalle(o)
    setCampoMonto(o.monto_mensual != null ? String(o.monto_mensual) : "")
    setCampoVencimiento(o.proximo_vencimiento || "")
    setCampoMarca({
      nombreMarca: o.marca?.nombreMarca || "",
      eslogan: o.marca?.eslogan || "",
      colorAcento: o.marca?.colorAcento || "#2563EB",
      mensaje: o.marca?.mensaje || "",
      servicios: o.marca?.servicios?.length === 3
        ? o.marca.servicios.map((s) => ({ titulo: s.titulo || "", texto: s.texto || "", features: [s.features?.[0] || "", s.features?.[1] || "", s.features?.[2] || ""] }))
        : SERVICIOS_VACIOS(),
    })
    setCampoLogoUrl(o.logo_url || "")
    setFacturasOptica([])
    cargarFacturasOptica(o.id)
  }

  const guardarMarca = async () => {
    if (!detalle) return
    setGuardandoMarca(true)
    // Los 3 servicios solo se guardan como bloque cuando las 3 tarjetas
    // tienen al menos título — si el admin dejó alguna vacía (nunca las tocó,
    // o las borró para volver al default), no se manda la clave "servicios"
    // en absoluto, y Login.jsx cae de nuevo en el contenido genérico de
    // siempre en vez de mostrar tarjetas a medio llenar.
    const serviciosLimpios = campoMarca.servicios.map((s) => ({
      titulo: s.titulo.trim(), texto: s.texto.trim(), features: s.features.map((f) => f.trim()),
    }))
    const serviciosCompletos = serviciosLimpios.every((s) => s.titulo) ? serviciosLimpios : null
    const marca = {
      nombreMarca: campoMarca.nombreMarca.trim(),
      eslogan: campoMarca.eslogan.trim(),
      colorAcento: campoMarca.colorAcento,
      mensaje: campoMarca.mensaje.trim(),
      ...(serviciosCompletos ? { servicios: serviciosCompletos } : {}),
    }
    const { error } = await supabase.from("opticas").update({ marca, logo_url: campoLogoUrl.trim() || null }).eq("id", detalle.id)
    if (!error) {
      setDetalle((prev) => (prev ? { ...prev, marca, logo_url: campoLogoUrl.trim() || null } : prev))
      setOpticas((prev) => prev.map((o) => (o.id === detalle.id ? { ...o, marca, logo_url: campoLogoUrl.trim() || null } : o)))
      setMarcaGuardadaOk(true)
      setTimeout(() => setMarcaGuardadaOk(false), 2500)
    }
    setGuardandoMarca(false)
  }

  // "Cancelar cambios" de la barra de guardar: descarta lo tecleado en el
  // formulario y vuelve a los valores realmente guardados en `detalle`
  // (mismo cálculo que abrirDetalleOptica al abrir el modal por primera vez).
  const cancelarCambiosMarca = () => {
    if (!detalle) return
    setCampoMarca({
      nombreMarca: detalle.marca?.nombreMarca || "",
      eslogan: detalle.marca?.eslogan || "",
      colorAcento: detalle.marca?.colorAcento || "#2563EB",
      mensaje: detalle.marca?.mensaje || "",
      servicios: detalle.marca?.servicios?.length === 3
        ? detalle.marca.servicios.map((s) => ({ titulo: s.titulo || "", texto: s.texto || "", features: [s.features?.[0] || "", s.features?.[1] || "", s.features?.[2] || ""] }))
        : SERVICIOS_VACIOS(),
    })
    setCampoLogoUrl(detalle.logo_url || "")
  }

  // Muchas ópticas (sobre todo pequeñas) no tienen un logo ya alojado en
  // algún lado para pegar como URL — se sube el archivo directo al bucket
  // público "logos" (migración 0037) y se guarda la URL pública resultante,
  // exactamente como si la hubieran pegado a mano.
  const subirLogo = async (archivo) => {
    if (!archivo || !detalle) return
    if (archivo.size > 2 * 1024 * 1024) {
      setErrorLogo("La imagen no puede pesar más de 2 MB.")
      return
    }
    setErrorLogo("")
    setSubiendoLogo(true)
    const extension = archivo.name.split(".").pop()?.toLowerCase() || "png"
    const ruta = `${detalle.id}/${Date.now()}.${extension}`
    const { error: errorSubida } = await supabase.storage.from("logos").upload(ruta, archivo, { upsert: true })
    if (errorSubida) {
      setSubiendoLogo(false)
      setErrorLogo("No se pudo subir la imagen. Intenta de nuevo.")
      return
    }
    const { data } = supabase.storage.from("logos").getPublicUrl(ruta)
    setCampoLogoUrl(data.publicUrl)
    setSubiendoLogo(false)
    const { error } = await supabase.from("opticas").update({ logo_url: data.publicUrl }).eq("id", detalle.id)
    if (!error) {
      setDetalle((prev) => (prev ? { ...prev, logo_url: data.publicUrl } : prev))
      setOpticas((prev) => prev.map((o) => (o.id === detalle.id ? { ...o, logo_url: data.publicUrl } : o)))
    }
  }

  // created_at viene de Supabase en UTC — recortar el string ISO tal cual
  // desalinea "hoy" con la fecha local del navegador (ej. un evento de las
  // 21:48 en Ecuador ya cayó en el día siguiente en UTC). Hay que pasarlo
  // por Date y leer año/mes/día en hora local, igual que ultimosNMeses/Días.
  const claveMesLocal = (iso) => {
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  }
  const claveDiaLocal = (iso) => {
    const d = new Date(iso)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  }

  const opticasPorMes = useMemo(() => {
    const meses = ultimosNMeses(6)
    const mapa = new Map()
    opticas.forEach((o) => {
      if (!o.created_at) return
      const clave = claveMesLocal(o.created_at)
      mapa.set(clave, (mapa.get(clave) || 0) + 1)
    })
    return meses.map((m) => ({ ...m, valor: mapa.get(m.clave) || 0 }))
  }, [opticas])
  const maxOpticasMes = Math.max(1, ...opticasPorMes.map((m) => m.valor))

  const actividadPorDia = useMemo(() => {
    const dias = ultimosNDias(7)
    const mapa = new Map()
    auditoria.forEach((a) => {
      if (!a.created_at) return
      const clave = claveDiaLocal(a.created_at)
      mapa.set(clave, (mapa.get(clave) || 0) + 1)
    })
    return dias.map((d) => ({ ...d, valor: mapa.get(d.clave) || 0 }))
  }, [auditoria])
  const maxActividadDia = Math.max(1, ...actividadPorDia.map((d) => d.valor))

  // ─── Datos derivados para el resumen visual (todo real, nada decorativo) ───
  const opticasSinAdmin = useMemo(
    () => opticas.filter((o) => o.activa && (adminsPorOptica.get(o.id) || []).length === 0),
    [opticas, adminsPorOptica],
  )
  const pctActivas = opticas.length ? Math.round((totalActivas / opticas.length) * 100) : 0
  const creadasEsteMes = opticasPorMes.length ? opticasPorMes[opticasPorMes.length - 1].valor : 0

  const [refGraficoOpticas, anchoGraficoOpticas] = useAnchoElemento()
  const curvaOpticas = useMemo(
    () => construirCurva(opticasPorMes.map((m) => m.valor), anchoGraficoOpticas, 90, maxOpticasMes, 14),
    [opticasPorMes, maxOpticasMes, anchoGraficoOpticas],
  )

  // ─── Funnel comercial (leads/visitas de la página de venta) ───
  const visitasVenta = useMemo(() => visitas.filter((v) => v.tipo === "venta"), [visitas])
  const visitasPorDia = useMemo(() => {
    const dias = ultimosNDias(14)
    const mapa = new Map()
    visitasVenta.forEach((v) => {
      if (!v.created_at) return
      const clave = claveDiaLocal(v.created_at)
      mapa.set(clave, (mapa.get(clave) || 0) + 1)
    })
    return dias.map((d) => ({ ...d, valor: mapa.get(d.clave) || 0 }))
  }, [visitasVenta])
  const maxVisitasDia = Math.max(1, ...visitasPorDia.map((d) => d.valor))
  const [refGraficoVisitas, anchoGraficoVisitas] = useAnchoElemento()
  // Barras, no línea: la mayoría de los días suele estar en 0 visitas — una
  // línea plana que de golpe se dispara se ve como si algo estuviera roto;
  // una barra en 0 se lee como dato normal. Mismo patrón que "Actividad por
  // día" un poco más abajo en esta pantalla (barrasActividad).
  const barrasVisitas = useMemo(() => {
    const w = anchoGraficoVisitas, base = 82, padTop = 8
    const n = visitasPorDia.length || 1
    const gap = 10
    const barW = (w - gap * (n + 1)) / n
    return visitasPorDia.map((d, i) => {
      const alto = maxVisitasDia > 0 ? Math.max(d.valor > 0 ? 4 : 2, (d.valor / maxVisitasDia) * (base - padTop)) : 2
      const x = gap + i * (barW + gap)
      return { ...d, x, w: barW, h: alto, y: base - alto, cx: x + barW / 2 }
    })
  }, [visitasPorDia, maxVisitasDia, anchoGraficoVisitas])
  const leadsConvertidos = useMemo(() => leads.filter((l) => l.estado === "convertido").length, [leads])
  const tasaConversion = leads.length ? Math.round((leadsConvertidos / leads.length) * 100) : 0
  const tarjetasFunnel = [
    { key: "visitas", label: "Visitas (últimos 90 días)", valor: visitasVenta.length, icon: BarChart3, bg: "#F3E8FF", fg: "#7C3AED" },
    { key: "leads", label: "Leads recibidos", valor: leads.length, icon: Inbox, bg: "#E8F0FF", fg: "#2563EB" },
    { key: "conversion", label: "Convertidos a cliente", valor: `${leadsConvertidos} (${tasaConversion}%)`, icon: CheckCircle2, bg: "#E7F7EF", fg: "#059669" },
  ]

  const barrasActividad = useMemo(() => {
    const w = 880, base = 108, padTop = 10
    const n = actividadPorDia.length || 1
    const gap = 16
    const barW = (w - gap * (n + 1)) / n
    return actividadPorDia.map((d, i) => {
      const alto = maxActividadDia > 0 ? Math.max(d.valor > 0 ? 6 : 2, (d.valor / maxActividadDia) * (base - padTop)) : 2
      const x = gap + i * (barW + gap)
      return { ...d, x, w: barW, h: alto, y: base - alto, cx: x + barW / 2 }
    })
  }, [actividadPorDia, maxActividadDia])

  // Auditoría agrupada por día (mismo patrón que Citas.jsx: rail por fecha,
  // colapsable por día — sobre todo para poder ocultar "hoy" y no tener que
  // scrollear tanto para llegar a días anteriores). El Map preserva el orden
  // de inserción, y auditoria ya viene ordenada desc por created_at.
  const auditoriaAgrupada = useMemo(() => {
    const visibles = auditoria.filter((a) => {
      if (filtroFechaActividad && claveDiaLocal(a.created_at) !== filtroFechaActividad) return false
      if (filtroActorActividad && a.actor_id !== filtroActorActividad.id) return false
      return true
    })
    const mapa = new Map()
    for (const a of visibles) {
      const clave = claveDiaLocal(a.created_at)
      if (!mapa.has(clave)) mapa.set(clave, [])
      mapa.get(clave).push(a)
    }
    return Array.from(mapa.entries())
  }, [auditoria, filtroFechaActividad, filtroActorActividad])

  const anilloR = 54
  const anilloCircunferencia = 2 * Math.PI * anilloR
  const anilloProgreso = (pctActivas / 100) * anilloCircunferencia

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

  const abrirCrear = () => {
    setCampos(camposOpticaIniciales)
    setSlugTocado(false)
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

  const actualizarCampo = (clave, valor) => {
    setCampos((prev) => {
      const siguiente = { ...prev, [clave]: valor }
      if (clave === "nombreOptica" && !slugTocado) siguiente.slug = generarSlug(valor)
      return siguiente
    })
  }

  const guardar = async (e) => {
    e.preventDefault()
    setError("")
    const { nombreOptica, slug, eslogan, colorAcento, logoUrl, nombreAdmin, emailAdmin, fechaNacimientoAdmin, clave, confirmarClave } = campos
    if (!nombreOptica.trim() || !slug.trim() || !clave) {
      setError("Completa todos los campos.")
      return
    }
    if (!esNombreValido(nombreAdmin)) { setError("Ingresa un nombre válido para el administrador (solo letras)."); return }
    if (!esEmailValido(emailAdmin, false)) { setError("Ingresa un correo válido para el administrador (ej. nombre@dominio.com)."); return }
    if (clave.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.")
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
        setError("Ese slug ya está en uso por otra óptica.")
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
        setError(errorOptica.message.includes("duplicate") ? "Ese slug ya está en uso por otra óptica." : errorOptica.message)
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
      setError((errorAlta?.message || "No se pudo crear la cuenta del administrador") + " — la óptica ya quedó creada, podés reintentar la cuenta de admin más tarde.")
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
      .insert({ id: alta.user.id, optica_id: nuevaOptica.id, rol: "admin", nombre: nombreAdmin.trim(), email: emailAdmin.trim(), fecha_nacimiento: fechaNacimientoAdmin || null })

    await temp.auth.signOut()

    if (errorPerfil) {
      setError(errorPerfil.message + " — la óptica y la cuenta de correo ya quedaron creadas, revisá en Supabase.")
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
    await cargarDatos()
    // Feedback de Diego: al crear una óptica, de una vez ofrecer editar cómo
    // se ve su login (logo, marca, servicios) en vez de dejarlo para que lo
    // busque después entre la lista de ópticas.
    setSeccion("opticas")
    abrirDetalleOptica(nuevaOptica)
  }

  const alternarActiva = async (optica) => {
    setProcesandoId(optica.id)
    const { error: errorUpdate } = await supabase.from("opticas").update({ activa: !optica.activa }).eq("id", optica.id)
    if (!errorUpdate) {
      setOpticas((prev) => prev.map((o) => (o.id === optica.id ? { ...o, activa: !o.activa } : o)))
      setDetalle((prev) => (prev && prev.id === optica.id ? { ...prev, activa: !prev.activa } : prev))
      await registrarAuditoria(optica.activa ? "suspender_optica" : "reactivar_optica", { opticaId: optica.id, opticaNombre: optica.nombre })
      cargarAuditoria(true)
    }
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
    // propósito, para poder personalizarlo distinto. Pero si nunca se
    // personalizó (sigue igual al nombre anterior), renombrar la óptica acá
    // debe arrastrarlo también: si no, el nombre nuevo nunca se ve reflejado
    // en la página pública (quedaba pegado al nombre viejo/al de creación
    // para siempre) — justo lo que reportó Diego.
    const marcaSinPersonalizar = (detalle.marca?.nombreMarca || "") === detalle.nombre
    const marcaActualizada = marcaSinPersonalizar ? { ...(detalle.marca || {}), nombreMarca: nuevo } : detalle.marca
    const cambios = marcaSinPersonalizar ? { nombre: nuevo, marca: marcaActualizada } : { nombre: nuevo }
    const { error: errorUpdate } = await supabase.from("opticas").update(cambios).eq("id", detalle.id)
    if (!errorUpdate) {
      const anterior = detalle.nombre
      setOpticas((prev) => prev.map((o) => (o.id === detalle.id ? { ...o, ...cambios } : o)))
      setDetalle((prev) => ({ ...prev, ...cambios }))
      if (marcaSinPersonalizar) setCampoMarca((p) => ({ ...p, nombreMarca: nuevo }))
      await registrarAuditoria("renombrar_optica", { opticaId: detalle.id, opticaNombre: nuevo, detalle: anterior })
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
        cuerpo: `El pago de tu suscripción ${textoEstado}. Si ya lo hiciste, escribinos desde acá para confirmarlo.`,
        estado: "resuelto",
      })
      await registrarAuditoria("actualizar_pago", { opticaId: o.id, opticaNombre: o.nombre, detalle: `${nuevoEstado} (automático)` })
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
          cuerpo: `El pago de tu suscripción ${textoEstado}. Si ya lo hiciste, escribinos desde acá para confirmarlo.`,
          estado: "resuelto",
        })
        cargarMensajes()
      }
      await registrarAuditoria("actualizar_pago", { opticaId: detalle.id, opticaNombre: detalle.nombre, detalle: nuevoEstado })
      cargarAuditoria(true)
    }
    setActualizandoPago(false)
  }

  const guardarSuscripcion = async () => {
    if (!detalle) return
    setGuardandoSuscripcion(true)
    const cambios = { monto_mensual: campoMonto ? Number(campoMonto) : null, proximo_vencimiento: campoVencimiento || null }
    const { error } = await supabase.from("opticas").update(cambios).eq("id", detalle.id)
    if (!error) {
      setOpticas((prev) => prev.map((o) => (o.id === detalle.id ? { ...o, ...cambios } : o)))
      setDetalle((prev) => ({ ...prev, ...cambios }))
    }
    setGuardandoSuscripcion(false)
  }

  const registrarPago = async () => {
    if (!detalle) return
    setActualizandoPago(true)
    const hoy = new Date()
    const siguienteVencimiento = new Date(hoy.getFullYear(), hoy.getMonth() + 1, hoy.getDate()).toISOString().slice(0, 10)
    const cambios = { estado_pago: "al_dia", proximo_vencimiento: siguienteVencimiento }
    const { error } = await supabase.from("opticas").update(cambios).eq("id", detalle.id)
    if (!error) {
      setOpticas((prev) => prev.map((o) => (o.id === detalle.id ? { ...o, ...cambios } : o)))
      setDetalle((prev) => ({ ...prev, ...cambios }))
      setCampoVencimiento(siguienteVencimiento)
      await registrarAuditoria("actualizar_pago", { opticaId: detalle.id, opticaNombre: detalle.nombre, detalle: "al_dia" })
      cargarAuditoria(true)
    }
    setActualizandoPago(false)
  }

  const generarFactura = async () => {
    if (!detalle) return
    setGenerandoFactura(true)
    const hoy = new Date()
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
      cargarAuditoria(true)
    }
    setGenerandoFactura(false)
  }

  const alternarEstadoFactura = async (factura) => {
    const nuevoEstado = factura.estado === "pagada" ? "pendiente" : "pagada"
    const cambios = { estado: nuevoEstado, pagada_at: nuevoEstado === "pagada" ? new Date().toISOString() : null }
    const { error } = await supabase.from("facturas").update(cambios).eq("id", factura.id)
    if (!error) setFacturasOptica((prev) => prev.map((f) => (f.id === factura.id ? { ...f, ...cambios } : f)))
  }

  const guardarCumpleanos = async (adminId, fecha) => {
    setGuardandoCumple(adminId)
    const { error } = await supabase.from("perfiles").update({ fecha_nacimiento: fecha || null }).eq("id", adminId)
    if (!error) setAdmins((prev) => prev.map((a) => (a.id === adminId ? { ...a, fecha_nacimiento: fecha || null } : a)))
    setGuardandoCumple(null)
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
    const { nombre, email, clave, confirmarClave } = camposAdminExtra
    if (!esNombreValido(nombre)) { setErrorAdminExtra("Ingresa un nombre válido (solo letras)."); return }
    if (!esEmailValido(email, false)) { setErrorAdminExtra("Ingresa un correo válido (ej. nombre@dominio.com)."); return }
    if (!clave) { setErrorAdminExtra("Completa la contraseña."); return }
    if (clave.length < 6) { setErrorAdminExtra("La contraseña debe tener al menos 6 caracteres."); return }
    if (clave !== confirmarClave) { setErrorAdminExtra("Las contraseñas no coinciden."); return }
    setGuardandoAdminExtra(true)
    const temp = crearClienteTemporal()
    const { data: alta, error: errorAlta } = await temp.auth.signUp({ email: email.trim(), password: clave })
    if (errorAlta || !alta?.user) {
      setErrorAdminExtra(errorAlta?.message || "No se pudo crear la cuenta.")
      setGuardandoAdminExtra(false)
      return
    }
    // Ciberseguridad: insert con la sesión del superadmin (supabase), no con
    // la del usuario recién creado — ver nota igual en crearOptica más
    // arriba.
    const { error: errorPerfil } = await supabase.from("perfiles").insert({ id: alta.user.id, optica_id: detalle.id, rol: "admin", nombre: nombre.trim(), email: email.trim() })
    await temp.auth.signOut()
    if (errorPerfil) {
      setErrorAdminExtra(errorPerfil.message + " — la cuenta de correo ya quedó creada, revisá en Supabase.")
      setGuardandoAdminExtra(false)
      return
    }
    await registrarAuditoria("agregar_administrador", { opticaId: detalle.id, opticaNombre: detalle.nombre, detalle: nombre.trim() })
    setGuardandoAdminExtra(false)
    setAgregarAdminAbierto(false)
    cargarDatos()
  }
  const confirmarEliminarAdmin = async () => {
    if (!adminAEliminar) return
    setEliminandoAdmin(true)
    const { error: errorDelete } = await supabase.from("perfiles").delete().eq("id", adminAEliminar.id)
    if (!errorDelete) {
      await registrarAuditoria("eliminar_administrador", { opticaId: detalle.id, opticaNombre: detalle.nombre, detalle: adminAEliminar.nombre })
      setAdmins((prev) => prev.filter((a) => a.id !== adminAEliminar.id))
      cargarAuditoria(true)
      setAdminAEliminar(null)
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
    if (clave.length < 6) { setErrorSuperadmin("La contraseña debe tener al menos 6 caracteres."); return }
    if (clave !== confirmarClave) { setErrorSuperadmin("Las contraseñas no coinciden."); return }
    setGuardandoSuperadmin(true)
    const temp = crearClienteTemporal()
    const { data: alta, error: errorAlta } = await temp.auth.signUp({ email: email.trim(), password: clave })
    await temp.auth.signOut()
    if (errorAlta || !alta?.user) {
      setErrorSuperadmin(errorAlta?.message || "No se pudo crear la cuenta.")
      setGuardandoSuperadmin(false)
      return
    }
    // El self-insert de perfiles solo permite rol='admin' (RLS, ver
    // migración 0001) — para rol='superadmin' hay que insertar con la
    // sesión del superadmin actual, que sí tiene permiso "for all" sobre
    // perfiles vía la policy perfiles_superadmin_all/es_superadmin().
    const { error: errorPerfil } = await supabase.from("perfiles").insert({ id: alta.user.id, rol: "superadmin", nombre: nombre.trim(), email: email.trim() })
    if (errorPerfil) {
      setErrorSuperadmin(errorPerfil.message + " — la cuenta de correo ya quedó creada, revisá en Supabase.")
      setGuardandoSuperadmin(false)
      return
    }
    await registrarAuditoria("crear_superadmin", { opticaNombre: nombre.trim() })
    setGuardandoSuperadmin(false)
    setModalSuperadminAbierto(false)
    cargarDatos()
  }
  const confirmarEliminarSuperadmin = async () => {
    if (!superadminAEliminar) return
    setEliminandoSuperadmin(true)
    const { error: errorDelete } = await supabase.from("perfiles").delete().eq("id", superadminAEliminar.id)
    if (!errorDelete) {
      await registrarAuditoria("eliminar_superadmin", { opticaNombre: superadminAEliminar.nombre })
      setSuperadmins((prev) => prev.filter((s) => s.id !== superadminAEliminar.id))
      cargarAuditoria(true)
      setSuperadminAEliminar(null)
    }
    setEliminandoSuperadmin(false)
  }

  // ─── Secciones ───

  const hoyFechaBruta = new Date().toLocaleDateString("es-EC", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
  const hoyFechaResumen = hoyFechaBruta.charAt(0).toUpperCase() + hoyFechaBruta.slice(1)

  // Solo se muestra en la primerísima carga (cargaInicial) — evita el "flash"
  // de tarjetas en 0 y gráficos vacíos antes de que responda Supabase, sin
  // tapar el panel de nuevo en cada refetch posterior a una acción.
  const Skeleton = ({ className }) => <div className={"animate-pulse rounded-2xl bg-slate-200/70 " + className} />

  const renderResumenSkeleton = () => (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: INK }}>Resumen</h1>
          <p className="text-sm text-slate-400">Cargando panel…</p>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Skeleton className="h-[104px]" /><Skeleton className="h-[104px]" /><Skeleton className="h-[104px]" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Skeleton className="h-[220px] lg:col-span-3" />
        <Skeleton className="h-[220px] lg:col-span-2" />
      </div>
      <Skeleton className="h-[180px]" />
      <Skeleton className="h-[260px]" />
    </div>
  )

  const renderResumen = () => cargaInicial ? renderResumenSkeleton() : (
    <div className="space-y-5" style={{ animation: "rise-in 320ms ease-out both" }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: INK }}>Resumen</h1>
          <p className="text-sm text-slate-500">
            {hoyFechaResumen} · {opticas.length} óptica{opticas.length === 1 ? "" : "s"} bajo gestión
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={abrirCrear}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 cursor-pointer"
            style={{ background: GRAD, boxShadow: "0 12px 24px -12px rgba(37,99,235,0.55)" }}
          >
            <Plus size={16} /> Crear óptica
          </button>
          <button
            type="button"
            onClick={abrirCrearSuperadmin}
            className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-slate-400 hover:shadow-md cursor-pointer"
          >
            <ShieldCheck size={16} className="text-violet-600" /> Agregar superadmin
          </button>
        </div>
      </div>

      {/* ─── Stat cards ─── */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {tarjetas.map((t, i) => {
          const Icono = t.icon
          let delta = null
          if (t.key === "Todas") delta = { texto: creadasEsteMes > 0 ? `+${creadasEsteMes} este mes` : "sin nuevas este mes", tono: creadasEsteMes > 0 ? "#059669" : "#94A3B8" }
          else if (t.key === "Activas") delta = { texto: `${pctActivas}% del total`, tono: "#059669" }
          else delta = { texto: totalSuspendidas > 0 ? "revisar" : "ninguna", tono: totalSuspendidas > 0 ? "#E11D48" : "#94A3B8" }
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => irAOpticasConFiltro(t.key)}
              style={{ animation: `rise-in 320ms ease-out both`, animationDelay: `${i * 40}ms` }}
              className={CARD + " group relative overflow-hidden p-4 text-left transition-all hover:-translate-y-0.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-400">{t.label}</p>
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-transform group-hover:scale-105" style={{ background: t.bg, color: t.fg }}>
                  <Icono size={15} />
                </div>
              </div>
              <p className="mt-2 text-[28px] font-extrabold leading-none tracking-tight" style={{ color: INK }}>{t.valor}</p>
              <p className="mt-2 text-[11.5px] font-semibold" style={{ color: delta.tono }}>{delta.texto}</p>
            </button>
          )
        })}
      </div>

      {/* ─── Usuarios del sistema (feedback del ing: admins/asistentes/pacientes, total y por óptica) ─── */}
      <div>
        <p className="mb-2 text-[11.5px] font-bold uppercase tracking-wide text-slate-400">Usuarios del sistema</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { label: "Administradores", valor: totalesUsuarios.admins, icon: ShieldCheck, bg: "#E8F0FF", fg: "#2563EB" },
            { label: "Asistentes", valor: totalesUsuarios.asistentes, icon: Users, bg: "#F3E8FF", fg: "#7C3AED" },
            { label: "Pacientes", valor: totalesUsuarios.pacientes, icon: Stethoscope, bg: "#E7F7EF", fg: "#059669" },
          ].map((t, i) => (
            <div key={t.label} className={CARD + " p-4"} style={{ animation: `rise-in 320ms ease-out both`, animationDelay: `${(i + 3) * 40}ms` }}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-400">{t.label}</p>
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: t.bg, color: t.fg }}>
                  <t.icon size={15} />
                </div>
              </div>
              <p className="mt-2 text-[28px] font-extrabold leading-none tracking-tight" style={{ color: INK }}>{t.valor}</p>
              <p className="mt-2 text-[11.5px] font-semibold text-slate-400">en {opticas.length} óptica{opticas.length === 1 ? "" : "s"}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Funnel comercial: página de venta → leads → clientes ─── */}
      <div>
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">Página de venta</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {tarjetasFunnel.map((t, i) => {
            const Icono = t.icon
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => t.key === "leads" && setSeccion("leads")}
                style={{ animation: `rise-in 320ms ease-out both`, animationDelay: `${i * 40}ms` }}
                className={CARD + " group relative overflow-hidden p-4 text-left transition-all " + (t.key === "leads" ? "hover:-translate-y-0.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50" : "cursor-default")}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[11.5px] font-semibold uppercase tracking-wide text-slate-400">{t.label}</p>
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-transform group-hover:scale-105" style={{ background: t.bg, color: t.fg }}>
                    <Icono size={15} />
                  </div>
                </div>
                <p className="mt-2 text-[28px] font-extrabold leading-none tracking-tight" style={{ color: INK }}>{t.valor}</p>
              </button>
            )
          })}
        </div>
      </div>

      <div className={CARD_PAD}>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-[13.5px] font-bold" style={{ color: INK }}>Visitas a la página de venta</h3>
          <span className="text-[11px] font-semibold text-slate-400">Últimos 14 días</span>
        </div>
        {visitasVenta.length === 0 ? (
          <p className="py-14 text-center text-sm text-slate-400">Aún no hay visitas registradas.</p>
        ) : (
          <div ref={refGraficoVisitas} className="relative mt-3">
            <svg viewBox={`0 0 ${anchoGraficoVisitas} 98`} className="w-full" style={{ height: 98 }} preserveAspectRatio="none">
              <defs>
                <linearGradient id="barraVisitas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#A78BFA" />
                  <stop offset="100%" stopColor="#7C3AED" />
                </linearGradient>
              </defs>
              {barrasVisitas.map((b, i) => {
                const clicable = b.valor > 0
                return (
                  <g
                    key={i}
                    className={clicable ? "cursor-pointer group/barravisita" : "group/barravisita"}
                    onMouseEnter={() => clicable && setHoverVisitaIdx(i)}
                    onMouseLeave={() => setHoverVisitaIdx(null)}
                  >
                    <rect x={b.x} y="2" width={b.w} height="80" fill="transparent" />
                    <rect
                      x={b.x} y={b.y} width={b.w} height={b.h} rx="4"
                      fill="url(#barraVisitas)"
                      className={"transition-transform duration-150 " + (clicable ? "group-hover/barravisita:brightness-110" : "opacity-30")}
                      style={{ transformBox: "fill-box", transformOrigin: "bottom", transform: hoverVisitaIdx === i ? "scaleY(1.06)" : "scaleY(1)" }}
                    />
                    <text x={b.cx} y="94" textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#94A3B8" style={{ textTransform: "uppercase" }}>{b.etiqueta}</text>
                  </g>
                )
              })}
            </svg>
            {hoverVisitaIdx !== null && (
              <div
                className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg"
                style={{ left: `${(barrasVisitas[hoverVisitaIdx].cx / anchoGraficoVisitas) * 100}%`, top: barrasVisitas[hoverVisitaIdx].y - 8, background: INK }}
              >
                {visitasPorDia[hoverVisitaIdx].valor} visita{visitasPorDia[hoverVisitaIdx].valor === 1 ? "" : "s"}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ─── Bento: ópticas creadas por mes + estado del sistema ─── */}
      {/* items-start: cada tarjeta se ajusta a su propio contenido en vez de
          estirarse a la altura de la más alta — "Estado del sistema" tiene
          bastante más contenido (donut + tiles + aviso) que un gráfico
          simple, y estirar el gráfico para igualar esa altura dejaba un
          hueco vacío abajo en vez de una tarjeta más compacta. */}
      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-5">
        <div className={CARD_PAD + " lg:col-span-3"}>
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-[13.5px] font-bold" style={{ color: INK }}>Ópticas creadas por mes</h3>
            <span className="text-[11px] font-semibold text-slate-400">Últimos 6 meses</span>
          </div>
          {opticas.length === 0 ? (
            <p className="py-14 text-center text-sm text-slate-400">Aún no hay ópticas registradas.</p>
          ) : (
            <div ref={refGraficoOpticas} className="relative mt-3">
              <svg viewBox={`0 0 ${anchoGraficoOpticas} 110`} className="w-full" style={{ height: 110 }} preserveAspectRatio="none">
                <defs>
                  <linearGradient id="areaOpticas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563EB" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={curvaOpticas.area} fill="url(#areaOpticas)" />
                <path d={curvaOpticas.linea} fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                {curvaOpticas.puntos.map((p, i) => (
                  <g key={i} className="cursor-pointer" onMouseEnter={() => setHoverMesIdx(i)} onMouseLeave={() => setHoverMesIdx(null)}>
                    <circle cx={p[0]} cy={p[1]} r="11" fill="transparent" />
                    <circle
                      cx={p[0]} cy={p[1]} r="3" fill="#fff" stroke="#2563EB" strokeWidth="2"
                      className={"transition-transform duration-150 " + (hoverMesIdx === i ? "scale-[1.6]" : "scale-100")}
                      style={{ transformBox: "fill-box", transformOrigin: "center" }}
                    />
                    <text x={p[0]} y={p[1] - 8} textAnchor="middle" fontSize="9.5" fontWeight="700" fill="#334155">{opticasPorMes[i].valor}</text>
                    <text x={p[0]} y="104" textAnchor="middle" fontSize="9.5" fontWeight="600" fill="#94A3B8" style={{ textTransform: "uppercase" }}>{opticasPorMes[i].etiqueta}</text>
                  </g>
                ))}
              </svg>
              {hoverMesIdx !== null && (
                <div
                  className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg"
                  style={{ left: `${(curvaOpticas.puntos[hoverMesIdx][0] / anchoGraficoOpticas) * 100}%`, top: curvaOpticas.puntos[hoverMesIdx][1] - 14, background: INK }}
                >
                  {opticasPorMes[hoverMesIdx].valor} óptica{opticasPorMes[hoverMesIdx].valor === 1 ? "" : "s"} creada{opticasPorMes[hoverMesIdx].valor === 1 ? "" : "s"}
                </div>
              )}
            </div>
          )}
        </div>

        <div className={CARD_PAD + " lg:col-span-2 flex flex-col"}>
          <h3 className="mb-3 text-[13.5px] font-bold" style={{ color: INK }}>Estado del sistema</h3>
          <div className="flex items-center justify-center gap-5">
            <svg
              width="128" height="128" viewBox="0 0 128 128"
              className="shrink-0 cursor-pointer transition-transform duration-200 hover:scale-110"
            >
              <title>{`${pctActivas}% de las ópticas están activas`}</title>
              <circle cx="64" cy="64" r={anilloR} fill="none" stroke="#FEE2E2" strokeWidth="14" />
              <circle
                cx="64" cy="64" r={anilloR} fill="none" stroke="#10B981" strokeWidth="14" strokeLinecap="round"
                strokeDasharray={`${anilloProgreso} ${anilloCircunferencia}`}
                transform="rotate(-90 64 64)"
                style={{ transition: "stroke-dasharray 500ms ease-out" }}
              />
              <text x="64" y="60" textAnchor="middle" fontSize="22" fontWeight="800" fill={INK}>{pctActivas}%</text>
              <text x="64" y="76" textAnchor="middle" fontSize="10" fontWeight="600" fill="#94A3B8">activas</text>
            </svg>
            <div className="flex flex-col gap-2 text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-slate-600"><span className="h-2 w-2 rounded-full bg-emerald-500" /> {totalActivas} activas</span>
              <span className="flex items-center gap-1.5 font-semibold text-slate-600"><span className="h-2 w-2 rounded-full bg-rose-200" /> {totalSuspendidas} suspendidas</span>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-4">
            <div className="rounded-xl border border-slate-100 p-2.5 text-center">
              <p className="text-lg font-extrabold" style={{ color: INK }}>{admins.length}</p>
              <p className="text-[10.5px] font-medium text-slate-400">administradores</p>
            </div>
            <div className="rounded-xl border border-slate-100 p-2.5 text-center">
              <p className="text-lg font-extrabold" style={{ color: INK }}>{superadmins.length}</p>
              <p className="text-[10.5px] font-medium text-slate-400">superadmins</p>
            </div>
          </div>
          {/* Solo ocupa espacio si realmente hay algo que atender — Diego: la
              mayoría de las ópticas siempre van a tener admin (se crean juntos),
              así que un aviso permanente todo-en-verde no aportaba nada. */}
          {opticasSinAdmin.length > 0 && (
            <button
              type="button"
              onClick={() => irAOpticasConFiltro("Todas")}
              className="mt-3 flex w-full items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-left text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 cursor-pointer"
            >
              <AlertTriangle size={13} className="shrink-0" />
              {opticasSinAdmin.length} óptica{opticasSinAdmin.length === 1 ? "" : "s"} sin administrador
              <ChevronRight size={13} className="ml-auto shrink-0" />
            </button>
          )}
        </div>
      </div>

      {/* ─── Actividad por día — barras interactivas: hover para resaltar,
          clic para saltar a Actividad filtrada a ese día ─── */}
      <div className={CARD_PAD}>
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-[13.5px] font-bold" style={{ color: INK }}>Actividad por día</h3>
          <span className="text-[11px] font-semibold text-slate-400">Últimos 7 días · clic en una barra para ver el detalle</span>
        </div>
        {auditoria.length === 0 ? (
          <p className="py-14 text-center text-sm text-slate-400">Sin actividad registrada.</p>
        ) : (
          <div className="relative mt-3">
            <svg viewBox="0 0 880 130" className="w-full" style={{ height: 130 }} preserveAspectRatio="none">
              <defs>
                <linearGradient id="barraViol" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#A78BFA" />
                  <stop offset="100%" stopColor="#7C3AED" />
                </linearGradient>
              </defs>
              {barrasActividad.map((b) => {
                const clicable = b.valor > 0
                return (
                  <g
                    key={b.clave}
                    className={clicable ? "cursor-pointer group/barra" : "group/barra"}
                    onMouseEnter={() => clicable && setHoverBarClave(b.clave)}
                    onMouseLeave={() => setHoverBarClave(null)}
                    onClick={() => {
                      if (!clicable) return
                      setFiltroFechaActividad(b.clave)
                      setFiltroActorActividad(null)
                      setDiasActividadColapsados((prev) => { const s = new Set(prev); s.delete(b.clave); return s })
                      setSeccion("actividad")
                    }}
                  >
                    <rect x={b.x} y="4" width={b.w} height="104" fill="transparent" />
                    <rect
                      x={b.x} y={b.y} width={b.w} height={b.h} rx="5"
                      fill="url(#barraViol)"
                      className={"transition-transform duration-150 " + (clicable ? "group-hover/barra:brightness-110" : "opacity-40")}
                      style={{ transformBox: "fill-box", transformOrigin: "bottom", transform: hoverBarClave === b.clave ? "scaleY(1.08)" : "scaleY(1)" }}
                    />
                    <text x={b.cx} y="122" textAnchor="middle" fontSize="11" fontWeight="700" fill="#94A3B8" className={clicable ? "transition-colors group-hover/barra:fill-violet-600" : ""}>{b.etiqueta}</text>
                  </g>
                )
              })}
            </svg>
            {hoverBarClave && (() => {
              const b = barrasActividad.find((x) => x.clave === hoverBarClave)
              if (!b) return null
              return (
                <div
                  className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white shadow-lg"
                  style={{ left: `${(b.cx / 880) * 100}%`, top: b.y - 8, background: INK }}
                >
                  {b.valor} acción{b.valor === 1 ? "" : "es"} · clic para ver el detalle
                </div>
              )
            })()}
          </div>
        )}
      </div>

      {/* ─── Actividad reciente ─── */}
      <div className={CARD_PAD}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History size={16} className="text-slate-400" />
            <h3 className="text-[13.5px] font-bold" style={{ color: INK }}>Actividad reciente</h3>
          </div>
          <button type="button" onClick={() => setSeccion("actividad")} className="flex items-center gap-1 text-[11.5px] font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">
            Ver toda la actividad <ChevronRight size={13} />
          </button>
        </div>
        {auditoria.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Todavía no hay acciones registradas.</p>
        ) : (
          <ul className="space-y-3">
            {auditoria.slice(0, 5).map((a) => <ItemAuditoria key={a.id} a={a} />)}
          </ul>
        )}
      </div>
    </div>
  )

  const MENSAJES_FILTROS = [
    { key: "todas", label: "Todas" },
    { key: "consulta", label: "Consultas" },
    { key: "anuncio", label: "Avisos" },
    { key: "pago", label: "Pagos" },
    { key: "cumpleanos", label: "Cumpleaños" },
  ]

  const renderMensajes = () => (
    <div className="space-y-5" style={{ animation: "rise-in 320ms ease-out both" }}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3.5">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white" style={{ background: GRAD, boxShadow: "0 12px 24px -10px rgba(37,99,235,0.6)" }}>
            <MessageSquare size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight" style={{ color: INK }}>CRM</h1>
            <p className="text-sm text-slate-500">Relación con tus administradores de óptica: mensajes, pagos y avisos.</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setErrorAviso(""); setAvisoAsunto(""); setAvisoCuerpo(""); setAvisoDestino("todos"); setModalAvisoAbierto(true) }}
          className="flex shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2"
          style={{ background: GRAD, boxShadow: "0 14px 28px -12px rgba(37,99,235,0.6)" }}
        >
          <Megaphone size={18} />
          Nuevo aviso
        </button>
      </div>

      {/* ─── Panel de control: cada tarjeta es real y clickeable, mismo lenguaje visual que CRM.jsx (Dashboard) ─── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => setMensajesFiltro(mensajesFiltro === "consulta" ? "todas" : "consulta")}
          className="flex items-center justify-between rounded-2xl border bg-white p-5 text-left transition-all hover:-translate-y-0.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
          style={{
            borderColor: mensajesFiltro === "consulta" ? "#2563EB" : "rgba(14,43,51,0.08)",
            boxShadow: mensajesFiltro === "consulta" ? "0 0 0 3px rgba(37,99,235,0.14)" : "0 1px 2px rgba(14,43,51,0.04)",
          }}
        >
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Consultas abiertas</p>
            <p className="mt-1 text-3xl font-black leading-none" style={{ color: INK }}>{consultasAbiertas}</p>
            <p className="mt-1.5 text-[11px] font-semibold" style={{ color: consultasAbiertas > 0 ? "#B45309" : "#94A3B8" }}>{consultasAbiertas > 0 ? "esperando tu respuesta" : "todo al día"}</p>
          </div>
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ background: "#E8F0FF", color: "#2563EB" }}>
            <MessageSquare size={22} />
          </div>
        </button>

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
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Pago pendiente/vencido</p>
            <p className="mt-1 text-3xl font-black leading-none" style={{ color: INK }}>{opticasConPagoProblema.length}</p>
            <p className="mt-1.5 text-[11px] font-semibold" style={{ color: opticasConPagoProblema.length > 0 ? "#B45309" : "#94A3B8" }}>{opticasConPagoProblema.length > 0 ? "revisar suscripciones" : "ninguna"}</p>
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
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Cumpleaños próximos</p>
            <p className="mt-1 text-3xl font-black leading-none" style={{ color: INK }}>{cumpleanosProximos.length}</p>
            <p className="mt-1.5 text-[11px] font-semibold" style={{ color: cumpleanosProximos.length > 0 ? "#7C3AED" : "#94A3B8" }}>{cumpleanosProximos.length > 0 ? "en los próximos días" : "ninguno"}</p>
          </div>
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ background: "#F1EAFE", color: "#7C3AED" }}>
            <Cake size={22} />
          </div>
        </button>
      </div>

      {/* ─── Bandeja ─── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 p-4">
          <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1 shadow-inner">
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
                        className="rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider"
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
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider" style={{ backgroundColor: "#f1eafe", color: "#7c3aed", border: "1px solid #ddd6fe" }}>
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
                  onClick={() => { setMensajeAbierto(m); setRespuestaTexto(m.respuesta || "") }}
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
                          className="rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider"
                          style={m.optica_id ? { backgroundColor: "#eff6ff", color: "#1d4ed8", border: "1px solid #dbeafe" } : { backgroundColor: "#fef3c7", color: "#92600f", border: "1px solid #fde68a" }}
                        >
                          {m.optica_id ? "Puntual" : "General"}
                        </span>
                      ) : (
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider"
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

  const renderOpticas = () => (
    <div className="space-y-4" style={{ animation: "rise-in 320ms ease-out both" }}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: INK }}>Ópticas</h1>
          <p className="text-sm text-slate-500">Creá y administrá las ópticas que usan el sistema.</p>
        </div>
        <button
          type="button"
          onClick={abrirCrear}
          className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2"
          style={{ background: GRAD, boxShadow: "0 14px 28px -12px rgba(37,99,235,0.6)" }}
        >
          <Plus size={18} />
          Crear óptica
        </button>
      </div>

      <div className={CARD + " p-4"}>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              placeholder="Nombre de la óptica, slug o administrador..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-9 text-sm text-slate-800 outline-none transition-colors focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda("")}
                title="Limpiar búsqueda"
                aria-label="Limpiar búsqueda"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1 shadow-inner">
            {tarjetas.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setFiltroEstado(t.key)}
                className={"flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 " + (filtroEstado === t.key ? "bg-white shadow-sm" : "text-slate-500 hover:text-slate-700")}
                style={filtroEstado === t.key ? { color: INK } : undefined}
              >
                {t.label} <span className={filtroEstado === t.key ? "font-extrabold" : "opacity-60"} style={filtroEstado === t.key ? { color: t.fg } : undefined}>{t.valor}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={CARD + " overflow-hidden"}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3.5">Óptica</th>
                <th className="px-5 py-3.5">Administrador</th>
                <th className="px-5 py-3.5">Estado</th>
                <th className="px-5 py-3.5">Creada</th>
                <th className="px-5 py-3.5 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cargando ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-sm text-slate-500">Cargando ópticas…</td>
                </tr>
              ) : opticasFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <div className="mx-auto max-w-xs space-y-3">
                      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-slate-100 text-slate-300">
                        <Building2 size={28} />
                      </div>
                      <p className="text-sm font-semibold text-slate-500">
                        {opticas.length === 0 ? "Aún no hay ópticas registradas." : "Ninguna óptica coincide con la búsqueda."}
                      </p>
                      {opticas.length === 0 && (
                        <button type="button" onClick={abrirCrear} className="text-sm font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">
                          Crear la primera
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                opticasFiltradas.map((o) => {
                  const listaAdmins = adminsPorOptica.get(o.id) || []
                  const procesando = procesandoId === o.id
                  return (
                    <tr key={o.id} className="group cursor-pointer transition-colors hover:bg-slate-50/70" onClick={() => abrirDetalleOptica(o)}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-sm font-bold text-white" style={{ background: GRAD }}>
                            {o.nombre.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-800 transition-colors group-hover:text-blue-600">{o.nombre}</p>
                            <p className="truncate font-mono text-xs text-slate-400">{o.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {listaAdmins.length === 0 ? (
                          <span className="flex items-center gap-1.5 text-xs font-medium text-amber-600">
                            <AlertTriangle size={13} /> Sin administrador
                          </span>
                        ) : (
                          <div className="space-y-0.5">
                            <p className="font-medium text-slate-700">{listaAdmins[0].nombre}</p>
                            <div className="flex items-center gap-1.5 text-xs text-slate-400">
                              <Mail size={12} />
                              <span className="max-w-[180px] truncate">{listaAdmins[0].email || "—"}</span>
                            </div>
                            {listaAdmins.length > 1 && <p className="text-[11px] text-slate-400">+{listaAdmins.length - 1} más</p>}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold " + (o.activa ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
                          <span className={"h-1.5 w-1.5 rounded-full " + (o.activa ? "bg-emerald-500" : "bg-rose-500")} />
                          {o.activa ? "Activa" : "Suspendida"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={13} className="text-slate-400" />
                          <span>{formatearFecha(o.created_at)}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button type="button" onClick={() => abrirDetalleOptica(o)} title="Ver detalle" aria-label={`Ver detalle de ${o.nombre}`} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50">
                            <Eye size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => abrirMenuAcciones(o.id, e)}
                            title="Más acciones"
                            aria-label={`Más acciones para ${o.nombre}`}
                            disabled={procesando}
                            className={"rounded-lg p-2 transition-colors cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 " + (menuAccionesId === o.id ? "bg-slate-100 text-slate-700" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700")}
                          >
                            <MoreVertical size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )

  const renderActividad = () => (
    <div className="space-y-4" style={{ animation: "rise-in 320ms ease-out both" }}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: INK }}>Actividad</h1>
        <p className="text-sm text-slate-500">Registro de auditoría de acciones administrativas.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1 shadow-inner">
          {FILTROS_ACTIVIDAD.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setAuditoriaFiltro(f.key)}
              className={"rounded-xl px-3.5 py-2 text-xs font-bold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 " + (auditoriaFiltro === f.key ? "bg-white shadow-sm" : "text-slate-500 hover:text-slate-700")}
              style={auditoriaFiltro === f.key ? { color: INK } : undefined}
            >
              {f.label}
            </button>
          ))}
        </div>
        {filtroFechaActividad && (
          <span className="flex items-center gap-1.5 rounded-full bg-violet-50 py-1.5 pl-3.5 pr-2 text-xs font-semibold text-violet-700">
            {etiquetaFecha(filtroFechaActividad)}
            <button type="button" onClick={() => setFiltroFechaActividad(null)} className="rounded-full p-0.5 hover:bg-violet-100 cursor-pointer"><X size={12} /></button>
          </span>
        )}
        {filtroActorActividad && (
          <span className="flex items-center gap-1.5 rounded-full bg-blue-50 py-1.5 pl-3.5 pr-2 text-xs font-semibold text-blue-700">
            De {filtroActorActividad.nombre}
            <button type="button" onClick={() => setFiltroActorActividad(null)} className="rounded-full p-0.5 hover:bg-blue-100 cursor-pointer"><X size={12} /></button>
          </span>
        )}
      </div>

      {auditoriaAgrupada.length === 0 ? (
        <div className={CARD_PAD}>
          <p className="py-10 text-center text-sm text-slate-400">No hay actividad para este filtro.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {auditoriaAgrupada.map(([dia, items]) => {
            const hoyDia = esHoy(dia)
            const colapsado = diasActividadColapsados.has(dia)
            return (
              <div key={dia} className={CARD}>
                <button
                  type="button"
                  onClick={() => alternarDiaActividad(dia)}
                  className="flex w-full items-center gap-2 rounded-t-[22px] px-5 py-3.5 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-inset"
                  title={colapsado ? "Expandir este día" : "Colapsar este día"}
                >
                  <ChevronDown size={15} className={"shrink-0 text-slate-400 transition-transform " + (colapsado ? "-rotate-90" : "")} />
                  <h4 className="text-sm font-bold capitalize" style={{ color: INK }}>{etiquetaFecha(dia)}</h4>
                  {hoyDia && <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold text-white" style={{ background: GRAD }}>Hoy</span>}
                  <span className="text-xs text-slate-400">· {items.length} acción{items.length === 1 ? "" : "es"}</span>
                </button>
                {!colapsado && (
                  <ul className="space-y-3 border-t border-slate-100 px-5 pb-5 pt-4">
                    {items.map((a) => <ItemAuditoria key={a.id} a={a} />)}
                  </ul>
                )}
              </div>
            )
          })}
          {!filtroFechaActividad && (
            <div className="flex justify-center pt-1">
              {auditoriaTieneMas ? (
                <button
                  type="button"
                  onClick={() => cargarAuditoria(false)}
                  disabled={auditoriaCargandoMas}
                  className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer disabled:opacity-60"
                >
                  {auditoriaCargandoMas ? "Cargando…" : "Cargar más"}
                </button>
              ) : (
                <p className="text-xs text-slate-400">No hay más actividad para mostrar.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )

  const ESTADO_LEAD = {
    nuevo: { label: "Nuevo", bg: "bg-blue-50", fg: "text-blue-700" },
    contactado: { label: "Contactado", bg: "bg-amber-50", fg: "text-amber-700" },
    convertido: { label: "Convertido", bg: "bg-emerald-50", fg: "text-emerald-700" },
    descartado: { label: "Descartado", bg: "bg-slate-100", fg: "text-slate-500" },
  }

  const renderLeads = () => (
    <div className="space-y-4" style={{ animation: "rise-in 320ms ease-out both" }}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: INK }}>Leads</h1>
        <p className="text-sm text-slate-500">Solicitudes recibidas desde la página de venta del sistema.</p>
      </div>

      {leads.length === 0 ? (
        <div className={CARD_PAD}>
          <p className="py-10 text-center text-sm text-slate-400">Todavía no llegó ninguna solicitud.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map((l) => {
            const estado = ESTADO_LEAD[l.estado] || ESTADO_LEAD.nuevo
            const procesando = procesandoLeadId === l.id
            return (
              <div key={l.id} className={CARD_PAD}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-bold" style={{ color: INK }}>{l.nombre_optica}</h4>
                      <span className={"rounded-full px-2.5 py-0.5 text-[11px] font-semibold " + estado.bg + " " + estado.fg}>{estado.label}</span>
                      {l.slug_deseado && <span className="font-mono text-xs text-slate-400">{l.slug_deseado}</span>}
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{l.nombre_admin} · {l.email_admin}{l.telefono ? ` · ${l.telefono}` : ""}</p>
                    {l.mensaje && <p className="mt-1.5 text-xs italic leading-relaxed text-slate-500">"{l.mensaje}"</p>}
                    <p className="mt-1.5 text-[11px] text-slate-400">{formatearFechaHora(l.created_at)}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => contactarLeadWhatsApp(l)}
                      disabled={!l.telefono}
                      title={l.telefono ? "Escribir por WhatsApp" : "Este lead no dejó teléfono"}
                      className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <MessageSquare size={13} /> WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={() => contactarLeadGmail(l)}
                      title="Escribir por Gmail"
                      className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100 cursor-pointer"
                    >
                      <Mail size={13} /> Gmail
                    </button>
                    {l.estado === "nuevo" && (
                      <button type="button" disabled={procesando} onClick={() => marcarLead(l.id, "contactado")} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer disabled:opacity-50">
                        <PhoneCall size={13} /> Marcar contactado
                      </button>
                    )}
                    {(l.estado === "nuevo" || l.estado === "contactado") && (
                      <>
                        <button type="button" disabled={procesando} onClick={() => abrirCrearDesdeLead(l)} className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-white transition hover:-translate-y-0.5 cursor-pointer disabled:opacity-50" style={{ background: GRAD }}>
                          <Plus size={13} /> Crear cuenta
                        </button>
                        <button type="button" disabled={procesando} onClick={() => marcarLead(l.id, "descartado")} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500 transition hover:bg-slate-50 cursor-pointer disabled:opacity-50">
                          <X size={13} /> Descartar
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )

  const renderSuperadminsSkeleton = () => (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight" style={{ color: INK }}>Superadmins</h1>
        <p className="text-sm text-slate-400">Cargando…</p>
      </div>
      <Skeleton className="h-[104px]" />
      <Skeleton className="h-[104px]" />
    </div>
  )

  const renderSuperadmins = () => cargaInicial ? renderSuperadminsSkeleton() : (
    <div className="space-y-4" style={{ animation: "rise-in 320ms ease-out both" }}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: INK }}>Superadmins</h1>
          <p className="text-sm text-slate-500">Cuentas con acceso total al sistema — creá una de respaldo, no dependas de una sola.</p>
        </div>
        <button
          type="button"
          onClick={abrirCrearSuperadmin}
          className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2"
          style={{ background: GRAD, boxShadow: "0 14px 28px -12px rgba(37,99,235,0.6)" }}
        >
          <UserPlus size={18} />
          Agregar superadmin
        </button>
      </div>

      {/* Antes había una franja de 3 stat cards, y después un banner amber de
          "sos el único superadmin" — Diego tampoco quedó conforme con el
          banner: decía casi palabra por palabra lo mismo que ya dice el
          subtítulo de arriba ("creá una de respaldo, no dependas de una
          sola"), solo que más fuerte y separado — quedaba redundante consigo
          misma. El subtítulo + el botón "Agregar superadmin" ya arriba
          cubren esto sin duplicar el mensaje. */}

      <div className="space-y-3">
        {superadmins.map((s) => {
          const ultima = ultimaAccionPorSuperadmin.get(s.id)
          const esVos = s.id === usuario?.id
          return (
          <div key={s.id} className={CARD_PAD}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={() => {
                  if (esVos) { abrirMiCuenta(); return }
                  setFiltroActorActividad({ id: s.id, nombre: s.nombre }); setFiltroFechaActividad(null); setAuditoriaFiltro("todas"); setSeccion("actividad")
                }}
                title={esVos ? "Editar mi cuenta" : `Ver actividad de ${s.nombre}`}
                className="group flex min-w-0 items-center gap-3.5 rounded-xl text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
              >
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-base font-bold text-white" style={{ background: GRAD }}>
                  {s.nombre.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate text-[15px] font-bold text-slate-800 transition-colors group-hover:text-blue-600">
                    {s.nombre}
                    {s.id === usuario?.id && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">TÚ</span>}
                  </p>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
                    <Mail size={12} /> {s.email || "—"}
                  </div>
                </div>
              </button>

              <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
                <div className="flex items-center gap-1.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                  <Calendar size={13} className="text-slate-400" />
                  Superadmin desde {formatearFecha(s.created_at)}
                </div>
                <div className="flex items-center gap-1.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                  <History size={13} className="text-slate-400" />
                  {accionesPorSuperadmin[s.id] ?? 0} acción{(accionesPorSuperadmin[s.id] ?? 0) === 1 ? "" : "es"} registrada{(accionesPorSuperadmin[s.id] ?? 0) === 1 ? "" : "s"}
                </div>
                <button
                  type="button"
                  onClick={() => setSuperadminAEliminar(s)}
                  disabled={s.id === usuario?.id || superadmins.length <= 1}
                  title={s.id === usuario?.id ? "No podés quitarte a vos mismo" : superadmins.length <= 1 ? "Debe quedar al menos un superadmin" : "Quitar superadmin"}
                  aria-label={s.id === usuario?.id ? "No podés quitarte a vos mismo" : superadmins.length <= 1 ? "Debe quedar al menos un superadmin" : `Quitar superadmin ${s.nombre || ""}`.trim()}
                  className="rounded-xl p-2.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 cursor-pointer"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            {ultima && (
              <div className="mt-3.5 flex items-start gap-2.5 border-t border-slate-100 pt-3.5">
                {(() => {
                  const info = AUDITORIA_INFO[ultima.accion]
                  if (!info) return null
                  const Icono = info.icon
                  return <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: info.bg, color: info.fg }}><Icono size={13} /></div>
                })()}
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Última acción</p>
                  <p className="text-[13px] text-slate-600">{textoAuditoria(ultima)} <span className="text-slate-400">· {formatearFechaHora(ultima.created_at)}</span></p>
                </div>
              </div>
            )}
          </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="flex h-screen font-sans" style={{ backgroundColor: "#F5F7FA" }}>
      {menuAbierto && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMenuAbierto(false)} />}

      {/* ─── SIDEBAR ─── */}
      <aside
        className={
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col justify-between overflow-hidden transition-all duration-300 lg:static lg:translate-x-0 " +
          (colapsado ? "lg:w-20 " : "lg:w-72 ") +
          (menuAbierto ? "translate-x-0" : "-translate-x-full")
        }
        style={{ backgroundColor: INK }}
      >
        <svg aria-hidden="true" className="pointer-events-none absolute -bottom-20 -right-20 h-80 w-80" viewBox="0 0 400 400" fill="none" stroke="#ffffff" style={{ opacity: 0.05 }}>
          {[70, 130, 190].map((r) => (<circle key={r} cx="200" cy="200" r={r} strokeWidth="1.4" />))}
        </svg>
        <div className="pointer-events-none absolute -left-24 top-1/4 h-56 w-56 rounded-full blur-3xl" style={{ background: "radial-gradient(circle, rgba(34,211,238,0.12), transparent 70%)" }} />

        <div className="relative z-10 flex-1 overflow-y-auto">
          <div className={"flex items-center justify-between border-b border-white/10 px-6 py-5 " + (colapsado ? "lg:justify-center lg:px-0" : "")}>
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white" style={{ background: GRAD, boxShadow: "0 10px 24px -8px rgba(34,211,238,0.6)" }}>
                <ShieldCheck size={22} strokeWidth={2.2} />
              </div>
              <div className={"leading-tight " + (colapsado ? "lg:hidden" : "")}>
                <p className="text-lg font-bold tracking-tight text-white">
                  Diego <span style={{ color: "#22D3EE" }}>Óptica</span>
                </p>
                <p className="text-[11px] font-medium tracking-wide text-white/40">SUPERADMIN</p>
              </div>
            </div>
            <button type="button" onClick={() => setMenuAbierto(false)} aria-label="Cerrar menú" className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white lg:hidden cursor-pointer">
              <X size={20} />
            </button>
          </div>

          <nav className="space-y-1.5 px-4 py-6">
            <p className={"mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-white/30 " + (colapsado ? "lg:hidden" : "")}>Menú</p>
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
                  className={"group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 " + (colapsado ? "lg:justify-center lg:px-0 " : "") + (activo ? "text-white" : "text-white/55 hover:bg-white/5 hover:text-white")}
                  style={activo ? { background: GRAD, boxShadow: "0 12px 24px -12px rgba(34,211,238,0.55)" } : undefined}
                >
                  <Icono size={20} className={activo ? "text-white" : "text-white/55 group-hover:text-white"} />
                  <span className={colapsado ? "lg:hidden" : ""}>{opcion.nombre}</span>
                  {opcion.id === "mensajes" && consultasAbiertas > 0 ? (
                    <span className={"ml-auto grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10.5px] font-bold " + (activo ? "bg-white/25 text-white" : "bg-amber-400 text-amber-950") + (colapsado ? " lg:hidden" : "")}>
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

        <div className={"relative z-10 border-t border-white/10 p-4 " + (colapsado ? "lg:px-2" : "")}>
          {!colapsado && (
            <div className="mb-3 hidden rounded-xl bg-white/5 px-3.5 py-3 lg:block">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-white/50">
                <TrendingUp size={12} /> {opticas.length} óptica{opticas.length === 1 ? "" : "s"} · {superadmins.length} superadmin{superadmins.length === 1 ? "" : "s"}
              </p>
            </div>
          )}
          <button
            type="button"
            onClick={() => alSalir()}
            className={"flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-semibold text-white/55 transition-colors hover:bg-white/5 hover:text-white cursor-pointer " + (colapsado ? "lg:justify-center lg:px-0" : "")}
          >
            <LogOut size={18} />
            <span className={colapsado ? "lg:hidden" : ""}>Salir</span>
          </button>
        </div>
      </aside>

      {/* ─── CONTENIDO ─── */}
      <main className="flex flex-1 flex-col overflow-hidden">
        <header className="relative z-30 flex items-center justify-between gap-4 border-b border-slate-200 bg-white/80 px-4 py-3 backdrop-blur-md sm:px-8">
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
              className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white py-1.5 pl-1.5 pr-2.5 transition-colors hover:bg-slate-50 cursor-pointer"
            >
              <div className="grid h-7 w-7 place-items-center rounded-lg text-xs font-bold text-white" style={{ background: GRAD }}>
                {(usuario?.nombre || "S").charAt(0).toUpperCase()}
              </div>
              <div className="hidden text-left leading-tight sm:block">
                <p className="text-sm font-semibold" style={{ color: INK }}>{usuario?.nombre || "Superadmin"}</p>
                <p className="text-[10px] text-slate-500">Superadministrador</p>
              </div>
              <ChevronDown size={16} className={"text-slate-500 transition-transform " + (userMenuAbierto ? "rotate-180" : "")} />
            </button>

            {userMenuAbierto && (
              <div className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
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

        <div className="flex-1 overflow-y-auto p-4 sm:p-8">
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
            className="fixed z-50 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 text-left shadow-xl"
            style={{ top: menuPos.top, left: menuPos.left, animation: "modal-in 120ms ease-out" }}
          >
            <button
              type="button"
              onClick={() => { setMenuAccionesId(null); alternarActiva(o) }}
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
              <Copy size={15} /> Copiar slug
            </button>
          </div>,
          document.body,
        )
      })()}

      {/* ─── MODAL DETALLE ÓPTICA ─── */}
      {detalle && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }}
          onClick={() => { setDetalle(null); setRenombrando(false); setAgregarAdminAbierto(false); setAdminAEliminar(null) }}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: GRAD }}>
                  {detalle.nombre.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  {renombrando ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        autoFocus
                        type="text"
                        value={nombreEditado}
                        onChange={(e) => setNombreEditado(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") guardarNombre(); if (e.key === "Escape") setRenombrando(false) }}
                        className="w-44 rounded-lg border border-blue-300 px-2 py-1 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
                      />
                      <button type="button" onClick={guardarNombre} disabled={guardandoNombre} className="rounded-lg p-1.5 text-emerald-600 hover:bg-emerald-50 cursor-pointer"><Check size={16} /></button>
                      <button type="button" onClick={() => setRenombrando(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 cursor-pointer"><X size={16} /></button>
                    </div>
                  ) : (
                    <h4 className="flex min-w-0 items-center gap-1.5 text-lg font-bold" style={{ color: INK }} title={detalle.nombre}>
                      <span className="truncate">{detalle.nombre}</span>
                      <button type="button" onClick={iniciarRenombrar} title="Renombrar" className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"><Pencil size={13} /></button>
                    </h4>
                  )}
                  <p className="font-mono text-xs text-slate-500">{detalle.slug}</p>
                </div>
              </div>
              <button type="button" onClick={() => setDetalle(null)} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3.5">
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
                  onClick={() => alternarActiva(detalle)}
                  className={"rounded-xl px-4 py-2.5 text-sm font-semibold transition cursor-pointer disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 " + (detalle.activa ? "border border-rose-200 text-rose-600 hover:bg-rose-50 focus-visible:ring-rose-400/60" : "border border-emerald-200 text-emerald-600 hover:bg-emerald-50 focus-visible:ring-emerald-400/60")}
                >
                  {procesandoId === detalle.id ? "Actualizando…" : detalle.activa ? "Suspender" : "Reactivar"}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><Users size={13} /> Asistentes</p>
                  <p className="mt-1 text-xl font-bold" style={{ color: INK }}>{asistentesPorOptica.get(detalle.id) || 0}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500"><Stethoscope size={13} /> Pacientes</p>
                  <p className="mt-1 text-xl font-bold" style={{ color: INK }}>{pacientesPorOptica.get(detalle.id) || 0}</p>
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Administradores</p>
                  <button type="button" onClick={() => (agregarAdminAbierto ? setAgregarAdminAbierto(false) : abrirAgregarAdmin())} className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">
                    <UserPlus size={13} /> Agregar
                  </button>
                </div>

                {(adminsPorOptica.get(detalle.id) || []).length === 0 ? (
                  <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm font-medium text-amber-700">
                    <AlertTriangle size={16} /> Sin administrador vinculado.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(adminsPorOptica.get(detalle.id) || []).map((a) => (
                      adminAEliminar?.id === a.id ? (
                        <div key={a.id} className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm">
                          <span className="font-medium text-rose-700">¿Quitar a {a.nombre}?</span>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => setAdminAEliminar(null)} className="rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-white cursor-pointer">Cancelar</button>
                            <button type="button" onClick={confirmarEliminarAdmin} disabled={eliminandoAdmin} className="rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-rose-700 cursor-pointer disabled:opacity-60">
                              {eliminandoAdmin ? "Quitando…" : "Confirmar"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div key={a.id} className="rounded-xl border border-slate-200 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-800">{a.nombre}</p>
                              <div className="flex items-center gap-1.5 text-xs text-slate-500"><Mail size={12} /><span className="truncate">{a.email || "—"}</span></div>
                            </div>
                            <button type="button" onClick={() => setAdminAEliminar(a)} title="Quitar administrador" className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"><Trash2 size={15} /></button>
                          </div>
                          <div className="mt-2.5 flex items-center gap-1.5 border-t border-slate-100 pt-2.5">
                            <Cake size={13} className="shrink-0 text-slate-400" />
                            <label className="text-xs text-slate-500">Cumpleaños</label>
                            <input
                              type="date"
                              defaultValue={a.fecha_nacimiento || ""}
                              onBlur={(e) => { if (e.target.value !== (a.fecha_nacimiento || "")) guardarCumpleanos(a.id, e.target.value) }}
                              disabled={guardandoCumple === a.id}
                              className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs outline-none focus:border-blue-500 focus:bg-white disabled:opacity-60"
                            />
                            {guardandoCumple === a.id && <Loader2 size={12} className="animate-spin text-slate-400" />}
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                )}

                {agregarAdminAbierto && (
                  <form onSubmit={guardarAdminExtra} className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
                    {errorAdminExtra && (
                      <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs font-medium text-red-700">
                        <AlertCircle size={14} /> {errorAdminExtra}
                      </div>
                    )}
                    <input
                      type="text" placeholder="Nombre completo" value={camposAdminExtra.nombre} onChange={(e) => actualizarCampoAdminExtra("nombre", filtrarSoloLetras(e.target.value))}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50"
                    />
                    <input
                      type="email" placeholder="Correo electrónico" value={camposAdminExtra.email} onChange={(e) => actualizarCampoAdminExtra("email", e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="relative">
                        <input
                          type={verClaveExtra ? "text" : "password"} placeholder="Contraseña" value={camposAdminExtra.clave} onChange={(e) => actualizarCampoAdminExtra("clave", e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pr-8 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50"
                        />
                        <button type="button" onClick={() => setVerClaveExtra((v) => !v)} aria-label={verClaveExtra ? "Ocultar contraseña" : "Mostrar contraseña"} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer">{verClaveExtra ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                      </div>
                      <input
                        type={verClaveExtra ? "text" : "password"} placeholder="Confirmar" value={camposAdminExtra.confirmarClave} onChange={(e) => actualizarCampoAdminExtra("confirmarClave", e.target.value)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-50"
                      />
                    </div>
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
                <div className="space-y-3 rounded-xl border border-slate-200 p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1 shadow-inner">
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
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">Monto mensual (USD)</label>
                      <input
                        type="number" min="0" step="0.01" value={campoMonto} onChange={(e) => setCampoMonto(e.target.value)} onBlur={guardarSuscripcion}
                        placeholder="0.00"
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 focus:bg-white"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">Próximo vencimiento</label>
                      <input
                        type="date" value={campoVencimiento} onChange={(e) => setCampoVencimiento(e.target.value)} onBlur={guardarSuscripcion}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 focus:bg-white"
                      />
                    </div>
                  </div>
                  {guardandoSuscripcion && <p className="text-xs text-slate-400">Guardando…</p>}
                </div>
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
                      <div key={f.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 p-3">
                        <div className="min-w-0">
                          <p className="truncate font-mono text-xs font-semibold text-slate-700">{f.numero}</p>
                          <p className="text-xs text-slate-500">{f.periodo} · ${Number(f.monto).toFixed(2)}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => alternarEstadoFactura(f)}
                            className={"rounded-full px-2.5 py-1 text-[11px] font-semibold cursor-pointer " + (f.estado === "pagada" ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100" : "bg-amber-50 text-amber-700 hover:bg-amber-100")}
                          >
                            {f.estado === "pagada" ? "Pagada" : "Pendiente"}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setFacturaImprimir(f); setTimeout(() => imprimirDocumento("factura-imprimible", "printing-factura"), 50) }}
                            title="Imprimir factura"
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 cursor-pointer"
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
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Slug</p>
                <div className="flex items-center justify-between rounded-xl border border-slate-200 p-3.5">
                  <span className="font-mono text-sm text-slate-700">{detalle.slug}</span>
                  <button type="button" onClick={() => copiarSlug(detalle.slug)} className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">
                    {slugCopiado ? <Check size={14} /> : <Copy size={14} />}
                    {slugCopiado ? "Copiado" : "Copiar"}
                  </button>
                </div>
              </div>

              {/* ─── Personalización del login (lo único que ve el cliente) ─── */}
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Personalización del login</p>
                <div className="space-y-2.5 rounded-xl border border-slate-200 p-3.5">
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Nombre de marca</label>
                    <input
                      type="text" value={campoMarca.nombreMarca} onChange={(e) => setCampoMarca((p) => ({ ...p, nombreMarca: e.target.value }))} onBlur={guardarMarca}
                      placeholder="Ej. Óptica Vision Plus"
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Eslogan</label>
                    <input
                      type="text" value={campoMarca.eslogan} onChange={(e) => setCampoMarca((p) => ({ ...p, eslogan: e.target.value }))} onBlur={guardarMarca}
                      placeholder="Ej. Ve el mundo con claridad."
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 focus:bg-white"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">Color de acento</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color" value={campoMarca.colorAcento} onChange={(e) => setCampoMarca((p) => ({ ...p, colorAcento: e.target.value }))} onBlur={guardarMarca}
                          className="h-8 w-10 shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-slate-50 p-0.5"
                        />
                        <input
                          type="text" value={campoMarca.colorAcento} onChange={(e) => setCampoMarca((p) => ({ ...p, colorAcento: e.target.value }))} onBlur={guardarMarca}
                          className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-xs outline-none focus:border-blue-500 focus:bg-white"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs text-slate-500">Logo</label>
                      <div className="flex items-center gap-2">
                        {campoLogoUrl && (
                          <img src={campoLogoUrl} alt="" className="h-8 w-8 shrink-0 rounded-lg border border-slate-200 object-contain bg-white" />
                        )}
                        <label className={"flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 " + (subiendoLogo ? "pointer-events-none opacity-60" : "")}>
                          <ImageIcon size={13} />
                          {subiendoLogo ? "Subiendo…" : "Subir imagen"}
                          <input
                            type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) subirLogo(f); e.target.value = "" }}
                          />
                        </label>
                      </div>
                      {errorLogo && <p className="mt-1 text-[11px] font-medium text-red-600">{errorLogo}</p>}
                      <p className="mt-1 text-[10px] text-slate-400">PNG, JPG, WEBP o SVG · máx. 2 MB. También puedes pegar una URL ya alojada:</p>
                      <input
                        type="text" value={campoLogoUrl} onChange={(e) => setCampoLogoUrl(e.target.value)} onBlur={guardarMarca}
                        placeholder="https://…"
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 focus:bg-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs text-slate-500">Mensaje de bienvenida (hero)</label>
                    <textarea
                      rows={3} value={campoMarca.mensaje} onChange={(e) => setCampoMarca((p) => ({ ...p, mensaje: e.target.value }))} onBlur={guardarMarca}
                      placeholder="Ej. En Óptica Vision Plus cuidamos tu salud visual de principio a fin..."
                      className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 focus:bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* ─── Tarjetas de servicios del login (opcional, las 3 juntas) ─── */}
              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Tarjetas de servicios del login <span className="font-normal normal-case text-slate-400">(completá las 3 para reemplazar las genéricas)</span>
                </p>
                <div className="space-y-3">
                  {campoMarca.servicios.map((s, i) => (
                    <div key={i} className="space-y-2 rounded-xl border border-slate-200 p-3.5">
                      <p className="text-xs font-semibold text-slate-400">Tarjeta {i + 1}</p>
                      <input
                        type="text" value={s.titulo}
                        onChange={(e) => setCampoMarca((p) => ({ ...p, servicios: p.servicios.map((sv, j) => j === i ? { ...sv, titulo: e.target.value } : sv) }))}
                        onBlur={guardarMarca}
                        placeholder="Título (ej. Exámenes optométricos)"
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm font-semibold outline-none focus:border-blue-500 focus:bg-white"
                      />
                      <textarea
                        rows={2} value={s.texto}
                        onChange={(e) => setCampoMarca((p) => ({ ...p, servicios: p.servicios.map((sv, j) => j === i ? { ...sv, texto: e.target.value } : sv) }))}
                        onBlur={guardarMarca}
                        placeholder="Descripción breve"
                        className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-sm outline-none focus:border-blue-500 focus:bg-white"
                      />
                      <div className="space-y-1.5">
                        {s.features.map((f, k) => (
                          <input
                            key={k} type="text" value={f}
                            onChange={(e) => setCampoMarca((p) => ({ ...p, servicios: p.servicios.map((sv, j) => j === i ? { ...sv, features: sv.features.map((ft, l) => l === k ? e.target.value : ft) } : sv) }))}
                            onBlur={guardarMarca}
                            placeholder={`Punto destacado ${k + 1}`}
                            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs outline-none focus:border-blue-500 focus:bg-white"
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ─── Guardar, en una barra pegajosa (aparte del autoguardado
                  onBlur de cada campo: quedaba enterrado varias pantallas
                  más abajo, después de las 3 tarjetas de servicios — Diego
                  nunca llegaba a verlo con solo bajar un poco) — así queda a
                  la vista mientras se editan estos campos, sin tener que
                  seguir bajando hasta el final del modal. ─── */}
              <div className="sticky bottom-0 z-10 -mx-5 -mb-5 border-t border-slate-200 bg-white/95 px-5 py-3 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={guardarMarca}
                    disabled={guardandoMarca}
                    className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition cursor-pointer disabled:opacity-60"
                    style={{ background: GRAD }}
                  >
                    {guardandoMarca ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                    {guardandoMarca ? "Guardando…" : "Guardar cambios"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelarCambiosMarca}
                    disabled={guardandoMarca}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer disabled:opacity-60"
                  >
                    Cancelar cambios
                  </button>
                  {marcaGuardadaOk && (
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
                      <Check size={15} /> Guardado
                    </span>
                  )}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Creada</p>
                <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 p-3.5 text-sm text-slate-700">
                  <Calendar size={14} className="text-slate-500" />
                  {formatearFecha(detalle.created_at)}
                </div>
              </div>

              <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3.5 text-xs text-slate-500">
                <Info size={14} className="mt-0.5 shrink-0" />
                Los datos operativos de esta óptica (pacientes, citas, inventario) todavía viven en el navegador de su administrador — la centralización de esos módulos es la siguiente fase del proyecto.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Factura imprimible (oculta salvo al imprimir — imprimirDocumento
          la clona a un portal fuera del árbol normal) ─── */}
      {facturaImprimir && (
        <div style={{ position: "fixed", left: "-9999px", top: 0 }}>
          <style>{estilosImpresion("printing-factura")}</style>
          <div id="factura-imprimible" className="w-[480px] bg-white p-8 text-sm text-slate-800">
            <div className="mb-6 flex items-center justify-between border-b border-slate-200 pb-4">
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
              <p className="text-lg font-bold" style={{ color: INK }}>${Number(facturaImprimir.monto).toFixed(2)}</p>
            </div>
            <button type="button" onClick={() => setFacturaImprimir(null)} className="no-print mt-6 text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">Cerrar</button>
          </div>
        </div>
      )}

      {/* ─── MODAL DETALLE MENSAJE ─── */}
      {mensajeAbierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }}
          onClick={() => !enviandoRespuesta && setMensajeAbierto(null)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ background: mensajeAbierto.tipo === "anuncio" ? "#FFF7E6" : "#E8F0FF", color: mensajeAbierto.tipo === "anuncio" ? "#B45309" : "#2563EB" }}>
                  {mensajeAbierto.tipo === "anuncio" ? <Megaphone size={20} /> : <MessageSquare size={20} />}
                </div>
                <div className="min-w-0">
                  <h4 className="truncate text-lg font-bold" style={{ color: INK }}>{mensajeAbierto.asunto}</h4>
                  <p className="truncate text-xs text-slate-500">
                    {mensajeAbierto.tipo === "anuncio" ? "Aviso general" : <>{mensajeAbierto.remitente_nombre} · {opticas.find((o) => o.id === mensajeAbierto.optica_id)?.nombre || "Óptica"}</>}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setMensajeAbierto(null)} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-700 whitespace-pre-wrap">{mensajeAbierto.cuerpo}</div>
              <p className="flex items-center gap-1.5 text-xs text-slate-400"><Clock size={11} /> {formatearFechaHora(mensajeAbierto.created_at)}</p>

              {mensajeAbierto.tipo === "consulta" && (
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Tu respuesta</label>
                  <textarea
                    rows={4} value={respuestaTexto} onChange={(e) => setRespuestaTexto(e.target.value)}
                    placeholder="Escribí tu respuesta para el administrador…"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
                  />
                  {mensajeAbierto.respondido_at && (
                    <p className="mt-1.5 text-xs text-slate-400">Última respuesta: {formatearFechaHora(mensajeAbierto.respondido_at)}</p>
                  )}
                </div>
              )}
            </div>

            {mensajeAbierto.tipo === "consulta" && (
              <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-4">
                <button type="button" onClick={() => responderMensaje(false)} disabled={enviandoRespuesta} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer disabled:opacity-60">
                  {enviandoRespuesta ? "Guardando…" : "Guardar respuesta"}
                </button>
                {mensajeAbierto.estado === "abierto" && (
                  <button type="button" onClick={() => responderMensaje(true)} disabled={enviandoRespuesta} className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white cursor-pointer disabled:opacity-60" style={{ background: GRAD }}>
                    <CheckCircle2 size={16} /> Responder y marcar resuelto
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL NUEVO AVISO GENERAL ─── */}
      {modalAvisoAbierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }}
          onClick={() => !publicandoAviso && setModalAvisoAbierto(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: GRAD }}>
                  <Megaphone size={20} />
                </div>
                <div>
                  <h4 className="text-lg font-bold" style={{ color: INK }}>Nuevo aviso</h4>
                  <p className="text-xs text-slate-500">
                    {avisoDestino === "todos" ? "Lo van a ver todos los administradores de óptica." : "Solo lo va a ver el administrador de esa óptica."}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setModalAvisoAbierto(false)} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={publicarAviso} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                {errorAviso && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                    <AlertCircle size={16} /> {errorAviso}
                  </div>
                )}
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Destinatario</label>
                  <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1 shadow-inner">
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
                      className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
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
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Mensaje</label>
                  <textarea
                    rows={5} value={avisoCuerpo} onChange={(e) => setAvisoCuerpo(e.target.value)}
                    placeholder="Escribí el aviso…"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
                  />
                </div>
              </div>
              <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-5 py-4">
                <button type="button" onClick={() => setModalAvisoAbierto(false)} disabled={publicandoAviso} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-50">
                  Cancelar
                </button>
                <button type="submit" disabled={publicandoAviso} className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white cursor-pointer disabled:opacity-60" style={{ background: GRAD }}>
                  <Send size={15} /> {publicandoAviso ? "Publicando…" : "Publicar aviso"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL CREAR ÓPTICA ─── */}
      {modalAbierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }}
          onClick={cerrarModal}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: GRAD }}>
                  <Building2 size={20} />
                </div>
                <div>
                  <h4 className="text-lg font-bold" style={{ color: INK }}>Crear óptica</h4>
                  <p className="text-xs text-slate-500">Se crea la óptica y la cuenta de su administrador en un solo paso.</p>
                </div>
              </div>
              <button type="button" onClick={cerrarModal} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-600 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={guardar} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
                {error && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
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
                  <div className="space-y-4 rounded-xl border border-slate-200 p-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-slate-700">Nombre de la óptica</label>
                      <div className="relative">
                        <Building2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                          type="text" value={campos.nombreOptica} onChange={(e) => actualizarCampo("nombreOptica", e.target.value)}
                          placeholder="Ej. Óptica Visión Clara"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-slate-700">Slug (identificador único)</label>
                      <div className="relative">
                        <Hash className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                          type="text" value={campos.slug}
                          onChange={(e) => { setSlugTocado(true); actualizarCampo("slug", generarSlug(e.target.value)) }}
                          placeholder="Ej. vision-clara"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-9 font-mono text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          {slugEstado === "verificando" && <Loader2 size={15} className="animate-spin text-slate-400" />}
                          {slugEstado === "disponible" && <CheckCircle2 size={15} className="text-emerald-600" />}
                          {slugEstado === "ocupado" && <XCircle size={15} className="text-rose-600" />}
                        </div>
                      </div>
                      <p className={"mt-1.5 text-xs " + (slugEstado === "ocupado" ? "font-medium text-rose-600" : "text-slate-500")}>
                        {slugEstado === "ocupado"
                          ? "Ese identificador ya está en uso — probá con otro."
                          : campos.slug
                            ? `Se identificará internamente como "${campos.slug}".`
                            : "Se genera automáticamente a partir del nombre."}
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
                  <div className="space-y-4 rounded-xl border border-slate-200 p-4">
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-slate-700">Eslogan</label>
                      <input
                        type="text" value={campos.eslogan} onChange={(e) => actualizarCampo("eslogan", e.target.value)}
                        placeholder="Ej. Ve el mundo con claridad."
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">Color de acento</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color" value={campos.colorAcento} onChange={(e) => actualizarCampo("colorAcento", e.target.value)}
                            className="h-[42px] w-12 shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-slate-50 p-0.5"
                          />
                          <input
                            type="text" value={campos.colorAcento} onChange={(e) => actualizarCampo("colorAcento", e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-mono text-xs text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">Logo (URL)</label>
                        <input
                          type="text" value={campos.logoUrl} onChange={(e) => actualizarCampo("logoUrl", e.target.value)}
                          placeholder="https://…"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
                        />
                      </div>
                    </div>
                    <p className="text-xs text-slate-400">Subir el logo como archivo (en vez de pegar una URL) y las tarjetas de servicios quedan disponibles después, ya con la óptica creada.</p>
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
                  <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">Nombre completo</label>
                        <div className="relative">
                          <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                          <input
                            type="text" value={campos.nombreAdmin} onChange={(e) => actualizarCampo("nombreAdmin", filtrarSoloLetras(e.target.value))}
                            placeholder="Ej. Ana Torres"
                            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-50"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">Correo electrónico</label>
                        <div className="relative">
                          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                          <input
                            type="email" value={campos.emailAdmin} onChange={(e) => actualizarCampo("emailAdmin", e.target.value)}
                            placeholder="admin@vision-clara.com"
                            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-50"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">Fecha de nacimiento <span className="font-normal text-slate-400">(opcional)</span></label>
                        <div className="relative">
                          <Cake className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                          <input
                            type="date" value={campos.fechaNacimientoAdmin} onChange={(e) => actualizarCampo("fechaNacimientoAdmin", e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-50"
                          />
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">Contraseña</label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                          <input
                            type={verClave ? "text" : "password"} value={campos.clave} onChange={(e) => actualizarCampo("clave", e.target.value)}
                            placeholder="Mínimo 6 caracteres"
                            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-9 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-50"
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
                            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-50"
                          />
                        </div>
                      </div>
                    </div>
                    {(campos.clave || campos.confirmarClave) && (
                      <div className="flex flex-wrap gap-x-4 gap-y-1 pt-0.5">
                        <span className={"flex items-center gap-1.5 text-xs font-medium " + (campos.clave.length >= 6 ? "text-emerald-600" : "text-slate-400")}>
                          {campos.clave.length >= 6 ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                          Mínimo 6 caracteres
                        </span>
                        <span className={"flex items-center gap-1.5 text-xs font-medium " + (campos.confirmarClave && campos.clave === campos.confirmarClave ? "text-emerald-600" : "text-slate-400")}>
                          {campos.confirmarClave && campos.clave === campos.confirmarClave ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                          Las contraseñas coinciden
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-5 py-4">
                <button type="button" onClick={cerrarModal} disabled={guardando} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50">
                  Cancelar
                </button>
                <button type="submit" disabled={guardando || slugEstado === "ocupado"} className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 cursor-pointer disabled:opacity-60 disabled:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 focus-visible:ring-offset-2" style={{ background: GRAD, boxShadow: "0 12px 24px -12px rgba(37,99,235,0.6)" }}>
                  {guardando ? "Creando…" : "Crear óptica"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL AGREGAR SUPERADMIN ─── */}
      {modalSuperadminAbierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }}
          onClick={() => !guardandoSuperadmin && setModalSuperadminAbierto(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: GRAD }}>
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h4 className="text-lg font-bold" style={{ color: INK }}>Agregar superadmin</h4>
                  <p className="text-xs text-slate-500">Tendrá el mismo acceso total que vos.</p>
                </div>
              </div>
              <button type="button" onClick={() => setModalSuperadminAbierto(false)} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={guardarSuperadmin} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                {errorSuperadmin && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
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
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
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
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
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
                        placeholder="Mínimo 6 caracteres"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-9 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
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
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-5 py-4">
                <button type="button" onClick={() => setModalSuperadminAbierto(false)} disabled={guardandoSuperadmin} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-50">
                  Cancelar
                </button>
                <button type="submit" disabled={guardandoSuperadmin} className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 cursor-pointer disabled:opacity-60" style={{ background: GRAD, boxShadow: "0 12px 24px -12px rgba(37,99,235,0.6)" }}>
                  {guardandoSuperadmin ? "Creando…" : "Agregar superadmin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── CONFIRMAR QUITAR SUPERADMIN ─── */}
      {superadminAEliminar && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }}
          onClick={() => !eliminandoSuperadmin && setSuperadminAEliminar(null)}
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-5">
              <div className="mb-3 grid h-11 w-11 place-items-center rounded-xl bg-rose-50 text-rose-600"><AlertTriangle size={20} /></div>
              <h4 className="text-base font-bold" style={{ color: INK }}>¿Quitar a {superadminAEliminar.nombre} como superadmin?</h4>
              <p className="mt-1.5 text-sm text-slate-500">Perderá acceso al panel. Su cuenta de correo no se elimina, solo el permiso.</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button type="button" onClick={() => setSuperadminAEliminar(null)} disabled={eliminandoSuperadmin} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer disabled:opacity-50">
                Cancelar
              </button>
              <button type="button" onClick={confirmarEliminarSuperadmin} disabled={eliminandoSuperadmin} className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 cursor-pointer disabled:opacity-60">
                {eliminandoSuperadmin ? "Quitando…" : "Quitar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL MI CUENTA ─── */}
      {modalMiCuentaAbierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }}
          onClick={() => !guardandoMiCuenta && !guardandoClaveNueva && setModalMiCuentaAbierto(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: GRAD }}>
                  <Settings size={20} />
                </div>
                <div>
                  <h4 className="text-lg font-bold" style={{ color: INK }}>Mi cuenta</h4>
                  <p className="text-xs text-slate-500">Tus datos y tu acceso a este panel.</p>
                </div>
              </div>
              <button type="button" onClick={() => setModalMiCuentaAbierto(false)} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5">
              {/* ─── Información personal ─── */}
              <form onSubmit={guardarMiCuenta} className="space-y-3">
                {errorMiCuenta && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs font-medium text-red-700">
                    <AlertCircle size={14} /> {errorMiCuenta}
                  </div>
                )}
                {avisoEmailPendiente && (
                  <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 p-2.5 text-xs font-medium text-blue-700">
                    <Info size={14} className="shrink-0" /> Te enviamos un enlace a {camposMiCuenta.email} para confirmar el cambio de correo — hasta que lo confirmes, seguís entrando con el anterior.
                  </div>
                )}
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Nombre completo</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="text" value={camposMiCuenta.nombre} onChange={(e) => setCamposMiCuenta((p) => ({ ...p, nombre: filtrarSoloLetras(e.target.value) }))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Correo electrónico</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                      type="email" value={camposMiCuenta.email} onChange={(e) => setCamposMiCuenta((p) => ({ ...p, email: e.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
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
                    <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs font-medium text-red-700">
                      <AlertCircle size={14} /> {errorClaveNueva}
                    </div>
                  )}
                  {claveActualizada && (
                    <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs font-medium text-emerald-700">
                      <CheckCircle2 size={14} /> Contraseña actualizada.
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type={verClaveNueva ? "text" : "password"} placeholder="Nueva contraseña" value={claveNueva} onChange={(e) => setClaveNueva(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-9 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
                      />
                      <button type="button" onClick={() => setVerClaveNueva((v) => !v)} aria-label={verClaveNueva ? "Ocultar contraseña" : "Mostrar contraseña"} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 cursor-pointer">
                        {verClaveNueva ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <input
                      type={verClaveNueva ? "text" : "password"} placeholder="Confirmar" value={confirmarClaveNueva} onChange={(e) => setConfirmarClaveNueva(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
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
          </div>
        </div>
      )}
    </div>
  )
}
