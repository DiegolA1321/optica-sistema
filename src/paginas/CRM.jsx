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
  const [filtro, setFiltro] = useState("Todos")

  // Procesamiento conectado y en tiempo real
  const prospectosDinamicos = useMemo(() => {
    return pacientes.map((p) => {
      let estado = "Paciente activo"
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
        estado = `Paciente frecuente · ${numConsultas} consultas`
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
        saludoEnviadoEsteAnio: p.ultimoSaludoCumpleAnio === new Date().getFullYear(),
      }
    })
  }, [pacientes, consultas])

  const filtrados = prospectosDinamicos.filter((p) => filtro === "Todos" || p.tipo === filtro)

  // Corte de rango — mismo criterio que Pacientes.jsx/Inventario.jsx (feedback del ing).
  const [cantidadVisible, setCantidadVisible] = useState(25)
  useEffect(() => { setCantidadVisible(25) }, [filtro])
  const visibles = filtrados.slice(0, cantidadVisible)

  const totalCumpleanos = prospectosDinamicos.filter((p) => p.tipo === "Felicitar").length
  const totalInactivos = prospectosDinamicos.filter((p) => p.tipo === "Inactivo").length
  const totalFieles = prospectosDinamicos.filter((p) => p.tipo === "Fiel").length

  // Referidos: quién ha traído pacientes nuevos
  const mapaReferidos = useMemo(() => obtenerReferidos(pacientes), [pacientes])
  const referentes = useMemo(
    () => Array.from(mapaReferidos.entries()).sort((a, b) => b[1].length - a[1].length),
    [mapaReferidos],
  )

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

  const reconocerReferente = (nombre, telefono, cantidad) => {
    let numeroLimpio = (telefono || "").replace(/\D/g, "")
    if (numeroLimpio.startsWith("0")) numeroLimpio = "593" + numeroLimpio.substring(1)
    if (!numeroLimpio.startsWith("593") && numeroLimpio.length === 9) numeroLimpio = "593" + numeroLimpio
    const texto = `Hola ${nombre}, ¡gracias por confiar en ${usuario?.opticaNombre || "nuestra óptica"} y recomendarnos a ${cantidad > 1 ? `${cantidad} personas` : "un amigo"}! Como agradecimiento, tenemos un beneficio especial para ti en tu próxima visita. 🎁`
    const url = `https://api.whatsapp.com/send?phone=${numeroLimpio}&text=${encodeURIComponent(texto)}`
    window.open(url, "_blank")
  }

  const METRICAS = [
    { icon: Users, valor: pacientes.length, label: "Total de pacientes", tile: GRAD, tileText: "#fff", filtroId: "Todos", ring: "#2563EB" },
    { icon: Cake, valor: totalCumpleanos, label: "Cumpleaños cercanos", tile: "#fef3c7", tileText: "#b45309", filtroId: "Felicitar", ring: "#d97706" },
    { icon: Clock, valor: totalInactivos, label: "Sin visitar hace tiempo", tile: "#fee2e2", tileText: "#dc2626", filtroId: "Inactivo", ring: "#dc2626" },
    { icon: Star, valor: totalFieles, label: "Pacientes frecuentes", tile: "#ecfdf5", tileText: "#059669", filtroId: "Fiel", ring: "#059669" },
  ]

  const etiquetaFiltro =
    filtro === "Felicitar" ? "Cumpleaños cercanos"
    : filtro === "Inactivo" ? "Sin visitar hace tiempo"
    : filtro === "Fiel" ? "Pacientes frecuentes"
    : "Todos los contactos"

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
        <p className="mb-2 text-xs font-medium text-slate-500">Toca una tarjeta para filtrar los contactos</p>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {METRICAS.map((m, i) => {
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
                  animation: "rise-in 320ms ease-out both",
                  animationDelay: `${i * 50}ms`,
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
            visibles.map((prospecto, idx) => {
              const esCumple = prospecto.tipo === "Felicitar"
              const esInactivoTipo = prospecto.tipo === "Inactivo"
              const esFiel = prospecto.tipo === "Fiel"
              const inicial = (prospecto.paciente || "P").charAt(0).toUpperCase()
              const avatarBg = esCumple ? "linear-gradient(135deg,#e0b64e,#b45309)" : esInactivoTipo ? "linear-gradient(135deg,#f87171,#dc2626)" : esFiel ? "linear-gradient(135deg,#34d399,#059669)" : GRAD
              return (
                <div
                  key={prospecto.id}
                  className="flex flex-col items-start justify-between gap-4 p-4 transition hover:bg-slate-50/60 sm:flex-row sm:items-center"
                  style={{ animation: "rise-in 260ms ease-out both", animationDelay: `${Math.min(idx * 30, 240)}ms` }}
                >
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
                    {prospecto.cumpleHoy && cumpleAuto && prospecto.saludoEnviadoEsteAnio ? (
                      <span
                        className="flex select-none items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-700"
                        title="El correo de saludo automático ya se envió este año"
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
        {cantidadVisible < filtrados.length && (
          <div className="border-t border-slate-100 px-4 py-3 text-center">
            <button type="button" onClick={() => setCantidadVisible((v) => v + 25)} className="text-xs font-semibold text-blue-600 hover:text-blue-700 cursor-pointer">
              Mostrar 25 más
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ─── PROGRAMA DE REFERIDOS ─── */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50/70 p-4">
            <span className="grid h-9 w-9 place-items-center rounded-xl text-white" style={{ background: "linear-gradient(135deg,#e0b64e,#b45309)" }}><Award size={18} /></span>
            <div>
              <h4 className="text-sm font-bold" style={{ color: INK }}>Programa de referidos</h4>
              <p className="text-[11px] text-slate-500">Pacientes que han traído nuevos pacientes</p>
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
    </div>
  )
}
