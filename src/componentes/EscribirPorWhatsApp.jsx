"use client"

// Todo aviso que ofrece «WhatsApp» (control vencido, contactar al paciente, lentes listos, medidas pedidas, cita reagendada, por vender) escribe con la plantilla que la óptica personalizó
// en el CRM y deja su contacto en el Seguimiento del CRM, igual que si se hubiera enviado desde el CRM (Ronda 3a, punto 4). Una sola pieza para todos: el Dashboard la ofrece con este
// contexto y cada pantalla la pide con `useEscribirPorWhatsApp()`; así ningún aviso arma su propio texto ni su propio link.
import { createContext, useContext } from "react"
import { abrirWhatsApp } from "../utilidades/whatsapp"
import { armarMensaje, plantillaDe } from "../utilidades/crmContactos"

const Contexto = createContext(null)
export const ProveedorEscribirPorWhatsApp = Contexto.Provider

// Sin proveedor (una pantalla probada sola) abre WhatsApp con el mensaje base y no registra nada.
const SIN_PROVEEDOR = ({ paciente, telefono, motivo, contexto = {} }) => {
  const tel = telefono || paciente?.telefono
  const mensaje = armarMensaje(plantillaDe(motivo), { paciente, ...contexto })
  if (tel) abrirWhatsApp(tel, mensaje)
  return { mensaje }
}

// escribir({ paciente, telefono?, motivo, contexto? }): `motivo` es el del aviso (utilidades/crmContactos: MOTIVOS_DE_AVISO o control_vencido); `contexto`, lo propio de ese aviso
// ({ cita, orden, medidas }). Devuelve { mensaje } (o { sinTelefono: true }). Va síncrono dentro del clic: si se espera a otra cosa antes de abrir WhatsApp, el navegador bloquea la ventana.
export const useEscribirPorWhatsApp = () => useContext(Contexto) || SIN_PROVEEDOR

// Lo que arma el Dashboard con los datos del CRM: la plantilla de la óptica, el contacto registrado y el aviso flotante.
export function crearEscribirPorWhatsApp({ plantillas, opticaNombre, consultas, contactarDeAviso, avisar }) {
  return ({ paciente, telefono, motivo, contexto = {} }) => {
    const tel = telefono || paciente?.telefono
    if (!tel || /^sin /i.test(tel)) { avisar?.(`${paciente?.nombre || "El paciente"} no tiene teléfono registrado.`); return { sinTelefono: true } }
    const mensaje = armarMensaje(plantillaDe(motivo, plantillas), { paciente, opticaNombre, consultas, ...contexto })
    abrirWhatsApp(tel, mensaje)
    if (paciente?.id) {
      contactarDeAviso({ paciente, motivo, mensaje }).then((r) => {
        avisar?.(r.ok ? `WhatsApp abierto para ${paciente.nombre}. Queda en el Seguimiento del CRM.` : `WhatsApp abierto para ${paciente.nombre}, pero no se pudo anotar en el CRM: ${r.error}`)
      })
    } else avisar?.(`WhatsApp abierto para ${paciente?.nombre || "el paciente"}.`)
    return { mensaje }
  }
}
