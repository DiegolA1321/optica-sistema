"use client"

import React, { useState, useMemo, useEffect, useRef, Suspense } from "react"
import { createPortal } from "react-dom"
import {
  Users,
  Calendar,
  Eye,
  Package,
  LayoutDashboard,
  HeartHandshake,
  LogOut,
  Menu,
  X,
  AlertTriangle,
  RefreshCw,
  Bell,
  Cake,
  CheckCircle2,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  CalendarClock,
  BarChart3,
  ShieldCheck,
  ShieldAlert,
  Settings,
  MessageSquare,
  Loader2,
  Search,
} from "lucide-react"

// Módulos del sistema — Inicio se queda como import normal porque es lo
// primero que ve un admin/asistente al entrar (sin parpadeo de carga en el
// camino más común); el resto se carga bajo demanda (code-splitting: nadie
// que solo use Citas necesita bajar el código de Reportes, Usuarios, etc.
// de una sola vez al entrar al panel).
import Inicio from "./Inicio"
import { lazyConReintento } from "../utilidades/lazyConReintento"
const Pacientes = lazyConReintento(() => import("./Pacientes"), "Pacientes")
const ConsultaMedica = lazyConReintento(() => import("./ConsultaMedica"), "ConsultaMedica")
const Inventario = lazyConReintento(() => import("./Inventario"), "Inventario")
const Citas = lazyConReintento(() => import("./Citas"), "Citas")
const Horario = lazyConReintento(() => import("./Horario"), "Horario")
const CRM = lazyConReintento(() => import("./CRM"), "CRM")
const Reportes = lazyConReintento(() => import("./Reportes"), "Reportes")
const Usuarios = lazyConReintento(() => import("./Usuarios"), "Usuarios")
const Configuracion = lazyConReintento(() => import("./Configuracion"), "Configuracion")
const Mensajes = lazyConReintento(() => import("./Mensajes"), "Mensajes")
import { esHoy } from "../utilidades/disponibilidad"
import { esStockBajo } from "../utilidades/inventario"
import { diasVencido } from "../utilidades/fidelizacion"
import { supabase } from "../lib/supabaseClient"
import SeccionMfa from "./SeccionMfa"
import { INK } from "@/lib/tema"
import { MODO_SAAS_VISIBLE } from "@/lib/config"

// Modo anteproyecto: "el equipo de Diego Óptica" revela un proveedor
// atendiendo a varios clientes — con MODO_SAAS_VISIBLE apagado se muestra un
// texto neutral que no lo insinúa.
const NOMBRE_EQUIPO = MODO_SAAS_VISIBLE ? "Diego Óptica" : "la óptica"

// ─── Paleta de firma ───
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)" // cian → azul

// Orden por frecuencia de uso real (feedback del asesor, 2026-08-20): lo que
// más se usa día a día va primero, lo ocasional (horario, reportes) al final.
// soloAdmin: nunca lo ve un perfil de asistente, sin importar sus permisos.
const OPCIONES = [
  { id: "inicio", nombre: "Inicio", icono: LayoutDashboard },
  { id: "citas", nombre: "Citas médicas", icono: Calendar },
  // oculto: ya no es un ítem de navegación aparte (Sexta Mirada / feedback
  // 2026-09-07 del ing y de Diego) — dos entradas separadas para "buscar
  // paciente" y "ficha clínica" generaban confusión y datos duplicados. Se
  // mantiene en OPCIONES (no se borra) porque sigue siendo una sección real
  // a la que se navega — desde "Atender" en Citas médicas y desde "Ficha
  // clínica" en el perfil del paciente (el ícono del ojo en Pacientes) — y
  // porque el permiso "consultas" en Usuarios y permisos sigue existiendo.
  { id: "consultas", nombre: "Ficha clínica", icono: Eye, oculto: true },
  { id: "pacientes", nombre: "Pacientes", icono: Users },
  { id: "inventario", nombre: "Inventario", icono: Package },
  { id: "crm", nombre: "CRM y fidelización", icono: HeartHandshake },
  { id: "horario", nombre: "Mi horario", icono: CalendarClock },
  { id: "reportes", nombre: "Reportes", icono: BarChart3 },
  // soloAdmin + delegable: oculto por defecto, pero el admin puede delegarlo
  // explícitamente desde Usuarios.jsx (categoría "Administración") — a nivel
  // de base de datos ya tenían el mismo acceso que un admin (mensajes y
  // opticas.settings no distinguen rol en RLS, solo optica_id), así que esto
  // es una decisión de producto que el admin controla, no una restricción
  // técnica nueva.
  { id: "mensajes", nombre: "Mensajes", icono: MessageSquare, soloAdmin: true, delegable: true },
  // soloAdmin sin delegable: Usuarios y permisos sí requiere rol='admin' a
  // nivel de RLS (perfiles_admin_gestiona_asistentes) — delegarlo de verdad
  // necesitaría una policy nueva, no solo un permiso de interfaz, así que se
  // mantiene exclusivo del administrador principal.
  { id: "usuarios", nombre: "Usuarios y permisos", icono: ShieldCheck, soloAdmin: true },
  { id: "configuracion", nombre: "Configuración", icono: Settings, soloAdmin: true, delegable: true },
]

// Ventana de cumpleaños (-5 a +7 días) → diferencia en días o null
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

export default function Dashboard({ usuario, opticaActiva = true, cargaInicialStaff = false, erroresCarga = [], onCerrarErroresCarga, pacientes = [], setPacientes, citas = [], setCitas, inventario = [], setInventario, consultas = [], setConsultas, ventas = [], setVentas, facturasVenta = [], setFacturasVenta, respuestasSatisfaccion = [], solicitudesEliminacion = [], marcarSolicitudEliminacionAtendida, disponibilidad, setDisponibilidad, horarioPersonal, setHorarioPersonal, asistentes = [], setAsistentes, parametrizacion, setParametrizacion, motivosConsulta = [], setMotivosConsulta, diagnosticosRapidos = [], setDiagnosticosRapidos, categoriasInventario = [], setCategoriasInventario, alSalir, onSalirImpersonacion, alActualizarUsuario }) {
  const esAsistente = usuario?.rol === "asistente"
  const esAdmin = usuario?.rol === "admin"

  // Un asistente solo ve lo que el administrador le habilitó (default: todo
  // menos lo marcado soloAdmin). El administrador ve siempre todo. Un
  // soloAdmin+delegable es la excepción: un asistente lo ve si el admin se lo
  // activó explícitamente (default false, a diferencia de los módulos
  // operativos que son default true) — es la "administración delegada" que
  // pidió el ing para cuando el optómetra contrata a alguien que le
  // administre el sistema completo.
  const opcionesVisibles = useMemo(
    () => OPCIONES.filter((o) => {
      if (o.soloAdmin) {
        if (esAdmin) return true
        if (esAsistente && o.delegable) return usuario?.permisos?.[o.id] === true
        return false
      }
      if (esAsistente) return usuario?.permisos?.[o.id] !== false
      return true
    }),
    [esAsistente, esAdmin, usuario],
  )

  // Recuerda la sección del sidebar en la que estaba — recargar la página ya no
  // manda de vuelta a Inicio si estaba, por ejemplo, en Citas médicas.
  const [seccionActiva, setSeccionActiva] = useState(() => {
    const guardada = localStorage.getItem('optica_seccion_activa')
    return opcionesVisibles.some((o) => o.id === guardada) ? guardada : "inicio"
  })
  const [accionPacienteInicio, setAccionPacienteInicio] = useState(null)
  const [abrirAgendarAlEntrar, setAbrirAgendarAlEntrar] = useState(false)
  const [abrirCrearProductoAlEntrar, setAbrirCrearProductoAlEntrar] = useState(false)
  const [fichaClinicaPacienteInicial, setFichaClinicaPacienteInicial] = useState(null)
  const [fichaClinicaMotivoInicial, setFichaClinicaMotivoInicial] = useState(null)
  // Viaja junto a fichaClinicaPacienteInicial cuando la ficha se abre desde
  // "Atender" en Citas médicas — permite que ConsultaMedica marque esa cita
  // como "Atendida" al guardar, sin que el optómetra tenga que hacerlo a mano.
  const [fichaClinicaCitaId, setFichaClinicaCitaId] = useState(null)
  // De dónde se entró a la ficha clínica (Pacientes o Citas médicas) — para
  // que "Volver"/"X" ahí adentro regrese al lugar correcto, ya que esta
  // sección no tiene entrada propia en el sidebar.
  const [fichaClinicaOrigen, setFichaClinicaOrigen] = useState("pacientes")
  // Cuando el origen es "pacientes", "Volver" reabre el perfil de este
  // paciente (accionPacienteInicio) en vez de solo listar a todos de nuevo.
  const [fichaClinicaPacienteOrigenId, setFichaClinicaPacienteOrigenId] = useState(null)
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [colapsado, setColapsado] = useState(false)
  const [notifAbierta, setNotifAbierta] = useState(false)
  const [userMenuAbierto, setUserMenuAbierto] = useState(false)

  // Paleta de comandos (Ctrl/Cmd+K) — sección 7 del pedido de UI ("reduce
  // clics en uso diario intensivo"), la única pieza de navegación del spec
  // que faltaba por completo. Reusa opcionesVisibles/navegar tal cual, así
  // que respeta el mismo filtro de permisos que ya aplica el sidebar — no
  // se duplica esa lógica.
  const [paletaAbierta, setPaletaAbierta] = useState(false)
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setPaletaAbierta((v) => !v)
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])
  const [modalMiCuentaAbierto, setModalMiCuentaAbierto] = useState(false)
  // Número de registro profesional (hallazgo de auditoría 2026-09-08: la
  // receta impresa siempre dejaba "Reg. Prof. ____" en blanco porque no
  // había dónde cargarlo). Autoedición habilitada en la migración 0053.
  const [campoRegistroProfesional, setCampoRegistroProfesional] = useState(usuario?.registroProfesional || "")
  const [guardandoRegistroProfesional, setGuardandoRegistroProfesional] = useState(false)
  const [registroProfesionalGuardadoOk, setRegistroProfesionalGuardadoOk] = useState(false)
  useEffect(() => { setCampoRegistroProfesional(usuario?.registroProfesional || "") }, [usuario?.registroProfesional])
  const guardarRegistroProfesional = async () => {
    if (!usuario?.id || campoRegistroProfesional.trim() === (usuario?.registroProfesional || "")) return
    setGuardandoRegistroProfesional(true)
    const valor = campoRegistroProfesional.trim() || null
    const { error } = await supabase.from("perfiles").update({ registro_profesional: valor }).eq("id", usuario.id)
    if (!error) {
      alActualizarUsuario?.({ registroProfesional: valor })
      setRegistroProfesionalGuardadoOk(true)
      setTimeout(() => setRegistroProfesionalGuardadoOk(false), 2500)
    }
    setGuardandoRegistroProfesional(false)
  }
  // Buscador global de pacientes en la barra superior — hallazgo de la
  // auditoría de navegación 2026-09-08: antes solo se podía buscar un
  // paciente desde adentro de Pacientes (o el widget de Inicio); estando en
  // Inventario, Reportes, etc. había que ir primero ahí. Reusa el mismo
  // mecanismo que ya usa Inicio.jsx (accionPacienteInicio → navegar a
  // "pacientes" → Pacientes.jsx abre el perfil solo con su useEffect sobre
  // accionInicial), no hizo falta ninguna plomería nueva del lado de
  // Pacientes.jsx.
  const [busquedaGlobal, setBusquedaGlobal] = useState("")
  const [mostrarBusquedaGlobal, setMostrarBusquedaGlobal] = useState(false)
  const resultadosBusquedaGlobal = useMemo(() => {
    const q = busquedaGlobal.trim().toLowerCase()
    if (!q) return []
    return pacientes.filter((p) => p.nombre?.toLowerCase().includes(q) || p.cedula?.includes(q)).slice(0, 6)
  }, [pacientes, busquedaGlobal])
  const irAPacienteGlobal = (paciente) => {
    setAccionPacienteInicio({ pacienteId: paciente.id, accion: "historial" })
    navegar("pacientes")
    setMostrarBusquedaGlobal(false)
    setBusquedaGlobal("")
  }

  // B1: el buscador global solo cubría pacientes — lo que más se busca en
  // el día a día también incluye la cita de hoy de alguien y si queda un
  // producto en bodega. Sin deep-link a la fila exacta (Citas.jsx no tiene
  // un mecanismo externo para abrir una cita puntual, a diferencia de
  // Pacientes.jsx con accionInicial) — igual resuelve el caso real: saltar
  // directo a la sección correcta en vez de navegar ahí a ciegas primero.
  const resultadosCitasGlobal = useMemo(() => {
    const q = busquedaGlobal.trim().toLowerCase()
    if (!q) return []
    return citas.filter((c) => esHoy(c.fecha) && c.estado !== "Cancelada" && ((c.paciente || "").toLowerCase().includes(q) || (c.motivo || "").toLowerCase().includes(q))).slice(0, 4)
  }, [citas, busquedaGlobal])
  const resultadosProductosGlobal = useMemo(() => {
    const q = busquedaGlobal.trim().toLowerCase()
    if (!q) return []
    return inventario.filter((p) => (p.nombre || "").toLowerCase().includes(q)).slice(0, 4)
  }, [inventario, busquedaGlobal])
  const irASeccionGlobal = (seccion) => {
    navegar(seccion)
    setMostrarBusquedaGlobal(false)
    setBusquedaGlobal("")
  }
  const notifRef = useRef(null)
  const userRef = useRef(null)
  const busquedaGlobalRef = useRef(null)

  useEffect(() => {
    const onDown = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifAbierta(false)
      if (userRef.current && !userRef.current.contains(e.target)) setUserMenuAbierto(false)
      if (busquedaGlobalRef.current && !busquedaGlobalRef.current.contains(e.target)) setMostrarBusquedaGlobal(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [])

  useEffect(() => {
    localStorage.setItem('optica_seccion_activa', seccionActiva)
  }, [seccionActiva])

  // Si al administrador le quita un permiso mientras el asistente está en esa
  // sección (u otra sesión abierta), no lo deja varado: lo manda a Inicio.
  useEffect(() => {
    if (!opcionesVisibles.some((o) => o.id === seccionActiva)) setSeccionActiva("inicio")
  }, [opcionesVisibles, seccionActiva])

  // ─── Historial del navegador ───
  // Antes, cambiar de sección solo tocaba estado de React (+ localStorage
  // para sobrevivir un reload) sin tocar window.history — la app entera
  // vivía en una sola entrada del historial. Resultado real: Pacientes →
  // Inventario → botón Atrás del navegador no volvía a Pacientes, sacaba al
  // usuario del sistema (a lo que hubiera antes de cargar la app). Ahora
  // cada sección visitada por navegar() empuja una entrada real
  // (?seccion=xxx en la URL), y un listener de popstate sincroniza el
  // estado cuando el usuario usa Atrás/Adelante — sin recargar la página ni
  // volver a resolver la óptica (?optica=/?sitio= se preservan intactos).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get("seccion") !== seccionActiva) {
      params.set("seccion", seccionActiva)
      window.history.replaceState({ seccion: seccionActiva }, "", `${window.location.pathname}?${params}`)
    }
    // Solo al montar: sincroniza la URL con la sección restaurada de
    // localStorage sin crear una entrada de historial nueva.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const alPopState = (e) => {
      const seccion = e.state?.seccion || new URLSearchParams(window.location.search).get("seccion") || "inicio"
      if (opcionesVisibles.some((o) => o.id === seccion)) setSeccionActiva(seccion)
    }
    window.addEventListener("popstate", alPopState)
    return () => window.removeEventListener("popstate", alPopState)
  }, [opcionesVisibles])

  // Navegación unificada (mapea alias de otros módulos)
  const navegar = (vista) => {
    const mapa = { consulta: "consultas", consultas_opticas: "consultas" }
    const destino = mapa[vista] || vista
    if (destino !== seccionActiva) {
      const params = new URLSearchParams(window.location.search)
      params.set("seccion", destino)
      window.history.pushState({ seccion: destino }, "", `${window.location.pathname}?${params}`)
    }
    setSeccionActiva(destino)
    setMenuAbierto(false)
    setNotifAbierta(false)
  }

  // Único punto de entrada a Ficha clínica, sea desde el perfil de un
  // paciente o desde "Atender" en Citas médicas — centraliza qué debe
  // recordar Dashboard para que "Volver" (a diferencia de "X", que siempre
  // sale a la lista de origen) pueda reabrir el perfil del paciente en vez
  // de aterrizar en la lista pelada.
  const irAFichaClinica = (paciente, { citaId = null, origen = "pacientes" } = {}) => {
    setFichaClinicaPacienteInicial(paciente)
    setFichaClinicaCitaId(citaId)
    setFichaClinicaOrigen(origen)
    setFichaClinicaPacienteOrigenId(origen === "pacientes" ? paciente?.id ?? null : null)
    // El ing probó "Atender" esperando ver ya puesto el motivo con el que se
    // agendó la cita, en vez de tener que volver a escribirlo en la ficha
    // clínica (ING7) — se resuelve acá porque Dashboard ya tiene `citas`
    // completo, sin tener que hacer viajar el objeto cita entero por Citas.jsx.
    const citaOrigen = citaId ? citas.find((c) => c.id === citaId) : null
    setFichaClinicaMotivoInicial(citaOrigen?.motivo || null)
    navegar("consultas")
  }

  // Resumen de Mensajes para la campanita — única llamada a Supabase de este
  // archivo (el resto del Dashboard es local/localStorage). Consultas propias
  // sin responder + avisos generales publicados en los últimos 14 días.
  const [mensajesResumen, setMensajesResumen] = useState({ abiertas: 0, avisosRecientes: 0 })
  useEffect(() => {
    if (!supabase || !esAdmin || !usuario?.opticaId) return
    let vigente = true
    const cargar = async () => {
      const desde14dias = new Date(Date.now() - 14 * 86400000).toISOString()
      const [{ count: abiertas }, { count: avisosRecientes }] = await Promise.all([
        supabase.from("mensajes").select("id", { count: "exact", head: true }).eq("optica_id", usuario.opticaId).eq("tipo", "consulta").eq("estado", "abierto"),
        supabase.from("mensajes").select("id", { count: "exact", head: true }).eq("tipo", "anuncio").gte("created_at", desde14dias),
      ])
      if (vigente) setMensajesResumen({ abiertas: abiertas || 0, avisosRecientes: avisosRecientes || 0 })
    }
    cargar()
    return () => { vigente = false }
  }, [esAdmin, usuario?.opticaId, seccionActiva])

  // Centro de notificaciones (alertas reales del sistema)
  const alertas = useMemo(() => {
    const arr = []
    inventario.forEach((p) => {
      if (esStockBajo(p)) arr.push({ icon: Package, color: "#d97706", bg: "#fffbeb", texto: `Stock bajo: ${p.nombre}`, sub: `${p.stock} u. disponibles`, destino: "inventario" })
    })
    const citasDeHoy = citas.filter((c) => esHoy(c.fecha))
    if (citasDeHoy.length) arr.push({ icon: Calendar, color: "#2563eb", bg: "#eff6ff", texto: `${citasDeHoy.length} cita${citasDeHoy.length > 1 ? "s" : ""} para hoy`, sub: "Revisa la agenda del día", destino: "citas" })
    if (mensajesResumen.abiertas > 0) arr.push({ icon: MessageSquare, color: "#2563eb", bg: "#eff6ff", texto: `${mensajesResumen.abiertas} consulta${mensajesResumen.abiertas > 1 ? "s" : ""} esperando respuesta`, sub: `Le escribiste al equipo de ${NOMBRE_EQUIPO}`, destino: "mensajes" })
    if (mensajesResumen.avisosRecientes > 0) arr.push({ icon: MessageSquare, color: "#b45309", bg: "#fef3c7", texto: `${mensajesResumen.avisosRecientes} aviso${mensajesResumen.avisosRecientes > 1 ? "s" : ""} general${mensajesResumen.avisosRecientes > 1 ? "es" : ""}`, sub: `Publicado por el equipo de ${NOMBRE_EQUIPO}`, destino: "mensajes" })
    pacientes.forEach((p) => {
      const d = diasACumple(p.fechaNacimiento || p.fecha_nacimiento)
      if (d !== null) {
        const t = d === 0 ? "cumple años hoy" : d > 0 ? `cumple en ${d} día${d > 1 ? "s" : ""}` : `cumplió hace ${Math.abs(d)} día${Math.abs(d) > 1 ? "s" : ""}`
        arr.push({ icon: Cake, color: "#b45309", bg: "#fef3c7", texto: `${p.nombre} ${t}`, sub: "Envíale un saludo desde el CRM", destino: "crm" })
      }
      // Próximo control recién vencido (ventana de 7 días, igual que
      // cumpleaños) — feedback del asesor: el optómetra debe enterarse solo,
      // no ir a buscarlo a CRM. Los vencidos de hace más tiempo ya están en
      // el bucket "Sin visitar hace tiempo" de CRM, no hace falta repetirlos
      // aquí indefinidamente.
      const dv = diasVencido(p, consultas)
      if (dv !== null && dv >= 0 && dv <= 7) {
        arr.push({ icon: CalendarClock, color: "#2563eb", bg: "#eff6ff", texto: `Control vencido: ${p.nombre}`, sub: dv === 0 ? "Vence hoy" : `Venció hace ${dv} día${dv > 1 ? "s" : ""}`, destino: "crm" })
      }
    })
    return arr
  }, [inventario, citas, pacientes, consultas, mensajesResumen])

  const hora = new Date().getHours()
  const saludo = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches"
  const hoyFecha = new Date().toLocaleDateString("es-ES", { weekday: "long", year: "numeric", month: "long", day: "numeric" })

  const nombreUsuario = usuario?.nombre || (esAsistente ? "Asistente" : "Administrador")
  const rolUsuario = esAsistente ? "Asistente" : "Administrador"
  const inicialUsuario = nombreUsuario.charAt(0).toUpperCase()

  const renderSeccion = () => {
    switch (seccionActiva) {
      case "pacientes":
        return (
          <Pacientes
            usuario={usuario}
            setVista={navegar}
            cargaInicial={cargaInicialStaff}
            pacientes={pacientes}
            setPacientes={setPacientes}
            consultas={consultas}
            setConsultas={setConsultas}
            citas={citas}
            setCitas={setCitas}
            disponibilidad={disponibilidad}
            motivosConsulta={motivosConsulta}
            inventario={inventario}
            setInventario={setInventario}
            categoriasInventario={categoriasInventario}
            setCategoriasInventario={setCategoriasInventario}
            ventas={ventas}
            setVentas={setVentas}
            setFacturasVenta={setFacturasVenta}
            accionInicial={accionPacienteInicio}
            onAccionInicialConsumida={() => setAccionPacienteInicio(null)}
            onIrAFichaClinica={(paciente, citaId) => irAFichaClinica(paciente, { citaId, origen: "pacientes" })}
            solicitudesEliminacion={solicitudesEliminacion}
            marcarSolicitudEliminacionAtendida={marcarSolicitudEliminacionAtendida}
          />
        )
      case "consultas":
        return (
          <ConsultaMedica
            usuario={usuario}
            pacientes={pacientes}
            setPacientes={setPacientes}
            consultas={consultas}
            setConsultas={setConsultas}
            inventario={inventario}
            setInventario={setInventario}
            setFacturasVenta={setFacturasVenta}
            parametrizacion={parametrizacion}
            diagnosticosRapidos={diagnosticosRapidos}
            pacienteInicial={fichaClinicaPacienteInicial}
            citaIdInicial={fichaClinicaCitaId}
            motivoInicial={fichaClinicaMotivoInicial}
            citas={citas}
            setCitas={setCitas}
            onPacienteInicialConsumido={() => { setFichaClinicaPacienteInicial(null); setFichaClinicaCitaId(null); setFichaClinicaMotivoInicial(null) }}
            onCerrar={() => navegar(fichaClinicaOrigen)}
            onVolver={() => {
              if (fichaClinicaOrigen === "pacientes" && fichaClinicaPacienteOrigenId) {
                setAccionPacienteInicio({ pacienteId: fichaClinicaPacienteOrigenId, accion: "historial" })
              }
              navegar(fichaClinicaOrigen)
            }}
            origenNombre={fichaClinicaOrigen === "citas" ? "Citas médicas" : "Pacientes"}
          />
        )
      case "inventario":
        return (
          <Inventario
            usuario={usuario}
            cargaInicial={cargaInicialStaff}
            inventario={inventario}
            setInventario={setInventario}
            categorias={categoriasInventario}
            setCategorias={setCategoriasInventario}
            pacientes={pacientes}
            ventas={ventas}
            setVentas={setVentas}
            abrirModalAlEntrar={abrirCrearProductoAlEntrar}
            onModalAlEntrarConsumido={() => setAbrirCrearProductoAlEntrar(false)}
          />
        )
      case "citas":
        return (
          <Citas
            usuario={usuario}
            cargaInicial={cargaInicialStaff}
            citas={citas}
            setCitas={setCitas}
            pacientes={pacientes}
            setPacientes={setPacientes}
            disponibilidad={disponibilidad}
            abrirModalAlEntrar={abrirAgendarAlEntrar}
            onModalAlEntrarConsumido={() => setAbrirAgendarAlEntrar(false)}
            motivosConsulta={motivosConsulta}
            onAtender={(paciente, citaId) => irAFichaClinica(paciente, { citaId, origen: "citas" })}
            onVerPerfil={(pacienteId) => { setAccionPacienteInicio({ pacienteId, accion: "historial" }); navegar("pacientes") }}
          />
        )
      case "horario":
        return <Horario usuario={usuario} disponibilidad={disponibilidad} setDisponibilidad={setDisponibilidad} horarioPersonal={horarioPersonal} setHorarioPersonal={setHorarioPersonal} citas={citas} />
      case "crm":
        return <CRM usuario={usuario} pacientes={pacientes} consultas={consultas} parametrizacion={parametrizacion} setParametrizacion={setParametrizacion} />
      case "reportes":
        return <Reportes pacientes={pacientes} consultas={consultas} citas={citas} ventas={ventas} facturasVenta={facturasVenta} respuestasSatisfaccion={respuestasSatisfaccion} />
      case "mensajes":
        return <Mensajes usuario={usuario} />
      case "usuarios":
        return <Usuarios usuario={usuario} asistentes={asistentes} setAsistentes={setAsistentes} />
      case "configuracion":
        return (
          <Configuracion
            usuario={usuario}
            alActualizarUsuario={alActualizarUsuario}
            parametrizacion={parametrizacion}
            setParametrizacion={setParametrizacion}
            motivosConsulta={motivosConsulta}
            setMotivosConsulta={setMotivosConsulta}
            diagnosticosRapidos={diagnosticosRapidos}
            setDiagnosticosRapidos={setDiagnosticosRapidos}
            categoriasInventario={categoriasInventario}
            setCategoriasInventario={setCategoriasInventario}
          />
        )
      case "inicio":
        return (
          <Inicio
            setVista={navegar}
            usuario={usuario}
            opticaActiva={opticaActiva}
            nombreUsuario={nombreUsuario}
            opticaNombre={usuario?.opticaNombre}
            pacientes={pacientes}
            citas={citas}
            inventario={inventario}
            consultas={consultas}
            onAgendarRapido={() => {
              setAbrirAgendarAlEntrar(true)
              navegar("citas")
            }}
            onCrearPacienteRapido={() => {
              setAccionPacienteInicio({ accion: "crear" })
              navegar("pacientes")
            }}
            onCrearProductoRapido={() => {
              setAbrirCrearProductoAlEntrar(true)
              navegar("inventario")
            }}
          />
        )
      default:
        return (
          <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-slate-200 bg-white p-6">
            <div className="text-center">
              <p className="text-lg text-slate-500">Sección en desarrollo</p>
              <h3 className="mt-1 text-2xl font-bold uppercase text-blue-600">{seccionActiva}</h3>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="flex h-screen font-sans" style={{ backgroundColor: "#F7F5F0" }}>
      {/* Backdrop móvil */}
      {menuAbierto && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMenuAbierto(false)} />}

      {/* ─── SIDEBAR ─── */}
      <aside
        className={
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col justify-between overflow-hidden border-r border-white/[0.07] transition-all duration-300 lg:static lg:translate-x-0 " +
          (colapsado ? "lg:w-20 " : "lg:w-72 ") +
          (menuAbierto ? "translate-x-0" : "-translate-x-full")
        }
        style={{ background: `linear-gradient(180deg, #16404D 0%, ${INK} 55%)` }}
      >
        {/* Profundidad de marca */}
        <svg aria-hidden="true" className="pointer-events-none absolute -bottom-20 -right-20 h-80 w-80" viewBox="0 0 400 400" fill="none" stroke="#ffffff" style={{ opacity: 0.05 }}>
          {[70, 130, 190].map((r) => (<circle key={r} cx="200" cy="200" r={r} strokeWidth="1.4" />))}
        </svg>
        <div className="pointer-events-none absolute -left-24 top-1/4 h-56 w-56 rounded-full blur-3xl" style={{ background: "radial-gradient(circle, rgba(34,211,238,0.12), transparent 70%)" }} />

        <div className="relative z-10 min-h-0 flex-1 overflow-y-auto">
          <div className={"flex min-w-0 items-center justify-between border-b border-white/10 px-6 py-5 " + (colapsado ? "lg:justify-center lg:px-0" : "")}>
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white" style={{ background: GRAD, boxShadow: "0 10px 24px -8px rgba(34,211,238,0.6)" }}>
                <Eye size={22} strokeWidth={2.2} />
              </div>
              <div className={"min-w-0 leading-tight " + (colapsado ? "lg:hidden" : "")}>
                <p className="truncate text-lg font-bold tracking-tight text-white">
                  {usuario?.opticaNombre || "Mi Óptica"}
                </p>
                <p className="text-[11px] font-medium tracking-wide text-white/55">PANEL DE CONTROL</p>
              </div>
            </div>
            <button type="button" onClick={() => setMenuAbierto(false)} aria-label="Cerrar menú" className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white lg:hidden cursor-pointer">
              <X size={20} />
            </button>
          </div>

          <nav className="space-y-1.5 px-4 py-6">
            <p className={"mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-white/55 " + (colapsado ? "lg:hidden" : "")}>Menú principal</p>
            {opcionesVisibles.filter((o) => !o.oculto).map((opcion) => {
              const Icono = opcion.icono
              const activo = seccionActiva === opcion.id
              return (
                <button
                  key={opcion.id}
                  type="button"
                  onClick={() => navegar(opcion.id)}
                  title={colapsado ? opcion.nombre : undefined}
                  aria-label={opcion.nombre}
                  className={"group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-all cursor-pointer " + (colapsado ? "lg:justify-center lg:px-0 " : "") + (activo ? "text-white" : "text-white/75 hover:bg-white/5 hover:text-white")}
                  style={activo ? { background: GRAD, boxShadow: "0 12px 24px -12px rgba(34,211,238,0.55)" } : undefined}
                >
                  <Icono size={20} className={activo ? "text-white" : "text-white/75 group-hover:text-white"} />
                  <span className={colapsado ? "lg:hidden" : ""}>{opcion.nombre}</span>
                  {activo && <span className={"ml-auto h-1.5 w-1.5 rounded-full bg-white/80 " + (colapsado ? "lg:hidden" : "")} />}
                </button>
              )
            })}
          </nav>
        </div>

        <div className="relative z-10 border-t border-white/10 p-4">
          <div className={"flex items-center gap-2 px-2 text-[11px] font-medium text-white/55 " + (colapsado ? "lg:justify-center lg:px-0" : "")}>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className={colapsado ? "lg:hidden" : ""}>Sistema en línea · v1.0</span>
          </div>
        </div>
      </aside>

      {/* ─── CONTENIDO ─── */}
      {/* relative: ancla al perfil de paciente en pantalla completa (Pacientes.jsx
          lo porta acá vía #vista-completa-root) — cubre todo este panel,
          incluida esta barra superior, pero nunca el sidebar de al lado. */}
      <main className="relative flex flex-1 flex-col overflow-hidden">
        {/* Ancla de vistas a pantalla completa dentro del panel (perfil del
            paciente, y cualquier otra a futuro) — position:relative en <main>
            de arriba es lo que hace que "absolute inset-0" adentro cubra
            justo este panel y no el sidebar. */}
        <div id="vista-completa-root" />

        {/* Franja de impersonación — visible mientras un superadmin está
            "entrado como" el administrador de esta óptica (caso #8 de la
            reunión con el ing). Salir vuelve al panel de superadmin sin
            cerrar la sesión real de Supabase Auth. */}
        {onSalirImpersonacion && (
          <div className="relative z-30 flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs font-semibold text-white sm:px-8" style={{ background: "linear-gradient(135deg,#a78bfa,#6d28d9)" }}>
            <span className="flex items-center gap-2">
              <ShieldAlert size={15} />
              Estás dentro de <strong>{usuario?.opticaNombre}</strong> como superadmin — cualquier acción queda registrada.
            </span>
            <button type="button" onClick={onSalirImpersonacion} className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-bold transition hover:bg-white/25 cursor-pointer">
              <LogOut size={13} /> Salir y volver a Superadmin
            </button>
          </div>
        )}

        {/* Barra superior */}
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
                {saludo}, {nombreUsuario}
              </p>
              <p className="truncate text-xs capitalize text-slate-500">{hoyFecha}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Paleta de comandos — Ctrl/Cmd+K abre desde cualquier lado, este
                botón es solo para que se descubra con el mouse. */}
            <button
              type="button"
              onClick={() => setPaletaAbierta(true)}
              className="hidden h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-600 cursor-pointer md:flex"
              title="Ir a una sección (Ctrl+K)"
              aria-label="Abrir paleta de comandos"
            >
              <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold">Ctrl K</kbd>
            </button>

            {/* Buscador global de pacientes — accesible desde cualquier
                sección, no solo desde adentro de Pacientes. */}
            <div className="relative" ref={busquedaGlobalRef}>
              <button
                type="button"
                onClick={() => setMostrarBusquedaGlobal((v) => !v)}
                className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-slate-500 transition-colors hover:bg-slate-50 cursor-pointer sm:w-64"
                title="Buscar paciente"
                aria-label="Buscar paciente"
              >
                <Search size={16} className="shrink-0" />
                <span className="hidden truncate text-sm sm:inline">Buscar paciente...</span>
              </button>

              {mostrarBusquedaGlobal && (
                <div className="absolute left-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:left-auto sm:right-0">
                  <div className="border-b border-slate-100 p-3">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                      <input
                        autoFocus
                        type="text"
                        value={busquedaGlobal}
                        onChange={(e) => setBusquedaGlobal(e.target.value)}
                        placeholder="Paciente, cita de hoy o producto..."
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
                      />
                    </div>
                  </div>
                  {busquedaGlobal.trim() && (
                    <div className="max-h-80 overflow-y-auto">
                      {resultadosBusquedaGlobal.length === 0 && resultadosCitasGlobal.length === 0 && resultadosProductosGlobal.length === 0 ? (
                        <p className="p-4 text-center text-xs text-slate-500">Nada coincide.</p>
                      ) : (
                        <>
                          {resultadosBusquedaGlobal.length > 0 && (
                            <div>
                              <p className="px-4 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Pacientes</p>
                              {resultadosBusquedaGlobal.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => irAPacienteGlobal(p)}
                                  className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-blue-50 cursor-pointer"
                                >
                                  <span className="truncate font-semibold text-slate-700">{p.nombre}</span>
                                  {p.cedula && <span className="shrink-0 font-mono text-xs text-slate-400">{p.cedula}</span>}
                                </button>
                              ))}
                            </div>
                          )}
                          {resultadosCitasGlobal.length > 0 && (
                            <div>
                              <p className="px-4 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Citas de hoy</p>
                              {resultadosCitasGlobal.map((c) => (
                                <button
                                  key={c.id}
                                  type="button"
                                  onClick={() => irASeccionGlobal("citas")}
                                  className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-blue-50 cursor-pointer"
                                >
                                  <span className="truncate font-semibold text-slate-700">{c.paciente || "Sin nombre"}</span>
                                  <span className="shrink-0 text-xs text-slate-400">{c.hora || ""}</span>
                                </button>
                              ))}
                            </div>
                          )}
                          {resultadosProductosGlobal.length > 0 && (
                            <div>
                              <p className="px-4 pt-2.5 pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Inventario</p>
                              {resultadosProductosGlobal.map((p) => (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => irASeccionGlobal("inventario")}
                                  className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-blue-50 cursor-pointer"
                                >
                                  <span className="truncate font-semibold text-slate-700">{p.nombre}</span>
                                  <span className="shrink-0 font-mono text-xs text-slate-400">{p.stock} u.</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Notificaciones */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setNotifAbierta((v) => !v)}
                className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer"
                title="Notificaciones"
                aria-label="Notificaciones"
              >
                <Bell size={18} />
                {alertas.length > 0 && (
                  <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full px-1 text-[10px] font-bold text-white" style={{ background: "linear-gradient(135deg,#f59e0b,#dc2626)" }}>
                    {alertas.length > 9 ? "9+" : alertas.length}
                  </span>
                )}
              </button>

              {notifAbierta && (
                <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                  <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                    <p className="text-sm font-bold" style={{ color: INK }}>Notificaciones</p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">{alertas.length}</span>
                  </div>
                  {alertas.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-10 text-center">
                      <CheckCircle2 size={28} className="text-emerald-500" />
                      <p className="text-sm font-medium text-slate-500">Todo al día. Sin alertas.</p>
                    </div>
                  ) : (
                    <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto">
                      {alertas.map((a, i) => (
                        <button key={i} type="button" onClick={() => navegar(a.destino)} className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 cursor-pointer">
                          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: a.bg, color: a.color }}>
                            <a.icon size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-800">{a.texto}</p>
                            <p className="truncate text-xs text-slate-500">{a.sub}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Usuario */}
            <div className="relative" ref={userRef}>
              <button
                type="button"
                onClick={() => setUserMenuAbierto((v) => !v)}
                className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white py-1.5 pl-1.5 pr-2.5 transition-colors hover:bg-slate-50 cursor-pointer"
              >
                <div className="grid h-7 w-7 place-items-center rounded-lg text-xs font-bold text-white" style={{ background: GRAD }}>{inicialUsuario}</div>
                <div className="hidden text-left leading-tight sm:block">
                  <p className="text-sm font-semibold" style={{ color: INK }}>{nombreUsuario}</p>
                  <p className="text-[10px] text-slate-500">{rolUsuario}</p>
                </div>
                <ChevronDown size={16} className={"text-slate-500 transition-transform " + (userMenuAbierto ? "rotate-180" : "")} />
              </button>

              {userMenuAbierto && (
                <div className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                  <div className="flex items-center gap-3 border-b border-slate-100 p-4">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: GRAD }}>{inicialUsuario}</div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold" style={{ color: INK }}>{nombreUsuario}</p>
                      <p className="flex items-center gap-1.5 text-xs text-slate-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {rolUsuario}
                      </p>
                    </div>
                  </div>
                  <div className="p-2">
                    <button
                      type="button"
                      onClick={() => { setUserMenuAbierto(false); setModalMiCuentaAbierto(true) }}
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
          </div>
        </header>

        {/* Espacio de trabajo */}
        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {/* Hallazgo real 2026-09-10: suspender una óptica no cortaba el
              acceso de una sesión ya abierta, y tampoco avisaba nada — la
              persona solo veía que las cosas empezaban a fallar sin
              explicación. Este banner no se puede cerrar (no tiene botón de
              cerrar a propósito) y se queda mientras opticaActiva sea
              false — no bloquea la pantalla porque las acciones reales ya
              fallan limpio por RLS (migración 0073), esto es solo para
              explicar por qué. */}
          {!opticaActiva && (
            <div role="alert" className="mb-4 flex items-start gap-3 rounded-2xl border border-red-300 bg-red-100 p-4">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-600" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-red-900">Esta óptica fue suspendida por el administrador del sistema.</p>
                <p className="text-xs text-red-700">Ya no podés ver ni modificar pacientes, citas, inventario ni el resto de los datos. Contactá a soporte si esto es un error.</p>
              </div>
              <button type="button" onClick={() => alSalir()} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-red-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-800 transition hover:bg-red-50 cursor-pointer">
                <LogOut size={13} /> Cerrar sesión
              </button>
            </div>
          )}

          {/* J7: antes un fallo de red o un RLS que negaba el acceso al cargar
              pacientes/citas/etc. quedaba en silencio — la pantalla se veía
              igual que "no hay datos todavía", sin ninguna forma de saber que
              en realidad falló la carga. */}
          {erroresCarga.length > 0 && (
            <div role="alert" className="mb-4 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-500" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-red-800">No se pudo cargar: {erroresCarga.join(", ")}.</p>
                <p className="text-xs text-red-600">Puede que la información que ves esté vieja o incompleta. Revisa tu conexión e intenta recargar la página.</p>
              </div>
              <button type="button" onClick={() => window.location.reload()} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 cursor-pointer">
                <RefreshCw size={13} /> Recargar
              </button>
              <button type="button" onClick={onCerrarErroresCarga} aria-label="Cerrar aviso" className="shrink-0 rounded-lg p-1.5 text-red-400 transition hover:bg-red-100 hover:text-red-600 cursor-pointer">
                <X size={16} />
              </button>
            </div>
          )}
          <Suspense fallback={<div className="flex h-64 items-center justify-center"><Loader2 size={28} className="animate-spin text-blue-500" /></div>}>
            {renderSeccion()}
          </Suspense>
        </div>
      </main>

      {/* ─── MODAL MI CUENTA ─── */}
      {modalMiCuentaAbierto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }}
          onClick={() => setModalMiCuentaAbierto(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)", willChange: "transform, opacity" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: GRAD }}>
                  <Settings size={20} />
                </div>
                <div>
                  <h4 className="text-lg font-bold" style={{ color: INK }}>Mi cuenta</h4>
                  <p className="text-xs text-slate-500">{nombreUsuario} · {rolUsuario}</p>
                </div>
              </div>
              <button type="button" onClick={() => setModalMiCuentaAbierto(false)} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <div className="mb-5 space-y-2 rounded-xl border border-slate-200 p-4">
                <label htmlFor="registroProfesional" className="block text-sm font-bold" style={{ color: INK }}>
                  Número de registro profesional <span className="font-normal text-slate-400">(opcional)</span>
                </label>
                <p className="text-xs text-slate-500">Si atiendes pacientes vos mismo, aparece en el "Reg. Prof." de la receta impresa de las consultas que guardes.</p>
                <div className="flex items-center gap-2">
                  <input
                    id="registroProfesional"
                    type="text"
                    value={campoRegistroProfesional}
                    onChange={(e) => setCampoRegistroProfesional(e.target.value)}
                    onBlur={guardarRegistroProfesional}
                    placeholder="Ej. SENESCYT-1234567890"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:bg-white"
                  />
                  {guardandoRegistroProfesional && <Loader2 size={16} className="shrink-0 animate-spin text-slate-400" />}
                  {registroProfesionalGuardadoOk && <CheckCircle2 size={16} className="shrink-0 text-emerald-500" />}
                </div>
              </div>
              <SeccionMfa />
            </div>
          </div>
        </div>
      )}

      {paletaAbierta && (
        <PaletaComandos
          opciones={opcionesVisibles.filter((o) => !o.oculto)}
          onNavegar={(id) => { navegar(id); setPaletaAbierta(false) }}
          onCerrar={() => setPaletaAbierta(false)}
        />
      )}
    </div>
  )
}

// Paleta de comandos: Ctrl/Cmd+K la abre desde cualquier pantalla del
// dashboard (listener global en el componente de arriba). Filtra por texto,
// se navega con flechas + Enter o con un clic — mismo patrón visual
// hand-rolled (createPortal + overlay-in/modal-in) que el resto de los
// modales del sistema.
function PaletaComandos({ opciones, onNavegar, onCerrar }) {
  const [texto, setTexto] = useState("")
  const [indiceActivo, setIndiceActivo] = useState(0)
  const inputRef = useRef(null)

  const filtradas = useMemo(() => {
    const q = texto.trim().toLowerCase()
    if (!q) return opciones
    return opciones.filter((o) => o.nombre.toLowerCase().includes(q))
  }, [opciones, texto])

  useEffect(() => { setIndiceActivo(0) }, [texto])
  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === "Escape") { onCerrar(); return }
      if (e.key === "ArrowDown") { e.preventDefault(); setIndiceActivo((i) => Math.min(i + 1, filtradas.length - 1)) }
      if (e.key === "ArrowUp") { e.preventDefault(); setIndiceActivo((i) => Math.max(i - 1, 0)) }
      if (e.key === "Enter" && filtradas[indiceActivo]) { e.preventDefault(); onNavegar(filtradas[indiceActivo].id) }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [filtradas, indiceActivo, onCerrar, onNavegar])

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-start justify-center p-4 pt-[12vh] backdrop-blur-sm"
      style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }}
      onClick={onCerrar}
    >
      <div
        className="flex max-h-[60vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
        style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)", willChange: "transform, opacity" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Paleta de comandos"
      >
        <div className="flex shrink-0 items-center gap-2.5 border-b border-slate-100 px-4 py-3">
          <Search size={16} className="shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Ir a..."
            className="w-full text-sm text-slate-800 outline-none placeholder:text-slate-400"
          />
          <kbd className="hidden shrink-0 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 sm:block">Esc</kbd>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {filtradas.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-slate-500">Sin resultados.</p>
          ) : (
            filtradas.map((o, i) => {
              const Icono = o.icono
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => onNavegar(o.id)}
                  onMouseEnter={() => setIndiceActivo(i)}
                  className={"flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors cursor-pointer " + (i === indiceActivo ? "bg-blue-50 text-blue-700" : "text-slate-600")}
                >
                  <Icono size={16} className="shrink-0" />
                  {o.nombre}
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
