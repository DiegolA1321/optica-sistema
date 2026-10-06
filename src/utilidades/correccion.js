// Nombres que se muestran para el estado de corrección. Los valores guardados
// no cambian ("Sin evaluar" / "Sin evaluación"); solo se renombran para que se
// distingan a simple vista.
//  - "AV sin evaluar": el paciente tuvo consulta, pero el optómetra no marcó la
//    "AV con lentes" en ningún ojo.
//  - "Sin consulta": el paciente nunca tuvo una consulta registrada.
const ETIQUETAS = { "Sin evaluar": "AV sin evaluar", "Sin evaluación": "Sin consulta" }
export const etiquetaCorreccion = (estado) => ETIQUETAS[estado] || estado || ETIQUETAS["Sin evaluación"]

export const AYUDA_CORRECCION = {
  "Sin evaluar": "Tuvo consulta, pero no se midió la agudeza visual con lentes",
  "Sin evaluación": "Nunca ha tenido una consulta registrada",
}
