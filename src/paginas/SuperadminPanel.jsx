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
  Users,
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
} from "lucide-react"
import { supabase, crearClienteTemporal } from "../lib/supabaseClient"

// ─── Paleta de firma (consistente con el resto del sistema) ───
const INK = "#0A1420"
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)" // cian → azul

const generarSlug = (texto) =>
  texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

const camposOpticaIniciales = { nombreOptica: "", slug: "", nombreAdmin: "", emailAdmin: "", clave: "", confirmarClave: "" }
const camposCuentaIniciales = { nombre: "", email: "", clave: "", confirmarClave: "" }

const formatearFecha = (fecha) => new Date(fecha).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" })
const formatearFechaHora = (fecha) =>
  new Date(fecha).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })

const NAV = [
  { id: "resumen", nombre: "Resumen", icono: LayoutDashboard },
  { id: "opticas", nombre: "Ópticas", icono: Building2 },
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

// ─── Registro de actividad (auditoría) ───
const AUDITORIA_INFO = {
  crear_optica: { grupo: "opticas", icon: Plus, bg: "rgba(37,99,235,0.1)", fg: "#2563EB" },
  suspender_optica: { grupo: "opticas", icon: Ban, bg: "rgba(225,29,72,0.1)", fg: "#E11D48" },
  reactivar_optica: { grupo: "opticas", icon: CheckCircle2, bg: "rgba(16,185,129,0.1)", fg: "#059669" },
  renombrar_optica: { grupo: "opticas", icon: Pencil, bg: "rgba(37,99,235,0.1)", fg: "#2563EB" },
  agregar_administrador: { grupo: "administradores", icon: UserPlus, bg: "rgba(124,58,237,0.1)", fg: "#7C3AED" },
  eliminar_administrador: { grupo: "administradores", icon: Trash2, bg: "rgba(225,29,72,0.1)", fg: "#E11D48" },
  crear_superadmin: { grupo: "superadmins", icon: ShieldCheck, bg: "rgba(124,58,237,0.1)", fg: "#7C3AED" },
  eliminar_superadmin: { grupo: "superadmins", icon: Trash2, bg: "rgba(225,29,72,0.1)", fg: "#E11D48" },
}

const FILTROS_ACTIVIDAD = [
  { key: "todas", label: "Todas" },
  { key: "opticas", label: "Ópticas" },
  { key: "administradores", label: "Administradores" },
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
    default: return a.accion
  }
}

function ItemAuditoria({ a }) {
  const info = AUDITORIA_INFO[a.accion]
  if (!info) return null
  const Icono = info.icon
  return (
    <li className="flex items-start gap-3">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full" style={{ background: info.bg, color: info.fg }}>
        <Icono size={14} />
      </div>
      <div className="min-w-0 flex-1 border-b border-slate-100 pb-3">
        <p className="text-sm text-slate-700">
          <span className="font-semibold">{a.actor_nombre}</span> {textoAuditoria(a)}
        </p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
          <Clock size={11} />
          {formatearFechaHora(a.created_at)}
        </p>
      </div>
    </li>
  )
}

export default function SuperadminPanel({ usuario, alSalir }) {
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
  const [cargando, setCargando] = useState(true)

  // ─── Auditoría (paginada + filtrable por grupo) ───
  const [auditoria, setAuditoria] = useState([])
  const [auditoriaOffset, setAuditoriaOffset] = useState(0)
  const [auditoriaTieneMas, setAuditoriaTieneMas] = useState(true)
  const [auditoriaCargandoMas, setAuditoriaCargandoMas] = useState(false)
  const [auditoriaFiltro, setAuditoriaFiltro] = useState("todas")

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
  const [filtroEstado, setFiltroEstado] = useState("Todas") // Todas | Activas | Suspendidas | ConAdmin
  const [detalle, setDetalle] = useState(null)
  const [procesandoId, setProcesandoId] = useState(null)
  const [slugCopiado, setSlugCopiado] = useState(false)

  // ─── Detalle: renombrar óptica ───
  const [renombrando, setRenombrando] = useState(false)
  const [nombreEditado, setNombreEditado] = useState("")
  const [guardandoNombre, setGuardandoNombre] = useState(false)

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
    const [{ data: opticasData }, { data: adminsData }, { data: superadminsData }] = await Promise.all([
      supabase.from("opticas").select("*").order("created_at", { ascending: false }),
      supabase.from("perfiles").select("id, optica_id, nombre, email").eq("rol", "admin"),
      supabase.from("perfiles").select("id, nombre, email, created_at").eq("rol", "superadmin").order("created_at", { ascending: true }),
    ])
    setOpticas(opticasData || [])
    setAdmins(adminsData || [])
    setSuperadmins(superadminsData || [])
    setCargando(false)
    cargarAuditoria(true)
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

  const adminsPorOptica = useMemo(() => {
    const mapa = new Map()
    for (const a of admins) {
      const arr = mapa.get(a.optica_id) || []
      arr.push(a)
      mapa.set(a.optica_id, arr)
    }
    return mapa
  }, [admins])

  const opticasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return opticas.filter((o) => {
      const listaAdmins = adminsPorOptica.get(o.id) || []
      if (filtroEstado === "Activas" && !o.activa) return false
      if (filtroEstado === "Suspendidas" && o.activa) return false
      if (filtroEstado === "ConAdmin" && listaAdmins.length === 0) return false
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

  const tarjetas = [
    { key: "Todas", label: "Ópticas totales", valor: opticas.length, icon: Building2, bg: "rgba(37,99,235,0.1)", fg: "#2563EB", ring: "#2563EB" },
    { key: "Activas", label: "Activas", valor: totalActivas, icon: CheckCircle2, bg: "rgba(16,185,129,0.1)", fg: "#059669", ring: "#059669" },
    { key: "Suspendidas", label: "Suspendidas", valor: totalSuspendidas, icon: Ban, bg: "rgba(225,29,72,0.1)", fg: "#E11D48", ring: "#E11D48" },
    { key: "ConAdmin", label: "Administradores", valor: admins.length, icon: Users, bg: "rgba(124,58,237,0.1)", fg: "#7C3AED", ring: "#7C3AED" },
  ]

  const irAOpticasConFiltro = (key) => { setFiltroEstado(key); setSeccion("opticas") }

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

  const abrirCrear = () => {
    setCampos(camposOpticaIniciales)
    setSlugTocado(false)
    setSlugEstado("idle")
    setVerClave(false)
    setError("")
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
    const { nombreOptica, slug, nombreAdmin, emailAdmin, clave, confirmarClave } = campos
    if (!nombreOptica.trim() || !slug.trim() || !nombreAdmin.trim() || !emailAdmin.trim() || !clave) {
      setError("Completa todos los campos.")
      return
    }
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
      const { data: creada, error: errorOptica } = await supabase
        .from("opticas")
        .insert({ nombre: nombreOptica.trim(), slug: slug.trim() })
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

    const { error: errorPerfil } = await temp
      .from("perfiles")
      .insert({ id: alta.user.id, optica_id: nuevaOptica.id, rol: "admin", nombre: nombreAdmin.trim(), email: emailAdmin.trim() })

    await temp.auth.signOut()

    if (errorPerfil) {
      setError(errorPerfil.message + " — la óptica y la cuenta de correo ya quedaron creadas, revisá en Supabase.")
      setGuardando(false)
      cargarDatos()
      return
    }

    await registrarAuditoria("crear_optica", { opticaId: nuevaOptica.id, opticaNombre: nuevaOptica.nombre })

    setGuardando(false)
    setModalAbierto(false)
    cargarDatos()
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
    const { error: errorUpdate } = await supabase.from("opticas").update({ nombre: nuevo }).eq("id", detalle.id)
    if (!errorUpdate) {
      const anterior = detalle.nombre
      setOpticas((prev) => prev.map((o) => (o.id === detalle.id ? { ...o, nombre: nuevo } : o)))
      setDetalle((prev) => ({ ...prev, nombre: nuevo }))
      await registrarAuditoria("renombrar_optica", { opticaId: detalle.id, opticaNombre: nuevo, detalle: anterior })
      cargarAuditoria(true)
      setRenombrando(false)
    }
    setGuardandoNombre(false)
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
    if (!nombre.trim() || !email.trim() || !clave) { setErrorAdminExtra("Completa todos los campos."); return }
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
    const { error: errorPerfil } = await temp.from("perfiles").insert({ id: alta.user.id, optica_id: detalle.id, rol: "admin", nombre: nombre.trim(), email: email.trim() })
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
    if (!nombre.trim() || !email.trim() || !clave) { setErrorSuperadmin("Completa todos los campos."); return }
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

  const renderResumen = () => (
    <>
      <div>
        <h1 className="font-serif text-2xl font-bold tracking-tight" style={{ color: INK }}>Resumen</h1>
        <p className="text-sm text-slate-500">Estado general del sistema multi-óptica.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tarjetas.map((t) => {
          const Icono = t.icon
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => irAOpticasConFiltro(t.key)}
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-transform group-hover:scale-105" style={{ background: t.bg, color: t.fg }}>
                  <Icono size={20} />
                </div>
                <div>
                  <p className="text-2xl font-black leading-none" style={{ color: INK }}>{t.valor}</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">{t.label}</p>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {opticas.length > 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-2 flex items-center justify-between text-sm">
            <p className="font-bold text-slate-700">Ópticas activas</p>
            <p className="text-slate-500">{totalActivas} de {opticas.length} ({Math.round((totalActivas / opticas.length) * 100)}%)</p>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-rose-100">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(totalActivas / opticas.length) * 100}%` }} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-1 text-sm font-bold" style={{ color: INK }}>Ópticas creadas por mes</h3>
          <p className="mb-5 text-xs text-slate-500">Últimos 6 meses</p>
          {opticas.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Aún no hay ópticas registradas.</p>
          ) : (
            <div className="flex h-40 items-end gap-3">
              {opticasPorMes.map((m) => (
                <div key={m.clave} className="flex flex-1 flex-col items-center gap-2">
                  <span className="text-xs font-bold text-slate-600">{m.valor}</span>
                  <div className="flex h-28 w-full items-end overflow-hidden rounded-lg bg-slate-50">
                    <div
                      className="w-full rounded-lg transition-all"
                      style={{ height: `${Math.max(4, (m.valor / maxOpticasMes) * 100)}%`, background: GRAD }}
                      title={`${m.etiqueta}: ${m.valor} óptica${m.valor === 1 ? "" : "s"}`}
                    />
                  </div>
                  <span className="text-[11px] font-semibold uppercase text-slate-500">{m.etiqueta}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="mb-1 text-sm font-bold" style={{ color: INK }}>Actividad por día</h3>
          <p className="mb-5 text-xs text-slate-500">Últimos 7 días</p>
          {auditoria.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-500">Todavía no hay actividad registrada.</p>
          ) : (
            <div className="flex h-40 items-end gap-3">
              {actividadPorDia.map((d) => (
                <div key={d.clave} className="flex flex-1 flex-col items-center gap-2">
                  <span className="text-xs font-bold text-slate-600">{d.valor}</span>
                  <div className="flex h-28 w-full items-end overflow-hidden rounded-lg bg-slate-50">
                    <div
                      className="w-full rounded-lg transition-all"
                      style={{ height: `${Math.max(4, (d.valor / maxActividadDia) * 100)}%`, background: "linear-gradient(135deg,#A78BFA,#7C3AED)" }}
                      title={`${d.etiqueta}: ${d.valor} acción${d.valor === 1 ? "" : "es"}`}
                    />
                  </div>
                  <span className="text-[11px] font-semibold uppercase text-slate-500">{d.etiqueta}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History size={16} className="text-slate-500" />
            <h3 className="text-sm font-bold text-slate-700">Actividad reciente</h3>
          </div>
          <button type="button" onClick={() => setSeccion("actividad")} className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">
            Ver toda la actividad <ChevronRight size={14} />
          </button>
        </div>
        {auditoria.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Todavía no hay acciones registradas.</p>
        ) : (
          <ul className="space-y-3">
            {auditoria.slice(0, 5).map((a) => <ItemAuditoria key={a.id} a={a} />)}
          </ul>
        )}
      </div>
    </>
  )

  const renderOpticas = () => (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight" style={{ color: INK }}>Ópticas</h1>
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

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label htmlFor="buscar-optica" className="mb-1.5 block text-sm font-medium text-slate-600">Buscar</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <input
            id="buscar-optica"
            type="text"
            placeholder="Nombre de la óptica, slug o administrador..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none transition-colors focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
          />
        </div>
        {filtroEstado !== "Todas" && (
          <div className="mt-3 flex items-center gap-2 text-xs">
            <span className="text-slate-500">Filtro activo:</span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 font-semibold text-blue-700">
              {tarjetas.find((t) => t.key === filtroEstado)?.label}
              <button type="button" onClick={() => setFiltroEstado("Todas")} className="cursor-pointer hover:text-blue-900"><X size={12} /></button>
            </span>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold uppercase tracking-wide text-slate-500">
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
                    <tr key={o.id} className="group cursor-pointer transition-colors hover:bg-slate-50/70" onClick={() => setDetalle(o)}>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: GRAD }}>
                            {o.nombre.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-800 transition-colors group-hover:text-blue-600">{o.nombre}</p>
                            <p className="truncate font-mono text-xs text-slate-500">{o.slug}</p>
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
                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                              <Mail size={12} />
                              <span className="max-w-[180px] truncate">{listaAdmins[0].email || "—"}</span>
                            </div>
                            {listaAdmins.length > 1 && <p className="text-[11px] text-slate-400">+{listaAdmins.length - 1} más</p>}
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span className={"inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold " + (o.activa ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700")}>
                          {o.activa ? <CheckCircle2 size={13} /> : <Ban size={13} />}
                          {o.activa ? "Activa" : "Suspendida"}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={13} className="text-slate-500" />
                          <span>{formatearFecha(o.created_at)}</span>
                        </div>
                      </td>
                      <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button type="button" onClick={() => setDetalle(o)} title="Ver detalle" className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-600 cursor-pointer">
                            <Eye size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => abrirMenuAcciones(o.id, e)}
                            title="Más acciones"
                            disabled={procesando}
                            className={"rounded-lg p-2 transition-colors cursor-pointer disabled:opacity-50 " + (menuAccionesId === o.id ? "bg-slate-100 text-slate-700" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700")}
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
    </>
  )

  const renderActividad = () => (
    <>
      <div>
        <h1 className="font-serif text-2xl font-bold tracking-tight" style={{ color: INK }}>Actividad</h1>
        <p className="text-sm text-slate-500">Registro de auditoría de acciones administrativas.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTROS_ACTIVIDAD.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setAuditoriaFiltro(f.key)}
            className={"rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer " + (auditoriaFiltro === f.key ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {auditoria.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">No hay actividad para este filtro.</p>
        ) : (
          <>
            <ul className="space-y-3">
              {auditoria.map((a) => <ItemAuditoria key={a.id} a={a} />)}
            </ul>
            <div className="mt-4 flex justify-center">
              {auditoriaTieneMas ? (
                <button
                  type="button"
                  onClick={() => cargarAuditoria(false)}
                  disabled={auditoriaCargandoMas}
                  className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer disabled:opacity-60"
                >
                  {auditoriaCargandoMas ? "Cargando…" : "Cargar más"}
                </button>
              ) : (
                <p className="text-xs text-slate-400">No hay más actividad para mostrar.</p>
              )}
            </div>
          </>
        )}
      </div>
    </>
  )

  const renderSuperadmins = () => (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight" style={{ color: INK }}>Superadmins</h1>
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

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <ul className="divide-y divide-slate-100">
          {superadmins.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: GRAD }}>
                  {s.nombre.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 truncate font-semibold text-slate-800">
                    {s.nombre}
                    {s.id === usuario?.id && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">TÚ</span>}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Mail size={12} /> {s.email || "—"}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSuperadminAEliminar(s)}
                disabled={s.id === usuario?.id || superadmins.length <= 1}
                title={s.id === usuario?.id ? "No podés quitarte a vos mismo" : superadmins.length <= 1 ? "Debe quedar al menos un superadmin" : "Quitar superadmin"}
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 cursor-pointer"
              >
                <Trash2 size={16} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  )

  return (
    <div className="flex h-screen font-sans" style={{ backgroundColor: "#F7F5F0" }}>
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
            <button type="button" onClick={() => setMenuAbierto(false)} className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white lg:hidden cursor-pointer">
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
                  className={"group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all cursor-pointer " + (colapsado ? "lg:justify-center lg:px-0 " : "") + (activo ? "text-white" : "text-white/55 hover:bg-white/5 hover:text-white")}
                  style={activo ? { background: GRAD, boxShadow: "0 12px 24px -12px rgba(34,211,238,0.55)" } : undefined}
                >
                  <Icono size={20} className={activo ? "text-white" : "text-white/55 group-hover:text-white"} />
                  <span className={colapsado ? "lg:hidden" : ""}>{opcion.nombre}</span>
                  {activo && <span className={"ml-auto h-1.5 w-1.5 rounded-full bg-white/80 " + (colapsado ? "lg:hidden" : "")} />}
                </button>
              )
            })}
          </nav>
        </div>

        <div className="relative z-10 border-t border-white/10 p-4">
          <button
            type="button"
            onClick={alSalir}
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
            <button type="button" onClick={() => setMenuAbierto(true)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 lg:hidden cursor-pointer">
              <Menu size={22} />
            </button>
            <button type="button" onClick={() => setColapsado((v) => !v)} className="hidden rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 lg:inline-flex cursor-pointer" title={colapsado ? "Expandir menú" : "Colapsar menú"}>
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
                    onClick={alSalir}
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
          <div className="mx-auto w-full max-w-6xl space-y-6">
            {seccion === "resumen" && renderResumen()}
            {seccion === "opticas" && renderOpticas()}
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
          style={{ backgroundColor: "rgba(10,20,32,0.55)", animation: "overlay-in 150ms ease-out" }}
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
                    <h4 className="flex items-center gap-1.5 truncate text-lg font-bold" style={{ color: INK }}>
                      {detalle.nombre}
                      <button type="button" onClick={iniciarRenombrar} title="Renombrar" className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 cursor-pointer"><Pencil size={13} /></button>
                    </h4>
                  )}
                  <p className="font-mono text-xs text-slate-500">{detalle.slug}</p>
                </div>
              </div>
              <button type="button" onClick={() => setDetalle(null)} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-600 cursor-pointer">
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
                        <div key={a.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-800">{a.nombre}</p>
                            <div className="flex items-center gap-1.5 text-xs text-slate-500"><Mail size={12} /><span className="truncate">{a.email || "—"}</span></div>
                          </div>
                          <button type="button" onClick={() => setAdminAEliminar(a)} title="Quitar administrador" className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"><Trash2 size={15} /></button>
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
                      type="text" placeholder="Nombre completo" value={camposAdminExtra.nombre} onChange={(e) => actualizarCampoAdminExtra("nombre", e.target.value)}
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
                        <button type="button" onClick={() => setVerClaveExtra((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 cursor-pointer">{verClaveExtra ? <EyeOff size={14} /> : <Eye size={14} />}</button>
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

      {/* ─── MODAL CREAR ÓPTICA ─── */}
      {modalAbierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          style={{ backgroundColor: "rgba(10,20,32,0.55)", animation: "overlay-in 150ms ease-out" }}
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
              <button type="button" onClick={cerrarModal} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-600 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50">
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
                            type="text" value={campos.nombreAdmin} onChange={(e) => actualizarCampo("nombreAdmin", e.target.value)}
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
                        <label className="mb-1.5 block text-sm font-semibold text-slate-700">Contraseña</label>
                        <div className="relative">
                          <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                          <input
                            type={verClave ? "text" : "password"} value={campos.clave} onChange={(e) => actualizarCampo("clave", e.target.value)}
                            placeholder="Mínimo 6 caracteres"
                            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-9 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-50"
                          />
                          <button type="button" onClick={() => setVerClave((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 cursor-pointer">
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
          style={{ backgroundColor: "rgba(10,20,32,0.55)", animation: "overlay-in 150ms ease-out" }}
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
              <button type="button" onClick={() => setModalSuperadminAbierto(false)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer">
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
                      type="text" value={camposSuperadmin.nombre} onChange={(e) => actualizarCampoSuperadmin("nombre", e.target.value)}
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
                      <button type="button" onClick={() => setVerClaveSuperadmin((v) => !v)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 cursor-pointer">{verClaveSuperadmin ? <EyeOff size={16} /> : <Eye size={16} />}</button>
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
          style={{ backgroundColor: "rgba(10,20,32,0.55)", animation: "overlay-in 150ms ease-out" }}
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
    </div>
  )
}
