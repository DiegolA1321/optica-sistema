import React, { useEffect, useState } from "react"
import { supabase } from "../lib/supabaseClient"
import { filtrarSoloLetras, filtrarSoloNumeros, esNombreValido, esEmailValido } from "../utilidades/validaciones"
import { irALegal } from "../utilidades/resolverSitio"
import {
  Eye,
  Users,
  Calendar,
  Stethoscope,
  MessageSquare,
  BarChart3,
  ShieldCheck,
  Check,
  ArrowRight,
  X,
  AlertTriangle,
  Loader2,
  ClipboardList,
  MonitorSmartphone,
  Rocket,
  Clock,
  Sparkles,
  Compass,
  LayoutGrid,
  Tag,
  Menu,
  FileText,
  Activity,
  UserCheck,
  RefreshCw,
  Globe,
  Palette,
  UserCog,
  Lock,
} from "lucide-react"

const NAV_LINKS = [
  { href: "#como-funciona", label: "Cómo funciona", icon: Compass },
  { href: "#funciones", label: "Funciones", icon: LayoutGrid },
  { href: "#plan", label: "Plan", icon: Tag },
]

// ─── Paleta de firma (misma que el resto del sistema) ───
const INK = "#0E2B33"
const PORCELAIN = "#F7F5F0"
const GOLD = "#C8A24E"
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)"

function MockHistorial() {
  return (
    <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold" style={{ color: INK }}>Historial · María G.</span>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600">↓ Mejoró</span>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2 text-center">
        <div className="rounded-lg bg-white py-1.5">
          <p className="text-[10px] font-semibold text-slate-400">OD</p>
          <p className="text-sm font-bold" style={{ color: INK }}>-2.00</p>
        </div>
        <div className="rounded-lg bg-white py-1.5">
          <p className="text-[10px] font-semibold text-slate-400">OI</p>
          <p className="text-sm font-bold" style={{ color: INK }}>-1.75</p>
        </div>
      </div>
    </div>
  )
}

function MockInventario() {
  const items = [
    { nombre: "Armazón Aviator", pct: 18, estado: "Stock bajo", color: "#DC2626" },
    { nombre: "Lentes progresivos", pct: 64, estado: "OK", color: "#0EA5A0" },
  ]
  return (
    <div className="mt-5 space-y-2.5 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
      {items.map((it) => (
        <div key={it.nombre}>
          <div className="flex items-center justify-between text-[11px] font-semibold" style={{ color: INK }}>
            <span>{it.nombre}</span>
            <span style={{ color: it.color }}>{it.estado}</span>
          </div>
          <div className="mt-1 h-1.5 rounded-full bg-slate-200">
            <div className="h-1.5 rounded-full" style={{ width: `${it.pct}%`, backgroundColor: it.color }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function MockCRM() {
  return (
    <div className="mt-5 flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-50 text-base">🎂</span>
      <div>
        <p className="text-xs font-bold" style={{ color: INK }}>3 cumpleaños esta semana</p>
        <p className="text-[11px] text-slate-500">Recordatorio listo para enviar</p>
      </div>
    </div>
  )
}

// ─── Vitrina de módulos: una sección grande y alternada por módulo real del
// sistema (inspirado en cómo sistemaoptica.com presenta cada función a fondo,
// en vez de una sola grilla apretada de tarjetas). "mock" reutiliza las
// vistas previas ya existentes; "chips" arma una grilla de sub-funciones
// cuando no hay una vista previa dedicada.
const MODULOS = [
  {
    icon: Users,
    titulo: "Historiales que no viven en un cuaderno",
    texto: "Ficha clínica completa de cada paciente: medidas de corrección, evolución de cada control y datos de contacto, siempre a un clic.",
    dark: false,
    mock: MockHistorial,
    etiqueta: "historial · María G.",
    grad: "linear-gradient(135deg,#22D3EE,#2563EB)",
    glow: "rgba(37,99,235,0.55)",
    accent: "#2563EB",
  },
  {
    icon: Calendar,
    titulo: "Tu agenda real, sin choques de horario",
    texto: "Reservas con y sin cuenta de paciente, conectadas al horario real del optómetra — con confirmación por código y control de asistencia.",
    dark: true,
    grad: "linear-gradient(135deg,#34D399,#0D9488)",
    glow: "rgba(13,148,136,0.5)",
    accent: "#2DD4BF",
    chips: [
      { icon: Calendar, txt: "Reservas con y sin cuenta" },
      { icon: Clock, txt: "Horario real del optómetra" },
      { icon: Check, txt: "Confirmación por código" },
      { icon: UserCheck, txt: "Control de asistencia" },
    ],
  },
  {
    icon: Stethoscope,
    titulo: "Consulta médica digital",
    texto: "Retinoscopia, refracción y transposición en un flujo guiado, con receta imprimible y el historial del paciente siempre a mano.",
    dark: false,
    grad: "linear-gradient(135deg,#A78BFA,#7C3AED)",
    glow: "rgba(124,58,237,0.45)",
    accent: "#7C3AED",
    chips: [
      { icon: Stethoscope, txt: "Retinoscopia y refracción" },
      { icon: RefreshCw, txt: "Transposición automática" },
      { icon: FileText, txt: "Receta en PDF" },
      { icon: Activity, txt: "Diagnósticos guiados" },
    ],
  },
  {
    icon: MessageSquare,
    titulo: "El seguimiento que antes se olvidaba",
    texto: "Recordatorios de cita, saludos de cumpleaños y avisos de pago, enviados automáticamente — sin que nadie tenga que acordarse de hacerlo a mano.",
    dark: true,
    mock: MockCRM,
    etiqueta: "CRM · recordatorios",
    grad: `linear-gradient(135deg,#FCD34D,${GOLD})`,
    glow: "rgba(200,162,78,0.5)",
    accent: "#F0B429",
  },
  {
    icon: BarChart3,
    titulo: "Sabés exactamente qué tenés y qué vendés",
    texto: "Stock de armazones y lentes con alertas de reabastecimiento, y reportes claros de ingresos y consultas para decidir con datos reales.",
    dark: false,
    mock: MockInventario,
    etiqueta: "inventario · stock",
    grad: "linear-gradient(135deg,#FB7185,#E11D48)",
    glow: "rgba(225,29,72,0.4)",
    accent: "#E11D48",
  },
  {
    icon: ShieldCheck,
    titulo: "Tu óptica, con tu marca — no la nuestra",
    texto: "Tu propio link, tu logo y tus colores. Cada persona del equipo entra con su rol y sus permisos, y los datos de tu óptica quedan completamente aislados de cualquier otra.",
    dark: true,
    grad: "linear-gradient(135deg,#22D3EE,#2563EB)",
    glow: "rgba(37,99,235,0.55)",
    accent: "#67E8F9",
    chips: [
      { icon: Globe, txt: "Tu propio link" },
      { icon: Palette, txt: "Logo y colores propios" },
      { icon: UserCog, txt: "Roles con permisos" },
      { icon: Lock, txt: "Datos aislados por óptica" },
    ],
  },
]

const PASOS = [
  {
    numero: "01",
    icon: ClipboardList,
    titulo: "Contanos sobre tu óptica",
    texto: "Completás un formulario breve con los datos de tu óptica y los tuyos. No es una compra automática — es el primer contacto.",
  },
  {
    numero: "02",
    icon: MonitorSmartphone,
    titulo: "Te mostramos el sistema completo",
    texto: "Te contactamos para ver juntos cada módulo en vivo y armar un plan a la medida de tu óptica.",
  },
  {
    numero: "03",
    icon: Rocket,
    titulo: "Empezás a usarlo con tu marca",
    texto: "Recibís tu propio link, con tu logo y tus colores, listo para que tus pacientes agenden y vos gestiones todo.",
  },
]

const AGENDA_DEMO = [
  { hora: "09:00", paciente: "María G.", motivo: "Control", color: "#0EA5A0" },
  { hora: "09:30", paciente: "Luis R.", motivo: "Medición", color: "#2563EB" },
  { hora: "10:15", paciente: "Carla P.", motivo: "Compra de lentes", color: "#C8A24E" },
  { hora: "11:00", paciente: "Andrés T.", motivo: "Consulta", color: "#0EA5A0" },
]

const CONFIANZA = [
  { icon: ShieldCheck, txt: "Sin instalar nada" },
  { icon: Sparkles, txt: "Tu propia marca" },
  { icon: Clock, txt: "Soporte humano, no un bot" },
]

const ANTES = [
  "Turnos anotados en un cuaderno o Excel suelto",
  "Recordatorios manuales, uno por uno, por WhatsApp",
  "Historial clínico en papel, difícil de rastrear",
  "Nadie sabe con certeza qué stock queda",
]

const DESPUES = [
  "Una sola agenda, sin choques de horario",
  "Reservas online, con y sin cuenta de paciente",
  "Historial digital completo, siempre a mano",
  "Alertas automáticas cuando el stock baja",
]

const camposIniciales = { nombreOptica: "", slugDeseado: "", nombreAdmin: "", emailAdmin: "", telefono: "", mensaje: "" }

function Eyebrow({ children, dark = false }) {
  return (
    <span className={`inline-flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.18em] ${dark ? "text-white/60" : "text-slate-500"}`}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: GOLD }} />
      {children}
    </span>
  )
}

// ─── Vista previa "de navegador" reutilizada en la vitrina de módulos —
// mismo lenguaje visual que la sección de capturas reales, para que un mock
// pequeño no se sienta como un elemento distinto al resto de la página.
function PanelVistaPrevia({ etiqueta, children }) {
  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white" style={{ boxShadow: "0 30px 60px -24px rgba(14,43,51,0.4)" }}>
      <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
        <span className="ml-2 truncate text-[11px] font-medium text-slate-400">{etiqueta}</span>
      </div>
      <div className="p-5 [&>div]:mt-0">{children}</div>
    </div>
  )
}

// ─── Grilla de sub-funciones (para módulos sin una vista previa dedicada) —
// mismo formato "chip" en claro u oscuro según la sección donde caiga.
function ChipsModulo({ chips, dark, accent }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {chips.map((c) => (
        <div
          key={c.txt}
          className={"flex items-center gap-3 rounded-2xl border px-4 py-3.5 text-sm font-semibold " + (dark ? "border-white/15 bg-white/[0.06] text-white/90" : "border-slate-200 bg-white text-slate-700")}
        >
          <c.icon size={17} className="shrink-0" style={{ color: accent }} />
          {c.txt}
        </div>
      ))}
    </div>
  )
}

export default function PaginaVenta() {
  const [modalAbierto, setModalAbierto] = useState(false)
  const [campos, setCampos] = useState(camposIniciales)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState("")
  const [enviado, setEnviado] = useState(false)
  const [menuMovilAbierto, setMenuMovilAbierto] = useState(false)

  useEffect(() => {
    supabase?.rpc("registrar_visita", { p_tipo: "venta" }).then(() => {})
  }, [])

  const actualizarCampo = (clave, valor) => setCampos((prev) => ({ ...prev, [clave]: valor }))

  const abrirModal = () => {
    setCampos(camposIniciales)
    setError("")
    setEnviado(false)
    setModalAbierto(true)
  }
  const cerrarModal = () => { if (!enviando) setModalAbierto(false) }

  const enviarSolicitud = async (e) => {
    e.preventDefault()
    setError("")
    if (!campos.nombreOptica.trim()) {
      setError("Completa el nombre de la óptica.")
      return
    }
    if (!esNombreValido(campos.nombreAdmin)) { setError("Ingresa tu nombre válido (solo letras)."); return }
    if (!esEmailValido(campos.emailAdmin, false)) { setError("Ingresa un correo válido (ej. nombre@dominio.com)."); return }
    setEnviando(true)
    const { error: errorInsert } = await supabase.rpc("crear_lead", {
      p_nombre_optica: campos.nombreOptica.trim(),
      p_slug_deseado: campos.slugDeseado.trim() || null,
      p_nombre_admin: campos.nombreAdmin.trim(),
      p_email_admin: campos.emailAdmin.trim(),
      p_telefono: campos.telefono.trim() || null,
      p_mensaje: campos.mensaje.trim() || null,
    })
    setEnviando(false)
    if (errorInsert) {
      setError("No se pudo enviar la solicitud. Intenta de nuevo en unos minutos.")
      return
    }
    setEnviado(true)
  }

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: PORCELAIN }}>
      <style>{`
        html { scroll-behavior: smooth; }
        @keyframes pvRise { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
        .pv-rise { animation: pvRise 0.8s ease-out both; }
        .pv-d1 { animation-delay: .05s; } .pv-d2 { animation-delay: .18s; }
        .pv-d3 { animation-delay: .31s; } .pv-d4 { animation-delay: .44s; }
        @media (prefers-reduced-motion: reduce) { .pv-rise { animation: none !important; } }
      `}</style>

      {/* ─── NAV ─── */}
      <header className="sticky top-0 z-20" style={{ backgroundColor: "rgba(14,43,51,0.97)" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 md:px-12">
          <div className="flex items-center gap-2.5">
            <div className="grid h-9 w-9 place-items-center rounded-xl text-white" style={{ background: GRAD }}>
              <Eye size={18} />
            </div>
            <span className="font-heading text-lg font-extrabold tracking-tight text-white">Sistema Óptica</span>
          </div>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="group relative flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-white/70 transition hover:text-white"
              >
                <l.icon size={15} className="opacity-70 transition group-hover:opacity-100" />
                {l.label}
                <span className="pointer-events-none absolute inset-x-3 -bottom-0.5 h-0.5 origin-left scale-x-0 rounded-full transition-transform duration-300 group-hover:scale-x-100" style={{ backgroundColor: GOLD }} />
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={abrirModal}
              className="hidden items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 cursor-pointer sm:flex"
              style={{ background: GRAD, boxShadow: "0 12px 24px -12px rgba(37,99,235,0.6)" }}
            >
              Obtener sistema <ArrowRight size={15} />
            </button>
            <button
              type="button"
              onClick={() => setMenuMovilAbierto((v) => !v)}
              aria-label={menuMovilAbierto ? "Cerrar menú" : "Abrir menú"}
              className="grid h-10 w-10 place-items-center rounded-xl text-white transition-colors hover:bg-white/10 cursor-pointer md:hidden"
            >
              {menuMovilAbierto ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {menuMovilAbierto && (
          <div className="border-t border-white/10 px-6 pb-5 pt-2 md:hidden" style={{ backgroundColor: "rgba(14,43,51,0.97)" }}>
            <nav className="flex flex-col gap-1">
              {NAV_LINKS.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={() => setMenuMovilAbierto(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/5 hover:text-white"
                >
                  <l.icon size={16} className="opacity-70" />
                  {l.label}
                </a>
              ))}
            </nav>
            <button
              type="button"
              onClick={() => { setMenuMovilAbierto(false); abrirModal() }}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all cursor-pointer sm:hidden"
              style={{ background: GRAD, boxShadow: "0 12px 24px -12px rgba(37,99,235,0.6)" }}
            >
              Obtener sistema <ArrowRight size={15} />
            </button>
          </div>
        )}
      </header>

      {/* ─── HERO (claro — el tono oscuro contradice el mensaje de "claridad") ─── */}
      <section className="relative overflow-hidden px-6 pb-24 pt-16 md:px-12 md:pb-32 md:pt-20" style={{ backgroundColor: PORCELAIN }}>
        <div
          className="pointer-events-none absolute -left-40 -top-40 h-[30rem] w-[30rem] rounded-full opacity-70 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(46,107,255,0.14), transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute right-0 top-1/3 h-96 w-96 rounded-full opacity-60 blur-3xl"
          style={{ background: "radial-gradient(circle, rgba(34,211,238,0.12), transparent 70%)" }}
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <span className="pv-rise pv-d1 inline-flex w-fit items-center gap-2.5 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-bold uppercase tracking-[0.16em] text-slate-600">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: GOLD }} />
              Gestión clínica y de citas para ópticas
            </span>
            <h1 className="pv-rise pv-d2 mt-5 font-heading text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl" style={{ color: INK }}>
              El sistema web para gestionar tu óptica, de principio a fin
            </h1>
            <p className="pv-rise pv-d2 mt-5 max-w-xl text-base leading-relaxed text-slate-600">
              Pacientes, citas, consultas clínicas, inventario y fidelización — todo en un solo panel,
              con tu propia marca y tu propio link para tus pacientes.
            </p>
            <div className="pv-rise pv-d3 mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#como-funciona"
                className="inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 cursor-pointer"
                style={{ background: GRAD, boxShadow: "0 16px 32px -12px rgba(37,99,235,0.6)" }}
              >
                Ver cómo funciona <ArrowRight size={16} />
              </a>
            </div>
            <div className="pv-rise pv-d4 mt-8 flex flex-wrap gap-x-7 gap-y-3">
              {CONFIANZA.map((c) => (
                <span key={c.txt} className="flex items-center gap-2 text-sm font-medium text-slate-600">
                  <c.icon size={16} style={{ color: "#2563EB" }} />
                  {c.txt}
                </span>
              ))}
            </div>
          </div>

          {/* Mini-mockup de la agenda real del sistema */}
          <div className="pv-rise pv-d3 relative">
            <div className="relative rounded-3xl border border-slate-200 bg-white p-5 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <p className="text-sm font-bold" style={{ color: INK }}>Agenda de hoy</p>
                  <p className="text-xs text-slate-400">Miércoles 26 de agosto</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-600">4 citas</span>
              </div>
              <ul className="mt-3 space-y-2.5">
                {AGENDA_DEMO.map((c) => (
                  <li
                    key={c.hora}
                    className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/70 py-2.5 pl-3 pr-3.5"
                    style={{ borderLeft: `3px solid ${c.color}` }}
                  >
                    <span className="text-xs font-bold tabular-nums text-slate-500">{c.hora}</span>
                    <span className="flex-1 truncate text-sm font-semibold" style={{ color: INK }}>{c.paciente}</span>
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: c.color }}>
                      {c.motivo}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 px-3.5 py-2.5">
                <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Tu link</span>
                <span className="text-xs font-bold" style={{ color: INK }}>tuoptica.tudominio.com</span>
              </div>
            </div>
            <div className="absolute -right-5 top-16 hidden items-center gap-2.5 rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-lg sm:flex">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-600">
                <Check size={14} strokeWidth={3} />
              </span>
              <div className="leading-tight">
                <p className="text-[11px] font-bold" style={{ color: INK }}>Recordatorio enviado</p>
                <p className="text-[10px] text-slate-400">a Luis R.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── ANTES / DESPUÉS ─── */}
      <section className="mx-auto max-w-5xl px-6 py-20 md:px-12">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>El cambio real</Eyebrow>
          <h2 className="mt-4 font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl" style={{ color: INK }}>
            De administrar a los saltos, a tenerlo todo bajo control
          </h2>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-8">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">Sin sistema</span>
            <ul className="mt-5 flex flex-col gap-4">
              {ANTES.map((t) => (
                <li key={t} className="flex items-start gap-3 text-sm leading-relaxed text-slate-500">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-400">
                    <X size={12} strokeWidth={3} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl p-8 text-white" style={{ background: INK }}>
            <span className="text-xs font-bold uppercase tracking-[0.16em]" style={{ color: GOLD }}>Con Sistema Óptica</span>
            <ul className="mt-5 flex flex-col gap-4">
              {DESPUES.map((t) => (
                <li key={t} className="flex items-start gap-3 text-sm leading-relaxed text-white/85">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full" style={{ backgroundColor: GOLD, color: INK }}>
                    <Check size={12} strokeWidth={3} />
                  </span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ─── CÓMO FUNCIONA ─── */}
      <section id="como-funciona" className="mx-auto max-w-6xl scroll-mt-24 px-6 py-20 md:px-12">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>Cómo funciona</Eyebrow>
          <h2 className="mt-4 font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl" style={{ color: INK }}>
            De la solicitud a tu primer paciente
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            No es un self-service anónimo: un humano te acompaña en cada paso.
          </p>
        </div>

        <div className="relative mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="pointer-events-none absolute left-0 right-0 top-[3.7rem] hidden border-t-2 border-dashed border-slate-200 md:block" />
          {PASOS.map((p) => (
            <div key={p.numero} className="relative rounded-3xl border border-slate-200 bg-white p-7">
              <div className="flex items-center justify-between">
                <span className="font-heading text-3xl font-bold text-slate-200">{p.numero}</span>
                <div className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: GRAD }}>
                  <p.icon size={19} />
                </div>
              </div>
              <h3 className="mt-5 text-lg font-bold" style={{ color: INK }}>{p.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{p.texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── VITRINA DE MÓDULOS ───
          Una sección grande y alternada (fondo claro/oscuro) por cada módulo
          real del sistema, en vez de una sola grilla apretada — el mismo
          formato "vitrina de producto" que sistemaoptica.com usa en su
          página completa. */}
      <div id="funciones" className="scroll-mt-24">
        <div className="mx-auto max-w-2xl px-6 pt-20 text-center md:px-12">
          <Eyebrow>Todo lo que necesita tu óptica</Eyebrow>
          <h2 className="mt-4 font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl" style={{ color: INK }}>
            Un solo sistema, sin cuadernos ni hojas de cálculo sueltas
          </h2>
        </div>

        {MODULOS.map((m, i) => (
          <section
            key={m.titulo}
            className="relative overflow-hidden px-6 py-16 md:px-12 md:py-20"
            style={{ backgroundColor: m.dark ? INK : PORCELAIN }}
          >
            {m.dark && (
              <div className="pointer-events-none absolute -right-24 top-0 h-80 w-80 rounded-full opacity-70 blur-3xl" style={{ background: "radial-gradient(circle, rgba(34,211,238,0.16), transparent 70%)" }} />
            )}
            <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
              <div className={i % 2 === 1 ? "lg:order-2" : ""}>
                <Eyebrow dark={m.dark}>Módulo {String(i + 1).padStart(2, "0")}</Eyebrow>
                <div className="mt-4 flex items-center gap-3.5">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white" style={{ background: m.grad, boxShadow: `0 12px 24px -10px ${m.glow}` }}>
                    <m.icon size={22} />
                  </div>
                  <h3 className="font-heading text-2xl font-bold leading-tight sm:text-3xl" style={{ color: m.dark ? "#fff" : INK }}>
                    {m.titulo}
                  </h3>
                </div>
                <p className={"mt-4 max-w-lg text-base leading-relaxed " + (m.dark ? "text-white/70" : "text-slate-600")}>
                  {m.texto}
                </p>
              </div>

              <div className={i % 2 === 1 ? "lg:order-1" : ""}>
                {m.mock ? <PanelVistaPrevia etiqueta={m.etiqueta}><m.mock /></PanelVistaPrevia> : <ChipsModulo chips={m.chips} dark={m.dark} accent={m.accent} />}
              </div>
            </div>
          </section>
        ))}
      </div>

      {/* ─── CAPTURAS REALES DEL PANEL ─── */}
      <section className="mx-auto max-w-6xl px-6 py-10 md:px-12">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>No es un mockup</Eyebrow>
          <h2 className="mt-4 font-heading text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl" style={{ color: INK }}>
            Así se ve el panel por dentro
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            Las tarjetas de arriba son un adelanto. Esto es el sistema real, funcionando.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2">
          {[
            { src: "/capturas/panel-inicio.jpg", titulo: "Panel principal", texto: "Pacientes, citas del día y alertas de inventario en un solo vistazo." },
            { src: "/capturas/panel-crm.jpg", titulo: "CRM y fidelización", texto: "Cumpleaños, clientes inactivos y recordatorios listos para enviar por WhatsApp." },
          ].map((cap) => (
            <div key={cap.titulo} className="group">
              <div
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl transition-all duration-300 group-hover:-translate-y-1.5 group-hover:shadow-2xl"
                style={{ boxShadow: "0 24px 48px -24px rgba(14,43,51,0.35)" }}
              >
                <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-3.5 py-2.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-300" />
                </div>
                <img src={cap.src} alt={`Captura del ${cap.titulo.toLowerCase()} del sistema`} className="w-full" loading="lazy" />
              </div>
              <h3 className="mt-4 text-sm font-bold" style={{ color: INK }}>{cap.titulo}</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{cap.texto}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── PLAN ─── */}
      <section id="plan" className="mx-auto max-w-4xl scroll-mt-24 px-6 py-10 pb-24 md:px-12">
        <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-10 text-center">
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-60 blur-3xl"
            style={{ background: "radial-gradient(circle, rgba(46,107,255,0.14), transparent 70%)" }}
          />
          <div className="relative">
            <Eyebrow>Un plan a tu medida</Eyebrow>
            <h2 className="mt-4 font-heading text-3xl font-extrabold tracking-tight" style={{ color: INK }}>Contáctanos y te armamos una propuesta</h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-slate-500">
              El costo depende del tamaño de tu óptica y de los módulos que necesites. Dejanos tus datos y
              te contactamos para mostrarte el sistema completo y armar un plan.
            </p>
            <ul className="mx-auto mt-6 flex max-w-md flex-col gap-2.5 text-left text-sm text-slate-600">
              {["Panel de administrador y de optómetra", "Tu propio dominio y marca", "Soporte directo durante la puesta en marcha"].map((f) => (
                <li key={f} className="flex items-center gap-2.5">
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full" style={{ backgroundColor: GOLD, color: INK }}>
                    <Check size={13} strokeWidth={3} />
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={abrirModal}
              className="mt-8 inline-flex items-center gap-2 rounded-xl px-7 py-3.5 text-sm font-bold text-white transition-all hover:-translate-y-0.5 cursor-pointer"
              style={{ background: GRAD, boxShadow: "0 16px 32px -12px rgba(37,99,235,0.6)" }}
            >
              Solicitar mi plan <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>

      {/* ─── MODAL: SOLICITUD ─── */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={cerrarModal}>
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)", willChange: "transform, opacity" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: GRAD }}>
                  <ArrowRight size={20} />
                </div>
                <div>
                  <h4 className="text-lg font-bold" style={{ color: INK }}>Obtener sistema</h4>
                  <p className="text-xs text-slate-500">Contanos de tu óptica y te contactamos.</p>
                </div>
              </div>
              <button type="button" onClick={cerrarModal} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-600 cursor-pointer">
                <X size={20} />
              </button>
            </div>

            {enviado ? (
              <div className="flex flex-col items-center gap-3 p-8 text-center">
                <div className="grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-600">
                  <Check size={26} />
                </div>
                <h4 className="text-lg font-bold" style={{ color: INK }}>¡Listo! Recibimos tu solicitud</h4>
                <p className="text-sm text-slate-500">Te vamos a contactar pronto para mostrarte el sistema completo y armar tu plan.</p>
                <button type="button" onClick={cerrarModal} className="mt-2 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer">
                  Cerrar
                </button>
              </div>
            ) : (
              <form onSubmit={enviarSolicitud} className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
                  {error && (
                    <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">
                      <AlertTriangle size={16} />
                      {error}
                    </div>
                  )}
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Nombre de la óptica</label>
                    <input
                      type="text" value={campos.nombreOptica} onChange={(e) => actualizarCampo("nombreOptica", e.target.value)}
                      placeholder="Ej. Óptica Vision Plus"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Alias o dominio que te gustaría <span className="font-normal text-slate-400">(opcional)</span></label>
                    <input
                      type="text" value={campos.slugDeseado} onChange={(e) => actualizarCampo("slugDeseado", e.target.value)}
                      placeholder="Ej. vision-plus"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
                    />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-slate-700">Tu nombre</label>
                      <input
                        type="text" value={campos.nombreAdmin} onChange={(e) => actualizarCampo("nombreAdmin", filtrarSoloLetras(e.target.value))}
                        placeholder="Ej. Ana Torres"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-slate-700">Teléfono <span className="font-normal text-slate-400">(opcional)</span></label>
                      <input
                        type="tel" value={campos.telefono} onChange={(e) => actualizarCampo("telefono", filtrarSoloNumeros(e.target.value, 10))}
                        placeholder="Ej. 0991234567"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Correo electrónico</label>
                    <input
                      type="email" value={campos.emailAdmin} onChange={(e) => actualizarCampo("emailAdmin", e.target.value)}
                      placeholder="tucorreo@ejemplo.com"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700">Cuéntanos algo más <span className="font-normal text-slate-400">(opcional)</span></label>
                    <textarea
                      rows={3} value={campos.mensaje} onChange={(e) => actualizarCampo("mensaje", e.target.value)}
                      placeholder="Ej. cuántos optómetras trabajan en tu óptica..."
                      className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
                    />
                  </div>
                </div>
                <div className="flex shrink-0 justify-end gap-2 border-t border-slate-100 px-5 py-4">
                  <button type="button" disabled={enviando} onClick={cerrarModal} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer disabled:opacity-50">
                    Cancelar
                  </button>
                  <button type="submit" disabled={enviando} className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 cursor-pointer disabled:opacity-60" style={{ background: GRAD, boxShadow: "0 12px 24px -12px rgba(37,99,235,0.6)" }}>
                    {enviando ? <><Loader2 size={15} className="animate-spin" /> Enviando...</> : "Enviar solicitud"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ─── FOOTER ─── */}
      <footer className="px-6 py-10 md:px-12" style={{ backgroundColor: INK }}>
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 text-center sm:flex-row sm:justify-between sm:text-left">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-lg text-white" style={{ background: GRAD }}>
              <Eye size={15} />
            </div>
            <span className="font-heading text-base font-bold text-white">Sistema Óptica</span>
          </div>
          <p className="text-xs text-white/50">
            © {new Date().getFullYear()} Sistema Óptica — gestión clínica y de citas para ópticas.
          </p>
          <div className="flex gap-5 text-xs text-white/50">
            <button type="button" onClick={() => irALegal("terminos")} className="cursor-pointer transition-colors hover:text-white/80">Términos</button>
            <button type="button" onClick={() => irALegal("privacidad")} className="cursor-pointer transition-colors hover:text-white/80">Privacidad</button>
          </div>
        </div>
      </footer>
    </div>
  )
}
