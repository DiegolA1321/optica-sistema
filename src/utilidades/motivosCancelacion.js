// Motivos de cancelación de una cita (reunión del 20 oct., CIT-7): una lista fija —para poder agrupar en los reportes— con «Otro» y un detalle opcional.
// Los códigos son los de la base (_motivo_de_cancelacion en la migración 0134); el texto es lo que se ve.
export const MOTIVOS_PERSONAL = [
  { id: "paciente_no_puede", texto: "El paciente no puede asistir" },
  { id: "paciente_llamada", texto: "El paciente lo pidió por llamada o WhatsApp" },
  { id: "optica_no_puede", texto: "La óptica no puede atender" },
  { id: "otro", texto: "Otro" },
]

// El portal habla en primera persona y no ofrece lo que solo la óptica puede decir.
export const MOTIVOS_PACIENTE = [
  { id: "paciente_no_puede", texto: "No puedo asistir" },
  { id: "paciente_ya_no_necesita", texto: "Ya no necesito la cita" },
  { id: "otro", texto: "Otro" },
]

export const LARGO_DETALLE_CANCELACION = 300
