"use client"

import { useMemo } from "react"
import { Package, BellRing } from "lucide-react"
import { Seccion, Caja, SinResultados, NumeroPulsable, REJILLA_TARJETAS_4 } from "./bloques"
import { crearDestinos } from "./destinos"
import { col } from "./listas"
import { estaAtrasada, ordenesAbiertas, ordenesListasSinAvisar, resumenPedidos } from "../../utilidades/reportesDatos"
import { entregadaEn, diasDeEntrega } from "../../utilidades/reportesLaboratorio"
import { enRango } from "../../utilidades/reportesPeriodo"
import { etiquetaEntrega } from "../../utilidades/ventasModulo"

const pct = (n) => (n == null ? "—" : `${n}%`)
const dias = (n) => (n == null ? "—" : `${Math.round(n * 10) / 10} días`)

// Pedidos — "¿Se entregan a tiempo los pedidos?": cuántos están en proceso, atrasados y listos sin avisar hoy, qué porcentaje se entregó en la fecha aproximada y cuánto tarda en promedio,
// separado por cómo lo recibe el paciente (retira en la óptica o envío a domicilio).
export default function PestanaPedidos({ r }) {
  const { cols, abrir, rango, hoy, tarjeta } = r
  const d = crearDestinos(r)
  const ordenes = r.f.ordenes

  const abiertas = useMemo(() => ordenesAbiertas(ordenes), [ordenes])
  const atrasadas = useMemo(() => ordenes.filter((o) => estaAtrasada(o, hoy)), [ordenes, hoy])
  const sinAvisar = useMemo(() => ordenesListasSinAvisar(ordenes), [ordenes])
  const porEntrega = useMemo(() => resumenPedidos(ordenes, rango, hoy), [ordenes, rango, hoy])
  const entregadasEnElPeriodo = useMemo(() => ordenes.filter((o) => o.estado === "entregada" && diasDeEntrega(o) != null && enRango(entregadaEn(o), rango)), [ordenes, rango])

  const abrirOrdenes = (titulo, lista, destino, filtros, valor = lista.length) => abrir({ titulo, valor, icono: Package, columnas: cols.orden, filas: lista, abrirEn: destino, ...(filtros ? { filtros } : {}) })

  return (
    <>
      <Seccion titulo="Pedidos">
        <div className={REJILLA_TARJETAS_4}>
          {tarjeta({ titulo: "En proceso", aHoy: true, valor: abiertas.length, ayuda: "Pedidos que se encargaron y todavía no se entregan al paciente (en proceso o listos).", onClick: () => abrirOrdenes("Pedidos en proceso", abiertas, d.ordenes("enproceso"), `A hoy · ${r.filtrosTexto}`) })}
          {tarjeta({ titulo: "Atrasados", aHoy: true, valor: atrasadas.length, ayuda: "Pedidos en proceso cuya fecha aproximada ya pasó.", onClick: () => abrirOrdenes("Pedidos atrasados", atrasadas, d.ordenes("atrasadas"), `A hoy · ${r.filtrosTexto}`) })}
          {tarjeta({ titulo: "Listos sin avisar", aHoy: true, valor: sinAvisar.length, ayuda: "Pedidos ya listos a los que todavía no se avisó al paciente.", onClick: () => abrir({ titulo: "Pedidos listos sin avisar al paciente", valor: sinAvisar.length, icono: BellRing, columnas: cols.orden, filas: sinAvisar, abrirEn: { ...d.ordenes("sinavisar"), etiqueta: "Abrir los pedidos listos en Ventas" }, filtros: `A hoy · ${r.filtrosTexto}` }) })}
        </div>
      </Seccion>

      <Seccion titulo="Tiempos de entrega">
        <Caja titulo="Entrega de pedidos según cómo lo recibe el paciente" exportar={r.bloque("Entrega de pedidos",
          () => ({ columnas: [col("Entrega", (l) => l.entrega), col("En proceso (hoy)", (l) => l.abiertas, "entero"), col("Atrasados (hoy)", (l) => l.atrasadas, "entero"), col("Entregados en el período", (l) => l.entregadas, "entero"), col("Entregados a tiempo", (l) => l.pctATiempo, "tasa"), col("Promedio de entrega (días)", (l) => (l.promedioDias == null ? null : Math.round(l.promedioDias * 10) / 10), "decimal")], filas: porEntrega }),
          () => ({ columnas: cols.orden, filas: [...new Map([...abiertas, ...entregadasEnElPeriodo].map((o) => [o.id, o])).values()] }))} ayuda="En proceso y Atrasados son de hoy. Entregados, A tiempo y Promedio cuentan los pedidos que se entregaron en el período. A tiempo: entregados en la fecha aproximada o antes. Promedio: días desde que se creó el pedido hasta que se entregó.">
          {porEntrega.length === 0 ? (
            <SinResultados texto={r.hay ? "Ningún pedido coincide con estos filtros. Quita algún filtro para ver más." : "Todavía no hay pedidos en proceso ni entregados en este período. Se crean desde Ventas, al vender lunas."} acciones={r.hay ? [{ etiqueta: "Limpiar filtros", onClick: r.quitarFiltros }] : [{ etiqueta: "Ver este año", onClick: () => r.setPeriodo("anio") }]} />
          ) : (
            <table className="w-full table-fixed text-sm" aria-label="Pedidos por entrega">
              <colgroup><col />{[0, 1, 2, 3, 4].map((i) => <col key={i} style={{ width: 112 }} />)}</colgroup>
              <thead>
                <tr className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  <th scope="col" rowSpan={2} className="py-2 pr-2 text-left align-bottom">Entrega</th>
                  <th scope="colgroup" colSpan={2} className="border-b border-slate-100 px-1 pb-1 pt-2 text-center">A hoy</th>
                  <th scope="colgroup" colSpan={3} className="border-b border-slate-100 px-1 pb-1 pt-2 text-center">Entregados en el período</th>
                </tr>
                <tr className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  <th scope="col" className="truncate px-1 py-1.5 text-right">En proceso</th>
                  <th scope="col" className="truncate px-1 py-1.5 text-right">Atrasados</th>
                  <th scope="col" className="truncate px-1 py-1.5 text-right">Entregados</th>
                  <th scope="col" className="truncate px-1 py-1.5 text-right">A tiempo</th>
                  <th scope="col" className="truncate px-1 py-1.5 text-right">Promedio</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {porEntrega.map((l) => {
                  const deEsta = (o) => etiquetaEntrega(o) === l.entrega
                  const listaAbiertas = abiertas.filter(deEsta)
                  const listaAtrasadas = atrasadas.filter(deEsta)
                  const listaEntregadas = entregadasEnElPeriodo.filter(deEsta)
                  return (
                    <tr key={l.entrega}>
                      <th scope="row" className="truncate py-2 pr-2 text-left font-semibold text-slate-700" title={l.entrega}>{l.entrega}</th>
                      <td className="px-1 text-right"><NumeroPulsable valor={l.abiertas} nombre={`${l.entrega}: ${l.abiertas} en proceso. Ver la lista`} onClick={() => abrirOrdenes(`${l.entrega} · en proceso`, listaAbiertas, d.ordenes("enproceso"), `A hoy · ${r.filtrosTexto}`)} /></td>
                      <td className="px-1 text-right">{l.atrasadas > 0 ? <NumeroPulsable valor={l.atrasadas} nombre={`${l.entrega}: ${l.atrasadas} atrasados. Ver la lista`} onClick={() => abrirOrdenes(`${l.entrega} · atrasados`, listaAtrasadas, d.ordenes("atrasadas"), `A hoy · ${r.filtrosTexto}`)} texto={<span className="text-red-600">{l.atrasadas}</span>} /> : <span className="tabular-nums text-slate-400">0</span>}</td>
                      <td className="px-1 text-right"><NumeroPulsable valor={l.entregadas} nombre={`${l.entrega}: ${l.entregadas} entregados en el período. Ver la lista`} onClick={() => abrirOrdenes(`${l.entrega} · entregados`, listaEntregadas, null)} /></td>
                      <td className="px-1 text-right"><NumeroPulsable valor={l.entregadas} texto={pct(l.pctATiempo)} nombre={`${l.entrega}: ${pct(l.pctATiempo)} entregado a tiempo (${l.aTiempo} de ${l.entregadas}). Ver la lista`} onClick={() => abrirOrdenes(`${l.entrega} · entregados: ${l.aTiempo} de ${l.entregadas} a tiempo`, listaEntregadas, null, undefined, pct(l.pctATiempo))} /></td>
                      <td className="px-1 text-right"><NumeroPulsable valor={l.entregadas} texto={dias(l.promedioDias)} nombre={`${l.entrega}: promedio de entrega ${dias(l.promedioDias)}. Ver la lista`} onClick={() => abrirOrdenes(`${l.entrega} · entregados: promedio ${dias(l.promedioDias)}`, listaEntregadas, null, undefined, dias(l.promedioDias))} /></td>
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
