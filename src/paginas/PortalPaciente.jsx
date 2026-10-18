"use client"

import { ahoraEcuador } from "../utilidades/horaEcuador"
import { formatoFecha } from "../utilidades/formatoFecha"
import React, { useState, useMemo, useEffect, useRef } from "react"
import { Home, CalendarDays, Glasses, ReceiptText, UserRound, CheckCircle2, AlertCircle, LogOut, Stethoscope, CalendarClock, KeyRound, Lock, X, Bell, ChevronRight } from "lucide-react"
import SelectorFechaHora from "../componentes/SelectorFechaHora"
import SelectorLista from "../componentes/SelectorLista"
import ConfirmarCitaModal from "../componentes/ConfirmarCitaModal"
import { ordenarPorFechaYCreacion } from "../utilidades/fidelizacion"
import { minutosHastaCita } from "../utilidades/agendaCitas"
import { Cascaron } from "../componentes/AtencionPaciente"
import MisCompras from "../componentes/MisCompras"
import ResumenPortal from "../componentes/portal/ResumenPortal"
import MisCitasPortal from "../componentes/portal/MisCitasPortal"
import MiRecetaPortal from "../componentes/portal/MiRecetaPortal"
import MisDatosPortal from "../componentes/portal/MisDatosPortal"
import { usePortalDatos } from "../componentes/portal/usePortalDatos"
import { useConsulta } from "../componentes/portal/useAncho"
import { IconoLentes } from "../componentes/portal/piezas"
import { BOTON_PRINCIPAL, BOTON_SECUNDARIO, ESTILO_PRINCIPAL } from "../componentes/portal/estilos"
import { numeroComprobante } from "../utilidades/comprobantes"
import { identidadDeLaOptica, citasProximas, citasHistorial, ordenesAbiertasDelPaciente, proximoControlDelPaciente, saldoDelPaciente, contactoDeLaOptica, tieneContacto, resumenCambioGraduacion } from "../utilidades/portalPaciente"
import { avisosDelPaciente, descargarIcs } from "../utilidades/portalVistas"
import { supabase } from "../lib/supabaseClient"
import { validarClaveNueva } from "../utilidades/validaciones"
import { esErrorHoraInvalida, MENSAJE_HORA_INVALIDA } from "../utilidades/erroresCitas"

const OPCIONES = [
  { id: "resumen", nombre: "Inicio", corto: "Inicio", icono: Home },
  { id: "citas", nombre: "Mis citas", corto: "Citas", icono: CalendarDays },
  { id: "receta", nombre: "Mi receta", corto: "Receta", icono: IconoLentes },
  { id: "compras", nombre: "Mis compras", corto: "Compras", icono: ReceiptText },
  { id: "datos", nombre: "Mis datos", corto: "Mis datos", icono: UserRound },
]

// Portal del paciente (portal v2, 17 oct. 2026). Pensado para pacientes de una óptica —muchos mayores, casi todos desde el celular—: texto de 16 px o más,
// botones de 48 px, una tarea por pantalla y lenguaje sencillo. En laptop y tablet ancha, menú lateral claro como el del personal; en celular y tablet,
// una barra de navegación abajo (más cómoda al pulgar que un menú escondido). Lo que el paciente hace queda en el sistema del personal (Citas, Inicio, CRM).
export default function PortalPaciente({ usuario, citas = [], setCitas, consultas = [], disponibilidad, opticaId, opticaPublica, parametrizacion, motivosConsulta = [], cargandoDatos = false, onCerrarSesion, alActualizarUsuario }) {
  const nombreOptica = opticaPublica?.marca?.nombreMarca || opticaPublica?.nombre || "tu óptica"
  const identidad = identidadDeLaOptica(opticaPublica)
  const logoUrl = identidad.logoUrl
  // El color de la óptica llega a todo el portal por variables de CSS (el menú, los botones principales y la tarjeta destacada).
  const estiloRaiz = { "--portal-acento": identidad.acento, "--portal-texto-boton": identidad.textoBoton }
  // Las ventanas (Cascaron) se dibujan fuera de esta raíz, en el body: las variables también van en el documento mientras el portal está abierto.
  useEffect(() => {
    const raiz = document.documentElement
    Object.entries(estiloRaiz).forEach(([k, v]) => raiz.style.setProperty(k, v))
    return () => Object.keys(estiloRaiz).forEach((k) => raiz.style.removeProperty(k))
  }, [identidad.acento, identidad.textoBoton]) // eslint-disable-line react-hooks/exhaustive-deps
  // Política de la óptica (configurable en Configuración > Políticas hacia el paciente)
  const mostrarMedidas = parametrizacion?.mostrarMedidasPaciente === true
  const [seccion, setSeccion] = useState("resumen")
  const pacienteId = typeof usuario?.id === "string" ? usuario.id : null

  // Aviso que confirma lo que acaba de hacer el paciente (agendar, cambiar, cancelar): se queda a la vista hasta que lo cierra o pasan 8 segundos.
  const [aviso, setAviso] = useState("")
  const avisar = (texto) => { setAviso(texto); setTimeout(() => setAviso((a) => (a === texto ? "" : a)), 8000) }

  // Agendar
  const [modalAgendar, setModalAgendar] = useState(false)
  const [fecha, setFecha] = useState("")
  const [hora, setHora] = useState("")
  const [motivo, setMotivo] = useState(motivosConsulta[0] || "")
  const [error, setError] = useState("")
  const [confirmandoCita, setConfirmandoCita] = useState(false)
  const [guardandoCita, setGuardandoCita] = useState(false)
  const [errorCita, setErrorCita] = useState("")
  // «Agendar mi control» abre la misma ventana con el motivo de control ya elegido.
  const [compraRelacionada, setCompraRelacionada] = useState("")
  const abrirAgendar = (para) => {
    const control = motivosConsulta.find((m) => /control/i.test(m))
    const garantia = motivosConsulta.find((m) => /garant/i.test(m))
    setCompraRelacionada("")
    setMotivo(para === "control" && control ? control : para === "garantia" && garantia ? garantia : motivosConsulta[0] || "")
    setFecha(""); setHora(""); setError(""); setErrorCita("")
    setModalAgendar(true)
  }

  // Reagendar — solo si el admin lo habilitó en Configuración, y solo dentro de la ventana de anticipación que él mismo define.
  const [reagendando, setReagendando] = useState(null)
  const [fechaReagenda, setFechaReagenda] = useState(null)
  const [horaReagenda, setHoraReagenda] = useState("")
  const [guardandoReagenda, setGuardandoReagenda] = useState(false)
  const [errorReagenda, setErrorReagenda] = useState("")

  // `citas` acá solo trae las citas DE ESTE paciente (mis_citas_paciente): el calendario de agendar/reagendar necesita saber qué horarios ya están
  // ocupados por CUALQUIERA. horas_ocupadas_publicas() expone solo fecha/hora (sin datos de otros pacientes) para calcular la disponibilidad real.
  const [horasOcupadas, setHorasOcupadas] = useState([])
  const refrescarHorasOcupadas = () => {
    if (!supabase || !opticaId) return
    supabase.rpc("horas_ocupadas_publicas", { p_optica_id: opticaId }).then(({ data }) => { if (data) setHorasOcupadas(data) })
  }
  useEffect(() => { refrescarHorasOcupadas() }, [opticaId]) // eslint-disable-line react-hooks/exhaustive-deps

  const horasAntesPermitidas = parametrizacion?.horasAntesReagendar ?? 2
  // Una cita se puede cambiar o cancelar si la óptica lo permite, sigue pendiente y faltan al menos N horas (hora de Ecuador).
  const puedeReagendar = (cita) => {
    if (!parametrizacion?.permitirReagendarPaciente) return false
    if (cita.estado !== "Pendiente") return false
    return minutosHastaCita(cita) >= horasAntesPermitidas * 60
  }
  // Si la política lo permite pero ya no hay tiempo, se dice por qué en vez de esconder los botones sin explicación.
  const textoNoReagendable = (cita) => {
    if (!parametrizacion?.permitirReagendarPaciente || cita.estado !== "Pendiente") return null
    if (minutosHastaCita(cita) >= horasAntesPermitidas * 60) return null
    return `Faltan menos de ${horasAntesPermitidas} hora${horasAntesPermitidas === 1 ? "" : "s"}: para cambiarla, comunícate con la óptica.`
  }
  const abrirReagendar = (cita) => { setReagendando(cita); setFechaReagenda(null); setHoraReagenda(""); setErrorReagenda("") }

  // Cancelar — misma ventana de anticipación y permiso que reagendar.
  const [cancelando, setCancelando] = useState(null)
  const [guardandoCancelar, setGuardandoCancelar] = useState(false)
  const [errorCancelar, setErrorCancelar] = useState("")
  // Cuando el servidor rechaza una regla (anticipación, política de la óptica, horario), su mensaje ya está escrito para el paciente.
  const mensajeDelServidor = (err) => (err?.code === "P0001" ? err.message : null)
  const confirmarCancelar = async () => {
    if (!cancelando) return
    setGuardandoCancelar(true)
    setErrorCancelar("")
    if (supabase && opticaId) {
      const { data, error: errorRpc } = await supabase.rpc("cancelar_cita_publica", { p_cita_id: cancelando.id, p_paciente_id: pacienteId, p_token: usuario?.token })
      if (errorRpc || data !== true) {
        setGuardandoCancelar(false)
        setErrorCancelar(mensajeDelServidor(errorRpc) || "No pudimos cancelar tu cita. Intenta de nuevo en un momento.")
        return
      }
    }
    setCitas(citas.map((c) => (c.id === cancelando.id ? { ...c, estado: "Cancelada" } : c)))
    refrescarHorasOcupadas()
    setGuardandoCancelar(false)
    avisar(`Cancelaste tu cita del ${formatoFecha(cancelando.fecha, "medio")} a las ${cancelando.hora}.`)
    setCancelando(null)
  }

  const confirmarReagenda = async () => {
    if (!fechaReagenda || !horaReagenda) { setErrorReagenda("Selecciona fecha y hora."); return }
    setGuardandoReagenda(true)
    setErrorReagenda("")
    if (supabase && opticaId) {
      const { data, error: errorRpc } = await supabase.rpc("reagendar_cita_publica", { p_cita_id: reagendando.id, p_paciente_id: pacienteId, p_fecha: fechaReagenda, p_hora: horaReagenda, p_token: usuario?.token })
      if (errorRpc || data !== true) {
        setGuardandoReagenda(false)
        const delServidor = mensajeDelServidor(errorRpc)
        if (delServidor && !delServidor.includes("ya no está disponible")) {
          setErrorReagenda(delServidor)
          setHoraReagenda("")
        } else if (errorRpc?.message?.includes("horario")) {
          setErrorReagenda("Ese horario ya no está disponible — alguien más lo acaba de reservar. Elige otro.")
          refrescarHorasOcupadas()
          setHoraReagenda("")
        } else if (esErrorHoraInvalida(errorRpc)) {
          setErrorReagenda(MENSAJE_HORA_INVALIDA + " Elige otra hora.")
          setHoraReagenda("")
        } else {
          setErrorReagenda("No pudimos reagendar tu cita. Intenta de nuevo en un momento.")
        }
        return
      }
    }
    setCitas(citas.map((c) => (c.id === reagendando.id ? { ...c, fecha: fechaReagenda, hora: horaReagenda, estado: "Pendiente" } : c)))
    refrescarHorasOcupadas()
    setGuardandoReagenda(false)
    avisar(`Listo: tu cita quedó para el ${formatoFecha(fechaReagenda, "medio")} a las ${horaReagenda}.`)
    setReagendando(null)
  }

  // Contraseña
  const [modalClave, setModalClave] = useState(false)
  const [claveActual, setClaveActual] = useState("")
  const [nuevaClave, setNuevaClave] = useState("")
  const [confirmarClave, setConfirmarClave] = useState("")
  const [errorClave, setErrorClave] = useState("")
  const [guardandoClave, setGuardandoClave] = useState(false)
  const abrirClave = () => { setClaveActual(""); setNuevaClave(""); setConfirmarClave(""); setErrorClave(""); setModalClave(true) }

  // Recetas del paciente
  const misConsultas = useMemo(
    () => consultas.filter((c) => (usuario?.id != null && c.pacienteId === usuario.id) || c.paciente === usuario?.nombre).sort(ordenarPorFechaYCreacion),
    [consultas, usuario],
  )
  const ultimaReceta = misConsultas[0] || null
  // Pedir las medidas completas llama de verdad a solicitar_medidas_paciente (migración 0080): el perfil del paciente y la campana de la óptica lo avisan.
  const [medidasSolicitadas, setMedidasSolicitadas] = useState(false)
  const [errorMedidas, setErrorMedidas] = useState("")
  const [enviandoMedidas, setEnviandoMedidas] = useState(false)
  const solicitarMedidasCompletas = async () => {
    setErrorMedidas("")
    setEnviandoMedidas(true)
    if (supabase) {
      const { data, error: errorRpc } = await supabase.rpc("solicitar_medidas_paciente", { p_paciente_id: pacienteId, p_token: usuario?.token })
      setEnviandoMedidas(false)
      if (errorRpc || data !== true) { setErrorMedidas("No pudimos enviar tu solicitud. Intenta de nuevo en un momento."); return }
    } else {
      setEnviandoMedidas(false)
    }
    setMedidasSolicitadas(true)
  }

  const misCitas = useMemo(() => {
    if (!usuario?.id && !usuario?.cedula) return citas
    return citas.filter((c) => c.pacienteId === usuario.id || c.cedula === usuario.cedula || c.paciente === usuario.nombre)
  }, [citas, usuario])
  const datos = usePortalDatos(usuario, misCitas)
  const proximas = useMemo(() => citasProximas(misCitas), [misCitas])
  const historial = useMemo(() => citasHistorial(misCitas), [misCitas])
  const proximaCita = proximas[0] || null
  const comprasConSaldo = datos.compras.filter((c) => c.estado === "pendiente_pago" && Number(c.saldo) > 0)
  const saldo = saldoDelPaciente(datos.compras)
  const saldoInfo = saldo > 0 ? { saldo, total: comprasConSaldo.reduce((s, c) => s + Number(c.total), 0), abonado: comprasConSaldo.reduce((s, c) => s + Number(c.abonado), 0) } : null
  const control = useMemo(() => proximoControlDelPaciente(datos.control), [datos.control])
  const contacto = contactoDeLaOptica({ parametrizacion, disponibilidad, nombre: nombreOptica, paciente: usuario?.nombre })
  const esNuevo = misCitas.length === 0 && misConsultas.length === 0 && datos.compras.length === 0 && datos.ordenes.length === 0
  const [recetaAbierta, setRecetaAbierta] = useState(null)
  const verReceta = (id) => { setSeccion("receta"); setRecetaAbierta(id) }
  // «Solicitar ajuste o garantía»: abre «Agendar cita» con el motivo ya elegido y dice de qué compra viene (la más reciente).
  const pedirGarantia = (compra) => { abrirAgendar("garantia"); const c = compra || datos.compras[0]; setCompraRelacionada(c ? numeroComprobante(c.numero) : "") }
  // La fecha del «Pedido» es la de la compra a la que pertenece la orden.
  const ordenesConPedido = datos.ordenes.map((o) => { const compra = datos.compras.find((c) => c.id === o.facturaId); return { ...o, pedidoEl: compra?.fecha || o.creadaEn, comprobante: compra ? numeroComprobante(compra.numero) : "" } })
  const avisos = avisosDelPaciente({ ordenes: datos.ordenes, proximaCita, control })
  const [campana, setCampana] = useState(false)
  const campanaRef = useRef(null)
  useEffect(() => {
    const fuera = (e) => { if (campanaRef.current && !campanaRef.current.contains(e.target)) setCampana(false) }
    document.addEventListener("mousedown", fuera)
    return () => document.removeEventListener("mousedown", fuera)
  }, [])

  const validarYPedirConfirmacion = (e) => {
    e.preventDefault()
    if (!motivo) { setError("Elige el motivo de tu cita."); return }
    if (!fecha || !hora) { setError("Por favor selecciona fecha y hora."); return }
    setError("")
    setConfirmandoCita(true)
  }

  const handleAgendar = async () => {
    const nuevaCita = { pacienteId: usuario?.id, paciente: usuario?.nombre || "Paciente Registrado", cedula: usuario?.cedula || "", telefono: usuario?.telefono || "", fecha, hora, motivo, estado: "Pendiente" }
    setErrorCita("")
    setGuardandoCita(true)
    if (supabase && opticaId) {
      // crear_cita_publica devuelve una tabla (id, codigo) desde la migración 0058 y, desde la 0067, resuelve o crea al paciente por cédula y exige la
      // fecha de nacimiento: la cita entra al sistema del personal con origen «Web» y enlazada a este mismo paciente.
      const { data, error: errorRpc } = await supabase.rpc("crear_cita_publica", {
        p_optica_id: opticaId, p_paciente: nuevaCita.paciente, p_fecha: nuevaCita.fecha, p_hora: nuevaCita.hora, p_cedula: nuevaCita.cedula || null,
        p_fecha_nacimiento: usuario?.fecha_nacimiento || usuario?.fechaNacimiento || null, p_telefono: nuevaCita.telefono || null, p_motivo: nuevaCita.motivo,
      })
      if (errorRpc || !data?.[0]) {
        setGuardandoCita(false)
        if (errorRpc?.message?.includes("horario")) {
          setErrorCita("Ese horario ya no está disponible — alguien más lo acaba de reservar. Elige otro.")
          refrescarHorasOcupadas()
          setHora("")
        } else if (esErrorHoraInvalida(errorRpc)) {
          setErrorCita(MENSAJE_HORA_INVALIDA + " Elige otra hora.")
          setHora("")
        } else if (errorRpc?.message?.includes("cédula") || errorRpc?.message?.includes("nacimiento")) {
          setErrorCita("Tu perfil no tiene cédula o fecha de nacimiento registrada — pide en recepción que actualicen tu ficha antes de agendar online.")
        } else {
          setErrorCita("No pudimos guardar tu cita. Intenta de nuevo en un momento.")
        }
        return
      }
      nuevaCita.id = data[0].id
      nuevaCita.codigo = data[0].codigo
    } else {
      nuevaCita.id = Date.now()
    }
    setCitas([nuevaCita, ...citas])
    refrescarHorasOcupadas()
    setGuardandoCita(false)
    setConfirmandoCita(false)
    setModalAgendar(false); setFecha(""); setHora(""); setError("")
    setSeccion("citas")
    avisar(`Tu cita quedó agendada para el ${formatoFecha(nuevaCita.fecha, "medio")} a las ${nuevaCita.hora}. ¡Te esperamos!${parametrizacion?.permitirReagendarPaciente ? ` Puedes cambiarla o cancelarla hasta con ${horasAntesPermitidas} hora${horasAntesPermitidas === 1 ? "" : "s"} de anticipación, desde «Mis citas».` : ""}`)
  }

  const handleCambiarClave = async (e) => {
    e.preventDefault()
    if (!claveActual) { setErrorClave("Ingresa tu contraseña actual."); return }
    const errorClaveSegura = validarClaveNueva(nuevaClave)
    if (errorClaveSegura) { setErrorClave(errorClaveSegura); return }
    if (nuevaClave === usuario?.cedula) { setErrorClave("La nueva contraseña no puede ser tu número de cédula."); return }
    if (nuevaClave !== confirmarClave) { setErrorClave("Las contraseñas no coinciden."); return }
    // El RPC exige y verifica la contraseña actual en el servidor (crypt()) antes de aceptar la nueva, y repite ahí la política de contraseña.
    setGuardandoClave(true)
    if (supabase) {
      const { data: mensajeError, error: errorRpc } = await supabase.rpc("cambiar_clave_paciente", { p_paciente_id: usuario?.id, p_clave_actual: claveActual, p_clave_nueva: nuevaClave })
      if (errorRpc || mensajeError) {
        setGuardandoClave(false)
        setErrorClave(mensajeError || "No pudimos guardar tu nueva contraseña. Intenta de nuevo en un momento.")
        return
      }
    }
    // El RPC invalida el token de sesión actual al cambiar la clave (fuerza a volver a entrar en todos los dispositivos): se cierra la sesión ya mismo.
    setGuardandoClave(false)
    setModalClave(false); setClaveActual(""); setNuevaClave(""); setConfirmarClave(""); setErrorClave("")
    onCerrarSesion("Contraseña actualizada. Vuelve a iniciar sesión con tu nueva contraseña.")
  }

  const navegar = (id) => { setSeccion(id); setCampana(false) }
  const primerNombre = usuario?.nombre?.split(" ")[0] || "Paciente"
  const hora24 = ahoraEcuador().getHours()
  const saludo = hora24 < 12 ? "Buenos días" : hora24 < 19 ? "Buenas tardes" : "Buenas noches"
  const hoyFecha = formatoFecha(ahoraEcuador(), "largo")
  const alIcs = (cita) => descargarIcs({ cita, optica: nombreOptica, direccion: contacto.direccion })
  const citaProps = { puedeReagendar, avisoNoReagendable: textoNoReagendable, onReagendar: abrirReagendar, onCancelar: setCancelando }
  const cargandoPortal = cargandoDatos || datos.cargando
  const cambioGraduacion = resumenCambioGraduacion(misConsultas)
  const recetaActualId = misConsultas[0]?.id ?? null
  const primeraRecetaId = misConsultas.length > 1 ? misConsultas[misConsultas.length - 1].id : null
  // Con 1024 px o más el portal lleva el menú a la izquierda; con menos (tablet y celular), una barra de navegación abajo. Se dibuja una sola versión.
  const laptop = useConsulta("(min-width: 1024px)", true)
  const nombreMostrado = opticaPublica?.nombre || "Mi Óptica"
  const marca = () => (
    <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl lg:h-9 lg:w-9 lg:rounded-[10px]" style={{ background: logoUrl ? "#fff" : "var(--portal-acento)", color: logoUrl ? undefined : identidad.textoBoton, boxShadow: logoUrl ? "inset 0 0 0 1px rgb(226 232 240)" : undefined }}>
      {logoUrl ? <img src={logoUrl} alt="" className="h-full w-full object-contain p-1" /> : <Glasses size={22} aria-hidden="true" />}
    </div>
  )
  // La campanita de avisos: un punto naranja si hay algo nuevo (el número exacto lo lee quien usa lector de pantalla).
  const campanita = (
    <div className="relative" ref={campanaRef}>
      <button type="button" onClick={() => setCampana((v) => !v)} aria-haspopup="menu" aria-expanded={campana} aria-label={avisos.length ? `Avisos: tienes ${avisos.length}` : "Avisos: no tienes avisos nuevos"} className="relative grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-pt-borde bg-white text-pt-marino transition-colors hover:bg-slate-50 cursor-pointer">
        <Bell size={24} aria-hidden="true" />
        {avisos.length > 0 && <span aria-hidden="true" className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-[#B45309] ring-2 ring-white" />}
      </button>
      {campana && (
        <div role="menu" aria-label="Avisos" className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-pt-borde bg-white shadow-2xl">
          <p className="border-b border-pt-borde px-4 py-3 font-heading text-lg font-bold text-pt-marino">Tus avisos</p>
          {avisos.length === 0 ? <p className="px-4 py-5 text-lg text-pt-texto">No tienes avisos por ahora.</p> : (
            <ul className="p-2">{avisos.map((a) => (
              <li key={a.id}><button type="button" role="menuitem" onClick={() => navegar(a.va)} className="flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-lg font-semibold text-slate-800 transition-colors hover:bg-pt-fondo cursor-pointer"><span className="min-w-0 flex-1">{a.texto}</span><ChevronRight size={20} className="shrink-0 text-slate-400" aria-hidden="true" /></button></li>
            ))}</ul>
          )}
        </div>
      )}
    </div>
  )

  return (
    <div style={estiloRaiz} className="flex h-[100dvh] overflow-hidden bg-pt-fondo font-sans text-pt-marino">
      {/* ─── MENÚ LATERAL (laptop): la marca de la óptica y las cinco pantallas ─── */}
      {laptop && (
        <aside className="flex w-[232px] shrink-0 flex-col border-r border-pt-borde bg-white">
          <div className="flex min-w-0 items-start gap-2.5 px-[18px] pb-6 pt-6">
            {marca()}
            <div className="min-w-0 leading-tight">
              <p className="font-heading text-base font-bold leading-snug text-pt-marino">{nombreMostrado}</p>
              <p className="mt-0.5 whitespace-nowrap text-base tracking-tight text-pt-texto">Tu portal de paciente</p>
            </div>
          </div>
          <nav aria-label="Menú del portal" className="min-h-0 flex-1 space-y-1 overflow-y-auto px-4">
            {OPCIONES.map((o) => {
              const Icono = o.icono
              const activo = seccion === o.id
              return (
                <button key={o.id} type="button" onClick={() => navegar(o.id)} aria-current={activo ? "page" : undefined}
                  className={"flex h-12 w-full items-center gap-3.5 rounded-xl px-3.5 text-base transition-colors cursor-pointer " + (activo ? "bg-pt-suave font-semibold text-pt-azul" : "font-medium text-slate-700 hover:bg-slate-50 hover:text-pt-marino")}>
                  <Icono size={22} aria-hidden="true" />
                  <span>{o.nombre}</span>
                </button>
              )
            })}
          </nav>
          {onCerrarSesion && (
            <div className="p-4">
              <button type="button" onClick={() => onCerrarSesion()} className="flex min-h-12 w-full items-center gap-3.5 rounded-xl px-3.5 py-3 text-base font-medium text-slate-700 transition-colors hover:bg-slate-50 cursor-pointer"><LogOut size={22} aria-hidden="true" /> Cerrar sesión</button>
            </div>
          )}
        </aside>
      )}

      {/* ─── CONTENIDO ─── */}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Celular y tablet: una barra arriba con la marca, el saludo y los avisos */}
        {!laptop && (
          <header className="relative z-30 flex shrink-0 items-center gap-3 border-b border-pt-borde bg-white px-4 py-3">
            {marca()}
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate font-heading text-lg font-bold text-pt-marino">Hola, {primerNombre}</p>
              <p className="truncate text-base text-pt-texto">{nombreMostrado}</p>
            </div>
            {campanita}
          </header>
        )}

        <div data-portal-scroll className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-4 pb-28 pt-4 sm:px-8 lg:px-10 lg:pb-12 lg:pt-7">
          <div className="pt-zona mx-auto max-w-[1160px]">
            {/* Laptop, solo en Inicio: el saludo con la fecha, la campanita y la cuenta */}
            {laptop && seccion === "resumen" && (
              <div className="mb-6 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-heading text-[28px] font-bold leading-tight tracking-tight text-pt-marino">{saludo}, {primerNombre}</p>
                  <p className="mt-1 text-base text-pt-texto">{hoyFecha}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {campanita}
                  <button type="button" onClick={() => navegar("datos")} aria-label="Mi cuenta: ir a Mis datos" className="flex min-h-12 items-center gap-3 rounded-xl border border-pt-borde bg-white py-1.5 pl-2 pr-5 transition-colors hover:bg-slate-50 cursor-pointer">
                    <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-pt-suave text-base font-bold text-pt-azul">{(usuario?.nombre || "P").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")}</span>
                    <span className="max-w-[16rem] truncate text-base font-semibold text-pt-marino">{usuario?.nombre || primerNombre}</span>
                  </button>
                </div>
              </div>
            )}
            {aviso && (
              <div role="status" className="mb-5 flex items-start gap-3 rounded-2xl bg-[#E3F4EA] p-4 text-[#166534]">
                <CheckCircle2 className="mt-0.5 shrink-0" size={22} aria-hidden="true" />
                <p className="min-w-0 flex-1 text-lg font-semibold">{aviso}</p>
                <button type="button" onClick={() => setAviso("")} aria-label="Cerrar aviso" className="-m-2 grid h-12 w-12 shrink-0 place-items-center rounded-xl transition-colors hover:bg-emerald-100 cursor-pointer"><X size={20} aria-hidden="true" /></button>
              </div>
            )}

            {seccion === "resumen" && (
              <ResumenPortal cargando={cargandoPortal} esNuevo={esNuevo} proximaCita={proximaCita} detalleCita={datos.detalle.porCita[proximaCita?.id]} detalleDisponible={datos.detalle.disponible} ordenesAbiertas={ordenesAbiertasDelPaciente(ordenesConPedido)}
                control={control} tieneCitaPendiente={proximas.length > 0} saldoInfo={saldoInfo} contacto={contacto} hayContacto={tieneContacto(contacto)} ultimaReceta={ultimaReceta} cambio={cambioGraduacion} nombreOptica={nombreOptica} direccion={contacto.direccion}
                citaProps={citaProps} onConfirmar={datos.confirmar} onIcs={alIcs} onAgendar={abrirAgendar} onVerCompras={() => navegar("compras")} onVerReceta={() => navegar("receta")} />
            )}
            {seccion === "citas" && <MisCitasPortal cargando={cargandoDatos} proximas={proximas} historial={historial} citaProps={citaProps} onAgendar={abrirAgendar} detalle={datos.detalle} direccion={contacto.direccion} onConfirmar={datos.confirmar} onIcs={alIcs} onVerReceta={verReceta} onCalificar={datos.calificar} recetaActualId={recetaActualId} primeraRecetaId={primeraRecetaId} />}
            {seccion === "receta" && (
              <MiRecetaPortal cargando={cargandoDatos} ultimaReceta={ultimaReceta} recetasAnteriores={misConsultas.slice(1)} todasLasRecetas={misConsultas} recetaAbierta={recetaAbierta} onAbrirReceta={setRecetaAbierta} usuario={usuario} nombreOptica={nombreOptica} mostrarMedidas={mostrarMedidas} control={control}
                medidasSolicitadas={medidasSolicitadas} enviandoMedidas={enviandoMedidas} errorMedidas={errorMedidas} onSolicitarMedidas={solicitarMedidasCompletas} onAgendar={abrirAgendar} />
            )}
            {seccion === "compras" && <MisCompras usuario={usuario} compras={datos.compras} ordenes={ordenesConPedido} cargando={datos.cargando} error={datos.errorCompras} contacto={contacto} onPedirCita={abrirAgendar} onGarantia={pedirGarantia} />}
            {seccion === "datos" && <MisDatosPortal usuario={usuario} nombreOptica={nombreOptica} citas={misCitas} consultas={misConsultas} alActualizarUsuario={alActualizarUsuario} onCambiarClave={abrirClave} onCerrarSesion={onCerrarSesion} />}
          </div>
        </div>
      </main>

      {/* ─── BARRA DE NAVEGACIÓN (celular y tablet): abajo, al alcance del pulgar ─── */}
      {!laptop && (
        <nav aria-label="Menú del portal" className="fixed inset-x-0 bottom-0 z-40 border-t border-pt-borde bg-white pb-[env(safe-area-inset-bottom)]">
          <ul className="mx-auto grid max-w-3xl grid-cols-5">
            {OPCIONES.map((o) => {
              const Icono = o.icono
              const activo = seccion === o.id
              return (
                <li key={o.id}>
                  <button type="button" onClick={() => navegar(o.id)} aria-current={activo ? "page" : undefined} aria-label={o.nombre}
                    className={"flex min-h-[68px] w-full flex-col items-center justify-center gap-1 px-0.5 py-2 text-base leading-tight tracking-tight whitespace-nowrap transition-colors cursor-pointer " + (activo ? "font-bold text-pt-azul" : "font-medium text-slate-600 hover:text-pt-marino")}>
                    <Icono size={24} aria-hidden="true" />
                    <span>{o.corto}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>
      )}

      {/* ─── AGENDAR CITA ─── */}
      {modalAgendar && (
        <Cascaron pantallaCompletaEnCelular titulo="Agendar cita" subtitulo="Elige el motivo y un horario disponible." Icono={Stethoscope} ancho="max-w-3xl" onCerrar={() => setModalAgendar(false)} formulario={{ onSubmit: validarYPedirConfirmacion }}
          pie={<>
            <span />
            <div className="ml-auto flex items-center gap-2">
              <button type="button" onClick={() => setModalAgendar(false)} className={BOTON_SECUNDARIO}>Cancelar</button>
              <button type="submit" className={BOTON_PRINCIPAL} style={ESTILO_PRINCIPAL}>Continuar</button>
            </div>
          </>}
        >
          <div className="space-y-5 p-3 sm:p-5">
            {error && <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-base font-medium text-red-700"><AlertCircle size={20} aria-hidden="true" /> {error}</div>}
            {compraRelacionada && <p className="rounded-xl bg-violet-50 px-4 py-3 text-lg text-violet-900">Ajuste o garantía de tu compra <span className="font-bold">{compraRelacionada}</span>. Cuéntale a tu optómetra qué necesitas cuando llegues.</p>}
            <div>
              <label htmlFor="portal-motivo" className="mb-1.5 block text-base font-semibold text-slate-700">Motivo de la cita</label>
              <SelectorLista id="portal-motivo" etiqueta="Motivo de la cita" valor={motivo} onChange={setMotivo} options={motivosConsulta} placeholder="Elige el motivo" requerido />
            </div>
            <SelectorFechaHora publico grande disponibilidad={disponibilidad} citas={horasOcupadas} fecha={fecha} hora={hora} onCambiarFecha={setFecha} onCambiarHora={setHora} />
          </div>
        </Cascaron>
      )}

      {/* ─── REAGENDAR ─── */}
      {reagendando && (
        <Cascaron pantallaCompletaEnCelular titulo="Reagendar cita" subtitulo={"Tenías: " + formatoFecha(reagendando.fecha, "medio") + " · " + reagendando.hora} Icono={CalendarClock} ancho="max-w-3xl" onCerrar={() => !guardandoReagenda && setReagendando(null)}
          pie={<>
            <span />
            <div className="ml-auto flex items-center gap-2">
              <button type="button" disabled={guardandoReagenda} onClick={() => setReagendando(null)} className={BOTON_SECUNDARIO}>Cancelar</button>
              <button type="button" disabled={guardandoReagenda || !fechaReagenda || !horaReagenda} onClick={confirmarReagenda} className={BOTON_PRINCIPAL} style={ESTILO_PRINCIPAL}>{guardandoReagenda ? "Guardando..." : "Confirmar nuevo horario"}</button>
            </div>
          </>}
        >
          <div className="space-y-4 p-3 sm:p-5">
            {errorReagenda && <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-base font-medium text-red-700"><AlertCircle size={20} aria-hidden="true" /> {errorReagenda}</div>}
            <SelectorFechaHora grande disponibilidad={disponibilidad} citas={horasOcupadas.filter((c) => !(c.fecha === reagendando.fecha && c.hora === reagendando.hora))} fecha={fechaReagenda} hora={horaReagenda} onCambiarFecha={setFechaReagenda} onCambiarHora={setHoraReagenda} />
          </div>
        </Cascaron>
      )}

      {/* ─── CANCELAR ─── */}
      {cancelando && (
        <Cascaron titulo="¿Cancelar esta cita?" subtitulo={formatoFecha(cancelando.fecha, "medio") + " · " + cancelando.hora} Icono={AlertCircle} ancho="max-w-md" onCerrar={() => !guardandoCancelar && setCancelando(null)}
          pie={<>
            <span />
            <div className="ml-auto flex items-center gap-2">
              <button type="button" disabled={guardandoCancelar} onClick={() => setCancelando(null)} className={BOTON_SECUNDARIO}>Volver</button>
              <button type="button" disabled={guardandoCancelar} onClick={confirmarCancelar} className="inline-flex min-h-12 items-center justify-center rounded-xl bg-red-600 px-5 py-3 text-base font-semibold text-white transition-colors hover:bg-red-700 cursor-pointer disabled:opacity-50">{guardandoCancelar ? "Cancelando..." : "Sí, cancelar cita"}</button>
            </div>
          </>}
        >
          <div className="p-5">
            <p className="text-lg text-slate-700">Esta acción no se puede deshacer — si cambias de opinión tendrás que agendar una cita nueva.</p>
            {errorCancelar && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-base font-medium text-red-700">{errorCancelar}</p>}
          </div>
        </Cascaron>
      )}

      {/* ─── CONFIRMACIÓN DE AGENDAMIENTO ─── */}
      {confirmandoCita && (
        <ConfirmarCitaModal paciente={usuario?.nombre || "Paciente Registrado"} motivo={motivo} fecha={fecha ? formatoFecha(fecha, "largoSinDia") : ""} hora={hora}
          onCancelar={() => setConfirmandoCita(false)} onConfirmar={handleAgendar} guardando={guardandoCita} error={errorCita} />
      )}

      {/* ─── CAMBIAR CONTRASEÑA ─── */}
      {modalClave && (
        <Cascaron pantallaCompletaEnCelular titulo="Cambiar contraseña" subtitulo="Usa una que no hayas usado antes." Icono={KeyRound} ancho="max-w-md" onCerrar={() => setModalClave(false)} formulario={{ onSubmit: handleCambiarClave, autoComplete: "off" }}
          pie={<>
            <span />
            <div className="ml-auto flex items-center gap-2">
              <button type="button" disabled={guardandoClave} onClick={() => setModalClave(false)} className={BOTON_SECUNDARIO}>Cancelar</button>
              <button type="submit" disabled={guardandoClave} className={BOTON_PRINCIPAL} style={ESTILO_PRINCIPAL}>{guardandoClave ? "Guardando..." : "Guardar contraseña"}</button>
            </div>
          </>}
        >
          <div className="space-y-4 p-5">
            <p className="text-base text-slate-600">Elige una contraseña nueva para reemplazar la actual.</p>
            {errorClave && <div role="alert" className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-base font-medium text-red-700"><AlertCircle size={20} aria-hidden="true" /> {errorClave}</div>}
            {[
              ["Contraseña actual", claveActual, setClaveActual, "Tu contraseña actual", "current-password"],
              ["Nueva contraseña", nuevaClave, setNuevaClave, "8 o más, con letra y número", "new-password"],
              ["Confirmar contraseña", confirmarClave, setConfirmarClave, "Repite la contraseña", "new-password"],
            ].map(([etiqueta, valor, poner, ejemplo, completar]) => (
              <div key={etiqueta}>
                <label className="mb-1.5 block text-base font-semibold text-slate-700">{etiqueta}
                  <span className="relative mt-1.5 block">
                    <Lock size={18} aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input type="password" value={valor} onChange={(e) => poner(e.target.value)} placeholder={ejemplo} autoComplete={completar} className="min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-3 text-base font-normal text-slate-800 outline-none transition focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50" />
                  </span>
                </label>
              </div>
            ))}
          </div>
        </Cascaron>
      )}
    </div>
  )
}
