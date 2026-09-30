// Formatea un teléfono ecuatoriano (móvil de 9 dígitos con o sin el 0 inicial)
// al formato internacional que espera wa.me/api.whatsapp.com — misma lógica
// que antes vivía duplicada en CRM.jsx (enviarRecordatorio) y Citas.jsx
// (avisarReagendoWhatsApp), cada una con su propia copia.
export function formatearTelefonoEC(telefono) {
  let numero = (telefono || "").replace(/\D/g, "")
  if (numero.startsWith("0")) numero = "593" + numero.substring(1)
  if (!numero.startsWith("593") && numero.length === 9) numero = "593" + numero
  return numero
}

// Arma el link de WhatsApp Web/app con el mensaje precargado. Abrir este
// link (window.open) es todo el "envío" — el sistema no manda mensajes
// automáticos, igual que en CRM.jsx hoy.
export function linkWhatsApp(telefono, mensaje) {
  return `https://api.whatsapp.com/send?phone=${formatearTelefonoEC(telefono)}&text=${encodeURIComponent(mensaje)}`
}
