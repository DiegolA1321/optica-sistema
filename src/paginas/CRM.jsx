"use client"

import React, { useState, useMemo, useEffect } from "react"
import {
  HeartHandshake,
  MessageSquare,
  Cake,
  Users,
  Gift,
  ShieldAlert,
  Clock,
  Star,
  Award,
  Megaphone,
  Copy,
  Check,
  Send,
  Trash2,
  Zap,
  CheckCircle2,
} from "lucide-react"
import { diasDesdeUltimaVisita, esInactivo, esClienteFrecuente, contarConsultas, obtenerReferidos } from "../utilidades/fidelizacion"

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

function cargarAvisos() {
  try {
    const raw = localStorage.getItem("optica_crm_avisos")
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

// Preferencia del administrador: activar/desactivar el saludo automático de
// cumpleaños (feedback del asesor: debe ser configurable, no forzado).
function cargarCumpleAuto() {
  try {
    return localStorage.getItem("optica_crm_cumple_auto") === "true"
  } catch {
    return false
  }
}

// Registro de a quién ya se le "envió" el saludo automático hoy — evita
// reenviar el mismo saludo en cada re-render mientras sea su cumpleaños.
function cargarCumpleEnviados() {
  try {
    const raw = localStorage.getItem("optica_crm_cumple_enviados")
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export default function CRM({ pacientes = [], consultas = [] }) {
  const [filtro, setFiltro] = useState("Todos")

  // Procesamiento conectado y en tiempo real
  const prospectosDinamicos = useMemo(() => {
    return pacientes.map((p) => {
      let estado = "Cliente activo"
      let motivo = "Mantener contacto postventa."
      let tipo = "Seguimiento"
      let dias = "Activo"

      const fn = p.fechaNacimiento || p.fecha_nacimiento
      let esCumple = false
      if (fn) {
        const partes = fn.split(/[-/T]/)
        const mes = Number(partes[1])
        const dia = Number(partes[2])
        const d = diffCumpleEnVentana(mes, dia)
        if (d !== null) {
          esCumple = true
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

      if (!esCumple && esInactivo(p, consultas)) {
        tipo = "Inactivo"
        estado = `Sin visitar hace ${diasInactivo} días`
        dias = `Hace ${diasInactivo} días`
        motivo = "Ya se venció su control visual recomendado. Ofrécele agendar una revisión."
      } else if (!esCumple && esClienteFrecuente(p, consultas)) {
        tipo = "Fiel"
        estado = `Cliente frecuente · ${numConsultas} consultas`
        dias = "Fiel"
        motivo = "Te ha visitado varias veces. Un buen momento para agradecerle su confianza."
      }

      return {
        id: p.id,
        paciente: p.nombre,
        estado,
        motivo,
        telefono: p.telefono || p.contacto || p.celular || "",
        tipo,
        dias,
        cumpleHoy: esCumple && dias === "Hoy",
      }
    })
  }, [pacientes, consultas])

  const filtrados = prospectosDinamicos.filter((p) => filtro === "Todos" || p.tipo === filtro)

  const totalCumpleanos = prospectosDinamicos.filter((p) => p.tipo === "Felicitar").length
  const totalInactivos = prospectosDinamicos.filter((p) => p.tipo === "Inactivo").length
  const totalFieles = prospectosDinamicos.filter((p) => p.tipo === "Fiel").length

  // Referidos: quién ha traído pacientes nuevos
  const mapaReferidos = useMemo(() => obtenerReferidos(pacientes), [pacientes])
  const referentes = useMemo(
    () => Array.from(mapaReferidos.entries()).sort((a, b) => b[1].length - a[1].length),
    [mapaReferidos],
  )

  // Avisos globales (anuncios para todos los pacientes: cierres, promociones, etc.)
  const [avisos, setAvisos] = useState(() => cargarAvisos())
  const [nuevoAviso, setNuevoAviso] = useState("")
  const [copiadoAviso, setCopiadoAviso] = useState(null)

  useEffect(() => {
    localStorage.setItem("optica_crm_avisos", JSON.stringify(avisos))
  }, [avisos])

  // Saludo automático de cumpleaños: preferencia on/off del administrador,
  // más el registro de a quién ya se le "envió" hoy para no repetirlo.
  const [cumpleAuto, setCumpleAuto] = useState(() => cargarCumpleAuto())
  const [cumpleEnviados, setCumpleEnviados] = useState(() => cargarCumpleEnviados())
  const hoyISO = useMemo(() => new Date().toISOString().slice(0, 10), [])

  useEffect(() => {
    localStorage.setItem("optica_crm_cumple_auto", String(cumpleAuto))
  }, [cumpleAuto])

  useEffect(() => {
    localStorage.setItem("optica_crm_cumple_enviados", JSON.stringify(cumpleEnviados))
  }, [cumpleEnviados])

  // Mientras el saludo automático esté activo, registra (sin abrir WhatsApp
  // solo) a cada paciente que cumple años hoy y todavía no fue marcado —
  // es un mockup de frontend: representa el envío, no dispara mensajes reales.
  useEffect(() => {
    if (!cumpleAuto) return
    const pendientes = prospectosDinamicos.filter((p) => p.cumpleHoy && cumpleEnviados[p.id] !== hoyISO)
    if (pendientes.length === 0) return
    setCumpleEnviados((prev) => {
      const actualizado = { ...prev }
      pendientes.forEach((p) => { actualizado[p.id] = hoyISO })
      return actualizado
    })
  }, [cumpleAuto, prospectosDinamicos, cumpleEnviados, hoyISO])

  const publicarAviso = () => {
    if (!nuevoAviso.trim()) return
    const aviso = { id: Date.now(), texto: nuevoAviso.trim(), fecha: new Date().toLocaleDateString("es-EC", { day: "numeric", month: "short", year: "numeric" }) }
    setAvisos([aviso, ...avisos])
    setNuevoAviso("")
  }

  const copiarAviso = (aviso) => {
    navigator.clipboard.writeText(aviso.texto)
    setCopiadoAviso(aviso.id)
    setTimeout(() => setCopiadoAviso(null), 2000)
  }

  const eliminarAviso = (id) => setAvisos(avisos.filter((a) => a.id !== id))

  // Envío por WhatsApp con prefijo internacional (Ecuador)
  const enviarRecordatorio = (nombre, motivo, telefono) => {
    let numeroLimpio = (telefono || "").replace(/\D/g, "")
    if (numeroLimpio.startsWith("0")) {
      numeroLimpio = "593" + numeroLimpio.substring(1)
    }
    if (!numeroLimpio.startsWith("593") && numeroLimpio.length === 9) {
      numeroLimpio = "593" + numeroLimpio
    }
    const texto = `Hola ${nombre}, te saludamos de Diego Óptica. Queremos recordarte: ${motivo} ¡Escríbenos para agendar tu cita!`
    const url = `https://api.whatsapp.com/send?phone=${numeroLimpio}&text=${encodeURIComponent(texto)}`
    window.open(url, "_blank")
  }

  const reconocerReferente = (nombre, telefono, cantidad) => {
    let numeroLimpio = (telefono || "").replace(/\D/g, "")
    if (numeroLimpio.startsWith("0")) numeroLimpio = "593" + numeroLimpio.substring(1)
    if (!numeroLimpio.startsWith("593") && numeroLimpio.length === 9) numeroLimpio = "593" + numeroLimpio
    const texto = `Hola ${nombre}, ¡gracias por confiar en Diego Óptica y recomendarnos a ${cantidad > 1 ? `${cantidad} personas` : "un amigo"}! Como agradecimiento, tenemos un beneficio especial para ti en tu próxima visita. 🎁`
    const url = `https://api.whatsapp.com/send?phone=${numeroLimpio}&text=${encodeURIComponent(texto)}`
    window.open(url, "_blank")
  }

  const METRICAS = [
    { icon: Users, valor: pacientes.length, label: "Total de clientes", tile: GRAD, tileText: "#fff", filtroId: "Todos", ring: "#2563EB" },
    { icon: Cake, valor: totalCumpleanos, label: "Cumpleaños cercanos", tile: "#fef3c7", tileText: "#b45309", filtroId: "Felicitar", ring: "#d97706" },
    { icon: Clock, valor: totalInactivos, label: "Sin visitar hace tiempo", tile: "#fee2e2", tileText: "#dc2626", filtroId: "Inactivo", ring: "#dc2626" },
    { icon: Star, valor: totalFieles, label: "Clientes frecuentes", tile: "#ecfdf5", tileText: "#059669", filtroId: "Fiel", ring: "#059669" },
  ]

  const etiquetaFiltro =
    filtro === "Felicitar" ? "Cumpleaños cercanos"
    : filtro === "Inactivo" ? "Sin visitar hace tiempo"
    : filtro === "Fiel" ? "Clientes frecuentes"
    : "Todos los contactos"

  return (
    <div className="w-full space-y-6 text-left">
      {/* ─── HEADER ─── */}
      <div className="flex items-start gap-3.5">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-white" style={{ background: GRAD, boxShadow: "0 12px 24px -10px rgba(37,99,235,0.6)" }}>
          <HeartHandshake size={24} />
        </div>
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight" style={{ color: INK }}>CRM y fidelización</h1>
          <p className="text-sm text-slate-500">Cumpleaños, inactividad, clientes fieles y comunicación con tus pacientes.</p>
        </div>
      </div>

      {/* ─── MÉTRICAS (también filtran) ─── */}
      <div>
        <p className="mb-2 text-xs font-medium text-slate-500">Toca una tarjeta para filtrar los contactos</p>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {METRICAS.map((m) => {
            const activo = filtro === m.filtroId
            return (
              <button
                key={m.label}
                type="button"
                onClick={() => setFiltro(m.filtroId)}
                className="flex items-center justify-between rounded-2xl border bg-white p-5 text-left transition-all hover:-translate-y-0.5 cursor-pointer"
                style={{
                  borderColor: activo ? m.ring : "rgba(14,43,51,0.08)",
                  boxShadow: activo ? `0 0 0 3px ${m.ring}22` : "0 1px 2px rgba(14,43,51,0.04)",
                }}
              >
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{m.label}</p>
                  <p className="mt-1 text-3xl font-black" style={{ color: INK }}>{m.valor}</p>
                </div>
                <div className="grid h-12 w-12 place-items-center rounded-2xl" style={{ background: m.tile, color: m.tileText }}>
                  <m.icon size={22} />
                </div>
              </button>
            )
          })}
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
                ? "Activo: el día del cumpleaños, el paciente queda marcado como saludado sin que tengas que hacerlo manualmente."
                : "Apagado: tú decides a quién saludar con el botón \"Notificar WhatsApp\" de la lista."}
            </p>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={cumpleAuto}
          onClick={() => setCumpleAuto((v) => !v)}
          className={"relative h-7 w-12 shrink-0 self-start rounded-full transition-colors cursor-pointer sm:self-auto " + (cumpleAuto ? "" : "bg-slate-200")}
          style={cumpleAuto ? { background: GRAD } : undefined}
        >
          <span className={"absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all " + (cumpleAuto ? "left-6" : "left-1")} />
        </button>
      </div>

      {/* ─── PANEL DE TAREAS ─── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 p-4">
          <h4 className="text-sm font-bold" style={{ color: INK }}>{etiquetaFiltro}</h4>
          <span className="text-xs text-slate-500">{filtrados.length} {filtrados.length === 1 ? "contacto" : "contactos"}</span>
        </div>

        <div className="divide-y divide-slate-100">
          {filtrados.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-300"><ShieldAlert size={24} /></div>
              <p className="text-sm font-medium text-slate-500">No hay acciones pendientes en este filtro.</p>
            </div>
          ) : (
            filtrados.map((prospecto) => {
              const esCumple = prospecto.tipo === "Felicitar"
              const esInactivoTipo = prospecto.tipo === "Inactivo"
              const esFiel = prospecto.tipo === "Fiel"
              const inicial = (prospecto.paciente || "P").charAt(0).toUpperCase()
              const avatarBg = esCumple ? "linear-gradient(135deg,#e0b64e,#b45309)" : esInactivoTipo ? "linear-gradient(135deg,#f87171,#dc2626)" : esFiel ? "linear-gradient(135deg,#34d399,#059669)" : GRAD
              return (
                <div key={prospecto.id} className="flex flex-col items-start justify-between gap-4 p-4 transition hover:bg-slate-50/60 sm:flex-row sm:items-center">
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold text-white" style={{ background: avatarBg }}>
                      {esCumple ? <Gift size={17} /> : esInactivoTipo ? <Clock size={17} /> : esFiel ? <Star size={17} /> : inicial}
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-slate-800">{prospecto.paciente}</span>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider"
                          style={
                            esCumple ? { backgroundColor: "#fef3c7", color: "#92600f", border: "1px solid #fde68a" }
                            : esInactivoTipo ? { backgroundColor: "#fee2e2", color: "#991b1b", border: "1px solid #fecaca" }
                            : esFiel ? { backgroundColor: "#d1fae5", color: "#065f46", border: "1px solid #a7f3d0" }
                            : { backgroundColor: "#eff6ff", color: "#1d4ed8", border: "1px solid #dbeafe" }
                          }
                        >
                          {prospecto.estado}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-slate-500">{prospecto.motivo}</p>
                    </div>
                  </div>

                  <div className="flex w-full items-center justify-between gap-3 border-t border-slate-100 pt-2 sm:w-auto sm:justify-end sm:border-t-0 sm:pt-0">
                    <span className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1 font-mono text-[11px] font-semibold text-slate-500">
                      {prospecto.dias}
                    </span>
                    {prospecto.cumpleHoy && cumpleAuto && cumpleEnviados[prospecto.id] === hoyISO ? (
                      <span
                        className="flex select-none items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-700"
                        title="El saludo automático ya quedó marcado como enviado para hoy"
                      >
                        <CheckCircle2 size={13} />
                        Enviado automáticamente
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => enviarRecordatorio(prospecto.paciente, prospecto.motivo, prospecto.telefono)}
                        disabled={!prospecto.telefono}
                        className="flex select-none items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                        title={prospecto.telefono ? "Enviar por WhatsApp" : "Sin número registrado"}
                      >
                        <MessageSquare size={13} />
                        Notificar WhatsApp
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ─── PROGRAMA DE REFERIDOS ─── */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/70 p-4">
            <span className="grid h-9 w-9 place-items-center rounded-xl text-white" style={{ background: "linear-gradient(135deg,#e0b64e,#b45309)" }}><Award size={18} /></span>
            <div>
              <h4 className="text-sm font-bold" style={{ color: INK }}>Programa de referidos</h4>
              <p className="text-[11px] text-slate-500">Pacientes que han traído nuevos clientes</p>
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {referentes.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <div className="grid h-11 w-11 place-items-center rounded-full bg-slate-100 text-slate-300"><Award size={22} /></div>
                <p className="text-sm font-medium text-slate-500">Aún nadie ha referido pacientes.</p>
                <p className="text-xs text-slate-500">Se registra al crear un paciente con el campo "Referido por".</p>
              </div>
            ) : (
              referentes.map(([nombreReferente, referidos]) => {
                const referente = pacientes.find((p) => p.nombre === nombreReferente)
                return (
                  <div key={nombreReferente} className="flex flex-col items-start justify-between gap-3 p-4 sm:flex-row sm:items-center">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{nombreReferente}</p>
                      <p className="text-xs text-slate-500">
                        Trajo a {referidos.map((r) => r.nombre).join(", ")}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => reconocerReferente(nombreReferente, referente?.telefono, referidos.length)}
                      disabled={!referente?.telefono}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                      style={{ background: "linear-gradient(135deg,#e0b64e,#b45309)" }}
                    >
                      <Gift size={13} /> Reconocer
                    </button>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* ─── AVISOS GLOBALES ─── */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/70 p-4">
            <span className="grid h-9 w-9 place-items-center rounded-xl text-white" style={{ background: GRAD }}><Megaphone size={18} /></span>
            <div>
              <h4 className="text-sm font-bold" style={{ color: INK }}>Avisos globales</h4>
              <p className="text-[11px] text-slate-500">Cierres, promociones u otros anuncios para todos</p>
            </div>
          </div>

          <div className="space-y-3 p-4">
            <textarea
              value={nuevoAviso}
              onChange={(e) => setNuevoAviso(e.target.value)}
              rows={2}
              placeholder="Ej. Cerraremos el sábado 22 por mantenimiento. Reprogramaremos tu cita sin costo."
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-50"
            />
            <button
              type="button"
              onClick={publicarAviso}
              disabled={!nuevoAviso.trim()}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold text-white transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
              style={{ background: GRAD }}
            >
              <Send size={14} /> Publicar aviso
            </button>
            <p className="text-[11px] text-slate-500">
              El sistema aún no envía mensajes automáticos: copia el aviso y pégalo en tu lista de difusión de WhatsApp o donde avises a tus pacientes.
            </p>

            {avisos.length > 0 && (
              <div className="max-h-52 space-y-2 overflow-y-auto border-t border-slate-100 pt-3">
                {avisos.map((a) => (
                  <div key={a.id} className="flex items-start justify-between gap-2 rounded-lg bg-slate-50 p-2.5">
                    <div className="min-w-0">
                      <p className="text-xs text-slate-700">{a.texto}</p>
                      <p className="mt-0.5 text-[10px] text-slate-500">{a.fecha}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button type="button" onClick={() => copiarAviso(a)} title="Copiar mensaje" className="rounded-md p-1.5 text-slate-500 transition hover:bg-white hover:text-blue-600 cursor-pointer">
                        {copiadoAviso === a.id ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                      </button>
                      <button type="button" onClick={() => eliminarAviso(a.id)} title="Eliminar" className="rounded-md p-1.5 text-slate-500 transition hover:bg-white hover:text-red-600 cursor-pointer">
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
    </div>
  )
}
