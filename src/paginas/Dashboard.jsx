"use client"

import { ahoraEcuador } from "../utilidades/horaEcuador"

import { formatoFecha } from "../utilidades/formatoFecha"
import React, { useState, useMemo, useEffect, useRef, Suspense } from "react"
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
  ShoppingBag,
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
const Ventas = lazyConReintento(() => import("./Ventas"), "Ventas")
// Atajo "Registrar paciente" de Inicio: Pacientes abre su formulario de crear sin mostrar su lista.
const ACCION_CREAR_PACIENTE = { accion: "crear" }
const Citas = lazyConReintento(() => import("./Citas"), "Citas")
const Horario = lazyConReintento(() => import("./Horario"), "Horario")
const CRM = lazyConReintento(() => import("./CRM"), "CRM")
const Reportes = lazyConReintento(() => import("./Reportes"), "Reportes")
const Usuarios = lazyConReintento(() => import("./Usuarios"), "Usuarios")
const Configuracion = lazyConReintento(() => import("./Configuracion"), "Configuracion")
const Mensajes = lazyConReintento(() => import("./Mensajes"), "Mensajes")
import { umbralStock } from "../utilidades/inventario"
import { useModalAccesible } from "../utilidades/useModalAccesible"
import { supabase } from "../lib/supabaseClient"
import SeccionMfa from "./SeccionMfa"
import ConfirmarEliminarModal from "../componentes/ConfirmarEliminarModal"
import { INK } from "@/lib/tema"
import { MODO_SAAS_VISIBLE } from "@/lib/config"
import { useVistas } from "../utilidades/useVistas"
import { puede } from "../utilidades/permisosUi"
import { puedeReasignar } from "../utilidades/reasignacion"
import { citasPropias } from "../utilidades/inicio"
import { PARAMS_DE_SECCION, escribirParam, leerParam } from "../utilidades/urlEstado"
import { modulosVisibles, puedeNivel } from "../utilidades/roles"
import { EVENTO_ORDEN, numeroOrden, ordenesAtrasadas, ordenesListasSinAvisar } from "../utilidades/ordenesLaboratorio"

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
  // Ventas (Bloque E): la cola "Listo para venta", los comprobantes, las órdenes de laboratorio y los saldos.
  // Se ve con el permiso ventas:ver (rol o vista activa); antes vivía dentro de Pacientes.
  { id: "ventas", nombre: "Ventas", icono: ShoppingBag },
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

export default function Dashboard({ usuario, opticaActiva = true, cargaInicialStaff = false, erroresCarga = [], onCerrarErroresCarga, pacientes = [], setPacientes, citas = [], setCitas, inventario = [], setInventario, consultas = [], setConsultas, ventas = [], setVentas, facturasVenta = [], setFacturasVenta, respuestasSatisfaccion = [], solicitudesEliminacion = [], marcarSolicitudEliminacionAtendida, marcarMedidasAtendidas, disponibilidad, setDisponibilidad, horarioPersonal, setHorarioPersonal, asistentes = [], setAsistentes, equipo = [], pases = [], setPases, ordenesLab = [], setOrdenesLab, abonos = [], parametrizacion, setParametrizacion, motivosConsulta = [], setMotivosConsulta, diagnosticosRapidos = [], setDiagnosticosRapidos, categoriasInventario = [], setCategoriasInventario, alSalir, onSalirImpersonacion, alActualizarUsuario }) {
  const esAsistente = usuario?.rol === "asistente"
  const esAdmin = usuario?.rol === "admin"

  // Un asistente solo ve lo que el administrador le habilitó (default: todo
  // menos lo marcado soloAdmin). El administrador ve siempre todo. Un
  // soloAdmin+delegable es la excepción: un asistente lo ve si el admin se lo
  // activó explícitamente (default false, a diferencia de los módulos
  // operativos que son default true) — es la "administración delegada" que
  // pidió el ing para cuando el optómetra contrata a alguien que le
  // administre el sistema completo.
  const listosParaVenta = useMemo(() => pases.filter((p) => p.estado === "listo").length, [pases])
  // Órdenes de laboratorio que piden acción: lentes listos sin avisar y órdenes atrasadas (R37).
  const ordenesPendientes = useMemo(() => ordenesListasSinAvisar(ordenesLab).length + ordenesAtrasadas(ordenesLab).length, [ordenesLab])
  // El contador del menú es de quien vende (ventas: crear), no de quien solo puede mirar Ventas: aparece sobre "Ventas".
  const vendeAqui = puede(usuario, "ventas", "crear")
  const avisosVentas = vendeAqui ? listosParaVenta + ordenesPendientes : 0
  const textoAvisosVentas = [
    listosParaVenta > 0 && `${listosParaVenta} listo${listosParaVenta === 1 ? "" : "s"} para venta`,
    ordenesPendientes > 0 && `${ordenesPendientes} orden${ordenesPendientes === 1 ? "" : "es"} de laboratorio por atender`,
  ].filter(Boolean).join(" · ")
  // Vista activa (R50): quien tiene más de un rol, o es administrador y también atiende, elige desde el
  // menú de usuario con qué vista trabajar. La vista enfoca el menú y el Inicio; la base sigue aplicando
  // la suma de los permisos de todos sus roles.
  const { vistas, vista, cambiarVista } = useVistas(usuario)
  const menuDeRol = vista && vista.tipo === "rol" ? modulosVisibles(vista.permisos) : null
  // Alcance de los datos (R49) según la vista: en una vista de rol manda el alcance de ese rol; si no, el que da la base.
  // La base ya acota lo que llega a quien solo tiene un rol "propio"; esto además enfoca a quien cambia de vista.
  const alcanceDeVista = (modulo) => (vista?.tipo === "rol" ? (vista.alcance?.[modulo] === "propio" ? "propio" : "todo") : usuario?.alcance?.[modulo] === "propio" ? "propio" : "todo")
  const citasReportes = useMemo(() => (alcanceDeVista("citas") === "propio" || alcanceDeVista("reportes") === "propio" ? citasPropias(citas, usuario?.id) : citas), [citas, vista, usuario]) // eslint-disable-line react-hooks/exhaustive-deps
  const consultasReportes = useMemo(() => (alcanceDeVista("consultas") === "propio" || alcanceDeVista("reportes") === "propio" ? consultas.filter((c) => !c.profesionalId || c.profesionalId === usuario?.id) : consultas), [consultas, vista, usuario]) // eslint-disable-line react-hooks/exhaustive-deps
  // Con alcance "propio" (por el rol o por la vista de optómetra) TODAS las secciones de Reportes se acotan a lo suyo,
  // no solo las citas: sus pacientes (los de sus citas o consultas), las encuestas de sus citas y los pases de sus
  // consultas. El historial completo de consultas se pasa aparte para que "controles atrasados" y "primera vez"
  // se midan contra todo lo que pasó con ese paciente, no solo contra lo que atendió esta persona.
  const reportesAcotado = alcanceDeVista("citas") === "propio" || alcanceDeVista("reportes") === "propio"
  const pacientesReportes = useMemo(() => {
    if (!reportesAcotado) return pacientes
    const ids = new Set([...citasReportes.map((c) => c.pacienteId), ...consultasReportes.map((c) => c.pacienteId)].filter(Boolean))
    return pacientes.filter((p) => ids.has(p.id))
  }, [pacientes, citasReportes, consultasReportes, reportesAcotado])
  const respuestasReportes = useMemo(() => {
    if (!reportesAcotado) return respuestasSatisfaccion
    const ids = new Set(citasReportes.map((c) => c.id))
    return respuestasSatisfaccion.filter((r) => ids.has(r.citaId))
  }, [respuestasSatisfaccion, citasReportes, reportesAcotado])
  const pasesReportes = useMemo(() => {
    if (!reportesAcotado) return pases
    const ids = new Set(consultasReportes.map((c) => c.id))
    return pases.filter((p) => ids.has(p.consultaId))
  }, [pases, consultasReportes, reportesAcotado])
  // Reportes: los montos (ingresos, ventas por tipo de luna, etc.) solo los ve quien puede ver Ventas en la vista activa.
  const verMontosReportes = vista?.tipo === "rol" ? puedeNivel(vista.permisos, "ventas", "ver") : puede(usuario, "ventas", "ver")
  // Con alcance "propio" en Reportes, las órdenes de laboratorio son solo las que creó la persona o de sus consultas.
  const ordenesReportes = useMemo(() => {
    if (alcanceDeVista("reportes") !== "propio") return ordenesLab
    const propias = new Set(consultasReportes.map((c) => c.id))
    return ordenesLab.filter((o) => o.creadaPor === usuario?.id || (o.consultaId && propias.has(o.consultaId)))
  }, [ordenesLab, consultasReportes, vista, usuario]) // eslint-disable-line react-hooks/exhaustive-deps
  const opcionesVisibles = useMemo(
    () => OPCIONES.filter((o) => {
      if (o.id === "inicio") return true
      if (o.id === "ventas" && !menuDeRol) return puede(usuario, "ventas", "ver")
      if (menuDeRol) return menuDeRol[o.id] === true && !(o.soloAdmin && !o.delegable)
      if (o.soloAdmin) {
        if (esAdmin) return true
        if (esAsistente && o.delegable) return usuario?.permisos?.[o.id] === true
        return false
      }
      if (esAsistente) return usuario?.permisos?.[o.id] !== false
      return true
    }),
    [esAsistente, esAdmin, usuario, vista], // eslint-disable-line react-hooks/exhaustive-deps
  )

  // Recuerda la sección del sidebar en la que estaba — recargar la página ya no
  // manda de vuelta a Inicio si estaba, por ejemplo, en Citas médicas.
  const [seccionActiva, setSeccionActiva] = useState(() => {
    // Enlace "Ver perfil" abierto en otra pestaña (?paciente=<id>): entra directo a Pacientes.
    if (new URLSearchParams(window.location.search).get('paciente') && opcionesVisibles.some((o) => o.id === 'pacientes')) return 'pacientes'
    // La sección de la URL manda (recargar, o abrir un enlace): así no se ve otra pantalla un instante.
    const deUrl = new URLSearchParams(window.location.search).get('seccion')
    if (deUrl && opcionesVisibles.some((o) => o.id === deUrl)) return deUrl
    const guardada = localStorage.getItem('optica_seccion_activa')
    return opcionesVisibles.some((o) => o.id === guardada) ? guardada : "inicio"
  })
  useEffect(() => {
    if (!opcionesVisibles.some((o) => o.id === seccionActiva)) setSeccionActiva("inicio")
  }, [opcionesVisibles]) // eslint-disable-line react-hooks/exhaustive-deps
  // Ref (no state): navegar() solo necesita leer el valor actual en el
  // momento del click, no re-renderizar cuando cambia. Lo actualiza
  // ConsultaMedica.jsx vía onCambiosSinGuardarChange cada vez que su propio
  // dirty-tracking cambia (ver audit UX, Lote 1, punto 1b).
  const fichaClinicaCambiosSinGuardar = useRef(false)
  // Aviso breve (abajo, al centro) para confirmar una acción que cambia de
  // pantalla, como "Dejar de atender". Se apaga solo.
  const [aviso, setAviso] = useState(null)
  const timeoutAviso = useRef(null)
  // Una orden de laboratorio creada o corregida desde cualquier pantalla avisa aquí (micro-feedback).
  useEffect(() => {
    const alGuardar = (e) => mostrarAviso(`Orden ${numeroOrden(e.detail.numero)} guardada.`)
    window.addEventListener(EVENTO_ORDEN, alGuardar)
    return () => window.removeEventListener(EVENTO_ORDEN, alGuardar)
  }, [])
  useEffect(() => {
    const alAviso = (e) => mostrarAviso(e.detail)
    window.addEventListener("aviso-global", alAviso)
    return () => window.removeEventListener("aviso-global", alAviso)
  }, [])
  // Acepta un texto o { texto, accion: { etiqueta, onClick } } (p. ej. "Deshacer"): con acción dura más para dar tiempo a usarla.
  const mostrarAviso = (mensaje) => {
    setAviso(mensaje)
    clearTimeout(timeoutAviso.current)
    timeoutAviso.current = setTimeout(() => setAviso(null), mensaje?.accion ? 8000 : 4000)
  }
  // Destino pendiente cuando navegar() necesita confirmar que se van a
  // perder cambios sin guardar de la ficha clínica (antes: window.confirm
  // nativo del navegador, sin el estilo del resto del sistema).
  const [confirmSalirFicha, setConfirmSalirFicha] = useState(null)
  const [accionPacienteInicio, setAccionPacienteInicio] = useState(() => {
    const id = new URLSearchParams(window.location.search).get('paciente')
    return id && opcionesVisibles.some((o) => o.id === 'pacientes') ? { pacienteId: id, accion: 'historial' } : null
  })
  // Destino pedido al módulo de Ventas: { tab: "cola" | "ventas" | "ordenes" | "saldos", filtro?, texto? }
  const [accionVentasInicio, setAccionVentasInicio] = useState(null)
  const [abrirAgendarAlEntrar, setAbrirAgendarAlEntrar] = useState(false)
  // Atajos de Inicio (Registrar paciente, Agendar cita, Añadir producto): el formulario se abre encima del Inicio.
  const [atajoInicio, setAtajoInicio] = useState(null)
  // Control a agendar desde el aviso de Inicio: { pacienteId, fecha, asignadoA } (fecha recomendada y quien atendió la consulta).
  const [controlParaAgendar, setControlParaAgendar] = useState(null)
  // Desde las tarjetas del Inicio: abre Citas ya filtrada por estado (atendidas, no asistieron, canceladas...)
  const [estadoCitasInicial, setEstadoCitasInicial] = useState(null)
  // Cita que el Inicio manda a atender: Citas abre su resumen y de ahí la ficha (el mismo flujo de "Atender" de Citas).
  const [citaParaAtender, setCitaParaAtender] = useState(null)
  const [abrirCrearProductoAlEntrar, setAbrirCrearProductoAlEntrar] = useState(false)
  const [productoIdParaReabastecer, setProductoIdParaReabastecer] = useState(null)
  const [verStockBajoAlEntrar, setVerStockBajoAlEntrar] = useState(false)
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
  const notifRef = useRef(null)
  const userRef = useRef(null)

  useEffect(() => {
    const onDown = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifAbierta(false)
      if (userRef.current && !userRef.current.contains(e.target)) setUserMenuAbierto(false)
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
    // El paciente abierto (?paciente=) se conserva: Pacientes lo reabre al recargar.
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

  // Navegación real, una vez que ya no hace falta (o ya se confirmó) salir
  // de cambios sin guardar en la ficha clínica.
  const irADestino = (destino) => {
    if (destino !== seccionActiva) {
      const params = new URLSearchParams(window.location.search)
      params.set("seccion", destino)
      // El detalle de una sección (pestaña, paciente abierto, ficha) no viaja a la siguiente.
      PARAMS_DE_SECCION.forEach((k) => params.delete(k))
      window.history.pushState({ seccion: destino }, "", `${window.location.pathname}?${params}`)
    }
    setSeccionActiva(destino)
    setMenuAbierto(false)
    setNotifAbierta(false)
  }

  // Navegación unificada (mapea alias de otros módulos)
  const navegar = (vista) => {
    const mapa = { consulta: "consultas", consultas_opticas: "consultas" }
    const destino = mapa[vista] || vista
    // Único chokepoint de toda navegación por sidebar/Ctrl+K/campanita
    // (ver audit UX, Lote 1, punto 1b) — cubre salir de la ficha clínica
    // con cambios sin guardar sin tener que interceptar cada botón que
    // llama a navegar() por separado.
    if (destino !== seccionActiva && seccionActiva === "consultas" && fichaClinicaCambiosSinGuardar.current) {
      setConfirmSalirFicha(destino)
      return
    }
    irADestino(destino)
  }

  // Único punto de entrada a Ficha clínica, sea desde el perfil de un
  // paciente o desde "Atender" en Citas médicas — centraliza qué debe
  // recordar Dashboard para que "Volver" (a diferencia de "X", que siempre
  // sale a la lista de origen) pueda reabrir el perfil del paciente en vez
  // de aterrizar en la lista pelada.
  const irAFichaClinica = (paciente, { citaId = null, origen = "pacientes", motivo = null } = {}) => {
    // Red de seguridad: atender exige poder crear fichas clínicas. Los botones ya no se muestran sin ese
    // permiso, pero si alguien llega por otro camino ve el motivo en vez de un clic que no hace nada.
    if (!puede(usuario, "consultas", "crear")) { mostrarAviso("No tienes permiso para atender pacientes."); return }
    setFichaClinicaPacienteInicial(paciente)
    setFichaClinicaCitaId(citaId)
    setFichaClinicaOrigen(origen)
    setFichaClinicaPacienteOrigenId(origen === "pacientes" ? paciente?.id ?? null : null)
    // El ing probó "Atender" esperando ver ya puesto el motivo con el que se
    // agendó la cita, en vez de tener que volver a escribirlo en la ficha
    // clínica (ING7) — se resuelve acá porque Dashboard ya tiene `citas`
    // completo, sin tener que hacer viajar el objeto cita entero por Citas.jsx.
    const citaOrigen = citaId ? citas.find((c) => c.id === citaId) : null
    // Con "Atender ahora" (walk-in) la cita se acaba de crear en Citas.jsx y
    // este `citas` todavía es el de antes del alta — el motivo llegaba vacío.
    // Citas.jsx ahora lo manda explícito; la búsqueda queda como respaldo.
    setFichaClinicaMotivoInicial(motivo || citaOrigen?.motivo || null)
    navegar("consultas")
    // La ficha sobrevive a una recargar: se guarda a quién se atiende y desde qué cita.
    if (paciente?.id) escribirParam("ficha", String(paciente.id), { estado: { seccion: "consultas" } })
    if (citaId) escribirParam("fcita", String(citaId), { estado: { seccion: "consultas" } })
  }

  // Recarga dentro de la ficha clínica: se vuelve a poner al paciente y la cita en cuanto cargan los datos.
  const fichaRestaurada = useRef(false)
  useEffect(() => {
    if (fichaRestaurada.current || seccionActiva !== "consultas" || pacientes.length === 0) return
    fichaRestaurada.current = true
    const id = leerParam("ficha")
    if (!id || fichaClinicaPacienteInicial) return
    const paciente = pacientes.find((p) => String(p.id) === id)
    if (!paciente) return
    setFichaClinicaPacienteInicial(paciente)
    setFichaClinicaCitaId(leerParam("fcita"))
    setFichaClinicaOrigen(leerParam("fcita") ? "citas" : "pacientes")
  }, [seccionActiva, pacientes]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // Centro de notificaciones: solo lo que NO está ya en "Requiere tu atención" del Inicio (el stock bajo, las citas, los cumpleaños y los
  // controles viven allí): consultas de soporte, avisos generales y solicitudes de medidas del portal. Cada una según el permiso del rol.
  const alertas = useMemo(() => {
    const arr = []
    if (puede(usuario, "mensajes", "ver")) {
      if (mensajesResumen.abiertas > 0) arr.push({ icon: MessageSquare, color: "#2563eb", bg: "#eff6ff", texto: `${mensajesResumen.abiertas} consulta${mensajesResumen.abiertas > 1 ? "s" : ""} esperando respuesta`, sub: `Le escribiste al equipo de ${NOMBRE_EQUIPO}`, destino: "mensajes" })
      if (mensajesResumen.avisosRecientes > 0) arr.push({ icon: MessageSquare, color: "#b45309", bg: "#fef3c7", texto: `${mensajesResumen.avisosRecientes} aviso${mensajesResumen.avisosRecientes > 1 ? "s" : ""} general${mensajesResumen.avisosRecientes > 1 ? "es" : ""}`, sub: `Publicado por el equipo de ${NOMBRE_EQUIPO}`, destino: "mensajes" })
    }
    // Solicitud de medidas completas desde el portal (migración 0080): el paciente pide ver esfera/cilindro/eje.
    if (puede(usuario, "pacientes", "ver")) {
      const conMedidasPendientes = pacientes.filter((p) => p.medidasSolicitadasEn)
      if (conMedidasPendientes.length) arr.push({ icon: Eye, color: "#2563eb", bg: "#eff6ff", texto: `${conMedidasPendientes.length} solicitud${conMedidasPendientes.length > 1 ? "es" : ""} de medidas completas`, sub: "Un paciente pidió ver su receta completa", destino: "pacientes" })
    }
    return arr
  }, [usuario, pacientes, mensajesResumen])

  const hora = ahoraEcuador().getHours()
  const saludo = hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches"
  const hoyFecha = formatoFecha(ahoraEcuador(), "largo")

  const nombreUsuario = usuario?.nombre || (esAsistente ? "Asistente" : "Administrador")
  const rolUsuario = vistas.length > 1 && vista ? vista.nombre : esAsistente ? (vista?.nombre || "Asistente") : "Administrador"
  const inicialUsuario = nombreUsuario.charAt(0).toUpperCase()

  // Desde el Inicio se bajan en segundo plano los módulos que abren sus atajos, para que el formulario aparezca al instante.
  useEffect(() => {
    if (seccionActiva !== "inicio") return
    const id = setTimeout(() => { import("./Pacientes").catch(() => {}); import("./Citas").catch(() => {}); import("./Inventario").catch(() => {}) }, 300)
    return () => clearTimeout(id)
  }, [seccionActiva])

  // `extra` solo lo usan los atajos de Inicio: montan el formulario de Pacientes/Citas/Inventario encima del Inicio.
  const renderSeccion = (seccion = seccionActiva, extra = {}) => {
    switch (seccion) {
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
            parametrizacion={parametrizacion}
            inventario={inventario}
            setInventario={setInventario}
            categoriasInventario={categoriasInventario}
            setCategoriasInventario={setCategoriasInventario}
            ventas={ventas}
            setVentas={setVentas}
            facturasVenta={facturasVenta}
            setFacturasVenta={setFacturasVenta}
            accionInicial={accionPacienteInicio}
            onAccionInicialConsumida={() => setAccionPacienteInicio(null)}
            onIrAFichaClinica={(paciente, citaId, motivo) => irAFichaClinica(paciente, { citaId, origen: "pacientes", motivo })}
            onAviso={mostrarAviso}
            pases={pases}
            setPases={setPases}
            ordenesLab={ordenesLab}
            setOrdenesLab={setOrdenesLab}
            abonos={abonos}
            equipo={equipo}
            solicitudesEliminacion={solicitudesEliminacion}
            marcarSolicitudEliminacionAtendida={marcarSolicitudEliminacionAtendida}
            marcarMedidasAtendidas={marcarMedidasAtendidas}
            {...extra}
          />
        )
      case "consultas":
        return (
          <ConsultaMedica
            usuario={usuario}
            disponibilidad={disponibilidad}
            pacientes={pacientes}
            setPacientes={setPacientes}
            consultas={consultas}
            setConsultas={setConsultas}
            inventario={inventario}
            setInventario={setInventario}
            setFacturasVenta={setFacturasVenta}
            parametrizacion={parametrizacion}
            diagnosticosRapidos={diagnosticosRapidos}
            motivosConsulta={motivosConsulta}
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
            onCambiosSinGuardarChange={(v) => { fichaClinicaCambiosSinGuardar.current = v }}
            onAviso={mostrarAviso}
            pases={pases}
            setPases={setPases}
          />
        )
      case "ventas":
        return (
          <Ventas
            usuario={usuario}
            cargaInicial={cargaInicialStaff}
            parametrizacion={parametrizacion}
            pacientes={pacientes}
            consultas={consultas}
            inventario={inventario}
            setInventario={setInventario}
            categoriasInventario={categoriasInventario}
            setCategoriasInventario={setCategoriasInventario}
            ventas={ventas}
            facturasVenta={facturasVenta}
            setFacturasVenta={setFacturasVenta}
            pases={pases}
            setPases={setPases}
            ordenesLab={ordenesLab}
            setOrdenesLab={setOrdenesLab}
            abonos={abonos}
            equipo={equipo}
            accionInicial={accionVentasInicio}
            onAccionInicialConsumida={() => setAccionVentasInicio(null)}
            onVerPaciente={(pacienteId) => { setAccionPacienteInicio({ pacienteId, accion: "historial" }); navegar("pacientes") }}
            onAviso={mostrarAviso}
          />
        )
      case "inventario":
        return (
          <Inventario
            usuario={usuario}
            umbralStock={umbralStock(parametrizacion)}
            cargaInicial={cargaInicialStaff}
            inventario={inventario}
            setInventario={setInventario}
            categorias={categoriasInventario}
            setCategorias={setCategoriasInventario}
            pacientes={pacientes}
            ventas={ventas}
            setVentas={setVentas}
            facturasVenta={facturasVenta}
            setFacturasVenta={setFacturasVenta}
            abrirModalAlEntrar={abrirCrearProductoAlEntrar}
            onModalAlEntrarConsumido={() => setAbrirCrearProductoAlEntrar(false)}
            productoIdParaReabastecer={productoIdParaReabastecer}
            onProductoParaReabastecerConsumido={() => setProductoIdParaReabastecer(null)}
            verStockBajoAlEntrar={verStockBajoAlEntrar}
            onVerStockBajoConsumido={() => setVerStockBajoAlEntrar(false)}
            onVerPerfil={(pacienteId) => { setAccionPacienteInicio({ pacienteId, accion: "historial" }); navegar("pacientes") }}
            onAviso={mostrarAviso}
            {...extra}
          />
        )
      case "citas":
        return (
          <Citas
            usuario={usuario}
            setDisponibilidad={setDisponibilidad}
            cargaInicial={cargaInicialStaff}
            citas={citas}
            setCitas={setCitas}
            pacientes={pacientes}
            setPacientes={setPacientes}
            consultas={consultas}
            disponibilidad={disponibilidad}
            abrirModalAlEntrar={abrirAgendarAlEntrar}
            onModalAlEntrarConsumido={() => setAbrirAgendarAlEntrar(false)}
            vistaPropia={alcanceDeVista("citas") === "propio"}
            estadoInicial={estadoCitasInicial}
            onEstadoInicialConsumido={() => setEstadoCitasInicial(null)}
            atenderCitaId={citaParaAtender}
            onAtenderCitaConsumido={() => setCitaParaAtender(null)}
            motivosConsulta={motivosConsulta}
            inventario={inventario}
            setInventario={setInventario}
            facturasVenta={facturasVenta}
            setFacturasVenta={setFacturasVenta}
            parametrizacion={parametrizacion}
            equipo={equipo}
            onAviso={mostrarAviso}
            onAtender={(paciente, citaId, motivo) => irAFichaClinica(paciente, { citaId, origen: "citas", motivo })}
            onVerPerfil={(pacienteId) => { setAccionPacienteInicio({ pacienteId, accion: "historial" }); navegar("pacientes") }}
            {...extra}
          />
        )
      case "horario":
        return <Horario usuario={usuario} disponibilidad={disponibilidad} setDisponibilidad={setDisponibilidad} horarioPersonal={horarioPersonal} setHorarioPersonal={setHorarioPersonal} citas={citas} equipo={equipo} />
      case "crm":
        return <CRM usuario={usuario} pacientes={pacientes} consultas={consultas} parametrizacion={parametrizacion} setParametrizacion={setParametrizacion} onVerPerfil={(pacienteId) => { setAccionPacienteInicio({ pacienteId, accion: "historial" }); navegar("pacientes") }} />
      case "reportes":
        return <Reportes usuario={usuario} soloLoPropio={alcanceDeVista("reportes") === "propio"} cargaInicial={cargaInicialStaff} pacientes={pacientesReportes} consultas={consultasReportes} consultasCompletas={consultas} citas={citasReportes} ventas={ventas} facturasVenta={facturasVenta} respuestasSatisfaccion={respuestasReportes} pases={pasesReportes} abonos={abonos} ordenesLab={ordenesReportes} verMontos={verMontosReportes} />
      case "mensajes":
        return <Mensajes usuario={usuario} />
      case "usuarios":
        return <Usuarios usuario={usuario} asistentes={asistentes} setAsistentes={setAsistentes} alActualizarUsuario={alActualizarUsuario} />
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
            disponibilidad={disponibilidad}
            puedeReasignarCitas={puedeReasignar(usuario, alcanceDeVista("citas"))}
            setPacientes={setPacientes}
            onVerPacientes={(filtro) => { setAccionPacienteInicio({ accion: "filtrar", ...filtro }); navegar("pacientes") }}
            umbralStock={umbralStock(parametrizacion)}
            equipo={equipo}
            setCitas={setCitas}
            onAviso={mostrarAviso}
            onAtenderCita={(cita) => {
              const paciente = pacientes.find((p) => p.id === cita.pacienteId)
              if (paciente) irAFichaClinica(paciente, { citaId: cita.id, origen: "citas", motivo: cita.motivo })
              else navegar("citas")
            }}
            setVista={navegar}
            usuario={usuario}
            opticaActiva={opticaActiva}
            cargaInicial={cargaInicialStaff}
            nombreUsuario={nombreUsuario}
            opticaNombre={usuario?.opticaNombre}
            pacientes={pacientes}
            citas={citas}
            inventario={inventario}
            consultas={consultas}
            ordenesLab={ordenesLab}
            vista={vista}
            pases={pases}
            facturasVenta={facturasVenta}
            abonos={abonos}
            onVerCola={() => { setAccionVentasInicio({ tab: "cola" }); navegar("ventas") }}
            onAtenderEnCitas={(cita) => { setCitaParaAtender(cita.id); navegar("citas") }}
            onVerCitas={(estado, periodo) => { setEstadoCitasInicial(periodo ? { estado, periodo } : estado); navegar("citas") }}
            onVerOrdenes={(filtro) => { setAccionVentasInicio({ tab: "ordenes", filtro }); navegar("ventas") }}
            onVerSaldos={() => { setAccionVentasInicio({ tab: "saldos" }); navegar("ventas") }}
            onVerStockBajo={() => { setVerStockBajoAlEntrar(true); navegar("inventario") }}
            onVerPerfilPaciente={(pacienteId) => { setAccionPacienteInicio({ pacienteId, accion: "historial" }); navegar("pacientes") }}
            onAgendarRapido={() => { setControlParaAgendar(null); setAtajoInicio("citas") }}
            onAgendarControl={(paciente, fecha, asignadoA) => { setControlParaAgendar({ pacienteId: paciente.id, fecha, asignadoA }); setAtajoInicio("citas") }}
            onReagendarCancelada={(cita) => { setControlParaAgendar({ pacienteId: cita.pacienteId, fecha: cita.fecha, asignadoA: cita.asignadoA || "", motivo: cita.motivo || "" }); setAtajoInicio("citas") }}
            onCrearPacienteRapido={() => setAtajoInicio("pacientes")}
            onCrearProductoRapido={() => setAtajoInicio("inventario")}
            onReabastecerProducto={(productoId) => {
              setProductoIdParaReabastecer(productoId)
              navegar("inventario")
            }}
          />
        )
      default:
        return (
          <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-slate-200/60 bg-white p-6">
            <div className="text-center">
              <p className="text-lg text-slate-500">Sección en desarrollo</p>
              <h3 className="mt-1 text-2xl font-bold uppercase text-blue-600">{seccionActiva}</h3>
            </div>
          </div>
        )
    }
  }

  // Accesibilidad de modales (audit UX, Lote 1, punto 1c)
  const refModalMiCuenta = useModalAccesible(modalMiCuentaAbierto, () => setModalMiCuentaAbierto(false))

  return (
    <div className="flex h-screen bg-slate-50 font-sans">
      {/* Backdrop móvil */}
      {menuAbierto && <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setMenuAbierto(false)} />}

      {/* ─── SIDEBAR ─── */}
      <aside
        className={
          "fixed inset-y-0 left-0 z-50 flex w-72 flex-col justify-between overflow-hidden border-r border-slate-200/70 bg-slate-50/80 transition-all duration-300 lg:static lg:translate-x-0 " +
          (colapsado ? "lg:w-20 " : "lg:w-72 ") +
          (menuAbierto ? "translate-x-0" : "-translate-x-full")
        }
      >
        {/* Toque de marca — sutil, pensado para fondo claro (antes eran anillos
            blancos al 5% pensados para el fondo oscuro anterior, invisibles
            acá). */}
        <div className="pointer-events-none absolute -left-24 top-1/4 h-56 w-56 rounded-full blur-3xl" style={{ background: "radial-gradient(circle, rgba(37,99,235,0.06), transparent 70%)" }} />

        <div className="sidebar-scroll relative z-10 min-h-0 flex-1 overflow-y-auto">
          <div className={"flex min-w-0 items-center justify-between border-b border-slate-200/70 px-6 py-5 " + (colapsado ? "lg:justify-center lg:px-0" : "")}>
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-white" style={{ background: GRAD, boxShadow: "0 10px 24px -8px rgba(34,211,238,0.6)" }}>
                <Eye size={22} strokeWidth={2.2} />
              </div>
              <div className={"min-w-0 leading-tight " + (colapsado ? "lg:hidden" : "")}>
                <p className="truncate text-lg font-bold tracking-tight text-slate-900">
                  {usuario?.opticaNombre || "Mi Óptica"}
                </p>
                <p className="text-[11px] font-medium tracking-wide text-slate-500">PANEL DE CONTROL</p>
              </div>
            </div>
            <button type="button" onClick={() => setMenuAbierto(false)} aria-label="Cerrar menú" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 lg:hidden cursor-pointer">
              <X size={20} />
            </button>
          </div>

          <nav className="space-y-1.5 px-4 py-6">
            <p className={"mb-2 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400 " + (colapsado ? "lg:hidden" : "")}>Menú principal</p>
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
                  className={"group relative flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all cursor-pointer " + (colapsado ? "lg:justify-center lg:px-0 " : "") + (activo ? "text-white shadow-md shadow-blue-500/20" : "bg-transparent text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm")}
                  style={activo ? { background: GRAD } : undefined}
                >
                  <Icono size={20} className={activo ? "text-white" : "text-slate-500 group-hover:text-slate-900"} />
                  <span className={colapsado ? "lg:hidden" : ""}>{opcion.nombre}</span>
                  {/* Pacientes listos para venta (R35) y órdenes por atender: se ven sobre el módulo de Ventas. */}
                  {opcion.id === "ventas" && avisosVentas > 0 && (
                    <span
                      title={textoAvisosVentas}
                      aria-label={textoAvisosVentas}
                      className={"ml-auto grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold " + (activo ? "bg-white text-blue-700" : "bg-emerald-600 text-white") + (colapsado ? " lg:absolute lg:right-1 lg:top-1 lg:ml-0 lg:h-4 lg:min-w-4 lg:px-1 lg:text-[10px]" : "")}
                    >
                      {avisosVentas}
                    </span>
                  )}
                  {activo && <span className={(opcion.id === "ventas" && avisosVentas > 0 ? "ml-1.5 " : "ml-auto ") + "h-1.5 w-1.5 rounded-full bg-white/80 " + (colapsado ? "lg:hidden" : "")} />}
                </button>
              )
            })}
          </nav>
        </div>

        <div className="relative z-10 space-y-3 border-t border-slate-200/70 p-4">
          {/* Widget de perfil — tarjeta blanca nítida flotando sobre el fondo
              slate del sidebar (antes bg-slate-50/80 sobre bg-slate-50/80: se
              fundía con el fondo y perdía la sensación de "tarjeta"). Pedido
              explícito: iniciales/avatar, nombre completo y rol, siempre
              visible al pie. Reutiliza el mismo modal "Mi cuenta" que ya abre
              el menú de usuario de la barra superior, en vez de duplicar un
              segundo menú desplegable con las mismas dos acciones. */}
          <button
            type="button"
            onClick={() => setModalMiCuentaAbierto(true)}
            title={colapsado ? `${nombreUsuario} · ${rolUsuario}` : undefined}
            className={"flex w-full items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 text-left shadow-sm transition-shadow hover:shadow-md cursor-pointer " + (colapsado ? "lg:justify-center lg:px-0" : "")}
          >
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold text-white" style={{ background: GRAD }}>{inicialUsuario}</div>
            <div className={"min-w-0 flex-1 " + (colapsado ? "lg:hidden" : "")}>
              <p className="truncate text-sm font-bold text-slate-800">{nombreUsuario}</p>
              <p className="flex items-center gap-1.5 truncate text-[11px] font-medium text-slate-500">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" /> {rolUsuario}
              </p>
            </div>
          </button>

          <div className={"flex items-center gap-2 px-2 text-[11px] font-medium text-slate-400 " + (colapsado ? "lg:justify-center lg:px-0" : "")}>
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
                {saludo}, {nombreUsuario}
              </p>
              <p className="truncate text-xs text-slate-500">{hoyFecha}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Notificaciones */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setNotifAbierta((v) => !v)}
                className="relative grid h-10 w-10 place-items-center rounded-xl border border-slate-200/60 bg-white text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer"
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
                <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-2xl">
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
                className="flex items-center gap-2.5 rounded-xl border border-slate-200/60 bg-white py-1.5 pl-1.5 pr-2.5 transition-colors hover:bg-slate-50 cursor-pointer"
              >
                <div className="grid h-7 w-7 place-items-center rounded-lg text-xs font-bold text-white" style={{ background: GRAD }}>{inicialUsuario}</div>
                <div className="hidden text-left leading-tight sm:block">
                  <p className="text-sm font-semibold" style={{ color: INK }}>{nombreUsuario}</p>
                  <p className="text-[10px] text-slate-500">{rolUsuario}</p>
                </div>
                <ChevronDown size={16} className={"text-slate-500 transition-transform " + (userMenuAbierto ? "rotate-180" : "")} />
              </button>

              {userMenuAbierto && (
                <div className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-2xl">
                  <div className="flex items-center gap-3 border-b border-slate-100 p-4">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: GRAD }}>{inicialUsuario}</div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold" style={{ color: INK }}>{nombreUsuario}</p>
                      <p className="flex items-center gap-1.5 text-xs text-slate-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> {rolUsuario}
                      </p>
                    </div>
                  </div>
                  {vistas.length > 1 && (
                    <div className="border-b border-slate-100 p-2" role="group" aria-label="Vista">
                      <p className="px-3 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Vista</p>
                      {vistas.map((v) => (
                        <button
                          key={v.id}
                          type="button"
                          role="menuitemradio"
                          aria-checked={vista?.id === v.id}
                          onClick={() => { cambiarVista(v.id); setUserMenuAbierto(false) }}
                          className={"flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors cursor-pointer " + (vista?.id === v.id ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50")}
                        >
                          <span className={"grid h-4 w-4 shrink-0 place-items-center rounded-full border " + (vista?.id === v.id ? "border-blue-600 bg-blue-600" : "border-slate-300")}>{vista?.id === v.id && <span className="h-1.5 w-1.5 rounded-full bg-white" />}</span>
                          {v.nombre}
                        </button>
                      ))}
                    </div>
                  )}
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

        {/* Espacio de trabajo. El perfil de paciente a pantalla completa se ancla aquí (Pacientes.jsx lo porta a #vista-completa-root):
            cubre el espacio de trabajo pero deja a la vista la barra de arriba (campanita y usuario). */}
        <div className="relative flex min-h-0 flex-1 flex-col">
        <div id="vista-completa-root" />
        <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-gutter:stable] p-4 sm:p-6 lg:p-8 pt-3 sm:pt-3 lg:pt-4">
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
                <p className="text-xs text-red-700">Ya no puedes ver ni modificar pacientes, citas, inventario ni el resto de los datos. Contacta a soporte si esto es un error.</p>
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
            <div role="alert" className="mb-4 flex items-start gap-3 rounded-2xl border border-red-200/60 bg-red-50 p-4">
              <AlertTriangle size={18} className="mt-0.5 shrink-0 text-red-500" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-red-800">No se pudo cargar: {erroresCarga.join(", ")}.</p>
                <p className="text-xs text-red-600">Puede que la información que ves esté vieja o incompleta. Revisa tu conexión e intenta recargar la página.</p>
              </div>
              <button type="button" onClick={() => window.location.reload()} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-red-200/60 bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 cursor-pointer">
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
          {/* Con su propio Suspense (sin cargador): si el módulo aún se está bajando, el Inicio se queda tal cual en vez de taparse con un spinner. */}
          <Suspense fallback={null}>
            {seccionActiva === "inicio" && atajoInicio && renderSeccion(atajoInicio, {
              overlaySolo: true,
              onOverlayCerrado: () => { setAtajoInicio(null); setControlParaAgendar(null) },
              ...(atajoInicio === "citas" && controlParaAgendar ? { controlParaAgendar } : {}),
              ...(atajoInicio === "pacientes" ? { accionInicial: ACCION_CREAR_PACIENTE, onAccionInicialConsumida: () => {} } : { abrirModalAlEntrar: true, onModalAlEntrarConsumido: () => {} }),
            })}
          </Suspense>
          {aviso && (
            <div role="status" className="fixed bottom-6 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-3 rounded-xl border border-slate-200/60 bg-white px-4 py-3 text-sm font-semibold shadow-xl" style={{ color: INK, animation: "rise-in 240ms ease-out both" }}>
              {aviso.texto ?? aviso}
              {aviso.accion && (
                <button
                  type="button"
                  onClick={() => { const accion = aviso.accion.onClick; setAviso(null); clearTimeout(timeoutAviso.current); accion() }}
                  className="rounded-md px-2 py-0.5 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 cursor-pointer"
                >
                  {aviso.accion.etiqueta}
                </button>
              )}
            </div>
          )}
        </div>
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
            ref={refModalMiCuenta}
            role="dialog"
            aria-modal="true"
            aria-labelledby="dashboard-modal-micuenta-titulo"
            className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-2xl"
            style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)", willChange: "transform, opacity" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: GRAD }}>
                  <Settings size={20} />
                </div>
                <div>
                  <h4 id="dashboard-modal-micuenta-titulo" className="text-lg font-bold" style={{ color: INK }}>Mi cuenta</h4>
                  <p className="text-xs text-slate-500">{nombreUsuario} · {rolUsuario}</p>
                </div>
              </div>
              <button type="button" onClick={() => setModalMiCuentaAbierto(false)} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 cursor-pointer">
                <X size={20} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-5">
              <div className="mb-5 space-y-2 rounded-xl border border-slate-200/60 p-4">
                <label htmlFor="registroProfesional" className="block text-sm font-bold" style={{ color: INK }}>
                  Número de registro profesional <span className="font-normal text-slate-400">(opcional)</span>
                </label>
                <p className="text-xs text-slate-500">Si atiendes pacientes tú mismo, aparece en el "Reg. Prof." de la receta impresa de las consultas que guardes.</p>
                <div className="flex items-center gap-2">
                  <input
                    id="registroProfesional"
                    type="text"
                    value={campoRegistroProfesional}
                    onChange={(e) => setCampoRegistroProfesional(e.target.value)}
                    onBlur={guardarRegistroProfesional}
                    placeholder="Ej. SENESCYT-1234567890"
                    className="w-full rounded-lg border border-slate-200/60 bg-slate-50 px-3 py-2 text-sm outline-none transition focus-visible:border-blue-500 focus-visible:bg-white"
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

      {confirmSalirFicha && (
        <ConfirmarEliminarModal
          titulo="¿Salir de la ficha clínica?"
          mensaje="Tienes cambios sin guardar en la ficha clínica. Si sales ahora, se van a perder."
          etiquetaConfirmar="Salir de todas formas"
          onCancelar={() => setConfirmSalirFicha(null)}
          onConfirmar={() => {
            const destino = confirmSalirFicha
            fichaClinicaCambiosSinGuardar.current = false
            setConfirmSalirFicha(null)
            irADestino(destino)
          }}
        />
      )}
    </div>
  )
}
