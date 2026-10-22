"use client"

import { useMemo, useState } from "react"
import { FlaskConical, MessageCircle } from "lucide-react"
import { INK, GRAD_MARCA } from "@/lib/tema"
import { Insignia, Vacio } from "./Lista"
import { FiltroActivo, Pildoras, TablaLista } from "./Piezas"
import { CLASE_ACCION_PRINCIPAL, CLASE_ACCION_SECUNDARIA } from "./estilos"
import { formatoFecha } from "../../utilidades/formatoFecha"
import { diasDeAtraso, estadoVisible, nombreDeLentes, numeroOrden } from "../../utilidades/ordenesLaboratorio"
import { FILTRO_EN_LABORATORIO, FILTROS_ORDENES, estadoDePedido, filtroDeOrdenesValido, ordenesDelFiltro } from "../../utilidades/ventasModulo"
import { claveDeNombre, laboratoriosParaFiltrar } from "../../utilidades/laboratorios"

const COLUMNAS = "lg:grid-cols-[5.5rem_minmax(9rem,1.5fr)_minmax(7rem,1fr)_6rem_minmax(9.5rem,1fr)_8.5rem]"
const ENCABEZADO = [{ texto: "Pedido" }, { texto: "Paciente" }, { texto: "Laboratorio" }, { texto: "Prometido" }, { texto: "Estado" }, { texto: "" }]
const VACIO = {
  encurso: ["No hay pedidos en curso", "Todo lo que se mandó al laboratorio ya se entregó."],
  atrasadas: ["No hay pedidos atrasados", "Todos los pedidos van dentro de su fecha prometida."],
  sinavisar: ["No hay lentes listos sin avisar", "A todos los pacientes con lentes listos ya se les avisó."],
  enlab: ["No hay lentes en el laboratorio", "Los pedidos que se manden al laboratorio aparecen aquí."],
  entregadas: ["Todavía no se ha entregado ningún pedido", "Los pedidos entregados quedan aquí."],
  todas: ["Todavía no hay pedidos de lentes", "Un pedido de lentes se crea al guardar una venta que incluye lunas."],
}

// Pestaña «Pedidos de lentes»: una lista ordenada en columnas (pedido, paciente con sus lentes, laboratorio, fecha prometida y estado) con UNA acción según el momento: Marcar listo,
// Contactar (la ventana única, con el mensaje de lentes listos) o Entregar. Lo demás está en el detalle del pedido. Un pedido está atrasado si pasó su fecha prometida sin estar listo.
export default function PestanaPedidos({ api, ordenes, parametrizacion, filtroInicial = "encurso", puedeVender, onNuevaVenta }) {
  const [filtro, setFiltro] = useState(filtroDeOrdenesValido(filtroInicial))
  const [laboratorio, setLaboratorio] = useState("")
  const laboratorios = useMemo(() => laboratoriosParaFiltrar(parametrizacion, ordenes), [parametrizacion, ordenes])
  const vivas = useMemo(() => ordenes.filter((o) => o.estado !== "cancelada"), [ordenes])

  const delLaboratorio = (o) => !laboratorio || claveDeNombre(o.laboratorio) === claveDeNombre(laboratorio)
  const visibles = useMemo(
    () => ordenesDelFiltro(vivas, filtro).filter(delLaboratorio).slice().sort((a, b) => (a.fechaPrometida < b.fechaPrometida ? -1 : a.fechaPrometida > b.fechaPrometida ? 1 : b.numero - a.numero)),
    [vivas, filtro, laboratorio], // eslint-disable-line react-hooks/exhaustive-deps
  )
  // Los números de las píldoras cuentan lo mismo que listan (con el laboratorio elegido).
  const cuenta = (id) => ordenesDelFiltro(vivas, id).filter(delLaboratorio).length
  const opciones = FILTROS_ORDENES.map((f) => ({ ...f, cuenta: f.id === "atrasadas" || f.id === "sinavisar" ? cuenta(f.id) : null }))
  const enLaboratorio = filtro === FILTRO_EN_LABORATORIO.id
  const hayFiltros = laboratorio !== "" || (filtro !== "encurso")
  const limpiar = () => { setFiltro("encurso"); setLaboratorio("") }
  const n = visibles.length
  const [titulo, texto] = VACIO[filtro] || VACIO.encurso

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Pildoras etiqueta="Estado de los pedidos" opciones={enLaboratorio ? [] : opciones} valor={filtro} onCambiar={setFiltro} />
        {enLaboratorio && <FiltroActivo texto="En el laboratorio" onQuitar={() => setFiltro("encurso")} />}
        <div className="relative">
          <label htmlFor="pedidos-laboratorio" className="sr-only">Laboratorio</label>
          <select id="pedidos-laboratorio" value={laboratorio} onChange={(e) => setLaboratorio(e.target.value)}
            className="h-10 cursor-pointer rounded-xl border border-slate-200/60 bg-white px-3.5 text-sm font-semibold text-slate-800 shadow-sm outline-none transition-colors hover:bg-slate-50 focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-100">
            <option value="">Laboratorio: todos</option>
            {laboratorios.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>

      {n === 0 ? (
        vivas.length === 0 ? (
          <Vacio Icono={FlaskConical} titulo="Todavía no hay pedidos de lentes" texto="Un pedido de lentes se crea al guardar una venta que incluye lunas.">
            {puedeVender && <button type="button" onClick={onNuevaVenta} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}>Nueva venta</button>}
          </Vacio>
        ) : (
          <Vacio Icono={FlaskConical} titulo={laboratorio ? `Sin pedidos de ${laboratorio} con este estado` : titulo} texto={laboratorio ? undefined : texto}>
            {hayFiltros && <button type="button" onClick={limpiar} className={CLASE_ACCION_SECUNDARIA}>Ver los pedidos en curso</button>}
          </Vacio>
        )
      ) : (
        <TablaLista etiqueta="Pedidos de lentes" plantilla={COLUMNAS} encabezado={ENCABEZADO}>
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
                  <p className="truncate text-sm text-slate-700" title={o.laboratorio || "Sin laboratorio"}>{o.laboratorio || <span className="text-slate-400">Sin laboratorio</span>}</p>
                  <p className={"text-sm " + (estadoVisible(o) === "atrasada" ? "font-semibold text-red-700" : "text-slate-700")}>{o.fechaPrometida ? formatoFecha(o.fechaPrometida, "medioSinAnio") : "—"}</p>
                  <div data-col="estado" className="min-w-0"><Insignia tono={estado.tono}>{estado.etiqueta}</Insignia></div>
                  <div className="relative z-10 flex lg:justify-end">
                    {sig && (
                      <button type="button" onClick={() => api.ejecutarSiguiente(o)} disabled={ocupado} title={sig.id === "avisar" ? "Abre la ventana de Contactar con el mensaje de lentes listos" : undefined}
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
      <p className="px-1 text-sm text-slate-500">Los laboratorios se administran en Configuración → Laboratorios.</p>
    </div>
  )
}

