import { useEffect, useState } from "react"
import { MessageSquare, Megaphone, Send, Clock, AlertCircle, CheckCircle2, Wallet, Receipt, Printer } from "lucide-react"
import { supabase } from "../lib/supabaseClient"
import { imprimirDocumento, estilosImpresion } from "../utilidades/imprimir"

// ─── Paleta de firma ───
const INK = "#0E2B33"
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)" // cian → azul

const formatearFecha = (fecha) => new Date(fecha).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" })
const formatearFechaHora = (fecha) =>
  new Date(fecha).toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })

export default function Mensajes({ usuario }) {
  const [mensajes, setMensajes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [filtro, setFiltro] = useState("todas")

  const [asunto, setAsunto] = useState("")
  const [cuerpo, setCuerpo] = useState("")
  const [error, setError] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  // ─── Suscripción y facturas (misma óptica, solo lectura desde acá) ───
  const [optica, setOptica] = useState(null)
  const [facturas, setFacturas] = useState([])
  const [facturaImprimir, setFacturaImprimir] = useState(null)

  const cargarMensajes = async () => {
    if (!supabase) { setCargando(false); return }
    setCargando(true)
    const { data } = await supabase.from("mensajes").select("*").order("created_at", { ascending: false })
    setMensajes(data || [])
    setCargando(false)
  }

  const cargarSuscripcion = async () => {
    if (!supabase || !usuario?.opticaId) return
    const [{ data: opticaData }, { data: facturasData }] = await Promise.all([
      supabase.from("opticas").select("estado_pago, monto_mensual, proximo_vencimiento").eq("id", usuario.opticaId).single(),
      supabase.from("facturas").select("*").eq("optica_id", usuario.opticaId).order("emitida_at", { ascending: false }),
    ])
    setOptica(opticaData || null)
    setFacturas(facturasData || [])
  }

  useEffect(() => {
    cargarMensajes()
    cargarSuscripcion()
  }, [])

  const enviarConsulta = async (e) => {
    e.preventDefault()
    setError("")
    setEnviado(false)
    if (!asunto.trim() || !cuerpo.trim()) { setError("Completa el asunto y el mensaje."); return }
    if (!usuario?.opticaId) { setError("No se encontró tu óptica — recargá la página e intentá de nuevo."); return }
    setEnviando(true)
    const { data, error: errorInsert } = await supabase
      .from("mensajes")
      .insert({
        tipo: "consulta",
        optica_id: usuario.opticaId,
        remitente_id: usuario.id,
        remitente_nombre: usuario.nombre || "Administrador",
        asunto: asunto.trim(),
        cuerpo: cuerpo.trim(),
      })
      .select()
      .single()
    setEnviando(false)
    if (errorInsert) { setError(errorInsert.message); return }
    setMensajes((prev) => [data, ...prev])
    setAsunto("")
    setCuerpo("")
    setEnviado(true)
    setTimeout(() => setEnviado(false), 4000)
  }

  const estadoPago = optica?.estado_pago || "al_dia"
  const consultasAbiertas = mensajes.filter((m) => m.tipo === "consulta" && m.estado === "abierto").length
  const totalAvisos = mensajes.filter((m) => m.tipo === "anuncio").length
  const mensajesFiltrados = filtro === "todas" ? mensajes : mensajes.filter((m) => m.tipo === filtro)

  return (
    <div className="w-full space-y-6 text-left">
      <div className="flex items-center gap-3.5">
        <div className="grid h-12 w-12 place-items-center rounded-2xl text-white" style={{ background: GRAD, boxShadow: "0 12px 24px -10px rgba(37,99,235,0.6)" }}>
          <MessageSquare size={22} />
        </div>
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight" style={{ color: INK }}>Mensajes</h1>
          <p className="text-sm text-slate-500">Escribile al equipo de Diego Óptica y mirá los avisos generales.</p>
        </div>
      </div>

      {/* ─── Panel de control: tarjetas filtran la lista de abajo, mismo lenguaje visual que CRM.jsx ─── */}
      <div>
        <p className="mb-2 text-xs font-medium text-slate-500">Toca una tarjeta para filtrar tus mensajes</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setFiltro(filtro === "consulta" ? "todas" : "consulta")}
            className="flex items-center justify-between rounded-2xl border bg-white p-5 text-left transition-all hover:-translate-y-0.5 cursor-pointer"
            style={{
              borderColor: filtro === "consulta" ? "#2563EB" : "rgba(14,43,51,0.08)",
              boxShadow: filtro === "consulta" ? "0 0 0 3px rgba(37,99,235,0.14)" : "0 1px 2px rgba(14,43,51,0.04)",
            }}
          >
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Consultas abiertas</p>
              <p className="mt-1 text-3xl font-black leading-none" style={{ color: INK }}>{consultasAbiertas}</p>
              <p className="mt-1.5 text-[11px] font-semibold" style={{ color: consultasAbiertas > 0 ? "#B45309" : "#94A3B8" }}>{consultasAbiertas > 0 ? "esperando respuesta" : "todo al día"}</p>
            </div>
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ background: "#E8F0FF", color: "#2563EB" }}>
              <MessageSquare size={22} />
            </div>
          </button>

          <button
            type="button"
            onClick={() => setFiltro(filtro === "anuncio" ? "todas" : "anuncio")}
            className="flex items-center justify-between rounded-2xl border bg-white p-5 text-left transition-all hover:-translate-y-0.5 cursor-pointer"
            style={{
              borderColor: filtro === "anuncio" ? "#D97706" : "rgba(14,43,51,0.08)",
              boxShadow: filtro === "anuncio" ? "0 0 0 3px rgba(217,119,6,0.14)" : "0 1px 2px rgba(14,43,51,0.04)",
            }}
          >
            <div className="min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Avisos</p>
              <p className="mt-1 text-3xl font-black leading-none" style={{ color: INK }}>{totalAvisos}</p>
              <p className="mt-1.5 text-[11px] font-semibold text-slate-400">de Diego Óptica</p>
            </div>
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ background: "#FFF7E6", color: "#B45309" }}>
              <Megaphone size={22} />
            </div>
          </button>
        </div>
      </div>

      {/* ─── Suscripción — solo ocupa espacio si hay algo que atender ─── */}
      {estadoPago !== "al_dia" && (
        <div className="flex items-center justify-between gap-4 rounded-2xl border bg-white p-5" style={{ borderColor: estadoPago === "vencido" ? "#FECACA" : "#FDE68A", boxShadow: `0 0 0 3px ${estadoPago === "vencido" ? "rgba(225,29,72,0.08)" : "rgba(217,119,6,0.08)"}` }}>
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Suscripción</p>
            <p className="mt-1 text-lg font-black leading-tight" style={{ color: estadoPago === "vencido" ? "#BE123C" : "#B45309" }}>
              {estadoPago === "vencido" ? "Pago vencido" : "Pago pendiente"}
            </p>
            <p className="mt-1 text-[13px] font-semibold text-slate-500">
              {optica?.proximo_vencimiento ? <>Vencimiento: {formatearFecha(optica.proximo_vencimiento)}</> : "Escribinos si ya lo hiciste para confirmarlo."}
            </p>
          </div>
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ background: estadoPago === "vencido" ? "#FEE2E2" : "#FFF7E6", color: estadoPago === "vencido" ? "#BE123C" : "#B45309" }}>
            <Wallet size={22} />
          </div>
        </div>
      )}

      {facturas.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/70 p-4">
            <span className="grid h-9 w-9 place-items-center rounded-xl text-white" style={{ background: GRAD }}><Receipt size={18} /></span>
            <div>
              <h4 className="text-sm font-bold" style={{ color: INK }}>Tus facturas</h4>
              <p className="text-[11px] text-slate-500">Historial de facturación de tu suscripción</p>
            </div>
          </div>
          <div className="divide-y divide-slate-100">
            {facturas.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-2 p-4">
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs font-semibold text-slate-700">{f.numero}</p>
                  <p className="text-xs text-slate-500">{f.periodo} · ${Number(f.monto).toFixed(2)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <span
                    className="rounded-full px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider"
                    style={f.estado === "pagada" ? { backgroundColor: "#d1fae5", color: "#065f46", border: "1px solid #a7f3d0" } : { backgroundColor: "#fef3c7", color: "#92600f", border: "1px solid #fde68a" }}
                  >
                    {f.estado === "pagada" ? "Pagada" : "Pendiente"}
                  </span>
                  <button
                    type="button"
                    onClick={() => { setFacturaImprimir(f); setTimeout(() => imprimirDocumento("factura-imprimible-admin", "printing-factura-admin"), 50) }}
                    title="Imprimir factura"
                    className="rounded-lg p-1.5 text-slate-400 hover:bg-blue-50 hover:text-blue-600 cursor-pointer"
                  >
                    <Printer size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Nueva consulta ─── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/70 p-4">
          <span className="grid h-9 w-9 place-items-center rounded-xl text-white" style={{ background: GRAD }}><MessageSquare size={18} /></span>
          <div>
            <h4 className="text-sm font-bold" style={{ color: INK }}>Escribir una consulta</h4>
            <p className="text-[11px] text-slate-500">Le llega directo al equipo de Diego Óptica</p>
          </div>
        </div>
        <form onSubmit={enviarConsulta} className="space-y-3 p-4">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs font-medium text-red-700">
              <AlertCircle size={14} /> {error}
            </div>
          )}
          {enviado && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-xs font-medium text-emerald-700">
              <CheckCircle2 size={14} /> Mensaje enviado — te avisamos acá mismo cuando te respondan.
            </div>
          )}
          <input
            type="text" value={asunto} onChange={(e) => setAsunto(e.target.value)}
            placeholder="Asunto — ej. Necesito cambiar el nombre de mi óptica"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
          />
          <textarea
            rows={3} value={cuerpo} onChange={(e) => setCuerpo(e.target.value)}
            placeholder="Contanos qué necesitás…"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
          />
          <div className="flex justify-end">
            <button type="submit" disabled={enviando} className="flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 cursor-pointer disabled:opacity-60 disabled:hover:translate-y-0" style={{ background: GRAD, boxShadow: "0 12px 24px -12px rgba(37,99,235,0.6)" }}>
              <Send size={15} /> {enviando ? "Enviando…" : "Enviar"}
            </button>
          </div>
        </form>
      </div>

      {/* ─── Historial ─── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50/70 p-4">
          <h4 className="text-sm font-bold" style={{ color: INK }}>{filtro === "consulta" ? "Tus consultas" : filtro === "anuncio" ? "Avisos" : "Tus mensajes"}</h4>
          {!cargando && <span className="text-xs font-semibold text-slate-500">{mensajesFiltrados.length} {mensajesFiltrados.length === 1 ? "mensaje" : "mensajes"}</span>}
        </div>
        {cargando ? (
          <p className="py-14 text-center text-sm text-slate-400">Cargando…</p>
        ) : mensajesFiltrados.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-300"><MessageSquare size={24} /></div>
            <p className="text-sm font-medium text-slate-500">
              {filtro === "consulta" ? "Todavía no escribiste ninguna consulta." : filtro === "anuncio" ? "Todavía no hay avisos." : "Todavía no hay mensajes."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {mensajesFiltrados.map((m) => {
              const esAnuncio = m.tipo === "anuncio"
              return (
                <div key={m.id} className="flex items-start gap-3.5 p-4">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white" style={{ background: esAnuncio ? "linear-gradient(135deg,#e0b64e,#b45309)" : GRAD }}>
                    {esAnuncio ? <Megaphone size={17} /> : <MessageSquare size={17} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-slate-800">{m.asunto}</p>
                      {esAnuncio ? (
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider" style={{ backgroundColor: "#fef3c7", color: "#92600f", border: "1px solid #fde68a" }}>
                          Aviso
                        </span>
                      ) : (
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider"
                          style={m.estado === "abierto" ? { backgroundColor: "#fef3c7", color: "#92600f", border: "1px solid #fde68a" } : { backgroundColor: "#d1fae5", color: "#065f46", border: "1px solid #a7f3d0" }}
                        >
                          {m.estado === "abierto" ? "Esperando respuesta" : "Resuelto"}
                        </span>
                      )}
                    </div>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm text-slate-600">{m.cuerpo}</p>
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-400"><Clock size={11} /> {formatearFechaHora(m.created_at)}</p>

                    {m.respuesta && (
                      <div className="mt-3 rounded-xl border border-blue-100 bg-blue-50/60 p-3">
                        <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-blue-700">Respuesta</p>
                        <p className="whitespace-pre-wrap text-sm text-slate-700">{m.respuesta}</p>
                        {m.respondido_at && <p className="mt-1.5 text-xs text-slate-400">{formatearFechaHora(m.respondido_at)}</p>}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ─── Factura imprimible (oculta salvo al imprimir) ─── */}
      {facturaImprimir && (
        <div style={{ position: "fixed", left: "-9999px", top: 0 }}>
          <style>{estilosImpresion("printing-factura-admin")}</style>
          <div id="factura-imprimible-admin" className="w-[480px] bg-white p-8 text-sm text-slate-800">
            <div className="mb-6 flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <p className="text-lg font-bold" style={{ color: INK }}>Diego Óptica</p>
                <p className="text-xs text-slate-500">Sistema multi-óptica</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Factura</p>
                <p className="font-mono text-sm font-bold">{facturaImprimir.numero}</p>
              </div>
            </div>
            <div className="mb-6 grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Facturado a</p>
                <p className="font-semibold">{usuario?.opticaNombre || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Período</p>
                <p className="font-semibold">{facturaImprimir.periodo}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Emitida</p>
                <p className="font-semibold">{formatearFecha(facturaImprimir.emitida_at)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Estado</p>
                <p className="font-semibold">{facturaImprimir.estado === "pagada" ? "Pagada" : "Pendiente"}</p>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4">
              <p className="font-semibold">Suscripción mensual</p>
              <p className="text-lg font-bold" style={{ color: INK }}>${Number(facturaImprimir.monto).toFixed(2)}</p>
            </div>
            <button type="button" onClick={() => setFacturaImprimir(null)} className="no-print mt-6 text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">Cerrar</button>
          </div>
        </div>
      )}
    </div>
  )
}
