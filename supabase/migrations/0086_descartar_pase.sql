-- Paso 9 del plan de prioridad 1 (reunión 29 sept., R35, R39, R40): la cola de
-- "Listo para venta". Quien vende toma los datos del diagnóstico, arma la
-- proforma y registra la venta; o marca "No compró" y deja el motivo.
--
-- Esta migración agrega lo que falta en la base:
--   1. El motivo por el que un paciente no compró (precio, lo pensará, compra en
--      otro lugar, otro con texto), guardado en el propio pase para que el
--      embudo de R40 pueda contarlo y agruparlo.
--   2. descartar_pase(): único camino para marcar "No compró" (nadie escribe en
--      la tabla directamente, igual que pasar_a_optica en la 0085).
--   3. reabrir_pase(): "Volver a la lista de espera" para un pase descartado
--      (por ejemplo, "lo pensará" y el paciente vuelve). El motivo anterior
--      queda en el historial de actividad (logs_optica).
--   4. registrar_proforma(): la proforma no se guarda como documento, pero el
--      pase anota cuándo se entregó una y por cuánto, para dar seguimiento a
--      "lo pensará" y medir en R40 cuántas proformas terminan en venta. Si se
--      vuelve a generar, se actualizan esos dos datos.
--   5. Un ajuste al trigger de facturas de la 0085:
--        - solo cierra el pase si la factura es del MISMO paciente de la
--          consulta (hoy un cliente podría mandar la consulta de otro paciente
--          en p_consulta_id y cerrar su pase);
--        - un paciente "descartado" que cambia de opinión y compra pasa a
--          'vendido' (antes un pase descartado quedaba así aunque se facturara);
--        - al volver a la cola por una anulación se limpia el motivo anterior.

alter table public.pases_a_venta
  add column motivo_descarte text check (motivo_descarte in ('precio', 'lo_pensara', 'otro_lugar', 'otro')),
  add column detalle_descarte text,
  add column proforma_entregada_en timestamptz,
  add column proforma_total numeric(10, 2) check (proforma_total is null or proforma_total >= 0);

alter table public.pases_a_venta
  add constraint pases_descartado_con_motivo check (estado <> 'descartado' or motivo_descarte is not null),
  add constraint pases_otro_con_detalle check (
    motivo_descarte is distinct from 'otro' or length(btrim(coalesce(detalle_descarte, ''))) >= 3
  ),
  add constraint pases_proforma_completa check ((proforma_entregada_en is null) = (proforma_total is null));

-- ════════════════════════════════════════════════════════════════
-- Comprobación común de las funciones de la cola: devuelve la óptica de quien
-- llama, o rechaza. Solo la usan otras funciones (no se expone a la API).
-- ════════════════════════════════════════════════════════════════
create or replace function public.optica_de_vendedor()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
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
    raise exception 'La óptica está suspendida.';
  end if;
  if not mfa_satisfecho() then
    raise exception 'Verifica tu segundo factor para continuar.';
  end if;
  if not (tiene_permiso_modulo('inventario') or tiene_permiso_modulo('pacientes') or tiene_permiso_modulo('consultas')) then
    raise exception 'No tienes permiso para atender la lista de ventas.';
  end if;
  return v_optica;
end;
$$;

revoke all on function public.optica_de_vendedor() from public, anon, authenticated;

-- ════════════════════════════════════════════════════════════════
-- descartar_pase(pase, motivo, detalle): "No compró".
-- Solo un pase que sigue 'listo' se puede descartar.
-- ════════════════════════════════════════════════════════════════
create or replace function public.descartar_pase(p_pase_id uuid, p_motivo text, p_detalle text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_optica uuid := optica_de_vendedor();
  v_pase record;
  v_nombre text;
  v_detalle text := nullif(left(btrim(coalesce(p_detalle, '')), 300), '');
begin
  if p_motivo is null or p_motivo not in ('precio', 'lo_pensara', 'otro_lugar', 'otro') then
    raise exception 'Elige el motivo por el que no compró.';
  end if;
  if p_motivo = 'otro' and length(coalesce(v_detalle, '')) < 3 then
    raise exception 'Describe el motivo.';
  end if;

  select id, estado, paciente_id into v_pase
  from pases_a_venta
  where id = p_pase_id and optica_id = v_optica
  for update;
  if not found then
    raise exception 'El pase no existe.';
  end if;
  if v_pase.estado <> 'listo' then
    raise exception 'Este paciente ya no está en la lista de espera.';
  end if;

  update pases_a_venta
     set estado = 'descartado',
         motivo_descarte = p_motivo,
         detalle_descarte = v_detalle,
         cerrada_por = auth.uid(),
         cerrada_en = now()
   where id = p_pase_id;

  select nombre into v_nombre from pacientes_base where id = v_pase.paciente_id;
  insert into logs_optica (optica_id, usuario_id, usuario_nombre, modulo, accion, detalle)
  select v_optica, auth.uid(), pf.nombre, 'pacientes', 'Marcó que un paciente no compró',
         coalesce(v_nombre, 'Paciente') || ' · ' ||
         case p_motivo when 'precio' then 'por el precio' when 'lo_pensara' then 'lo pensará' when 'otro_lugar' then 'comprará en otro lugar' else coalesce(v_detalle, 'otro') end
  from perfiles pf where pf.id = auth.uid();
  return true;
end;
$$;

revoke all on function public.descartar_pase(uuid, text, text) from public, anon;
grant execute on function public.descartar_pase(uuid, text, text) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- reabrir_pase(pase): "Volver a la lista de espera". Solo un pase 'descartado'
-- sin factura vuelve a 'listo'. El motivo anterior se guarda en la actividad
-- (logs_optica) y se limpia del pase.
-- ════════════════════════════════════════════════════════════════
create or replace function public.reabrir_pase(p_pase_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_optica uuid := optica_de_vendedor();
  v_pase record;
  v_nombre text;
begin
  select id, estado, paciente_id, motivo_descarte, detalle_descarte into v_pase
  from pases_a_venta
  where id = p_pase_id and optica_id = v_optica
  for update;
  if not found then
    raise exception 'El pase no existe.';
  end if;
  if v_pase.estado <> 'descartado' then
    raise exception 'Solo se puede volver a la lista de espera un paciente que no compró.';
  end if;

  update pases_a_venta
     set estado = 'listo', motivo_descarte = null, detalle_descarte = null, cerrada_por = null, cerrada_en = null
   where id = p_pase_id;

  select nombre into v_nombre from pacientes_base where id = v_pase.paciente_id;
  insert into logs_optica (optica_id, usuario_id, usuario_nombre, modulo, accion, detalle)
  select v_optica, auth.uid(), pf.nombre, 'pacientes', 'Devolvió un paciente a la lista de espera',
         coalesce(v_nombre, 'Paciente') || ' · motivo anterior: ' ||
         case v_pase.motivo_descarte when 'precio' then 'por el precio' when 'lo_pensara' then 'lo pensará' when 'otro_lugar' then 'comprará en otro lugar' else coalesce(v_pase.detalle_descarte, 'otro') end
  from perfiles pf where pf.id = auth.uid();
  return true;
end;
$$;

revoke all on function public.reabrir_pase(uuid) from public, anon;
grant execute on function public.reabrir_pase(uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- registrar_proforma(pase, total): anota que se entregó una proforma y su
-- monto. No guarda el documento. Devuelve la fecha registrada.
-- ════════════════════════════════════════════════════════════════
create or replace function public.registrar_proforma(p_pase_id uuid, p_total numeric)
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
     set proforma_entregada_en = v_cuando, proforma_total = round(p_total, 2)
   where id = p_pase_id;
  return v_cuando;
end;
$$;

revoke all on function public.registrar_proforma(uuid, numeric) from public, anon;
grant execute on function public.registrar_proforma(uuid, numeric) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- Trigger de facturas (reemplaza el cuerpo de la 0085; misma firma, sin
-- argumentos, así que no queda ninguna sobrecarga duplicada).
-- ════════════════════════════════════════════════════════════════
create or replace function public.sincronizar_pase_con_factura()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_otra uuid;
begin
  if tg_op = 'INSERT' then
    if new.consulta_id is not null and new.estado <> 'anulada' then
      update pases_a_venta
         set estado = 'vendido', factura_id = new.id, cerrada_en = now(), cerrada_por = new.registrado_por
       where consulta_id = new.consulta_id
         and paciente_id is not distinct from new.paciente_id
         and estado in ('listo', 'descartado');
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
$$;
