import React, { useState } from "react"
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  Clock,
  Check,
  Eye,
  HeartPulse,
  Glasses,
  Stethoscope,
  ChevronRight,
  CheckCircle2,
  Copy,
  ShieldCheck,
  CalendarDays,
} from "lucide-react"
import SelectorFechaHora from "../componentes/SelectorFechaHora"
import ConfirmarCitaModal from "../componentes/ConfirmarCitaModal"
import { isoAFechaLocal } from "../utilidades/disponibilidad"
import { filtrarSoloLetras, filtrarSoloNumeros, esEmailValido } from "../utilidades/validaciones"
import { supabase } from "../lib/supabaseClient"

// ─── Paleta de firma (consistente con el login) ───
const INK = "#0E2B33"
const PORCELAIN = "#F7F5F0"
const GOLD = "#C8A24E"
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)" // cian → azul

export default function AgendarCitaPublica({ onVolver, citas = [], setCitas, disponibilidad, opticaId, opticaPublica, parametrizacion }) {
  const horasAntesPermitidas = parametrizacion?.horasAntesReagendar ?? 2
  const nombreOptica = opticaPublica?.marca?.nombreMarca || opticaPublica?.nombre || "esta óptica"
  const [paso, setPaso] = useState(1)
  const [enviando, setEnviando] = useState(false)
  const [errorReserva, setErrorReserva] = useState("")

  const [formData, setFormData] = useState({
    nombres: "",
    apellidos: "",
    telefono: "",
    correo: "",
    motivo: "Medición y examen visual",
    fecha: null,
    hora: "",
    codigoCita: "",
  })

  const [copiado, setCopiado] = useState(false)
  const [confirmando, setConfirmando] = useState(false)

  const motivos = [
    {
      id: "atencion",
      titulo: "Atención por molestia o enfermedad",
      descripcion: "Ojo rojo, dolor, visión borrosa u otra molestia que quieras revisar.",
      icon: HeartPulse,
    },
    {
      id: "medicion",
      titulo: "Medición y examen visual",
      descripcion: "Chequeo de tu vista, control de tu graduación o examen completo.",
      icon: Eye,
    },
    {
      id: "compra",
      titulo: "Compra de lentes o monturas",
      descripcion: "Asesoría para elegir monturas, lentes o cambio de armazón.",
      icon: Glasses,
    },
  ]

  // La agenda interna (Citas.jsx) sólo reconoce y colorea 4 motivos fijos
  // ("Consulta General" / "Adaptación de Lentes" / "Examen de Control" /
  // "Garantía / Ajuste"). Antes toda cita agendada desde este formulario público
  // guardaba el texto del paciente tal cual y caía en el badge gris genérico —
  // nunca se podía filtrar ni colorear en la agenda del optómetra. Se conserva
  // el texto amigable para el paciente en este wizard, pero al guardar la cita
  // se traduce al motivo interno equivalente.
  const MOTIVO_INTERNO = {
    "Atención por molestia o enfermedad": "Consulta General",
    "Medición y examen visual": "Examen de Control",
    "Compra de lentes o monturas": "Adaptación de Lentes",
  }

  const siguientePaso = () => setPaso((prev) => Math.min(prev + 1, 3))

  const anteriorPaso = () => setPaso((prev) => Math.max(prev - 1, 1))

  const confirmarReserva = async () => {
    const codigoGenerado = `CIT-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`
    const nombreCompleto = [formData.nombres, formData.apellidos].filter(Boolean).join(" ").trim()
    const partesNombre = nombreCompleto.split(" ").filter(Boolean)
    const iniciales = partesNombre.length > 1
      ? (partesNombre[0][0] + partesNombre[1][0]).toUpperCase()
      : (partesNombre[0]?.[0] || "P").toUpperCase()

    const motivoInterno = MOTIVO_INTERNO[formData.motivo] || "Consulta General"
    const nuevaCita = {
      paciente: nombreCompleto,
      telefono: formData.telefono,
      fecha: formData.fecha || "",
      hora: formData.hora,
      motivo: motivoInterno,
      motivoPublico: formData.motivo,
      iniciales,
      estado: "Pendiente",
    }

    setErrorReserva("")
    if (formData.correo && !esEmailValido(formData.correo, false)) {
      setErrorReserva("Ese correo no es válido — corrígelo o déjalo vacío.")
      return
    }
    setEnviando(true)
    if (supabase && opticaId) {
      const { data, error } = await supabase.rpc("crear_cita_publica", {
        p_optica_id: opticaId,
        p_paciente: nuevaCita.paciente,
        p_fecha: nuevaCita.fecha,
        p_hora: nuevaCita.hora,
        p_telefono: nuevaCita.telefono || null,
        p_motivo: motivoInterno,
        p_motivo_publico: formData.motivo,
        p_correo: formData.correo || null,
      })
      if (error) {
        setEnviando(false)
        setErrorReserva("No pudimos guardar tu cita. Intenta de nuevo en un momento.")
        return
      }
      nuevaCita.id = data
    } else {
      nuevaCita.id = Date.now()
    }

    setCitas?.([...citas, nuevaCita])
    setFormData((prev) => ({ ...prev, codigoCita: codigoGenerado }))
    setEnviando(false)
    setConfirmando(false)
    setPaso(3)
  }

  const copiarCodigo = () => {
    navigator.clipboard.writeText(formData.codigoCita)
    setCopiado(true)
    setTimeout(() => setCopiado(false), 2000)
  }

  const motivoActual = motivos.find((m) => m.titulo === formData.motivo)
  const IconoMotivo = motivoActual ? motivoActual.icon : Eye
  const nombreCompleto =
    [formData.nombres, formData.apellidos].filter(Boolean).join(" ").trim()
  const fechaTexto = formData.fecha
    ? isoAFechaLocal(formData.fecha).toLocaleDateString("es-EC", { day: "numeric", month: "long", year: "numeric" })
    : null

  return (
    <div
      className="relative flex min-h-screen w-full flex-col font-sans text-slate-800 antialiased selection:bg-cyan-200 selection:text-slate-900"
      style={{ backgroundColor: PORCELAIN }}
    >
      <style>{`
        @keyframes acStep { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
        @keyframes acPop  { from { opacity: 0; transform: scale(0.9); } to { opacity: 1; transform: scale(1); } }
        .ac-step { animation: acStep .45s ease-out both; }
        .ac-pop  { animation: acPop .5s cubic-bezier(0.2,0.8,0.2,1) both; }
        @media (prefers-reduced-motion: reduce) { .ac-step,.ac-pop { animation: none !important; } }
      `}</style>

      {/* ─── HEADER ─── */}
      <header
        className="sticky top-0 z-30 border-b px-4 py-3.5 backdrop-blur-md sm:px-8"
        style={{ backgroundColor: "rgba(247,245,240,0.85)", borderColor: "rgba(14,43,51,0.08)" }}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <button
            type="button"
            onClick={onVolver}
            className="flex items-center gap-2 text-sm font-semibold text-slate-600 transition-colors hover:text-slate-900 cursor-pointer"
          >
            <ArrowLeft size={16} /> Volver al inicio
          </button>

          <div className="flex items-center gap-2.5">
            <div
              className="grid h-9 w-9 place-items-center rounded-xl text-white"
              style={{ background: GRAD, boxShadow: "0 8px 20px -8px rgba(34,211,238,0.6)" }}
            >
              <Eye size={18} />
            </div>
            <span className="font-bold tracking-tight" style={{ color: INK }}>
              {nombreOptica}
            </span>
          </div>

          <div className="hidden w-28 sm:block" />
        </div>
      </header>

      {/* ─── CUERPO: RESUMEN (aside) + FORMULARIO ─── */}
      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-8 px-4 py-8 sm:px-8 lg:grid-cols-12 lg:gap-10 lg:py-12">
        {/* ASIDE — resumen en vivo; ya no se muestra en el paso 3, donde el
            recibo del panel principal es la única fuente de esos datos */}
        {paso !== 3 && (
          <aside className="lg:col-span-5">
            <div
              className="relative overflow-hidden rounded-3xl p-7 text-white lg:sticky lg:top-24"
              style={{ backgroundColor: INK }}
            >
              {/* decoración */}
              <svg
                aria-hidden="true"
                className="pointer-events-none absolute -right-16 -top-16 h-72 w-72"
                viewBox="0 0 400 400" fill="none" stroke="#ffffff" style={{ opacity: 0.06 }}
              >
                {[70, 130, 190].map((r) => (<circle key={r} cx="200" cy="200" r={r} strokeWidth="1.4" />))}
              </svg>
              <div
                className="pointer-events-none absolute -bottom-10 -left-10 h-56 w-56 rounded-full blur-3xl"
                style={{ background: "radial-gradient(circle, rgba(34,211,238,0.18), transparent 70%)" }}
              />

              <div className="relative">
                <span className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.16em]" style={{ color: GOLD }}>
                  <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: GOLD }} />
                  Resumen de tu cita
                </span>
                <h2 className="mt-3 font-serif text-2xl font-bold leading-tight">
                  Estás a pocos pasos
                </h2>
                <p className="mt-1.5 text-sm text-white/60">
                  Vamos completando los datos a medida que avanzas.
                </p>

                <div className="mt-7 flex flex-col gap-1">
                  <ResumenFila icon={IconoMotivo} label="Motivo" valor={formData.motivo} />
                  <ResumenFila icon={User} label="Paciente" valor={nombreCompleto || null} />
                  <ResumenFila icon={CalendarDays} label="Fecha" valor={fechaTexto} />
                  <ResumenFila icon={Clock} label="Hora" valor={formData.hora || null} />
                  <ResumenFila icon={Stethoscope} label="Profesional" valor={`Equipo de ${nombreOptica}`} />
                </div>

                <div className="mt-7 flex flex-col gap-2.5 border-t border-white/10 pt-6">
                  {["Sin crear cuenta", "Confirmación inmediata", "Datos protegidos"].map((t) => (
                    <span key={t} className="flex items-center gap-2.5 text-sm text-white/70">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full" style={{ backgroundColor: "rgba(34,211,238,0.15)" }}>
                        <Check size={12} strokeWidth={3} style={{ color: "#22D3EE" }} />
                      </span>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        )}

        {/* FORMULARIO */}
        <section className={paso === 3 ? "lg:col-span-12 lg:mx-auto lg:w-full lg:max-w-2xl" : "lg:col-span-7"}>
          <div className="mb-6">
            <h1 className="font-serif text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: INK }}>
              Solicita tu cita en línea
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Sin crear cuenta y en pocos pasos. Reserva tu espacio rápidamente.
            </p>
          </div>

          {/* Stepper */}
          <div className="mb-8 flex items-center">
            <StepItem num={1} label="Tus datos" activo={paso === 1} completado={paso > 1} />
            <Conector activo={paso > 1} />
            <StepItem num={2} label="Fecha y hora" activo={paso === 2} completado={paso > 2} />
            <Conector activo={paso > 2} />
            <StepItem num={3} label="Listo" activo={paso === 3} completado={paso === 3} />
          </div>

          {/* Tarjeta del formulario */}
          <div
            className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8"
            style={{ boxShadow: "0 30px 60px -30px rgba(14,43,51,0.25)" }}
          >
            {/* PASO 1 */}
            {paso === 1 && (
              <div className="ac-step space-y-8">
                <div>
                  <h3 className="text-lg font-bold" style={{ color: INK }}>¿Cómo te llamas?</h3>
                  <p className="text-xs text-slate-500">Con tu nombre y teléfono basta para coordinar la cita.</p>

                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Campo label="Nombres" icon={User} placeholder="Ej. Diego Andrés"
                      value={formData.nombres} onChange={(v) => setFormData({ ...formData, nombres: filtrarSoloLetras(v) })} />
                    <Campo label="Apellidos" icon={User} placeholder="Ej. Zambrano Loor"
                      value={formData.apellidos} onChange={(v) => setFormData({ ...formData, apellidos: filtrarSoloLetras(v) })} />
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Campo label="Teléfono / WhatsApp" icon={Phone} type="tel" placeholder="Ej. 0991234567" maxLength={10}
                      value={formData.telefono} onChange={(v) => setFormData({ ...formData, telefono: filtrarSoloNumeros(v, 10) })} />
                    <Campo label="Correo (opcional)" icon={Mail} type="email" placeholder="tucorreo@ejemplo.com"
                      value={formData.correo} onChange={(v) => setFormData({ ...formData, correo: v })} />
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-400">Si nos dejas tu correo, te mandamos un recordatorio antes de tu cita.</p>
                </div>

                <div>
                  <h3 className="text-lg font-bold" style={{ color: INK }}>¿Qué necesitas?</h3>
                  <p className="text-xs text-slate-500">Elige el motivo principal de tu visita.</p>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    {motivos.map((item) => {
                      const Icono = item.icon
                      const seleccionado = formData.motivo === item.titulo
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, motivo: item.titulo })}
                          className={
                            "group relative flex flex-col rounded-2xl border p-4 text-left transition-all cursor-pointer " +
                            (seleccionado
                              ? "border-blue-500 bg-blue-50/50 shadow-sm"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60")
                          }
                        >
                          <div
                            className="mb-3 grid h-10 w-10 place-items-center rounded-xl text-white transition-all"
                            style={{
                              background: seleccionado ? GRAD : "#eef2ff",
                              color: seleccionado ? "#fff" : "#2563EB",
                            }}
                          >
                            <Icono size={18} />
                          </div>
                          <h4 className="text-sm font-bold leading-snug" style={{ color: INK }}>{item.titulo}</h4>
                          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{item.descripcion}</p>
                          {seleccionado && (
                            <span className="absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full text-white" style={{ background: GRAD }}>
                              <Check size={12} strokeWidth={3} />
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <BotonPrimario onClick={siguientePaso} disabled={!formData.nombres || !formData.apellidos}>
                    Continuar <ChevronRight size={16} />
                  </BotonPrimario>
                </div>
              </div>
            )}

            {/* PASO 2 */}
            {paso === 2 && (
              <div className="ac-step space-y-6">
                <div>
                  <h3 className="text-lg font-bold" style={{ color: INK }}>Selecciona fecha y hora</h3>
                  <p className="text-xs text-slate-500">Elige un día disponible para ver los horarios del optómetra.</p>
                </div>

                <SelectorFechaHora
                  disponibilidad={disponibilidad}
                  citas={citas}
                  fecha={formData.fecha}
                  hora={formData.hora}
                  onCambiarFecha={(iso) => setFormData((prev) => ({ ...prev, fecha: iso, hora: "" }))}
                  onCambiarHora={(h) => setFormData((prev) => ({ ...prev, hora: h }))}
                />

                <div className="flex items-center justify-between border-t border-slate-100 pt-6">
                  <button type="button" onClick={anteriorPaso}
                    className="text-sm font-bold text-slate-500 transition-colors hover:text-slate-800 cursor-pointer">
                    Atrás
                  </button>
                  <BotonPrimario onClick={() => setConfirmando(true)} disabled={!formData.fecha || !formData.hora}>
                    Confirmar reserva <ChevronRight size={16} />
                  </BotonPrimario>
                </div>
              </div>
            )}

            {/* PASO 3 */}
            {paso === 3 && (
              <div className="ac-step space-y-6 py-2 text-center">
                <div className="ac-pop mx-auto grid h-20 w-20 place-items-center rounded-full text-white"
                  style={{ background: GRAD, boxShadow: "0 20px 40px -12px rgba(34,211,238,0.5)" }}>
                  <CheckCircle2 size={40} />
                </div>

                <div>
                  <h3 className="font-serif text-3xl font-bold" style={{ color: INK }}>¡Tu cita está reservada!</h3>
                  <p className="mt-1.5 text-sm text-slate-500">Guarda tu código de seguimiento para futuras consultas.</p>
                </div>

                {/* Código */}
                <div className="mx-auto max-w-sm rounded-2xl border-2 border-dashed p-4" style={{ borderColor: "rgba(37,99,235,0.3)", backgroundColor: "#eff6ff" }}>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Tu código de cita</span>
                  <div className="mt-2 flex items-center justify-between gap-2 rounded-xl border border-blue-100 bg-white p-2.5 shadow-sm">
                    <span className="font-mono text-lg font-black" style={{ color: INK }}>{formData.codigoCita}</span>
                    <button type="button" onClick={copiarCodigo}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-all hover:-translate-y-0.5 cursor-pointer"
                      style={{ background: GRAD }}>
                      <Copy size={14} />
                      {copiado ? "¡Copiado!" : "Copiar"}
                    </button>
                  </div>
                </div>

                {/* Recibo con detalles */}
                <div className="mx-auto max-w-sm rounded-2xl border border-slate-200 bg-slate-50/50 p-4 text-left">
                  <ReciboFila label="Motivo" valor={formData.motivo} />
                  <ReciboFila label="Fecha" valor={fechaTexto} />
                  <ReciboFila label="Hora" valor={formData.hora} />
                  <ReciboFila label="Profesional" valor={`Equipo de ${nombreOptica}`} ultima />
                </div>

                <p className="flex items-center justify-center gap-1.5 text-xs text-slate-500">
                  <ShieldCheck size={14} className="text-emerald-600" />
                  Te enviaremos un recordatorio por WhatsApp antes de tu cita.
                </p>

                {parametrizacion?.permitirReagendarPaciente && (
                  <p className="mx-auto max-w-sm text-xs leading-relaxed text-slate-500">
                    Puedes cambiar el horario o cancelar tu cita hasta con {horasAntesPermitidas} hora{horasAntesPermitidas === 1 ? "" : "s"} de anticipación. Escríbenos o pídelo directamente si tienes cuenta de paciente.
                  </p>
                )}

                <div className="mx-auto max-w-sm rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-left">
                  <p className="text-xs leading-relaxed text-slate-500">
                    <span className="font-semibold text-slate-700">¿Tienes dudas o necesitas más información?</span> Escríbenos o pregúntale directamente al optómetra el día de tu cita.
                  </p>
                  <p className="mt-2 text-xs leading-relaxed text-slate-500">
                    Si quieres una experiencia más completa —ver tu receta, tu historial y agendar más rápido la próxima vez— pídele al optómetra que active tu <span className="font-semibold text-slate-700">cuenta de paciente</span> durante tu visita.
                  </p>
                </div>

                <button type="button" onClick={onVolver}
                  className="w-full rounded-xl py-3.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 cursor-pointer"
                  style={{ backgroundColor: INK }}>
                  Volver a la página principal
                </button>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* ─── CONFIRMACIÓN DE RESERVA ─── */}
      {confirmando && (
        <ConfirmarCitaModal
          paciente={nombreCompleto}
          motivo={formData.motivo}
          fecha={fechaTexto}
          hora={formData.hora}
          onCancelar={() => setConfirmando(false)}
          onConfirmar={confirmarReserva}
          guardando={enviando}
          error={errorReserva}
        />
      )}
    </div>
  )
}

// ─── Subcomponentes ───
function ResumenFila({ icon: Icon, label, valor }) {
  const puesto = Boolean(valor)
  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-2.5">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg" style={{ backgroundColor: "rgba(255,255,255,0.06)" }}>
        <Icon size={16} className="text-white/70" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wider text-white/40">{label}</p>
        <p className={"truncate text-sm font-semibold " + (puesto ? "text-white" : "text-white/35")}>
          {puesto ? valor : "Por completar"}
        </p>
      </div>
    </div>
  )
}

function ReciboFila({ label, valor, ultima }) {
  return (
    <div className={"flex items-center justify-between py-2 " + (ultima ? "" : "border-b border-slate-200/70")}>
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <span className="text-sm font-semibold" style={{ color: INK }}>{valor || "—"}</span>
    </div>
  )
}

function Campo({ label, icon: Icon, value, onChange, placeholder, type = "text", maxLength }) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-slate-700">{label}</label>
      <div className="relative">
        <Icon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          maxLength={maxLength}
          inputMode={maxLength ? "numeric" : undefined}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-slate-50/60 py-3 pl-10 pr-4 text-sm outline-none transition-all focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-50"
        />
      </div>
    </div>
  )
}

function BotonPrimario({ children, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-bold text-white transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      style={{ background: GRAD, boxShadow: "0 14px 28px -12px rgba(37,99,235,0.6)" }}
    >
      {children}
    </button>
  )
}

function Conector({ activo }) {
  return (
    <div className="mx-2 h-0.5 flex-1 rounded-full transition-colors sm:mx-3"
      style={{ background: activo ? GRAD : "rgba(14,43,51,0.12)" }} />
  )
}

function StepItem({ num, label, activo, completado }) {
  const activoOhecho = activo || completado
  return (
    <div className="flex items-center gap-2">
      <div
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold transition-all"
        style={
          completado
            ? { background: GRAD, color: "#fff" }
            : activo
            ? { background: GRAD, color: "#fff", boxShadow: "0 0 0 4px rgba(34,211,238,0.18)" }
            : { backgroundColor: "#e2e8f0", color: "#94a3b8" }
        }
      >
        {completado ? <Check size={14} strokeWidth={3} /> : num}
      </div>
      <span className={"hidden text-xs font-semibold sm:block " + (activoOhecho ? "text-slate-800" : "text-slate-500")}>
        {label}
      </span>
    </div>
  )
}