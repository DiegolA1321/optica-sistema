-- Inventario v2 (rama inventario-v2): "Montura", datos opcionales de la montura y kárdex (movimientos de inventario).
--
-- QUÉ HACE
--   1. La categoría "Armazones" pasa a llamarse "Montura" (productos y catálogo de cada óptica), como en Ventas y la orden de laboratorio.
--   2. Campos OPCIONALES de la montura en `inventario`: codigo, marca, modelo, color, calibre, puente, varilla (mm), proveedor y costo.
--   3. Tabla `movimientos_inventario` (el kárdex): cada cambio de existencia queda con su tipo, cantidad, existencia resultante,
--      motivo y quién lo hizo. Los movimientos NO se editan ni se borran. El stock actual de cada producto queda como su saldo inicial.
--   4. Un disparador sobre `inventario` registra el movimiento SOLO, así que la versión publicada sigue funcionando sin cambios:
--        · vender (crear_factura_venta) descuenta el stock como siempre y el movimiento nace como "venta";
--        · anular una venta devuelve el stock y nace como "anulación de venta";
--        · una edición directa del stock (la pantalla publicada todavía la permite) nace como "ajuste directo".
--      Las funciones de venta y de anulación NO se tocan: dos disparadores sobre `facturas_venta` solo anotan, dentro de la
--      misma transacción, de qué se trata el cambio que viene.
--   5. Funciones para la pantalla nueva (con permiso Inventario "editar"):
--        registrar_movimiento_inventario(producto, tipo, cantidad con signo, motivo)  → ingreso, merma, devolución, ajuste
--        registrar_conteo_inventario(conteos)                                          → conteo físico, atómico, solo registra diferencias
--
-- CÓMO NO ROMPE LO PUBLICADO
--   · No cambia la firma de ninguna función existente ni quita columnas: las columnas nuevas son opcionales.
--   · La política de lectura de `inventario` y todo lo demás quedan igual. `select *` sigue funcionando (trae columnas de más).
--   · Un producto con movimientos (todos tienen al menos su saldo inicial) ya no se puede ELIMINAR, solo descontinuar:
--     la pantalla publicada, al intentar eliminar uno sin ventas, mostrará "No se pudo eliminar el producto".
--
-- Ensayo: scripts/ensayo-0111.mjs (dentro de una transacción que se revierte).

-- ════════════════════════════════════════════════════════════════
-- 1. "Armazones" → "Montura"
-- ════════════════════════════════════════════════════════════════
update public.inventario set categoria = 'Montura' where categoria = 'Armazones';

update public.opticas o
   set categorias_inventario = (
     select array_agg(c order by primero)
       from (
         select c, min(orden) as primero
           from unnest(array_replace(o.categorias_inventario, 'Armazones', 'Montura')) with ordinality as t(c, orden)
          group by c
       ) s
   )
 where 'Armazones' = any (o.categorias_inventario);

alter table public.opticas alter column categorias_inventario set default array['Montura', 'Accesorios'];

-- ════════════════════════════════════════════════════════════════
-- 2. Datos opcionales de la montura
-- ════════════════════════════════════════════════════════════════
alter table public.inventario
  add column if not exists codigo    text,
  add column if not exists marca     text,
  add column if not exists modelo    text,
  add column if not exists color     text,
  add column if not exists calibre   smallint,
  add column if not exists puente    smallint,
  add column if not exists varilla   smallint,
  add column if not exists proveedor text,
  add column if not exists costo     numeric(10,2);

alter table public.inventario
  add constraint inventario_medidas_validas check (
    (calibre is null or calibre between 1 and 300) and (puente is null or puente between 1 and 300) and (varilla is null or varilla between 1 and 300)
  ),
  add constraint inventario_costo_valido check (costo is null or costo >= 0),
  add constraint inventario_textos_cortos check (
    char_length(coalesce(codigo, '')) <= 40 and char_length(coalesce(marca, '')) <= 60 and char_length(coalesce(modelo, '')) <= 60
    and char_length(coalesce(color, '')) <= 40 and char_length(coalesce(proveedor, '')) <= 80
  );

-- Un código no se repite dentro de la misma óptica (si se escribe).
create unique index if not exists inventario_codigo_unico_idx
  on public.inventario (optica_id, lower(btrim(codigo)))
  where codigo is not null and btrim(codigo) <> '';

-- ════════════════════════════════════════════════════════════════
-- 3. Kárdex
-- ════════════════════════════════════════════════════════════════
create table public.movimientos_inventario (
  id               uuid primary key default gen_random_uuid(),
  seq              bigint generated always as identity,
  optica_id        uuid not null references public.opticas(id) on delete cascade,
  producto_id      uuid not null references public.inventario(id),
  tipo             text not null check (tipo in (
                     'saldo_inicial', 'venta', 'anulacion_venta', 'ingreso_compra', 'ajuste_conteo', 'merma', 'devolucion_proveedor', 'ajuste_directo')),
  cantidad         integer not null,
  stock_resultante integer not null check (stock_resultante >= 0),
  motivo           text,
  referencia       uuid,   -- el comprobante de venta, cuando el movimiento sale de una venta o de su anulación
  usuario_id       uuid,
  usuario_nombre   text,
  created_at       timestamptz not null default now(),
  constraint movimientos_cantidad_valida check (cantidad <> 0 or tipo = 'saldo_inicial')
);
create index movimientos_inventario_producto_idx on public.movimientos_inventario (producto_id, created_at, seq);
create index movimientos_inventario_optica_idx   on public.movimientos_inventario (optica_id, created_at);

alter table public.movimientos_inventario enable row level security;

-- Se lee con Inventario "ver" o Reportes "ver", en la óptica propia. Nadie escribe directo: solo las funciones y el disparador (security definer).
create policy movimientos_inventario_select on public.movimientos_inventario for select
  using (
    optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and ((select tiene_permiso('inventario', 'ver')) or (select tiene_permiso('reportes', 'ver')))
  );
create policy movimientos_inventario_superadmin_select on public.movimientos_inventario for select using (es_superadmin());

revoke all on public.movimientos_inventario from public, anon, authenticated;
grant select on public.movimientos_inventario to authenticated;

-- Los movimientos no se editan ni se borran. (Borrar la óptica entera sí los arrastra: ahí la óptica ya no existe.)
create function public._movimientos_inventario_inmutables()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if tg_op = 'UPDATE' then
    raise exception 'Los movimientos de inventario no se pueden modificar.';
  end if;
  if exists (select 1 from public.opticas where id = old.optica_id) then
    raise exception 'Los movimientos de inventario no se pueden borrar.';
  end if;
  return old;
end;
$function$;
create trigger movimientos_inventario_inmutables
  before update or delete on public.movimientos_inventario
  for each row execute function public._movimientos_inventario_inmutables();

-- Saldo inicial de lo que ya existe: la existencia actual de cada producto, con la fecha en que se creó.
insert into public.movimientos_inventario (optica_id, producto_id, tipo, cantidad, stock_resultante, motivo, created_at)
select i.optica_id, i.id, 'saldo_inicial', i.stock, i.stock, 'Saldo inicial al activar el kárdex', i.created_at
  from public.inventario i;

-- ════════════════════════════════════════════════════════════════
-- 4. El disparador que anota cada cambio de existencia
-- ════════════════════════════════════════════════════════════════
create function public._anotar_movimiento_inventario()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tipo text;
  v_motivo text;
  v_ref uuid;
  v_nombre text;
begin
  select p.nombre into v_nombre from public.perfiles p where p.id = auth.uid();

  if tg_op = 'INSERT' then
    insert into public.movimientos_inventario (optica_id, producto_id, tipo, cantidad, stock_resultante, motivo, usuario_id, usuario_nombre)
    values (new.optica_id, new.id, 'saldo_inicial', new.stock, new.stock, 'Saldo inicial al registrar el producto', auth.uid(), v_nombre);
    return new;
  end if;

  -- El contexto lo deja la función que cambia el stock (o el disparador de ventas); sin contexto es una edición directa.
  v_tipo := nullif(current_setting('app.mov_tipo', true), '');
  if v_tipo is null or v_tipo not in ('venta', 'anulacion_venta', 'ingreso_compra', 'ajuste_conteo', 'merma', 'devolucion_proveedor') then
    v_tipo := 'ajuste_directo';
    v_motivo := 'Cambio directo de la existencia';
    v_ref := null;
  else
    v_motivo := nullif(current_setting('app.mov_motivo', true), '');
    v_ref := nullif(current_setting('app.mov_ref', true), '')::uuid;
  end if;

  insert into public.movimientos_inventario (optica_id, producto_id, tipo, cantidad, stock_resultante, motivo, referencia, usuario_id, usuario_nombre)
  values (new.optica_id, new.id, v_tipo, new.stock - old.stock, new.stock, v_motivo, v_ref, auth.uid(), v_nombre);
  return new;
end;
$function$;

create trigger inventario_anotar_alta
  after insert on public.inventario
  for each row execute function public._anotar_movimiento_inventario();
create trigger inventario_anotar_stock
  after update of stock on public.inventario
  for each row when (old.stock is distinct from new.stock)
  execute function public._anotar_movimiento_inventario();

-- Las ventas y sus anulaciones ya descuentan y devuelven el stock en sus propias funciones (que no se tocan): estos dos
-- disparadores solo anotan de qué se trata, para que el movimiento nazca como "venta" o "anulación de venta".
create function public._contexto_movimiento_de_venta()
returns trigger
language plpgsql
as $function$
begin
  if tg_op = 'INSERT' then
    perform set_config('app.mov_tipo', 'venta', true);
    perform set_config('app.mov_motivo', 'Venta', true);
    perform set_config('app.mov_ref', new.id::text, true);
  elsif new.estado = 'anulada' and old.estado is distinct from 'anulada' then
    perform set_config('app.mov_tipo', 'anulacion_venta', true);
    perform set_config('app.mov_motivo', 'Anulación de la venta', true);
    perform set_config('app.mov_ref', new.id::text, true);
  end if;
  return new;
end;
$function$;
create trigger facturas_venta_contexto_movimiento
  after insert or update of estado on public.facturas_venta
  for each row execute function public._contexto_movimiento_de_venta();

-- ════════════════════════════════════════════════════════════════
-- 5. Funciones de la pantalla nueva
-- ════════════════════════════════════════════════════════════════
-- La comprobación común (como optica_de_vendedor, pero del módulo Inventario).
create function public.optica_de_inventario(p_nivel text default 'ver')
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid;
begin
  select p.optica_id into v_optica
    from perfiles p
   where p.id = auth.uid() and p.rol in ('admin', 'asistente');
  if v_optica is null then
    raise exception 'No tienes acceso a esta óptica.';
  end if;
  if not optica_activa_actual() then
    raise exception 'La óptica está suspendida o tu cuenta está desactivada.';
  end if;
  if not mfa_satisfecho() then
    raise exception 'Verifica tu segundo factor para continuar.';
  end if;
  if not tiene_permiso('inventario', p_nivel) then
    raise exception 'No tienes permiso para esta acción de inventario.';
  end if;
  return v_optica;
end;
$function$;
revoke all on function public.optica_de_inventario(text) from public, anon, authenticated;

-- Ingreso por compra (+), merma o pérdida (−), devolución al proveedor (−) o ajuste por conteo (±).
-- p_cantidad lleva el signo del cambio. El motivo es obligatorio. Devuelve la existencia resultante.
create function public.registrar_movimiento_inventario(p_producto_id uuid, p_tipo text, p_cantidad integer, p_motivo text)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid;
  v_producto record;
  v_motivo text := btrim(coalesce(p_motivo, ''));
  v_nuevo integer;
begin
  if es_superadmin() then
    select i.optica_id into v_optica from inventario i where i.id = p_producto_id;
  else
    v_optica := optica_de_inventario('editar');
  end if;
  if p_tipo is null or p_tipo not in ('ingreso_compra', 'ajuste_conteo', 'merma', 'devolucion_proveedor') then
    raise exception 'Tipo de movimiento no válido.';
  end if;
  if p_cantidad is null or p_cantidad = 0 then
    raise exception 'Escribe una cantidad distinta de cero.';
  end if;
  if p_tipo = 'ingreso_compra' and p_cantidad < 0 then
    raise exception 'Un ingreso por compra suma unidades.';
  end if;
  if p_tipo in ('merma', 'devolucion_proveedor') and p_cantidad > 0 then
    raise exception 'Una merma o una devolución al proveedor restan unidades.';
  end if;
  if char_length(v_motivo) < 3 then
    raise exception 'Escribe el motivo del movimiento.';
  end if;
  if char_length(v_motivo) > 200 then
    raise exception 'El motivo es demasiado largo (máximo 200 caracteres).';
  end if;

  select i.id, i.nombre, i.stock into v_producto
    from inventario i
   where i.id = p_producto_id and i.optica_id = v_optica
   for update;
  if not found then
    raise exception 'El producto no existe.';
  end if;
  v_nuevo := v_producto.stock + p_cantidad;
  if v_nuevo < 0 then
    raise exception 'No hay tantas unidades de "%": la existencia actual es %.', v_producto.nombre, v_producto.stock;
  end if;

  perform set_config('app.mov_tipo', p_tipo, true);
  perform set_config('app.mov_motivo', v_motivo, true);
  perform set_config('app.mov_ref', '', true);
  update inventario set stock = v_nuevo where inventario.id = p_producto_id;
  perform set_config('app.mov_tipo', '', true);
  perform set_config('app.mov_motivo', '', true);
  return v_nuevo;
end;
$function$;
revoke all on function public.registrar_movimiento_inventario(uuid, text, integer, text) from public, anon;
grant execute on function public.registrar_movimiento_inventario(uuid, text, integer, text) to authenticated;

-- Conteo físico: p_conteos = [{"producto_id": "...", "contado": 12}, …]. Todo o nada. Solo se registran las diferencias, como
-- ajustes por conteo con el motivo "Conteo físico" (la fecha es la del propio movimiento). Devuelve cada diferencia aplicada.
create function public.registrar_conteo_inventario(p_conteos jsonb)
returns table (producto_id uuid, antes integer, despues integer, diferencia integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid;
  v_fila record;
  v_stock integer;
begin
  v_optica := optica_de_inventario('editar');
  if p_conteos is null or jsonb_typeof(p_conteos) <> 'array' or jsonb_array_length(p_conteos) = 0 then
    raise exception 'No hay productos contados.';
  end if;

  for v_fila in
    select (e ->> 'producto_id')::uuid as pid, (e ->> 'contado')::integer as contado
      from jsonb_array_elements(p_conteos) e
     order by 1  -- siempre el mismo orden, para que dos conteos a la vez no se bloqueen entre sí
  loop
    if v_fila.contado is null or v_fila.contado < 0 then
      raise exception 'La cantidad contada debe ser 0 o más.';
    end if;
    select i.stock into v_stock from inventario i where i.id = v_fila.pid and i.optica_id = v_optica for update;
    if not found then
      raise exception 'Un producto del conteo no existe.';
    end if;
    if v_stock <> v_fila.contado then
      perform set_config('app.mov_tipo', 'ajuste_conteo', true);
      perform set_config('app.mov_motivo', 'Conteo físico', true);
      perform set_config('app.mov_ref', '', true);
      update inventario set stock = v_fila.contado where inventario.id = v_fila.pid;
      perform set_config('app.mov_tipo', '', true);
      perform set_config('app.mov_motivo', '', true);
      producto_id := v_fila.pid; antes := v_stock; despues := v_fila.contado; diferencia := v_fila.contado - v_stock;
      return next;
    end if;
  end loop;
end;
$function$;
revoke all on function public.registrar_conteo_inventario(jsonb) from public, anon;
grant execute on function public.registrar_conteo_inventario(jsonb) to authenticated;
