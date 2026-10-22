"use client"

import { useState } from "react"
import { MessageCircle } from "lucide-react"
import { Cascaron, PieFormulario } from "./AtencionPaciente"
import ContadorMensaje from "./ContadorMensaje"
import { LIMITE_MENSAJE } from "../utilidades/limiteMensaje"
import { ETIQUETA_MOTIVO } from "../utilidades/crmContactos"

// LA ventana de «Contactar» del sistema: la usan todos los lugares donde se le escribe a un paciente por un aviso (Inicio, Citas, Resumen del perfil, Ventas, CRM). Trae el mensaje ya escrito con la
// plantilla del CRM para ese motivo (con el nombre del paciente y, si hay, la fecha de la cita), se puede editar antes de enviar y «Enviar por WhatsApp» lo abre listo para mandar y deja el contacto
// registrado en el Seguimiento. `enviar(texto)` lo arma EscribirPorWhatsApp: se llama dentro del clic para que el navegador no bloquee la ventana de WhatsApp.
export default function ContactarModal({ paciente, telefono, motivo, mensaje: inicial, enviar, onCerrar }) {
  const [texto, setTexto] = useState(inicial || "")
  const vacio = texto.trim() === ""
  const alEnviar = (e) => {
    e.preventDefault()
    if (vacio) return
    enviar(texto.trim())
    onCerrar()
  }
  return (
    <Cascaron
      titulo={`Contactar a ${paciente?.nombre || "el paciente"}`}
      subtitulo={[ETIQUETA_MOTIVO[motivo], telefono && `WhatsApp ${telefono}`].filter(Boolean).join(" · ")}
      Icono={MessageCircle}
      ancho="max-w-lg"
      etiqueta="Contactar"
      onCerrar={onCerrar}
      formulario={{ onSubmit: alEnviar }}
      pie={<PieFormulario onCancelar={onCerrar} etiquetaGuardar="Enviar por WhatsApp" deshabilitado={vacio} nota="Queda en el Seguimiento del CRM." />}
    >
      <div className="space-y-1.5 px-5 py-4">
        <label htmlFor="contactar-mensaje" className="text-sm font-semibold text-slate-700">Mensaje <span className="font-normal text-slate-500">· puedes cambiarlo antes de enviar</span></label>
        <textarea id="contactar-mensaje" value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={LIMITE_MENSAJE} rows={7} autoFocus className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-[15px] leading-relaxed text-slate-800 outline-none focus-visible:border-blue-500" />
        <ContadorMensaje valor={texto} />
      </div>
    </Cascaron>
  )
}
