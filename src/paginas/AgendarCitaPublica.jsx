import React, { useState, useEffect, useMemo } from "react"
import { ArrowLeft, ChevronRight } from "lucide-react"
import SelectorFechaHora from "../componentes/SelectorFechaHora"
import ConfirmarCitaModal from "../componentes/ConfirmarCitaModal"
import LogoOptica from "../componentes/LogoOptica"
import PasosAgendar from "../componentes/agendar/PasosAgendar"
import ResumenCita from "../componentes/agendar/ResumenCita"
import BloqueProfesional from "../componentes/agendar/BloqueProfesional"
import PasoDatos from "../componentes/agendar/PasoDatos"
import { datosCompletos } from "../utilidades/validacionDatosAgendar"
import PasoListo from "../componentes/agendar/PasoListo"
import { esEmailValido } from "../utilidades/validaciones"
import { supabase } from "../lib/supabaseClient"
import { INK, PORCELAIN } from "@/lib/tema"
import { esHoraOcupadaError, esErrorHoraInvalida, MENSAJE_HORA_INVALIDA } from "../utilidades/erroresCitas"
import { colorMarca, degradadoMarca } from "../utilidades/marcaOptica"
import { slotsDisponibles } from "../utilidades/disponibilidad"
import { fechaDiaCorto, fechaDiaLargo, leerBorrador, guardarBorrador, borrarBorrador } from "../utilidades/agendarWeb"
import useHorasOcupadasEnVivo from "../utilidades/useHorasOcupadasEnVivo"

// Motivos que trae el sistema si la óptica aún no cargó los suyos (los mismos de la agenda interna).
const MOTIVOS_POR_DEFECTO = ["Consulta General", "Examen de Control", "Adaptación de Lentes", "Garantía / Ajuste"]
// Texto de ayuda de una línea para los motivos conocidos; un motivo que la óptica agregó va solo con su nombre.
const AYUDA_MOTIVO = {
  "Consulta General": "Revisión o una molestia",
  "Examen de Control": "Seguimiento de tu receta",
  "Adaptación de Lentes": "Lentes nuevos o progresivos",
  "Garantía / Ajuste": "Reparación o ajuste",
}
const AYUDA_HORAS = "Solo se muestran las horas en que el optómetra atiende y no tiene otra cita. Las ocupadas aparecen tachadas."
const textoHoraPerdida = (hora) => `La hora ${hora} acaba de ocuparse. Elige otra; ya actualizamos los horarios.`

const DATOS_VACIOS = {
  nombres: "", apellidos: "", cedula: "", fechaNacimiento: "", telefono: "", correo: "",
  // Los permisos para recibir mensajes (Recordatorios de salud sí, Promociones y saludos no, por defecto).
  aceptaRecordatorios: true, aceptaPromociones: false,
  motivo: "", motivoElegido: false,
  // Pre-triage remoto (opcional): lo que el optómetra ve al revisar la cita antes de atenderla. No es un test de agudeza visual ni reemplaza el examen.
  triage: { sintomas: [], desdeCuando: "", detalle: "" },
  fecha: null, hora: "", codigoCita: "",
}

// Lo que se recuerda al recargar (solo la pestaña): únicamente lo que la persona escribió o eligió.
function armarBorrador({ paso, formData, profesionalId, esPasaporte, conMolestia }) {
  const b = { paso, profesionalId, esPasaporte }
  for (const c of ["nombres", "apellidos", "cedula", "fechaNacimiento", "telefono", "correo", "fecha", "hora"]) if (formData[c]) b[c] = formData[c]
  if (formData.motivoElegido) b.motivo = formData.motivo
  if (conMolestia) b.triage = formData.triage
  return b
}

export default function AgendarCitaPublica({ onVolver, citas = [], setCitas, disponibilidad, opticaId, opticaPublica, motivosConsulta = MOTIVOS_POR_DEFECTO, motivoInicial = "" }) {
  const nombreOptica = opticaPublica?.marca?.nombreMarca || opticaPublica?.nombre || "esta óptica"
  const color = colorMarca(opticaPublica?.marca)
  const marca = { color, fondo: degradadoMarca(color) }

  // Los motivos son los que configuró la óptica (Configuración → Catálogos), los mismos de su agenda interna:
  // el paciente elige uno de ellos y la cita se guarda con ese texto, sin traducciones.
  const motivos = (motivosConsulta.length > 0 ? motivosConsulta : MOTIVOS_POR_DEFECTO).map((nombre) => ({ id: nombre, titulo: nombre, descripcion: AYUDA_MOTIVO[nombre] || "" }))

  // Al recargar, el agendamiento sigue en el mismo paso con lo ya escrito (sessionStorage de esta pestaña, nunca la base).
  const borrador = useMemo(() => leerBorrador(opticaId), [opticaId])
  const [paso, setPaso] = useState(() => (borrador?.paso === 2 || borrador?.paso === 1 ? borrador.paso : 1))
  const [formData, setFormData] = useState(() => {
    const inicial = motivoInicial && motivos.some((m) => m.titulo === motivoInicial) ? motivoInicial : ""
    const d = { ...DATOS_VACIOS, triage: { sintomas: [], desdeCuando: "", detalle: "" } }
    if (borrador) {
      for (const c of ["nombres", "apellidos", "cedula", "fechaNacimiento", "telefono", "correo", "fecha", "hora"]) if (typeof borrador[c] === "string") d[c] = borrador[c]
      if (borrador.triage && Array.isArray(borrador.triage.sintomas)) d.triage = { sintomas: borrador.triage.sintomas, desdeCuando: borrador.triage.desdeCuando || "", detalle: borrador.triage.detalle || "" }
      if (typeof borrador.motivo === "string" && motivos.some((m) => m.titulo === borrador.motivo)) { d.motivo = borrador.motivo; d.motivoElegido = true }
    }
    if (inicial) { d.motivo = inicial; d.motivoElegido = true }
    if (!d.motivo) d.motivo = motivos.find((m) => m.titulo === "Consulta General")?.titulo || motivos[0].titulo
    return d
  })
  const [esPasaporte, setEsPasaporte] = useState(() => Boolean(borrador?.esPasaporte))
  const [profesionalId, setProfesionalId] = useState(() => (typeof borrador?.profesionalId === "string" ? borrador.profesionalId : ""))
  const [conMolestia, setConMolestia] = useState(() => Boolean(borrador?.triage?.sintomas?.length || borrador?.triage?.desdeCuando || borrador?.triage?.detalle))
  const [intento, setIntento] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [errorReserva, setErrorReserva] = useState("")
  const [avisoHora, setAvisoHora] = useState("")
  const [confirmando, setConfirmando] = useState(false)
  const [asignado, setAsignado] = useState("")
  const cambiar = (parcial) => setFormData((prev) => ({ ...prev, ...parcial }))

  // Un paso 2 recordado sin datos completos no tiene sentido: se vuelve al paso 1.
  useEffect(() => {
    if (paso === 2 && !datosCompletos(formData, esPasaporte)) setPaso(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Si los motivos de la óptica llegan después de abrir el formulario, el elegido se ajusta al primero válido.
  useEffect(() => {
    if (!motivos.some((m) => m.titulo === formData.motivo)) setFormData((prev) => ({ ...prev, motivo: motivos[0].titulo, motivoElegido: false }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [motivosConsulta])

  // Guardar el borrador mientras se escribe (no en el paso Listo, donde ya no hay nada que recordar).
  useEffect(() => {
    if (paso === 3) return
    guardarBorrador(opticaId, armarBorrador({ paso, formData, profesionalId, esPasaporte, conMolestia }))
  }, [opticaId, paso, formData, profesionalId, esPasaporte, conMolestia])

  // Hallazgo E7: `citas` (prop compartido de App.jsx) solo se llena cuando un admin inició sesión en este mismo navegador — un visitante nuevo
  // veía todos los horarios como libres. horas_ocupadas_publicas() expone solo fecha/hora/profesional (sin datos del paciente) para que la
  // disponibilidad que ve el público sea la real. Se vuelve a pedir sola cada ~20 s y al volver el foco a la pestaña mientras se eligen las horas.
  const { horas: horasOcupadas, refrescar, cargando } = useHorasOcupadasEnVivo(opticaId, { activo: paso === 2 })

  // Quiénes atienden (profesionales_agendamiento: nombre y foto siempre; el registro solo si la persona activó «Mostrarme en la página pública»). Si la función no existe aún o falla, no hay nombres:
  // la cantidad sale de la agenda del personal (agenda_profesionales) y no se muestra «Te atiende» sin nombre.
  const [datosPublicos, setDatosPublicos] = useState(null)
  useEffect(() => {
    if (!supabase || !opticaId) return undefined
    let vivo = true
    Promise.resolve(supabase.rpc("profesionales_agendamiento", { p_optica_id: opticaId }))
      .then(({ data, error }) => { if (vivo && !error && Array.isArray(data)) setDatosPublicos(data) })
      .catch(() => {})
    return () => { vivo = false }
  }, [opticaId])

  const profesionales = useMemo(() => {
    const datos = datosPublicos || []
    return (disponibilidad?.profesionales || []).map((p) => {
      const d = datos.find((x) => x.id === p.id)
      return { id: p.id, nombre: d?.nombre || "", registro: d?.registro || "", foto: d?.foto || "" }
    })
  }, [disponibilidad, datosPublicos])
  const profesionalElegido = profesionales.find((p) => p.id === profesionalId) || null
  const unico = profesionales.length === 1 ? profesionales[0] : null

  // Las horas libres: LA regla única (slotsDisponibles); el mismo cálculo dice si la hora elegida sigue libre tras cada refresco.
  const opcionesHoras = { publico: true, porProfesional: true, profesionalId: profesionalId || null }
  const slotsDelDia = useMemo(
    () => (formData.fecha ? slotsDisponibles(formData.fecha, disponibilidad, horasOcupadas, opcionesHoras) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [formData.fecha, disponibilidad, horasOcupadas, profesionalId],
  )
  useEffect(() => {
    if (paso !== 2 || cargando || !formData.fecha || !formData.hora) return
    const s = slotsDelDia.find((x) => x.hora === formData.hora)
    if (s && !s.libre) {
      setAvisoHora(textoHoraPerdida(formData.hora))
      setFormData((prev) => ({ ...prev, hora: "" }))
    }
  }, [paso, cargando, slotsDelDia, formData.fecha, formData.hora])

  const alternarSintoma = (s) => {
    setFormData((prev) => {
      const actuales = prev.triage.sintomas
      const siguientes = actuales.includes(s) ? actuales.filter((x) => x !== s) : [...actuales, s]
      return { ...prev, triage: { ...prev.triage, sintomas: siguientes } }
    })
  }
  const alternarMolestia = () => {
    if (conMolestia) cambiar({ triage: { sintomas: [], desdeCuando: "", detalle: "" } })
    setConMolestia((v) => !v)
  }

  const continuar = () => {
    setIntento(true)
    if (!datosCompletos(formData, esPasaporte)) return
    if (formData.correo && !esEmailValido(formData.correo, false)) return
    setPaso(2)
  }

  const nombreCompleto = [formData.nombres, formData.apellidos].filter(Boolean).join(" ").trim()
  const nombreProfesional = unico?.nombre || profesionalElegido?.nombre || asignado || ""

  const perderHora = async () => {
    const hora = formData.hora
    setConfirmando(false)
    setErrorReserva("")
    setFormData((prev) => ({ ...prev, hora: "" }))
    setAvisoHora(textoHoraPerdida(hora))
    await refrescar()
  }

  const confirmarReserva = async () => {
    if (enviando) return
    setErrorReserva("")
    if (!datosCompletos(formData, esPasaporte)) {
      setConfirmando(false)
      setIntento(true)
      setPaso(1)
      return
    }
    if (formData.correo && !esEmailValido(formData.correo, false)) {
      setErrorReserva("Ese correo no es válido — corrígelo o déjalo vacío.")
      return
    }
    const triageAEnviar = formData.triage.sintomas.length > 0 || formData.triage.desdeCuando || formData.triage.detalle.trim() ? formData.triage : null
    const nuevaCita = {
      paciente: nombreCompleto,
      cedula: formData.cedula,
      telefono: formData.telefono,
      fecha: formData.fecha || "",
      hora: formData.hora,
      motivo: formData.motivo,
      motivoPublico: formData.motivo,
      triage: triageAEnviar,
      iniciales: nombreCompleto.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "P",
      estado: "Pendiente",
    }

    setEnviando(true)
    try {
      let codigoReal = ""
      if (supabase && opticaId) {
        // crear_cita_publica resuelve o crea el registro del paciente (dedupe por cédula) y genera el código en el servidor. Es una función que devuelve
        // una tabla: el cliente la recibe como un ARREGLO de una fila. Solo se manda el profesional si la persona eligió a uno y el tipo de documento si es pasaporte
        // (así sigue funcionando con la base de antes de la migración 0149).
        const parametros = {
          p_optica_id: opticaId,
          p_paciente: nuevaCita.paciente,
          p_fecha: nuevaCita.fecha,
          p_hora: nuevaCita.hora,
          p_cedula: nuevaCita.cedula,
          p_fecha_nacimiento: formData.fechaNacimiento || null,
          p_telefono: nuevaCita.telefono || null,
          p_motivo: formData.motivo,
          p_motivo_publico: formData.motivo,
          p_correo: formData.correo || null,
          p_triage: triageAEnviar,
          ...(profesionalId ? { p_profesional_id: profesionalId } : {}),
          ...(esPasaporte ? { p_tipo_documento: "pasaporte" } : {}),
        }
        const { data, error } = await supabase.rpc("crear_cita_publica", parametros)
        const fila = Array.isArray(data) ? data[0] : data
        if (error || !fila?.id) {
          if (esHoraOcupadaError(error)) await perderHora()
          else if (esErrorHoraInvalida(error)) setErrorReserva(MENSAJE_HORA_INVALIDA + " Elige otra hora.")
          else if (/c[eé]dula|pasaporte/i.test(error?.message || "")) setErrorReserva(esPasaporte ? "El pasaporte no es válido — revísalo." : "La cédula ingresada no es válida — revisa los dígitos.")
          else if (/Elige otr[ao]/i.test(error?.message || "")) setErrorReserva(error.message)
          else setErrorReserva("No pudimos guardar tu cita. Intenta de nuevo en un momento.")
          return
        }
        nuevaCita.id = fila.id
        codigoReal = fila.codigo
        // Los permisos que eligió: si falla no se pierde la cita (valen los de siempre y el paciente los cambia desde su portal).
        // (El cliente devuelve { error } sin lanzar; no es una promesa con .catch.)
        try {
          await supabase.rpc("registrar_permisos_cita_publica", { p_cita_id: fila.id, p_recordatorios: formData.aceptaRecordatorios, p_promociones: formData.aceptaPromociones })
        } catch { /* los permisos de siempre */ }
      } else {
        nuevaCita.id = Date.now()
        codigoReal = `CIT-${formData.fecha?.slice(0, 4) || "0000"}-DEMO`
      }

      setCitas?.([...citas, nuevaCita])
      setFormData((prev) => ({ ...prev, codigoCita: codigoReal }))
      borrarBorrador(opticaId)
      setConfirmando(false)
      setPaso(3)
      // Con «cualquier optómetra», saber quién quedó asignado (si la base lo dice) para mostrarlo en el resumen.
      if (!profesionalId && profesionales.length > 1) {
        refrescar().then((filas) => {
          const mia = (filas || []).find((h) => h.fecha === nuevaCita.fecha && h.hora === nuevaCita.hora && h.asignado_a)
          const quien = profesionales.find((p) => p.id === mia?.asignado_a)
          if (quien?.nombre) setAsignado(quien.nombre)
        })
      }
    } catch {
      setErrorReserva("No pudimos guardar tu cita. Intenta de nuevo en un momento.")
    } finally {
      setEnviando(false)
    }
  }

  const salir = () => { borrarBorrador(opticaId); onVolver?.() }

  const profesionalResumen = nombreProfesional || (profesionales.length > 1 && !asignado ? "Cualquier optómetra" : `Equipo de ${nombreOptica}`)
  const filasResumen = [
    { etiqueta: "Motivo", valor: formData.motivo },
    { etiqueta: "Paciente", valor: nombreCompleto },
    { etiqueta: "Profesional", valor: profesionalResumen },
    { etiqueta: "Fecha", valor: fechaDiaCorto(formData.fecha) },
    { etiqueta: "Hora", valor: formData.hora },
  ]
  const resumenCorto = [formData.motivo, formData.fecha ? fechaDiaCorto(formData.fecha) : "", formData.hora].filter(Boolean).join(" · ")

  return (
    <div className="relative flex min-h-screen w-full flex-col font-sans text-slate-800 antialiased selection:bg-cyan-200 selection:text-slate-900" style={{ backgroundColor: PORCELAIN }}>
      <style>{`
        @keyframes acStep { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        @keyframes acPop  { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        .ac-step { animation: acStep .45s ease-out both; }
        .ac-pop  { animation: acPop .5s cubic-bezier(0.2,0.8,0.2,1) both; }
        @media (prefers-reduced-motion: reduce) { .ac-step,.ac-pop { animation: none !important; } }
      `}</style>

      {/* ─── CABECERA: volver a la izquierda, logo y nombre al centro ─── */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur-md sm:px-8">
        <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto_1fr] items-center gap-2">
          <button type="button" onClick={salir} className="inline-flex min-h-11 cursor-pointer items-center gap-2 justify-self-start text-sm font-semibold transition-colors hover:underline sm:text-base" style={{ color }}>
            <ArrowLeft size={18} aria-hidden="true" /> <span>Volver al inicio</span>
          </button>
          <div className="flex min-w-0 items-center gap-2.5">
            <LogoOptica url={opticaPublica?.logo_url} nombre={nombreOptica} color={color} tamano={40} />
            <span className="max-w-[9rem] truncate font-serif text-lg font-bold tracking-tight sm:max-w-xs sm:text-xl" style={{ color: INK }}>{nombreOptica}</span>
          </div>
          <span aria-hidden="true" />
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-5 px-4 py-6 sm:px-8 lg:grid-cols-12 lg:gap-10 lg:py-10">
        <section className="min-w-0 lg:col-span-8">
          <h1 className="mb-5 font-serif text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: INK }}>Solicita tu cita en línea</h1>
          <div className="mb-5"><PasosAgendar paso={paso} color={color} /></div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-8" style={{ boxShadow: "0 30px 60px -36px rgba(14,43,51,0.25)" }}>
            {paso === 1 && (
              <PasoDatos datos={formData} cambiar={cambiar} esPasaporte={esPasaporte} onPasaporte={setEsPasaporte} intento={intento} motivos={motivos}
                conMolestia={conMolestia} onMolestia={alternarMolestia} alternarSintoma={alternarSintoma} onContinuar={continuar} marca={marca} />
            )}

            {paso === 2 && (
              <div className="ac-step space-y-5">
                <BloqueProfesional profesionales={profesionales} valor={profesionalId} color={color}
                  onCambiar={(id) => { setProfesionalId(id); setAvisoHora(""); cambiar({ hora: "" }) }} />

                {avisoHora && <p role="alert" className="rounded-xl bg-amber-50 px-4 py-3 text-base text-amber-900">{avisoHora}</p>}

                {cargando ? (
                  <div className="grid animate-pulse grid-cols-1 gap-6 md:grid-cols-2" aria-busy="true" aria-label="Cargando horarios">
                    <div className="h-64 rounded-xl bg-slate-100" />
                    <div className="h-64 rounded-xl bg-slate-100" />
                  </div>
                ) : (
                  <SelectorFechaHora
                    publico agrupar porProfesional
                    color={color}
                    ayuda={AYUDA_HORAS}
                    disponibilidad={disponibilidad}
                    citas={horasOcupadas}
                    profesionalId={profesionalId || null}
                    fecha={formData.fecha}
                    hora={formData.hora}
                    onCambiarFecha={(iso) => { setAvisoHora(""); setFormData((prev) => ({ ...prev, fecha: iso, hora: "" })) }}
                    onCambiarHora={(h) => { setAvisoHora(""); cambiar({ hora: h }) }}
                  />
                )}

                <div className="flex items-center justify-between gap-3 pt-2">
                  <button type="button" onClick={() => setPaso(1)} className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 px-1 text-base font-semibold transition-colors hover:underline" style={{ color }}>
                    <ArrowLeft size={18} aria-hidden="true" /> Atrás
                  </button>
                  <button type="button" onClick={() => { setErrorReserva(""); setConfirmando(true) }} disabled={!formData.fecha || !formData.hora}
                    className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-xl px-6 text-base font-bold text-white transition-colors hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                    style={{ background: marca.fondo, boxShadow: "0 14px 28px -12px rgba(37,99,235,0.6)" }}>
                    Confirmar reserva <ChevronRight size={18} aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}

            {paso === 3 && (
              <PasoListo fecha={formData.fecha} hora={formData.hora} motivo={formData.motivo} profesional={nombreProfesional} codigo={formData.codigoCita}
                direccion={opticaPublica?.settings?.opticaDireccion} telefono={opticaPublica?.settings?.opticaTelefono}
                nombreOptica={nombreOptica} duracionMinutos={disponibilidad?.duracionCita || 40} />
            )}
          </div>
        </section>

        {/* Resumen: tarjeta blanca a la derecha (en celular, arriba y plegada). Sigue completa en el paso Listo. */}
        <aside className="order-first lg:order-none lg:col-span-4">
          <ResumenCita filas={filasResumen} color={color} corto={resumenCorto} />
        </aside>
      </main>

      {/* ─── CONFIRMACIÓN DE RESERVA ─── */}
      {confirmando && (
        <ConfirmarCitaModal
          paciente={nombreCompleto}
          motivo={formData.motivo}
          fecha={fechaDiaLargo(formData.fecha)}
          hora={formData.hora}
          profesional={nombreProfesional}
          onCancelar={() => setConfirmando(false)}
          onConfirmar={confirmarReserva}
          guardando={enviando}
          error={errorReserva}
        />
      )}
    </div>
  )
}
