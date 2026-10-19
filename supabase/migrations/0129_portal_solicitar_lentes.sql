-- 0129 · «Solicitar lentes nuevos» desde el portal del paciente
-- Pedido de Diego (18 oct. 2026, ronda 8, punto 8): el paciente avisa a la óptica que quiere lentes nuevos sin tener que escribir ni llamar. NO es un carrito: elige qué le interesa
-- (lentes con su receta vigente, montura nueva, lentes de sol o lentes de contacto), puede dejar un comentario y la solicitud llega a Ventas.
--
-- Se reutiliza la cola «Por vender» (pases_a_venta) en vez de crear otra: así la vendedora la atiende con las acciones de siempre («Tomar datos del diagnóstico», «No compró», WhatsApp)
-- y entra sola al aviso «Requiere tu atención» del Inicio. Lo que cambia:
--   1. pases_a_venta.consulta_id ya no es obligatorio: una solicitud del portal no nace de una consulta. Sigue siendo único y obligatorio para los pases que vienen de una consulta.
--   2. Columnas nuevas: origen ('consulta' | 'portal'), interes, comentario_paciente y en_atencion_en (cuándo alguien del personal la tomó).
--   3. solicitar_lentes_paciente(paciente, token, interes, comentario): crea la solicitud con la misma sesión de paciente del resto del portal. Una sola solicitud en curso por paciente.
--   4. mis_solicitudes_lentes_paciente(paciente, token): lo que el paciente ve, con tres estados en palabras simples: Recibida · En atención · Atendida.
--      Para el paciente «Atendida» es todo lo que ya se cerró (se vendió o no): el motivo de «No compró» es de la óptica y no se le muestra.
--   5. tomar_solicitud_portal(pase): el personal marca «En atención» al abrirla; registrar_proforma también lo marca (mismo cuerpo de 0086 más esa marca; misma firma).
--   6. El trigger de facturas también cierra (como «vendido») la solicitud del portal del mismo paciente que ya estaba en atención.
--   7. mis_compras_paciente ahora entrega también `cita_id` de cada compra (para mostrar lo que compró en cada visita). Misma firma que 0126: sin sobrecargas duplicadas.
--
-- Nadie escribe en la tabla directamente: solo por estas funciones (el paciente por la suya, el personal por las de la cola).

alter table public.pases_a_venta alter column consulta_id drop not null;

alter table public.pases_a_venta
  add column origen text not null default 'consulta' check (origen in ('consulta', 'portal')),
  add column interes text check (interes in ('lentes_con_receta', 'montura_nueva', 'lentes_de_sol', 'lentes_de_contacto')),
  add column comentario_paciente text check (comentario_paciente is null or length(comentario_paciente) <= 300),
  add column en_atencion_en timestamptz;

alter table public.pases_a_venta
  add constraint pases_consulta_o_portal check (
    (origen = 'consulta' and consulta_id is not null)
    or (origen = 'portal' and consulta_id is null and interes is not null and paciente_id is not null)
  );

-- Una sola solicitud del portal abierta por paciente.
create unique index pases_portal_abierto_unico on public.pases_a_venta (paciente_id) where origen = 'portal' and estado = 'listo';

-- ════════════════════════════════════════════════════════════════
-- El paciente solicita lentes nuevos
-- ════════════════════════════════════════════════════════════════
create or replace function public.solicitar_lentes_paciente(p_paciente_id uuid, p_token text, p_interes text, p_comentario text default null)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid;
  v_id uuid;
  v_comentario text := nullif(left(btrim(coalesce(p_comentario, '')), 300), '');
begin
  if not sesion_paciente_valida(p_paciente_id, p_token) then
    raise exception 'Tu sesión venció. Vuelve a iniciar sesión.';
  end if;
  if p_interes is null or p_interes not in ('lentes_con_receta', 'montura_nueva', 'lentes_de_sol', 'lentes_de_contacto') then
    raise exception 'Elige qué te interesa.';
  end if;
  select optica_id into v_optica from pacientes_base where id = p_paciente_id;
  if v_optica is null then
    raise exception 'No encontramos tu ficha.';
  end if;
  if exists (select 1 from pases_a_venta where paciente_id = p_paciente_id and origen = 'portal' and estado = 'listo') then
    raise exception 'Ya tienes una solicitud en curso. La óptica te contactará pronto.';
  end if;
  insert into pases_a_venta (optica_id, paciente_id, origen, interes, comentario_paciente)
  values (v_optica, p_paciente_id, 'portal', p_interes, v_comentario)
  returning id into v_id;
  return v_id;
end;
$function$;
revoke all on function public.solicitar_lentes_paciente(uuid, text, text, text) from public;
grant execute on function public.solicitar_lentes_paciente(uuid, text, text, text) to anon, authenticated;

-- ════════════════════════════════════════════════════════════════
-- Lo que el paciente ve de sus solicitudes
-- ════════════════════════════════════════════════════════════════
create or replace function public.mis_solicitudes_lentes_paciente(p_paciente_id uuid, p_token text default null)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'interes', s.interes,
    'comentario', s.comentario_paciente,
    'creada', s.pasada_en,
    'cerrada', s.cerrada_en,
    'estado', case when s.estado <> 'listo' then 'atendida' when s.en_atencion_en is not null or s.proforma_entregada_en is not null then 'en_atencion' else 'recibida' end
  ) order by s.pasada_en desc), '[]'::jsonb)
  from (
    select * from pases_a_venta
    where paciente_id = p_paciente_id and origen = 'portal' and sesion_paciente_valida(p_paciente_id, p_token)
    order by pasada_en desc limit 20
  ) s;
$function$;
revoke all on function public.mis_solicitudes_lentes_paciente(uuid, text) from public;
grant execute on function public.mis_solicitudes_lentes_paciente(uuid, text) to anon, authenticated;

-- ════════════════════════════════════════════════════════════════
-- El personal la toma: queda «En atención»
-- ════════════════════════════════════════════════════════════════
create or replace function public.tomar_solicitud_portal(p_pase_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_optica uuid := optica_de_vendedor();
  v_cuando timestamptz;
begin
  update pases_a_venta set en_atencion_en = coalesce(en_atencion_en, now())
   where id = p_pase_id and optica_id = v_optica and origen = 'portal' and estado = 'listo'
  returning en_atencion_en into v_cuando;
  if v_cuando is null then
    raise exception 'Esta solicitud ya no está en la lista de espera.';
  end if;
  return v_cuando;
end;
$function$;
revoke all on function public.tomar_solicitud_portal(uuid) from public, anon;
grant execute on function public.tomar_solicitud_portal(uuid) to authenticated;

-- registrar_proforma: igual que en 0086, y además marca la solicitud del portal como «En atención».
create or replace function public.registrar_proforma(p_pase_id uuid, p_total numeric)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_optica uuid := optica_de_vendedor();
  v_estado text;
  v_cuando timestamptz := now();
begin
  if p_total is null or p_total < 0 then
    raise exception 'El monto de la proforma no es válido.';
  end if;
  select estado into v_estado
  from pases_a_venta
  where id = p_pase_id and optica_id = v_optica
  for update;
  if not found then
    raise exception 'El pase no existe.';
  end if;
  if v_estado <> 'listo' then
    raise exception 'Este paciente ya no está en la lista de espera.';
  end if;

  update pases_a_venta
     set proforma_entregada_en = v_cuando, proforma_total = round(p_total, 2),
         en_atencion_en = coalesce(en_atencion_en, v_cuando)
   where id = p_pase_id;
  return v_cuando;
end;
$function$;

-- ════════════════════════════════════════════════════════════════
-- Trigger de facturas (mismo cuerpo de 0086; misma firma, sin argumentos). Añade: una factura del paciente cierra su solicitud del portal que ya estaba en atención.
-- ════════════════════════════════════════════════════════════════
create or replace function public.sincronizar_pase_con_factura()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_otra uuid;
begin
  if tg_op = 'INSERT' then
    if new.estado <> 'anulada' then
      if new.consulta_id is not null then
        update pases_a_venta
           set estado = 'vendido', factura_id = new.id, cerrada_en = now(), cerrada_por = new.registrado_por
         where consulta_id = new.consulta_id
           and paciente_id is not distinct from new.paciente_id
           and estado in ('listo', 'descartado');
      end if;
      if new.paciente_id is not null then
        update pases_a_venta
           set estado = 'vendido', factura_id = new.id, cerrada_en = now(), cerrada_por = new.registrado_por
         where origen = 'portal' and paciente_id = new.paciente_id and estado = 'listo' and en_atencion_en is not null;
      end if;
    end if;
  elsif tg_op = 'UPDATE' and new.estado = 'anulada' and old.estado <> 'anulada' then
    if new.consulta_id is not null then
      select f.id into v_otra
      from facturas_venta f
      where f.consulta_id = new.consulta_id and f.id <> new.id and f.estado <> 'anulada'
      order by f.created_at
      limit 1;
    end if;
    if v_otra is not null then
      update pases_a_venta set factura_id = v_otra
       where factura_id = new.id and estado = 'vendido';
    else
      update pases_a_venta
         set estado = 'listo', factura_id = null, cerrada_en = null, cerrada_por = null,
             motivo_descarte = null, detalle_descarte = null
       where factura_id = new.id and estado = 'vendido';
    end if;
  end if;
  return new;
end;
$function$;

-- ════════════════════════════════════════════════════════════════
-- mis_compras_paciente: cuerpo de 0126 más `cita_id`
-- ════════════════════════════════════════════════════════════════
create or replace function public.mis_compras_paciente(p_paciente_id uuid, p_token text default null)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(x.fila order by x.fecha desc, x.numero desc), '[]'::jsonb)
  from (
    select f.created_at as fecha, f.numero,
      jsonb_build_object(
        'id', f.id, 'numero', f.numero, 'fecha', f.created_at, 'total', f.monto_total, 'estado', f.estado, 'cita_id', f.cita_id,
        'abonado', case when f.estado = 'pagada' then f.monto_total else coalesce((select sum(a.monto) from abonos_factura a where a.factura_id = f.id and a.anulado_en is null), 0) end,
        'saldo', case when f.estado = 'pendiente_pago' then greatest(0, f.monto_total - coalesce((select sum(a.monto) from abonos_factura a where a.factura_id = f.id and a.anulado_en is null), 0)) else 0 end,
        'abonos', coalesce((select jsonb_agg(jsonb_build_object('fecha', a.fecha, 'monto', a.monto) order by a.fecha, a.created_at) from abonos_factura a where a.factura_id = f.id and a.anulado_en is null), '[]'::jsonb),
        'lineas', coalesce((select jsonb_agg(jsonb_build_object('descripcion', l.descripcion, 'cantidad', l.cantidad, 'subtotal', l.subtotal) order by l.created_at) from facturas_venta_lineas l where l.factura_id = f.id), '[]'::jsonb),
        'factura_electronica', case when f.factura_electronica is null then null else jsonb_build_object(
          'numero', f.factura_electronica,
          'autorizada_el', (select e.autorizada_el from facturas_electronicas e where e.factura_id = f.id),
          'pdf', exists (select 1 from facturas_electronicas_archivos a where a.factura_id = f.id and a.tipo = 'pdf'),
          'xml', exists (select 1 from facturas_electronicas_archivos a where a.factura_id = f.id and a.tipo = 'xml')
        ) end
      ) as fila
    from facturas_venta f
    where f.paciente_id = p_paciente_id and f.estado <> 'anulada' and sesion_paciente_valida(p_paciente_id, p_token)
  ) x;
$function$;
revoke all on function public.mis_compras_paciente(uuid, text) from public;
grant execute on function public.mis_compras_paciente(uuid, text) to anon, authenticated;

-- ───────────────────────── Reversión (no se ejecuta) ─────────────────────────
--   delete from pases_a_venta where origen = 'portal';
--   drop function solicitar_lentes_paciente(uuid, text, text, text); drop function mis_solicitudes_lentes_paciente(uuid, text); drop function tomar_solicitud_portal(uuid);
--   drop index pases_portal_abierto_unico; alter table pases_a_venta drop constraint pases_consulta_o_portal;
--   alter table pases_a_venta drop column origen, drop column interes, drop column comentario_paciente, drop column en_atencion_en; alter table pases_a_venta alter column consulta_id set not null;
--   Volver a crear registrar_proforma y sincronizar_pase_con_factura con el cuerpo de 0086, y mis_compras_paciente con el de 0126.
