// Las atenciones (fichas clínicas) cuya cita no está en la lista de citas de la persona: una atención sin cita (el paciente llegó sin agendar) o la ficha de una cita que no es suya
// (su alcance de citas es «solo las suyas» y el de fichas es más amplio). En el segundo caso la base entrega con la ficha la fecha, la hora y el estado de esa cita (`citaResumen`, migración 0145);
// en el primero no hay cita y se dice «Sin cita». Lógica pura.
export function atencionesSinCita(consultas = [], citas = []) {
  return consultas
    .filter((k) => !citas.some((c) => c.id === k.citaId))
    .map((k) => {
      const r = k.citaResumen || null
      return { id: "consulta-" + k.id, fecha: r?.fecha || k.fecha, hora: r?.hora || "Sin cita", motivo: k.motivo, estado: r?.estado || "Atendida", _consulta: k }
    })
}
