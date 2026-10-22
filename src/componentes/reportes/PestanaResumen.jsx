"use client"

import { useMemo, useState } from "react"
import { Stethoscope, UserPlus, CalendarX, ShoppingBag, DollarSign, Wallet } from "lucide-react"
import { Seccion, Caja, REJILLA_TARJETAS } from "./bloques"
import GraficoTendencia from "../graficas/GraficoTendencia"
import { crearDestinos } from "./destinos"
import { col } from "./listas"
import { dinero } from "../../utilidades/formatoMoneda"
import { vendidoYCobrado } from "../../utilidades/vendidoCobrado"
import { tieneReceta } from "../../utilidades/embudo"
import { comoFactura } from "../../utilidades/reportesDatos"
import { enRango, ultimosMeses } from "../../utilidades/reportesPeriodo"

const DINERO = { baseMinima: 100, formato: dinero }
const pct = (n) => (n == null ? "—" : `${n}%`)

// Resumen — "¿Cómo le fue a la óptica en este período?": seis números en el orden del recorrido (se atiende, se capta, se vende) y la
// tendencia de los últimos 12 meses. Cada número abre su lista; el detalle completo vive en su pestaña.
export default function PestanaResumen({ r }) {
  const { act, ant, cols, abrir, ocultarMontos, f, datos, hoy, tarjeta } = r
  const d = crearDestinos(r)
  const [serie, setSerie] = useState("consultas")

  const meses = useMemo(() => ultimosMeses(12, hoy).map((m) => {
    const en = (v) => enRango(v, m)
    const consultas = f.consultas.filter((c) => en(c.fecha))
    const facturas = f.facturas.filter((x) => x.estado !== "anulada" && en(x.creadoEn))
    const viejas = f.hay ? [] : datos.ventas.filter((v) => en(v.creadoEn))
    const vendido = vendidoYCobrado({ facturas: f.facturas, ventasViejas: f.hay ? [] : datos.ventas, abonos: datos.abonos, enPeriodo: en }).vendido
    return { ...m, consultas, ventas: [...facturas, ...viejas.map(comoFactura)], vendido }
  }), [f, datos, hoy])

  const { embudo, vc } = act
  const atendidosConReceta = act.cons.filter(tieneReceta)
  const sinConsultas = act.cons.length === 0

  return (
    <>
      <div className={REJILLA_TARJETAS}>
        {tarjeta({
          titulo: "Consultas realizadas", valor: act.cons.length, ayuda: "Fichas clínicas guardadas en el período.",
          onClick: () => abrir({ titulo: "Consultas realizadas", valor: act.cons.length, icono: Stethoscope, columnas: cols.consulta, filas: act.cons, abrirEn: d.consultas(), pestana: "clinico" }),
        }, act.cons.length, ant.cons.length)}
        {tarjeta({
          titulo: "Pacientes nuevos", valor: act.nuevos.length, ayuda: "Pacientes que se registraron en el período, por su fecha de registro.",
          onClick: () => abrir({ titulo: "Pacientes nuevos", valor: act.nuevos.length, icono: UserPlus, columnas: cols.pacienteNuevo, filas: act.nuevos, abrirEn: d.pacientesNuevos(), pestana: "clinico" }),
        }, act.nuevos.length, ant.nuevos.length)}
        {tarjeta({
          titulo: "Tasa de citas no efectuadas", valor: pct(act.tasaInasist), sub: act.tasaInasist == null ? "Sin citas en el período" : undefined,
          ayuda: "De las citas del período que no se cancelaron, cuántas terminaron en No efectuadas. Es la misma cifra que la pestaña Citas.",
          onClick: () => abrir({ titulo: `No efectuadas: ${act.noAsistio.length} de ${act.programadas.length} citas`, valor: pct(act.tasaInasist), icono: CalendarX, columnas: cols.cita, filas: act.noAsistio, abrirEn: d.citas("noAsistio"), pestana: "citas" }),
        }, act.tasaInasist ?? undefined, ant.tasaInasist, { buenoSiSube: false, puntos: true })}
        {!ocultarMontos && tarjeta({
          titulo: "Tasa de captación", valor: pct(act.captacion), sub: act.captacion == null ? "Sin atendidos con receta" : undefined,
          ayuda: "De los pacientes atendidos con receta en el período, cuántos compraron en la óptica. Es el último paso del embudo de la pestaña Ventas.",
          onClick: () => abrir({ titulo: `Compraron: ${embudo.compraron} de ${embudo.consultaron} atendidos con receta`, valor: pct(act.captacion), icono: ShoppingBag, columnas: cols.consultaCompra(embudo.ids.compraron), filas: atendidosConReceta, pestana: "ventas" }),
        }, act.captacion ?? undefined, ant.captacion, { puntos: true })}
        {!ocultarMontos && tarjeta({
          titulo: "Vendido", valor: dinero(vc.vendido), ayuda: "Total de los comprobantes de venta del período, sin los anulados, aunque todavía tengan saldo.",
          onClick: () => abrir({ titulo: `Vendido: ${vc.cantidad} venta${vc.cantidad === 1 ? "" : "s"}`, valor: dinero(vc.vendido), icono: DollarSign, columnas: cols.factura, filas: act.ventasLista, abrirEn: d.ventas(), pestana: "ventas" }),
        }, vc.vendido, ant.vc.vendido, DINERO)}
        {!ocultarMontos && tarjeta({
          titulo: "Ingreso por consulta", valor: act.ingresoPorConsulta == null ? "—" : dinero(act.ingresoPorConsulta), sub: sinConsultas ? "Sin consultas en el período" : undefined,
          ayuda: "Lo vendido en el período dividido entre las consultas realizadas en él.",
          onClick: () => abrir({ titulo: `Vendido ÷ consultas: ${dinero(vc.vendido)} ÷ ${act.cons.length}`, valor: act.ingresoPorConsulta == null ? "—" : dinero(act.ingresoPorConsulta), icono: Wallet, columnas: cols.factura, filas: act.ventasLista, abrirEn: d.ventas(), pestana: "ventas" }),
        }, act.ingresoPorConsulta ?? undefined, ant.ingresoPorConsulta, { baseMinima: 20, formato: dinero })}
      </div>

      <Seccion titulo="Tendencia" ayuda="Los últimos 12 meses con los filtros elegidos. No cambia con el período: sirve para ver hacia dónde va el negocio.">
        <Caja
          titulo={serie === "consultas" ? "Consultas por mes" : "Vendido por mes"}
          exportar={r.bloque(
            serie === "consultas" || ocultarMontos ? "Consultas por mes" : "Vendido por mes",
            () => ({ columnas: [col("Mes", (m) => m.etiqueta), col("Consultas", (m) => m.consultas.length, "entero"), ...(ocultarMontos ? [] : [col("Vendido", (m) => m.vendido, "dinero")])], filas: meses }),
            () => (serie === "consultas" || ocultarMontos ? { columnas: cols.consulta, filas: meses.flatMap((m) => m.consultas) } : { columnas: cols.factura, filas: meses.flatMap((m) => m.ventas) }),
          )}
          derecha={!ocultarMontos && (
            <div role="group" aria-label="Qué mostrar" className="flex rounded-lg border border-slate-200/60 p-0.5">
              {[["consultas", "Consultas"], ["vendido", "Vendido"]].map(([id, etiqueta]) => (
                <button key={id} type="button" aria-pressed={serie === id} onClick={() => setSerie(id)} className={"rounded-md px-2.5 py-1 text-sm font-semibold transition-colors cursor-pointer " + (serie === id ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50")}>{etiqueta}</button>
              ))}
            </div>
          )}
        >
          {serie === "consultas" || ocultarMontos ? (
            <GraficoTendencia periodo="mes" plural="consultas" nombre="Consultas por mes"
              datos={meses.map((m) => ({ clave: m.clave, etiqueta: m.etiqueta, valor: m.consultas.length, tip: `${m.etiqueta}: ${m.consultas.length} consulta${m.consultas.length === 1 ? "" : "s"}`, m }))}
              onElegir={(b) => abrir({ titulo: `Consultas · ${b.etiqueta}`, valor: b.valor, icono: Stethoscope, columnas: cols.consulta, filas: b.m.consultas, abrirEn: d.consultas() })}
            />
          ) : (
            <GraficoTendencia periodo="mes" plural="vendido" sujeto="lo vendido" nombre="Vendido por mes" formato={(v) => dinero(Math.round(v)).replace(/.00$/, "")} textoPendiente={(sube) => `${sube ? "más" : "menos"} vendidos por mes (tendencia)`}
              datos={meses.map((m) => ({ clave: m.clave, etiqueta: m.etiqueta, valor: m.vendido, texto: dinero(m.vendido), tip: `${m.etiqueta}: ${dinero(m.vendido)} vendidos en ${m.ventas.length} venta${m.ventas.length === 1 ? "" : "s"}`, m }))}
              onElegir={(b) => abrir({ titulo: `Vendido · ${b.etiqueta}`, valor: dinero(b.valor), icono: DollarSign, columnas: cols.factura, filas: b.m.ventas, abrirEn: d.ventas({}, b.m) })}
            />
          )}
        </Caja>
      </Seccion>
    </>
  )
}
