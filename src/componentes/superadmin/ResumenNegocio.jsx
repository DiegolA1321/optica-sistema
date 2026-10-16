"use client"

import { useEffect, useMemo, useState } from "react"
import { Building2, CircleAlert, DollarSign, Handshake, Headset, Inbox, LifeBuoy, Plus, Users, Wallet } from "lucide-react"
import { supabase } from "../../lib/supabaseClient"
import { INK, GRAD_MARCA } from "@/lib/tema"
import { MODO_SAAS_VISIBLE } from "@/lib/config"
import TarjetaReporte from "../reportes/TarjetaReporte"
import VentanaDetalle from "../reportes/VentanaDetalle"
import SelectorPeriodo from "../reportes/SelectorPeriodo"
import { Seccion, Caja, SinResultados, REJILLA_TARJETAS_4 } from "../reportes/bloques"
import { BarrasMes, BarraRepartida } from "../reportes/Graficas"
import { col } from "../reportes/listas"
import SinDatosAun from "../SinDatosAun"
import DetalleOptica from "./DetalleOptica"
import { CabeceraSeccion, EtiquetasFiltros, InsigniaSalud, InterruptorPrueba } from "./piezas"
import { dinero } from "../../utilidades/formatoMoneda"
import { formatoFecha, fechaLegible, fechaHoraLegible, tituloSemana } from "../../utilidades/formatoFecha"
import { ahoraEcuador } from "../../utilidades/horaEcuador"
import { fechaAISO } from "../../utilidades/disponibilidad"
import { modeloDeLista, descargarModelo } from "../../utilidades/reportesExcel"
import { rangoDePeriodo, rangoAnterior, etiquetaComparacion, variacion, diaDe } from "../../utilidades/reportesPeriodo"
import { codigoConsulta, duracionLegible, indicadoresSoporte, esAbierta } from "../../utilidades/soporte"
import {
  opticasDelNegocio, idsDePrueba, ingresosDelPeriodo, porCobrarAl, serieIngresos, clientesDelPeriodo, serieClientes, saludDeLaRed, contarSalud,
  AYUDA_SALUD, SALUD, usoDeLaRed, frasesDeAccion, sinPruebas, tiposVisibles, MODULOS_USO, embudoLeads, consultasAbiertasAl, instanteInicio, instanteFin,
} from "../../utilidades/superadminNegocio"

const DINERO = { baseMinima: 100, formato: dinero }
const PAGO = { al_dia: "Al día", pendiente: "Pendiente", vencido: "Vencido" }
const FILAS_SALUD = 8
const columna = (titulo, valor, ancho, extra = {}) => ({ titulo, valor, ...(ancho ? { ancho } : {}), ...extra })
const fecha = (titulo, fn, ancho = 124) => ({ titulo, ancho, valor: (f) => fechaLegible(diaDe(fn(f))), tipo: "fecha", crudo: (f) => diaDe(fn(f)) })
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`

// El Resumen del superadmin: las cuentas de un negocio de software por suscripción. Responde "¿cómo va mi negocio y qué óptica necesita atención?".
// Es el mismo molde que Reportes: tarjetas con su comparación y su ⓘ, gráficas con su valor, cada número abre su lista en la ventana estándar
// con "Abrir en …" y "Exportar", y el mismo selector de período.
export default function ResumenNegocio({ datos, opticas, leads, consultas, cargandoSoporte, estadoServidor, incluirPrueba, onIncluirPrueba, usuario, onAbrir, onEntrarComo, onAviso, onCrearOptica, actividad = [] }) {
  // Con el modo de la tesis (una sola óptica) el panel es la administración técnica del sistema: sin ingresos, clientes, leads ni salud de clientes.
  const saas = MODO_SAAS_VISIBLE
  const [periodo, setPeriodo] = useState("mes")
  const [personalizado, setPersonalizado] = useState({ inicio: "", fin: "" })
  const [detalle, setDetalle] = useState(null)
  const [opticaAbierta, setOpticaAbierta] = useState(null)
  const [visitas, setVisitas] = useState({ actual: null, previo: null })

  const hoyClave = fechaAISO(ahoraEcuador())
  const hoy = useMemo(() => ahoraEcuador(), [hoyClave]) // eslint-disable-line react-hooks/exhaustive-deps
  const rango = useMemo(() => rangoDePeriodo(periodo, personalizado, hoy), [periodo, personalizado, hoy])
  const previo = useMemo(() => rangoAnterior(periodo, rango, hoy), [periodo, rango, hoy])
  const etiquetaComp = etiquetaComparacion(previo, hoy)
  const finActual = rango.fin > hoyClave ? hoyClave : rango.fin
  const finPrevio = previo.fin > hoyClave ? hoyClave : previo.fin

  // ── Qué ópticas cuentan
  const negocio = useMemo(() => opticasDelNegocio(opticas, incluirPrueba), [opticas, incluirPrueba])
  const ids = useMemo(() => new Set(negocio.map((o) => o.id)), [negocio])
  const nPrueba = useMemo(() => idsDePrueba(opticas).size, [opticas])
  const nombreOptica = (id) => opticas.find((o) => o.id === id)?.nombre || "—"
  const facturas = useMemo(() => datos.facturas.filter((f) => ids.has(f.optica_id)), [datos.facturas, ids])
  const eventos = useMemo(() => datos.eventos.filter((e) => ids.has(e.optica_id)), [datos.eventos, ids])
  const consultasN = useMemo(() => consultas.filter((c) => ids.has(c.opticaId)), [consultas, ids])

  // ── Lo que se calcula
  const ing = useMemo(() => ({ act: ingresosDelPeriodo(facturas, rango), ant: ingresosDelPeriodo(facturas, previo), pc: porCobrarAl(facturas, finActual), pcAnt: porCobrarAl(facturas, finPrevio) }), [facturas, rango, previo, finActual, finPrevio])
  const serie = useMemo(() => serieIngresos(facturas, hoy), [facturas, hoy])
  const cli = useMemo(() => ({ act: clientesDelPeriodo(negocio, eventos, { ...rango, fin: finActual }), ant: clientesDelPeriodo(negocio, eventos, { ...previo, fin: finPrevio }) }), [negocio, eventos, rango, previo, finActual, finPrevio])
  const serieCli = useMemo(() => serieClientes(negocio, eventos, hoy), [negocio, eventos, hoy])
  const salud = useMemo(() => saludDeLaRed({ opticas: negocio, personas: datos.personas, uso: datos.uso, facturas, consultas: consultasN, hoyISO: hoyClave }), [negocio, datos.personas, datos.uso, facturas, consultasN, hoyClave])
  const conteoSalud = useMemo(() => contarSalud(salud), [salud])
  const uso = useMemo(() => usoDeLaRed(datos.uso, new Set(negocio.filter((o) => o.activa !== false).map((o) => o.id))), [datos.uso, negocio])
  const lead = useMemo(() => ({ act: embudoLeads(leads, rango), ant: embudoLeads(leads, previo) }), [leads, rango, previo])
  const sop = useMemo(() => {
    const todas = indicadoresSoporte(consultasN)
    const pedir = (r) => indicadoresSoporte(consultasN, { desde: instanteInicio(r.inicio), hasta: instanteFin(r.fin) })
    return {
      todas,
      abiertasAhora: consultasN.filter(esAbierta),
      urgentesAhora: consultasN.filter((c) => esAbierta(c) && c.urgencia === "urgente"),
      abiertasAntes: consultasAbiertasAl(consultasN, finPrevio),
      act: pedir({ ...rango, fin: finActual }), ant: pedir({ ...previo, fin: finPrevio }),
    }
  }, [consultasN, rango, previo, finActual, finPrevio])

  // Las visitas a la página de venta no se descargan: se cuentan en el servidor, una vez por período.
  useEffect(() => {
    let vigente = true
    const contar = async (r) => {
      const { count, error } = await supabase.from("visitas").select("id", { count: "exact", head: true }).eq("tipo", "venta").gte("created_at", instanteInicio(r.inicio)).lte("created_at", instanteFin(r.fin))
      return error ? null : count ?? 0
    }
    Promise.all([contar(rango), contar(previo)]).then(([actual, anterior]) => { if (vigente) setVisitas({ actual, previo: anterior }) })
    return () => { vigente = false }
  }, [rango, previo])

  // ── Exportar y abrir
  const filtrosTexto = [`Período: ${tituloSemana(rango.inicio, rango.fin)}`, incluirPrueba ? "con ópticas de prueba" : "sin ópticas de prueba"].join(" · ")
  const exportarLista = async ({ titulo, valor, columnas, filas }) => {
    if (filas.length === 0) { onAviso?.(`No hay datos para «${titulo}» con estos filtros: no se descargó nada.`); return }
    try {
      await descargarModelo(modeloDeLista({ titulo, valor, columnas, filas, rango, personal: false }), { usuario: null, opticaNombre: "Panel del superadmin", usuarioNombre: usuario?.nombre, rango, filtrosTexto })
      onAviso?.(`Se descargó «${titulo}» (${filas.length} filas).`)
    } catch { onAviso?.(`No se pudo descargar «${titulo}». Vuelve a intentarlo.`) }
  }
  const bloque = (titulo, datosBloque, detalleBloque) => [
    { id: "datos", etiqueta: "Datos de la gráfica", descripcion: "Lo que se ve en el bloque, resumido.", ejecutar: () => exportarLista({ titulo: `${titulo} · datos`, ...datosBloque() }) },
    { id: "detalle", etiqueta: "Detalle completo", descripcion: "Todos los registros que lo componen.", ejecutar: () => exportarLista({ titulo: `${titulo} · detalle`, ...detalleBloque() }) },
  ]
  const abrir = (spec) => setDetalle({
    filtros: filtrosTexto, ...spec,
    exportar: () => exportarLista({ titulo: spec.titulo, valor: spec.valor, columnas: spec.columnas, filas: spec.filas }),
    abrirEn: spec.abrirEn ? { etiqueta: spec.abrirEn.etiqueta, ir: () => onAbrir(spec.abrirEn.modulo, spec.abrirEn.params) } : null,
  })
  const tarjeta = (props, a, b, opciones) => <TarjetaReporte key={props.titulo} {...props} variacion={a === undefined ? undefined : variacion(a, b, opciones)} comparacion={a === undefined ? undefined : (props.comparacion ?? etiquetaComp)} />

  // ── Columnas de las listas
  const colsFactura = [
    columna("Factura", (f) => f.numero, 128),
    columna("Óptica", (f) => nombreOptica(f.optica_id)),
    { titulo: "Período", ancho: 110, valor: (f) => formatoFecha(`${f.periodo}-01`, "mesAnioCorto") },
    { titulo: "Monto", ancho: 110, derecha: true, valor: (f) => dinero(f.monto), tipo: "dinero", crudo: (f) => Number(f.monto) || 0 },
    columna("Estado", (f) => (f.estado === "pagada" ? "Pagada" : "Por cobrar"), 100),
  ]
  const colsOptica = [
    columna("Óptica", (o) => o.nombre),
    fecha("Creada", (o) => o.created_at),
    columna("Pago", (o) => PAGO[o.estado_pago] || "Al día", 100),
    columna("Estado", (o) => (o.activa === false ? "Suspendida" : "Activa"), 116),
  ]
  const colsSalud = [
    columna("Óptica", (f) => f.optica.nombre),
    columna("Salud", (f) => SALUD[f.salud.estado].nombre, 104),
    columna("Motivo", (f) => (f.salud.motivos.map((m) => m.texto).join(" · ") || "Todo en orden"), 330),
    { titulo: "Último ingreso", ancho: 124, valor: (f) => (f.salud.ultimoIngreso ? fechaLegible(f.salud.ultimoIngreso) : "Nunca"), tipo: "fecha", crudo: (f) => f.salud.ultimoIngreso || "" },
  ]
  const colsConsulta = [
    columna("Número", (c) => codigoConsulta(c.numero), 96),
    columna("Óptica", (c) => nombreOptica(c.opticaId)),
    columna("Asunto", (c) => c.asunto, 250),
    columna("Urgencia", (c) => (c.urgencia === "urgente" ? "Urgente" : "Normal"), 92),
  ]
  const colsLead = [
    columna("Óptica interesada", (l) => l.nombre_optica),
    columna("Contacto", (l) => l.nombre_admin, 170),
    columna("Estado", (l) => ESTADOS_LEAD[l.estado]?.nombre || l.estado, 108),
    fecha("Recibido", (l) => l.created_at, 118),
  ]
  const colsUsoPorOptica = (clave, titulo) => [
    columna("Óptica", (u) => nombreOptica(u.optica_id)),
    { titulo, ancho: 150, derecha: true, valor: (u) => clave(u), tipo: "entero", crudo: (u) => clave(u) },
  ]

  const sinNada = !datos.cargando && opticas.length === 0
  const etiquetas = [
    { id: "periodo", texto: `Período: ${tituloSemana(rango.inicio, rango.fin)}` },
    incluirPrueba && { id: "prueba", texto: "Con ópticas de prueba", quitar: () => onIncluirPrueba(false) },
  ].filter(Boolean)

  if (datos.cargando && opticas.length === 0) {
    return <div className="space-y-4" aria-busy="true" aria-label="Cargando el resumen">{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-200/70" />)}</div>
  }

  // Ingresos: lo que vale cada punto de la gráfica
  const datosSerie = serie.map((m) => ({ clave: m.clave, etiqueta: m.etiqueta, valor: m.cobrado, texto: m.cobrado ? dinero(m.cobrado).replace(/\.00$/, "") : "0", tip: `${m.etiqueta}: cobrado ${dinero(m.cobrado)} · facturado ${dinero(m.facturado)}`, mes: m }))
  const datosSerieCli = serieCli.map((m) => ({ clave: m.clave, etiqueta: m.etiqueta, valor: m.activas.length, tip: `${m.etiqueta}: ${plural(m.activas.length, "óptica activa", "ópticas activas")} al cierre`, mes: m }))
  const verPorCobrar = (vencidas) => {
    const lista = vencidas ? ing.pc.vencidas : ing.pc.pendientes
    abrir({ titulo: vencidas ? `Facturas vencidas: ${plural(lista.length, "factura", "facturas")}` : `Facturas pendientes: ${plural(lista.length, "factura", "facturas")}`, valor: dinero(vencidas ? ing.pc.montoVencido : ing.pc.monto), icono: Wallet, columnas: colsFactura, filas: lista, abrirEn: { modulo: "opticas", etiqueta: "Abrir Ópticas (lista completa)", params: {} } })
  }
  const mensajeFin = rango.fin < hoyClave ? " (a hoy)" : ""
  const abrirOpticas = (estado) => ({ modulo: "opticas", etiqueta: `Abrir en Ópticas${mensajeFin}`, params: { estado, ...(incluirPrueba ? { incluirPrueba: true } : {}) } })
  const salirHaciaSoporte = (params, etiqueta = "Abrir en Soporte") => ({ modulo: "soporte", etiqueta, params: { ...params, ...(incluirPrueba ? { incluirPrueba: true } : {}) } })
  const rangoLeads = { desde: rango.inicio, hasta: rango.fin }

  const secIngresos = (
        <Seccion titulo="Ingresos" ayuda="Lo que la suscripción de las ópticas le deja al negocio. Facturado = facturas emitidas en el período. Cobrado = facturas pagadas en el período. Pendientes y vencidas se miran al cierre del período; una factura por cobrar pasa a vencida a los 30 días de emitida.">
          <div className={REJILLA_TARJETAS_4}>
            {tarjeta({ titulo: "Facturado", valor: dinero(ing.act.facturado), ayuda: "Suma de las facturas de suscripción emitidas en el período.", onClick: () => abrir({ titulo: `Facturado: ${plural(ing.act.facturadas.length, "factura", "facturas")}`, valor: dinero(ing.act.facturado), icono: DollarSign, columnas: colsFactura, filas: ing.act.facturadas, abrirEn: { modulo: "opticas", etiqueta: "Abrir Ópticas (lista completa)", params: {} } }) }, ing.act.facturado, ing.ant.facturado, DINERO)}
            {tarjeta({ titulo: "Cobrado", valor: dinero(ing.act.cobrado), ayuda: "Suma de las facturas que se marcaron como pagadas dentro del período.", onClick: () => abrir({ titulo: `Cobrado: ${plural(ing.act.cobradas.length, "factura pagada", "facturas pagadas")}`, valor: dinero(ing.act.cobrado), icono: Wallet, columnas: colsFactura, filas: ing.act.cobradas, abrirEn: { modulo: "opticas", etiqueta: "Abrir Ópticas (lista completa)", params: {} } }) }, ing.act.cobrado, ing.ant.cobrado, DINERO)}
            {tarjeta({ titulo: "Facturas pendientes", valor: dinero(ing.pc.monto), aHoy: rango.fin >= hoyClave, ayuda: "Facturas emitidas que todavía no se han pagado al cierre del período, vencidas incluidas.", onClick: () => verPorCobrar(false) }, ing.pc.monto, ing.pcAnt.monto, { ...DINERO, buenoSiSube: false })}
            {tarjeta({ titulo: "Facturas vencidas", valor: dinero(ing.pc.montoVencido), aHoy: rango.fin >= hoyClave, ayuda: "Facturas por cobrar con más de 30 días desde que se emitieron.", onClick: () => verPorCobrar(true) }, ing.pc.montoVencido, ing.pcAnt.montoVencido, { ...DINERO, buenoSiSube: false })}
          </div>
          <Caja titulo="Cobrado por mes · últimos 12 meses" ayuda="Lo cobrado en cada mes. Al pasar el cursor se ve también lo facturado. Pulsa un mes para ver sus facturas." exportar={bloque("Ingresos por mes",
            () => ({ columnas: [col("Mes", (m) => m.etiqueta), col("Facturado", (m) => m.facturado, "dinero"), col("Cobrado", (m) => m.cobrado, "dinero")], filas: serie }),
            () => ({ columnas: colsFactura, filas: facturas }))}>
            {facturas.length === 0 ? (
              <SinResultados texto="Todavía no hay facturas de suscripción. Se generan desde el detalle de cada óptica." acciones={[{ etiqueta: "Ir a Ópticas", onClick: () => onAbrir("opticas", {}) }]} />
            ) : (
              <BarrasMes datos={datosSerie} onElegir={(d) => abrir({ titulo: `${d.etiqueta}: facturado ${dinero(d.mes.facturado)} · cobrado ${dinero(d.mes.cobrado)}`, valor: dinero(d.mes.facturado), icono: DollarSign, columnas: colsFactura, filas: d.mes.facturadas, abrirEn: { modulo: "opticas", etiqueta: "Abrir Ópticas (lista completa)", params: {} } })} />
            )}
          </Caja>
        </Seccion>
  )

  const secClientes = (
        <Seccion titulo="Clientes" ayuda="Las ópticas que pagan el sistema. Activas y suspendidas se miran al cierre del período. Nuevas = creadas en el período. Dadas de baja = suspendidas durante el período y que siguen suspendidas al cierre.">
          <div className={REJILLA_TARJETAS_4}>
            {tarjeta({ titulo: "Ópticas activas", valor: cli.act.activas.length, ayuda: "Ópticas que podían usar el sistema al cierre del período.", onClick: () => abrir({ titulo: `Ópticas activas: ${cli.act.activas.length}`, valor: cli.act.activas.length, icono: Building2, columnas: colsOptica, filas: cli.act.activas, abrirEn: abrirOpticas("Activas") }) }, cli.act.activas.length, cli.ant.activas.length)}
            {tarjeta({ titulo: "Nuevas", valor: cli.act.nuevas.length, ayuda: "Ópticas creadas dentro del período.", onClick: () => abrir({ titulo: `Ópticas nuevas: ${cli.act.nuevas.length}`, valor: cli.act.nuevas.length, icono: Building2, columnas: colsOptica, filas: cli.act.nuevas, abrirEn: { modulo: "opticas", etiqueta: "Abrir en Ópticas", params: { estado: "Todas", desde: rango.inicio, hasta: finActual, ...(incluirPrueba ? { incluirPrueba: true } : {}) } } }) }, cli.act.nuevas.length, cli.ant.nuevas.length)}
            {tarjeta({ titulo: "Suspendidas", valor: cli.act.suspendidas.length, ayuda: "Ópticas suspendidas al cierre del período.", onClick: () => abrir({ titulo: `Ópticas suspendidas: ${cli.act.suspendidas.length}`, valor: cli.act.suspendidas.length, icono: Building2, columnas: colsOptica, filas: cli.act.suspendidas, abrirEn: abrirOpticas("Suspendidas") }) }, cli.act.suspendidas.length, cli.ant.suspendidas.length, { buenoSiSube: false })}
            {tarjeta({ titulo: "Dadas de baja", valor: cli.act.bajas.length, ayuda: "Ópticas que se suspendieron durante el período y siguen suspendidas al cierre.", onClick: () => abrir({ titulo: `Ópticas dadas de baja: ${cli.act.bajas.length}`, valor: cli.act.bajas.length, icono: Building2, columnas: colsOptica, filas: cli.act.bajas, abrirEn: abrirOpticas("Suspendidas") }) }, cli.act.bajas.length, cli.ant.bajas.length, { buenoSiSube: false })}
          </div>
          <Caja titulo="Ópticas activas por mes · últimos 12 meses" ayuda="Ópticas activas al cierre de cada mes. Pulsa un mes para ver cuáles eran." exportar={bloque("Ópticas activas por mes",
            () => ({ columnas: [col("Mes", (m) => m.etiqueta), col("Ópticas activas", (m) => m.activas.length, "entero")], filas: serieCli }),
            () => ({ columnas: colsOptica, filas: negocio }))}>
            {negocio.length === 0 ? <SinResultados texto="Todavía no hay ópticas que contar." acciones={onCrearOptica ? [{ etiqueta: "Crear una óptica", onClick: onCrearOptica }] : []} /> : (
              <BarrasMes datos={datosSerieCli} onElegir={(d) => abrir({ titulo: `Ópticas activas al cierre de ${d.etiqueta}: ${d.mes.activas.length}`, valor: d.mes.activas.length, icono: Building2, columnas: colsOptica, filas: d.mes.activas, abrirEn: abrirOpticas("Todas") })} />
            )}
          </Caja>
        </Seccion>
  )

  const secSalud = (
        <Seccion titulo="Ópticas que necesitan atención" aHoy ayuda={AYUDA_SALUD}>
          <Caja titulo={`${plural(salud.length, "óptica activa", "ópticas activas")}`} exportar={bloque("Salud de las ópticas",
            () => ({ columnas: [col("Salud", (x) => x.nombre), col("Ópticas", (x) => x.n, "entero")], filas: ["riesgo", "atencion", "saludable"].map((k) => ({ nombre: SALUD[k].nombre, n: conteoSalud[k] })) }),
            () => ({ columnas: colsSalud, filas: salud }))}
            derecha={<span className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-600">{["riesgo", "atencion", "saludable"].map((k) => <span key={k} className={"rounded-full border px-2 py-0.5 " + SALUD[k].clase}>{conteoSalud[k]} {SALUD[k].nombre.toLowerCase()}</span>)}</span>}>
            {salud.length === 0 ? (
              <SinResultados texto="No hay ópticas activas que revisar." acciones={onCrearOptica ? [{ etiqueta: "Crear una óptica", onClick: onCrearOptica }] : []} />
            ) : (
              <>
                {datos.sinServidor && <p role="status" className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">Todavía no se puede leer el último ingreso ni el uso de las ópticas: la salud se calcula solo con el pago y el soporte.</p>}
                <table className="w-full table-fixed text-sm" aria-label="Salud de las ópticas">
                  <colgroup><col /><col style={{ width: 112 }} /><col /><col style={{ width: 124 }} /></colgroup>
                  <thead><tr className="text-xs font-bold uppercase tracking-wider text-slate-500">{["Óptica", "Salud", "Motivo", "Último ingreso"].map((t) => <th key={t} scope="col" className="truncate py-2 pr-2 text-left">{t}</th>)}</tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {salud.slice(0, FILAS_SALUD).map((f) => (
                      <tr key={f.optica.id} className="hover:bg-slate-50/60">
                        <td className="truncate py-1.5 pr-2"><button type="button" data-lista onClick={() => setOpticaAbierta(f.optica.id)} aria-label={`${f.optica.nombre}: ${SALUD[f.salud.estado].nombre}. Ver el detalle`} className="block max-w-full truncate rounded-md px-1.5 py-0.5 text-left font-semibold transition-colors hover:bg-blue-50 hover:text-blue-700 cursor-pointer" style={{ color: INK }}>{f.optica.nombre}</button></td>
                        <td className="py-1.5 pr-2"><InsigniaSalud estado={f.salud.estado} /></td>
                        <td className="truncate py-1.5 pr-2 text-slate-600" title={f.salud.motivos.map((m) => m.texto).join(" · ")}>{f.salud.motivos.map((m) => m.texto).join(" · ") || "Todo en orden"}</td>
                        <td className="truncate py-1.5 pr-2 text-slate-600">{f.salud.ultimoIngreso ? fechaLegible(f.salud.ultimoIngreso) : "Nunca"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {salud.length > FILAS_SALUD && (
                  <button type="button" onClick={() => abrir({ titulo: `Salud de las ópticas: ${salud.length}`, valor: salud.length, icono: Building2, columnas: colsSalud, filas: salud })} className="mt-2 rounded-lg px-2 py-1 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 cursor-pointer">Ver las {salud.length} ópticas</button>
                )}
              </>
            )}
          </Caja>
        </Seccion>
  )

  const secUso = (
        <Seccion titulo="Uso del sistema" ayuda="Lo que hizo el personal de las ópticas activas en los últimos 30 días, sin importar el período elegido arriba. Se compara con los 30 días anteriores. Personas activas = quienes anotaron al menos una acción. Los módulos se cuentan por las acciones que el personal anotó en la actividad de cada óptica.">
          {datos.sinServidor ? (
            <SinResultados texto="Todavía no se puede leer el uso de las ópticas. Vuelve a intentarlo en un momento." acciones={[{ etiqueta: "Reintentar", onClick: datos.recargar }]} />
          ) : (
            <>
              <div className={REJILLA_TARJETAS_4}>
                {[
                  { titulo: "Personas activas", valor: uso.personas, previo: uso.personasPrevio, clave: (u) => u.personas_activas, icono: Users, nombre: "Personas activas", unidad: "Personas" },
                  { titulo: "Citas registradas", valor: uso.citas, previo: uso.citasPrevio, clave: (u) => u.citas, icono: Inbox, nombre: "Citas registradas", unidad: "Citas" },
                  { titulo: "Consultas", valor: uso.consultas, previo: uso.consultasPrevio, clave: (u) => u.consultas, icono: Headset, nombre: "Consultas", unidad: "Consultas" },
                  { titulo: "Ventas", valor: uso.ventas, previo: uso.ventasPrevio, clave: (u) => u.ventas, icono: DollarSign, nombre: "Ventas", unidad: "Ventas" },
                ].map((t) => tarjeta({ titulo: t.titulo, valor: t.valor, comparacion: "vs. los 30 días anteriores", ayuda: `${t.nombre} de las ópticas activas en los últimos 30 días.`, onClick: () => abrir({ titulo: `${t.titulo} en 30 días: ${t.valor}`, valor: t.valor, icono: t.icono, columnas: colsUsoPorOptica(t.clave, t.unidad), filas: uso.filas.filter((u) => t.clave(u) > 0), abrirEn: { modulo: "opticas", etiqueta: "Abrir Ópticas (lista completa)", params: {} } }) }, t.valor, t.previo))}
              </div>
              <Caja titulo="Qué módulos usa cada óptica · últimos 30 días" ayuda="Cada número son las acciones que el personal anotó en ese módulo. Un guion es que no usó el módulo. Pulsa una óptica para ver su detalle." exportar={bloque("Uso por módulo",
                () => ({ columnas: [col("Módulo", (m) => m.nombre), col("Acciones", (m) => m.acciones, "entero"), col("Ópticas que lo usan", (m) => m.opticas.length, "entero")], filas: uso.porModulo }),
                () => ({ columnas: [col("Óptica", (u) => nombreOptica(u.optica_id)), ...MODULOS_USO.map((m) => col(m.nombre, (u) => u.modulos?.[m.id] || 0, "entero"))], filas: uso.filas }))}>
                {uso.filas.length === 0 ? <SinResultados texto="Todavía no hay ópticas activas que mostrar." /> : (
                  <table className="w-full table-fixed text-sm" aria-label="Módulos que usa cada óptica">
                    <colgroup><col />{MODULOS_USO.map((m) => <col key={m.id} style={{ width: 96 }} />)}</colgroup>
                    <thead><tr className="text-xs font-bold uppercase tracking-wider text-slate-500"><th scope="col" className="py-2 pr-2 text-left">Óptica</th>{MODULOS_USO.map((m) => <th key={m.id} scope="col" className="px-1 py-2 text-right" title={m.nombre}><span className="block truncate">{m.corto || m.nombre}</span></th>)}</tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {uso.filas.map((u) => {
                        const fila = salud.find((s) => s.optica.id === u.optica_id)
                        return (
                          <tr key={u.optica_id} className="hover:bg-slate-50/60">
                            <td className="truncate py-1.5 pr-2">{fila && saas ? <button type="button" data-lista onClick={() => setOpticaAbierta(u.optica_id)} aria-label={`${nombreOptica(u.optica_id)}: ver el detalle`} className="block max-w-full truncate rounded-md px-1.5 py-0.5 text-left font-semibold transition-colors hover:bg-blue-50 hover:text-blue-700 cursor-pointer" style={{ color: INK }}>{nombreOptica(u.optica_id)}</button> : nombreOptica(u.optica_id)}</td>
                            {MODULOS_USO.map((m) => <td key={m.id} className="px-1 py-1.5 text-right tabular-nums">{u.modulos?.[m.id] ? <span className="font-semibold" style={{ color: INK }}>{u.modulos[m.id]}</span> : <span className="text-slate-400">—</span>}</td>)}
                          </tr>
                        )
                      })}
                      <tr className="font-bold">
                        <th scope="row" className="py-1.5 pr-2 text-left text-xs uppercase tracking-wider text-slate-500">Total</th>
                        {uso.porModulo.map((m) => (
                          <td key={m.id} className="px-1 py-1.5 text-right tabular-nums">{m.acciones ? <button type="button" data-lista onClick={() => abrir({ titulo: `${m.nombre}: ${m.acciones} acciones en 30 días`, valor: m.acciones, icono: Building2, columnas: colsUsoPorOptica((u) => Number(u.modulos?.[m.id]) || 0, "Acciones"), filas: m.opticas, abrirEn: { modulo: "opticas", etiqueta: "Abrir Ópticas (lista completa)", params: {} } })} aria-label={`${m.nombre}: ${m.acciones} acciones. Ver las ópticas`} className="rounded-md px-1.5 py-0.5 font-bold transition-colors hover:bg-blue-50 hover:text-blue-700 cursor-pointer" style={{ color: INK }}>{m.acciones}</button> : <span className="text-slate-400">—</span>}</td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                )}
              </Caja>
            </>
          )}
        </Seccion>
  )

  const secSoporte = (
        <Seccion titulo="Soporte" ayuda="Los mismos números que la bandeja de Soporte. Abiertas y urgentes son las de hoy, comparadas con el cierre del período anterior; el tiempo de primera respuesta (mediana) y la satisfacción son de las consultas del período.">
          {cargandoSoporte ? <div className="h-24 animate-pulse rounded-2xl bg-slate-200/70" /> : (
            <div className={REJILLA_TARJETAS_4}>
              {tarjeta({ titulo: "Consultas abiertas", valor: sop.abiertasAhora.length, aHoy: true, ayuda: "Consultas de soporte que todavía no están resueltas.", onClick: () => abrir({ titulo: `Consultas abiertas: ${sop.abiertasAhora.length}`, valor: sop.abiertasAhora.length, icono: LifeBuoy, columnas: colsConsulta, filas: sop.abiertasAhora, abrirEn: salirHaciaSoporte({ tab: "consultas", estado: "abiertas" }) }) }, sop.abiertasAhora.length, sop.abiertasAntes.length, { buenoSiSube: false, baseMinima: 5 })}
              {tarjeta({ titulo: "Urgentes abiertas", valor: sop.urgentesAhora.length, aHoy: true, ayuda: "Consultas abiertas que la óptica marcó como urgentes.", onClick: () => abrir({ titulo: `Consultas urgentes abiertas: ${sop.urgentesAhora.length}`, valor: sop.urgentesAhora.length, icono: CircleAlert, columnas: colsConsulta, filas: sop.urgentesAhora, abrirEn: salirHaciaSoporte({ tab: "consultas", estado: "abiertas", urgencia: "urgente" }) }) }, sop.urgentesAhora.length, sop.abiertasAntes.filter((c) => c.urgencia === "urgente").length, { buenoSiSube: false, baseMinima: 5 })}
              {tarjeta({ titulo: "Primera respuesta", valor: duracionLegible(sop.act.primeraRespuestaMin), sub: sop.act.primeraRespuestaMin === null ? "Sin respuestas en el período" : undefined, ayuda: "Mediana del tiempo que pasa desde que la óptica escribe hasta la primera respuesta, en las consultas del período.", onClick: () => abrir({ titulo: `Primera respuesta: ${duracionLegible(sop.act.primeraRespuestaMin)}`, valor: duracionLegible(sop.act.primeraRespuestaMin), icono: Headset, columnas: colsConsulta, filas: consultasN.filter((c) => c.primeraRespuestaEn && diaDe(c.creadaEn) >= rango.inicio && diaDe(c.creadaEn) <= finActual), abrirEn: salirHaciaSoporte({ tab: "indicadores", rango: { inicio: rango.inicio, fin: finActual } }, "Abrir Indicadores de Soporte (este período)") }) }, sop.act.primeraRespuestaMin ?? undefined, sop.ant.primeraRespuestaMin, { buenoSiSube: false, baseMinima: 0, formato: duracionLegible })}
              {tarjeta({ titulo: "Satisfacción", valor: sop.act.satisfaccion === null ? "—" : `${sop.act.satisfaccion} de 5`, sub: sop.act.satisfaccion === null ? "Nadie calificó en el período" : undefined, ayuda: "Promedio de las calificaciones de 1 a 5 de las consultas del período.", onClick: () => abrir({ titulo: `Satisfacción: ${sop.act.satisfaccion === null ? "sin calificaciones" : `${sop.act.satisfaccion} de 5`}`, valor: sop.act.satisfaccion === null ? "—" : sop.act.satisfaccion, icono: Handshake, columnas: [...colsConsulta.slice(0, 3), columna("Nota", (c) => c.calificacion, 70, { derecha: true })], filas: consultasN.filter((c) => c.calificacion && diaDe(c.creadaEn) >= rango.inicio && diaDe(c.creadaEn) <= finActual), abrirEn: salirHaciaSoporte({ tab: "indicadores", rango: { inicio: rango.inicio, fin: finActual } }, "Abrir Indicadores de Soporte (este período)") }) }, sop.act.satisfaccion ?? undefined, sop.ant.satisfaccion, { puntos: true })}
            </div>
          )}
        </Seccion>
  )

  const secLeads = (
        <Seccion titulo="Leads" ayuda="Los interesados que escribieron desde la página de venta. Los mismos números que la sección Leads: cada interesado está en un solo estado.">
          <div className={REJILLA_TARJETAS_4}>
            {tarjeta({ titulo: "Visitas a la página de venta", valor: visitas.actual ?? "—", ayuda: "Personas que abrieron la página de venta en el período." }, visitas.actual ?? undefined, visitas.previo)}
            {tarjeta({ titulo: "Interesados", valor: lead.act.recibidos.length, ayuda: "Solicitudes recibidas desde la página de venta en el período.", onClick: () => abrir({ titulo: `Interesados: ${lead.act.recibidos.length}`, valor: lead.act.recibidos.length, icono: Inbox, columnas: colsLead, filas: lead.act.recibidos, abrirEn: { modulo: "leads", etiqueta: "Abrir en Leads", params: { ...rangoLeads } } }) }, lead.act.recibidos.length, lead.ant.recibidos.length)}
            {tarjeta({ titulo: "Convertidos a cliente", valor: lead.act.convertidos.length, ayuda: "Interesados del período a los que ya se les creó su óptica.", onClick: () => abrir({ titulo: `Convertidos: ${lead.act.convertidos.length}`, valor: lead.act.convertidos.length, icono: Handshake, columnas: colsLead, filas: lead.act.convertidos, abrirEn: { modulo: "leads", etiqueta: "Abrir en Leads", params: { ...rangoLeads, estado: "convertido" } } }) }, lead.act.convertidos.length, lead.ant.convertidos.length)}
            {tarjeta({ titulo: "De cada 100, convierten", valor: lead.act.tasa === null ? "—" : `${lead.act.tasa}%`, sub: lead.act.tasa === null ? "Sin interesados en el período" : undefined, ayuda: "Convertidos entre interesados del período.", onClick: () => abrir({ titulo: `Convertidos ÷ interesados: ${lead.act.convertidos.length} ÷ ${lead.act.recibidos.length}`, valor: lead.act.tasa === null ? "—" : `${lead.act.tasa}%`, icono: Inbox, columnas: colsLead, filas: lead.act.recibidos, abrirEn: { modulo: "leads", etiqueta: "Abrir en Leads", params: { ...rangoLeads } } }) }, lead.act.tasa ?? undefined, lead.ant.tasa, { puntos: true })}
          </div>
          <Caja titulo="Qué pasó con los interesados" ayuda="Cada interesado del período está en un solo estado; las partes suman los interesados." exportar={bloque("Embudo de leads",
            () => ({ columnas: [col("Estado", (x) => x.nombre), col("Interesados", (x) => x.n, "entero")], filas: ESTADOS_LEAD_LISTA.map((e) => ({ nombre: e.nombre, n: lead.act.recibidos.filter((l) => l.estado === e.id).length })) }),
            () => ({ columnas: colsLead, filas: lead.act.recibidos }))}>
            {lead.act.recibidos.length === 0 ? (
              <SinResultados texto="Nadie escribió desde la página de venta en este período. Prueba con otro período." acciones={[{ etiqueta: "Ver este año", onClick: () => setPeriodo("anio") }]} />
            ) : (
              <BarraRepartida
                segmentos={ESTADOS_LEAD_LISTA.map((e) => ({ id: e.id, etiqueta: e.nombre, valor: lead.act.recibidos.filter((l) => l.estado === e.id).length, color: e.color, tip: `${e.nombre}: ${lead.act.recibidos.filter((l) => l.estado === e.id).length}` }))}
                onElegir={(s) => abrir({ titulo: `Interesados ${s.etiqueta.toLowerCase()}s: ${s.valor}`, valor: s.valor, icono: Inbox, columnas: colsLead, filas: lead.act.recibidos.filter((l) => l.estado === s.id), abrirEn: { modulo: "leads", etiqueta: "Abrir en Leads", params: { ...rangoLeads, estado: s.id } } })}
              />
            )}
          </Caja>
        </Seccion>
  )

  const secEstado = (
        <Seccion titulo="Estado del sistema" aHoy ayuda="Se mide con la última carga de datos de este panel: menos de 1,2 segundos es normal, hasta 3,5 es lento y más es crítico.">
          <div className={REJILLA_TARJETAS_4}>
            {tarjeta({ titulo: "Base de datos", valor: ESTADO_SERVIDOR[estadoServidor.estado] || "Sin conexión", sub: estadoServidor.estado === "operativo" ? "Responde con normalidad" : estadoServidor.estado === "verificando" ? "Comprobando…" : "Revisa la conexión", ayuda: "Si la base de datos responde con normalidad." })}
            {tarjeta({ titulo: "Tiempo de respuesta", valor: estadoServidor.latenciaMs != null ? `${new Intl.NumberFormat("en-US").format(estadoServidor.latenciaMs)} ms` : "—", sub: "Última carga de datos", ayuda: "Lo que tardó la última carga de datos de este panel." })}
          </div>
        </Seccion>
  )

  const recientes = sinPruebas(actividad, opticas, incluirPrueba).filter((a) => tiposVisibles(false).some((t) => t.acciones?.includes(a.accion))).slice(0, 8)
  const secActividad = (
        <Seccion titulo="Actividad reciente" ayuda="Lo último que hicieron los superadmins en el sistema. Es un registro: no se borra ni se edita.">
          <Caja titulo="Últimas acciones" derecha={<button type="button" onClick={() => onAbrir("actividad", {})} className="rounded-lg px-2 py-1 text-sm font-semibold text-blue-700 transition-colors hover:bg-blue-50 cursor-pointer">Ver toda la actividad</button>}>
            {recientes.length === 0 ? (
              <SinResultados texto="Todavía no hay acciones registradas." />
            ) : (
              <ul role="list" className="divide-y divide-slate-100">
                {recientes.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-2 text-sm text-slate-700">
                    <span className="min-w-0 flex-1 truncate"><span className="font-semibold" style={{ color: INK }}>{a.actor_nombre}</span> {frasesDeAccion(a, saas).map((x) => x.t).join("")}</span>
                    <span className="shrink-0 text-xs tabular-nums text-slate-500">{fechaHoraLegible(a.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Caja>
        </Seccion>
  )

  return (
    <div className="space-y-3" data-resumen-negocio>
      <CabeceraSeccion titulo="Resumen" pregunta={saas ? "¿Cómo va el negocio y qué óptica necesita atención?" : "¿Funciona bien el sistema y lo están usando?"}>
        {<button type="button" onClick={onCrearOptica} className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer" style={{ background: GRAD_MARCA }}><Plus size={15} aria-hidden="true" /> Crear óptica</button>}
      </CabeceraSeccion>

      {sinNada && <SinDatosAun titulo="Todavía no hay ópticas" texto="El resumen se llena con las ópticas que se creen y con lo que hagan en el sistema." accion={onCrearOptica ? { etiqueta: "Crear la primera óptica", onClick: onCrearOptica } : null} />}

      <div className="space-y-2 rounded-2xl border border-slate-200/60 bg-white px-3 py-2.5 shadow-sm" role="group" aria-label="Filtros">
        <div className="flex flex-wrap items-center gap-2">
          <SelectorPeriodo periodo={periodo} onPeriodo={setPeriodo} personalizado={personalizado} onPersonalizado={setPersonalizado} rango={rango} prefijo="sa" />
          <InterruptorPrueba activo={incluirPrueba} onCambiar={onIncluirPrueba} cuantas={nPrueba} />
          <EtiquetasFiltros etiquetas={etiquetas} />
        </div>
      </div>

      <div className="space-y-4 pb-6">
        {saas ? <>{secIngresos}{secClientes}{secSalud}{secUso}{secSoporte}{secLeads}{secEstado}</> : <>{secEstado}{secUso}{secSoporte}{secActividad}</>}
      </div>

      {detalle && <VentanaDetalle d={detalle} onCerrar={() => setDetalle(null)} />}
      {opticaAbierta && (() => {
        const fila = salud.find((s) => s.optica.id === opticaAbierta)
        if (!fila) return null
        return (
          <DetalleOptica
            fila={fila} uso={datos.uso.find((u) => u.optica_id === opticaAbierta) || null} facturas={facturas}
            consultasAbiertas={consultasN.filter((c) => c.opticaId === opticaAbierta && esAbierta(c))} hoyISO={hoyClave}
            onCerrar={() => setOpticaAbierta(null)} onEntrarComo={onEntrarComo}
            onAbrirEnOpticas={() => onAbrir("opticas", { abrir: opticaAbierta, estado: "Todas", ...(incluirPrueba ? { incluirPrueba: true } : {}) })}
          />
        )
      })()}
    </div>
  )
}

const ESTADO_SERVIDOR = { operativo: "Operativo", lento: "Lento", critico: "Crítico", verificando: "Verificando…", sin_conexion: "Sin conexión" }
// Un estado de lead = un nombre y un color en todo el panel (los mismos de la sección Leads).
export const ESTADOS_LEAD_LISTA = [
  { id: "nuevo", nombre: "Nuevo", color: "#2563eb" },
  { id: "contactado", nombre: "Contactado", color: "#d97706" },
  { id: "convertido", nombre: "Convertido", color: "#059669" },
  { id: "descartado", nombre: "Descartado", color: "#94a3b8" },
]
const ESTADOS_LEAD = Object.fromEntries(ESTADOS_LEAD_LISTA.map((e) => [e.id, e]))
