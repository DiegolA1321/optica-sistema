"use client"

import React, { useState, useMemo, useEffect } from "react"
import { createPortal } from "react-dom"
import {
  HeartHandshake,
  MessageSquare,
  Cake,
  Users,
  Clock,
  Star,
  Megaphone,
  Copy,
  Check,
  Send,
  Trash2,
  Zap,
  CheckCircle2,
  X,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
} from "lucide-react"
import { diasDesdeUltimaVisita, esInactivo, esClienteFrecuente, contarConsultas } from "../utilidades/fidelizacion"
import { supabase } from "../lib/supabaseClient"

// ─── Paleta de firma (consistente con el resto del sistema) ───
const INK = "#0E2B33"
const GRAD = "linear-gradient(135deg,#22D3EE,#2563EB)" // cian → azul

// Ventana de cumpleaños: devuelve la diferencia en días si cae entre -5 y +7 (si no, null)
const diffCumpleEnVentana = (mes, dia) => {
  if (!mes || !dia) return null
  const hoy0 = new Date()
  hoy0.setHours(0, 0, 0, 0)
  const y = hoy0.getFullYear()
  const candidatos = [new Date(y - 1, mes - 1, dia), new Date(y, mes - 1, dia), new Date(y + 1, mes - 1, dia)]
  let mejor = null
  for (const c of candidatos) {
    c.setHours(0, 0, 0, 0)
    const d = Math.round((c - hoy0) / 86400000)
    if (d >= -5 && d <= 7) {
      if (mejor === null || Math.abs(d) < Math.abs(mejor)) mejor = d
    }
  }
  return mejor
}

export default function CRM({ usuario, pacientes = [], consultas = [], parametrizacion, setParametrizacion }) {
  // Procesamiento conectado y en tiempo real
  const prospectosDinamicos = useMemo(() => {
    return pacientes.map((p) => {
      let estado = "Paciente activo"
      let motivo = "Mantener contacto postventa."
      let tipo = "Seguimiento"
      let dias = "Activo"

      const fn = p.fechaNacimiento || p.fecha_nacimiento
      let esCumple = false
      let diaCumple = 0
      if (fn) {
        const partes = fn.split(/[-/T]/)
        const mes = Number(partes[1])
        const dia = Number(partes[2])
        const d = diffCumpleEnVentana(mes, dia)
        if (d !== null) {
          esCumple = true
          diaCumple = d
          tipo = "Felicitar"
          if (d === 0) {
            estado = "Cumpleaños hoy"
            dias = "Hoy"
            motivo = "¡Hoy es su cumpleaños! Salúdalo y ofrécele una promoción especial."
          } else if (d > 0) {
            estado = `Cumple en ${d} día${d > 1 ? "s" : ""}`
            dias = `En ${d} día${d > 1 ? "s" : ""}`
            motivo = `Su cumpleaños es en ${d} día${d > 1 ? "s" : ""}. Buen momento para un detalle.`
          } else {
            const abs = Math.abs(d)
            estado = `Cumplió hace ${abs} día${abs > 1 ? "s" : ""}`
            dias = `Hace ${abs} día${abs > 1 ? "s" : ""}`
            motivo = `Cumplió años hace ${abs} día${abs > 1 ? "s" : ""}. Un saludo tardío también fideliza.`
          }
        }
      }

      const diasInactivo = diasDesdeUltimaVisita(p, consultas)
      const numConsultas = contarConsultas(p, consultas)
      // Valor numérico para ordenar en "Ver detalles" — depende del tipo:
      // cercanía de cumpleaños (0 = hoy), meses de inactividad, o frecuencia
      // de atención (caso de la reunión con el ing).
      let ordenValor = esCumple ? diaCumple : 0

      if (!esCumple && esInactivo(p, consultas)) {
        tipo = "Inactivo"
        estado = `Sin visitar hace ${diasInactivo} días`
        dias = `Hace ${diasInactivo} días`
        motivo = "Ya se venció su control visual recomendado. Ofrécele agendar una revisión."
        ordenValor = diasInactivo ?? 0
      } else if (!esCumple && esClienteFrecuente(p, consultas)) {
        tipo = "Fiel"
        estado = `Paciente frecuente · ${numConsultas} consultas`
        dias = "Fiel"
        motivo = "Te ha visitado varias veces. Un buen momento para agradecerle su confianza."
        ordenValor = numConsultas
      }

      return {
        id: p.id,
        paciente: p.nombre,
        estado,
        motivo,
        telefono: p.telefono || p.contacto || p.celular || "",
        tipo,
        dias,
        numConsultas,
        cumpleHoy: esCumple && dias === "Hoy",
        saludoEnviadoEsteAnio: p.ultimoSaludoCumpleAnio === new Date().getFullYear(),
        ordenValor,
      }
    })
  }, [pacientes, consultas])

  // Tres bloques curados (top 5 cada uno) en vez de una sola lista con los
  // 100+ pacientes de la óptica — caso de la reunión con el ing. Cada uno
  // ordenado por lo más relevante de esa categoría; "Ver detalles" reordena
  // sobre la lista completa, no solo el top 5.
  const listaFieles = useMemo(() => prospectosDinamicos.filter((p) => p.tipo === "Fiel").sort((a, b) => b.ordenValor - a.ordenValor), [prospectosDinamicos])
  const listaCumpleanos = useMemo(() => prospectosDinamicos.filter((p) => p.tipo === "Felicitar").sort((a, b) => Math.abs(a.ordenValor) - Math.abs(b.ordenValor)), [prospectosDinamicos])
  const listaInactivos = useMemo(() => prospectosDinamicos.filter((p) => p.tipo === "Inactivo").sort((a, b) => b.ordenValor - a.ordenValor), [prospectosDinamicos])

  const [detalleAbierto, setDetalleAbierto] = useState(null) // "fieles" | "cumpleanos" | "inactivos" | null

  // Avisos globales (anuncios para todos los pacientes: cierres, promociones,
  // etc.) — antes vivían solo en localStorage (CRM.jsx no llamaba nunca a
  // Supabase): un aviso publicado por un admin era invisible para un
  // asistente en otra máquina, y se perdía si se limpiaba el navegador.
  const [avisos, setAvisos] = useState([])
  const [nuevoAviso, setNuevoAviso] = useState("")
  const [avisoDestinoId, setAvisoDestinoId] = useState("")
  const [avisoError, setAvisoError] = useState("")
  const [copiadoAviso, setCopiadoAviso] = useState(null)

  useEffect(() => {
    if (!supabase || !usuario?.opticaId) return
    supabase.from("avisos").select("*").eq("optica_id", usuario.opticaId).order("created_at", { ascending: false }).then(({ data }) => {
      if (!data) return
      setAvisos(data.map((a) => ({
        id: a.id, texto: a.texto, fecha: new Date(a.created_at).toLocaleDateString("es-EC", { day: "numeric", month: "short", year: "numeric" }),
        destinatarioId: a.destinatario_id, destinatarioNombre: a.destinatario_nombre, destinatarioTelefono: a.destinatario_telefono,
      })))
    })
  }, [usuario?.opticaId])

  // Saludo automático de cumpleaños: preferencia on/off del administrador,
  // parte de la parametrización de la óptica (mismo mecanismo ya usado para
  // "mostrar medidas", etc.) — así es la misma preferencia sin importar
  // quién ni desde dónde entre. El envío en sí ya no es un mockup: lo manda
  // de verdad un cron diario por correo (enviar_saludos_cumpleanos, ver
  // migración 0033) a quien tenga cumpleAuto activo y el paciente tenga
  // correo real; "saludoEnviadoEsteAnio" (arriba, en prospectosDinamicos)
  // refleja si ese envío ya ocurrió este año, no un candado local.
  const cumpleAuto = parametrizacion?.cumpleAuto === true
  const setCumpleAuto = (valorOFn) => setParametrizacion?.((prev) => ({
    ...prev,
    cumpleAuto: typeof valorOFn === "function" ? valorOFn(prev?.cumpleAuto === true) : valorOFn,
  }))

  const publicarAviso = async () => {
    if (!nuevoAviso.trim()) return
    const destinatario = avisoDestinoId ? pacientes.find((p) => p.id === avisoDestinoId) : null
    const aviso = {
      texto: nuevoAviso.trim(),
      fecha: new Date().toLocaleDateString("es-EC", { day: "numeric", month: "short", year: "numeric" }),
      destinatarioId: destinatario?.id || null,
      destinatarioNombre: destinatario?.nombre || null,
      destinatarioTelefono: destinatario?.telefono || destinatario?.contacto || destinatario?.celular || "",
    }
    if (supabase && usuario?.opticaId) {
      const { data, error } = await supabase.from("avisos").insert({
        optica_id: usuario.opticaId, texto: aviso.texto,
        destinatario_id: typeof aviso.destinatarioId === "string" ? aviso.destinatarioId : null,
        destinatario_nombre: aviso.destinatarioNombre, destinatario_telefono: aviso.destinatarioTelefono,
      }).select().single()
      if (error) {
        setAvisoError("No se pudo publicar el aviso. Revisa tu conexión e intenta de nuevo.")
        return
      }
      if (data) aviso.id = data.id
    }
    if (aviso.id == null) aviso.id = Date.now()
    setAvisoError("")
    setAvisos([aviso, ...avisos])
    setNuevoAviso("")
    setAvisoDestinoId("")
  }

  const copiarAviso = (aviso) => {
    navigator.clipboard.writeText(aviso.texto)
    setCopiadoAviso(aviso.id)
    setTimeout(() => setCopiadoAviso(null), 2000)
  }

  const eliminarAviso = async (id) => {
    if (supabase && usuario?.opticaId) {
      const { error } = await supabase.from("avisos").delete().eq("id", id)
      if (error) {
        setAvisoError("No se pudo eliminar el aviso. Revisa tu conexión e intenta de nuevo.")
        return
      }
    }
    setAvisoError("")
    setAvisos(avisos.filter((a) => a.id !== id))
  }

  // Envío por WhatsApp con prefijo internacional (Ecuador)
  const enviarRecordatorio = (nombre, motivo, telefono) => {
    let numeroLimpio = (telefono || "").replace(/\D/g, "")
    if (numeroLimpio.startsWith("0")) {
      numeroLimpio = "593" + numeroLimpio.substring(1)
    }
    if (!numeroLimpio.startsWith("593") && numeroLimpio.length === 9) {
      numeroLimpio = "593" + numeroLimpio
    }
    const texto = `Hola ${nombre}, te saludamos de ${usuario?.opticaNombre || "tu óptica"}. Queremos recordarte: ${motivo} ¡Escríbenos para agendar tu cita!`
    const url = `https://api.whatsapp.com/send?phone=${numeroLimpio}&text=${encodeURIComponent(texto)}`
    window.open(url, "_blank")
  }

  const METRICAS = [
    { icon: Users, valor: pacientes.length, label: "Total de pacientes", tile: GRAD, tileText: "#fff" },
    { icon: Cake, valor: listaCumpleanos.length, label: "Cumpleaños cercanos", tile: "#fef3c7", tileText: "#b45309" },
    { icon: Clock, valor: listaInactivos.length, label: "Sin visitar hace tiempo", tile: "#fee2e2", tileText: "#dc2626" },
    { icon: Star, valor: listaFieles.length, label: "Pacientes frecuentes", tile: "#ecfdf5", tileText: "#059669" },
  ]

  return (
    <div className="w-full space-y-6 text-left" style={{ animation: "rise-in 320ms ease-out both" }}>
      {/* ─── HEADER ─── */}
      <div className="flex items-start gap-3.5">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white" style={{ background: GRAD, boxShadow: "0 12px 24px -10px rgba(37,99,235,0.6)" }}>
          <HeartHandshake size={24} />
        </div>
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight" style={{ color: INK }}>CRM y fidelización</h1>
          <p className="text-sm text-slate-500">Cumpleaños, inactividad, pacientes fieles y comunicación con tus pacientes.</p>
        </div>
      </div>

      {/* ─── MÉTRICAS (también filtran) ─── */}
      <div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {METRICAS.map((m, i) => (
            <div
              key={m.label}
              className="flex items-center justify-between rounded-2xl border bg-white p-5"
              style={{ borderColor: "rgba(14,43,51,0.08)", boxShadow: "0 1px 2px rgba(14,43,51,0.04)", animation: "rise-in 320ms ease-out both", animationDelay: `${i * 50}ms` }}
            >
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{m.label}</p>
                <p className="mt-1 text-3xl font-black" style={{ color: INK }}>{m.valor}</p>
              </div>
              <div className="grid h-12 w-12 place-items-center rounded-2xl" style={{ background: m.tile, color: m.tileText }}>
                <m.icon size={22} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── SALUDO AUTOMÁTICO DE CUMPLEAÑOS (configurable por el administrador) ─── */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: "linear-gradient(135deg,#e0b64e,#b45309)" }}>
            <Zap size={17} />
          </span>
          <div>
            <h4 className="text-sm font-bold" style={{ color: INK }}>Saludo automático de cumpleaños</h4>
            <p className="text-[11px] text-slate-500">
              {cumpleAuto
                ? "Activo: el día del cumpleaños le mandamos un correo de saludo automático a quien tenga correo registrado, sin que tengas que hacerlo manualmente."
                : "Apagado: tú decides a quién saludar con el botón \"Notificar WhatsApp\" de la lista."}
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={cumpleAuto}
          aria-label="Saludo automático de cumpleaños"
          onClick={() => setCumpleAuto((v) => !v)}
          className={"relative h-7 w-12 shrink-0 self-start rounded-full transition-colors cursor-pointer sm:self-auto " + (cumpleAuto ? "" : "bg-slate-200")}
          style={cumpleAuto ? { background: GRAD } : undefined}
        >
          <span className={"absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all " + (cumpleAuto ? "left-6" : "left-1")} />
        </button>
      </div>

      {/* ─── TRES BLOQUES CURADOS (top 5 cada uno) ─── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <BloqueContacto
          titulo="Pacientes más atendidos"
          icono={Star}
          bgIcono="linear-gradient(135deg,#34d399,#059669)"
          lista={listaFieles}
          cumpleAuto={cumpleAuto}
          onEnviar={(p) => enviarRecordatorio(p.paciente, p.motivo, p.telefono)}
          onVerDetalles={() => setDetalleAbierto("fieles")}
          vacioTexto="Todavía nadie cruza el mínimo de consultas para ser paciente frecuente."
        />
        <BloqueContacto
          titulo="Cumpleaños próximos"
          icono={Cake}
          bgIcono="linear-gradient(135deg,#e0b64e,#b45309)"
          lista={listaCumpleanos}
          cumpleAuto={cumpleAuto}
          onEnviar={(p) => enviarRecordatorio(p.paciente, p.motivo, p.telefono)}
          onVerDetalles={() => setDetalleAbierto("cumpleanos")}
          vacioTexto="Ningún paciente cumple años en los próximos días."
        />
        <BloqueContacto
          titulo="Sin visitar hace tiempo"
          icono={Clock}
          bgIcono="linear-gradient(135deg,#f87171,#dc2626)"
          lista={listaInactivos}
          cumpleAuto={cumpleAuto}
          onEnviar={(p) => enviarRecordatorio(p.paciente, p.motivo, p.telefono)}
          onVerDetalles={() => setDetalleAbierto("inactivos")}
          vacioTexto="No hay pacientes con el control vencido por ahora."
        />
      </div>

      {detalleAbierto && (
        <ModalDetalleCRM
          config={
            detalleAbierto === "fieles"
              ? { titulo: "Pacientes más atendidos", icono: Star, bgIcono: "linear-gradient(135deg,#34d399,#059669)", lista: listaFieles, columnaLabel: "Consultas", columnaValor: (p) => p.numConsultas, dirDefecto: "desc" }
              : detalleAbierto === "cumpleanos"
              ? { titulo: "Cumpleaños próximos", icono: Cake, bgIcono: "linear-gradient(135deg,#e0b64e,#b45309)", lista: listaCumpleanos, columnaLabel: "Cuándo", columnaValor: (p) => p.dias, dirDefecto: "asc", ordenAbsoluto: true }
              : { titulo: "Sin visitar hace tiempo", icono: Clock, bgIcono: "linear-gradient(135deg,#f87171,#dc2626)", lista: listaInactivos, columnaLabel: "Días sin visitar", columnaValor: (p) => p.ordenValor, dirDefecto: "desc" }
          }
          cumpleAuto={cumpleAuto}
          onEnviar={(p) => enviarRecordatorio(p.paciente, p.motivo, p.telefono)}
          onCerrar={() => setDetalleAbierto(null)}
        />
      )}

      {/* ─── AVISOS ─── */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/70 p-4">
            <span className="grid h-9 w-9 place-items-center rounded-xl text-white" style={{ background: GRAD }}><Megaphone size={18} /></span>
            <div>
              <h4 className="text-sm font-bold" style={{ color: INK }}>Avisos</h4>
              <p className="text-[11px] text-slate-500">Cierres, promociones o un mensaje puntual para un paciente</p>
            </div>
          </div>

          <div className="space-y-3 p-4">
            <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1 shadow-inner">
              <button
                type="button"
                onClick={() => setAvisoDestinoId("")}
                className={"flex-1 rounded-xl px-3 py-2 text-xs font-bold transition-all cursor-pointer " + (!avisoDestinoId ? "bg-white shadow-sm" : "text-slate-500 hover:text-slate-700")}
                style={!avisoDestinoId ? { color: INK } : undefined}
              >
                Todos los pacientes
              </button>
              <button
                type="button"
                onClick={() => setAvisoDestinoId(pacientes[0]?.id || "")}
                className={"flex-1 rounded-xl px-3 py-2 text-xs font-bold transition-all cursor-pointer " + (avisoDestinoId ? "bg-white shadow-sm" : "text-slate-500 hover:text-slate-700")}
                style={avisoDestinoId ? { color: INK } : undefined}
              >
                Un paciente puntual
              </button>
            </div>
            {avisoDestinoId && (
              <select
                value={avisoDestinoId}
                onChange={(e) => setAvisoDestinoId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
              >
                {pacientes.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            )}
            <textarea
              value={nuevoAviso}
              onChange={(e) => setNuevoAviso(e.target.value)}
              rows={2}
              placeholder={avisoDestinoId ? "Ej. Tu armazón ya llegó, podés pasar a retirarlo cuando quieras." : "Ej. Cerraremos el sábado 22 por mantenimiento. Reprogramaremos tu cita sin costo."}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
            />
            <button
              type="button"
              onClick={publicarAviso}
              disabled={!nuevoAviso.trim()}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
              style={{ background: GRAD }}
            >
              <Send size={14} /> {avisoDestinoId ? "Publicar aviso puntual" : "Publicar aviso"}
            </button>
            <p className="text-[11px] text-slate-500">
              El sistema aún no envía mensajes automáticos: copia el aviso y pégalo en tu difusión de WhatsApp, o enviaselo directo al paciente si elegiste uno puntual.
            </p>
            {avisoError && <p className="text-[11px] font-semibold text-red-600">{avisoError}</p>}

            {avisos.length > 0 && (
              <div className="max-h-52 space-y-2 overflow-y-auto border-t border-slate-100 pt-3">
                {avisos.map((a) => (
                  <div key={a.id} className="flex items-start justify-between gap-2 rounded-lg bg-slate-50 p-2.5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {a.destinatarioNombre ? (
                          <span className="rounded-full px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider" style={{ backgroundColor: "#eff6ff", color: "#1d4ed8", border: "1px solid #dbeafe" }}>
                            Para: {a.destinatarioNombre}
                          </span>
                        ) : (
                          <span className="rounded-full px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider" style={{ backgroundColor: "#fef3c7", color: "#92600f", border: "1px solid #fde68a" }}>
                            General
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-slate-700">{a.texto}</p>
                      <p className="mt-0.5 text-[10px] text-slate-500">{a.fecha}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {a.destinatarioNombre && (
                        <button
                          type="button"
                          onClick={() => enviarRecordatorio(a.destinatarioNombre, a.texto, a.destinatarioTelefono)}
                          disabled={!a.destinatarioTelefono}
                          title={a.destinatarioTelefono ? "Enviar por WhatsApp" : "Sin número registrado"}
                          aria-label={a.destinatarioTelefono ? "Enviar por WhatsApp" : "Sin número registrado"}
                          className="rounded-md p-1.5 text-slate-500 transition hover:bg-white hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                        >
                          <MessageSquare size={13} />
                        </button>
                      )}
                      <button type="button" onClick={() => copiarAviso(a)} title="Copiar mensaje" aria-label="Copiar mensaje" className="rounded-md p-1.5 text-slate-500 transition hover:bg-white hover:text-blue-600 cursor-pointer">
                        {copiadoAviso === a.id ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                      </button>
                      <button type="button" onClick={() => eliminarAviso(a.id)} title="Eliminar" aria-label="Eliminar aviso" className="rounded-md p-1.5 text-slate-500 transition hover:bg-white hover:text-red-600 cursor-pointer">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
    </div>
  )
}

// ─── Bloque curado (top 5) — pacientes más atendidos / cumpleaños / inactivos ───
// Mismo componente para los tres: la fila de contacto (nombre, estado,
// WhatsApp) es idéntica, solo cambian los datos que recibe.
function BloqueContacto({ titulo, icono: Icono, bgIcono, lista, cumpleAuto, onEnviar, onVerDetalles, vacioTexto }) {
  const top5 = lista.slice(0, 5)
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/70 p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: bgIcono }}><Icono size={18} /></span>
          <div>
            <h4 className="text-sm font-bold" style={{ color: INK }}>{titulo}</h4>
            <p className="text-[11px] text-slate-500">{lista.length} en total</p>
          </div>
        </div>
        {lista.length > 5 && (
          <button type="button" onClick={onVerDetalles} className="shrink-0 text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">
            Ver detalles
          </button>
        )}
      </div>
      <div className="flex-1 divide-y divide-slate-100">
        {top5.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-300"><Icono size={18} /></div>
            <p className="text-xs font-medium text-slate-500">{vacioTexto}</p>
          </div>
        ) : (
          top5.map((p) => <FilaContacto key={p.id} prospecto={p} cumpleAuto={cumpleAuto} onEnviar={onEnviar} />)
        )}
      </div>
    </div>
  )
}

function FilaContacto({ prospecto: p, cumpleAuto, onEnviar }) {
  return (
    <div className="flex items-center justify-between gap-2 p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-slate-800">{p.paciente}</p>
        <p className="truncate text-[11px] text-slate-500">{p.estado}</p>
      </div>
      {p.cumpleHoy && cumpleAuto && p.saludoEnviadoEsteAnio ? (
        <span className="flex shrink-0 items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-bold text-emerald-700" title="El correo de saludo automático ya se envió este año">
          <CheckCircle2 size={11} /> Enviado
        </span>
      ) : (
        <button
          type="button"
          onClick={() => onEnviar(p)}
          disabled={!p.telefono}
          title={p.telefono ? "Enviar por WhatsApp" : "Sin número registrado"}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[10px] font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
        >
          <MessageSquare size={11} /> WhatsApp
        </button>
      )}
    </div>
  )
}

// ─── Modal "Ver detalles" — tabla completa, ordenable ───
// Caso de la reunión con el ing: cada bloque tiene su botón "Ver detalles"
// con la tabla completa, ordenable (cercanía de cumpleaños, frecuencia de
// atención, meses de inactividad).
function ModalDetalleCRM({ config, cumpleAuto, onEnviar, onCerrar }) {
  const { titulo, icono: Icono, bgIcono, lista, columnaLabel, columnaValor, dirDefecto, ordenAbsoluto } = config
  const [orden, setOrden] = useState({ campo: "metrica", dir: dirDefecto })

  const ordenadas = useMemo(() => {
    const valorMetrica = (p) => (ordenAbsoluto ? Math.abs(p.ordenValor) : p.ordenValor)
    const arr = [...lista]
    arr.sort((a, b) => {
      const va = orden.campo === "paciente" ? a.paciente.toLowerCase() : valorMetrica(a)
      const vb = orden.campo === "paciente" ? b.paciente.toLowerCase() : valorMetrica(b)
      if (va < vb) return orden.dir === "asc" ? -1 : 1
      if (va > vb) return orden.dir === "asc" ? 1 : -1
      return 0
    })
    return arr
  }, [lista, orden, ordenAbsoluto])

  const cambiarOrden = (campo) => {
    setOrden((prev) => (prev.campo === campo ? { campo, dir: prev.dir === "asc" ? "desc" : "asc" } : { campo, dir: campo === "paciente" ? "asc" : dirDefecto }))
  }

  const IconoOrden = ({ campo }) => {
    if (orden.campo !== campo) return <ArrowUpDown size={11} className="text-slate-300" />
    return orden.dir === "asc" ? <ChevronUp size={11} /> : <ChevronDown size={11} />
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm" style={{ backgroundColor: "rgba(14,43,51,0.55)", animation: "overlay-in 150ms ease-out" }} onClick={onCerrar}>
      <div className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" style={{ animation: "modal-in 180ms cubic-bezier(0.16,1,0.3,1)", willChange: "transform, opacity" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: bgIcono }}>
              <Icono size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: INK }}>{titulo}</h2>
              <p className="text-xs text-slate-500">{lista.length} paciente{lista.length === 1 ? "" : "s"}</p>
            </div>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-600 cursor-pointer">
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 bg-slate-50">
              <tr className="border-b border-slate-100 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                <th className="cursor-pointer select-none px-4 py-3" onClick={() => cambiarOrden("paciente")}>
                  <span className="flex items-center gap-1">Paciente <IconoOrden campo="paciente" /></span>
                </th>
                <th className="cursor-pointer select-none px-4 py-3" onClick={() => cambiarOrden("metrica")}>
                  <span className="flex items-center gap-1">{columnaLabel} <IconoOrden campo="metrica" /></span>
                </th>
                <th className="px-4 py-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ordenadas.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-2.5 font-semibold text-slate-800">{p.paciente}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-600">{columnaValor(p)}</td>
                  <td className="px-4 py-2.5 text-right">
                    {p.cumpleHoy && cumpleAuto && p.saludoEnviadoEsteAnio ? (
                      <span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                        <CheckCircle2 size={11} /> Enviado
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onEnviar(p)}
                        disabled={!p.telefono}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                      >
                        <MessageSquare size={11} /> WhatsApp
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-100 p-4">
          <button type="button" onClick={onCerrar} className="w-full rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 cursor-pointer">
            Cerrar
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
