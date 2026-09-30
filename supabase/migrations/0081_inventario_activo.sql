-- Inventario: en vez de permitir eliminar un producto que ya tiene ventas
-- asociadas (perdiendo el acceso a su "Reporte de ventas" desde la tabla,
-- aunque la venta en sí sobreviva por producto_id references ... on delete
-- set null + producto_nombre cacheado, 0047), se desactiva — deja de poder
-- elegirse en una venta nueva, pero conserva su historial y sigue siendo
-- reactivable. Productos sin ninguna venta asociada se pueden seguir
-- eliminando tal cual, con confirmación (sin cambios en ese camino).
--
-- Tabla simple, sin vista/cifrado de por medio (a diferencia de pacientes/
-- citas/consultas) — el cambio de esquema es mínimo.

alter table public.inventario
  add column if not exists activo boolean not null default true;
