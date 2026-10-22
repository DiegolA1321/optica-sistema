"use client"

// Todo aviso que ofrece «Contactar» o «WhatsApp» (control vencido, contactar al paciente, lentes listos, medidas pedidas, cita reagendada, por vender, el CRM y el perfil del paciente) abre LA ventana
// de Contactar (ContactarModal): el mensaje ya escrito con la plantilla que la óptica personalizó en el CRM para ese motivo, editable antes de enviar; «Enviar por WhatsApp» lo abre listo para mandar y deja
// su contacto en el Seguimiento del CRM, igual que si se hubiera enviado desde el CRM. Una sola pieza para todos: el Dashboard la ofrece con este contexto y cada pantalla la pide con
// `useEscribirPorWhatsApp()`; así ningún aviso arma su propio texto, su propia ventana ni su propio link.
import { createContext, useContext } from "react"
import { abrirWhatsApp } from "../utilidades/whatsapp"
import { armarMensaje, plantillaDe } from "../utilidades/crmContactos"

const Contexto = createContext(null)
export const ProveedorEscribirPorWhatsApp = Contexto.Provider

// Sin proveedor (una pantalla probada sola) abre WhatsApp directo con el mensaje base, sin ventana.
const SIN_PROVEEDOR = ({ paciente, telefono, motivo, contexto = {}, alEnviar, registro }) => {
  const tel = telefono || paciente?.telefono
  const mensaje = armarMensaje(plantillaDe(motivo), { paciente, ...contexto })
  if (tel) { abrirWhatsApp(tel, mensaje); alEnviar?.(mensaje); registro?.({ paciente, motivo, mensaje }) }
  return { mensaje }
}
SIN_PROVEEDOR.manual = async () => ({ ok: true })

// escribir({ paciente, telefono?, motivo, contexto?, alEnviar?, registro?, alRegistrar? }): `motivo` es el del aviso (utilidades/crmContactos); `contexto`, lo propio de ese aviso ({ cita, orden, medidas }).
// Abre la ventana de Contactar y devuelve { mensaje } (o { sinTelefono: true } sin abrirla). Lo que debe pasar al enviar va en `alEnviar(texto)` (se llama dentro del clic de «Enviar por WhatsApp»;
// si se cierra la ventana no pasa nada). `registro({ paciente, motivo, mensaje })` reemplaza el registro del contacto (el CRM lo anota con su propio motivo y canal) y `alRegistrar(resultado)` el aviso de después.
export const useEscribirPorWhatsApp = () => useContext(Contexto) || SIN_PROVEEDOR

// Lo que arma el Dashboard con los datos del CRM: la plantilla de la óptica, el contacto registrado, el aviso flotante y la ventana (`pedirVentana` la dibuja).
export function crearEscribirPorWhatsApp({ plantillas, opticaNombre, consultas, contactarDeAviso, contactarManual, avisar, pedirVentana }) {
  const escribir = ({ paciente, telefono, motivo, contexto = {}, alEnviar, registro, alRegistrar }) => {
    const tel = telefono || paciente?.telefono
    if (!tel || /^sin /i.test(tel)) { avisar?.(`${paciente?.nombre || "El paciente"} no tiene teléfono registrado.`); return { sinTelefono: true } }
    const mensaje = armarMensaje(plantillaDe(motivo, plantillas), { paciente, opticaNombre, consultas, ...contexto })
    // Dentro del clic de «Enviar por WhatsApp»: primero la ventana de WhatsApp (si se espera a otra cosa antes, el navegador la bloquea) y después el registro.
    const enviar = (texto) => {
      abrirWhatsApp(tel, texto)
      alEnviar?.(texto)
      const anotar = registro || (paciente?.id ? ({ paciente: p, motivo: m, mensaje: t }) => contactarDeAviso({ paciente: p, motivo: m, mensaje: t }) : null)
      if (!anotar) { avisar?.(`WhatsApp abierto para ${paciente?.nombre || "el paciente"}.`); return }
      anotar({ paciente, motivo, mensaje: texto }).then((r) => {
        if (alRegistrar) alRegistrar(r)
        else avisar?.(r.ok ? `WhatsApp abierto para ${paciente.nombre}. Queda en el Seguimiento del CRM.` : `WhatsApp abierto para ${paciente.nombre}, pero no se pudo anotar en el CRM: ${r.error}`)
      })
    }
    if (pedirVentana) pedirVentana({ paciente, telefono: tel, motivo, mensaje, enviar })
    else enviar(mensaje)
    return { mensaje }
  }
  // El mensaje escrito a mano desde el perfil (WhatsApp o correo): queda en el Seguimiento del CRM; devuelve { ok, error? }.
  escribir.manual = async ({ paciente, canal, mensaje }) => (contactarManual ? contactarManual({ paciente, canal, mensaje }) : { ok: true })
  return escribir
}
