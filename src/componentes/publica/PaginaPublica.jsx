import { useState } from "react"
import { Menu, X, LogIn, MapPin, Check, Star, Eye, Glasses, RefreshCcw, Sparkles, Stethoscope, Clock, Phone, Navigation } from "lucide-react"
import BotonWhatsAppFlotante from "./BotonWhatsAppFlotante"
import LogoOptica from "../LogoOptica"
import OjoOptico from "./OjoOptico"
import EstilosPublica from "./EstilosPublica"
import { paginaPublica, anosAtendiendo, pacientesRedondeado, iniciales, ESLOGAN_POR_DEFECTO, degradadoMarca } from "../../utilidades/marcaOptica"
import { estadoAtencionHoy, resumenHorarioSemanal } from "../../utilidades/disponibilidad"
import { irALegal } from "../../utilidades/resolverSitio"
import { formatearTelefonoEC, linkWhatsApp } from "../../utilidades/whatsapp"
import { ahoraEcuador } from "../../utilidades/horaEcuador"
import { mapaGuardado, urlMapaIncrustado } from "../../utilidades/enlaceMapa"

const NAVY = "#0B1633"
const FONDO_SUAVE = "#F6F9FE"

const ENLACES_MENU = [
  { id: "quienes-somos", texto: "Quiénes somos" },
  { id: "servicios", texto: "Servicios" },
  { id: "como-agendar", texto: "Cómo agendar" },
  { id: "preguntas", texto: "Preguntas" },
  { id: "contacto", texto: "Contacto" },
]

// Primero la disponibilidad (como el agendamiento): motivo, fecha y hora; después los datos; al final el código.
const PASOS = [
  { n: 1, titulo: "Motivo, fecha y hora", texto: "Solo ves las horas realmente libres." },
  { n: 2, titulo: "Tus datos", texto: "Nombre, cédula y teléfono." },
  { n: 3, titulo: "Listo", texto: "Recibes tu código; la óptica ya te ve en su agenda." },
]

// Ícono de cada servicio, en el orden de la lista (se repite si hay más): cada uno con su color.
const ICONOS_SERVICIO = [
  { Icono: Eye, fondo: "#2563EB" },
  { Icono: Glasses, fondo: "#7C3AED" },
  { Icono: RefreshCcw, fondo: "#15803D" },
  { Icono: Stethoscope, fondo: "#C2410C" },
  { Icono: Sparkles, fondo: "#BE185D" },
]

const sinCero = (texto) => texto.replace(/\b0(\d:\d\d)/g, "$1")

const Eyebrow = ({ children, color }) => (
  <p className="text-xs font-bold uppercase tracking-[0.14em]" style={{ color }}>{children}</p>
)

const Titulo = ({ children, id }) => (
  <h2 id={id} className="mt-2 font-serif text-3xl font-bold leading-tight tracking-tight md:text-4xl" style={{ color: NAVY }}>{children}</h2>
)

// Tarjeta flotante del inicio: ilustra lo que verá el paciente en su portal. Decorativa (aria-hidden) y solo en pantallas anchas,
// donde el contenedor del ojo deja espacio libre para ella; nunca se monta sobre la imagen ni sobre el texto.
function TarjetaFlotante({ className, estilo, titulo, texto, retraso }) {
  return (
    <div aria-hidden="true" className={"pointer-events-none absolute hidden lg:block " + className} style={estilo}>
      <div className={"lg-flota rounded-2xl border border-slate-100 bg-white px-3 py-2 shadow-[0_12px_30px_-12px_rgba(15,23,42,0.35)] " + retraso}>
        <p className="text-xs font-bold leading-tight" style={{ color: NAVY }}>{titulo}</p>
        <p className="mt-0.5 text-xs leading-tight text-slate-500">{texto}</p>
      </div>
    </div>
  )
}

// Una fila de contacto: icono en un cuadro del color de la marca, título y su contenido.
function FilaContacto({ Icono, color, titulo, children }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: color + "1A", color }}><Icono size={18} aria-hidden="true" /></span>
      <div className="min-w-0">
        <p className="font-semibold" style={{ color: NAVY }}>{titulo}</p>
        {children}
      </div>
    </div>
  )
}

export default function PaginaPublica({ opticaPublica, disponibilidad, datos, abrirLogin, alAgendar }) {
  const [menuAbierto, setMenuAbierto] = useState(false)
  const nombre = opticaPublica?.nombre || "Tu óptica"
  const pp = paginaPublica(opticaPublica?.marca, nombre)
  const color = pp.color
  const degradado = degradadoMarca(color)
  const logoUrl = opticaPublica?.logo_url || ""
  const settings = opticaPublica?.settings || {}
  const mapa = mapaGuardado(settings) // el enlace de Google Maps que pegó la óptica (con sus coordenadas)
  const direccion = (settings.opticaDireccion || "").trim()
  const lugarMapa = direccion || mapa?.nombre || ""
  const telefono = (settings.opticaTelefono || "").trim()
  const telefonoIntl = telefono ? formatearTelefonoEC(telefono) : ""
  const horarioResumen = resumenHorarioSemanal(disponibilidad?.horarioSemanal)
  const estado = disponibilidad?.horarioSemanal ? estadoAtencionHoy(disponibilidad) : null
  const textoEstado = estado ? sinCero(estado.texto) : ""
  const pastilla = estado?.abierto ? textoEstado.replace(/^Abierto hoy hasta/, "Abierto · hasta") : textoEstado
  const anio = ahoraEcuador().getFullYear()

  const q = pp.quienesSomos
  const optometras = Array.isArray(datos?.optometras) ? datos.optometras : []
  const anos = q.mostrarAnos ? anosAtendiendo(q.anoFundacion) : null
  const pacientes = q.mostrarPacientes ? pacientesRedondeado(datos?.pacientesAtendidos) : null
  const total = datos?.optometrasTotal
  const nOptometras = q.mostrarOptometras && Number.isInteger(total) && total > 0 ? total : null
  const numeros = [
    anos != null && { valor: anos, etiqueta: anos === 1 ? "año atendiendo" : "años atendiendo" },
    pacientes && { valor: pacientes, etiqueta: "pacientes" },
    nOptometras && { valor: nOptometras, etiqueta: nOptometras === 1 ? "optómetra" : "optómetras" },
  ].filter(Boolean)

  // Con enlace de Google Maps: el mapa y «Cómo llegar» salen de ahí; sin él, de la dirección escrita.
  const urlMapa = mapa ? urlMapaIncrustado(mapa) : direccion ? `https://www.google.com/maps?q=${encodeURIComponent(direccion)}&output=embed` : ""
  const urlComoLlegar = mapa ? mapa.url : direccion ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}` : ""

  const botonPrincipal = (
    <button
      type="button"
      onClick={() => alAgendar()}
      className="inline-flex min-h-12 items-center justify-center rounded-xl px-6 py-3 text-base font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 cursor-pointer"
      style={{ background: degradado, boxShadow: `0 16px 32px -14px ${color}99`, "--tw-ring-color": color }}
    >
      Agenda tu cita en línea
    </button>
  )
  const botonCortoAgendar = (
    <button
      type="button"
      onClick={() => alAgendar()}
      className="inline-flex min-h-12 items-center justify-center rounded-xl px-6 py-3 text-base font-semibold text-white transition duration-200 hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 cursor-pointer"
      style={{ background: degradado, boxShadow: `0 16px 32px -14px ${color}99`, "--tw-ring-color": color }}
    >
      Agenda tu cita
    </button>
  )

  const claseEnlaceMenu = "rounded-lg px-1 py-2 text-[0.95rem] font-medium text-slate-700 transition-colors hover:text-slate-950"

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-white font-sans text-slate-800 antialiased">
      <EstilosPublica />

      {/* ─── Barra superior ─── */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/70 bg-white/95 backdrop-blur-md">
        <div className="mx-auto w-full max-w-[1296px] px-5 sm:px-8 lg:px-12 flex items-center justify-between gap-3 py-3">
          <div className="flex min-w-0 items-center gap-8">
            <a href="#inicio" className="flex min-w-0 items-center gap-3 rounded-lg">
              <LogoOptica url={logoUrl} nombre={pp.nombre} color={color} tamano={40} ancho="ancho" />
              <span className="min-w-0 leading-tight">
                <span className="block truncate font-serif text-lg font-bold tracking-tight" style={{ color: NAVY }}>{pp.nombre}</span>
                <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-slate-500">Salud visual</span>
              </span>
            </a>
            <nav aria-label="Secciones de la página" className="hidden items-center gap-6 lg:flex">
              {ENLACES_MENU.map((e) => (
                <a key={e.id} href={`#${e.id}`} className={claseEnlaceMenu}>{e.texto}</a>
              ))}
            </nav>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={abrirLogin}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold transition-colors hover:bg-slate-50 cursor-pointer"
              style={{ color: NAVY }}
            >
              <LogIn size={16} aria-hidden="true" className="sm:hidden" />
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={() => setMenuAbierto((v) => !v)}
              aria-expanded={menuAbierto}
              aria-controls="menu-movil"
              aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú"}
              className="grid h-11 w-11 place-items-center rounded-xl border border-slate-300 bg-white text-slate-700 transition-colors hover:bg-slate-50 lg:hidden cursor-pointer"
            >
              {menuAbierto ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        {menuAbierto && (
          <nav id="menu-movil" aria-label="Menú de secciones" className="border-t border-slate-200 bg-white px-5 py-2 sm:px-8 lg:hidden">
            <ul>
              {ENLACES_MENU.map((e) => (
                <li key={e.id}>
                  <a href={`#${e.id}`} onClick={() => setMenuAbierto(false)} className="flex min-h-11 items-center text-base font-medium text-slate-700">{e.texto}</a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </header>

      <main>
        {/* ─── Inicio ─── */}
        <section id="inicio" className="relative scroll-mt-20 overflow-hidden" style={{ background: "linear-gradient(135deg,#FFFFFF 0%,#F1F6FF 55%,#E6EFFE 100%)" }}>
          <div className="mx-auto w-full max-w-[1296px] px-5 sm:px-8 lg:px-12 grid grid-cols-1 items-center gap-10 py-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:py-12">
            <div className="flex min-w-0 flex-col items-start gap-6">
              {estado && (
                <span className="lg-rise lg-d1 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: estado.abierto ? "#16A34A" : "#94A3B8" }} aria-hidden="true" />
                  {pastilla}
                </span>
              )}
              <h1 className="font-serif text-6xl font-bold leading-[1.02] tracking-tight md:text-7xl lg:text-[5.25rem]" style={{ color: NAVY }}>
                {pp.eslogan === ESLOGAN_POR_DEFECTO ? (
                  <>
                    Ve el mundo{" "}
                    <br />
                    <span className="lg-focus italic" style={{ color }}>con claridad.</span>
                  </>
                ) : (
                  pp.eslogan
                )}
              </h1>
              <p className="lg-rise lg-d2 max-w-lg text-lg leading-relaxed text-slate-600 md:text-xl">{pp.textoInicio}</p>
              <div className="lg-rise lg-d3 flex flex-col items-start gap-3">
                {botonPrincipal}
                <p className="text-sm text-slate-500">Sin crear cuenta · Confirmación inmediata · Datos protegidos</p>
              </div>
            </div>

            {/* Contenedor del ojo: las tarjetas viven en los márgenes libres de este cuadrado, fuera del círculo. */}
            <div className="lg-rise lg-d2 relative mx-auto aspect-square w-full max-w-[22rem] lg:max-w-[34rem]" data-zona-ojo>
              <div className="absolute aspect-square overflow-hidden rounded-full" style={{ left: "19%", top: "23%", width: "54%" }}>
                {pp.imagenPrincipal ? (
                  <img src={pp.imagenPrincipal} alt={`${pp.nombre}`} className="h-full w-full object-cover" />
                ) : (
                  <OjoOptico className="block h-full w-full" />
                )}
              </div>
              <TarjetaFlotante className="" estilo={{ left: 0, top: "2%", width: "42%" }} titulo="Tu próxima cita" texto="Mié 29 oct · 10:40 AM" retraso="" />
              <TarjetaFlotante className="" estilo={{ right: 0, top: "42%", width: "24%" }} titulo="Tus lentes" texto="Listos para retirar" retraso="lg-flota-2" />
              <TarjetaFlotante className="" estilo={{ left: 0, bottom: "4%", width: "42%" }} titulo="Tu receta" texto="Siempre en tu portal" retraso="lg-flota-3" />
            </div>
          </div>
        </section>

        {/* ─── Quiénes somos ─── */}
        <section id="quienes-somos" aria-labelledby="t-quienes" className="scroll-mt-20 bg-white">
          <div className="mx-auto w-full max-w-[1296px] px-5 sm:px-8 lg:px-12 grid grid-cols-1 gap-10 py-9 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-14 lg:py-11">
            <div className="min-w-0">
              <Eyebrow color={color}>Quiénes somos</Eyebrow>
              <Titulo id="t-quienes">{q.anoFundacion ? `Cuidamos tu vista desde ${q.anoFundacion}` : "Cuidamos tu vista"}</Titulo>
              <p className="mt-4 max-w-2xl leading-relaxed text-slate-600">{q.historia}</p>
              <p className="mt-2 max-w-2xl leading-relaxed text-slate-600"><strong style={{ color: NAVY }}>Misión:</strong> {q.mision}</p>
              {numeros.length > 0 && (
                <dl className="mt-6 flex flex-wrap gap-x-10 gap-y-4">
                  {numeros.map((n) => (
                    <div key={n.etiqueta}>
                      <dd className="font-serif text-3xl font-bold" style={{ color: NAVY }}>{n.valor}</dd>
                      <dt className="text-sm text-slate-500">{n.etiqueta}</dt>
                    </div>
                  ))}
                </dl>
              )}
            </div>
            {optometras.length === 0 && (
              <div className="min-w-0 rounded-2xl p-6 lg:p-7" style={{ backgroundColor: FONDO_SUAVE }} data-por-que-elegirnos>
                <h3 className="font-semibold" style={{ color: NAVY }}>Por qué elegirnos</h3>
                <ul className="mt-4 flex flex-col gap-4">
                  {pp.razones.map((r) => (
                    <li key={r.id} className="flex items-start gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-50" style={{ color }} aria-hidden="true"><Check size={18} strokeWidth={2.5} /></span>
                      <div className="min-w-0">
                        <p className="font-semibold leading-tight" style={{ color: NAVY }}>{r.titulo}</p>
                        <p className="text-sm text-slate-500">{r.texto}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {optometras.length > 0 && (
              <ul className="flex min-w-0 flex-col gap-3">
                {optometras.map((o) => (
                  <li key={o.id || o.nombre} className="flex items-center gap-4 rounded-2xl p-5" style={{ backgroundColor: FONDO_SUAVE }}>
                    {o.foto ? (
                      <img src={o.foto} alt={o.nombre} className="h-[4.5rem] w-[4.5rem] shrink-0 rounded-full object-cover" />
                    ) : (
                      <span className="grid h-[4.5rem] w-[4.5rem] shrink-0 place-items-center rounded-full bg-blue-100 text-xl font-bold" style={{ color }} aria-hidden="true">{iniciales(o.nombre)}</span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-semibold" style={{ color: NAVY }}>{o.nombre}</p>
                      <p className="text-sm text-slate-500">Optómetra{o.registro ? ` · Reg. ${o.registro}` : ""}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        {/* ─── Servicios ─── */}
        <section id="servicios" aria-labelledby="t-servicios" className="scroll-mt-20" style={{ backgroundColor: FONDO_SUAVE }}>
          <div className="mx-auto w-full max-w-[1296px] px-5 sm:px-8 lg:px-12 py-9 lg:py-11">
            <Eyebrow color={color}>Nuestros servicios</Eyebrow>
            <Titulo id="t-servicios">Todo lo que tu visión necesita</Titulo>
            <ul className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              {pp.servicios.map((s, i) => {
                const { Icono, fondo } = ICONOS_SERVICIO[i % ICONOS_SERVICIO.length]
                return (
                <li key={s.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6">
                  <span className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ backgroundColor: fondo }} aria-hidden="true" data-icono-servicio><Icono size={20} /></span>
                  <h3 className="mt-4 font-semibold" style={{ color: NAVY }}>{s.titulo}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-500">{s.texto}</p>
                  <button
                    type="button"
                    onClick={() => alAgendar(s.motivo || undefined)}
                    className="mt-auto inline-flex min-h-11 items-center self-start pt-2 text-sm font-semibold hover:underline cursor-pointer"
                    style={{ color }}
                  >
                    Agendar este servicio →
                  </button>
                </li>
                )
              })}
            </ul>
          </div>
        </section>

        {/* ─── Cómo agendar ─── */}
        <section id="como-agendar" aria-labelledby="t-como" className="scroll-mt-20 bg-white">
          <div className="mx-auto w-full max-w-[1296px] px-5 sm:px-8 lg:px-12 py-9 lg:py-11">
            <Eyebrow color={color}>Cómo agendar</Eyebrow>
            <Titulo id="t-como">Tu cita en tres pasos, sin crear cuenta</Titulo>
            <ol className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-[1fr_1fr_1fr_auto] lg:items-center lg:gap-8">
              {PASOS.map((p) => (
                <li key={p.n} className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-base font-bold text-white" style={{ backgroundColor: NAVY }} aria-hidden="true">{p.n}</span>
                  <div className="min-w-0">
                    <p className="font-semibold" style={{ color: NAVY }}>{p.titulo}</p>
                    <p className="text-sm leading-relaxed text-slate-500">{p.texto}</p>
                  </div>
                </li>
              ))}
              <li className="md:col-span-3 lg:col-span-1 lg:justify-self-end">{botonCortoAgendar}</li>
            </ol>
          </div>
        </section>

        {/* ─── Lo que dicen nuestros pacientes (opcional: la escribe la óptica; sin opiniones no se dibuja) ─── */}
        {pp.opiniones.length > 0 && (
          <section id="opiniones" aria-labelledby="t-opiniones" className="scroll-mt-20 bg-white">
            <div className="mx-auto w-full max-w-[1296px] px-5 sm:px-8 lg:px-12 pb-3 pt-0 lg:pb-4">
              <Eyebrow color={color}>Lo que dicen nuestros pacientes</Eyebrow>
              <Titulo id="t-opiniones">Pacientes que ya ven mejor</Titulo>
              <ul className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
                {pp.opiniones.map((o) => (
                  <li key={o.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5" data-opinion>
                    <span className="flex gap-0.5 text-amber-500" role="img" aria-label="5 de 5 estrellas">
                      {[0, 1, 2, 3, 4].map((k) => <Star key={k} size={16} fill="currentColor" aria-hidden="true" />)}
                    </span>
                    <blockquote className="mt-3 leading-relaxed text-slate-700">«{o.texto}»</blockquote>
                    {o.nombre && <p className="mt-3 text-sm font-semibold" style={{ color: NAVY }}>{o.nombre}</p>}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {/* ─── Preguntas frecuentes ─── */}
        <section id="preguntas" aria-labelledby="t-preguntas" className="scroll-mt-20" style={{ backgroundColor: FONDO_SUAVE }}>
          <div className="mx-auto w-full max-w-[1296px] px-5 sm:px-8 lg:px-12 py-9 lg:py-11">
            <Eyebrow color={color}>Preguntas frecuentes</Eyebrow>
            <Titulo id="t-preguntas">Antes de tu visita</Titulo>
            <div className="mt-6 grid grid-cols-1 items-start gap-3 md:grid-cols-2">
              {pp.preguntas.map((f, i) => (
                <details key={f.id} open={i === 0} className="group rounded-xl border border-slate-200 bg-white">
                  <summary className="flex min-h-11 cursor-pointer items-center px-4 py-2 font-medium" style={{ color: NAVY }}>{f.p}</summary>
                  <p className="px-4 pb-3 text-sm leading-relaxed text-slate-600">{f.r}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Contacto ─── */}
        <section id="contacto" aria-labelledby="t-contacto" className="scroll-mt-20" style={{ backgroundColor: FONDO_SUAVE }}>
          <div className="mx-auto w-full max-w-[1296px] px-5 sm:px-8 lg:px-12 py-9 lg:py-11">
            <Eyebrow color={color}>Contacto</Eyebrow>
            <Titulo id="t-contacto">Visítanos o escríbenos</Titulo>
            <div className="mt-6 grid grid-cols-1 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_48px_-28px_rgba(11,22,51,0.35)] md:grid-cols-5">
              <div className="flex min-w-0 flex-col gap-5 p-6 text-sm sm:p-8 md:col-span-2">
                <FilaContacto Icono={MapPin} color={color} titulo="Dirección">
                  {lugarMapa ? (
                    <>
                      <p className="text-slate-600">{lugarMapa}</p>
                      {direccion && mapa?.nombre && mapa.nombre.toLowerCase() !== direccion.toLowerCase() && <p className="text-xs text-slate-500">{mapa.nombre} en Google Maps</p>}
                    </>
                  ) : (
                    <p className="text-slate-600">La óptica aún no ha publicado su dirección.</p>
                  )}
                </FilaContacto>
                {horarioResumen.length > 0 && (
                  <FilaContacto Icono={Clock} color={color} titulo="Horario">
                    {horarioResumen.map((h) => (
                      <p key={h.etiqueta} className="text-slate-600">{h.etiqueta} {h.horario}</p>
                    ))}
                  </FilaContacto>
                )}
                {telefono && (
                  <FilaContacto Icono={Phone} color={color} titulo="Teléfono">
                    <p className="text-slate-600">{telefono}</p>
                  </FilaContacto>
                )}
                {(telefonoIntl || urlComoLlegar) && (
                  <div className="mt-auto flex flex-wrap gap-2 pt-1">
                    {urlComoLlegar && (
                      <a href={urlComoLlegar} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 font-semibold text-white transition duration-200 hover:brightness-105" style={{ background: degradado }}><Navigation size={16} aria-hidden="true" /> Cómo llegar</a>
                    )}
                    {telefonoIntl && (
                      <a href={linkWhatsApp(telefono, `Hola, quisiera agendar una cita en ${pp.nombre}.`)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-xl bg-green-700 px-4 font-semibold text-white transition-colors hover:bg-green-800">WhatsApp</a>
                    )}
                    {telefonoIntl && (
                      <a href={"tel:+" + telefonoIntl} className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 font-semibold transition-colors hover:bg-slate-50" style={{ color: NAVY }}>Llamar</a>
                    )}
                  </div>
                )}
              </div>
              {urlMapa ? (
                <iframe title={`Mapa de ${pp.nombre}`} src={urlMapa} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-72 w-full border-0 md:col-span-3 md:h-full md:min-h-[22rem]" />
              ) : (
                <div className="grid min-h-48 place-items-center p-6 text-center text-sm text-slate-500 md:col-span-3" style={{ backgroundImage: "repeating-linear-gradient(135deg,#EEF3FB 0 14px,#F6F9FE 14px 28px)" }}>
                  <span className="flex items-center gap-2"><MapPin size={16} aria-hidden="true" /> El mapa aparecerá cuando la óptica configure su dirección.</span>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* ─── Pie ─── */}
      <footer className="mt-auto text-white" style={{ backgroundColor: NAVY }}>
        <div className="mx-auto w-full max-w-[1296px] px-5 sm:px-8 lg:px-12 flex flex-col items-center justify-between gap-2 py-5 text-sm text-white/80 md:flex-row">
          <p className="flex items-center gap-2">
            <LogoOptica url={logoUrl} nombre={pp.nombre} color={color} tamano={24} />
            © {anio} {pp.nombre}
          </p>
          <p className="flex flex-wrap items-center justify-center">
            <button type="button" onClick={() => irALegal("privacidad")} className="inline-flex min-h-11 items-center px-1 transition-colors hover:text-white cursor-pointer">Política de privacidad</button>
            <span aria-hidden="true" className="px-1">·</span>
            <button type="button" onClick={abrirLogin} className="inline-flex min-h-11 items-center px-1 transition-colors hover:text-white cursor-pointer">Iniciar sesión</button>
          </p>
        </div>
      </footer>
      <BotonWhatsAppFlotante telefono={telefono} mensaje={`Hola, quisiera información para agendar una cita en ${pp.nombre}.`} />
    </div>
  )
}

