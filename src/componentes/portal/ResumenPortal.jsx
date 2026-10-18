"use client"

import { useState } from "react"
import { CalendarPlus, Phone, MessageCircle, Navigation, Eye, ChevronRight, Glasses, CalendarCheck, DollarSign, Star } from "lucide-react"
import { formatoFecha, nombreMes } from "../../utilidades/formatoFecha"
import { nombreDeLosLentes, textoControl, tipoDeLentes } from "../../utilidades/portalPaciente"
import { enCuantoTiempo, valorD } from "../../utilidades/portalVistas"
import { fraseDeCambio } from "../../utilidades/graduacion"
import { Tarjeta, TituloTarjeta, Esqueleto, PasosLentes, VerDetalle } from "./piezas"
import OjoIlustrado from "../graduacion/OjoIlustrado"
import BoletoCita from "./BoletoCita"
import { useCelular } from "./useAncho"
import { BOTON_PRINCIPAL, BOTON_SECUNDARIO, BOTON_SOBRE_OSCURO, BOTON_BORDE_BLANCO, ENLACE_AZUL, ESTILO_PRINCIPAL } from "./estilos"

const mayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1)
const diaMes = (iso) => formatoFecha(iso, "largoSinDia").replace(/ de \d{4}$/, "")

const ICONO_PENDIENTE = { lentes: Glasses, cita: CalendarCheck, saldo: DollarSign, calificar: Star }

// «Pendiente para ti»: lo que el paciente debe hacer, por prioridad (retirar lentes, confirmar la cita, pagar el saldo, calificar una visita). Solo se dibuja si hay algo.
function PendienteParaTi({ pendientes, onAbrir, onConfirmar }) {
  const [confirmando, setConfirmando] = useState("")
  const [error, setError] = useState("")
  const confirmar = async (p) => {
    setConfirmando(p.id); setError("")
    const r = await onConfirmar(p.confirmar)
    setConfirmando("")
    if (!r.ok) setError(r.error)
  }
  return (
    <section aria-labelledby="pendiente" className="rounded-[20px] border border-pt-borde bg-white p-5 sm:px-[34px] sm:py-7">
      <h2 id="pendiente" className="font-heading text-xl font-bold text-pt-marino">Pendiente para ti</h2>
      <ul className="mt-4 grid gap-4 @[900px]/portal:grid-cols-2">
        {pendientes.map((p) => {
          const Icono = ICONO_PENDIENTE[p.tipo]
          const ambar = p.tipo === "saldo"
          return (
            <li key={p.id} className={"pt-abrible relative flex min-h-[96px] flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border px-4 py-4 transition-shadow hover:shadow-md sm:px-5 " + (ambar ? "border-[#F6D9A8] bg-[#FEF4E5]" : "border-pt-borde bg-pt-fondo")}>
              <button type="button" onClick={() => onAbrir(p.abrir)} aria-label={`${p.titulo}. Ver el detalle`} className="pt-abrir absolute inset-0 rounded-2xl cursor-pointer" />
              <span aria-hidden="true" className={"grid h-14 w-14 shrink-0 place-items-center rounded-2xl " + (ambar ? "bg-[#FDEBD3] text-pt-ambar" : "bg-pt-suave text-pt-azul")}><Icono size={26} /></span>
              <span className="min-w-[12rem] flex-1">
                <span className="block text-lg font-bold leading-snug text-pt-marino">{p.titulo}</span>
                <span className="block text-base text-pt-texto">{p.texto}</span>
              </span>
              {p.confirmar
                ? <button type="button" onClick={() => confirmar(p)} disabled={Boolean(confirmando)} className={BOTON_PRINCIPAL + " shrink-0"} style={ESTILO_PRINCIPAL}>{confirmando === p.id ? "Confirmando…" : p.accion}</button>
                : <span className={"shrink-0 text-base font-semibold " + (ambar ? "text-pt-ambar" : "text-pt-azul")}>{p.accion}</span>}
            </li>
          )
        })}
      </ul>
      {error && <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-base font-medium text-red-700">{error}</p>}
    </section>
  )
}

// «Tus lentes»: el pedido y la línea de pasos (vertical en laptop, horizontal en el celular). Si ya están listos, «Ya puedes retirarlos» con el horario de hoy.
function TarjetaLentes({ ordenes, horarioHoy, celular, onAbrir }) {
  const una = ordenes.length === 1
  return (
    <Tarjeta aria-labelledby="lentes" className="flex h-full flex-col" onAbrir={una ? () => onAbrir({ tipo: "pedido", id: ordenes[0].id }) : undefined} etiquetaAbrir="Ver el detalle del pedido de tus lentes">
      <TituloTarjeta id="lentes">Tus lentes</TituloTarjeta>
      <ul className="mt-1 flex-1 divide-y divide-pt-borde">
        {ordenes.map((o) => (
          <li key={o.id} className={"space-y-4 py-3 first:pt-0 last:pb-0" + (una ? "" : " pt-abrible relative")}>
            {!una && <button type="button" onClick={() => onAbrir({ tipo: "pedido", id: o.id })} aria-label={`Ver el detalle del pedido de ${nombreDeLosLentes(o).toLowerCase()}`} className="pt-abrir absolute inset-0 cursor-pointer" />}
            {!celular && <p className="text-base leading-snug text-pt-texto">{tipoDeLentes(o).replace("Lentes ", "").replace(/^./, (c) => c.toUpperCase())}{o.montura ? ` · montura ${o.montura}` : ""}</p>}
            <PasosLentes orden={o} variante={celular ? "horizontal" : "vertical"} conMensaje={o.estado !== "lista" || !celular} />
            {o.estado === "lista" && (
              <div className="rounded-xl bg-[#E3F4EA] px-4 py-3 text-[#166534]">
                <p className="text-lg font-bold">Ya puedes retirarlos</p>
                {horarioHoy && <p className="text-base">{horarioHoy}</p>}
              </div>
            )}
            {!una && <p className="text-right"><VerDetalle /></p>}
          </li>
        ))}
      </ul>
      {una && <p className="mt-2 text-right"><VerDetalle /></p>}
    </Tarjeta>
  )
}

// «Tu graduación»: los dos ojos ilustrados con la esfera en grande, el cilindro y el eje, y una frase de cómo cambió con el enlace a la receta.
function TarjetaGraduacion({ receta, cambio, onVerReceta, onAbrir, celular }) {
  const ojo = (titulo, o = {}) => {
    const cil = valorD(o.cilindro)
    const detalle = cil ? `cil ${cil}${!celular && o.eje ? ` · eje ${o.eje}°` : ""}` : "sin cilindro"
    return (
      <div className="flex flex-col items-center text-center">
        <OjoIlustrado ancho={celular ? 140 : 176} />
        <p className="mt-2 font-heading text-[32px] font-bold leading-none tabular-nums text-pt-marino sm:text-[44px]">{valorD(o.esfera) || "—"}</p>
        <p className="mt-1.5 text-base text-pt-texto">{detalle}</p>
        <p className="mt-2 text-lg font-semibold text-pt-marino">{titulo}</p>
      </div>
    )
  }
  return (
    <Tarjeta aria-labelledby="graduacion" className="flex h-full flex-col" onAbrir={() => onAbrir({ tipo: "receta", id: receta.id })} etiquetaAbrir="Ver tu receta completa">
      <div className="flex items-baseline justify-between gap-3">
        <TituloTarjeta id="graduacion">Tu graduación</TituloTarjeta>
        {!celular && <span className="text-base text-pt-texto">Receta del {formatoFecha(receta.fecha, "largoSinDia")}</span>}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5 sm:gap-x-7">{ojo("Ojo izquierdo", receta.oi)}{ojo("Ojo derecho", receta.od)}</div>
      {celular
        ? <button type="button" onClick={onVerReceta} className={BOTON_SECUNDARIO + " mt-5 w-full"}>Ver mi receta completa</button>
        : (
          <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl bg-pt-fondo px-5 py-4">
            <p className="text-base leading-relaxed text-pt-marino">{cambio || "Esta es tu graduación vigente."}</p>
            <button type="button" onClick={onVerReceta} className={ENLACE_AZUL + " shrink-0"}>Ver mi receta<ChevronRight size={20} aria-hidden="true" /></button>
          </div>
        )}
    </Tarjeta>
  )
}

function TarjetaControl({ control, tieneCitaPendiente, onAgendar, onAbrir, celular }) {
  const [anio, mes] = control.iso.split("-").map(Number)
  return (
    <Tarjeta aria-labelledby="control" onAbrir={() => onAbrir({ tipo: "control" })} etiquetaAbrir="Ver por qué se recomienda tu próximo control">
      <div className="flex items-center gap-5">
        {!celular && <span aria-hidden="true" className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-pt-suave text-pt-azul"><Eye size={28} /></span>}
        <div className="min-w-0 flex-1">
          <h2 id="control" className="text-base text-pt-texto">Tu próximo control</h2>
          <p className={"font-heading text-2xl font-bold leading-tight sm:text-[26px] " + (control.vencido ? "text-red-700" : "text-pt-marino")}>{mayuscula(nombreMes(mes - 1))} de {anio}</p>
          <p className="mt-0.5 text-base text-pt-texto">{control.vencido ? textoControl(control) : `${mayuscula(enCuantoTiempo(control.dias))} · te avisaremos antes`}</p>
        </div>
        <ChevronRight size={22} className="shrink-0 text-slate-500" aria-hidden="true" />
      </div>
      {!tieneCitaPendiente && (
        <button type="button" onClick={() => onAgendar("control")} className={BOTON_PRINCIPAL + " mt-4 w-full"} style={ESTILO_PRINCIPAL}><CalendarPlus size={22} aria-hidden="true" /> Agendar control</button>
      )}
    </Tarjeta>
  )
}

// «Tus puntos de cliente»: los mismos puntos y la misma regla que el CRM del personal, y lo que le falta para ser cliente frecuente.
export function TarjetaPuntos({ puntos, onAbrir }) {
  return (
    <Tarjeta aria-labelledby="puntos" onAbrir={() => onAbrir({ tipo: "puntos" })} etiquetaAbrir="Ver cómo sumas tus puntos">
      <h2 id="puntos" className="flex items-center justify-between gap-3 text-base text-pt-texto">Tus puntos de cliente<ChevronRight size={22} className="shrink-0 text-slate-500" aria-hidden="true" /></h2>
      <p className="mt-2 font-heading text-[32px] font-bold leading-none tabular-nums text-pt-marino">{puntos.puntos} <span className="text-lg font-medium text-pt-texto">puntos</span></p>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#E9EEF5]" role="img" aria-label={`Llevas el ${puntos.porcentaje} por ciento del camino a cliente frecuente`}><div className="h-full rounded-full bg-[#15803D]" style={{ width: puntos.porcentaje + "%" }} /></div>
      <p className="mt-3 text-base leading-snug text-pt-texto">{puntos.texto}</p>
    </Tarjeta>
  )
}

// La franja oscura de la óptica: si está abierta o cerrada hoy, la dirección y el horario, y tres botones (Llamar y WhatsApp en blanco, Cómo llegar con borde).
function FranjaOptica({ contacto, celular, onAbrir }) {
  const hoy = contacto.hoy
  const textoHoy = !hoy ? "" : hoy.abierto ? hoy.texto.replace(/^Abierto hoy hasta las /, celular ? "Abierto · cierra a las " : "Abierto ahora · cierra a las ") : hoy.texto
  const linea2 = [contacto.direccion, "ver horario y mapa"].filter(Boolean).join(" · ")
  const boton = "flex-auto whitespace-nowrap !px-1.5 sm:flex-none sm:!px-5"
  return (
    <section aria-label="La óptica" className={"flex flex-col gap-4 rounded-[20px] bg-pt-marino px-5 py-5 text-white sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-7 " + (onAbrir ? "pt-abrible relative transition-shadow hover:shadow-lg" : "")}>
      {onAbrir && <button type="button" onClick={() => onAbrir({ tipo: "optica" })} aria-label="Ver el horario completo, la dirección y el mapa de la óptica" className="pt-abrir absolute inset-0 rounded-[20px] cursor-pointer" />}
      <div className="min-w-0">
        {textoHoy && (
          <p className="flex items-center gap-3 text-lg font-bold leading-snug">
            <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: hoy.abierto ? "#34D399" : "#FBBF24" }} />
            <span className="min-w-0">{textoHoy}</span>
          </p>
        )}
        {!celular && linea2 && <p className="mt-1 text-base leading-snug text-[#B9C4D6]">{linea2}</p>}
      </div>
      {(contacto.telefono || contacto.comoLlegarUrl) && (
        <div className="flex w-full shrink-0 gap-1.5 sm:w-auto sm:gap-3">
          {contacto.telefono && <a href={contacto.telefonoHref} className={BOTON_SOBRE_OSCURO + " " + boton}>{!celular && <Phone size={20} aria-hidden="true" />} Llamar</a>}
          {contacto.telefono && <a href={contacto.whatsappUrl} target="_blank" rel="noopener noreferrer" className={BOTON_SOBRE_OSCURO + " " + boton}>{!celular && <MessageCircle size={20} aria-hidden="true" />} WhatsApp</a>}
          {contacto.comoLlegarUrl && <a href={contacto.comoLlegarUrl} target="_blank" rel="noopener noreferrer" className={BOTON_BORDE_BLANCO + " " + boton}>{!celular && <Navigation size={20} aria-hidden="true" />} Cómo llegar</a>}
        </div>
      )}
    </section>
  )
}

const PASOS_NUEVO = [["Agenda tu cita", "Elige el día y la hora que más te convengan."], ["Te atendemos", "Revisamos tu vista y te damos tu receta."], ["Sigue tus lentes aquí", "Mira en qué paso va tu pedido, sin llamar."]]

// Inicio del portal (diseño aprobado). Arriba, «Pendiente para ti» (solo si hay algo). Después: tu próxima cita en estilo boleto y tus lentes; tu graduación con los ojos ilustrados y, a la
// derecha, el próximo control y tus puntos; y abajo, la franja oscura de la óptica. La rejilla va por el ancho de la zona de contenido, no de la ventana.
export default function ResumenPortal({ cargando, esNuevo, proximaCita, detalleCita, detalleDisponible, ordenesAbiertas, pendientes = [], control, tieneCitaPendiente, puntos, contacto, hayContacto, ultimaReceta, consultas = [], nombreOptica, direccion, citaProps, onConfirmar, onAbrir, onAgendar, onVerReceta }) {
  const celular = useCelular()
  if (cargando) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Cargando tu resumen">
        <h1 className="sr-only">Inicio</h1>
        <div className="pt-fila pt-fila--8-4"><Esqueleto alto="h-64" etiqueta="Cargando tu próxima cita" /><Esqueleto alto="h-64" /></div>
        <div className="pt-fila pt-fila--7-5"><Esqueleto alto="h-80" /><Esqueleto alto="h-44" /></div>
      </div>
    )
  }
  const hayLentes = ordenesAbiertas.length > 0

  if (esNuevo) {
    return (
      <div className="space-y-5 sm:space-y-6">
        <h1 className="sr-only">Inicio</h1>
        <section aria-label="Bienvenida" className="rounded-[20px] bg-pt-marino p-6 text-white sm:p-9">
          <p className="text-lg font-medium text-white/80">Bienvenido</p>
          <h2 className="mt-1 max-w-2xl font-heading text-3xl font-bold leading-tight sm:text-4xl">Te damos la bienvenida a {nombreOptica}</h2>
          <p className="mt-3 max-w-xl text-lg text-white/85">Este es tu portal: aquí vas a ver tus citas, tu receta, el estado de tus lentes y lo que debes. Empieza agendando tu primera cita.</p>
          <button type="button" onClick={() => onAgendar()} className={BOTON_SOBRE_OSCURO + " mt-6 w-full sm:w-auto"}><CalendarPlus size={22} aria-hidden="true" /> Agendar mi primera cita</button>
        </section>
        <ol aria-label="Cómo funciona" className="pt-fila pt-fila--cuatro">
          {PASOS_NUEVO.map(([titulo, texto], i) => (
            <li key={titulo} className="rounded-[20px] border border-pt-borde bg-white p-5 sm:p-6">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-pt-suave text-base font-bold text-pt-azul">{i + 1}</span>
              <p className="mt-3 text-lg font-bold text-pt-marino">{titulo}</p>
              <p className="mt-1 text-base text-pt-texto">{texto}</p>
            </li>
          ))}
        </ol>
        {hayContacto && <FranjaOptica contacto={contacto} celular={celular} onAbrir={onAbrir} />}
      </div>
    )
  }

  const derecha = Boolean(control) || Boolean(puntos)
  const cambio = fraseDeCambio(consultas)
  return (
    <div className="space-y-5 sm:space-y-6">
      <h1 className="sr-only">Inicio</h1>
      {pendientes.length > 0 && <PendienteParaTi pendientes={pendientes} onAbrir={onAbrir} onConfirmar={onConfirmar} />}
      <div className={"pt-fila " + (hayLentes ? "pt-fila--8-4" : "pt-fila--solo")}>
        <BoletoCita cita={proximaCita} detalle={detalleCita} detalleDisponible={detalleDisponible} direccion={direccion} citaProps={citaProps} onConfirmar={onConfirmar} onAbrir={(c) => onAbrir({ tipo: "cita", id: c.id })} onAgendar={onAgendar} ocultarConfirmar />
        {hayLentes && <TarjetaLentes ordenes={ordenesAbiertas} horarioHoy={contacto.hoy?.texto} celular={celular} onAbrir={onAbrir} />}
      </div>
      {(ultimaReceta || derecha) && (
        <div className={"pt-fila pt-fila--arriba " + (ultimaReceta && derecha ? "pt-fila--7-5" : ultimaReceta ? "pt-fila--solo" : "pt-fila--dos")}>
          {ultimaReceta && <TarjetaGraduacion receta={ultimaReceta} cambio={cambio} onVerReceta={onVerReceta} onAbrir={onAbrir} celular={celular} />}
          {derecha && (
            <div className="space-y-5 sm:space-y-6">
              {control && <TarjetaControl control={control} tieneCitaPendiente={tieneCitaPendiente} onAgendar={onAgendar} onAbrir={onAbrir} celular={celular} />}
              {puntos && <TarjetaPuntos puntos={puntos} onAbrir={onAbrir} />}
            </div>
          )}
        </div>
      )}
      {hayContacto && <FranjaOptica contacto={contacto} celular={celular} onAbrir={onAbrir} />}
    </div>
  )
}
