-- 0142 — Pedidos sin laboratorio: entrega («Retira en la óptica» o «Envío a domicilio», con su dirección) (reunión del 20 oct., Ronda 4: Ventas, punto 6).
--
-- La óptica no administra al laboratorio (se comunica con él por fuera): el pedido (la tabla `ordenes_laboratorio`) pasa a ser el registro simple de lo que se encarga afuera,
-- con CÓMO lo recibe el paciente y la fecha aproximada en que estará listo (la columna `fecha_prometida` de siempre; solo cambia cómo se llama en pantalla).
-- Los días por defecto de esa fecha viven en la parametrización de la óptica (`parametrizacion.diasPedido`, Configuración → Ventas): no necesitan esquema.
--
--   1. ordenes_laboratorio.entrega            text NOT NULL DEFAULT 'retira'  ('retira' | 'envio')
--      ordenes_laboratorio.direccion_entrega  text NULL                       (obligatoria si entrega = 'envio')
--      Todos los pedidos que ya existen quedan «retira» (como se entregaban hasta hoy). La columna `laboratorio` NO se toca ni se borra: lo guardado se conserva, solo se deja de mostrar.
--   2. crear_orden_laboratorio / actualizar_orden_laboratorio: mismas firmas (no se crea ninguna sobrecarga), leen `entrega` y `direccion_entrega` de p_datos.
--      El envío sin dirección se rechaza con un mensaje claro. Una orden sin `entrega` en p_datos (un cliente viejo) se crea como «retira».
--      Mismo permiso, mismas comprobaciones de óptica, venta anulada y orden cerrada, mismo historial: lo único que cambia es lo de la entrega y los textos de los avisos («pedido», «fecha aproximada»).
--   3. mis_ordenes_paciente: el portal recibe además `entrega` (para decir «te lo enviaremos» o «retíralo»). NO entrega la dirección (el paciente ya la sabe) ni el laboratorio.
--
-- Qué NO cambia: ninguna política, ningún permiso, ningún dato existente más que el valor por defecto de la columna nueva, ni el estado ni el historial de ningún pedido.
-- Una óptica nueva no necesita nada más: sus pedidos nacen con la entrega elegida en «Nueva venta» y los días por defecto salen del código (7) hasta que el administrador los cambie.
--
-- Revertir (ver al final): se restauran las dos funciones y mis_ordenes_paciente de 0087/0123 y se borran las dos columnas.

alter table public.ordenes_laboratorio
  add column if not exists entrega text not null default 'retira',
  add column if not exists direccion_entrega text;

alter table public.ordenes_laboratorio drop constraint if exists ordenes_entrega_valida;
alter table public.ordenes_laboratorio add constraint ordenes_entrega_valida check (entrega in ('retira', 'envio'));
alter table public.ordenes_laboratorio drop constraint if exists ordenes_envio_con_direccion;
alter table public.ordenes_laboratorio add constraint ordenes_envio_con_direccion check (entrega <> 'envio' or nullif(btrim(direccion_entrega), '') is not null);

comment on column public.ordenes_laboratorio.entrega is 'Cómo recibe el paciente el pedido: retira (en la óptica) o envio (a domicilio).';
comment on column public.ordenes_laboratorio.direccion_entrega is 'Dirección del envío a domicilio (obligatoria si entrega = envio).';

-- ════════════════════════════════════════════════════════════════
-- crear_orden_laboratorio(venta, datos): crea el pedido de una venta (mismos datos que antes + la entrega).
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
  v_entrega text;
  v_direccion text;
begin
  if p_datos is null or jsonb_typeof(p_datos) <> 'object' then
    raise exception 'Los datos del pedido no son válidos.';
  end if;

  select f.id, f.paciente_id, f.consulta_id, f.cita_id, f.estado into v_factura
  from facturas_venta f
  where f.id = p_factura_id and f.optica_id = v_optica;
  if not found then
    raise exception 'La venta no existe.';
  end if;
  if v_factura.estado = 'anulada' then
    raise exception 'La venta está anulada: no se puede crear un pedido.';
  end if;

  begin
    v_fecha := (p_datos ->> 'fecha_prometida')::date;
  exception when others then
    raise exception 'La fecha aproximada no es válida.';
  end;
  if v_fecha is null then
    raise exception 'Indica la fecha aproximada en que estará listo el pedido.';
  end if;
  if (p_datos ->> 'tipo_lente') is null or (p_datos ->> 'tipo_lente') not in ('monofocal', 'bifocal', 'progresivo') then
    raise exception 'Elige el tipo de lente.';
  end if;

  v_entrega := coalesce(nullif(btrim(p_datos ->> 'entrega'), ''), 'retira');
  if v_entrega not in ('retira', 'envio') then
    raise exception 'Elige cómo recibirá el paciente el pedido.';
  end if;
  v_direccion := case when v_entrega = 'envio' then nullif(btrim(p_datos ->> 'direccion_entrega'), '') else null end;
  if v_entrega = 'envio' and v_direccion is null then
    raise exception 'Escribe la dirección de envío.';
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
    montura, montura_medidas, laboratorio, fecha_prometida, observaciones, creada_por,
    entrega, direccion_entrega
  ) values (
    v_optica, v_numero, p_factura_id, v_factura.consulta_id, v_factura.paciente_id, v_factura.cita_id,
    coalesce(p_datos -> 'receta_od', '{}'::jsonb), coalesce(p_datos -> 'receta_oi', '{}'::jsonb),
    nullif(btrim(p_datos ->> 'dp_lejos'), ''), nullif(btrim(p_datos ->> 'dp_cerca'), ''), nullif(btrim(p_datos ->> 'altura_montaje'), ''),
    p_datos ->> 'tipo_lente', nullif(btrim(p_datos ->> 'material'), ''),
    coalesce((p_datos ->> 'antirreflejo')::boolean, false), coalesce((p_datos ->> 'filtro_azul')::boolean, false),
    coalesce((p_datos ->> 'fotocromatico')::boolean, false), nullif(btrim(p_datos ->> 'otros_tratamientos'), ''),
    nullif(btrim(p_datos ->> 'montura'), ''), nullif(btrim(p_datos ->> 'montura_medidas'), ''),
    nullif(btrim(p_datos ->> 'laboratorio'), ''), v_fecha, nullif(btrim(p_datos ->> 'observaciones'), ''), auth.uid(),
    v_entrega, v_direccion
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
-- actualizar_orden_laboratorio(pedido, datos): corrige el pedido mientras no esté entregado ni cancelado. Solo se cambian las claves que vienen en p_datos.
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
  v_entrega text;
  v_direccion text;
begin
  if p_datos is null or jsonb_typeof(p_datos) <> 'object' then
    raise exception 'Los datos del pedido no son válidos.';
  end if;
  select * into v_o from ordenes_laboratorio where id = p_orden_id and optica_id = v_optica for update;
  if not found then
    raise exception 'El pedido no existe.';
  end if;
  if v_o.estado in ('entregada', 'cancelada') then
    raise exception 'Este pedido ya está cerrado y no se puede modificar.';
  end if;

  if p_datos ? 'fecha_prometida' then
    begin
      v_fecha := (p_datos ->> 'fecha_prometida')::date;
    exception when others then
      raise exception 'La fecha aproximada no es válida.';
    end;
    if v_fecha is null then raise exception 'Indica la fecha aproximada en que estará listo el pedido.'; end if;
  else
    v_fecha := v_o.fecha_prometida;
  end if;
  v_tipo := coalesce(p_datos ->> 'tipo_lente', v_o.tipo_lente);
  if v_tipo not in ('monofocal', 'bifocal', 'progresivo') then
    raise exception 'Elige el tipo de lente.';
  end if;

  v_entrega := case when p_datos ? 'entrega' then coalesce(nullif(btrim(p_datos ->> 'entrega'), ''), 'retira') else v_o.entrega end;
  if v_entrega not in ('retira', 'envio') then
    raise exception 'Elige cómo recibirá el paciente el pedido.';
  end if;
  v_direccion := case
    when v_entrega <> 'envio' then null
    when p_datos ? 'direccion_entrega' then nullif(btrim(p_datos ->> 'direccion_entrega'), '')
    else v_o.direccion_entrega
  end;
  if v_entrega = 'envio' and v_direccion is null then
    raise exception 'Escribe la dirección de envío.';
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
    observaciones = case when p_datos ? 'observaciones' then nullif(btrim(p_datos ->> 'observaciones'), '') else observaciones end,
    entrega = v_entrega,
    direccion_entrega = v_direccion
  where id = p_orden_id;
  return true;
end;
$$;

revoke all on function public.actualizar_orden_laboratorio(uuid, jsonb) from public, anon;
grant execute on function public.actualizar_orden_laboratorio(uuid, jsonb) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- mis_ordenes_paciente: el portal recibe además cómo recibirá su pedido (sin la dirección ni el laboratorio).
-- ════════════════════════════════════════════════════════════════
create or replace function public.mis_ordenes_paciente(p_paciente_id uuid, p_token text default null)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(x.fila order by x.creada_en desc, x.numero desc), '[]'::jsonb)
  from (
    select o.creada_en, o.numero,
      jsonb_build_object(
        'id', o.id,
        'numero', o.numero,
        'estado', o.estado,
        'fecha_prometida', o.fecha_prometida,
        'tipo_lente', o.tipo_lente,
        'montura', o.montura,
        'entrega', o.entrega,
        'factura_id', o.factura_id,
        'creada_en', o.creada_en,
        'lista_el', (select max(h.cambiado_en) from ordenes_laboratorio_historial h where h.orden_id = o.id and h.estado = 'lista'),
        'entregada_el', (select max(h.cambiado_en) from ordenes_laboratorio_historial h where h.orden_id = o.id and h.estado = 'entregada')
      ) as fila
    from ordenes_laboratorio o
    where o.paciente_id = p_paciente_id and o.estado <> 'cancelada' and sesion_paciente_valida(p_paciente_id, p_token)
  ) x;
$function$;
revoke all on function public.mis_ordenes_paciente(uuid, text) from public;
grant execute on function public.mis_ordenes_paciente(uuid, text) to anon, authenticated;

-- ───────────────────────── Reversión (no se ejecuta) ─────────────────────────
--   1. Restaurar crear_orden_laboratorio y actualizar_orden_laboratorio como están en 0087 y mis_ordenes_paciente como está en 0123 (create or replace; mismas firmas).
--   2. alter table public.ordenes_laboratorio drop constraint ordenes_envio_con_direccion, drop constraint ordenes_entrega_valida, drop column direccion_entrega, drop column entrega;
--   (Los pedidos creados con envío perderían su entrega y su dirección; por eso se hace un pg_dump antes de aplicarla.)
