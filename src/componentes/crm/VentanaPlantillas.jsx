"use client"

import { useMemo, useState } from "react"
import { MessageSquareText, RotateCcw } from "lucide-react"
import { GRAD_MARCA, INK } from "@/lib/tema"
import { Cascaron } from "../AtencionPaciente"
import { BOTON_CERRAR, CLASE_ACCION_PRINCIPAL, CLASE_ACCION_SECUNDARIA } from "../ventas/estilos"
import EditorMensaje from "./EditorMensaje"
import { InterruptorAutomatico } from "./VentanasCampana"
import { MAX_PLANTILLA, PLANTILLAS_BASE, alNombreActual, armarMensaje, plantillaDe } from "../../utilidades/crmContactos"

// Los motivos con su plantilla, en el orden del diseño: primero los de los avisos y el seguimiento diario, después los de las campañas.
// `usa` dice dónde sale el mensaje de cada motivo.
export const MOTIVOS_PLANTILLA = [
  { id: "control_vencido", nombre: "Control vencido", usa: "Para contactar, el Inicio y las campañas" },
  { id: "control_proximo", nombre: "Control que vence pronto", usa: "Para contactar y el Inicio" },
  { id: "cita_no_efectuada", nombre: "Cita no efectuada", usa: "«Contactar al paciente» del Inicio y de Citas" },
  { id: "cita_reagendada", nombre: "Cita reagendada", usa: "el aviso por WhatsApp de una cita que cambió de fecha u hora" },
  { id: "lentes_listos", nombre: "Pedido listo (retira)", usa: "el aviso «listo sin avisar» de Ventas y del Inicio, cuando el paciente retira en la óptica" },
  { id: "lentes_listos_envio", nombre: "Pedido listo (envío)", usa: "el aviso «listo sin avisar» de Ventas y del Inicio, cuando se envía a la dirección del paciente" },
  { id: "cumpleanos", nombre: "Cumpleaños", usa: "Fidelización (botón Saludar), Para contactar y las campañas. Va a quien aceptó promociones y saludos" },
  { id: "por_vender", nombre: "Diagnóstico sin compra", usa: "Para contactar: quien recibió su diagnóstico y todavía no compra" },
  { id: "medidas_montaje", nombre: "Medidas pedidas", usa: "el envío por WhatsApp de las medidas que el paciente pidió desde el portal" },
  { id: "sin_visitar", nombre: "Sin visitar +12 meses", usa: "Para contactar y las campañas" },
  { id: "postventa", nombre: "Después de la compra", usa: "Para contactar, unos días después de entregar los lentes" },
  { id: "promocion", nombre: "Promoción", usa: "las campañas de ofertas. Solo va a quien aceptó promociones y saludos" },
]

// Lo que el paciente de ejemplo recibe según el motivo: el pedido que se envía lleva una dirección de muestra.
const ENTREGA_EJEMPLO = { lentes_listos_envio: { tipo: "envio", direccion: "Av. Amazonas y Colón" } }

// Ventana «Plantillas» (el botón junto a «Nueva campaña»): el texto de cada motivo, con los datos automáticos que se pueden usar, la vista previa con un paciente de ejemplo y «Volver al original».
// La ventana única de Contactar usa siempre estas plantillas. Cada motivo se guarda por separado; lo que se escribe y no se guarda se conserva al cambiar de motivo.
export default function VentanaPlantillas({ plantillas, opticaNombre, opticaTelefono, puedeEditar, cumpleAuto, onCumpleAuto, onGuardar, onAviso, onCerrar }) {
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
    <Cascaron titulo="Plantillas de mensajes" subtitulo="Cada motivo tiene su mensaje. Se usa en todo el sistema al contactar." Icono={MessageSquareText} onCerrar={onCerrar} ancho="max-w-5xl"
      pie={<>
        {puedeEditar ? <button type="button" onClick={volverAlOriginal} disabled={esOriginal} className={CLASE_ACCION_SECUNDARIA}><RotateCcw size={14} aria-hidden="true" /> Volver al original</button> : <span className="text-xs text-slate-500">Solo quien tiene permiso de editar el CRM puede cambiar las plantillas.</span>}
        <div className="flex items-center gap-2">
          <button type="button" onClick={onCerrar} className={BOTON_CERRAR}>Cerrar</button>
          {puedeEditar && <button type="button" onClick={guardar} disabled={!cambio || invalido || guardando} className={CLASE_ACCION_PRINCIPAL} style={{ background: GRAD_MARCA }}>{guardando ? "Guardando…" : "Guardar"}</button>}
        </div>
      </>}>
      <div className="grid grid-cols-1 gap-4 px-5 py-4 lg:grid-cols-[minmax(13rem,0.8fr)_minmax(0,1.4fr)_minmax(14rem,1fr)] lg:items-start">
        <nav aria-label="Motivos">
          <p className="pb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">Motivos</p>
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

        <section aria-label={`Plantilla: ${motivo.nombre}`} className="space-y-3">
          <div>
            <h3 className="text-lg font-bold" style={{ color: INK }}>{motivo.nombre}</h3>
            <p className="text-xs text-slate-500">Se usa en {motivo.usa}.</p>
          </div>
          <EditorMensaje id="plantilla-texto" ayudaId="plantilla-texto-largo" motivo={elegido} valor={texto} filas={6} soloLectura={!puedeEditar} etiquetaVariables="Datos automáticos:" onCambio={poner} />
          {elegido === "cumpleanos" && <InterruptorAutomatico activo={cumpleAuto} puedeEditar={puedeEditar} onCambiar={onCumpleAuto} />}
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</p>}
        </section>

        <section aria-label="Vista previa">
          <h3 className="text-lg font-bold" style={{ color: INK }}>Vista previa</h3>
          <p className="text-sm text-slate-500">Con un paciente de ejemplo</p>
          <div data-vista-previa className="mt-3 whitespace-pre-line rounded-2xl px-4 py-3 text-[15px] leading-relaxed" style={{ background: "#DCF8C6", color: "#1f2d1f" }}>{vista}</div>
        </section>
      </div>
    </Cascaron>
  )
}
