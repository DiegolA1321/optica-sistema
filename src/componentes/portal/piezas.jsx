"use client"

import { CalendarClock, X, Check, Star, ChevronRight, MessageCircle } from "lucide-react"
import { etiquetaEstadoCita } from "../../utilidades/estadosCita"
import { formatoFecha, horaSinCero } from "../../utilidades/formatoFecha"
import { diaDeRegistro } from "../../utilidades/periodoLista"
import { pasosDeLosLentes, textoOrdenPaciente, NOTA_ESTADO_CITA } from "../../utilidades/portalPaciente"
import { BOTON_SECUNDARIO, BOTON_PELIGRO, BOTON_PRINCIPAL, ESTILO_PRINCIPAL } from "./estilos"

// Piezas del portal del paciente (diseño aprobado, docs/portal-propuesta/). Reglas del portal: texto de 16 px o más, títulos de tarjeta de 20 px en Sora, números principales
// en Sora de 32 a 76 px y todo lo que se toca mide al menos 44 px (regla 48). Sin ícono delante de cada título: la tarjeta se reconoce por su título.

// Una tarjeta: blanca, borde claro, esquinas de 20 px.
export const TARJETA = "min-w-0 rounded-[20px] border border-pt-borde bg-white p-5 sm:p-6"
// Con `onAbrir`, toda la tarjeta se pulsa y abre su detalle en la ventana estándar: un botón transparente cubre la tarjeta (los botones y enlaces de adentro quedan por encima,
// ver `.pt-abrible` en index.css) y la flecha › del título (`flecha` en TituloTarjeta) lo avisa.
export const Tarjeta = ({ children, className = "", onAbrir, etiquetaAbrir, ...resto }) => (
  <section className={TARJETA + " " + (onAbrir ? "pt-abrible relative transition-shadow hover:shadow-md " : "") + className} {...resto}>
    {onAbrir && <button type="button" onClick={onAbrir} aria-label={etiquetaAbrir} className="pt-abrir absolute inset-0 rounded-[20px] cursor-pointer" />}
    {children}
  </section>
)
export const TituloTarjeta = ({ id, children, className = "", flecha = false }) => (
  <h2 id={id} className={"font-heading text-xl font-bold leading-tight text-pt-marino " + (flecha ? "flex items-center justify-between gap-3 " : "") + className}>
    {flecha ? <><span className="min-w-0">{children}</span><ChevronRight size={22} className="shrink-0 text-slate-500" aria-hidden="true" /></> : children}
  </h2>
)

// «Ver detalle ›» en texto: el aviso visible de que la tarjeta o la fila se pulsa (el botón transparente que la cubre es lo que abre el detalle).
export const VerDetalle = ({ children = "Ver detalle", className = "" }) => <span className={"inline-flex min-h-11 items-center gap-1 text-base font-semibold text-pt-azul " + className}>{children}<ChevronRight size={20} aria-hidden="true" /></span>

export const TituloPagina = ({ children, subtitulo, accion, className = "" }) => (
  <div className={"flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6 " + className}>
    <div className="min-w-0">
      <h1 className="font-heading text-2xl font-bold tracking-tight text-pt-marino sm:text-[28px] sm:leading-tight">{children}</h1>
      {subtitulo && <p className="mt-1 text-base text-pt-texto sm:text-base">{subtitulo}</p>}
    </div>
    {accion && <div className="shrink-0">{accion}</div>}
  </div>
)

// Insignia (píldora sin borde, fondo suave): el color significa lo mismo que en el sistema del personal (verde listo o atendida, naranja pendiente, rojo no efectuada, gris cerrada).
const TONOS = {
  verde: "bg-[#E3F4EA] text-[#166534]",
  ambar: "bg-[#FDEBD3] text-pt-ambar",
  rojo: "bg-[#FDECEC] text-[#B42318]",
  azul: "bg-pt-suave text-[#1B4FB5]",
  violeta: "bg-violet-100 text-violet-800",
  gris: "bg-slate-100 text-slate-700",
}
export function Insignia({ tono = "gris", children, className = "" }) {
  return <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-3.5 py-[3px] text-base font-semibold leading-snug ${TONOS[tono]} ${className}`}>{children}</span>
}

// El estado de una cita, con el nombre y el color del módulo de Citas (Pendiente naranja, En atención azul, Atendida verde, No efectuada rojo, En espera violeta, Cancelada gris).
const TONO_ESTADO = { Pendiente: "ambar", "En Espera": "violeta", "En Atención": "azul", Atendida: "verde", "No Asistió": "rojo", Cancelada: "gris" }
// `enCalendario`: el paciente ya la agregó a su calendario; el estado lo dice una sola vez, en la misma etiqueta («Pendiente · en tu calendario»).
export function EstadoCita({ estado, enCalendario = false }) {
  const calendario = enCalendario && estado === "Pendiente" ? " · en tu calendario" : ""
  return <span role="status" aria-label={"Estado: " + etiquetaEstadoCita(estado) + calendario}><Insignia tono={TONO_ESTADO[estado] || "gris"}>{etiquetaEstadoCita(estado)}{calendario}</Insignia></span>
}

// Lo que se ve mientras llegan los datos (en vez de una pantalla vacía o que parpadea).
export const Esqueleto = ({ alto = "h-28", etiqueta = "Cargando" }) => <div aria-busy="true" aria-label={etiqueta} className={"animate-pulse rounded-[20px] bg-slate-200/70 " + alto} />

// Un círculo de graduación: el valor en grande dentro de un anillo azul claro.
export function Circulo({ children, className = "" }) {
  return (
    <div className={"flex shrink-0 flex-col items-center justify-center rounded-full border-[#DCE6FA] text-center " + className} style={{ background: "radial-gradient(circle at 50% 38%, #FFFFFF 45%, #EEF3FD 100%)" }}>
      {children}
    </div>
  )
}

// Lo que se le dice al paciente cuando no puede cambiar su cita desde el portal: la óptica no lo permite, o ya falta poco. Siempre con la salida (WhatsApp de la óptica).
export function CambiosDeCita({ cita, citaProps = {}, className = "" }) {
  if (cita.estado !== "Pendiente" || citaProps.puedeReagendar?.(cita)) return null
  const texto = citaProps.cambiosPermitidos === false ? "Para cambiar tu cita, comunícate con la óptica." : citaProps.avisoNoReagendable?.(cita)
  if (!texto) return null
  return (
    <div className={"space-y-3 rounded-xl bg-pt-fondo p-4 " + className}>
      <p className="text-base text-pt-marino">{texto}</p>
      {citaProps.whatsappUrl && <a href={citaProps.whatsappUrl} target="_blank" rel="noopener noreferrer" className={BOTON_SECUNDARIO + " w-full sm:w-auto"}><MessageCircle size={20} aria-hidden="true" /> Escribir por WhatsApp</a>}
    </div>
  )
}

// «Agregar a mi calendario» cambia a «Agregada a tu calendario ✓» cuando el paciente ya la agregó (se guarda en la base, por cita: vale en todos sus aparatos). `otraVez`: en el detalle de la
// cita también se ofrece volver a agregarla. `corto`: «A mi calendario» (celular). `ocultaAgregada`: donde el estado de la cita ya dice «en tu calendario», no se repite.
export function BotonCalendario({ cita, citaProps = {}, principal = false, otraVez = false, corto = false, ocultaAgregada = false, className = "" }) {
  const agregada = citaProps.calendarioAgregada?.(cita.id)
  const boton = (texto, clase, estilo, etiqueta) => <button type="button" onClick={() => citaProps.onCalendario?.(cita)} aria-label={etiqueta} className={clase + " " + className} style={estilo}>{texto}</button>
  if (!agregada) return boton(corto ? "A mi calendario" : "Agregar a mi calendario", principal ? BOTON_PRINCIPAL : BOTON_SECUNDARIO, principal ? ESTILO_PRINCIPAL : undefined, "Agregar a mi calendario")
  if (ocultaAgregada) return null
  if (otraVez) return boton("Volver a agregarla a mi calendario", BOTON_SECUNDARIO) // el estado de la cita ya dice «en tu calendario»
  return (
    <>
      <span role="status" className={"inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#E3F4EA] px-5 py-2.5 text-center text-base font-semibold leading-snug text-[#166534] " + className}><Check size={20} strokeWidth={2.5} aria-hidden="true" /> Agregada a tu calendario</span>
    </>
  )
}

// Una cita en una fila de lista (otras citas próximas): cuándo, para qué, en qué estado está y qué sigue. Reagendar y cancelar solo si se puede.
export function FilaCita({ cita, onAbrir, ...citaProps }) {
  const { puedeReagendar, onReagendar, onCancelar } = citaProps
  const reagendable = puedeReagendar?.(cita)
  return (
    <li className="pt-abrible relative flex flex-col gap-3 py-4 transition-colors hover:bg-pt-fondo/60 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0 space-y-1">
        <button type="button" onClick={() => onAbrir?.(cita)} aria-label={`Ver el detalle de tu cita del ${formatoFecha(cita.fecha, "medio")}`} className="pt-abrir absolute inset-0 cursor-pointer" />
        <p className="text-lg font-bold leading-snug text-pt-marino">{formatoFecha(cita.fecha, "corto")} · {horaSinCero(cita.hora)}</p>
        <p className="text-base text-pt-texto">{cita.motivo || "Consulta"}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <EstadoCita estado={cita.estado} enCalendario={Boolean(citaProps.calendarioAgregada?.(cita.id))} />
          <span className="text-base text-pt-texto">{NOTA_ESTADO_CITA[cita.estado]}</span>
        </div>
        <CambiosDeCita cita={cita} citaProps={citaProps} className="mt-2" />
      </div>
      {reagendable && (
        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
          <button type="button" onClick={() => onReagendar?.(cita)} className={BOTON_SECUNDARIO}><CalendarClock size={20} aria-hidden="true" /> Reagendar</button>
          <button type="button" onClick={() => onCancelar?.(cita)} className={BOTON_PELIGRO}><X size={20} aria-hidden="true" /> Cancelar</button>
        </div>
      )}
    </li>
  )
}

// El seguimiento de unos lentes (Pedido → En el laboratorio → Listos para retirar → Entregados), mismo estado y mismo color que las órdenes de Ventas, con tres presentaciones:
//   "vertical"   (Resumen, laptop): marcador, nombre y fecha de cada paso, unidos por una línea.
//   "horizontal" (Resumen, celular): los cuatro marcadores en una fila y, debajo, el paso actual y lo que sigue.
//   "lista"      (Mis compras): una línea por paso con su fecha corta, dentro de «Estado de tus lentes».
const COLOR = { azul: "#1D5FD6", verde: "#15803D", rojo: "#DC2626", gris: "#475569" }
const diaMes = (v) => (v ? formatoFecha(diaDeRegistro(v), "largoSinDia").replace(/ de \d{4}$/, "") : "")
const diaCorto = (v) => (v ? formatoFecha(diaDeRegistro(v), "medioSinAnio") : "")

function Marcador({ estado, color, tam = 26 }) {
  const base = { width: tam, height: tam }
  if (estado === "hecho") return <span aria-hidden="true" className="grid shrink-0 place-items-center rounded-full text-white" style={{ ...base, background: "#15803D" }}><Check size={tam * 0.6} strokeWidth={3} /></span>
  if (estado === "actual") return <span aria-hidden="true" className="block shrink-0 rounded-full" style={{ ...base, background: color, boxShadow: `0 0 0 ${Math.round(tam * 0.27)}px ${color}2B` }} />
  return <span aria-hidden="true" className="block shrink-0 rounded-full border-2 border-slate-300 bg-white" style={base} />
}

export function PasosLentes({ orden, variante = "vertical", conMensaje = true }) {
  const { pasos, tono, actual } = pasosDeLosLentes(orden)
  const t = textoOrdenPaciente(orden)
  const color = COLOR[tono]
  const pedido = orden.pedidoEl || orden.creadaEn
  const atrasada = conMensaje && t.clave === "atrasada" && <p className="mt-3 rounded-xl px-4 py-3 text-base font-semibold leading-snug" style={{ background: color + "14", color }}>{t.detalle}</p>

  if (variante === "horizontal") {
    const siguiente = t.clave === "enviada" ? (orden.fechaPrometida ? `Listos para retirar el ${diaMes(orden.fechaPrometida)}, aproximadamente.` : t.detalle) : t.detalle
    return (
      <div>
        <ol aria-label="Seguimiento de tus lentes" className="flex items-center">
          {pasos.map((p, i) => (
            <li key={p.nombre} aria-current={p.estado === "actual" ? "step" : undefined} className={"flex items-center " + (i < pasos.length - 1 ? "flex-1" : "")}>
              <span className="sr-only">{p.nombre}: {p.estado === "hecho" ? "listo" : p.estado === "actual" ? "paso actual" : "falta"}</span>
              <Marcador estado={p.estado} color={color} />
              {i < pasos.length - 1 && <span aria-hidden="true" className="mx-0 h-[3px] flex-1" style={{ background: p.estado === "hecho" ? "#15803D" : "#DDE4EF" }} />}
            </li>
          ))}
        </ol>
        {conMensaje && (
          <div className="mt-4">
            <p className="text-lg font-bold leading-snug" style={{ color }}>{t.titulo}</p>
            <p className="mt-0.5 text-base text-pt-texto">{siguiente}</p>
          </div>
        )}
        {atrasada}
      </div>
    )
  }

  if (variante === "lista") {
    const sub = [
      pedido ? ` · ${diaCorto(pedido)}` : "",
      actual === 1 ? (orden.creadaEn ? ` · desde el ${diaCorto(orden.creadaEn)}` : "") : orden.creadaEn ? ` · ${diaCorto(orden.creadaEn)}` : "",
      actual === 2 ? (orden.listaEl ? ` · desde el ${diaCorto(orden.listaEl)}` : "") : actual > 2 ? (orden.listaEl ? ` · ${diaCorto(orden.listaEl)}` : "") : orden.fechaPrometida ? ` · aprox. ${diaCorto(orden.fechaPrometida)}` : "",
      orden.entregadaEl ? ` · ${diaCorto(orden.entregadaEl)}` : "",
    ]
    return (
      <div>
        <ol aria-label="Seguimiento de tus lentes" className="space-y-3.5">
          {pasos.map((p, i) => (
            <li key={p.nombre} aria-current={p.estado === "actual" ? "step" : undefined} className="flex items-center gap-3.5 text-base leading-snug">
              <Marcador estado={p.estado} color={color} tam={24} />
              <span className={p.estado === "actual" ? "font-bold" : "text-pt-marino"} style={p.estado === "actual" ? { color } : undefined}>{p.nombre}{sub[i]}</span>
            </li>
          ))}
        </ol>
        {atrasada}
      </div>
    )
  }

  // Vertical
  const sub = [
    pedido ? diaMes(pedido) : "",
    actual === 1 ? (orden.creadaEn ? `Desde el ${diaMes(orden.creadaEn)}` : "") : orden.creadaEn ? diaMes(orden.creadaEn) : "",
    actual === 2 ? (orden.listaEl ? `Desde el ${diaMes(orden.listaEl)}` : "") : actual > 2 ? diaMes(orden.listaEl) : orden.fechaPrometida ? `Estimado: ${diaMes(orden.fechaPrometida)}` : "",
    orden.entregadaEl ? diaMes(orden.entregadaEl) : "",
  ]
  return (
    <div>
      <ol aria-label="Seguimiento de tus lentes" className="flex flex-col">
        {pasos.map((p, i) => {
          const ultimo = i === pasos.length - 1
          return (
            <li key={p.nombre} aria-current={p.estado === "actual" ? "step" : undefined} className={"relative flex gap-4 " + (ultimo ? "" : "pb-3")}>
              {!ultimo && <span aria-hidden="true" className="absolute left-[11px] top-[26px] bottom-0 w-[3px]" style={{ background: p.estado === "hecho" ? "#15803D" : "#DDE4EF" }} />}
              <span className="relative z-10 mt-0.5"><Marcador estado={p.estado} color={color} /></span>
              <span className="min-w-0">
                <span className={"block text-lg font-semibold leading-snug " + (p.estado === "actual" ? "" : "text-pt-marino")} style={p.estado === "actual" ? { color } : undefined}>{p.nombre}</span>{" "}
                {sub[i] && <span className="block text-base leading-snug text-pt-texto">{sub[i]}</span>}
              </span>
            </li>
          )
        })}
      </ol>
      {atrasada}
    </div>
  )
}

// Las cinco estrellas para calificar la atención (cada una mide 48 px).
export function Estrellas({ valor, onCambiar, etiqueta = "Calificación" }) {
  return (
    <div role="radiogroup" aria-label={etiqueta} className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={valor === n} aria-label={`${n} de 5`} onClick={() => onCambiar?.(n)} className="grid h-11 w-11 place-items-center rounded-lg transition-colors hover:bg-amber-50 cursor-pointer">
          <Star size={32} aria-hidden="true" fill={valor >= n ? "#F59E0B" : "none"} stroke={valor >= n ? "#F59E0B" : "#94A3B8"} strokeWidth={1.8} />
        </button>
      ))}
    </div>
  )
}

// El ícono de «Mi receta» del diseño aprobado: dos círculos unidos por el puente (sin las patillas del ícono de lentes de la marca).
export const IconoLentes = ({ size = 24, ...resto }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...resto}>
    <circle cx="6.5" cy="13" r="4" /><circle cx="17.5" cy="13" r="4" /><path d="M10.5 13h3" />
  </svg>
)
