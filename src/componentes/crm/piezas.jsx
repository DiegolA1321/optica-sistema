"use client"

// Piezas que comparten las pestañas del CRM, para que se vean y se comporten igual (regla 18).
import { Insignia } from "../ventas/Lista"
import { ETIQUETA_MOTIVO, RESULTADOS } from "../../utilidades/crmContactos"

// El color solo comunica urgencia o estado (regla 14): rojo = vencido o perdido, azul = una ocasión para escribir.
const TONO_MOTIVO = { control_vencido: "rojo", sin_visitar: "rojo", control_proximo: "azul", cumpleanos: "azul", postventa: "azul", promocion: "gris" }

export const InsigniaMotivo = ({ motivo, title }) => <Insignia tono={TONO_MOTIVO[motivo] || "gris"} title={title}>{ETIQUETA_MOTIVO[motivo] || motivo}</Insignia>

export function InsigniaResultado({ resultado, automatico = false }) {
  const r = RESULTADOS[resultado]
  if (!r) return <Insignia tono="gris">Sin resultado</Insignia>
  return <Insignia tono={r.tono} title={automatico ? "El paciente agendó una cita después del contacto" : undefined}>{r.etiqueta}{automatico ? " (automático)" : ""}</Insignia>
}

// El nombre del paciente es un botón que abre su perfil (un solo camino al perfil, desde cualquier lista del CRM).
export function NombrePaciente({ paciente, onVerPerfil, className = "" }) {
  const base = "truncate text-left text-sm font-bold text-slate-800 "
  return onVerPerfil ? (
    <button type="button" onClick={() => onVerPerfil(paciente.id)} className={base + "hover:text-blue-700 hover:underline underline-offset-2 cursor-pointer " + className}>{paciente.nombre}</button>
  ) : <span className={base + className}>{paciente.nombre}</span>
}
