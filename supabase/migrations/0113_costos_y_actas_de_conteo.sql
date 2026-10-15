-- Inventario v2, segunda parte: el costo se oculta en el servidor y el conteo físico deja su acta.
--
--   1. COSTO. Hasta ahora el costo era una columna de `inventario`: quien podía ver el inventario la recibía aunque la pantalla no la mostrara.
--      Pasa a su propia tabla `inventario_costos`, que solo lee y escribe quien tiene Inventario "editar" (regla 36: lo que no se debe ver no se envía).
--      Quien no puede, recibe 0 filas, no un error. Los valores que ya existían se copian y la columna se quita.
--      La pantalla publicada no usa el costo (nunca lo leyó) y `select *` sigue funcionando.
--   2. ACTAS DE CONTEO. Cada conteo físico confirmado queda en `conteos_inventario`: fecha, quién contó, cuántos contó, cuáles tenían diferencia
--      (con lo que decía el sistema, lo contado y el precio y costo de ese momento), las unidades que sobran y faltan y el valor de la diferencia
--      en dinero (a precio de venta y, si hay costos, a costo). No se editan ni se borran. La lee quien tiene Inventario "editar".
--   3. registrar_conteo_inventario cambia lo que devuelve (ahora un jsonb con el id del acta y los ajustes): se quita la versión de la 0111 y se
--      crea la nueva (misma lista de parámetros; no queda una sobrecarga duplicada). La pantalla de la 0111 nunca se publicó.
--
-- Ensayo: scripts/ensayo-0113.mjs (dentro de una transacción que se revierte).

-- ════════════════════════════════════════════════════════════════
-- 1. Costos aparte
-- ════════════════════════════════════════════════════════════════
create table public.inventario_costos (
  producto_id uuid primary key references public.inventario(id) on delete cascade,
  optica_id   uuid not null references public.opticas(id) on delete cascade,
  costo       numeric(10,2) not null check (costo >= 0),
  updated_at  timestamptz not null default now()
);
create index inventario_costos_optica_idx on public.inventario_costos (optica_id);

insert into public.inventario_costos (producto_id, optica_id, costo)
select id, optica_id, costo from public.inventario where costo is not null;

alter table public.inventario drop column costo;

alter table public.inventario_costos enable row level security;
create policy inventario_costos_select on public.inventario_costos for select
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and (select tiene_permiso('inventario', 'editar')));
create policy inventario_costos_insert on public.inventario_costos for insert
  with check (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and (select tiene_permiso('inventario', 'editar'))
    and exists (select 1 from public.inventario i where i.id = producto_id and i.optica_id = inventario_costos.optica_id));
create policy inventario_costos_update on public.inventario_costos for update
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and (select tiene_permiso('inventario', 'editar')))
  with check (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and (select tiene_permiso('inventario', 'editar')));
create policy inventario_costos_delete on public.inventario_costos for delete
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and (select tiene_permiso('inventario', 'editar')));
create policy inventario_costos_superadmin on public.inventario_costos for all using (es_superadmin()) with check (es_superadmin());

revoke all on public.inventario_costos from public, anon, authenticated;
grant select, insert, update, delete on public.inventario_costos to authenticated;

-- ════════════════════════════════════════════════════════════════
-- 2. Actas de conteo
-- ════════════════════════════════════════════════════════════════
create table public.conteos_inventario (
  id                  uuid primary key default gen_random_uuid(),
  optica_id           uuid not null references public.opticas(id) on delete cascade,
  created_at          timestamptz not null default now(),
  usuario_id          uuid,
  usuario_nombre      text,
  productos_contados  integer not null check (productos_contados >= 0),
  productos_iguales   integer not null check (productos_iguales >= 0),
  unidades_sobrantes  integer not null default 0,
  unidades_faltantes  integer not null default 0,
  valor_precio        numeric(12,2) not null default 0,
  valor_costo         numeric(12,2),
  detalle             jsonb not null default '[]'::jsonb
);
create index conteos_inventario_optica_idx on public.conteos_inventario (optica_id, created_at desc);

alter table public.conteos_inventario enable row level security;
create policy conteos_inventario_select on public.conteos_inventario for select
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and (select tiene_permiso('inventario', 'editar')));
create policy conteos_inventario_superadmin_select on public.conteos_inventario for select using (es_superadmin());
revoke all on public.conteos_inventario from public, anon, authenticated;
grant select on public.conteos_inventario to authenticated;

-- Misma protección que los movimientos: ni editar ni borrar (borrar la óptica entera sí los arrastra).
create trigger conteos_inventario_inmutables
  before update or delete on public.conteos_inventario
  for each row execute function public._movimientos_inventario_inmutables();

-- ════════════════════════════════════════════════════════════════
-- 3. El conteo ahora deja su acta
-- ════════════════════════════════════════════════════════════════
drop function public.registrar_conteo_inventario(jsonb);

-- p_conteos = [{"producto_id": "...", "contado": 12}, …] con TODO lo que se contó (también lo que coincide). Todo o nada.
-- Las diferencias se registran como ajustes por conteo («Conteo físico»); el acta guarda todo lo demás.
-- Devuelve { "conteo_id": "...", "ajustes": [{ "producto_id", "antes", "despues", "diferencia" }] }.
create function public.registrar_conteo_inventario(p_conteos jsonb)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid;
  v_fila record;
  v_prod record;
  v_nombre text;
  v_contados integer := 0;
  v_iguales integer := 0;
  v_sobran integer := 0;
  v_faltan integer := 0;
  v_valor_precio numeric := 0;
  v_valor_costo numeric;
  v_detalle jsonb := '[]'::jsonb;
  v_ajustes jsonb := '[]'::jsonb;
  v_id uuid;
begin
  v_optica := optica_de_inventario('editar');
  if p_conteos is null or jsonb_typeof(p_conteos) <> 'array' or jsonb_array_length(p_conteos) = 0 then
    raise exception 'No hay productos contados.';
  end if;
  if (select count(distinct e ->> 'producto_id') from jsonb_array_elements(p_conteos) e) <> jsonb_array_length(p_conteos) then
    raise exception 'Un producto está repetido en el conteo.';
  end if;

  for v_fila in
    select (e ->> 'producto_id')::uuid as pid, (e ->> 'contado')::integer as contado
      from jsonb_array_elements(p_conteos) e
     order by 1  -- siempre el mismo orden, para que dos conteos a la vez no se bloqueen entre sí
  loop
    if v_fila.contado is null or v_fila.contado < 0 then
      raise exception 'La cantidad contada debe ser 0 o más.';
    end if;
    select i.id, i.nombre, i.categoria, i.stock, i.precio, c.costo into v_prod
      from inventario i left join inventario_costos c on c.producto_id = i.id
     where i.id = v_fila.pid and i.optica_id = v_optica
       for update of i;
    if not found then
      raise exception 'Un producto del conteo no existe.';
    end if;
    v_contados := v_contados + 1;
    if v_prod.stock = v_fila.contado then
      v_iguales := v_iguales + 1;
    else
      perform set_config('app.mov_tipo', 'ajuste_conteo', true);
      perform set_config('app.mov_motivo', 'Conteo físico', true);
      perform set_config('app.mov_ref', '', true);
      update inventario set stock = v_fila.contado where inventario.id = v_fila.pid;
      perform set_config('app.mov_tipo', '', true);
      perform set_config('app.mov_motivo', '', true);
      if v_fila.contado > v_prod.stock then
        v_sobran := v_sobran + (v_fila.contado - v_prod.stock);
      else
        v_faltan := v_faltan + (v_prod.stock - v_fila.contado);
      end if;
      v_valor_precio := v_valor_precio + (v_fila.contado - v_prod.stock) * coalesce(v_prod.precio, 0);
      if v_prod.costo is not null then
        v_valor_costo := coalesce(v_valor_costo, 0) + (v_fila.contado - v_prod.stock) * v_prod.costo;
      end if;
      v_detalle := v_detalle || jsonb_build_object(
        'producto_id', v_fila.pid, 'nombre', v_prod.nombre, 'categoria', v_prod.categoria, 'antes', v_prod.stock, 'contado', v_fila.contado,
        'diferencia', v_fila.contado - v_prod.stock, 'precio', v_prod.precio, 'costo', v_prod.costo);
      v_ajustes := v_ajustes || jsonb_build_object('producto_id', v_fila.pid, 'antes', v_prod.stock, 'despues', v_fila.contado, 'diferencia', v_fila.contado - v_prod.stock);
    end if;
  end loop;

  select p.nombre into v_nombre from perfiles p where p.id = auth.uid();
  insert into conteos_inventario (optica_id, usuario_id, usuario_nombre, productos_contados, productos_iguales, unidades_sobrantes, unidades_faltantes, valor_precio, valor_costo, detalle)
  values (v_optica, auth.uid(), v_nombre, v_contados, v_iguales, v_sobran, v_faltan, round(v_valor_precio, 2), round(v_valor_costo, 2), v_detalle)
  returning id into v_id;

  return jsonb_build_object('conteo_id', v_id, 'ajustes', v_ajustes);
end;
$function$;
revoke all on function public.registrar_conteo_inventario(jsonb) from public, anon;
grant execute on function public.registrar_conteo_inventario(jsonb) to authenticated;
