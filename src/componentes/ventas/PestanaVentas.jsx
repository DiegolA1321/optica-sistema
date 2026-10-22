"use client"

import { useMemo, useState } from "react"
import { Receipt, ShoppingCart } from "lucide-react"
import { INK, GRAD_MARCA } from "@/lib/tema"
import { Insignia, Vacio } from "./Lista"
import { BotonFiltrar, CampoBusqueda, FiltroActivo, FranjaDatos, SelectorPeriodo, TablaLista } from "./Piezas"
import { CLASE_ACCION_PRINCIPAL, CLASE_ACCION_SECUNDARIA, plural } from "./estilos"
import { dinero } from "../../utilidades/formatoMoneda"
import { formatoFecha } from "../../utilidades/formatoFecha"
import { numeroComprobante } from "../../utilidades/comprobantes"
import { filtrarComprobantes } from "../../utilidades/saldosVentas"
import { hoyISO } from "../../utilidades/disponibilidad"
import { PERIODO_INICIAL, diaDeRegistro, rangoDelPeriodo } from "../../utilidades/periodoLista"
import { METODOS_COBRO, SIN_INDICAR } from "../../utilidades/pagos"
import { PERIODO_DE_VENTAS, detalleDeVenta, estadoPagoDeVenta, pagadoDeVenta, resumenDeVentas, ventaDelDato } from "../../utilidades/ventasLista"

const POR_PAGINA = 30
const COLUMNAS = "lg:grid-cols-[4.5rem_minmax(8rem,1.1fr)_minmax(10rem,1.8fr)_minmax(5.5rem,0.7fr)_minmax(5.5rem,0.7fr)_minmax(8.5rem,1fr)_1rem]"
const ENCABEZADO = [{ texto: "Fecha" }, { texto: "Paciente" }, { texto: "Detalle" }, { texto: "Total", derecha: true }, { texto: "Pagado", derecha: true }, { texto: "Estado del pago" }, { texto: "" }]
const ANULADAS = [{ id: "sin", etiqueta: "Sin anuladas" }, { id: "con", etiqueta: "Con anuladas" }, { id: "solo", etiqueta: "Solo anuladas" }]
const METODOS = [{ id: "todos", etiqueta: "Todas" }, ...METODOS_COBRO, { id: SIN_INDICAR, etiqueta: "Sin indicar" }]
const FE = [{ id: "todas", etiqueta: "Todas" }, { id: "sin", etiqueta: "Sin factura electrónica" }]
const TEXTO_DATO = { cobrado: "Cobrado · ventas pagadas", porcobrar: "Por cobrar · ventas con saldo", verificar: "Pago por verificar · transferencias por revisar" }

// Pestaña «Ventas»: solo lo vendido. Arriba, el período, la búsqueda y «Filtrar»; luego la franja de datos (vendido, cobrado, por cobrar, pagos por verificar y lentes en el laboratorio) que cambia
// con el período y la búsqueda y cuyos datos filtran la lista al pulsarlos; abajo, la lista en columnas. Al pulsar una venta se abre su detalle completo en la ventana estándar.
export default function PestanaVentas({ facturas, abonos, pacientes, ordenes = [], pagosPorVerificar = [], puedeVender, onNuevaVenta, onAbrir, onVerPedidos, inicial = {} }) {
  const [periodo, setPeriodo] = useState(inicial.periodo || PERIODO_DE_VENTAS)
  const [texto, setTexto] = useState(inicial.texto || "")
  const [dato, setDato] = useState(inicial.dato || null)
  const [anuladas, setAnuladas] = useState(inicial.estado === "anuladas" ? "solo" : "sin")
  const [metodo, setMetodo] = useState("todos")
  const [fe, setFe] = useState(inicial.sinFE ? "sin" : "todas")
  const [visibles, setVisibles] = useState(POR_PAGINA)
  const hoy = hoyISO()
  const buscando = texto.trim() !== ""
  // Con texto, la búsqueda mira todas las fechas (y el selector lo dice).
  const rango = buscando ? null : rangoDelPeriodo(periodo, hoy)
  const volver = (poner) => (valor) => { poner(valor); setVisibles(POR_PAGINA) }

  // Las ventas del período y de los filtros; la franja suma sobre ellas y el dato pulsado recorta la lista.
  const base = useMemo(() => filtrarComprobantes(facturas, {
    texto, estado: anuladas === "solo" ? "anuladas" : anuladas === "con" ? "todas" : "vigentes", periodo: rango ? "rango" : "todo", desde: rango?.desde || "", hasta: rango?.hasta || "",
    sinFacturaElectronica: fe === "sin", metodo: metodo === "todos" ? "" : metodo, pacientes, abonos,
  }), [facturas, texto, anuladas, rango?.desde, rango?.hasta, fe, metodo, pacientes, abonos]) // eslint-disable-line react-hooks/exhaustive-deps
  const resumen = useMemo(() => resumenDeVentas({ ventas: base, abonos, pagosPorVerificar, ordenes }), [base, abonos, pagosPorVerificar, ordenes])
  const lista = useMemo(() => (dato ? base.filter((f) => ventaDelDato(f, dato, abonos, pagosPorVerificar)) : base), [base, dato, abonos, pagosPorVerificar])
  const n = lista.length

  const elegirDato = (id) => { setDato((actual) => (actual === id ? null : id)); setVisibles(POR_PAGINA) }
  const datos = [
    { id: "vendido", etiqueta: "Vendido", valor: dinero(resumen.vendido), sub: `${plural(resumen.ventas, "venta", "ventas")} · ver todas`, activo: dato === null, onClick: () => { setDato(null); setVisibles(POR_PAGINA) }, ayuda: "Lo vendido en la lista de abajo, sin las ventas anuladas. Pulsa para ver todas." },
    { id: "cobrado", etiqueta: "Cobrado", valor: dinero(resumen.cobrado), sub: resumen.cobradas === 0 ? "ninguna venta pagada" : `${plural(resumen.cobradas, "venta pagada", "ventas pagadas")}`, activo: dato === "cobrado", onClick: () => elegirDato("cobrado"), ayuda: "Lo que ya se pagó de lo vendido. Pulsa para ver las ventas pagadas." },
    { id: "porcobrar", etiqueta: "Por cobrar", punto: "rojo", valor: dinero(resumen.porCobrar), sub: resumen.conSaldo === 0 ? "nada pendiente" : plural(resumen.conSaldo, "venta con saldo", "ventas con saldo"), activo: dato === "porcobrar", onClick: () => elegirDato("porcobrar"), ayuda: "Lo que falta por cobrar de lo vendido. Pulsa para ver las ventas con saldo." },
    { id: "verificar", etiqueta: "Pago por verificar", punto: "ambar", valor: dinero(resumen.porVerificar), sub: resumen.transferencias === 0 ? "ninguna transferencia" : resumen.transferencias === resumen.ventasPorVerificar ? plural(resumen.transferencias, "transferencia", "transferencias") : `${plural(resumen.transferencias, "transferencia", "transferencias")} · ${plural(resumen.ventasPorVerificar, "venta", "ventas")}`, activo: dato === "verificar", onClick: () => elegirDato("verificar"), ayuda: "Transferencias que los pacientes dicen haber hecho y nadie revisó. Pulsa para ver esas ventas." },
    { id: "lentes", etiqueta: "Pedidos en proceso", valor: String(resumen.enProceso), sub: resumen.enProceso === 0 ? "ninguno pendiente" : resumen.atrasados > 0 ? plural(resumen.atrasados, "atrasado", "atrasados") : "ninguno atrasado", onClick: () => onVerPedidos("enproceso"), ayuda: "Pedidos de estas ventas que todavía no están listos. Pulsa para verlos en Pedidos." },
  ]

  const secciones = [
    { id: "anuladas", titulo: "Ventas anuladas", valor: anuladas, onChange: volver(setAnuladas), opciones: ANULADAS },
    { id: "metodo", titulo: "Forma de pago", valor: metodo, onChange: volver(setMetodo), opciones: METODOS },
    { id: "fe", titulo: "Factura electrónica", valor: fe, onChange: volver(setFe), opciones: FE },
  ]
  const hayFiltros = dato !== null || anuladas !== "sin" || metodo !== "todos" || fe !== "todas"
  const limpiar = () => { setDato(null); setAnuladas("sin"); setMetodo("todos"); setFe("todas"); setTexto(""); setPeriodo(PERIODO_DE_VENTAS); setVisibles(POR_PAGINA) }
  const quitarFiltros = () => { setDato(null); setAnuladas("sin"); setMetodo("todos"); setFe("todas"); setVisibles(POR_PAGINA) }
  const puestos = [
    dato && TEXTO_DATO[dato],
    anuladas !== "sin" && ANULADAS.find((a) => a.id === anuladas).etiqueta,
    metodo !== "todos" && `Pagadas con ${METODOS.find((m) => m.id === metodo).etiqueta.toLowerCase()}`,
    fe === "sin" && "Sin factura electrónica",
  ].filter(Boolean)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <SelectorPeriodo periodo={periodo} onCambiar={volver(setPeriodo)} buscando={buscando} ariaLabel="Período de las ventas" />
        <CampoBusqueda id="ventas-busqueda" valor={texto} onCambio={volver(setTexto)} placeholder="Buscar paciente o comprobante" className="min-w-[12rem]" />
        <BotonFiltrar secciones={secciones} panelId="ventas-filtrar-panel" />
      </div>

      <FranjaDatos etiqueta="Resumen de las ventas" datos={datos} />

      {hayFiltros && (
        <FiltroActivo texto={puestos.join(" · ")} onQuitar={quitarFiltros} onLimpiar={buscando ? limpiar : undefined} />
      )}

      {n === 0 ? (
        facturas.length === 0 ? (
          <Vacio Icono={Receipt} titulo="Todavía no hay ventas registradas" texto="Cada venta que se registra queda aquí, con sus abonos y el estado de sus lentes.">
            {puedeVender && <button type="button" onClick={onNuevaVenta} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}><ShoppingCart size={15} aria-hidden="true" /> Registrar la primera venta</button>}
          </Vacio>
        ) : hayFiltros || buscando ? (
          <Vacio Icono={Receipt} titulo={buscando ? "Ninguna venta coincide con la búsqueda" : "Ninguna venta coincide con el filtro"}>
            <button type="button" onClick={limpiar} className={CLASE_ACCION_SECUNDARIA}>Quitar filtros</button>
          </Vacio>
        ) : (
          <Vacio Icono={Receipt} titulo={periodo.filtro === "hoy" ? "Hoy no hay ventas" : "No hay ventas en este período"} texto="Las ventas de otros períodos siguen guardadas: cambia el período para verlas.">
            <button type="button" onClick={() => setPeriodo(PERIODO_INICIAL)} className={CLASE_ACCION_SECUNDARIA}>Ver todas las fechas</button>
          </Vacio>
        )
      ) : (
        <>
          <TablaLista etiqueta="Ventas" plantilla={COLUMNAS} encabezado={ENCABEZADO}>
            {lista.slice(0, visibles).map((f) => {
              const paciente = pacientes.find((p) => p.id === f.pacienteId)
              const { titulo, sub } = detalleDeVenta(f)
              const estado = estadoPagoDeVenta(f, abonos, pagosPorVerificar)
              const anulada = estado.id === "anulada"
              const dia = diaDeRegistro(f.creadoEn)
              return (
                <li key={f.id} data-fila className="relative px-5 py-3.5 transition-colors hover:bg-slate-50/70 lg:py-4">
                  <div className={"grid grid-cols-1 gap-x-4 gap-y-1 lg:items-center " + COLUMNAS}>
                    <button type="button" onClick={() => onAbrir(f)} aria-label={`Ver la venta ${numeroComprobante(f.numero)} de ${paciente?.nombre || "un paciente"}`} className="absolute inset-0 cursor-pointer" />
                    <p className="text-sm text-slate-700">{dia ? formatoFecha(dia, "medioSinAnio") : "—"}</p>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold" style={{ color: INK }} title={paciente?.nombre}>{paciente?.nombre || "Paciente"}</p>
                      <p className="truncate font-mono text-xs text-slate-500">{numeroComprobante(f.numero)}</p>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800" title={titulo}>{titulo}</p>
                      {sub && <p className="truncate text-xs text-slate-500" title={sub}>{sub}</p>}
                    </div>
                    <p data-col="monto" className={"font-mono text-sm lg:text-right " + (anulada ? "text-slate-400 line-through" : "text-slate-800")}>{dinero(f.montoTotal)}</p>
                    <p data-col="monto" className={"font-mono text-sm lg:text-right " + (anulada ? "text-slate-400" : "text-slate-800")}>{anulada ? "—" : dinero(pagadoDeVenta(f, abonos))}</p>
                    <div data-col="estado" className="min-w-0"><Insignia tono={estado.tono}>{estado.monto > 0 ? `${estado.etiqueta} ${dinero(estado.monto)}` : estado.etiqueta}</Insignia></div>
                    <span className="hidden text-slate-400 lg:block" aria-hidden="true">›</span>
                  </div>
                </li>
              )
            })}
          </TablaLista>
          {visibles < n && (
            <div className="flex justify-end px-1">
              <button type="button" onClick={() => setVisibles((x) => x + POR_PAGINA)} className="text-sm font-semibold text-blue-700 hover:text-blue-800 cursor-pointer">Ver {Math.min(POR_PAGINA, n - visibles)} más · quedan {n - visibles}</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
