-- La categoría de las monturas se llama "Monturas" (en plural, como "Accesorios") en todas las ópticas: la Demo, la de pruebas y las demás,
-- y en la categoría predeterminada de las ópticas nuevas. Antes se llamaba "Armazones" (0007) y, desde la 0111, "Montura".
-- Solo cambia el texto de la categoría: no se pierde ni se mueve ningún producto ni existencia.
update public.inventario set categoria = 'Monturas' where categoria in ('Armazones', 'Armazón', 'Montura');

update public.opticas o
   set categorias_inventario = (
     select array_agg(c order by primero)
       from (
         select c, min(orden) as primero
           from (select case when x in ('Armazones', 'Armazón', 'Montura') then 'Monturas' else x end as c, orden
                   from unnest(o.categorias_inventario) with ordinality as t(x, orden)) q
          group by c
       ) s
   )
 where o.categorias_inventario && array['Armazones', 'Armazón', 'Montura'];

alter table public.opticas alter column categorias_inventario set default array['Monturas', 'Accesorios'];
