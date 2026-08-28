-- Hallazgo de la revisión total (2026-08-28): el catálogo de categorías de
-- Inventario ("Armazones", "Accesorios") estaba fijo en el código —
-- CATEGORIAS = ["Armazones", "Accesorios"] en Inventario.jsx — sin forma de
-- que un administrador lo ajuste a lo que realmente vende su óptica, a
-- diferencia de motivos_consulta/diagnosticos_rapidos que ya eran editables
-- desde Configuración. Mismo patrón: columna en opticas, con el mismo valor
-- por defecto que ya traía el código, para que ninguna óptica existente vea
-- su inventario cambiar de categoría al aplicar esta migración.
alter table opticas add column if not exists categorias_inventario text[] not null default array['Armazones', 'Accesorios'];
