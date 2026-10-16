"use client"

import { ArrowRight, Building2, Check, LogIn, TriangleAlert } from "lucide-react"
import { Cascaron } from "../AtencionPaciente"
import { InsigniaUrgencia, InsigniaEstado } from "../soporte/piezas"
import { InsigniaSalud, EtiquetaPrueba } from "./piezas"
import { GRAD_MARCA, INK } from "@/lib/tema"
import { dinero } from "../../utilidades/formatoMoneda"
import { formatoFecha, fechaLegible } from "../../utilidades/formatoFecha"
import { diaDe } from "../../utilidades/reportesPeriodo"
import { codigoConsulta } from "../../utilidades/soporte"
import { MODULOS_USO, modulosUsadosPor, textoUsoModulo, porCobrarAl, esDePrueba } from "../../utilidades/superadminNegocio"

const PAGO = { al_dia: "Al día", pendiente: "Pendiente", vencido: "Vencido" }
const AREAS = { ingreso: "Último ingreso", uso: "Uso", pago: "Pago", soporte: "Soporte" }

function Bloque({ titulo, children }) {
  return (
    <section>
      <h3 className="mb-2 border-b border-slate-200/60 pb-1.5 text-xs font-bold uppercase tracking-widest text-slate-500">{titulo}</h3>
      {children}
    </section>
  )
}
function Dato({ etiqueta, children }) {
  return (
    <div className="mt-2.5 first:mt-0">
      <dt className="text-xs font-bold uppercase tracking-wide text-slate-400">{etiqueta}</dt>
      <dd className="mt-0.5 break-words text-sm font-semibold" style={{ color: INK }}>{children}</dd>
    </div>
  )
}

// El detalle de una óptica en la ventana estándar: su salud, su uso de los últimos 30 días, sus pagos y sus consultas de soporte abiertas.
// `fila` es { optica, salud } de saludDeLaRed; `uso` es la fila de datos_negocio_superadmin (o null si el servidor aún no la entrega).
export default function DetalleOptica({ fila, uso, facturas, consultasAbiertas, hoyISO, onCerrar, onAbrirEnOpticas, onEntrarComo }) {
  const { optica, salud } = fila
  const suyas = facturas.filter((f) => f.optica_id === optica.id)
  const porCobrar = porCobrarAl(suyas, hoyISO)
  const ultimas = [...suyas].sort((a, b) => (a.emitida_at < b.emitida_at ? 1 : -1)).slice(0, 3)
  const usados = modulosUsadosPor(uso)
  const ultimoIngreso = salud.ultimoIngreso
  return (
    <Cascaron
      titulo={optica.nombre}
      subtitulo={`Dirección de la página: ${optica.slug} · creada el ${fechaLegible(diaDe(optica.created_at))}`}
      Icono={Building2}
      ancho="max-w-3xl"
      onCerrar={onCerrar}
      derecha={<span className="flex items-center gap-2">{esDePrueba(optica) && <EtiquetaPrueba />}<InsigniaSalud estado={salud.estado} /></span>}
      pie={<>
        <button type="button" onClick={() => { onCerrar(); onAbrirEnOpticas() }} className="flex items-center gap-1 text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">Abrir en Ópticas <ArrowRight size={14} aria-hidden="true" /></button>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => onEntrarComo(optica)} className="flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer" style={{ background: GRAD_MARCA }}><LogIn size={14} aria-hidden="true" /> Entrar como administrador</button>
          <button type="button" onClick={onCerrar} className="rounded-lg border border-slate-200/60 px-3.5 py-1.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 cursor-pointer">Cerrar</button>
        </div>
      </>}
    >
      <div className="grid grid-cols-1 gap-x-8 gap-y-5 px-5 py-4 sm:grid-cols-2">
        <Bloque titulo="Salud">
          {salud.motivos.length === 0 ? (
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700"><Check size={16} aria-hidden="true" /> Todo en orden: ingresa, la usan, el pago está al día y no tiene consultas abiertas.</p>
          ) : (
            <ul className="space-y-1.5">
              {salud.motivos.map((m) => (
                <li key={m.area} className="flex items-start gap-2 text-sm">
                  <TriangleAlert size={15} className={"mt-0.5 shrink-0 " + (m.nivel === "riesgo" ? "text-red-600" : "text-amber-600")} aria-hidden="true" />
                  <span><span className="font-semibold text-slate-500">{AREAS[m.area]}: </span><span className="font-semibold" style={{ color: INK }}>{m.texto}</span></span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-slate-500">{ultimoIngreso ? `Último ingreso de su personal: ${formatoFecha(ultimoIngreso, "medio")}` : "Todavía nadie de su personal ha ingresado."}</p>
        </Bloque>

        <Bloque titulo="Uso · últimos 30 días">
          {uso ? (
            <dl>
              <Dato etiqueta="Personas activas">{uso.personas_activas}</Dato>
              <Dato etiqueta="Módulos en uso">{usados.length === 0 ? <span className="font-normal text-slate-500">Ninguno en 30 días</span> : `${usados.length} de ${MODULOS_USO.length}`}</Dato>
              {MODULOS_USO.map((m) => <Dato key={m.id} etiqueta={m.nombre}><span className={uso.modulos?.[m.id] ? "" : "font-normal text-slate-500"}>{textoUsoModulo(uso.modulos?.[m.id], hoyISO)}</span></Dato>)}
            </dl>
          ) : <p className="text-sm text-slate-500">Todavía no se puede leer el uso de esta óptica.</p>}
        </Bloque>

        <Bloque titulo="Pagos">
          <dl>
            <Dato etiqueta="Estado del pago">{PAGO[optica.estado_pago] || "Al día"}{optica.proximo_vencimiento ? ` · vence el ${formatoFecha(optica.proximo_vencimiento, "medio")}` : ""}</Dato>
            <Dato etiqueta="Mensualidad">{optica.monto_mensual != null ? dinero(optica.monto_mensual) : <span className="font-normal text-slate-500">Sin precio definido</span>}</Dato>
            <Dato etiqueta="Facturas por cobrar">{porCobrar.pendientes.length === 0 ? "Ninguna" : `${porCobrar.pendientes.length} · ${dinero(porCobrar.monto)}${porCobrar.vencidas.length ? ` (${porCobrar.vencidas.length} vencida${porCobrar.vencidas.length === 1 ? "" : "s"})` : ""}`}</Dato>
          </dl>
          {ultimas.length > 0 && (
            <ul className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200/60 text-sm">
              {ultimas.map((f) => (
                <li key={f.id} className="flex items-center gap-2 px-3 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-slate-600">{f.numero} · {formatoFecha(`${f.periodo}-01`, "mesAnioCorto")}</span>
                  <span className="shrink-0 font-semibold tabular-nums" style={{ color: INK }}>{dinero(f.monto)}</span>
                  <span className={"shrink-0 text-xs font-bold " + (f.estado === "pagada" ? "text-emerald-700" : "text-amber-700")}>{f.estado === "pagada" ? "Pagada" : "Por cobrar"}</span>
                </li>
              ))}
            </ul>
          )}
        </Bloque>

        <Bloque titulo="Consultas de soporte abiertas">
          {consultasAbiertas.length === 0 ? <p className="text-sm text-slate-500">No tiene consultas abiertas.</p> : (
            <ul className="space-y-2">
              {consultasAbiertas.slice(0, 5).map((c) => (
                <li key={c.id} className="text-sm">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-xs font-bold text-slate-600">{codigoConsulta(c.numero)}</span>
                    <InsigniaEstado estado={c.estado} />
                    <InsigniaUrgencia urgencia={c.urgencia} />
                  </div>
                  <p className="truncate font-semibold" style={{ color: INK }} title={c.asunto}>{c.asunto}</p>
                </li>
              ))}
              {consultasAbiertas.length > 5 && <li className="text-xs text-slate-500">y {consultasAbiertas.length - 5} más</li>}
            </ul>
          )}
        </Bloque>
      </div>
    </Cascaron>
  )
}
