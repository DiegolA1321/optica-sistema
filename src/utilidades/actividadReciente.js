// Lo último que pasó con un paciente, de lo más reciente a lo más antiguo (hasta 5): sus citas ya ocurridas, sus compras y los mensajes que se le escribieron. Para «Actividad reciente» del Resumen.
import { textoDiagnostico } from "./pasesVenta"
import { diaDeRegistro } from "./periodoLista"
import { hoyISO } from "./disponibilidad"
import { CANALES, ETIQUETA_MOTIVO } from "./crmContactos"

// citas, consultas: las del paciente; compras: [{ id, fecha, texto }]; mensajes: filas de crm_contactos ({ id, canal, motivo, creado_en }). Cada evento: { id, fecha, tono, texto }.
export function actividadReciente({ citas = [], consultas = [], compras = [], mensajes = [], hoy = hoyISO() }) {
  const ev = []
  for (const c of citas) {
    if (!c.fecha || c.fecha > hoy) continue
    const k = consultas.find((x) => x.citaId === c.id)
    if (c.estado === "Atendida") ev.push({ id: "c" + c.id, fecha: c.fecha, tono: "verde", texto: `Consulta atendida · ${(k && textoDiagnostico(k)) || c.motivo || "Consulta general"}` })
    else if (c.estado === "No Asistió") ev.push({ id: "c" + c.id, fecha: c.fecha, tono: "rojo", texto: `Cita no efectuada · ${c.motivo || "Consulta general"}` })
    else if (c.estado === "Cancelada") ev.push({ id: "c" + c.id, fecha: c.fecha, tono: "gris", texto: `Cita cancelada · ${c.motivo || "Consulta general"}` })
    else if (c.estado === "En Atención") ev.push({ id: "c" + c.id, fecha: c.fecha, tono: "azul", texto: `En atención · ${c.motivo || "Consulta general"}` })
  }
  // Una atención sin cita (llegó sin agendar) también cuenta.
  for (const k of consultas) if (!k.citaId || !citas.some((c) => c.id === k.citaId)) ev.push({ id: "k" + k.id, fecha: k.fecha, tono: "verde", texto: `Consulta atendida · ${textoDiagnostico(k) || k.motivo || "Consulta general"}` })
  for (const v of compras) ev.push({ id: "v" + v.id, fecha: v.fecha, tono: "verde", texto: v.texto })
  for (const m of mensajes) {
    const motivo = ETIQUETA_MOTIVO[m.motivo]
    ev.push({ id: "m" + m.id, fecha: diaDeRegistro(m.creado_en), tono: "azul", texto: `Mensaje por ${CANALES[m.canal] || m.canal}${motivo ? ` · ${motivo.toLowerCase()}` : ""}` })
  }
  return ev.filter((e) => e.fecha).sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0)).slice(0, 5)
}
