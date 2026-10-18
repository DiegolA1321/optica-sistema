"use client"

import { CalendarPlus, Phone, MessageCircle, Navigation, Eye, ChevronRight } from "lucide-react"
import { formatoFecha, nombreMes } from "../../utilidades/formatoFecha"
import { dinero } from "../../utilidades/formatoMoneda"
import { nombreDeLosLentes, textoControl } from "../../utilidades/portalPaciente"
import { enCuantoTiempo, porcentajeAbonado, valorD } from "../../utilidades/portalVistas"
import { Tarjeta, TituloTarjeta, Esqueleto, PasosLentes, Circulo } from "./piezas"
import BoletoCita from "./BoletoCita"
import { useCelular } from "./useAncho"
import { BOTON_PRINCIPAL, BOTON_SECUNDARIO, BOTON_SOBRE_OSCURO, BOTON_BORDE_BLANCO, ENLACE_AZUL, ESTILO_PRINCIPAL } from "./estilos"

const mayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1)
const diaMes = (iso) => formatoFecha(iso, "largoSinDia").replace(/ de \d{4}$/, "")

// «Tus lentes»: el pedido y la línea de pasos (vertical en laptop, horizontal en el celular). Si ya están listos, «Ya puedes retirarlos» con el horario de hoy.
function TarjetaLentes({ ordenes, horarioHoy, celular, onAbrir }) {
  const una = ordenes.length === 1
  return (
    <Tarjeta aria-labelledby="lentes" className="h-full" onAbrir={una ? () => onAbrir({ tipo: "pedido", id: ordenes[0].id }) : undefined} etiquetaAbrir="Ver el detalle del pedido de tus lentes">
      <TituloTarjeta id="lentes" flecha={una}>Tus lentes</TituloTarjeta>
      <ul className="mt-3 divide-y divide-pt-borde">
        {ordenes.map((o) => (
          <li key={o.id} className={"space-y-4 py-4 first:pt-0 last:pb-0" + (una ? "" : " pt-abrible relative")}>
            {!una && <button type="button" onClick={() => onAbrir({ tipo: "pedido", id: o.id })} aria-label={`Ver el detalle del pedido de ${nombreDeLosLentes(o).toLowerCase()}`} className="pt-abrir absolute inset-0 cursor-pointer" />}
            {!celular && <p className="text-base leading-snug text-pt-texto">{nombreDeLosLentes(o)}{o.comprobante ? ` · pedido ${o.comprobante}` : ""}</p>}
            <PasosLentes orden={o} variante={celular ? "horizontal" : "vertical"} conMensaje={o.estado !== "lista" || !celular} />
            {o.estado === "lista" && (
              <div className="rounded-xl bg-[#E3F4EA] px-4 py-3 text-[#166534]">
                <p className="text-lg font-bold">Ya puedes retirarlos</p>
                {horarioHoy && <p className="text-base">{horarioHoy}</p>}
              </div>
            )}
          </li>
        ))}
      </ul>
    </Tarjeta>
  )
}

// «Tu graduación»: los dos ojos en círculos con la esfera en grande, el cilindro y el eje, y (en laptop) una frase de cómo cambió y de qué receta viene.
function TarjetaGraduacion({ receta, cambio, onVerReceta, onAbrir, celular }) {
  const ojo = (titulo, o = {}) => {
    const cil = valorD(o.cilindro)
    const detalle = cil ? `cil ${cil}${!celular && o.eje ? ` · eje ${o.eje}°` : ""}` : "sin cilindro"
    return (
      <div className="flex flex-col items-center gap-3">
        <Circulo className="h-[132px] w-[132px] border-[9px] sm:h-[175px] sm:w-[175px] sm:border-[11px]">
          <span className="font-heading text-[28px] font-bold leading-none tabular-nums text-pt-marino sm:text-4xl">{valorD(o.esfera) || "—"}</span>
          <span className="mt-1.5 px-2 text-base leading-tight text-pt-texto">{detalle}</span>
        </Circulo>
        <p className="text-base font-semibold leading-snug text-pt-marino">{titulo}</p>
      </div>
    )
  }
  const quien = receta.profesionalNombre ? `, ${receta.profesionalNombre}` : ""
  return (
    <Tarjeta aria-labelledby="graduacion" className="h-full" onAbrir={() => onAbrir({ tipo: "receta", id: receta.id })} etiquetaAbrir="Ver tu receta completa">
      <div className="flex items-center justify-between gap-3">
        <TituloTarjeta id="graduacion">Tu graduación</TituloTarjeta>
        <span className="flex items-center gap-3">
          {!celular && <button type="button" onClick={onVerReceta} className={ENLACE_AZUL}>Ver mi receta completa</button>}
          <ChevronRight size={22} className="shrink-0 text-slate-500" aria-hidden="true" />
        </span>
      </div>
      <div className="mt-5 flex flex-wrap justify-center gap-x-5 gap-y-5 sm:gap-x-7">{ojo("Ojo derecho", receta.od)}{ojo("Ojo izquierdo", receta.oi)}</div>
      {celular
        ? <button type="button" onClick={onVerReceta} className={BOTON_SECUNDARIO + " mt-5 w-full"}>Ver mi receta completa</button>
        : <p className="mt-6 rounded-2xl bg-pt-fondo px-5 py-4 text-base leading-relaxed text-pt-marino">{cambio ? cambio.frase + " " : ""}Receta del {diaMes(receta.fecha)}{quien}.</p>}
    </Tarjeta>
  )
}

function TarjetaSaldo({ saldoInfo, onVerCompras, onAbrir, celular }) {
  const pct = porcentajeAbonado(saldoInfo.total, saldoInfo.abonado)
  return (
    <Tarjeta aria-labelledby="saldo" onAbrir={() => onAbrir({ tipo: "saldo" })} etiquetaAbrir="Ver el detalle de tu saldo y tus abonos">
      <h2 id="saldo" className="flex items-center justify-between gap-3 text-lg font-medium text-pt-texto">Saldo por pagar<ChevronRight size={22} className="shrink-0 text-slate-500" aria-hidden="true" /></h2>
      <p className="mt-1 font-heading text-[32px] font-bold leading-tight tabular-nums text-pt-ambar sm:text-4xl">{dinero(saldoInfo.saldo)}</p>
      <div className="mt-3" role="img" aria-label={`Has abonado el ${pct} por ciento: ${dinero(saldoInfo.abonado)} de ${dinero(saldoInfo.total)}`}>
        <div className="h-2 overflow-hidden rounded-full bg-[#E9EEF5]"><div className="h-full rounded-full bg-pt-azul" style={{ width: pct + "%" }} /></div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4">
        <p className="text-base text-pt-texto sm:text-base">Abonaste {dinero(saldoInfo.abonado)} de {dinero(saldoInfo.total)}</p>
        {!celular && <button type="button" onClick={onVerCompras} aria-label={`Tienes un saldo por pagar de ${dinero(saldoInfo.saldo)}. Ver mis compras`} className={ENLACE_AZUL}>Ver mis compras</button>}
      </div>
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
          <h2 id="control" className="text-lg font-medium text-pt-texto">Tu próximo control</h2>
          <p className={"font-heading text-2xl font-bold leading-tight sm:text-[26px] " + (control.vencido ? "text-red-700" : "text-pt-marino")}>{mayuscula(nombreMes(mes - 1))} de {anio}</p>
          <p className="mt-0.5 text-base text-pt-texto sm:text-base">{control.vencido ? textoControl(control) : `${mayuscula(enCuantoTiempo(control.dias))} · te avisaremos antes`}</p>
        </div>
        <ChevronRight size={22} className="shrink-0 text-slate-500" aria-hidden="true" />
      </div>
      {!tieneCitaPendiente && (
        <button type="button" onClick={() => onAgendar("control")} className={BOTON_PRINCIPAL + " mt-4 w-full"} style={ESTILO_PRINCIPAL}><CalendarPlus size={22} aria-hidden="true" /> Agendar control</button>
      )}
    </Tarjeta>
  )
}

// La franja oscura de la óptica: si está abierta o cerrada hoy, la dirección y el horario, y tres botones (Llamar y WhatsApp en blanco, Cómo llegar con borde).
function FranjaOptica({ contacto, celular, onAbrir }) {
  const hoy = contacto.hoy
  const textoHoy = !hoy ? "" : hoy.abierto ? hoy.texto.replace(/^Abierto hoy hasta las /, celular ? "Abierto · cierra a las " : "Abierto ahora · cierra a las ") : hoy.texto
  const rango = contacto.horario.length === 1 ? contacto.horario[0].etiqueta.toLowerCase() : ""
  const linea2 = [contacto.direccion, rango].filter(Boolean).join(" · ")
  const boton = "flex-auto whitespace-nowrap !px-1.5 sm:flex-none sm:!px-5"
  return (
    <section aria-label="La óptica" className={"flex flex-col gap-4 rounded-[20px] bg-pt-marino px-5 py-5 text-white sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-7 " + (onAbrir ? "pt-abrible relative transition-shadow hover:shadow-lg" : "")}>
      {onAbrir && <button type="button" onClick={() => onAbrir({ tipo: "optica" })} aria-label="Ver el horario completo, la dirección y el mapa de la óptica" className="pt-abrir absolute inset-0 rounded-[20px] cursor-pointer" />}
      <div className="min-w-0">
        {textoHoy && (
          <p className="flex items-center gap-3 text-lg font-bold leading-snug">
            <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: hoy.abierto ? "#34D399" : "#94A3B8" }} />
            <span className="min-w-0">{textoHoy}</span>
            {onAbrir && <ChevronRight size={22} className="shrink-0 text-white/70" aria-hidden="true" />}
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

// Resumen del portal (diseño aprobado). Primera fila: tu próxima cita en estilo boleto y, si hay lentes en proceso, su línea de pasos. Segunda: tu graduación a la izquierda y, a la
// derecha, el saldo y el próximo control (los que tengan algo que mostrar). Abajo, la franja oscura de la óptica. La rejilla va por el ancho de la zona de contenido, no de la ventana.
export default function ResumenPortal({ cargando, esNuevo, proximaCita, detalleCita, detalleDisponible, ordenesAbiertas, control, tieneCitaPendiente, saldoInfo, contacto, hayContacto, ultimaReceta, cambio, nombreOptica, direccion, citaProps, onConfirmar, onAbrir, onAgendar, onVerCompras, onVerReceta }) {
  const celular = useCelular()
  if (cargando) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Cargando tu resumen">
        <h1 className="sr-only">Resumen</h1>
        <div className="pt-fila pt-fila--8-4"><Esqueleto alto="h-64" etiqueta="Cargando tu próxima cita" /><Esqueleto alto="h-64" /></div>
        <div className="pt-fila pt-fila--7-5"><Esqueleto alto="h-80" /><Esqueleto alto="h-44" /></div>
      </div>
    )
  }
  const hayLentes = ordenesAbiertas.length > 0
  const derecha = Boolean(saldoInfo) || Boolean(control)

  if (esNuevo) {
    return (
      <div className="space-y-5 sm:space-y-6">
        <h1 className="sr-only">Resumen</h1>
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

  return (
    <div className="space-y-5 sm:space-y-6">
      <h1 className="sr-only">Resumen</h1>
      <div className={"pt-fila " + (hayLentes ? "pt-fila--8-4" : "pt-fila--solo")}>
        <BoletoCita cita={proximaCita} detalle={detalleCita} detalleDisponible={detalleDisponible} direccion={direccion} citaProps={citaProps} onConfirmar={onConfirmar} onAbrir={(c) => onAbrir({ tipo: "cita", id: c.id })} onAgendar={onAgendar} />
        {hayLentes && <TarjetaLentes ordenes={ordenesAbiertas} horarioHoy={contacto.hoy?.texto} celular={celular} onAbrir={onAbrir} />}
      </div>
      {(ultimaReceta || derecha) && (
        <div className={"pt-fila pt-fila--arriba " + (ultimaReceta && derecha ? "pt-fila--7-5" : ultimaReceta ? "pt-fila--solo" : "pt-fila--dos")}>
          {ultimaReceta && <TarjetaGraduacion receta={ultimaReceta} cambio={cambio} onVerReceta={onVerReceta} onAbrir={onAbrir} celular={celular} />}
          {derecha && (
            <div className="space-y-5 sm:space-y-6">
              {saldoInfo && <TarjetaSaldo saldoInfo={saldoInfo} onVerCompras={onVerCompras} onAbrir={onAbrir} celular={celular} />}
              {control && <TarjetaControl control={control} tieneCitaPendiente={tieneCitaPendiente} onAgendar={onAgendar} onAbrir={onAbrir} celular={celular} />}
            </div>
          )}
        </div>
      )}
      {hayContacto && <FranjaOptica contacto={contacto} celular={celular} onAbrir={onAbrir} />}
    </div>
  )
}
