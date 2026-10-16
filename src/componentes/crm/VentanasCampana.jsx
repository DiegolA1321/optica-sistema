"use client"

import { useMemo, useState } from "react"
import { Check, Copy, Download, Megaphone, MessageCircle, RotateCcw } from "lucide-react"
import { GRAD_MARCA, INK } from "@/lib/tema"
import { Cascaron, PieFormulario } from "../AtencionPaciente"
import { BOTON_CERRAR, CLASE_ACCION_PRINCIPAL, CLASE_ACCION_SECUNDARIA, plural } from "../ventas/estilos"
import { Insignia } from "../ventas/Lista"
import { NombrePaciente } from "./piezas"
import {
  GRUPOS_CAMPANA, MAX_PLANTILLA, ORDEN_GRUPOS, PLANTILLAS_BASE, VARIABLES_PLANTILLA, armarMensaje, destinatariosCampana, modeloListaCampana, plantillaDe,
} from "../../utilidades/crmContactos"
import { fechaHoraLegible, formatoFecha } from "../../utilidades/formatoFecha"
import { hoyISO } from "../../utilidades/disponibilidad"
import { abrirWhatsApp } from "../../utilidades/whatsapp"

const NOMBRE_MOTIVO_PLANTILLA = {
  control_vencido: "Control vencido", control_proximo: "Control que vence pronto", cumpleanos: "Cumpleaños", sin_visitar: "Reactivación (sin visitar hace más de 12 meses)",
  postventa: "Seguimiento después de la compra", promocion: "Promoción",
}
const CAMPO = "w-full resize-none rounded-xl border border-slate-200/60 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none transition-colors focus-visible:border-blue-500 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-blue-50"

function FichasVariables({ onAgregar, deshabilitado }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-slate-500">Variables:</span>
      {VARIABLES_PLANTILLA.map((v) => (
        <button key={v.id} type="button" disabled={deshabilitado} onClick={() => onAgregar(v.id)} title={v.ayuda} className="rounded-md border border-slate-200/60 bg-white px-2 py-0.5 font-mono text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 cursor-pointer">{v.id}</button>
      ))}
    </div>
  )
}

// ─── Nueva campaña: grupo, nombre y mensaje ───
export function VentanaNuevaCampana({ pacientes, consultas, plantillas, opticaNombre, onCrear, onCerrar }) {
  const hoy = hoyISO()
  const grupos = useMemo(() => Object.fromEntries(ORDEN_GRUPOS.map((g) => [g, destinatariosCampana(g, { pacientes, consultas, hoy })])), [pacientes, consultas, hoy])
  const primero = ORDEN_GRUPOS.find((g) => grupos[g].pacientes.length > 0) || ORDEN_GRUPOS[0]
  const [grupo, setGrupo] = useState(primero)
  const [nombre, setNombre] = useState(`${GRUPOS_CAMPANA[primero].etiqueta} · ${formatoFecha(hoy, "medio")}`)
  const [mensaje, setMensaje] = useState(plantillaDe(GRUPOS_CAMPANA[primero].motivo, plantillas))
  const [editado, setEditado] = useState({ nombre: false, mensaje: false })
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  const total = grupos[grupo].pacientes.length

  const elegir = (g) => {
    setGrupo(g)
    if (!editado.nombre) setNombre(`${GRUPOS_CAMPANA[g].etiqueta} · ${formatoFecha(hoy, "medio")}`)
    if (!editado.mensaje) setMensaje(plantillaDe(GRUPOS_CAMPANA[g].motivo, plantillas))
  }
  const ejemplo = grupos[grupo].pacientes[0]
  const vista = armarMensaje(mensaje, { paciente: ejemplo || { nombre: "Nombre del paciente" }, opticaNombre, consultas })
  const falta = total === 0 || nombre.trim().length < 3 || mensaje.trim().length < 10 || mensaje.length > MAX_PLANTILLA

  const enviar = async (e) => {
    e.preventDefault()
    if (falta || guardando) return
    setGuardando(true)
    setError("")
    const r = await onCrear({ nombre, grupo, mensaje })
    if (r && r.ok === false) { setError(r.error || "No se pudo crear la campaña."); setGuardando(false) }
  }

  return (
    <Cascaron titulo="Nueva campaña" subtitulo="Prepara un mensaje para un grupo y envíalo uno por uno" Icono={Megaphone} onCerrar={onCerrar} ancho="max-w-2xl" formulario={{ onSubmit: enviar }}
      pie={<PieFormulario onCancelar={onCerrar} etiquetaGuardar="Crear campaña" guardando={guardando} deshabilitado={falta} nota="No se envía nada solo: tú envías cada mensaje por WhatsApp." />}>
      <div className="space-y-5 px-5 py-4">
        <fieldset>
          <legend className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">¿A quién?</legend>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ORDEN_GRUPOS.map((g) => {
              const def = GRUPOS_CAMPANA[g]
              const { pacientes: ps, sinPermiso } = grupos[g]
              return (
                <label key={g} className={"flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors " + (grupo === g ? "border-blue-500 bg-blue-50/60" : "border-slate-200/60 hover:bg-slate-50")}>
                  <input type="radio" name="grupo" value={g} checked={grupo === g} onChange={() => elegir(g)} className="mt-1 h-4 w-4 shrink-0 accent-blue-600" />
                  <span className="min-w-0">
                    <span className="block text-sm font-bold" style={{ color: INK }}>{def.etiqueta} <span className="font-semibold text-slate-500">({ps.length})</span></span>
                    <span className="block text-xs text-slate-500">{def.ayuda}</span>
                    {sinPermiso > 0 && <span className="mt-0.5 block text-xs font-semibold text-amber-700">{plural(sinPermiso, "paciente no se incluye", "pacientes no se incluyen")}: {def.consentimiento === "promocion" ? "no aceptó promociones y saludos" : "no aceptó recordatorios de salud"}.</span>}
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>

        <div>
          <label htmlFor="campana-nombre" className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Nombre de la campaña</label>
          <input id="campana-nombre" value={nombre} maxLength={80} onChange={(e) => { setNombre(e.target.value); setEditado((x) => ({ ...x, nombre: true })) }} className={CAMPO} />
        </div>

        <div className="space-y-2">
          <label htmlFor="campana-mensaje" className="block text-xs font-bold uppercase tracking-wide text-slate-500">Mensaje</label>
          <textarea id="campana-mensaje" rows={4} value={mensaje} onChange={(e) => { setMensaje(e.target.value); setEditado((x) => ({ ...x, mensaje: true })) }} className={CAMPO} aria-describedby="campana-mensaje-ayuda" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <FichasVariables onAgregar={(v) => { setMensaje((m) => `${m}${m && !m.endsWith(" ") ? " " : ""}${v}`); setEditado((x) => ({ ...x, mensaje: true })) }} />
            <span id="campana-mensaje-ayuda" className={"text-xs " + (mensaje.length > MAX_PLANTILLA ? "font-semibold text-red-600" : "text-slate-500")}>{mensaje.length} / {MAX_PLANTILLA}</span>
          </div>
          <div className="rounded-xl bg-slate-50 px-3.5 py-3">
            <p className="mb-1 text-xs font-semibold text-slate-500">Así lo recibirá {ejemplo ? ejemplo.nombre : "cada paciente"}</p>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{vista}</p>
          </div>
        </div>

        {total === 0 && <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">Este grupo está vacío: elige otro para crear la campaña.</p>}
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
      </div>
    </Cascaron>
  )
}

// ─── Una campaña: enviar uno por uno o exportar la lista ───
export function VentanaCampana({ campana, pacientes, consultas, contactos, opticaNombre, usuario, puedeEnviar, onEnviar, onVerPerfil, onAviso, onCerrar }) {
  const hoy = hoyISO()
  const [copiado, setCopiado] = useState(false)
  const [enviando, setEnviando] = useState(null)
  const grupo = GRUPOS_CAMPANA[campana.grupo]
  const { pacientes: destinatarios, sinPermiso } = useMemo(() => destinatariosCampana(campana.grupo, { pacientes, consultas, hoy }), [campana.grupo, pacientes, consultas, hoy])
  const enviados = useMemo(() => {
    const m = new Map()
    for (const c of contactos) if (c.campanaId === campana.id && !m.has(c.pacienteId)) m.set(c.pacienteId, c)
    return m
  }, [contactos, campana.id])
  // Los que ya recibieron se quedan en la lista aunque el grupo haya cambiado (por ejemplo, ya agendaron), para que el conteo no baje solo.
  const filas = useMemo(() => {
    const ids = new Set(destinatarios.map((p) => p.id))
    const extra = [...enviados.keys()].filter((id) => !ids.has(id)).map((id) => pacientes.find((p) => p.id === id)).filter(Boolean)
    return [...destinatarios, ...extra]
  }, [destinatarios, enviados, pacientes])
  const pendientes = filas.filter((p) => !enviados.has(p.id)).length
  const mensajeDe = (p) => armarMensaje(campana.mensaje, { paciente: p, opticaNombre, consultas })

  const enviar = async (p) => {
    if (enviando) return
    setEnviando(p.id)
    abrirWhatsApp(p.telefono || p.contacto || p.celular, mensajeDe(p)) // primero la ventana (dentro del clic) y después se anota
    const r = await onEnviar(p, mensajeDe(p))
    if (r?.ok === false) onAviso?.(r.error)
    setEnviando(null)
  }
  const copiar = async () => {
    try { await navigator.clipboard.writeText(campana.mensaje); setCopiado(true); setTimeout(() => setCopiado(false), 2000) } catch { onAviso?.("No se pudo copiar el mensaje.") }
  }
  const exportar = async () => {
    try {
      const { descargarModelo } = await import("../../utilidades/reportesExcel")
      const modelo = modeloListaCampana({ campana, filas: filas.map((p) => ({ nombre: p.nombre, telefono: p.telefono || "", correo: p.correo && p.correo !== "Sin Correo" ? p.correo : "", mensaje: mensajeDe(p), enviado: enviados.has(p.id) })) })
      await descargarModelo(modelo, { usuario, opticaNombre, usuarioNombre: usuario?.nombre, filtrosTexto: "ninguno" })
      onAviso?.(`Se descargó la lista de “${campana.nombre}”.`)
    } catch { onAviso?.("No se pudo descargar el Excel. Vuelve a intentarlo.") }
  }

  return (
    <Cascaron titulo={campana.nombre} subtitulo={`${grupo?.etiqueta || campana.grupo} · ${enviados.size} de ${filas.length} enviados`} Icono={Megaphone} onCerrar={onCerrar} ancho="max-w-3xl"
      pie={<>
        <button type="button" onClick={exportar} disabled={filas.length === 0} className={CLASE_ACCION_SECUNDARIA}><Download size={14} aria-hidden="true" /> Exportar la lista</button>
        <button type="button" onClick={onCerrar} className={BOTON_CERRAR}>Cerrar</button>
      </>}>
      <div className="space-y-4 px-5 py-4">
        <div className="rounded-xl bg-slate-50 px-3.5 py-3">
          <div className="mb-1 flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Mensaje</p>
            <button type="button" onClick={copiar} className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800 cursor-pointer">{copiado ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />} {copiado ? "Copiado" : "Copiar"}</button>
          </div>
          <p className="whitespace-pre-wrap text-sm text-slate-700">{campana.mensaje}</p>
        </div>

        {filas.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-600">No hay pacientes en este grupo ahora mismo.</p>
        ) : (
          <ul role="list" aria-label="Pacientes de la campaña" className="divide-y divide-slate-100 rounded-xl border border-slate-200/60">
            {filas.map((p) => {
              const e = enviados.get(p.id)
              const tel = p.telefono || p.contacto || p.celular || ""
              return (
                <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5">
                  <div className="min-w-0 flex-1">
                    <NombrePaciente paciente={p} onVerPerfil={onVerPerfil} className="block max-w-full" />
                    <p className="truncate text-xs text-slate-500">{tel || "Sin teléfono"}</p>
                  </div>
                  {e ? (
                    <span className="flex shrink-0 items-center gap-2 text-sm"><Insignia tono="verde"><Check size={12} aria-hidden="true" /> Enviado</Insignia><span className="hidden text-xs text-slate-500 sm:inline">{fechaHoraLegible(e.creadoEn)}{e.creadoPorNombre ? ` · ${e.creadoPorNombre}` : ""}</span></span>
                  ) : puedeEnviar ? (
                    <button type="button" onClick={() => enviar(p)} disabled={!tel || enviando === p.id} title={tel ? "Abre WhatsApp con el mensaje y lo marca como enviado" : "Sin número registrado"} aria-label={`Enviar por WhatsApp a ${p.nombre}`} className={CLASE_ACCION_PRINCIPAL.replace("px-3.5", "px-3")} style={{ background: GRAD_MARCA }}>
                      <MessageCircle size={14} aria-hidden="true" /> Enviar por WhatsApp
                    </button>
                  ) : <span className="text-xs text-slate-500">Pendiente</span>}
                </li>
              )
            })}
          </ul>
        )}
        <p className="text-xs text-slate-500">
          {plural(pendientes, "paciente pendiente", "pacientes pendientes")}. Cada envío queda en Seguimiento.
          {sinPermiso > 0 && ` No se incluyen ${plural(sinPermiso, "paciente", "pacientes")} del grupo que ${grupo?.consentimiento === "promocion" ? "no aceptaron promociones y saludos" : "no aceptaron recordatorios de salud"}.`}
        </p>
      </div>
    </Cascaron>
  )
}

// ─── Plantillas: el mensaje de cada motivo ───
export function VentanaPlantillas({ plantillas, opticaNombre, puedeEditar, onGuardar, onCerrar }) {
  const [borrador, setBorrador] = useState(() => Object.fromEntries(Object.keys(PLANTILLAS_BASE).map((m) => [m, plantillaDe(m, plantillas)])))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  const cambios = Object.keys(PLANTILLAS_BASE).filter((m) => borrador[m].trim() !== plantillaDe(m, plantillas).trim())
  const invalido = cambios.some((m) => borrador[m].trim().length < 10 || borrador[m].length > MAX_PLANTILLA)

  const enviar = async (e) => {
    e.preventDefault()
    if (cambios.length === 0 || invalido || guardando) return
    setGuardando(true)
    setError("")
    for (const m of cambios) {
      // Un texto igual al mensaje base se guarda vacío: así la óptica vuelve a seguir el mensaje base si algún día cambia.
      const r = await onGuardar(m, borrador[m].trim() === PLANTILLAS_BASE[m].trim() ? "" : borrador[m])
      if (r?.ok === false) { setError(r.error || "No se pudo guardar."); setGuardando(false); return }
    }
    onCerrar(true)
  }

  return (
    <Cascaron titulo="Plantillas de mensajes" subtitulo="El texto que sale al contactar por cada motivo" Icono={MessageCircle} onCerrar={() => onCerrar(false)} ancho="max-w-2xl" formulario={{ onSubmit: enviar }}
      pie={puedeEditar
        ? <PieFormulario onCancelar={() => onCerrar(false)} etiquetaGuardar={cambios.length > 1 ? `Guardar ${cambios.length} cambios` : "Guardar"} guardando={guardando} deshabilitado={cambios.length === 0 || invalido} nota="Mensajes cortos, cordiales y con el nombre de la óptica." />
        : <><span className="text-xs text-slate-500">Solo quien tiene permiso de editar el CRM puede cambiar los mensajes.</span><button type="button" onClick={() => onCerrar(false)} className={BOTON_CERRAR}>Cerrar</button></>}>
      <div className="space-y-5 px-5 py-4">
        {Object.keys(PLANTILLAS_BASE).map((m) => {
          const largo = borrador[m].length
          const esBase = borrador[m].trim() === PLANTILLAS_BASE[m].trim()
          return (
            <div key={m} className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor={`plantilla-${m}`} className="text-sm font-bold" style={{ color: INK }}>{NOMBRE_MOTIVO_PLANTILLA[m]}</label>
                {puedeEditar && !esBase && <button type="button" onClick={() => setBorrador((b) => ({ ...b, [m]: PLANTILLAS_BASE[m] }))} className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 cursor-pointer"><RotateCcw size={12} aria-hidden="true" /> Volver al mensaje base</button>}
              </div>
              <textarea id={`plantilla-${m}`} rows={3} value={borrador[m]} readOnly={!puedeEditar} onChange={(e) => setBorrador((b) => ({ ...b, [m]: e.target.value }))} className={CAMPO} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <FichasVariables deshabilitado={!puedeEditar} onAgregar={(v) => setBorrador((b) => ({ ...b, [m]: `${b[m]}${b[m] && !b[m].endsWith(" ") ? " " : ""}${v}` }))} />
                <span className={"text-xs " + (largo > MAX_PLANTILLA ? "font-semibold text-red-600" : "text-slate-500")}>{largo} / {MAX_PLANTILLA}</span>
              </div>
              <p className="text-xs text-slate-500">Ejemplo: {armarMensaje(borrador[m], { paciente: { nombre: "Rosa Bravo Cedeño" }, opticaNombre })}</p>
            </div>
          )
        })}
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
      </div>
    </Cascaron>
  )
}
