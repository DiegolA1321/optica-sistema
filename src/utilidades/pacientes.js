// ─── Alta de paciente: inserta en Supabase (o genera un id local si no hay
// conexión configurada) con el mismo shape en todo el sistema. Centraliza lo
// que antes eran dos copias — Citas.jsx (alta rápida desde una cita) y
// Pacientes.jsx (alta completa) — para que una corrección futura (p. ej. el
// bug de zona horaria de fechaRegistro, ya resuelto en ambas antes de
// unificar) no dependa de acordarse de aplicarla dos veces.

import { hoyISO } from "./disponibilidad"
import { esNombreValido, esTelefonoValido, esEmailValido } from "./validaciones"
import { errorDeDocumento } from "./documento"

// `referidoPor`/`referidoPorId` son opcionales: Citas.jsx no pide ese dato en
// sus formularios rápidos, así que quedan null/"" y el registro se guarda
// igual que antes de unificar (la columna no se tocaba en absoluto).
export async function crearRegistroPaciente(supabase, opticaId, { nombre, cedula, tipoDocumento = "cedula", telefono, correo, fechaNacimiento, referidoPor = "", referidoPorId = null, aceptaRecordatorios = true, aceptaPromociones = false }) {
  const nuevoPaciente = {
    nombre,
    cedula,
    tipoDocumento,
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
    // Los permisos con los que nace (Recordatorios de salud sí y Promociones y saludos no, salvo que quien lo registra elija otra cosa).
    aceptaRecordatorios, aceptaPromociones,
  }
  if (supabase && opticaId) {
    const { data, error } = await supabase
      .from("pacientes")
      .insert({
        optica_id: opticaId,
        nombre: nuevoPaciente.nombre,
        cedula: nuevoPaciente.cedula,
        tipo_documento: tipoDocumento,
        telefono: nuevoPaciente.telefono,
        correo: nuevoPaciente.correo,
        fecha_nacimiento: nuevoPaciente.fecha_nacimiento,
        referido_por: nuevoPaciente.referidoPor || null,
        referido_por_id: nuevoPaciente.referidoPorId,
        evolucion: nuevoPaciente.evolucion,
        ultima_consulta: nuevoPaciente.ultimaConsulta,
        fecha_registro: nuevoPaciente.fechaRegistro,
        estado_clinico: nuevoPaciente.estadoClinico,
        acepta_recordatorios: aceptaRecordatorios,
        acepta_promociones: aceptaPromociones,
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
// teléfono, correo): la cédula se valida con la regla oficial de Ecuador (dígito verificador) y no puede repetirse en la óptica.
export function validarDatosPaciente(pacientes, { nombre, cedula, telefono, correo, tipoDocumento = "cedula" }, idEnEdicion = null) {
  const errs = {}
  if (!esNombreValido(nombre)) errs.nombre = "Ingresa un nombre válido (solo letras)."
  const errDoc = errorDeDocumento(tipoDocumento, cedula)
  if (errDoc) errs.cedula = errDoc
  else if (pacientes.some((p) => p.id !== idEnEdicion && p.cedula === cedula)) errs.cedula = `Ya existe un paciente registrado con ese ${tipoDocumento === "cedula" ? "número de cédula" : "documento"}.`
  if (!esTelefonoValido(telefono)) errs.telefono = "El teléfono debe tener entre 7 y 10 dígitos."
  if (correo && !esEmailValido(correo)) errs.correo = "Ingresa un correo válido (ej. nombre@dominio.com)."
  return errs
}

