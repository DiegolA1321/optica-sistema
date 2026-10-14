"use client"

import { useMemo, useState } from "react"
import { Receipt, Search, ShoppingCart } from "lucide-react"
import { GRAD_MARCA } from "@/lib/tema"
import { BarraBusquedaFiltros, ConteoCitas, NavegadorPeriodo, PeriodoLista } from "../FiltrosCitas"
import FilaComprobante from "../FilaComprobante"
import { ContenedorLista, EncabezadoLista, Vacio } from "./Lista"
import { CLASE_ACCION_PRINCIPAL, CLASE_ACCION_SECUNDARIA, COLUMNAS_COMPROBANTES, ENCABEZADO_COMPROBANTES, plural } from "./estilos"
import { LEYENDA_INTERNO } from "../../utilidades/comprobantes"
import { filtrarComprobantes } from "../../utilidades/saldosVentas"
import { hoyISO } from "../../utilidades/disponibilidad"
import { periodosFiltro } from "../../utilidades/filtrosCitas"
import { PERIODO_INICIAL, hayRango, moverPeriodo, rangoDelPeriodo, selectorDelPeriodo, tituloDelPeriodo } from "../../utilidades/periodoLista"
import { METODOS_COBRO, SIN_INDICAR } from "../../utilidades/pagos"
import { formatoFecha } from "../../utilidades/formatoFecha"

const POR_PAGINA = 30
const ESTADOS = [{ id: "todos", etiqueta: "Todos" }, { id: "pagadas", etiqueta: "Pagadas" }, { id: "saldo", etiqueta: "Con saldo" }, { id: "anuladas", etiqueta: "Anuladas" }]
const METODOS = [{ id: "todos", etiqueta: "Todos" }, ...METODOS_COBRO, { id: SIN_INDICAR, etiqueta: "Sin indicar" }]
const FE = [{ id: "todas", etiqueta: "Todas" }, { id: "sin", etiqueta: "Sin factura electrónica" }]
const SUFIJO = { hoy: "hoy", semana: "en la semana", mes: "en el mes" }
const corta = (iso) => formatoFecha(iso, "medioSinAnio")

// Pestaña "Comprobantes": las ventas registradas. Cada fila dice número, fecha, paciente, total, estado y si tiene factura electrónica; una sola
// acción de contexto ("Abonar") y el resto en el detalle. El período es el mismo selector que usa la Lista de Citas.
export default function PestanaComprobantes({ facturas, abonos, pacientes, puedeVender, puedeEditar, onNuevaVenta, onAbrir, onAbonar, onVerPaciente, inicial = {} }) {
  const [periodo, setPeriodo] = useState(inicial.periodo || PERIODO_INICIAL)
  const [estado, setEstado] = useState(inicial.estado || "todos")
  const [metodo, setMetodo] = useState("todos")
  const [fe, setFe] = useState(inicial.sinFE ? "sin" : "todas")
  const [texto, setTexto] = useState(inicial.texto || "")
  const [visibles, setVisibles] = useState(POR_PAGINA)
  const hoy = hoyISO()
  const buscando = texto.trim() !== ""
  const rango = buscando ? null : rangoDelPeriodo(periodo, hoy)

  // Cada cambio de filtro vuelve a mostrar solo las primeras filas.
  const cambiar = (poner) => (valor) => { poner(valor); setVisibles(POR_PAGINA) }
  const comprobantes = useMemo(() => filtrarComprobantes(facturas, {
    texto, estado: estado === "todos" ? "vigentes" : estado, periodo: rango ? "rango" : "todo", desde: rango?.desde || "", hasta: rango?.hasta || "",
    sinFacturaElectronica: fe === "sin", metodo: metodo === "todos" ? "" : metodo, pacientes, abonos,
  }), [facturas, texto, estado, rango?.desde, rango?.hasta, fe, metodo, pacientes, abonos]) // eslint-disable-line react-hooks/exhaustive-deps

  const etiquetas = [
    estado !== "todos" && { id: "estado", texto: `Estado: ${ESTADOS.find((e) => e.id === estado).etiqueta}`, quitar: () => setEstado("todos") },
    metodo !== "todos" && { id: "metodo", texto: `Método: ${METODOS.find((m) => m.id === metodo).etiqueta}`, quitar: () => setMetodo("todos") },
    fe === "sin" && { id: "fe", texto: "Sin factura electrónica", quitar: () => setFe("todas") },
    hayRango(periodo) && { id: "fechas", texto: `Fechas: ${periodo.desde ? corta(periodo.desde) : "…"} – ${periodo.hasta ? corta(periodo.hasta) : "…"}`, quitar: () => setPeriodo(PERIODO_INICIAL) },
  ].filter(Boolean)
  const secciones = [
    { id: "estado", titulo: "Estado", valor: estado, onChange: cambiar(setEstado), opciones: ESTADOS },
    { id: "metodo", titulo: "Método de pago", valor: metodo, onChange: cambiar(setMetodo), opciones: METODOS },
    { id: "fe", titulo: "Factura electrónica", valor: fe, onChange: cambiar(setFe), opciones: FE },
    { id: "fechas", titulo: "Fechas", tipo: "rango", rango: { desde: periodo.desde, hasta: periodo.hasta, onDesde: (d) => setPeriodo({ filtro: "todas", ref: "", desde: d, hasta: periodo.hasta }), onHasta: (h) => setPeriodo({ filtro: "todas", ref: "", desde: periodo.desde, hasta: h }) } },
  ]
  const limpiar = () => { setEstado("todos"); setMetodo("todos"); setFe("todas"); setTexto(""); setPeriodo(PERIODO_INICIAL); setVisibles(POR_PAGINA) }
  const hayFiltros = etiquetas.length > 0 || buscando
  const n = comprobantes.length
  const sufijo = buscando ? "" : hayRango(periodo) ? " en el rango" : SUFIJO[periodo.filtro] ? ` ${periodo.filtro === "hoy" && periodo.ref && periodo.ref !== hoy ? "ese día" : SUFIJO[periodo.filtro]}` : ""
  const conteo = `${plural(n, "comprobante", "comprobantes")}${estado === "anuladas" ? " anulados" : ""}${sufijo}`
  const hayPeriodo = !buscando && Boolean(rango)

  return (
    <div className="space-y-2.5">
      <div className="flex items-start gap-3">
        <BarraBusquedaFiltros texto={texto} onTexto={cambiar(setTexto)} secciones={secciones} etiquetas={etiquetas} onLimpiar={limpiar} placeholder="Buscar: paciente, cédula, CV-0001 o factura electrónica" inputId="comprobantes-busqueda" etiquetaPanel="Filtrar los comprobantes" panelId="comprobantes-filtrar-panel" />
      </div>
      <div className="flex h-12 items-center justify-between gap-3 px-2 pt-2.5">
        <div className="flex min-w-0 items-center gap-3">
          {buscando && <p className="flex items-center gap-2 text-xs font-semibold text-slate-600"><Search size={14} aria-hidden="true" /> Buscando en todas las fechas</p>}
          <ConteoCitas texto={conteo} />
        </div>
        {!buscando && (
          <div className="flex min-w-0 items-center gap-3">
            <PeriodoLista valor={periodo.filtro} onChange={(id) => { setPeriodo({ filtro: id, ref: "", desde: "", hasta: "" }); setVisibles(POR_PAGINA) }} opciones={periodosFiltro()} sinActivo={hayRango(periodo)} />
            {hayPeriodo ? (
              <NavegadorPeriodo titulo={tituloDelPeriodo(periodo, hoy)} onAnterior={() => setPeriodo(moverPeriodo(periodo, -1, hoy))} onSiguiente={() => setPeriodo(moverPeriodo(periodo, 1, hoy))} etiquetaAnterior="Periodo anterior" etiquetaSiguiente="Periodo siguiente" selector={selectorDelPeriodo(periodo, setPeriodo, hoy)} />
            ) : (
              <NavegadorPeriodo inactivo titulo="Todas las fechas" etiquetaAnterior="Periodo anterior" etiquetaSiguiente="Periodo siguiente" />
            )}
          </div>
        )}
      </div>

      {n === 0 ? (
        facturas.length === 0 ? (
          <Vacio Icono={Receipt} titulo="Todavía no hay ventas registradas" texto="Cada venta que se registra queda aquí como un comprobante, con sus abonos y sus órdenes de laboratorio.">
            {puedeVender && <button type="button" onClick={onNuevaVenta} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}><ShoppingCart size={15} aria-hidden="true" /> Registrar la primera venta</button>}
          </Vacio>
        ) : hayFiltros ? (
          <Vacio Icono={Receipt} titulo={buscando ? "Ningún comprobante coincide con la búsqueda" : "Ningún comprobante coincide con los filtros"}>
            <button type="button" onClick={limpiar} className={CLASE_ACCION_SECUNDARIA}>Quitar filtros</button>
          </Vacio>
        ) : (
          <Vacio Icono={Receipt} titulo={periodo.filtro === "hoy" && !periodo.ref ? "Hoy no hay ventas" : "No hay ventas en este período"} texto="Las ventas de otros días siguen en sus comprobantes.">
            <button type="button" onClick={() => setPeriodo(PERIODO_INICIAL)} className={CLASE_ACCION_SECUNDARIA}>Ver todas las fechas</button>
          </Vacio>
        )
      ) : (
        <>
          <ContenedorLista etiqueta="Comprobantes de venta" encabezado={<EncabezadoLista plantilla={COLUMNAS_COMPROBANTES} etiquetas={ENCABEZADO_COMPROBANTES} />}>
            {comprobantes.slice(0, visibles).map((f) => (
              <FilaComprobante key={f.id} factura={f} abonos={abonos} paciente={pacientes.find((p) => p.id === f.pacienteId) || null} mostrarPaciente puedeEditar={puedeEditar} onAbrir={onAbrir} onAbonar={onAbonar} onVerPaciente={onVerPaciente} />
            ))}
          </ContenedorLista>
          <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-500">
            <span>{LEYENDA_INTERNO}</span>
            {visibles < n && <button type="button" onClick={() => setVisibles((x) => x + POR_PAGINA)} className="text-sm font-semibold text-blue-700 hover:text-blue-800 cursor-pointer">Ver {Math.min(POR_PAGINA, n - visibles)} más · quedan {n - visibles}</button>}
          </div>
        </>
      )}
    </div>
  )
}
