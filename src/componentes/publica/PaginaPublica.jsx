import { useState } from "react"
import { Menu, X, LogIn, MapPin } from "lucide-react"
import LogoOptica from "../LogoOptica"
import OjoOptico from "./OjoOptico"
import EstilosPublica from "./EstilosPublica"
import { paginaPublica, anosAtendiendo, pacientesRedondeado, iniciales, ESLOGAN_POR_DEFECTO, degradadoMarca } from "../../utilidades/marcaOptica"
import { estadoAtencionHoy, resumenHorarioSemanal } from "../../utilidades/disponibilidad"
import { irALegal } from "../../utilidades/resolverSitio"
import { formatearTelefonoEC, linkWhatsApp } from "../../utilidades/whatsapp"
import { ahoraEcuador } from "../../utilidades/horaEcuador"

const NAVY = "#0B1633"
const FONDO_SUAVE = "#F6F9FE"

const ENLACES_MENU = [
  { id: "quienes-somos", texto: "Quiénes somos" },
  { id: "servicios", texto: "Servicios" },
  { id: "como-agendar", texto: "Cómo agendar" },
  { id: "preguntas", texto: "Preguntas" },
  { id: "contacto", texto: "Contacto" },
]

const PASOS = [
  { n: 1, titulo: "Tus datos y el motivo", texto: "Nombre, cédula y teléfono." },
  { n: 2, titulo: "Fecha y hora", texto: "Solo ves las horas realmente libres." },
  { n: 3, titulo: "Listo", texto: "Recibes tu código y la óptica ya te ve en su agenda." },
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

export default function PaginaPublica({ opticaPublica, disponibilidad, datos, abrirLogin, alAgendar }) {
  const [menuAbierto, setMenuAbierto] = useState(false)
  const nombre = opticaPublica?.nombre || "Tu óptica"
  const pp = paginaPublica(opticaPublica?.marca, nombre)
  const color = pp.color
  const degradado = degradadoMarca(color)
  const logoUrl = opticaPublica?.logo_url || ""
  const settings = opticaPublica?.settings || {}
  const direccion = (settings.opticaDireccion || "").trim()
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

  const urlMapa = direccion ? `https://www.google.com/maps?q=${encodeURIComponent(direccion)}&output=embed` : ""
  const urlComoLlegar = direccion ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(direccion)}` : ""

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

  const claseEnlaceMenu = "rounded-lg px-1 py-2 text-[0.95rem] font-medium text-slate-700 transition-colors hover:text-slate-950"

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-white font-sans text-slate-800 antialiased">
      <EstilosPublica />

      {/* ─── Barra superior ─── */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/70 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
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
          <nav id="menu-movil" aria-label="Menú de secciones" className="border-t border-slate-200 bg-white px-4 py-2 sm:px-6 lg:hidden">
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
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:gap-6 lg:px-8 lg:py-16">
            <div className="flex min-w-0 flex-col items-start gap-6">
              {estado && (
                <span className="lg-rise lg-d1 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold uppercase tracking-[0.12em] text-slate-600">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: estado.abierto ? "#16A34A" : "#94A3B8" }} aria-hidden="true" />
                  {pastilla}
                </span>
              )}
              <h1 className="font-serif text-5xl font-bold leading-[1.05] tracking-tight md:text-6xl" style={{ color: NAVY }}>
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
              <p className="lg-rise lg-d2 max-w-md text-lg leading-relaxed text-slate-600">{pp.textoInicio}</p>
              <div className="lg-rise lg-d3 flex flex-col items-start gap-3">
                {botonPrincipal}
                <p className="text-sm text-slate-500">Sin crear cuenta · Confirmación inmediata · Datos protegidos</p>
              </div>
            </div>

            {/* Contenedor del ojo: las tarjetas viven en los márgenes libres de este cuadrado, fuera del círculo. */}
            <div className="lg-rise lg-d2 relative mx-auto aspect-square w-full max-w-[22rem] lg:max-w-[30rem]" data-zona-ojo>
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
          <div className={"mx-auto grid w-full max-w-6xl grid-cols-1 gap-10 px-4 py-14 sm:px-6 lg:px-8 " + (optometras.length > 0 ? "lg:grid-cols-[1.35fr_1fr] lg:items-center" : "")}>
            <div className="min-w-0">
              <Eyebrow color={color}>Quiénes somos</Eyebrow>
              <Titulo id="t-quienes">{q.anoFundacion ? `Cuidamos tu vista desde ${q.anoFundacion}` : "Cuidamos tu vista"}</Titulo>
              <p className="mt-4 max-w-xl leading-relaxed text-slate-600">{q.historia}</p>
              <p className="mt-2 max-w-xl leading-relaxed text-slate-600"><strong style={{ color: NAVY }}>Misión:</strong> {q.mision}</p>
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
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
            <Eyebrow color={color}>Nuestros servicios</Eyebrow>
            <Titulo id="t-servicios">Todo lo que tu visión necesita</Titulo>
            <ul className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              {pp.servicios.map((s) => (
                <li key={s.id} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5">
                  <h3 className="font-semibold" style={{ color: NAVY }}>{s.titulo}</h3>
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
              ))}
            </ul>
          </div>
        </section>

        {/* ─── Cómo agendar ─── */}
        <section id="como-agendar" aria-labelledby="t-como" className="scroll-mt-20 bg-white">
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
            <Eyebrow color={color}>Cómo agendar</Eyebrow>
            <Titulo id="t-como">Tu cita en tres pasos, sin crear cuenta</Titulo>
            <ol className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
              {PASOS.map((p) => (
                <li key={p.n} className="flex items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-base font-bold text-white" style={{ backgroundColor: NAVY }} aria-hidden="true">{p.n}</span>
                  <div className="min-w-0">
                    <p className="font-semibold" style={{ color: NAVY }}>{p.titulo}</p>
                    <p className="text-sm leading-relaxed text-slate-500">{p.texto}</p>
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-8">{botonPrincipal}</div>
          </div>
        </section>

        {/* ─── Preguntas frecuentes ─── */}
        <section id="preguntas" aria-labelledby="t-preguntas" className="scroll-mt-20" style={{ backgroundColor: FONDO_SUAVE }}>
          <div className="mx-auto w-full max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
            <Eyebrow color={color}>Preguntas frecuentes</Eyebrow>
            <Titulo id="t-preguntas">Antes de tu visita</Titulo>
            <div className="mt-6 flex flex-col gap-3">
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
        <section id="contacto" aria-labelledby="t-contacto" className="scroll-mt-20 bg-white">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 px-4 py-14 sm:px-6 md:grid-cols-2 lg:px-8">
            <div className="min-w-0">
              <Eyebrow color={color}>Contacto</Eyebrow>
              <Titulo id="t-contacto">Visítanos o escríbenos</Titulo>
              <div className="mt-5 flex flex-col gap-4 text-sm">
                <div>
                  <p className="font-semibold" style={{ color: NAVY }}>Dirección</p>
                  <p className="text-slate-600">{direccion || "La óptica aún no ha publicado su dirección."}</p>
                </div>
                {horarioResumen.length > 0 && (
                  <div>
                    <p className="font-semibold" style={{ color: NAVY }}>Horario</p>
                    {horarioResumen.map((h) => (
                      <p key={h.etiqueta} className="text-slate-600">{h.etiqueta} {h.horario}</p>
                    ))}
                  </div>
                )}
                {(telefonoIntl || direccion) && (
                  <div className="flex flex-wrap gap-2">
                    {telefonoIntl && (
                      <a href={linkWhatsApp(telefono, `Hola, quisiera agendar una cita en ${pp.nombre}.`)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-xl bg-green-700 px-4 font-semibold text-white transition-colors hover:bg-green-800">WhatsApp</a>
                    )}
                    {telefonoIntl && (
                      <a href={"tel:+" + telefonoIntl} className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 font-semibold transition-colors hover:bg-slate-50" style={{ color: NAVY }}>Llamar</a>
                    )}
                    {direccion && (
                      <a href={urlComoLlegar} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 font-semibold transition-colors hover:bg-slate-50" style={{ color: NAVY }}>Cómo llegar</a>
                    )}
                  </div>
                )}
              </div>
            </div>
            {urlMapa ? (
              <iframe title={`Mapa de ${pp.nombre}`} src={urlMapa} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-64 w-full rounded-2xl border border-slate-200 md:h-full md:min-h-64" />
            ) : (
              <div className="grid min-h-48 place-items-center rounded-2xl border border-slate-200 p-6 text-center text-sm text-slate-500" style={{ backgroundImage: "repeating-linear-gradient(135deg,#EEF3FB 0 14px,#F6F9FE 14px 28px)" }}>
                <span className="flex items-center gap-2"><MapPin size={16} aria-hidden="true" /> El mapa aparecerá cuando la óptica configure su dirección.</span>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* ─── Pie ─── */}
      <footer className="mt-auto text-white" style={{ backgroundColor: NAVY }}>
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-sm text-white/80 sm:px-6 md:flex-row lg:px-8">
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
    </div>
  )
}

