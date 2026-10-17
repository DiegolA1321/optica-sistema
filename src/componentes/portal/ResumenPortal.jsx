"use client"

import { CalendarDays, CalendarPlus, Glasses, Receipt, MapPin, Phone, MessageCircle, Clock, Sparkles, ArrowRight } from "lucide-react"
import { INK } from "@/lib/tema"
import { dinero } from "../../utilidades/formatoMoneda"
import { formatoFecha } from "../../utilidades/formatoFecha"
import { textoOrdenPaciente, nombreDeLosLentes, textoControl } from "../../utilidades/portalPaciente"
import { Bloque, Insignia, TituloPagina, FilaCita, Esqueleto } from "./piezas"
import { BOTON_PRINCIPAL, BOTON_SECUNDARIO, ESTILO_PRINCIPAL } from "./estilos"

// Resumen del portal: solo lo que le importa a un paciente de óptica, en este orden y sin repetir: lo próximo, sus lentes, su próximo control, su saldo y la óptica.
// Cada bloque aparece solo si tiene algo que mostrar; un paciente nuevo ve una bienvenida con un solo botón para agendar su primera cita.
export default function ResumenPortal({ cargando, esNuevo, proximaCita, ordenesAbiertas, control, tieneCitaPendiente, saldo, contacto, hayContacto, nombreOptica, citaProps, onAgendar, onVerCompras }) {
  if (cargando) {
    return (
      <div className="space-y-5" aria-busy="true" aria-label="Cargando tu resumen">
        <TituloPagina>Resumen</TituloPagina>
        <Esqueleto alto="h-44" etiqueta="Cargando lo próximo" />
        <div className="grid gap-5 md:grid-cols-2"><Esqueleto /><Esqueleto /></div>
      </div>
    )
  }

  // Los bloques de abajo van en dos columnas; si queda uno solo, o uno suelto al final, ocupa todo el ancho.
  const hayLentes = ordenesAbiertas.length > 0
  const hayControl = Boolean(control)
  const haySaldo = saldo > 0
  const cuantos = [hayLentes, hayControl, haySaldo].filter(Boolean).length
  const ancho = (esUltimo) => (cuantos === 1 || (cuantos === 3 && esUltimo) ? "md:col-span-2" : "")

  return (
    <div className="space-y-5">
      <TituloPagina>Resumen</TituloPagina>

      {esNuevo ? (
        <Bloque id="bienvenida" titulo={`Te damos la bienvenida a ${nombreOptica}`} Icono={Sparkles}>
          <p className="max-w-xl text-lg text-slate-700">Aquí vas a ver tus citas, tu receta, el estado de tus lentes y lo que debes. Empieza agendando tu primera cita.</p>
          <button type="button" onClick={() => onAgendar()} className={BOTON_PRINCIPAL + " mt-5 w-full sm:w-auto"} style={ESTILO_PRINCIPAL}><CalendarPlus size={22} aria-hidden="true" /> Agendar mi primera cita</button>
        </Bloque>
      ) : (
        <Bloque id="proximo" titulo="Lo próximo" Icono={CalendarDays}>
          {proximaCita ? (
            <ul><FilaCita cita={proximaCita} grande {...citaProps} /></ul>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-lg text-slate-700">No tienes ninguna cita agendada.</p>
              <button type="button" onClick={() => onAgendar()} className={BOTON_PRINCIPAL} style={ESTILO_PRINCIPAL}><CalendarPlus size={22} aria-hidden="true" /> Agendar cita</button>
            </div>
          )}
        </Bloque>
      )}

      {cuantos > 0 && (
        <div className="grid gap-5 md:grid-cols-2">
          {hayLentes && (
            <Bloque id="lentes" titulo="Mis lentes" Icono={Glasses} className={ancho(false)}>
              <ul className="divide-y divide-slate-100">
                {ordenesAbiertas.map((o) => {
                  const t = textoOrdenPaciente(o)
                  return (
                    <li key={o.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
                      <p className="text-lg font-semibold text-slate-800">{nombreDeLosLentes(o)}</p>
                      <Insignia tono={t.tono}>{t.titulo}</Insignia>
                      <p className="text-lg text-slate-700">{t.detalle}</p>
                    </li>
                  )
                })}
              </ul>
            </Bloque>
          )}

          {hayControl && (
            <Bloque id="control" titulo="Mi próximo control" Icono={Clock} className={ancho(false)}>
              <p className="text-2xl font-bold" style={{ color: control.vencido ? "#B91C1C" : INK }}>{formatoFecha(control.iso, "medio")}</p>
              <p className="mt-1 text-lg text-slate-700">{textoControl(control)}</p>
              {!tieneCitaPendiente && (
                <button type="button" onClick={() => onAgendar("control")} className={BOTON_PRINCIPAL + " mt-4 w-full sm:w-auto"} style={ESTILO_PRINCIPAL}><CalendarPlus size={22} aria-hidden="true" /> Agendar mi control</button>
              )}
            </Bloque>
          )}

          {haySaldo && (
            <Bloque id="saldo" titulo="Mi saldo" Icono={Receipt} className={ancho(true)}>
              <p className="text-lg text-slate-700">Saldo por pagar</p>
              <p className="text-3xl font-bold tabular-nums" style={{ color: "#B45309" }}>{dinero(saldo)}</p>
              <button type="button" onClick={onVerCompras} aria-label={`Tienes un saldo por pagar de ${dinero(saldo)}. Ver mis compras`} className={BOTON_SECUNDARIO + " mt-4 w-full sm:w-auto"}>Ver mis compras <ArrowRight size={20} aria-hidden="true" /></button>
            </Bloque>
          )}
        </div>
      )}

      {hayContacto && (
        <Bloque id="optica" titulo="La óptica" Icono={MapPin}>
          <div className="grid gap-5 md:grid-cols-2">
            <dl className="space-y-3 text-lg text-slate-700">
              {contacto.direccion && <div><dt className="text-base font-semibold text-slate-600">Dirección</dt><dd>{contacto.direccion}</dd></div>}
              {contacto.horario.length > 0 && (
                <div>
                  <dt className="text-base font-semibold text-slate-600">Horario</dt>
                  <dd>{contacto.horario.map((h) => <span key={h.etiqueta} className="block">{h.etiqueta} · {h.horario}</span>)}</dd>
                </div>
              )}
              {contacto.telefono && <div><dt className="text-base font-semibold text-slate-600">Teléfono</dt><dd className="tabular-nums">{contacto.telefono}</dd></div>}
            </dl>
            {contacto.telefono && (
              <div className="flex flex-col gap-3 md:justify-end">
                <a href={contacto.telefonoHref} className={BOTON_SECUNDARIO}><Phone size={20} aria-hidden="true" /> Llamar</a>
                <a href={contacto.whatsappUrl} target="_blank" rel="noopener noreferrer" className={BOTON_SECUNDARIO}><MessageCircle size={20} aria-hidden="true" /> Escribir por WhatsApp</a>
              </div>
            )}
          </div>
        </Bloque>
      )}
    </div>
  )
}
