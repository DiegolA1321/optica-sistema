-- Paso 10 del plan de prioridad 1 (reunión 29 sept., R36-R37): órdenes de
-- laboratorio. Cuando una venta incluye lentes, la vendedora genera una orden
-- vinculada a la venta, a la consulta y al paciente, con numeración
-- consecutiva por óptica. La orden se imprime en dos copias (laboratorio y
-- paciente) y pasa por: enviada al laboratorio → lista para entregar →
-- entregada. Cada cambio guarda fecha y responsable.
--
-- Decisiones de diseño:
--   * Una venta puede tener varias órdenes (dos pares: lejos y cerca, o lentes
--     y gafas de sol graduadas); cada una con su número, receta, montura y
--     fecha prometida. Si la venta se anula, todas las órdenes que aún no se
--     entregaron pasan a 'cancelada' (lo hace un trigger) para que no se mande
--     a fabricar algo que ya no se vendió.
--   * "laboratorio" es texto libre (la interfaz sugiere los ya usados en la
--     óptica) para ver los atrasos por laboratorio.
--   * "Atrasada" NO es un estado guardado: es 'enviada' con fecha prometida ya
--     pasada. Se calcula al mostrarla, así nunca queda desactualizada.
--   * Numeración: tabla de contadores por óptica. Cada orden toma el siguiente
--     número con un INSERT ... ON CONFLICT DO UPDATE, que bloquea la fila del
--     contador, así dos vendedoras a la vez nunca obtienen el mismo número.
--     (No se usa una columna en `opticas` porque esa tabla tiene sus campos
--     centrales protegidos por trigger desde la 0073.)
--   * La orden guarda una copia de la receta y de las medidas en el momento de
--     crearla (la vendedora puede completarlas o corregirlas): lo que se manda
--     al laboratorio no cambia si después se edita algo de la ficha.
--   * Nadie escribe en las tablas directamente: solo se lee. Las escrituras
--     pasan por crear_orden_laboratorio(), actualizar_orden_laboratorio(),
--     cambiar_estado_orden() y registrar_aviso_paciente().
--   * El aviso al administrador (R37) no necesita tabla: son las órdenes en
--     'lista' con paciente_avisado_en vacío, que el Inicio muestra como alerta.
--
-- Permisos: igual que facturas y pases (inventario, pacientes o consultas);
-- el Bloque D lo refinará con los roles.

-- ════════════════════════════════════════════════════════════════
-- Contador de números de orden, uno por óptica
-- ════════════════════════════════════════════════════════════════
create table public.contador_ordenes_laboratorio (
  optica_id uuid primary key references public.opticas(id) on delete cascade,
  ultimo_numero integer not null default 0
);
alter table public.contador_ordenes_laboratorio enable row level security;
-- Sin políticas para usuarios: solo la función security definer lo toca.

-- ════════════════════════════════════════════════════════════════
-- Órdenes
-- ════════════════════════════════════════════════════════════════
create table public.ordenes_laboratorio (
  id uuid primary key default gen_random_uuid(),
  optica_id uuid not null references public.opticas(id) on delete cascade,
  numero integer not null,
  factura_id uuid not null references public.facturas_venta(id) on delete cascade,
  consulta_id uuid references public.consultas_base(id) on delete set null,
  paciente_id uuid not null references public.pacientes_base(id) on delete cascade,
  cita_id uuid references public.citas_base(id) on delete set null,

  -- Receta por ojo: { esfera, cilindro, eje, adicion } como texto (igual que la ficha).
  receta_od jsonb not null default '{}'::jsonb,
  receta_oi jsonb not null default '{}'::jsonb,
  dp_lejos text,
  dp_cerca text,
  altura_montaje text,

  tipo_lente text not null check (tipo_lente in ('monofocal', 'bifocal', 'progresivo')),
  material text,
  antirreflejo boolean not null default false,
  filtro_azul boolean not null default false,
  fotocromatico boolean not null default false,
  otros_tratamientos text,

  montura text,
  montura_medidas text,

  laboratorio text,
  fecha_prometida date not null,
  observaciones text,

  estado text not null default 'enviada' check (estado in ('enviada', 'lista', 'entregada', 'cancelada')),
  creada_por uuid references public.perfiles(id) on delete set null,
  creada_en timestamptz not null default now(),
  paciente_avisado_en timestamptz,
  paciente_avisado_por uuid references public.perfiles(id) on delete set null,

  constraint ordenes_numero_unico unique (optica_id, numero),
  constraint ordenes_receta_objeto check (jsonb_typeof(receta_od) = 'object' and jsonb_typeof(receta_oi) = 'object'),
  constraint ordenes_aviso_completo check ((paciente_avisado_en is null) = (paciente_avisado_por is null))
);

create index ordenes_laboratorio_cola_idx on public.ordenes_laboratorio (optica_id, estado, fecha_prometida);
create index ordenes_laboratorio_factura_idx on public.ordenes_laboratorio (factura_id);
create index ordenes_laboratorio_paciente_idx on public.ordenes_laboratorio (paciente_id);

-- Historial: una fila por cada estado por el que pasa la orden, con quién y cuándo.
create table public.ordenes_laboratorio_historial (
  id uuid primary key default gen_random_uuid(),
  orden_id uuid not null references public.ordenes_laboratorio(id) on delete cascade,
  estado text not null check (estado in ('enviada', 'lista', 'entregada', 'cancelada')),
  cambiado_por uuid references public.perfiles(id) on delete set null,
  cambiado_en timestamptz not null default now(),
  nota text
);
create index ordenes_laboratorio_historial_orden_idx on public.ordenes_laboratorio_historial (orden_id, cambiado_en);

alter table public.ordenes_laboratorio enable row level security;
alter table public.ordenes_laboratorio_historial enable row level security;

create policy ordenes_laboratorio_staff_select on public.ordenes_laboratorio for select
  using (
    optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid())
    and optica_activa_actual()
    and (tiene_permiso_modulo('inventario') or tiene_permiso_modulo('pacientes') or tiene_permiso_modulo('consultas'))
  );
create policy ordenes_laboratorio_superadmin_all on public.ordenes_laboratorio for all
  using (es_superadmin()) with check (es_superadmin());
create policy exige_aal2_si_mfa_activo on public.ordenes_laboratorio
  as restrictive for all
  using (mfa_satisfecho())
  with check (mfa_satisfecho());

create policy ordenes_laboratorio_historial_staff_select on public.ordenes_laboratorio_historial for select
  using (exists (
    select 1 from public.ordenes_laboratorio o
    where o.id = ordenes_laboratorio_historial.orden_id
      and o.optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid())
      and optica_activa_actual()
      and (tiene_permiso_modulo('inventario') or tiene_permiso_modulo('pacientes') or tiene_permiso_modulo('consultas'))
  ));
create policy ordenes_laboratorio_historial_superadmin_all on public.ordenes_laboratorio_historial for all
  using (es_superadmin()) with check (es_superadmin());
create policy exige_aal2_si_mfa_activo on public.ordenes_laboratorio_historial
  as restrictive for all
  using (mfa_satisfecho())
  with check (mfa_satisfecho());

-- ════════════════════════════════════════════════════════════════
-- crear_orden_laboratorio(factura, datos): crea la orden de una venta.
-- p_datos trae el contenido de la orden (receta_od, receta_oi, dp_lejos,
-- dp_cerca, altura_montaje, tipo_lente, material, antirreflejo, filtro_azul,
-- fotocromatico, otros_tratamientos, montura, montura_medidas, laboratorio,
-- fecha_prometida, observaciones). Una venta puede tener varias órdenes. Devuelve el id de la orden.
-- La consulta, la cita y el paciente salen de la venta, no del cliente.
-- ════════════════════════════════════════════════════════════════
create or replace function public.crear_orden_laboratorio(p_factura_id uuid, p_datos jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_optica uuid := optica_de_vendedor();
  v_factura record;
  v_numero integer;
  v_id uuid;
  v_fecha date;
begin
  if p_datos is null or jsonb_typeof(p_datos) <> 'object' then
    raise exception 'Los datos de la orden no son válidos.';
  end if;

  select f.id, f.paciente_id, f.consulta_id, f.cita_id, f.estado into v_factura
  from facturas_venta f
  where f.id = p_factura_id and f.optica_id = v_optica;
  if not found then
    raise exception 'La venta no existe.';
  end if;
  if v_factura.estado = 'anulada' then
    raise exception 'La venta está anulada: no se puede crear una orden de laboratorio.';
  end if;

  begin
    v_fecha := (p_datos ->> 'fecha_prometida')::date;
  exception when others then
    raise exception 'La fecha prometida no es válida.';
  end;
  if v_fecha is null then
    raise exception 'Indica la fecha prometida de entrega.';
  end if;
  if (p_datos ->> 'tipo_lente') is null or (p_datos ->> 'tipo_lente') not in ('monofocal', 'bifocal', 'progresivo') then
    raise exception 'Elige el tipo de lente.';
  end if;

  -- Siguiente número de esta óptica (la fila del contador queda bloqueada hasta el commit).
  insert into contador_ordenes_laboratorio (optica_id, ultimo_numero)
  values (v_optica, 1)
  on conflict (optica_id) do update set ultimo_numero = contador_ordenes_laboratorio.ultimo_numero + 1
  returning ultimo_numero into v_numero;

  insert into ordenes_laboratorio (
    optica_id, numero, factura_id, consulta_id, paciente_id, cita_id,
    receta_od, receta_oi, dp_lejos, dp_cerca, altura_montaje,
    tipo_lente, material, antirreflejo, filtro_azul, fotocromatico, otros_tratamientos,
    montura, montura_medidas, laboratorio, fecha_prometida, observaciones, creada_por
  ) values (
    v_optica, v_numero, p_factura_id, v_factura.consulta_id, v_factura.paciente_id, v_factura.cita_id,
    coalesce(p_datos -> 'receta_od', '{}'::jsonb), coalesce(p_datos -> 'receta_oi', '{}'::jsonb),
    nullif(btrim(p_datos ->> 'dp_lejos'), ''), nullif(btrim(p_datos ->> 'dp_cerca'), ''), nullif(btrim(p_datos ->> 'altura_montaje'), ''),
    p_datos ->> 'tipo_lente', nullif(btrim(p_datos ->> 'material'), ''),
    coalesce((p_datos ->> 'antirreflejo')::boolean, false), coalesce((p_datos ->> 'filtro_azul')::boolean, false),
    coalesce((p_datos ->> 'fotocromatico')::boolean, false), nullif(btrim(p_datos ->> 'otros_tratamientos'), ''),
    nullif(btrim(p_datos ->> 'montura'), ''), nullif(btrim(p_datos ->> 'montura_medidas'), ''),
    nullif(btrim(p_datos ->> 'laboratorio'), ''), v_fecha, nullif(btrim(p_datos ->> 'observaciones'), ''), auth.uid()
  )
  returning id into v_id;

  insert into ordenes_laboratorio_historial (orden_id, estado, cambiado_por)
  values (v_id, 'enviada', auth.uid());

  return v_id;
end;
$$;

revoke all on function public.crear_orden_laboratorio(uuid, jsonb) from public, anon;
grant execute on function public.crear_orden_laboratorio(uuid, jsonb) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- actualizar_orden_laboratorio(orden, datos): corrige el contenido mientras la
-- orden no esté entregada ni cancelada. Mismas claves que al crear; solo se
-- cambian las que vienen en p_datos.
-- ════════════════════════════════════════════════════════════════
create or replace function public.actualizar_orden_laboratorio(p_orden_id uuid, p_datos jsonb)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_optica uuid := optica_de_vendedor();
  v_o ordenes_laboratorio%rowtype;
  v_fecha date;
  v_tipo text;
begin
  if p_datos is null or jsonb_typeof(p_datos) <> 'object' then
    raise exception 'Los datos de la orden no son válidos.';
  end if;
  select * into v_o from ordenes_laboratorio where id = p_orden_id and optica_id = v_optica for update;
  if not found then
    raise exception 'La orden no existe.';
  end if;
  if v_o.estado in ('entregada', 'cancelada') then
    raise exception 'Esta orden ya está cerrada y no se puede modificar.';
  end if;

  if p_datos ? 'fecha_prometida' then
    begin
      v_fecha := (p_datos ->> 'fecha_prometida')::date;
    exception when others then
      raise exception 'La fecha prometida no es válida.';
    end;
    if v_fecha is null then raise exception 'Indica la fecha prometida de entrega.'; end if;
  else
    v_fecha := v_o.fecha_prometida;
  end if;
  v_tipo := coalesce(p_datos ->> 'tipo_lente', v_o.tipo_lente);
  if v_tipo not in ('monofocal', 'bifocal', 'progresivo') then
    raise exception 'Elige el tipo de lente.';
  end if;

  update ordenes_laboratorio set
    receta_od = coalesce(p_datos -> 'receta_od', receta_od),
    receta_oi = coalesce(p_datos -> 'receta_oi', receta_oi),
    dp_lejos = case when p_datos ? 'dp_lejos' then nullif(btrim(p_datos ->> 'dp_lejos'), '') else dp_lejos end,
    dp_cerca = case when p_datos ? 'dp_cerca' then nullif(btrim(p_datos ->> 'dp_cerca'), '') else dp_cerca end,
    altura_montaje = case when p_datos ? 'altura_montaje' then nullif(btrim(p_datos ->> 'altura_montaje'), '') else altura_montaje end,
    tipo_lente = v_tipo,
    material = case when p_datos ? 'material' then nullif(btrim(p_datos ->> 'material'), '') else material end,
    antirreflejo = coalesce((p_datos ->> 'antirreflejo')::boolean, antirreflejo),
    filtro_azul = coalesce((p_datos ->> 'filtro_azul')::boolean, filtro_azul),
    fotocromatico = coalesce((p_datos ->> 'fotocromatico')::boolean, fotocromatico),
    otros_tratamientos = case when p_datos ? 'otros_tratamientos' then nullif(btrim(p_datos ->> 'otros_tratamientos'), '') else otros_tratamientos end,
    montura = case when p_datos ? 'montura' then nullif(btrim(p_datos ->> 'montura'), '') else montura end,
    montura_medidas = case when p_datos ? 'montura_medidas' then nullif(btrim(p_datos ->> 'montura_medidas'), '') else montura_medidas end,
    laboratorio = case when p_datos ? 'laboratorio' then nullif(btrim(p_datos ->> 'laboratorio'), '') else laboratorio end,
    fecha_prometida = v_fecha,
    observaciones = case when p_datos ? 'observaciones' then nullif(btrim(p_datos ->> 'observaciones'), '') else observaciones end
  where id = p_orden_id;
  return true;
end;
$$;

revoke all on function public.actualizar_orden_laboratorio(uuid, jsonb) from public, anon;
grant execute on function public.actualizar_orden_laboratorio(uuid, jsonb) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- cambiar_estado_orden(orden, estado, nota): enviada → lista → entregada.
-- Se puede retroceder un paso (para corregir un error) y queda en el
-- historial. 'cancelada' solo la pone el trigger de facturas anuladas.
-- Al pasar a 'enviada' o a 'lista' se limpia el aviso al paciente (si volvió y
-- vuelve a quedar lista, hay que avisar de nuevo).
-- ════════════════════════════════════════════════════════════════
create or replace function public.cambiar_estado_orden(p_orden_id uuid, p_estado text, p_nota text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_optica uuid := optica_de_vendedor();
  v_actual text;
  v_orden_actual int;
  v_orden_nuevo int;
begin
  if p_estado not in ('enviada', 'lista', 'entregada') then
    raise exception 'Estado no válido.';
  end if;
  select estado into v_actual from ordenes_laboratorio where id = p_orden_id and optica_id = v_optica for update;
  if not found then
    raise exception 'La orden no existe.';
  end if;
  if v_actual = 'cancelada' then
    raise exception 'La orden está cancelada porque la venta se anuló.';
  end if;
  if v_actual = p_estado then
    return false;
  end if;
  v_orden_actual := array_position(array['enviada', 'lista', 'entregada'], v_actual);
  v_orden_nuevo := array_position(array['enviada', 'lista', 'entregada'], p_estado);
  if abs(v_orden_nuevo - v_orden_actual) <> 1 then
    raise exception 'Solo se puede pasar al estado siguiente o volver al anterior.';
  end if;

  update ordenes_laboratorio
     set estado = p_estado,
         paciente_avisado_en = case when p_estado in ('enviada', 'lista') then null else paciente_avisado_en end,
         paciente_avisado_por = case when p_estado in ('enviada', 'lista') then null else paciente_avisado_por end
   where id = p_orden_id;
  insert into ordenes_laboratorio_historial (orden_id, estado, cambiado_por, nota)
  values (p_orden_id, p_estado, auth.uid(), nullif(btrim(p_nota), ''));
  return true;
end;
$$;

revoke all on function public.cambiar_estado_orden(uuid, text, text) from public, anon;
grant execute on function public.cambiar_estado_orden(uuid, text, text) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- registrar_aviso_paciente(orden): anota que se avisó al paciente por
-- WhatsApp que sus lentes están listos. Solo órdenes en 'lista'. Devuelve la
-- fecha registrada.
-- ════════════════════════════════════════════════════════════════
create or replace function public.registrar_aviso_paciente(p_orden_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_optica uuid := optica_de_vendedor();
  v_estado text;
  v_cuando timestamptz := now();
begin
  select estado into v_estado from ordenes_laboratorio where id = p_orden_id and optica_id = v_optica for update;
  if not found then
    raise exception 'La orden no existe.';
  end if;
  if v_estado <> 'lista' then
    raise exception 'Solo se avisa al paciente cuando la orden está lista para entregar.';
  end if;
  update ordenes_laboratorio set paciente_avisado_en = v_cuando, paciente_avisado_por = auth.uid() where id = p_orden_id;
  return v_cuando;
end;
$$;

revoke all on function public.registrar_aviso_paciente(uuid) from public, anon;
grant execute on function public.registrar_aviso_paciente(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- Si la venta se anula, la orden que aún no se entregó se cancela. Se añade
-- al trigger de facturas sin tocar el de los pases (la 0086 sigue vigente).
-- ════════════════════════════════════════════════════════════════
create or replace function public.cancelar_orden_con_factura_anulada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.estado = 'anulada' and old.estado <> 'anulada' then
    with canceladas as (
      update ordenes_laboratorio set estado = 'cancelada'
       where factura_id = new.id and estado in ('enviada', 'lista')
      returning id
    )
    insert into ordenes_laboratorio_historial (orden_id, estado, cambiado_por, nota)
    select id, 'cancelada', auth.uid(), 'La venta se anuló' from canceladas;
  end if;
  return new;
end;
$$;

create trigger cancelar_orden_con_factura_anulada_trigger
  after update of estado on public.facturas_venta
  for each row execute function public.cancelar_orden_con_factura_anulada();
