-- 0141 — Stock máximo propio de cada producto (reunión del 20 oct., Ronda 4: Inventario, punto 10).
--
-- El stock mínimo ya existe (inventario.critico: el propio del producto; el general vive en la parametrización de la óptica, Configuración → Inventario). El máximo funciona igual:
-- el general también vive en la parametrización (parametrizacion.stockMaximo, sin cambio de esquema) y, para el producto que necesita uno distinto, esta columna:
--
--   inventario.stock_maximo  integer  NULL = «usar el general»
--
-- El máximo NO limita nada: no hay disparador ni restricción sobre las existencias. Solo avisa «sobrestock» en la lista, en el Inicio y al registrar un ingreso (todo en la pantalla).
--
-- Qué NO cambia: ningún dato existente (la columna nace vacía en todos los productos, de todas las ópticas: «usar el general»), ninguna función, ninguna política ni permiso:
-- quien puede editar un producto (inventario: editar) ya puede escribir esta columna con las políticas de siempre; quien no, no.
-- Sin la columna la pantalla sigue funcionando (el máximo de todos los productos es el general); solo no se puede guardar un máximo propio.
--
-- Una óptica nueva no necesita nada más: su inventario nace con la columna vacía y el máximo general por defecto (30) sale del código hasta que el administrador lo cambie.
--
-- Revertir: alter table public.inventario drop column stock_maximo;

alter table public.inventario
  add column if not exists stock_maximo integer;

alter table public.inventario
  drop constraint if exists inventario_stock_maximo_check;
alter table public.inventario
  add constraint inventario_stock_maximo_check check (stock_maximo is null or (stock_maximo >= 1 and stock_maximo <= 9999));

comment on column public.inventario.stock_maximo is 'Stock máximo propio del producto; NULL = usar el general de la óptica (parametrizacion.stockMaximo). Solo avisa (sobrestock): no limita nada.';
