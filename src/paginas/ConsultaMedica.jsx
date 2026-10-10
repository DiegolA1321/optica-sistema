"use client"

import { ahoraEcuador } from "../utilidades/horaEcuador"

import { useState, useEffect, useMemo, useRef } from "react"
import { createPortal } from "react-dom"
import { supabase } from "../lib/supabaseClient"
import {
  Eye,
  FileText,
  ClipboardList,
  CheckCircle,
  Ruler,
  ArrowLeft,
  ArrowRight,
  Save,
  Stethoscope,
  AlertCircle,
  User,
  Sparkles,
  Printer,
  Calendar,
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  Move,
  ScanEye,
  Palette,
  Glasses,
  Droplet,
  CalendarClock,
  XCircle,
  History,
  ChevronDown,
  X,
  Image as ImageIcon,
  Receipt,
  Wrench,
  LogOut,
  ShoppingBag,
} from "lucide-react"
import { filtrarSoloNumeros, filtrarNumeroDecimalConSigno } from "../utilidades/validaciones"
import { hoyISO, diaTieneCupo } from "../utilidades/disponibilidad"
import { sumarDiasISO, diaHabilMasCercano } from "../utilidades/controles"
import { MENSAJE_HORA_INVALIDA, esErrorHoraInvalida } from "../utilidades/erroresCitas"
import SelectorFechaHora from "../componentes/SelectorFechaHora"
import { lineasCobroConsulta } from "../utilidades/costosConsulta"
import ConfirmarFichaModal from "../componentes/ConfirmarFichaModal"
import ConfirmarEliminarModal from "../componentes/ConfirmarEliminarModal"
import ComprobanteVentaModal from "./ComprobanteVentaModal"
import { registrarLog } from "../utilidades/logs"
import { ordenarPorFechaYCreacion } from "../utilidades/fidelizacion"
import { fechaLegible, formatoFecha } from "../utilidades/formatoFecha"
import { variacionEntre, verdictoPorVariacion, tendenciaEntreConsultas, textoDioptrias } from "../utilidades/tendenciaGraduacion"
import { MENSAJE_SIN_PERMISO, esErrorSinPermiso } from "../utilidades/permisos"
import { INK, GOLD } from "@/lib/tema"

// ─── Paleta de firma (consistente con el resto del sistema) ───
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)" // cian → azul

const escalasSnellen = ["20/20", "20/25", "20/30", "20/40", "20/50", "20/70", "20/100", "20/200"]
const ORDEN_SNELLEN = escalasSnellen.reduce((acc, esc, i) => ({ ...acc, [esc]: i }), {})

const PASOS = [
  { id: "anamnesis", n: 1, label: "Anamnesis", icon: ClipboardList },
  { id: "refraccion", n: 2, label: "Refracción", icon: Eye },
  { id: "diagnostico", n: 3, label: "Diagnóstico y receta", icon: FileText },
]

// Tendencia de la graduación medida (solo describe el número, no implica cura ni deterioro clínico)
const TENDENCIA = {
  Disminuyó: { fg: "#0891b2", bg: "#ecfeff", border: "#a5f3fc", icon: TrendingDown, txt: "La graduación medida disminuyó respecto a la consulta anterior." },
  Aumentó: { fg: "#dc2626", bg: "#fef2f2", border: "#fecaca", icon: TrendingUp, txt: "La graduación medida aumentó respecto a la consulta anterior." },
  "Sin cambios": { fg: "#475569", bg: "#f1f5f9", border: "#e2e8f0", icon: Minus, txt: "La graduación medida se mantiene estable." },
}

// Estado de corrección: lo clínicamente relevante — un error refractivo no se autocorrige,
// se maneja con anteojos, lentes de contacto o cirugía refractiva. Esto mide si ese manejo funciona.
const CORRECCION = {
  "Bien corregido": { fg: "#059669", bg: "#ecfdf5", border: "#a7f3d0", icon: CheckCircle, txt: "Con su corrección actual alcanza una buena agudeza visual (20/20–20/25). El manejo con lentes está funcionando." },
  "Requiere ajuste": { fg: "#dc2626", bg: "#fef2f2", border: "#fecaca", icon: AlertCircle, txt: "Incluso con su corrección actual no alcanza una buena agudeza visual. Conviene actualizar la receta o evaluar otras opciones (lentes de contacto, cirugía refractiva)." },
  "Sin evaluar": { fg: "#475569", bg: "#f1f5f9", border: "#e2e8f0", icon: Minus, txt: "No se registró la agudeza visual con corrección de ambos ojos en esta consulta — no se puede saber si el manejo actual (anteojos/lentes) está funcionando." },
}

// Diagnóstico con Diego (2026-09-10): "AV con lentes" arrancaba en "20/20"
// por defecto y nada obligaba a tocarlo, así que "Bien corregido" no
// distinguía "se evaluó y de verdad da 20/20" de "nadie lo evaluó". Ahora
// el campo arranca vacío (ver odAgudezaCc/oiAgudezaCc más abajo) y esta
// función devuelve "Sin evaluar" en vez de asumir 20/20 cuando falta.
const evaluarCorreccion = (avCcOd, avCcOi) => {
  if (!avCcOd || !avCcOi) return "Sin evaluar"
  const odIdx = ORDEN_SNELLEN[avCcOd] ?? 99
  const oiIdx = ORDEN_SNELLEN[avCcOi] ?? 99
  return Math.max(odIdx, oiIdx) <= 1 ? "Bien corregido" : "Requiere ajuste"
}

// El umbral y el cálculo de la tendencia (refracción de hoy vs. visita anterior, y entre las 2 visitas
// anteriores) viven en utilidades/tendenciaGraduacion.js, compartidos con el perfil del paciente.


// Misma escritura que el perfil: coma decimal ("+0,25 D").
const textoVariacion = textoDioptrias

export default function ConsultaMedica({ usuario, disponibilidad, pacientes: pacientesLista = [], setPacientes, consultas: historialConsultas = [], setConsultas: setHistorialConsultas, inventario = [], setInventario, setFacturasVenta, parametrizacion, diagnosticosRapidos = [], motivosConsulta = [], pacienteInicial, citaIdInicial, motivoInicial, citas = [], setCitas, onPacienteInicialConsumido, onVolver, onCerrar, origenNombre = "Pacientes", onCambiosSinGuardarChange, onAviso, pases = [], setPases }) {
  const [subTab, setSubTab] = useState("anamnesis")
  // Cita de origen cuando esta ficha se abrió desde "Atender" en Citas
  // médicas (ver citaIdInicial más abajo) — se guarda aparte de
  // pacienteInicial porque debe seguir disponible al guardar, no solo al
  // momento de precargar el paciente.
  const [citaEnAtencionId, setCitaEnAtencionId] = useState(null)
  // Lo que cambió al abrir la ficha de una cita: el estado anterior (si pasó a
  // "En atención") y si se registró quién atiende. Sirve para "Dejar de atender".
  const aperturaCita = useRef({ estado: null, atendido: false })
  const [mostrarDejarDeAtender, setMostrarDejarDeAtender] = useState(false)
  const [dejandoDeAtender, setDejandoDeAtender] = useState(false)
  const [errorDejarDeAtender, setErrorDejarDeAtender] = useState("")
  // Si la óptica no ofrece progresión, no tiene sentido pedir ese dato (configurable en Configuración)
  const manejaProgresion = parametrizacion?.manejaProgresion !== false

  // --- Buscador y Selección Filtrada de Pacientes ---
  // pacienteId es la fuente de verdad de la selección (igual que en Citas.jsx) —
  // pacienteSeleccionado (el nombre) sólo se deriva de una selección real del
  // desplegable, nunca de lo que el optómetra tecleó. Antes se podía guardar una
  // ficha clínica completa para un nombre que no correspondía a ningún paciente.
  const [pacienteId, setPacienteId] = useState(null)
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState("")
  const [busquedaPaciente, setBusquedaPaciente] = useState("")
  const [mostrarDropdown, setMostrarDropdown] = useState(false)
  const dropdownRef = useRef(null)

  const pacientesFiltrados = useMemo(() => {
    if (!busquedaPaciente.trim()) return pacientesLista
    return pacientesLista.filter(
      (p) =>
        p.nombre.toLowerCase().includes(busquedaPaciente.toLowerCase()) ||
        (p.cedula && p.cedula.includes(busquedaPaciente))
    )
  }, [pacientesLista, busquedaPaciente])

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setMostrarDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // --- Datos de Anamnesis ---
  // toISOString() convierte a UTC antes de recortar la fecha — en Ecuador
  // (UTC-5), guardar una ficha después de las 19:00 hora local quedaba
  // fechada al día calendario SIGUIENTE (afecta receta impresa, historial,
  // próximo control y los reportes por mes). hoyISO() (ya usado en
  // Citas.jsx/Horario.jsx/AgendarCitaPublica.jsx) usa los componentes
  // locales del Date, sin ese salto de zona horaria.
  const [fechaConsulta, setFechaConsulta] = useState(() => hoyISO())
  const [motivo, setMotivo] = useState("")
  // El ing probó este flujo en vivo y separó dos cosas que antes eran un solo
  // campo: "motivo" es la categoría con la que el paciente agendó la cita
  // (se precarga sola cuando se entra desde "Atender" en Citas médicas — ver
  // motivoInicial), "detalleConsulta" es lo que cuenta con sus propias
  // palabras al llegar ("me duelen los ojos..."). Uno es relacional a la
  // cita, el otro es libre y específico de esta visita.
  const [detalleConsulta, setDetalleConsulta] = useState("")
  // Con cita, el motivo llega relleno y se muestra como dato (con "Cambiar");
  // sin cita aparece el selector obligatorio. El detalle es un enlace
  // "+ Agregar detalle" salvo que el motivo sea "Otros" (ahí es obligatorio).
  const [editandoMotivo, setEditandoMotivo] = useState(false)
  const [mostrarDetalle, setMostrarDetalle] = useState(false)
  const detalleRef = useRef(null)
  const [usaLentes, setUsaLentes] = useState("")
  const [antecedentes, setAntecedentes] = useState("")
  const [alergias, setAlergias] = useState("")
  const [antecedentesFamiliares, setAntecedentesFamiliares] = useState("")

  // Rastrea qué campos de anamnesis vienen precargados de una visita anterior (sin editar todavía)
  const [precargado, setPrecargado] = useState({})
  const [fechaPrecarga, setFechaPrecarga] = useState(null)

  // --- Refracción objetiva (retinoscopía) — precede a la subjetiva ---
  const [retinoscopiaOd, setRetinoscopiaOd] = useState("")
  const [retinoscopiaOi, setRetinoscopiaOi] = useState("")

  // --- Ojo Derecho (OD) ---
  // Vacío significa "no medido", nunca "normal" (propuesta de flujo de
  // atención, Ronda 3): ningún campo de refracción arranca con un valor
  // por defecto — los números de ejemplo son solo placeholder.
  const [odEsfera, setOdEsfera] = useState("")
  const [odCilindro, setOdCilindro] = useState("")
  const [odEje, setOdEje] = useState("")
  const [odAgudezaSc, setOdAgudezaSc] = useState("")
  const [odAgudezaCc, setOdAgudezaCc] = useState("")

  // --- Ojo Izquierdo (OI) ---
  const [oiEsfera, setOiEsfera] = useState("")
  const [oiCilindro, setOiCilindro] = useState("")
  const [oiEje, setOiEje] = useState("")
  const [oiAgudezaSc, setOiAgudezaSc] = useState("")
  const [oiAgudezaCc, setOiAgudezaCc] = useState("")

  // --- Adición y Medidas ---
  const [adicion, setAdicion] = useState("")
  const [dp, setDp] = useState("")
  const [alt, setAlt] = useState("")
  const [avCerca, setAvCerca] = useState("")

  // --- Examen físico complementario ---
  const [testMotor, setTestMotor] = useState("")
  const [coverTestLejos, setCoverTestLejos] = useState("Ortoforia")
  const [coverTestCerca, setCoverTestCerca] = useState("Ortoforia")
  const [oftalmoscopia, setOftalmoscopia] = useState("")
  const [testColor, setTestColor] = useState("Normal")
  const [pioOd, setPioOd] = useState("")
  const [pioOi, setPioOi] = useState("")

  // --- Biomicroscopía (segmento anterior, lámpara de hendidura) ---
  const [biomicroParpados, setBiomicroParpados] = useState("")
  const [biomicroCornea, setBiomicroCornea] = useState("")
  const [biomicroCamara, setBiomicroCamara] = useState("")

  // --- Diagnóstico ---
  // Categorías fijas (miopía, astigmatismo, presbicia...) + un detalle libre
  // aparte — caso de la reunión con el ing: antes era un solo campo de texto
  // libre, lo que no permitía luego reportar "cuántos pacientes tengo con
  // miopía". `diagnostico` ahora es el detalle opcional; el texto final que
  // se guarda para mostrar en el resto del sistema (historial, receta
  // impresa) se compone de categorías + detalle al guardar la ficha.
  const [diagnosticoCategorias, setDiagnosticoCategorias] = useState([])
  const [diagnostico, setDiagnostico] = useState("")
  // "¿Recomendar lente?" — el ing insistió en que no todo tratamiento
  // recomienda un lente ("no sé si todos los tratamientos recomiendan un
  // lente") y que vender el lente es un paso APARTE del diagnóstico, no
  // parte del mismo formulario ("no lo incluyo directamente aquí"). Este
  // checkbox es lo que separa ambas cosas: si está apagado, ni el campo de
  // texto ni la búsqueda de inventario se muestran.
  const [recomendarLente, setRecomendarLente] = useState(false)
  const [lenteRecomendado, setLenteRecomendado] = useState("")
  // Vincula el texto libre de arriba a un producto real de inventario —
  // sin esto no hay forma de precargar una línea de cobro real al cerrar
  // la consulta (el texto por sí solo no tiene precio ni stock). Queda
  // aparte del panel de cobro (que se abre al guardar la ficha):
  // esto es específicamente "¿qué lente recomendó el optómetra?", no una
  // factura ya armada — la venta recién se decide después de guardar.
  const [indicaciones, setIndicaciones] = useState("")
  const [proximoControlDias, setProximoControlDias] = useState(180)
  // Qué se hace con el control: ninguna opción viene marcada, el optómetra elige. "ahora" crea la cita al guardar la ficha
  // (con la fecha y la hora que el paciente aceptó); "despues" no crea nada y deja el aviso "Control sin agendar".
  const [controlModo, setControlModo] = useState("")
  const [controlFecha, setControlFecha] = useState("")
  const [controlHora, setControlHora] = useState("")
  // Punto 2.1 (plan 29 sept.): arranca en false en CADA ficha nueva, incluso
  // si el paciente ya está "De alta" — así, si vuelve a consulta y se guarda
  // sin marcarla, su estado_clinico vuelve a "Activo" (pedido explícito de
  // Diego), en vez de quedar "de alta" para siempre por inercia.
  const [tratamientoFinalizado, setTratamientoFinalizado] = useState(false)

  // --- Cobro (Ronda 4 del flujo de atención) ---
  // Antes la ficha mezclaba tres lugares para el dinero (campo "Costo de la
  // consulta", editor "Factura de esta consulta" y el modal "lente sugerido").
  // Ahora la ficha solo captura lo clínico; al guardarla aparece UN panel de
  // cobro (ComprobanteVentaModal, el mismo del perfil del paciente) ya relleno
  // con la consulta (costo base del motivo, editable, puede ser 0) y el lente
  // recomendado si está vinculado a inventario.
  const [consultaGuardadaId, setConsultaGuardadaId] = useState(null)
  const [mostrarPanelCobro, setMostrarPanelCobro] = useState(false)
  const [cobroEstado, setCobroEstado] = useState(null) // null | 'pendiente' | 'cobrado'
  const [cobroTotal, setCobroTotal] = useState(0)
  // "Pasar a la óptica" (R34): deja al paciente "Listo para venta" para quien vende.
  const [pasandoAOptica, setPasandoAOptica] = useState(false)
  const [errorPase, setErrorPase] = useState("")
  const paseDeEstaConsulta = consultaGuardadaId ? pases.find((p) => p.consultaId === consultaGuardadaId) : null
  const pasarAOptica = async () => {
    if (!consultaGuardadaId || !supabase) return
    setPasandoAOptica(true)
    setErrorPase("")
    const { data, error } = await supabase.rpc("pasar_a_optica", { p_consulta_id: consultaGuardadaId })
    setPasandoAOptica(false)
    if (error) {
      setErrorPase(esErrorSinPermiso(error) ? MENSAJE_SIN_PERMISO : "No se pudo pasar al paciente a la óptica. Revisa tu conexión e intenta de nuevo.")
      return
    }
    setPases?.((prev) => (prev.some((p) => p.id === data) ? prev : [{ id: data, consultaId: consultaGuardadaId, pacienteId, citaId: citaEnAtencionId || null, estado: "listo", pasadaPor: usuario?.id || null, pasadaEn: new Date().toISOString(), facturaId: null }, ...prev]))
    registrarLog(usuario, "consultas", "Pasó un paciente a la óptica (listo para venta)", pacienteSeleccionado)
  }

  // Mantiene en sincronía el campo legado consultas.producto_id (lo lee
  // Reportes.jsx para "Conversión a venta", ver Punto 06) cuando la venta se
  // registra DESPUÉS de guardar la ficha.
  const sincronizarProductoConsulta = async (factura) => {
    const linea = factura.lineas?.find((l) => l.tipo === "producto")
    if (!linea || !consultaGuardadaId) return
    const montoVenta = linea.cantidad * linea.precioUnitario
    if (supabase) {
      await supabase.from("consultas").update({ producto_id: linea.productoId, producto_nombre: linea.descripcion, monto_venta: montoVenta }).eq("id", consultaGuardadaId)
    }
    setHistorialConsultas((prev) => prev.map((c) => (c.id === consultaGuardadaId ? { ...c, productoId: linea.productoId, productoNombre: linea.descripcion, montoVenta } : c)))
  }

  // La cita pasa a "Atendida" al terminar la atención: el hecho clínico (atendida)
  // se separa del comercial (vendido o descartado, que sigue el pase a venta).
  const marcarCitaAtendida = async () => {
    if (!citaEnAtencionId || !supabase) return
    const { error: errorCita } = await supabase.from("citas").update({ estado: "Atendida" }).eq("id", citaEnAtencionId)
    if (errorCita) console.error("No se pudo marcar la cita como atendida:", errorCita.message)
    else setCitas?.((prev) => prev.map((c) => (c.id === citaEnAtencionId ? { ...c, estado: "Atendida" } : c)))
  }

  const alCobrar = async (factura) => {
    setFacturasVenta?.((prev) => [factura, ...prev])
    await sincronizarProductoConsulta(factura)
    await marcarCitaAtendida()
    setCobroTotal(Number(factura.montoTotal) || 0)
    setCobroEstado("cobrado")
    registrarLog(usuario, "consultas", "Cobró la atención desde la ficha clínica", `$${(Number(factura.montoTotal) || 0).toFixed(2)}`)
  }

  // "Dejar de atender" (R32): no se pospone. Lo que no se guardó se pierde y la
  // cita queda como estaba: si pasó a "En atención" al abrir la ficha, vuelve a
  // su estado anterior (una cita creada al vuelo con "Atender ahora" queda
  // pendiente), y deja de figurar quien atendía.
  const dejarDeAtender = async () => {
    setDejandoDeAtender(true)
    setErrorDejarDeAtender("")
    const cita = citaDeLaVisita
    const estadoDestino = aperturaCita.current.estado || (cita?.estado === "En Atención" ? "Pendiente" : null)
    const cambios = {}
    if (estadoDestino && cita?.estado !== estadoDestino) cambios.estado = estadoDestino
    if (cita?.atendidoPor && cita.atendidoPor === usuario?.id) cambios.atendido_por = null
    if (supabase && citaEnAtencionId && Object.keys(cambios).length > 0) {
      const { error } = await supabase.from("citas").update(cambios).eq("id", citaEnAtencionId)
      if (error) {
        setErrorDejarDeAtender("No se pudo devolver la cita a su estado anterior. Revisa tu conexión e intenta de nuevo.")
        setDejandoDeAtender(false)
        return
      }
    }
    setCitas?.((prev) => prev.map((c) => (c.id === citaEnAtencionId ? { ...c, ...(cambios.estado ? { estado: cambios.estado } : {}), ...("atendido_por" in cambios ? { atendidoPor: null } : {}) } : c)))
    registrarLog(usuario, "consultas", "Dejó de atender a un paciente", pacienteSeleccionado)
    onCambiosSinGuardarChange?.(false)
    onAviso?.(`Dejaste de atender a ${pacienteSeleccionado}. La cita sigue agendada.`)
    setDejandoDeAtender(false)
    setMostrarDejarDeAtender(false)
    ;(onCerrar || onVolver)?.()
  }


  // --- Imágenes adjuntas (opcional) — se suben a Storage recién al
  // confirmar guardado, no antes, para no dejar archivos huérfanos si el
  // optómetra cancela la ficha a medio llenar. ---
  const [archivosImagenes, setArchivosImagenes] = useState([])
  const agregarArchivosImagenes = (lista) => {
    const nuevos = Array.from(lista).filter((f) => f.type.startsWith("image/"))
    setArchivosImagenes((prev) => [...prev, ...nuevos].slice(0, 6))
  }
  const quitarArchivoImagen = (idx) => setArchivosImagenes((prev) => prev.filter((_, i) => i !== idx))

  // Antes cada re-render llamaba URL.createObjectURL(f) directo en el .map()
  // de miniaturas — una URL de blob nueva sin liberar la anterior en cada
  // render, en el módulo que más tiempo abierto pasa durante una consulta.
  // Memoizada por lista de archivos + revocada en el cleanup del efecto
  // (se dispara antes del siguiente cómputo y al desmontar).
  const previsualizacionesImagenes = useMemo(() => archivosImagenes.map((f) => URL.createObjectURL(f)), [archivosImagenes])
  useEffect(() => {
    return () => previsualizacionesImagenes.forEach((url) => URL.revokeObjectURL(url))
  }, [previsualizacionesImagenes])

  const [notificacion, setNotificacion] = useState(false)
  const [errores, setErrores] = useState({})
  const [bannerError, setBannerError] = useState("")
  const [fichaGuardada, setFichaGuardada] = useState(false)
  const [mostrarConfirmarGuardar, setMostrarConfirmarGuardar] = useState(false)
  const [guardandoFicha, setGuardandoFicha] = useState(false)
  const [errorConfirmarFicha, setErrorConfirmarFicha] = useState("")

  // ── Aviso de cambios sin guardar (Lote 1 del audit UX, punto 1b) ──
  // "Dirty tracking" contra la lista de campos clínicos editables. Arranca
  // en pausa (`detectarCambios`) al montar y tras cada resetForm(), porque
  // el precargado inicial (receta/motivo de la cita) y la limpieza de
  // campos al iniciar una consulta nueva también disparan estos mismos
  // setters — sin la pausa, el aviso saltaría de entrada sin que el
  // usuario haya tocado nada.
  const [hayCambiosSinGuardar, setHayCambiosSinGuardar] = useState(false)
  const detectarCambios = useRef(false)
  const activarDeteccionCambios = () => {
    detectarCambios.current = false
    setTimeout(() => { detectarCambios.current = true }, 400)
  }
  useEffect(() => { activarDeteccionCambios() }, [])
  useEffect(() => {
    if (detectarCambios.current) setHayCambiosSinGuardar(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    motivo, detalleConsulta, usaLentes, antecedentes, alergias, antecedentesFamiliares,
    retinoscopiaOd, retinoscopiaOi, odEsfera, odCilindro, odEje, odAgudezaSc, odAgudezaCc,
    oiEsfera, oiCilindro, oiEje, oiAgudezaSc, oiAgudezaCc, adicion, dp, alt, avCerca,
    testMotor, coverTestLejos, coverTestCerca, oftalmoscopia, testColor, pioOd, pioOi,
    biomicroParpados, biomicroCornea, biomicroCamara, diagnosticoCategorias, diagnostico,
    recomendarLente, lenteRecomendado, indicaciones, proximoControlDias, controlModo, controlFecha, controlHora, tratamientoFinalizado, archivosImagenes,
  ])
  // Cierre de pestaña/recarga — el aviso in-app (navegar a otra sección) lo
  // maneja Dashboard.jsx vía onCambiosSinGuardarChange, no acá.
  useEffect(() => {
    const alCerrar = (e) => {
      if (!hayCambiosSinGuardar) return
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", alCerrar)
    return () => window.removeEventListener("beforeunload", alCerrar)
  }, [hayCambiosSinGuardar])
  // Reporta el estado a Dashboard.jsx, que es quien controla la navegación
  // por sidebar/Ctrl+K/campanita (todas pasan por su función navegar(), no
  // por onVolver/onCerrar de acá abajo) — navegar() ya limpia el flag del
  // lado de Dashboard al confirmar la salida, así que no hace falta un
  // efecto de desmontaje acá también.
  useEffect(() => {
    onCambiosSinGuardarChange?.(hayCambiosSinGuardar)
  }, [hayCambiosSinGuardar, onCambiosSinGuardarChange])

  // Secciones opcionales colapsadas por defecto — lo obligatorio queda fijo y a
  // la vista, lo opcional se expande solo si se necesita (feedback del asesor).
  // "antecedentesPaciente" es la excepción: empieza ABIERTA (primer paciente,
  // sin historial todavía que resumir) y seleccionarPacienteCombo la cierra
  // sola apenas detecta que ese paciente ya tiene antecedentes/alergias/etc.
  // registrados de una visita anterior — pedido de Diego: no repetir el
  // formulario completo en cada visita de un paciente que ya lo llenó.
  const [seccionesAbiertas, setSeccionesAbiertas] = useState({ antecedentesPaciente: true, refraccionSubjetiva: true })
  const alternarSeccion = (id) => setSeccionesAbiertas((prev) => ({ ...prev, [id]: !prev[id] }))
  // Si hay algo que resumir en el cuadro colapsado (antecedentes ya
  // registrados de antes) — independiente de si el usuario los editó justo
  // ahora, que ya no cuenta como "precargado" campo por campo.
  const [tieneHistorialAntecedentes, setTieneHistorialAntecedentes] = useState(false)

  // Al elegir "Otros" el detalle pasa a ser obligatorio: el foco va directo ahí.
  useEffect(() => {
    if (motivo === "Otros") detalleRef.current?.focus()
  }, [motivo])

  // Scroll automático al inicio del formulario al cambiar de paso
  const inicioFormRef = useRef(null)
  useEffect(() => {
    inicioFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [subTab])

  // Acceso rápido al historial clínico del paciente sin salir del flujo de consulta
  const [mostrarHistorial, setMostrarHistorial] = useState(false)
  // Si el sistema detecta que es la primera consulta del paciente, avisa solo
  // (feedback del asesor) en vez de dejar que pase desapercibido y se salte
  // el registro de antecedentes.
  const [avisoPrimeraVisita, setAvisoPrimeraVisita] = useState(false)
  const historialPaciente = useMemo(() => {
    if (!pacienteId) return []
    return historialConsultas.filter((c) => c.pacienteId === pacienteId).sort(ordenarPorFechaYCreacion)
  }, [historialConsultas, pacienteId])

  const ultimaConsultaPaciente = useMemo(() => {
    if (!pacienteId && !pacienteSeleccionado) return null
    return historialConsultas.find((c) => (pacienteId && c.pacienteId === pacienteId) || c.paciente === pacienteSeleccionado)
  }, [pacienteId, pacienteSeleccionado, historialConsultas])

  // --- Cálculo Clínico de Evolución (Equivalente Esférico) ---
  const calcularEvolucionIA = useMemo(() => {
    if (!ultimaConsultaPaciente) return "Primera consulta"

    // Sin refracción registrada hoy (o sin un ojo comparable) no hay
    // veredicto: "Sin evaluación", nunca un "Sin cambios" falso.
    const variacionPromedio = variacionEntre(
      { od: { esfera: odEsfera, cilindro: odCilindro }, oi: { esfera: oiEsfera, cilindro: oiCilindro } },
      ultimaConsultaPaciente,
    )
    return variacionPromedio === null ? "Sin evaluación" : verdictoPorVariacion(variacionPromedio)
  }, [odEsfera, odCilindro, oiEsfera, oiCilindro, ultimaConsultaPaciente])

  // --- Estado de corrección: ¿la corrección actual (anteojos/lentes) logra buena AV? ---
  const estadoCorreccionActual = useMemo(
    () => evaluarCorreccion(odAgudezaCc, oiAgudezaCc),
    [odAgudezaCc, oiAgudezaCc],
  )
  // --- Detalle del análisis (solo para mostrar; no altera la lógica) ---
  const analisisEvolucion = useMemo(() => {
    if (!ultimaConsultaPaciente) return { primera: true, variacion: null }
    const variacion = variacionEntre(
      { od: { esfera: odEsfera, cilindro: odCilindro }, oi: { esfera: oiEsfera, cilindro: oiCilindro } },
      ultimaConsultaPaciente,
    )
    return { primera: false, variacion, fechaPrev: ultimaConsultaPaciente.fecha, verdicto: calcularEvolucionIA }
  }, [odEsfera, odCilindro, oiEsfera, oiCilindro, ultimaConsultaPaciente, calcularEvolucionIA])

  // --- Tendencia histórica (entre las 2 visitas anteriores, sin depender de
  // la refracción de hoy) — contexto que sí puede mostrarse antes de
  // empezar a refractar. Distinta de analisisEvolucion/calcularEvolucionIA
  // arriba, que comparan la refracción de hoy contra la visita anterior y
  // solo tienen sentido una vez que hay datos de hoy que comparar (ver
  // "Comparación con la refracción de hoy" en PanelEvolucion). Decisión de
  // Diego, 30 sept.
  const tendenciaHistorica = useMemo(() => tendenciaEntreConsultas(historialPaciente), [historialPaciente])

  const seleccionarPacienteCombo = (paciente) => {
    setPacienteId(paciente.id)
    setPacienteSeleccionado(paciente.nombre)
    setBusquedaPaciente(paciente.nombre)
    limpiarError("paciente")
    setMostrarDropdown(false)

    // Se recalcula de cero en cada selección: si el paciente nuevo no tiene un campo
    // en su historial, no debe arrastrar el valor que había quedado de la selección anterior.
    const prev = historialConsultas.find((c) => c.pacienteId === paciente.id || c.paciente === paciente.nombre)
    const camposPrecargados = {}

    setAntecedentes(prev?.antecedentes || "")
    if (prev?.antecedentes) camposPrecargados.antecedentes = true

    setAlergias(prev?.alergias || "")
    if (prev?.alergias) camposPrecargados.alergias = true

    setAntecedentesFamiliares(prev?.antecedentesFamiliares || "")
    if (prev?.antecedentesFamiliares) camposPrecargados.antecedentesFamiliares = true

    setUsaLentes(prev?.usaLentes || "")
    if (prev?.usaLentes) camposPrecargados.usaLentes = true

    setPrecargado(camposPrecargados)
    const hayHistorial = Object.keys(camposPrecargados).length > 0
    setFechaPrecarga(hayHistorial ? prev.fecha : null)
    setAvisoPrimeraVisita(!prev)
    // Con historial ya registrado, el cuadro arranca colapsado (no repetir el
    // formulario completo); sin historial, arranca abierto para completarlo.
    setTieneHistorialAntecedentes(hayHistorial)
    setSeccionesAbiertas((s) => ({ ...s, antecedentesPaciente: !hayHistorial }))
    // ING7: si ya tiene historia clínica registrada, la ficha abre directo
    // en Refracción (el resumen plegable de antecedentes queda arriba de
    // los 3 pasos, ver más abajo) — un paciente nuevo sigue abriendo en
    // Anamnesis para registrar sus antecedentes por primera vez. Se fija
    // explícitamente en los dos casos (no solo cuando hay historial) por si
    // se reselecciona un paciente distinto a mitad de sesión.
    // Propuesta de flujo de atención (Ronda 3): primero el contexto del
    // paciente y el motivo, después la captura — la ficha abre siempre en el
    // paso 1, con o sin historial (antes abría en Refracción si ya tenía).
    setSubTab("anamnesis")
    // La detección de cambios solo se pausaba al montar el componente o al
    // reiniciar el formulario — buscar y elegir un paciente casi siempre
    // toma más de los 400ms de esa pausa, así que la precarga de
    // antecedentes/alergias/etc. de arriba (todos campos vigilados por el
    // dirty-tracking) podía disparar el aviso de "cambios sin guardar" antes
    // de que el optómetra tocara nada. Se re-arma acá también.
    activarDeteccionCambios()
  }

  // Llega desde "¿Deseas abrir su ficha clínica ahora?" al crear un paciente en
  // Pacientes.jsx, o desde "Atender" en Citas médicas (en ese caso también
  // trae citaIdInicial) — lo preselecciona para no tener que buscarlo de
  // nuevo aquí.
  useEffect(() => {
    if (!pacienteInicial) return
    seleccionarPacienteCombo(pacienteInicial)
    if (citaIdInicial) {
      setCitaEnAtencionId(citaIdInicial)
      // "En Atención" (azul) apenas se abre la consulta — antes solo pasaba
      // si se entraba por el botón "Atender" de Citas médicas (marcarEstado
      // ahí mismo); entrando por "Ficha clínica" desde el perfil del
      // paciente la cita se quedaba en "Pendiente" hasta guardar la ficha,
      // saltándose el estado intermedio sin que nadie lo pidiera así.
      const citaActual = citas.find((c) => c.id === citaIdInicial)
      aperturaCita.current = { estado: null, atendido: false }
      if (citaActual && !["Atendida", "Cancelada", "No Asistió", "En Atención"].includes(citaActual.estado)) {
        aperturaCita.current.estado = citaActual.estado
        supabase?.from("citas").update({ estado: "En Atención" }).eq("id", citaIdInicial).then(({ error }) => {
          if (!error) setCitas?.((prev) => prev.map((c) => (c.id === citaIdInicial ? { ...c, estado: "En Atención" } : c)))
        })
      }
      // "Atendido por" (R12, R18): quien abre la ficha de la cita queda
      // registrado solo, sin pedirlo, si la cita aún no tiene a nadie. Al
      // guardar la ficha se confirma con quien la guardó. Va en una llamada
      // aparte para que un fallo aquí nunca impida el cambio de estado de arriba.
      if (citaActual && usuario?.id && usuario.rol !== "superadmin" && !["Atendida", "Cancelada"].includes(citaActual.estado) && !citaActual.atendidoPor) {
        aperturaCita.current.atendido = true
        supabase?.from("citas").update({ atendido_por: usuario.id }).eq("id", citaIdInicial).then(({ error }) => {
          if (error) console.warn("No se pudo registrar quién atiende la cita:", error.message)
          else setCitas?.((prev) => prev.map((c) => (c.id === citaIdInicial ? { ...c, atendidoPor: usuario.id } : c)))
        })
      }
    }
    // El motivo ya se eligió al agendar la cita (categoría fija) — el ing
    // probó "Atender" y esperaba verlo ya puesto acá, no volver a escribirlo:
    // "el motivo de la consulta debería estar registrado ahí porque está en
    // la cita". Si la cita es de antes de este catálogo (o su motivo ya no
    // está en Configuración), cae en "Otros" y el texto original no se
    // pierde: pasa al detalle.
    if (motivoInicial) {
      if (motivosConsulta.includes(motivoInicial)) {
        setMotivo(motivoInicial)
      } else {
        setMotivo("Otros")
        setDetalleConsulta(motivoInicial)
      }
    }
    onPacienteInicialConsumido?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteInicial])

  const resetForm = () => {
    // Pausa la detección de cambios mientras se limpian los campos abajo —
    // si no, el propio reset (todo pasa de lleno a vacío) se marcaría a sí
    // mismo como "cambios sin guardar" del usuario.
    detectarCambios.current = false
    // No reseteaba la fecha — tras guardar y pasar a "Nueva consulta" para
    // el siguiente paciente, la fecha se quedaba en lo que fuera que tuviera
    // el campo (la de la consulta anterior, o una que el optómetra haya
    // tocado a mano), en vez de volver a hoy por defecto.
    setFechaConsulta(hoyISO())
    setPacienteId(null)
    setPacienteSeleccionado("")
    setBusquedaPaciente("")
    setMotivo("")
    setDetalleConsulta("")
    setUsaLentes("")
    setAntecedentes("")
    setAlergias("")
    setAntecedentesFamiliares("")
    setPrecargado({})
    setFechaPrecarga(null)
    setRetinoscopiaOd("")
    setRetinoscopiaOi("")
    setOdEsfera("")
    setOdCilindro("")
    setOdEje("")
    setOdAgudezaSc("")
    setOdAgudezaCc("")
    setOiEsfera("")
    setOiCilindro("")
    setOiEje("")
    setOiAgudezaSc("")
    setOiAgudezaCc("")
    setAdicion("")
    setDp("")
    setAlt("")
    setAvCerca("")
    setTestMotor("")
    setCoverTestLejos("Ortoforia")
    setCoverTestCerca("Ortoforia")
    setOftalmoscopia("")
    setTestColor("Normal")
    setPioOd("")
    setPioOi("")
    setBiomicroParpados("")
    setBiomicroCornea("")
    setBiomicroCamara("")
    setDiagnosticoCategorias([])
    setDiagnostico("")
    setRecomendarLente(false)
    setLenteRecomendado("")
    setIndicaciones("")
    setProximoControlDias(180)
    setControlModo("")
    setControlFecha("")
    setControlHora("")
    setTratamientoFinalizado(false)
    setMostrarPanelCobro(false)
    setCobroEstado(null)
    setCobroTotal(0)
    setConsultaGuardadaId(null)
    setErrores({})
    setBannerError("")
    setFichaGuardada(false)
    setSubTab("anamnesis")
    setSeccionesAbiertas({ antecedentesPaciente: true, refraccionSubjetiva: true })
    setEditandoMotivo(false)
    setMostrarDetalle(false)
    setTieneHistorialAntecedentes(false)
    setMostrarHistorial(false)
    setHayCambiosSinGuardar(false)
    activarDeteccionCambios()
  }

  // Valida los 3 pasos y, si todo está bien, abre el paso de confirmación antes de guardar
  const intentarGuardar = (e) => {
    e.preventDefault()

    for (const paso of ["anamnesis", "refraccion", "diagnostico"]) {
      const errs = validarPaso(paso)
      if (Object.keys(errs).length > 0) {
        setErrores(errs)
        setBannerError(mensajeBanner(paso, errs))
        setSubTab(paso)
        return
      }
    }

    setMostrarConfirmarGuardar(true)
  }

  // Guardado real de la ficha clínica, disparado tras confirmar en el modal
  const confirmarGuardarFicha = async () => {
    setGuardandoFicha(true)
    setErrorConfirmarFicha("")

    const tendenciaGraduacion = calcularEvolucionIA
    const estadoCorreccion = estadoCorreccionActual
    // Punto 2.1 (plan 29 sept.): toda ficha decide explícitamente el estado
    // clínico del paciente — "De alta" si se marcó la casilla, "Activo" si
    // no (incluso para un paciente que ya estaba de alta y vuelve a consulta).
    const nuevoEstadoClinico = tratamientoFinalizado ? "De alta" : "Activo"
    const nuevaFicha = {
      fecha: fechaConsulta,
      pacienteId,
      // Sin esto, el aviso de cobro pendiente (Citas/perfil) no vería esta
      // consulta hasta recargar la página.
      citaId: citaEnAtencionId || null,
      paciente: pacienteSeleccionado,
      motivo,
      detalleConsulta,
      usaLentes,
      antecedentes,
      alergias,
      antecedentesFamiliares,
      retinoscopia: { od: retinoscopiaOd, oi: retinoscopiaOi },
      od: { esfera: odEsfera, cilindro: odCilindro, eje: odEje, avSc: odAgudezaSc, avCc: odAgudezaCc },
      oi: { esfera: oiEsfera, cilindro: oiCilindro, eje: oiEje, avSc: oiAgudezaSc, avCc: oiAgudezaCc },
      medidas: { adicion, dp, alt, avCerca },
      examen: {
        testMotor, coverTestLejos, coverTestCerca, oftalmoscopia, testColor, pioOd, pioOi,
        biomicroscopia: { parpados: biomicroParpados, cornea: biomicroCornea, camara: biomicroCamara },
      },
      diagnosticoCategorias,
      // Texto compuesto (categorías + detalle) — es lo que sigue mostrando
      // el historial del paciente y la receta impresa, sin tener que tocar
      // esas pantallas.
      diagnostico: [diagnosticoCategorias.join(", "), diagnostico.trim()].filter(Boolean).join(" — "),
      lenteRecomendado,
      indicaciones,
      proximoControlDias,
      controlAgenda: tratamientoFinalizado ? null : controlModo || null,
      evolucionCalculada: tendenciaGraduacion,
      estadoCorreccion,
      // Se llenan al cobrar (sincronizarProductoConsulta) si se vende un producto.
      productoId: null,
      productoNombre: null,
      montoVenta: null,
    }

    nuevaFicha.profesionalNombre = usuario?.nombre || null
    nuevaFicha.profesionalRegistro = usuario?.registroProfesional || null

    // Declarada acá (no dentro del bloque de abajo) para poder usarla más
    // abajo al intentar crear la factura — nuevaFicha.id se sobreescribe a
    // un id local (Date.now()) si Supabase no está configurado, así que no
    // sirve para distinguir "sí se guardó de verdad" en ese caso límite.
    let idConsultaGuardada = null

    if (supabase && usuario?.opticaId) {
      // Sube las imágenes seleccionadas recién ahora (confirmado el
      // guardado) — un archivo que no llega a subir no bloquea la ficha,
      // solo se omite y se avisa aparte (nunca se pierde la consulta por
      // un adjunto fallido).
      // En paralelo en vez de una por una — el índice en la ruta (además del
      // timestamp) evita colisión si dos suben en el mismo milisegundo.
      const resultadosSubida = await Promise.all(
        archivosImagenes.map(async (archivo, i) => {
          const ruta = `${usuario.opticaId}/${pacienteId || "sin-paciente"}-${Date.now()}-${i}-${archivo.name}`
          const { error: errorSubida } = await supabase.storage.from("consultas-adjuntos").upload(ruta, archivo)
          return errorSubida ? null : { path: ruta, nombre: archivo.name }
        })
      )
      nuevaFicha.imagenes = resultadosSubida.filter(Boolean)

      const { data, error } = await supabase
        .from("consultas")
        .insert({
          optica_id: usuario.opticaId,
          paciente_id: typeof pacienteId === "string" ? pacienteId : null,
          paciente: nuevaFicha.paciente,
          fecha: nuevaFicha.fecha,
          motivo: nuevaFicha.motivo,
          detalle_consulta: nuevaFicha.detalleConsulta,
          usa_lentes: nuevaFicha.usaLentes === "si",
          antecedentes: nuevaFicha.antecedentes,
          alergias: nuevaFicha.alergias,
          antecedentes_familiares: nuevaFicha.antecedentesFamiliares,
          datos_clinicos: { retinoscopia: nuevaFicha.retinoscopia, od: nuevaFicha.od, oi: nuevaFicha.oi, medidas: nuevaFicha.medidas, examen: nuevaFicha.examen, control_agenda: nuevaFicha.controlAgenda, control_asignado_a: nuevaFicha.controlAgenda ? usuario?.id || null : null },
          diagnostico: nuevaFicha.diagnostico,
          diagnostico_categorias: nuevaFicha.diagnosticoCategorias,
          lente_recomendado: nuevaFicha.lenteRecomendado,
          indicaciones: nuevaFicha.indicaciones,
          proximo_control_dias: nuevaFicha.proximoControlDias,
          evolucion_calculada: nuevaFicha.evolucionCalculada,
          estado_correccion: nuevaFicha.estadoCorreccion,
          producto_id: nuevaFicha.productoId,
          producto_nombre: nuevaFicha.productoNombre,
          monto_venta: nuevaFicha.montoVenta,
          profesional_nombre: nuevaFicha.profesionalNombre,
          profesional_registro: nuevaFicha.profesionalRegistro,
          imagenes: nuevaFicha.imagenes,
          // Vincula la consulta con la cita que la originó (0079) — sin
          // duplicar el registro: la cita conserva su fecha/hora agendada,
          // esta consulta ya trae su propia fecha real (fechaConsulta,
          // arranca en hoyISO()) para el caso de una cita atendida en un
          // día distinto al agendado (punto 3, reunión 29 sept.).
          cita_id: citaEnAtencionId || null,
        })
        .select()
        .single()
      // Antes esto solo se registraba en consola y seguía como si hubiera
      // guardado bien — el optómetra veía "guardado con éxito" y una receta
      // lista para imprimir de una consulta que nunca llegó a la base de
      // datos. Ahora se detiene y avisa, igual que cualquier otro paso.
      if (error) {
        setGuardandoFicha(false)
        setErrorConfirmarFicha(
          esErrorSinPermiso(error)
            ? MENSAJE_SIN_PERMISO
            : "No se pudo guardar la ficha clínica. Revisa tu conexión e intenta de nuevo — nada se imprimió ni se guardó todavía."
        )
        return
      }
      if (data) {
        nuevaFicha.id = data.id
        // Desempate de historialPaciente cuando hay más de una consulta el
        // mismo día — sin esto, la ficha recién guardada quedaría sin la
        // marca que necesita para ordenarse como la más reciente hasta el
        // siguiente reload.
        nuevaFicha.creadoEn = data.created_at
        idConsultaGuardada = data.id
        setConsultaGuardadaId(data.id)
      }
      // Hallazgo I4: era el único módulo que crea/edita historia clínica sin
      // dejar rastro de auditoría — la auditoría de superadmin/admin ya
      // existía para el resto del sistema, esta era la excepción real.
      registrarLog(usuario, "consultas", "Registró una ficha clínica", `${nuevaFicha.paciente} · ${fechaLegible(nuevaFicha.fecha)}`)
      const { error: errorPaciente } = await supabase.from("pacientes").update({ evolucion: tendenciaGraduacion, estado_correccion: estadoCorreccion, ultima_consulta: fechaConsulta, estado_clinico: nuevoEstadoClinico }).eq("id", pacienteId)
      if (errorPaciente) console.error("La ficha se guardó, pero no se pudo actualizar el resumen del paciente:", errorPaciente.message)

    }

    if (nuevaFicha.id == null) nuevaFicha.id = Date.now()

    setHistorialConsultas([nuevaFicha, ...historialConsultas])

    // "Agendar ahora": la cita del control se crea recién con la ficha guardada. Si no se pudo crear, la ficha ya está a salvo:
    // el control queda como "sin agendar" (aviso en Inicio y en el perfil) y se le dice al optómetra.
    if (controlModo === "ahora" && !tratamientoFinalizado && controlFecha && controlHora) {
      const paciente = pacientesLista.find((p) => p.id === pacienteId)
      const motivoControl = motivosConsulta.find((m) => /control/i.test(m)) || "Examen de Control"
      const citaControl = {
        pacienteId, paciente: nuevaFicha.paciente, cedula: paciente?.cedula, telefono: paciente?.telefono,
        fecha: controlFecha, hora: controlHora, duracionMinutos: null, motivo: motivoControl, asignadoA: usuario?.id || null, atendidoPor: null,
        iniciales: (nuevaFicha.paciente || "P").split(" ").filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase() || "P",
        estado: "Pendiente",
      }
      let errorControl = ""
      if (supabase && usuario?.opticaId) {
        const { data: citaGuardada, error: errorInsert } = await supabase
          .from("citas")
          .insert({
            optica_id: usuario.opticaId,
            paciente_id: typeof pacienteId === "string" ? pacienteId : null,
            paciente: citaControl.paciente, cedula: citaControl.cedula, telefono: citaControl.telefono,
            fecha: citaControl.fecha, hora: citaControl.hora, motivo: citaControl.motivo, estado: "Pendiente",
            asignado_a: citaControl.asignadoA,
          })
          .select()
          .single()
        if (errorInsert) {
          errorControl = errorInsert.code === "23505" ? "ese horario ya lo tomó otra persona" : esErrorHoraInvalida(errorInsert) ? MENSAJE_HORA_INVALIDA.toLowerCase().replace(/\.$/, "") : esErrorSinPermiso(errorInsert) ? "no tienes permiso para agendar citas" : "revisa tu conexión"
        } else {
          citaControl.id = citaGuardada.id
          citaControl.creadoEn = citaGuardada.created_at
        }
      } else {
        citaControl.id = Date.now()
      }
      if (errorControl) onAviso?.(`La ficha se guardó, pero no se pudo agendar el control (${errorControl}). Agéndalo desde el perfil del paciente.`)
      else {
        setCitas?.((prev) => [...prev, citaControl])
        registrarLog(usuario, "citas", "Agendó el control desde la ficha clínica", `${citaControl.paciente} · ${fechaLegible(citaControl.fecha)}`)
        onAviso?.(`Control agendado para el ${fechaLegible(citaControl.fecha)} a las ${citaControl.hora}.`)
      }
    }

    if (pacientesLista.length > 0 && setPacientes) {
      const pacientesActualizados = pacientesLista.map((p) => {
        if (p.id === pacienteId) {
          return { ...p, evolucion: tendenciaGraduacion, estadoCorreccion, ultimaConsulta: fechaConsulta, estadoClinico: nuevoEstadoClinico }
        }
        return p
      })
      setPacientes(pacientesActualizados)
    }

    if (citaEnAtencionId && supabase && usuario?.id && usuario.rol !== "superadmin" && citaDeLaVisita?.atendidoPor !== usuario.id) {
      supabase.from("citas").update({ atendido_por: usuario.id }).eq("id", citaEnAtencionId).then(({ error }) => {
        if (error) console.warn("No se pudo registrar quién guardó la ficha:", error.message)
        else setCitas?.((prev) => prev.map((c) => (c.id === citaEnAtencionId ? { ...c, atendidoPor: usuario.id } : c)))
      })
    }

    await marcarCitaAtendida()

    setGuardandoFicha(false)
    setMostrarConfirmarGuardar(false)
    setNotificacion(true)
    setTimeout(() => setNotificacion(false), 3500)
    setFichaGuardada(true)
    setHayCambiosSinGuardar(false)
    setSubTab("diagnostico")
    // La atención terminó: la receta queda lista y el paciente se pasa a la óptica
    // (o se cobra ahí mismo) desde el bloque de "Atención terminada".
    setCobroEstado("terminada")
    setErrorPase("")
  }

  // ── Validación por paso ──
  const esNumero = (v) => v !== "" && v !== null && v !== undefined && !isNaN(parseFloat(v))

  const validarPaso = (paso) => {
    const errs = {}
    if (paso === "anamnesis") {
      if (!pacienteId) errs.paciente = busquedaPaciente.trim()
        ? "Ese nombre no coincide con ningún paciente registrado. Selecciónalo de la lista."
        : "Selecciona un paciente registrado de la lista."
      // El motivo se decide antes de capturar nada (viene de la cita, o se
      // elige acá si la ficha se abrió sin cita) — es obligatorio.
      else if (!motivo.trim()) errs.motivo = "Selecciona el motivo de la consulta."
      // "Otros" no dice nada por sí solo — si se elige, el detalle deja de ser opcional.
      else if (motivo === "Otros" && !detalleConsulta.trim()) errs.detalleConsulta = "Describe el motivo."
    } else if (paso === "refraccion") {
      // Refracción: todo opcional (puede haber citas que no midan algunos
      // valores). Solo se valida lo que sí se escribió: que sea un número, el
      // rango del eje, y que un cilindro real traiga su eje.
      for (const [pre, esf, cil, eje] of [["od", odEsfera, odCilindro, odEje], ["oi", oiEsfera, oiCilindro, oiEje]]) {
        if (esf.trim() && !esNumero(esf)) errs[`${pre}_esfera`] = "Número no válido"
        if (cil.trim() && !esNumero(cil)) errs[`${pre}_cilindro`] = "Número no válido"
        if (eje.trim()) {
          if (!esNumero(eje)) errs[`${pre}_eje`] = "Número no válido"
          else if (parseFloat(eje) < 0 || parseFloat(eje) > 180) errs[`${pre}_eje`] = "El eje va de 0° a 180°"
        } else if (esNumero(cil) && parseFloat(cil) !== 0) {
          errs[`${pre}_eje`] = "Indica el eje del cilindro"
        }
      }
    } else if (paso === "diagnostico") {
      if (diagnosticoCategorias.length === 0) errs.diagnostico = "Selecciona al menos una categoría de diagnóstico."
      // "Otro" no dice nada por sí solo — es la única fuente del diagnóstico
      // en ese caso, así que el detalle deja de ser opcional (mismo criterio
      // que "Otros" en motivo de consulta, línea ~1056).
      if (diagnosticoCategorias.includes("Otro") && !diagnostico.trim()) errs.diagnosticoDetalle = "Describe el diagnóstico en el detalle — con \"Otro\" no puede quedar vacío."
      // El control no se decide solo: hay que elegir si se agenda ahora (con fecha y hora) o después.
      if (!tratamientoFinalizado) {
        if (!controlModo) errs.control = "Elige si el próximo control se agenda ahora o después."
        else if (controlModo === "ahora" && (!controlFecha || !controlHora)) errs.control = "Elige la fecha y la hora del control, o marca \"Agendar después\"."
      }
    }
    return errs
  }

  const mensajeBanner = (paso, errs = {}) => {
    if (paso === "anamnesis") return "Selecciona un paciente registrado y el motivo de la consulta (si es \"Otros\", descríbelo) antes de continuar."
    if (paso === "refraccion") return "Revisa la refracción: lo que escribiste en esfera, cilindro y eje debe ser un número válido (el eje es obligatorio si hay cilindro)."
    if (paso === "diagnostico" && errs.control && !errs.diagnostico && !errs.diagnosticoDetalle) return errs.control
    if (paso === "diagnostico") return "Selecciona al menos una categoría de diagnóstico (si es \"Otro\", descríbelo en el detalle) antes de guardar la ficha."
    return "Hay campos por completar."
  }

  const limpiarError = (campo) => {
    setErrores((prev) => {
      if (!prev[campo]) return prev
      const n = { ...prev }
      delete n[campo]
      return n
    })
    setBannerError("")
  }

  const ORDEN = { anamnesis: 1, refraccion: 2, diagnostico: 3 }

  const irA = (destino) => {
    // Si vuelve a un paso de edición, la receta deja de estar "guardada"
    if (destino !== "diagnostico") setFichaGuardada(false)
    // Retroceder o quedarse en el paso actual: libre
    if (ORDEN[destino] <= ORDEN[subTab]) {
      setErrores({})
      setBannerError("")
      setSubTab(destino)
      return
    }
    // Avanzar: validar el paso actual y los intermedios; si algo falla, se detiene ahí
    for (const paso of ["anamnesis", "refraccion", "diagnostico"]) {
      if (ORDEN[paso] >= ORDEN[subTab] && ORDEN[paso] < ORDEN[destino]) {
        const errs = validarPaso(paso)
        if (Object.keys(errs).length > 0) {
          setErrores(errs)
          setBannerError(mensajeBanner(paso, errs))
          setSubTab(paso)
          return
        }
      }
    }
    setErrores({})
    setBannerError("")
    setSubTab(destino)
  }

  const pasoActual = PASOS.find((p) => p.id === subTab)

  // "Registrado"/"No registrado" en las secciones opcionales de Refracción —
  // el ing pidió justo esto: no todas las consultas requieren retinoscopía,
  // examen físico o biomicroscopía, pero al colapsarlas hay que poder ver de
  // un vistazo cuáles sí se llenaron sin tener que volver a abrirlas.
  // "Copiar de la visita anterior": solo si la refracción de hoy está vacía y
  // la visita anterior sí tiene valores — nunca pisa lo que se tecleó.
  const copiarDesdeAnterior = (() => {
    const ant = ultimaConsultaPaciente
    if (!ant) return null
    const hayPrevios = ["od", "oi"].some((o) => ant[o]?.esfera || ant[o]?.cilindro || ant[o]?.eje)
    const hoyVacio = !odEsfera && !odCilindro && !odEje && !oiEsfera && !oiCilindro && !oiEje
    if (!hayPrevios || !hoyVacio) return null
    return {
      fecha: ant.fecha,
      accion: () => {
        setOdEsfera(ant.od?.esfera || ""); setOdCilindro(ant.od?.cilindro || ""); setOdEje(ant.od?.eje || "")
        setOiEsfera(ant.oi?.esfera || ""); setOiCilindro(ant.oi?.cilindro || ""); setOiEje(ant.oi?.eje || "")
      },
    }
  })()
  const registradoAntecedentes = Boolean(antecedentes.trim() || alergias.trim() || antecedentesFamiliares.trim() || usaLentes)
  const registradoRefraccion = Boolean(odEsfera.trim() || odCilindro.trim() || odEje.trim() || odAgudezaSc || odAgudezaCc || oiEsfera.trim() || oiCilindro.trim() || oiEje.trim() || oiAgudezaSc || oiAgudezaCc)
  const registradoCercana = Boolean(adicion.trim() || dp.trim() || alt.trim() || avCerca.trim())
  const registradoRetinoscopia = Boolean(retinoscopiaOd.trim() || retinoscopiaOi.trim())
  const registradoExamenFisico = Boolean(testMotor.trim() || oftalmoscopia.trim() || pioOd.trim() || pioOi.trim())
  const registradoBiomicroscopia = Boolean(biomicroParpados.trim() || biomicroCornea.trim() || biomicroCamara.trim())

  // Impresión robusta: clona la receta a una capa pegada al <body>
  const imprimirReceta = () => {
    const receta = document.getElementById("receta-imprimible")
    if (!receta) {
      window.print()
      return
    }
    const clon = receta.cloneNode(true)
    clon.removeAttribute("id")

    // Los inputs/textarea/select no se clonan con su valor: se reemplazan por
    // texto — un <select> impreso tal cual se ve con flechita de dropdown,
    // que no tiene sentido en un documento ya emitido.
    const origs = receta.querySelectorAll("input, textarea, select")
    const clones = clon.querySelectorAll("input, textarea, select")
    clones.forEach((el, i) => {
      const original = origs[i]
      const val = el.tagName === "SELECT"
        ? (original?.options[original.selectedIndex]?.text || "")
        : (original?.value || "")
      const div = document.createElement("div")
      div.textContent = val
      div.style.cssText = "border-bottom:1px solid #cbd5e1;padding:4px 0;font-size:14px;font-weight:600;color:#0f172a;min-height:22px;"
      el.replaceWith(div)
    })

    clon.querySelectorAll(".no-print").forEach((n) => n.remove())
    clon.style.border = "none"
    clon.style.boxShadow = "none"
    clon.style.borderRadius = "0"

    const previo = document.getElementById("print-portal")
    if (previo) previo.remove()
    const portal = document.createElement("div")
    portal.id = "print-portal"
    portal.appendChild(clon)
    document.body.appendChild(portal)
    document.body.classList.add("printing-receta")

    const limpiar = () => {
      document.body.classList.remove("printing-receta")
      const p = document.getElementById("print-portal")
      if (p) p.remove()
    }
    window.addEventListener("afterprint", limpiar, { once: true })
    window.print()
    setTimeout(limpiar, 1500)
  }

  // ── Datos derivados para la receta impresa ──
  const pacienteInfo = useMemo(
    () => pacientesLista.find((p) => p.id === pacienteId),
    [pacientesLista, pacienteId],
  )

  const edadPaciente = useMemo(() => {
    const fn = pacienteInfo?.fecha_nacimiento || pacienteInfo?.fechaNacimiento
    if (!fn) return null
    const nac = new Date(fn)
    if (isNaN(nac.getTime())) return null
    const hoy = ahoraEcuador()
    let e = hoy.getFullYear() - nac.getFullYear()
    const m = hoy.getMonth() - nac.getMonth()
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) e--
    return e
  }, [pacienteInfo])

  const recetaNum = useMemo(() => {
    const base = (pacienteSeleccionado + fechaConsulta) || "receta"
    let h = 0
    for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) >>> 0
    return "RX-" + (fechaConsulta || "").replace(/-/g, "") + "-" + h.toString(36).toUpperCase().slice(0, 4)
  }, [pacienteSeleccionado, fechaConsulta])

  // Barra de la visita: cita de origen, alergias (rojo si hay) y última graduación.
  const citaDeLaVisita = useMemo(() => citas.find((c) => c.id === citaEnAtencionId) || null, [citas, citaEnAtencionId])
  const alergiaSignificativa = Boolean(alergias.trim()) && !/^(ning|no\b|sin\b|n\/a|na$|-+$|—)/i.test(alergias.trim())
  const ultimaGraduacion = useMemo(() => {
    if (!ultimaConsultaPaciente) return null
    const od = textoOjo(ultimaConsultaPaciente.od)
    const oi = textoOjo(ultimaConsultaPaciente.oi)
    if (od === "No registrada" && oi === "No registrada") return null
    return { fecha: ultimaConsultaPaciente.fecha, od, oi }
  }, [ultimaConsultaPaciente])
  const fechaCorta = (iso) => (iso ? fechaLegible(iso) : "")

  // Fecha recomendada del control = día de la consulta + el plazo elegido. Si ese día no hay atención, se propone el día hábil más
  // cercano, pero solo se propone: la fecha la elige el optómetra con el paciente.
  const fechaControlRecomendada = useMemo(() => sumarDiasISO(fechaConsulta, proximoControlDias), [fechaConsulta, proximoControlDias])
  const diaControlSugerido = useMemo(() => {
    if (controlModo !== "ahora") return null
    if (diaTieneCupo(fechaControlRecomendada, disponibilidad, citas)) return fechaControlRecomendada
    return diaHabilMasCercano(fechaControlRecomendada, disponibilidad, citas)
  }, [controlModo, fechaControlRecomendada, disponibilidad, citas])
  const textoDia = (iso) => formatoFecha(iso, "largo")

  const fechaLarga = useMemo(() => formatoFecha(fechaConsulta, "largoSinDia") || fechaConsulta, [fechaConsulta])

  return (
    <div className="w-full space-y-6 text-left">
      {/* Estilos para impresión limpia de la receta */}
      <style>{`
        @page { margin: 1.4cm; }
        #print-portal { display: none; }
        @media print {
          body.printing-receta > *:not(#print-portal) { display: none !important; }
          #print-portal { display: block !important; }
          #print-portal, #print-portal * { visibility: visible !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .print-force-color { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {/* ─── VOLVER / CERRAR ───
          Ficha clínica ya no tiene entrada propia en el sidebar (se llega
          acá desde "Atender" en Citas médicas o desde "Ficha clínica" en el
          perfil del paciente) — sin esto no había forma de salir salvo
          eligiendo otra sección al azar en el menú. Volver y Cerrar no son
          lo mismo: "Volver" reabre lo que había antes (el perfil del
          paciente, si se entró desde ahí — lo maneja Dashboard.jsx), "Cerrar"
          siempre sale a la lista de origen sin importar de dónde se venía. */}
      {(onVolver || onCerrar) && (
        <div className="no-print -mt-2 flex items-center justify-between">
          <button type="button" onClick={onVolver || onCerrar} className="flex items-center gap-2 rounded-lg py-1.5 pl-1.5 pr-3 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 cursor-pointer">
            <ArrowLeft size={18} /> {origenNombre}
          </button>
          <div className="flex items-center gap-1">
            {citaEnAtencionId && !fichaGuardada && (
              <button
                type="button"
                onClick={() => { setErrorDejarDeAtender(""); setMostrarDejarDeAtender(true) }}
                title="Salir sin guardar: la cita se mantiene agendada"
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700 cursor-pointer"
              >
                <LogOut size={14} aria-hidden="true" /> Dejar de atender
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── HEADER ─── */}
      <div className="no-print flex items-start gap-3.5">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white" style={{ background: GRAD, boxShadow: "0 12px 24px -10px rgba(37,99,235,0.6)" }}>
          <Stethoscope size={24} />
        </div>
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight" style={{ color: INK }}>Ficha clínica</h1>
          <p className="text-sm text-slate-500">
            Examen visual digitalizado, toma de medidas refractivas y actualización del expediente del paciente.
          </p>
        </div>
      </div>

      {/* ─── ÉXITO ─── */}
      {notificacion && (
        <div role="status" className="no-print flex items-center gap-3 rounded-xl border border-emerald-200/60 bg-emerald-50 p-4 text-emerald-900 shadow-sm">
          <CheckCircle className="shrink-0 text-emerald-600" size={20} />
          <div>
            <p className="text-sm font-semibold">Ficha clínica guardada con éxito.</p>
            <p className="text-xs text-emerald-700">La evolución del paciente se ha actualizado en el sistema.</p>
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-3xl">
        {/* ─── IDENTIDAD DEL PACIENTE (fija al hacer scroll) ─── Antes el
            nombre solo aparecía en el buscador del paso 1 y en el resumen
            del paso 3 — al completar un formulario largo (Refracción tiene
            bastante contenido) el optómetra podía perder de vista a quién
            le está tomando las medidas. Sticky respecto del contenedor con
            scroll real (Dashboard.jsx, no la ventana), no se necesita
            ningún offset especial. */}
        {/* ─── BARRA DE LA VISITA ─── Opaca (sin blur) y con el scroll
            del paso calculado debajo de ella (scrollMarginTop de
            inicioFormRef) para que ya no tape el título de la sección.
            Reúne lo que antes se repartía entre esta barra, el bloque
            "Datos del paciente e historial" y el campo de motivo:
            paciente, cita de origen, fecha de la consulta (editable),
            alergias (rojo) y última graduación. */}
        {pacienteId && pacienteSeleccionado && (
          <div className="no-print sticky top-0 z-10 mb-4 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white" style={{ background: GRAD }}>
                  <User size={15} />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold" style={{ color: INK }}>
                    {pacienteSeleccionado}{edadPaciente != null ? ` · ${edadPaciente} años` : ""}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {citaDeLaVisita
                      ? `Cita ${citaDeLaVisita.hora} · ${citaDeLaVisita.motivo || "Consulta"} · ${citaDeLaVisita.fecha === hoyISO() ? "Hoy" : `agendada ${fechaCorta(citaDeLaVisita.fecha)} · atención hoy`}`
                      : "Sin cita · consulta directa"}
                    {motivo && !citaDeLaVisita ? ` · ${motivo}` : ""}
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500">
                <Calendar size={13} aria-hidden="true" /> Fecha de la consulta
                <input
                  type="date"
                  value={fechaConsulta}
                  onChange={(e) => setFechaConsulta(e.target.value)}
                  className="rounded-lg border border-slate-200/60 bg-slate-50 px-2 py-1 text-xs text-slate-700 outline-none focus-visible:border-blue-500"
                />
              </label>
            </div>
            {(alergiaSignificativa || ultimaGraduacion) && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                {alergiaSignificativa && (
                  <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 font-bold text-red-700">
                    <AlertCircle size={12} className="shrink-0" aria-hidden="true" />
                    <span className="truncate">Alergias: {alergias.trim()}</span>
                  </span>
                )}
                {ultimaGraduacion && (
                  <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200/60 bg-slate-50 px-2.5 py-1 font-mono text-[11px] text-slate-600">
                    <Glasses size={12} className="shrink-0 text-slate-500" aria-hidden="true" />
                    <span className="truncate">Últ. graduación ({fechaCorta(ultimaGraduacion.fecha)}): OD {ultimaGraduacion.od} · OI {ultimaGraduacion.oi}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* ─── FORMULARIO PRINCIPAL ─── */}
        <div className="no-print flex flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
          {/* Stepper */}
          <div className="flex gap-1 border-b border-slate-200/60 bg-slate-50/70 p-2">
            {PASOS.map((paso) => {
              const Icono = paso.icon
              const activo = subTab === paso.id
              return (
                <button
                  key={paso.id}
                  type="button"
                  onClick={() => irA(paso.id)}
                  className={"flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold transition " + (activo ? "bg-white shadow-sm" : "text-slate-500 hover:text-slate-800")}
                  style={activo ? { color: "#2563EB" } : undefined}
                >
                  <span className="grid h-5 w-5 place-items-center rounded-full text-xs font-bold text-white" style={activo ? { background: GRAD } : { backgroundColor: "#cbd5e1" }}>
                    {paso.n}
                  </span>
                  <span className="hidden items-center gap-1.5 sm:flex">
                    <Icono size={15} /> {paso.label}
                  </span>
                </button>
              )
            })}
          </div>

          <form onSubmit={intentarGuardar} className="flex flex-1 flex-col justify-between gap-6 p-6">
            <div ref={inicioFormRef} style={{ scrollMarginTop: 140 }} />
            {bannerError && (
              <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-200/60 bg-red-50 p-3.5 text-red-700">
                <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
                <div>
                  <p className="text-sm font-bold">No puedes continuar todavía</p>
                  <p className="text-xs text-red-600">{bannerError}</p>
                </div>
              </div>
            )}
            {/* ─── Antecedentes del paciente (dato fijo de la persona, no
                relacional a esta consulta) — se muestra una sola vez, en el
                paso donde se abre la ficha para este paciente (decisión de
                Diego, 29 sept.): paciente nuevo abre en Anamnesis y el
                bloque vive solo ahí; paciente con historial abre directo en
                Refracción (ver seleccionarPacienteCombo, pedido ING7) y el
                resumen plegado vive solo ahí — nunca en los dos pasos ni en
                Diagnóstico. Colapsado cuando ya están registrados de una
                visita anterior (pedido de Diego: no repetir este formulario
                completo en cada visita; solo la primera vez, o si el
                optómetra quiere revisarlo/editarlo, se despliega). Mismo
                patrón alternarSeccion() que usa Refracción para
                retinoscopía/examen físico/biomicroscopía. ─── */}
            {/* Contexto en lectura, arriba: última visita, tendencia y acceso al
                historial (lo que pidió el ingeniero el 29 sep: "todo el
                contexto del paciente primero, y luego me dedico a registrar"). */}
            {pacienteId && subTab === "anamnesis" && (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200/60 bg-blue-50/50 px-4 py-3">
                <div className="min-w-0 space-y-0.5 text-xs text-slate-600">
                  {ultimaConsultaPaciente ? (
                    <>
                      <p>
                        <span className="font-bold" style={{ color: INK }}>Última visita</span> {fechaCorta(ultimaConsultaPaciente.fecha)} · {ultimaConsultaPaciente.diagnostico || "Sin diagnóstico registrado"}
                      </p>
                      {tendenciaHistorica && (() => {
                        const t = TENDENCIA[tendenciaHistorica.verdicto] || TENDENCIA["Sin cambios"]
                        const IconoT = t.icon
                        return (
                          <p className="flex items-center gap-1">
                            <IconoT size={12} style={{ color: t.fg }} aria-hidden="true" />
                            Tendencia: <span className="font-semibold" style={{ color: t.fg }}>{tendenciaHistorica.verdicto.toLowerCase()}</span> ({textoVariacion(tendenciaHistorica.variacion)})
                          </p>
                        )
                      })()}
                    </>
                  ) : (
                    <p><span className="font-bold" style={{ color: INK }}>Primera consulta</span> de este paciente — sin historial previo.</p>
                  )}
                </div>
                {historialPaciente.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setMostrarHistorial(true)}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200/60 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 transition-colors hover:border-blue-300 hover:text-blue-700 cursor-pointer"
                  >
                    <History size={13} /> Ver historial ({historialPaciente.length})
                  </button>
                )}
              </div>
            )}

            {pacienteId && subTab === "anamnesis" && (
              <div className="space-y-3 rounded-xl border border-slate-200/60 bg-slate-50 p-4">
                <button type="button" onClick={() => alternarSeccion("antecedentesPaciente")} aria-expanded={!!seccionesAbiertas.antecedentesPaciente} className="flex w-full items-center justify-between gap-2 text-left cursor-pointer">
                  <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: INK }}>
                    <ClipboardList size={16} className="text-blue-600" /> Antecedentes del paciente
                    <EtiquetaRegistro registrado={registradoAntecedentes} />
                  </span>
                  <span className="flex items-center gap-2">
                    {tieneHistorialAntecedentes && !seccionesAbiertas.antecedentesPaciente && (
                      <span className="hidden items-center gap-1 text-[11px] font-normal normal-case text-slate-500 sm:flex">
                        <History size={11} /> Ya registrados{fechaPrecarga ? ` el ${fechaLegible(fechaPrecarga)}` : ""} · toca para ver o editar
                      </span>
                    )}
                    <ChevronDown size={15} className={"text-slate-500 transition-transform " + (seccionesAbiertas.antecedentesPaciente ? "" : "-rotate-90")} />
                  </span>
                </button>

                {/* Línea base siempre visible al colapsar — antes, colapsado
                    solo decía "ya registrados, toca para ver": el optómetra
                    tenía que abrir el acordeón para enterarse de una alergia
                    antes de recetar. Ahora el dato real queda a la vista sin
                    clic, que es justo lo que se necesita revisar antes de
                    empezar la consulta; el acordeón sigue existiendo para
                    editar sin repetir el formulario completo cada visita. */}
                {!seccionesAbiertas.antecedentesPaciente && (
                  <div className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200/60 bg-white p-3 text-xs leading-relaxed text-slate-700 sm:grid-cols-3">
                    <p><span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">Alergias</span>{alergias || "Ninguna registrada"}</p>
                    <p><span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">Antecedentes médicos/oculares</span>{antecedentes || "Ninguno registrado"}</p>
                    <p><span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">Antecedentes familiares</span>{antecedentesFamiliares || "Ninguno registrado"}</p>
                  </div>
                )}

                {seccionesAbiertas.antecedentesPaciente && (
                <>
                <div className="flex flex-col gap-3 rounded-lg border border-slate-200/60 bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-600">
                    <Glasses size={16} className="text-slate-500" />
                    ¿Utiliza o ha utilizado lentes?
                    {precargado.usaLentes && <InsigniaHistorial fecha={fechaPrecarga} />}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setUsaLentes("si"); setPrecargado((p) => ({ ...p, usaLentes: false })) }}
                      aria-pressed={usaLentes === "si"}
                      className={
                        "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-semibold transition sm:flex-none " +
                        (usaLentes === "si"
                          ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-100"
                          : "border-slate-300 bg-white text-slate-500 hover:border-slate-400")
                      }
                    >
                      <CheckCircle size={16} className={usaLentes === "si" ? "text-blue-600" : "text-slate-400"} />
                      Sí
                    </button>
                    <button
                      type="button"
                      onClick={() => { setUsaLentes("no"); setPrecargado((p) => ({ ...p, usaLentes: false })) }}
                      aria-pressed={usaLentes === "no"}
                      className={
                        "flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-semibold transition sm:flex-none " +
                        (usaLentes === "no"
                          ? "border-red-400 bg-red-50 text-red-600 ring-2 ring-red-100"
                          : "border-slate-300 bg-white text-slate-500 hover:border-slate-400")
                      }
                    >
                      <XCircle size={16} className={usaLentes === "no" ? "text-red-500" : "text-slate-400"} />
                      No
                    </button>
                  </div>
                </div>

                <div>
                  <label htmlFor="antecedentes" className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-600">
                    Antecedentes médicos / oculares
                    {precargado.antecedentes && <InsigniaHistorial fecha={fechaPrecarga} />}
                  </label>
                  <textarea
                    id="antecedentes"
                    rows={3}
                    placeholder="Ej. Paciente con diabetes tipo 2. Usa lentes desde hace 3 años."
                    value={antecedentes}
                    onChange={(e) => { setAntecedentes(e.target.value); setPrecargado((p) => ({ ...p, antecedentes: false })) }}
                    className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm leading-relaxed text-slate-800 outline-none transition focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100"
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label htmlFor="alergias" className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-600">
                      Alergias
                      {precargado.alergias && <InsigniaHistorial fecha={fechaPrecarga} />}
                    </label>
                    <input
                      id="alergias"
                      type="text"
                      placeholder="Ej. Alergia a fluoresceína, ninguna conocida..."
                      value={alergias}
                      onChange={(e) => { setAlergias(e.target.value); setPrecargado((p) => ({ ...p, alergias: false })) }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100"
                    />
                  </div>
                  <div>
                    <label htmlFor="antFamiliares" className="mb-1.5 flex items-center gap-2 text-sm font-medium text-slate-600">
                      Antecedentes familiares oculares
                      {precargado.antecedentesFamiliares && <InsigniaHistorial fecha={fechaPrecarga} />}
                    </label>
                    <input
                      id="antFamiliares"
                      type="text"
                      placeholder="Ej. Glaucoma en línea materna, sin antecedentes..."
                      value={antecedentesFamiliares}
                      onChange={(e) => { setAntecedentesFamiliares(e.target.value); setPrecargado((p) => ({ ...p, antecedentesFamiliares: false })) }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100"
                    />
                  </div>
                </div>
                </>
                )}
              </div>
            )}

            {/* PASO 1: CONTEXTO Y ANAMNESIS */}
            {subTab === "anamnesis" && (
              <div className="space-y-5">
                {/* ─── Buscador de paciente: solo si la ficha se abrió sin uno ya
                    resuelto. Cuando llega desde "Atender" o desde el perfil del
                    paciente (pacienteInicial → seleccionarPacienteCombo ya fijó
                    pacienteId), no tiene sentido dejarlo buscar/cambiar de
                    paciente acá — el nombre sigue visible en la barra de la
                    visita de arriba. Sigue apareciendo para el caso real en
                    que sí hace falta: "Nueva consulta" al final de la ficha
                    (resetForm limpia pacienteId a propósito para el siguiente
                    paciente) y cualquier apertura sin paciente precargado.
                    Decisión de Diego, 30 sept. ─── */}
                {!pacienteId && (
                <div className="relative" ref={dropdownRef}>
                  <label htmlFor="paciente" className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Paciente <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <User size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      id="paciente"
                      type="text"
                      placeholder="Escriba para filtrar paciente..."
                      value={busquedaPaciente}
                      onFocus={() => setMostrarDropdown(true)}
                      onChange={(e) => {
                        setBusquedaPaciente(e.target.value)
                        // Escribir sólo filtra el desplegable — no cuenta como selección hasta
                        // hacer clic en un paciente real de la lista (ver seleccionarPacienteCombo).
                        setPacienteId(null)
                        setPacienteSeleccionado("")
                        setMostrarDropdown(true)
                      }}
                      className={"w-full rounded-lg border bg-white py-2.5 pl-9 pr-8 text-sm text-slate-800 outline-none transition focus-visible:border-blue-500 " + (errores.paciente ? "border-red-400 ring-2 ring-red-100" : "border-slate-300")}
                    />
                    <Search size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  </div>

                  {mostrarDropdown && pacientesFiltrados.length > 0 && (
                    <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200/60 bg-white shadow-lg">
                      {pacientesFiltrados.map((p) => (
                        <li
                          key={p.id || p.nombre}
                          onClick={() => seleccionarPacienteCombo(p)}
                          className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                        >
                          <span className="font-semibold">{p.nombre}</span>
                          {p.cedula && <span className="font-mono text-xs text-slate-500">ID: {p.cedula}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                  {mostrarDropdown && busquedaPaciente.trim() && pacientesFiltrados.length === 0 && (
                    <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200/60 bg-white p-3 text-xs text-slate-500 shadow-lg">
                      Ningún paciente registrado coincide. Créalo primero en el módulo Pacientes — aquí no se puede escribir un nombre nuevo.
                    </div>
                  )}

                  {errores.paciente && (
                    <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600">
                      <AlertCircle size={13} /> {errores.paciente}
                    </p>
                  )}
                </div>
                )}

                {/* ─── Motivo de la consulta: con cita llega relleno y se
                    muestra como dato (con "Cambiar"); sin cita (entrada desde
                    el perfil) es el selector obligatorio de siempre. Al elegir
                    "Otros", el detalle se abre debajo con el foco puesto. ─── */}
                {pacienteId && (
                  <div className="space-y-3">
                    {citaEnAtencionId && motivo && motivo !== "Otros" && !editandoMotivo ? (
                      <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/60 bg-white px-4 py-3">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Motivo de la consulta</p>
                          <p className="text-sm font-semibold" style={{ color: INK }}>{motivo} <span className="text-xs font-normal text-slate-400">(de la cita)</span></p>
                        </div>
                        <button type="button" onClick={() => setEditandoMotivo(true)} className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">Cambiar</button>
                      </div>
                    ) : (
                      <div>
                        <label htmlFor="motivo" className="mb-1.5 block text-sm font-semibold text-slate-700">
                          Motivo de la consulta <span className="text-red-500">*</span>
                        </label>
                        <select
                          id="motivo"
                          value={motivo}
                          onChange={(e) => {
                            setMotivo(e.target.value)
                            limpiarError("motivo")
                            if (e.target.value !== "Otros") limpiarError("detalleConsulta")
                          }}
                          className={"w-full rounded-lg border bg-white px-3 py-2.5 text-sm font-medium text-slate-700 outline-none transition focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100 " + (errores.motivo ? "border-red-400 ring-2 ring-red-100" : "border-slate-300")}
                        >
                          <option value="" disabled>Selecciona un motivo...</option>
                          {motivosConsulta.map((m) => (<option key={m} value={m}>{m}</option>))}
                          <option value="Otros">Otros</option>
                        </select>
                        {errores.motivo && (
                          <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600">
                            <AlertCircle size={13} /> {errores.motivo}
                          </p>
                        )}
                      </div>
                    )}

                    {motivo === "Otros" || detalleConsulta || mostrarDetalle ? (
                      <div>
                        <label htmlFor="detalleConsulta" className="mb-1.5 block text-sm font-semibold text-slate-700">
                          {motivo === "Otros" ? <>Describe el motivo <span className="text-red-500">*</span></> : <>Detalle de la consulta <span className="font-normal text-slate-400">(opcional)</span></>}
                        </label>
                        <input
                          id="detalleConsulta"
                          ref={detalleRef}
                          type="text"
                          placeholder="Ej. Visión borrosa de lejos hace 2 semanas, dolor ocular..."
                          value={detalleConsulta}
                          onChange={(e) => { setDetalleConsulta(e.target.value); limpiarError("detalleConsulta") }}
                          className={"w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100 " + (errores.detalleConsulta ? "border-red-400 ring-2 ring-red-100" : "border-slate-300")}
                        />
                        {errores.detalleConsulta && (
                          <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600">
                            <AlertCircle size={13} /> {errores.detalleConsulta}
                          </p>
                        )}
                      </div>
                    ) : (
                      <button type="button" onClick={() => { setMostrarDetalle(true); setTimeout(() => detalleRef.current?.focus(), 30) }} className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">
                        + Agregar detalle
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* PASO 2: REFRACCIÓN */}
            {subTab === "refraccion" && (
              <div className="space-y-5">
                <div className="space-y-3 rounded-xl border border-slate-200/60 bg-slate-50 p-4">
                  <button type="button" onClick={() => alternarSeccion("retinoscopia")} aria-expanded={!!seccionesAbiertas.retinoscopia} className="flex w-full items-center gap-1.5 border-b border-slate-200/60 pb-2 text-left text-sm font-semibold cursor-pointer" style={{ color: INK }}>
                    <ScanEye size={16} className="text-blue-600" /> Retinoscopía (refracción objetiva)
                    <span className="ml-auto flex items-center gap-2 text-[10px] font-normal normal-case text-slate-500">
                      Opcional · punto de partida antes de refinar
                      <EtiquetaRegistro registrado={registradoRetinoscopia} />
                    </span>
                    <ChevronDown size={15} className={"text-slate-500 transition-transform " + (seccionesAbiertas.retinoscopia ? "" : "-rotate-90")} />
                  </button>
                  {seccionesAbiertas.retinoscopia && (
                  <>
                  <p className="text-xs text-slate-500">Hallazgo objetivo antes de refinar con la refracción subjetiva del paciente, abajo.</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label htmlFor="retinoOd" className="mb-1 block text-xs font-semibold text-slate-500">Hallazgo OD</label>
                      <input
                        id="retinoOd" type="text" placeholder="Ej. -1.00 -0.50 x180"
                        value={retinoscopiaOd} onChange={(e) => setRetinoscopiaOd(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-sm text-slate-800 outline-none focus-visible:border-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="retinoOi" className="mb-1 block text-xs font-semibold text-slate-500">Hallazgo OI</label>
                      <input
                        id="retinoOi" type="text" placeholder="Ej. -0.75 -0.25 x175"
                        value={retinoscopiaOi} onChange={(e) => setRetinoscopiaOi(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-sm text-slate-800 outline-none focus-visible:border-blue-500"
                      />
                    </div>
                  </div>
                  </>
                  )}
                </div>

                <div className="space-y-3 rounded-xl border border-slate-200/60 bg-slate-50 p-4">
                  <button type="button" onClick={() => alternarSeccion("refraccionSubjetiva")} aria-expanded={!!seccionesAbiertas.refraccionSubjetiva} className="flex w-full items-center gap-1.5 border-b border-slate-200/60 pb-2 text-left text-sm font-semibold cursor-pointer" style={{ color: INK }}>
                    <Eye size={16} className="text-blue-600" /> Refracción subjetiva final
                    <span className="ml-auto flex items-center gap-2 text-[10px] font-normal normal-case text-slate-500">
                      Todo opcional · vacío significa "no medido"
                      <EtiquetaRegistro registrado={registradoRefraccion} />
                    </span>
                    <ChevronDown size={15} className={"text-slate-500 transition-transform " + (seccionesAbiertas.refraccionSubjetiva ? "" : "-rotate-90")} />
                  </button>
                  {seccionesAbiertas.refraccionSubjetiva && (
                  <>
                  {copiarDesdeAnterior && (
                    <button type="button" onClick={copiarDesdeAnterior.accion} className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">
                      <History size={13} aria-hidden="true" /> Copiar de la visita anterior ({fechaCorta(copiarDesdeAnterior.fecha)})
                    </button>
                  )}
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <OjoCard sigla="OD" titulo="Ojo derecho" esfera={odEsfera} setEsfera={setOdEsfera} cilindro={odCilindro} setCilindro={setOdCilindro} eje={odEje} setEje={setOdEje} avSc={odAgudezaSc} setAvSc={setOdAgudezaSc} avCc={odAgudezaCc} setAvCc={setOdAgudezaCc} errores={errores} limpiarError={limpiarError} />
                    <OjoCard sigla="OI" titulo="Ojo izquierdo" esfera={oiEsfera} setEsfera={setOiEsfera} cilindro={oiCilindro} setCilindro={setOiCilindro} eje={oiEje} setEje={setOiEje} avSc={oiAgudezaSc} setAvSc={setOiAgudezaSc} avCc={oiAgudezaCc} setAvCc={setOiAgudezaCc} errores={errores} limpiarError={limpiarError} />
                  </div>
                  {estadoCorreccionActual !== "Sin evaluar" && (
                    <div><ChipCorreccion correccion={estadoCorreccionActual} /></div>
                  )}
                  </>
                  )}
                </div>

                <div className="space-y-3 rounded-xl border border-slate-200/60 bg-slate-50 p-4">
                  <button type="button" onClick={() => alternarSeccion("visionCercana")} aria-expanded={!!seccionesAbiertas.visionCercana} className="flex w-full items-center gap-1.5 border-b border-slate-200/60 pb-2 text-left text-sm font-semibold cursor-pointer" style={{ color: INK }}>
                    <Ruler size={16} className="text-blue-600" /> Visión cercana y centrado
                    <span className="ml-auto flex items-center gap-2 text-[10px] font-normal normal-case text-slate-500">
                      Opcional
                      <EtiquetaRegistro registrado={registradoCercana} />
                    </span>
                    <ChevronDown size={15} className={"text-slate-500 transition-transform " + (seccionesAbiertas.visionCercana ? "" : "-rotate-90")} />
                  </button>
                  {seccionesAbiertas.visionCercana && (
                  <div className={"grid grid-cols-1 gap-3 sm:grid-cols-" + (manejaProgresion ? "4" : "3")}>
                    {manejaProgresion && <MedidaCampo id="add" label="Adición (ADD)" value={adicion} onChange={setAdicion} placeholder="+0.00" />}
                    <MedidaCampo id="dp" label="Distancia pupilar (DP)" value={dp} onChange={setDp} placeholder="64 mm" />
                    <MedidaCampo id="alt" label="Altura pupilar (ALT)" value={alt} onChange={setAlt} placeholder="18 mm" />
                    <MedidaCampo id="avCerca" label="AV Cerca (Jaeger)" value={avCerca} onChange={setAvCerca} placeholder="J1" />
                  </div>
                  )}
                </div>

                <div className="space-y-3 rounded-xl border border-slate-200/60 bg-slate-50 p-4">
                  <button type="button" onClick={() => alternarSeccion("examenFisico")} aria-expanded={!!seccionesAbiertas.examenFisico} className="flex w-full items-center gap-1.5 border-b border-slate-200/60 pb-2 text-left text-sm font-semibold cursor-pointer" style={{ color: INK }}>
                    <ScanEye size={16} className="text-blue-600" /> Examen físico complementario
                    <span className="ml-auto flex items-center gap-2 text-[10px] font-normal normal-case text-slate-500">
                      Opcional
                      <EtiquetaRegistro registrado={registradoExamenFisico} />
                    </span>
                    <ChevronDown size={15} className={"text-slate-500 transition-transform " + (seccionesAbiertas.examenFisico ? "" : "-rotate-90")} />
                  </button>
                  {seccionesAbiertas.examenFisico && (
                  <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label htmlFor="testMotor" className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-500"><Move size={12} /> Motilidad ocular</label>
                      <input
                        id="testMotor" type="text" placeholder="Ej. Movimientos normales, sin restricción"
                        value={testMotor} onChange={(e) => setTestMotor(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 outline-none focus-visible:border-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="oftalmoscopia" className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-500"><ScanEye size={12} /> Oftalmoscopia</label>
                      <input
                        id="oftalmoscopia" type="text" placeholder="Ej. Papila y retina sin alteraciones"
                        value={oftalmoscopia} onChange={(e) => setOftalmoscopia(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 outline-none focus-visible:border-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="testColor" className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-500"><Palette size={12} /> Test de color</label>
                      <select
                        id="testColor" value={testColor} onChange={(e) => setTestColor(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm font-medium text-slate-700 outline-none focus-visible:border-blue-500"
                      >
                        <option value="Normal">Normal</option>
                        <option value="Deficiencia rojo-verde">Deficiencia rojo-verde</option>
                        <option value="Deficiencia azul-amarillo">Deficiencia azul-amarillo</option>
                        <option value="No realizado">No realizado</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-t border-slate-200/60 pt-3">
                    <div>
                      <label htmlFor="coverLejos" className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-500">Cover test — lejos</label>
                      <select
                        id="coverLejos" value={coverTestLejos} onChange={(e) => setCoverTestLejos(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm font-medium text-slate-700 outline-none focus-visible:border-blue-500"
                      >
                        <option value="Ortoforia">Ortoforia</option>
                        <option value="Exoforia">Exoforia</option>
                        <option value="Esoforia">Esoforia</option>
                        <option value="Exotropia">Exotropia</option>
                        <option value="Esotropia">Esotropia</option>
                        <option value="No realizado">No realizado</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="coverCerca" className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-500">Cover test — cerca</label>
                      <select
                        id="coverCerca" value={coverTestCerca} onChange={(e) => setCoverTestCerca(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm font-medium text-slate-700 outline-none focus-visible:border-blue-500"
                      >
                        <option value="Ortoforia">Ortoforia</option>
                        <option value="Exoforia">Exoforia</option>
                        <option value="Esoforia">Esoforia</option>
                        <option value="Exotropia">Exotropia</option>
                        <option value="Esotropia">Esotropia</option>
                        <option value="No realizado">No realizado</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-t border-slate-200/60 pt-3">
                    <div>
                      <label htmlFor="pioOd" className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-500">
                        <Droplet size={12} /> PIO — Ojo derecho (mmHg)
                      </label>
                      <input
                        id="pioOd" type="text" placeholder="Ej. 14" inputMode="numeric" maxLength={2}
                        value={pioOd} onChange={(e) => setPioOd(filtrarSoloNumeros(e.target.value, 2))}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 outline-none focus-visible:border-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="pioOi" className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-500">
                        <Droplet size={12} /> PIO — Ojo izquierdo (mmHg)
                      </label>
                      <input
                        id="pioOi" type="text" placeholder="Ej. 15" inputMode="numeric" maxLength={2}
                        value={pioOi} onChange={(e) => setPioOi(filtrarSoloNumeros(e.target.value, 2))}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 outline-none focus-visible:border-blue-500"
                      />
                    </div>
                  </div>
                  </>
                  )}
                </div>

                <div className="space-y-3 rounded-xl border border-slate-200/60 bg-slate-50 p-4">
                  <button type="button" onClick={() => alternarSeccion("biomicroscopia")} aria-expanded={!!seccionesAbiertas.biomicroscopia} className="flex w-full items-center gap-1.5 border-b border-slate-200/60 pb-2 text-left text-sm font-semibold cursor-pointer" style={{ color: INK }}>
                    <Eye size={16} className="text-blue-600" /> Biomicroscopía (segmento anterior)
                    <span className="ml-auto flex items-center gap-2 text-[10px] font-normal normal-case text-slate-500">
                      Opcional · lámpara de hendidura
                      <EtiquetaRegistro registrado={registradoBiomicroscopia} />
                    </span>
                    <ChevronDown size={15} className={"text-slate-500 transition-transform " + (seccionesAbiertas.biomicroscopia ? "" : "-rotate-90")} />
                  </button>
                  {seccionesAbiertas.biomicroscopia && (
                  <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label htmlFor="biomicroParpados" className="mb-1 block text-xs font-semibold text-slate-500">Párpados / conjuntiva</label>
                      <input
                        id="biomicroParpados" type="text" placeholder="Ej. Sin alteraciones"
                        value={biomicroParpados} onChange={(e) => setBiomicroParpados(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 outline-none focus-visible:border-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="biomicroCornea" className="mb-1 block text-xs font-semibold text-slate-500">Córnea</label>
                      <input
                        id="biomicroCornea" type="text" placeholder="Ej. Transparente, sin lesiones"
                        value={biomicroCornea} onChange={(e) => setBiomicroCornea(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 outline-none focus-visible:border-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="biomicroCamara" className="mb-1 block text-xs font-semibold text-slate-500">Cámara anterior / cristalino</label>
                      <input
                        id="biomicroCamara" type="text" placeholder="Ej. Formada, cristalino transparente"
                        value={biomicroCamara} onChange={(e) => setBiomicroCamara(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 outline-none focus-visible:border-blue-500"
                      />
                    </div>
                  </div>
                  </>
                  )}
                </div>

                {/* Pie: variación frente a la visita anterior, solo si hay valores */}
                <LineaVariacion analisis={analisisEvolucion} />
              </div>
            )}

            {/* PASO 3: DIAGNÓSTICO Y RECETA */}
            {subTab === "diagnostico" && (
              <div className="space-y-5">
                {/* Una línea de variación en vez de las tarjetas "Estado de
                    corrección" y "Comparación" (que repetían lo del paso 2). */}
                <LineaVariacion analisis={analisisEvolucion} />

                {/* Barra de acción (no se imprime) */}
                <div className="no-print flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: INK }}>Vista previa de la receta</h3>
                    {fichaGuardada ? (
                      <p className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                        <CheckCircle size={12} /> Ficha guardada · lista para imprimir
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500">Guarda la ficha clínica para habilitar la impresión.</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={imprimirReceta}
                    disabled={!fichaGuardada}
                    title={fichaGuardada ? "Imprimir o descargar como PDF" : "Primero guarda la ficha clínica"}
                    className={"flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition " + (fichaGuardada ? "text-white hover:-translate-y-0.5 cursor-pointer" : "cursor-not-allowed text-slate-400")}
                    style={fichaGuardada ? { background: GRAD, boxShadow: "0 12px 24px -12px rgba(37,99,235,0.6)" } : { backgroundColor: "#e2e8f0" }}
                  >
                    <Printer size={15} /> Imprimir / Descargar PDF
                  </button>
                </div>

                {/* RECETA IMPRIMIBLE */}
                <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm" id="receta-imprimible">
                  {/* Membrete */}
                  <div className="print-force-color px-8 pt-8" style={{ color: INK }}>
                    <div className="flex items-start justify-between gap-6">
                      <div className="flex items-center gap-3.5">
                        <div className="print-force-color grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-white" style={{ background: GRAD }}>
                          <Eye size={26} strokeWidth={2.1} />
                        </div>
                        <div>
                          <h2 className="font-serif text-2xl font-bold leading-none tracking-tight">{usuario?.opticaNombre || "Tu óptica"}</h2>
                          <p className="mt-1 text-xs font-medium uppercase tracking-[0.16em] text-slate-500">Salud visual &amp; optometría</p>
                          {(usuario?.opticaMarca?.direccion || usuario?.opticaMarca?.telefono || usuario?.opticaMarca?.correo) && (
                            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                              {[usuario?.opticaMarca?.direccion, usuario?.opticaMarca?.telefono, usuario?.opticaMarca?.correo].filter(Boolean).join(" · ")}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-[11px] font-bold uppercase tracking-[0.16em]" style={{ color: GOLD }}>Receta óptica</p>
                        <p className="mt-1 font-mono text-xs font-semibold text-slate-700">N.º {recetaNum}</p>
                        <p className="text-[11px] text-slate-500">{fechaLarga}</p>
                      </div>
                    </div>
                  </div>

                  {/* Línea de acento dorada */}
                  <div className="print-force-color mx-8 mt-5 h-[3px] rounded-full" style={{ background: `linear-gradient(90deg, ${GOLD}, ${GOLD}55 60%, transparent)` }} />

                  {/* Datos del paciente */}
                  <div className="print-force-color mx-8 mt-5 grid grid-cols-2 gap-x-6 gap-y-2 rounded-xl bg-slate-50 px-5 py-3.5 sm:grid-cols-4">
                    <RecetaDato label="Paciente" valor={pacienteSeleccionado || "—"} />
                    <RecetaDato label="Cédula" valor={pacienteInfo?.cedula || "—"} />
                    <RecetaDato label="Edad" valor={edadPaciente != null ? `${edadPaciente} años` : "—"} />
                    <RecetaDato label="¿Usa lentes?" valor={usaLentes === "si" ? "Sí" : usaLentes === "no" ? "No" : "—"} />
                  </div>

                  {/* El ing probó esta receta impresa y pidió quitar el
                      cartel de "Estado de corrección visual" de aquí — "esto
                      es subjetivo" y su sistema no está pensado para dar un
                      diagnóstico previo antes del propio diagnóstico del
                      optómetra (ver ING7). El cálculo sigue vivo como
                      contexto interno para el optómetra (PanelEvolucion,
                      arriba, marcado "no se imprime") y sigue alimentando el
                      indicador de Reportes — solo se retira de este documento
                      impreso. */}

                  {/* Diagnóstico, lente recomendado e indicaciones — lo que el paciente se lleva */}
                  <div className="space-y-3.5 px-8 pt-5">
                    <div className="print-force-color rounded-xl border border-slate-200/60 bg-slate-50/70 p-4">
                      <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                        <Stethoscope size={12} /> Diagnóstico
                      </label>
                      {fichaGuardada ? (
                        <p className="text-base font-bold" style={{ color: INK }}>
                          {diagnosticoCategorias.join(", ")}{diagnostico.trim() ? ` — ${diagnostico.trim()}` : ""}
                        </p>
                      ) : (
                        <>
                          <div className="flex flex-wrap gap-1.5">
                            {/* "Otro" siempre disponible como salida de emergencia,
                                sin depender de qué catálogo haya configurado el
                                admin — pedido del ing: "puede ser tal vez pongo
                                'Otro' y aquí detallo". */}
                            {[...diagnosticosRapidos, ...(diagnosticosRapidos.includes("Otro") ? [] : ["Otro"])].map((cat) => {
                              const activo = diagnosticoCategorias.includes(cat)
                              return (
                                <button
                                  key={cat}
                                  type="button"
                                  onClick={() => {
                                    setDiagnosticoCategorias((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]))
                                    limpiarError("diagnostico")
                                    limpiarError("diagnosticoDetalle")
                                  }}
                                  className="rounded-full border px-3 py-1.5 text-xs font-bold transition cursor-pointer"
                                  style={activo ? { backgroundColor: "#2563eb", borderColor: "#2563eb", color: "#fff" } : { borderColor: "#e2e8f0", color: "#475569", backgroundColor: "#fff" }}
                                >
                                  {cat}
                                </button>
                              )
                            })}
                          </div>
                          {errores.diagnostico && (
                            <p className="no-print mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600">
                              <AlertCircle size={13} /> {errores.diagnostico}
                            </p>
                          )}
                          {/* Con "Otro" seleccionado, el detalle deja de ser una
                              nota opcional de una línea — es la única fuente
                              del diagnóstico en sí, así que pasa a ser un
                              textarea más amplio pensado para escribir el
                              hallazgo completo, no solo una aclaración. */}
                          {diagnosticoCategorias.includes("Otro") ? (
                            <>
                              <label htmlFor="diagnostico" className="mb-1 mt-3 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                                Detalle del diagnóstico personalizado
                              </label>
                              <textarea
                                id="diagnostico"
                                rows={3}
                                placeholder="Detalle del diagnóstico personalizado..."
                                value={diagnostico}
                                onChange={(e) => { setDiagnostico(e.target.value); limpiarError("diagnosticoDetalle") }}
                                className={"w-full resize-none rounded-lg border bg-white px-3 py-2.5 text-sm font-medium leading-relaxed outline-none transition focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100 " + (errores.diagnosticoDetalle ? "border-red-400 ring-2 ring-red-100" : "border-slate-300")}
                                style={{ color: INK }}
                              />
                              {errores.diagnosticoDetalle && (
                                <p className="no-print mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600">
                                  <AlertCircle size={13} /> {errores.diagnosticoDetalle}
                                </p>
                              )}
                            </>
                          ) : (
                            <>
                              <label htmlFor="diagnostico" className="mb-1 mt-3 block text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                                Detalle <span className="font-normal normal-case text-slate-400">(opcional)</span>
                              </label>
                              <input
                                id="diagnostico"
                                type="text"
                                placeholder="Ej. Se determina progresión leve, control en 6 meses"
                                value={diagnostico}
                                onChange={(e) => setDiagnostico(e.target.value)}
                                className="w-full bg-transparent text-sm font-medium outline-none focus-visible:underline"
                                style={{ color: INK }}
                              />
                            </>
                          )}
                        </>
                      )}
                    </div>

                    {/* No todo diagnóstico recomienda un lente — el ing fue
                        explícito con esto ("no sé si todos los tratamientos
                        recomiendan un lente"). Sin el checkbox, ni el campo
                        de texto ni la búsqueda de inventario aparecen. */}
                    {!fichaGuardada && (
                      <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200/60 bg-slate-50/70 p-3.5 text-sm font-semibold text-slate-700">
                        <input
                          type="checkbox"
                          checked={recomendarLente}
                          onChange={(e) => {
                            setRecomendarLente(e.target.checked)
                            if (!e.target.checked) {
                              setLenteRecomendado("")
                            }
                          }}
                          className="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600 focus-visible:ring-blue-500"
                        />
                        <Glasses size={16} style={{ color: GOLD }} /> Añadir recomendación de lente
                      </label>
                    )}

                    {recomendarLente && (lenteRecomendado || !fichaGuardada) && (
                      <div className="print-force-color flex items-start gap-3 rounded-xl border p-4" style={{ borderColor: "rgba(200,162,78,0.35)", backgroundColor: "rgba(200,162,78,0.08)" }}>
                        <Glasses size={18} style={{ color: GOLD }} className="mt-0.5 shrink-0" />
                        <div className="flex-1 space-y-2">
                          <label htmlFor="lenteRecomendado" className="mb-1 block text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "#7c5e14" }}>Lente a recomendar</label>
                          <input
                            id="lenteRecomendado"
                            type="text"
                            placeholder="Ej. Monofocal con antirreflejo y filtro luz azul"
                            value={lenteRecomendado}
                            readOnly={fichaGuardada}
                            onChange={(e) => setLenteRecomendado(e.target.value)}
                            className="w-full bg-transparent text-sm font-semibold outline-none focus-visible:underline"
                            style={{ color: INK }}
                          />
                          <p className="no-print text-[11px] text-slate-500">Solo el texto de la receta: la luna se elige y se cobra al vender, sin inventario.</p>
                        </div>
                      </div>
                    )}

                    {/* Atención terminada (R33-R34): la receta está lista; el paciente se
                        pasa a la óptica (queda "Listo para venta") o se cobra ahí mismo. */}
                    {fichaGuardada && cobroEstado === "terminada" && (
                      <div role="status" className="no-print space-y-2.5 rounded-lg border border-emerald-200/60 bg-emerald-50 p-3.5">
                        <p className="flex items-center gap-1.5 text-sm font-bold text-emerald-900">
                          <CheckCircle size={16} className="shrink-0 text-emerald-600" />
                          Atención terminada{citaEnAtencionId ? " · la cita quedó atendida" : ""}. La receta está lista.
                        </p>
                        {paseDeEstaConsulta ? (
                          <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                            <ShoppingBag size={14} className="shrink-0" /> Listo para venta: quien venda verá a este paciente en su lista.
                          </p>
                        ) : (
                          <p className="text-xs text-emerald-800">Si el paciente va a comprar, pásalo a la óptica o cóbralo ahora.</p>
                        )}
                        {errorPase && <p role="alert" className="text-xs font-medium text-red-700">{errorPase}</p>}
                        <div className="flex flex-wrap items-center gap-2">
                          {!paseDeEstaConsulta && (
                            <button type="button" onClick={pasarAOptica} disabled={pasandoAOptica || !consultaGuardadaId} className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold text-white transition hover:brightness-110 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60" style={{ background: GRAD }}>
                              <ShoppingBag size={14} /> {pasandoAOptica ? "Pasando…" : "Pasar a la óptica"}
                            </button>
                          )}
                          <button type="button" onClick={() => setMostrarPanelCobro(true)} className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3.5 py-2 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-100 cursor-pointer">
                            <Receipt size={14} /> Cobrar ahora
                          </button>
                          {(onVolver || onCerrar) && (
                            <button type="button" onClick={onVolver || onCerrar} className="rounded-lg border border-slate-200/60 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">
                              Volver a {origenNombre}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                    {fichaGuardada && cobroEstado === "cobrado" && (
                      <div role="status" className="no-print flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200/60 bg-emerald-50 p-3">
                        <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                          <CheckCircle size={14} className="shrink-0" />
                          Cobrado ${cobroTotal.toFixed(2)}{citaEnAtencionId ? " · cita atendida" : ""}. Ya puedes imprimir la receta.
                        </p>
                        {(onVolver || onCerrar) && (
                          <button type="button" onClick={onVolver || onCerrar} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700 cursor-pointer">
                            Volver a {origenNombre}
                          </button>
                        )}
                      </div>
                    )}

                    {!fichaGuardada && (
                      <div className="no-print rounded-lg border border-dashed border-slate-300 bg-slate-50/70 p-3">
                        <label className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                          <ImageIcon size={12} /> Adjuntar imágenes <span className="font-normal normal-case text-slate-500">(opcional — hasta 6)</span>
                        </label>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          {archivosImagenes.map((f, i) => (
                            <div key={i} className="relative h-14 w-14 overflow-hidden rounded-lg border border-slate-200/60">
                              <img src={previsualizacionesImagenes[i]} alt={f.name} className="h-full w-full object-cover" />
                              <button type="button" onClick={() => quitarArchivoImagen(i)} aria-label="Quitar imagen" className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-black/60 text-white cursor-pointer">
                                <X size={10} />
                              </button>
                            </div>
                          ))}
                          {archivosImagenes.length < 6 && (
                            <label className="grid h-14 w-14 cursor-pointer place-items-center rounded-lg border border-dashed border-slate-300 text-slate-400 transition hover:border-blue-300 hover:text-blue-500">
                              <ImageIcon size={18} />
                              <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={(e) => { agregarArchivosImagenes(e.target.files); e.target.value = "" }} />
                            </label>
                          )}
                        </div>
                      </div>
                    )}

                    {(indicaciones || !fichaGuardada) && (
                      <div className="print-force-color rounded-xl border border-slate-200/60 bg-slate-50/70 p-4">
                        <label htmlFor="indicaciones" className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                          <ClipboardList size={12} /> Indicaciones y cuidados
                        </label>
                        <textarea
                          id="indicaciones"
                          rows={2}
                          placeholder="Ej. Uso permanente de lentes con filtro antirreflejo y luz azul."
                          value={indicaciones}
                          readOnly={fichaGuardada}
                          onChange={(e) => setIndicaciones(e.target.value)}
                          className="w-full resize-none bg-transparent text-sm font-medium outline-none focus-visible:underline"
                          style={{ color: INK }}
                        />
                      </div>
                    )}

                    <div className="print-force-color rounded-xl border border-slate-200/60 bg-slate-50/70 p-4">
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">Medidas de graduación</p>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs font-semibold text-slate-500">OD (derecho)</p>
                          <p className="font-semibold" style={{ color: INK }}>{odEsfera || "—"} {odCilindro || ""} x{odEje || "—"}°</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-500">OI (izquierdo)</p>
                          <p className="font-semibold" style={{ color: INK }}>{oiEsfera || "—"} {oiCilindro || ""} x{oiEje || "—"}°</p>
                        </div>
                      </div>
                    </div>

                    {/* Punto 2.1 (plan 29 sept.): si el optómetra da de alta
                        al paciente, ya no tiene sentido pedirle un próximo
                        control — se oculta el selector y se explica por qué. */}
                    <label className="no-print flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200/60 bg-slate-50 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={tratamientoFinalizado}
                        disabled={fichaGuardada}
                        onChange={(e) => setTratamientoFinalizado(e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-blue-600 focus-visible:ring-blue-500 disabled:cursor-not-allowed"
                      />
                      <span>
                        <span className="block text-sm font-semibold" style={{ color: INK }}>Tratamiento finalizado</span>
                        <span className="block text-xs text-slate-500">El paciente ya no necesita más controles — queda marcado como "De alta".</span>
                      </span>
                    </label>

                    <div className="print-force-color flex items-center gap-3 rounded-xl border border-slate-200/60 bg-slate-50 px-4 py-3">
                      <CalendarClock size={18} className="no-print shrink-0 text-blue-600" />
                      <div className="flex-1">
                        <label htmlFor="proximoControl" className="block text-xs font-bold uppercase tracking-wide text-slate-500">Próximo control recomendado</label>
                        <p className="no-print text-[11px] text-slate-500">
                          {tratamientoFinalizado ? "No aplica — el tratamiento quedó finalizado." : "Define cuándo el CRM debe avisar si el paciente no ha vuelto."}
                        </p>
                      </div>
                      {!tratamientoFinalizado && (
                        <select
                          id="proximoControl"
                          value={proximoControlDias}
                          disabled={fichaGuardada}
                          onChange={(e) => { setProximoControlDias(Number(e.target.value)); setControlFecha(""); setControlHora("") }}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus-visible:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                        >
                          <option value={30}>1 mes</option>
                          <option value={90}>3 meses</option>
                          <option value={180}>6 meses</option>
                          <option value={365}>1 año</option>
                        </select>
                      )}
                    </div>

                    {!tratamientoFinalizado && (
                      <fieldset disabled={fichaGuardada} className="no-print mt-3 rounded-xl border border-slate-200/60 bg-white p-4">
                        <legend className="px-1 text-sm font-bold" style={{ color: INK }}>¿Cuándo se agenda ese control?</legend>
                        <p className="mb-3 text-xs text-slate-500">El paciente tiene que aceptar la fecha y la hora, así que la cita solo se crea si eliges "Agendar ahora" y al guardar la ficha.</p>
                        <div role="radiogroup" aria-label="Cuándo se agenda el control" className="grid gap-2 sm:grid-cols-2">
                          {[
                            ["ahora", "Agendar ahora", "Elige fecha y hora con los horarios libres."],
                            ["despues", "Agendar después", "No se crea la cita: queda como aviso para Recepción y el administrador."],
                          ].map(([valor, titulo, ayuda]) => (
                            <label key={valor} className={"flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors " + (controlModo === valor ? "border-blue-300 bg-blue-50/50" : "border-slate-200/60 bg-slate-50 hover:border-blue-200") + (fichaGuardada ? " cursor-not-allowed opacity-70" : "")}>
                              <input type="radio" name="control-agenda" value={valor} checked={controlModo === valor} onChange={() => { setControlModo(valor); limpiarError("control") }} className="mt-0.5 h-4 w-4 accent-blue-600" />
                              <span className="min-w-0 text-sm">
                                <span className="block font-semibold text-slate-700">{titulo}</span>
                                <span className="block text-xs leading-relaxed text-slate-500">{ayuda}</span>
                              </span>
                            </label>
                          ))}
                        </div>
                        {controlModo === "ahora" && (
                          <div className="mt-3 space-y-3">
                            {diaControlSugerido ? (
                              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                                <span>
                                  Fecha recomendada: <span className="font-semibold">{textoDia(fechaControlRecomendada)}</span>
                                  {diaControlSugerido !== fechaControlRecomendada && <> · ese día no hay atención; el día hábil más cercano es el <span className="font-semibold">{textoDia(diaControlSugerido)}</span></>}
                                </span>
                                <button type="button" onClick={() => { setControlFecha(diaControlSugerido); setControlHora("") }} className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-50 cursor-pointer">
                                  Elegir {diaControlSugerido === fechaControlRecomendada ? "esa fecha" : "ese día"}
                                </button>
                              </div>
                            ) : (
                              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">No hay un día con cupo cerca de la fecha recomendada ({textoDia(fechaControlRecomendada)}). Elige otro en el calendario.</p>
                            )}
                            <SelectorFechaHora
                              disponibilidad={disponibilidad}
                              citas={citas}
                              fecha={controlFecha}
                              hora={controlHora}
                              onCambiarFecha={(f) => { setControlFecha(f); limpiarError("control") }}
                              onCambiarHora={(h) => { setControlHora(h); limpiarError("control") }}
                              mesesAdelante={14}
                              mesInicial={diaControlSugerido || fechaControlRecomendada}
                            />
                          </div>
                        )}
                        {errores.control && <p role="alert" className="mt-3 text-sm font-semibold text-red-600">{errores.control}</p>}
                      </fieldset>
                    )}
                  </div>

                  {/* Pie: validez + firma */}
                  <div className="mt-8 border-t border-slate-100 px-8 pb-8 pt-6">
                    <div className="flex items-end justify-between gap-6">
                      <p className="max-w-[16rem] text-[10px] leading-relaxed text-slate-500">
                        Presente esta receta para la elaboración de sus lentes. Validez de 12 meses desde la fecha de emisión.
                      </p>
                      <div className="w-52 text-center">
                        <div className="mb-2.5 border-t border-slate-400" />
                        <p className="text-sm font-bold" style={{ color: INK }}>{usuario?.nombre || "Optómetra"}</p>
                        <p className="text-[11px] text-slate-500">{usuario?.registroProfesional ? `Reg. Prof. ${usuario.registroProfesional}` : "Reg. Prof. ____________"}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navegación */}
            <div className="no-print mt-2 flex items-center justify-between border-t border-slate-100 pt-4">
              <div className="text-sm font-medium text-slate-500">Paso {pasoActual?.n} de 3</div>
              <div className="flex gap-2">
                {subTab !== "anamnesis" && (
                  <button
                    type="button"
                    onClick={() => irA(subTab === "diagnostico" ? "refraccion" : "anamnesis")}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer"
                  >
                    <ArrowLeft size={15} /> Anterior
                  </button>
                )}
                {subTab !== "diagnostico" ? (
                  <button
                    key="btn-siguiente"
                    type="button"
                    onClick={() => irA(subTab === "anamnesis" ? "refraccion" : "diagnostico")}
                    className="flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 cursor-pointer"
                    style={{ backgroundColor: INK }}
                  >
                    Siguiente <ArrowRight size={15} />
                  </button>
                ) : !fichaGuardada ? (
                  // key distinta del botón "Siguiente" de arriba a propósito: sin
                  // ella, React reutiliza el mismo nodo <button> al cambiar de
                  // paso y solo le muta el atributo type de "button" a "submit"
                  // A MITAD del despacho síncrono del clic — el navegador evalúa
                  // si el clic activa un envío de formulario DESPUÉS de ese
                  // re-render, así que un clic real en "Siguiente" terminaba
                  // disparando un submit fantasma del formulario completo
                  // (intentarGuardar) apenas se entraba a Diagnóstico, mostrando
                  // el error de categoría/costo sin que el usuario tocara nada
                  // (bug reportado por el ing 29-sept, ver docs/feedback-ing/bug-diagnostico-receta.md).
                  <button
                    key="btn-guardar"
                    type="submit"
                    className="flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 cursor-pointer"
                    style={{ background: GRAD, boxShadow: "0 12px 24px -12px rgba(37,99,235,0.6)" }}
                  >
                    <Save size={15} /> Terminar atención
                  </button>
                ) : (
                  <button
                    key="btn-nueva-consulta"
                    type="button"
                    onClick={resetForm}
                    className="flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 cursor-pointer"
                    style={{ backgroundColor: INK }}
                  >
                    <ClipboardList size={15} /> Nueva consulta
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>

      {mostrarDejarDeAtender && (
        <ConfirmarEliminarModal
          titulo="¿Dejar de atender?"
          mensaje={`Lo que no guardaste de la ficha se perderá y la cita de ${pacienteSeleccionado || "este paciente"} se mantiene agendada.${errorDejarDeAtender ? " " + errorDejarDeAtender : ""}`}
          etiquetaConfirmar="Sí, dejar de atender"
          eliminando={dejandoDeAtender}
          onCancelar={() => setMostrarDejarDeAtender(false)}
          onConfirmar={dejarDeAtender}
        />
      )}

      {mostrarConfirmarGuardar && (
        <ConfirmarFichaModal
          paciente={pacienteSeleccionado}
          diagnostico={diagnostico}
          lenteRecomendado={lenteRecomendado}
          usaLentes={usaLentes}
          onCancelar={() => { setMostrarConfirmarGuardar(false); setErrorConfirmarFicha("") }}
          onConfirmar={confirmarGuardarFicha}
          guardando={guardandoFicha}
          error={errorConfirmarFicha}
        />
      )}

      {mostrarHistorial && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={() => setMostrarHistorial(false)}>
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-2xl" style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)", willChange: "transform, opacity" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: GRAD }}>
                  <History size={20} />
                </div>
                <div>
                  <h4 className="text-lg font-bold" style={{ color: INK }}>Historial clínico</h4>
                  <p className="text-xs text-slate-500">{pacienteSeleccionado}</p>
                </div>
              </div>
              <button type="button" onClick={() => setMostrarHistorial(false)} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
              {historialPaciente.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <div className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-300"><History size={22} /></div>
                  <p className="text-sm font-medium text-slate-500">Este paciente aún no tiene consultas registradas.</p>
                </div>
              ) : (
                historialPaciente.map((c) => <TarjetaVisita key={c.id} consulta={c} />)
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ─── AVISO: PRIMERA CONSULTA DEL PACIENTE (feedback del asesor) ─── */}
      {avisoPrimeraVisita && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={() => setAvisoPrimeraVisita(false)}>
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl" style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)", willChange: "transform, opacity" }} onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-6 text-center">
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full text-white" style={{ background: GRAD }}>
                <Sparkles size={22} />
              </div>
              <h2 className="text-lg font-bold" style={{ color: INK }}>Primera consulta de {pacienteSeleccionado}</h2>
              <p className="mt-1.5 text-sm text-slate-500">No hay historial previo para este paciente. Completa antecedentes, alergias y antecedentes familiares antes de continuar con la refracción.</p>
            </div>
            <div className="border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                onClick={() => { setAvisoPrimeraVisita(false); setTimeout(() => document.getElementById("antecedentes")?.focus(), 50) }}
                className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 cursor-pointer"
                style={{ background: GRAD }}
              >
                Entendido, completar antecedentes
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ─── PANEL DE COBRO (Ronda 4): aparece al guardar la ficha ─── */}
      {mostrarPanelCobro && pacienteInfo && (
        <ComprobanteVentaModal
          usuario={usuario}
          inventario={inventario}
          setInventario={setInventario}
          pacienteFijo={pacienteInfo}
          titulo={`Cobrar la atención de ${pacienteInfo.nombre}`}
          subtitulo={`Consulta${motivo ? ` · ${motivo}` : ""}`}
          etiquetaGuardar="Cobrar y finalizar"
          lineasIniciales={lineasCobroConsulta({ motivo, lenteRecomendado: recomendarLente ? lenteRecomendado : "" }, parametrizacion)}
          consultaId={consultaGuardadaId}
          citaId={citaEnAtencionId}
          onGuardado={alCobrar}
          onMasTarde={() => setMostrarPanelCobro(false)}
          onCerrar={() => setMostrarPanelCobro(false)}
        />
      )}
    </div>
  )
}

/* ---------- Subcomponentes ---------- */

// Una sola línea de variación frente a la visita anterior — reemplaza las
// tarjetas grandes "Comparación con la refracción de hoy". Solo aparece si hay
// valores de hoy comparables con los de la visita anterior.
function LineaVariacion({ analisis }) {
  if (!analisis || analisis.primera || analisis.variacion == null) return null
  const t = TENDENCIA[analisis.verdicto] || TENDENCIA["Sin cambios"]
  const IconoT = t.icon
  return (
    <p className="no-print flex items-center gap-1.5 text-xs text-slate-500">
      <IconoT size={13} style={{ color: t.fg }} aria-hidden="true" />
      Variación frente al {fechaLegible(analisis.fechaPrev)}:{" "}
      <span className="font-semibold" style={{ color: t.fg }}>{analisis.verdicto.toLowerCase()}</span> ({textoVariacion(analisis.variacion)})
    </p>
  )
}

// Estado de corrección como chip junto a su dato (AV con lentes), solo si se
// registró en ambos ojos — antes era una tarjeta que casi siempre decía
// "Sin evaluar".
function ChipCorreccion({ correccion }) {
  if (correccion === "Sin evaluar") return null
  const c = CORRECCION[correccion]
  const IconoC = c.icon
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold"
      style={{ borderColor: c.border, backgroundColor: c.bg, color: c.fg }}
      title={c.txt}
    >
      <IconoC size={13} aria-hidden="true" /> Corrección: {correccion === "Bien corregido" ? "efectiva" : "requiere ajuste"}
    </span>
  )
}

function OjoCard({ sigla, titulo, esfera, setEsfera, cilindro, setCilindro, eje, setEje, avSc, setAvSc, avCc, setAvCc, errores = {}, limpiarError }) {
  const color = sigla === "OD" ? "#2563EB" : "#06b6d4"
  const pre = sigla.toLowerCase()
  return (
    <div className="space-y-3.5 rounded-xl border border-slate-200/60 bg-slate-50/60 p-4">
      <div className="flex items-center gap-2 border-b border-slate-200/60 pb-2">
        <span className="grid h-6 w-6 place-items-center rounded-md font-mono text-xs font-bold text-white" style={{ backgroundColor: color }}>
          {sigla}
        </span>
        <h3 className="text-sm font-bold" style={{ color }}>{titulo}</h3>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <NumCampo label="Esfera" value={esfera} onChange={(v) => { setEsfera(v); limpiarError?.(`${pre}_esfera`) }} id={`${sigla}-esf`} error={errores[`${pre}_esfera`]} placeholder="0.00" />
        <NumCampo label="Cilindro" value={cilindro} onChange={(v) => { setCilindro(v); limpiarError?.(`${pre}_cilindro`); limpiarError?.(`${pre}_eje`) }} id={`${sigla}-cil`} error={errores[`${pre}_cilindro`]} placeholder="0.00" />
        <NumCampo label="Eje (°)" value={eje} onChange={(v) => { setEje(v); limpiarError?.(`${pre}_eje`) }} id={`${sigla}-eje`} error={errores[`${pre}_eje`]} tipo="entero" maxLength={3} placeholder="0" />
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-slate-200/60 pt-2">
        <div>
          <label htmlFor={`${sigla}-avsc`} className="mb-0.5 block text-xs font-semibold text-slate-500">AV sin lentes</label>
          <select id={`${sigla}-avsc`} value={avSc} onChange={(e) => setAvSc(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none focus-visible:border-blue-500">
            <option value="">Sin evaluar</option>
            {escalasSnellen.map((esc) => (<option key={esc} value={esc}>{esc}</option>))}
          </select>
        </div>
        <div>
          <label htmlFor={`${sigla}-avcc`} className="mb-0.5 block text-xs font-semibold text-slate-500">AV con lentes</label>
          <select id={`${sigla}-avcc`} value={avCc} onChange={(e) => setAvCc(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none focus-visible:border-blue-500">
            <option value="">Sin evaluar</option>
            {escalasSnellen.map((esc) => (<option key={esc} value={esc}>{esc}</option>))}
          </select>
        </div>
      </div>
    </div>
  )
}

function NumCampo({ label, value, onChange, id, error, tipo = "decimal", maxLength, placeholder }) {
  const manejarCambio = (e) => {
    const filtrado = tipo === "entero" ? filtrarSoloNumeros(e.target.value, maxLength) : filtrarNumeroDecimalConSigno(e.target.value)
    onChange(filtrado)
  }
  return (
    <div>
      <label htmlFor={id} className="mb-0.5 block text-xs font-semibold text-slate-500">{label}</label>
      <input
        id={id}
        type="text"
        inputMode={tipo === "entero" ? "numeric" : "decimal"}
        value={value}
        onChange={manejarCambio}
        placeholder={placeholder}
        className={"w-full rounded-lg border bg-white px-2 py-1.5 text-center font-mono text-sm font-semibold text-slate-800 outline-none placeholder:font-normal placeholder:text-slate-300 focus-visible:border-blue-500 " + (error ? "border-red-400 ring-2 ring-red-100" : "border-slate-300")}
      />
      {error && <p className="mt-0.5 text-[10px] font-medium text-red-600">{error}</p>}
    </div>
  )
}

function MedidaCampo({ id, label, value, onChange, placeholder }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-slate-500">{label}</label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm font-semibold text-slate-700 outline-none placeholder:font-normal placeholder:text-slate-300 focus-visible:border-blue-500"
      />
    </div>
  )
}

// Registrado/no registrado a simple vista en una sección colapsable opcional
function EtiquetaRegistro({ registrado }) {
  return (
    <span className={"rounded-full px-2 py-0.5 text-xs font-bold normal-case " + (registrado ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500")}>
      {registrado ? "Registrado" : "No registrado"}
    </span>
  )
}

// Tarjeta de una visita del historial — reutilizada tanto por el modal de
// historial completo como por el bloque "Última cita", para que ambos
// muestren exactamente los mismos datos de la misma fuente (historialPaciente).
function TarjetaVisita({ consulta: c }) {
  return (
    <div className="rounded-xl border border-slate-200/60 bg-slate-50/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-bold" style={{ color: INK }}>{c.fecha}</span>
        <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 shadow-sm">{c.motivo || "Consulta general"}</span>
      </div>
      {c.detalleConsulta && <p className="mt-1 text-xs italic text-slate-500">"{c.detalleConsulta}"</p>}
      <p className="mt-1.5 text-sm text-slate-700">{c.diagnostico || "Sin diagnóstico registrado"}</p>
      <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[11px] text-slate-500">
        <span>OD: {textoOjo(c.od)} · AV {c.od?.avCc || "—"}</span>
        <span>OI: {textoOjo(c.oi)} · AV {c.oi?.avCc || "—"}</span>
      </div>
      {c.lenteRecomendado && <p className="mt-1.5 text-[11px] text-slate-500">Lente recomendado: <span className="font-semibold text-slate-600">{c.lenteRecomendado}</span></p>}
    </div>
  )
}

// Marca un campo como heredado de una visita anterior, sin ocultar que sigue siendo editable
function InsigniaHistorial({ fecha }) {
  const fechaCorta = fecha ? fechaLegible(fecha) : null
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600" title="Puedes editarlo si cambió">
      <History size={10} /> {fechaCorta ? `De su visita del ${fechaCorta}` : "De su historial"}
    </span>
  )
}

// "-1.00 -0.50 x180", o "No registrada" si ese ojo no se midió.
function textoOjo(o) {
  if (!o || (!o.esfera && !o.cilindro && !o.eje)) return "No registrada"
  return [o.esfera, o.cilindro, o.eje ? `x${o.eje}` : ""].filter(Boolean).join(" ")
}

function RecetaDato({ label, valor }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">{valor}</p>
    </div>
  )
}

