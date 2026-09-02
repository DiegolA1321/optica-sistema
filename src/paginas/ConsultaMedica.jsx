"use client"

import { useState, useEffect, useMemo, useRef } from "react"
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
} from "lucide-react"
import { filtrarSoloNumeros, filtrarNumeroDecimalConSigno } from "../utilidades/validaciones"
import ConfirmarFichaModal from "../componentes/ConfirmarFichaModal"

// ─── Paleta de firma (consistente con el resto del sistema) ───
const INK = "#0E2B33"
const GOLD = "#C8A24E"
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
}

const evaluarCorreccion = (avCcOd, avCcOi) => {
  const odIdx = ORDEN_SNELLEN[avCcOd] ?? 99
  const oiIdx = ORDEN_SNELLEN[avCcOi] ?? 99
  return Math.max(odIdx, oiIdx) <= 1 ? "Bien corregido" : "Requiere ajuste"
}

export default function ConsultaMedica({ usuario, pacientes: pacientesLista = [], setPacientes, consultas: historialConsultas = [], setConsultas: setHistorialConsultas, inventario = [], setInventario, parametrizacion, diagnosticosRapidos = [], pacienteInicial, onPacienteInicialConsumido }) {
  const [subTab, setSubTab] = useState("anamnesis")
  // Si la óptica no ofrece progresión, no tiene sentido pedir ese dato (configurable en Configuración)
  const manejaProgresion = parametrizacion?.manejaProgresion !== false
  // Política de la óptica (Configuración > Políticas hacia el paciente) — debe
  // regir también la receta impresa, no solo la vista web del portal
  // (PortalPaciente.jsx ya la respeta desde antes).
  const mostrarMedidasPaciente = parametrizacion?.mostrarMedidasPaciente === true

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
      if (dropdownProductoRef.current && !dropdownProductoRef.current.contains(event.target)) {
        setMostrarDropdownProducto(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // --- Datos de Anamnesis ---
  const [fechaConsulta, setFechaConsulta] = useState(() => new Date().toISOString().split("T")[0])
  const [motivo, setMotivo] = useState("")
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
  const [odEsfera, setOdEsfera] = useState("0.00")
  const [odCilindro, setOdCilindro] = useState("0.00")
  const [odEje, setOdEje] = useState("0")
  const [odAgudezaSc, setOdAgudezaSc] = useState("20/20")
  const [odAgudezaCc, setOdAgudezaCc] = useState("20/20")

  // --- Ojo Izquierdo (OI) ---
  const [oiEsfera, setOiEsfera] = useState("0.00")
  const [oiCilindro, setOiCilindro] = useState("0.00")
  const [oiEje, setOiEje] = useState("0")
  const [oiAgudezaSc, setOiAgudezaSc] = useState("20/20")
  const [oiAgudezaCc, setOiAgudezaCc] = useState("20/20")

  // --- Adición y Medidas ---
  const [adicion, setAdicion] = useState("+0.00")
  const [dp, setDp] = useState("64 mm")
  const [alt, setAlt] = useState("18 mm")
  const [avCerca, setAvCerca] = useState("J1")

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
  const [diagnostico, setDiagnostico] = useState("")
  const [lenteRecomendado, setLenteRecomendado] = useState("")
  const [indicaciones, setIndicaciones] = useState("")
  const [proximoControlDias, setProximoControlDias] = useState(180)

  // --- Producto de bodega vinculado (cierra el ciclo clínico → inventario) ---
  const [productoId, setProductoId] = useState(null)
  const [busquedaProducto, setBusquedaProducto] = useState("")
  const [mostrarDropdownProducto, setMostrarDropdownProducto] = useState(false)
  const dropdownProductoRef = useRef(null)

  const productosFiltrados = useMemo(() => {
    const q = busquedaProducto.trim().toLowerCase()
    const disponibles = inventario.filter((p) => (Number(p.stock) || 0) > 0)
    if (!q) return disponibles
    return disponibles.filter((p) => p.nombre.toLowerCase().includes(q))
  }, [inventario, busquedaProducto])

  const productoSeleccionado = useMemo(() => inventario.find((p) => p.id === productoId) || null, [inventario, productoId])
  // Monto real cobrado por la venta — precarga con el precio de lista pero
  // queda editable (descuentos, promociones) porque no siempre coincide.
  // Cierra el vínculo receta→venta que pide el anteproyecto (conversión de
  // recetas a ventas + ingresos, ver Reportes.jsx).
  const [montoVenta, setMontoVenta] = useState("")

  // --- Imágenes adjuntas (opcional) — se suben a Storage recién al
  // confirmar guardado, no antes, para no dejar archivos huérfanos si el
  // optómetra cancela la ficha a medio llenar. ---
  const [archivosImagenes, setArchivosImagenes] = useState([])
  const agregarArchivosImagenes = (lista) => {
    const nuevos = Array.from(lista).filter((f) => f.type.startsWith("image/"))
    setArchivosImagenes((prev) => [...prev, ...nuevos].slice(0, 6))
  }
  const quitarArchivoImagen = (idx) => setArchivosImagenes((prev) => prev.filter((_, i) => i !== idx))

  const seleccionarProducto = (p) => {
    setProductoId(p.id)
    setBusquedaProducto(p.nombre)
    setMostrarDropdownProducto(false)
    setMontoVenta(String(p.precio ?? ""))
    if (!lenteRecomendado.trim()) setLenteRecomendado(p.nombre)
  }

  const quitarProducto = () => {
    setProductoId(null)
    setBusquedaProducto("")
    setMontoVenta("")
  }

  const [notificacion, setNotificacion] = useState(false)
  const [errores, setErrores] = useState({})
  const [bannerError, setBannerError] = useState("")
  const [fichaGuardada, setFichaGuardada] = useState(false)
  const [mostrarConfirmarGuardar, setMostrarConfirmarGuardar] = useState(false)
  const [guardandoFicha, setGuardandoFicha] = useState(false)
  const [errorConfirmarFicha, setErrorConfirmarFicha] = useState("")

  // Secciones opcionales colapsadas por defecto — lo obligatorio queda fijo y a
  // la vista, lo opcional se expande solo si se necesita (feedback del asesor).
  const [seccionesAbiertas, setSeccionesAbiertas] = useState({})
  const alternarSeccion = (id) => setSeccionesAbiertas((prev) => ({ ...prev, [id]: !prev[id] }))

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
    return historialConsultas.filter((c) => c.pacienteId === pacienteId).sort((a, b) => (a.fecha < b.fecha ? 1 : -1))
  }, [historialConsultas, pacienteId])

  const ultimaConsultaPaciente = useMemo(() => {
    if (!pacienteId && !pacienteSeleccionado) return null
    return historialConsultas.find((c) => (pacienteId && c.pacienteId === pacienteId) || c.paciente === pacienteSeleccionado)
  }, [pacienteId, pacienteSeleccionado, historialConsultas])

  // --- Cálculo Clínico de Evolución (Equivalente Esférico) ---
  const calcularEvolucionIA = useMemo(() => {
    if (!ultimaConsultaPaciente) return "Primera consulta"

    const calcularEE = (esf, cil) => parseFloat(esf || 0) + parseFloat(cil || 0) / 2

    const eeOdActual = calcularEE(odEsfera, odCilindro)
    const eeOiActual = calcularEE(oiEsfera, oiCilindro)

    const eeOdPrev = calcularEE(ultimaConsultaPaciente.od?.esfera, ultimaConsultaPaciente.od?.cilindro)
    const eeOiPrev = calcularEE(ultimaConsultaPaciente.oi?.esfera, ultimaConsultaPaciente.oi?.cilindro)

    const variacionPromedio = (Math.abs(eeOdActual) - Math.abs(eeOdPrev) + (Math.abs(eeOiActual) - Math.abs(eeOiPrev))) / 2

    if (Math.abs(variacionPromedio) < 0.25) return "Sin cambios"
    if (variacionPromedio > 0.25) return "Aumentó"
    return "Disminuyó"
  }, [odEsfera, odCilindro, oiEsfera, oiCilindro, ultimaConsultaPaciente])

  // --- Estado de corrección: ¿la corrección actual (anteojos/lentes) logra buena AV? ---
  const estadoCorreccionActual = useMemo(
    () => evaluarCorreccion(odAgudezaCc, oiAgudezaCc),
    [odAgudezaCc, oiAgudezaCc],
  )
  const estadoRecetaColor = CORRECCION[estadoCorreccionActual] || CORRECCION["Requiere ajuste"]
  const IconoEstadoReceta = estadoRecetaColor.icon

  // --- Detalle del análisis (solo para mostrar; no altera la lógica) ---
  const analisisEvolucion = useMemo(() => {
    const ee = (esf, cil) => parseFloat(esf || 0) + parseFloat(cil || 0) / 2
    const odA = ee(odEsfera, odCilindro)
    const oiA = ee(oiEsfera, oiCilindro)
    if (!ultimaConsultaPaciente) return { primera: true, odA, oiA }
    const odP = ee(ultimaConsultaPaciente.od?.esfera, ultimaConsultaPaciente.od?.cilindro)
    const oiP = ee(ultimaConsultaPaciente.oi?.esfera, ultimaConsultaPaciente.oi?.cilindro)
    const variacion = (Math.abs(odA) - Math.abs(odP) + (Math.abs(oiA) - Math.abs(oiP))) / 2
    return { primera: false, odA, oiA, odP, oiP, variacion, fechaPrev: ultimaConsultaPaciente.fecha, verdicto: calcularEvolucionIA }
  }, [odEsfera, odCilindro, oiEsfera, oiCilindro, ultimaConsultaPaciente, calcularEvolucionIA])

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
    setFechaPrecarga(Object.keys(camposPrecargados).length > 0 ? prev.fecha : null)
    setAvisoPrimeraVisita(!prev)
  }

  // Llega desde "¿Deseas abrir su ficha clínica ahora?" al crear un paciente en
  // Pacientes.jsx — lo preselecciona para no tener que buscarlo de nuevo aquí.
  useEffect(() => {
    if (!pacienteInicial) return
    seleccionarPacienteCombo(pacienteInicial)
    onPacienteInicialConsumido?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteInicial])

  const resetForm = () => {
    setPacienteId(null)
    setPacienteSeleccionado("")
    setBusquedaPaciente("")
    setMotivo("")
    setUsaLentes("")
    setAntecedentes("")
    setAlergias("")
    setAntecedentesFamiliares("")
    setPrecargado({})
    setFechaPrecarga(null)
    setRetinoscopiaOd("")
    setRetinoscopiaOi("")
    setOdEsfera("0.00")
    setOdCilindro("0.00")
    setOdEje("0")
    setOdAgudezaSc("20/70")
    setOdAgudezaCc("20/20")
    setOiEsfera("0.00")
    setOiCilindro("0.00")
    setOiEje("0")
    setOiAgudezaSc("20/50")
    setOiAgudezaCc("20/20")
    setAdicion("+0.00")
    setDp("64 mm")
    setAlt("18 mm")
    setAvCerca("J1")
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
    setDiagnostico("")
    setLenteRecomendado("")
    setIndicaciones("")
    setProximoControlDias(180)
    setProductoId(null)
    setBusquedaProducto("")
    setErrores({})
    setBannerError("")
    setFichaGuardada(false)
    setSubTab("anamnesis")
    setSeccionesAbiertas({})
    setMostrarHistorial(false)
  }

  // Valida los 3 pasos y, si todo está bien, abre el paso de confirmación antes de guardar
  const intentarGuardar = (e) => {
    e.preventDefault()

    for (const paso of ["anamnesis", "refraccion", "diagnostico"]) {
      const errs = validarPaso(paso)
      if (Object.keys(errs).length > 0) {
        setErrores(errs)
        setBannerError(mensajeBanner(paso))
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

    const nuevaFicha = {
      fecha: fechaConsulta,
      pacienteId,
      paciente: pacienteSeleccionado,
      motivo,
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
      diagnostico,
      lenteRecomendado,
      indicaciones,
      proximoControlDias,
      evolucionCalculada: tendenciaGraduacion,
      estadoCorreccion,
      productoId: productoSeleccionado?.id || null,
      productoNombre: productoSeleccionado?.nombre || null,
      montoVenta: productoSeleccionado ? (Number(montoVenta) || 0) : null,
    }

    nuevaFicha.profesionalNombre = usuario?.nombre || null

    if (supabase && usuario?.opticaId) {
      // Sube las imágenes seleccionadas recién ahora (confirmado el
      // guardado) — un archivo que no llega a subir no bloquea la ficha,
      // solo se omite y se avisa aparte (nunca se pierde la consulta por
      // un adjunto fallido).
      const imagenesSubidas = []
      for (const archivo of archivosImagenes) {
        const ruta = `${usuario.opticaId}/${pacienteId || "sin-paciente"}-${Date.now()}-${archivo.name}`
        const { error: errorSubida } = await supabase.storage.from("consultas-adjuntos").upload(ruta, archivo)
        if (!errorSubida) imagenesSubidas.push({ path: ruta, nombre: archivo.name })
      }
      nuevaFicha.imagenes = imagenesSubidas

      const { data, error } = await supabase
        .from("consultas")
        .insert({
          optica_id: usuario.opticaId,
          paciente_id: typeof pacienteId === "string" ? pacienteId : null,
          paciente: nuevaFicha.paciente,
          fecha: nuevaFicha.fecha,
          motivo: nuevaFicha.motivo,
          usa_lentes: nuevaFicha.usaLentes === "si",
          antecedentes: nuevaFicha.antecedentes,
          alergias: nuevaFicha.alergias,
          antecedentes_familiares: nuevaFicha.antecedentesFamiliares,
          datos_clinicos: { retinoscopia: nuevaFicha.retinoscopia, od: nuevaFicha.od, oi: nuevaFicha.oi, medidas: nuevaFicha.medidas, examen: nuevaFicha.examen },
          diagnostico: nuevaFicha.diagnostico,
          lente_recomendado: nuevaFicha.lenteRecomendado,
          indicaciones: nuevaFicha.indicaciones,
          proximo_control_dias: nuevaFicha.proximoControlDias,
          evolucion_calculada: nuevaFicha.evolucionCalculada,
          estado_correccion: nuevaFicha.estadoCorreccion,
          producto_id: nuevaFicha.productoId,
          producto_nombre: nuevaFicha.productoNombre,
          monto_venta: nuevaFicha.montoVenta,
          profesional_nombre: nuevaFicha.profesionalNombre,
          imagenes: nuevaFicha.imagenes,
        })
        .select()
        .single()
      // Antes esto solo se registraba en consola y seguía como si hubiera
      // guardado bien — el optómetra veía "guardado con éxito" y una receta
      // lista para imprimir de una consulta que nunca llegó a la base de
      // datos. Ahora se detiene y avisa, igual que cualquier otro paso.
      if (error) {
        setGuardandoFicha(false)
        setErrorConfirmarFicha("No se pudo guardar la ficha clínica. Revisa tu conexión e intenta de nuevo — nada se imprimió ni se guardó todavía.")
        return
      }
      if (data) nuevaFicha.id = data.id
      const { error: errorPaciente } = await supabase.from("pacientes").update({ evolucion: tendenciaGraduacion, estado_correccion: estadoCorreccion, ultima_consulta: fechaConsulta }).eq("id", pacienteId)
      if (errorPaciente) console.error("La ficha se guardó, pero no se pudo actualizar el resumen del paciente:", errorPaciente.message)
    }
    if (nuevaFicha.id == null) nuevaFicha.id = Date.now()

    setHistorialConsultas([nuevaFicha, ...historialConsultas])

    if (pacientesLista.length > 0 && setPacientes) {
      const pacientesActualizados = pacientesLista.map((p) => {
        if (p.id === pacienteId) {
          return { ...p, evolucion: tendenciaGraduacion, estadoCorreccion, ultimaConsulta: fechaConsulta }
        }
        return p
      })
      setPacientes(pacientesActualizados)
    }

    // Descuenta 1 unidad del producto vinculado — cierra el ciclo clínico → inventario
    if (productoSeleccionado && setInventario) {
      const stockNuevo = Math.max(0, (Number(productoSeleccionado.stock) || 0) - 1)
      if (supabase && usuario?.opticaId) {
        supabase.from("inventario").update({ stock: stockNuevo }).eq("id", productoSeleccionado.id).then(({ error: errorStock }) => {
          if (errorStock) console.error("La ficha se guardó, pero no se pudo descontar el stock del producto vinculado:", errorStock.message)
        })
      }
      setInventario(
        inventario.map((p) => (p.id === productoSeleccionado.id ? { ...p, stock: stockNuevo } : p)),
      )
    }

    setGuardandoFicha(false)
    setMostrarConfirmarGuardar(false)
    setNotificacion(true)
    setTimeout(() => setNotificacion(false), 3500)
    setFichaGuardada(true)
    setSubTab("diagnostico")
  }

  // ── Validación por paso ──
  const esNumero = (v) => v !== "" && v !== null && v !== undefined && !isNaN(parseFloat(v))

  const validarPaso = (paso) => {
    const errs = {}
    if (paso === "anamnesis") {
      if (!pacienteId) errs.paciente = busquedaPaciente.trim()
        ? "Ese nombre no coincide con ningún paciente registrado. Selecciónalo de la lista."
        : "Selecciona un paciente registrado de la lista."
    } else if (paso === "refraccion") {
      if (!esNumero(odEsfera)) errs.od_esfera = "Número requerido"
      if (!esNumero(odCilindro)) errs.od_cilindro = "Número requerido"
      if (!esNumero(odEje)) errs.od_eje = "Número requerido"
      else if (parseFloat(odEje) < 0 || parseFloat(odEje) > 180) errs.od_eje = "El eje va de 0° a 180°"
      if (!esNumero(oiEsfera)) errs.oi_esfera = "Número requerido"
      if (!esNumero(oiCilindro)) errs.oi_cilindro = "Número requerido"
      if (!esNumero(oiEje)) errs.oi_eje = "Número requerido"
      else if (parseFloat(oiEje) < 0 || parseFloat(oiEje) > 180) errs.oi_eje = "El eje va de 0° a 180°"
    } else if (paso === "diagnostico") {
      if (!diagnostico.trim()) errs.diagnostico = "Escribe el diagnóstico clínico."
    }
    return errs
  }

  const mensajeBanner = (paso) => {
    if (paso === "anamnesis") return "Selecciona un paciente registrado de la lista antes de continuar."
    if (paso === "refraccion") return "Revisa la refracción: esfera, cilindro y eje deben ser números válidos en ambos ojos."
    if (paso === "diagnostico") return "Escribe el diagnóstico clínico antes de guardar la receta."
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
          setBannerError(mensajeBanner(paso))
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
    const hoy = new Date()
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

  const fechaLarga = useMemo(() => {
    try {
      const d = new Date(fechaConsulta + "T00:00:00")
      return d.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" })
    } catch {
      return fechaConsulta
    }
  }, [fechaConsulta])

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
        <div role="status" className="no-print flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-900 shadow-sm">
          <CheckCircle className="shrink-0 text-emerald-600" size={20} />
          <div>
            <p className="text-sm font-semibold">Ficha clínica guardada con éxito.</p>
            <p className="text-xs text-emerald-700">La evolución del paciente se ha actualizado en el sistema.</p>
          </div>
        </div>
      )}

      <div className="mx-auto w-full max-w-3xl">
        {/* ─── FORMULARIO PRINCIPAL ─── */}
        <div className="no-print flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Stepper */}
          <div className="flex gap-1 border-b border-slate-200 bg-slate-50/70 p-2">
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
            <div ref={inicioFormRef} />
            {bannerError && (
              <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-red-700">
                <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
                <div>
                  <p className="text-sm font-bold">No puedes continuar todavía</p>
                  <p className="text-xs text-red-600">{bannerError}</p>
                </div>
              </div>
            )}
            {/* PASO 1: ANAMNESIS */}
            {subTab === "anamnesis" && (
              <div className="space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <h2 className="text-sm font-bold" style={{ color: INK }}>Datos del paciente e historial clínico</h2>
                  <div className="flex items-center gap-2">
                    {pacienteId && (
                      <button
                        type="button"
                        onClick={() => setMostrarHistorial(true)}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:border-blue-300 hover:text-blue-700 cursor-pointer"
                      >
                        <History size={13} /> Ver historial ({historialPaciente.length})
                      </button>
                    )}
                    <Calendar size={14} className="text-slate-500" />
                    <input
                      type="date"
                      value={fechaConsulta}
                      onChange={(e) => setFechaConsulta(e.target.value)}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="relative" ref={dropdownRef}>
                    <label htmlFor="paciente" className="mb-1.5 block text-sm font-medium text-slate-600">
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
                        className={"w-full rounded-lg border bg-white py-2.5 pl-9 pr-8 text-sm text-slate-800 outline-none transition focus:border-blue-500 " + (errores.paciente ? "border-red-400 ring-2 ring-red-100" : "border-slate-300")}
                      />
                      <Search size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    </div>

                    {mostrarDropdown && pacientesFiltrados.length > 0 && (
                      <ul className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
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
                      <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500 shadow-lg">
                        Ningún paciente registrado coincide. Créalo primero en el módulo Pacientes — aquí no se puede escribir un nombre nuevo.
                      </div>
                    )}

                    {errores.paciente && (
                      <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600">
                        <AlertCircle size={13} /> {errores.paciente}
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="motivo" className="mb-1.5 block text-sm font-medium text-slate-600">Motivo de la consulta</label>
                    <input
                      id="motivo"
                      type="text"
                      placeholder="Ej. Visión borrosa de lejos, dolor ocular..."
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
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
                    className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm leading-relaxed text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
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
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* PASO 2: REFRACCIÓN */}
            {subTab === "refraccion" && (
              <div className="space-y-5">
                <h2 className="text-sm font-bold" style={{ color: INK }}>Valores dióptricos y parámetros de taller</h2>

                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <button type="button" onClick={() => alternarSeccion("retinoscopia")} className="flex w-full items-center gap-1.5 border-b border-slate-200 pb-2 text-left text-sm font-semibold cursor-pointer" style={{ color: INK }}>
                    <ScanEye size={16} className="text-blue-600" /> Retinoscopía (refracción objetiva)
                    <span className="ml-auto text-[10px] font-normal normal-case text-slate-500">Opcional · punto de partida antes de refinar</span>
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
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-sm text-slate-800 outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="retinoOi" className="mb-1 block text-xs font-semibold text-slate-500">Hallazgo OI</label>
                      <input
                        id="retinoOi" type="text" placeholder="Ej. -0.75 -0.25 x175"
                        value={retinoscopiaOi} onChange={(e) => setRetinoscopiaOi(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-mono text-sm text-slate-800 outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  </>
                  )}
                </div>

                <p className="text-sm font-semibold" style={{ color: INK }}>Refracción subjetiva final</p>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <OjoCard sigla="OD" titulo="Ojo derecho" esfera={odEsfera} setEsfera={setOdEsfera} cilindro={odCilindro} setCilindro={setOdCilindro} eje={odEje} setEje={setOdEje} avSc={odAgudezaSc} setAvSc={setOdAgudezaSc} avCc={odAgudezaCc} setAvCc={setOdAgudezaCc} errores={errores} limpiarError={limpiarError} />
                  <OjoCard sigla="OI" titulo="Ojo izquierdo" esfera={oiEsfera} setEsfera={setOiEsfera} cilindro={oiCilindro} setCilindro={setOiCilindro} eje={oiEje} setEje={setOiEje} avSc={oiAgudezaSc} setAvSc={setOiAgudezaSc} avCc={oiAgudezaCc} setAvCc={setOiAgudezaCc} errores={errores} limpiarError={limpiarError} />
                </div>

                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <p className="flex items-center gap-1.5 border-b border-slate-200 pb-2 text-sm font-semibold" style={{ color: INK }}>
                    <Ruler size={16} className="text-blue-600" /> Parámetros de visión cercana y centrado
                  </p>
                  <div className={"grid grid-cols-1 gap-3 sm:grid-cols-" + (manejaProgresion ? "4" : "3")}>
                    {manejaProgresion && <MedidaCampo id="add" label="Adición (ADD)" value={adicion} onChange={setAdicion} />}
                    <MedidaCampo id="dp" label="Distancia pupilar (DP)" value={dp} onChange={setDp} />
                    <MedidaCampo id="alt" label="Altura pupilar (ALT)" value={alt} onChange={setAlt} />
                    <MedidaCampo id="avCerca" label="AV Cerca (Jaeger)" value={avCerca} onChange={setAvCerca} />
                  </div>
                </div>

                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <button type="button" onClick={() => alternarSeccion("examenFisico")} className="flex w-full items-center gap-1.5 border-b border-slate-200 pb-2 text-left text-sm font-semibold cursor-pointer" style={{ color: INK }}>
                    <ScanEye size={16} className="text-blue-600" /> Examen físico complementario
                    <span className="ml-auto text-[10px] font-normal normal-case text-slate-500">Opcional</span>
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
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="oftalmoscopia" className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-500"><ScanEye size={12} /> Oftalmoscopia</label>
                      <input
                        id="oftalmoscopia" type="text" placeholder="Ej. Papila y retina sin alteraciones"
                        value={oftalmoscopia} onChange={(e) => setOftalmoscopia(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="testColor" className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-500"><Palette size={12} /> Test de color</label>
                      <select
                        id="testColor" value={testColor} onChange={(e) => setTestColor(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm font-medium text-slate-700 outline-none focus:border-blue-500"
                      >
                        <option value="Normal">Normal</option>
                        <option value="Deficiencia rojo-verde">Deficiencia rojo-verde</option>
                        <option value="Deficiencia azul-amarillo">Deficiencia azul-amarillo</option>
                        <option value="No realizado">No realizado</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 border-t border-slate-200 pt-3">
                    <div>
                      <label htmlFor="coverLejos" className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-500">Cover test — lejos</label>
                      <select
                        id="coverLejos" value={coverTestLejos} onChange={(e) => setCoverTestLejos(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm font-medium text-slate-700 outline-none focus:border-blue-500"
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
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm font-medium text-slate-700 outline-none focus:border-blue-500"
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

                  <div className="grid grid-cols-2 gap-3 border-t border-slate-200 pt-3">
                    <div>
                      <label htmlFor="pioOd" className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-500">
                        <Droplet size={12} /> PIO — Ojo derecho (mmHg)
                      </label>
                      <input
                        id="pioOd" type="text" placeholder="Ej. 14" inputMode="numeric" maxLength={2}
                        value={pioOd} onChange={(e) => setPioOd(filtrarSoloNumeros(e.target.value, 2))}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="pioOi" className="mb-1 flex items-center gap-1 text-xs font-semibold text-slate-500">
                        <Droplet size={12} /> PIO — Ojo izquierdo (mmHg)
                      </label>
                      <input
                        id="pioOi" type="text" placeholder="Ej. 15" inputMode="numeric" maxLength={2}
                        value={pioOi} onChange={(e) => setPioOi(filtrarSoloNumeros(e.target.value, 2))}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  </>
                  )}
                </div>

                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <button type="button" onClick={() => alternarSeccion("biomicroscopia")} className="flex w-full items-center gap-1.5 border-b border-slate-200 pb-2 text-left text-sm font-semibold cursor-pointer" style={{ color: INK }}>
                    <Eye size={16} className="text-blue-600" /> Biomicroscopía (segmento anterior)
                    <span className="ml-auto text-[10px] font-normal normal-case text-slate-500">Opcional · lámpara de hendidura</span>
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
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="biomicroCornea" className="mb-1 block text-xs font-semibold text-slate-500">Córnea</label>
                      <input
                        id="biomicroCornea" type="text" placeholder="Ej. Transparente, sin lesiones"
                        value={biomicroCornea} onChange={(e) => setBiomicroCornea(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="biomicroCamara" className="mb-1 block text-xs font-semibold text-slate-500">Cámara anterior / cristalino</label>
                      <input
                        id="biomicroCamara" type="text" placeholder="Ej. Formada, cristalino transparente"
                        value={biomicroCamara} onChange={(e) => setBiomicroCamara(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  </>
                  )}
                </div>

                {/* Evolución en vivo mientras se editan los valores */}
                <PanelEvolucion analisis={analisisEvolucion} correccion={estadoCorreccionActual} compacto />
              </div>
            )}

            {/* PASO 3: DIAGNÓSTICO Y RECETA */}
            {subTab === "diagnostico" && (
              <div className="space-y-5">
                {/* Análisis de evolución asistido (no se imprime) */}
                <PanelEvolucion analisis={analisisEvolucion} correccion={estadoCorreccionActual} />

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
                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" id="receta-imprimible">
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
                        <p className="text-[11px] capitalize text-slate-500">{fechaLarga}</p>
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

                  {/* Estado de corrección — sin cifras exactas, solo el resultado clínico */}
                  <div className="px-8 pt-6">
                    <div className="print-force-color flex flex-col gap-3 rounded-xl border px-5 py-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: estadoRecetaColor.border, backgroundColor: estadoRecetaColor.bg }}>
                      <div className="flex items-center gap-3">
                        <span className="print-force-color grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: GRAD }}>
                          <IconoEstadoReceta size={19} />
                        </span>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: estadoRecetaColor.fg }}>Estado de corrección visual</p>
                          <p className="text-base font-bold" style={{ color: INK }}>{estadoCorreccionActual}</p>
                        </div>
                      </div>
                      <div className="flex gap-4 text-xs text-slate-600 sm:text-right">
                        <p>Agudeza OD <span className="font-mono font-bold" style={{ color: INK }}>{odAgudezaCc}</span></p>
                        <p>Agudeza OI <span className="font-mono font-bold" style={{ color: INK }}>{oiAgudezaCc}</span></p>
                      </div>
                    </div>
                  </div>

                  {/* Diagnóstico, lente recomendado e indicaciones — lo que el paciente se lleva */}
                  <div className="space-y-3.5 px-8 pt-5">
                    <div className="print-force-color rounded-xl border border-slate-200 bg-slate-50/70 p-4">
                      <label htmlFor="diagnostico" className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                        <Stethoscope size={12} /> Diagnóstico
                      </label>
                      <input
                        id="diagnostico"
                        type="text"
                        placeholder="Ej. Astigmatismo miópico compuesto / Presbicia"
                        value={diagnostico}
                        readOnly={fichaGuardada}
                        onChange={(e) => { setDiagnostico(e.target.value); if (e.target.value.trim()) limpiarError("diagnostico") }}
                        className={"w-full bg-transparent text-base font-bold outline-none focus:underline " + (errores.diagnostico ? "text-red-600" : "")}
                        style={errores.diagnostico ? undefined : { color: INK }}
                      />
                      {errores.diagnostico && (
                        <p className="no-print mt-1 flex items-center gap-1 text-xs font-medium text-red-600">
                          <AlertCircle size={13} /> {errores.diagnostico}
                        </p>
                      )}
                      {!fichaGuardada && (
                        <div className="no-print mt-2.5 flex flex-wrap gap-1.5 border-t border-slate-200 pt-2.5">
                          {diagnosticosRapidos.map((d) => (
                            <button
                              key={d}
                              type="button"
                              onClick={() => { setDiagnostico(d); limpiarError("diagnostico") }}
                              className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-blue-300 hover:text-blue-700 cursor-pointer"
                            >
                              {d}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {(lenteRecomendado || !fichaGuardada) && (
                      <div className="print-force-color flex items-start gap-3 rounded-xl border p-4" style={{ borderColor: "rgba(200,162,78,0.35)", backgroundColor: "rgba(200,162,78,0.08)" }}>
                        <Glasses size={18} style={{ color: GOLD }} className="mt-0.5 shrink-0" />
                        <div className="flex-1">
                          <label htmlFor="lenteRecomendado" className="mb-1 block text-[11px] font-bold uppercase tracking-[0.14em]" style={{ color: "#7c5e14" }}>Lente a recomendar</label>
                          <input
                            id="lenteRecomendado"
                            type="text"
                            placeholder="Ej. Monofocal con antirreflejo y filtro luz azul"
                            value={lenteRecomendado}
                            readOnly={fichaGuardada}
                            onChange={(e) => setLenteRecomendado(e.target.value)}
                            className="w-full bg-transparent text-sm font-semibold outline-none focus:underline"
                            style={{ color: INK }}
                          />
                        </div>
                      </div>
                    )}

                    {!fichaGuardada && (
                      <div className="no-print relative rounded-lg border border-dashed border-slate-300 bg-slate-50/70 p-3" ref={dropdownProductoRef}>
                        <label htmlFor="productoBodega" className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                          <Glasses size={12} /> Vincular producto de bodega <span className="font-normal normal-case text-slate-500">(opcional — descuenta 1 unidad de stock al guardar)</span>
                        </label>
                        {productoSeleccionado ? (
                          <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
                            <span className="font-semibold text-blue-800">{productoSeleccionado.nombre}</span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs text-blue-600">{productoSeleccionado.stock} u. en stock</span>
                              <label className="flex items-center gap-1 rounded-md border border-blue-200 bg-white px-1.5 py-0.5">
                                <span className="text-xs font-bold text-blue-500">$</span>
                                <input
                                  type="number" min="0" step="0.01" value={montoVenta} onChange={(e) => setMontoVenta(e.target.value)}
                                  aria-label="Monto de la venta"
                                  className="w-16 text-right font-mono text-xs text-blue-800 outline-none"
                                />
                              </label>
                              <button type="button" onClick={quitarProducto} aria-label="Quitar producto vinculado" className="rounded-md px-1.5 py-0.5 text-sm font-bold text-blue-500 hover:bg-blue-100 hover:text-blue-700 cursor-pointer">
                                ×
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="relative">
                              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
                              <input
                                type="text"
                                placeholder="Buscar armazón o producto en inventario..."
                                value={busquedaProducto}
                                onFocus={() => setMostrarDropdownProducto(true)}
                                onChange={(e) => { setBusquedaProducto(e.target.value); setMostrarDropdownProducto(true) }}
                                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-8 pr-3 text-sm text-slate-800 outline-none focus:border-blue-500"
                              />
                            </div>
                            {mostrarDropdownProducto && productosFiltrados.length > 0 && (
                              <ul className="absolute z-50 mt-1 max-h-40 w-[calc(100%-1.5rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                                {productosFiltrados.map((p) => (
                                  <li
                                    key={p.id}
                                    onClick={() => seleccionarProducto(p)}
                                    className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700"
                                  >
                                    <span className="font-semibold">{p.nombre}</span>
                                    <span className="font-mono text-xs text-slate-500">{p.stock} u. · ${Number(p.precio).toFixed(2)}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                            {mostrarDropdownProducto && busquedaProducto && productosFiltrados.length === 0 && (
                              <p className="mt-1.5 text-xs text-slate-500">Ningún producto con stock coincide con la búsqueda.</p>
                            )}
                          </>
                        )}
                      </div>
                    )}

                    {fichaGuardada && productoSeleccionado && (
                      <p className="no-print flex items-center gap-1.5 text-xs text-slate-500">
                        <Glasses size={13} className="text-blue-500" /> Vinculado a <span className="font-semibold text-slate-700">{productoSeleccionado.nombre}</span> — se descontó 1 unidad del inventario.
                      </p>
                    )}

                    {!fichaGuardada && (
                      <div className="no-print rounded-lg border border-dashed border-slate-300 bg-slate-50/70 p-3">
                        <label className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-500">
                          <ImageIcon size={12} /> Adjuntar imágenes <span className="font-normal normal-case text-slate-500">(opcional — hasta 6)</span>
                        </label>
                        <div className="mt-1.5 flex flex-wrap items-center gap-2">
                          {archivosImagenes.map((f, i) => (
                            <div key={i} className="relative h-14 w-14 overflow-hidden rounded-lg border border-slate-200">
                              <img src={URL.createObjectURL(f)} alt={f.name} className="h-full w-full object-cover" />
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
                      <div className="print-force-color rounded-xl border border-slate-200 bg-slate-50/70 p-4">
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
                          className="w-full resize-none bg-transparent text-sm font-medium outline-none focus:underline"
                          style={{ color: INK }}
                        />
                      </div>
                    )}

                    {mostrarMedidasPaciente ? (
                      <div className="print-force-color rounded-xl border border-slate-200 bg-slate-50/70 p-4">
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
                    ) : (
                      <p className="print-force-color rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3.5 text-[11px] leading-relaxed text-slate-500">
                        <span className="font-semibold text-slate-600">Medidas protegidas: </span>
                        por política de la óptica, las medidas exactas de su graduación (esfera, cilindro, eje) no se incluyen en este documento. Si las necesita para otro proveedor, puede solicitarlas — tienen un costo adicional por la toma y entrega del examen.
                      </p>
                    )}

                    <div className="print-force-color flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <CalendarClock size={18} className="no-print shrink-0 text-blue-600" />
                      <div className="flex-1">
                        <label htmlFor="proximoControl" className="block text-xs font-bold uppercase tracking-wide text-slate-500">Próximo control recomendado</label>
                        <p className="no-print text-[11px] text-slate-500">Define cuándo el CRM debe avisar si el paciente no ha vuelto.</p>
                      </div>
                      <select
                        id="proximoControl"
                        value={proximoControlDias}
                        disabled={fichaGuardada}
                        onChange={(e) => setProximoControlDias(Number(e.target.value))}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        <option value={30}>1 mes</option>
                        <option value={90}>3 meses</option>
                        <option value={180}>6 meses</option>
                        <option value={365}>1 año</option>
                      </select>
                    </div>
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
                        <p className="text-[11px] text-slate-500">Reg. Prof. ____________</p>
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
                    type="button"
                    onClick={() => irA(subTab === "anamnesis" ? "refraccion" : "diagnostico")}
                    className="flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 cursor-pointer"
                    style={{ backgroundColor: INK }}
                  >
                    Siguiente <ArrowRight size={15} />
                  </button>
                ) : !fichaGuardada ? (
                  <button
                    type="submit"
                    className="flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-semibold text-white transition hover:-translate-y-0.5 cursor-pointer"
                    style={{ background: GRAD, boxShadow: "0 12px 24px -12px rgba(37,99,235,0.6)" }}
                  >
                    <Save size={15} /> Guardar ficha clínica
                  </button>
                ) : (
                  <button
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={() => setMostrarHistorial(false)}>
          <div className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)" }} onClick={(e) => e.stopPropagation()}>
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
                historialPaciente.map((c) => (
                  <div key={c.id} className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-bold" style={{ color: INK }}>{c.fecha}</span>
                      <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 shadow-sm">{c.motivo || "Consulta general"}</span>
                    </div>
                    <p className="mt-1.5 text-sm text-slate-700">{c.diagnostico || "Sin diagnóstico registrado"}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[11px] text-slate-500">
                      <span>OD: {c.od?.esfera ?? "—"} {c.od?.cilindro ?? ""} x{c.od?.eje ?? "—"} · AV {c.od?.avCc ?? "—"}</span>
                      <span>OI: {c.oi?.esfera ?? "—"} {c.oi?.cilindro ?? ""} x{c.oi?.eje ?? "—"} · AV {c.oi?.avCc ?? "—"}</span>
                    </div>
                    {c.lenteRecomendado && <p className="mt-1.5 text-[11px] text-slate-500">Lente recomendado: <span className="font-semibold text-slate-600">{c.lenteRecomendado}</span></p>}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─── AVISO: PRIMERA CONSULTA DEL PACIENTE (feedback del asesor) ─── */}
      {avisoPrimeraVisita && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={() => setAvisoPrimeraVisita(false)}>
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl" style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)" }} onClick={(e) => e.stopPropagation()}>
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
        </div>
      )}
    </div>
  )
}

/* ---------- Subcomponentes ---------- */

function PanelEvolucion({ analisis, correccion, compacto }) {
  const c = CORRECCION[correccion] || CORRECCION["Requiere ajuste"]
  const IconoC = c.icon

  if (compacto) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-2.5" style={{ borderColor: c.border, backgroundColor: c.bg }}>
          <span className="flex items-center gap-1.5 text-sm font-bold" style={{ color: c.fg }}>
            <IconoC size={16} /> {correccion}
          </span>
          <span className="text-xs text-slate-500">Según agudeza visual con la corrección actual</span>
        </div>
        {!analisis.primera && (() => {
          const t = TENDENCIA[analisis.verdicto] || TENDENCIA["Sin cambios"]
          const IconoT = t.icon
          const signo = analisis.variacion > 0 ? "+" : ""
          return (
            <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-1.5 text-xs text-slate-500">
              <IconoT size={13} style={{ color: t.fg }} />
              <span>Tendencia de graduación: <span className="font-semibold" style={{ color: t.fg }}>{analisis.verdicto}</span> ({signo}{analisis.variacion.toFixed(2)} D)</span>
            </div>
          )
        })()}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Estado de corrección: lo clínicamente accionable */}
      <div className="overflow-hidden rounded-2xl border" style={{ borderColor: c.border }}>
        <div className="flex items-center justify-between px-5 py-3" style={{ backgroundColor: c.bg }}>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg text-white" style={{ background: GRAD }}><IconoC size={16} /></span>
            <h3 className="text-sm font-bold" style={{ color: INK }}>Estado de corrección visual</h3>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold" style={{ backgroundColor: "#fff", color: c.fg, border: `1px solid ${c.border}` }}>
            <IconoC size={14} /> {correccion}
          </span>
        </div>
        <div className="bg-white p-5">
          <p className="text-sm text-slate-600">{c.txt}</p>
          <p className="mt-3 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">
            <span className="font-semibold text-slate-600">Recuerda: </span>
            un error refractivo no se corrige por sí solo; se maneja de forma efectiva con anteojos, lentes de contacto o cirugía refractiva.
          </p>
        </div>
      </div>

      {/* Tendencia de graduación: dato de contexto, no un veredicto de mejoría/empeoramiento */}
      {analisis.primera ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-slate-200 text-slate-500"><Sparkles size={14} /></span>
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">Tendencia de graduación</h4>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Es la <span className="font-semibold text-slate-600">primera consulta</span> de este paciente: estos valores quedarán como punto de partida para comparar a futuro.
          </p>
        </div>
      ) : (() => {
        const t = TENDENCIA[analisis.verdicto] || TENDENCIA["Sin cambios"]
        const IconoT = t.icon
        const signo = analisis.variacion > 0 ? "+" : ""
        const varTxt = `${signo}${analisis.variacion.toFixed(2)} D`
        return (
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                <Sparkles size={13} className="text-slate-500" /> Tendencia de graduación (dato de contexto)
              </h4>
              <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ backgroundColor: t.bg, color: t.fg }}>
                <IconoT size={12} /> {analisis.verdicto}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ComparaOjo sigla="OD" prev={analisis.odP} actual={analisis.odA} />
              <ComparaOjo sigla="OI" prev={analisis.oiP} actual={analisis.oiA} />
            </div>
            <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-4 py-2.5 text-xs">
              <span className="text-slate-500">Variación promedio</span>
              <span className="font-mono font-bold" style={{ color: t.fg }}>{varTxt}</span>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
              Calculado por <span className="font-semibold text-slate-500">equivalente esférico</span> (Esfera + Cilindro/2) frente a
              la consulta del {analisis.fechaPrev}. Es solo un dato de referencia: no indica por sí mismo mejoría ni empeoramiento.
            </p>
          </div>
        )
      })()}
    </div>
  )
}

function ComparaOjo({ sigla, prev, actual }) {
  const fmt = (n) => `${n > 0 ? "+" : ""}${Number(n).toFixed(2)}`
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <span className="grid h-5 w-5 place-items-center rounded font-mono text-[10px] font-bold text-white" style={{ backgroundColor: sigla === "OD" ? "#2563EB" : "#06b6d4" }}>
        {sigla}
      </span>
      <div className="mt-2 flex items-center gap-2 font-mono text-sm">
        <span className="text-slate-500">{fmt(prev)}</span>
        <ArrowRight size={13} className="text-slate-300" />
        <span className="font-bold" style={{ color: "#0E2B33" }}>{fmt(actual)}</span>
      </div>
      <p className="mt-0.5 text-[10px] text-slate-500">Equiv. esférico</p>
    </div>
  )
}

function OjoCard({ sigla, titulo, esfera, setEsfera, cilindro, setCilindro, eje, setEje, avSc, setAvSc, avCc, setAvCc, errores = {}, limpiarError }) {
  const color = sigla === "OD" ? "#2563EB" : "#06b6d4"
  const pre = sigla.toLowerCase()
  return (
    <div className="space-y-3.5 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <span className="grid h-6 w-6 place-items-center rounded-md font-mono text-xs font-bold text-white" style={{ backgroundColor: color }}>
          {sigla}
        </span>
        <h3 className="text-sm font-bold" style={{ color }}>{titulo}</h3>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <NumCampo label="Esfera" value={esfera} onChange={(v) => { setEsfera(v); limpiarError?.(`${pre}_esfera`) }} id={`${sigla}-esf`} error={errores[`${pre}_esfera`]} />
        <NumCampo label="Cilindro" value={cilindro} onChange={(v) => { setCilindro(v); limpiarError?.(`${pre}_cilindro`) }} id={`${sigla}-cil`} error={errores[`${pre}_cilindro`]} />
        <NumCampo label="Eje (°)" value={eje} onChange={(v) => { setEje(v); limpiarError?.(`${pre}_eje`) }} id={`${sigla}-eje`} error={errores[`${pre}_eje`]} tipo="entero" maxLength={3} />
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-slate-200 pt-2">
        <div>
          <label htmlFor={`${sigla}-avsc`} className="mb-0.5 block text-xs font-semibold text-slate-500">AV sin lentes</label>
          <select id={`${sigla}-avsc`} value={avSc} onChange={(e) => setAvSc(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500">
            {escalasSnellen.map((esc) => (<option key={esc} value={esc}>{esc}</option>))}
          </select>
        </div>
        <div>
          <label htmlFor={`${sigla}-avcc`} className="mb-0.5 block text-xs font-semibold text-slate-500">AV con lentes</label>
          <select id={`${sigla}-avcc`} value={avCc} onChange={(e) => setAvCc(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 outline-none focus:border-blue-500">
            {escalasSnellen.map((esc) => (<option key={esc} value={esc}>{esc}</option>))}
          </select>
        </div>
      </div>
    </div>
  )
}

function NumCampo({ label, value, onChange, id, error, tipo = "decimal", maxLength }) {
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
        className={"w-full rounded-lg border bg-white px-2 py-1.5 text-center font-mono text-sm font-semibold text-slate-800 outline-none focus:border-blue-500 " + (error ? "border-red-400 ring-2 ring-red-100" : "border-slate-300")}
      />
      {error && <p className="mt-0.5 text-[10px] font-medium text-red-600">{error}</p>}
    </div>
  )
}

function MedidaCampo({ id, label, value, onChange }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-slate-500">{label}</label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500"
      />
    </div>
  )
}

// Marca un campo como heredado de una visita anterior, sin ocultar que sigue siendo editable
function InsigniaHistorial({ fecha }) {
  const fechaCorta = fecha ? fecha.split("-").reverse().join("/") : null
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600" title="Puedes editarlo si cambió">
      <History size={10} /> {fechaCorta ? `De su visita del ${fechaCorta}` : "De su historial"}
    </span>
  )
}

function RecetaDato({ label, valor, ancho }) {
  return (
    <div className={ancho ? "sm:col-span-2" : ""}>
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">{valor}</p>
    </div>
  )
}

