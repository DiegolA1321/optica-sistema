"use client"

import { useState, useMemo, useEffect, useRef } from "react"
import {
  UserPlus,
  Search,
  Trash2,
  Pencil,
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
  TrendingUp,
  TrendingDown,
  Minus,
  AlertCircle,
  SlidersHorizontal,
  KeyRound,
  Copy,
  Check,
  Glasses,
  Heart,
  Stethoscope,
  ChevronRight,
  Activity,
  Lock,
  MoreVertical,
} from "lucide-react"
import SelectorFechaHora from "../componentes/SelectorFechaHora"
import ConfirmarCitaModal from "../componentes/ConfirmarCitaModal"
import { filtrarSoloLetras, filtrarSoloNumeros, esNombreValido, esCedulaValida, esTelefonoValido } from "../utilidades/validaciones"
import { isoAFechaLocal, minutosDesdeMedianoche } from "../utilidades/disponibilidad"

// ─── Paleta de firma (consistente con login / agenda / dashboard) ───
const INK = "#0E2B33"
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)" // cian → azul
const OD_COLOR = "#2563EB"
const OI_COLOR = "#06b6d4"

// Equivalente esférico (dioptrías) — solo para uso interno del optómetra, nunca expuesto al paciente
const ee = (o) => parseFloat(o?.esfera || 0) + parseFloat(o?.cilindro || 0) / 2

// Estado de corrección: ¿la corrección actual (anteojos/lentes) logra buena agudeza visual?
// Es el dato clínicamente accionable — un error refractivo no se autocorrige, se maneja con
// anteojos, lentes de contacto o cirugía refractiva; esto mide si ese manejo está funcionando.
const CORRECCION = {
  "Bien corregido": { label: "Bien corregido", icon: CheckCircle, clase: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  "Requiere ajuste": { label: "Requiere ajuste", icon: AlertCircle, clase: "bg-red-50 text-red-700 border-red-200" },
  "Sin evaluación": { label: "Sin evaluación", icon: Minus, clase: "bg-amber-50 text-amber-700 border-amber-200" },
}

// Colores (hex) para las tarjetas-resumen de corrección
const CORRECCION_COLOR = {
  "Bien corregido": { fg: "#059669", bg: "#ecfdf5", border: "#a7f3d0" },
  "Requiere ajuste": { fg: "#dc2626", bg: "#fef2f2", border: "#fecaca" },
  "Sin evaluación": { fg: "#d97706", bg: "#fffbeb", border: "#fde68a" },
}

// Tendencia de graduación: dato de contexto secundario (no implica mejoría/empeoramiento por sí solo)
const TENDENCIA = {
  Disminuyó: { label: "Disminuyó", icon: TrendingDown, fg: "#0891b2" },
  Aumentó: { label: "Aumentó", icon: TrendingUp, fg: "#dc2626" },
  "Sin cambios": { label: "Sin cambios", icon: Minus, fg: "#64748b" },
}

export default function Pacientes({ pacientes = [], setPacientes, consultas = [], setConsultas, citas = [], setCitas, disponibilidad, motivosConsulta = [], accionInicial, onAccionInicialConsumida, overlaySolo = false, onIrAFichaClinica }) {
  // Estados del formulario (solo datos básicos personales)
  const [nombre, setNombre] = useState("")
  const [cedula, setCedula] = useState("")
  const [telefono, setTelefono] = useState("")
  const [correo, setCorreo] = useState("")
  const [fechaNacimiento, setFechaNacimiento] = useState("")
  const [referidoPor, setReferidoPor] = useState("")
  const [erroresForm, setErroresForm] = useState({})

  // Modales
  const [modalAbierto, setModalAbierto] = useState(false)
  const [idEditando, setIdEditando] = useState(null)
  const [pacienteAEliminar, setPacienteAEliminar] = useState(null)

  // Filtros
  const [busqueda, setBusqueda] = useState("")
  const [filtroEstado, setFiltroEstado] = useState("Todos")
  const [filtroCorreccion, setFiltroCorreccion] = useState("Todos")
  const [filtroFecha, setFiltroFecha] = useState("")

  // Menú "más acciones" por fila de la tabla
  const [menuAccionesId, setMenuAccionesId] = useState(null)
  const menuAccionesRef = useRef(null)
  useEffect(() => {
    if (menuAccionesId == null) return
    const onDown = (e) => { if (menuAccionesRef.current && !menuAccionesRef.current.contains(e.target)) setMenuAccionesId(null) }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [menuAccionesId])

  const [notificacion, setNotificacion] = useState("")

  // Cuenta de acceso (clave temporal)
  const [cuentaPaciente, setCuentaPaciente] = useState(null)
  const [claveGen, setClaveGen] = useState("")
  const [copiadoCred, setCopiadoCred] = useState(false)

  // Historial clínico (consultas y citas del paciente)
  const [pacienteHistorial, setPacienteHistorial] = useState(null)
  const [tabHistorial, setTabHistorial] = useState("valoraciones")

  // Agendar cita desde el perfil del paciente
  const [agendarPara, setAgendarPara] = useState(null)
  const [agendarFecha, setAgendarFecha] = useState("")
  const [agendarHora, setAgendarHora] = useState("")
  const [agendarMotivo, setAgendarMotivo] = useState("")
  const [errorAgendar, setErrorAgendar] = useState("")
  const [confirmandoCita, setConfirmandoCita] = useState(false)

  // Ofrecer abrir la ficha clínica justo después de crear un paciente nuevo —
  // evita el paso extra de ir a buscarlo de nuevo en Ficha clínica.
  const [pacienteRecienCreado, setPacienteRecienCreado] = useState(null)

  const mostrarNotif = (texto) => {
    setNotificacion(texto)
    setTimeout(() => setNotificacion(""), 3500)
  }

  // ── Cuenta de acceso del paciente ──
  const generarClave = () => "Opt-" + Math.random().toString(36).slice(2, 7).toUpperCase()

  const abrirCuenta = (paciente) => {
    setCuentaPaciente(paciente)
    setClaveGen(paciente.tieneCuenta && paciente.claveTemporal ? paciente.claveTemporal : generarClave())
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

  const guardarCuenta = () => {
    if (!cuentaPaciente) return
    const eraNueva = !cuentaPaciente.tieneCuenta
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
  }

  const validarFormularioPaciente = () => {
    const errs = {}
    if (!esNombreValido(nombre)) errs.nombre = "Ingresa un nombre válido (solo letras)."
    if (!esCedulaValida(cedula)) errs.cedula = "Esa cédula no es válida — revisa los dígitos."
    else if (pacientes.some((p) => p.id !== idEditando && p.cedula === cedula)) errs.cedula = "Ya existe un paciente registrado con esa cédula."
    if (!esTelefonoValido(telefono)) errs.telefono = "El teléfono debe tener entre 7 y 10 dígitos."
    return errs
  }

  const abrirCrear = () => {
    limpiarFormulario()
    setModalAbierto(true)
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
    const paciente = pacientes.find((p) => p.id === accionInicial.pacienteId)
    if (paciente) {
      if (accionInicial.accion === "historial") { setPacienteHistorial(paciente); setTabHistorial("valoraciones") }
      else if (accionInicial.accion === "editar") abrirEdicion(paciente)
      else if (accionInicial.accion === "eliminar") setPacienteAEliminar(paciente)
    }
    onAccionInicialConsumida?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accionInicial])

  const manejarEnvio = (e) => {
    e.preventDefault()
    const errs = validarFormularioPaciente()
    setErroresForm(errs)
    if (Object.keys(errs).length > 0) return

    if (idEditando) {
      setPacientes(
        pacientes.map((p) =>
          p.id === idEditando
            ? {
                ...p,
                nombre,
                cedula,
                telefono: telefono || "Sin Teléfono",
                correo: correo || "Sin Correo",
                fecha_nacimiento: fechaNacimiento || "",
                referidoPor: referidoPor || "",
              }
            : p,
        ),
      )
      mostrarNotif("Expediente del paciente actualizado correctamente.")
    } else {
      const nuevoPaciente = {
        id: Date.now(),
        nombre,
        cedula,
        telefono: telefono || "Sin Teléfono",
        correo: correo || "Sin Correo",
        fecha_nacimiento: fechaNacimiento || "",
        referidoPor: referidoPor || "",
        evolucion: "Sin evaluación", // Inicializa sin evaluación hasta su primera consulta médica
        ultimaConsulta: "Pendiente",
        fechaRegistro: new Date().toISOString().split("T")[0],
        estadoClinico: "Activo",
      }
      setPacientes([nuevoPaciente, ...pacientes])
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

  const confirmarEliminar = () => {
    if (!pacienteAEliminar) return
    setPacientes(pacientes.filter((p) => p.id !== pacienteAEliminar.id))
    setCitas?.(citas.filter((c) => !perteneceAPaciente(c, pacienteAEliminar)))
    setConsultas?.(consultas.filter((c) => !perteneceAPaciente(c, pacienteAEliminar)))
    mostrarNotif("Paciente removido de la base de datos, junto con sus citas y consultas asociadas.")
    setPacienteAEliminar(null)
  }

  // ── Agendar cita desde el perfil del paciente ──
  const abrirAgendar = (paciente) => {
    setAgendarPara(paciente)
    setAgendarFecha("")
    setAgendarHora("")
    setAgendarMotivo("")
    setErrorAgendar("")
    setConfirmandoCita(false)
  }

  const validarYPedirConfirmacionCita = (e) => {
    e.preventDefault()
    if (!agendarMotivo) {
      setErrorAgendar("Selecciona el motivo del examen.")
      return
    }
    if (!agendarFecha || !agendarHora) {
      setErrorAgendar("Selecciona fecha y hora para la cita.")
      return
    }
    setErrorAgendar("")
    setConfirmandoCita(true)
  }

  const confirmarAgendarCita = () => {
    const partes = agendarPara.nombre.trim().split(" ").filter(Boolean)
    const iniciales = partes.length > 1 ? (partes[0][0] + partes[1][0]).toUpperCase() : (partes[0]?.[0] || "P").toUpperCase()
    const nuevaCita = {
      id: Date.now(),
      pacienteId: agendarPara.id,
      paciente: agendarPara.nombre,
      cedula: agendarPara.cedula,
      telefono: agendarPara.telefono,
      fecha: agendarFecha,
      hora: agendarHora,
      motivo: agendarMotivo,
      iniciales,
      estado: "Pendiente",
    }
    setCitas?.([...citas, nuevaCita])
    mostrarNotif(`Cita agendada para ${agendarPara.nombre}.`)
    setConfirmandoCita(false)
    setAgendarPara(null)
  }

  const pacientesFiltrados = useMemo(() => {
    return pacientes.filter((p) => {
      const coincideTexto =
        p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || p.cedula.includes(busqueda)
      const coincideEstado = filtroEstado === "Todos" || p.estadoClinico === filtroEstado
      const coincideCorreccion = filtroCorreccion === "Todos" || (p.estadoCorreccion || "Sin evaluación") === filtroCorreccion
      const coincideFecha = !filtroFecha || (p.fechaRegistro || "") === filtroFecha
      return coincideTexto && coincideEstado && coincideCorreccion && coincideFecha
    })
  }, [pacientes, busqueda, filtroEstado, filtroCorreccion, filtroFecha])

  // Conteo por estado de corrección (para el resumen superior)
  const conteoCorreccion = useMemo(() => {
    const base = { "Bien corregido": 0, "Requiere ajuste": 0, "Sin evaluación": 0 }
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
    { key: "Sin evaluación", icon: CORRECCION["Sin evaluación"].icon, valor: conteoCorreccion["Sin evaluación"], label: "Sin evaluación", fg: CORRECCION_COLOR["Sin evaluación"].fg, bg: CORRECCION_COLOR["Sin evaluación"].bg, ring: CORRECCION_COLOR["Sin evaluación"].fg },
  ]

  const hayFiltrosActivos =
    busqueda || filtroEstado !== "Todos" || filtroCorreccion !== "Todos" || filtroFecha

  const limpiarFiltros = () => {
    setBusqueda("")
    setFiltroEstado("Todos")
    setFiltroCorreccion("Todos")
    setFiltroFecha("")
  }

  return (
    <div className="w-full space-y-5 text-left">
      {notificacion && (
        <div className={(overlaySolo ? "fixed right-6 top-6 z-[60] w-80 shadow-2xl " : "") + "flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-emerald-900"}>
          <CheckCircle className="shrink-0 text-emerald-500" size={18} />
          <p className="text-sm font-semibold">{notificacion}</p>
        </div>
      )}

      {!overlaySolo && (
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

        <button
          type="button"
          onClick={abrirCrear}
          className="flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          style={{ background: GRAD, boxShadow: "0 14px 28px -12px rgba(37,99,235,0.6)" }}
        >
          <UserPlus size={18} />
          Crear paciente
        </button>
      </div>

      {/* ─── RESUMEN POR ESTADO DE CORRECCIÓN (tarjetas que también filtran) ─── */}
      <div>
        <p className="mb-2 text-xs font-medium text-slate-500">Toca una tarjeta para filtrar la lista</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {tarjetasCorreccion.map((t) => {
            const Icono = t.icon
            const activo = filtroCorreccion === t.key
            const pct = pacientes.length ? Math.round((t.valor / pacientes.length) * 100) : 0
            return (
              <button
                key={t.key}
                type="button"
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
                    <p className="text-2xl font-black leading-none" style={{ color: INK }}>{t.valor}</p>
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

      {/* ─── BARRA DE FILTROS ─── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          <SlidersHorizontal size={14} />
          Filtros
        </div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label htmlFor="buscar-paciente" className="mb-1.5 block text-sm font-medium text-slate-600">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input
                id="buscar-paciente"
                type="text"
                placeholder="Nombre o cédula del paciente..."
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none transition-colors focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
              />
            </div>
          </div>

          <div>
            <label htmlFor="filtro-estado" className="mb-1.5 block text-sm font-medium text-slate-600">Estado</label>
            <select
              id="filtro-estado"
              value={filtroEstado}
              onChange={(e) => setFiltroEstado(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-3 pr-8 text-sm font-medium text-slate-700 outline-none transition-colors focus:border-blue-500 focus:bg-white lg:w-36"
            >
              <option value="Todos">Todos</option>
              <option value="Activo">Activo</option>
              <option value="Revisión">Revisión</option>
            </select>
          </div>

          <div>
            <label htmlFor="filtro-evolucion" className="mb-1.5 block text-sm font-medium text-slate-600">Corrección</label>
            <select
              id="filtro-evolucion"
              value={filtroCorreccion}
              onChange={(e) => setFiltroCorreccion(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-3 pr-8 text-sm font-medium text-slate-700 outline-none transition-colors focus:border-blue-500 focus:bg-white lg:w-40"
            >
              <option value="Todos">Todas</option>
              <option value="Bien corregido">Bien corregido</option>
              <option value="Requiere ajuste">Requiere ajuste</option>
              <option value="Sin evaluación">Sin evaluación</option>
            </select>
          </div>

          <div>
            <label htmlFor="filtro-fecha" className="mb-1.5 block text-sm font-medium text-slate-600">Fecha de registro</label>
            <input
              id="filtro-fecha"
              type="date"
              value={filtroFecha}
              onChange={(e) => setFiltroFecha(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-sm text-slate-700 outline-none transition-colors focus:border-blue-500 focus:bg-white lg:w-44"
            />
          </div>

          {hayFiltrosActivos && (
            <button
              type="button"
              onClick={limpiarFiltros}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 cursor-pointer"
            >
              <X size={15} />
              Limpiar
            </button>
          )}
        </div>
      </div>

      {/* ─── TABLA ─── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3.5">Paciente</th>
                <th className="px-5 py-3.5">Contacto</th>
                <th className="px-5 py-3.5">Corrección</th>
                <th className="px-5 py-3.5">Último examen</th>
                <th className="px-5 py-3.5 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pacientesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <div className="mx-auto max-w-xs space-y-3">
                      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-slate-100 text-slate-300">
                        <AlertCircle size={28} />
                      </div>
                      <p className="text-sm font-semibold text-slate-500">
                        {pacientes.length === 0
                          ? "Aún no hay pacientes registrados."
                          : "Ningún paciente coincide con los filtros."}
                      </p>
                      {pacientes.length === 0 && (
                        <button type="button" onClick={abrirCrear} className="text-sm font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">
                          Crear el primero
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                pacientesFiltrados.map((paciente) => {
                  const correccion = CORRECCION[paciente.estadoCorreccion] || CORRECCION["Sin evaluación"]
                  const IconoCorreccion = correccion.icon
                  const tendencia = TENDENCIA[paciente.evolucion]
                  return (
                    <tr key={paciente.id} className="group transition-colors hover:bg-slate-50/70">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: GRAD }}>
                            {paciente.nombre.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-800 transition-colors group-hover:text-blue-600">{paciente.nombre}</p>
                            <p className="mt-0.5 font-mono text-xs text-slate-500">{paciente.cedula}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <span className={"rounded-full px-2 py-0.5 text-xs font-semibold " + (paciente.estadoClinico === "Activo" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
                                {paciente.estadoClinico}
                              </span>
                              <span className={"rounded-full px-2 py-0.5 text-xs font-semibold " + (paciente.tieneCuenta ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500")}>
                                {paciente.tieneCuenta ? "Con cuenta" : "Sin cuenta"}
                              </span>
                              {(paciente.fecha_nacimiento || paciente.fechaNacimiento) && (
                                <span className="flex items-center gap-1 text-xs text-slate-500">
                                  <Cake size={11} />
                                  {(paciente.fecha_nacimiento || paciente.fechaNacimiento).split("-").reverse().slice(0, 2).join("/")}
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
                            <span className="max-w-[160px] truncate">{paciente.correo}</span>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="space-y-1">
                          <span className={"inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold " + correccion.clase}>
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
                          <span>{paciente.ultimaConsulta}</span>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex items-center justify-center gap-1">
                          <button type="button" onClick={() => { setPacienteHistorial(paciente); setTabHistorial("valoraciones") }} title="Ver historial clínico" className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-blue-50 hover:text-blue-600 cursor-pointer">
                            <Eye size={16} />
                          </button>
                          <button type="button" onClick={() => abrirAgendar(paciente)} title="Agendar cita" className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-emerald-50 hover:text-emerald-600 cursor-pointer">
                            <CalendarPlus size={16} />
                          </button>
                          <div className="relative" ref={menuAccionesId === paciente.id ? menuAccionesRef : null}>
                            <button
                              type="button"
                              onClick={() => setMenuAccionesId((prev) => (prev === paciente.id ? null : paciente.id))}
                              title="Más acciones"
                              className={"rounded-lg p-2 transition-colors cursor-pointer " + (menuAccionesId === paciente.id ? "bg-slate-100 text-slate-700" : "text-slate-500 hover:bg-slate-100 hover:text-slate-700")}
                            >
                              <MoreVertical size={16} />
                            </button>
                            {menuAccionesId === paciente.id && (
                              <div className="absolute right-0 top-full z-20 mt-1 w-52 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 text-left shadow-xl">
                                <button
                                  type="button"
                                  onClick={() => { setMenuAccionesId(null); abrirCuenta(paciente) }}
                                  className={"flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-medium transition-colors cursor-pointer " + (paciente.tieneCuenta ? "text-slate-600 hover:bg-slate-50" : "text-blue-600 hover:bg-blue-50")}
                                >
                                  <KeyRound size={15} /> {paciente.tieneCuenta ? "Restablecer clave" : "Crear cuenta de acceso"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setMenuAccionesId(null); abrirEdicion(paciente) }}
                                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer"
                                >
                                  <Pencil size={15} /> Editar datos
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { setMenuAccionesId(null); setPacienteAEliminar(paciente) }}
                                  className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 cursor-pointer"
                                >
                                  <Trash2 size={15} /> Eliminar
                                </button>
                              </div>
                            )}
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
          <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
            Mostrando {pacientesFiltrados.length} de {pacientes.length} pacientes
          </div>
        )}
      </div>

      </>
      )}

      {/* ─── MODAL CREAR / EDITAR ─── */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)" }} onClick={cerrarModal}>
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl text-white" style={idEditando ? { backgroundColor: "#F59E0B" } : { background: GRAD }}>
                  <UserPlus size={20} />
                </div>
                <h2 className="text-lg font-bold" style={{ color: INK }}>
                  {idEditando ? "Editar paciente" : "Crear paciente"}
                </h2>
              </div>
              <button type="button" onClick={cerrarModal} className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={manejarEnvio} className="space-y-4 px-6 py-5">
              <div>
                <label htmlFor="p-nombre" className="mb-1.5 block text-sm font-medium text-slate-600">
                  Apellidos y nombres <span className="text-red-500">*</span>
                </label>
                <input
                  id="p-nombre" type="text" required placeholder="Ej. Cevallos Macías Diego"
                  value={nombre} onChange={(e) => setNombre(filtrarSoloLetras(e.target.value))}
                  className={"w-full rounded-xl border bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition-colors focus:bg-white focus:ring-2 " + (erroresForm.nombre ? "border-red-400 focus:border-red-500 focus:ring-red-100" : "border-slate-200 focus:border-blue-500 focus:ring-blue-50")}
                />
                {erroresForm.nombre && <p className="mt-1 flex items-center gap-1 text-xs font-medium text-red-600"><AlertCircle size={13} /> {erroresForm.nombre}</p>}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="p-cedula" className="mb-1.5 block text-sm font-medium text-slate-600">
                    Cédula <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <IdCard className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
                    <input
                      id="p-cedula" type="text" required placeholder="1315556667" inputMode="numeric" maxLength={10}
                      value={cedula} onChange={(e) => setCedula(filtrarSoloNumeros(e.target.value, 10))}
                      className={"w-full rounded-xl border bg-slate-50 py-2.5 pl-9 pr-3 font-mono text-sm text-slate-800 outline-none transition-colors focus:bg-white focus:ring-2 " + (erroresForm.cedula ? "border-red-400 focus:border-red-500 focus:ring-red-100" : "border-slate-200 focus:border-blue-500 focus:ring-blue-50")}
                    />
                  </div>
                  {erroresForm.cedula && <p className="mt-1 flex items-center gap-1 text-xs font-medium text-red-600"><AlertCircle size={13} /> {erroresForm.cedula}</p>}
                </div>

                <div>
                  <label htmlFor="p-nacimiento" className="mb-1.5 block text-sm font-medium text-slate-600">Fecha de nacimiento</label>
                  <div className="relative">
                    <Cake className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
                    <input
                      id="p-nacimiento" type="date"
                      value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none transition-colors focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="p-telefono" className="mb-1.5 block text-sm font-medium text-slate-600">Teléfono</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
                    <input
                      id="p-telefono" type="text" placeholder="0999999999" inputMode="numeric" maxLength={10}
                      value={telefono} onChange={(e) => setTelefono(filtrarSoloNumeros(e.target.value, 10))}
                      className={"w-full rounded-xl border bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none transition-colors focus:bg-white focus:ring-2 " + (erroresForm.telefono ? "border-red-400 focus:border-red-500 focus:ring-red-100" : "border-slate-200 focus:border-blue-500 focus:ring-blue-50")}
                    />
                  </div>
                  {erroresForm.telefono && <p className="mt-1 flex items-center gap-1 text-xs font-medium text-red-600"><AlertCircle size={13} /> {erroresForm.telefono}</p>}
                </div>

                <div>
                  <label htmlFor="p-correo" className="mb-1.5 block text-sm font-medium text-slate-600">Correo</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
                    <input
                      id="p-correo" type="email" placeholder="correo@ejemplo.com"
                      value={correo} onChange={(e) => setCorreo(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none transition-colors focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="p-referido" className="mb-1.5 block text-sm font-medium text-slate-600">
                  Referido por <span className="normal-case text-slate-500">(opcional)</span>
                </label>
                <div className="relative">
                  <Heart className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
                  <select
                    id="p-referido" value={referidoPor} onChange={(e) => setReferidoPor(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none transition-colors focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
                  >
                    <option value="">Nadie / llegó por su cuenta</option>
                    {pacientes.filter((p) => p.nombre !== nombre).map((p) => (
                      <option key={p.id} value={p.nombre}>{p.nombre}</option>
                    ))}
                  </select>
                </div>
                <p className="mt-1 text-xs text-slate-500">Si vino recomendado por otro paciente, selecciónalo aquí para reconocerlo en el CRM.</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={cerrarModal} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 cursor-pointer"
                  style={idEditando ? { backgroundColor: "#F59E0B" } : { background: GRAD }}
                >
                  {idEditando ? "Guardar cambios" : "Registrar paciente"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── PACIENTE CREADO: ofrecer abrir su ficha clínica ─── */}
      {pacienteRecienCreado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)" }} onClick={() => setPacienteRecienCreado(null)}>
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-emerald-50">
              <CheckCircle size={24} className="text-emerald-600" />
            </div>
            <h4 className="text-center text-lg font-bold" style={{ color: INK }}>Paciente registrado</h4>
            <p className="mt-1.5 text-center text-sm text-slate-500">
              <span className="font-semibold text-slate-700">{pacienteRecienCreado.nombre}</span> ya está en el sistema. ¿Deseas abrir su ficha clínica ahora?
            </p>
            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => setPacienteRecienCreado(null)} className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer">
                Ahora no
              </button>
              <button
                type="button"
                onClick={() => { onIrAFichaClinica?.(pacienteRecienCreado); setPacienteRecienCreado(null) }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 cursor-pointer"
                style={{ background: GRAD }}
              >
                <Stethoscope size={15} /> Abrir ficha clínica
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL ELIMINAR ─── */}
      {pacienteAEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)" }} onClick={() => setPacienteAEliminar(null)}>
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-600">
              <Trash2 size={22} />
            </div>
            <h2 className="text-lg font-bold" style={{ color: INK }}>Eliminar paciente</h2>
            <p className="mt-1.5 text-sm text-slate-500">
              ¿Seguro que deseas eliminar a <span className="font-semibold text-slate-700">{pacienteAEliminar.nombre}</span>? Esta acción no se puede deshacer.
            </p>
            {(() => {
              const nCitas = citas.filter((c) => perteneceAPaciente(c, pacienteAEliminar)).length
              const nConsultas = consultas.filter((c) => perteneceAPaciente(c, pacienteAEliminar)).length
              if (nCitas === 0 && nConsultas === 0) return null
              return (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs font-medium text-amber-800">
                  También se eliminarán {nCitas > 0 ? `${nCitas} cita${nCitas === 1 ? "" : "s"}` : ""}{nCitas > 0 && nConsultas > 0 ? " y " : ""}{nConsultas > 0 ? `${nConsultas} consulta${nConsultas === 1 ? "" : "s"} clínica${nConsultas === 1 ? "" : "s"}` : ""} asociadas a este paciente.
                </p>
              )
            })()}
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setPacienteAEliminar(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">
                Cancelar
              </button>
              <button type="button" onClick={confirmarEliminar} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 cursor-pointer">
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ─── MODAL CUENTA DE ACCESO (clave temporal) ─── */}
      {cuentaPaciente && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)" }} onClick={() => setCuentaPaciente(null)}>
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
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
              <button type="button" onClick={() => setCuentaPaciente(null)} className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <p className="text-sm text-slate-600">
                Acceso para <span className="font-semibold text-slate-800">{cuentaPaciente.nombre}</span>. Con estos datos podrá entrar a ver sus recetas, citas y evolución.
              </p>

              {/* Credenciales */}
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Usuario</span>
                  <span className="font-mono text-sm font-bold text-slate-800">{cuentaPaciente.cedula || cuentaPaciente.correo}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-200 pt-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Clave temporal</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-base font-black" style={{ color: "#2563EB" }}>{claveGen}</span>
                    <button type="button" onClick={regenerarClave} title="Generar otra clave" className="rounded-md p-1 text-slate-500 transition-colors hover:bg-white hover:text-blue-600 cursor-pointer">
                      <TrendingUp size={14} className="rotate-90" />
                    </button>
                  </div>
                </div>
              </div>

              <button type="button" onClick={copiarCredenciales} className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">
                {copiadoCred ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
                {copiadoCred ? "¡Copiado!" : "Copiar usuario y clave"}
              </button>

              <p className="rounded-lg bg-blue-50 p-3 text-xs leading-relaxed text-blue-800">
                Entrega estos datos al paciente. Es una <span className="font-semibold">clave temporal</span>: podrá cambiarla por la que desee cuando ingrese por primera vez.
              </p>

              <div className="flex gap-3 border-t border-slate-100 pt-4">
                <button type="button" onClick={() => setCuentaPaciente(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">
                  Cancelar
                </button>
                <button type="button" onClick={guardarCuenta} className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 cursor-pointer" style={{ background: GRAD }}>
                  {cuentaPaciente.tieneCuenta ? "Guardar nueva clave" : "Crear cuenta"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL HISTORIAL CLÍNICO ─── */}
      {pacienteHistorial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)" }} onClick={() => setPacienteHistorial(null)}>
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: GRAD }}>
                  <Eye size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold" style={{ color: INK }}>Historial clínico</h2>
                  <p className="text-xs text-slate-500">{pacienteHistorial.nombre}</p>
                </div>
              </div>
              <button type="button" onClick={() => setPacienteHistorial(null)} className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            {(() => {
              const consultasPaciente = consultas
                .filter((c) => c.pacienteId === pacienteHistorial.id || c.paciente === pacienteHistorial.nombre)
                .slice()
                .sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
              const citasPaciente = citas
                .filter((c) => c.pacienteId === pacienteHistorial.id || c.paciente === pacienteHistorial.nombre)
                .slice()
                .sort((a, b) => (a.fecha !== b.fecha ? (a.fecha < b.fecha ? 1 : -1) : minutosDesdeMedianoche(b.hora) - minutosDesdeMedianoche(a.hora)))

              return (
                <>
                  <div className="flex gap-1 border-b border-slate-100 bg-slate-50/70 px-4 pt-3">
                    <button
                      type="button"
                      onClick={() => setTabHistorial("valoraciones")}
                      className={"flex items-center gap-1.5 rounded-t-lg px-4 py-2.5 text-sm font-semibold transition cursor-pointer " + (tabHistorial === "valoraciones" ? "bg-white text-blue-600 shadow-[0_-1px_0_0_#fff]" : "text-slate-500 hover:text-slate-800")}
                    >
                      <Eye size={14} /> Valoraciones
                      {consultasPaciente.length > 0 && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">{consultasPaciente.length}</span>}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTabHistorial("citas")}
                      className={"flex items-center gap-1.5 rounded-t-lg px-4 py-2.5 text-sm font-semibold transition cursor-pointer " + (tabHistorial === "citas" ? "bg-white text-blue-600 shadow-[0_-1px_0_0_#fff]" : "text-slate-500 hover:text-slate-800")}
                    >
                      <Calendar size={14} /> Citas
                      {citasPaciente.length > 0 && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-500">{citasPaciente.length}</span>}
                    </button>
                    <button
                      type="button"
                      onClick={() => setTabHistorial("evolucion")}
                      className={"flex items-center gap-1.5 rounded-t-lg px-4 py-2.5 text-sm font-semibold transition cursor-pointer " + (tabHistorial === "evolucion" ? "bg-white text-blue-600 shadow-[0_-1px_0_0_#fff]" : "text-slate-500 hover:text-slate-800")}
                    >
                      <Activity size={14} /> Evolución
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto px-6 py-5">
                    {tabHistorial === "evolucion" ? (
                      consultasPaciente.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-12 text-center">
                          <div className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-300"><Activity size={24} /></div>
                          <p className="text-sm font-medium text-slate-500">Este paciente aún no tiene consultas registradas.</p>
                        </div>
                      ) : (() => {
                        const ultima = consultasPaciente[0]
                        const correccion = CORRECCION[ultima.estadoCorreccion] || CORRECCION["Sin evaluación"]
                        const IconoCorreccion = correccion.icon
                        const tendencia = TENDENCIA[ultima.evolucionCalculada]
                        const colorEstado = CORRECCION_COLOR[ultima.estadoCorreccion] || CORRECCION_COLOR["Sin evaluación"]
                        return (
                          <div className="space-y-4">
                            <div className="flex items-center gap-3 rounded-2xl border p-4" style={{ borderColor: colorEstado.border, backgroundColor: colorEstado.bg }}>
                              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white" style={{ color: colorEstado.fg }}><IconoCorreccion size={20} /></div>
                              <div>
                                <p className="text-base font-bold" style={{ color: colorEstado.fg }}>{ultima.estadoCorreccion || "Sin evaluación"}</p>
                                <p className="text-xs text-slate-500">Estado de corrección más reciente · {ultima.fecha}</p>
                              </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                              <div className="mb-3 flex flex-wrap items-center gap-3">
                                <h3 className="text-sm font-bold" style={{ color: INK }}>Tendencia de graduación medida</h3>
                                {tendencia && (
                                  <span className="flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ backgroundColor: "#f1f5f9", color: tendencia.fg }}>
                                    <tendencia.icon size={12} /> {tendencia.label}
                                  </span>
                                )}
                              </div>
                              <div className="mb-3 flex items-center gap-4">
                                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: OD_COLOR }} /> Ojo derecho</span>
                                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: OI_COLOR }} /> Ojo izquierdo</span>
                                <span className="ml-auto text-[11px] text-slate-500">Equivalente esférico (dioptrías)</span>
                              </div>
                              <GraficoEvolucion consultas={[...consultasPaciente].reverse()} />
                            </div>

                            <p className="flex items-center gap-1.5 rounded-lg bg-slate-50 p-2.5 text-[11px] text-slate-500"><Lock size={12} /> Vista interna — estas medidas nunca se muestran en el portal del paciente.</p>
                          </div>
                        )
                      })()
                    ) : tabHistorial === "citas" ? (
                      citasPaciente.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 py-12 text-center">
                          <div className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-300"><Calendar size={24} /></div>
                          <p className="text-sm font-medium text-slate-500">Este paciente aún no tiene citas registradas.</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-slate-100">
                          {citasPaciente.map((c) => {
                            const atendida = c.estado === "Atendida"
                            const enEspera = c.estado === "En Espera"
                            const noAsistio = c.estado === "No Asistió"
                            const enAtencion = c.estado === "En Atención"
                            return (
                              <div key={c.id} className="flex items-center justify-between py-3.5">
                                <div className="flex items-center gap-3">
                                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: atendida || noAsistio ? "#f1f5f9" : "#eef2ff", color: atendida || noAsistio ? "#64748b" : "#2563eb" }}>
                                    <Calendar size={16} />
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-slate-800">{c.motivo || "Consulta general"}</p>
                                    <p className="text-xs text-slate-500">{c.fecha || "Sin fecha"} · {c.hora || "—"}</p>
                                  </div>
                                </div>
                                <span className={"rounded-full px-2.5 py-1 text-[11px] font-bold " + (atendida ? "bg-slate-100 text-slate-600" : noAsistio ? "border border-red-200 bg-red-50 text-red-700" : enAtencion ? "border border-blue-200 bg-blue-50 text-blue-700" : enEspera ? "border border-amber-200 bg-amber-50 text-amber-700" : "border border-emerald-200 bg-emerald-50 text-emerald-700")}>
                                  {c.estado || "Pendiente"}
                                </span>
                              </div>
                            )
                          })}
                        </div>
                      )
                    ) : consultasPaciente.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-12 text-center">
                        <div className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-300"><AlertCircle size={24} /></div>
                        <p className="text-sm font-medium text-slate-500">Este paciente aún no tiene consultas registradas.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {consultasPaciente.map((c) => {
                          const correccion = CORRECCION[c.estadoCorreccion] || CORRECCION["Sin evaluación"]
                          const IconoCorreccion = correccion.icon
                          const tendencia = TENDENCIA[c.evolucionCalculada]
                          return (
                            <div key={c.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                              <div className="mb-2.5 flex items-center justify-between">
                                <span className="font-mono text-xs font-semibold text-slate-500">{c.fecha}</span>
                                <span className={"inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold " + correccion.clase}>
                                  <IconoCorreccion size={13} /> {correccion.label}
                                </span>
                              </div>
                              {tendencia && (
                                <p className="mb-2 flex items-center gap-1 text-[11px] text-slate-500">
                                  <tendencia.icon size={11} style={{ color: tendencia.fg }} />
                                  Graduación: <span style={{ color: tendencia.fg }}>{tendencia.label.toLowerCase()}</span>
                                </p>
                              )}
                              {c.motivo && (
                                <p className="mb-1 text-sm text-slate-600">
                                  <span className="font-semibold text-slate-700">Motivo:</span> {c.motivo}
                                </p>
                              )}
                              {c.usaLentes && (
                                <p className="mb-2 flex items-center gap-1.5 text-sm text-slate-600">
                                  <Glasses size={13} className="text-slate-400" />
                                  <span className="font-semibold text-slate-700">¿Usa lentes?</span> {c.usaLentes === "si" ? "Sí" : "No"}
                                </p>
                              )}
                              {c.antecedentes && (
                                <p className="mb-2 text-sm text-slate-600">
                                  <span className="font-semibold text-slate-700">Antecedentes:</span> {c.antecedentes}
                                </p>
                              )}
                              {(c.alergias || c.antecedentesFamiliares) && (
                                <div className="mb-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
                                  {c.alergias && <p><span className="font-semibold">Alergias:</span> {c.alergias}</p>}
                                  {c.antecedentesFamiliares && <p><span className="font-semibold">Ant. familiares:</span> {c.antecedentesFamiliares}</p>}
                                </div>
                              )}
                              <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-100 bg-white p-2.5 font-mono text-xs">
                                <div>
                                  <span className="font-bold text-blue-700">OD:</span> {c.od?.esfera} | {c.od?.cilindro} | {c.od?.eje}°
                                  <br /><span className="text-slate-500">AV: {c.od?.avCc || "—"}</span>
                                </div>
                                <div>
                                  <span className="font-bold text-cyan-600">OI:</span> {c.oi?.esfera} | {c.oi?.cilindro} | {c.oi?.eje}°
                                  <br /><span className="text-slate-500">AV: {c.oi?.avCc || "—"}</span>
                                </div>
                              </div>
                              {(c.diagnostico || c.indicaciones || c.lenteRecomendado) && (
                                <div className="mt-2.5 space-y-1.5 border-t border-slate-200 pt-2.5 text-sm">
                                  {c.diagnostico && (
                                    <p><span className="font-semibold text-slate-700">Diagnóstico:</span> <span className="text-slate-600">{c.diagnostico}</span></p>
                                  )}
                                  {c.lenteRecomendado && (
                                    <p className="flex items-center gap-1.5"><Glasses size={13} style={{ color: "#C8A24E" }} /> <span className="font-semibold text-slate-700">Lente:</span> <span className="text-slate-600">{c.lenteRecomendado}</span></p>
                                  )}
                                  {c.productoNombre && (
                                    <p className="flex items-center gap-1.5 text-xs text-blue-600"><CheckCircle size={12} /> Vinculado a bodega: <span className="font-semibold">{c.productoNombre}</span> (1 unidad descontada)</p>
                                  )}
                                  {c.indicaciones && (
                                    <p><span className="font-semibold text-slate-700">Indicaciones:</span> <span className="text-slate-600">{c.indicaciones}</span></p>
                                  )}
                                  {(c.examen?.testMotor || c.examen?.oftalmoscopia || (c.examen?.testColor && c.examen.testColor !== "Normal") || c.examen?.pioOd || c.examen?.pioOi || (c.examen?.coverTestLejos && c.examen.coverTestLejos !== "Ortoforia") || (c.examen?.coverTestCerca && c.examen.coverTestCerca !== "Ortoforia")) && (
                                    <div className="rounded-lg bg-slate-100/70 p-2 text-xs text-slate-500">
                                      {c.examen?.testMotor && <p><span className="font-semibold text-slate-600">Motilidad ocular:</span> {c.examen.testMotor}</p>}
                                      {((c.examen?.coverTestLejos && c.examen.coverTestLejos !== "Ortoforia") || (c.examen?.coverTestCerca && c.examen.coverTestCerca !== "Ortoforia")) && (
                                        <p><span className="font-semibold text-slate-600">Cover test:</span> lejos {c.examen?.coverTestLejos || "—"} · cerca {c.examen?.coverTestCerca || "—"}</p>
                                      )}
                                      {c.examen?.oftalmoscopia && <p><span className="font-semibold text-slate-600">Oftalmoscopia:</span> {c.examen.oftalmoscopia}</p>}
                                      {c.examen?.testColor && c.examen.testColor !== "Normal" && <p><span className="font-semibold text-slate-600">Test de color:</span> {c.examen.testColor}</p>}
                                      {(c.examen?.pioOd || c.examen?.pioOi) && <p><span className="font-semibold text-slate-600">PIO:</span> OD {c.examen?.pioOd || "—"} · OI {c.examen?.pioOi || "—"} mmHg</p>}
                                    </div>
                                  )}
                                  {(c.examen?.biomicroscopia?.parpados || c.examen?.biomicroscopia?.cornea || c.examen?.biomicroscopia?.camara) && (
                                    <div className="rounded-lg bg-slate-100/70 p-2 text-xs text-slate-500">
                                      <p className="mb-0.5 font-semibold text-slate-600">Biomicroscopía:</p>
                                      {c.examen.biomicroscopia?.parpados && <p>Párpados/conjuntiva: {c.examen.biomicroscopia.parpados}</p>}
                                      {c.examen.biomicroscopia?.cornea && <p>Córnea: {c.examen.biomicroscopia.cornea}</p>}
                                      {c.examen.biomicroscopia?.camara && <p>Cámara anterior/cristalino: {c.examen.biomicroscopia.camara}</p>}
                                    </div>
                                  )}
                                  {(c.retinoscopia?.od || c.retinoscopia?.oi) && (
                                    <p className="text-xs text-slate-500"><span className="font-semibold text-slate-600">Retinoscopía:</span> OD {c.retinoscopia?.od || "—"} · OI {c.retinoscopia?.oi || "—"}</p>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </>
              )
            })()}

            <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
              <button type="button" onClick={() => setPacienteHistorial(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => { const p = pacienteHistorial; setPacienteHistorial(null); abrirAgendar(p) }}
                className="flex-1 rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 cursor-pointer"
                style={{ background: GRAD }}
              >
                Agendar nueva cita
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL AGENDAR CITA (desde el perfil del paciente) ─── */}
      {agendarPara && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)" }} onClick={() => setAgendarPara(null)}>
          <div className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
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
              <button type="button" onClick={() => setAgendarPara(null)} className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={validarYPedirConfirmacionCita} className="flex min-h-0 flex-1 flex-col">
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                {errorAgendar && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                    <AlertCircle size={16} /> {errorAgendar}
                  </div>
                )}

                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">Motivo del examen</label>
                  <select
                    value={agendarMotivo}
                    onChange={(e) => setAgendarMotivo(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
                  >
                    <option value="" disabled>Seleccione el motivo del examen</option>
                    {motivosConsulta.map((m) => (<option key={m} value={m}>{m}</option>))}
                  </select>
                </div>

                <SelectorFechaHora
                  disponibilidad={disponibilidad}
                  citas={citas}
                  fecha={agendarFecha}
                  hora={agendarHora}
                  onCambiarFecha={setAgendarFecha}
                  onCambiarHora={setAgendarHora}
                />
              </div>

              <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-5 py-4">
                <button type="button" onClick={() => setAgendarPara(null)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer">
                  Cancelar
                </button>
                <button type="submit" className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 cursor-pointer" style={{ background: GRAD, boxShadow: "0 12px 24px -12px rgba(37,99,235,0.6)" }}>
                  Confirmar cita <ChevronRight size={16} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── CONFIRMACIÓN DE AGENDAMIENTO ─── */}
      {confirmandoCita && agendarPara && (
        <ConfirmarCitaModal
          paciente={agendarPara.nombre}
          motivo={agendarMotivo}
          fecha={agendarFecha ? isoAFechaLocal(agendarFecha).toLocaleDateString("es-EC", { day: "numeric", month: "long", year: "numeric" }) : ""}
          hora={agendarHora}
          onCancelar={() => setConfirmandoCita(false)}
          onConfirmar={confirmarAgendarCita}
        />
      )}
    </div>
  )
}

// Gráfico de tendencia de graduación — solo visible para el optómetra (nunca en el portal del paciente,
// para no facilitar que se lleve sus medidas a otra óptica sin costo).
function GraficoEvolucion({ consultas }) {
  // consultas: más antigua → más reciente
  if (!consultas || consultas.length < 2) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-300"><Activity size={24} /></div>
        <p className="text-sm font-medium text-slate-500">Se necesitan al menos dos consultas para ver la tendencia.</p>
      </div>
    )
  }
  const pts = consultas.map((c) => ({ fecha: c.fecha, od: ee(c.od), oi: ee(c.oi) }))
  const vals = pts.flatMap((p) => [p.od, p.oi])
  let min = Math.min(...vals), max = Math.max(...vals)
  if (min === max) { min -= 1; max += 1 }
  const pad = (max - min) * 0.25 || 0.5
  min -= pad; max += pad
  const W = 560, H = 220, pX = 44, pY = 24
  const x = (i) => pX + (i * (W - 2 * pX)) / (pts.length - 1)
  const y = (v) => pY + ((max - v) * (H - 2 * pY)) / (max - min)
  const path = (key) => pts.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(p[key]).toFixed(1)}`).join(" ")
  const ticks = 4
  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[460px]">
        {Array.from({ length: ticks + 1 }).map((_, i) => {
          const v = max - (i * (max - min)) / ticks
          const yy = y(v)
          return (
            <g key={i}>
              <line x1={pX} y1={yy} x2={W - pX} y2={yy} stroke="#e2e8f0" strokeWidth="1" strokeDasharray={v === 0 ? "0" : "3 4"} />
              <text x={pX - 8} y={yy + 4} textAnchor="end" fontSize="11" fill="#94a3b8" fontFamily="monospace">{v.toFixed(1)}</text>
            </g>
          )
        })}
        {pts.map((p, i) => (
          <text key={i} x={x(i)} y={H - 4} textAnchor="middle" fontSize="10" fill="#94a3b8">{p.fecha?.slice(5)}</text>
        ))}
        <path d={path("od")} fill="none" stroke={OD_COLOR} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d={path("oi")} fill="none" stroke={OI_COLOR} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (<circle key={"od" + i} cx={x(i)} cy={y(p.od)} r="4" fill="#fff" stroke={OD_COLOR} strokeWidth="2.5" />))}
        {pts.map((p, i) => (<circle key={"oi" + i} cx={x(i)} cy={y(p.oi)} r="4" fill="#fff" stroke={OI_COLOR} strokeWidth="2.5" />))}
      </svg>
    </div>
  )
}
