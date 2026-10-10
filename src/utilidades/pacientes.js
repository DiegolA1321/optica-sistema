// ─── Alta de paciente: inserta en Supabase (o genera un id local si no hay
// conexión configurada) con el mismo shape en todo el sistema. Centraliza lo
// que antes eran dos copias — Citas.jsx (alta rápida desde una cita) y
// Pacientes.jsx (alta completa) — para que una corrección futura (p. ej. el
// bug de zona horaria de fechaRegistro, ya resuelto en ambas antes de
// unificar) no dependa de acordarse de aplicarla dos veces.

import { hoyISO } from "./disponibilidad"
import { esNombreValido, esCedulaValida, esTelefonoValido, esEmailValido } from "./validaciones"

// `referidoPor`/`referidoPorId` son opcionales: Citas.jsx no pide ese dato en
// sus formularios rápidos, así que quedan null/"" y el registro se guarda
// igual que antes de unificar (la columna no se tocaba en absoluto).
export async function crearRegistroPaciente(supabase, opticaId, { nombre, cedula, telefono, correo, fechaNacimiento, referidoPor = "", referidoPorId = null }) {
  const nuevoPaciente = {
    nombre,
    cedula,
    telefono: telefono || "Sin Teléfono",
    correo: correo || "Sin Correo",
    fecha_nacimiento: fechaNacimiento || null,
    referidoPor,
    referidoPorId,
    evolucion: "Sin evaluación",
    ultimaConsulta: "Pendiente",
    // toISOString() convierte a UTC antes de recortar — en Ecuador (UTC-5),
    // registrar después de las 19:00 local guardaba la fecha del día
    // SIGUIENTE. hoyISO() arma la fecha con los componentes locales del Date.
    fechaRegistro: hoyISO(),
    estadoClinico: "Activo",
  }
  if (supabase && opticaId) {
    const { data, error } = await supabase
      .from("pacientes")
      .insert({
        optica_id: opticaId,
        nombre: nuevoPaciente.nombre,
        cedula: nuevoPaciente.cedula,
        telefono: nuevoPaciente.telefono,
        correo: nuevoPaciente.correo,
        fecha_nacimiento: nuevoPaciente.fecha_nacimiento,
        referido_por: nuevoPaciente.referidoPor || null,
        referido_por_id: nuevoPaciente.referidoPorId,
        evolucion: nuevoPaciente.evolucion,
        ultima_consulta: nuevoPaciente.ultimaConsulta,
        fecha_registro: nuevoPaciente.fechaRegistro,
        estado_clinico: nuevoPaciente.estadoClinico,
      })
      .select()
      .single()
    if (error) return { error }
    if (data) nuevoPaciente.id = data.id
  }
  if (nuevoPaciente.id == null) nuevoPaciente.id = Date.now()
  return { paciente: nuevoPaciente }
}

// Validación compartida de los datos básicos de un paciente (nombre, cédula,
// teléfono, correo) — antes vivía solo dentro de Citas.jsx (completar
// registro / confirmar datos / alta rápida); ahora también la usa
// ConfirmarDatosPacienteModal (D2, ver ese componente) para no repetir las
// mismas reglas en un segundo lugar.
export function validarDatosPaciente(pacientes, { nombre, cedula, telefono, correo }, idEnEdicion = null) {
  const errs = {}
  if (!esNombreValido(nombre)) errs.nombre = "Ingresa un nombre válido (solo letras)."
  if (!esCedulaValida(cedula)) errs.cedula = "Esa cédula no es válida — revisa los dígitos."
  else if (pacientes.some((p) => p.id !== idEnEdicion && p.cedula === cedula)) errs.cedula = "Ya existe un paciente registrado con esa cédula."
  if (!esTelefonoValido(telefono)) errs.telefono = "El teléfono debe tener entre 7 y 10 dígitos."
  if (correo && !esEmailValido(correo)) errs.correo = "Ingresa un correo válido (ej. nombre@dominio.com)."
  return errs
}

