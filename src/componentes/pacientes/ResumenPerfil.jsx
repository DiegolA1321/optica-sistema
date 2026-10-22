"use client"

import { useMemo, useState } from "react"
import { INK } from "@/lib/tema"
import { Despliegue, PanelPuntaje, PanelReferidos, PanelCumple } from "../DetallesResumen"
import { dinero } from "../../utilidades/formatoMoneda"
import { fechaLegible, fechaReciente, formatoFecha } from "../../utilidades/formatoFecha"
import { fraseCumpleanos, antiguedadEnPalabras } from "../../utilidades/edad"
import { comoLlego } from "../../utilidades/comoLlego"
import { recetaEnLinea } from "../../utilidades/resultadoDeCita"
import { textoDiagnostico } from "../../utilidades/pasesVenta"
import { ahoraEcuador } from "../../utilidades/horaEcuador"
import { actividadReciente } from "../../utilidades/actividadReciente"
import { useContactosDelPaciente } from "../../utilidades/contactosPaciente"

// El Resumen del perfil, de arriba abajo: los avisos del paciente (etiquetas pequeñas con su acción), la franja con sus datos (paciente desde, total comprado, saldo y cómo llegó),
// «Última atención» y «Actividad reciente» lado a lado, y la fidelización compacta. La última consulta y el próximo control NO van aquí: están solo en Citas.
const TONO_AVISO = {
  ambar: "bg-amber-50 text-amber-800", rojo: "bg-red-50 text-red-800", azul: "bg-blue-50 text-blue-800", verde: "bg-emerald-50 text-emerald-800", gris: "bg-slate-100 text-slate-700",
}
const PUNTO_AVISO = { ambar: "bg-amber-600", rojo: "bg-red-600", azul: "bg-blue-600", verde: "bg-emerald-600", gris: "bg-slate-500" }
const PUNTO_ACTIVIDAD = { verde: "bg-emerald-600", rojo: "bg-red-600", azul: "bg-blue-600", gris: "bg-slate-400", ambar: "bg-amber-600" }
const CARTA = "rounded-2xl border border-slate-200/60 bg-white shadow-sm"
const ROTULO = "text-[13px] font-medium text-slate-500"

export function AvisosDelPaciente({ avisos = [] }) {
  if (avisos.length === 0) return null
  return (
    <ul aria-label="Avisos del paciente" className="flex flex-wrap items-center gap-2.5">
      {avisos.map((a) => (
        <li key={a.id} role="status" className={"inline-flex max-w-full items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold " + TONO_AVISO[a.tono || "gris"]}>
          <span aria-hidden="true" className={"h-2 w-2 shrink-0 rounded-full " + PUNTO_AVISO[a.tono || "gris"]} />
          <span className="min-w-0">{a.texto}</span>
          {a.accion && <><span aria-hidden="true">·</span><button type="button" onClick={a.accion.onClick} className="shrink-0 font-bold underline-offset-2 hover:underline cursor-pointer">{a.accion.etiqueta}</button></>}
        </li>
      ))}
    </ul>
  )
}

export default function ResumenPerfil({ paciente, pacientes = [], citas = [], consultas = [], compras = [], avisos = [], totales, fidelidad: f, referidosLista = [], onAbrirPaciente, onVerDiagnostico, onVerCitas, onVerCompras, onAgendar }) {
  const [abierto, setAbierto] = useState(null)
  const alternar = (clave) => setAbierto((a) => (a === clave ? null : clave))
  const mensajes = useContactosDelPaciente(paciente.id, 5)
  const actividad = useMemo(() => actividadReciente({ citas, consultas, compras, mensajes }), [citas, consultas, compras, mensajes])
  const ultima = consultas[0]
  const llego = comoLlego(paciente, pacientes)
  const receta = ultima ? recetaEnLinea(ultima) : ""
  const dx = ultima ? textoDiagnostico(ultima) : ""
  const nombreNivel = f.nivel?.nombre
  const base = f.nivel?.desde ?? 0
  const avance = f.siguiente ? Math.max(0, Math.min(100, Math.round(((f.puntos.total - base) / Math.max(1, f.siguiente.desde - base)) * 100))) : 100
  const nacimiento = paciente.fecha_nacimiento || paciente.fechaNacimiento
  const celda = "min-w-0 px-5 py-3.5 text-left"
  const celdaPulsable = celda + " transition-colors hover:bg-slate-50 cursor-pointer"
  const valor = "mt-0.5 break-words font-serif text-[26px] font-bold leading-tight"
  return (
    <div className="space-y-4">
      <AvisosDelPaciente avisos={avisos} />

      {/* La franja de datos: cada uno del tamaño de su contenido, separados por líneas finas. */}
      <section aria-label="Datos del paciente" className={CARTA + " grid grid-cols-2 divide-slate-200/70 overflow-hidden lg:divide-x " + (totales.sinMontos ? "lg:grid-cols-3" : "lg:grid-cols-4")}>
        <div className={celda}>
          <p className={ROTULO}>Paciente desde</p>
          <p className={valor} style={{ color: INK }}>{paciente.fechaRegistro ? formatoFecha(paciente.fechaRegistro, "mesAnioCorto") : "Sin fecha"}</p>
          <p className="text-sm text-slate-500">{antiguedadEnPalabras(paciente.fechaRegistro) || "registro sin fecha"}</p>
        </div>
        <button type="button" onClick={onVerCompras} data-resumen className={celdaPulsable} aria-label="Total comprado. Ver las compras">
          <p className={ROTULO}>Total comprado</p>
          <p className={valor} style={{ color: INK }}>{totales.sinMontos ? `${totales.nCompras} compra${totales.nCompras === 1 ? "" : "s"}` : dinero(totales.comprado)}</p>
          {!totales.sinMontos && <p className="text-sm text-slate-500">{totales.nCompras} compra{totales.nCompras === 1 ? "" : "s"}</p>}
        </button>
        {!totales.sinMontos && (
          <button type="button" onClick={onVerCompras} data-resumen className={celdaPulsable} aria-label="Saldo. Ver las compras">
            <p className={ROTULO + " flex items-center gap-1.5"}>{totales.saldo > 0 && <span aria-hidden="true" className="h-2 w-2 rounded-full bg-red-600" />}Saldo</p>
            <p className={valor} style={{ color: INK }}>{dinero(totales.saldo)}</p>
            <p className="text-sm text-slate-500">{totales.saldo > 0 ? "por cobrar" : "al día"}</p>
          </button>
        )}
        <div className={celda}>
          <p className={ROTULO}>Cómo llegó</p>
          <p className={valor} style={{ color: INK }}>
            {llego.tipo === "referido" && llego.referente && onAbrirPaciente
              ? <>Referido por <button type="button" onClick={() => onAbrirPaciente(llego.referente)} className="text-left text-blue-700 underline-offset-2 hover:underline cursor-pointer">{llego.referente.nombre}</button></>
              : llego.texto}
          </p>
          <p className="text-sm text-slate-500">{llego.detalle}</p>
        </div>
      </section>

      <div className="grid items-stretch gap-4 lg:grid-cols-2">
        <section aria-label="Última atención" data-resumen={ultima && onVerDiagnostico ? "" : undefined} className={CARTA + " relative p-5 " + (ultima && onVerDiagnostico ? "transition-colors hover:bg-slate-50/60" : "")}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-base font-bold" style={{ color: INK }}>Última atención</h2>
            {ultima && onVerDiagnostico && <button type="button" onClick={onVerDiagnostico} className="text-sm font-semibold text-blue-600 transition-colors after:absolute after:inset-0 after:rounded-2xl hover:text-blue-700 cursor-pointer">Ver diagnóstico →</button>}
          </div>
          {ultima ? (
            <div className="mt-3 space-y-2.5 text-[15px] leading-snug text-slate-700">
              <p><span className="text-slate-500">Diagnóstico:</span> <span className="font-bold" style={{ color: INK }}>{dx || "sin diagnóstico registrado"}</span></p>
              {receta && <p className="break-words font-mono text-sm" style={{ color: INK }}>{receta}</p>}
              {ultima.indicaciones && <p><span className="text-slate-500">Indicaciones:</span> {ultima.indicaciones}</p>}
              <p><span className="text-slate-500">Atendió:</span> {ultima.profesionalNombre ? `${ultima.profesionalNombre} · ` : ""}{fechaLegible(ultima.fecha)}</p>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-500">Todavía no tiene una atención registrada.</p>
              {onAgendar && <button type="button" onClick={onAgendar} className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 cursor-pointer">Agendar cita</button>}
            </div>
          )}
        </section>

        <section aria-label="Actividad reciente" data-resumen={actividad.length > 0 && onVerCitas ? "" : undefined} className={CARTA + " relative p-5 " + (actividad.length > 0 && onVerCitas ? "transition-colors hover:bg-slate-50/60" : "")}>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-base font-bold" style={{ color: INK }}>Actividad reciente</h2>
            {actividad.length > 0 && onVerCitas && <button type="button" onClick={onVerCitas} className="text-sm font-semibold text-blue-600 transition-colors after:absolute after:inset-0 after:rounded-2xl hover:text-blue-700 cursor-pointer">Ver todo →</button>}
          </div>
          {actividad.length > 0 ? (
            <ul className="mt-3 space-y-2.5">
              {actividad.map((e) => (
                <li key={e.id} className="grid grid-cols-[3.75rem_minmax(0,1fr)] items-baseline gap-x-2 text-[15px]">
                  <span className="flex items-center gap-2.5 text-slate-500"><span aria-hidden="true" className={"h-2 w-2 shrink-0 rounded-full " + PUNTO_ACTIVIDAD[e.tono]} />{fechaReciente(e.fecha)}</span>
                  <span className="min-w-0 break-words pl-4 text-slate-800">{e.texto}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-500">Todavía no hay actividad: aparece al atenderlo, venderle o escribirle.</p>
              {onAgendar && <button type="button" onClick={onAgendar} className="rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 cursor-pointer">Agendar cita</button>}
            </div>
          )}
        </section>
      </div>

      <section aria-label="Fidelización" className={CARTA + " px-5 py-4"}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-bold" style={{ color: INK }}>Fidelización</h2>
          <button type="button" onClick={f.onCrm} className="text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700 cursor-pointer">Gestionar en CRM →</button>
        </div>
        <div className="mt-3 grid gap-y-3 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] sm:divide-x sm:divide-slate-200/70">
          <button type="button" onClick={() => alternar("puntaje")} aria-haspopup="dialog" data-resumen className="min-w-0 pr-6 text-left cursor-pointer">
            <p className={ROTULO}>Nivel y puntos</p>
            <p className="text-lg font-bold" style={{ color: INK }}>{nombreNivel} · {f.puntos.total} pts</p>
            <div role="progressbar" aria-label="Avance hacia el siguiente nivel" aria-valuemin={0} aria-valuemax={100} aria-valuenow={avance} className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-600" style={{ width: `${avance}%` }} /></div>
            <p className="mt-1.5 text-sm text-slate-500">{f.siguiente ? `Faltan ${f.faltan} para ${f.siguiente.nombre}${f.siguiente.descuento > 0 ? ` (${f.siguiente.descuento} % de descuento)` : ""}` : "Es el nivel más alto"}</p>
          </button>
          <button type="button" onClick={() => alternar("referidos")} aria-haspopup="dialog" data-resumen className="min-w-0 text-left cursor-pointer sm:px-6">
            <p className={ROTULO}>Referidos</p>
            <p className="text-lg font-bold" style={{ color: INK }}>{f.referidos} paciente{f.referidos === 1 ? "" : "s"}</p>
            <p className="text-sm text-slate-500">+{f.programa?.porReferido ?? 15} pts por cada uno</p>
          </button>
          <button type="button" onClick={() => alternar("cumple")} aria-haspopup="dialog" data-resumen className="min-w-0 text-left cursor-pointer sm:pl-6">
            <p className={ROTULO}>Cumpleaños del paciente</p>
            <p className="text-lg font-bold" style={{ color: INK }}>{nacimiento && f.diasCumple != null ? formatoFecha(nacimiento, "diaMes") : "Sin fecha de nacimiento"}</p>
            <p className="text-sm text-slate-500">{nacimiento && f.diasCumple != null ? fraseCumpleanos(f.edad, f.diasCumple) : "se pide en Datos"}</p>
          </button>
        </div>
        {abierto === "puntaje" && <Despliegue titulo="Cómo se ganaron los puntos" onCerrar={() => setAbierto(null)}><PanelPuntaje consultas={consultas} referidos={referidosLista} puntos={f.puntos} nivel={{ nivel: f.nivel, siguiente: f.siguiente, faltan: f.faltan }} programa={f.programa} /></Despliegue>}
        {abierto === "referidos" && <Despliegue titulo="Pacientes que refirió" onCerrar={() => setAbierto(null)}><PanelReferidos lista={referidosLista} referidoPor={f.referidoPor} onAbrir={onAbrirPaciente} /></Despliegue>}
        {abierto === "cumple" && <Despliegue titulo="Cumpleaños" onCerrar={() => setAbierto(null)}><PanelCumple fechaNacimiento={nacimiento} diasCumple={f.diasCumple} edad={f.edad} saludoAnio={paciente.ultimoSaludoCumpleAnio} anioActual={ahoraEcuador().getFullYear()} cumpleAuto={f.cumpleAuto === true} tieneCorreo={!!paciente.correo && !/^sin /i.test(paciente.correo)} onCrm={f.onCrm} /></Despliegue>}
      </section>
    </div>
  )
}
