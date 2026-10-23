"use client"

import { useMemo, useState } from "react"
import { RotateCcw } from "lucide-react"
import { GRAD_MARCA, INK } from "@/lib/tema"
import { CLASE_ACCION_PRINCIPAL, CLASE_ACCION_SECUNDARIA } from "../ventas/estilos"
import EditorMensaje from "./EditorMensaje"
import { InterruptorAutomatico } from "./VentanasCampana"
import { MAX_PLANTILLA, PLANTILLAS_BASE, alNombreActual, armarMensaje, plantillaDe } from "../../utilidades/crmContactos"

// Los motivos con su plantilla, en el orden en que se leen: primero los de los avisos y el seguimiento diario, después los de las campañas.
export const MOTIVOS_PLANTILLA = [
  { id: "control_vencido", nombre: "Control vencido", cuando: "Recordatorio de salud para quien ya pasó su control. Va desde Para contactar, el Inicio y las campañas." },
  { id: "cita_no_efectuada", nombre: "Cita no efectuada", cuando: "Desde «Contactar al paciente» (Inicio y Citas): una cita que no se efectuó o que el paciente canceló." },
  { id: "lentes_listos", nombre: "Pedido listo (retira)", cuando: "Cuando el pedido está listo y el paciente lo retira en la óptica. Desde el aviso «listo sin avisar» de Ventas y del Inicio." },
  { id: "lentes_listos_envio", nombre: "Pedido listo (envío)", cuando: "Cuando el pedido está listo y se envía a la dirección del paciente. Desde el aviso «listo sin avisar» de Ventas y del Inicio." },
  { id: "cumpleanos", nombre: "Cumpleaños", cuando: "Saludo para quien cumple años. Va a quien aceptó promociones y saludos." },
  { id: "por_vender", nombre: "Recibió su diagnóstico y no compró", cuando: "Desde Para contactar: quien recibió su diagnóstico y todavía no compra." },
  { id: "medidas_montaje", nombre: "Medidas pedidas", cuando: "Cuando el paciente pidió sus medidas desde el portal y se le envían por WhatsApp." },
  { id: "control_proximo", nombre: "Control que vence pronto", cuando: "Recordatorio de salud para quien está por cumplir su control." },
  { id: "sin_visitar", nombre: "Sin visitar hace más de 12 meses", cuando: "Recordatorio de salud para quien lleva más de 12 meses sin venir." },
  { id: "postventa", nombre: "Seguimiento después de la compra", cuando: "Recordatorio de salud unos días después de entregar los lentes." },
  { id: "cita_reagendada", nombre: "Cita reagendada", cuando: "Al avisarle por WhatsApp que su cita cambió de fecha u hora." },
  { id: "promocion", nombre: "Promoción", cuando: "Para campañas de ofertas. Solo va a quien aceptó promociones y saludos." },
]

// Lo que el paciente de ejemplo recibe según el motivo: el pedido que se envía lleva una dirección de muestra.
const ENTREGA_EJEMPLO = { lentes_listos_envio: { tipo: "envio", direccion: "Av. Amazonas y Colón" } }

// Pestaña «Plantillas»: el texto de cada motivo, con los datos automáticos que se pueden usar, la vista previa con un paciente de ejemplo y «Volver al original». La ventana única de Contactar usa siempre estas
// plantillas. Cada motivo se guarda por separado; lo que se escribe y no se guarda se conserva al cambiar de motivo.
export default function PestanaPlantillas({ plantillas, opticaNombre, opticaTelefono, puedeEditar, cumpleAuto, onCumpleAuto, onGuardar, onAviso }) {
  const [elegido, setElegido] = useState(MOTIVOS_PLANTILLA[0].id)
  const guardada = (m) => alNombreActual(plantillaDe(m, plantillas)).trim()
  const [borradores, setBorradores] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")
  const texto = borradores[elegido] ?? alNombreActual(plantillaDe(elegido, plantillas))
  const cambio = texto.trim() !== guardada(elegido)
  const invalido = texto.trim().length < 10 || texto.length > MAX_PLANTILLA
  const esOriginal = texto.trim() === PLANTILLAS_BASE[elegido].trim()
  const motivo = MOTIVOS_PLANTILLA.find((m) => m.id === elegido)
  const sinGuardar = useMemo(() => new Set(MOTIVOS_PLANTILLA.filter((m) => borradores[m.id] !== undefined && borradores[m.id].trim() !== guardada(m.id)).map((m) => m.id)), [borradores, plantillas]) // eslint-disable-line react-hooks/exhaustive-deps

  const vista = armarMensaje(texto, { paciente: { nombre: "Ana" }, opticaNombre, opticaTelefono, ejemplo: true, entrega: ENTREGA_EJEMPLO[elegido] || null })

  const elegir = (id) => { setElegido(id); setError("") }
  const poner = (t) => setBorradores((b) => ({ ...b, [elegido]: t }))
  const volverAlOriginal = () => { poner(PLANTILLAS_BASE[elegido]); setError("") }
  const guardar = async () => {
    if (!cambio || invalido || guardando) return
    setGuardando(true)
    setError("")
    // Un texto igual al original se guarda vacío: así la óptica vuelve a seguir el original si algún día cambia.
    const r = await onGuardar(elegido, texto.trim() === PLANTILLAS_BASE[elegido].trim() ? "" : texto)
    setGuardando(false)
    if (r?.ok === false) { setError(r.error || "No se pudo guardar."); return }
    setBorradores((b) => { const { [elegido]: _quitado, ...resto } = b; return resto })
    onAviso?.(`Plantilla «${motivo.nombre}» guardada.`)
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(14rem,0.9fr)_minmax(0,1.3fr)_minmax(14rem,1fr)] lg:items-start">
      <nav aria-label="Motivos" className="rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm">
        <p className="px-2 pb-1.5 pt-1 text-xs font-bold uppercase tracking-wide text-slate-500">Motivos</p>
        <ul className="space-y-0.5">
          {MOTIVOS_PLANTILLA.map((m) => {
            const activo = elegido === m.id
            return (
              <li key={m.id}>
                <button type="button" onClick={() => elegir(m.id)} aria-current={activo ? "true" : undefined}
                  className={"flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors cursor-pointer " + (activo ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50")}>
                  <span className="min-w-0">{m.nombre}</span>
                  {sinGuardar.has(m.id) && <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700">Sin guardar</span>}
                </button>
              </li>
            )
          })}
        </ul>
      </nav>

      <section aria-label={`Plantilla: ${motivo.nombre}`} className="space-y-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-bold" style={{ color: INK }}>{motivo.nombre}</h2>
        <p className="text-xs text-slate-500">{motivo.cuando}</p>
        <EditorMensaje id="plantilla-texto" ayudaId="plantilla-texto-largo" motivo={elegido} valor={texto} filas={6} soloLectura={!puedeEditar} etiquetaVariables="Datos automáticos:" onCambio={poner} />
        {elegido === "cumpleanos" && <InterruptorAutomatico activo={cumpleAuto} puedeEditar={puedeEditar} onCambiar={onCumpleAuto} />}
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
        {puedeEditar ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <button type="button" onClick={volverAlOriginal} disabled={esOriginal} className={CLASE_ACCION_SECUNDARIA}><RotateCcw size={14} aria-hidden="true" /> Volver al original</button>
            <button type="button" onClick={guardar} disabled={!cambio || invalido || guardando} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}>{guardando ? "Guardando…" : "Guardar"}</button>
          </div>
        ) : (
          <p className="text-xs text-slate-500">Solo quien tiene permiso de editar el CRM puede cambiar las plantillas.</p>
        )}
      </section>

      <section aria-label="Vista previa" className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-bold" style={{ color: INK }}>Vista previa</h2>
        <p className="text-sm text-slate-500">Con un paciente de ejemplo</p>
        <div data-vista-previa className="mt-3 whitespace-pre-line rounded-2xl px-4 py-3 text-[15px] leading-relaxed" style={{ background: "#DCF8C6", color: "#1f2d1f" }}>{vista}</div>
      </section>
    </div>
  )
}
