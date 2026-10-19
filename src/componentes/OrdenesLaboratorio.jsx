"use client"

import { useMemo, useState } from "react"
import { FlaskConical, MessageCircle } from "lucide-react"
import { INK, GRAD_MARCA } from "@/lib/tema"
import { fechaLegible } from "../utilidades/formatoFecha"
import { dinero } from "../utilidades/formatoMoneda"
import { coincideTexto } from "../utilidades/busqueda"
import { diasDeAtraso, estadoVisible, laboratoriosUsados, numeroOrden } from "../utilidades/ordenesLaboratorio"
import { FILTROS_ORDENES, filtroDeOrdenesValido, ordenesDelFiltro, textoEstadoOrden } from "../utilidades/ventasModulo"
import { BarraBusquedaFiltros, ConteoCitas } from "./FiltrosCitas"
import { ContenedorLista, EncabezadoLista, Insignia, Vacio } from "./ventas/Lista"
import { CLASE_ACCION_PRINCIPAL, CLASE_ACCION_SECUNDARIA, TONO_ESTADO_ORDEN, plural } from "./ventas/estilos"
import { useOrdenesLab } from "./ventas/useOrdenesLab"

// Las columnas se reparten el ancho (fr con mínimos): en una pantalla grande el contenido se reparte y el centro de la fila no queda vacío.
// Los mínimos suman 40 rem (640 px): caben en los 707 px de lista que deja un perfil o el módulo con el menú abierto en una laptop de 1093 px.
const COLUMNAS_MODULO = "lg:grid-cols-[4.5rem_minmax(9rem,1.6fr)_6.5rem_7.5rem_minmax(8.5rem,1fr)_minmax(8.5rem,auto)]"
const COLUMNAS_PERFIL = "lg:grid-cols-[4.5rem_minmax(7rem,1.2fr)_6rem_7.5rem_minmax(6.5rem,1fr)_minmax(8.5rem,auto)]"
const ADJETIVO = { abiertas: ["abierta", "abiertas"], enviadas: ["enviada", "enviadas"], atrasadas: ["atrasada", "atrasadas"], listas: ["lista", "listas"], sinavisar: ["lista sin avisar", "listas sin avisar"], entregadas: ["entregada", "entregadas"], canceladas: ["cancelada", "canceladas"], todas: ["", ""] }

// Órdenes de laboratorio: lista con filtros por estado y por laboratorio. Cada fila lleva la siguiente acción del proceso (marcar lista,
// avisar al paciente o entregar); lo demás está en el detalle de la orden (R36-R37). La usa el módulo de Ventas y el perfil del paciente.
export default function OrdenesLaboratorio({ api: apiExterna = null, ...props }) {
  // Quien ya tiene su propio manejo de órdenes (el módulo de Ventas, que también las abre desde un comprobante) lo pasa; si no, esta pestaña crea el suyo.
  return apiExterna ? <ListaOrdenes api={apiExterna} {...props} /> : <ConManejoPropio {...props} />
}

function ConManejoPropio(props) {
  const { ordenes, setOrdenes, pacientes, equipo, usuario, pacienteFijo, facturas, abonos, onAbonar, onAviso, onVerComprobante } = props
  const api = useOrdenesLab({ ordenes, setOrdenes, pacientes, equipo, usuario, facturas, abonos, pacienteFijo, onAbonar, onAviso, onVerComprobante })
  return <><ListaOrdenes api={api} {...props} />{api.ventanas}</>
}

function ListaOrdenes({ api, ordenes, pacientes = [], pacienteFijo = null, filtroInicial = null, accion = null, accionVacio = null, onVerComprobantes, onVerPerfil }) {
  const porDefecto = pacienteFijo ? "todas" : "abiertas"
  const [filtro, setFiltro] = useState(filtroDeOrdenesValido(filtroInicial || porDefecto))
  const [laboratorio, setLaboratorio] = useState("")
  const [texto, setTexto] = useState("")
  const propias = useMemo(() => (pacienteFijo ? ordenes.filter((o) => o.pacienteId === pacienteFijo.id) : ordenes), [ordenes, pacienteFijo])
  const laboratorios = useMemo(() => laboratoriosUsados(propias), [propias])

  const visibles = useMemo(
    () => ordenesDelFiltro(propias, filtro)
      .filter((o) => !laboratorio || o.laboratorio === laboratorio)
      .filter((o) => { const p = pacientes.find((x) => x.id === o.pacienteId); return coincideTexto(texto, p?.nombre, p?.cedula, numeroOrden(o.numero), o.numero) })
      .sort((a, b) => (a.fechaPrometida < b.fechaPrometida ? -1 : a.fechaPrometida > b.fechaPrometida ? 1 : b.numero - a.numero)),
    [propias, filtro, laboratorio, texto, pacientes],
  )

  // El estado por defecto va primero en el panel: un clic en la opción activa vuelve a él.
  const opcionesEstado = [FILTROS_ORDENES.find((f) => f.id === porDefecto), ...FILTROS_ORDENES.filter((f) => f.id !== porDefecto)]
  const secciones = [
    { id: "estado", titulo: "Estado", valor: filtro, onChange: setFiltro, opciones: opcionesEstado },
    ...(laboratorios.length > 0 ? [{ id: "laboratorio", titulo: "Laboratorio", tipo: "lista", valor: laboratorio, onChange: setLaboratorio, opciones: [{ id: "", etiqueta: "Todos" }, ...laboratorios.map((l) => ({ id: l, etiqueta: l }))] }] : []),
  ]
  const etiquetas = [
    filtro !== porDefecto && { id: "estado", texto: `Estado: ${FILTROS_ORDENES.find((f) => f.id === filtro).etiqueta}`, quitar: () => setFiltro(porDefecto) },
    laboratorio && { id: "laboratorio", texto: `Laboratorio: ${laboratorio}`, quitar: () => setLaboratorio("") },
  ].filter(Boolean)
  const limpiar = () => { setFiltro(porDefecto); setLaboratorio(""); setTexto("") }
  const hayFiltros = etiquetas.length > 0 || texto.trim() !== ""
  const n = visibles.length
  const adj = ADJETIVO[filtro][n === 1 ? 0 : 1]
  const conteo = `${plural(n, "orden", "órdenes")}${adj ? ` ${adj}` : ""}`
  const mostrarBarra = propias.length > (pacienteFijo ? 5 : 0)
  const columnas = pacienteFijo ? COLUMNAS_PERFIL : COLUMNAS_MODULO
  const encabezado = [{ texto: "Orden" }, { texto: pacienteFijo ? "Laboratorio" : "Paciente y laboratorio" }, { texto: "Prometida" }, { texto: "Estado" }, { texto: "Pendiente" }, { texto: "" }]

  return (
    <section aria-label="Órdenes de laboratorio" className="space-y-3">
      {(mostrarBarra || accion) && (
        <div className="flex flex-wrap items-start gap-3">
          {mostrarBarra && <BarraBusquedaFiltros texto={texto} onTexto={setTexto} secciones={secciones} etiquetas={etiquetas} onLimpiar={limpiar} placeholder="Buscar orden: paciente, cédula o número" inputId={pacienteFijo ? "ordenes-perfil-busqueda" : "ordenes-busqueda"} etiquetaPanel="Filtrar las órdenes de laboratorio" panelId="ordenes-filtrar-panel" />}
          {accion}
        </div>
      )}
      {mostrarBarra && <div className="flex h-9 items-center px-2"><ConteoCitas texto={conteo} /></div>}

      {n === 0 ? (
        propias.length === 0 ? (
          <Vacio Icono={FlaskConical} titulo="Todavía no hay órdenes de laboratorio" texto="Una orden es el pedido de los lentes al laboratorio. Se crea desde una venta que incluye lentes.">
            {pacienteFijo ? accionVacio : onVerComprobantes && <button type="button" onClick={onVerComprobantes} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}>Ver los comprobantes</button>}
          </Vacio>
        ) : hayFiltros ? (
          <Vacio Icono={FlaskConical} titulo={texto.trim() ? "Ninguna orden coincide con la búsqueda" : "Ninguna orden coincide con el filtro"}>
            <button type="button" onClick={limpiar} className={CLASE_ACCION_SECUNDARIA}>Quitar filtros</button>
          </Vacio>
        ) : (
          <Vacio Icono={FlaskConical} titulo={filtro === "atrasadas" ? "No hay órdenes atrasadas" : filtro === "abiertas" ? "No hay órdenes abiertas" : "No hay órdenes con este estado"} texto="Todo lo enviado al laboratorio va al día.">
            <button type="button" onClick={() => setFiltro("todas")} className={CLASE_ACCION_SECUNDARIA}>Ver todas las órdenes</button>
          </Vacio>
        )
      ) : (
        <ContenedorLista etiqueta="Órdenes de laboratorio" encabezado={<EncabezadoLista plantilla={columnas} etiquetas={encabezado} />}>
          {visibles.map((o) => {
            const p = api.pacienteDe(o)
            const visible = estadoVisible(o)
            const dias = diasDeAtraso(o)
            const saldo = o.estado === "cancelada" ? 0 : api.saldoDe(o)
            const sig = api.siguiente(o)
            const ocupado = api.trabajando === o.id
            const faltaAvisar = o.estado === "lista" && !o.pacienteAvisadoEn
            return (
              <li key={o.id} data-fila className={"relative grid grid-cols-1 gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-slate-50/70 lg:items-center " + columnas}>
                <button type="button" onClick={() => api.verDetalle(o)} aria-label={`Ver la orden ${numeroOrden(o.numero)}`} className="text-left font-mono text-sm font-bold after:absolute after:inset-0 hover:text-blue-700 cursor-pointer" style={{ color: INK }}>{numeroOrden(o.numero)}</button>
                <div className="min-w-0">
                  {!pacienteFijo && <button type="button" onClick={() => p && onVerPerfil?.(p)} title={p?.nombre} className="relative z-10 block max-w-full truncate text-left text-sm font-bold transition-colors hover:text-blue-700 cursor-pointer" style={{ color: INK }}>{p?.nombre || "Paciente"}</button>}
                  <p className={"truncate " + (pacienteFijo ? "text-sm text-slate-700" : "text-xs text-slate-500")} title={o.laboratorio || "Sin laboratorio"}>{o.laboratorio || "Sin laboratorio"}</p>
                </div>
                <p className={"text-sm " + (visible === "atrasada" ? "font-semibold text-red-700" : "text-slate-600")}>{fechaLegible(o.fechaPrometida) || "—"}</p>
                <div data-col="estado" className="min-w-0"><Insignia tono={TONO_ESTADO_ORDEN[visible]}>{textoEstadoOrden(o, dias)}</Insignia></div>
                <div className="flex min-w-0 flex-nowrap items-center gap-1.5">
                  {faltaAvisar && <Insignia tono="ambar">Falta avisar</Insignia>}
                  {saldo > 0 && <Insignia tono="ambar" title="La venta tiene saldo por cobrar">Saldo {dinero(saldo)}</Insignia>}
                  {!faltaAvisar && !(saldo > 0) && <span className="text-sm text-slate-400">—</span>}
                </div>
                <div className="relative z-10 flex justify-end">
                  {sig && (
                    <button type="button" onClick={() => api.ejecutarSiguiente(o)} disabled={ocupado} title={sig.id === "avisar" ? "Abre WhatsApp con el mensaje de que sus lentes están listos" : undefined} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}>
                      {sig.id === "avisar" && <MessageCircle size={14} aria-hidden="true" />}{sig.etiqueta}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ContenedorLista>
      )}
    </section>
  )
}
