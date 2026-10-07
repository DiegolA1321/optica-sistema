"use client"

import { useEffect, useMemo, useState } from "react"
import { FlaskConical, Printer, Pencil, MessageCircle, ChevronDown, Plus, ArrowRight, Undo2, AlertTriangle, CheckCircle2 } from "lucide-react"
import { supabase } from "../lib/supabaseClient"
import { INK } from "@/lib/tema"
import { fechaLegible } from "../utilidades/formatoFecha"
import { linkWhatsApp } from "../utilidades/whatsapp"
import { MENSAJE_SIN_PERMISO, esErrorSinPermiso } from "../utilidades/permisos"
import { imprimirHtml, datosOpticaProforma } from "../utilidades/proforma"
import { registrarLog } from "../utilidades/logs"
import { puede } from "../utilidades/permisosUi"
import OrdenLaboratorioModal from "./OrdenLaboratorioModal"
import { numeroComprobante } from "../utilidades/comprobantes"
import EntregaConSaldoModal from "./EntregaConSaldoModal"
import { saldoFactura, saldoPacienteFacturas } from "../utilidades/abonos"
import {
  ETIQUETA_ESTADO, numeroOrden, estadoVisible, diasDeAtraso, tratamientos, atrasosPorLaboratorio, laboratoriosUsados,
  ordenesAbiertas, ordenesAtrasadas, armarHtmlOrdenDosCopias, mensajeLentesListos, TIPOS_LENTE,
} from "../utilidades/ordenesLaboratorio"

const CLASE_ESTADO = {
  enviada: "bg-blue-50 text-blue-700 border-blue-200/60",
  lista: "bg-emerald-50 text-emerald-700 border-emerald-200/60",
  entregada: "bg-slate-100 text-slate-600 border-slate-200/60",
  cancelada: "bg-slate-100 text-slate-500 border-slate-200/60",
  atrasada: "bg-red-50 text-red-700 border-red-200/60",
}
const SIGUIENTE = { enviada: { estado: "lista", texto: "Marcar lista" }, lista: { estado: "entregada", texto: "Marcar entregada" } }
const ANTERIOR = { lista: "enviada", entregada: "lista" }
const FILTROS = [
  { id: "abiertas", label: "Abiertas" },
  { id: "atrasadas", label: "Atrasadas" },
  { id: "listas", label: "Listas" },
  { id: "entregadas", label: "Entregadas" },
  { id: "todas", label: "Todas" },
]
const aplicarFiltro = (ordenes, filtro) => {
  if (filtro === "abiertas") return ordenesAbiertas(ordenes)
  if (filtro === "atrasadas") return ordenesAtrasadas(ordenes)
  if (filtro === "listas") return ordenes.filter((o) => o.estado === "lista")
  if (filtro === "entregadas") return ordenes.filter((o) => o.estado === "entregada")
  return ordenes
}

// Órdenes de laboratorio: lista con filtros por estado y por laboratorio, cambio de
// estado con responsable, copias impresas y aviso al paciente por WhatsApp (R36-R37).
export default function OrdenesLaboratorio({ ordenes, setOrdenes, pacientes = [], equipo = [], usuario, pacienteFijo = null, filtroInicial = "abiertas", facturas = [], abonos = [], onAbonar, onAviso, onVerPerfil }) {
  const puedeEditar = puede(usuario, "ventas", "editar")
  const puedeCrear = puede(usuario, "ventas", "crear")
  const propias = useMemo(() => (pacienteFijo ? ordenes.filter((o) => o.pacienteId === pacienteFijo.id) : ordenes), [ordenes, pacienteFijo])
  const [filtro, setFiltro] = useState(filtroInicial)
  const [laboratorio, setLaboratorio] = useState("")
  const [editando, setEditando] = useState(null)
  const [entregaConSaldo, setEntregaConSaldo] = useState(null) // orden que se quiere entregar con saldo pendiente
  const [otraDe, setOtraDe] = useState(null) // orden de cuya venta se crea otra (segundo par)
  const [trabajando, setTrabajando] = useState(null)
  const [abierta, setAbierta] = useState(null)
  const [historial, setHistorial] = useState({})
  const [datosOptica, setDatosOptica] = useState(datosOpticaProforma({}))

  useEffect(() => { setFiltro(filtroInicial) }, [filtroInicial])
  useEffect(() => {
    if (!supabase || !usuario?.opticaId) return
    let vivo = true
    supabase.from("opticas").select("settings").eq("id", usuario.opticaId).maybeSingle().then(({ data }) => { if (vivo && data) setDatosOptica(datosOpticaProforma(data.settings)) })
    return () => { vivo = false }
  }, [usuario?.opticaId])

  const laboratorios = useMemo(() => laboratoriosUsados(propias), [propias])
  const atrasos = useMemo(() => atrasosPorLaboratorio(propias), [propias])
  const visibles = useMemo(
    () => aplicarFiltro(propias, filtro).filter((o) => !laboratorio || o.laboratorio === laboratorio).sort((a, b) => (a.fechaPrometida < b.fechaPrometida ? -1 : a.fechaPrometida > b.fechaPrometida ? 1 : b.numero - a.numero)),
    [propias, filtro, laboratorio],
  )
  const nombreDe = (id) => equipo.find((m) => m.id === id)?.nombre || (id === usuario?.id ? usuario?.nombre : null) || "Equipo"
  const pacienteDe = (o) => pacienteFijo || pacientes.find((p) => p.id === o.pacienteId) || null
  const reemplazar = (id, cambios) => setOrdenes?.((prev) => prev.map((o) => (o.id === id ? { ...o, ...cambios } : o)))
  const falla = (error, texto) => onAviso?.(esErrorSinPermiso(error) ? MENSAJE_SIN_PERMISO : texto, "error")

  const facturaDe = (o) => facturas.find((f) => f.id === o.facturaId) || null
  const saldoDe = (o) => saldoFactura(facturaDe(o), abonos)

  // Entregar con saldo pendiente: antes de marcarla entregada se muestra lo que falta por cobrar.
  const pedirEstado = (o, estado) => {
    if (estado === "entregada" && saldoDe(o) > 0) { setEntregaConSaldo(o); return }
    cambiarEstado(o, estado)
  }

  const cambiarEstado = async (o, estado) => {
    setTrabajando(o.id)
    const { error } = supabase ? await supabase.rpc("cambiar_estado_orden", { p_orden_id: o.id, p_estado: estado }) : { error: null }
    setTrabajando(null)
    if (error) { falla(error, "No se pudo cambiar el estado. Revisa tu conexión e intenta de nuevo."); return }
    reemplazar(o.id, { estado, historial: [...(o.historial || []), { estado, cambiadoEn: new Date().toISOString() }], ...(estado === "enviada" || estado === "lista" ? { pacienteAvisadoEn: null, pacienteAvisadoPor: null } : {}) })
    setHistorial((h) => { const { [o.id]: _quitar, ...resto } = h; return resto })
    registrarLog(usuario, "pacientes", "Cambió el estado de una orden de laboratorio", `${numeroOrden(o.numero)} → ${ETIQUETA_ESTADO[estado]}`)
    onAviso?.(estado === "lista" ? `${numeroOrden(o.numero)} lista para entregar. Avísale al paciente.` : `${numeroOrden(o.numero)}: ${ETIQUETA_ESTADO[estado].toLowerCase()}.`)
  }

  const avisarPaciente = async (o) => {
    const p = pacienteDe(o)
    if (!p?.telefono) return
    setTrabajando(o.id)
    const { data, error } = supabase ? await supabase.rpc("registrar_aviso_paciente", { p_orden_id: o.id }) : { data: new Date().toISOString(), error: null }
    setTrabajando(null)
    if (error) { falla(error, "No se pudo registrar el aviso. Revisa tu conexión e intenta de nuevo."); return }
    window.open(linkWhatsApp(p.telefono, mensajeLentesListos({ paciente: p, opticaNombre: usuario?.opticaNombre, orden: o })), "_blank", "noopener")
    reemplazar(o.id, { pacienteAvisadoEn: data, pacienteAvisadoPor: usuario?.id || null })
    registrarLog(usuario, "pacientes", "Avisó al paciente que sus lentes están listos", `${p.nombre} · ${numeroOrden(o.numero)}`)
    onAviso?.(`Aviso a ${p.nombre} abierto en WhatsApp.`)
  }

  const imprimir = (o) => imprimirHtml(armarHtmlOrdenDosCopias({ opticaNombre: usuario?.opticaNombre, opticaDatos: datosOptica, paciente: pacienteDe(o) || {}, orden: { ...o, facturaNumero: facturaDe(o)?.numero != null ? numeroComprobante(facturaDe(o).numero) : "" } }))

  const alternarHistorial = async (o) => {
    if (abierta === o.id) { setAbierta(null); return }
    setAbierta(o.id)
    if (historial[o.id] || !supabase) return
    const { data } = await supabase.from("ordenes_laboratorio_historial").select("estado, cambiado_por, cambiado_en, nota").eq("orden_id", o.id).order("cambiado_en")
    setHistorial((h) => ({ ...h, [o.id]: data || [] }))
  }

  return (
    <section aria-label="Órdenes de laboratorio" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {FILTROS.map((f) => {
          const n = aplicarFiltro(propias, f.id).length
          const activo = filtro === f.id
          return (
            <button key={f.id} type="button" onClick={() => setFiltro(f.id)} aria-pressed={activo} className={"rounded-full border px-3 py-1 text-xs font-semibold transition-colors cursor-pointer " + (activo ? "border-transparent text-white" : "border-slate-200/60 bg-white text-slate-600 hover:bg-slate-50")} style={activo ? { backgroundColor: INK } : undefined}>
              {f.label}{f.id !== "todas" && n > 0 ? ` (${n})` : ""}
            </button>
          )
        })}
        {laboratorios.length > 0 && (
          <select aria-label="Filtrar por laboratorio" value={laboratorio} onChange={(e) => setLaboratorio(e.target.value)} className="ml-auto rounded-lg border border-slate-200/60 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 outline-none transition-colors focus-visible:border-blue-500">
            <option value="">Todos los laboratorios</option>
            {laboratorios.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        )}
      </div>

      {atrasos.length > 0 && !pacienteFijo && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-red-200/60 bg-red-50/60 px-3 py-2 text-xs text-red-800">
          <AlertTriangle size={14} aria-hidden="true" className="shrink-0" />
          <span className="font-semibold">Atrasos por laboratorio:</span>
          {atrasos.map((a) => (
            <button key={a.laboratorio} type="button" onClick={() => { setFiltro("atrasadas"); setLaboratorio(a.laboratorio === "Sin laboratorio" ? "" : a.laboratorio) }} className="rounded-full border border-red-200/60 bg-white px-2.5 py-0.5 font-semibold transition-colors hover:bg-red-100 cursor-pointer">
              {a.laboratorio}: {a.atrasadas}
            </button>
          ))}
        </div>
      )}

      {visibles.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-400"><FlaskConical size={24} aria-hidden="true" /></div>
          <p className="text-sm font-semibold text-slate-600">{propias.length === 0 ? "Aún no hay órdenes de laboratorio." : "No hay órdenes con este filtro."}</p>
          {propias.length === 0 && <p className="max-w-sm text-xs text-slate-500">Se crean al registrar una venta que incluye lentes.</p>}
        </div>
      ) : (
        <ul className="space-y-3">
          {visibles.map((o) => {
            const p = pacienteDe(o)
            const visible = estadoVisible(o)
            const sig = SIGUIENTE[o.estado]
            const trat = tratamientos(o)
            const ocupado = trabajando === o.id
            return (
              <li key={o.id} className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold" style={{ color: INK }}>{numeroOrden(o.numero)}</span>
                      <span className={"rounded-full border px-2.5 py-0.5 text-xs font-semibold " + CLASE_ESTADO[visible]}>
                        {visible === "atrasada" ? `Atrasada ${diasDeAtraso(o)} d` : ETIQUETA_ESTADO[visible]}
                      </span>
                      {saldoDe(o) > 0 && o.estado !== "cancelada" && <span className="rounded-full border border-amber-200/60 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">Saldo ${saldoDe(o).toFixed(2)}</span>}
                      {o.estado === "lista" && (o.pacienteAvisadoEn
                        ? <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/60 bg-white px-2.5 py-0.5 text-xs font-semibold text-emerald-700"><CheckCircle2 size={12} aria-hidden="true" /> Paciente avisado {fechaLegible(o.pacienteAvisadoEn)}</span>
                        : <span className="rounded-full border border-amber-200/60 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">Falta avisar al paciente</span>)}
                    </div>
                    {!pacienteFijo && (
                      <button type="button" onClick={() => p && onVerPerfil?.(p)} className="mt-1 block truncate text-left text-base font-bold transition-colors hover:text-blue-700 cursor-pointer" style={{ color: INK }}>{p?.nombre || "Paciente"}</button>
                    )}
                    <p className="mt-1 text-sm text-slate-700">
                      {TIPOS_LENTE.find((t) => t.id === o.tipoLente)?.label}{o.material ? ` · ${o.material}` : ""}{trat.length > 0 ? ` · ${trat.join(", ")}` : ""}
                    </p>
                    <p className="text-xs text-slate-500">
                      {o.montura ? `${o.montura} · ` : ""}{o.laboratorio ? `Laboratorio: ${o.laboratorio} · ` : "Sin laboratorio · "}Entrega prometida: <span className={visible === "atrasada" ? "font-semibold text-red-700" : ""}>{fechaLegible(o.fechaPrometida)}</span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {puedeEditar && o.estado === "lista" && (
                      <button type="button" onClick={() => avisarPaciente(o)} disabled={ocupado || !p?.telefono} title={p?.telefono ? "Abre WhatsApp con el mensaje de que sus lentes están listos" : "El paciente no tiene teléfono registrado"} className="flex items-center gap-1.5 rounded-xl border border-emerald-200/60 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50">
                        <MessageCircle size={14} aria-hidden="true" /> {o.pacienteAvisadoEn ? "Avisar de nuevo" : "Avisar por WhatsApp"}
                      </button>
                    )}
                    {puedeEditar && sig && (
                      <button type="button" onClick={() => pedirEstado(o, sig.estado)} disabled={ocupado} className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110 cursor-pointer disabled:opacity-60" style={{ background: "linear-gradient(135deg,#22D3EE,#2563EB)" }}>
                        {sig.texto} <ArrowRight size={14} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-slate-100 pt-2 text-xs font-semibold text-slate-500">
                  <button type="button" onClick={() => imprimir(o)} className="flex items-center gap-1 rounded-lg px-2 py-1 transition-colors hover:bg-slate-100 cursor-pointer"><Printer size={13} aria-hidden="true" /> Imprimir copias</button>
                  {puedeEditar && (o.estado === "enviada" || o.estado === "lista") && (
                    <button type="button" onClick={() => setEditando(o)} className="flex items-center gap-1 rounded-lg px-2 py-1 transition-colors hover:bg-slate-100 cursor-pointer"><Pencil size={13} aria-hidden="true" /> Editar</button>
                  )}
                  {puedeCrear && o.estado !== "cancelada" && (
                    <button type="button" onClick={() => setOtraDe(o)} title="Crear otra orden para la misma venta (por ejemplo, un segundo par)" className="flex items-center gap-1 rounded-lg px-2 py-1 transition-colors hover:bg-slate-100 cursor-pointer"><Plus size={13} aria-hidden="true" /> Otra orden</button>
                  )}
                  {puedeEditar && ANTERIOR[o.estado] && (
                    <button type="button" onClick={() => cambiarEstado(o, ANTERIOR[o.estado])} disabled={ocupado} className="flex items-center gap-1 rounded-lg px-2 py-1 transition-colors hover:bg-slate-100 cursor-pointer disabled:opacity-60"><Undo2 size={13} aria-hidden="true" /> Volver a "{ETIQUETA_ESTADO[ANTERIOR[o.estado]].toLowerCase()}"</button>
                  )}
                  <button type="button" onClick={() => alternarHistorial(o)} aria-expanded={abierta === o.id} className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 transition-colors hover:bg-slate-100 cursor-pointer">
                    Historial <ChevronDown size={13} className={"transition-transform " + (abierta === o.id ? "rotate-180" : "")} aria-hidden="true" />
                  </button>
                </div>
                {abierta === o.id && (
                  <ol className="mt-2 space-y-1 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600" aria-label="Historial de la orden">
                    {!historial[o.id] ? <li>Cargando…</li> : historial[o.id].map((h, i) => (
                      <li key={i}><span className="font-semibold">{ETIQUETA_ESTADO[h.estado]}</span> · {fechaLegible(h.cambiado_en)} {new Date(h.cambiado_en).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })} · {nombreDe(h.cambiado_por)}{h.nota ? ` · ${h.nota}` : ""}</li>
                    ))}
                  </ol>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {entregaConSaldo && (
        <EntregaConSaldoModal
          orden={entregaConSaldo}
          paciente={pacienteDe(entregaConSaldo)}
          saldo={saldoDe(entregaConSaldo)}
          saldoTotal={saldoPacienteFacturas(entregaConSaldo.pacienteId, facturas, abonos)}
          puedeCobrar={!!onAbonar && !!facturaDe(entregaConSaldo)}
          onCobrar={() => { const o = entregaConSaldo; setEntregaConSaldo(null); onAbonar(facturaDe(o), pacienteDe(o)) }}
          onEntregar={() => { const o = entregaConSaldo; setEntregaConSaldo(null); cambiarEstado(o, "entregada") }}
          onCancelar={() => setEntregaConSaldo(null)}
        />
      )}
      {otraDe && (
        <OrdenLaboratorioModal
          facturaId={otraDe.facturaId}
          consultaId={otraDe.consultaId}
          paciente={pacienteDe(otraDe)}
          usuario={usuario}
          opticaDatos={datosOptica}
          onCerrar={() => setOtraDe(null)}
        />
      )}
      {editando && (
        <OrdenLaboratorioModal
          orden={editando}
          paciente={pacienteDe(editando)}
          usuario={usuario}
          opticaDatos={datosOptica}
          onCerrar={() => setEditando(null)}
        />
      )}
    </section>
  )
}
