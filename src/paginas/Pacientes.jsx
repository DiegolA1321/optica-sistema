"use client"

import { ahoraEcuador } from "../utilidades/horaEcuador"

import { useState, useMemo, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import {
  ArrowLeft,
  UserX,
  UserPlus,
  Search,
  Trash2,
  Pencil,
  ChevronLeft,
  Eye,
  Phone,
  Mail,
  IdCard,
  CheckCircle,
  Calendar,
  CalendarPlus,
  Users,
  X,
  Cake,
  ShoppingBag,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  KeyRound,
  Copy,
  Check,
  Glasses,
  Heart,
  Stethoscope,
  ChevronRight,
  Lock,
  MoreVertical,
  RefreshCw,
  Image as ImageIcon,
  ClipboardList,
  Wallet,
  ShoppingCart,
  Receipt,
  CreditCard,
  Gift,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Clock,
  Star,
  BarChart3,
  HelpCircle,
  MessageCircle,
  FlaskConical,
} from "lucide-react"
import CamposCita from "../componentes/CamposCita"
import { BarraBusquedaFiltros, SeccionRango } from "../componentes/FiltrosCitas"
import { contarCitas, citasPorMes, diaMasFrecuente } from "../utilidades/resumenCitas"
import { esAtencionInmediata, validarHorarioCita, registrarCita } from "../utilidades/agendarCita"
import ConfirmarCitaModal from "../componentes/ConfirmarCitaModal"
import SeleccionarCitaModal from "../componentes/SeleccionarCitaModal"
import ConfirmarDatosPacienteModal from "../componentes/ConfirmarDatosPacienteModal"
import ComprobanteVentaModal from "./ComprobanteVentaModal"
import { cobrosPendientes, marcarCitaAtendidaDb } from "../utilidades/cobrosPendientes"
import { lineasCobroConsulta } from "../utilidades/costosConsulta"
import { filtrarSoloLetras, filtrarSoloNumeros, esNombreValido, esCedulaValida, esTelefonoValido, esEmailValido, generarClaveTemporal } from "../utilidades/validaciones"
import { minutosDesdeMedianoche, esHoy, etiquetaFecha, horaA12 } from "../utilidades/disponibilidad"
import { linkWhatsApp } from "../utilidades/whatsapp"
import { marcarContactadoHoy } from "../utilidades/contactosCrm"
import TendenciaGraduacion from "../componentes/TendenciaGraduacion"
import { tendenciaEntreConsultas } from "../utilidades/tendenciaGraduacion"
import { pacientesQueNoCompraron, textoDiagnostico } from "../utilidades/pasesVenta"
import { fechaLegible, formatoFecha } from "../utilidades/formatoFecha"
import { atencionesAbiertasAntiguas, textoAtencionAbierta, diasAtencionAbierta } from "../utilidades/atencionAbierta"
import ConfirmarDejarDeAtender from "../componentes/ConfirmarDejarDeAtender"
import { etiquetaCorreccion, AYUDA_CORRECCION } from "../utilidades/correccion"
import OrdenesLaboratorio from "../componentes/OrdenesLaboratorio"
import { puede } from "../utilidades/permisosUi"
import EliminarPacienteModal from "../componentes/EliminarPacienteModal"
import { saldoFactura, saldoPacienteFacturas } from "../utilidades/abonos"
import FilaComprobante from "../componentes/FilaComprobante"
import ModalesVentas from "../componentes/ModalesVentas"
import { useVentas } from "../utilidades/useVentas"
import { saldoVenta, METODOS_PAGO, ventasPendientesPaciente } from "../utilidades/ventas"
import { registrarLog } from "../utilidades/logs"
import { hoyISO, fechaAISO } from "../utilidades/disponibilidad"
import { controlesSinAgendar, diaHabilMasCercano, asignadoDelControl } from "../utilidades/controles"
import CampoFecha from "../componentes/CampoFecha"
import { ModalAtencion, ModalHistoriaClinica, ModalDatosPaciente } from "../componentes/AtencionPaciente"
import { Despliegue, PanelUltimaConsulta, PanelCorreccion, PanelControl, PanelCompras, PanelPuntaje, PanelReferidos, PanelCumple, PanelCitasEstado } from "../componentes/DetallesResumen"
import { escribirParam, leerParam } from "../utilidades/urlEstado"
import SelectorBuscable from "../componentes/SelectorBuscable"
import ElegirVentaOrdenModal from "../componentes/ElegirVentaOrdenModal"
import { fechaProximoControl, diasVencido, esInactivo, diasDesdeUltimaVisita, contarConsultas, esClienteFrecuente, contarReferidos, listarReferidos, ordenarPorFechaYCreacion, diasParaCumpleanos } from "../utilidades/fidelizacion"
import { crearRegistroPaciente, primerNombre } from "../utilidades/pacientes"
import { MENSAJE_SIN_PERMISO, esErrorSinPermiso, fueBloqueadoPorPermiso } from "../utilidades/permisos"
import { supabase } from "../lib/supabaseClient"
import { INK, ACCION_VER, ACCION_CONFIRMAR } from "@/lib/tema"

// ─── Paleta de firma (consistente con login / agenda / dashboard) ───
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)" // cian → azul

// Búsqueda insensible a tildes/mayúsculas — "jose" debe encontrar "José" sin
// que recepción tenga que escribir el acento exacto.
const normalizarTexto = (t) => (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

// Paleta de acentos para el avatar de iniciales — antes todos los pacientes
// compartían el mismo degradado azul, lo que hacía la tabla más difícil de
// escanear de un vistazo. Determinístico por nombre (mismo paciente = mismo
// color siempre), no aleatorio en cada render.
const PALETA_AVATAR = [
  "linear-gradient(135deg,#22D3EE,#2563EB)",
  "linear-gradient(135deg,#34d399,#059669)",
  "linear-gradient(135deg,#f472b6,#db2777)",
  "linear-gradient(135deg,#fbbf24,#d97706)",
  "linear-gradient(135deg,#a78bfa,#7c3aed)",
  "linear-gradient(135deg,#fb923c,#ea580c)",
  "linear-gradient(135deg,#38bdf8,#0369a1)",
]
const colorAvatar = (nombre) => {
  let h = 0
  for (let i = 0; i < (nombre || "").length; i++) h = (h * 31 + nombre.charCodeAt(i)) >>> 0
  return PALETA_AVATAR[h % PALETA_AVATAR.length]
}

// "De alta" es un estado positivo/resuelto (el ing lo pidió como cierre de
// tratamiento, punto 2.1), no algo que requiera atención — no comparte el
// ámbar que el resto de la fila usa para "esto necesita revisión" (pago
// pendiente, control vencido, etc.).
const claseBadgeEstadoClinico = (estado) =>
  estado === "Activo" ? "bg-emerald-50 text-emerald-700" : estado === "De alta" ? "bg-slate-100 text-slate-600" : "bg-amber-50 text-amber-700"

// Estado de corrección: ¿la corrección actual (anteojos/lentes) logra buena agudeza visual?
// Es el dato clínicamente accionable — un error refractivo no se autocorrige, se maneja con
// anteojos, lentes de contacto o cirugía refractiva; esto mide si ese manejo está funcionando.
// "Sin evaluación" = el paciente nunca tuvo una consulta registrada.
// "Sin evaluar" = tuvo consulta, pero el optómetra no seleccionó "AV con
// lentes" en ningún ojo (ver evaluarCorreccion en ConsultaMedica.jsx) — son
// dos cosas distintas a propósito, no se funden en una sola categoría.
const CORRECCION = {
  "Bien corregido": { label: "Bien corregido", icon: CheckCircle, clase: "bg-emerald-50 text-emerald-700 border-emerald-200/60" },
  "Requiere ajuste": { label: "Requiere ajuste", icon: AlertCircle, clase: "bg-red-50 text-red-700 border-red-200/60" },
  "Sin evaluar": { label: "Sin agudeza visual con lentes registrada", icon: Minus, clase: "bg-slate-100 text-slate-600 border-slate-200/60" },
  "Sin evaluación": { label: "Sin consulta", icon: HelpCircle, clase: "bg-amber-50 text-amber-700 border-amber-200/60" },
}

// Colores (hex) para las tarjetas-resumen de corrección
const CORRECCION_COLOR = {
  "Bien corregido": { fg: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
  "Requiere ajuste": { fg: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  "Sin evaluar": { fg: "#475569", bg: "#f1f5f9", border: "#e2e8f0" },
  "Sin evaluación": { fg: "#d97706", bg: "#fffbeb", border: "#fde68a" },
}

// Tendencia de graduación: dato de contexto secundario (no implica mejoría/empeoramiento por sí solo)
const TENDENCIA = {
  Disminuyó: { label: "Disminuyó", icon: TrendingDown, fg: "#0891b2" },
  Aumentó: { label: "Aumentó", icon: TrendingUp, fg: "#dc2626" },
  "Sin cambios": { label: "Sin cambios", icon: Minus, fg: "#64748b" },
}

// Miniatura de un adjunto clínico — el bucket es privado (a diferencia de
// logos), así que no hay URL pública fija: se pide una firmada al montar.
function MiniaturaAdjunto({ path }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let vivo = true
    supabase?.storage.from("consultas-adjuntos").createSignedUrl(path, 3600).then(({ data }) => {
      if (vivo && data?.signedUrl) setUrl(data.signedUrl)
    })
    return () => { vivo = false }
  }, [path])
  if (!url) return <div className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-slate-100"><ImageIcon size={16} className="text-slate-300" /></div>
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200/60">
      <img src={url} alt="Adjunto clínico" className="h-full w-full object-cover" />
    </a>
  )
}

export default function Pacientes({ usuario, onAviso, pases = [], setPases, ordenesLab = [], setOrdenesLab, abonos = [], equipo = [], setVista, cargaInicial = false, pacientes = [], setPacientes, consultas = [], setConsultas, citas = [], setCitas, disponibilidad, motivosConsulta = [], parametrizacion, inventario = [], setInventario, categoriasInventario = [], setCategoriasInventario, ventas = [], setVentas, facturasVenta = [], setFacturasVenta, accionInicial, onAccionInicialConsumida, overlaySolo = false, onOverlayCerrado, onIrAFichaClinica, solicitudesEliminacion = [], marcarSolicitudEliminacionAtendida, marcarMedidasAtendidas }) {
  const opticaId = usuario?.opticaId
  // Estados del formulario (solo datos básicos personales)
  const [nombre, setNombre] = useState("")
  const [cedula, setCedula] = useState("")
  const [telefono, setTelefono] = useState("")
  const [correo, setCorreo] = useState("")
  const [fechaNacimiento, setFechaNacimiento] = useState("")
  const [referidoPor, setReferidoPor] = useState("")
  const [erroresForm, setErroresForm] = useState({})
  const [guardandoPaciente, setGuardandoPaciente] = useState(false)

  // Modales
  const [modalAbierto, setModalAbierto] = useState(false)
  const [idEditando, setIdEditando] = useState(null)
  const [pacienteAEliminar, setPacienteAEliminar] = useState(null)
  // Qué puede hacer quien tiene la sesión (la base lo exige de todos modos; aquí solo se muestran u ocultan los botones).
  const puedeCrearPaciente = puede(usuario, "pacientes", "crear")
  const puedeEditarPaciente = puede(usuario, "pacientes", "editar")
  const puedeEliminar = puede(usuario, "pacientes", "eliminar")
  const puedeAgendar = puede(usuario, "citas", "crear")
  // Atender = abrir la ficha clínica para registrar una consulta: exige consultas "crear".
  const puedeAtender = puede(usuario, "consultas", "crear")
  const puedeVender = puede(usuario, "ventas", "crear")
  const puedeEditarCita = puede(usuario, "citas", "editar")
  // Enviar un mensaje al paciente es una acción del CRM: pide "CRM: crear".
  const puedeMensaje = puede(usuario, "crm", "crear")
  const puedeEditarVentas = puede(usuario, "ventas", "editar")
  const puedeAnular = puede(usuario, "ventas", "eliminar")
  const [eliminandoPaciente, setEliminandoPaciente] = useState(false)

  // Filtros
  // Búsqueda: el campo de texto se actualiza al instante (para que teclear se
  // sienta fluido), pero el filtro real (`busqueda`) espera un debounce corto
  // — evita recalcular/repintar la tabla en cada tecla cuando alguien escribe
  // rápido. `buscando` queda en true durante esa ventana y reutiliza las filas
  // esqueleto de la carga inicial en vez de parpadear la tabla ya cargada.
  const [busquedaInput, setBusquedaInput] = useState("")
  const [busqueda, setBusqueda] = useState("")
  const [buscando, setBuscando] = useState(false)
  useEffect(() => {
    if (busquedaInput === busqueda) return
    setBuscando(true)
    const t = setTimeout(() => { setBusqueda(busquedaInput); setBuscando(false) }, 220)
    return () => clearTimeout(t)
  }, [busquedaInput]) // eslint-disable-line react-hooks/exhaustive-deps
  const inputBusquedaRef = useRef(null)
  const [filtroEstado, setFiltroEstado] = useState("Todos")
  const [filtroCorreccion, setFiltroCorreccion] = useState("Todos")
  const [filtroDesde, setFiltroDesde] = useState("")
  const [filtroHasta, setFiltroHasta] = useState("")
  // Filtros rápidos (badges) que no se derivan de estadoCorreccion: excluyentes
  // entre sí y con la tarjeta de corrección activa, para no combinar dos
  // filtros a la vez sin que quede claro cuál está aplicado.
  const [filtroRapido, setFiltroRapido] = useState("Todos")

  // Atajos de teclado: "/" o Ctrl+K enfocan la búsqueda al instante — pedido
  // explícito, mismo patrón que la paleta de comandos del resto del sistema.
  // Se ignora si ya se está escribiendo en algún campo (para no robarle la
  // "/" a un input de texto) o si hay un modal abierto encima de la tabla.
  useEffect(() => {
    if (overlaySolo) return
    const onKeyDown = (e) => {
      const enCampo = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)
      const esCtrlK = (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k"
      const esBarra = e.key === "/" && !enCampo
      if (!esCtrlK && !esBarra) return
      if (modalAbierto || pacienteHistorial || pacienteAEliminar || cuentaPaciente || agendarPara) return
      e.preventDefault()
      inputBusquedaRef.current?.focus()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }) // sin deps: siempre lee el estado más reciente de los modales

  // Menú "más acciones" por fila de la tabla — se renderiza en un portal a
  // document.body con posición fija calculada desde el botón, en vez de
  // quedar anidado en el contenedor de la tabla, porque ese contenedor
  // scrollea horizontalmente (overflow-x-auto), lo que en la mayoría de
  // navegadores también activa overflow-y:auto y corta/atraviesa el menú con
  // su propio scrollbar en vez de dejarlo flotar limpio encima del contenido
  // (mismo bug y misma solución que "más acciones" en SuperadminPanel.jsx).
  const [menuAccionesId, setMenuAccionesId] = useState(null)
  const [menuAccionesPos, setMenuAccionesPos] = useState(null)
  const menuAccionesRef = useRef(null)
  const abrirMenuAcciones = (id, e) => {
    if (menuAccionesId === id) { setMenuAccionesId(null); return }
    const rect = e.currentTarget.getBoundingClientRect()
    setMenuAccionesPos({ top: rect.bottom + 6, left: rect.right - 208 })
    setMenuAccionesId(id)
  }
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

  const [notificacion, setNotificacion] = useState("")
  const [bannerError, setBannerError] = useState("")

  // Cuenta de acceso (clave temporal)
  const [cuentaPaciente, setCuentaPaciente] = useState(null)
  const [claveGen, setClaveGen] = useState("")
  const [copiadoCred, setCopiadoCred] = useState(false)

  // Historial clínico (consultas y citas del paciente)
  const [pacienteHistorial, setPacienteHistorial] = useState(null)
  // Selector de cita al entrar a la ficha clínica desde el perfil (pedido del
  // ing, reunión 29 sept.): { paciente, citas } cuando hay que elegir, o null.
  const [seleccionCitaPara, setSeleccionCitaPara] = useState(null)
  // D2 (reunión 29 sept.): igual que "Atender" en Citas médicas, elegir una
  // cita de un paciente web sin confirmar por recepción pide confirmar sus
  // datos primero — { paciente, citaId } o null. Reutiliza
  // ConfirmarDatosPacienteModal en vez de duplicar ese formulario acá.
  const [confirmarDatosPara, setConfirmarDatosPara] = useState(null)
  // Edad calculada desde fecha_nacimiento — mismo cálculo que ya usa
  // ConsultaMedica.jsx para la receta impresa, ahora también visible en el
  // encabezado del expediente (pedido explícito de Diego).
  const edadPaciente = useMemo(() => {
    const fn = pacienteHistorial?.fecha_nacimiento
    if (!fn) return null
    const nac = new Date(fn)
    if (isNaN(nac.getTime())) return null
    const hoy = ahoraEcuador()
    let e = hoy.getFullYear() - nac.getFullYear()
    const m = hoy.getMonth() - nac.getMonth()
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) e--
    return e
  }, [pacienteHistorial])
  const [tabHistorial, setTabHistorial] = useState("citas")
  const [verHistoriaClinica, setVerHistoriaClinica] = useState(false)
  // El perfil abierto guardaba una copia del paciente: al crear su cuenta o editar sus datos seguía mostrando lo anterior ("Sin cuenta").
  // Se mantiene al día con la lista.
  useEffect(() => {
    if (!pacienteHistorial) return
    const actual = pacientes.find((p) => p.id === pacienteHistorial.id)
    if (actual && actual !== pacienteHistorial) setPacienteHistorial(actual)
  }, [pacientes]) // eslint-disable-line react-hooks/exhaustive-deps
  // Escape cierra la vista de perfil del paciente (atajo de teclado).
  useEffect(() => {
    if (!pacienteHistorial) return
    // Con una ventana abierta encima (atención, mensaje...), Escape cierra solo esa ventana, no el perfil.
    const onKeyDown = (e) => { if (e.key === "Escape" && !document.querySelector("[aria-modal=\"true\"], [data-popover-abierto]")) setPacienteHistorial(null) }
    window.addEventListener("keydown", onKeyDown, true)
    return () => window.removeEventListener("keydown", onKeyDown, true)
  }, [pacienteHistorial])
  // El perfil abierto y su pestaña viven en la URL: recargar deja el perfil abierto, y "atrás" vuelve a la lista.
  const sincronizarUrl = !overlaySolo
  const idPerfil = pacienteHistorial?.id ?? null
  const perfilVisto = useRef(false)
  const [perfilNoEncontrado, setPerfilNoEncontrado] = useState(false)
  // Al recargar con un perfil en la URL, se espera a los datos mostrando el esqueleto del perfil, no un instante la lista.
  const abriendoPerfil = sincronizarUrl && !!leerParam("paciente") && !pacienteHistorial && !perfilVisto.current && !perfilNoEncontrado
  useEffect(() => {
    if (!sincronizarUrl) return
    const enUrl = leerParam("paciente")
    if (idPerfil) {
      perfilVisto.current = true
      if (enUrl !== String(idPerfil)) escribirParam("paciente", String(idPerfil), { empujar: true, estado: { seccion: "pacientes", perfilPaciente: true } })
    } else if (enUrl && perfilVisto.current) {
      // Se cerró el perfil: si esa pantalla la empujó este módulo, "atrás" la quita del historial; si no, solo se limpia la URL.
      if (window.history.state?.perfilPaciente) window.history.back()
      else escribirParam("paciente", null)
    }
  }, [idPerfil]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (sincronizarUrl && idPerfil) escribirParam("tab", tabHistorial === "citas" ? null : tabHistorial)
  }, [tabHistorial, idPerfil]) // eslint-disable-line react-hooks/exhaustive-deps
  // Atrás/adelante del navegador, y volver desde la ficha clínica: abre o cierra el perfil según la URL.
  useEffect(() => {
    if (!sincronizarUrl) return undefined
    const abrirSegunUrl = () => {
      const id = leerParam("paciente")
      if (!id) { setPacienteHistorial(null); return }
      const paciente = pacientes.find((x) => String(x.id) === id)
      if (!paciente) {
        // Ya cargó la lista y ese paciente no existe (o no se puede ver): se vuelve a la lista.
        if (!cargaInicial) { escribirParam("paciente", null); setPerfilNoEncontrado(true) }
        return
      }
      const tab = leerParam("tab")
      setPacienteHistorial(paciente)
      setTabHistorial(["citas", "resumen", "pagos", "ordenes"].includes(tab) ? tab : "citas")
    }
    if (!perfilVisto.current && !pacienteHistorial) abrirSegunUrl()
    window.addEventListener("popstate", abrirSegunUrl)
    return () => window.removeEventListener("popstate", abrirSegunUrl)
  }, [pacientes, cargaInicial]) // eslint-disable-line react-hooks/exhaustive-deps
  // "Nueva venta" (Ronda 4 del flujo de atención): antes había dos botones,
  // "Vender producto" (un producto, pago directo, tabla `ventas`) y "Nueva
  // factura" (varias líneas, cuotas, tabla `facturas_venta`). Una venta de un
  // producto es una factura de una línea, así que se fundieron en uno solo que
  // abre el mismo panel de cobro que usa la ficha clínica. Las ventas viejas
  // (tabla `ventas`) se siguen mostrando y cobrando en cuotas como siempre.
  const [mostrarFactura, setMostrarFactura] = useState(false)
  // Venta abierta desde la lista de pacientes: el cobro se abre encima de la lista, sin entrar al perfil.
  const [ventaRapidaPara, setVentaRapidaPara] = useState(null)
  const [elegirVentaOrden, setElegirVentaOrden] = useState(false)
  const [verDatosPaciente, setVerDatosPaciente] = useState(false)
  useEffect(() => { setVerDatosPaciente(false) }, [pacienteHistorial?.id])
  useEffect(() => { if (!pacienteHistorial) setElegirVentaOrden(false) }, [pacienteHistorial])
  const pacienteVenta = ventaRapidaPara || pacienteHistorial
  useEffect(() => { if (!pacienteHistorial) setMostrarFactura(false) }, [pacienteHistorial])
  // Líneas a precargar en ComprobanteVentaModal cuando se vende la receta
  // directo desde el encabezado del perfil (undefined = abre vacía, como el
  // botón manual "Nueva venta" de la pestaña Productos y servicios).
  const [facturaLineaInicial, setFacturaLineaInicial] = useState(undefined)

  // Abonar, anular, crear la orden y registrar la factura electrónica de una venta se manejan con el mismo
  // hook que usa el módulo de Ventas (Bloque E); aquí solo se abren desde el perfil del paciente.
  const ventasApi = useVentas({
    usuario, parametrizacion, pacientes, consultas, pases, setPases, setOrdenesLab, facturasVenta, setFacturasVenta, abonos, ventas, setInventario,
    notificar: (m) => mostrarNotif(m), avisarError: (m) => mostrarError(m),
  })
  const { registrarFactura } = ventasApi
  const { setAbonoPara, setAnularPara, setOrdenParaVenta, setFacturaElectronicaPara, setVentaCola } = ventasApi

  // Cobro pendiente (Ronda 4): ficha guardada con "Más tarde" en el panel de
  // cobro. Se cobra con el mismo panel; al cobrar, la cita (si la hay) pasa a
  // Atendida.
  const [cobrandoPendiente, setCobrandoPendiente] = useState(null) // { consulta, cita } | null
  useEffect(() => { if (!pacienteHistorial) setCobrandoPendiente(null) }, [pacienteHistorial])
  const alCobrarPendiente = async (factura) => {
    registrarFactura(factura)
    const cita = cobrandoPendiente?.cita
    if (cita) {
      const { error } = await marcarCitaAtendidaDb(supabase, cita.id)
      if (!error) setCitas?.((prev) => prev.map((c) => (c.id === cita.id ? { ...c, estado: "Atendida" } : c)))
    }
    mostrarNotif(cita ? "Cobro registrado · cita atendida." : "Cobro registrado.")
  }


  const marcarVentaPagada = async (venta) => {
    const cuotasFinales = venta.cuotasTotales || venta.cuotasPagadas
    if (supabase) {
      const { data: actualizadas, error } = await supabase.from("ventas").update({ estado: "completado", cuotas_pagadas: cuotasFinales }).eq("id", venta.id).select()
      if (fueBloqueadoPorPermiso({ error, data: actualizadas })) { mostrarError(MENSAJE_SIN_PERMISO); return }
      if (error) { mostrarError("No se pudo registrar el pago. Revisa tu conexión e intenta de nuevo."); return }
    }
    setVentas?.((prev) => prev.map((v) => (v.id === venta.id ? { ...v, estado: "completado", cuotasPagadas: cuotasFinales } : v)))
  }

  const registrarCuotaPagada = async (venta) => {
    const nuevasCuotas = (venta.cuotasPagadas || 0) + 1
    const completado = venta.cuotasTotales != null && nuevasCuotas >= venta.cuotasTotales
    const estadoNuevo = completado ? "completado" : "pendiente"
    if (supabase) {
      const { data: actualizadas, error } = await supabase.from("ventas").update({ cuotas_pagadas: nuevasCuotas, estado: estadoNuevo }).eq("id", venta.id).select()
      if (fueBloqueadoPorPermiso({ error, data: actualizadas })) { mostrarError(MENSAJE_SIN_PERMISO); return }
      if (error) { mostrarError("No se pudo registrar el pago. Revisa tu conexión e intenta de nuevo."); return }
    }
    setVentas?.((prev) => prev.map((v) => (v.id === venta.id ? { ...v, cuotasPagadas: nuevasCuotas, estado: estadoNuevo } : v)))
  }

  // Agendar cita desde el perfil del paciente
  const [agendarPara, setAgendarPara] = useState(null)
  const [agendarFecha, setAgendarFecha] = useState("")
  const [agendarHora, setAgendarHora] = useState("")
  const [agendarMotivo, setAgendarMotivo] = useState("")
  // A quién se asigna la cita; con "Control sin agendar" arranca en quien atendió la consulta.
  const [agendarAsignado, setAgendarAsignado] = useState("")
  const [errorAgendar, setErrorAgendar] = useState("")
  // "Llegó en un horario diferente": hora real y duración. Con la cita de hoy, al confirmar pasa directo a la ficha.
  const [agendarHoraPersonalizada, setAgendarHoraPersonalizada] = useState(false)
  const [agendarHoraCustom, setAgendarHoraCustom] = useState("")
  const [agendarDuracion, setAgendarDuracion] = useState(disponibilidad?.duracionCita || 40)
  const [errorHorarioAgendar, setErrorHorarioAgendar] = useState("")
  const atenderInmediato = esAtencionInmediata({ horaPersonalizada: agendarHoraPersonalizada, fecha: agendarFecha, puedeAtender })
  const [confirmandoCita, setConfirmandoCita] = useState(false)
  const [guardandoCita, setGuardandoCita] = useState(false)

  // "Enviar mensaje" desde el perfil (reunión 29 sept., punto 4) — reusa el
  // mismo mecanismo de WhatsApp que ya usa CRM.jsx (sin envío automático:
  // abre wa.me con el texto precargado), ahora compartido vía
  // utilidades/whatsapp.js en vez de estar reimplementado ahí y en
  // Citas.jsx.
  // Atención abierta de un día anterior que se quiere dejar de atender (desde el perfil).
  const [dejarCita, setDejarCita] = useState(null)
  const [mensajePara, setMensajePara] = useState(null)
  const [textoMensaje, setTextoMensaje] = useState("")
  // Desde aquí se escribe al paciente aunque los envíos automáticos del CRM
  // estén apagados: el mensaje es manual (se abre WhatsApp), queda marcado como
  // "contactado hoy" en el CRM y registrado en Actividad.
  const nombreOptica = usuario?.opticaNombre || "tu óptica"
  const plantillasMensaje = (paciente) => {
    const control = fechaProximoControl(paciente, consultas)
    const cumple = diasParaCumpleanos(paciente.fecha_nacimiento || paciente.fechaNacimiento)
    return [
      { id: "saludo", etiqueta: "Saludo", texto: `Hola ${primerNombre(paciente.nombre)}, te escribimos de ${nombreOptica}. ` },
      ...(control ? [{ id: "control", etiqueta: "Recordar control", texto: `Hola ${primerNombre(paciente.nombre)}, te escribimos de ${nombreOptica}. Te recordamos que tu próximo control visual es el ${formatoFecha(control, "largoSinDia")}. ¡Escríbenos para agendar tu cita!` }] : []),
      ...(cumple != null && cumple <= 30 ? [{ id: "cumple", etiqueta: "Cumpleaños", texto: `Hola ${primerNombre(paciente.nombre)}, ¡de parte de todo el equipo de ${nombreOptica} te deseamos un feliz cumpleaños! ` }] : []),
    ]
  }
  const abrirMensaje = (paciente) => {
    setMensajePara(paciente)
    setTextoMensaje(plantillasMensaje(paciente)[0].texto)
  }
  const tieneCorreoValido = (pa) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pa?.correo || "")
  const enviarMensajeGmail = () => {
    const asunto = `Mensaje de ${nombreOptica}`
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(mensajePara.correo)}&su=${encodeURIComponent(asunto)}&body=${encodeURIComponent(textoMensaje)}`, "_blank")
    marcarContactadoHoy(mensajePara.id)
    registrarLog(usuario, "crm", "Escribió un correo desde el perfil del paciente", mensajePara.nombre)
    setMensajePara(null)
  }
  const enviarMensajeWhatsApp = () => {
    window.open(linkWhatsApp(mensajePara.telefono, textoMensaje), "_blank")
    marcarContactadoHoy(mensajePara.id)
    registrarLog(usuario, "crm", "Envió un mensaje por WhatsApp desde el perfil del paciente", mensajePara.nombre)
    setMensajePara(null)
  }

  // Ofrecer abrir la ficha clínica justo después de crear un paciente nuevo —
  // evita el paso extra de ir a buscarlo de nuevo en Ficha clínica.
  const [pacienteRecienCreado, setPacienteRecienCreado] = useState(null)

  const mostrarNotif = (texto) => {
    if (overlaySolo) { onAviso?.(texto); return }
    setNotificacion(texto)
    setTimeout(() => setNotificacion(""), 3500)
  }

  const mostrarError = (texto) => {
    setBannerError(texto)
    setTimeout(() => setBannerError(""), 4500)
  }

  // ── Cuenta de acceso del paciente ──
  const generarClave = () => generarClaveTemporal()

  const abrirCuenta = (paciente) => {
    setCuentaPaciente(paciente)
    // clave_temporal en la base es un hash bcrypt desde la migración 0023 (nunca
    // texto plano) — reusarlo aquí mostraría el hash en vez de una clave que el
    // paciente pueda escribir. Siempre se genera una clave temporal nueva.
    setClaveGen(generarClave())
    setCopiadoCred(false)
  }

  const regenerarClave = () => {
    setClaveGen(generarClave())
    setCopiadoCred(false)
  }

  const copiarCredenciales = () => {
    const usuario = cuentaPaciente?.cedula || cuentaPaciente?.correo || ""
    navigator.clipboard.writeText(`Usuario: ${usuario}\nClave temporal: ${claveGen}`)
    setCopiadoCred(true)
    setTimeout(() => setCopiadoCred(false), 2000)
  }

  const [guardandoCuenta, setGuardandoCuenta] = useState(false)

  const guardarCuenta = async () => {
    if (!cuentaPaciente) return
    const eraNueva = !cuentaPaciente.tieneCuenta
    if (supabase && opticaId) {
      setGuardandoCuenta(true)
      const { error } = await supabase.rpc("establecer_clave_paciente", {
        p_paciente_id: cuentaPaciente.id,
        p_usuario: cuentaPaciente.cedula,
        p_clave: claveGen,
      })
      setGuardandoCuenta(false)
      if (error) {
        mostrarNotif("No se pudo guardar la cuenta: " + error.message)
        return
      }
    }
    setPacientes(
      pacientes.map((p) =>
        p.id === cuentaPaciente.id ? { ...p, tieneCuenta: true, usuario: p.cedula, claveTemporal: claveGen } : p,
      ),
    )
    mostrarNotif(eraNueva ? "Cuenta de acceso creada para el paciente." : "Clave temporal restablecida.")
    setCuentaPaciente(null)
  }

  const limpiarFormulario = () => {
    setNombre("")
    setCedula("")
    setTelefono("")
    setCorreo("")
    setFechaNacimiento("")
    setReferidoPor("")
    setIdEditando(null)
    setErroresForm({})
    setGuardandoPaciente(false)
  }

  const validarFormularioPaciente = () => {
    const errs = {}
    if (!esNombreValido(nombre)) errs.nombre = "Ingresa un nombre válido (solo letras)."
    if (!esCedulaValida(cedula)) errs.cedula = "Esa cédula no es válida — revisa los dígitos."
    else if (pacientes.some((p) => p.id !== idEditando && p.cedula === cedula)) errs.cedula = "Ya existe un paciente registrado con esa cédula."
    if (!esTelefonoValido(telefono)) errs.telefono = "El teléfono debe tener entre 7 y 10 dígitos."
    if (!esEmailValido(correo)) errs.correo = "Ingresa un correo válido (ej. nombre@dominio.com)."
    // Igual que el formulario público (AgendarCitaPublica.jsx): la fecha de
    // nacimiento no es un dato "extra" — es la fuente de la edad que se
    // muestra en todo el expediente, así que recepción no puede omitirla
    // como sí puede con el correo/teléfono (que tienen "Sin Correo"/"Sin
    // Teléfono" como relleno válido).
    if (!fechaNacimiento) errs.fechaNacimiento = "La fecha de nacimiento es obligatoria."
    return errs
  }

  const abrirCrear = () => {
    limpiarFormulario()
    setModalAbierto(true)
  }

  // Vacío inteligente de la búsqueda: precarga el formulario con lo que ya
  // se escribió — cédula si el texto es todo dígitos, nombre si no — en vez
  // de que la persona tenga que copiarlo de nuevo a mano.
  const abrirCrearConPrellenado = (query) => {
    limpiarFormulario()
    const texto = (query || "").trim()
    if (/^[0-9]+$/.test(texto)) {
      setCedula(filtrarSoloNumeros(texto, 10))
    } else {
      const letras = filtrarSoloLetras(texto)
      if (letras.trim()) setNombre(letras)
    }
    setModalAbierto(true)
    mostrarNotif(`Formulario prellenado con "${texto}".`)
  }

  const abrirEdicion = (paciente) => {
    setIdEditando(paciente.id)
    setNombre(paciente.nombre)
    setCedula(paciente.cedula)
    setTelefono(paciente.telefono === "Sin Teléfono" ? "" : paciente.telefono)
    setCorreo(paciente.correo === "Sin Correo" ? "" : paciente.correo)
    setFechaNacimiento(paciente.fecha_nacimiento || paciente.fechaNacimiento || "")
    setReferidoPor(paciente.referidoPor || "")
    setModalAbierto(true)
  }

  const cerrarModal = () => {
    setModalAbierto(false)
    limpiarFormulario()
  }

  // Acción disparada desde otro módulo (ej. "Búsqueda rápida" en Inicio) — abre el mismo
  // modal que se usaría si el optómetra hiciera clic aquí mismo, en vez de tener una copia aparte.
  useEffect(() => {
    if (!accionInicial) return
    if (accionInicial.accion === "filtrar") {
      // Atajo desde Inicio (ej. "Pacientes sin atender"): abre esta lista ya filtrada.
      setFiltroCorreccion(accionInicial.correccion ?? "Todos")
      setFiltroRapido(accionInicial.rapido ?? "Todos")
    } else if (accionInicial.accion === "crear") {
      // Atajo "Gestionar pacientes" del Dashboard — no referencia a ningún
      // paciente existente, así que no pasa por la búsqueda por id de abajo.
      abrirCrear()
    } else {
      const paciente = pacientes.find((p) => p.id === accionInicial.pacienteId)
      // Si la lista aún se está cargando (enlace abierto en otra pestaña), se
      // espera en vez de descartar la acción.
      if (!paciente && cargaInicial) return
      if (paciente) {
        if (accionInicial.accion === "historial") { setPacienteHistorial(paciente); setTabHistorial(["citas", "resumen", "pagos", "ordenes"].includes(leerParam("tab")) ? leerParam("tab") : "citas") }
        else if (accionInicial.accion === "editar") abrirEdicion(paciente)
        else if (accionInicial.accion === "eliminar" && puedeEliminar) setPacienteAEliminar(paciente)
        else if (accionInicial.accion === "agendar") abrirAgendar(paciente)
      }
    }
    onAccionInicialConsumida?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accionInicial, cargaInicial])

  const manejarEnvio = async (e) => {
    e.preventDefault()
    const errs = validarFormularioPaciente()
    setErroresForm(errs)
    if (Object.keys(errs).length > 0) return

    // F4: resuelve el texto libre de "Referido por" a un paciente real si
    // coincide exacto (sin mayúsculas/tildes de más) con uno ya registrado
    // — así contarReferidos() puede emparejar por id en vez de por nombre.
    // No es él mismo (un paciente no puede referirse a sí mismo) y, si no
    // hay coincidencia, queda en null (el texto se guarda igual — puede
    // ser alguien que no es paciente del sistema).
    const referidoTexto = (referidoPor || "").trim()
    const referidoPorIdResuelto = referidoTexto
      ? pacientes.find((p) => p.id !== idEditando && (p.nombre || "").trim().toLowerCase() === referidoTexto.toLowerCase())?.id || null
      : null

    setGuardandoPaciente(true)
    if (idEditando) {
      const cambios = {
        nombre,
        cedula,
        telefono: telefono || "Sin Teléfono",
        correo: correo || "Sin Correo",
        fecha_nacimiento: fechaNacimiento || null,
        referidoPor: referidoPor || "",
        referidoPorId: referidoPorIdResuelto,
      }
      if (supabase && opticaId) {
        const { data: actualizados, error: errorUpdate } = await supabase.from("pacientes").update({ nombre: cambios.nombre, cedula: cambios.cedula, telefono: cambios.telefono, correo: cambios.correo, fecha_nacimiento: cambios.fecha_nacimiento, referido_por: cambios.referidoPor || null, referido_por_id: cambios.referidoPorId }).eq("id", idEditando).select()
        if (fueBloqueadoPorPermiso({ error: errorUpdate, data: actualizados })) {
          setGuardandoPaciente(false)
          mostrarError(MENSAJE_SIN_PERMISO)
          return
        }
        if (errorUpdate) {
          setGuardandoPaciente(false)
          mostrarError("No se pudo actualizar el expediente. Revisa tu conexión e intenta de nuevo.")
          return
        }
      }
      setPacientes(pacientes.map((p) => (p.id === idEditando ? { ...p, ...cambios } : p)))
      // Las citas y consultas guardan una copia del nombre y los datos de contacto: se actualizan para que se vea igual en todas las pantallas.
      setCitas?.((prev) => prev.map((c) => (c.pacienteId === idEditando ? { ...c, paciente: cambios.nombre, cedula: cambios.cedula, telefono: cambios.telefono, correo: cambios.correo } : c)))
      setConsultas?.((prev) => prev.map((c) => (c.pacienteId === idEditando ? { ...c, paciente: cambios.nombre } : c)))
      registrarLog(usuario, "pacientes", "Editó el expediente de un paciente", cambios.nombre)
      mostrarNotif("Expediente del paciente actualizado correctamente.")
    } else {
      // La alta en sí (insert + shape) vive en utilidades/pacientes.js,
      // compartida con Citas.jsx, para no tener dos copias que puedan
      // desincronizarse (p. ej. el bug de zona horaria de fechaRegistro que
      // hubo que corregir en ambas por separado antes de unificar).
      const { paciente: nuevoPaciente, error: errorInsert } = await crearRegistroPaciente(supabase, opticaId, {
        nombre, cedula, telefono, correo, fechaNacimiento, referidoPor, referidoPorId: referidoPorIdResuelto,
      })
      if (errorInsert) {
        setGuardandoPaciente(false)
        mostrarError("No se pudo registrar el paciente. Revisa tu conexión e intenta de nuevo.")
        return
      }

      setPacientes([nuevoPaciente, ...pacientes])
      registrarLog(usuario, "pacientes", "Registró un paciente nuevo", nuevoPaciente.nombre)
      mostrarNotif("Paciente ingresado al sistema exitosamente.")
      cerrarModal()
      setPacienteRecienCreado(nuevoPaciente)
      return
    }

    cerrarModal()
  }

  // Eliminar en cascada: antes esto sólo borraba el registro de contacto del
  // paciente y dejaba sus citas/consultas huérfanas para siempre (apuntando a un
  // pacienteId que ya no existe, invisibles pero nunca realmente borradas).
  const perteneceAPaciente = (registro, paciente) =>
    (paciente.id != null && registro.pacienteId === paciente.id) || registro.paciente === paciente.nombre

  // Eliminar = anonimizar (migración 0089): la base borra sus datos personales y conserva las
  // visitas, ventas y datos clínicos sin nombre. Solo el administrador; una sola transacción en la base.
  const confirmarEliminar = async () => {
    if (!pacienteAEliminar) return
    const paciente = pacienteAEliminar
    setEliminandoPaciente(true)
    if (supabase && opticaId) {
      const { error } = await supabase.rpc("anonimizar_paciente", { p_paciente_id: paciente.id })
      if (error) {
        mostrarError(esErrorSinPermiso(error) ? MENSAJE_SIN_PERMISO : /permiso para eliminar/i.test(error.message || "") ? "No tienes permiso para eliminar pacientes." : "No se pudo eliminar al paciente. Revisa tu conexión e intenta de nuevo.")
        setEliminandoPaciente(false)
        return
      }
    }
    const ANON = "Paciente anonimizado"
    setPacientes(pacientes.filter((p) => p.id !== paciente.id))
    setCitas?.(citas.map((c) => (perteneceAPaciente(c, paciente) ? { ...c, paciente: ANON, cedula: null, telefono: null, correo: null } : c)))
    setConsultas?.(consultas.map((c) => (perteneceAPaciente(c, paciente) ? { ...c, paciente: ANON } : c)))
    solicitudesEliminacion.filter((x) => x.pacienteId === paciente.id).forEach((x) => marcarSolicitudEliminacionAtendida?.(x.id))
    // El registro de actividad no guarda el nombre: la persona ya no es identificable.
    registrarLog(usuario, "pacientes", "Eliminó (anonimizó) a un paciente", "Paciente #" + String(paciente.id).slice(0, 8))
    mostrarNotif("Paciente eliminado. Sus datos personales se borraron y su historial quedó anonimizado.")
    setEliminandoPaciente(false)
    setPacienteAEliminar(null)
  }

  // Ir a la ficha clínica de un paciente. Si tiene citas sin terminar
  // (pendientes o ya en atención), el ing pidió (reunión 29 sept.) mostrar
  // primero esa lista para elegir cuál se está atendiendo, en vez de adivinar
  // "la de hoy" en silencio como antes — con varias citas pendientes, o una
  // pendiente para otro día, el vínculo se perdía. Al elegir, la ficha queda
  // vinculada a esa cita (motivo precargado, "En Atención", igual que
  // "Atender" en Citas médicas), para que guardarla también la marque
  // "Atendida" sin un paso aparte. Sin ninguna cita sin terminar, se abre sin
  // vincular, como antes. Un solo lugar para esta lógica: la usan el botón
  // grande del perfil y el atajo "Nueva ficha clínica" del menú de la tabla.
  const abrirFichaClinica = (paciente) => {
    if (!puedeAtender) { onAviso?.("No tienes permiso para atender pacientes."); return }
    setPacienteHistorial(null)
    const citasSinTerminar = citas
      .filter((c) => perteneceAPaciente(c, paciente) && (c.estado === "Pendiente" || c.estado === "En Atención"))
      .slice()
      .sort((a, b) => (a.fecha !== b.fecha ? (a.fecha < b.fecha ? -1 : 1) : minutosDesdeMedianoche(a.hora) - minutosDesdeMedianoche(b.hora)))
    if (citasSinTerminar.length > 0) {
      setSeleccionCitaPara({
        paciente,
        citas: citasSinTerminar.map((c) => ({ id: c.id, estado: c.estado, motivo: c.motivo, fechaEtiqueta: etiquetaFecha(c.fecha), horaEtiqueta: c.hora })),
      })
      return
    }
    abrirAtenderAhora(paciente)
  }

  // "Atender ahora": toda atención pasa por una cita. Abre el mismo modal "Agendar cita" del perfil con "Llegó en un
  // horario diferente" ya marcado y la hora actual; al confirmar crea la cita "En Atención" y entra a la ficha.
  const abrirAtenderAhora = (paciente) => {
    abrirAgendar(paciente, "")
    setAgendarFecha(hoyISO())
    setAgendarHoraPersonalizada(true)
    const ahora = ahoraEcuador()
    setAgendarHoraCustom(`${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`)
  }

  // D2 (reunión 29 sept.): mismo chequeo que "Atender" en Citas médicas —
  // un paciente de origen web sin confirmar por recepción no entra directo a
  // la ficha clínica, tenga o no una cita vinculada (elegida en
  // SeleccionarCitaModal o "Atender ahora"
  // pendiente). Un solo punto de entrada para no repetir el chequeo en cada
  // callback de arriba.
  const irAFichaConfirmandoSiHaceFalta = (paciente, citaId, motivo) => {
    if (!puedeAtender) { onAviso?.("No tienes permiso para atender pacientes."); return }
    if (paciente.origen === "paciente" && !paciente.confirmadoRecepcion) {
      setConfirmarDatosPara({ paciente, citaId, motivo })
      return
    }
    onIrAFichaClinica?.(paciente, citaId, motivo)
  }

  // Venta rápida desde la tabla — abre el perfil 360° directo en la pestaña
  // "Lentes/Productos" con el modal de cobro ya abierto, sin el paso
  // intermedio de entrar al perfil y navegar hasta ahí (regla de "cero
  // fricción" de la guía: precargar y saltar directo al cobro).
  const abrirVentaRapida = (paciente) => {
    setFacturaLineaInicial(undefined)
    setVentaRapidaPara(paciente)
  }

  // ── Agendar cita desde el perfil del paciente ──
  // `fechaSugerida` (opcional): la del control recomendado; se abre en el día hábil más cercano, y la hora la elige quien agenda.
  const abrirAgendar = (paciente, fechaSugerida = "", asignadoSugerido = "") => {
    setAgendarPara(paciente)
    setAgendarAsignado(asignadoSugerido)
    setAgendarFecha(fechaSugerida ? diaHabilMasCercano(fechaSugerida, disponibilidad, citas) || "" : "")
    setAgendarHora("")
    setAgendarMotivo(fechaSugerida ? motivosConsulta.find((m) => /control/i.test(m)) || "" : "")
    setErrorAgendar("")
    setAgendarHoraPersonalizada(false)
    setAgendarHoraCustom("")
    setAgendarDuracion(disponibilidad?.duracionCita || 40)
    setErrorHorarioAgendar("")
    setConfirmandoCita(false)
  }

  const validarYPedirConfirmacionCita = (e) => {
    e.preventDefault()
    if (!agendarMotivo) {
      setErrorAgendar("Selecciona el motivo del examen.")
      return
    }
    const { error: errorGeneral, errorHorario } = validarHorarioCita({ fecha: agendarFecha, hora: agendarHora, horaPersonalizada: agendarHoraPersonalizada, horaCustom: agendarHoraCustom, duracionCustom: agendarDuracion, disponibilidad, citas })
    if (errorGeneral) { setErrorAgendar(errorGeneral); return }
    if (errorHorario) { setErrorHorarioAgendar(errorHorario); return }
    setErrorHorarioAgendar("")
    setErrorAgendar("")
    // "Atender ahora": el formulario ya es la confirmación, se salta el segundo diálogo.
    if (atenderInmediato) { confirmarAgendarCita(); return }
    setConfirmandoCita(true)
  }

  const confirmarAgendarCita = async () => {
    setGuardandoCita(true)
    const paciente = agendarPara
    const { cita: nuevaCita, error } = await registrarCita(supabase, opticaId, paciente, {
      fecha: agendarFecha,
      hora: agendarHoraPersonalizada ? horaA12(agendarHoraCustom) : agendarHora,
      duracionMinutos: agendarHoraPersonalizada ? (Number(agendarDuracion) || disponibilidad?.duracionCita || 40) : null,
      motivo: agendarMotivo,
      asignadoA: agendarAsignado,
      estado: atenderInmediato ? "En Atención" : "Pendiente",
    })
    setGuardandoCita(false)
    if (error) {
      setConfirmandoCita(false)
      setErrorAgendar(error)
      return
    }
    setCitas?.([...citas, nuevaCita])
    registrarLog(usuario, "citas", atenderInmediato ? "Atendió a un paciente de inmediato" : "Agendó una cita", `${nuevaCita.paciente} · ${fechaLegible(nuevaCita.fecha)}`)
    setConfirmandoCita(false)
    setAgendarPara(null)
    if (atenderInmediato) {
      setPacienteHistorial(null)
      irAFichaConfirmandoSiHaceFalta(paciente, nuevaCita.id, nuevaCita.motivo)
      return
    }
    mostrarNotif(`Cita agendada para ${paciente.nombre}.`)
  }

  // Pacientes con algún saldo pendiente (venta puntual sin completar, o
  // factura multi-línea en "pendiente_pago") — para el badge "Pagos
  // pendientes" y el filtro rápido del mismo nombre.
  // Tendencia de graduación por paciente, calculada con la misma regla que la ficha clínica y el perfil
  // (entre sus dos consultas más recientes), no con el valor guardado al momento de cada consulta.
  // Pacientes listos para venta (pase "listo", sin vender ni descartar): se marcan en la lista con un enlace a la cola de Ventas.
  // Consultaron y no compraron (N4): su último pase quedó en "No compró", con el motivo.
  const noCompraron = useMemo(() => pacientesQueNoCompraron(pases, facturasVenta), [pases, facturasVenta])
  // Control que se dejó "para agendar después" (o cuya cita se canceló) y sigue sin cita.
  const sinAgendarPorPaciente = useMemo(() => new Map(controlesSinAgendar(pacientes, consultas, citas).map((x) => [x.paciente.id, x])), [pacientes, consultas, citas])
  const idsListosParaVenta = useMemo(() => new Set(pases.filter((p) => p.estado === "listo" && p.pacienteId).map((p) => p.pacienteId)), [pases])
  const puedeVerVentas = puede(usuario, "ventas", "ver")
  const tendenciaPorPaciente = useMemo(() => {
    const porPaciente = new Map()
    consultas.forEach((c) => { if (c.pacienteId) porPaciente.set(c.pacienteId, [...(porPaciente.get(c.pacienteId) || []), c]) })
    const mapa = new Map()
    porPaciente.forEach((lista, id) => mapa.set(id, tendenciaEntreConsultas(lista.sort(ordenarPorFechaYCreacion))?.verdicto))
    return mapa
  }, [consultas])
  const idsConDeuda = useMemo(() => {
    const set = new Set()
    ventas.forEach((v) => { if (v.estado === "pendiente") set.add(v.pacienteId) })
    facturasVenta.forEach((f) => { if (f.estado === "pendiente_pago") set.add(f.pacienteId) })
    return set
  }, [ventas, facturasVenta])

  const UMBRAL_VISITA_RECIENTE_DIAS = 30

  const pacientesFiltrados = useMemo(() => {
    const busquedaNorm = normalizarTexto(busqueda.trim())
    const busquedaDigitos = busqueda.replace(/\D/g, "")
    return pacientes.filter((p) => {
      // Búsqueda por nombre, cédula, teléfono o correo — insensible a
      // tildes/mayúsculas. Antes el teléfono no se buscaba (recepción no
      // podía ubicar a alguien de quien solo tenía el número a mano) y el
      // correo no se buscaba en absoluto.
      const coincideTexto =
        !busquedaNorm ||
        normalizarTexto(p.nombre).includes(busquedaNorm) ||
        (p.cedula || "").includes(busquedaDigitos || busqueda) ||
        (busquedaDigitos && (p.telefono || "").includes(busquedaDigitos)) ||
        normalizarTexto(p.telefono).includes(busquedaNorm) ||
        normalizarTexto(p.correo).includes(busquedaNorm)
      const coincideEstado = filtroEstado === "Todos" || p.estadoClinico === filtroEstado
      const coincideCorreccion = filtroCorreccion === "Todos" || (p.estadoCorreccion || "Sin evaluación") === filtroCorreccion
      const coincideFecha = (!filtroDesde && !filtroHasta) || (!!p.fechaRegistro && (!filtroDesde || p.fechaRegistro >= filtroDesde) && (!filtroHasta || p.fechaRegistro <= filtroHasta))
      const coincideRapido =
        filtroRapido === "Todos" ||
        (filtroRapido === "Recientes" && (() => { const d = diasDesdeUltimaVisita(p, consultas); return d !== null && d <= UMBRAL_VISITA_RECIENTE_DIAS })()) ||
        (filtroRapido === "PagosPendientes" && idsConDeuda.has(p.id)) ||
        (filtroRapido === "NoCompraron" && noCompraron.has(p.id)) ||
        (filtroRapido === "ControlSinAgendar" && sinAgendarPorPaciente.has(p.id))
      return coincideTexto && coincideEstado && coincideCorreccion && coincideFecha && coincideRapido
    })
  }, [pacientes, busqueda, filtroEstado, filtroCorreccion, filtroDesde, filtroHasta, filtroRapido, consultas, idsConDeuda, noCompraron, sinAgendarPorPaciente])

  // Orden de la tabla — mismo patrón (orden/cambiarOrden/IconoOrden) que ya
  // usa CRM.jsx en su modal de detalle, para no inventar uno nuevo. Solo la
  // columna "Paciente" (nombre) es ordenable: es el único dato de la fila
  // con un tipo simple y sin ambigüedad de formato (a diferencia de "Último
  // examen", que es texto ya formateado y a veces "Pendiente", no una fecha
  // real comparable).
  const [orden, setOrden] = useState({ campo: null, dir: "asc" })
  const cambiarOrden = (campo) => {
    setOrden((prev) => (prev.campo === campo ? { campo, dir: prev.dir === "asc" ? "desc" : "asc" } : { campo, dir: "asc" }))
  }
  const IconoOrden = ({ campo }) => {
    if (orden.campo !== campo) return <ArrowUpDown size={11} className="text-slate-300" />
    return orden.dir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />
  }
  const pacientesOrdenados = useMemo(() => {
    if (orden.campo !== "nombre") return pacientesFiltrados
    return [...pacientesFiltrados].sort((a, b) => {
      const cmp = (a.nombre || "").localeCompare(b.nombre || "", "es")
      return orden.dir === "asc" ? cmp : -cmp
    })
  }, [pacientesFiltrados, orden])

  // Paginación numerada — reemplaza el "Mostrar 25 más" acumulativo por
  // páginas reales (Anterior / 1 2 3... / Siguiente), pedido explícito de
  // Diego. Se reinicia a la página 1 cada vez que cambia cualquier filtro
  // (incluida la búsqueda), para no quedar parado en una página que ya no
  // tiene sentido para el nuevo resultado.
  const PACIENTES_POR_PAGINA = 10
  const [pagina, setPagina] = useState(1)
  // `busquedaInput` (no el debounced `busqueda`) para que la página se
  // reinicie de inmediato al teclear, sin esperar los ~220ms del debounce.
  useEffect(() => { setPagina(1) }, [busquedaInput, filtroEstado, filtroCorreccion, filtroDesde, filtroHasta, filtroRapido])
  const totalPaginas = Math.max(1, Math.ceil(pacientesOrdenados.length / PACIENTES_POR_PAGINA))
  // Si la página guardada quedó fuera de rango (p. ej. se estaba en la
  // página 3 y un filtro nuevo dejó solo 1 página), se recorta a la última
  // válida en vez de mostrar una tabla vacía con controles que no cuadran.
  const paginaActual = Math.min(pagina, totalPaginas)
  const inicioPagina = (paginaActual - 1) * PACIENTES_POR_PAGINA
  const pacientesVisibles = useMemo(
    () => pacientesOrdenados.slice(inicioPagina, inicioPagina + PACIENTES_POR_PAGINA),
    [pacientesOrdenados, inicioPagina],
  )
  const numerosPagina = useMemo(() => Array.from({ length: totalPaginas }, (_, i) => i + 1), [totalPaginas])

  // Navegación por teclado en la tabla: ↑/↓ mueven una fila resaltada,
  // Enter abre su historial clínico (mismo destino que el ícono de "ojo"),
  // Escape la quita. Solo activa cuando la lista es lo que se ve en
  // pantalla — se apaga sola si se abre cualquier modal encima.
  const [filaActiva, setFilaActiva] = useState(-1)
  useEffect(() => { setFilaActiva(-1) }, [pacientesVisibles])
  // Abierto sobre Inicio: cuando ya no queda ningún formulario abierto se avisa para desmontar esta vista oculta.
  const abrioSobreInicio = useRef(false)
  useEffect(() => {
    if (!overlaySolo) return
    const hayModal = modalAbierto || pacienteRecienCreado || pacienteHistorial || pacienteAEliminar || cuentaPaciente || agendarPara
    if (hayModal) abrioSobreInicio.current = true
    else if (abrioSobreInicio.current) onOverlayCerrado?.()
  }, [modalAbierto, pacienteRecienCreado, pacienteHistorial, pacienteAEliminar, cuentaPaciente, agendarPara]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (overlaySolo) return
    const hayModalEncima = modalAbierto || pacienteHistorial || pacienteAEliminar || cuentaPaciente || agendarPara
    if (hayModalEncima) return
    const onKeyDown = (e) => {
      const enCampo = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)
      if (e.key === "ArrowDown") {
        if (enCampo && document.activeElement !== inputBusquedaRef.current) return
        e.preventDefault()
        setFilaActiva((prev) => Math.min(prev + 1, pacientesVisibles.length - 1))
      } else if (e.key === "ArrowUp") {
        if (enCampo && document.activeElement !== inputBusquedaRef.current) return
        e.preventDefault()
        setFilaActiva((prev) => Math.max(prev - 1, 0))
      } else if (e.key === "Enter" && filaActiva >= 0 && pacientesVisibles[filaActiva]) {
        if (enCampo && document.activeElement !== inputBusquedaRef.current) return
        const p = pacientesVisibles[filaActiva]
        setPacienteHistorial(p)
        setTabHistorial("citas")
      } else if (e.key === "Escape") {
        setFilaActiva(-1)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }) // sin deps: siempre lee el estado (pacientesVisibles/filaActiva) más reciente

  // Conteo por estado de corrección (para el resumen superior)
  const conteoCorreccion = useMemo(() => {
    const base = { "Bien corregido": 0, "Requiere ajuste": 0, "Sin evaluar": 0, "Sin evaluación": 0 }
    pacientes.forEach((p) => {
      const k = p.estadoCorreccion || "Sin evaluación"
      if (base[k] !== undefined) base[k]++
    })
    return base
  }, [pacientes])

  // Tarjetas-resumen: Total primero, luego los estados de corrección accionables
  const tarjetasCorreccion = [
    { key: "Todos", icon: Users, valor: pacientes.length, label: "Total pacientes", filled: true, fg: "#fff", bg: GRAD, ring: "#2563EB" },
    { key: "Bien corregido", icon: CORRECCION["Bien corregido"].icon, valor: conteoCorreccion["Bien corregido"], label: "Bien corregidos", fg: CORRECCION_COLOR["Bien corregido"].fg, bg: CORRECCION_COLOR["Bien corregido"].bg, ring: CORRECCION_COLOR["Bien corregido"].fg },
    { key: "Requiere ajuste", icon: CORRECCION["Requiere ajuste"].icon, valor: conteoCorreccion["Requiere ajuste"], label: "Requieren ajuste", fg: CORRECCION_COLOR["Requiere ajuste"].fg, bg: CORRECCION_COLOR["Requiere ajuste"].bg, ring: CORRECCION_COLOR["Requiere ajuste"].fg },
    { key: "Sin evaluar", icon: CORRECCION["Sin evaluar"].icon, valor: conteoCorreccion["Sin evaluar"], label: "Sin agudeza visual con lentes registrada", fg: CORRECCION_COLOR["Sin evaluar"].fg, bg: CORRECCION_COLOR["Sin evaluar"].bg, ring: CORRECCION_COLOR["Sin evaluar"].fg },
    { key: "Sin evaluación", icon: CORRECCION["Sin evaluación"].icon, valor: conteoCorreccion["Sin evaluación"], label: "Sin consulta", fg: CORRECCION_COLOR["Sin evaluación"].fg, bg: CORRECCION_COLOR["Sin evaluación"].bg, ring: CORRECCION_COLOR["Sin evaluación"].fg },
  ]

  const corta = (iso) => formatoFecha(iso, "medioSinAnio")
  const seccionesFiltro = [
    { id: "estado", titulo: "Estado", valor: filtroEstado, onChange: setFiltroEstado, opciones: [{ id: "Todos", etiqueta: "Todos" }, { id: "Activo", etiqueta: "Activo" }, { id: "De alta", etiqueta: "De alta" }] },
    { id: "correccion", titulo: "Corrección", valor: filtroCorreccion, onChange: setFiltroCorreccion, opciones: [{ id: "Todos", etiqueta: "Todas" }, { id: "Bien corregido", etiqueta: "Bien corregido" }, { id: "Requiere ajuste", etiqueta: "Requiere ajuste" }, { id: "Sin evaluar", etiqueta: "Sin agudeza visual con lentes registrada" }, { id: "Sin evaluación", etiqueta: "Sin consulta" }] },
    { id: "fecha", titulo: "Fecha de registro", tipo: "rango", rango: { desde: filtroDesde, hasta: filtroHasta, onDesde: setFiltroDesde, onHasta: setFiltroHasta } },
  ]
  const etiquetasFiltro = [
    ...(filtroEstado !== "Todos" ? [{ id: "estado", texto: filtroEstado, quitar: () => setFiltroEstado("Todos") }] : []),
    ...(filtroCorreccion !== "Todos" ? [{ id: "correccion", texto: seccionesFiltro[1].opciones.find((o) => o.id === filtroCorreccion)?.etiqueta || filtroCorreccion, quitar: () => setFiltroCorreccion("Todos") }] : []),
    ...(filtroDesde || filtroHasta ? [{ id: "fecha", texto: filtroDesde && filtroHasta ? `${corta(filtroDesde)} – ${corta(filtroHasta)}` : `Desde el ${corta(filtroDesde || filtroHasta)}`, quitar: () => { setFiltroDesde(""); setFiltroHasta("") } }] : []),
  ]

  const limpiarFiltros = () => {
    setBusquedaInput("")
    setBusqueda("")
    setFiltroEstado("Todos")
    setFiltroCorreccion("Todos")
    setFiltroDesde("")
    setFiltroHasta("")
    setFiltroRapido("Todos")
  }

  // Badges de filtro rápido sobre la tabla — "Recetas activas" reusa el
  // mismo filtroCorreccion que ya usan las tarjetas de arriba (no se duplica
  // el estado); "Visitas recientes" y "Pagos pendientes" son criterios que
  // no vive en estadoCorreccion, así que usan filtroRapido aparte. Los tres
  // se muestran como un solo grupo excluyente para que quede claro cuál
  // está activo — activar uno limpia el otro tipo de filtro.
  const badgesRapidos = [
    { key: "Todos", label: "Todos" },
    { key: "Recientes", label: "Visitas recientes" },
    { key: "RecetasActivas", label: "Recetas activas" },
    { key: "PagosPendientes", label: "Pagos pendientes" },
    { key: "NoCompraron", label: `Consultaron y no compraron (${noCompraron.size})` },
    { key: "ControlSinAgendar", label: `Control sin agendar (${sinAgendarPorPaciente.size})` },
  ]
  const badgeRapidoActivo = filtroCorreccion === "Bien corregido" ? "RecetasActivas" : filtroRapido === "Todos" ? "Todos" : filtroRapido
  const activarBadgeRapido = (key) => {
    if (key === "RecetasActivas") {
      setFiltroRapido("Todos")
      setFiltroCorreccion((prev) => (prev === "Bien corregido" ? "Todos" : "Bien corregido"))
    } else {
      setFiltroCorreccion("Todos")
      setFiltroRapido((prev) => (prev === key ? "Todos" : key))
    }
  }

  return (
    <div className="w-full space-y-5 text-left" style={overlaySolo ? undefined : { animation: "rise-in 320ms ease-out both" }}>
      {notificacion && (
        <div role="status" className={(overlaySolo ? "fixed right-6 top-6 z-[60] w-80 shadow-2xl " : "") + "flex items-center gap-3 rounded-xl border border-emerald-200/60 bg-emerald-50 p-3.5 text-emerald-900"}>
          <CheckCircle className="shrink-0 text-emerald-500" size={18} />
          <p className="text-sm font-semibold">{notificacion}</p>
        </div>
      )}

      {bannerError && (
        <div role="alert" className={(overlaySolo ? "fixed right-6 top-6 z-[60] w-80 shadow-2xl " : "") + "flex items-center gap-3 rounded-xl border border-red-200/60 bg-red-50 p-3.5 text-red-900"}>
          <AlertCircle className="shrink-0 text-red-500" size={18} />
          <p className="text-sm font-semibold">{bannerError}</p>
        </div>
      )}

      {!overlaySolo && abriendoPerfil && (
        <div role="status" aria-label="Abriendo el perfil del paciente" className="space-y-4">
          <div className="h-28 animate-pulse rounded-2xl border border-slate-200/60 bg-white" />
          <div className="h-12 w-96 max-w-full animate-pulse rounded-xl border border-slate-200/60 bg-white" />
          <div className="h-40 animate-pulse rounded-2xl border border-slate-200/60 bg-white" />
        </div>
      )}
      {!overlaySolo && !abriendoPerfil && (
      <>
      {/* ─── HEADER ─── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3.5">
          <div className="grid h-12 w-12 place-items-center rounded-2xl text-white" style={{ background: GRAD, boxShadow: "0 12px 24px -10px rgba(37,99,235,0.6)" }}>
            <Users size={24} />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold tracking-tight" style={{ color: INK }}>Pacientes</h1>
            <p className="text-sm text-slate-500">
              {pacientes.length} {pacientes.length === 1 ? "paciente registrado" : "pacientes registrados"}
            </p>
          </div>
        </div>

        {puedeCrearPaciente && <button
          type="button"
          onClick={abrirCrear}
          className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          style={{ background: GRAD, boxShadow: "0 14px 28px -12px rgba(37,99,235,0.6)" }}
        >
          <UserPlus size={18} />
          Crear paciente
        </button>}
      </div>

      {/* ─── RESUMEN POR ESTADO DE CORRECCIÓN (tarjetas que también filtran) ─── */}
      <div>
        <p className="mb-2 text-xs font-medium text-slate-500">Toca una tarjeta para filtrar la lista</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {tarjetasCorreccion.map((t) => {
            const Icono = t.icon
            const activo = filtroCorreccion === t.key
            const pct = pacientes.length ? Math.round((t.valor / pacientes.length) * 100) : 0
            return (
              <button
                key={t.key}
                type="button"
                title={AYUDA_CORRECCION[t.key]}
                onClick={() => setFiltroCorreccion((prev) => (t.key === "Todos" ? "Todos" : prev === t.key ? "Todos" : t.key))}
                className="group relative overflow-hidden rounded-2xl border bg-white p-4 text-left transition-all hover:-translate-y-0.5 cursor-pointer"
                style={{
                  borderColor: activo ? t.ring : "rgba(14,43,51,0.08)",
                  boxShadow: activo ? `0 0 0 3px ${t.ring}22` : "0 1px 2px rgba(14,43,51,0.04)",
                }}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-transform group-hover:scale-105"
                    style={{ background: t.bg, color: t.fg }}
                  >
                    <Icono size={20} />
                  </div>
                  <div>
                    <p className="text-2xl font-serif font-semibold leading-none" style={{ color: INK }}>{t.valor}</p>
                    <p className="mt-1 text-xs font-medium text-slate-500">{t.label}</p>
                  </div>
                </div>
                {/* Barra de proporción respecto al total */}
                <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full transition-all" style={{ width: pct + "%", background: t.filled ? t.bg : t.fg }} />
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ─── BÚSQUEDA Y FILTROS: la misma barra única de Citas ─── */}
      <BarraBusquedaFiltros
        texto={busquedaInput}
        onTexto={setBusquedaInput}
        secciones={seccionesFiltro}
        etiquetas={etiquetasFiltro}
        onLimpiar={limpiarFiltros}
        placeholder="Buscar paciente: nombre, cédula, teléfono o correo"
        inputId="buscar-paciente"
        inputRef={inputBusquedaRef}
        etiquetaPanel="Filtrar pacientes"
        panelId="pacientes-filtrar-panel"
      />

      {/* ─── FILTROS RÁPIDOS (badges) ─── */}
      <div className="flex flex-wrap items-center gap-2">
        {badgesRapidos.map((b) => {
          const activo = badgeRapidoActivo === b.key
          return (
            <button
              key={b.key}
              type="button"
              onClick={() => activarBadgeRapido(b.key)}
              className={"rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer " + (activo ? "border-blue-600 bg-blue-600 text-white shadow-sm" : "border-slate-200/60 bg-white text-slate-600 hover:bg-slate-50")}
            >
              {b.label}
            </button>
          )
        })}
      </div>

      {/* ─── TABLA (o la cola de ventas cuando está activo "Listos para venta" / "No compraron") ─── */}
      {(
      <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200/60 bg-slate-50/70 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="cursor-pointer select-none px-5 py-3.5" onClick={() => cambiarOrden("nombre")}>
                  <span className="flex items-center gap-1">Paciente <IconoOrden campo="nombre" /></span>
                </th>
                <th className="px-5 py-3.5">Contacto</th>
                <th className="px-5 py-3.5">Corrección</th>
                <th className="px-5 py-3.5">Último examen</th>
                <th className="px-5 py-3.5 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(cargaInicial && pacientes.length === 0) || buscando ? (
                Array.from({ length: buscando ? Math.min(5, pacientesVisibles.length || 5) : 5 }).map((_, i) => (
                  <tr key={"skeleton-" + i}>
                    <td colSpan={5} className="px-5 py-4">
                      <div className="flex items-center gap-4">
                        <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-slate-200/70" />
                        <div className="flex-1 space-y-1.5">
                          <div className="h-3 w-1/3 animate-pulse rounded bg-slate-200/70" />
                          <div className="h-2.5 w-1/5 animate-pulse rounded bg-slate-200/60" />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : pacientesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <div className="mx-auto max-w-xs space-y-3">
                      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-slate-100 text-slate-300">
                        <AlertCircle size={28} />
                      </div>
                      <p className="text-sm font-semibold text-slate-500">
                        {pacientes.length === 0
                          ? "Aún no hay pacientes registrados."
                          : busqueda
                          ? <>Ningún paciente coincide con &ldquo;{busqueda}&rdquo;.</>
                          : "Ningún paciente coincide con los filtros."}
                      </p>
                      {pacientes.length === 0 ? (
                        <button type="button" onClick={abrirCrear} className="text-sm font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">
                          Crear el primero
                        </button>
                      ) : busqueda ? (
                        // Vacío interactivo: en vez de un callejón sin salida,
                        // ofrece registrar directamente a quien se buscó — el
                        // formulario abre con lo ya escrito precargado (cédula
                        // o nombre, según el patrón del texto).
                        <button
                          type="button"
                          onClick={() => abrirCrearConPrellenado(busqueda)}
                          className="mx-auto flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 cursor-pointer"
                          style={{ background: GRAD }}
                        >
                          <UserPlus size={15} /> Registrar &ldquo;{busqueda}&rdquo;
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ) : (
                pacientesVisibles.map((paciente, indiceFila) => {
                  const correccion = CORRECCION[paciente.estadoCorreccion] || CORRECCION["Sin evaluación"]
                  const IconoCorreccion = correccion.icon
                  const tendencia = TENDENCIA[tendenciaPorPaciente.get(paciente.id)]
                  const activa = indiceFila === filaActiva
                  // Badges contextuales de alto valor — lo que recepción
                  // necesita saber de un vistazo sin abrir el perfil: si
                  // tiene cita hoy, si debe dinero, o si su control ya venció.
                  const tieneCitaHoy = citas.some((c) => perteneceAPaciente(c, paciente) && esHoy(c.fecha) && c.estado !== "Cancelada" && c.estado !== "No Asistió")
                  const tienePagoPendiente = idsConDeuda.has(paciente.id)
                  const controlVencido = esInactivo(paciente, consultas)
                  return (
                    <tr
                      key={paciente.id}
                      onMouseEnter={() => setFilaActiva(indiceFila)}
                      className={"group cursor-pointer transition-colors " + (activa ? "bg-blue-50/70 ring-1 ring-inset ring-blue-200" : "hover:bg-slate-50/70")}
                      onClick={() => { setPacienteHistorial(paciente); setTabHistorial("citas") }}
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white transition-transform group-hover:scale-105" style={{ background: colorAvatar(paciente.nombre) }}>
                            {paciente.nombre.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 transition-colors group-hover:text-blue-600">
                              {paciente.nombre}
                            </p>
                            <p className="mt-0.5 font-mono text-xs text-slate-500">{paciente.cedula}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <span className={"rounded-full px-2 py-0.5 text-xs font-semibold " + claseBadgeEstadoClinico(paciente.estadoClinico)}>
                                {paciente.estadoClinico}
                              </span>
                              {/* Metadata de identidad (cuenta/origen) — se
                                  distingue de los 3 badges accionables de
                                  abajo (cita hoy/pago pendiente/control
                                  vencido) con un tratamiento de borde en vez
                                  de relleno, para que no compitan por
                                  atención en un vistazo rápido de la fila. */}
                              <span className="flex items-center gap-1 rounded-full border border-slate-200/60 px-2 py-0.5 text-xs font-medium text-slate-500">
                                {paciente.tieneCuenta ? "Con cuenta" : "Sin cuenta"}
                              </span>
                              {(paciente.fecha_nacimiento || paciente.fechaNacimiento) && (
                                <span className="flex items-center gap-1 text-xs text-slate-500">
                                  <Cake size={11} />
                                  {formatoFecha(paciente.fecha_nacimiento || paciente.fechaNacimiento, "numericoCorto")}
                                </span>
                              )}
                              {tieneCitaHoy && (
                                <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                                  <Calendar size={11} /> Cita hoy
                                </span>
                              )}
                              {idsListosParaVenta.has(paciente.id) && (puedeVerVentas && setVista ? (
                                <button type="button" onClick={(e) => { e.stopPropagation(); setVista("ventas") }} title="Ir a la cola de Ventas" className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 cursor-pointer">
                                  <ShoppingCart size={11} /> Listo para venta
                                </button>
                              ) : (
                                <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                                  <ShoppingCart size={11} /> Listo para venta
                                </span>
                              ))}
                              {sinAgendarPorPaciente.has(paciente.id) && (
                                <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700" title="Su control recomendado todavía no tiene cita">
                                  <Calendar size={11} /> Control sin agendar
                                </span>
                              )}
                              {noCompraron.has(paciente.id) && (
                                <span className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600" title="Consultó y no compró">
                                  <UserX size={11} /> No compró: {noCompraron.get(paciente.id).motivo}
                                </span>
                              )}
                              {tienePagoPendiente && (
                                <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                                  <CreditCard size={11} /> Pago pendiente
                                </span>
                              )}
                              {controlVencido && (
                                <span className="flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                                  <Clock size={11} /> Control vencido
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-slate-600">
                            <Phone size={13} className="text-slate-500" />
                            <span>{paciente.telefono}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <Mail size={13} className="text-slate-500" />
                            <span className="max-w-[160px] truncate" title={paciente.correo}>{paciente.correo}</span>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          <span title={AYUDA_CORRECCION[paciente.estadoCorreccion] || AYUDA_CORRECCION["Sin evaluación"]} className={"inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold " + correccion.clase}>
                            <IconoCorreccion size={13} />
                            {correccion.label}
                          </span>
                          {tendencia && (
                            <p className="flex items-center gap-1 text-[11px] text-slate-500">
                              <tendencia.icon size={11} style={{ color: tendencia.fg }} />
                              Graduación: <span style={{ color: tendencia.fg }}>{tendencia.label.toLowerCase()}</span>
                            </p>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={13} className="text-slate-500" />
                          <span>{fechaLegible(paciente.ultimaConsulta) || paciente.ultimaConsulta}</span>
                        </div>
                      </td>

                      <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          {/* Acciones rápidas: invisibles hasta que se pasa el
                              mouse sobre la fila (o se llega por teclado), para
                              no saturar la tabla — se mantienen visibles en la
                              fila resaltada por navegación con flechas para no
                              depender solo del hover. "Más acciones" (⋮) queda
                              siempre visible aparte, como respaldo en
                              pantallas táctiles donde no existe hover. */}
                          <div className={"flex items-center gap-1 transition-opacity " + (activa ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100")}>
                            <button type="button" onClick={() => { setPacienteHistorial(paciente); setTabHistorial("citas") }} title="Ver perfil 360°" aria-label="Ver perfil 360°" className={"rounded-lg p-2 transition-colors cursor-pointer " + ACCION_VER}>
                              <Eye size={16} />
                            </button>
                            {puedeAgendar && <button type="button" onClick={() => abrirAgendar(paciente)} title="Agendar cita" aria-label="Agendar cita" className={"rounded-lg p-2 transition-colors cursor-pointer " + ACCION_CONFIRMAR}>
                              <CalendarPlus size={16} />
                            </button>}
                            {puedeVender && <button type="button" onClick={() => abrirVentaRapida(paciente)} title="Nueva venta" aria-label="Nueva venta" className="rounded-lg p-2 text-emerald-600 transition-colors hover:bg-emerald-50 cursor-pointer">
                              <ShoppingCart size={16} />
                            </button>}
                          </div>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => abrirMenuAcciones(paciente.id, e)}
                              title="Más acciones"
                              aria-label="Más acciones"
                              className={"rounded-lg p-2 transition-colors cursor-pointer " + (menuAccionesId === paciente.id ? "bg-slate-100 text-slate-700" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700")}
                            >
                              <MoreVertical size={16} />
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {pacientesFiltrados.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Mostrando <span className="font-semibold text-slate-700">{inicioPagina + 1}–{Math.min(inicioPagina + PACIENTES_POR_PAGINA, pacientesFiltrados.length)}</span> de <span className="font-semibold text-slate-700">{pacientesFiltrados.length}</span>
              {pacientesFiltrados.length !== pacientes.length ? ` (de ${pacientes.length} en total)` : ""}
            </span>
            {totalPaginas > 1 && (
              <nav className="flex items-center gap-1" aria-label="Paginación de pacientes">
                <button
                  type="button"
                  onClick={() => setPagina(paginaActual - 1)}
                  disabled={paginaActual === 1}
                  aria-label="Página anterior"
                  className="flex items-center gap-1 rounded-lg border border-slate-200/60 bg-white px-2.5 py-1.5 font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft size={14} /> Anterior
                </button>
                <div className="flex items-center gap-1 px-1">
                  {numerosPagina.map((numero) => (
                    <button
                      key={numero}
                      type="button"
                      onClick={() => setPagina(numero)}
                      aria-label={`Página ${numero}`}
                      aria-current={numero === paginaActual ? "page" : undefined}
                      className={"min-w-[28px] rounded-lg px-2 py-1.5 font-semibold transition cursor-pointer " + (numero === paginaActual ? "bg-blue-600 text-white shadow-sm" : "border border-slate-200/60 bg-white text-slate-600 hover:bg-slate-100")}
                    >
                      {numero}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setPagina(paginaActual + 1)}
                  disabled={paginaActual === totalPaginas}
                  aria-label="Página siguiente"
                  className="flex items-center gap-1 rounded-lg border border-slate-200/60 bg-white px-2.5 py-1.5 font-semibold text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                >
                  Siguiente <ChevronRight size={14} />
                </button>
              </nav>
            )}
          </div>
        )}
      </div>
      )}

      </>
      )}

      {/* ─── MODAL CREAR / EDITAR ─── */}
      {modalAbierto && createPortal(
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={cerrarModal}>
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-2xl" style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)", willChange: "transform, opacity" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: GRAD }}>
                  <UserPlus size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold" style={{ color: INK }}>
                    {idEditando ? "Editar paciente" : "Crear paciente"}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {idEditando ? "Actualiza sus datos de contacto y registro." : "Datos básicos para registrarlo en el sistema."}
                  </p>
                </div>
              </div>
              <button type="button" onClick={cerrarModal} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={manejarEnvio} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
              <div>
                <label htmlFor="p-nombre" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Apellidos y nombres <span className="text-red-500">*</span>
                </label>
                <input
                  id="p-nombre" type="text" required placeholder="Ej. Cevallos Macías Diego" autoComplete="name"
                  value={nombre} onChange={(e) => setNombre(filtrarSoloLetras(e.target.value))}
                  className={"w-full rounded-xl border bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition-colors focus-visible:bg-white focus-visible:ring-2 " + (erroresForm.nombre ? "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-100" : "border-slate-200/60 focus-visible:border-blue-500 focus-visible:ring-blue-50")}
                />
                {erroresForm.nombre && <p className="mt-1 flex items-center gap-1 text-xs font-medium text-red-600"><AlertCircle size={13} /> {erroresForm.nombre}</p>}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="p-cedula" className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Cédula <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
                    <input
                      id="p-cedula" type="text" required placeholder="1315556667" inputMode="numeric" maxLength={10} autoComplete="off"
                      value={cedula} onChange={(e) => setCedula(filtrarSoloNumeros(e.target.value, 10))}
                      className={"w-full rounded-xl border bg-slate-50 py-2.5 pl-9 pr-3 font-mono text-sm text-slate-800 outline-none transition-colors focus-visible:bg-white focus-visible:ring-2 " + (erroresForm.cedula ? "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-100" : "border-slate-200/60 focus-visible:border-blue-500 focus-visible:ring-blue-50")}
                    />
                  </div>
                  {erroresForm.cedula && <p className="mt-1 flex items-center gap-1 text-xs font-medium text-red-600"><AlertCircle size={13} /> {erroresForm.cedula}</p>}
                </div>

                <div>
                  <label htmlFor="p-nacimiento" className="mb-1.5 block text-sm font-semibold text-slate-700">Fecha de nacimiento *</label>
                  <CampoFecha id="p-nacimiento" valor={fechaNacimiento} onCambiar={setFechaNacimiento} icono={Cake} error={!!erroresForm.fechaNacimiento} requerido placeholder="Elige la fecha" />
                  {erroresForm.fechaNacimiento && <p className="mt-1 flex items-center gap-1 text-xs font-medium text-red-600"><AlertCircle size={13} /> {erroresForm.fechaNacimiento}</p>}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="p-telefono" className="mb-1.5 block text-sm font-semibold text-slate-700">Teléfono</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
                    <input
                      id="p-telefono" type="text" placeholder="0999999999" inputMode="numeric" maxLength={10} autoComplete="tel"
                      value={telefono} onChange={(e) => setTelefono(filtrarSoloNumeros(e.target.value, 10))}
                      className={"w-full rounded-xl border bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none transition-colors focus-visible:bg-white focus-visible:ring-2 " + (erroresForm.telefono ? "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-100" : "border-slate-200/60 focus-visible:border-blue-500 focus-visible:ring-blue-50")}
                    />
                  </div>
                  {erroresForm.telefono && <p className="mt-1 flex items-center gap-1 text-xs font-medium text-red-600"><AlertCircle size={13} /> {erroresForm.telefono}</p>}
                </div>

                <div>
                  <label htmlFor="p-correo" className="mb-1.5 block text-sm font-semibold text-slate-700">Correo</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
                    <input
                      id="p-correo" type="email" placeholder="correo@ejemplo.com" autoComplete="email"
                      value={correo} onChange={(e) => setCorreo(e.target.value)}
                      className={"w-full rounded-xl border bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none transition-colors focus-visible:bg-white focus-visible:ring-2 " + (erroresForm.correo ? "border-red-400 focus-visible:border-red-500 focus-visible:ring-red-100" : "border-slate-200/60 focus-visible:border-blue-500 focus-visible:ring-blue-50")}
                    />
                  </div>
                  {erroresForm.correo && <p className="mt-1 flex items-center gap-1 text-xs font-medium text-red-600"><AlertCircle size={13} /> {erroresForm.correo}</p>}
                </div>
              </div>

              <div>
                <label htmlFor="p-referido" className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Referido por <span className="normal-case text-slate-500">(opcional)</span>
                </label>
                <SelectorBuscable
                  id="p-referido"
                  valor={referidoPor}
                  onChange={setReferidoPor}
                  icono={Heart}
                  placeholder="Escribe un nombre…"
                  etiquetaNinguno="Nadie / llegó por su cuenta"
                  options={pacientes.filter((x) => x.nombre !== nombre).map((x) => ({ id: x.nombre, etiqueta: x.nombre, detalle: x.cedula }))}
                />
                <p className="mt-1 text-xs text-slate-500">Si vino recomendado por otro paciente, selecciónalo aquí para reconocerlo en el CRM.</p>
              </div>
              </div>

              <div className="flex shrink-0 gap-3 border-t border-slate-100 px-6 py-4">
                <button type="button" onClick={cerrarModal} className="flex-1 rounded-xl border border-slate-200/60 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoPaciente}
                  className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ background: GRAD }}
                >
                  {guardandoPaciente ? "Guardando…" : idEditando ? "Guardar cambios" : "Registrar paciente"}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ─── PACIENTE CREADO: ofrecer abrir su ficha clínica ─── */}
      {pacienteRecienCreado && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={() => setPacienteRecienCreado(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-slate-200/60 bg-white p-6 shadow-2xl" style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)", willChange: "transform, opacity" }} onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-emerald-50">
              <CheckCircle size={24} className="text-emerald-600" />
            </div>
            <h4 className="text-center text-lg font-bold" style={{ color: INK }}>Paciente registrado</h4>
            <p className="mt-1.5 text-center text-sm text-slate-500">
              <span className="font-semibold text-slate-700">{pacienteRecienCreado.nombre}</span> ya está en el sistema. ¿Qué quieres hacer ahora?
            </p>
            {/* Antes solo ofrecía "Abrir ficha clínica" — asumía que siempre se
                está registrando a alguien para atenderlo ya mismo. Pero
                también se registra gente para agendarla más adelante (no
                todo el que llega al mostrador es un walk-in) — sin esto,
                había que cerrar el modal y buscarlo de nuevo en la lista
                para agendarle una cita. */}
            <div className="mt-6 space-y-2">
              {puedeAtender && (
              <button
                type="button"
                onClick={() => { const p = pacienteRecienCreado; setPacienteRecienCreado(null); onIrAFichaClinica?.(p) }}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 cursor-pointer"
                style={{ background: GRAD }}
              >
                <Stethoscope size={15} /> Atenderlo ahora — abrir ficha clínica
              </button>
              )}
              <button
                type="button"
                onClick={() => { const p = pacienteRecienCreado; setPacienteRecienCreado(null); abrirAgendar(p) }}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200/60 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 cursor-pointer"
              >
                <CalendarPlus size={15} /> Agendarle una cita para después
              </button>
              <button type="button" onClick={() => setPacienteRecienCreado(null)} className="w-full rounded-xl px-4 py-2 text-sm font-semibold text-slate-500 transition hover:bg-slate-50 cursor-pointer">
                Ahora no
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ─── MENÚ "MÁS ACCIONES" (portal, ver comentario junto a abrirMenuAcciones) ─── */}
      {menuAccionesId != null && menuAccionesPos && (() => {
        const paciente = pacientes.find((p) => p.id === menuAccionesId)
        if (!paciente) return null
        return createPortal(
          <div
            ref={menuAccionesRef}
            className="fixed z-50 w-52 overflow-hidden rounded-xl border border-slate-200/60 bg-white py-1.5 text-left shadow-xl"
            style={{ top: menuAccionesPos.top, left: menuAccionesPos.left, animation: "menu-in 160ms ease-out", transformOrigin: "top right" }}
          >
            {puedeAtender && puedeAgendar && <button
              type="button"
              onClick={() => { setMenuAccionesId(null); abrirFichaClinica(paciente) }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 cursor-pointer"
            >
              <Stethoscope size={15} /> Atender ahora
            </button>}
            {puedeVender && <button
              type="button"
              onClick={() => { setMenuAccionesId(null); abrirVentaRapida(paciente) }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-emerald-600 transition-colors hover:bg-emerald-50 cursor-pointer"
            >
              <ShoppingCart size={15} /> Nueva venta
            </button>}
            {puedeEditarPaciente && <button
              type="button"
              onClick={() => { setMenuAccionesId(null); abrirCuenta(paciente) }}
              className={"flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-medium transition-colors cursor-pointer " + (paciente.tieneCuenta ? "text-slate-600 hover:bg-slate-50" : "text-blue-600 hover:bg-blue-50")}
            >
              <KeyRound size={15} /> {paciente.tieneCuenta ? "Restablecer clave" : "Crear cuenta de acceso"}
            </button>}
            {puedeEditarPaciente && <button
              type="button"
              onClick={() => { setMenuAccionesId(null); abrirEdicion(paciente) }}
              className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer"
            >
              <Pencil size={15} /> Editar datos
            </button>}
            {puedeEliminar && (
              <button
                type="button"
                onClick={() => { setMenuAccionesId(null); setPacienteAEliminar(paciente) }}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 cursor-pointer"
              >
                <Trash2 size={15} /> Eliminar
              </button>
            )}
          </div>,
          document.body,
        )
      })()}

      {/* ─── MODAL ELIMINAR (anonimiza; solo el administrador) ─── */}
      {pacienteAEliminar && puedeEliminar && (
        <EliminarPacienteModal
          paciente={pacienteAEliminar}
          nCitas={citas.filter((c) => perteneceAPaciente(c, pacienteAEliminar)).length}
          nConsultas={consultas.filter((c) => perteneceAPaciente(c, pacienteAEliminar)).length}
          nVentas={facturasVenta.filter((f) => f.pacienteId === pacienteAEliminar.id).length + ventas.filter((v) => v.pacienteId === pacienteAEliminar.id).length}
          eliminando={eliminandoPaciente}
          onConfirmar={confirmarEliminar}
          onCancelar={() => setPacienteAEliminar(null)}
        />
      )}
      {/* ─── MODAL CUENTA DE ACCESO (clave temporal) ─── */}
      {cuentaPaciente && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={() => setCuentaPaciente(null)}>
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl" style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)", willChange: "transform, opacity" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: GRAD }}>
                  <KeyRound size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold" style={{ color: INK }}>
                    {cuentaPaciente.tieneCuenta ? "Restablecer clave" : "Crear cuenta de acceso"}
                  </h2>
                  <p className="text-xs text-slate-500">Portal del paciente</p>
                </div>
              </div>
              <button type="button" onClick={() => setCuentaPaciente(null)} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <p className="text-sm text-slate-600">
                Acceso para <span className="font-semibold text-slate-800">{cuentaPaciente.nombre}</span>. Con estos datos podrá entrar a ver sus recetas, citas y evolución.
              </p>

              {/* Credenciales */}
              <div className="space-y-3 rounded-xl border border-slate-200/60 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Usuario</span>
                  <span className="font-mono text-sm font-bold text-slate-800">{cuentaPaciente.cedula || cuentaPaciente.correo}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200/60 pt-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Clave temporal</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-black" style={{ color: "#2563EB" }}>{claveGen}</span>
                    <button type="button" onClick={regenerarClave} title="Generar otra clave" aria-label="Generar otra clave" className="rounded-md p-1 text-slate-500 transition-colors hover:bg-white hover:text-blue-600 cursor-pointer">
                      <RefreshCw size={14} />
                    </button>
                  </div>
                </div>
              </div>

              <button type="button" onClick={copiarCredenciales} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200/60 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">
                {copiadoCred ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
                {copiadoCred ? "¡Copiado!" : "Copiar usuario y clave"}
              </button>

              <p className="rounded-lg bg-blue-50 p-3 text-xs leading-relaxed text-blue-800">
                Entrega estos datos al paciente. Es una <span className="font-semibold">clave temporal</span>: podrá cambiarla por la que desee cuando ingrese por primera vez.
              </p>

              <div className="flex gap-3 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setCuentaPaciente(null)} disabled={guardandoCuenta} className="flex-1 rounded-xl border border-slate-200/60 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60">
                  Cancelar
                </button>
                <button type="button" onClick={guardarCuenta} disabled={guardandoCuenta} className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60" style={{ background: GRAD }}>
                  {guardandoCuenta ? "Guardando…" : cuentaPaciente.tieneCuenta ? "Guardar nueva clave" : "Crear cuenta"}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ─── MODAL HISTORIAL CLÍNICO ─── */}
      {pacienteHistorial && createPortal(
        <div className="absolute inset-0 z-20 flex flex-col overflow-hidden" style={{ backgroundColor: "#F7F5F0", animation: "rise-in 320ms ease-out" }}>
          {/* Barra superior de la vista — una sola forma de salir: "← Pacientes" (Escape también cierra). */}
          {(() => {
            const botonVolver = (
              <button type="button" onClick={() => setPacienteHistorial(null)} className="flex items-center gap-2 rounded-lg py-1.5 pl-1.5 pr-3 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 cursor-pointer">
              <ArrowLeft size={18} /> Pacientes
              </button>
            )
            const slot = document.getElementById("encabezado-slot")
            // Con el encabezado del panel disponible, "← Pacientes" sube allí (en lugar del saludo); sin él, queda la barra de siempre.
            return slot ? createPortal(botonVolver, slot) : <div className="flex shrink-0 items-center justify-between border-b border-slate-200/60 bg-white px-4 py-3 sm:px-8">{botonVolver}</div>
          })()}

          {(() => {
            const solicitudEliminacion = solicitudesEliminacion.find((s) => s.pacienteId === pacienteHistorial.id)
            if (!solicitudEliminacion) return null
            return (
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-amber-200/60 bg-amber-50 px-4 py-3 sm:px-8">
                <div className="flex items-start gap-2.5">
                  <AlertCircle size={18} className="mt-0.5 shrink-0 text-amber-600" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">Este paciente solicitó eliminar su cuenta y sus datos.</p>
                    {solicitudEliminacion.motivo && <p className="text-xs text-amber-700">Motivo: {solicitudEliminacion.motivo}</p>}
                    <p className="text-[11px] text-amber-600">Usa "Eliminar paciente" en el menú de acciones para completarlo, y marca esta solicitud como atendida.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => marcarSolicitudEliminacionAtendida?.(solicitudEliminacion.id)}
                  className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-100 cursor-pointer"
                >
                  Marcar atendida
                </button>
              </div>
            )
          })()}

          {pacienteHistorial.medidasSolicitadasEn && (
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-blue-200/60 bg-blue-50 px-4 py-3 sm:px-8">
              <div className="flex items-start gap-2.5">
                <Eye size={18} className="mt-0.5 shrink-0 text-blue-600" />
                <div>
                  <p className="text-sm font-semibold text-blue-800">Este paciente pidió ver sus medidas completas (esfera/cilindro/eje) desde el portal.</p>
                  <p className="text-[11px] text-blue-600">Entrégaselas por el canal que prefieras y marca esta solicitud como atendida.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => marcarMedidasAtendidas?.(pacienteHistorial.id)}
                className="shrink-0 rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 cursor-pointer"
              >
                Marcar atendida
              </button>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="px-4 pb-6 pt-3 sm:px-8 sm:pb-8 sm:pt-4">
              {/* ─── Cabecera del perfil: identidad + acciones principales ─── */}
              <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-5">
                <div className="flex min-w-0 items-start gap-4">
                  <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl text-xl font-bold text-white" style={{ background: GRAD }}>
                    {pacienteHistorial.nombre.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h1 className="font-serif text-2xl font-bold" style={{ color: INK }}>
                      {pacienteHistorial.nombre}
                    </h1>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
                      {pacienteHistorial.cedula && <span className="flex items-center gap-1.5 font-mono"><IdCard size={14} /> {pacienteHistorial.cedula}</span>}
                      {pacienteHistorial.telefono && <span className="flex items-center gap-1.5"><Phone size={14} /> {pacienteHistorial.telefono}</span>}
                      {pacienteHistorial.correo && <span className="flex items-center gap-1.5"><Mail size={14} /> {pacienteHistorial.correo}</span>}
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <span className={"rounded-full px-2.5 py-1 text-xs font-semibold " + claseBadgeEstadoClinico(pacienteHistorial.estadoClinico)}>
                        {pacienteHistorial.estadoClinico}
                      </span>
                      {/* Cuenta Portal — pedido explícito de Diego: etiqueta
                          "Cuenta Portal: Activa/Sin cuenta" en vez del
                          "Con cuenta"/"Sin cuenta" genérico de antes. */}
                      {/* Con cuenta, un clic abre sus opciones (restablecer la clave). Sin cuenta es solo la etiqueta: el acceso se crea con "Crear acceso". */}
                      {pacienteHistorial.tieneCuenta && puedeEditarPaciente ? (
                        <button
                          type="button"
                          onClick={() => abrirCuenta(pacienteHistorial)}
                          title="Opciones de la cuenta del portal"
                          className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-100 cursor-pointer"
                        >
                          Cuenta Portal: Activa
                        </button>
                      ) : (
                        <span className={"rounded-full px-2.5 py-1 text-xs font-semibold " + (pacienteHistorial.tieneCuenta ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500")}>
                          Cuenta Portal: {pacienteHistorial.tieneCuenta ? "Activa" : "Sin cuenta"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setVerHistoriaClinica(true)}
                    aria-haspopup="dialog"
                    className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-1.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 cursor-pointer"
                  >
                    <ClipboardList size={15} /> Historia clínica
                  </button>
                  {puedeAgendar && <button
                    type="button"
                    onClick={() => abrirAgendar(pacienteHistorial)}
                    className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200/60 px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer"
                  >
                    <CalendarPlus size={15} /> Agendar cita
                  </button>}
                  {puedeMensaje && <button
                    type="button"
                    onClick={() => abrirMensaje(pacienteHistorial)}
                    disabled={!pacienteHistorial.telefono}
                    title={pacienteHistorial.telefono ? undefined : "Este paciente no tiene teléfono registrado"}
                    className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200/60 px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <MessageCircle size={15} /> Enviar mensaje
                  </button>}
                  {!pacienteHistorial.tieneCuenta && puedeEditarPaciente && (
                  <button
                    type="button"
                    onClick={() => abrirCuenta(pacienteHistorial)}
                    className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200/60 px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer"
                  >
                    <KeyRound size={15} className="shrink-0" /> Crear acceso
                  </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setVerDatosPaciente(true)}
                    aria-haspopup="dialog"
                    className="flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200/60 px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer"
                  >
                    <IdCard size={15} className="shrink-0" /> Datos
                  </button>
                </div>
              </div>
              </div>

              {(() => {
              const consultasPaciente = consultas
                .filter((c) => c.pacienteId === pacienteHistorial.id || c.paciente === pacienteHistorial.nombre)
                .slice()
                .sort(ordenarPorFechaYCreacion)
              const ordenesPaciente = ordenesLab.filter((o) => o.pacienteId === pacienteHistorial.id)
              const citasPaciente = citas
                .filter((c) => c.pacienteId === pacienteHistorial.id || c.paciente === pacienteHistorial.nombre)
                .slice()
                .sort((a, b) => (a.fecha !== b.fecha ? (a.fecha < b.fecha ? 1 : -1) : minutosDesdeMedianoche(b.hora) - minutosDesdeMedianoche(a.hora)))
              const ventasPaciente = ventas
                .filter((v) => v.pacienteId === pacienteHistorial.id)
                .slice()
                .sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1))
              // Punto 06: facturas_venta (multi-línea, "Nueva factura") nunca se
              // mostraba acá — el botón solo escribía (setFacturasVenta), esta
              // pestaña solo leía de `ventas` (el camino viejo de un producto).
              // Una factura recién generada quedaba invisible en el historial de
              // pagos del propio paciente hasta ir a buscarla a otro lado.
              const facturasPaciente = facturasVenta
                .filter((f) => f.pacienteId === pacienteHistorial.id)
                .slice()
                .sort((a, b) => (a.creadoEn < b.creadoEn ? 1 : -1))
              // Cada venta aparece una sola vez: por comprobante (con sus líneas desplegables). El número del título
              // y el de la pestaña son el mismo: las compras no anuladas.
              const comprobantesPaciente = [
                ...facturasPaciente.map((f) => ({ clave: "factura-" + f.id, fecha: f.creadoEn, factura: f })),
                ...ventasPaciente.map((v) => ({ clave: "venta-" + v.id, fecha: v.creadoEn, venta: v })),
              ].sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
              const comprobantesAnulados = facturasPaciente.filter((f) => f.estado === "anulada").length
              const deudaTotal = ventasPendientesPaciente(ventas, pacienteHistorial.id).reduce((a, v) => a + saldoVenta(v), 0) + saldoPacienteFacturas(pacienteHistorial.id, facturasVenta, abonos)
              const diasControl = diasVencido(pacienteHistorial, consultas)
              const proximoControl = fechaProximoControl(pacienteHistorial, consultas)
              const inactivo = esInactivo(pacienteHistorial, consultas)
              const frecuente = esClienteFrecuente(pacienteHistorial, consultas)
              const totalConsultasFidelizacion = contarConsultas(pacienteHistorial, consultas)
              const referidosPorEste = contarReferidos(pacienteHistorial, pacientes)
              // Compras totales (Lentes/Productos): cuenta + monto de ambos
              // caminos de venta (facturas_venta multi-línea y el mecanismo
              // viejo de un producto), excluyendo facturas anuladas.
              const totalComprasCount = facturasPaciente.filter((f) => f.estado !== "anulada").length + ventasPaciente.length
              const totalComprasMonto = facturasPaciente.filter((f) => f.estado !== "anulada").reduce((a, f) => a + Number(f.montoTotal), 0)
                + ventasPaciente.reduce((a, v) => a + Number(v.montoTotal), 0)
              // Puntaje de fidelidad: fórmula simple y transparente (no una
              // caja negra) — 10 pts por consulta registrada + 15 pts por
              // cada paciente que refirió, mostrado siempre con su desglose
              // al lado para que se entienda de un vistazo cómo se compone.
              const puntajeFidelidad = totalConsultasFidelizacion * 10 + referidosPorEste * 15
              const abiertasPaciente = atencionesAbiertasAntiguas(citasPaciente)
              const paseListo = pases.find((p) => p.pacienteId === pacienteHistorial.id && p.estado === "listo")
              const diasCumple = diasParaCumpleanos(pacienteHistorial.fecha_nacimiento || pacienteHistorial.fechaNacimiento)
              const controlPorAgendar = sinAgendarPorPaciente.get(pacienteHistorial.id)
              // Control del paciente: vencido, o recomendado y todavía sin cita. Es una alerta de arriba, con su botón para agendar,
              // para cualquier paciente (con o sin consultas) mientras no tenga una cita pendiente.
              const hayCitaPendiente = citasPaciente.some((c) => ESTADOS_PENDIENTES.includes(c.estado))
              const alertaControl = proximoControl && !hayCitaPendiente ? (inactivo ? "vencido" : controlPorAgendar ? "sinAgendar" : null) : null

              return (
                <>
                  {/* ─── ALERTAS: lo que conviene saber de este paciente, justo debajo de la cabecera y antes de las pestañas ─── */}
                  {/* ─── ALERTAS DEL PACIENTE: lo que conviene saber de un vistazo.
                      El próximo control vive aquí (y en el historial clínico),
                      no en Fidelización. ─── */}
                  {(paseListo || abiertasPaciente.length > 0 || (alertaControl || (proximoControl && !inactivo && consultasPaciente.length === 0)) || (diasCumple != null && diasCumple <= 30)) && (
                    <div className="mt-5 flex flex-wrap items-center gap-2" aria-label="Alertas del paciente">
                      {paseListo && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/60 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700" title="Esperando a quien vende">
                          <ShoppingBag size={13} aria-hidden="true" /> Listo para venta · desde {fechaLegible(paseListo.pasadaEn)}
                          {puedeVender && <button type="button" onClick={() => setVentaCola({ pase: paseListo, paciente: pacienteHistorial, consulta: consultas.find((k) => k.id === paseListo.consultaId) || null })} className="ml-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-white transition-colors hover:bg-emerald-700 cursor-pointer">Tomar datos</button>}
                        </span>
                      )}
                      {abiertasPaciente.map(({ cita, dias }) => (
                        <span key={cita.id} className="inline-flex flex-wrap items-center gap-2 rounded-full border border-amber-300/70 bg-amber-50 py-1 pl-3 pr-1.5 text-xs font-bold text-amber-800">
                          <AlertTriangle size={13} aria-hidden="true" /> {textoAtencionAbierta(dias)}
                          {puedeAtender && <button type="button" onClick={() => { setPacienteHistorial(null); irAFichaConfirmandoSiHaceFalta(pacienteHistorial, cita.id) }} className="rounded-full bg-amber-600 px-2.5 py-1 text-white transition-colors hover:bg-amber-700 cursor-pointer">Ingresar</button>}
                          {puedeEditarCita && <button type="button" onClick={() => setDejarCita(cita)} className="rounded-full border border-amber-300 bg-white px-2.5 py-1 text-amber-800 transition-colors hover:bg-amber-100 cursor-pointer">Dejar de atender</button>}
                        </span>
                      ))}
                      {alertaControl && (() => {
                        const texto = alertaControl === "vencido" ? `Control vencido hace ${diasControl} día${diasControl === 1 ? "" : "s"}` : `Control sin agendar para el ${fechaLegible(proximoControl)}`
                        const clase = alertaControl === "vencido" ? "border-red-200/60 bg-red-50 text-red-700" : "border-amber-300/70 bg-amber-50 text-amber-800"
                        if (!puedeAgendar) return <span className={"inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold " + clase}><AlertTriangle size={13} aria-hidden="true" /> {texto}</span>
                        return (
                          <button type="button" onClick={() => abrirAgendar(pacienteHistorial, controlPorAgendar ? fechaAISO(proximoControl) : "", controlPorAgendar ? asignadoDelControl(controlPorAgendar.consulta, equipo) : "")} title="Agendar su próximo control" className={"inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors hover:brightness-95 cursor-pointer " + clase}>
                            <AlertTriangle size={13} aria-hidden="true" /> {texto} · Agendar
                          </button>
                        )
                      })()}
                      {!alertaControl && proximoControl && !inactivo && consultasPaciente.length === 0 && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200/60 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                          <Calendar size={13} className="text-slate-500" aria-hidden="true" />
                          Control recomendado: {fechaLegible(proximoControl)}
                          <span className="font-normal text-slate-500">· {diasControl === 0 ? "es hoy" : `${Math.abs(diasControl) === 1 ? "falta 1 día" : `faltan ${Math.abs(diasControl)} días`}`}</span>
                        </span>
                      )}
                      {diasCumple != null && diasCumple <= 30 && (
                        <span className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold" style={{ borderColor: "rgba(200,162,78,0.4)", backgroundColor: "rgba(200,162,78,0.1)", color: "#7c5e14" }}>
                          <Cake size={13} aria-hidden="true" /> {diasCumple === 0 ? "Hoy cumple años" : `Cumple años en ${diasCumple} día${diasCumple === 1 ? "" : "s"}`}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Segmented control tipo píldora — mismo lenguaje que el
                      resto del sistema para "esto está activo" (ver filtros
                      de Citas.jsx), en vez del subrayado recto que tenía
                      antes. role="tablist"/"tab"/aria-selected para que un
                      lector de pantalla las anuncie como pestañas, no como
                      4 botones sueltos. */}
                  <div role="tablist" aria-label="Secciones del paciente" className="mt-5 flex w-fit max-w-full items-center gap-1.5 overflow-x-auto rounded-xl border border-slate-200/60 bg-white p-1 shadow-sm">
                    {[
                      { id: "citas", etiqueta: "Citas", Icono: Calendar, cuenta: citasPaciente.length },
                    ].map(({ id, etiqueta, Icono, cuenta }) => (
                      <button
                        key={id}
                        type="button"
                        role="tab"
                        id={"tab-" + id}
                        aria-selected={tabHistorial === id}
                        aria-controls="panel-paciente"
                        onClick={() => setTabHistorial(id)}
                        className={"flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition cursor-pointer " + (tabHistorial === id ? "text-white" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800")}
                        style={tabHistorial === id ? { background: GRAD } : undefined}
                      >
                        {/* El ing pidió dos secciones en vez de un historial único (29 sept.,
                            R45): Citas (pendientes, próxima e historial) y Diagnósticos
                            (cada atención con su motivo y diagnóstico, con la tendencia arriba). */}
                        <Icono size={14} /> {etiqueta}
                        {cuenta > 0 && <span className={"rounded-full px-1.5 py-0.5 text-xs font-bold " + (tabHistorial === id ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500")}>{cuenta}</span>}
                      </button>
                    ))}
                    <button
                      type="button"
                      role="tab"
                      id="tab-resumen"
                      aria-selected={tabHistorial === "resumen"}
                      aria-controls="panel-paciente"
                      onClick={() => setTabHistorial("resumen")}
                      className={"flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition cursor-pointer " + (tabHistorial === "resumen" ? "text-white" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800")}
                      style={tabHistorial === "resumen" ? { background: GRAD } : undefined}
                    >
                      <BarChart3 size={14} /> Resumen
                    </button>
                    <button
                      type="button"
                      role="tab"
                      id="tab-pagos"
                      aria-selected={tabHistorial === "pagos"}
                      aria-controls="panel-paciente"
                      onClick={() => setTabHistorial("pagos")}
                      className={"flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition cursor-pointer " + (tabHistorial === "pagos" ? "text-white" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800")}
                      style={tabHistorial === "pagos" ? { background: GRAD } : undefined}
                    >
                      {/* El ing rechazó tanto "Pagos" como "Ventas" para esta
                          pestaña — "aquí están los productos que yo le he
                          vendido al paciente", así que la etiqueta pasa a ser
                          literal. Reunión 29 sept.: separa productos de
                          servicios (la línea "Consulta" del cobro de la
                          ficha clínica incluida), así que el nombre ya no
                          puede ser solo "productos". */}
                      <Wallet size={14} /> Productos y servicios
                      {totalComprasCount > 0 && <span className={"rounded-full px-1.5 py-0.5 text-xs font-bold " + (tabHistorial === "pagos" ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500")}>{totalComprasCount}</span>}
                      {deudaTotal > 0 && <span className={"rounded-full px-1.5 py-0.5 text-xs font-bold " + (tabHistorial === "pagos" ? "bg-white/25 text-white" : "bg-amber-100 text-amber-700")}>${deudaTotal.toFixed(0)}</span>}
                    </button>
                    <button
                      type="button"
                      role="tab"
                      id="tab-ordenes"
                      aria-selected={tabHistorial === "ordenes"}
                      aria-controls="panel-paciente"
                      onClick={() => setTabHistorial("ordenes")}
                      className={"flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition cursor-pointer " + (tabHistorial === "ordenes" ? "text-white" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700")}
                      style={tabHistorial === "ordenes" ? { background: GRAD } : undefined}
                    >
                      <FlaskConical size={14} /> Órdenes de laboratorio
                      {ordenesPaciente.length > 0 && <span className={"rounded-full px-1.5 py-0.5 text-xs font-bold " + (tabHistorial === "ordenes" ? "bg-white/25 text-white" : "bg-slate-100 text-slate-500")}>{ordenesPaciente.length}</span>}
                      {ordenesPaciente.some((o) => o.estado === "lista" && !o.pacienteAvisadoEn) && <span className={"rounded-full px-1.5 py-0.5 text-xs font-bold " + (tabHistorial === "ordenes" ? "bg-white/25 text-white" : "bg-amber-100 text-amber-700")}>Avisar</span>}
                    </button>
                  </div>

                  {/* key={tabHistorial}: remonta el panel en cada cambio de
                      pestaña para que "rise-in" (ya estándar en el resto del
                      sistema, 320ms) se dispare de nuevo — antes el
                      contenido cambiaba de golpe sin ninguna transición. */}
                  <div key={tabHistorial} role="tabpanel" id="panel-paciente" aria-labelledby={"tab-" + tabHistorial} className="py-6" style={{ animation: "rise-in 320ms ease-out both" }}>
                    {tabHistorial === "resumen" ? (
                      <PanelResumenPaciente
                        consultas={consultasPaciente}
                        citas={citasPaciente}
                        inactivo={inactivo}
                        proximoControl={proximoControl}
                        diasControl={diasControl}
                        diasDesdeUltimaVisita={diasDesdeUltimaVisita(pacienteHistorial, consultas)}
                        compras={{ cantidad: totalComprasCount, monto: totalComprasMonto }}
                        equipo={equipo}
                        comprobantes={comprobantesPaciente}
                        referidosLista={listarReferidos(pacienteHistorial, pacientes)}
                        paciente={pacienteHistorial}
                        usuario={usuario}
                        parametrizacion={parametrizacion}
                        adjuntosDe={adjuntosConsulta}
                        onAbrirPaciente={(p) => { setTabHistorial("citas"); setPacienteHistorial(p) }}
                        onVerProductos={() => setTabHistorial("pagos")}
                        onAgendar={puedeAgendar ? () => abrirAgendar(pacienteHistorial) : undefined}
                        fidelidad={{ puntaje: puntajeFidelidad, consultas: totalConsultasFidelizacion, referidos: referidosPorEste, frecuente, referidoPor: pacienteHistorial.referidoPor, diasCumple, edad: edadPaciente, onCrm: () => setVista?.("crm") }}
                      />
                    ) : tabHistorial === "citas" ? (
                      <div className="space-y-4">
                        <PanelCitasPaciente
                        citas={citasPaciente}
                        consultas={consultasPaciente}
                        onDejarDeAtender={puedeEditarCita ? setDejarCita : undefined}
                        onAgendar={puedeAgendar ? () => abrirAgendar(pacienteHistorial) : undefined}
                        onIngresar={puedeAtender ? (cita) => { setPacienteHistorial(null); irAFichaConfirmandoSiHaceFalta(pacienteHistorial, cita.id) } : undefined}
                        cobros={cobrosPendientes(consultasPaciente, facturasVenta, citas)}
                        onCobrar={puedeVender ? setCobrandoPendiente : undefined}
                        paciente={pacienteHistorial}
                        usuario={usuario}
                        parametrizacion={parametrizacion}
                      />
                      </div>
                    ) : tabHistorial === "pagos" ? (
                      <div className="space-y-4">
                        {deudaTotal > 0 && (
                          <p role="status" className="flex items-center gap-2 rounded-xl border border-amber-200/60 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800">
                            <Wallet size={16} className="shrink-0 text-amber-600" aria-hidden="true" /> Saldo pendiente de ventas: ${deudaTotal.toFixed(2)}
                          </p>
                        )}
                        {/* Para las ventas sin receta (un líquido, un estuche...). La venta de la receta sale solo de la alerta "Listo para venta". */}
                        {puedeVender && <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs text-slate-500">Venta sin receta: productos y servicios, con pago directo, tarjeta o cuotas.</p>
                          <button
                            type="button"
                            onClick={() => { setFacturaLineaInicial(undefined); setMostrarFactura(true) }}
                            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:brightness-110 cursor-pointer"
                            style={{ background: GRAD }}
                          >
                            <Receipt size={14} aria-hidden="true" /> Nueva venta
                          </button>
                        </div>}
                        {comprobantesPaciente.length === 0 ? (
                          <div className="flex flex-col items-center gap-2 py-10 text-center" style={{ animation: "rise-in 250ms ease-out both" }}>
                            <div className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-300"><Wallet size={22} /></div>
                            <p className="text-sm font-medium text-slate-500">Este paciente todavía no tiene compras registradas.</p>
                            <p className="max-w-sm text-xs text-slate-400">Cuando una ficha deje una receta, aparece arriba "Listo para venta".</p>
                          </div>
                        ) : (
                          <section aria-label="Compras del paciente">
                            <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500"><Receipt size={13} /> Compras <span className="font-normal normal-case text-slate-400">· {totalComprasCount}{comprobantesAnulados > 0 ? ` · ${comprobantesAnulados} anulada${comprobantesAnulados === 1 ? "" : "s"}` : ""}</span></h3>
                            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200/60" aria-label="Compras del paciente">
                              {comprobantesPaciente.map((c) => c.factura ? (
                                <FilaComprobante
                                  key={c.clave} factura={c.factura} abonos={abonos} ordenes={ordenesLab.filter((o) => o.facturaId === c.factura.id)}
                                  puedeEditar={puedeEditarVentas} puedeVender={puedeVender} puedeAnular={puedeAnular} lineasDesplegables
                                  onAbonar={(fac) => setAbonoPara({ factura: fac, paciente: pacienteHistorial })}
                                  onOrden={(fac) => setOrdenParaVenta({ factura: fac, paciente: pacienteHistorial })}
                                  onAnular={(fac) => setAnularPara({ factura: fac, paciente: pacienteHistorial })}
                                  onFacturaElectronica={(fac) => setFacturaElectronicaPara({ factura: fac, paciente: pacienteHistorial })}
                                />
                              ) : (() => {
                                // Venta rápida de un producto (el mecanismo anterior a las facturas): se sigue cobrando en cuotas como siempre.
                                const v = c.venta
                                const saldo = saldoVenta(v)
                                return (
                                  <li key={c.clave} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div>
                                      <p className="text-sm font-semibold text-slate-800">{v.productoNombre}</p>
                                      <p className="text-[11px] text-slate-500">
                                        {v.cantidad} u. · ${Number(v.montoTotal).toFixed(2)} · {METODOS_PAGO[v.metodoPago] || v.metodoPago}
                                        {v.metodoPago === "cuotas" && v.cuotasTotales ? ` (${v.cuotasPagadas || 0}/${v.cuotasTotales})` : ""}
                                        {" · "}{fechaLegible(v.creadoEn)}
                                      </p>
                                    </div>
                                    {v.estado === "completado" ? (
                                      <span className="inline-flex w-fit items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">
                                        <CheckCircle size={12} /> Pagada
                                      </span>
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                                          <CreditCard size={12} /> Saldo ${saldo.toFixed(2)}
                                        </span>
                                        {v.metodoPago === "cuotas" && v.cuotasTotales ? (
                                          <button type="button" onClick={() => registrarCuotaPagada(v)} className="rounded-lg border border-slate-200/60 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer">
                                            Registrar cuota
                                          </button>
                                        ) : null}
                                        <button type="button" onClick={() => marcarVentaPagada(v)} className="rounded-lg border border-emerald-200/60 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-100 cursor-pointer">
                                          Marcar pagada
                                        </button>
                                      </div>
                                    )}
                                  </li>
                                )
                              })())}
                            </ul>
                          </section>
                        )}
                      </div>
                    ) : tabHistorial === "ordenes" ? (
                      <OrdenesLaboratorio
                        accion={puedeVender && comprobantesPaciente.some((c) => c.factura && c.factura.estado !== "anulada") ? (
                          <button
                            type="button"
                            title="Un pedido al laboratorio sale de una venta del paciente (lleva su montura y su luna)"
                            onClick={() => {
                              const ventas = comprobantesPaciente.filter((c) => c.factura && c.factura.estado !== "anulada")
                              if (ventas.length === 1) setOrdenParaVenta({ factura: ventas[0].factura, paciente: pacienteHistorial })
                              else setElegirVentaOrden(true)
                            }}
                            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:brightness-110 cursor-pointer"
                            style={{ background: GRAD }}
                          >
                            <FlaskConical size={14} aria-hidden="true" /> Enviar a laboratorio
                          </button>
                        ) : null}
                        accionVacio={puedeVender && (() => {
                          const pase = pases.find((p) => p.pacienteId === pacienteHistorial.id && p.estado === "listo")
                          return pase ? (
                            <button type="button" onClick={() => setVentaCola({ pase, paciente: pacienteHistorial, consulta: consultas.find((k) => k.id === pase.consultaId) || null })} className="mt-1 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:brightness-110 cursor-pointer" style={{ background: GRAD }}>
                              <ShoppingBag size={14} aria-hidden="true" /> Vender la receta
                            </button>
                          ) : null
                        })()}
                        ordenes={ordenesLab}
                        setOrdenes={setOrdenesLab}
                        pacientes={pacientes}
                        equipo={equipo}
                        usuario={usuario}
                        pacienteFijo={pacienteHistorial}
                        filtroInicial="todas"
                        facturas={facturasVenta}
                        abonos={abonos}
                        onAbonar={(factura, paciente) => setAbonoPara({ factura, paciente })}
                        filtroInicial="todas"
                        onAviso={mostrarNotif}
                      />
                    ) : null}
                  </div>
                </>
              )
            })()}
            </div>
          </div>
        </div>,
        document.getElementById("vista-completa-root") || document.body
      )}

      {elegirVentaOrden && pacienteHistorial && (
        <ElegirVentaOrdenModal
          paciente={pacienteHistorial}
          comprobantes={facturasVenta.filter((f) => f.pacienteId === pacienteHistorial.id).map((f) => ({ clave: "factura-" + f.id, factura: f }))}
          ordenes={ordenesLab}
          onElegir={(factura) => { setElegirVentaOrden(false); setOrdenParaVenta({ factura, paciente: pacienteHistorial }) }}
          onNuevaVenta={() => { setElegirVentaOrden(false); setTabHistorial("pagos"); setFacturaLineaInicial(undefined); setMostrarFactura(true) }}
          onCerrar={() => setElegirVentaOrden(false)}
        />
      )}

      {verDatosPaciente && pacienteHistorial && (
        <ModalDatosPaciente
          paciente={pacienteHistorial}
          onEditar={puedeEditarPaciente ? () => abrirEdicion(pacienteHistorial) : undefined}
          onCerrar={() => setVerDatosPaciente(false)}
        />
      )}

      {verHistoriaClinica && pacienteHistorial && (
        <ModalHistoriaClinica
          paciente={pacienteHistorial}
          consultas={consultas.filter((c) => c.pacienteId === pacienteHistorial.id || c.paciente === pacienteHistorial.nombre).slice().sort(ordenarPorFechaYCreacion)}
          onCerrar={() => setVerHistoriaClinica(false)}
        />
      )}

      {cobrandoPendiente && pacienteHistorial && (
        <ComprobanteVentaModal
          usuario={usuario}
          inventario={inventario}
          setInventario={setInventario}
          categorias={categoriasInventario}
          setCategorias={setCategoriasInventario}
          pacienteFijo={pacienteHistorial}
          titulo={`Cobrar la atención de ${pacienteHistorial.nombre}`}
          subtitulo={`Consulta del ${fechaLegible(cobrandoPendiente.consulta.fecha)}${cobrandoPendiente.consulta.motivo ? ` · ${cobrandoPendiente.consulta.motivo}` : ""}`}
          etiquetaGuardar="Cobrar y finalizar"
          lineasIniciales={lineasCobroConsulta(cobrandoPendiente.consulta, parametrizacion)}
          consultaId={cobrandoPendiente.consulta.id}
          citaId={cobrandoPendiente.cita?.id || null}
          onGuardado={alCobrarPendiente}
          onCerrar={() => setCobrandoPendiente(null)}
        />
      )}

      <ModalesVentas
        v={ventasApi} usuario={usuario} parametrizacion={parametrizacion} inventario={inventario} setInventario={setInventario}
        categoriasInventario={categoriasInventario} setCategoriasInventario={setCategoriasInventario} abonos={abonos} ordenesLab={ordenesLab}
      />

      {/* ─── PANEL DE COBRO / NUEVA VENTA (desde el perfil del paciente) ─── */}
      {((mostrarFactura && pacienteHistorial) || ventaRapidaPara) && (
        <ComprobanteVentaModal
          usuario={usuario}
          inventario={inventario}
          setInventario={setInventario}
          categorias={categoriasInventario}
          setCategorias={setCategoriasInventario}
          pacienteFijo={pacienteVenta}
          lineasIniciales={facturaLineaInicial}
          vinculoSugerido={(() => {
            const p = pases.find((x) => x.pacienteId === pacienteVenta.id && x.estado === "listo")
            if (!p) return null
            const c = consultas.find((k) => k.id === p.consultaId)
            return { consultaId: p.consultaId, citaId: p.citaId, etiqueta: `¿Esta venta es de la consulta del ${fechaLegible(c?.fecha) || "paciente"}? (listo para venta)` }
          })()}
          onGuardado={registrarFactura}
          onCerrar={() => { setMostrarFactura(false); setVentaRapidaPara(null) }}
        />
      )}

      {/* ─── MODAL AGENDAR CITA (desde el perfil del paciente) ─── */}
      {agendarPara && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={() => setAgendarPara(null)}>
          <div className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-2xl" style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)", willChange: "transform, opacity" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: GRAD }}>
                  <Stethoscope size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold" style={{ color: INK }}>Agendar cita</h3>
                  <p className="text-xs text-slate-500">Para {agendarPara.nombre}</p>
                </div>
              </div>
              <button type="button" onClick={() => setAgendarPara(null)} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={validarYPedirConfirmacionCita} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                {errorAgendar && (
                  <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200/60 bg-red-50 p-3 text-sm font-medium text-red-700">
                    <AlertCircle size={16} /> {errorAgendar}
                  </div>
                )}

                <CamposCita
                  prefijoId="pacientes-agendar"
                  motivosConsulta={motivosConsulta}
                  equipo={equipo}
                  disponibilidad={disponibilidad}
                  citas={citas}
                  atenderInmediato={atenderInmediato}
                  errorHorarioCustom={errorHorarioAgendar}
                  valores={{ motivo: agendarMotivo, asignadoA: agendarAsignado, fecha: agendarFecha, hora: agendarHora, horaPersonalizada: agendarHoraPersonalizada, horaCustom: agendarHoraCustom, duracionCustom: agendarDuracion }}
                  cambiar={{ setMotivo: setAgendarMotivo, setAsignadoA: setAgendarAsignado, setFecha: setAgendarFecha, setHora: setAgendarHora, setHoraPersonalizada: setAgendarHoraPersonalizada, setHoraCustom: setAgendarHoraCustom, setDuracionCustom: setAgendarDuracion, limpiarErrorHorario: () => setErrorHorarioAgendar("") }}
                />
              </div>

              <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-5 py-4">
                <button type="button" onClick={() => setAgendarPara(null)} className="rounded-xl border border-slate-200/60 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5 cursor-pointer" style={{ background: GRAD, boxShadow: "0 12px 24px -12px rgba(37,99,235,0.6)" }}>
                  {atenderInmediato ? "Atender ahora" : "Confirmar cita"} <ChevronRight size={16} />
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* ─── CONFIRMACIÓN DE AGENDAMIENTO ─── */}
      {confirmandoCita && agendarPara && (
        <ConfirmarCitaModal
          paciente={agendarPara.nombre}
          motivo={agendarMotivo}
          fecha={agendarFecha ? formatoFecha(agendarFecha, "largoSinDia") : ""}
          hora={agendarHoraPersonalizada ? `${horaA12(agendarHoraCustom)} (personalizada, ~${agendarDuracion} min)` : agendarHora}
          onCancelar={() => setConfirmandoCita(false)}
          onConfirmar={confirmarAgendarCita}
          guardando={guardandoCita}
        />
      )}

      {/* ─── SELECCIÓN DE CITA AL ENTRAR A LA FICHA CLÍNICA (pedido del ing,
          reunión 29 sept.) ─── */}
      {seleccionCitaPara && (
        <SeleccionarCitaModal
          paciente={seleccionCitaPara.paciente.nombre}
          citas={seleccionCitaPara.citas}
          onSeleccionar={(citaId) => { const p = seleccionCitaPara.paciente; setSeleccionCitaPara(null); irAFichaConfirmandoSiHaceFalta(p, citaId) }}
          onAbrirSinCita={() => { const p = seleccionCitaPara.paciente; setSeleccionCitaPara(null); abrirAtenderAhora(p) }}
          onCerrar={() => setSeleccionCitaPara(null)}
        />
      )}

      {/* ─── CONFIRMAR DATOS DEL PACIENTE (D2, reunión 29 sept.) ─── */}
      {confirmarDatosPara && (
        <ConfirmarDatosPacienteModal
          usuario={usuario}
          paciente={confirmarDatosPara.paciente}
          pacientes={pacientes}
          setPacientes={setPacientes}
          onConfirmado={(pacienteConfirmado) => {
            const { citaId, motivo } = confirmarDatosPara
            setConfirmarDatosPara(null)
            onIrAFichaClinica?.(pacienteConfirmado, citaId, motivo)
          }}
          onCerrar={() => setConfirmarDatosPara(null)}
        />
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

      {/* ─── MODAL ENVIAR MENSAJE (desde el perfil del paciente) ─── */}
      {mensajePara && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={() => setMensajePara(null)}>
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-2xl" style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)", willChange: "transform, opacity" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: "linear-gradient(135deg,#34d399,#059669)" }}>
                  <MessageCircle size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold" style={{ color: INK }}>Enviar mensaje por CRM</h3>
                  <p className="text-xs text-slate-500">Para {mensajePara.nombre} · {mensajePara.telefono}{tieneCorreoValido(mensajePara) ? " · " + mensajePara.correo : ""}</p>
                </div>
              </div>
              <button type="button" onClick={() => setMensajePara(null)} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-3 p-5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Plantilla</span>
                {plantillasMensaje(mensajePara).map((p) => (
                  <button key={p.id} type="button" onClick={() => setTextoMensaje(p.texto)} className="rounded-full border border-slate-200/60 bg-white px-3 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">{p.etiqueta}</button>
                ))}
              </div>
              <div>
                <label htmlFor="texto-mensaje-whatsapp" className="mb-1.5 block text-sm font-semibold text-slate-700">Mensaje</label>
                <textarea
                  id="texto-mensaje-whatsapp"
                  rows={4}
                  value={textoMensaje}
                  onChange={(e) => setTextoMensaje(e.target.value)}
                  className="w-full resize-none rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50"
                />
                <p className="mt-1.5 text-xs text-slate-500">Se abre WhatsApp o Gmail con este texto ya escrito: tú lo revisas y lo mandas ahí. Funciona aunque los envíos automáticos estén apagados, y queda marcado como contactado hoy en el CRM.</p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={enviarMensajeWhatsApp}
                disabled={!textoMensaje.trim()}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#34d399,#059669)" }}
              >
                <MessageCircle size={15} /> Enviar por WhatsApp
              </button>
                <button
                  type="button"
                  onClick={enviarMensajeGmail}
                  disabled={!textoMensaje.trim() || !tieneCorreoValido(mensajePara)}
                  title={tieneCorreoValido(mensajePara) ? "Abre Gmail con el mensaje escrito" : "Este paciente no tiene correo registrado"}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200/60 bg-white py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Mail size={15} /> Abrir en Gmail
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

// ─── Perfil del paciente: sección Citas ───
// Pendientes y próxima cita arriba (con "Ingresar" a la ficha de esa cita) y el
// historial de citas debajo.
const BADGE_ESTADO_CITA = {
  "En Atención": "border-blue-200/60 bg-blue-50 text-blue-700",
  Atendida: "border-emerald-200/60 bg-emerald-50 text-emerald-700",
  "No Asistió": "border-red-200/60 bg-red-50 text-red-700",
  Cancelada: "border-slate-200/60 bg-slate-100 text-slate-500",
}
const ETIQUETA_ESTADO_CITA = { "En Atención": "En atención", "No Asistió": "No asistió" }
const ESTADOS_PENDIENTES = ["Pendiente", "En Espera", "En Atención"]

function BadgeEstadoCita({ estado }) {
  return (
    <span className={"rounded-full border px-2.5 py-0.5 text-xs font-semibold " + (BADGE_ESTADO_CITA[estado] || "border-amber-200/60 bg-amber-50 text-amber-700")}>
      {ETIQUETA_ESTADO_CITA[estado] || estado || "Pendiente"}
    </span>
  )
}

// Imágenes adjuntas de una consulta (el bucket es privado: cada miniatura pide su URL firmada).
function adjuntosConsulta(consulta) {
  if (!consulta?.imagenes?.length) return null
  return (
    <div className="mt-3">
      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600"><ImageIcon size={13} /> Imágenes adjuntas</p>
      <div className="flex flex-wrap gap-2">{consulta.imagenes.map((img) => <MiniaturaAdjunto key={img.path} path={img.path} />)}</div>
    </div>
  )
}

function PanelCitasPaciente({ citas, consultas = [], onIngresar, onDejarDeAtender, onAgendar, cobros = [], onCobrar, paciente, usuario, parametrizacion }) {
  // El diagnóstico de una cita atendida se abre en una ventana encima del perfil, sin mover el resto de la lista.
  const [citaAbierta, setCitaAbierta] = useState(null)
  // Buscador del historial: rango de fechas y texto libre (motivo o diagnóstico), para ubicar una cita de hace meses.
  const [desde, setDesde] = useState("")
  const [hasta, setHasta] = useState("")
  const [texto, setTexto] = useState("")
  // Arriba va solo la cita actual o próxima; las demás pendientes se despliegan con "+N citas pendientes más".
  const [verOtras, setVerOtras] = useState(false)
  const consultaDe = (cita) => cita._consulta || consultas.find((k) => k.citaId === cita.id)
  const porFechaHora = (a, b) => (a.fecha !== b.fecha ? (a.fecha < b.fecha ? -1 : 1) : minutosDesdeMedianoche(a.hora) - minutosDesdeMedianoche(b.hora))
  const pendientes = citas.filter((c) => ESTADOS_PENDIENTES.includes(c.estado)).sort((a, b) => (a.estado === "En Atención" ? -1 : b.estado === "En Atención" ? 1 : porFechaHora(a, b)))
  // Una atención sin cita (paciente que llegó sin agendar) también aparece aquí: así este historial es el único lugar donde se ve todo lo que pasó.
  const sinCita = consultas.filter((k) => !citas.some((c) => c.id === k.citaId)).map((k) => ({ id: "consulta-" + k.id, fecha: k.fecha, hora: "Sin cita", motivo: k.motivo, estado: "Atendida", _consulta: k }))
  const historialCompleto = [...citas.filter((c) => !ESTADOS_PENDIENTES.includes(c.estado)), ...sinCita].sort((a, b) => porFechaHora(b, a))
  const quitarTildes = (t) => String(t ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  const buscado = quitarTildes(texto.trim())
  const historial = historialCompleto.filter((c) => {
    if (desde && c.fecha < desde) return false
    if (hasta && c.fecha > hasta) return false
    if (!buscado) return true
    const k = consultaDe(c)
    return quitarTildes([c.motivo, c.estado, k && textoDiagnostico(k), k?.lenteRecomendado].filter(Boolean).join(" ")).includes(buscado)
  })
  const hayFiltro = !!(desde || hasta || texto.trim())
  const limpiarFiltro = () => { setDesde(""); setHasta(""); setTexto("") }
  // Atajos de rango: terminan hoy y empiezan hace 1, 6 o 12 meses.
  const rangoReciente = (meses) => {
    const f = ahoraEcuador()
    f.setMonth(f.getMonth() - meses)
    setDesde(fechaAISO(f))
    setHasta(hoyISO())
  }
  const proxima = pendientes[0]
  const otras = pendientes.slice(1)
  const fila = (c, conIngresar) => (
    <li
      key={c.id}
      className={"flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 " + (!conIngresar && consultaDe(c) ? "-mx-2 cursor-pointer rounded-lg px-2 transition-colors hover:bg-slate-50" : "")}
      onClick={!conIngresar && consultaDe(c) ? () => setCitaAbierta(c) : undefined}
    >
      <div className="w-40 shrink-0">
        <p className="text-sm font-semibold text-slate-800">{fechaLegible(c.fecha) || "Sin fecha"}</p>
        <p className="text-xs text-slate-500">{c.hora}</p>
      </div>
      <p className="min-w-0 flex-1 truncate text-sm text-slate-600">{c.motivo || "Consulta general"}</p>
      <BadgeEstadoCita estado={c.estado} />
      {!conIngresar && consultaDe(c) && (
        <button type="button" onClick={(e) => { e.stopPropagation(); setCitaAbierta(c) }} aria-haspopup="dialog" aria-label={"Ver la atención del " + (fechaLegible(c.fecha) || "")} className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50 cursor-pointer">
          Ver atención <ChevronRight size={14} aria-hidden="true" />
        </button>
      )}
      {conIngresar && onIngresar && (
        <button type="button" onClick={() => onIngresar(c)} className="flex items-center gap-1.5 rounded-lg border border-slate-200/60 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer">
          <Stethoscope size={13} aria-hidden="true" /> Ingresar
        </button>
      )}
    </li>
  )
  return (
    <div className="space-y-5">
      {/* Dos bloques pequeños, juntos en una fila; cada uno ocupa lo que necesita. Sin ninguno, no aparece nada. */}
      {(proxima || cobros.length > 0) && (
        <div className="flex flex-wrap items-stretch gap-3">
          {proxima && (
            <section aria-label="Próxima cita" className="flex flex-wrap items-center gap-3 rounded-xl border border-blue-200/60 bg-blue-50/50 px-3.5 py-2.5">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white" style={{ background: GRAD }}><Calendar size={16} aria-hidden="true" /></div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wide text-blue-700">{proxima.estado === "En Atención" ? "Cita en atención" : "Próxima cita"}</p>
                {diasAtencionAbierta(proxima) !== null && <p className="text-[11px] font-bold text-amber-700">{textoAtencionAbierta(diasAtencionAbierta(proxima))}</p>}
                <p className="text-sm font-bold" style={{ color: INK }}>{fechaLegible(proxima.fecha) || "Sin fecha"} · {proxima.hora}</p>
                <p className="truncate text-xs text-slate-600">{proxima.motivo || "Consulta general"}</p>
              </div>
              <BadgeEstadoCita estado={proxima.estado} />
              {diasAtencionAbierta(proxima) !== null && onDejarDeAtender && (
                <button type="button" onClick={() => onDejarDeAtender(proxima)} className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold text-amber-800 transition-colors hover:bg-amber-50 cursor-pointer">Dejar de atender</button>
              )}
              {onIngresar && (
                <button type="button" onClick={() => onIngresar(proxima)} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:brightness-110 cursor-pointer" style={{ background: GRAD }}>
                  <Stethoscope size={14} aria-hidden="true" /> Ingresar
                </button>
              )}
            </section>
          )}
          {cobros.map(({ consulta, cita }) => (
            <section key={consulta.id} role="status" aria-label="Cobro pendiente" className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200/60 bg-amber-50 px-3.5 py-2.5">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-600 text-white"><Receipt size={16} aria-hidden="true" /></div>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wide text-amber-800">Cobro pendiente</p>
                <p className="text-sm font-bold text-amber-950">Consulta del {fechaLegible(consulta.fecha)}</p>
                {consulta.motivo && <p className="truncate text-xs text-amber-900/80">{consulta.motivo}</p>}
              </div>
              {onCobrar && <button type="button" onClick={() => onCobrar({ consulta, cita })} className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-amber-700 cursor-pointer">Cobrar</button>}
            </section>
          ))}
        </div>
      )}

      {!proxima && cobros.length === 0 && historialCompleto.length === 0 && (
        <section aria-label="Sin citas" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-slate-300 bg-white p-5">
          <p className="flex items-center gap-2 text-sm font-medium text-slate-600"><Calendar size={16} className="text-slate-400" aria-hidden="true" /> Este paciente no tiene citas</p>
          {onAgendar && <button type="button" onClick={onAgendar} className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer" style={{ background: GRAD }}><CalendarPlus size={15} aria-hidden="true" /> Agendar cita</button>}
        </section>
      )}

      {otras.length > 0 && (
        <section aria-label="Otras citas pendientes">
          <button
            type="button"
            onClick={() => setVerOtras((v) => !v)}
            aria-expanded={verOtras}
            className="flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm font-semibold text-blue-700 transition-colors hover:text-blue-800 cursor-pointer"
          >
            <ChevronRight size={14} aria-hidden="true" className={"transition-transform " + (verOtras ? "rotate-90" : "")} />
            {verOtras ? "Ocultar" : "+" + otras.length} {otras.length === 1 ? "cita pendiente más" : "citas pendientes más"}
          </button>
          {verOtras && <ul className="mt-1 divide-y divide-slate-100 rounded-2xl border border-slate-200/60 bg-white px-4">{otras.map((c) => fila(c, true))}</ul>}
        </section>
      )}

      {(proxima || historialCompleto.length > 0) && <section aria-label="Historial de citas">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Historial de citas · {hayFiltro ? historial.length + " de " + historialCompleto.length : historialCompleto.length}</h3>
        {historialCompleto.length > 0 && (
          <div role="search" aria-label="Buscar en el historial de citas" className="mb-3 flex flex-wrap items-start gap-x-2 gap-y-2 rounded-2xl border border-slate-200/60 bg-white p-2">
            <label className="min-w-0 flex-1 basis-48">
              <span className="sr-only">Buscar por motivo o diagnóstico</span>
              <span className="relative block">
                <Search size={14} aria-hidden="true" className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input type="search" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Motivo o diagnóstico" className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-sm font-normal text-slate-700 outline-none focus-visible:border-blue-500" />
              </span>
            </label>
            <div className="w-56 shrink-0">
              <SeccionRango flotante rango={{ desde, hasta, onDesde: setDesde, onHasta: setHasta }} />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {[["Último mes", 1], ["6 meses", 6], ["Último año", 12]].map(([etiqueta, meses]) => (
                <button key={meses} type="button" onClick={() => rangoReciente(meses)} className="rounded-full border border-slate-200/60 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 cursor-pointer">{etiqueta}</button>
              ))}
              {hayFiltro && <button type="button" onClick={limpiarFiltro} className="rounded-full px-3 py-1.5 text-xs font-semibold text-blue-700 transition-colors hover:bg-blue-50 cursor-pointer">Limpiar</button>}
            </div>
          </div>
        )}
        {historial.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-5 text-center text-sm text-slate-500">{hayFiltro ? "Ninguna cita coincide con esa búsqueda." : "Todavía no hay citas pasadas."}</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200/60 bg-white px-4">{historial.map((c) => fila(c, false))}</ul>
        )}
      </section>}
      {citaAbierta && consultaDe(citaAbierta) && (
        <ModalAtencion
          cita={citaAbierta}
          consulta={consultaDe(citaAbierta)}
          paciente={paciente}
          usuario={usuario}
          adjuntos={consultaDe(citaAbierta).imagenes?.length > 0 && (
            <div className="mt-3">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600"><ImageIcon size={13} /> Imágenes adjuntas</p>
              <div className="flex flex-wrap gap-2">{consultaDe(citaAbierta).imagenes.map((img) => <MiniaturaAdjunto key={img.path} path={img.path} />)}</div>
            </div>
          )}
          onCerrar={() => setCitaAbierta(null)}
        />
      )}
    </div>
  )
}

// ─── Perfil del paciente: pestaña Resumen ───
// Lo que antes se mezclaba con las citas: cómo va el paciente (corrección, próximo control, compras, fidelidad),
// la tendencia de su graduación y cómo ha venido (conteos de citas y citas por mes).
// Un cuadro que se puede tocar: mismo aspecto que antes, con una flecha que indica que se despliega.
function Cuadro({ clave, abierto, alternar, className = "", style, children }) {
  return (
    <button
      type="button"
      onClick={() => alternar(clave)}
      aria-expanded={abierto === clave}
      className={"group relative w-full text-left transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-500 " + (abierto === clave ? "ring-2 ring-blue-500/60 " : "hover:border-slate-300 ") + className}
      style={style}
    >
      {children}
      <ChevronDown size={14} aria-hidden="true" className={"absolute right-3 top-3 text-slate-400 transition-transform " + (abierto === clave ? "rotate-180 text-blue-600" : "group-hover:text-slate-600")} />
    </button>
  )
}

const TENDENCIA_TEXTO = {
  Disminuyó: "La graduación medida disminuyó respecto a la consulta anterior.",
  Aumentó: "La graduación medida aumentó respecto a la consulta anterior.",
  "Sin cambios": "La graduación medida se mantiene estable.",
}

function PanelResumenPaciente({ consultas, citas, inactivo, proximoControl, diasControl, diasDesdeUltimaVisita, compras, fidelidad, equipo, comprobantes, referidosLista, paciente, usuario, parametrizacion, adjuntosDe, onAbrirPaciente, onVerProductos, onAgendar }) {
  const ultima = consultas[0]
  // Cada cuadro se despliega al tocarlo (uno a la vez) y muestra de dónde sale su número.
  const [abierto, setAbierto] = useState(null)
  const [citaVentana, setCitaVentana] = useState(null)
  const alternar = (clave) => setAbierto((a) => (a === clave ? null : clave))
  // "Control recomendado" es lo que dice la ficha; "Próxima cita" es la fecha ya agendada. Dos datos distintos, dos nombres.
  const citaPendiente = citas.filter((c) => ESTADOS_PENDIENTES.includes(c.estado)).sort((a, b) => (a.fecha < b.fecha ? -1 : 1))[0]
  const citaDeUltima = ultima ? citas.find((c) => c.id === ultima.citaId) : null
  const consultaDe = (cita) => consultas.find((k) => k.citaId === cita.id)
  const correccion = ultima ? CORRECCION[ultima.estadoCorreccion] || CORRECCION["Sin evaluación"] : null
  const IconoCorreccion = correccion?.icon
  const colorEstado = ultima ? CORRECCION_COLOR[ultima.estadoCorreccion] || CORRECCION_COLOR["Sin evaluación"] : null
  const infoTendencia = tendenciaEntreConsultas(consultas)
  const tendencia = TENDENCIA[infoTendencia?.verdicto]
  const conteo = contarCitas(citas)
  const meses = citasPorMes(citas, hoyISO(), 12)
  const maximo = Math.max(1, ...meses.map((m) => m.total))
  const totalMeses = meses.reduce((a, m) => a + m.total, 0)
  const frecuente = diaMasFrecuente(citas)
  const porFecha = (lista) => lista.slice().sort((a, b) => (a.fecha !== b.fecha ? (a.fecha < b.fecha ? 1 : -1) : minutosDesdeMedianoche(b.hora) - minutosDesdeMedianoche(a.hora)))
  const citasDe = {
    pendientes: porFecha(citas.filter((c) => ESTADOS_PENDIENTES.includes(c.estado))),
    atendidas: porFecha(citas.filter((c) => c.estado === "Atendida")),
    noAsistio: porFecha(citas.filter((c) => c.estado === "No Asistió")),
    canceladas: porFecha(citas.filter((c) => c.estado === "Cancelada")),
  }
  const tarjetas = [
    { clave: "pendientes", etiqueta: "Pendientes", valor: conteo.pendientes, clase: "text-amber-700", punto: "bg-amber-500" },
    { clave: "atendidas", etiqueta: "Atendidas", valor: conteo.atendidas, clase: "text-emerald-700", punto: "bg-emerald-500" },
    { clave: "noAsistio", etiqueta: "No asistió", valor: conteo.noAsistio, clase: "text-red-700", punto: "bg-red-500" },
    { clave: "canceladas", etiqueta: "Canceladas", valor: conteo.canceladas, clase: "text-slate-600", punto: "bg-slate-400" },
  ]
  const titulosCita = { pendientes: "Citas pendientes", atendidas: "Citas atendidas", noAsistio: "Citas a las que no asistió", canceladas: "Citas canceladas" }
  const consultaVentana = citaVentana ? consultaDe(citaVentana) || citaVentana._consulta : null
  return (
    <div className="space-y-4">
      <section aria-label="Información general" className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ultima ? (
            <Cuadro abierto={abierto} alternar={alternar} clave="correccion" className="flex items-center gap-3 rounded-xl border p-3.5" style={{ borderColor: colorEstado.border, backgroundColor: colorEstado.bg }}>
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white" style={{ color: colorEstado.fg }}><IconoCorreccion size={18} /></div>
              <div className="min-w-0 pr-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Estado de corrección</p>
                <p className="text-base font-bold" style={{ color: colorEstado.fg }}>{etiquetaCorreccion(ultima.estadoCorreccion)}</p>
                <p className="text-[11px] text-slate-500">Medido el {fechaLegible(ultima.fecha)}</p>
              </div>
            </Cuadro>
          ) : (
            <Cuadro abierto={abierto} alternar={alternar} clave="correccion" className="rounded-xl border border-slate-200/60 bg-white p-3.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Estado de corrección</p>
              <p className="mt-1 text-sm text-slate-500">Todavía sin consultas.</p>
            </Cuadro>
          )}
          <Cuadro abierto={abierto} alternar={alternar} clave="control" className={"rounded-xl border p-3.5 " + (inactivo && !citaPendiente ? "border-red-200/60 bg-red-50/60" : "border-slate-200/60 bg-white")}>
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500"><Calendar size={12} /> {citaPendiente ? "Próximo control" : "Control recomendado"}</p>
            {citaPendiente ? (
              <>
                <p className="mt-1 text-base font-bold" style={{ color: INK }}>{fechaLegible(citaPendiente.fecha)}</p>
                <p className="text-[11px] text-slate-500">Cita agendada{proximoControl ? " · recomendado: " + fechaLegible(proximoControl) : ""}</p>
              </>
            ) : proximoControl ? (
              <>
                <p className={"mt-1 text-base font-bold " + (inactivo ? "text-red-700" : "")} style={!inactivo ? { color: INK } : undefined}>{fechaLegible(proximoControl)}</p>
                <p className={"text-[11px] " + (inactivo ? "text-red-600/80" : "text-slate-500")}>
                  {inactivo ? `Vencido hace ${diasControl} día${diasControl === 1 ? "" : "s"}` : `Faltan ${Math.abs(diasControl)} día${Math.abs(diasControl) === 1 ? "" : "s"}`} · sin cita agendada
                </p>
              </>
            ) : (
              <p className="mt-1 text-sm text-slate-500">Sin datos suficientes para calcularlo.</p>
            )}
          </Cuadro>
          <Cuadro abierto={abierto} alternar={alternar} clave="ultima" className="rounded-xl border border-slate-200/60 bg-white p-3.5">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500"><Clock size={12} /> Última consulta</p>
            <p className="mt-1 text-base font-bold" style={{ color: INK }}>{fechaLegible(ultima?.fecha) || "—"}</p>
            {ultima && diasDesdeUltimaVisita !== null && <p className="text-[11px] text-slate-500">Hace {diasDesdeUltimaVisita} día{diasDesdeUltimaVisita === 1 ? "" : "s"}</p>}
          </Cuadro>
          <Cuadro abierto={abierto} alternar={alternar} clave="compras" className="rounded-xl border border-slate-200/60 bg-white p-3.5">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500"><Glasses size={12} /> Compras / lentes</p>
            <p className="mt-1 text-base font-bold" style={{ color: INK }}>{compras.cantidad}</p>
            <p className="text-[11px] text-slate-500">${compras.monto.toFixed(2)} en total</p>
          </Cuadro>
        </div>
        {abierto === "ultima" && (
          <Despliegue titulo="Última consulta" onCerrar={() => setAbierto(null)}>
            <PanelUltimaConsulta consulta={ultima} cita={citaDeUltima} equipo={equipo} adjuntos={ultima && adjuntosDe(ultima)} onAbrirVentana={() => setCitaVentana(citaDeUltima || { id: "consulta-" + ultima.id, fecha: ultima.fecha, hora: "Sin cita", motivo: ultima.motivo, estado: "Atendida", _consulta: ultima })} />
          </Despliegue>
        )}
        {abierto === "correccion" && (
          <Despliegue titulo="Estado de corrección" onCerrar={() => setAbierto(null)}>
            <PanelCorreccion consulta={ultima} etiqueta={ultima ? etiquetaCorreccion(ultima.estadoCorreccion) : ""} estado={ultima?.estadoCorreccion} tendencia={infoTendencia?.verdicto ? { txt: TENDENCIA_TEXTO[infoTendencia.verdicto] || tendencia?.label } : null} />
          </Despliegue>
        )}
        {abierto === "control" && (
          <Despliegue titulo="Control del paciente" onCerrar={() => setAbierto(null)}>
            <PanelControl proximoControl={proximoControl} diasControl={diasControl} inactivo={inactivo} ultima={ultima} citaPendiente={citaPendiente} onAgendar={onAgendar} />
          </Despliegue>
        )}
        {abierto === "compras" && (
          <Despliegue titulo="Compras y lentes" onCerrar={() => setAbierto(null)}>
            <PanelCompras comprobantes={comprobantes} onVerProductos={onVerProductos} />
          </Despliegue>
        )}
      </section>

      {consultas.length > 0 && (
        <section aria-label="Tendencia de graduación" className="rounded-2xl border border-slate-200/60 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h3 className="text-sm font-bold" style={{ color: INK }}>Tendencia de graduación medida</h3>
            {tendencia && (
              <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ backgroundColor: "#f1f5f9", color: tendencia.fg }}>
                <tendencia.icon size={12} /> {tendencia.label}
              </span>
            )}
          </div>
          <TendenciaGraduacion consultas={[...consultas].reverse()} />
          <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-500"><Lock size={12} /> Vista interna — estas medidas nunca se muestran en el portal del paciente.</p>
        </section>
      )}

      <section aria-label="Citas del paciente" className="space-y-3 rounded-2xl border border-slate-200/60 bg-white p-4">
        <h3 className="text-sm font-bold" style={{ color: INK }}>Citas del paciente</h3>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tarjetas.map((t) => (
            <Cuadro key={t.clave} abierto={abierto} alternar={alternar} clave={t.clave} className="rounded-xl border border-transparent bg-slate-50 px-3.5 py-3">
              <dt className="flex items-center gap-1.5 text-xs font-semibold text-slate-500"><span className={"h-2 w-2 rounded-full " + t.punto} aria-hidden="true" />{t.etiqueta}</dt>
              <dd className={"mt-0.5 text-2xl font-bold " + t.clase}>{t.valor}</dd>
            </Cuadro>
          ))}
        </dl>
        {titulosCita[abierto] && (
          <Despliegue titulo={titulosCita[abierto]} onCerrar={() => setAbierto(null)}>
            <PanelCitasEstado estado={abierto} citas={citasDe[abierto]} equipo={equipo} consultaDe={consultaDe} onVerAtencion={setCitaVentana} />
          </Despliegue>
        )}
      </section>

      {citaVentana && consultaVentana && (
        <ModalAtencion cita={citaVentana} consulta={consultaVentana} paciente={paciente} usuario={usuario} adjuntos={adjuntosDe(consultaVentana)} onCerrar={() => setCitaVentana(null)} />
      )}

      <section aria-label="Citas por mes" className="rounded-2xl border border-slate-200/60 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h3 className="text-sm font-bold" style={{ color: INK }}>Citas por mes <span className="font-normal text-slate-500">· últimos 12 meses</span></h3>
          {frecuente && <p className="text-xs text-slate-500">Suele venir los <span className="font-semibold text-slate-700">{frecuente.dia}</span> ({frecuente.veces} de sus {conteo.atendidas} citas atendidas)</p>}
        </div>
        {totalMeses === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-4 text-center text-sm text-slate-500">Sin citas en los últimos 12 meses.</p>
        ) : (
          <div role="img" aria-label={"Citas por mes: " + meses.filter((m) => m.total > 0).map((m) => m.etiqueta + " " + m.anio + ": " + m.total).join(", ")} className="flex h-40 items-end gap-1.5 sm:gap-2">
            {meses.map((m) => (
              <div key={m.clave} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1" title={m.etiqueta + " " + m.anio + ": " + m.total + (m.total === 1 ? " cita" : " citas")}>
                <span className="text-[11px] font-semibold text-slate-600">{m.total > 0 ? m.total : ""}</span>
                <div className="w-full max-w-9 rounded-t-md" style={{ height: m.total > 0 ? Math.max(6, (m.total / maximo) * 100) + "px" : "2px", background: m.total > 0 ? GRAD : "#e2e8f0" }} />
                <span className="text-[11px] text-slate-500">{m.etiqueta}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-label="Fidelización" className="space-y-3 rounded-2xl border border-slate-200/60 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold" style={{ color: INK }}>Fidelización</h3>
          <button type="button" onClick={fidelidad.onCrm} className="flex items-center gap-1 text-xs font-semibold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">
            Gestionar recordatorios en CRM <ChevronRight size={13} />
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Cuadro abierto={abierto} alternar={alternar} clave="puntaje" className="rounded-xl border border-transparent bg-slate-50 px-3.5 py-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Star size={13} /> Puntaje de fidelidad</p>
            <p className="mt-0.5 text-lg font-bold" style={{ color: INK }}>{fidelidad.puntaje} pts</p>
            <p className="text-xs text-slate-500">{fidelidad.consultas} consulta{fidelidad.consultas === 1 ? "" : "s"} + {fidelidad.referidos} referido{fidelidad.referidos === 1 ? "" : "s"} · {fidelidad.frecuente ? "Cliente frecuente" : `${Math.max(0, 3 - fidelidad.consultas) === 1 ? "Le falta 1 consulta" : `Le faltan ${Math.max(0, 3 - fidelidad.consultas)} consultas`} para ser cliente frecuente`}</p>
          </Cuadro>
          <Cuadro abierto={abierto} alternar={alternar} clave="referidos" className="rounded-xl border border-transparent bg-slate-50 px-3.5 py-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Gift size={13} /> Referidos</p>
            <p className="mt-0.5 text-lg font-bold" style={{ color: INK }}>{fidelidad.referidos} paciente{fidelidad.referidos === 1 ? "" : "s"}</p>
            <p className="text-xs text-slate-500">{fidelidad.referidos > 0 ? "Trajeron a la óptica mencionando a este paciente" : "Todavía no ha referido a nadie"}{fidelidad.referidoPor && <> · Llegó referido por <span className="font-semibold text-slate-700">{fidelidad.referidoPor}</span></>}</p>
          </Cuadro>
          <Cuadro abierto={abierto} alternar={alternar} clave="cumple" className="rounded-xl border border-transparent bg-slate-50 px-3.5 py-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500"><Cake size={13} /> Cumpleaños</p>
            <p className="mt-0.5 text-lg font-bold" style={{ color: INK }}>{fidelidad.diasCumple == null ? "—" : fidelidad.diasCumple === 0 ? "Hoy" : `En ${fidelidad.diasCumple} día${fidelidad.diasCumple === 1 ? "" : "s"}`}</p>
            <p className="text-xs text-slate-500">{fidelidad.diasCumple == null ? "Sin fecha de nacimiento registrada." : fidelidad.edad != null ? `Cumple ${fidelidad.edad + (fidelidad.diasCumple === 0 ? 0 : 1)} años` : "Próximo cumpleaños"}</p>
          </Cuadro>
        </div>
        {abierto === "puntaje" && <Despliegue titulo="Cómo se ganaron los puntos" onCerrar={() => setAbierto(null)}><PanelPuntaje consultas={consultas} referidos={referidosLista} frecuente={fidelidad.frecuente} /></Despliegue>}
        {abierto === "referidos" && <Despliegue titulo="Pacientes que refirió" onCerrar={() => setAbierto(null)}><PanelReferidos lista={referidosLista} referidoPor={fidelidad.referidoPor} onAbrir={onAbrirPaciente} /></Despliegue>}
        {abierto === "cumple" && <Despliegue titulo="Cumpleaños" onCerrar={() => setAbierto(null)}><PanelCumple fechaNacimiento={paciente.fecha_nacimiento || paciente.fechaNacimiento} diasCumple={fidelidad.diasCumple} edad={fidelidad.edad} saludoAnio={paciente.ultimoSaludoCumpleAnio} anioActual={ahoraEcuador().getFullYear()} cumpleAuto={parametrizacion?.cumpleAuto === true} tieneCorreo={!!paciente.correo && !/^sin /i.test(paciente.correo)} onCrm={fidelidad.onCrm} /></Despliegue>}
      </section>
    </div>
  )
}
