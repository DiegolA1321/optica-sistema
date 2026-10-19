"use client"

import { useEffect, useState } from "react"
import { dioptriaTexto } from "../../utilidades/refraccion"
import { ArrowRight, FlaskConical, MessageCircle, Pencil, Plus, Printer, Undo2 } from "lucide-react"
import { GRAD_MARCA } from "@/lib/tema"
import { supabase } from "../../lib/supabaseClient"
import { Cascaron } from "../AtencionPaciente"
import { Bloque, Columna, Dato } from "./Detalle"
import { Insignia } from "./Lista"
import { BOTON_CERRAR, CLASE_ACCION_PRINCIPAL, CLASE_ACCION_SECUNDARIA, TONO_ESTADO_ORDEN } from "./estilos"
import { dinero } from "../../utilidades/formatoMoneda"
import { fechaLegible, fechaHoraLegible } from "../../utilidades/formatoFecha"
import { numeroComprobante } from "../../utilidades/comprobantes"
import { ETIQUETA_ESTADO, TIPOS_LENTE, numeroOrden, diasDeAtraso, estadoVisible, tratamientos } from "../../utilidades/ordenesLaboratorio"
import { ESTADO_ANTERIOR, textoEstadoOrden } from "../../utilidades/ventasModulo"

const medida = (o) => ["esfera", "cilindro", "eje", "adicion"].map((k) => (k === "eje" ? o?.[k] : dioptriaTexto(o?.[k])) || "—")

// El detalle de una orden de laboratorio: la orden, la venta de la que sale, el pedido (lente, montura, receta) y su historial de estados.
// Las acciones están aquí; la fila de la lista solo lleva la siguiente del proceso.
export default function DetalleOrden({ orden, paciente, factura, saldo, api, equipo = [], onCerrar, onVerComprobante }) {
  const [historial, setHistorial] = useState(null)
  const visible = estadoVisible(orden)
  const dias = diasDeAtraso(orden)
  const sig = api.siguiente(orden)
  const ocupado = api.trabajando === orden.id
  const anterior = ESTADO_ANTERIOR[orden.estado]
  const nombre = (id) => equipo.find((m) => m.id === id)?.nombre || null

  // El historial completo (con quién cambió cada estado) se lee al abrir y cada vez que cambia el estado.
  useEffect(() => {
    if (!supabase) { setHistorial((orden.historial || []).map((h) => ({ estado: h.estado, cambiado_en: h.cambiadoEn, cambiado_por: null, nota: null }))); return }
    let vivo = true
    supabase.from("ordenes_laboratorio_historial").select("estado, cambiado_por, cambiado_en, nota").eq("orden_id", orden.id).order("cambiado_en").then(({ data }) => { if (vivo) setHistorial(data || []) })
    return () => { vivo = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orden.id, orden.estado])

  const trat = tratamientos(orden)
  const tipo = TIPOS_LENTE.find((t) => t.id === orden.tipoLente)?.label
  const accionSiguiente = sig && (
    <button type="button" onClick={() => api.ejecutarSiguiente(orden)} disabled={ocupado} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}>
      {sig.id === "avisar" ? <MessageCircle size={14} aria-hidden="true" /> : null}{sig.etiqueta}{sig.id !== "avisar" ? <ArrowRight size={14} aria-hidden="true" /> : null}
    </button>
  )

  return (
    <Cascaron
      titulo={`Orden ${numeroOrden(orden.numero)}`}
      subtitulo={`${paciente?.nombre || "Paciente"}${orden.laboratorio ? ` · ${orden.laboratorio}` : ""}`}
      Icono={FlaskConical}
      ancho="max-w-3xl"
      etiqueta={`Orden de laboratorio ${numeroOrden(orden.numero)}`}
      onCerrar={onCerrar}
      derecha={<Insignia tono={TONO_ESTADO_ORDEN[visible]}>{textoEstadoOrden(orden, dias)}</Insignia>}
      pie={(
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => api.imprimir(orden)} className={CLASE_ACCION_SECUNDARIA}><Printer size={14} aria-hidden="true" /> Imprimir copias</button>
            {api.puedeEditar && (orden.estado === "enviada" || orden.estado === "lista") && <button type="button" onClick={() => api.editar(orden)} className={CLASE_ACCION_SECUNDARIA}><Pencil size={14} aria-hidden="true" /> Editar</button>}
            {api.puedeCrear && orden.estado !== "cancelada" && <button type="button" onClick={() => api.otraOrden(orden)} title="Crear otra orden para la misma venta (por ejemplo, un segundo par)" className={CLASE_ACCION_SECUNDARIA}><Plus size={14} aria-hidden="true" /> Otra orden</button>}
            {api.puedeEditar && anterior && <button type="button" onClick={() => api.volver(orden)} disabled={ocupado} className={CLASE_ACCION_SECUNDARIA}><Undo2 size={14} aria-hidden="true" /> Volver al estado anterior</button>}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {accionSiguiente}
            <button type="button" onClick={onCerrar} className={BOTON_CERRAR}>Cerrar</button>
          </div>
        </>
      )}
    >
      <div className="space-y-5 p-5">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <Columna titulo="La orden">
            <Dato etiqueta="Estado">{textoEstadoOrden(orden, dias)}</Dato>
            <Dato etiqueta="Laboratorio" vacio={!orden.laboratorio}>{orden.laboratorio || "Sin laboratorio"}</Dato>
            <Dato etiqueta="Entrega prometida"><span className={visible === "atrasada" ? "text-red-700" : ""}>{fechaLegible(orden.fechaPrometida) || "—"}</span></Dato>
            {orden.estado === "lista" && <Dato etiqueta="Aviso al paciente" vacio={!orden.pacienteAvisadoEn}>{orden.pacienteAvisadoEn ? `Avisado el ${fechaLegible(orden.pacienteAvisadoEn)}${nombre(orden.pacienteAvisadoPor) ? ` por ${nombre(orden.pacienteAvisadoPor)}` : ""}` : "Falta avisar al paciente"}</Dato>}
          </Columna>
          <Columna titulo="La venta">
            <Dato etiqueta="Comprobante">
              {factura && onVerComprobante
                ? <button type="button" onClick={() => onVerComprobante(factura)} className="font-mono text-blue-700 transition-colors hover:text-blue-800 hover:underline cursor-pointer">{numeroComprobante(factura.numero)}</button>
                : <span className="font-mono">{factura ? numeroComprobante(factura.numero) : "—"}</span>}
            </Dato>
            <Dato etiqueta="Total de la venta" vacio={!factura}>{factura ? dinero(factura.montoTotal) : "—"}</Dato>
            <Dato etiqueta="Saldo" vacio={!(saldo > 0)}>{saldo > 0 ? <span className="text-amber-700">{dinero(saldo)}</span> : "Sin saldo"}</Dato>
            <Dato etiqueta="Paciente" vacio={!paciente?.telefono}>{paciente?.telefono || "Sin teléfono"}</Dato>
          </Columna>
          <Columna titulo="El pedido">
            <Dato etiqueta="Lente">{[tipo, orden.material].filter(Boolean).join(" · ") || "—"}</Dato>
            <Dato etiqueta="Tratamientos" vacio={trat.length === 0}>{trat.length > 0 ? trat.join(", ") : "Ninguno"}</Dato>
            <Dato etiqueta="Montura" vacio={!orden.montura}>{orden.montura ? `${orden.montura}${orden.monturaMedidas ? ` · ${orden.monturaMedidas}` : ""}` : "Sin montura"}</Dato>
            {orden.observaciones && <Dato etiqueta="Observaciones">{orden.observaciones}</Dato>}
          </Columna>
        </div>

        <Bloque titulo="Receta">
          <div className="overflow-hidden rounded-xl border border-slate-200/60">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="px-3 py-1.5 text-left font-bold">Ojo</th>{["Esfera", "Cilindro", "Eje", "Adición"].map((h) => <th key={h} className="px-3 py-1.5 text-right font-bold">{h}</th>)}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {[["OD", orden.recetaOd], ["OI", orden.recetaOi]].map(([ojo, r]) => (
                  <tr key={ojo}><td className="px-3 py-1.5 font-sans font-bold text-blue-700">{ojo}</td>{medida(r).map((m, i) => <td key={i} className="px-3 py-1.5 text-right">{m}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-sm text-slate-600">DP lejos {orden.dpLejos || "—"} · DP cerca {orden.dpCerca || "—"} · Altura de montaje {orden.alturaMontaje || "—"}</p>
        </Bloque>

        <Bloque titulo="Historial de estados">
          {historial === null ? (
            <p className="text-sm text-slate-500">Cargando…</p>
          ) : historial.length === 0 ? (
            <p className="text-sm text-slate-500">Todavía no hay cambios de estado.</p>
          ) : (
            <ol className="space-y-1 text-sm text-slate-600" aria-label="Historial de la orden">
              {historial.map((h, i) => (
                <li key={i}><span className="font-semibold text-slate-800">{ETIQUETA_ESTADO[h.estado]}</span> · {fechaHoraLegible(h.cambiado_en, { anio: true })} · {nombre(h.cambiado_por) || "Equipo"}{h.nota ? ` · ${h.nota}` : ""}</li>
              ))}
            </ol>
          )}
        </Bloque>
      </div>
    </Cascaron>
  )
}
