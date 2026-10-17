"use client"

import { useState } from "react"
import { CalendarPlus, CalendarCheck, Glasses, Receipt, MapPin, Phone, MessageCircle, Clock, ArrowRight, Navigation, ChevronDown, Sparkles, Stethoscope, PackageCheck, FileDown, FileText, Wrench, Eye, BadgeCheck } from "lucide-react"
import { INK } from "@/lib/tema"
import { dinero } from "../../utilidades/formatoMoneda"
import { formatoFecha } from "../../utilidades/formatoFecha"
import { nombreDeLosLentes, textoControl } from "../../utilidades/portalPaciente"
import { enCuantoTiempo, porcentajeAbonado } from "../../utilidades/portalVistas"
import { textoGraduacionOjo } from "../../utilidades/recetaTexto"
import { Bloque, TituloPagina, Esqueleto, PasosLentes, Baldosa } from "./piezas"
import BoletoCita from "./BoletoCita"
import { BOTON_PRINCIPAL, BOTON_SECUNDARIO, ESTILO_PRINCIPAL } from "./estilos"

// «Mis lentes»: la línea de pasos vertical con la fecha de cada paso, y si ya están listos, «Ya puedes retirarlos» con el horario de hoy.
function TarjetaLentes({ ordenes, horarioHoy }) {
  return (
    <Bloque id="lentes" titulo="Mis lentes" Icono={Glasses} tono="violeta" className="h-full">
      <ul className="divide-y divide-slate-100">
        {ordenes.map((o) => (
          <li key={o.id} className="space-y-4 py-4 first:pt-0 last:pb-0">
            <p className="text-lg font-semibold leading-snug text-slate-800">{nombreDeLosLentes(o)}</p>
            <PasosLentes orden={o} vertical conMensaje={o.estado !== "lista"} />
            {o.estado === "lista" && (
              <div className="flex items-start gap-3 rounded-xl bg-emerald-50 px-4 py-3 text-emerald-800">
                <PackageCheck size={26} className="mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  <p className="text-xl font-bold">Ya puedes retirarlos</p>
                  {horarioHoy && <p className="text-lg">{horarioHoy}</p>}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Bloque>
  )
}

function TarjetaControl({ control, tieneCitaPendiente, onAgendar }) {
  return (
    <Bloque id="control" titulo="Mi próximo control" Icono={Clock} tono="azul" className="h-full">
      <p className="font-heading text-3xl font-bold leading-tight sm:text-4xl" style={{ color: control.vencido ? "#B91C1C" : INK }}>{formatoFecha(control.iso, "medio")}</p>
      <p className="mt-1 text-xl font-semibold text-slate-700 first-letter:uppercase">{control.vencido ? textoControl(control) : enCuantoTiempo(control.dias)}</p>
      {control.ultima && <p className="mt-2 text-lg text-slate-600">Tu último examen fue el {formatoFecha(control.ultima, "medio")}.</p>}
      {!tieneCitaPendiente && (
        <button type="button" onClick={() => onAgendar("control")} className={BOTON_PRINCIPAL + " mt-4 w-full"} style={ESTILO_PRINCIPAL}><CalendarPlus size={22} aria-hidden="true" /> Agendar control</button>
      )}
    </Bloque>
  )
}

function TarjetaSaldo({ saldoInfo, onVerCompras }) {
  const pct = porcentajeAbonado(saldoInfo.total, saldoInfo.abonado)
  return (
    <Bloque id="saldo" titulo="Mi saldo" Icono={Receipt} tono="ambar" className="h-full">
      <p className="text-lg text-slate-700">Saldo por pagar</p>
      <p className="font-heading text-4xl font-bold tabular-nums leading-tight" style={{ color: "#B45309" }}>{dinero(saldoInfo.saldo)}</p>
      <div className="mt-3" role="img" aria-label={`Has abonado el ${pct} por ciento: ${dinero(saldoInfo.abonado)} de ${dinero(saldoInfo.total)}`}>
        <div className="h-3 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-emerald-500" style={{ width: pct + "%" }} /></div>
        <p className="mt-1.5 text-base text-slate-600">Abonaste {dinero(saldoInfo.abonado)} de {dinero(saldoInfo.total)}</p>
      </div>
      <button type="button" onClick={onVerCompras} aria-label={`Tienes un saldo por pagar de ${dinero(saldoInfo.saldo)}. Ver mis compras`} className={BOTON_SECUNDARIO + " mt-4 w-full"}>Ver mis compras <ArrowRight size={20} aria-hidden="true" /></button>
    </Bloque>
  )
}

// La óptica, en pocas líneas: abierta o cerrada hoy, la dirección y tres botones con ícono. El horario de toda la semana, solo al expandir.
function TarjetaOptica({ contacto }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <Bloque id="optica" titulo="La óptica" Icono={MapPin} tono="verde" className="h-full">
      {contacto.hoy && (
        <p className="flex items-start gap-2 text-lg font-semibold leading-snug" style={{ color: contacto.hoy.abierto ? "#047857" : "#475569" }}>
          <span aria-hidden="true" className="mt-2 h-3 w-3 shrink-0 rounded-full" style={{ background: contacto.hoy.abierto ? "#10B981" : "#94A3B8" }} />
          {contacto.hoy.texto}
        </p>
      )}
      {contacto.direccion && <p className="mt-2 text-lg text-slate-700">{contacto.direccion}</p>}
      {contacto.horario.length > 0 && (
        <div className="mt-1">
          <button type="button" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto} className="inline-flex min-h-11 items-center gap-1.5 text-lg font-semibold text-blue-700 hover:underline cursor-pointer">
            {abierto ? "Ocultar el horario" : "Ver el horario completo"} <ChevronDown size={20} aria-hidden="true" className={"transition-transform " + (abierto ? "rotate-180" : "")} />
          </button>
          {abierto && <ul className="mt-1 space-y-1 text-lg text-slate-700">{contacto.horario.map((h) => <li key={h.etiqueta}><span className="font-semibold">{h.etiqueta}</span> · {h.horario}</li>)}</ul>}
        </div>
      )}
      {(contacto.telefono || contacto.comoLlegarUrl) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {contacto.telefono && <a href={contacto.telefonoHref} className={BOTON_SECUNDARIO + " flex-1 px-3"}><Phone size={20} aria-hidden="true" /> Llamar</a>}
          {contacto.telefono && <a href={contacto.whatsappUrl} target="_blank" rel="noopener noreferrer" className={BOTON_SECUNDARIO + " flex-1 px-3"}><MessageCircle size={20} aria-hidden="true" /> WhatsApp</a>}
          {contacto.comoLlegarUrl && <a href={contacto.comoLlegarUrl} target="_blank" rel="noopener noreferrer" className={BOTON_SECUNDARIO + " flex-1 px-3"}><Navigation size={20} aria-hidden="true" /> Cómo llegar</a>}
        </div>
      )}
    </Bloque>
  )
}

// Un valor de la receta en resumen: el ojo, la graduación en grande y la agudeza.
const Ojo = ({ titulo, ojo = {} }) => (
  <div className="rounded-xl bg-slate-50 p-4">
    <p className="text-base font-semibold text-slate-600">{titulo}</p>
    <p className="font-heading text-2xl font-bold tabular-nums leading-snug sm:text-3xl" style={{ color: INK }}>{textoGraduacionOjo(ojo)}</p>
    <p className="text-base text-slate-600">Agudeza visual {ojo.avCc || ojo.avSc || "—"}</p>
  </div>
)

function TarjetaUltimaReceta({ receta, onVerReceta }) {
  return (
    <Bloque id="ultima-receta" titulo="Tu última receta" Icono={Eye} tono="rosa" className="h-full"
      derecha={<span className="text-base text-slate-600">{formatoFecha(receta.fecha, "medio")}</span>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Ojo titulo="Ojo derecho" ojo={receta.od} />
        <Ojo titulo="Ojo izquierdo" ojo={receta.oi} />
      </div>
      <button type="button" onClick={onVerReceta} className={BOTON_SECUNDARIO + " mt-4 w-full sm:w-auto"}>Ver mi receta <ArrowRight size={20} aria-hidden="true" /></button>
    </Bloque>
  )
}

// Accesos rápidos: lo que más pide un paciente de óptica, a un toque.
function AccesosRapidos({ hayReceta, hayCompras, onDescargarReceta, onFacturas, onGarantia }) {
  const acceso = (Icono, tono, texto, onClick, mostrar = true) => mostrar && (
    <button type="button" onClick={onClick} className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-slate-200/70 bg-white px-3 py-2 text-left text-lg font-semibold text-slate-800 transition-colors hover:bg-slate-50 cursor-pointer">
      <Baldosa Icono={Icono} tono={tono} tam="h-10 w-10" /> <span className="min-w-0 flex-1">{texto}</span> <ArrowRight size={20} className="shrink-0 text-slate-400" aria-hidden="true" />
    </button>
  )
  return (
    <Bloque id="accesos" titulo="Accesos rápidos" Icono={BadgeCheck} tono="gris" className="h-full">
      <div className="space-y-2.5">
        {acceso(FileDown, "rosa", "Descargar mi receta", onDescargarReceta, hayReceta)}
        {acceso(FileText, "ambar", "Mis facturas", onFacturas, hayCompras)}
        {acceso(Wrench, "violeta", "Solicitar ajuste o garantía", onGarantia, hayCompras)}
      </div>
    </Bloque>
  )
}

const PASOS_NUEVO = [[CalendarCheck, "azul", "Agenda tu cita", "Elige el día y la hora que más te convengan."], [Stethoscope, "verde", "Te atendemos", "Revisamos tu vista y te damos tu receta."], [Glasses, "violeta", "Sigue tus lentes aquí", "Mira en qué paso va tu pedido, sin llamar."]]

// Resumen del portal. Primera fila: tu próxima cita en estilo boleto y, si hay lentes en proceso, su línea de pasos. Segunda: el próximo control, el saldo y la óptica (las que
// tengan algo que mostrar). Tercera: tu última receta y los accesos rápidos. La rejilla va por el ancho de la zona de contenido, no de la ventana.
export default function ResumenPortal({ cargando, esNuevo, proximaCita, detalleCita, detalleDisponible, ordenesAbiertas, control, tieneCitaPendiente, saldoInfo, contacto, hayContacto, ultimaReceta, hayCompras, nombreOptica, direccion, citaProps, onConfirmar, onIcs, onAgendar, onVerCompras, onVerReceta, onDescargarReceta, onGarantia }) {
  if (cargando) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Cargando tu resumen">
        <TituloPagina>Resumen</TituloPagina>
        <div className="pt-fila pt-fila--8-4"><Esqueleto alto="h-64" etiqueta="Cargando tu próxima cita" /><Esqueleto alto="h-64" /></div>
        <div className="pt-fila pt-fila--auto"><Esqueleto alto="h-44" /><Esqueleto alto="h-44" /><Esqueleto alto="h-44" /></div>
      </div>
    )
  }
  const hayLentes = ordenesAbiertas.length > 0
  const fila2 = [Boolean(control), Boolean(saldoInfo), hayContacto].filter(Boolean).length

  if (esNuevo) {
    return (
      <div className="space-y-6">
        <TituloPagina>Resumen</TituloPagina>
        <section aria-label="Bienvenida" className="relative overflow-hidden rounded-2xl p-6 text-white shadow-lg sm:p-9" style={{ background: "var(--portal-hero)" }}>
          <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10" />
          <p className="flex items-center gap-2 text-lg font-semibold text-white/85"><Sparkles size={22} aria-hidden="true" /> Bienvenido</p>
          <h2 className="mt-2 max-w-2xl font-heading text-3xl font-bold leading-tight sm:text-4xl">Te damos la bienvenida a {nombreOptica}</h2>
          <p className="mt-3 max-w-xl text-lg text-white/90">Este es tu portal: aquí vas a ver tus citas, tu receta, el estado de tus lentes y lo que debes. Empieza agendando tu primera cita.</p>
          <button type="button" onClick={() => onAgendar()} className="mt-6 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white px-6 py-3 text-base font-semibold text-slate-900 transition-colors hover:bg-slate-100 cursor-pointer sm:w-auto"><CalendarPlus size={22} aria-hidden="true" /> Agendar mi primera cita</button>
        </section>
        <ol aria-label="Cómo funciona" className="pt-fila pt-fila--auto">
          {PASOS_NUEVO.map(([Icono, tono, titulo, texto], i) => (
            <li key={titulo} className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex items-center gap-3"><Baldosa Icono={Icono} tono={tono} tam="h-12 w-12" /><span className="text-base font-semibold text-slate-500">Paso {i + 1}</span></div>
              <p className="mt-3 text-lg font-bold" style={{ color: INK }}>{titulo}</p>
              <p className="mt-1 text-lg text-slate-700">{texto}</p>
            </li>
          ))}
        </ol>
        {hayContacto && <div className="pt-fila pt-fila--dos"><TarjetaOptica contacto={contacto} /></div>}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <TituloPagina>Resumen</TituloPagina>
      <div className={"pt-fila " + (hayLentes ? "pt-fila--8-4" : "pt-fila--solo")}>
        <BoletoCita cita={proximaCita} detalle={detalleCita} detalleDisponible={detalleDisponible} direccion={direccion} citaProps={citaProps} onConfirmar={onConfirmar} onIcs={onIcs} onAgendar={onAgendar} />
        {hayLentes && <TarjetaLentes ordenes={ordenesAbiertas} horarioHoy={contacto.hoy?.texto} />}
      </div>
      {fila2 > 0 && (
        <div className="pt-fila pt-fila--auto">
          {control && <TarjetaControl control={control} tieneCitaPendiente={tieneCitaPendiente} onAgendar={onAgendar} />}
          {saldoInfo && <TarjetaSaldo saldoInfo={saldoInfo} onVerCompras={onVerCompras} />}
          {hayContacto && <TarjetaOptica contacto={contacto} />}
        </div>
      )}
      {(ultimaReceta || hayCompras) && (
        <div className={"pt-fila " + (ultimaReceta ? "pt-fila--8-4" : "pt-fila--solo")}>
          {ultimaReceta && <TarjetaUltimaReceta receta={ultimaReceta} onVerReceta={onVerReceta} />}
          <AccesosRapidos hayReceta={Boolean(ultimaReceta)} hayCompras={hayCompras} onDescargarReceta={onDescargarReceta} onFacturas={onVerCompras} onGarantia={onGarantia} />
        </div>
      )}
    </div>
  )
}
