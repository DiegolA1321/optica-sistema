"use client"

import { useState } from "react"
import { Star, Stethoscope, UserRound, FileText, Glasses, Wallet, Eye, Store, MapPin, Phone, MessageCircle, Navigation, Clock, CalendarClock, X, CalendarPlus, Landmark } from "lucide-react"
import { formatoFecha, nombreMes, horaSinCero } from "../../utilidades/formatoFecha"
import { dinero } from "../../utilidades/formatoMoneda"
import { diaDeRegistro } from "../../utilidades/periodoLista"
import { NOTA_ESTADO_CITA, nombreDeLosLentes, textoControl } from "../../utilidades/portalPaciente"
import { porcentajeAbonado, enCuantoTiempo } from "../../utilidades/portalVistas"
import { Cascaron } from "../AtencionPaciente"
import { EstadoCita, Estrellas, PasosLentes, CambiosDeCita, BotonCalendario } from "./piezas"
import { DetalleReceta } from "../graduacion/Graduacion"
import { BOTON_PRINCIPAL, BOTON_SECUNDARIO, BOTON_PELIGRO, ESTILO_PRINCIPAL } from "./estilos"
import { PagosReportados } from "./PagarPorTransferencia"

// Las ventanas de detalle del portal (la ventana estándar del sistema, pantalla completa en el celular). Cada tarjeta del portal abre la suya: la cita, el pedido de los lentes, la receta,
// el saldo, el próximo control y la óptica. Todas leen los mismos datos que las pantallas; el portal decide cuál está abierta (abierto = { tipo, id }).

const Dato = ({ titulo, children }) => <div><dt className="text-base font-semibold text-pt-texto">{titulo}</dt><dd className="text-lg text-slate-800">{children}</dd></div>
const PieCerrar = ({ onCerrar }) => <><span /><button type="button" onClick={onCerrar} className={BOTON_SECUNDARIO}>Cerrar</button></>
const mayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1)

// La cita, próxima o pasada: cuándo, para qué, con quién, dónde, con todas sus acciones (calendario, cambiar o cancelar) o, si ya pasó, la receta que salió
// de ella y «¿Cómo te atendimos?» (una sola vez por cita).
function DetalleCita({ cita, detalle, detalleDisponible, direccion, citaProps, onVerReceta, onCalificar, onCerrar }) {
  const [puntaje, setPuntaje] = useState(0)
  const [comentario, setComentario] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState("")
  const cal = detalle?.calificacion
  const pendiente = cita.estado === "Pendiente"
  const reagendable = citaProps.puedeReagendar?.(cita)
  const cerrarYHacer = (fn) => () => { onCerrar(); fn?.(cita) }
  const enviar = async () => {
    if (!puntaje) { setError("Elige de 1 a 5 estrellas."); return }
    setEnviando(true); setError("")
    const r = await onCalificar(cita.id, puntaje, comentario.trim())
    setEnviando(false)
    if (!r.ok) setError(r.error)
  }
  return (
    <Cascaron pantallaCompletaEnCelular titulo="Tu cita" subtitulo={mayuscula(formatoFecha(cita.fecha, "largo")) + " · " + horaSinCero(cita.hora)} Icono={Stethoscope} ancho="max-w-xl" onCerrar={onCerrar} pie={<PieCerrar onCerrar={onCerrar} />}>
      <div className="space-y-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2"><EstadoCita estado={cita.estado} enCalendario={Boolean(citaProps.calendarioAgregada?.(cita.id))} /><span className="text-lg text-pt-texto">{NOTA_ESTADO_CITA[cita.estado]}</span></div>
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <Dato titulo="Motivo">{cita.motivo || "Consulta"}</Dato>
          {detalle?.profesional && <Dato titulo={cita.estado === "Atendida" ? "Te atendió" : "Profesional"}><span className="flex items-center gap-2"><UserRound size={20} className="text-slate-500" aria-hidden="true" /> {detalle.profesional}</span></Dato>}
          {direccion && <Dato titulo="Dónde es"><span className="flex items-start gap-2"><MapPin size={20} className="mt-1 shrink-0 text-slate-500" aria-hidden="true" /> {direccion}</span></Dato>}
        </dl>
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-base font-medium text-red-700">{error}</p>}
        {pendiente && (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2"><BotonCalendario cita={cita} citaProps={citaProps} otraVez className="w-full" /></div>
            {reagendable && (
              <div className="grid gap-3 sm:grid-cols-2">
                <button type="button" onClick={cerrarYHacer(citaProps.onReagendar)} className={BOTON_SECUNDARIO}><CalendarClock size={20} aria-hidden="true" /> Reagendar</button>
                <button type="button" onClick={cerrarYHacer(citaProps.onCancelar)} aria-label="Cancelar cita" className={BOTON_PELIGRO}><X size={20} aria-hidden="true" /> Cancelar</button>
              </div>
            )}
            <CambiosDeCita cita={cita} citaProps={citaProps} />
          </div>
        )}
        {detalle?.consultaId && (
          <button type="button" onClick={() => onVerReceta(detalle.consultaId)} className={BOTON_SECUNDARIO + " w-full"}><FileText size={20} aria-hidden="true" /> Ver la receta de esta cita</button>
        )}
        {cita.estado === "Atendida" && detalleDisponible && (
          <section aria-label="¿Cómo te atendimos?" className="rounded-2xl bg-pt-fondo p-4">
            <div className="flex flex-wrap items-center justify-between gap-x-4">
              <h3 className="font-heading text-lg font-bold text-pt-marino">¿Cómo te atendimos?</h3>
              {!cal && <Estrellas valor={puntaje} onCambiar={setPuntaje} />}
            </div>
            {cal ? (
              <div className="mt-2">
                <Estrellas valor={cal.puntaje} etiqueta="Tu calificación" />
                <p className="text-lg text-slate-700">Gracias: calificaste esta atención con {cal.puntaje} de 5.{cal.comentario ? ` «${cal.comentario}»` : ""}</p>
              </div>
            ) : (
              <div className="mt-1 space-y-2">
                <label className="block text-base font-semibold text-slate-700">Un comentario (opcional)
                  <textarea rows={2} maxLength={500} value={comentario} onChange={(e) => setComentario(e.target.value)} className="mt-1 w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-base font-normal text-slate-800 outline-none transition focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100" />
                </label>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1"><button type="button" onClick={enviar} disabled={enviando} className={BOTON_PRINCIPAL + " w-full sm:w-auto"} style={ESTILO_PRINCIPAL}>{enviando ? "Enviando…" : "Enviar mi calificación"}</button><p className="text-base text-pt-texto">Cada cita se califica una sola vez.</p></div>
              </div>
            )}
          </section>
        )}
      </div>
    </Cascaron>
  )
}

// Los botones de contacto de la óptica (Llamar, WhatsApp y Cómo llegar), los mismos de la franja oscura pero sobre fondo claro.
function BotonesContacto({ contacto }) {
  if (!contacto.telefono && !contacto.comoLlegarUrl) return null
  return (
    <div className="flex flex-wrap gap-3">
      {contacto.telefono && <a href={contacto.telefonoHref} className={BOTON_SECUNDARIO}><Phone size={20} aria-hidden="true" /> Llamar</a>}
      {contacto.telefono && <a href={contacto.whatsappUrl} target="_blank" rel="noopener noreferrer" className={BOTON_SECUNDARIO}><MessageCircle size={20} aria-hidden="true" /> WhatsApp</a>}
      {contacto.comoLlegarUrl && <a href={contacto.comoLlegarUrl} target="_blank" rel="noopener noreferrer" className={BOTON_SECUNDARIO}><Navigation size={20} aria-hidden="true" /> Cómo llegar</a>}
    </div>
  )
}

// El pedido de los lentes: qué lentes y qué montura, la fecha de cada paso, el comprobante, lo que falta pagar y cómo retirarlos.
function DetallePedido({ orden, contacto, onCerrar }) {
  const lista = orden.estado === "lista"
  const entregada = orden.estado === "entregada"
  const debe = Number(orden.saldo) > 0
  return (
    <Cascaron pantallaCompletaEnCelular titulo="Tu pedido de lentes" subtitulo={orden.comprobante ? `Comprobante ${orden.comprobante}` : "Seguimiento de tus lentes"} Icono={Glasses} ancho="max-w-xl" onCerrar={onCerrar} pie={<PieCerrar onCerrar={onCerrar} />}>
      <div className="space-y-3 p-4 sm:p-5">
        <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
          <Dato titulo="Lentes">{nombreDeLosLentes(orden).replace(/ con la montura .*/, "")}</Dato>
          {orden.montura && <Dato titulo="Montura">{orden.montura}</Dato>}
          {orden.pedidoEl && <Dato titulo="Pedido">{formatoFecha(diaDeRegistro(orden.pedidoEl), "largoSinDia")}</Dato>}
          <Dato titulo="Pago">{debe ? <span className="font-bold text-pt-ambar">Debes {dinero(orden.saldo)} <span className="font-normal text-pt-texto">(abonaste {dinero(orden.abonado)} de {dinero(orden.total)})</span></span> : orden.comprobante ? "Pagado completo" : "Sin saldo pendiente"}</Dato>
        </dl>
        <section aria-label="Seguimiento de tus lentes" className="rounded-2xl bg-pt-fondo p-3 sm:px-4">
          <h3 className="sr-only">En qué paso van</h3>
          <PasosLentes orden={orden} variante="lista" />
        </section>
        {!entregada && (
          <section aria-label="Cómo retirarlos" className="space-y-1.5">
            <h3 className="font-heading text-lg font-bold text-pt-marino">{orden.entrega === "envio" ? "Cómo los recibes" : "Cómo retirarlos"}</h3>
            <p className="text-lg text-slate-800">{orden.entrega === "envio" ? (lista ? "Ya están listos: te los enviaremos a tu domicilio." : "Te los enviaremos a tu domicilio cuando estén listos: te avisaremos.") : lista ? "Ya están listos: pasa por la óptica a recogerlos." : "Pasa por la óptica cuando estén listos: te avisaremos."}</p>
            {contacto.direccion && <p className="flex items-start gap-2 text-lg text-slate-800"><MapPin size={20} className="mt-1 shrink-0 text-slate-500" aria-hidden="true" /> {contacto.direccion}</p>}
            {contacto.hoy && <p className="flex items-start gap-2 text-lg text-slate-800"><Clock size={20} className="mt-1 shrink-0 text-slate-500" aria-hidden="true" /> {contacto.hoy.texto}</p>}
            <BotonesContacto contacto={contacto} />
          </section>
        )}
      </div>
    </Cascaron>
  )
}

// El saldo: cada compra con saldo (lo abonado, lo que falta y su barra) y el historial de abonos (fecha y monto) de cada una.
function DetalleSaldo({ comprasConSaldo, saldoInfo, contacto, transferencia = null, onPagarTransferencia, onVerCompras, onCerrar }) {
  return (
    <Cascaron pantallaCompletaEnCelular titulo="Tu saldo por pagar" subtitulo={saldoInfo ? (comprasConSaldo.length === 1 ? "En una compra" : `En ${comprasConSaldo.length} compras: ${dinero(saldoInfo.saldo)}`) : "Sin saldo pendiente"} Icono={Wallet} ancho="max-w-xl" onCerrar={onCerrar}
      pie={<><button type="button" onClick={() => { onCerrar(); onVerCompras() }} className={BOTON_SECUNDARIO}>Ver mis compras</button><button type="button" onClick={onCerrar} className={BOTON_SECUNDARIO}>Cerrar</button></>}>
      <div className="space-y-5 p-5">
        {comprasConSaldo.length === 0 && <p className="text-lg text-pt-texto">No tienes saldo pendiente.</p>}
        {comprasConSaldo.map((c) => {
          const pct = porcentajeAbonado(c.total, c.abonado)
          return (
            <section key={c.id} aria-label={`Compra ${c.comprobante}`} className="space-y-3 rounded-2xl border border-pt-borde p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <h3 className="font-heading text-lg font-bold text-pt-marino">Comprobante {c.comprobante}</h3>
                <p className="text-base text-pt-texto">{formatoFecha(diaDeRegistro(c.fecha), "largoSinDia")}</p>
              </div>
              <div role="img" aria-label={`Has abonado el ${pct} por ciento`}><div className="h-2 overflow-hidden rounded-full bg-[#E9EEF5]"><div className="h-full rounded-full bg-pt-azul" style={{ width: pct + "%" }} /></div></div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 text-base">
                <p className="text-pt-marino">Abonaste <span className="font-bold tabular-nums">{dinero(c.abonado)}</span> de <span className="font-bold tabular-nums">{dinero(c.total)}</span></p>
                <p className="font-bold text-pt-ambar">Debes <span className="tabular-nums">{dinero(c.saldo)}</span></p>
              </div>
              <div>
                <h4 className="text-base font-semibold text-pt-texto">Historial de abonos</h4>
                {Array.isArray(c.abonos) && c.abonos.length > 0 ? (
                  <ul className="mt-1 divide-y divide-pt-borde">
                    {c.abonos.map((a, i) => <li key={i} className="flex items-baseline justify-between gap-4 py-2 text-base"><span className="text-pt-marino">{formatoFecha(a.fecha, "largoSinDia")}</span><span className="font-bold tabular-nums text-pt-marino">{dinero(a.monto)}</span></li>)}
                  </ul>
                ) : <p className="mt-1 text-base text-pt-texto">{Array.isArray(c.abonos) ? "Todavía no has hecho abonos." : Number(c.abonado) > 0 ? `En total has abonado ${dinero(c.abonado)}.` : "Todavía no has hecho abonos."}</p>}
              </div>
            </section>
          )
        })}
        {transferencia?.pagos?.length > 0 && <section aria-label="Tus pagos por transferencia"><h3 className="mb-2 text-base font-semibold text-pt-texto">Tus pagos por transferencia</h3><PagosReportados pagos={transferencia.pagos} /></section>}
        <p className="text-base text-pt-texto">Puedes pagar en la óptica, en efectivo, con tarjeta o por transferencia.</p>
        {transferencia?.disponible && comprasConSaldo.length > 0 && <button type="button" onClick={() => onPagarTransferencia?.()} className={BOTON_PRINCIPAL + " w-full"} style={ESTILO_PRINCIPAL}><Landmark size={20} aria-hidden="true" /> Pagar por transferencia</button>}
        <BotonesContacto contacto={contacto} />
      </div>
    </Cascaron>
  )
}

// El próximo control: cuándo, por qué lo recomienda el optómetra y el botón para agendarlo.
function DetalleControl({ control, tieneCitaPendiente, onAgendar, onCerrar }) {
  const [anio, mes] = control.iso.split("-").map(Number)
  const meses = control.ultima ? Math.max(1, Math.round((new Date(control.iso + "T00:00:00Z") - new Date(control.ultima + "T00:00:00Z")) / (30.44 * 86400000))) : null
  return (
    <Cascaron pantallaCompletaEnCelular titulo="Tu próximo control" subtitulo={`${mayuscula(nombreMes(mes - 1))} de ${anio}`} Icono={Eye} ancho="max-w-xl" onCerrar={onCerrar}
      pie={<><span />{!tieneCitaPendiente && <button type="button" onClick={() => { onCerrar(); onAgendar("control") }} className={BOTON_PRINCIPAL} style={ESTILO_PRINCIPAL}><CalendarPlus size={22} aria-hidden="true" /> Agendar control</button>}<button type="button" onClick={onCerrar} className={BOTON_SECUNDARIO}>Cerrar</button></>}>
      <div className="space-y-5 p-5">
        <p className={"text-lg " + (control.vencido ? "font-semibold text-red-700" : "text-pt-texto")}>{control.vencido ? textoControl(control) : `${mayuscula(enCuantoTiempo(control.dias))} · te avisaremos antes`}</p>
        <section aria-label="Por qué se recomienda" className="space-y-2 rounded-2xl bg-pt-fondo p-5">
          <h3 className="font-heading text-lg font-bold text-pt-marino">¿Por qué se recomienda?</h3>
          <p className="text-lg text-slate-800">{control.ultima ? `Tu optómetra indicó revisar tu vista ${meses === 1 ? "un mes" : `${meses} meses`} después de tu último examen, el ${formatoFecha(control.ultima, "largoSinDia")}.` : "Es la fecha que recomendó tu optómetra."} La vista cambia con el tiempo, aunque veas igual: revisarla a tiempo permite ajustar tus lentes antes de que te cansen o te den dolor de cabeza.</p>
        </section>
        {tieneCitaPendiente && <p className="text-lg text-pt-texto">Ya tienes una cita agendada, así que no hace falta pedir otra.</p>}
      </div>
    </Cascaron>
  )
}

// La óptica: si está abierta, el horario completo de la semana, la dirección y el mapa.
function DetalleOptica({ contacto, nombreOptica, onCerrar }) {
  return (
    <Cascaron pantallaCompletaEnCelular titulo={nombreOptica} subtitulo={contacto.hoy?.texto || "Horario y dirección"} Icono={Store} ancho="max-w-xl" onCerrar={onCerrar} pie={<PieCerrar onCerrar={onCerrar} />}>
      <div className="space-y-5 p-5">
        {contacto.horario.length > 0 && (
          <section aria-label="Horario de atención">
            <h3 className="font-heading text-lg font-bold text-pt-marino">Horario de atención</h3>
            <ul className="mt-2 divide-y divide-pt-borde">
              {contacto.horario.map((h) => <li key={h.etiqueta} className="flex flex-wrap items-baseline justify-between gap-x-4 py-2 text-lg"><span className="text-pt-marino">{h.etiqueta}</span><span className="font-semibold tabular-nums text-pt-marino sm:text-right">{h.horario}</span></li>)}
            </ul>
          </section>
        )}
        {contacto.direccion && (
          <section aria-label="Dirección" className="space-y-3">
            <h3 className="font-heading text-lg font-bold text-pt-marino">Dirección</h3>
            <p className="flex items-start gap-2 text-lg text-slate-800"><MapPin size={20} className="mt-1 shrink-0 text-slate-500" aria-hidden="true" /> {contacto.direccion}</p>
            <iframe title={`Mapa de ${nombreOptica}`} loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={`https://www.google.com/maps?q=${encodeURIComponent([contacto.direccion, nombreOptica].filter(Boolean).join(", "))}&output=embed`} className="h-44 w-full rounded-2xl border border-pt-borde bg-pt-fondo" />
          </section>
        )}
        <BotonesContacto contacto={contacto} />
      </div>
    </Cascaron>
  )
}

// Los puntos: cómo se ganan (la misma regla del CRM), el historial de lo que sumó y el siguiente nivel.
function DetallePuntos({ puntos, historial = [], onCerrar }) {
  const lineas = [...historial].sort((x, y) => (x.fecha < y.fecha ? 1 : -1))
  return (
    <Cascaron pantallaCompletaEnCelular titulo="Tus puntos de cliente" subtitulo={`${puntos.puntos} puntos`} Icono={Star} ancho="max-w-xl" onCerrar={onCerrar} pie={<PieCerrar onCerrar={onCerrar} />}>
      <div className="space-y-4 p-4 sm:p-5">
        <section aria-label="Cómo se ganan" className="space-y-1">
          <h3 className="font-heading text-lg font-bold text-pt-marino">Cómo se ganan</h3>
          <p className="text-lg text-slate-800">{puntos.programa.porConsulta} puntos por cada consulta, {puntos.programa.porReferido} por cada paciente que refieras a la óptica y 1 punto por cada ${puntos.programa.dolaresPorPunto} que pagas.</p>
        </section>
        <section aria-label="Historial de puntos">
          <h3 className="font-heading text-lg font-bold text-pt-marino">Historial</h3>
          {lineas.length === 0 ? <p className="mt-1 text-lg text-pt-texto">Todavía no sumas puntos: se suman al terminar tu primera consulta.</p> : (
            <ul className="mt-1 divide-y divide-pt-borde">
              {lineas.map((l, i) => <li key={i} className="flex items-baseline justify-between gap-4 py-2 text-lg"><span className="text-pt-marino">{l.concepto}{l.fecha ? <span className="text-pt-texto"> · {formatoFecha(l.fecha, "medio")}</span> : null}</span><span className="font-bold tabular-nums text-[#15803D]">+{l.puntos}</span></li>)}
              <li className="flex items-baseline justify-between gap-4 py-2 text-lg font-bold text-pt-marino"><span>Total</span><span className="tabular-nums">{puntos.puntos}</span></li>
            </ul>
          )}
        </section>
        <section aria-label="Siguiente nivel" className="space-y-2 rounded-2xl bg-pt-fondo p-4">
          <h3 className="font-heading text-lg font-bold text-pt-marino">{puntos.siguiente ? `Tu nivel: ${puntos.nivel.nombre} · siguiente: ${puntos.siguiente.nombre}` : `Tu nivel: ${puntos.nivel.nombre}`}</h3>
          <div role="img" aria-label={`Llevas el ${puntos.porcentaje} por ciento del camino`}><div className="h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-[#15803D]" style={{ width: puntos.porcentaje + "%" }} /></div></div>
          <p className="text-lg text-slate-800">{puntos.texto}.{puntos.nivel.descuento > 0 ? ` Tu nivel da ${puntos.nivel.descuento} % de descuento en tus compras.` : ""}</p>
        </section>
      </div>
    </Cascaron>
  )
}

// Los lentes en proceso: cada pedido con sus pasos.
function DetalleLentes({ ordenes, onCerrar }) {
  return (
    <Cascaron pantallaCompletaEnCelular titulo="Tus lentes en proceso" subtitulo={ordenes.length === 1 ? "Un pedido" : ordenes.length + " pedidos"} Icono={Glasses} ancho="max-w-xl" onCerrar={onCerrar} pie={<PieCerrar onCerrar={onCerrar} />}>
      <div className="space-y-4 p-4 sm:p-5">
        {ordenes.map((o) => (
          <section key={o.id} aria-label={nombreDeLosLentes(o)} className="space-y-3 rounded-2xl border border-pt-borde p-4">
            <p className="text-lg font-semibold text-pt-marino">{nombreDeLosLentes(o)}{o.comprobante ? <span className="font-normal text-pt-texto"> · {o.comprobante}</span> : null}</p>
            <PasosLentes orden={o} variante="lista" />
          </section>
        ))}
      </div>
    </Cascaron>
  )
}

// Decide cuál ventana mostrar según lo que pulsó el paciente.
export default function VentanaDetalle({ abierto, onCerrar, citas, ordenes, comprasConSaldo, saldoInfo, recetas, control, tieneCitaPendiente, contacto, nombreOptica, detalle, citaProps, onCalificar, onVerReceta, onDescargarReceta, onAgendar, onVerCompras, transferencia = null, onPagarTransferencia, puntos, historialPuntos = [] }) {
  if (!abierto) return null
  if (abierto.tipo === "cita") {
    const cita = citas.find((c) => String(c.id) === String(abierto.id))
    return cita ? <DetalleCita cita={cita} detalle={detalle.porCita[cita.id]} detalleDisponible={detalle.disponible} direccion={contacto.direccion} citaProps={citaProps} onVerReceta={onVerReceta} onCalificar={onCalificar} onCerrar={onCerrar} /> : null
  }
  if (abierto.tipo === "pedido") {
    const orden = ordenes.find((o) => String(o.id) === String(abierto.id))
    return orden ? <DetallePedido orden={orden} contacto={contacto} onCerrar={onCerrar} /> : null
  }
  if (abierto.tipo === "receta") {
    const receta = recetas.find((r) => String(r.id) === String(abierto.id))
    return receta ? <DetalleReceta receta={receta} version="paciente" onCerrar={onCerrar} onImprimir={() => onDescargarReceta(receta)} /> : null
  }
  if (abierto.tipo === "saldo") return <DetalleSaldo comprasConSaldo={comprasConSaldo} saldoInfo={saldoInfo} contacto={contacto} transferencia={transferencia} onPagarTransferencia={onPagarTransferencia} onVerCompras={onVerCompras} onCerrar={onCerrar} />
  if (abierto.tipo === "control") return control ? <DetalleControl control={control} tieneCitaPendiente={tieneCitaPendiente} onAgendar={onAgendar} onCerrar={onCerrar} /> : null
  if (abierto.tipo === "puntos") return puntos ? <DetallePuntos puntos={puntos} historial={historialPuntos} onCerrar={onCerrar} /> : null
  if (abierto.tipo === "lentes") return <DetalleLentes ordenes={ordenes.filter((o) => o.estado === "enviada" || o.estado === "lista")} onCerrar={onCerrar} />
  if (abierto.tipo === "optica") return <DetalleOptica contacto={contacto} nombreOptica={nombreOptica} onCerrar={onCerrar} />
  return null
}
