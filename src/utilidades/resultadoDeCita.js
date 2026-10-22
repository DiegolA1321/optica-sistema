// Lo que salió de una cita atendida, en una o tres líneas para su fila (la del perfil del paciente en el sistema del personal y «Tus visitas anteriores» del portal): el diagnóstico, la receta
// emitida (OD y OI) y, si compró algo, qué compró. Mismos datos y mismo orden en los dos lados; el portal lo dice en palabras simples (`estilo: "paciente"`).
import { textoDiagnostico } from "./pasesVenta"
import { valorD } from "./portalVistas"
import { recetasDe } from "./graduacion"

const tecnica = (o = {}) => [valorD(o.esfera) || "", valorD(o.cilindro), o.eje ? `x${o.eje}` : ""].filter(Boolean).join(" ")

// consulta: la atención de esa cita (o null); facturas: los comprobantes del paciente ({ citaId, consultaId, estado, lineas }).
// Devuelve [{ clave: "diagnostico" | "receta" | "compra", etiqueta, texto }] (vacío si no salió nada).
export function resultadoDeCita({ cita, consulta = null, facturas = [], estilo = "personal" } = {}) {
  const simple = estilo === "paciente"
  const lineas = []
  const dx = consulta ? textoDiagnostico(consulta) : ""
  if (dx) lineas.push({ clave: "diagnostico", etiqueta: simple ? "Lo que encontramos" : "Diagnóstico", texto: simple ? dx.charAt(0).toLowerCase() + dx.slice(1) : dx })
  if (consulta && recetasDe([consulta]).length) {
    const od = tecnica(consulta.od)
    const oi = tecnica(consulta.oi)
    const texto = simple ? [od && `derecho ${valorD(consulta.od?.esfera) || od}`, oi && `izquierdo ${valorD(consulta.oi?.esfera) || oi}`].filter(Boolean).join(" · ") : [od && `OD ${od}`, oi && `OI ${oi}`].filter(Boolean).join(" · ")
    if (texto) lineas.push({ clave: "receta", etiqueta: simple ? "Tu receta" : "Receta emitida", texto })
  }
  const compras = facturas.filter((f) => f.estado !== "anulada" && ((cita?.id != null && f.citaId === cita.id) || (consulta && f.consultaId === consulta.id)))
  const productos = compras.flatMap((f) => (f.lineas || []).map((l) => l.descripcion).filter(Boolean))
  if (productos.length) lineas.push({ clave: "compra", etiqueta: simple ? "Lo que compraste" : "Compró", texto: [...new Set(productos)].join(", ") })
  return lineas
}

// La receta de una consulta en una línea para el perfil del personal, en el orden en que se ven los ojos (OI a la izquierda, OD a la derecha): «OI +0.25 −1.00 × 170 · OD +0.25 −0.75 × 10».
// Un ojo sin esfera, cilindro ni eje no se nombra. Sin ningún dato, "".
const enLinea = (o = {}) => [valorD(o.esfera) || "", valorD(o.cilindro), o.eje ? `× ${o.eje}` : ""].filter(Boolean).join(" ")
export function recetaEnLinea(consulta) {
  if (!consulta || !recetasDe([consulta]).length) return ""
  return [["OI", consulta.oi], ["OD", consulta.od]].map(([n, o]) => { const t = enLinea(o); return t ? `${n} ${t}` : "" }).filter(Boolean).join(" · ")
}
