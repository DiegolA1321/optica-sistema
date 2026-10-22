// Un producto del inventario tal como lo usa la pantalla: la fila de `inventario` con los nombres de la aplicación. Es una lista blanca:
// una columna nueva de la base no llega a la pantalla hasta que se agrega aquí (se usa al cargar, al refrescar cada 20 s y al guardar).
export function mapProducto(p) {
  return {
    id: p.id, nombre: p.nombre, categoria: p.categoria, stock: p.stock, precio: Number(p.precio), observacion: p.observacion || "", critico: p.critico, maximo: p.stock_maximo ?? null, imagen_url: p.imagen_url || null, activo: p.activo !== false, creadoEn: p.created_at,
    // Datos opcionales de la montura y su costo (migración 0111).
    codigo: p.codigo || "", marca: p.marca || "", modelo: p.modelo || "", color: p.color || "", proveedor: p.proveedor || "",
    calibre: p.calibre ?? null, puente: p.puente ?? null, varilla: p.varilla ?? null, costo: p.costo == null ? null : Number(p.costo),
  }
}
