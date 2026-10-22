"use client"

import { dinero } from "../utilidades/formatoMoneda"
import { ahoraEcuador } from "../utilidades/horaEcuador"

import { useState, useEffect, useMemo, useRef } from "react"
import { supabase } from "../lib/supabaseClient"
import {
  CheckCircle, ArrowLeft, ArrowRight, Save, Stethoscope, AlertCircle, User, Sparkles, Printer, Calendar, Search,
  TrendingUp, TrendingDown, Minus, Glasses, CalendarClock, History, X, Image as ImageIcon, Receipt, LogOut, ShoppingBag, ClipboardList, Download,
} from "lucide-react"
import { hoyISO, diaTieneCupo } from "../utilidades/disponibilidad"
import { sumarDiasISO, diaHabilMasCercano } from "../utilidades/controles"
import { MENSAJE_HORA_INVALIDA, esErrorHoraInvalida } from "../utilidades/erroresCitas"
import CampoFecha from "../componentes/CampoFecha"
import SelectorFechaHora from "../componentes/SelectorFechaHora"
import { moverCitaAHoy, necesitaMoverseAHoy } from "../utilidades/moverCitaAHoy"
import { antecedentesRelevantes, textoAntecedentes } from "../utilidades/antecedentes"
import { lineasCobroConsulta } from "../utilidades/costosConsulta"
import ConfirmarFichaModal from "../componentes/ConfirmarFichaModal"
import { Cascaron, DetalleAtencion } from "../componentes/AtencionPaciente"
import ConfirmarDejarDeAtender from "../componentes/ConfirmarDejarDeAtender"
import ComprobanteVentaModal from "./ComprobanteVentaModal"
import { registrarLog } from "../utilidades/logs"
import { ordenarPorFechaYCreacion } from "../utilidades/fidelizacion"
import { fechaLegible, formatoFecha } from "../utilidades/formatoFecha"
import { tendenciaEntreConsultas } from "../utilidades/tendenciaGraduacion"
import { cambioEntre, lineaDeCambio } from "../utilidades/cambioGraduacion"
import { imprimirHojaReceta } from "../utilidades/imprimirHojaReceta"
import { descargarHojaReceta } from "../utilidades/descargarHojaReceta"
import HojaReceta from "../componentes/HojaReceta"
import { MENSAJE_SIN_PERMISO, esErrorSinPermiso } from "../utilidades/permisos"
import { INK, GOLD } from "@/lib/tema"
import { guardarBorradorFicha, leerBorradorFicha, borrarBorradorFicha, textoGuardado } from "../utilidades/borradorFicha"
import { EVENTO_GUARDAR_BORRADOR } from "../utilidades/sesionPestanas"
import { textoOjoCompleto } from "../utilidades/refraccion"
import { agudezaConLentes } from "../utilidades/agudeza"
import { PASOS, crearForm, recetaDesdeForm, consultaDesdeForm, datosClinicosDesdeForm, columnasDeAnamnesis, estadoCorreccionDeForm, anamnesisDeConsulta, hayAnamnesisPrevia, validarPasos, pasoConErrores, estadoDePasos, componerTexto } from "../utilidades/fichaDatos"
import BarraPasos from "../componentes/ficha/BarraPasos"
import PanelContexto from "../componentes/ficha/PanelContexto"
import PasoAnamnesis from "../componentes/ficha/PasoAnamnesis"
import PasoExamen from "../componentes/ficha/PasoExamen"
import { CLASE_INPUT } from "../componentes/ficha/piezas"
import { datosOpticaReceta } from "../utilidades/datosReceta"
import { sugerirDiagnostico } from "../utilidades/diagnosticoSugerido"

// ─── Paleta de firma (consistente con el resto del sistema) ───
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)" // cian → azul

// Tendencia de la graduación medida (solo describe el número, no implica cura ni deterioro clínico)
const TENDENCIA = {
  Disminuyó: { fg: "#0891b2", icon: TrendingDown },
  Aumentó: { fg: "#dc2626", icon: TrendingUp },
  "Sin cambios": { fg: "#475569", icon: Minus },
}

const SIN_ERRORES = { anamnesis: {}, examen: {}, diagnostico: {} }
const CLAVES_FORM = Object.keys(crearForm(""))

export default function ConsultaMedica({ usuario, disponibilidad, pacientes: pacientesLista = [], setPacientes, consultas: historialConsultas = [], setConsultas: setHistorialConsultas, inventario = [], setInventario, setFacturasVenta, parametrizacion, diagnosticosRapidos = [], motivosConsulta = [], pacienteInicial, citaIdInicial, motivoInicial, citas = [], setCitas, onPacienteInicialConsumido, onVolver, onCerrar, origenNombre = "Pacientes", onCambiosSinGuardarChange, onAviso, pases = [], setPases }) {
  // El paso en pantalla (Anamnesis, Examen o Diagnóstico y receta).
  const [paso, setPaso] = useState("anamnesis")
  // Cita de origen cuando esta ficha se abrió desde "Atender" en Citas médicas.
  const [citaEnAtencionId, setCitaEnAtencionId] = useState(null)
  // Lo que cambió al abrir la ficha de una cita: el estado anterior (si pasó a "En atención") y si se registró quién atiende. Sirve para "Dejar de atender".
  const aperturaCita = useRef({ estado: null, atendido: false })
  const [mostrarDejarDeAtender, setMostrarDejarDeAtender] = useState(false)
  // Si la óptica no ofrece progresión, no tiene sentido pedir la adición (configurable en Configuración)
  const manejaProgresion = parametrizacion?.manejaProgresion !== false

  // ─── El formulario: un solo objeto (crearForm). `set` cambia un campo; `setVarios`, varios a la vez ───
  const [f, setF] = useState(() => crearForm(hoyISO()))
  const set = (campo, valor) => setF((p) => (p[campo] === valor ? p : { ...p, [campo]: valor }))
  const setVarios = (cambios) => setF((p) => ({ ...p, ...cambios }))

  // pacienteId es la fuente de verdad de la selección; pacienteSeleccionado (el nombre) sólo se deriva de una selección real del desplegable.
  const [pacienteId, setPacienteId] = useState(null)
  const [pacienteSeleccionado, setPacienteSeleccionado] = useState("")
  const [busquedaPaciente, setBusquedaPaciente] = useState("")
  const [mostrarDropdown, setMostrarDropdown] = useState(false)
  const dropdownRef = useRef(null)
  // El borrador vive en la base de datos, por paciente y cita (borradorFicha.js).
  const clave = usuario?.id && pacienteId ? `${pacienteId}:${citaEnAtencionId || "directa"}` : null
  const ctxBorrador = useMemo(() => ({ usuarioId: usuario?.id, pacienteId, citaId: citaEnAtencionId }), [usuario?.id, pacienteId, citaEnAtencionId])
  const [guardadoEn, setGuardadoEn] = useState(null)
  const [borradorPendiente, setBorradorPendiente] = useState(null)
  const [ahoraTexto, setAhoraTexto] = useState(() => Date.now())

  const pacientesFiltrados = useMemo(() => {
    if (!busquedaPaciente.trim()) return pacientesLista
    return pacientesLista.filter((p) => p.nombre.toLowerCase().includes(busquedaPaciente.toLowerCase()) || (p.cedula && p.cedula.includes(busquedaPaciente)))
  }, [pacientesLista, busquedaPaciente])

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) setMostrarDropdown(false)
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Con cita, el motivo llega relleno y se muestra como dato (con "Cambiar"); sin cita aparece el selector obligatorio.
  const [editandoMotivo, setEditandoMotivo] = useState(false)
  // Antecedentes que el paciente ya tenía: se precargan (solo se actualiza lo que cambió) y el cuadro arranca resumido.
  const [fechaPrecarga, setFechaPrecarga] = useState(null)
  const [tieneHistorialAntecedentes, setTieneHistorialAntecedentes] = useState(false)
  const [antecedentesAbiertos, setAntecedentesAbiertos] = useState(false)

  // Cobro (Ronda 4 del flujo de atención): la ficha solo captura lo clínico; al guardarla aparece UN panel de cobro ya relleno con la consulta.
  const [consultaGuardadaId, setConsultaGuardadaId] = useState(null)
  const [mostrarPanelCobro, setMostrarPanelCobro] = useState(false)
  const [cobroEstado, setCobroEstado] = useState(null) // null | 'terminada' | 'cobrado'
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

  // Mantiene en sincronía el campo legado consultas.producto_id (lo lee Reportes "Conversión a venta") cuando la venta se registra DESPUÉS de guardar la ficha.
  const sincronizarProductoConsulta = async (factura) => {
    const linea = factura.lineas?.find((l) => l.tipo === "producto")
    if (!linea || !consultaGuardadaId) return
    const montoVenta = linea.cantidad * linea.precioUnitario
    if (supabase) await supabase.from("consultas").update({ producto_id: linea.productoId, producto_nombre: linea.descripcion, monto_venta: montoVenta }).eq("id", consultaGuardadaId)
    setHistorialConsultas((prev) => prev.map((c) => (c.id === consultaGuardadaId ? { ...c, productoId: linea.productoId, productoNombre: linea.descripcion, montoVenta } : c)))
  }

  // La cita pasa a "Atendida" al terminar la atención: el hecho clínico (atendida) se separa del comercial (vendido o descartado, que sigue el pase a venta).
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

  // «Dejar de atender»: la cita vuelve a «En espera» (mismo día) o queda «No efectuada» (día pasado), lo decide el servidor, y el borrador de la ficha se CONSERVA para retomarla.
  const alDejarDeAtender = async (mensaje) => {
    await guardarBorradorYa()
    registrarLog(usuario, "consultas", "Dejó de atender a un paciente", pacienteSeleccionado)
    onCambiosSinGuardarChange?.(false)
    onAviso?.(mensaje)
    setMostrarDejarDeAtender(false)
    ;(onCerrar || onVolver)?.()
  }

  // --- Imágenes adjuntas (opcional) — se suben a Storage recién al confirmar guardado, no antes, para no dejar archivos huérfanos. ---
  const [archivosImagenes, setArchivosImagenes] = useState([])
  const agregarArchivosImagenes = (lista) => {
    const nuevos = Array.from(lista).filter((f2) => f2.type.startsWith("image/"))
    setArchivosImagenes((prev) => [...prev, ...nuevos].slice(0, 6))
  }
  const quitarArchivoImagen = (idx) => setArchivosImagenes((prev) => prev.filter((_, i) => i !== idx))
  const previsualizacionesImagenes = useMemo(() => archivosImagenes.map((a) => URL.createObjectURL(a)), [archivosImagenes])
  useEffect(() => () => previsualizacionesImagenes.forEach((url) => URL.revokeObjectURL(url)), [previsualizacionesImagenes])

  const [notificacion, setNotificacion] = useState(false)
  // Lo obligatorio que falta solo se marca después de intentar terminar la atención; lo que se escribe mal (rangos, cilindro positivo) se marca al instante.
  const [intento, setIntento] = useState(false)
  const [fichaGuardada, setFichaGuardada] = useState(false)
  const [mostrarConfirmarGuardar, setMostrarConfirmarGuardar] = useState(false)
  const [guardandoFicha, setGuardandoFicha] = useState(false)
  const [errorConfirmarFicha, setErrorConfirmarFicha] = useState("")

  // ── Aviso de cambios sin guardar: "dirty tracking" con pausa al montar y tras cada reinicio (la precarga inicial también cambia campos). ──
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
  }, [f, archivosImagenes])
  useEffect(() => {
    const alCerrar = (e) => {
      if (!hayCambiosSinGuardar) return
      e.preventDefault()
      e.returnValue = ""
    }
    window.addEventListener("beforeunload", alCerrar)
    return () => window.removeEventListener("beforeunload", alCerrar)
  }, [hayCambiosSinGuardar])
  useEffect(() => { onCambiosSinGuardarChange?.(hayCambiosSinGuardar) }, [hayCambiosSinGuardar, onCambiosSinGuardarChange])

  // Scroll automático al inicio del formulario al cambiar de paso
  const inicioFormRef = useRef(null)
  useEffect(() => { inicioFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }) }, [paso])

  const [mostrarHistorial, setMostrarHistorial] = useState(false)
  // Una visita anterior abierta en solo lectura (desde las últimas visitas del panel o desde el historial).
  const [visitaAbierta, setVisitaAbierta] = useState(null)
  const [mostrarHoja, setMostrarHoja] = useState(false)
  const [avisoPrimeraVisita, setAvisoPrimeraVisita] = useState(false)
  const historialPaciente = useMemo(() => {
    if (!pacienteId) return []
    return historialConsultas.filter((c) => c.pacienteId === pacienteId).sort(ordenarPorFechaYCreacion)
  }, [historialConsultas, pacienteId])

  const ultimaConsultaPaciente = useMemo(() => {
    if (!pacienteId && !pacienteSeleccionado) return null
    return historialConsultas.find((c) => (pacienteId && c.pacienteId === pacienteId) || c.paciente === pacienteSeleccionado)
  }, [pacienteId, pacienteSeleccionado, historialConsultas])

  // --- Cálculo Clínico de Evolución (Equivalente Esférico) con la refracción FINAL de hoy ---
  const refraccionHoy = useMemo(() => ({ od: { esfera: f.odEsfera, cilindro: f.odCilindro }, oi: { esfera: f.oiEsfera, cilindro: f.oiCilindro } }), [f.odEsfera, f.odCilindro, f.oiEsfera, f.oiCilindro])
  const calcularEvolucionIA = useMemo(() => {
    if (!ultimaConsultaPaciente) return "Primera consulta"
    const c = cambioEntre(refraccionHoy, ultimaConsultaPaciente)
    return c ? c.verdicto : "Sin evaluación"
  }, [refraccionHoy, ultimaConsultaPaciente])
  const estadoCorreccionActual = useMemo(() => estadoCorreccionDeForm(f), [f])
  const analisisEvolucion = useMemo(() => {
    if (!ultimaConsultaPaciente) return { primera: true, variacion: null }
    const cambio = cambioEntre(refraccionHoy, ultimaConsultaPaciente)
    return { primera: false, cambio, fechaPrev: ultimaConsultaPaciente.fecha, verdicto: calcularEvolucionIA }
  }, [refraccionHoy, ultimaConsultaPaciente, calcularEvolucionIA])
  const tendenciaHistorica = useMemo(() => tendenciaEntreConsultas(historialPaciente), [historialPaciente])

  const seleccionarPacienteCombo = (paciente) => {
    setPacienteId(paciente.id)
    setPacienteSeleccionado(paciente.nombre)
    setBusquedaPaciente(paciente.nombre)
    setMostrarDropdown(false)
    // Se recalcula de cero en cada selección: lo del paciente anterior no se arrastra. Los antecedentes se precargan de su última consulta (solo se actualiza lo que cambió).
    const prev = historialConsultas.find((c) => c.pacienteId === paciente.id || c.paciente === paciente.nombre)
    const an = anamnesisDeConsulta(prev)
    const hayHistorial = hayAnamnesisPrevia(an)
    setF((p) => ({ ...p, antMedChips: [], antMedDetalle: "", antFamChips: [], antFamDetalle: "", alergiasChips: [], alergiasDetalle: "", medChips: [], medDetalle: "", usaLentes: "", usaLentesDesde: "", tipoLentes: "", ...(an || {}) }))
    setFechaPrecarga(hayHistorial ? prev.fecha : null)
    setAvisoPrimeraVisita(!prev)
    setTieneHistorialAntecedentes(hayHistorial)
    setAntecedentesAbiertos(false)
    setPaso("anamnesis")
    activarDeteccionCambios()
  }

  // Llega desde "¿Deseas abrir su ficha clínica ahora?" al crear un paciente en Pacientes.jsx, o desde "Atender" en Citas médicas (en ese caso también trae citaIdInicial).
  useEffect(() => {
    if (!pacienteInicial) return
    seleccionarPacienteCombo(pacienteInicial)
    if (citaIdInicial) {
      setCitaEnAtencionId(citaIdInicial)
      // "En Atención" (azul) apenas se abre la consulta, entre por donde entre.
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
        // "Atendido por" (R12, R18): quien abre la ficha de la cita queda registrado solo, si la cita aún no tiene a nadie.
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
    // El motivo ya se eligió al agendar la cita (categoría del catálogo). Si es de antes del catálogo (o ya no está), cae en "Otros" y el texto original pasa al detalle.
    if (motivoInicial) {
      if (motivosConsulta.includes(motivoInicial)) setVarios({ motivo: motivoInicial })
      else setVarios({ motivo: "Otros", detalleConsulta: motivoInicial })
    }
    onPacienteInicialConsumido?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pacienteInicial])

  const resetForm = () => {
    // Pausa la detección de cambios mientras se limpian los campos: el propio reset no cuenta como «cambios sin guardar».
    detectarCambios.current = false
    setF(crearForm(hoyISO()))
    setPacienteId(null)
    setPacienteSeleccionado("")
    setBusquedaPaciente("")
    setFechaPrecarga(null)
    setMostrarPanelCobro(false)
    setCobroEstado(null)
    setCobroTotal(0)
    setConsultaGuardadaId(null)
    setIntento(false)
    setFichaGuardada(false)
    borrarBorradorFicha(ctxBorrador)
    setGuardadoEn(null)
    setPaso("anamnesis")
    setEditandoMotivo(false)
    setTieneHistorialAntecedentes(false)
    setAntecedentesAbiertos(false)
    setMostrarHistorial(false)
    setArchivosImagenes([])
    setHayCambiosSinGuardar(false)
    activarDeteccionCambios()
  }

  // ── Validación ──
  const todosLosErrores = useMemo(() => validarPasos(f), [f])
  const erroresDe = (id) => (intento ? todosLosErrores[id] : SIN_ERRORES[id])
  const pasoPendiente = pasoConErrores(todosLosErrores)
  const estados = useMemo(() => estadoDePasos(f), [f])
  const pacienteInfo = useMemo(() => pacientesLista.find((p) => p.id === pacienteId), [pacientesLista, pacienteId])
  // Falta algo obligatorio, y se dice qué y dónde.
  const mensajeFaltante = (id) => {
    const nombres = Object.keys(todosLosErrores[id] || {})
    if (id === "anamnesis") return "Falta el motivo de la consulta (si es «Otros», descríbelo)."
    if (id === "examen") return "Revisa la refracción final: si registras algo, van los dos ojos (o «Ojo no evaluado» con su motivo), con números válidos y el eje si hay cilindro."
    if (id === "diagnostico" && todosLosErrores.diagnostico.control && !todosLosErrores.diagnostico.diagnostico && !todosLosErrores.diagnostico.diagnosticoDetalle) return todosLosErrores.diagnostico.control
    return nombres.length ? "Selecciona al menos una categoría de diagnóstico (si es «Otro», descríbelo en el detalle)." : ""
  }

  // Valida los tres pasos (obligatorios: el motivo y el diagnóstico) y, si todo está bien, abre el paso de confirmación antes de guardar. Si algo falta, lleva al primer paso que lo necesita.
  const intentarGuardar = (e) => {
    e.preventDefault()
    if (!pacienteId) { setPaso("anamnesis"); setIntento(true); return }
    setIntento(true)
    if (pasoPendiente) { irA(pasoPendiente); return }
    setMostrarConfirmarGuardar(true)
  }

  // Guardado real de la ficha clínica, disparado tras confirmar en el modal
  const confirmarGuardarFicha = async () => {
    setGuardandoFicha(true)
    setErrorConfirmarFicha("")

    const tendenciaGraduacion = calcularEvolucionIA
    const estadoCorreccion = estadoCorreccionActual
    // Toda ficha decide explícitamente el estado clínico del paciente: "De alta" si se marcó la casilla, "Activo" si no.
    const nuevoEstadoClinico = f.tratamientoFinalizado ? "De alta" : "Activo"
    const datos = datosClinicosDesdeForm(f)
    const anam = columnasDeAnamnesis(f)
    const ojoNoEvaluado = { od: f.odNoEval ? f.odMotivoNoEval.trim() : "", oi: f.oiNoEval ? f.oiMotivoNoEval.trim() : "" }
    const controlAgenda = f.tratamientoFinalizado ? null : f.controlModo || null
    const diagnosticoTexto = [f.diagnosticoCategorias.join(", "), f.diagnostico.trim()].filter(Boolean).join(" — ")
    const lenteTexto = f.recomendarLente ? f.lenteRecomendado : ""
    const nuevaFicha = {
      fecha: f.fechaConsulta, pacienteId, citaId: citaEnAtencionId || null, paciente: pacienteSeleccionado,
      motivo: f.motivo, detalleConsulta: f.detalleConsulta,
      usaLentes: anam.usaLentes, antecedentes: anam.antecedentes, alergias: anam.alergias, antecedentesFamiliares: anam.antecedentesFamiliares,
      retinoscopia: datos.retinoscopia, od: datos.od, oi: datos.oi, ojoNoEvaluado, medidas: datos.medidas, examen: datos.examen, ficha: datos.ficha,
      diagnosticoCategorias: f.diagnosticoCategorias,
      // Texto compuesto (categorías + detalle): es lo que muestran el historial y la receta impresa.
      diagnostico: diagnosticoTexto,
      lenteRecomendado: lenteTexto, indicaciones: f.indicaciones, proximoControlDias: f.proximoControlDias, controlAgenda,
      evolucionCalculada: tendenciaGraduacion, estadoCorreccion,
      productoId: null, productoNombre: null, montoVenta: null,
    }
    nuevaFicha.profesionalNombre = usuario?.nombre || null
    nuevaFicha.profesionalRegistro = usuario?.registroProfesional || null

    if (supabase && usuario?.opticaId) {
      // Sube las imágenes recién ahora (confirmado el guardado); un adjunto fallido no bloquea la ficha.
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
          usa_lentes: nuevaFicha.usaLentes,
          antecedentes: nuevaFicha.antecedentes,
          alergias: nuevaFicha.alergias,
          antecedentes_familiares: nuevaFicha.antecedentesFamiliares,
          datos_clinicos: { retinoscopia: datos.retinoscopia, od: datos.od, oi: datos.oi, medidas: datos.medidas, examen: datos.examen, ficha: datos.ficha, ojo_no_evaluado: (ojoNoEvaluado.od || ojoNoEvaluado.oi) ? ojoNoEvaluado : null, control_agenda: controlAgenda, control_asignado_a: controlAgenda ? usuario?.id || null : null },
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
          // Vincula la consulta con la cita que la originó (0079).
          cita_id: citaEnAtencionId || null,
        })
        .select()
        .single()
      if (error) {
        setGuardandoFicha(false)
        setErrorConfirmarFicha(esErrorSinPermiso(error) ? MENSAJE_SIN_PERMISO : "No se pudo guardar la ficha clínica. Revisa tu conexión e intenta de nuevo — nada se imprimió ni se guardó todavía.")
        return
      }
      if (data) {
        nuevaFicha.id = data.id
        // Desempate de historialPaciente cuando hay más de una consulta el mismo día.
        nuevaFicha.creadoEn = data.created_at
        setConsultaGuardadaId(data.id)
      }
      registrarLog(usuario, "consultas", "Registró una ficha clínica", `${nuevaFicha.paciente} · ${fechaLegible(nuevaFicha.fecha)}`)
      const { error: errorPaciente } = await supabase.from("pacientes").update({ evolucion: tendenciaGraduacion, estado_correccion: estadoCorreccion, ultima_consulta: f.fechaConsulta, estado_clinico: nuevoEstadoClinico }).eq("id", pacienteId)
      if (errorPaciente) console.error("La ficha se guardó, pero no se pudo actualizar el resumen del paciente:", errorPaciente.message)
    }

    if (nuevaFicha.id == null) nuevaFicha.id = Date.now()
    setHistorialConsultas([nuevaFicha, ...historialConsultas])

    // "Agendar ahora": la cita del control se crea recién con la ficha guardada. Si no se pudo crear, la ficha ya está a salvo: el control queda como "sin agendar".
    if (f.controlModo === "ahora" && !f.tratamientoFinalizado && f.controlFecha && f.controlHora) {
      const paciente = pacientesLista.find((p) => p.id === pacienteId)
      const motivoControl = motivosConsulta.find((m) => /control/i.test(m)) || "Examen de Control"
      const citaControl = {
        pacienteId, paciente: nuevaFicha.paciente, cedula: paciente?.cedula, telefono: paciente?.telefono,
        fecha: f.controlFecha, hora: f.controlHora, duracionMinutos: null, motivo: motivoControl, asignadoA: usuario?.id || null, atendidoPor: null,
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
      setPacientes(pacientesLista.map((p) => (p.id === pacienteId ? { ...p, evolucion: tendenciaGraduacion, estadoCorreccion, ultimaConsulta: f.fechaConsulta, estadoClinico: nuevoEstadoClinico } : p)))
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
    borrarBorradorFicha(ctxBorrador)
    setGuardadoEn(null)
    setPaso("diagnostico")
    // «Terminar atención»: el documento del diagnóstico se abre al instante para descargarlo, imprimirlo o cerrarlo.
    setMostrarHoja(true)
    // La atención terminó: la receta queda lista y el paciente se pasa a la óptica (o se cobra ahí mismo).
    setCobroEstado("terminada")
    setErrorPase("")
  }

  // La barra de pasos permite ir a cualquiera; «Siguiente» solo sugiere el orden.
  const irA = (destino) => {
    // Si vuelve a un paso de edición, la receta deja de estar "guardada" (hay que volver a terminar la atención).
    if (destino !== "diagnostico") setFichaGuardada(false)
    setPaso(destino)
  }
  const indicePaso = PASOS.findIndex((p) => p.id === paso)

  // La receta impresa es la hoja de la receta (HojaReceta): la misma que ve el paciente al descargarla desde su portal y la que sale de «Imprimir receta» en el perfil.
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
    const base = (pacienteSeleccionado + f.fechaConsulta) || "receta"
    let h = 0
    for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) >>> 0
    return "RX-" + (f.fechaConsulta || "").replace(/-/g, "") + "-" + h.toString(36).toUpperCase().slice(0, 4)
  }, [pacienteSeleccionado, f.fechaConsulta])
  // UNA sola receta para la vista previa, la hoja y la impresión: siempre los valores finales del formulario (ya transpuestos si se transpuso).
  const recetaActual = useMemo(() => recetaDesdeForm(f, { id: consultaGuardadaId || recetaNum.split("-").pop().toLowerCase(), profesionalNombre: usuario?.nombre, profesionalRegistro: usuario?.registroProfesional }), [f, consultaGuardadaId, recetaNum, usuario?.nombre, usuario?.registroProfesional])
  // El documento del diagnóstico: la misma hoja que se imprime desde el perfil («Imprimir diagnóstico»), con la receta incluida cuando hubo refracción.
  const consultaDoc = useMemo(() => consultaDesdeForm(f, { id: consultaGuardadaId || recetaNum.split("-").pop().toLowerCase(), profesionalNombre: usuario?.nombre, profesionalRegistro: usuario?.registroProfesional }), [f, consultaGuardadaId, recetaNum, usuario?.nombre, usuario?.registroProfesional])
  const datosDeLaHoja = () => ({
    optica: datosOpticaReceta(usuario, parametrizacion),
    paciente: { nombre: pacienteSeleccionado, cedula: pacienteInfo?.cedula, edad: edadPaciente },
    receta: consultaDoc,
    completo: true,
  })
  const imprimirReceta = () => imprimirHojaReceta(datosDeLaHoja())
  const [descargandoPdf, setDescargandoPdf] = useState(false)
  const descargarPdf = async () => {
    setDescargandoPdf(true)
    const ok = await descargarHojaReceta(datosDeLaHoja())
    setDescargandoPdf(false)
    onAviso?.(ok ? "Diagnóstico descargado en PDF." : "No se pudo descargar el PDF. Usa «Imprimir» y elige «Guardar como PDF».")
  }

  // Barra de la visita: cita de origen, alergias (rojo si hay) y última graduación.
  const citaDeLaVisita = useMemo(() => citas.find((c) => c.id === citaEnAtencionId) || null, [citas, citaEnAtencionId])
  const textoAnt = useMemo(() => componerTexto(f.antMedChips, f.antMedDetalle), [f.antMedChips, f.antMedDetalle])
  const textoFam = useMemo(() => componerTexto(f.antFamChips, f.antFamDetalle), [f.antFamChips, f.antFamDetalle])
  const textoAlergias = useMemo(() => componerTexto(f.alergiasChips, f.alergiasDetalle), [f.alergiasChips, f.alergiasDetalle])
  const antecedentesAlerta = useMemo(() => antecedentesRelevantes({ antecedentes: textoAnt, antecedentesFamiliares: textoFam }), [textoAnt, textoFam])
  const alergiaSignificativa = Boolean(textoAlergias.trim()) && !/^(ning|no\b|sin\b|n\/a|na$|-+$|—)/i.test(textoAlergias.trim())
  const ultimaGraduacion = useMemo(() => {
    const u = ultimaConsultaPaciente
    if (!u) return null
    const od = textoOjoCompleto(u.od)
    const oi = textoOjoCompleto(u.oi)
    if (!od && !oi) return null
    return { fecha: u.fecha, od: od || "No registrada", oi: oi || "No registrada", adicion: u.medidas?.adicionOd || u.medidas?.adicion || "" }
  }, [ultimaConsultaPaciente])
  const fechaCorta = (iso) => (iso ? fechaLegible(iso) : "")

  // Fecha recomendada del control = día de la consulta + el plazo elegido. Si ese día no hay atención, se propone el día hábil más cercano (solo se propone).
  const fechaControlRecomendada = useMemo(() => sumarDiasISO(f.fechaConsulta, f.proximoControlDias), [f.fechaConsulta, f.proximoControlDias])
  const diaControlSugerido = useMemo(() => {
    if (f.controlModo !== "ahora") return null
    if (diaTieneCupo(fechaControlRecomendada, disponibilidad, citas)) return fechaControlRecomendada
    return diaHabilMasCercano(fechaControlRecomendada, disponibilidad, citas)
  }, [f.controlModo, fechaControlRecomendada, disponibilidad, citas])
  const textoDia = (iso) => formatoFecha(iso, "largo")

  // ─── Guardado automático del borrador (borradorFicha.js) ───
  // Mientras se escribe, la ficha se guarda sola como borrador en la base de datos (cifrado como las fichas, por paciente y cita): se recupera desde cualquier computadora y la cita reagendada lo hereda.
  const instantanea = JSON.stringify(f)
  useEffect(() => {
    if (!clave || fichaGuardada || !hayCambiosSinGuardar) return undefined
    const t = setTimeout(() => { guardarBorradorFicha(ctxBorrador, JSON.parse(instantanea)).then((ms) => { if (ms) setGuardadoEn(ms) }) }, 1200)
    return () => clearTimeout(t)
  }, [clave, ctxBorrador, instantanea, hayCambiosSinGuardar, fichaGuardada])
  // Antes de cerrar la sesión por inactividad (o al avisarla) y al dejar de atender, el borrador se guarda al instante, sin esperar la pausa.
  const ultimoEstadoRef = useRef(null)
  ultimoEstadoRef.current = { ctx: ctxBorrador, instantanea, guardar: !!clave && !fichaGuardada && hayCambiosSinGuardar }
  const guardarBorradorYa = () => {
    const u = ultimoEstadoRef.current
    if (!u?.guardar) return Promise.resolve(null)
    return guardarBorradorFicha(u.ctx, JSON.parse(u.instantanea)).then((ms) => { if (ms) setGuardadoEn(ms); return ms })
  }
  useEffect(() => {
    const alGuardar = () => { guardarBorradorYa() }
    window.addEventListener(EVENTO_GUARDAR_BORRADOR, alGuardar)
    return () => window.removeEventListener(EVENTO_GUARDAR_BORRADOR, alGuardar)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const claveRevisadaRef = useRef(null)
  const clavesRevisadas = useRef(new Set())
  claveRevisadaRef.current = clave
  useEffect(() => {
    if (!clave || fichaGuardada || clavesRevisadas.current.has(clave)) return
    clavesRevisadas.current.add(clave)
    leerBorradorFicha(ctxBorrador).then((b) => {
      if (claveRevisadaRef.current !== clave) return
      setBorradorPendiente(b ? { ...b, ctx: ctxBorrador } : null)
      setGuardadoEn(null)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave, fichaGuardada])
  useEffect(() => {
    if (!guardadoEn) return undefined
    const i = setInterval(() => setAhoraTexto(Date.now()), 5000)
    return () => clearInterval(i)
  }, [guardadoEn])
  const recuperarBorrador = () => {
    if (!borradorPendiente) return
    detectarCambios.current = false
    // Solo los campos que esta ficha conoce: un borrador de una ficha anterior trae otros nombres y se ignora.
    setF((p) => ({ ...p, ...Object.fromEntries(Object.entries(borradorPendiente.datos).filter(([k]) => CLAVES_FORM.includes(k))) }))
    setGuardadoEn(borradorPendiente.guardadoEn)
    setBorradorPendiente(null)
    setHayCambiosSinGuardar(true)
    setTimeout(() => { detectarCambios.current = true }, 400)
    onAviso?.("Recuperaste la ficha que tenías a medias.")
  }
  const descartarBorrador = () => { if (borradorPendiente?.ctx) borrarBorradorFicha(borradorPendiente.ctx); setBorradorPendiente(null) }

  const errDiag = erroresDe("diagnostico")
  // Diagnóstico sugerido con la refracción final y la adición (receta ya normalizada): el optómetra lo confirma con un clic.
  const sugerencia = useMemo(() => sugerirDiagnostico(recetaActual, diagnosticosRapidos), [recetaActual, diagnosticosRapidos])
  const sugerenciaParaUsar = sugerencia ? [...sugerencia.categorias, ...(sugerencia.presbiciaCategoria ? [sugerencia.presbiciaCategoria] : [])] : []
  const bannerPaso = intento && pasoPendiente && pasoPendiente === paso ? mensajeFaltante(paso) : ""
  const otrosPasosPendientes = intento ? PASOS.filter((p) => p.id !== paso && Object.keys(todosLosErrores[p.id] || {}).length > 0) : []

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

      {/* ─── VOLVER / CERRAR ─── "Volver" reabre lo que había antes (el perfil del paciente, si se entró desde ahí); "Cerrar" siempre sale a la lista de origen. */}
      {(onVolver || onCerrar) && (
        <div className="no-print -mt-2 flex items-center justify-between">
          <button type="button" onClick={onVolver || onCerrar} className="flex items-center gap-2 rounded-lg py-1.5 pl-1.5 pr-3 text-sm font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 cursor-pointer">
            <ArrowLeft size={18} /> {origenNombre}
          </button>
          <div className="flex items-center gap-1">
            {citaEnAtencionId && !fichaGuardada && (
              <button type="button" onClick={() => setMostrarDejarDeAtender(true)} title="Salir de la ficha: el borrador se conserva y la cita vuelve a «En espera»"
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 transition-colors hover:bg-red-50 hover:text-red-700 cursor-pointer">
                <LogOut size={14} aria-hidden="true" /> Dejar de atender
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sin encabezado grande: la fila del paciente y la barra de pasos bastan. El título queda solo para lectores de pantalla. */}
      <h1 className="sr-only">Ficha clínica</h1>

      {borradorPendiente && !fichaGuardada && (
        <div role="status" className="no-print flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-slate-800">
          <History size={18} className="shrink-0 text-blue-600" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm"><span className="font-semibold">Hay una ficha a medias de este paciente</span> · {textoGuardado(borradorPendiente.guardadoEn).replace("Guardado", "guardada")}. ¿La recuperas?</p>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={recuperarBorrador} className="rounded-lg px-4 py-2 text-sm font-semibold text-white cursor-pointer" style={{ background: GRAD }}>Recuperar</button>
            <button type="button" onClick={descartarBorrador} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer">Empezar de cero</button>
          </div>
        </div>
      )}

      {notificacion && (
        <div role="status" className="no-print flex items-center gap-3 rounded-xl border border-emerald-200/60 bg-emerald-50 p-4 text-emerald-900 shadow-sm">
          <CheckCircle className="shrink-0 text-emerald-600" size={20} />
          <div>
            <p className="text-sm font-semibold">Ficha clínica guardada con éxito.</p>
            <p className="text-xs text-emerald-700">La evolución del paciente se ha actualizado en el sistema.</p>
          </div>
        </div>
      )}

      <div className="w-full">
        {/* ─── BARRA DE LA VISITA ─── paciente, cita de origen y fecha de la consulta (editable). Opaca, fija al hacer scroll. */}
        {pacienteId && pacienteSeleccionado && (
          <div className="no-print sticky top-0 z-10 mb-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white" style={{ background: GRAD }}><User size={15} /></span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold" style={{ color: INK }}>{pacienteSeleccionado}{edadPaciente != null ? ` · ${edadPaciente} años` : ""}</p>
                  <p className="text-xs text-slate-500">
                    {citaDeLaVisita ? `Cita ${citaDeLaVisita.hora} · ${citaDeLaVisita.motivo || "Consulta"} · ${citaDeLaVisita.fecha === hoyISO() ? "Hoy" : `agendada ${fechaCorta(citaDeLaVisita.fecha)} · atención hoy`}` : "Sin cita · consulta directa"}
                    {f.motivo && !citaDeLaVisita ? ` · ${f.motivo}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {!fichaGuardada && guardadoEn != null && <span role="status" className="hidden text-xs text-slate-400 sm:inline">{textoGuardado(guardadoEn, ahoraTexto)}</span>}
                <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  <Calendar size={13} aria-hidden="true" /> Fecha de la consulta
                  <span className="w-40"><CampoFecha id="consulta-fecha" etiqueta="Fecha de la consulta" valor={f.fechaConsulta} onCambiar={(v) => set("fechaConsulta", v)} min={sumarDiasISO(hoyISO(), -365 * 3)} max={hoyISO()} /></span>
                </label>
              </div>
            </div>
          </div>
        )}

        <div className="no-print mb-3"><BarraPasos paso={paso} estados={estados} onIr={irA} /></div>

        <div className={"grid gap-4 " + (pacienteId ? (paso === "diagnostico" ? "lg:grid-cols-[minmax(0,1fr)_23rem]" : "lg:grid-cols-[minmax(0,1fr)_16rem]") : "")}>
          <form onSubmit={intentarGuardar} onKeyDown={(e) => { if (e.key === "Enter" && e.target.tagName === "INPUT") e.preventDefault() }} className="no-print min-w-0 space-y-3">
            <div ref={inicioFormRef} style={{ scrollMarginTop: 140 }} />
            {bannerPaso && (
              <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-200/60 bg-red-50 p-3.5 text-red-700">
                <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
                <div>
                  <p className="text-sm font-bold">Falta completar este paso</p>
                  <p className="text-xs text-red-600">{bannerPaso}</p>
                </div>
              </div>
            )}
            {otrosPasosPendientes.length > 0 && (
              <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                También falta algo en: {otrosPasosPendientes.map((p, i) => <span key={p.id}>{i > 0 && ", "}<button type="button" onClick={() => irA(p.id)} className="font-semibold underline cursor-pointer">{p.label}</button></span>)}.
              </p>
            )}

            {paso === "anamnesis" && (
              <PasoAnamnesis f={f} set={set} errores={erroresDe("anamnesis")} motivosConsulta={motivosConsulta} conCita={Boolean(citaEnAtencionId)} editandoMotivo={editandoMotivo} setEditandoMotivo={setEditandoMotivo}
                tieneHistorial={tieneHistorialAntecedentes} fechaPrecarga={fechaPrecarga} antecedentesAbiertos={antecedentesAbiertos} setAntecedentesAbiertos={setAntecedentesAbiertos}
                buscador={!pacienteId ? (
                  <div className="relative rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm" ref={dropdownRef}>
                    <label htmlFor="paciente" className="mb-1.5 block text-sm font-semibold text-slate-700">Paciente <span className="text-red-500">*</span></label>
                    <div className="relative max-w-md">
                      <User size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input id="paciente" type="text" placeholder="Escribe para filtrar paciente..." value={busquedaPaciente} onFocus={() => setMostrarDropdown(true)}
                        onChange={(e) => { setBusquedaPaciente(e.target.value); setPacienteId(null); setPacienteSeleccionado(""); setMostrarDropdown(true) }}
                        className={CLASE_INPUT + "w-full py-2.5 pl-9 pr-8 " + (intento ? "border-red-400 ring-2 ring-red-100" : "border-slate-300")} />
                      <Search size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    </div>
                    {mostrarDropdown && pacientesFiltrados.length > 0 && (
                      <ul className="absolute z-50 mt-1 max-h-48 w-full max-w-md overflow-y-auto rounded-xl border border-slate-200/60 bg-white shadow-lg">
                        {pacientesFiltrados.map((p) => (
                          <li key={p.id || p.nombre} onClick={() => seleccionarPacienteCombo(p)} className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700">
                            <span className="font-semibold">{p.nombre}</span>{p.cedula && <span className="font-mono text-xs text-slate-500">ID: {p.cedula}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                    {mostrarDropdown && busquedaPaciente.trim() && pacientesFiltrados.length === 0 && (
                      <div className="absolute z-50 mt-1 w-full max-w-md rounded-xl border border-slate-200/60 bg-white p-3 text-xs text-slate-500 shadow-lg">Ningún paciente registrado coincide. Créalo primero en el módulo Pacientes — aquí no se puede escribir un nombre nuevo.</div>
                    )}
                    {intento && !pacienteId && <p role="alert" className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600"><AlertCircle size={13} /> {busquedaPaciente.trim() ? "Ese nombre no coincide con ningún paciente registrado. Selecciónalo de la lista." : "Selecciona un paciente registrado de la lista."}</p>}
                  </div>
                ) : null} />
            )}

            {paso === "examen" && (
              <PasoExamen f={f} set={set} setVarios={setVarios} errores={erroresDe("examen")} edad={edadPaciente} manejaProgresion={manejaProgresion} ultimaConsulta={ultimaConsultaPaciente}
                analisis={analisisEvolucion && !analisisEvolucion.primera && analisisEvolucion.cambio ? (() => {
                  const t = TENDENCIA[analisisEvolucion.verdicto] || TENDENCIA["Sin cambios"]
                  const IconoT = t.icon
                  return <p className="flex items-center gap-1.5 text-xs text-slate-500"><IconoT size={13} style={{ color: t.fg }} aria-hidden="true" /> Cambio de la esfera frente al {fechaLegible(analisisEvolucion.fechaPrev)}: <span className="font-semibold" style={{ color: t.fg }}>{lineaDeCambio(analisisEvolucion.cambio, { siglas: true })}</span></p>
                })() : null} />
            )}

            {paso === "diagnostico" && (
              <div className="space-y-3">
                <div className="no-print flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold" style={{ color: INK }}>Diagnóstico y receta</h3>
                    {fichaGuardada
                      ? <p className="flex items-center gap-1 text-xs font-medium text-emerald-600"><CheckCircle size={12} /> Ficha guardada · lista para imprimir</p>
                      : <p className="text-xs text-slate-500">Guarda la ficha clínica para habilitar la impresión.</p>}
                  </div>
                  <button type="button" onClick={() => setMostrarHoja(true)} disabled={!fichaGuardada} title={fichaGuardada ? "Descargar el PDF o imprimir el diagnóstico" : "Primero termina la atención"}
                    className={"flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-colors " + (fichaGuardada ? "text-white cursor-pointer" : "cursor-not-allowed text-slate-400")}
                    style={fichaGuardada ? { background: GRAD, boxShadow: "0 12px 24px -12px rgba(37,99,235,0.6)" } : { backgroundColor: "#e2e8f0" }}>
                    <Printer size={15} /> Imprimir diagnóstico
                  </button>
                </div>

                {!usuario?.registroProfesional && !fichaGuardada && (
                  <p role="note" className="no-print rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">Tu registro profesional no está anotado: la receta saldrá sin él. Pídele al administrador que lo complete en Usuarios.</p>
                )}
                <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
                  <h3 className="mb-2 flex items-center gap-2 text-sm font-bold" style={{ color: INK }}><Stethoscope size={16} className="text-blue-600" aria-hidden="true" /> Diagnóstico <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">Obligatorio</span></h3>
                  {fichaGuardada ? (
                    <p className="text-base font-bold" style={{ color: INK }}>{f.diagnosticoCategorias.join(", ")}{f.diagnostico.trim() ? ` — ${f.diagnostico.trim()}` : ""}</p>
                  ) : (
                    <>
                      {sugerencia && (sugerencia.categorias.length > 0 || sugerencia.presbicia) && (
                        <div role="status" aria-label="Diagnóstico sugerido" className="mb-3 rounded-xl border border-blue-200 bg-blue-50/70 px-3 py-2 text-sm">
                          <p className="text-xs font-semibold text-blue-800">Sugerido según la refracción ({sugerencia.motivo.toLowerCase()})</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            {sugerencia.categorias.map((c) => <span key={c} className="rounded-full border border-blue-300 bg-white px-2.5 py-0.5 text-xs font-bold text-blue-700">{c}</span>)}
                            {sugerencia.presbicia && <span className="text-xs text-slate-700">Tiene adición{sugerencia.presbiciaCategoria ? <>: ¿<span className="font-bold">{sugerencia.presbiciaCategoria}</span>?</> : " (posible presbicia)"}</span>}
                            {(sugerenciaParaUsar.length > 0 && !sugerenciaParaUsar.every((c) => f.diagnosticoCategorias.includes(c))) && <button type="button" onClick={() => set("diagnosticoCategorias", [...new Set([...f.diagnosticoCategorias, ...sugerenciaParaUsar])])} className="rounded-lg bg-blue-600 px-2.5 py-1 text-xs font-semibold text-white cursor-pointer">Usar la sugerencia</button>}
                          </div>
                          <p className="mt-1 text-xs text-slate-500">Tú lo confirmas o lo cambias: no se marca solo.</p>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-1.5">
                        {/* Las categorías son las del catálogo que configura la óptica; "Otro" siempre disponible como salida. */}
                        {[...diagnosticosRapidos, ...(diagnosticosRapidos.includes("Otro") ? [] : ["Otro"])].map((cat) => {
                          const activo = f.diagnosticoCategorias.includes(cat)
                          return (
                            <button key={cat} type="button" aria-pressed={activo} onClick={() => set("diagnosticoCategorias", activo ? f.diagnosticoCategorias.filter((c) => c !== cat) : [...f.diagnosticoCategorias, cat])}
                              className="rounded-full border px-3 py-1.5 text-xs font-bold transition-colors cursor-pointer"
                              style={activo ? { backgroundColor: "#2563eb", borderColor: "#2563eb", color: "#fff" } : { borderColor: "#e2e8f0", color: "#475569", backgroundColor: "#fff" }}>{cat}</button>
                          )
                        })}
                      </div>
                      {errDiag.diagnostico && <p role="alert" className="no-print mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600"><AlertCircle size={13} /> {errDiag.diagnostico}</p>}
                      <label htmlFor="diagnostico" className="mb-1 mt-3 block text-xs font-semibold text-slate-500">{f.diagnosticoCategorias.includes("Otro") ? "Detalle del diagnóstico personalizado" : "Detalle (opcional)"}</label>
                      {f.diagnosticoCategorias.includes("Otro")
                        ? <textarea id="diagnostico" rows={3} placeholder="Detalle del diagnóstico personalizado..." value={f.diagnostico} onChange={(e) => set("diagnostico", e.target.value)} className={CLASE_INPUT + "w-full max-w-xl resize-y " + (errDiag.diagnosticoDetalle ? "border-red-400 ring-2 ring-red-100" : "border-slate-300")} />
                        : <input id="diagnostico" type="text" placeholder="Ej. Se determina progresión leve, control en 6 meses" value={f.diagnostico} onChange={(e) => set("diagnostico", e.target.value)} className={CLASE_INPUT + "w-full max-w-xl border-slate-300"} />}
                      {errDiag.diagnosticoDetalle && <p role="alert" className="no-print mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600"><AlertCircle size={13} /> {errDiag.diagnosticoDetalle}</p>}
                    </>
                  )}
                </section>

                {/* No todo diagnóstico recomienda un lente: sin la casilla, ni el campo ni la búsqueda aparecen. */}
                <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
                  {!fichaGuardada && (
                    <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-slate-700">
                      <input type="checkbox" checked={f.recomendarLente} onChange={(e) => { set("recomendarLente", e.target.checked); if (!e.target.checked) set("lenteRecomendado", "") }} className="h-4 w-4 cursor-pointer rounded border-slate-300 text-blue-600" />
                      <Glasses size={16} className="text-blue-600" /> Añadir recomendación de lente
                    </label>
                  )}
                  {f.recomendarLente && (f.lenteRecomendado || !fichaGuardada) && (
                    <div className="print-force-color mt-3 flex max-w-xl items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/70 p-3">
                      <Glasses size={18} className="mt-0.5 shrink-0 text-blue-600" />
                      <div className="flex-1 space-y-1">
                        <label htmlFor="lenteRecomendado" className="block text-xs font-bold uppercase tracking-[0.14em] text-blue-800">Lente a recomendar</label>
                        <input id="lenteRecomendado" type="text" placeholder="Ej. Monofocal con antirreflejo y filtro luz azul" value={f.lenteRecomendado} readOnly={fichaGuardada} onChange={(e) => set("lenteRecomendado", e.target.value)} className="w-full bg-transparent text-sm font-semibold outline-none focus-visible:underline" style={{ color: INK }} />
                        <p className="no-print text-xs text-slate-500">Solo el texto de la receta: la luna se elige y se cobra al vender, sin inventario.</p>
                      </div>
                    </div>
                  )}
                  {(f.indicaciones || !fichaGuardada) && (
                    <div className="mt-3 max-w-xl">
                      <label htmlFor="indicaciones" className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-slate-500"><ClipboardList size={12} aria-hidden="true" /> Indicaciones y cuidados</label>
                      <textarea id="indicaciones" rows={2} placeholder="Ej. Uso permanente de lentes con filtro antirreflejo y luz azul." value={f.indicaciones} readOnly={fichaGuardada} onChange={(e) => set("indicaciones", e.target.value)} className={CLASE_INPUT + "w-full resize-y border-slate-300"} />
                    </div>
                  )}
                </section>

                {/* Atención terminada (R33-R34): la receta está lista; el paciente se pasa a la óptica (queda "Listo para venta") o se cobra ahí mismo. */}
                {fichaGuardada && cobroEstado === "terminada" && (
                  <div role="status" className="no-print space-y-2.5 rounded-lg border border-emerald-200/60 bg-emerald-50 p-3.5">
                    <p className="flex items-center gap-1.5 text-sm font-bold text-emerald-900"><CheckCircle size={16} className="shrink-0 text-emerald-600" /> Atención terminada{citaEnAtencionId ? " · la cita quedó atendida" : ""}. La receta está lista.</p>
                    {paseDeEstaConsulta
                      ? <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800"><ShoppingBag size={14} className="shrink-0" /> Listo para venta: quien venda verá a este paciente en su lista.</p>
                      : <p className="text-xs text-emerald-800">Si el paciente va a comprar, pásalo a la óptica o cóbralo ahora.</p>}
                    {errorPase && <p role="alert" className="text-xs font-medium text-red-700">{errorPase}</p>}
                    <div className="flex flex-wrap items-center gap-2">
                      {!paseDeEstaConsulta && (
                        <button type="button" onClick={pasarAOptica} disabled={pasandoAOptica || !consultaGuardadaId} className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold text-white transition hover:brightness-110 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60" style={{ background: GRAD }}>
                          <ShoppingBag size={14} /> {pasandoAOptica ? "Pasando…" : "Pasar a la óptica"}
                        </button>
                      )}
                      <button type="button" onClick={() => setMostrarPanelCobro(true)} className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-white px-3.5 py-2 text-xs font-bold text-emerald-800 transition-colors hover:bg-emerald-100 cursor-pointer"><Receipt size={14} /> Cobrar ahora</button>
                      {(onVolver || onCerrar) && <button type="button" onClick={onVolver || onCerrar} className="rounded-lg border border-slate-200/60 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">Volver a {origenNombre}</button>}
                    </div>
                  </div>
                )}
                {fichaGuardada && cobroEstado === "cobrado" && (
                  <div role="status" className="no-print flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-200/60 bg-emerald-50 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800"><CheckCircle size={14} className="shrink-0" /> Cobrado {dinero(cobroTotal)}{citaEnAtencionId ? " · cita atendida" : ""}. Ya puedes imprimir la receta.</p>
                    {(onVolver || onCerrar) && <button type="button" onClick={onVolver || onCerrar} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-700 cursor-pointer">Volver a {origenNombre}</button>}
                  </div>
                )}

                {!fichaGuardada && (
                  <div className="no-print rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-3">
                    <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.14em] text-slate-500"><ImageIcon size={12} /> Adjuntar imágenes <span className="font-normal normal-case">(opcional — hasta 6)</span></p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {archivosImagenes.map((a, i) => (
                        <div key={i} className="relative h-14 w-14 overflow-hidden rounded-lg border border-slate-200/60">
                          <img src={previsualizacionesImagenes[i]} alt={a.name} className="h-full w-full object-cover" />
                          <button type="button" onClick={() => quitarArchivoImagen(i)} aria-label="Quitar imagen" className="absolute right-0.5 top-0.5 grid h-4 w-4 place-items-center rounded-full bg-black/60 text-white cursor-pointer"><X size={10} /></button>
                        </div>
                      ))}
                      {archivosImagenes.length < 6 && (
                        <label className="grid h-14 w-14 cursor-pointer place-items-center rounded-lg border border-dashed border-slate-300 text-slate-400 transition-colors hover:border-blue-300 hover:text-blue-500">
                          <ImageIcon size={18} />
                          <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={(e) => { agregarArchivosImagenes(e.target.files); e.target.value = "" }} />
                        </label>
                      )}
                    </div>
                  </div>
                )}

                {/* Si se da de alta al paciente, ya no tiene sentido pedir un próximo control: se oculta el selector y se explica por qué. */}
                <label className="no-print flex cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200/60 bg-white px-4 py-3">
                  <input type="checkbox" checked={f.tratamientoFinalizado} disabled={fichaGuardada} onChange={(e) => set("tratamientoFinalizado", e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-blue-600 disabled:cursor-not-allowed" />
                  <span>
                    <span className="block text-sm font-semibold" style={{ color: INK }}>Tratamiento finalizado</span>
                    <span className="block text-xs text-slate-500">El paciente ya no necesita más controles — queda marcado como "De alta".</span>
                  </span>
                </label>

                <div className="print-force-color flex items-center gap-3 rounded-xl border border-slate-200/60 bg-white px-4 py-3">
                  <CalendarClock size={18} className="no-print shrink-0 text-blue-600" />
                  <div className="flex-1">
                    <label htmlFor="proximoControl" className="block text-xs font-bold uppercase tracking-wide text-slate-500">Próximo control recomendado</label>
                    <p className="no-print text-xs text-slate-500">{f.tratamientoFinalizado ? "No aplica — el tratamiento quedó finalizado." : "Define cuándo el CRM debe avisar si el paciente no ha vuelto."}</p>
                  </div>
                  {!f.tratamientoFinalizado && (
                    <select id="proximoControl" value={f.proximoControlDias} disabled={fichaGuardada} onChange={(e) => setVarios({ proximoControlDias: Number(e.target.value), controlFecha: "", controlHora: "" })}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus-visible:border-blue-500 disabled:bg-slate-100 disabled:text-slate-400">
                      <option value={30}>1 mes</option><option value={90}>3 meses</option><option value={180}>6 meses</option><option value={365}>1 año</option>
                    </select>
                  )}
                </div>

                {!f.tratamientoFinalizado && (
                  <fieldset disabled={fichaGuardada} className="no-print rounded-xl border border-slate-200/60 bg-white p-4">
                    <legend className="px-1 text-sm font-bold" style={{ color: INK }}>¿Cuándo se agenda ese control?</legend>
                    <p className="mb-3 text-xs text-slate-500">El paciente tiene que aceptar la fecha y la hora, así que la cita solo se crea si eliges "Agendar ahora" y al guardar la ficha.</p>
                    <div role="radiogroup" aria-label="Cuándo se agenda el control" className="grid gap-2 sm:grid-cols-2">
                      {[["ahora", "Agendar ahora", "Elige fecha y hora con los horarios libres."], ["despues", "Agendar después", "No se crea la cita: queda como aviso para Recepción y el administrador."]].map(([valor, titulo, ayuda]) => (
                        <label key={valor} className={"flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-colors " + (f.controlModo === valor ? "border-blue-300 bg-blue-50/50" : "border-slate-200/60 bg-slate-50 hover:border-blue-200") + (fichaGuardada ? " cursor-not-allowed opacity-70" : "")}>
                          <input type="radio" name="control-agenda" value={valor} checked={f.controlModo === valor} onChange={() => set("controlModo", valor)} className="mt-0.5 h-4 w-4 accent-blue-600" />
                          <span className="min-w-0 text-sm"><span className="block font-semibold text-slate-700">{titulo}</span><span className="block text-xs leading-relaxed text-slate-500">{ayuda}</span></span>
                        </label>
                      ))}
                    </div>
                    {f.controlModo === "ahora" && (
                      <div className="mt-3 space-y-3">
                        {diaControlSugerido ? (
                          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
                            <span>Fecha recomendada: <span className="font-semibold">{textoDia(fechaControlRecomendada)}</span>{diaControlSugerido !== fechaControlRecomendada && <> · ese día no hay atención; el día hábil más cercano es el <span className="font-semibold">{textoDia(diaControlSugerido)}</span></>}</span>
                            <button type="button" onClick={() => setVarios({ controlFecha: diaControlSugerido, controlHora: "" })} className="rounded-full border border-blue-200 bg-white px-2.5 py-1 text-xs font-bold text-blue-700 transition-colors hover:bg-blue-50 cursor-pointer">Elegir {diaControlSugerido === fechaControlRecomendada ? "esa fecha" : "ese día"}</button>
                          </div>
                        ) : <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">No hay un día con cupo cerca de la fecha recomendada ({textoDia(fechaControlRecomendada)}). Elige otro en el calendario.</p>}
                        <SelectorFechaHora disponibilidad={disponibilidad} citas={citas} fecha={f.controlFecha} hora={f.controlHora} onCambiarFecha={(v) => set("controlFecha", v)} onCambiarHora={(v) => set("controlHora", v)} mesesAdelante={14} mesInicial={diaControlSugerido || fechaControlRecomendada} />
                      </div>
                    )}
                    {errDiag.control && <p role="alert" className="mt-3 text-sm font-semibold text-red-600">{errDiag.control}</p>}
                  </fieldset>
                )}
              </div>
            )}

            {/* Navegación: «Siguiente» solo sugiere el orden; la barra de arriba deja ir a cualquier paso. */}
            <div className="no-print mt-2 flex items-center justify-between rounded-2xl border border-slate-200/70 bg-white px-4 py-3 shadow-sm">
              <span className="text-sm font-medium text-slate-500">Paso {indicePaso + 1} de {PASOS.length}</span>
              <div className="flex gap-2">
                {indicePaso > 0 && (
                  <button type="button" onClick={() => irA(PASOS[indicePaso - 1].id)} className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer"><ArrowLeft size={15} /> Anterior</button>
                )}
                {paso !== "diagnostico" ? (
                  <button key="btn-siguiente" type="button" onClick={() => irA(PASOS[indicePaso + 1].id)} className="flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-semibold text-white transition-colors hover:brightness-125 cursor-pointer" style={{ backgroundColor: INK }}>Siguiente <ArrowRight size={15} /></button>
                ) : !fichaGuardada ? (
                  // key distinta del botón "Siguiente" a propósito: sin ella React reutiliza el nodo y un clic en "Siguiente" disparaba un submit fantasma (bug del ing, 29 sept.).
                  <button key="btn-guardar" type="submit" className="flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer" style={{ background: GRAD, boxShadow: "0 12px 24px -12px rgba(37,99,235,0.6)" }}><Save size={15} /> Terminar atención</button>
                ) : (
                  <button key="btn-nueva-consulta" type="button" onClick={resetForm} className="flex items-center gap-1.5 rounded-lg px-5 py-2 text-sm font-semibold text-white transition-colors hover:brightness-125 cursor-pointer" style={{ backgroundColor: INK }}><ClipboardList size={15} /> Nueva consulta</button>
                )}
              </div>
            </div>
          </form>

          {pacienteId && (
            <div className="no-print min-w-0">
              <PanelContexto paso={paso} paciente={pacienteInfo || { nombre: pacienteSeleccionado }} edad={edadPaciente} alergiaSignificativa={alergiaSignificativa} alergias={textoAlergias}
                antecedentesAlerta={antecedentesAlerta.length ? textoAntecedentes(antecedentesAlerta) : ""} ultimaGraduacion={ultimaGraduacion}
                visitas={historialPaciente.slice(0, 3)} totalVisitas={historialPaciente.length} onAbrirVisita={setVisitaAbierta} onVerHistorial={() => setMostrarHistorial(true)}
                tendencia={tendenciaHistorica ? (() => { const t = TENDENCIA[tendenciaHistorica.verdicto] || TENDENCIA["Sin cambios"]; const IconoT = t.icon; return <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><IconoT size={12} style={{ color: t.fg }} aria-hidden="true" /> Entre sus dos últimas consultas: <span className="font-semibold" style={{ color: t.fg }}>{lineaDeCambio(tendenciaHistorica.cambio, { siglas: true })}</span></p> })() : null}
                hoja={paso === "diagnostico" ? <HojaReceta {...datosDeLaHoja()} /> : null} onVerHoja={() => setMostrarHoja(true)} />
            </div>
          )}
        </div>
      </div>

      {mostrarDejarDeAtender && (
        <ConfirmarDejarDeAtender cita={citaDeLaVisita || { id: citaEnAtencionId, paciente: pacienteSeleccionado || "este paciente", fecha: hoyISO(), hora: "" }} setCitas={setCitas} onCancelar={() => setMostrarDejarDeAtender(false)} onHecho={alDejarDeAtender} />
      )}


      {mostrarConfirmarGuardar && (
        <ConfirmarFichaModal paciente={pacienteSeleccionado} diagnostico={[f.diagnosticoCategorias.join(", "), f.diagnostico.trim()].filter(Boolean).join(" — ")} lenteRecomendado={f.recomendarLente ? f.lenteRecomendado : ""} usaLentes={f.usaLentes}
          onCancelar={() => { setMostrarConfirmarGuardar(false); setErrorConfirmarFicha("") }} onConfirmar={confirmarGuardarFicha} guardando={guardandoFicha} error={errorConfirmarFicha} />
      )}

      {mostrarHistorial && (
        <Cascaron titulo="Historial clínico" subtitulo={pacienteSeleccionado} Icono={History} ancho="max-w-2xl" onCerrar={() => setMostrarHistorial(false)}
          pie={<><span /><button type="button" onClick={() => setMostrarHistorial(false)} className="rounded-lg border border-slate-200/60 px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">Cerrar</button></>}>
          <div className="space-y-3 p-5">
            {historialPaciente.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <div className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-300"><History size={22} /></div>
                <p className="text-sm font-medium text-slate-500">Este paciente aún no tiene consultas registradas.</p>
              </div>
            ) : historialPaciente.map((c) => <TarjetaVisita key={c.id} consulta={c} onAbrir={() => setVisitaAbierta(c)} />)}
          </div>
        </Cascaron>
      )}

      {/* Una visita anterior en solo lectura (las fichas guardadas antes de la de cinco pasos se ven con lo que tienen). */}
      {visitaAbierta && (
        <Cascaron titulo={"Ficha del " + (fechaLegible(visitaAbierta.fecha) || "—")} subtitulo={[visitaAbierta.motivo, visitaAbierta.profesionalNombre].filter(Boolean).join(" · ")} Icono={History} ancho="max-w-3xl" capa="z-[60]" onCerrar={() => setVisitaAbierta(null)}
          pie={<><span /><button type="button" onClick={() => setVisitaAbierta(null)} className="rounded-lg border border-slate-200/60 px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">Cerrar</button></>}>
          <DetalleAtencion consulta={visitaAbierta} />
        </Cascaron>
      )}

      {/* La hoja de la receta tal como sale impresa: los mismos valores de la vista previa. */}
      {mostrarHoja && (
        <Cascaron titulo={fichaGuardada ? "Atención terminada" : "Vista previa del diagnóstico"} subtitulo={fichaGuardada ? "El diagnóstico y la receta de " + pacienteSeleccionado + ". Si no lo descargas ahora, lo encuentras en «Imprimir diagnóstico»." : "Así saldrá el documento"} Icono={Printer} ancho="max-w-4xl" capa="z-[60]" onCerrar={() => setMostrarHoja(false)}
          pie={<><span /><div className="flex flex-wrap items-center gap-2">
            {fichaGuardada && <button type="button" onClick={descargarPdf} disabled={descargandoPdf} className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold text-white transition hover:brightness-110 cursor-pointer disabled:cursor-wait disabled:opacity-60" style={{ background: GRAD }}><Download size={15} aria-hidden="true" /> {descargandoPdf ? "Descargando…" : "Descargar PDF"}</button>}
            {fichaGuardada && <button type="button" onClick={imprimirReceta} className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer"><Printer size={15} aria-hidden="true" /> Imprimir</button>}
            <button type="button" onClick={() => setMostrarHoja(false)} className="rounded-lg border border-slate-200/60 px-3.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">Cerrar</button>
          </div></>}>
          <div className="overflow-x-auto bg-slate-100/70 p-4"><div className="rounded-xl border border-slate-200/60 bg-white shadow-sm"><HojaReceta {...datosDeLaHoja()} /></div></div>
        </Cascaron>
      )}

      {/* ─── AVISO: PRIMERA CONSULTA DEL PACIENTE ─── */}
      {avisoPrimeraVisita && (
        <Cascaron titulo={"Primera consulta de " + pacienteSeleccionado} subtitulo="No hay historial previo para este paciente." Icono={Sparkles} ancho="max-w-md" onCerrar={() => setAvisoPrimeraVisita(false)}
          pie={<><span /><button type="button" onClick={() => { setAvisoPrimeraVisita(false); setTimeout(() => document.getElementById("antMedDetalle")?.focus(), 50) }} className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer" style={{ background: GRAD }}>Entendido, completar antecedentes</button></>}>
          <p className="p-6 text-sm text-slate-600">Completa antecedentes, alergias y antecedentes familiares antes de continuar con el examen.</p>
        </Cascaron>
      )}

      {/* ─── PANEL DE COBRO (Ronda 4): aparece al guardar la ficha ─── */}
      {mostrarPanelCobro && pacienteInfo && (
        <ComprobanteVentaModal usuario={usuario} inventario={inventario} setInventario={setInventario} pacienteFijo={pacienteInfo} titulo={`Cobrar la atención de ${pacienteInfo.nombre}`} subtitulo={`Consulta${f.motivo ? ` · ${f.motivo}` : ""}`}
          etiquetaGuardar="Cobrar y finalizar" lineasIniciales={lineasCobroConsulta({ motivo: f.motivo, lenteRecomendado: f.recomendarLente ? f.lenteRecomendado : "" }, parametrizacion)}
          consultaId={consultaGuardadaId} citaId={citaEnAtencionId} onGuardado={alCobrar} onMasTarde={() => setMostrarPanelCobro(false)} onCerrar={() => setMostrarPanelCobro(false)} />
      )}
    </div>
  )
}

/* ---------- Subcomponentes ---------- */

// Tarjeta de una visita del historial; pulsable para ver esa ficha en solo lectura.
function TarjetaVisita({ consulta: c, onAbrir }) {
  const ojo = (o) => textoOjoCompleto(o) || "No registrada"
  return (
    <button type="button" onClick={onAbrir} className="block w-full rounded-xl border border-slate-200/60 bg-slate-50/60 p-4 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/40 cursor-pointer">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-bold" style={{ color: INK }}>{c.fecha}</span>
        <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-slate-600 shadow-sm">{c.motivo || "Consulta general"}</span>
      </div>
      {c.detalleConsulta && <p className="mt-1 text-xs italic text-slate-500">"{c.detalleConsulta}"</p>}
      <p className="mt-1.5 text-sm text-slate-700">{c.diagnostico || "Sin diagnóstico registrado"}</p>
      <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-xs text-slate-500">
        <span>OD: {ojo(c.od)} · AV {agudezaConLentes(c.od) || "—"}</span>
        <span>OI: {ojo(c.oi)} · AV {agudezaConLentes(c.oi) || "—"}</span>
      </div>
      {c.lenteRecomendado && <p className="mt-1.5 text-xs text-slate-500">Lente recomendado: <span className="font-semibold text-slate-600">{c.lenteRecomendado}</span></p>}
    </button>
  )
}
