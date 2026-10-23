"use client"

import { etiquetaEstadoCita } from "../utilidades/estadosCita"
import CampoHora from "../componentes/CampoHora"
import { horaSinCero } from "../utilidades/formatoFecha"
import { ahoraEcuador } from "../utilidades/horaEcuador"

import { useEffect, useMemo, useRef, useState } from "react"
import { useParamUrl } from "../utilidades/urlEstado"
import {
  Clock,
  CalendarClock,
  Sun,
  Moon,
  CalendarDays,
  CheckCircle2,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Info,
  AlertTriangle,
  User,
  Lock,
} from "lucide-react"
import {
  DIAS_SEMANA, ETIQUETAS_DIA, fechaAISO, hoyISO, horarioEfectivo, diaAbierto, horaA12,
  parseFechaFlexible, esHoy as esFechaHoy, esFutura, minutosDesdeMedianoche, minutosDesde24h,
  slotsDisponibles, citasQueBloqueanCierre, mensajeCierreBloqueado, nombreDeDiaCerrado,
} from "../utilidades/disponibilidad"
import { registrarLog } from "../utilidades/logs"
import { puede } from "../utilidades/permisosUi"
import { puedeNivel } from "../utilidades/roles"
import CampoFecha from "../componentes/CampoFecha"
import HorariosPersonal from "../componentes/horario/HorariosPersonal"
import MiHorario from "../componentes/horario/MiHorario"
import AusenciasAdmin from "../componentes/horario/AusenciasAdmin"
import { useDatosPersonal } from "../componentes/horario/useDatosPersonal"
import { Pestanas } from "../componentes/ventas/Piezas"
import TablaSkeleton from "../componentes/TablaSkeleton"
import { miembrosActivos } from "../utilidades/equipo"
import { esAdministrador } from "../utilidades/comunicacionInterna"
import { Cascaron } from "../componentes/AtencionPaciente"
import { INK } from "@/lib/tema"
import AvisoFlotante, { DURACION_AVISO_MS } from "../componentes/AvisoFlotante"
import { fechaLegible as fechaFormato, formatoFecha } from "../utilidades/formatoFecha"

// ─── Paleta de firma (consistente con el resto del sistema) ───
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)"
const DIAS_CORTOS = ["L", "M", "X", "J", "V", "S", "D"]
const ORDEN_LV = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"]

// Mismos colores por estado que usa Citas.jsx, en versión badge compacta
// para la lista de "Citas registradas" del modal de excepción de horario.
const ESTADO_BADGE_CLASE = {
  "Atendida": "bg-emerald-50 text-emerald-600",
  "No Asistió": "bg-red-50 text-red-600",
  "Cancelada": "bg-slate-100 text-slate-500",
  "En Atención": "bg-blue-50 text-blue-600",
  "Pendiente": "bg-amber-50 text-amber-600",
}

// Texto legible de un horario de dos sesiones — reemplaza al viejo "inicio–fin"
// plano ahora que cada día puede tener mañana y tarde por separado.
const resumenHorario = (horario) => {
  const partes = []
  if (horario?.manana?.activo) partes.push(`${horaA12(horario.manana.inicio)} – ${horaA12(horario.manana.fin)}`)
  if (horario?.tarde?.activo) partes.push(`${horaA12(horario.tarde.inicio)} – ${horaA12(horario.tarde.fin)}`)
  return partes.length ? partes.join(" y ") : "Cerrado"
}

const textoAbiertoPor = (exc) => (exc?.abiertoPor?.nombre ? `Abierto por ${exc.abiertoPor.nombre}${exc.abiertoPor.en ? ` el ${formatoFecha(exc.abiertoPor.en.slice(0, 10), "medio")}` : ""}` : "")


export default function Horario({ usuario, disponibilidad, setDisponibilidad, citas = [], setCitas, equipo = [], onCambioAgenda, onReagendarCita }) {
  const hoy = hoyISO()
  // En la vista de otro rol el administrador ve lo que vería esa persona.
  const esAdmin = esAdministrador(usuario)
  // Editar el horario general de la óptica, sus días cerrados y la duración de las citas: el administrador o quien tenga "Horario de la óptica: editar" (la base lo exige igual).
  const puedeH = (modulo, nivel) => (usuario?.enVistaDeRol ? puedeNivel(usuario.permisosNivel, modulo, nivel) : puede(usuario, modulo, nivel))
  const puedeEditarHorario = esAdmin || puedeH("horario_optica", "editar")
  const veGeneral = puedeEditarHorario || puedeH("horario_optica", "ver")
  // Lo que se ve (Ronda 5): el administrador, el horario de la óptica, los horarios del personal y las ausencias; el resto, su propio horario (de solo lectura: lo asigna la administración) y, si puede, el de la óptica de referencia.
  const vistas = esAdmin ? ["general", "equipo", "ausencias"] : ["mi", ...(veGeneral ? ["general"] : [])]
  const [tabUrl, setTab] = useParamUrl("tab", vistas[0], ["general", "equipo", "ausencias", "mi", "personal"])
  const vista = tabUrl === "personal" ? (esAdmin ? "equipo" : "mi") : vistas.includes(tabUrl) ? tabUrl : vistas[0]
  const datos = useDatosPersonal({ usuario, esAdmin, onCambioAgenda })
  const miembros = useMemo(() => miembrosActivos(equipo), [equipo])
  const esProfesional = Boolean(equipo.find((m) => m.id === usuario?.id)?.esOptometra)
  const pendientes = datos.ausencias.filter((a) => a.estado === "pendiente").length
  const rolDe = (m) => (m.rol === "admin" ? "Administrador" : datos.rolesDe[m.id]?.length ? datos.rolesDe[m.id].join(" · ") : m.esOptometra ? "Optómetra" : "Personal")
  const [avisoTexto, setAvisoTexto] = useState("")
  const avisar = (msg, tipo) => (tipo === "error" ? mostrarError(msg) : mostrarGuardado(msg))
  const [mesVista, setMesVista] = useState(new Date(ahoraEcuador().getFullYear(), ahoraEcuador().getMonth(), 1))
  const [fechaEditando, setFechaEditando] = useState(null)
  // Citas que quedarían fuera del horario si se aplica un cambio pendiente —
  // antes cerrar un día o acortar el horario no avisaba nada, el paciente
  // seguía "agendado" pero esa cita ya no cabía en ningún horario real.
  const [avisoConflicto, setAvisoConflicto] = useState(null)

  // Confirmación visual breve tras guardar (horario semanal con su botón, o
  // una excepción puntual que sigue aplicándose al instante desde su modal).
  // Antes esto era un useEffect atado a `disponibilidad` completo: se disparaba
  // también cuando ese objeto llegaba/cambiaba por la carga inicial desde
  // Supabase (sin que el admin hubiera tocado nada), mostrando "Cambios
  // guardados" al simple abrir la pantalla. Ahora se dispara explícitamente
  // solo desde las funciones que de verdad guardan (aplicarHorarioSemanal,
  // aplicarExcepcion, quitarExcepcion).
  const [guardadoVisible, setGuardadoVisible] = useState(false)
  const [errorGuardar, setErrorGuardar] = useState("")
  const [guardando, setGuardando] = useState(false)
  const timeoutGuardadoRef = useRef(null)
  const mostrarGuardado = (texto = "") => {
    setAvisoTexto(texto)
    setGuardadoVisible(true)
    clearTimeout(timeoutGuardadoRef.current)
    timeoutGuardadoRef.current = setTimeout(() => setGuardadoVisible(false), DURACION_AVISO_MS)
  }
  useEffect(() => () => clearTimeout(timeoutGuardadoRef.current), [])

  // Toast de error compartido para las acciones que no tienen su propio
  // banner (excepciones puntuales, ausencias) — mismo mecanismo que
  // mostrarGuardado, visible desde cualquiera de las dos pestañas.
  const [errorAccion, setErrorAccion] = useState("")
  const timeoutErrorRef = useRef(null)
  const mostrarError = (mensaje) => {
    setErrorAccion(mensaje)
    clearTimeout(timeoutErrorRef.current)
    timeoutErrorRef.current = setTimeout(() => setErrorAccion(""), DURACION_AVISO_MS + 1000)
  }
  useEffect(() => () => clearTimeout(timeoutErrorRef.current), [])

  // El horario semanal habitual ya NO se guarda solo al tocar un switch u
  // hora — se edita en un borrador local y solo se aplica (persiste en
  // Supabase) al presionar "Guardar cambios". Evita escribir en la base de
  // datos en cada clic mientras el administrador todavía está decidiendo.
  const [borradorHorario, setBorradorHorario] = useState(disponibilidad.horarioSemanal)
  useEffect(() => {
    setBorradorHorario(disponibilidad.horarioSemanal)
  }, [disponibilidad.horarioSemanal])
  const hayCambiosSinGuardar = useMemo(
    () => JSON.stringify(borradorHorario) !== JSON.stringify(disponibilidad.horarioSemanal),
    [borradorHorario, disponibilidad.horarioSemanal],
  )
  const actualizarBorrador = (dia, sesion, cambios) => {
    setBorradorHorario((prev) => ({
      ...prev,
      [dia]: { ...prev[dia], [sesion]: { ...prev[dia][sesion], ...cambios } },
    }))
  }
  const descartarCambiosHorario = () => setBorradorHorario(disponibilidad.horarioSemanal)

  // Cada día del horario semanal es colapsable — por defecto solo el día de
  // hoy aparece expandido, así los otros 6 no ocupan pantalla mientras no se
  // están editando. Qué días quedaron abiertos se recuerda entre recargas
  // (mismo patrón que 'optica_seccion_activa' en Dashboard.jsx).
  const [diasAbiertos, setDiasAbiertos] = useState(() => {
    try {
      const guardado = JSON.parse(localStorage.getItem("optica_horario_dias_abiertos"))
      if (Array.isArray(guardado)) return new Set(guardado)
    } catch {}
    return new Set([DIAS_SEMANA[ahoraEcuador().getDay()]])
  })
  useEffect(() => {
    localStorage.setItem("optica_horario_dias_abiertos", JSON.stringify([...diasAbiertos]))
  }, [diasAbiertos])
  const alternarDiaAbierto = (dia) => setDiasAbiertos((prev) => {
    const siguiente = new Set(prev)
    if (siguiente.has(dia)) siguiente.delete(dia)
    else siguiente.add(dia)
    return siguiente
  })

  // Citas de hoy en adelante que todavía necesitan atenderse (no canceladas del
  // sistema, no ya resueltas), agrupadas por día de la semana.
  const citasActivasPorDiaSemana = useMemo(() => {
    const mapa = {}
    DIAS_SEMANA.forEach((d) => { mapa[d] = [] })
    citas.forEach((c) => {
      if (!c.fecha) return
      if (c.estado === "Atendida" || c.estado === "No Asistió" || c.estado === "Cancelada") return
      if (!(esFechaHoy(c.fecha) || esFutura(c.fecha))) return
      const fechaObj = parseFechaFlexible(c.fecha)
      if (!fechaObj) return
      mapa[DIAS_SEMANA[fechaObj.getDay()]].push(c)
    })
    return mapa
  }, [citas])

  const citaFueraDeHorario = (cita, horario) => {
    const min = minutosDesdeMedianoche(cita.hora)
    const dentroDeSesion = (sesion) => sesion?.activo && min >= minutosDesde24h(sesion.inicio) && min < minutosDesde24h(sesion.fin)
    return !(dentroDeSesion(horario.manana) || dentroDeSesion(horario.tarde))
  }

  // Al presionar "Guardar cambios": revisa TODOS los días que cambiaron en el
  // borrador (no solo el último tocado) contra las citas ya agendadas, y
  // recién ahí persiste — mismo chequeo que antes hacía por cada clic, pero
  // una sola vez para el conjunto completo de cambios pendientes.
  const guardarHorarioSemanal = () => {
    const afectadas = []
    ORDEN_LV.forEach((dia) => {
      if (JSON.stringify(borradorHorario[dia]) === JSON.stringify(disponibilidad.horarioSemanal[dia])) return
      ;(citasActivasPorDiaSemana[dia] || [])
        .filter((c) => !disponibilidad.excepciones?.[c.fecha])
        .filter((c) => citaFueraDeHorario(c, borradorHorario[dia]))
        .forEach((c) => afectadas.push(c))
    })
    if (afectadas.length > 0) {
      setAvisoConflicto({ citas: afectadas, aplicar: aplicarHorarioSemanal })
      return
    }
    aplicarHorarioSemanal()
  }
  const aplicarHorarioSemanal = async () => {
    setGuardando(true)
    const { error } = await setDisponibilidad((prev) => ({ ...prev, horarioSemanal: borradorHorario }))
    setGuardando(false)
    if (error) {
      setErrorGuardar("No se pudo guardar el horario. Revisa tu conexión e intenta de nuevo.")
      return
    }
    setErrorGuardar("")
    mostrarGuardado()
    // Este cambio afecta directamente qué horarios ve el público y el
    // personal para agendar — antes no dejaba ningún rastro en "Actividad
    // reciente" (Inicio.jsx), a pesar de que ese módulo ya existía
    // justamente para responder "qué cambió" (Séptima Mirada). "horario" ya
    // estaba registrado en NOMBRE_MODULO sin que nada lo llamara nunca.
    registrarLog(usuario, "horario", "Actualizó el horario semanal de la óptica")
  }

  // Hallazgo B6: "Duración de cada cita" guardaba en Supabase en cada tecla
  // sin ningún botón ni confirmación — mismo bug de UX que ya se corrigió
  // una vez (autoguardado invisible se lee como botón faltante), reaparecido
  // acá. Mismo patrón que el horario semanal arriba: borrador local + botón
  // explícito "Guardar" + confirmación visible.
  const [borradorDuracion, setBorradorDuracion] = useState(disponibilidad.duracionCita)
  useEffect(() => {
    setBorradorDuracion(disponibilidad.duracionCita)
  }, [disponibilidad.duracionCita])
  const [guardandoDuracion, setGuardandoDuracion] = useState(false)
  const [errorDuracion, setErrorDuracion] = useState("")
  const guardarDuracion = async () => {
    setGuardandoDuracion(true)
    const { error } = await setDisponibilidad((prev) => ({ ...prev, duracionCita: borradorDuracion }))
    setGuardandoDuracion(false)
    if (error) {
      setErrorDuracion("No se pudo guardar. Revisa tu conexión e intenta de nuevo.")
      return
    }
    setErrorDuracion("")
    mostrarGuardado()
    registrarLog(usuario, "horario", "Cambió la duración de cada cita", `${borradorDuracion} min`)
  }

  const dias = useMemo(() => {
    const primerDia = new Date(mesVista.getFullYear(), mesVista.getMonth(), 1)
    const ultimoDia = new Date(mesVista.getFullYear(), mesVista.getMonth() + 1, 0)
    const offset = (primerDia.getDay() + 6) % 7
    const arr = []
    for (let i = 0; i < offset; i++) arr.push(null)
    for (let n = 1; n <= ultimoDia.getDate(); n++) {
      const d = new Date(mesVista.getFullYear(), mesVista.getMonth(), n)
      const iso = fechaAISO(d)
      arr.push({ numero: n, iso, pasado: iso < hoy })
    }
    return arr
  }, [mesVista, hoy])

  const excepcionesOrdenadas = useMemo(() => {
    return Object.entries(disponibilidad.excepciones || {})
      .filter(([iso]) => iso >= hoy)
      .sort(([a], [b]) => (a < b ? -1 : 1))
  }, [disponibilidad.excepciones, hoy, puedeEditarHorario, usuario?.id])

  const excepcionActual = fechaEditando ? disponibilidad.excepciones?.[fechaEditando] : null
  const horarioBaseFecha = fechaEditando
    ? disponibilidad.horarioSemanal[DIAS_SEMANA[new Date(fechaEditando + "T00:00:00").getDay()]]
    : null

  const aplicarExcepcion = async (fecha, cambios) => {
    const { error } = await setDisponibilidad((prev) => ({ ...prev, excepciones: { ...prev.excepciones, [fecha]: cambios } }))
    if (error) {
      mostrarError("No se pudo guardar la excepción. Revisa tu conexión e intenta de nuevo.")
      return
    }
    setFechaEditando(null)
    mostrarGuardado()
    registrarLog(usuario, "horario", diaAbierto(cambios) ? "Agregó un horario extra puntual" : "Cerró un día puntual", `${fecha}${cambios.nombre ? ` · ${cambios.nombre}` : ""}`)
  }

  const guardarExcepcion = (datos) => {
    const previa = disponibilidad.excepciones?.[fechaEditando] || {}
    const cambios = { ...previa, ...datos }
    delete cambios.reservasWeb // ya no existe: un día abierto por excepción es siempre solo para el personal
    if (diaAbierto(cambios) || !String(cambios.nombre || "").trim()) delete cambios.nombre
    else cambios.nombre = String(cambios.nombre).trim()
    const habiaAbierto = diaAbierto(previa) || diaAbierto(horarioBaseFecha)
    if (diaAbierto(cambios) && !habiaAbierto) cambios.abiertoPor = { id: usuario?.id || null, nombre: usuario?.nombre || "", en: new Date().toISOString() }
    if (!diaAbierto(cambios)) {
      const bloquean = citasQueBloqueanCierre(citas, fechaEditando)
      if (bloquean.length > 0) { mostrarError(mensajeCierreBloqueado(bloquean.length)); setFechaEditando(null); return }
    }
    const afectadas = citas.filter((c) => {
      if (c.fecha !== fechaEditando) return false
      if (c.estado === "Atendida" || c.estado === "No Asistió" || c.estado === "Cancelada") return false
      return citaFueraDeHorario(c, cambios)
    })
    if (afectadas.length > 0) {
      setAvisoConflicto({ citas: afectadas, aplicar: () => aplicarExcepcion(fechaEditando, cambios) })
      return
    }
    aplicarExcepcion(fechaEditando, cambios)
  }

  const quitarExcepcion = async () => {
    const fecha = fechaEditando
    if (!diaAbierto(horarioBaseFecha)) {
      const bloquean = citasQueBloqueanCierre(citas, fecha)
      if (bloquean.length > 0) { mostrarError(mensajeCierreBloqueado(bloquean.length)); setFechaEditando(null); return }
    }
    const { error } = await setDisponibilidad((prev) => {
      const n = { ...prev.excepciones }
      delete n[fecha]
      return { ...prev, excepciones: n }
    })
    if (error) {
      mostrarError("No se pudo guardar el cambio. Revisa tu conexión e intenta de nuevo.")
      return
    }
    setFechaEditando(null)
    mostrarGuardado()
    registrarLog(usuario, "horario", "Quitó una excepción de horario", fecha)
  }

  const irMesAnterior = () => setMesVista((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
  const irMesSiguiente = () => setMesVista((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))

  // Accesibilidad de modales (audit UX, Lote 1, punto 1c)

  return (
    <div className="w-full space-y-6 text-left">
      {/* ─── HEADER ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white" style={{ background: GRAD, boxShadow: "0 12px 24px -10px rgba(37,99,235,0.6)" }}>
            <CalendarClock size={24} aria-hidden="true" />
          </div>
          <h1 className="font-serif text-2xl font-bold tracking-tight" style={{ color: INK }}>{esAdmin ? "Horario" : "Mi horario"}</h1>
        </div>
        {esAdmin && pendientes > 0 && (
          <button type="button" onClick={() => setTab("ausencias")} className="rounded-xl border border-slate-200/70 bg-white px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors hover:bg-slate-50 cursor-pointer" style={{ color: INK }}>Ausencias · {pendientes} por aprobar</button>
        )}
      </div>

      {vistas.length > 1 && (
        <Pestanas etiqueta="Secciones de Horario" idBase="horario" activa={vista} onCambiar={setTab}
          pestanas={esAdmin
            ? [{ id: "general", titulo: "Horario de la óptica" }, { id: "equipo", titulo: "Horarios del personal", cuenta: miembros.length }, { id: "ausencias", titulo: "Ausencias", cuenta: pendientes }]
            : [{ id: "mi", titulo: "Mi horario" }, { id: "general", titulo: "Horario de la óptica" }]} />
      )}

      {/* ─── CONFIRMACIÓN DE GUARDADO (aparece brevemente tras cada cambio) ─── */}
      {guardadoVisible && <AvisoFlotante texto={avisoTexto || "Cambios guardados."} tipo="exito" />}
      {errorAccion && <AvisoFlotante texto={errorAccion} tipo="error" />}
      {datos.error && <p role="alert" className="rounded-xl border border-red-200/60 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{datos.error}</p>}

      <div id="horario-panel" role="tabpanel" aria-labelledby={`horario-tab-${vista}`}>
      {datos.cargando && vista !== "general" ? (
        <TablaSkeleton />
      ) : vista === "mi" ? (
        <MiHorario usuario={usuario} esProfesional={esProfesional} disponibilidad={disponibilidad} citas={citas} datos={datos} onAviso={avisar} />
      ) : vista === "equipo" ? (
        <HorariosPersonal miembros={miembros} disponibilidad={disponibilidad} citas={citas} datos={datos} onAviso={avisar} />
      ) : vista === "ausencias" ? (
        <AusenciasAdmin miembros={miembros} rolDe={rolDe} ausencias={datos.ausencias} citas={citas} setCitas={setCitas} disponibilidad={disponibilidad} datos={datos} onReagendarCita={onReagendarCita} onAviso={avisar} />
      ) : !puedeEditarHorario ? (
        <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-blue-100 bg-blue-50 p-3.5 text-blue-800">
            <Lock size={16} className="shrink-0" />
            <p className="text-xs leading-relaxed">Solo el administrador, o quien tenga delegado el horario de la óptica, puede editarlo. Esto es de referencia.</p>
          </div>
          <h4 className="mb-3 text-sm font-bold" style={{ color: INK }}>Horario semanal habitual</h4>
          <div className="space-y-2">
            {ORDEN_LV.map((dia) => (
              <div key={dia} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
                <span className="text-sm font-semibold text-slate-700">{ETIQUETAS_DIA[dia]}</span>
                <span className="text-xs text-slate-500">{resumenHorario(disponibilidad.horarioSemanal[dia])}</span>
              </div>
            ))}
          </div>
          {excepcionesOrdenadas.length > 0 && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <h4 className="mb-3 text-sm font-bold" style={{ color: INK }}>Próximos cambios sobre el horario habitual</h4>
              <div className="divide-y divide-slate-100">
                {excepcionesOrdenadas.map(([iso, exc]) => {
                  const abierta = diaAbierto(exc)
                  return (
                    <div key={iso} className="flex items-center gap-2.5 py-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: abierta ? "#059669" : "#dc2626" }} />
                      <span className="text-sm font-semibold text-slate-700">{fechaFormato(iso)}</span>
                      <span className="text-xs text-slate-500">{abierta ? `Abre ${resumenHorario(exc)}` : exc.nombre ? `Cerrado · ${exc.nombre}` : "Cerrado todo el día"}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      ) : (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* ─── HORARIO SEMANAL + PARÁMETROS ─── */}
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
            <h4 className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 text-sm font-bold" style={{ color: INK }}>
              <span className="grid h-8 w-8 place-items-center rounded-lg text-white" style={{ background: GRAD }}><Sun size={16} /></span>
              Horario semanal habitual
              {hayCambiosSinGuardar && (
                <span className="ml-auto rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wide text-amber-700">Sin guardar</span>
              )}
            </h4>
            <p className="-mt-2 mb-3 text-xs text-slate-500" title={"Si apagas \"Lunes\" aquí, cierras todos los lunes. Para cerrar solo un día puntual (por ejemplo, un lunes feriado) sin tocar el resto, usa \"Excepciones puntuales\" en el calendario de al lado."}>
              Cada día vale para todas las semanas. Para cerrar solo una fecha, usa «Excepciones puntuales».
            </p>
            <div className="space-y-2.5">
              {ORDEN_LV.map((dia) => {
                const d = borradorHorario[dia]
                const abierto = diaAbierto(d)
                const expandido = diasAbiertos.has(dia)
                return (
                  <div key={dia} className={"overflow-hidden rounded-xl border transition-colors " + (abierto ? "border-slate-200/60 bg-white" : "border-slate-100 bg-slate-50/60")}>
                    <button
                      type="button"
                      onClick={() => alternarDiaAbierto(dia)}
                      aria-expanded={expandido}
                      className="flex w-full items-center justify-between gap-2 p-3 text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
                    >
                      <div className="min-w-0">
                        <p className={"text-sm font-semibold " + (abierto ? "text-slate-800" : "text-slate-500")}>{ETIQUETAS_DIA[dia]}</p>
                        {!expandido && <p className="mt-0.5 truncate text-xs text-slate-500">{resumenHorario(d)}</p>}
                      </div>
                      <ChevronDown size={16} className={"shrink-0 text-slate-400 transition-transform " + (expandido ? "rotate-180" : "")} />
                    </button>
                    {expandido && (
                      <div className="space-y-2 px-3 pb-3">
                        {[["manana", "Mañana", Sun], ["tarde", "Tarde", Moon]].map(([clave, etiqueta, Icono]) => {
                          const s = d[clave]
                          return (
                            <div key={clave} className="rounded-lg bg-slate-50/70 p-2">
                              <div className="flex items-center justify-between">
                                <span className={"flex items-center gap-1.5 text-xs font-semibold " + (s.activo ? "text-slate-700" : "text-slate-400")}>
                                  <Icono size={12} /> {etiqueta}
                                </span>
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={s.activo}
                                  onClick={() => actualizarBorrador(dia, clave, { activo: !s.activo })}
                                  className="relative h-5 w-9 shrink-0 cursor-pointer rounded-full transition-colors"
                                  style={{ backgroundColor: s.activo ? "#2563EB" : "#e2e8f0" }}
                                  title={s.activo ? `Cerrar la ${etiqueta.toLowerCase()}` : `Abrir la ${etiqueta.toLowerCase()}`}
                                  aria-label={s.activo ? `Cerrar la ${etiqueta.toLowerCase()}` : `Abrir la ${etiqueta.toLowerCase()}`}
                                >
                                  <span className={"absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform " + (s.activo ? "translate-x-[16px]" : "translate-x-0")} />
                                </button>
                              </div>
                              {s.activo && (
                                <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                                  <CampoHora
                                    value={s.inicio} onChange={(v) => actualizarBorrador(dia, clave, { inicio: v })}
                                    className="w-full rounded-lg border border-slate-200/60 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none focus-visible:border-blue-500"
                                  />
                                  <CampoHora
                                    value={s.fin} onChange={(v) => actualizarBorrador(dia, clave, { fin: v })}
                                    className="w-full rounded-lg border border-slate-200/60 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none focus-visible:border-blue-500"
                                  />
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
            {errorGuardar && (
              <div role="alert" className="mt-4 flex items-center gap-2 rounded-lg border border-red-200/60 bg-red-50 p-2.5 text-xs font-medium text-red-700">
                <AlertTriangle size={14} /> {errorGuardar}
              </div>
            )}
            {hayCambiosSinGuardar && (
              <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  disabled={guardando}
                  onClick={descartarCambiosHorario}
                  className="flex-1 rounded-xl border border-slate-200/60 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                >
                  Descartar
                </button>
                <button
                  type="button"
                  disabled={guardando}
                  onClick={guardarHorarioSemanal}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 cursor-pointer disabled:opacity-50"
                  style={{ background: GRAD }}
                >
                  <CheckCircle2 size={15} /> {guardando ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
            <h4 className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-3 text-sm font-bold" style={{ color: INK }}>
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-600"><Clock size={16} /></span>
              Duración de cada cita
            </h4>
            <div className="flex items-center gap-2">
              <input
                type="number" min={10} step={5} value={borradorDuracion}
                onChange={(e) => setBorradorDuracion(Math.max(10, Number(e.target.value) || 10))}
                className="w-24 rounded-lg border border-slate-200/60 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus-visible:border-blue-500"
              />
              <span className="text-sm text-slate-500">minutos por paciente</span>
              {borradorDuracion !== disponibilidad.duracionCita && (
                <button
                  type="button"
                  disabled={guardandoDuracion}
                  onClick={guardarDuracion}
                  className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 cursor-pointer disabled:opacity-50"
                  style={{ background: GRAD }}
                >
                  <CheckCircle2 size={13} /> {guardandoDuracion ? "Guardando..." : "Guardar"}
                </button>
              )}
            </div>
            {errorDuracion && (
              <div role="alert" className="mt-2 flex items-center gap-2 rounded-lg border border-red-200/60 bg-red-50 p-2 text-xs font-medium text-red-700">
                <AlertTriangle size={13} /> {errorDuracion}
              </div>
            )}
          </div>
        </div>

        {/* ─── EXCEPCIONES PUNTUALES ─── */}
        <div className="space-y-6 lg:col-span-3">
          <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="flex items-center gap-2 text-sm font-bold" style={{ color: INK }}>
                <span className="grid h-8 w-8 place-items-center rounded-lg text-white" style={{ background: GRAD }}><CalendarDays size={16} /></span>
                Excepciones puntuales
              </h4>
              <span className="flex items-center gap-1 text-xs text-slate-500"><Info size={12} /> Toca un día para cerrarlo o abrirlo</span>
            </div>

            <div className="mb-3 flex items-center justify-between px-1">
              <span className="text-sm font-bold" style={{ color: INK }}>{formatoFecha(mesVista, "mesAnio")}</span>
              <div className="flex gap-1 text-slate-500">
                <button type="button" onClick={irMesAnterior} aria-label="Mes anterior" className="rounded-md p-1.5 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"><ChevronLeft size={16} /></button>
                <button type="button" onClick={irMesSiguiente} aria-label="Mes siguiente" className="rounded-md p-1.5 hover:bg-slate-100 hover:text-slate-700 cursor-pointer"><ChevronRight size={16} /></button>
              </div>
            </div>

            <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-bold text-slate-500">
              {DIAS_CORTOS.map((d, i) => (<span key={i}>{d}</span>))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {dias.map((dia, i) => {
                if (!dia) return <span key={`e${i}`} />
                const efectivo = horarioEfectivo(dia.iso, disponibilidad)
                const efectivoAbierto = diaAbierto(efectivo)
                const excepcion = disponibilidad.excepciones?.[dia.iso]
                const excepcionAbierta = excepcion ? diaAbierto(excepcion) : null
                const esHoy = dia.iso === hoy
                return (
                  <button
                    key={dia.iso}
                    type="button"
                    disabled={dia.pasado}
                    onClick={() => setFechaEditando(dia.iso)}
                    title={efectivoAbierto ? `Abierto ${resumenHorario(efectivo)}` : nombreDeDiaCerrado(dia.iso, disponibilidad) || "Cerrado"}
                    className={
                      "relative grid h-10 w-full place-items-center rounded-xl text-xs font-bold transition-all " +
                      (dia.pasado
                        ? "cursor-not-allowed text-slate-300"
                        : excepcion
                        ? (excepcionAbierta
                            ? "border-2 border-dashed border-emerald-400 bg-emerald-50 text-emerald-700 hover:border-emerald-500 cursor-pointer"
                            : "border-2 border-dashed border-red-400 bg-red-50 text-red-700 hover:border-red-500 cursor-pointer")
                        : efectivoAbierto
                        ? "border border-emerald-200/60 bg-emerald-50 text-emerald-700 hover:border-emerald-400 cursor-pointer"
                        : "border border-slate-200/60 bg-slate-50 text-slate-500 hover:border-slate-300 cursor-pointer") +
                      (esHoy ? " ring-2 ring-blue-500 ring-offset-1" : "")
                    }
                  >
                    {dia.numero}
                    {excepcion && (
                      <span
                        className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white"
                        style={{ backgroundColor: excepcionAbierta ? "#059669" : "#dc2626" }}
                      />
                    )}
                  </button>
                )
              })}
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-slate-200/70 pt-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-400" />Abierto</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-300" />Cerrado</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-600" />Excepción: abre extra</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-red-600" />Excepción: cierra</span>
            </div>
          </div>

          {excepcionesOrdenadas.length > 0 && (
            <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
              <h4 className="mb-3 text-sm font-bold" style={{ color: INK }}>Próximos cambios sobre tu horario habitual</h4>
              <div className="divide-y divide-slate-100">
                {excepcionesOrdenadas.map(([iso, exc]) => {
                  const abierta = diaAbierto(exc)
                  return (
                    <div key={iso} className="flex items-center justify-between py-2.5">
                      <div className="flex items-center gap-2.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: abierta ? "#059669" : "#dc2626" }} />
                        <span className="text-sm font-semibold text-slate-700">{fechaFormato(iso)}</span>
                        <span className="text-xs text-slate-500">{abierta ? `Abre ${resumenHorario(exc)}` : exc.nombre ? `Cerrado · ${exc.nombre}` : "Cerrado todo el día"}</span>
                        {textoAbiertoPor(exc) && <span className="hidden text-xs text-slate-500 lg:inline">· {textoAbiertoPor(exc)}</span>}
                      </div>
                      <button type="button" onClick={() => setFechaEditando(iso)} className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">Editar</button>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
      )}
      </div>

      {/* ─── MODAL EDITAR FECHA (solo tab general, solo admin) ─── */}
      {fechaEditando && (
        <EditorExcepcion
          fecha={fechaEditando}
          excepcion={excepcionActual}
          horarioBase={horarioBaseFecha}
          disponibilidad={disponibilidad}
          citas={citas}
          onGuardar={guardarExcepcion}
          onQuitar={excepcionActual ? quitarExcepcion : null}
          onCerrar={() => setFechaEditando(null)}
        />
      )}

      {/* ─── AVISO: EL CAMBIO DEJA CITAS YA AGENDADAS FUERA DE HORARIO ─── */}
      {avisoConflicto && (
        <Cascaron titulo="Hay citas fuera de este horario" subtitulo="Revisa antes de aplicar el cambio" Icono={AlertTriangle} ancho="max-w-md" capa="z-[60]" onCerrar={() => setAvisoConflicto(null)}
          pie={<>
            <span />
            <div className="ml-auto flex items-center gap-2">
              <button type="button" onClick={() => setAvisoConflicto(null)} className="rounded-lg border border-slate-200/60 px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">Cancelar</button>
              <button type="button" onClick={() => { avisoConflicto.aplicar(); setAvisoConflicto(null) }} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-amber-700 cursor-pointer">Aplicar de todas formas</button>
            </div>
          </>}>
          <div className="space-y-3 p-6">
            <p className="text-sm text-slate-600">
              {avisoConflicto.citas.length === 1
                ? "Esta cita ya agendada quedaría fuera del horario si aplicas el cambio:"
                : `Estas ${avisoConflicto.citas.length} citas ya agendadas quedarían fuera del horario si aplicas el cambio:`}
            </p>
            <div className="max-h-40 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200/60">
              {avisoConflicto.citas.map((c) => (
                <div key={c.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <User size={13} className="shrink-0 text-slate-500" />
                  <span className="truncate font-semibold text-slate-700">{c.paciente}</span>
                  <span className="ml-auto shrink-0 font-mono text-xs text-slate-500">{c.fecha} · {horaSinCero(c.hora)}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-500">Puedes aplicar el cambio igual y reprogramarlas tú mismo después, o cancelar y dejarlas como están.</p>
          </div>
        </Cascaron>
      )}

    </div>
  )
}

function EditorExcepcion({ fecha, excepcion, horarioBase, disponibilidad, citas, onGuardar, onQuitar, onCerrar }) {
  const base = excepcion || horarioBase
  const [manana, setManana] = useState({ ...horarioBase.manana, ...base.manana })
  const [tarde, setTarde] = useState({ ...horarioBase.tarde, ...base.tarde })
  // Nombre opcional de un día cerrado a mano ("Feriado: Día de los Difuntos"): se ve en los calendarios en lugar de solo "Cerrado".
  const [nombre, setNombre] = useState(excepcion?.nombre || "")

  const fechaLegible = formatoFecha(fecha, "calendario")

  // Citas + horarios libres de este día (reunión 29 sept., punto 9 del plan)
  // — informativo, calculado sobre el horario realmente guardado (no sobre
  // el borrador de mañana/tarde que se edita más abajo en este mismo modal).
  const citasDelDia = (citas || [])
    .filter((c) => c.fecha === fecha)
    .sort((a, b) => minutosDesdeMedianoche(a.hora) - minutosDesdeMedianoche(b.hora))
  const slots = slotsDisponibles(fecha, disponibilidad, citas || [])
  const diaEstaAbierto = diaAbierto(horarioEfectivo(fecha, disponibilidad))
  const slotsLibres = slots.filter((s) => s.libre)
  const slotsOcupados = slots.length - slotsLibres.length

  // Accesibilidad de modales (audit UX, Lote 1, punto 1c) — siempre "abierto"
  // mientras este componente está montado, ya que su caller lo monta y
  // desmonta condicionalmente en vez de mantenerlo siempre presente.

  return (
    <Cascaron titulo={fechaLegible} subtitulo={`Excepción de horario · normalmente este día: ${resumenHorario(horarioBase)}`} Icono={CalendarDays} ancho="max-w-md" capa="z-50" onCerrar={onCerrar}
      pie={<>
        {onQuitar ? (
          <button type="button" onClick={onQuitar} className="flex items-center gap-1.5 rounded-lg border border-slate-200/60 px-3 py-2 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-50 cursor-pointer"><RotateCcw size={14} aria-hidden="true" /> Volver al horario habitual</button>
        ) : <span />}
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={onCerrar} className="rounded-lg border border-slate-200/60 px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">Cancelar</button>
          <button type="button" onClick={() => onGuardar({ manana, tarde, nombre })} className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer" style={{ background: GRAD }}><CheckCircle2 size={15} aria-hidden="true" /> Guardar</button>
        </div>
      </>}>
      <div className="space-y-4 px-6 py-5">
        {/* Citas registradas + horarios libres (reunión 29 sept., punto 9 del
            plan) — informativo, no forma parte del formulario de abajo. */}
        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
            <CalendarDays size={13} /> Citas registradas <span className="font-normal normal-case text-slate-400">· {citasDelDia.length}</span>
          </h3>
          {citasDelDia.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-500">Sin citas registradas este día.</p>
          ) : (
            <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200/60">
              {citasDelDia.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-700">{c.paciente}</p>
                    <p className="text-xs text-slate-500">{horaSinCero(c.hora)}</p>
                  </div>
                  <span className={"shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold " + (ESTADO_BADGE_CLASE[c.estado] || ESTADO_BADGE_CLASE.Pendiente)}>
                    {etiquetaEstadoCita(c.estado)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
            <Clock size={13} /> Horarios libres
          </h3>
          {!diaEstaAbierto ? (
            <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-500">Día cerrado — no hay horarios que mostrar.</p>
          ) : (
            <>
              <p className="mb-2 text-xs text-slate-500">{slotsOcupados} ocupados · {slotsLibres.length} disponibles</p>
              {slotsLibres.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-3 text-xs text-slate-500">Sin horarios libres este día.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {slotsLibres.map((s) => (
                    <span key={s.hora} className="rounded-md border border-emerald-200/60 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">{horaSinCero(s.hora)}</span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-4">
          {[["manana", "Mañana", Sun, manana, setManana], ["tarde", "Tarde", Moon, tarde, setTarde]].map(([clave, etiqueta, Icono, valor, setValor]) => (
            <div key={clave} className="rounded-xl border border-slate-200/60 p-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-700"><Icono size={14} /> {etiqueta}</span>
                <button
                  type="button" onClick={() => setValor((v) => ({ ...v, activo: !v.activo }))}
                  role="switch"
                  aria-checked={valor.activo}
                  aria-label={valor.activo ? `Cerrar la ${etiqueta.toLowerCase()}` : `Abrir la ${etiqueta.toLowerCase()}`}
                  className="relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors"
                  style={{ backgroundColor: valor.activo ? "#059669" : "#e2e8f0" }}
                >
                  <span className={"absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform " + (valor.activo ? "translate-x-[22px]" : "translate-x-0")} />
                </button>
              </div>
              {valor.activo && (
                <div className="mt-2.5 grid grid-cols-2 gap-2">
                  <CampoHora sinCero value={valor.inicio || ""} onChange={(h) => setValor((v) => ({ ...v, inicio: h }))}
                    className="w-full rounded-lg border border-slate-200/60 bg-slate-50 px-2 py-2 text-sm font-semibold text-slate-700 outline-none focus-visible:border-blue-500" />
                  <CampoHora sinCero value={valor.fin || ""} onChange={(h) => setValor((v) => ({ ...v, fin: h }))}
                    className="w-full rounded-lg border border-slate-200/60 bg-slate-50 px-2 py-2 text-sm font-semibold text-slate-700 outline-none focus-visible:border-blue-500" />
                </div>
              )}
            </div>
          ))}
          {!manana.activo && !tarde.activo && (
            <label className="block rounded-xl bg-slate-50 px-3 py-2.5">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Nombre del día <span className="font-normal text-slate-500">(opcional)</span></span>
              <input
                type="text"
                value={nombre}
                maxLength={60}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej.: Feriado: Día de los Difuntos"
                className="w-full rounded-lg border border-slate-200/60 bg-white px-2.5 py-2 text-sm outline-none focus-visible:border-blue-500"
              />
            </label>
          )}
        </div>
      </div>
    </Cascaron>
  )
}
