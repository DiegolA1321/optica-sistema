"use client"

import { useMemo } from "react"
import { FlaskConical, BellRing } from "lucide-react"
import { Seccion, Caja, SinResultados, NumeroPulsable, REJILLA_TARJETAS_4 } from "./bloques"
import { crearDestinos } from "./destinos"
import { col } from "./listas"
import { estaAtrasada, ordenesAbiertas, ordenesListasSinAvisar, resumenLaboratorios } from "../../utilidades/reportesDatos"
import { entregadaEn, diasDeEntrega } from "../../utilidades/reportesLaboratorio"
import { enRango } from "../../utilidades/reportesPeriodo"

const SIN_LAB = "Sin laboratorio"
const labDe = (o) => (o.laboratorio || "").trim() || SIN_LAB
const pct = (n) => (n == null ? "—" : `${n}%`)
const dias = (n) => (n == null ? "—" : `${Math.round(n * 10) / 10} días`)

// Laboratorios — "¿Cumplen los laboratorios?": por laboratorio, cuántas órdenes tiene abiertas y atrasadas hoy, qué porcentaje entregó a
// tiempo y cuánto tarda en promedio, y las órdenes listas a las que todavía no se avisó al paciente.
export default function PestanaLaboratorios({ r }) {
  const { f, cols, abrir, rango, hoy, tarjeta } = r
  const d = crearDestinos(r)
  const ordenes = f.ordenes

  const abiertas = useMemo(() => ordenesAbiertas(ordenes), [ordenes])
  const atrasadas = useMemo(() => ordenes.filter((o) => estaAtrasada(o, hoy)), [ordenes, hoy])
  const sinAvisar = useMemo(() => ordenesListasSinAvisar(ordenes), [ordenes])
  const porLab = useMemo(() => resumenLaboratorios(ordenes, rango, hoy), [ordenes, rango, hoy])
  const entregadasEnElPeriodo = useMemo(() => ordenes.filter((o) => o.estado === "entregada" && diasDeEntrega(o) != null && enRango(entregadaEn(o), rango)), [ordenes, rango])

  const abrirOrdenes = (titulo, lista, destino, filtros, valor = lista.length) => abrir({ titulo, valor, icono: FlaskConical, columnas: cols.orden, filas: lista, abrirEn: destino, ...(filtros ? { filtros } : {}) })

  return (
    <>
      <Seccion titulo="Órdenes de laboratorio">
        <div className={REJILLA_TARJETAS_4}>
          {tarjeta({ titulo: "Abiertas", aHoy: true, valor: abiertas.length, ayuda: "Órdenes enviadas al laboratorio o listas para entregar que todavía no se entregan al paciente.", onClick: () => abrirOrdenes("Órdenes abiertas", abiertas, d.ordenes("abiertas"), `A hoy · ${r.filtrosTexto}`) })}
          {tarjeta({ titulo: "Atrasadas", aHoy: true, valor: atrasadas.length, ayuda: "Órdenes enviadas cuya fecha prometida de entrega ya pasó.", onClick: () => abrirOrdenes("Órdenes atrasadas", atrasadas, d.ordenes("atrasadas"), `A hoy · ${r.filtrosTexto}`) })}
          {tarjeta({ titulo: "Listas sin avisar", aHoy: true, valor: sinAvisar.length, ayuda: "Órdenes ya listas para entregar a las que todavía no se avisó al paciente.", onClick: () => abrir({ titulo: "Órdenes listas sin avisar al paciente", valor: sinAvisar.length, icono: BellRing, columnas: cols.orden, filas: sinAvisar, abrirEn: { ...d.ordenes("listas"), etiqueta: "Abrir las órdenes listas en Ventas" }, filtros: `A hoy · ${r.filtrosTexto}` }) })}
        </div>
      </Seccion>

      <Seccion titulo="Por laboratorio">
        <Caja titulo="Desempeño de cada laboratorio" exportar={r.bloque("Desempeño de los laboratorios",
          () => ({ columnas: [col("Laboratorio", (l) => l.laboratorio), col("Abiertas (hoy)", (l) => l.abiertas, "entero"), col("Atrasadas (hoy)", (l) => l.atrasadas, "entero"), col("Entregadas en el período", (l) => l.entregadas, "entero"), col("Entregadas a tiempo", (l) => l.pctATiempo, "tasa"), col("Promedio de entrega (días)", (l) => (l.promedioDias == null ? null : Math.round(l.promedioDias * 10) / 10), "decimal")], filas: porLab }),
          () => ({ columnas: cols.orden, filas: [...new Map([...abiertas, ...entregadasEnElPeriodo].map((o) => [o.id, o])).values()] }))} ayuda="Abiertas y atrasadas son de hoy. Entregadas, A tiempo y Promedio cuentan las órdenes que se entregaron en el período. A tiempo: entregadas en la fecha prometida o antes. Promedio: días desde que se creó la orden hasta que se entregó.">
          {porLab.length === 0 ? (
            <SinResultados texto={r.hay ? "Ninguna orden de laboratorio coincide con estos filtros. Quita algún filtro para ver más." : "Todavía no hay órdenes de laboratorio abiertas ni entregadas en este período. Se crean desde Ventas, al vender lentes."} acciones={r.hay ? [{ etiqueta: "Limpiar filtros", onClick: r.quitarFiltros }] : [{ etiqueta: "Ver este año", onClick: () => r.setPeriodo("anio") }]} />
          ) : (
            <table className="w-full table-fixed text-sm" aria-label="Laboratorios">
              <colgroup><col />{[0, 1, 2, 3, 4].map((i) => <col key={i} style={{ width: 112 }} />)}</colgroup>
              <thead>
                <tr className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  <th scope="col" rowSpan={2} className="py-2 pr-2 text-left align-bottom">Laboratorio</th>
                  <th scope="colgroup" colSpan={2} className="border-b border-slate-100 px-1 pb-1 pt-2 text-center">A hoy</th>
                  <th scope="colgroup" colSpan={3} className="border-b border-slate-100 px-1 pb-1 pt-2 text-center">Entregadas en el período</th>
                </tr>
                <tr className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  <th scope="col" className="truncate px-1 py-1.5 text-right">Abiertas</th>
                  <th scope="col" className="truncate px-1 py-1.5 text-right">Atrasadas</th>
                  <th scope="col" className="truncate px-1 py-1.5 text-right">Entregadas</th>
                  <th scope="col" className="truncate px-1 py-1.5 text-right">A tiempo</th>
                  <th scope="col" className="truncate px-1 py-1.5 text-right">Promedio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {porLab.map((l) => {
                  const delLab = (o) => labDe(o) === l.laboratorio
                  const listaAbiertas = abiertas.filter(delLab)
                  const listaAtrasadas = atrasadas.filter(delLab)
                  const listaEntregadas = entregadasEnElPeriodo.filter(delLab)
                  return (
                    <tr key={l.laboratorio}>
                      <th scope="row" className="truncate py-2 pr-2 text-left font-semibold text-slate-700" title={l.laboratorio}>{l.laboratorio}</th>
                      <td className="px-1 text-right"><NumeroPulsable valor={l.abiertas} nombre={`${l.laboratorio}: ${l.abiertas} abiertas. Ver la lista`} onClick={() => abrirOrdenes(`${l.laboratorio} · abiertas`, listaAbiertas, d.ordenes("abiertas"), `A hoy · ${r.filtrosTexto}`)} /></td>
                      <td className="px-1 text-right">{l.atrasadas > 0 ? <NumeroPulsable valor={l.atrasadas} nombre={`${l.laboratorio}: ${l.atrasadas} atrasadas. Ver la lista`} onClick={() => abrirOrdenes(`${l.laboratorio} · atrasadas`, listaAtrasadas, d.ordenes("atrasadas"), `A hoy · ${r.filtrosTexto}`)} texto={<span className="text-red-600">{l.atrasadas}</span>} /> : <span className="tabular-nums text-slate-400">0</span>}</td>
                      <td className="px-1 text-right"><NumeroPulsable valor={l.entregadas} nombre={`${l.laboratorio}: ${l.entregadas} entregadas en el período. Ver la lista`} onClick={() => abrirOrdenes(`${l.laboratorio} · entregadas`, listaEntregadas, null)} /></td>
                      <td className="px-1 text-right"><NumeroPulsable valor={l.entregadas} texto={pct(l.pctATiempo)} nombre={`${l.laboratorio}: ${pct(l.pctATiempo)} entregado a tiempo (${l.aTiempo} de ${l.entregadas}). Ver la lista`} onClick={() => abrirOrdenes(`${l.laboratorio} · entregadas: ${l.aTiempo} de ${l.entregadas} a tiempo`, listaEntregadas, null, undefined, pct(l.pctATiempo))} /></td>
                      <td className="px-1 text-right"><NumeroPulsable valor={l.entregadas} texto={dias(l.promedioDias)} nombre={`${l.laboratorio}: promedio de entrega ${dias(l.promedioDias)}. Ver la lista`} onClick={() => abrirOrdenes(`${l.laboratorio} · entregadas: promedio ${dias(l.promedioDias)}`, listaEntregadas, null, undefined, dias(l.promedioDias))} /></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </Caja>
      </Seccion>
    </>
  )
}
