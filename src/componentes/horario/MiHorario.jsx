"use client"

import { useMemo, useState } from "react"
import { horaSinCero } from "../../utilidades/formatoFecha"
import { GRAD_MARCA, INK } from "@/lib/tema"
import { Insignia } from "../ventas/Lista"
import { CLASE_ACCION_PRINCIPAL } from "../ventas/estilos"
import VentanaSolicitarAusencia from "./VentanaSolicitarAusencia"
import { ahoraEcuador } from "../../utilidades/horaEcuador"
import { ETIQUETAS_DIA, hoyISO } from "../../utilidades/disponibilidad"
import { lunesDeSemana } from "../../utilidades/calendarioSemana"
import { ESTADOS_AUSENCIA, ORDEN_DIAS, etiquetaTipoAusencia, resumenSemanaPersona, semanaDe, textoCuando } from "../../utilidades/agendaPersonal"

const TEXTO_TURNO = (t) => (t?.activo ? `${horaSinCero(t.inicio)} a ${horaSinCero(t.fin)}` : null)

// «Mi horario» (todos los roles): su horario de solo lectura (lo asigna la administración), sus ausencias con su estado y «Solicitar ausencia».
export default function MiHorario({ usuario, esProfesional, disponibilidad, citas = [], datos, onAviso }) {
  const { horarios, ausencias, retirarAusencia } = datos
  const yo = { id: usuario.id, ...(horarios[usuario.id] || { usaOptica: true, horario: null }), ausencias: [] }
  const semana = useMemo(() => semanaDe(yo, disponibilidad), [horarios, disponibilidad]) // eslint-disable-line react-hooks/exhaustive-deps
  const [pidiendo, setPidiendo] = useState(false)
  const [retirando, setRetirando] = useState(null)
  const mias = ausencias.filter((a) => a.usuarioId === usuario.id && a.estado !== "cancelada").sort((a, b) => (a.fechaDesde < b.fechaDesde ? 1 : -1)).slice(0, 12)
  // Las aprobadas ya cuentan en su agenda: «esta semana» las descuenta.
  const profesional = { ...yo, ausencias: ausencias.filter((a) => a.usuarioId === usuario.id && a.estado === "aprobada").map((a) => ({ desde: a.fechaDesde, hasta: a.fechaHasta, franja: a.franja })) }
  const semanaActual = esProfesional ? resumenSemanaPersona({ lunes: lunesDeSemana(hoyISO()), profesional, citas, disponibilidad, duracion: disponibilidad?.duracionCita || 40, ahora: ahoraEcuador() }) : null

  const retirar = async (a) => {
    setRetirando(a.id)
    const { error } = await retirarAusencia(a.id)
    setRetirando(null)
    onAviso?.(error || "Solicitud retirada.", error ? "error" : undefined)
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)] lg:items-start">
      <section aria-label="Tu horario de trabajo" className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-sm">
        <div className="px-5 py-4">
          <h2 className="text-xl font-bold" style={{ color: INK }}>Tu horario de trabajo</h2>
          <p className="text-sm text-slate-500">Lo asigna la administración. Si necesitas un cambio, escríbele desde Soporte.</p>
        </div>
        <ul aria-label="Semana" className="divide-y divide-slate-100 border-t border-slate-100">
          {ORDEN_DIAS.map((dia) => (
            <li key={dia} className="grid grid-cols-[6.5rem_1fr_1fr] items-center gap-x-4 gap-y-1 px-5 py-3.5 max-sm:grid-cols-1">
              <span className="text-sm font-bold" style={{ color: INK }}>{ETIQUETAS_DIA[dia]}</span>
              {["manana", "tarde"].map((k) => {
                const texto = TEXTO_TURNO(semana[dia][k])
                const nombre = k === "manana" ? "Mañana" : "Tarde"
                return texto ? <span key={k} className="text-sm text-slate-800">{nombre}: {texto}</span> : <span key={k} className="text-sm text-slate-400">{nombre}: no trabaja</span>
              })}
            </li>
          ))}
        </ul>
      </section>

      <div className="space-y-4">
        <section aria-label="Tus ausencias" className="rounded-2xl border border-slate-200/70 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 px-5 py-4">
            <h2 className="text-xl font-bold leading-tight" style={{ color: INK }}>Tus ausencias</h2>
            <button type="button" onClick={() => setPidiendo(true)} className={CLASE_ACCION_PRINCIPAL + " px-4 py-2.5"} style={{ background: GRAD_MARCA }}>Solicitar ausencia</button>
          </div>
          {mias.length === 0 ? (
            <p className="border-t border-slate-100 px-5 py-4 text-sm text-slate-500">Todavía no pediste ninguna ausencia. Si no vas a poder asistir, pídela aquí: la administración la aprueba o la rechaza.</p>
          ) : (
            <ul aria-label="Ausencias" className="divide-y divide-slate-100 border-t border-slate-100">
              {mias.map((a) => {
                const e = ESTADOS_AUSENCIA[a.estado] || ESTADOS_AUSENCIA.pendiente
                return (
                  <li key={a.id} className="flex items-start justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{textoCuando(a)}</p>
                      <p className="truncate text-sm text-slate-500">{etiquetaTipoAusencia(a.tipo)}{a.motivo ? ` · ${a.motivo}` : ""}</p>
                      {a.estado === "rechazada" && a.motivoRechazo && <p className="text-xs text-red-700">Motivo: {a.motivoRechazo}</p>}
                      {a.estado === "pendiente" && <button type="button" onClick={() => retirar(a)} disabled={retirando === a.id} aria-label={`Retirar la solicitud del ${textoCuando(a)}`} className="mt-0.5 text-xs font-semibold text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline cursor-pointer disabled:opacity-60">Retirar solicitud</button>}
                    </div>
                    <Insignia tono={e.tono}>{e.etiqueta}</Insignia>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        {semanaActual && (
          <section aria-label="Esta semana" className="rounded-2xl border border-slate-200/70 bg-white px-5 py-4 shadow-sm">
            <h2 className="text-base font-bold" style={{ color: INK }}>Esta semana</h2>
            <p className="text-sm text-slate-500">{semanaActual.citas} {semanaActual.citas === 1 ? "cita agendada" : "citas agendadas"} · {semanaActual.horasLibres} {semanaActual.horasLibres === 1 ? "hora libre" : "horas libres"}</p>
          </section>
        )}
      </div>

      {pidiendo && <VentanaSolicitarAusencia usuario={usuario} disponibilidad={disponibilidad} citas={citas} datos={datos} onCerrar={() => setPidiendo(false)} onEnviada={() => { setPidiendo(false); onAviso?.("Solicitud enviada. La administración la aprueba o la rechaza y te avisa.") }} />}
    </div>
  )
}
