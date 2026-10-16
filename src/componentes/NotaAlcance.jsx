import React from "react"

// Quien tiene alcance "propio" en citas o fichas ve cifras de SUS pacientes y SUS citas (visitas, controles, contactos):
// la pantalla lo dice, igual que el Inicio ("de tus pacientes"), para que no se lean como las de toda la óptica.
export default function NotaAlcance({ alcancePropio = false, className = "" }) {
  if (!alcancePropio) return null
  return <p role="note" className={"text-xs font-medium text-slate-500 " + className}>Las visitas, los controles y los contactos son de tus pacientes y de tus citas, no de toda la óptica.</p>
}
