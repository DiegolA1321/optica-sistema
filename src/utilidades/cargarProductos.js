import { mapProducto } from "./mapProducto"

// Los productos de la óptica con su costo. El costo vive aparte (`inventario_costos`, migración 0113) y la base solo lo entrega a quien tiene
// Inventario "editar": para los demás la consulta vuelve vacía y el producto queda sin costo, sin error.
export async function cargarProductos(supabase, opticaId) {
  const [productos, costos] = await Promise.all([
    supabase.from("inventario").select("*").eq("optica_id", opticaId).order("created_at", { ascending: false }),
    supabase.from("inventario_costos").select("producto_id, costo").eq("optica_id", opticaId),
  ])
  if (!productos.data) return { data: null, error: productos.error }
  const costoDe = new Map((costos.data || []).map((c) => [c.producto_id, Number(c.costo)]))
  return { data: productos.data.map((p) => mapProducto({ ...p, costo: costoDe.get(p.id) ?? null })), error: null }
}
