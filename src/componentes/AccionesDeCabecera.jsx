// Las acciones de la cabecera de un módulo (Citas, Pacientes, Ventas, Inventario): "Requieren atención" y la acción principal, una al lado
// de la otra, en el mismo orden y en el mismo sitio en todos los módulos (regla 1). `avisos` es el botón de avisos del módulo (o nada).
export default function AccionesDeCabecera({ avisos = null, children }) {
  return <div className="flex shrink-0 flex-wrap items-center justify-end gap-2.5 sm:flex-nowrap">{avisos}{children}</div>
}
