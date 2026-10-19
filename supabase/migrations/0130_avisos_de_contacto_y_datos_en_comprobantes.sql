-- 0130 · Cuando el paciente cambia su teléfono o su correo: aviso a la óptica y comprobantes que conservan los datos del día
-- Pedido de Diego (18 oct. 2026, ronda 8, punto 9).
--
-- Qué ya hacía la 0104: el trigger `propagar_datos_paciente` copia el teléfono y el correo nuevos a las citas del paciente (la agenda y los recordatorios), `consultas` no guarda
-- esos datos, y `actualizar_contacto_paciente` deja la constancia en la actividad de la óptica. El perfil, el CRM y Ventas leen la ficha del paciente directamente.
--
-- Qué agrega esta migración:
--   1. avisos_contacto_paciente: un aviso por cada cambio («Marta Zambrano actualizó su teléfono»). Lo ve el personal con permiso de Pacientes en la campana y en «Requiere tu atención»
--      del Inicio, y lo marca como visto con atender_aviso_contacto(). Nadie escribe en la tabla directamente.
--   2. actualizar_contacto_paciente (mismo cuerpo de la 0104, misma firma) además crea ese aviso.
--   3. facturas_venta.paciente_telefono y paciente_correo: los datos del paciente EL DÍA que se emitió el comprobante. Un trigger los copia al crearlo y no se vuelven a tocar; los
--      comprobantes que ya existen reciben los datos que hoy tiene su paciente (es lo único que hay: no se guardaba una copia).

-- ═══════════════════════════════════════════════════════
-- 1. Avisos de cambio de contacto
-- ═══════════════════════════════════════════════════════
create table public.avisos_contacto_paciente (
  id uuid primary key default gen_random_uuid(),
  optica_id uuid not null references public.opticas(id) on delete cascade,
  paciente_id uuid not null references public.pacientes_base(id) on delete cascade,
  campos text not null check (campos in ('telefono', 'correo', 'telefono_y_correo')),
  creado_en timestamptz not null default now(),
  atendido_en timestamptz,
  atendido_por uuid references public.perfiles(id) on delete set null
);
create index avisos_contacto_pendientes_idx on public.avisos_contacto_paciente (optica_id, creado_en desc) where atendido_en is null;

alter table public.avisos_contacto_paciente enable row level security;
create policy avisos_contacto_staff_select on public.avisos_contacto_paciente for select
  using (
    optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid())
    and optica_activa_actual()
    and tiene_permiso('pacientes', 'ver')
  );
create policy avisos_contacto_superadmin_all on public.avisos_contacto_paciente for all
  using (es_superadmin()) with check (es_superadmin());
create policy exige_aal2_si_mfa_activo on public.avisos_contacto_paciente
  as restrictive for all
  using (mfa_satisfecho())
  with check (mfa_satisfecho());

create or replace function public.atender_aviso_contacto(p_aviso_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_optica uuid;
begin
  select p.optica_id into v_optica from perfiles p where p.id = auth.uid() and p.rol in ('admin', 'asistente');
  if v_optica is null then raise exception 'No tienes acceso a esta óptica.'; end if;
  if not optica_activa_actual() then raise exception 'La óptica está suspendida.'; end if;
  if not mfa_satisfecho() then raise exception 'Verifica tu segundo factor para continuar.'; end if;
  if not tiene_permiso('pacientes', 'ver') then raise exception 'No tienes permiso para ver los pacientes.'; end if;
  update avisos_contacto_paciente set atendido_en = now(), atendido_por = auth.uid()
   where id = p_aviso_id and optica_id = v_optica and atendido_en is null;
  return found;
end;
$function$;
revoke all on function public.atender_aviso_contacto(uuid) from public, anon;
grant execute on function public.atender_aviso_contacto(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════
-- 2. El paciente cambia su contacto: se avisa a la óptica (cuerpo de la 0104 + el aviso)
-- ═══════════════════════════════════════════════════════
create or replace function public.actualizar_contacto_paciente(
  p_paciente_id uuid,
  p_token text,
  p_telefono text default null,
  p_correo text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_tel text := nullif(btrim(p_telefono), '');
  v_cor text := nullif(btrim(p_correo), '');
  v_p pacientes_base%rowtype;
  v_cambia_tel boolean;
  v_cambia_cor boolean;
  v_accion text;
begin
  if not sesion_paciente_valida(p_paciente_id, p_token) then
    return jsonb_build_object('ok', false, 'error', 'sesion');
  end if;
  if v_tel is null and v_cor is null then
    return jsonb_build_object('ok', false, 'error', 'Indica el teléfono o el correo que quieres cambiar.');
  end if;
  if v_tel is not null and v_tel !~ '^[0-9]{7,10}$' then
    return jsonb_build_object('ok', false, 'error', 'El teléfono debe tener entre 7 y 10 dígitos, sin espacios ni guiones.');
  end if;
  if v_cor is not null and (length(v_cor) > 120 or v_cor !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') then
    return jsonb_build_object('ok', false, 'error', 'Ingresa un correo válido (ej. nombre@dominio.com).');
  end if;

  select * into v_p from pacientes_base where id = p_paciente_id and anonimizado_en is null for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'sesion');
  end if;

  v_cambia_tel := v_tel is not null and v_tel is distinct from v_p.telefono;
  v_cambia_cor := v_cor is not null and lower(v_cor) is distinct from lower(coalesce(v_p.correo, ''));

  if v_cambia_tel or v_cambia_cor then
    update pacientes_base
       set telefono = case when v_cambia_tel then v_tel else telefono end,
           correo = case when v_cambia_cor then v_cor else correo end
     where id = p_paciente_id;

    v_accion := case
      when v_cambia_tel and v_cambia_cor then 'El paciente actualizó su teléfono y su correo'
      when v_cambia_tel then 'El paciente actualizó su teléfono'
      else 'El paciente actualizó su correo'
    end;
    insert into logs_optica (optica_id, usuario_id, usuario_nombre, modulo, accion, detalle)
    values (v_p.optica_id, null, v_p.nombre, 'pacientes', v_accion, v_p.nombre || ' (desde el portal del paciente)');
    insert into avisos_contacto_paciente (optica_id, paciente_id, campos)
    values (v_p.optica_id, p_paciente_id, case when v_cambia_tel and v_cambia_cor then 'telefono_y_correo' when v_cambia_tel then 'telefono' else 'correo' end);
  end if;

  select * into v_p from pacientes_base where id = p_paciente_id;
  return jsonb_build_object('ok', true, 'telefono', v_p.telefono, 'correo', v_p.correo, 'cambio', v_cambia_tel or v_cambia_cor);
end;
$function$;
revoke all on function public.actualizar_contacto_paciente(uuid, text, text, text) from public;
grant execute on function public.actualizar_contacto_paciente(uuid, text, text, text) to anon;

-- ═══════════════════════════════════════════════════════
-- 3. Los comprobantes conservan el contacto del día en que se emitieron
-- ═══════════════════════════════════════════════════════
alter table public.facturas_venta add column paciente_telefono text, add column paciente_correo text;

update public.facturas_venta f
   set paciente_telefono = p.telefono,
       paciente_correo = case when p.correo is null or p.correo = 'Sin Correo' then null else p.correo end
  from public.pacientes_base p
 where p.id = f.paciente_id;

create or replace function public.facturas_guardar_contacto_del_dia()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  select p.telefono, case when p.correo is null or p.correo = 'Sin Correo' then null else p.correo end
    into new.paciente_telefono, new.paciente_correo
    from pacientes_base p where p.id = new.paciente_id;
  return new;
end;
$function$;
create trigger facturas_guardar_contacto_del_dia before insert on public.facturas_venta
  for each row execute function public.facturas_guardar_contacto_del_dia();

-- Después de emitida, el contacto del comprobante no se cambia (ni desde el cliente ni por error).
create or replace function public.facturas_contacto_inmutable()
returns trigger
language plpgsql
as $function$
begin
  if new.paciente_telefono is distinct from old.paciente_telefono or new.paciente_correo is distinct from old.paciente_correo then
    raise exception 'El teléfono y el correo de un comprobante emitido no se pueden cambiar.';
  end if;
  return new;
end;
$function$;
create trigger facturas_contacto_inmutable before update of paciente_telefono, paciente_correo on public.facturas_venta
  for each row execute function public.facturas_contacto_inmutable();

-- ───────────────────────── Reversión (no se ejecuta) ─────────────────────────
--   drop trigger facturas_contacto_inmutable on facturas_venta; drop trigger facturas_guardar_contacto_del_dia on facturas_venta;
--   drop function facturas_contacto_inmutable(); drop function facturas_guardar_contacto_del_dia();
--   alter table facturas_venta drop column paciente_telefono, drop column paciente_correo;
--   Volver a crear actualizar_contacto_paciente con el cuerpo de la 0104; drop function atender_aviso_contacto(uuid); drop table avisos_contacto_paciente;
