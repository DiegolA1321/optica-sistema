"use client"

import { dinero } from "../utilidades/formatoMoneda"
import { ahoraEcuador } from "../utilidades/horaEcuador"

import { useState, useEffect, useMemo, useRef } from "react"
import { supabase } from "../lib/supabaseClient"
import {
  Eye,
  FileText,
  ClipboardList,
  CheckCircle,
  ArrowLeft,
  Save,
  Stethoscope,
  AlertCircle,
  User,
  Sparkles,
  Printer,
  Search,
  TrendingUp,
  TrendingDown,
  Minus,
  ScanEye,
  Glasses,
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
import { filtrarSoloNumeros } from "../utilidades/validaciones"
import { hoyISO, diaTieneCupo } from "../utilidades/disponibilidad"
import { sumarDiasISO, diaHabilMasCercano } from "../utilidades/controles"
import { MENSAJE_HORA_INVALIDA, esErrorHoraInvalida } from "../utilidades/erroresCitas"
import CampoFecha from "../componentes/CampoFecha"
import SelectorFechaHora from "../componentes/SelectorFechaHora"
import { moverCitaAHoy, necesitaMoverseAHoy } from "../utilidades/moverCitaAHoy"
import { antecedentesRelevantes, textoAntecedentes } from "../utilidades/antecedentes"
import { lineasCobroConsulta } from "../utilidades/costosConsulta"
import ConfirmarFichaModal from "../componentes/ConfirmarFichaModal"
import { Cascaron } from "../componentes/AtencionPaciente"
import ConfirmarEliminarModal from "../componentes/ConfirmarEliminarModal"
import ComprobanteVentaModal from "./ComprobanteVentaModal"
import { registrarLog } from "../utilidades/logs"
import { ordenarPorFechaYCreacion } from "../utilidades/fidelizacion"
import { fechaLegible, formatoFecha } from "../utilidades/formatoFecha"
import { variacionEntre, verdictoPorVariacion, tendenciaEntreConsultas, textoDioptrias } from "../utilidades/tendenciaGraduacion"
import { imprimirHojaReceta } from "../utilidades/imprimirHojaReceta"
import HojaReceta from "../componentes/HojaReceta"
import { MENSAJE_SIN_PERMISO, esErrorSinPermiso } from "../utilidades/permisos"
import { INK, GOLD } from "@/lib/tema"
import TablaRefraccion from "../componentes/ficha/TablaRefraccion"
import { SeccionFicha, BarraPasos, BloqueOpcional, VistaPreviaHoja, useAltoCabecera, useSeccionActiva } from "../componentes/ficha/PartesFicha"
import { claveBorrador, guardarBorrador, leerBorrador, borrarBorrador, textoGuardado } from "../utilidades/borradorFicha"

// ─── Paleta de firma (consistente con el resto del sistema) ───
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)" // cian → azul

const escalasSnellen = ["20/20", "20/25", "20/30", "20/40", "20/50", "20/70", "20/100", "20/200"]
const ORDEN_SNELLEN = escalasSnellen.reduce((acc, esc, i) => ({ ...acc, [esc]: i }), {})

// Las secciones de la ficha (una sola página): nombres cortos, para que la barra de pasos nunca los corte. Los ids de anamnesis, refraccion y diagnostico son los de la validación.
const SECCIONES = [
  { id: "anamnesis", label: "Motivo" },
  { id: "refraccion", label: "Refracción" },
  { id: "examen", label: "Examen" },
  { id: "diagnostico", label: "Diagnóstico" },
  { id: "receta", label: "Receta" },
]
const IDS_SECCIONES = SECCIONES.map((s) => s.id)

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
  const cabeceraRef = useRef(null)
  useAltoCabecera(cabeceraRef)
  const [seccionActiva, setSeccionActiva] = useSeccionActiva(IDS_SECCIONES)
  const [mostrarHojaCompleta, setMostrarHojaCompleta] = useState(false)
  // Guardado automático (borradorFicha.js): cuándo se guardó por última vez y si hay una ficha a medias que recuperar.
  const [guardadoEn, setGuardadoEn] = useState(null)
  const [borradorPendiente, setBorradorPendiente] = useState(null)
  const [ahoraTexto, setAhoraTexto] = useState(() => Date.now())
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
  const clave = claveBorrador(usuario?.id, pacienteId, citaEnAtencionId)

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
  // Una receta exige los dos ojos: solo se deja uno sin medir si se marca «Ojo no evaluado» y se dice por qué (por ejemplo, una prótesis ocular).
  const [odNoEval, setOdNoEval] = useState(false)
  const [odMotivoNoEval, setOdMotivoNoEval] = useState("")
  const [oiNoEval, setOiNoEval] = useState(false)
  const [oiMotivoNoEval, setOiMotivoNoEval] = useState("")

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
    registrarLog(usuario, "ventas", "Cobró la atención desde la ficha clínica", `${dinero((Number(factura.montoTotal) || 0))}`)
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
    borrarBorrador(clave)
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
    oiEsfera, oiCilindro, oiEje, oiAgudezaSc, oiAgudezaCc, odNoEval, odMotivoNoEval, oiNoEval, oiMotivoNoEval, adicion, dp, alt, avCerca,
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
      const abrirCita = async () => {
        let cita = citaActual
        // Una cita de otro día que se atiende hoy se mueve a hoy (igual que "Atender" en Citas): nunca queda "En atención" con fecha futura.
        if (necesitaMoverseAHoy(cita)) {
          const r = await moverCitaAHoy({ supabase, opticaId: usuario?.opticaId, cita, citas, setCitas, usuario })
          if (r.error) { onAviso?.(r.error); return }
          cita = r.cita
          onAviso?.(`La cita era de otro día: se movió a hoy, a las ${cita.hora}.`)
        }
        if (cita && !["Atendida", "Cancelada", "No Asistió", "En Atención"].includes(cita.estado)) {
          aperturaCita.current.estado = cita.estado
          supabase?.from("citas").update({ estado: "En Atención" }).eq("id", citaIdInicial).then(({ error }) => {
            if (!error) setCitas?.((prev) => prev.map((c) => (c.id === citaIdInicial ? { ...c, estado: "En Atención" } : c)))
          })
        }
        // "Atendido por" (R12, R18): quien abre la ficha de la cita queda registrado solo, sin pedirlo, si la cita aún no tiene a nadie.
        // Al guardar la ficha se confirma con quien la guardó. Va en una llamada aparte para que un fallo aquí nunca impida el cambio de estado.
        if (cita && usuario?.id && usuario.rol !== "superadmin" && !["Atendida", "Cancelada"].includes(cita.estado) && !cita.atendidoPor) {
          aperturaCita.current.atendido = true
          supabase?.from("citas").update({ atendido_por: usuario.id }).eq("id", citaIdInicial).then(({ error }) => {
            if (error) console.warn("No se pudo registrar quién atiende la cita:", error.message)
            else setCitas?.((prev) => prev.map((c) => (c.id === citaIdInicial ? { ...c, atendidoPor: usuario.id } : c)))
          })
        }
      }
      abrirCita()
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
    setOdNoEval(false); setOdMotivoNoEval(""); setOiNoEval(false); setOiMotivoNoEval("")
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
    borrarBorrador(clave)
    setGuardadoEn(null)
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
        irASeccion(paso)
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
      od: odNoEval ? { esfera: "", cilindro: "", eje: "", avSc: "", avCc: "" } : { esfera: odEsfera, cilindro: odCilindro, eje: odEje, avSc: odAgudezaSc, avCc: odAgudezaCc },
      oi: oiNoEval ? { esfera: "", cilindro: "", eje: "", avSc: "", avCc: "" } : { esfera: oiEsfera, cilindro: oiCilindro, eje: oiEje, avSc: oiAgudezaSc, avCc: oiAgudezaCc },
      ojoNoEvaluado: { od: odNoEval ? odMotivoNoEval.trim() : "", oi: oiNoEval ? oiMotivoNoEval.trim() : "" },
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
          datos_clinicos: { retinoscopia: nuevaFicha.retinoscopia, od: nuevaFicha.od, oi: nuevaFicha.oi, medidas: nuevaFicha.medidas, examen: nuevaFicha.examen, ojo_no_evaluado: (nuevaFicha.ojoNoEvaluado?.od || nuevaFicha.ojoNoEvaluado?.oi) ? nuevaFicha.ojoNoEvaluado : null, control_agenda: nuevaFicha.controlAgenda, control_asignado_a: nuevaFicha.controlAgenda ? usuario?.id || null : null },
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
    borrarBorrador(clave)
    setGuardadoEn(null)
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
      // La receta exige los dos ojos: si uno tiene medidas, el otro también, o se marca «Ojo no evaluado» con su motivo.
      const medido = (esf, cil, eje) => Boolean(esf.trim() || cil.trim() || eje.trim())
      const hayReceta = (!odNoEval && medido(odEsfera, odCilindro, odEje)) || (!oiNoEval && medido(oiEsfera, oiCilindro, oiEje))
      for (const [pre, noEval, motivoNoEval, esf, cil, eje] of [["od", odNoEval, odMotivoNoEval, odEsfera, odCilindro, odEje], ["oi", oiNoEval, oiMotivoNoEval, oiEsfera, oiCilindro, oiEje]]) {
        if (noEval) {
          if (motivoNoEval.trim().length < 3) errs[`${pre}_motivo`] = "Di por qué no se evaluó este ojo."
          continue
        }
        if (hayReceta && !esf.trim() && !cil.trim()) errs[`${pre}_esfera`] = "Ingresa la esfera o marca «Ojo no evaluado»"
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
    if (paso === "refraccion") return "Revisa la refracción: la receta lleva los dos ojos (o marca «Ojo no evaluado» con su motivo) y lo que escribiste en esfera, cilindro y eje debe ser un número válido (el eje es obligatorio si hay cilindro)."
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

  // Para llevar al optómetra a la sección que falta, mientras guarda.

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

  // La receta impresa es la hoja de la receta (HojaReceta): la misma que ve el paciente al descargarla desde su portal y la que sale de «Imprimir receta» en el perfil.
  // Los datos de la hoja: los mismos para la vista previa de la pantalla y para la impresión (HojaReceta).
  const datosDeLaHoja = () => ({
    optica: { nombre: usuario?.opticaNombre, direccion: usuario?.opticaMarca?.direccion, telefono: usuario?.opticaMarca?.telefono, correo: usuario?.opticaMarca?.correo, logoUrl: usuario?.opticaLogoUrl },
    paciente: { nombre: pacienteSeleccionado, cedula: pacienteInfo?.cedula, edad: edadPaciente },
    receta: {
      id: consultaGuardadaId || recetaNum.split("-").pop().toLowerCase(), fecha: fechaConsulta,
      od: odNoEval ? {} : { esfera: odEsfera, cilindro: odCilindro, eje: odEje, avSc: odAgudezaSc, avCc: odAgudezaCc },
      oi: oiNoEval ? {} : { esfera: oiEsfera, cilindro: oiCilindro, eje: oiEje, avSc: oiAgudezaSc, avCc: oiAgudezaCc },
      ojoNoEvaluado: { od: odNoEval ? odMotivoNoEval.trim() : "", oi: oiNoEval ? oiMotivoNoEval.trim() : "" },
      medidas: { adicion, dp, alt },
      diagnosticoCategorias, diagnostico, lenteRecomendado: recomendarLente ? lenteRecomendado : "", indicaciones,
      profesionalNombre: usuario?.nombre, profesionalRegistro: usuario?.registroProfesional,
    },
  })
  const imprimirReceta = () => imprimirHojaReceta(datosDeLaHoja())

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
  const antecedentesAlerta = useMemo(() => antecedentesRelevantes({ antecedentes, antecedentesFamiliares }), [antecedentes, antecedentesFamiliares])
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

  // ─── Ficha de una sola página ───
  // Los cinco pasos son secciones de la misma página; la barra fija de arriba salta a cada una y cada sección dice sola cómo va (Registrado / Falta algo). Nada de «Siguiente».
  const erroresRefraccion = validarPaso("refraccion")
  const erroresDiagnostico = validarPaso("diagnostico")
  const ojosSinDatos = ["od", "oi"].filter((k) => erroresRefraccion[`${k}_esfera`]?.startsWith("Ingresa la esfera")).map((k) => (k === "od" ? "derecho" : "izquierdo"))
  const estadosSeccion = {
    anamnesis: !pacienteId ? { texto: "Falta el paciente", tono: "pend" }
      : !motivo.trim() ? { texto: "Falta el motivo", tono: "pend" }
      : motivo === "Otros" && !detalleConsulta.trim() ? { texto: "Falta describir el motivo", tono: "pend" }
      : { texto: "Registrado", tono: "ok" },
    refraccion: ojosSinDatos.length ? { texto: `Falta el ojo ${ojosSinDatos.join(" y el ")}`, tono: "pend" }
      : Object.keys(erroresRefraccion).length ? { texto: "Revisa los valores", tono: "pend" }
      : registradoRefraccion ? { texto: "Registrada", tono: "ok" } : { texto: "Sin medir", tono: "neutro" },
    examen: registradoExamenFisico || registradoBiomicroscopia ? { texto: "Registrado", tono: "ok" } : { texto: "Opcional", tono: "neutro" },
    diagnostico: erroresDiagnostico.diagnostico ? { texto: "Falta el diagnóstico", tono: "pend" }
      : erroresDiagnostico.diagnosticoDetalle ? { texto: "Falta el detalle de «Otro»", tono: "pend" }
      : erroresDiagnostico.control ? { texto: "Falta el control", tono: "pend" }
      : { texto: "Registrado", tono: "ok" },
    receta: fichaGuardada ? { texto: "Lista para imprimir", tono: "ok" } : indicaciones.trim() ? { texto: "Registrada", tono: "ok" } : { texto: "Opcional", tono: "neutro" },
  }
  const pasosFicha = SECCIONES.map((s) => ({ ...s, estado: estadosSeccion[s.id] }))

  // Cada dato de la ficha con su «poner»: sirve para guardar el borrador y para recuperarlo sin repetir la lista.
  const campos = {
    fechaConsulta: [fechaConsulta, setFechaConsulta], motivo: [motivo, setMotivo], detalleConsulta: [detalleConsulta, setDetalleConsulta], usaLentes: [usaLentes, setUsaLentes], antecedentes: [antecedentes, setAntecedentes],
    alergias: [alergias, setAlergias], antecedentesFamiliares: [antecedentesFamiliares, setAntecedentesFamiliares], retinoscopiaOd: [retinoscopiaOd, setRetinoscopiaOd], retinoscopiaOi: [retinoscopiaOi, setRetinoscopiaOi],
    odEsfera: [odEsfera, setOdEsfera], odCilindro: [odCilindro, setOdCilindro], odEje: [odEje, setOdEje], odAgudezaSc: [odAgudezaSc, setOdAgudezaSc], odAgudezaCc: [odAgudezaCc, setOdAgudezaCc],
    oiEsfera: [oiEsfera, setOiEsfera], oiCilindro: [oiCilindro, setOiCilindro], oiEje: [oiEje, setOiEje], oiAgudezaSc: [oiAgudezaSc, setOiAgudezaSc], oiAgudezaCc: [oiAgudezaCc, setOiAgudezaCc],
    odNoEval: [odNoEval, setOdNoEval], odMotivoNoEval: [odMotivoNoEval, setOdMotivoNoEval], oiNoEval: [oiNoEval, setOiNoEval], oiMotivoNoEval: [oiMotivoNoEval, setOiMotivoNoEval],
    adicion: [adicion, setAdicion], dp: [dp, setDp], alt: [alt, setAlt], avCerca: [avCerca, setAvCerca], testMotor: [testMotor, setTestMotor], coverTestLejos: [coverTestLejos, setCoverTestLejos], coverTestCerca: [coverTestCerca, setCoverTestCerca],
    oftalmoscopia: [oftalmoscopia, setOftalmoscopia], testColor: [testColor, setTestColor], pioOd: [pioOd, setPioOd], pioOi: [pioOi, setPioOi],
    biomicroParpados: [biomicroParpados, setBiomicroParpados], biomicroCornea: [biomicroCornea, setBiomicroCornea], biomicroCamara: [biomicroCamara, setBiomicroCamara],
    diagnosticoCategorias: [diagnosticoCategorias, setDiagnosticoCategorias], diagnostico: [diagnostico, setDiagnostico], recomendarLente: [recomendarLente, setRecomendarLente], lenteRecomendado: [lenteRecomendado, setLenteRecomendado],
    indicaciones: [indicaciones, setIndicaciones], proximoControlDias: [proximoControlDias, setProximoControlDias], controlModo: [controlModo, setControlModo], controlFecha: [controlFecha, setControlFecha], controlHora: [controlHora, setControlHora],
    tratamientoFinalizado: [tratamientoFinalizado, setTratamientoFinalizado],
  }
  const instantanea = JSON.stringify(Object.fromEntries(Object.entries(campos).map(([k, [v]]) => [k, v])))

  // Guardado automático: mientras se escribe, la ficha se guarda sola como borrador (en este navegador, ver borradorFicha.js). Al volver a abrir al mismo paciente y la misma cita se ofrece recuperarlo.
  useEffect(() => {
    if (!clave || fichaGuardada || !hayCambiosSinGuardar) return undefined
    const t = setTimeout(() => { if (guardarBorrador(clave, JSON.parse(instantanea))) setGuardadoEn(Date.now()) }, 1200)
    return () => clearTimeout(t)
  }, [clave, instantanea, hayCambiosSinGuardar, fichaGuardada])
  const clavesRevisadas = useRef(new Set())
  useEffect(() => {
    if (!clave || fichaGuardada || clavesRevisadas.current.has(clave)) return
    clavesRevisadas.current.add(clave)
    const b = leerBorrador(clave)
    setBorradorPendiente(b ? { ...b, clave } : null)
    setGuardadoEn(null)
  }, [clave, fichaGuardada])
  useEffect(() => {
    if (!guardadoEn) return undefined
    const i = setInterval(() => setAhoraTexto(Date.now()), 5000)
    return () => clearInterval(i)
  }, [guardadoEn])
  const recuperarBorrador = () => {
    if (!borradorPendiente) return
    detectarCambios.current = false
    for (const [k, [, poner]] of Object.entries(campos)) if (k in borradorPendiente.datos) poner(borradorPendiente.datos[k])
    setGuardadoEn(borradorPendiente.guardadoEn)
    setBorradorPendiente(null)
    setHayCambiosSinGuardar(true)
    setTimeout(() => { detectarCambios.current = true }, 400)
    onAviso?.("Recuperaste la ficha que tenías a medias.")
  }
  const descartarBorrador = () => { borrarBorrador(borradorPendiente?.clave); setBorradorPendiente(null) }
  // «Guardar y salir»: deja el borrador al día y sale sin terminar la atención (la cita sigue «En atención»; al volver a abrir la ficha se recupera).
  const guardarYSalir = () => {
    if (clave && pacienteId) guardarBorrador(clave, JSON.parse(instantanea))
    setHayCambiosSinGuardar(false)
    onCambiosSinGuardarChange?.(false)
    onAviso?.(`Guardaste lo que llevas de la ficha de ${pacienteSeleccionado}. Al abrirla otra vez podrás seguir donde la dejaste.`)
    ;(onCerrar || onVolver)?.()
  }

  const irASeccion = (id) => {
    setSeccionActiva(id)
    document.getElementById(`ficha-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }
  const ojosTabla = {
    od: { esfera: odEsfera, cilindro: odCilindro, eje: odEje, avSc: odAgudezaSc, avCc: odAgudezaCc, noEval: odNoEval, motivo: odMotivoNoEval },
    oi: { esfera: oiEsfera, cilindro: oiCilindro, eje: oiEje, avSc: oiAgudezaSc, avCc: oiAgudezaCc, noEval: oiNoEval, motivo: oiMotivoNoEval },
  }
  const ponerOjo = {
    od: { esfera: setOdEsfera, cilindro: setOdCilindro, eje: setOdEje, avSc: setOdAgudezaSc, avCc: setOdAgudezaCc, noEval: setOdNoEval, motivo: setOdMotivoNoEval },
    oi: { esfera: setOiEsfera, cilindro: setOiCilindro, eje: setOiEje, avSc: setOiAgudezaSc, avCc: setOiAgudezaCc, noEval: setOiNoEval, motivo: setOiMotivoNoEval },
  }
  const claseCampo = "w-full rounded-lg border bg-white px-3 py-2.5 text-base text-slate-900 outline-none transition focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100 "
  const etiqueta = "mb-1.5 block text-sm font-semibold text-slate-700"
  const textoError = (m) => m && <p className="mt-1.5 flex items-center gap-1 text-sm font-medium text-red-600"><AlertCircle size={14} aria-hidden="true" /> {m}</p>

  return (
    <div className="w-full space-y-4 text-left">
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

      {/* ─── VOLVER / DEJAR DE ATENDER ─── «Volver» reabre lo que había antes (el perfil del paciente, si se entró desde ahí), «Cerrar» sale a la lista de origen. «Dejar de atender» descarta lo no guardado. */}
      <div className="no-print flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          {(onVolver || onCerrar) && (
            <button type="button" onClick={onVolver || onCerrar} className="flex shrink-0 items-center gap-2 rounded-lg py-1.5 pl-1.5 pr-3 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 cursor-pointer">
              <ArrowLeft size={18} aria-hidden="true" /> {origenNombre}
            </button>
          )}
          <h1 className="flex items-center gap-2 font-serif text-xl font-bold tracking-tight" style={{ color: INK }}><Stethoscope size={20} className="text-blue-600" aria-hidden="true" /> Ficha clínica</h1>
        </div>
        {citaEnAtencionId && !fichaGuardada && (
          <button type="button" onClick={() => { setErrorDejarDeAtender(""); setMostrarDejarDeAtender(true) }} title="Salir sin guardar: la cita se mantiene agendada"
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700 cursor-pointer">
            <LogOut size={15} aria-hidden="true" /> Dejar de atender
          </button>
        )}
      </div>

      {/* ─── ÉXITO ─── */}
      {notificacion && (
        <div role="status" className="no-print flex items-center gap-3 rounded-xl border border-emerald-200/60 bg-emerald-50 p-4 text-emerald-900 shadow-sm">
          <CheckCircle className="shrink-0 text-emerald-600" size={20} />
          <div>
            <p className="text-sm font-semibold">Ficha clínica guardada con éxito.</p>
            <p className="text-sm text-emerald-700">La evolución del paciente se ha actualizado en el sistema.</p>
          </div>
        </div>
      )}

      {borradorPendiente && !fichaGuardada && (
        <div role="status" className="no-print flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-slate-800">
          <History size={18} className="shrink-0 text-blue-600" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-base"><span className="font-semibold">Hay una ficha a medias de este paciente</span> · {textoGuardado(borradorPendiente.guardadoEn).replace("Guardado", "guardada")}. ¿La recuperas?</p>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={recuperarBorrador} className="min-h-10 rounded-lg px-4 text-base font-semibold text-white cursor-pointer" style={{ background: GRAD }}>Recuperar</button>
            <button type="button" onClick={descartarBorrador} className="min-h-10 rounded-lg border border-slate-300 bg-white px-4 text-base font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">Empezar de cero</button>
          </div>
        </div>
      )}

      <form onSubmit={intentarGuardar} className="@container/ficha no-print flex flex-col gap-4" noValidate>
        {/* ─── CABECERA FIJA: el paciente (con sus alergias a la vista) y los pasos ─── Opaca y compacta; su alto se mide para que el panel de la receta y los saltos queden justo debajo. */}
        <div ref={cabeceraRef} className="sticky top-0 z-30 space-y-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
          {pacienteId && pacienteSeleccionado ? (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white" style={{ background: GRAD }} aria-hidden="true"><User size={17} /></span>
              <div className="min-w-0">
                <p className="truncate text-base font-bold" style={{ color: INK }}>
                  {pacienteSeleccionado} <span className="font-semibold text-slate-600">· {edadPaciente != null ? `${edadPaciente} años` : <span title="Sin fecha de nacimiento registrada">edad sin registrar</span>}</span>
                </p>
                <p className="truncate text-sm text-slate-600">
                  {citaDeLaVisita
                    ? `Cita ${citaDeLaVisita.hora} · ${citaDeLaVisita.motivo || "Consulta"}${citaDeLaVisita.fecha === hoyISO() ? "" : ` · agendada ${fechaCorta(citaDeLaVisita.fecha)}`}`
                    : "Sin cita · consulta directa"}
                </p>
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-2">
                {alergiaSignificativa && (
                  <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-red-300 bg-red-50 px-3 py-1 text-sm font-bold text-red-700">
                    <AlertCircle size={15} className="shrink-0" aria-hidden="true" />
                    <span className="truncate">Alergias: {alergias.trim()}</span>
                  </span>
                )}
                {antecedentesAlerta.length > 0 && (
                  <span role="status" className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-amber-300/70 bg-amber-50 px-3 py-1 text-sm font-bold text-amber-800">
                    <AlertCircle size={15} className="shrink-0" aria-hidden="true" />
                    <span className="truncate">Antecedentes importantes: {textoAntecedentes(antecedentesAlerta)}</span>
                  </span>
                )}
                {ultimaGraduacion && (
                  <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-mono text-sm text-slate-700">
                    <Glasses size={15} className="shrink-0 text-slate-500" aria-hidden="true" />
                    <span className="truncate">Últ. graduación ({fechaCorta(ultimaGraduacion.fecha)}): OD {ultimaGraduacion.od} · OI {ultimaGraduacion.oi}</span>
                  </span>
                )}
              </div>
            </div>
          ) : (
            <p className="text-base font-semibold text-slate-600">Elige al paciente para empezar la ficha</p>
          )}
          <BarraPasos pasos={pasosFicha} activa={seccionActiva} onIr={irASeccion} />
          {bannerError && (
            <div role="alert" className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-red-700">
              <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" aria-hidden="true" />
              <div>
                <p className="text-sm font-bold">No puedes continuar todavía</p>
                <p className="text-sm text-red-600">{bannerError}</p>
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-4 @[56rem]/ficha:grid-cols-[minmax(0,1fr)_20rem] @[72rem]/ficha:grid-cols-[minmax(0,1fr)_26rem]">
          <div className="min-w-0 space-y-4">
          <fieldset disabled={fichaGuardada} className="m-0 min-w-0 space-y-4 border-0 p-0">
            <legend className="sr-only">Datos de la ficha clínica</legend>

            {/* ─── 1 · MOTIVO: paciente, motivo, antecedentes ─── */}
            <SeccionFicha id="anamnesis" n={1} titulo="Motivo" estado={estadosSeccion.anamnesis}>
              <div className="space-y-4">
                {/* Buscador de paciente: solo si la ficha se abrió sin uno ya resuelto (desde «Atender» o el perfil llega fijado). */}
                {!pacienteId && (
                  <div className="relative" ref={dropdownRef}>
                    <label htmlFor="paciente" className={etiqueta}>Paciente <span className="text-red-500">*</span></label>
                    <div className="relative">
                      <User size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                      <input id="paciente" type="text" autoComplete="off" placeholder="Escriba para filtrar paciente..." value={busquedaPaciente} onFocus={() => setMostrarDropdown(true)}
                        onChange={(e) => {
                          setBusquedaPaciente(e.target.value)
                          // Escribir solo filtra el desplegable: cuenta como selección únicamente al elegir un paciente real de la lista.
                          setPacienteId(null)
                          setPacienteSeleccionado("")
                          setMostrarDropdown(true)
                        }}
                        className={claseCampo + "pl-10 pr-9 " + (errores.paciente ? "border-red-400 ring-2 ring-red-100" : "border-slate-300")} />
                      <Search size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                    </div>
                    {mostrarDropdown && pacientesFiltrados.length > 0 && (
                      <ul className="absolute z-50 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200/60 bg-white shadow-lg">
                        {pacientesFiltrados.map((p) => (
                          <li key={p.id || p.nombre} onClick={() => seleccionarPacienteCombo(p)} className="flex cursor-pointer items-center justify-between px-3 py-2.5 text-base text-slate-700 hover:bg-blue-50 hover:text-blue-700">
                            <span className="font-semibold">{p.nombre}</span>
                            {p.cedula && <span className="font-mono text-sm text-slate-500">ID: {p.cedula}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                    {mostrarDropdown && busquedaPaciente.trim() && pacientesFiltrados.length === 0 && (
                      <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200/60 bg-white p-3 text-sm text-slate-500 shadow-lg">
                        Ningún paciente registrado coincide. Créalo primero en el módulo Pacientes — aquí no se puede escribir un nombre nuevo.
                      </div>
                    )}
                    {textoError(errores.paciente)}
                  </div>
                )}

                {/* Contexto en lectura, arriba: última visita, tendencia y acceso al historial. */}
                {pacienteId && (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-200/60 bg-blue-50/50 px-4 py-3">
                    <div className="min-w-0 space-y-0.5 text-sm text-slate-700">
                      {ultimaConsultaPaciente ? (
                        <>
                          <p><span className="font-bold" style={{ color: INK }}>Última visita</span> {fechaCorta(ultimaConsultaPaciente.fecha)} · {ultimaConsultaPaciente.diagnostico || "Sin diagnóstico registrado"}</p>
                          {tendenciaHistorica && (() => {
                            const t = TENDENCIA[tendenciaHistorica.verdicto] || TENDENCIA["Sin cambios"]
                            const IconoT = t.icon
                            return (
                              <p className="flex items-center gap-1">
                                <IconoT size={14} style={{ color: t.fg }} aria-hidden="true" />
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
                      <button type="button" onClick={() => setMostrarHistorial(true)} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200/60 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:border-blue-300 hover:text-blue-700 cursor-pointer">
                        <History size={14} aria-hidden="true" /> Ver historial ({historialPaciente.length})
                      </button>
                    )}
                  </div>
                )}

                {/* Motivo de la consulta: con cita llega relleno y se muestra como dato (con «Cambiar»); sin cita es el selector obligatorio. Al elegir «Otros» el detalle se abre con el foco puesto. */}
                {pacienteId && (
                  <div className="grid gap-4 @[30rem]:grid-cols-[minmax(0,1fr)_15rem]">
                    <div className="space-y-3">
                      {citaEnAtencionId && motivo && motivo !== "Otros" && !editandoMotivo ? (
                        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/60 bg-white px-4 py-3">
                          <div>
                            <p className="text-sm font-bold text-slate-600">Motivo de la consulta</p>
                            <p className="text-base font-semibold" style={{ color: INK }}>{motivo} <span className="text-sm font-normal text-slate-500">(de la cita)</span></p>
                          </div>
                          <button type="button" onClick={() => setEditandoMotivo(true)} className="text-sm font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">Cambiar</button>
                        </div>
                      ) : (
                        <div>
                          <label htmlFor="motivo" className={etiqueta}>Motivo de la consulta <span className="text-red-500">*</span></label>
                          <select id="motivo" value={motivo} onChange={(e) => { setMotivo(e.target.value); limpiarError("motivo"); if (e.target.value !== "Otros") limpiarError("detalleConsulta") }}
                            className={claseCampo + "font-medium " + (errores.motivo ? "border-red-400 ring-2 ring-red-100" : "border-slate-300")}>
                            <option value="" disabled>Selecciona un motivo...</option>
                            {motivosConsulta.map((m) => (<option key={m} value={m}>{m}</option>))}
                            <option value="Otros">Otros</option>
                          </select>
                          {textoError(errores.motivo)}
                        </div>
                      )}
                      {motivo === "Otros" || detalleConsulta || mostrarDetalle ? (
                        <div>
                          <label htmlFor="detalleConsulta" className={etiqueta}>
                            {motivo === "Otros" ? <>Describe el motivo <span className="text-red-500">*</span></> : <>Detalle de la consulta <span className="font-normal text-slate-500">(opcional)</span></>}
                          </label>
                          <input id="detalleConsulta" ref={detalleRef} type="text" placeholder="Ej. Visión borrosa de lejos hace 2 semanas, dolor ocular..." value={detalleConsulta}
                            onChange={(e) => { setDetalleConsulta(e.target.value); limpiarError("detalleConsulta") }}
                            className={claseCampo + (errores.detalleConsulta ? "border-red-400 ring-2 ring-red-100" : "border-slate-300")} />
                          {textoError(errores.detalleConsulta)}
                        </div>
                      ) : (
                        <button type="button" onClick={() => { setMostrarDetalle(true); setTimeout(() => detalleRef.current?.focus(), 30) }} className="text-sm font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">
                          + Agregar detalle
                        </button>
                      )}
                    </div>
                    <div>
                      <label htmlFor="consulta-fecha" className={etiqueta}>Fecha de la consulta</label>
                      <CampoFecha id="consulta-fecha" etiqueta="Fecha de la consulta" valor={fechaConsulta} onCambiar={setFechaConsulta} min={sumarDiasISO(hoyISO(), -365 * 3)} max={hoyISO()} />
                    </div>
                  </div>
                )}

                {/* Antecedentes del paciente (dato fijo de la persona): plegados cuando ya están registrados de una visita anterior, con lo importante siempre a la vista. */}
                {pacienteId && (
                  <div className="space-y-3 rounded-xl border border-slate-200/60 bg-slate-50 p-4">
                    <button type="button" onClick={() => alternarSeccion("antecedentesPaciente")} aria-expanded={!!seccionesAbiertas.antecedentesPaciente} className="flex w-full items-center justify-between gap-2 text-left cursor-pointer">
                      <span className="flex items-center gap-2 text-base font-semibold" style={{ color: INK }}>
                        <ClipboardList size={18} className="text-blue-600" aria-hidden="true" /> Antecedentes del paciente
                        <EtiquetaRegistro registrado={registradoAntecedentes} />
                      </span>
                      <span className="flex items-center gap-2">
                        {tieneHistorialAntecedentes && !seccionesAbiertas.antecedentesPaciente && (
                          <span className="hidden items-center gap-1 text-sm font-normal text-slate-500 @[30rem]:flex">
                            <History size={13} aria-hidden="true" /> Ya registrados{fechaPrecarga ? ` el ${fechaLegible(fechaPrecarga)}` : ""} · toca para ver o editar
                          </span>
                        )}
                        <ChevronDown size={18} aria-hidden="true" className={"text-slate-500 transition-transform " + (seccionesAbiertas.antecedentesPaciente ? "" : "-rotate-90")} />
                      </span>
                    </button>

                    {!seccionesAbiertas.antecedentesPaciente && (
                      <div className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200/60 bg-white p-3 text-sm leading-relaxed text-slate-700 @[30rem]:grid-cols-3">
                        <p><span className="block text-sm font-bold text-slate-500">Alergias</span>{alergias || "Ninguna registrada"}</p>
                        <p><span className="block text-sm font-bold text-slate-500">Antecedentes médicos/oculares</span>{antecedentes || "Ninguno registrado"}</p>
                        <p><span className="block text-sm font-bold text-slate-500">Antecedentes familiares</span>{antecedentesFamiliares || "Ninguno registrado"}</p>
                      </div>
                    )}

                    {seccionesAbiertas.antecedentesPaciente && (
                      <>
                        <div className="flex flex-col gap-3 rounded-lg border border-slate-200/60 bg-white p-3 @[30rem]:flex-row @[30rem]:items-center @[30rem]:justify-between">
                          <span className="flex items-center gap-2 text-base font-medium text-slate-700">
                            <Glasses size={18} className="text-slate-500" aria-hidden="true" />
                            ¿Utiliza o ha utilizado lentes?
                            {precargado.usaLentes && <InsigniaHistorial fecha={fechaPrecarga} />}
                          </span>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => { setUsaLentes("si"); setPrecargado((p) => ({ ...p, usaLentes: false })) }} aria-pressed={usaLentes === "si"}
                              className={"flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border px-5 text-base font-semibold transition-colors cursor-pointer @[30rem]:flex-none " + (usaLentes === "si" ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-100" : "border-slate-300 bg-white text-slate-600 hover:border-slate-400")}>
                              <CheckCircle size={17} className={usaLentes === "si" ? "text-blue-600" : "text-slate-400"} aria-hidden="true" /> Sí
                            </button>
                            <button type="button" onClick={() => { setUsaLentes("no"); setPrecargado((p) => ({ ...p, usaLentes: false })) }} aria-pressed={usaLentes === "no"}
                              className={"flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-lg border px-5 text-base font-semibold transition-colors cursor-pointer @[30rem]:flex-none " + (usaLentes === "no" ? "border-red-400 bg-red-50 text-red-600 ring-2 ring-red-100" : "border-slate-300 bg-white text-slate-600 hover:border-slate-400")}>
                              <XCircle size={17} className={usaLentes === "no" ? "text-red-500" : "text-slate-400"} aria-hidden="true" /> No
                            </button>
                          </div>
                        </div>
                        <div>
                          <label htmlFor="antecedentes" className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700">Antecedentes médicos / oculares {precargado.antecedentes && <InsigniaHistorial fecha={fechaPrecarga} />}</label>
                          <textarea id="antecedentes" rows={3} placeholder="Ej. Paciente con diabetes tipo 2. Usa lentes desde hace 3 años." value={antecedentes}
                            onChange={(e) => { setAntecedentes(e.target.value); setPrecargado((p) => ({ ...p, antecedentes: false })) }} className={claseCampo + "resize-none leading-relaxed border-slate-300"} />
                        </div>
                        <div className="grid grid-cols-1 gap-4 @[30rem]:grid-cols-2">
                          <div>
                            <label htmlFor="alergias" className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700">Alergias {precargado.alergias && <InsigniaHistorial fecha={fechaPrecarga} />}</label>
                            <input id="alergias" type="text" placeholder="Ej. Alergia a fluoresceína, ninguna conocida..." value={alergias}
                              onChange={(e) => { setAlergias(e.target.value); setPrecargado((p) => ({ ...p, alergias: false })) }} className={claseCampo + "border-slate-300"} />
                          </div>
                          <div>
                            <label htmlFor="antFamiliares" className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700">Antecedentes familiares oculares {precargado.antecedentesFamiliares && <InsigniaHistorial fecha={fechaPrecarga} />}</label>
                            <input id="antFamiliares" type="text" placeholder="Ej. Glaucoma en línea materna, sin antecedentes..." value={antecedentesFamiliares}
                              onChange={(e) => { setAntecedentesFamiliares(e.target.value); setPrecargado((p) => ({ ...p, antecedentesFamiliares: false })) }} className={claseCampo + "border-slate-300"} />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </SeccionFicha>

            {/* ─── 2 · REFRACCIÓN: la tabla del optómetra, una fila por ojo ─── */}
            <SeccionFicha id="refraccion" n={2} titulo="Refracción" estado={estadosSeccion.refraccion}>
              <div className="space-y-4">
                <TablaRefraccion
                  ojos={ojosTabla}
                  onCambiar={(ojo, c, v) => ponerOjo[ojo][c](v)}
                  medidas={{ adicion, dp }}
                  onMedida={(c, v) => (c === "adicion" ? setAdicion(v) : setDp(v))}
                  manejaProgresion={manejaProgresion}
                  errores={errores}
                  limpiarError={limpiarError}
                  escalas={escalasSnellen}
                  copiar={copiarDesdeAnterior ? { accion: copiarDesdeAnterior.accion, fechaTexto: fechaCorta(copiarDesdeAnterior.fecha) } : null}
                  bloqueada={fichaGuardada}
                />
                {estadoCorreccionActual !== "Sin evaluar" && <div><ChipCorreccion correccion={estadoCorreccionActual} /></div>}
                <div className="grid grid-cols-1 gap-4 @[30rem]:grid-cols-2">
                  <MedidaCampo id="alt" label="Altura pupilar (ALT) · mm" value={alt} onChange={setAlt} placeholder="18" />
                  <MedidaCampo id="avCerca" label="AV de cerca (Jaeger)" value={avCerca} onChange={setAvCerca} placeholder="J1" />
                </div>
                <BloqueOpcional icono={ScanEye} titulo="Retinoscopía (refracción objetiva)" nota="Opcional · punto de partida antes de refinar" registrado={registradoRetinoscopia} abierto={!!seccionesAbiertas.retinoscopia} onAlternar={() => alternarSeccion("retinoscopia")}>
                  <div className="grid grid-cols-1 gap-3 @[30rem]:grid-cols-2">
                    <div>
                      <label htmlFor="retinoOd" className={etiqueta}>Hallazgo OD</label>
                      <input id="retinoOd" type="text" placeholder="Ej. -1.00 -0.50 x180" value={retinoscopiaOd} onChange={(e) => setRetinoscopiaOd(e.target.value)} className={claseCampo + "font-mono border-slate-300"} />
                    </div>
                    <div>
                      <label htmlFor="retinoOi" className={etiqueta}>Hallazgo OI</label>
                      <input id="retinoOi" type="text" placeholder="Ej. -0.75 -0.25 x175" value={retinoscopiaOi} onChange={(e) => setRetinoscopiaOi(e.target.value)} className={claseCampo + "font-mono border-slate-300"} />
                    </div>
                  </div>
                </BloqueOpcional>
                <LineaVariacion analisis={analisisEvolucion} />
              </div>
            </SeccionFicha>

            {/* ─── 3 · EXAMEN: complementarios, opcionales y plegados ─── */}
            <SeccionFicha id="examen" n={3} titulo="Examen" estado={estadosSeccion.examen}>
              <div className="space-y-3">
                <BloqueOpcional icono={ScanEye} titulo="Examen físico complementario" nota="Opcional" registrado={registradoExamenFisico} abierto={!!seccionesAbiertas.examenFisico} onAlternar={() => alternarSeccion("examenFisico")}>
                  <div className="grid grid-cols-1 gap-3 @[30rem]:grid-cols-3">
                    <div>
                      <label htmlFor="testMotor" className={etiqueta}>Motilidad ocular</label>
                      <input id="testMotor" type="text" placeholder="Ej. Movimientos normales" value={testMotor} onChange={(e) => setTestMotor(e.target.value)} className={claseCampo + "border-slate-300"} />
                    </div>
                    <div>
                      <label htmlFor="oftalmoscopia" className={etiqueta}>Oftalmoscopia</label>
                      <input id="oftalmoscopia" type="text" placeholder="Ej. Papila y retina sin alteraciones" value={oftalmoscopia} onChange={(e) => setOftalmoscopia(e.target.value)} className={claseCampo + "border-slate-300"} />
                    </div>
                    <div>
                      <label htmlFor="testColor" className={etiqueta}>Test de color</label>
                      <select id="testColor" value={testColor} onChange={(e) => setTestColor(e.target.value)} className={claseCampo + "font-medium border-slate-300"}>
                        <option value="Normal">Normal</option>
                        <option value="Deficiencia rojo-verde">Deficiencia rojo-verde</option>
                        <option value="Deficiencia azul-amarillo">Deficiencia azul-amarillo</option>
                        <option value="No realizado">No realizado</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 border-t border-slate-200/70 pt-3 @[30rem]:grid-cols-2">
                    {[["coverLejos", "Cover test — lejos", coverTestLejos, setCoverTestLejos], ["coverCerca", "Cover test — cerca", coverTestCerca, setCoverTestCerca]].map(([id, texto, valor, poner]) => (
                      <div key={id}>
                        <label htmlFor={id} className={etiqueta}>{texto}</label>
                        <select id={id} value={valor} onChange={(e) => poner(e.target.value)} className={claseCampo + "font-medium border-slate-300"}>
                          {["Ortoforia", "Exoforia", "Esoforia", "Exotropia", "Esotropia", "No realizado"].map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 gap-3 border-t border-slate-200/70 pt-3 @[30rem]:grid-cols-2">
                    <div>
                      <label htmlFor="pioOd" className={etiqueta}>PIO — ojo derecho (mmHg)</label>
                      <input id="pioOd" type="text" placeholder="Ej. 14" inputMode="numeric" maxLength={2} value={pioOd} onChange={(e) => setPioOd(filtrarSoloNumeros(e.target.value, 2))} className={claseCampo + "border-slate-300"} />
                    </div>
                    <div>
                      <label htmlFor="pioOi" className={etiqueta}>PIO — ojo izquierdo (mmHg)</label>
                      <input id="pioOi" type="text" placeholder="Ej. 15" inputMode="numeric" maxLength={2} value={pioOi} onChange={(e) => setPioOi(filtrarSoloNumeros(e.target.value, 2))} className={claseCampo + "border-slate-300"} />
                    </div>
                  </div>
                </BloqueOpcional>
                <BloqueOpcional icono={Eye} titulo="Biomicroscopía (segmento anterior)" nota="Opcional · lámpara de hendidura" registrado={registradoBiomicroscopia} abierto={!!seccionesAbiertas.biomicroscopia} onAlternar={() => alternarSeccion("biomicroscopia")}>
                  <div className="grid grid-cols-1 gap-3 @[30rem]:grid-cols-3">
                    <div>
                      <label htmlFor="biomicroParpados" className={etiqueta}>Párpados / conjuntiva</label>
                      <input id="biomicroParpados" type="text" placeholder="Ej. Sin alteraciones" value={biomicroParpados} onChange={(e) => setBiomicroParpados(e.target.value)} className={claseCampo + "border-slate-300"} />
                    </div>
                    <div>
                      <label htmlFor="biomicroCornea" className={etiqueta}>Córnea</label>
                      <input id="biomicroCornea" type="text" placeholder="Ej. Transparente, sin lesiones" value={biomicroCornea} onChange={(e) => setBiomicroCornea(e.target.value)} className={claseCampo + "border-slate-300"} />
                    </div>
                    <div>
                      <label htmlFor="biomicroCamara" className={etiqueta}>Cámara anterior / cristalino</label>
                      <input id="biomicroCamara" type="text" placeholder="Ej. Formada, cristalino transparente" value={biomicroCamara} onChange={(e) => setBiomicroCamara(e.target.value)} className={claseCampo + "border-slate-300"} />
                    </div>
                  </div>
                </BloqueOpcional>
              </div>
            </SeccionFicha>

            {/* ─── 4 · DIAGNÓSTICO: categorías, lente recomendado y próximo control ─── */}
            <SeccionFicha id="diagnostico" n={4} titulo="Diagnóstico" estado={estadosSeccion.diagnostico}>
              <div className="space-y-4">
                <div>
                  <p className={etiqueta}>Categorías <span className="text-red-500">*</span></p>
                  <div className="flex flex-wrap gap-2">
                    {/* «Otro» siempre disponible como salida, sin depender del catálogo que haya configurado el administrador. */}
                    {[...diagnosticosRapidos, ...(diagnosticosRapidos.includes("Otro") ? [] : ["Otro"])].map((cat) => {
                      const activo = diagnosticoCategorias.includes(cat)
                      return (
                        <button key={cat} type="button" aria-pressed={activo}
                          onClick={() => { setDiagnosticoCategorias((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat])); limpiarError("diagnostico"); limpiarError("diagnosticoDetalle") }}
                          className="min-h-10 rounded-full border px-4 text-base font-semibold transition-colors cursor-pointer"
                          style={activo ? { backgroundColor: "#2563eb", borderColor: "#2563eb", color: "#fff" } : { borderColor: "#cbd5e1", color: "#475569", backgroundColor: "#fff" }}>
                          {cat}
                        </button>
                      )
                    })}
                  </div>
                  {textoError(errores.diagnostico)}
                </div>
                {diagnosticoCategorias.includes("Otro") ? (
                  <div>
                    <label htmlFor="diagnostico" className={etiqueta}>Detalle del diagnóstico personalizado</label>
                    <textarea id="diagnostico" rows={3} placeholder="Detalle del diagnóstico personalizado..." value={diagnostico} onChange={(e) => { setDiagnostico(e.target.value); limpiarError("diagnosticoDetalle") }}
                      className={claseCampo + "resize-none leading-relaxed " + (errores.diagnosticoDetalle ? "border-red-400 ring-2 ring-red-100" : "border-slate-300")} />
                    {textoError(errores.diagnosticoDetalle)}
                  </div>
                ) : (
                  <div>
                    <label htmlFor="diagnostico" className={etiqueta}>Detalle <span className="font-normal text-slate-500">(opcional)</span></label>
                    <input id="diagnostico" type="text" placeholder="Ej. Se determina progresión leve, control en 6 meses" value={diagnostico} onChange={(e) => setDiagnostico(e.target.value)} className={claseCampo + "border-slate-300"} />
                  </div>
                )}

                {/* No todo diagnóstico recomienda un lente: sin la casilla, ni el campo ni la búsqueda aparecen. */}
                <label className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-slate-200/60 bg-slate-50/70 px-4 text-base font-semibold text-slate-700">
                  <input type="checkbox" checked={recomendarLente} onChange={(e) => { setRecomendarLente(e.target.checked); if (!e.target.checked) setLenteRecomendado("") }} className="h-5 w-5 cursor-pointer rounded border-slate-300 text-blue-600 focus-visible:ring-blue-500" />
                  <Glasses size={18} style={{ color: GOLD }} aria-hidden="true" /> Añadir recomendación de lente
                </label>
                {recomendarLente && (
                  <div className="flex items-start gap-3 rounded-xl border p-4" style={{ borderColor: "rgba(200,162,78,0.35)", backgroundColor: "rgba(200,162,78,0.08)" }}>
                    <Glasses size={20} style={{ color: GOLD }} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <label htmlFor="lenteRecomendado" className="mb-1.5 block text-sm font-bold" style={{ color: "#7c5e14" }}>Lente a recomendar</label>
                      <input id="lenteRecomendado" type="text" placeholder="Ej. Monofocal con antirreflejo y filtro luz azul" value={lenteRecomendado} onChange={(e) => setLenteRecomendado(e.target.value)} className={claseCampo + "border-amber-200"} />
                      <p className="mt-1.5 text-sm text-slate-600">Solo el texto de la receta: la luna se elige y se cobra al vender, sin inventario.</p>
                    </div>
                  </div>
                )}

                {/* Si el optómetra da de alta al paciente ya no tiene sentido pedir un próximo control: se oculta el selector y se explica por qué. */}
                <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200/60 bg-slate-50 px-4 py-3">
                  <input type="checkbox" checked={tratamientoFinalizado} onChange={(e) => setTratamientoFinalizado(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-slate-300 text-blue-600 focus-visible:ring-blue-500" />
                  <span>
                    <span className="block text-base font-semibold" style={{ color: INK }}>Tratamiento finalizado</span>
                    <span className="block text-sm text-slate-600">El paciente ya no necesita más controles — queda marcado como "De alta".</span>
                  </span>
                </label>

                <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200/60 bg-slate-50 px-4 py-3">
                  <CalendarClock size={20} className="shrink-0 text-blue-600" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <label htmlFor="proximoControl" className="block text-base font-semibold text-slate-700">Próximo control recomendado</label>
                    <p className="text-sm text-slate-600">{tratamientoFinalizado ? "No aplica — el tratamiento quedó finalizado." : "Define cuándo el CRM debe avisar si el paciente no ha vuelto."}</p>
                  </div>
                  {!tratamientoFinalizado && (
                    <select id="proximoControl" value={proximoControlDias} onChange={(e) => { setProximoControlDias(Number(e.target.value)); setControlFecha(""); setControlHora("") }}
                      className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-base font-semibold text-slate-700 outline-none focus-visible:border-blue-500">
                      <option value={30}>1 mes</option>
                      <option value={90}>3 meses</option>
                      <option value={180}>6 meses</option>
                      <option value={365}>1 año</option>
                    </select>
                  )}
                </div>

                {!tratamientoFinalizado && (
                  <fieldset className="rounded-xl border border-slate-200/60 bg-white p-4">
                    <legend className="px-1 text-base font-bold" style={{ color: INK }}>¿Cuándo se agenda ese control?</legend>
                    <p className="mb-3 text-sm text-slate-600">El paciente tiene que aceptar la fecha y la hora, así que la cita solo se crea si eliges "Agendar ahora" y al guardar la ficha.</p>
                    <div role="radiogroup" aria-label="Cuándo se agenda el control" className="grid gap-2 @[30rem]:grid-cols-2">
                      {[
                        ["ahora", "Agendar ahora", "Elige fecha y hora con los horarios libres."],
                        ["despues", "Agendar después", "No se crea la cita: queda como aviso para Recepción y el administrador."],
                      ].map(([valor, titulo, ayuda]) => (
                        <label key={valor} className={"flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors " + (controlModo === valor ? "border-blue-300 bg-blue-50/50" : "border-slate-200/60 bg-slate-50 hover:border-blue-200")}>
                          <input type="radio" name="control-agenda" value={valor} checked={controlModo === valor} onChange={() => { setControlModo(valor); limpiarError("control") }} className="mt-1 h-4 w-4 accent-blue-600" />
                          <span className="min-w-0">
                            <span className="block text-base font-semibold text-slate-700">{titulo}</span>
                            <span className="block text-sm leading-relaxed text-slate-600">{ayuda}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                    {controlModo === "ahora" && (
                      <div className="mt-3 space-y-3">
                        {diaControlSugerido ? (
                          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                            <span>
                              Fecha recomendada: <span className="font-semibold">{textoDia(fechaControlRecomendada)}</span>
                              {diaControlSugerido !== fechaControlRecomendada && <> · ese día no hay atención; el día hábil más cercano es el <span className="font-semibold">{textoDia(diaControlSugerido)}</span></>}
                            </span>
                            <button type="button" onClick={() => { setControlFecha(diaControlSugerido); setControlHora("") }} className="rounded-full border border-blue-200 bg-white px-3 py-1 text-sm font-bold text-blue-700 transition-colors hover:bg-blue-50 cursor-pointer">
                              Elegir {diaControlSugerido === fechaControlRecomendada ? "esa fecha" : "ese día"}
                            </button>
                          </div>
                        ) : (
                          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">No hay un día con cupo cerca de la fecha recomendada ({textoDia(fechaControlRecomendada)}). Elige otro en el calendario.</p>
                        )}
                        <SelectorFechaHora disponibilidad={disponibilidad} citas={citas} fecha={controlFecha} hora={controlHora}
                          onCambiarFecha={(f) => { setControlFecha(f); limpiarError("control") }} onCambiarHora={(h) => { setControlHora(h); limpiarError("control") }}
                          mesesAdelante={14} mesInicial={diaControlSugerido || fechaControlRecomendada} />
                      </div>
                    )}
                    {errores.control && <p role="alert" className="mt-3 text-base font-semibold text-red-600">{errores.control}</p>}
                  </fieldset>
                )}
              </div>
            </SeccionFicha>
          </fieldset>

        {/* ─── 5 · RECETA: indicaciones, imágenes y, ya guardada, lo que sigue ─── */}
        <SeccionFicha id="receta" n={5} titulo="Receta" estado={estadosSeccion.receta}>
          <div className="space-y-4">
            <fieldset disabled={fichaGuardada} className="m-0 min-w-0 space-y-4 border-0 p-0">
              <div>
                <label htmlFor="indicaciones" className={etiqueta}>Indicaciones y cuidados</label>
                <textarea id="indicaciones" rows={3} placeholder="Ej. Uso permanente de lentes con filtro antirreflejo y luz azul." value={indicaciones} onChange={(e) => setIndicaciones(e.target.value)} className={claseCampo + "resize-none leading-relaxed border-slate-300"} />
              </div>
              {!fichaGuardada && (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/70 p-3">
                  <p className="flex items-center gap-1.5 text-sm font-bold text-slate-600"><ImageIcon size={14} aria-hidden="true" /> Adjuntar imágenes <span className="font-normal text-slate-500">(opcional — hasta 6)</span></p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {archivosImagenes.map((f, i) => (
                      <div key={i} className="relative h-16 w-16 overflow-hidden rounded-lg border border-slate-200/60">
                        <img src={previsualizacionesImagenes[i]} alt={f.name} className="h-full w-full object-cover" />
                        <button type="button" onClick={() => quitarArchivoImagen(i)} aria-label="Quitar imagen" className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white cursor-pointer"><X size={12} aria-hidden="true" /></button>
                      </div>
                    ))}
                    {archivosImagenes.length < 6 && (
                      <label className="grid h-16 w-16 cursor-pointer place-items-center rounded-lg border border-dashed border-slate-300 text-slate-500 transition-colors hover:border-blue-300 hover:text-blue-500">
                        <span className="sr-only">Agregar una imagen</span>
                        <ImageIcon size={20} aria-hidden="true" />
                        <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={(e) => { agregarArchivosImagenes(e.target.files); e.target.value = "" }} />
                      </label>
                    )}
                  </div>
                </div>
              )}
            </fieldset>

            {/* Atención terminada: la receta está lista; el paciente se pasa a la óptica (queda «Listo para venta») o se cobra ahí mismo. */}
            {fichaGuardada && cobroEstado === "terminada" && (
              <div role="status" className="space-y-2.5 rounded-lg border border-emerald-200/60 bg-emerald-50 p-4">
                <p className="flex items-center gap-1.5 text-base font-bold text-emerald-900">
                  <CheckCircle size={18} className="shrink-0 text-emerald-600" aria-hidden="true" />
                  Atención terminada{citaEnAtencionId ? " · la cita quedó atendida" : ""}. La receta está lista.
                </p>
                {paseDeEstaConsulta ? (
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800"><ShoppingBag size={15} className="shrink-0" aria-hidden="true" /> Listo para venta: quien venda verá a este paciente en su lista.</p>
                ) : (
                  <p className="text-sm text-emerald-800">Si el paciente va a comprar, pásalo a la óptica o cóbralo ahora.</p>
                )}
                {errorPase && <p role="alert" className="text-sm font-medium text-red-700">{errorPase}</p>}
                <div className="flex flex-wrap items-center gap-2">
                  {!paseDeEstaConsulta && (
                    <button type="button" onClick={pasarAOptica} disabled={pasandoAOptica || !consultaGuardadaId} className="flex min-h-10 items-center gap-1.5 rounded-lg px-4 text-sm font-bold text-white transition hover:brightness-110 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60" style={{ background: GRAD }}>
                      <ShoppingBag size={15} aria-hidden="true" /> {pasandoAOptica ? "Pasando…" : "Pasar a la óptica"}
                    </button>
                  )}
                  <button type="button" onClick={() => setMostrarPanelCobro(true)} className="flex min-h-10 items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-4 text-sm font-bold text-emerald-800 transition-colors hover:bg-emerald-100 cursor-pointer">
                    <Receipt size={15} aria-hidden="true" /> Cobrar ahora
                  </button>
                  {(onVolver || onCerrar) && (
                    <button type="button" onClick={onVolver || onCerrar} className="min-h-10 rounded-lg border border-slate-200/60 bg-white px-4 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">Volver a {origenNombre}</button>
                  )}
                </div>
              </div>
            )}
            {fichaGuardada && cobroEstado === "cobrado" && (
              <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200/60 bg-emerald-50 p-3">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-800">
                  <CheckCircle size={15} className="shrink-0" aria-hidden="true" />
                  Cobrado {dinero(cobroTotal)}{citaEnAtencionId ? " · cita atendida" : ""}. Ya puedes imprimir la receta.
                </p>
                {(onVolver || onCerrar) && (
                  <button type="button" onClick={onVolver || onCerrar} className="min-h-10 rounded-lg bg-emerald-600 px-4 text-sm font-bold text-white transition-colors hover:bg-emerald-700 cursor-pointer">Volver a {origenNombre}</button>
                )}
              </div>
            )}

            {/* En pantallas angostas el panel de la derecha no cabe: la hoja se ve aquí, al final. */}
            <div className="@[56rem]/ficha:hidden">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">Receta que se imprimirá</h3>
              <VistaPreviaHoja datos={datosDeLaHoja()} onAmpliar={() => setMostrarHojaCompleta(true)} />
            </div>
          </div>
        </SeccionFicha>
          </div>

          {/* ─── PANEL DE LA DERECHA: la hoja tal como se imprime (OD arriba, OI abajo), siempre a la vista bajo la cabecera ─── */}
          <aside aria-label="Vista previa de la receta" className="hidden @[56rem]/ficha:block">
            <div className="sticky top-[calc(var(--alto-cabecera-ficha,7rem)+1rem)] space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-600">Receta que se imprimirá</h2>
              <VistaPreviaHoja datos={datosDeLaHoja()} onAmpliar={() => setMostrarHojaCompleta(true)} />
            </div>
          </aside>
        </div>

        {/* ─── BARRA INFERIOR FIJA: siempre a la vista, sin tapar el formulario (la página termina sobre ella) ─── */}
        <div className="sticky bottom-0 z-30 -mt-1 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-[0_-6px_18px_-12px_rgba(15,35,64,0.35)]">
          <p className="min-w-0 flex-1 text-sm text-slate-600" role="status" aria-live="polite">
            {fichaGuardada ? "La ficha ya está en el expediente del paciente." : (
              <span className="inline-flex items-center gap-2"><span aria-hidden="true" className={"h-2 w-2 rounded-full " + (guardadoEn ? "bg-emerald-500" : "bg-slate-300")} /> {textoGuardado(guardadoEn, ahoraTexto)}</span>
            )}
          </p>
          {fichaGuardada ? (
            <>
              <button type="button" onClick={imprimirReceta} className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-base font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer">
                <Printer size={18} aria-hidden="true" /> Imprimir / Descargar PDF
              </button>
              <button type="button" onClick={resetForm} className="flex min-h-11 items-center gap-2 rounded-xl px-5 text-base font-semibold text-white transition-colors hover:brightness-110 cursor-pointer" style={{ backgroundColor: INK }}>
                <ClipboardList size={18} aria-hidden="true" /> Nueva consulta
              </button>
            </>
          ) : (
            <>
              {(onCerrar || onVolver) && pacienteId && (
                <button type="button" onClick={guardarYSalir} className="flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-base font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer">
                  <LogOut size={18} aria-hidden="true" /> Guardar y salir
                </button>
              )}
              {/* key propia a propósito: evita que React reutilice un <button> de otro tipo y dispare un envío fantasma del formulario (bug del 29 sept., docs/feedback-ing/bug-diagnostico-receta.md). */}
              <button key="btn-guardar" type="submit" className="flex min-h-11 items-center gap-2 rounded-xl px-6 text-base font-semibold text-white transition-colors hover:brightness-110 cursor-pointer" style={{ background: GRAD, boxShadow: "0 12px 24px -12px rgba(37,99,235,0.6)" }}>
                <Save size={18} aria-hidden="true" /> Terminar atención
              </button>
            </>
          )}
        </div>
      </form>

      {mostrarHojaCompleta && (
        <Cascaron titulo="Receta que se imprimirá" subtitulo={pacienteSeleccionado} Icono={FileText} ancho="max-w-4xl" onCerrar={() => setMostrarHojaCompleta(false)}
          pie={<>
            <span />
            <button type="button" onClick={() => setMostrarHojaCompleta(false)} className="rounded-lg border border-slate-200/60 px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">Cerrar</button>
          </>}
        >
          <div className="overflow-x-auto bg-slate-100/70 p-4"><div className="rounded-xl border border-slate-200 bg-white shadow-sm"><HojaReceta {...datosDeLaHoja()} /></div></div>
        </Cascaron>
      )}

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

      {mostrarHistorial && (
        <Cascaron titulo="Historial clínico" subtitulo={pacienteSeleccionado} Icono={History} ancho="max-w-2xl" onCerrar={() => setMostrarHistorial(false)}
          pie={<>
            <span />
            <button type="button" onClick={() => setMostrarHistorial(false)} className="rounded-lg border border-slate-200/60 px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">Cerrar</button>
          </>}
        >
          <div className="space-y-3 p-5">
          {historialPaciente.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <div className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-300"><History size={22} /></div>
              <p className="text-sm font-medium text-slate-500">Este paciente aún no tiene consultas registradas.</p>
            </div>
          ) : (
            historialPaciente.map((c) => <TarjetaVisita key={c.id} consulta={c} />)
          )}
          </div>
        </Cascaron>
      )}

      {/* ─── AVISO: PRIMERA CONSULTA DEL PACIENTE (feedback del asesor) ─── */}
      {avisoPrimeraVisita && (
        <Cascaron titulo={"Primera consulta de " + pacienteSeleccionado} subtitulo="No hay historial previo para este paciente." Icono={Sparkles} ancho="max-w-md" onCerrar={() => setAvisoPrimeraVisita(false)}
          pie={<>
            <span />
            <button
              type="button"
              onClick={() => { setAvisoPrimeraVisita(false); setTimeout(() => document.getElementById("antecedentes")?.focus(), 50) }}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer"
              style={{ background: GRAD }}
            >
              Entendido, completar antecedentes
            </button>
          </>}
        >
          <p className="p-6 text-sm text-slate-600">Completa antecedentes, alergias y antecedentes familiares antes de continuar con la refracción.</p>
        </Cascaron>
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

function MedidaCampo({ id, label, value, onChange, placeholder }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400 focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100"
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
        <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-600 shadow-sm">{c.motivo || "Consulta general"}</span>
      </div>
      {c.detalleConsulta && <p className="mt-1 text-xs italic text-slate-500">"{c.detalleConsulta}"</p>}
      <p className="mt-1.5 text-sm text-slate-700">{c.diagnostico || "Sin diagnóstico registrado"}</p>
      <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-xs text-slate-500">
        <span>OD: {textoOjo(c.od)} · AV {c.od?.avCc || "—"}</span>
        <span>OI: {textoOjo(c.oi)} · AV {c.oi?.avCc || "—"}</span>
      </div>
      {c.lenteRecomendado && <p className="mt-1.5 text-xs text-slate-500">Lente recomendado: <span className="font-semibold text-slate-600">{c.lenteRecomendado}</span></p>}
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
      <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">{valor}</p>
    </div>
  )
}

