import React, { useState } from "react"
import { supabase } from "../lib/supabaseClient"
import {
  Eye,
  EyeOff,
  Calendar,
  CalendarCheck,
  User,
  Lock,
  ArrowRight,
  ShieldCheck,
  Activity,
  X,
  Glasses,
  Stethoscope,
  Clock,
  LogIn,
  Check,
  ChevronDown,
} from "lucide-react"

// ─── Paleta de firma (inline para no depender de config de Tailwind) ───
const INK = "#0A1420"       // navy profundo — hero y cierre
const PORCELAIN = "#F7F5F0" // fondo cálido — secciones claras
const GOLD = "#C8A24E"      // dorado — acento óptico premium, con moderación
const CYAN = "#22D3EE"      // cian — resplandor de "claridad" del iris

// Datos de muestra SOLO para la vista previa (no interactiva)
const DIAS = [
  { d: "Lun", n: 12, estado: "lleno" },
  { d: "Mar", n: 13, estado: "libre" },
  { d: "Mié", n: 14, estado: "libre", sel: true },
  { d: "Jue", n: 15, estado: "libre" },
  { d: "Vie", n: 16, estado: "lleno" },
]
const HORARIOS = [
  { t: "08:30", libre: true },
  { t: "09:15", libre: true },
  { t: "10:00", libre: true, sel: true },
  { t: "11:30", libre: false },
]
// ─── Ilustraciones de línea para cada servicio (feedback del asesor,
// 2026-08-20: "imágenes genéricas/ilustrativas, no identificables"). Mismo
// lenguaje visual que IrisOptico (línea fina, degradé cian→azul) en vez de
// fotos de stock — evita cualquier problema de identidad/derechos y combina
// con el resto de la marca.
function IlustracionExamen() {
  return (
    <svg viewBox="0 0 280 150" className="h-full w-full">
      <defs>
        <linearGradient id="ilE-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22D3EE" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
      </defs>
      {/* Paciente (silueta genérica, sin rasgos) frente al equipo de examen */}
      <circle cx="70" cy="66" r="22" fill="#0A1420" fillOpacity="0.08" />
      <path d="M50 118c2-22 15-34 20-34s18 12 20 34" fill="#0A1420" fillOpacity="0.08" />
      {/* Línea de visión */}
      <line x1="94" y1="66" x2="176" y2="66" stroke="#94A3B8" strokeWidth="1.5" strokeDasharray="3 5" />
      {/* Foróptero estilizado */}
      <circle cx="196" cy="66" r="30" fill="none" stroke="url(#ilE-g)" strokeWidth="3" />
      <circle cx="196" cy="66" r="16" fill="none" stroke="url(#ilE-g)" strokeWidth="2" strokeOpacity="0.6" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
        const r1 = 34, r2 = 40, rad = (a * Math.PI) / 180
        return (
          <line key={a} x1={196 + r1 * Math.cos(rad)} y1={66 + r1 * Math.sin(rad)} x2={196 + r2 * Math.cos(rad)} y2={66 + r2 * Math.sin(rad)} stroke="#2563EB" strokeOpacity="0.35" strokeWidth="2" />
        )
      })}
    </svg>
  )
}

function IlustracionLentes() {
  return (
    <svg viewBox="0 0 280 150" className="h-full w-full">
      <defs>
        <linearGradient id="ilL-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#A5F3FC" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
      </defs>
      {/* Par de lentes, diseño a tu medida */}
      <circle cx="102" cy="72" r="34" fill="url(#ilL-g)" fillOpacity="0.22" stroke="#2563EB" strokeWidth="3" />
      <circle cx="178" cy="72" r="34" fill="url(#ilL-g)" fillOpacity="0.22" stroke="#2563EB" strokeWidth="3" />
      <path d="M136 68c4-6 4-6 8 0" fill="none" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" />
      <path d="M68 68c-10-4-20-2-24 4" fill="none" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" />
      <path d="M212 68c10-4 20-2 24 4" fill="none" stroke="#2563EB" strokeWidth="3" strokeLinecap="round" />
      {/* Brillo */}
      <path d="M88 60c4-6 12-9 18-8" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.85" />
      {/* Cota de medida ("a tu medida") */}
      <line x1="88" y1="118" x2="192" y2="118" stroke="#C8A24E" strokeWidth="1.5" />
      <line x1="88" y1="112" x2="88" y2="124" stroke="#C8A24E" strokeWidth="1.5" />
      <line x1="192" y1="112" x2="192" y2="124" stroke="#C8A24E" strokeWidth="1.5" />
    </svg>
  )
}

function IlustracionSeguimiento() {
  return (
    <svg viewBox="0 0 280 150" className="h-full w-full">
      <defs>
        <linearGradient id="ilS-g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22D3EE" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>
      </defs>
      {/* Ficha clínica */}
      <rect x="94" y="34" width="92" height="112" rx="10" fill="#ffffff" stroke="url(#ilS-g)" strokeWidth="3" />
      <rect x="118" y="26" width="44" height="16" rx="6" fill="url(#ilS-g)" />
      {[52, 68, 84].map((y) => (
        <line key={y} x1="110" y1={y} x2="170" y2={y} stroke="#94A3B8" strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.5" />
      ))}
      {/* Evolución (línea de progreso) */}
      <polyline points="108,124 128,110 146,118 168,98" fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {[[108, 124], [128, 110], [146, 118], [168, 98]].map(([x, y]) => (
        <circle key={x} cx={x} cy={y} r="3.5" fill="#22D3EE" stroke="#2563EB" strokeWidth="1.5" />
      ))}
      {/* Recordatorio de control */}
      <circle cx="196" cy="112" r="20" fill="#ffffff" stroke="#C8A24E" strokeWidth="2.5" />
      <path d="M196 102v11l8 5" fill="none" stroke="#C8A24E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const SERVICIOS = [
  {
    icon: Stethoscope,
    ilustracion: IlustracionExamen,
    titulo: "Exámenes optométricos",
    texto: "Evaluación completa de tu salud visual con equipos de precisión.",
    features: ["Agudeza visual y refracción", "Historial clínico digital", "Detección temprana de patologías"],
  },
  {
    icon: Glasses,
    ilustracion: IlustracionLentes,
    titulo: "Monturas y lentes",
    texto: "Un catálogo pensado para tu estilo y tu graduación exacta.",
    features: ["Armazones para cada rostro", "Lentes según tu receta", "Asesoría de estilo personalizada"],
  },
  {
    icon: Activity,
    ilustracion: IlustracionSeguimiento,
    titulo: "Seguimiento personalizado",
    texto: "No te dejamos solo después de la compra: te acompañamos.",
    features: ["Seguimiento de tu próximo control visual", "Acceso a tu portal de paciente", "Atención posventa y garantía"],
  },
]
const PASOS = [
  { n: "01", titulo: "Elige el motivo", texto: "Cuéntanos si es un examen, una molestia o la compra de tus lentes." },
  { n: "02", titulo: "Escoge fecha y hora", texto: "Ves la disponibilidad real del optómetra y reservas tu espacio." },
  { n: "03", titulo: "Recibe tu código", texto: "Te damos un comprobante con día, hora y profesional. Sin crear cuenta." },
]

// ─── Elemento de firma: iris / lente óptico dibujado a mano ───
function IrisOptico() {
  return (
    <div className="relative mx-auto aspect-square w-full max-w-md">
      {/* Resplandor ambiental */}
      <div
        className="lg-glow absolute inset-0 rounded-full blur-2xl"
        style={{ background: "radial-gradient(circle at 50% 50%, rgba(34,211,238,0.35), rgba(46,107,255,0.15) 45%, transparent 70%)" }}
      />
      <svg viewBox="0 0 400 400" className="relative h-full w-full">
        <defs>
          <radialGradient id="iris" cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor="#A5F3FC" />
            <stop offset="30%" stopColor="#38BDF8" />
            <stop offset="65%" stopColor="#2563EB" />
            <stop offset="100%" stopColor="#0A1420" />
          </radialGradient>
          <radialGradient id="pupila" cx="42%" cy="38%" r="65%">
            <stop offset="0%" stopColor="#0B1830" />
            <stop offset="100%" stopColor="#020509" />
          </radialGradient>
        </defs>

        {/* Anillos de refracción exteriores */}
        {[196, 176, 156].map((r, i) => (
          <circle key={r} cx="200" cy="200" r={r} fill="none" stroke="#38BDF8" strokeWidth="1" strokeOpacity={0.06 + i * 0.02} />
        ))}

        {/* Anillo de medición (gira lento) — evoca un instrumento óptico */}
        <g className="lg-spin" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
          <circle cx="200" cy="200" r="150" fill="none" stroke="#ffffff" strokeOpacity="0.14" strokeWidth="1" strokeDasharray="2 8" />
          {Array.from({ length: 60 }).map((_, i) => {
            const major = i % 5 === 0
            const rad = (i * 6 * Math.PI) / 180
            const r1 = major ? 138 : 143
            const r2 = 150
            return (
              <line
                key={i}
                x1={200 + r1 * Math.cos(rad)}
                y1={200 + r1 * Math.sin(rad)}
                x2={200 + r2 * Math.cos(rad)}
                y2={200 + r2 * Math.sin(rad)}
                stroke="#ffffff"
                strokeOpacity={major ? 0.35 : 0.15}
                strokeWidth={major ? 1.4 : 0.8}
              />
            )
          })}
        </g>

        {/* Disco del iris */}
        <circle cx="200" cy="200" r="116" fill="url(#iris)" />

        {/* Fibras del iris (gira muy lento en sentido inverso) */}
        <g className="lg-spin-rev" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
          {Array.from({ length: 90 }).map((_, i) => {
            const rad = (i * 4 * Math.PI) / 180
            const long = i % 5 === 0
            const r1 = 50
            const r2 = long ? 114 : 104
            return (
              <line
                key={i}
                x1={200 + r1 * Math.cos(rad)}
                y1={200 + r1 * Math.sin(rad)}
                x2={200 + r2 * Math.cos(rad)}
                y2={200 + r2 * Math.sin(rad)}
                stroke="#E0F2FE"
                strokeWidth={long ? 1.1 : 0.6}
                strokeOpacity={long ? 0.45 : 0.2}
                strokeLinecap="round"
              />
            )
          })}
        </g>

        {/* Borde brillante del iris */}
        <circle cx="200" cy="200" r="116" fill="none" stroke="#A5F3FC" strokeOpacity="0.5" strokeWidth="1.5" />

        {/* Pupila */}
        <circle cx="200" cy="200" r="50" fill="url(#pupila)" />
        <circle cx="200" cy="200" r="50" fill="none" stroke="#0A1420" strokeWidth="3" />
        {/* Reflejo (catchlight) */}
        <circle cx="182" cy="182" r="12" fill="#ffffff" fillOpacity="0.85" />
        <circle cx="214" cy="210" r="5" fill="#ffffff" fillOpacity="0.4" />
      </svg>
    </div>
  )
}

export default function Login({ pacientes = [], asistentes = [], AlTenerExito = () => {}, AlIrARegistro = () => {} }) {
  const [usuario, setUsuario] = useState("")
  const [password, setPassword] = useState("")
  const [verPassword, setVerPassword] = useState(false)
  const [mostrarModal, setMostrarModal] = useState(false)
  const [errorLogin, setErrorLogin] = useState("")
  const [enviando, setEnviando] = useState(false)

  const abrirLogin = () => {
    setErrorLogin("")
    setMostrarModal(true)
  }

  const manejarEnvio = async (e) => {
    e.preventDefault()
    if (enviando) return
    setErrorLogin("")
    setEnviando(true)
    try {
      const u = usuario.trim().toLowerCase()

      // Perfiles de asistente/secretaria: creados por el administrador desde el panel.
      const asistente = asistentes.find((a) => a.usuario.toLowerCase() === u && a.clave === password)
      if (asistente) {
        AlTenerExito({ ...asistente, rol: "asistente" })
        return
      }

      // Acceso de demostración fijo para el portal del paciente: como el
      // sistema todavía no tiene backend, las cuentas creadas desde Pacientes
      // solo viven en localStorage y se pierden entre navegadores/perfiles.
      // Este acceso siempre funciona, sin depender de ese estado.
      if (u === "paciente@gmail.com" && password === "123456") {
        const demo = pacientes.find((p) => p.nombre === "María Elena Anchundia") || {
          id: 2,
          nombre: "María Elena Anchundia",
          cedula: "1309876546",
          telefono: "0991234567",
          correo: "maria@ejemplo.com",
          fecha_nacimiento: "1985-03-15",
        }
        AlTenerExito({ ...demo, rol: "paciente" })
        return
      }

      const paciente = pacientes.find(
        (p) => p.tieneCuenta && (p.usuario || p.cedula) === usuario.trim() && p.claveTemporal === password
      )

      if (paciente) {
        AlTenerExito({ ...paciente, rol: "paciente" })
        return
      }

      // Superadmin / admin por óptica: cuentas reales en Supabase Auth.
      // `supabase` es null si aún no se configuró .env.local (ver supabaseClient.js).
      const { data, error } = supabase
        ? await supabase.auth.signInWithPassword({ email: usuario.trim(), password })
        : { data: null, error: true }
      if (!error && data?.user) {
        const { data: perfil } = await supabase.from("perfiles").select("*").eq("id", data.user.id).single()
        if (perfil?.rol === "superadmin") {
          AlTenerExito({ rol: "superadmin", nombre: perfil.nombre, id: perfil.id })
          return
        }
        if (perfil?.rol === "admin") {
          const { data: optica } = await supabase.from("opticas").select("*").eq("id", perfil.optica_id).single()
          if (optica && !optica.activa) {
            await supabase.auth.signOut()
            setErrorLogin("Esta óptica fue suspendida. Contacta al administrador del sistema para reactivarla.")
            return
          }
          AlTenerExito({
            rol: "admin",
            nombre: perfil.nombre,
            id: perfil.id,
            opticaId: perfil.optica_id,
            opticaNombre: optica?.nombre,
          })
          return
        }
      }

      setErrorLogin("Usuario o contraseña incorrectos. Verifica tus datos o pídelos de nuevo al optómetra.")
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div
      className="relative flex min-h-screen w-full flex-col font-sans text-slate-800 antialiased selection:bg-cyan-200 selection:text-slate-900"
      style={{ backgroundColor: PORCELAIN }}
    >
      {/* ─── ESTILOS DE FIRMA ─── */}
      <style>{`
        html { scroll-behavior: smooth; }
        @keyframes lgFocus { from { filter: blur(16px); opacity: 0; } to { filter: blur(0); opacity: 1; } }
        @keyframes lgRise  { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
        @keyframes lgSpin    { to { transform: rotate(360deg); } }
        @keyframes lgSpinRev { to { transform: rotate(-360deg); } }
        @keyframes lgGlow  { 0%,100% { opacity: 0.75; transform: scale(1); } 50% { opacity: 1; transform: scale(1.04); } }
        @keyframes lgNudge { 0%,100% { transform: translateY(0); } 50% { transform: translateY(4px); } }
        .lg-focus { animation: lgFocus 1.1s cubic-bezier(0.2,0.7,0.2,1) both; }
        .lg-rise  { animation: lgRise 0.8s ease-out both; }
        .lg-spin     { animation: lgSpin 48s linear infinite; }
        .lg-spin-rev { animation: lgSpinRev 90s linear infinite; }
        .lg-glow  { animation: lgGlow 6s ease-in-out infinite; }
        .lg-nudge { animation: lgNudge 1.8s ease-in-out infinite; }
        .lg-d1 { animation-delay: .05s; } .lg-d2 { animation-delay: .18s; }
        .lg-d3 { animation-delay: .31s; } .lg-d4 { animation-delay: .44s; }
        @media (prefers-reduced-motion: reduce) {
          html { scroll-behavior: auto; }
          .lg-focus,.lg-rise,.lg-spin,.lg-spin-rev,.lg-glow,.lg-nudge { animation: none !important; }
        }
      `}</style>

      {/* ─── NAVBAR (persistente, oscuro) ─── */}
      <header
        className="sticky top-0 z-40 flex w-full items-center justify-between border-b px-6 py-4 backdrop-blur-md md:px-12"
        style={{ backgroundColor: "rgba(10,20,32,0.97)", borderColor: "rgba(255,255,255,0.08)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="grid h-11 w-11 place-items-center rounded-xl text-white"
            style={{ background: "linear-gradient(135deg,#22D3EE,#2563EB)", boxShadow: "0 8px 24px -8px rgba(34,211,238,0.6)" }}
          >
            <Eye size={22} strokeWidth={2.2} />
          </div>
          <div className="leading-tight">
            <span className="text-xl font-bold tracking-tight text-white">
              Diego <span style={{ color: CYAN }}>Óptica</span>
            </span>
            <p className="text-xs font-medium tracking-wide text-white/50">SALUD VISUAL &amp; CRM</p>
          </div>
        </div>

        <button
          onClick={abrirLogin}
          className="flex items-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
          style={{ borderColor: "rgba(255,255,255,0.22)", backgroundColor: "rgba(255,255,255,0.04)" }}
        >
          <LogIn size={16} />
          Iniciar sesión
        </button>
      </header>

      {/* ─── HERO (claro — el tono oscuro contradecía el mensaje de "claridad") ─── */}
      <section className="relative overflow-hidden" style={{ backgroundColor: PORCELAIN }}>
        {/* Halos de fondo */}
        <div
          className="pointer-events-none absolute -left-40 top-0 h-[36rem] w-[36rem] rounded-full opacity-70 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(46,107,255,0.14), transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute right-0 top-1/3 h-[30rem] w-[30rem] rounded-full opacity-60 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(34,211,238,0.12), transparent 70%)" }}
        />

        <div className="relative z-10 mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-6 py-16 md:px-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8 lg:py-24">
          {/* Texto */}
          <div className="flex flex-col gap-7 text-left">
            <span className="lg-rise lg-d1 inline-flex w-fit items-center gap-2.5 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-slate-600">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: GOLD }} />
              Óptica &amp; consultorio optométrico
            </span>

            <h1 className="font-serif text-5xl font-bold leading-[1.04] tracking-tight sm:text-6xl lg:text-7xl" style={{ color: INK }}>
              Ve el mundo
              <br />
              <span className="lg-focus" style={{ color: "#2563EB" }}>con claridad.</span>
            </h1>

            <p className="lg-rise lg-d2 max-w-xl text-lg leading-relaxed text-slate-600">
              En Diego Óptica cuidamos tu salud visual de principio a fin: examen de precisión, lentes
              a tu medida y un acompañamiento cercano después de tu compra.
            </p>

            <div className="lg-rise lg-d3 flex flex-col items-start gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={AlIrARegistro}
                  className="group flex items-center justify-center gap-2.5 rounded-2xl px-8 py-4 text-lg font-semibold text-white transition-all hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 cursor-pointer"
                  style={{ background: "linear-gradient(135deg,#22D3EE,#2563EB)", boxShadow: "0 18px 40px -12px rgba(37,99,235,0.4)" }}
                >
                  <Calendar size={20} />
                  Solicita tu cita ahora
                  <ArrowRight size={20} className="transition-transform group-hover:translate-x-1" />
                </button>
                <a
                  href="#servicios"
                  className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-4 text-base font-semibold text-slate-700 transition-all hover:-translate-y-0.5 hover:border-slate-300 cursor-pointer"
                >
                  Conoce nuestros servicios
                  <ChevronDown size={18} className="lg-nudge" style={{ color: "#2563EB" }} />
                </a>
              </div>
              <button
                type="button"
                onClick={abrirLogin}
                className="text-sm font-medium text-slate-500 underline-offset-4 transition-colors hover:text-slate-800 hover:underline cursor-pointer"
              >
                ¿Ya tienes cuenta? Inicia sesión
              </button>
            </div>

            {/* Confianza sutil */}
            <div className="lg-rise lg-d4 mt-2 flex flex-wrap gap-x-7 gap-y-3">
              {[
                { icon: ShieldCheck, txt: "Datos protegidos" },
                { icon: Clock, txt: "Confirmación inmediata" },
                { icon: User, txt: "Portal del paciente" },
              ].map((c) => (
                <span key={c.txt} className="flex items-center gap-2 text-sm font-medium text-slate-600">
                  <c.icon size={16} style={{ color: "#2563EB" }} />
                  {c.txt}
                </span>
              ))}
            </div>
          </div>

          {/* Firma: iris óptico */}
          <div className="lg-rise lg-d2 order-first lg:order-last">
            <IrisOptico />
          </div>
        </div>

      </section>

      {/* ─── SERVICIOS: EL ENGANCHE ─── */}
      <section id="servicios" className="relative z-10 mx-auto w-full max-w-6xl scroll-mt-24 px-6 pt-12 md:px-12 lg:pt-16">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: GOLD }} />
            Nuestros servicios
          </span>
          <h2 className="mt-4 font-serif text-3xl font-bold leading-tight tracking-tight sm:text-4xl" style={{ color: INK }}>
            Todo lo que tu visión necesita, en un solo lugar
          </h2>
          <p className="mt-3 text-base leading-relaxed text-slate-600">
            Desde el examen hasta la entrega de tus lentes, acompañamos cada etapa con tecnología,
            historial digital y seguimiento cercano.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          {SERVICIOS.map((s) => (
            <div
              key={s.titulo}
              className="group relative flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white p-7 transition-all duration-300 hover:-translate-y-1.5 hover:border-blue-200 hover:shadow-2xl hover:shadow-blue-100/60"
            >
              <span
                className="absolute inset-x-0 top-0 h-1 origin-left scale-x-0 transition-transform duration-300 group-hover:scale-x-100"
                style={{ backgroundColor: GOLD }}
              />
              <div className="-mx-7 -mt-7 mb-1 h-32 overflow-hidden bg-slate-50">
                <s.ilustracion />
              </div>
              <div
                className="-mt-9 grid h-14 w-14 place-items-center rounded-2xl text-white"
                style={{ background: "linear-gradient(135deg,#22D3EE,#2563EB)", boxShadow: "0 12px 24px -10px rgba(37,99,235,0.6)" }}
              >
                <s.icon size={24} />
              </div>
              <h3 className="mt-5 text-lg font-bold" style={{ color: INK }}>{s.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{s.texto}</p>
              <ul className="mt-5 flex flex-col gap-2.5 border-t border-slate-100 pt-5">
                {s.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm text-slate-600">
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-600">
                      <Check size={13} strokeWidth={3} />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ─── CÓMO FUNCIONA + VISTA PREVIA ─── */}
      <section id="como-funciona" className="relative z-10 mx-auto w-full max-w-6xl scroll-mt-24 px-6 pt-24 pb-24 md:px-12">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Pasos (secuencia real → numeración justificada) */}
          <div>
            <span className="inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: GOLD }} />
              Reservar es simple
            </span>
            <h2 className="mt-4 font-serif text-3xl font-bold leading-tight tracking-tight sm:text-4xl" style={{ color: INK }}>
              Tu cita en tres pasos, sin crear cuenta
            </h2>

            <div className="mt-8 flex flex-col gap-6">
              {PASOS.map((p, i) => (
                <div key={p.n} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <span
                      className="grid h-11 w-11 shrink-0 place-items-center rounded-xl font-mono text-sm font-bold text-white"
                      style={{ backgroundColor: INK }}
                    >
                      {p.n}
                    </span>
                    {i < PASOS.length - 1 && <span className="mt-1 w-px flex-1" style={{ backgroundColor: "rgba(11,18,32,0.12)" }} />}
                  </div>
                  <div className="pb-1">
                    <h3 className="text-base font-bold" style={{ color: INK }}>{p.titulo}</h3>
                    <p className="mt-1 text-sm leading-relaxed text-slate-500">{p.texto}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Vista previa del producto (muestra, sin botón) */}
          <div className="relative">
            <div className="-rotate-1 transition-transform duration-500 hover:rotate-0">
              <div className="overflow-hidden rounded-3xl bg-white" style={{ boxShadow: "0 40px 80px -30px rgba(11,18,32,0.35), 0 0 0 1px rgba(11,18,32,0.05)" }}>
                <div className="flex items-center gap-2 border-b px-4 py-2.5" style={{ backgroundColor: "#f1f0ec", borderColor: "rgba(11,18,32,0.06)" }}>
                  <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  <span className="ml-2 truncate text-[11px] font-medium text-slate-500">agenda · Diego Óptica</span>
                  <span className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ backgroundColor: "rgba(11,18,32,0.06)", color: "#64748b" }}>
                    Vista previa
                  </span>
                </div>

                <div className="px-7 py-5 text-white" style={{ backgroundColor: INK }}>
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-full text-sm font-bold" style={{ background: "linear-gradient(135deg,#22D3EE,#2563EB)" }}>DO</div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">Optómetra Diego</p>
                      <p className="flex items-center gap-1.5 text-xs text-white/70">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />Disponible hoy
                      </p>
                    </div>
                    <Stethoscope size={18} className="text-white/50" />
                  </div>
                </div>

                <div className="p-7">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Semana actual</p>
                  <div className="grid grid-cols-5 gap-2">
                    {DIAS.map((dia) => {
                      const lleno = dia.estado === "lleno"
                      return (
                        <div key={dia.d} className="flex flex-col items-center gap-1.5">
                          <span className="text-[11px] font-medium text-slate-500">{dia.d}</span>
                          <div
                            className={"grid h-11 w-full place-items-center rounded-xl text-sm font-bold " + (dia.sel ? "text-white" : lleno ? "text-slate-300 line-through" : "text-slate-700")}
                            style={{ backgroundColor: dia.sel ? "#2563EB" : lleno ? "#f1f0ec" : "#eef2ff" }}
                          >
                            {dia.n}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                  <div className="mt-3 flex items-center gap-4 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#c7d2fe" }} />Disponible</span>
                    <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#dcdad3" }} />Lleno</span>
                  </div>

                  <p className="mb-2.5 mt-6 text-xs font-semibold uppercase tracking-wider text-slate-500">Horarios — Mié 14</p>
                  <div className="grid grid-cols-4 gap-2">
                    {HORARIOS.map((h) => (
                      <div
                        key={h.t}
                        className={"rounded-lg border py-2 text-center text-sm font-semibold " + (h.sel ? "border-transparent text-white" : h.libre ? "border-slate-200 text-slate-700" : "border-transparent text-slate-300 line-through")}
                        style={{ backgroundColor: h.sel ? "#2563EB" : h.libre ? "#fff" : "#f1f0ec" }}
                      >
                        {h.t}
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 flex items-center gap-3 rounded-xl p-3.5" style={{ backgroundColor: "#eef2ff" }}>
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white" style={{ backgroundColor: "#2563EB" }}>
                      <CalendarCheck size={18} />
                    </div>
                    <div className="text-sm">
                      <p className="font-semibold" style={{ color: INK }}>Miércoles 14 · 10:00</p>
                      <p className="text-xs text-slate-500">Optómetra Diego · duración 30 min</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── MODAL DE INICIO DE SESIÓN ─── */}
      {mostrarModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200" role="dialog" aria-modal="true" aria-labelledby="titulo-login">
          <div onClick={() => setMostrarModal(false)} className="absolute inset-0 cursor-pointer backdrop-blur-sm" style={{ backgroundColor: "rgba(10,20,32,0.6)" }} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-2xl sm:p-8 animate-in zoom-in-95 fade-in duration-200">
            <div className="mb-6 flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: "linear-gradient(135deg,#22D3EE,#2563EB)" }}>
                  <LogIn size={20} />
                </div>
                <div>
                  <h3 id="titulo-login" className="text-xl font-bold" style={{ color: INK }}>Iniciar sesión</h3>
                  <p className="text-sm text-slate-500">Acceso para pacientes y optómetras</p>
                </div>
              </div>
              <button onClick={() => setMostrarModal(false)} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={manejarEnvio} className="flex flex-col gap-4">
              {errorLogin && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                  <X size={16} className="mt-0.5 shrink-0" />
                  {errorLogin}
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <label htmlFor="usuario" className="text-sm font-medium text-slate-700">Usuario o identificación</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input id="usuario" type="text" autoComplete="username" required value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="Cédula o nombre de usuario"
                    className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-4 text-base text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-sm font-medium text-slate-700">Contraseña</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                  <input id="password" type={verPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Tu contraseña"
                    className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-11 pr-11 text-base text-slate-900 outline-none transition-colors focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                  <button type="button" onClick={() => setVerPassword((v) => !v)} aria-label={verPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-700 cursor-pointer">
                    {verPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={enviando}
                className="mt-2 w-full rounded-xl py-3.5 text-base font-semibold text-white transition-all hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                style={{ background: "linear-gradient(135deg,#22D3EE,#2563EB)", boxShadow: "0 12px 26px -10px rgba(37,99,235,0.5)" }}>
                {enviando ? "Entrando…" : "Entrar"}
              </button>
            </form>

            <p className="mt-5 text-center text-sm leading-relaxed text-slate-500">
              ¿No tienes cuenta? Solicítala al optómetra durante tu visita.
            </p>
          </div>
        </div>
      )}

      {/* ─── FOOTER ─── */}
      <footer className="relative z-10 mt-auto overflow-hidden" style={{ backgroundColor: INK }}>
        <svg aria-hidden="true" className="pointer-events-none absolute -bottom-28 -left-24 h-96 w-96" viewBox="0 0 400 400" fill="none" stroke="#ffffff" style={{ opacity: 0.04 }}>
          {[80, 140, 200].map((r) => (<circle key={r} cx="200" cy="200" r={r} strokeWidth="1.4" />))}
        </svg>
        <div className="pointer-events-none absolute -right-16 top-0 h-56 w-56 rounded-full blur-3xl" style={{ background: "radial-gradient(circle, rgba(34,211,238,0.12), transparent 70%)" }} />

        <div className="relative mx-auto max-w-6xl px-6 py-14 md:px-12">
          <div className="flex flex-col justify-between gap-10 md:flex-row">
            {/* Marca */}
            <div className="max-w-sm">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: "linear-gradient(135deg,#22D3EE,#2563EB)", boxShadow: "0 10px 24px -8px rgba(34,211,238,0.6)" }}>
                  <Eye size={22} strokeWidth={2.2} />
                </div>
                <div className="leading-tight">
                  <p className="text-lg font-bold tracking-tight text-white">
                    Diego <span style={{ color: CYAN }}>Óptica</span>
                  </p>
                  <p className="text-[11px] font-medium tracking-wide text-white/40">SALUD VISUAL &amp; OPTOMETRÍA</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-white/50">
                Tu centro de salud visual de confianza. Exámenes de precisión, lentes a tu medida y
                seguimiento cercano después de tu compra.
              </p>
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
                <span className="flex items-center gap-1.5 text-xs text-white/50"><ShieldCheck size={14} style={{ color: CYAN }} /> Datos protegidos</span>
                <span className="flex items-center gap-1.5 text-xs text-white/50"><User size={14} style={{ color: CYAN }} /> Portal del paciente</span>
              </div>
            </div>

            {/* Enlaces + Horario */}
            <div className="grid grid-cols-2 gap-10 sm:gap-16">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: GOLD }}>Enlaces</p>
                <ul className="mt-4 space-y-2.5 text-sm text-white/60">
                  <li><a href="#servicios" className="transition-colors hover:text-white">Servicios</a></li>
                  <li><a href="#como-funciona" className="transition-colors hover:text-white">Cómo funciona</a></li>
                  <li><button type="button" onClick={abrirLogin} className="transition-colors hover:text-white cursor-pointer">Iniciar sesión</button></li>
                </ul>
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: GOLD }}>Horario</p>
                <ul className="mt-4 space-y-2.5 text-sm text-white/60">
                  <li className="flex items-center gap-2"><Clock size={14} className="text-white/30" /> Lun a Vie · 9:00–18:00</li>
                  <li className="flex items-center gap-2"><Clock size={14} className="text-white/30" /> Sábados · 9:00–13:00</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-6 text-sm text-white/40 md:flex-row">
            <p>&copy; {new Date().getFullYear()} Diego Óptica. Comprometidos con tu salud visual.</p>
            <div className="flex gap-6">
              <span className="cursor-pointer transition-colors hover:text-white/80">Términos</span>
              <span className="cursor-pointer transition-colors hover:text-white/80">Privacidad</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
