import React, { useState, useEffect, useMemo } from "react"
import { ArrowLeft } from "lucide-react"
import LogoOptica from "../componentes/LogoOptica"
import BotonWhatsAppFlotante from "../componentes/publica/BotonWhatsAppFlotante"
import PasoElegir from "../componentes/agendar/PasoElegir"
import { linkWhatsApp } from "../utilidades/whatsapp"
import { formatoFecha, horaSinCero } from "../utilidades/formatoFecha"
import PasosAgendar from "../componentes/agendar/PasosAgendar"
import ResumenCita from "../componentes/agendar/ResumenCita"
import PasoDatos from "../componentes/agendar/PasoDatos"
import { datosCompletos } from "../utilidades/validacionDatosAgendar"
import PasoListo from "../componentes/agendar/PasoListo"
import { esEmailValido } from "../utilidades/validaciones"
import { supabase } from "../lib/supabaseClient"
import { INK, PORCELAIN } from "@/lib/tema"
import { esHoraOcupadaError, esErrorHoraInvalida, MENSAJE_HORA_INVALIDA } from "../utilidades/erroresCitas"
import { colorMarca, degradadoMarca } from "../utilidades/marcaOptica"
import { slotsDisponibles } from "../utilidades/disponibilidad"
import { leerBorrador, guardarBorrador, borrarBorrador } from "../utilidades/agendarWeb"
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
  const [asignado, setAsignado] = useState("")
  const cambiar = (parcial) => setFormData((prev) => ({ ...prev, ...parcial }))

  // Un paso 2 («Tus datos») recordado sin fecha y hora elegidas no tiene sentido: se vuelve al paso 1.
  useEffect(() => {
    if (paso === 2 && (!formData.fecha || !formData.hora)) setPaso(1)
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
  const { horas: horasOcupadas, refrescar, cargando } = useHorasOcupadasEnVivo(opticaId, { activo: paso === 1 || paso === 2 })

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
    if (paso === 3 || cargando || !formData.fecha || !formData.hora) return
    const s = slotsDelDia.find((x) => x.hora === formData.hora)
    if (s && !s.libre) {
      setAvisoHora(textoHoraPerdida(formData.hora))
      setFormData((prev) => ({ ...prev, hora: "" }))
      setPaso(1)
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

  // Paso 1 → 2: la hora elegida NO se reserva todavía; se reserva al confirmar en el paso 2.
  const continuar = () => {
    if (!formData.fecha || !formData.hora) return
    setAvisoHora("")
    setPaso(2)
  }

  const nombreCompleto = [formData.nombres, formData.apellidos].filter(Boolean).join(" ").trim()
  const nombreProfesional = unico?.nombre || profesionalElegido?.nombre || asignado || ""

  // Al confirmar, la hora ya se ocupó: se avisa y se vuelve al paso 1 con los horarios al día, sin perder lo escrito.
  const perderHora = async () => {
    const hora = formData.hora
    setErrorReserva("")
    setPaso(1)
    setFormData((prev) => ({ ...prev, hora: "" }))
    setAvisoHora(textoHoraPerdida(hora))
    await refrescar()
  }

  const confirmarReserva = async () => {
    if (enviando) return
    setErrorReserva("")
    setIntento(true)
    if (!datosCompletos(formData, esPasaporte)) return
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

  const profesionalResumen = nombreProfesional || (profesionales.length > 1 && !asignado ? "Cualquier optómetra" : profesionales.length === 1 ? "" : `Equipo de ${nombreOptica}`)
  const cuando = formData.fecha ? `${formatoFecha(formData.fecha, "diaNumero")} ${formatoFecha(formData.fecha, "mes")}${formData.hora ? " · " + horaSinCero(formData.hora) : ""}` : ""
  const itemsResumen = [
    { etiqueta: "Motivo", valor: formData.motivo },
    { etiqueta: "Profesional", valor: profesionalResumen },
    { etiqueta: "Fecha y hora", valor: cuando },
    { etiqueta: "Paciente", valor: nombreCompleto },
  ]
  const telefonoOptica = (opticaPublica?.settings?.opticaTelefono || "").trim()

  return (
    <div className="relative flex min-h-screen w-full flex-col font-sans text-slate-800 antialiased selection:bg-cyan-200 selection:text-slate-900" style={{ backgroundColor: PORCELAIN }}>
      <style>{`
        @keyframes acStep { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        @keyframes acPop  { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        .ac-step { animation: acStep .45s ease-out both; }
        .ac-pop  { animation: acPop .5s cubic-bezier(0.2,0.8,0.2,1) both; }
        @media (prefers-reduced-motion: reduce) { .ac-step,.ac-pop { animation: none !important; } }
      `}</style>

      {/* ─── CABECERA: volver a la izquierda, logo y nombre al centro, «¿Dudas? WhatsApp» a la derecha ─── */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur-md sm:px-8">
        <div className="mx-auto grid max-w-[1200px] grid-cols-[1fr_auto_1fr] items-center gap-2">
          <button type="button" onClick={salir} className="inline-flex min-h-11 cursor-pointer items-center gap-2 justify-self-start text-sm font-semibold transition-colors hover:underline sm:text-base" style={{ color }}>
            <ArrowLeft size={18} aria-hidden="true" /> <span>Volver al inicio</span>
          </button>
          <div className="flex min-w-0 items-center gap-2.5">
            <LogoOptica url={opticaPublica?.logo_url} nombre={nombreOptica} color={color} tamano={40} />
            <span className="max-w-[9rem] truncate font-serif text-lg font-bold tracking-tight sm:max-w-xs sm:text-xl" style={{ color: INK }}>{nombreOptica}</span>
          </div>
          {telefonoOptica ? (
            <a href={linkWhatsApp(telefonoOptica, `Hola, tengo una duda sobre cómo agendar una cita en ${nombreOptica}.`)} target="_blank" rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center justify-self-end text-sm text-slate-600 sm:text-base">
              <span className="hidden sm:inline">¿Dudas?&nbsp;</span><span className="font-semibold" style={{ color }}>WhatsApp</span>
            </a>
          ) : <span aria-hidden="true" />}
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1040px] flex-1 px-4 py-6 sm:px-8 lg:py-10">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
          <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: INK }}>Solicita tu cita en línea</h1>
          <div className="lg:w-[28rem] lg:shrink-0"><PasosAgendar paso={paso} color={color} /></div>
        </div>

        <div className="mb-5"><ResumenCita items={itemsResumen} /></div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-8" style={{ boxShadow: "0 30px 60px -36px rgba(14,43,51,0.25)" }}>
          {paso === 1 && (
            <PasoElegir
              motivos={motivos} motivo={formData.motivo} onMotivo={(m) => cambiar({ motivo: m, motivoElegido: true })} duracionMinutos={disponibilidad?.duracionCita || 40}
              profesionales={profesionales} profesionalId={profesionalId} onProfesional={(id) => { setProfesionalId(id); setAvisoHora(""); cambiar({ hora: "" }) }}
              aviso={avisoHora} disponibilidad={disponibilidad} horasOcupadas={horasOcupadas} cargando={cargando}
              fecha={formData.fecha} hora={formData.hora}
              onFecha={(iso) => { setAvisoHora(""); setFormData((prev) => ({ ...prev, fecha: iso, hora: "" })) }}
              onHora={(h) => { setAvisoHora(""); cambiar({ hora: h }) }}
              color={color} fondo={marca.fondo} telefono={telefonoOptica} nombreOptica={nombreOptica} onContinuar={continuar} />
          )}

          {paso === 2 && (
            <PasoDatos datos={formData} cambiar={cambiar} esPasaporte={esPasaporte} onPasaporte={setEsPasaporte} intento={intento}
              conMolestia={conMolestia} onMolestia={alternarMolestia} alternarSintoma={alternarSintoma}
              onConfirmar={confirmarReserva} onCambiarHora={() => { setErrorReserva(""); setPaso(1) }} enviando={enviando} errorReserva={errorReserva} marca={marca} />
          )}

          {paso === 3 && (
            <PasoListo fecha={formData.fecha} hora={formData.hora} motivo={formData.motivo} profesional={nombreProfesional} codigo={formData.codigoCita}
              direccion={opticaPublica?.settings?.opticaDireccion} telefono={opticaPublica?.settings?.opticaTelefono}
              nombreOptica={nombreOptica} duracionMinutos={disponibilidad?.duracionCita || 40} />
          )}
        </div>
      </main>

      <BotonWhatsAppFlotante telefono={telefonoOptica} mensaje={`Hola, tengo una duda sobre agendar una cita en ${nombreOptica}.`} />
    </div>
  )
}
