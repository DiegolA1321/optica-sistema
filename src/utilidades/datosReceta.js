// Los datos de la óptica que salen en el encabezado de la receta (la hoja de la receta, HojaReceta): nombre, logo, dirección y teléfono. La dirección y el teléfono se configuran en Configuración
// (parametrización); el logo y la marca, con la óptica. Un solo lugar para la consulta (al terminar la atención), el perfil del paciente y la ventana de cada atención.
const texto = (v) => (typeof v === "string" ? v.trim() : "")

export function datosOpticaReceta(usuario = {}, parametrizacion = {}) {
  const marca = usuario?.opticaMarca || {}
  return {
    nombre: usuario?.opticaNombre,
    logoUrl: usuario?.opticaLogoUrl || "", // el logo de la óptica (opticas.logo_url), el mismo que ve todo el sistema
    direccion: texto(parametrizacion?.opticaDireccion) || texto(marca.direccion),
    telefono: texto(parametrizacion?.opticaTelefono) || texto(marca.telefono),
    correo: texto(marca.correo),
  }
}
