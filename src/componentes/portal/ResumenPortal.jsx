"use client"

import { useState } from "react"
import { CalendarPlus, Glasses, Receipt, MapPin, Phone, MessageCircle, Clock, ArrowRight, Navigation, ChevronDown } from "lucide-react"
import { INK } from "@/lib/tema"
import { dinero } from "../../utilidades/formatoMoneda"
import { formatoFecha } from "../../utilidades/formatoFecha"
import { nombreDeLosLentes, textoControl } from "../../utilidades/portalPaciente"
import { Bloque, TituloPagina, Esqueleto, PasosLentes } from "./piezas"
import HeroCita from "./HeroCita"
import { BOTON_PRINCIPAL, BOTON_SECUNDARIO, ESTILO_PRINCIPAL } from "./estilos"

// La óptica, en pocas líneas: abierta o cerrada hoy (y hasta qué hora), la dirección y los botones. El horario de toda la semana, solo al expandir.
function TarjetaOptica({ contacto }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <Bloque id="optica" titulo="La óptica" Icono={MapPin}>
      {contacto.hoy && (
        <p className="flex items-center gap-2 text-lg font-semibold" style={{ color: contacto.hoy.abierto ? "#047857" : "#475569" }}>
          <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-full" style={{ background: contacto.hoy.abierto ? "#10B981" : "#94A3B8" }} />
          {contacto.hoy.texto}
        </p>
      )}
      {contacto.direccion && <p className="mt-2 text-lg text-slate-700">{contacto.direccion}</p>}
      {contacto.horario.length > 0 && (
        <div className="mt-2">
          <button type="button" onClick={() => setAbierto((v) => !v)} aria-expanded={abierto} className="inline-flex min-h-11 items-center gap-1.5 text-lg font-semibold text-blue-700 hover:underline cursor-pointer">
            {abierto ? "Ocultar el horario" : "Ver el horario completo"} <ChevronDown size={20} aria-hidden="true" className={"transition-transform " + (abierto ? "rotate-180" : "")} />
          </button>
          {abierto && <ul className="mt-1 space-y-1 text-lg text-slate-700">{contacto.horario.map((h) => <li key={h.etiqueta}><span className="font-semibold">{h.etiqueta}</span> · {h.horario}</li>)}</ul>}
        </div>
      )}
      {(contacto.telefono || contacto.comoLlegarUrl) && (
        <div className="mt-4 grid gap-2">
          {contacto.telefono && <a href={contacto.telefonoHref} className={BOTON_SECUNDARIO}><Phone size={20} aria-hidden="true" /> Llamar</a>}
          {contacto.telefono && <a href={contacto.whatsappUrl} target="_blank" rel="noopener noreferrer" className={BOTON_SECUNDARIO}><MessageCircle size={20} aria-hidden="true" /> WhatsApp</a>}
          {contacto.comoLlegarUrl && <a href={contacto.comoLlegarUrl} target="_blank" rel="noopener noreferrer" className={BOTON_SECUNDARIO}><Navigation size={20} aria-hidden="true" /> Cómo llegar</a>}
        </div>
      )}
    </Bloque>
  )
}

// Resumen del portal: una tarjeta destacada con lo más importante del momento (su próxima cita, o una invitación a agendar), los lentes con su línea de pasos y, al lado,
// tarjetas pequeñas: el próximo control, el saldo y la óptica. En laptop va en dos columnas y en celular se apila. Cada tarjeta aparece solo si tiene algo que mostrar.
export default function ResumenPortal({ cargando, esNuevo, proximaCita, ordenesAbiertas, control, tieneCitaPendiente, saldo, contacto, hayContacto, nombreOptica, citaProps, onAgendar, onVerCompras }) {
  if (cargando) {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="Cargando tu resumen">
        <TituloPagina>Resumen</TituloPagina>
        <div className="grid gap-5 lg:grid-cols-12"><div className="space-y-5 lg:col-span-8"><Esqueleto alto="h-56" etiqueta="Cargando lo próximo" /><Esqueleto alto="h-44" /></div><div className="grid gap-5 lg:col-span-4"><Esqueleto /><Esqueleto /></div></div>
      </div>
    )
  }
  const hayLentes = ordenesAbiertas.length > 0
  const haySaldo = saldo > 0
  const hayLado = Boolean(control) || haySaldo || hayContacto

  return (
    <div className="space-y-5">
      <TituloPagina>Resumen</TituloPagina>
      <div className="grid gap-5 lg:grid-cols-12 lg:items-start">
        <div className={"space-y-5 " + (hayLado ? "lg:col-span-8" : "lg:col-span-12")}>
          <HeroCita cita={proximaCita} nuevo={esNuevo} nombreOptica={nombreOptica} citaProps={citaProps} onAgendar={onAgendar} />
          {hayLentes && (
            <Bloque id="lentes" titulo="Mis lentes" Icono={Glasses}>
              <ul className="divide-y divide-slate-100">
                {ordenesAbiertas.map((o) => (
                  <li key={o.id} className="space-y-4 py-4 first:pt-0 last:pb-0">
                    <p className="text-xl font-semibold text-slate-800">{nombreDeLosLentes(o)}</p>
                    <PasosLentes orden={o} />
                  </li>
                ))}
              </ul>
            </Bloque>
          )}
        </div>

        {hayLado && (
          <div className="grid gap-5 sm:grid-cols-2 lg:col-span-4 lg:grid-cols-1 lg:content-start">
            {control && (
              <Bloque id="control" titulo="Mi próximo control" Icono={Clock}>
                <p className="text-3xl font-bold" style={{ color: control.vencido ? "#B91C1C" : INK }}>{formatoFecha(control.iso, "medio")}</p>
                <p className="mt-1 text-lg text-slate-700">{textoControl(control)}</p>
                {!tieneCitaPendiente && (
                  <button type="button" onClick={() => onAgendar("control")} className={BOTON_PRINCIPAL + " mt-4 w-full"} style={ESTILO_PRINCIPAL}><CalendarPlus size={22} aria-hidden="true" /> Agendar mi control</button>
                )}
              </Bloque>
            )}
            {haySaldo && (
              <Bloque id="saldo" titulo="Mi saldo" Icono={Receipt}>
                <p className="text-lg text-slate-700">Saldo por pagar</p>
                <p className="text-4xl font-bold tabular-nums" style={{ color: "#B45309" }}>{dinero(saldo)}</p>
                <button type="button" onClick={onVerCompras} aria-label={`Tienes un saldo por pagar de ${dinero(saldo)}. Ver mis compras`} className={BOTON_SECUNDARIO + " mt-4 w-full"}>Ver mis compras <ArrowRight size={20} aria-hidden="true" /></button>
              </Bloque>
            )}
            {hayContacto && <div className={control && haySaldo ? "sm:col-span-2 lg:col-span-1" : ""}><TarjetaOptica contacto={contacto} /></div>}
          </div>
        )}
      </div>
    </div>
  )
}
