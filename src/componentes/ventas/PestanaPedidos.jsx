"use client"

import { useMemo, useState } from "react"
import { Package, MessageCircle } from "lucide-react"
import { INK, GRAD_MARCA } from "@/lib/tema"
import { Insignia, Vacio } from "./Lista"
import { CampoBusqueda, FiltroActivo, Pildoras, TablaLista } from "./Piezas"
import { CLASE_ACCION_PRINCIPAL, CLASE_ACCION_SECUNDARIA } from "./estilos"
import { formatoFecha } from "../../utilidades/formatoFecha"
import { diasDeAtraso, estadoVisible, nombreDeLentes, numeroOrden } from "../../utilidades/ordenesLaboratorio"
import { FILTROS_ORDENES, FILTRO_SIN_AVISAR, estadoDePedido, etiquetaEntrega, filtroDeOrdenesValido, ordenesDelFiltro } from "../../utilidades/ventasModulo"
import { normalizarTexto } from "../../utilidades/busqueda"

const COLUMNAS = "lg:grid-cols-[5.5rem_minmax(9rem,1.5fr)_minmax(8rem,1fr)_6rem_minmax(9.5rem,1fr)_8.5rem]"
const ENCABEZADO = [{ texto: "Pedido" }, { texto: "Paciente" }, { texto: "Entrega" }, { texto: "Listo hacia" }, { texto: "Estado" }, { texto: "" }]
const VACIO = {
  enproceso: ["No hay pedidos en proceso", "Todo lo que se encargó ya está listo o entregado."],
  atrasadas: ["No hay pedidos atrasados", "Todos los pedidos van dentro de su fecha aproximada."],
  listos: ["No hay pedidos listos para entregar", "Los pedidos que se marquen como listos aparecen aquí hasta que se entreguen."],
  sinavisar: ["No hay pedidos listos sin avisar", "A todos los pacientes con pedidos listos ya se les avisó."],
  entregadas: ["Todavía no se ha entregado ningún pedido", "Los pedidos entregados quedan aquí."],
  todas: ["Todavía no hay pedidos", "Un pedido se crea al guardar una venta que incluye algo que se encarga afuera, como las lunas."],
}

// Pestaña «Pedidos»: el registro simple de lo que la óptica encarga afuera (las lunas). Una lista en columnas (pedido, paciente con sus lentes, entrega, fecha aproximada y estado) con UNA acción
// según el momento: Marcar listo, Avisar al paciente (la ventana única de Contactar) o Entregar. Un pedido está atrasado si pasó su fecha aproximada sin estar listo.
export default function PestanaPedidos({ api, ordenes, filtroInicial = "enproceso", puedeVender, onNuevaVenta }) {
  const [filtro, setFiltro] = useState(filtroDeOrdenesValido(filtroInicial))
  const [texto, setTexto] = useState("")
  const vivas = useMemo(() => ordenes.filter((o) => o.estado !== "cancelada"), [ordenes])

  const clave = normalizarTexto(texto)
  const coincide = (o) => {
    if (!clave) return true
    const p = api.pacienteDe(o)
    return normalizarTexto(`${p?.nombre || ""} ${numeroOrden(o.numero)} ${o.numero}`).includes(clave)
  }
  const visibles = useMemo(
    () => ordenesDelFiltro(vivas, filtro).filter(coincide).slice().sort((a, b) => (a.fechaPrometida < b.fechaPrometida ? -1 : a.fechaPrometida > b.fechaPrometida ? 1 : b.numero - a.numero)),
    [vivas, filtro, clave], // eslint-disable-line react-hooks/exhaustive-deps
  )
  // Los números de las píldoras cuentan lo mismo que listan.
  const cuenta = (id) => ordenesDelFiltro(vivas, id).filter(coincide).length
  const opciones = FILTROS_ORDENES.map((f) => ({ ...f, cuenta: f.id === "enproceso" || f.id === "atrasadas" || f.id === "listos" ? cuenta(f.id) : null }))
  const sinAvisar = filtro === FILTRO_SIN_AVISAR.id
  const hayFiltros = clave !== "" || filtro !== "enproceso"
  const limpiar = () => { setFiltro("enproceso"); setTexto("") }
  const n = visibles.length
  const [titulo, textoVacio] = VACIO[filtro] || VACIO.enproceso

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Pildoras etiqueta="Estado de los pedidos" opciones={sinAvisar ? [] : opciones} valor={filtro} onCambiar={setFiltro} />
        {sinAvisar && <FiltroActivo texto={`${FILTRO_SIN_AVISAR.etiqueta} (${n})`} onQuitar={() => setFiltro("enproceso")} />}
        <CampoBusqueda id="pedidos-buscar" valor={texto} onCambio={setTexto} placeholder="Buscar por paciente o número de pedido" className="sm:max-w-xs" />
      </div>

      {n === 0 ? (
        vivas.length === 0 ? (
          <Vacio Icono={Package} titulo={VACIO.todas[0]} texto={VACIO.todas[1]}>
            {puedeVender && <button type="button" onClick={onNuevaVenta} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}>Nueva venta</button>}
          </Vacio>
        ) : (
          <Vacio Icono={Package} titulo={clave ? "Ningún pedido coincide con la búsqueda" : titulo} texto={clave ? "Prueba con otro nombre o número." : textoVacio}>
            {hayFiltros && <button type="button" onClick={limpiar} className={CLASE_ACCION_SECUNDARIA}>Ver los pedidos en proceso</button>}
          </Vacio>
        )
      ) : (
        <TablaLista etiqueta="Pedidos" plantilla={COLUMNAS} encabezado={ENCABEZADO}>
          {visibles.map((o) => {
            const p = api.pacienteDe(o)
            const dias = diasDeAtraso(o)
            const estado = estadoDePedido(o, dias)
            const sig = api.siguiente(o)
            const ocupado = api.trabajando === o.id
            return (
              <li key={o.id} data-fila className="relative px-5 py-3.5 transition-colors hover:bg-slate-50/70 lg:py-4">
                <div className={"grid grid-cols-1 gap-x-4 gap-y-1 lg:items-center " + COLUMNAS}>
                  <button type="button" onClick={() => api.verDetalle(o)} aria-label={`Ver el pedido ${numeroOrden(o.numero)} de ${p?.nombre || "un paciente"}`} className="absolute inset-0 cursor-pointer" />
                  <p className="font-mono text-sm text-slate-700">{numeroOrden(o.numero)}</p>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold" style={{ color: INK }} title={p?.nombre}>{p?.nombre || "Paciente"}</p>
                    <p className="truncate text-xs text-slate-500">{nombreDeLentes(o)}</p>
                  </div>
                  <p className="truncate text-sm text-slate-700" title={o.entrega === "envio" ? o.direccionEntrega : undefined}>{etiquetaEntrega(o)}</p>
                  <p className={"text-sm " + (estadoVisible(o) === "atrasada" ? "font-semibold text-red-700" : "text-slate-700")}>{o.fechaPrometida ? formatoFecha(o.fechaPrometida, "medioSinAnio") : "—"}</p>
                  <div data-col="estado" className="min-w-0"><Insignia tono={estado.tono}>{estado.etiqueta}</Insignia></div>
                  <div className="relative z-10 flex lg:justify-end">
                    {sig && (
                      <button type="button" onClick={() => api.ejecutarSiguiente(o)} disabled={ocupado} title={sig.id === "avisar" ? "Abre la ventana de Contactar con el mensaje de pedido listo" : undefined}
                        className={(sig.id === "avisar" ? CLASE_ACCION_PRINCIPAL : CLASE_ACCION_SECUNDARIA)} style={sig.id === "avisar" ? { background: GRAD_MARCA } : undefined}>
                        {sig.id === "avisar" && <MessageCircle size={14} aria-hidden="true" />}{sig.etiqueta}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            )
          })}
        </TablaLista>
      )}
    </div>
  )
}
