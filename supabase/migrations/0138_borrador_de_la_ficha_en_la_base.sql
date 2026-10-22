-- 0138 — El borrador de la ficha clínica vive en la base de datos (Ronda 3b, punto 16).
--
-- Hasta hoy el borrador se guardaba en el navegador de quien atendía (localStorage): si cambiaba de computadora, o se reagendaba la cita desde otra, se perdía. Ahora se guarda aquí,
-- cifrado igual que las fichas (cifrar_clinico), por persona + paciente + cita. Nadie lo lee ni lo escribe directo: solo estas funciones, y cada una pide el permiso de Ficha clínica.
--   · guardar_borrador_ficha(paciente, cita, datos)   crea o reemplaza el borrador propio.
--   · leer_borrador_ficha(paciente, cita)             devuelve el borrador propio de los últimos 7 días (datos, guardado_en) o nada.
--   · borrar_borrador_ficha(paciente, cita)           al terminar o descartar la atención.
--   · heredar_borrador_ficha(cita_origen, cita_nueva) la cita reagendada (nueva) hereda el borrador de la que no se efectuó.
-- Se borra solo con la cita, con el paciente (también al anonimizarlo) y con la óptica. No guarda nada que la ficha no guardara ya en el navegador.
--
-- Revertir: drop function (las cuatro) y drop table public.fichas_borradores.

create table public.fichas_borradores (
  id           uuid primary key default gen_random_uuid(),
  optica_id    uuid not null references public.opticas(id) on delete cascade,
  paciente_id  uuid not null references public.pacientes_base(id) on delete cascade,
  cita_id      uuid references public.citas_base(id) on delete cascade,
  usuario_id   uuid not null,
  datos_enc    bytea not null,
  guardado_en  timestamptz not null default now()
);
create unique index fichas_borradores_unico on public.fichas_borradores (usuario_id, paciente_id, coalesce(cita_id, '00000000-0000-0000-0000-000000000000'::uuid));
create index fichas_borradores_optica_idx on public.fichas_borradores (optica_id, guardado_en);

alter table public.fichas_borradores enable row level security;
create policy exige_aal2_si_mfa_activo on public.fichas_borradores as restrictive for all using (mfa_satisfecho()) with check (mfa_satisfecho());
revoke all on public.fichas_borradores from public, anon, authenticated;

-- La comprobación común: la óptica de quien llama y su permiso de Ficha clínica.
create function public._optica_de_ficha(p_nivel text)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid;
begin
  select p.optica_id into v_optica from perfiles p where p.id = auth.uid() and p.rol in ('admin', 'asistente');
  if v_optica is null then raise exception 'No tienes acceso a esta óptica.'; end if;
  if not optica_activa_actual() then raise exception 'La óptica está suspendida o tu cuenta está desactivada.'; end if;
  if not mfa_satisfecho() then raise exception 'Verifica tu segundo factor para continuar.'; end if;
  if not tiene_permiso('consultas', p_nivel) then raise exception 'No tienes permiso para la ficha clínica.'; end if;
  return v_optica;
end;
$function$;
revoke all on function public._optica_de_ficha(text) from public, anon, authenticated;

create function public.guardar_borrador_ficha(p_paciente_id uuid, p_cita_id uuid, p_datos jsonb)
returns timestamptz
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid := _optica_de_ficha('crear');
  v_ahora timestamptz := now();
begin
  if p_datos is null or length(p_datos::text) > 400000 then raise exception 'El borrador es demasiado grande.'; end if;
  if not exists (select 1 from pacientes_base where id = p_paciente_id and optica_id = v_optica and anonimizado_en is null) then raise exception 'El paciente no existe.'; end if;
  if p_cita_id is not null and not exists (select 1 from citas_base where id = p_cita_id and optica_id = v_optica) then raise exception 'La cita no existe.'; end if;
  delete from fichas_borradores where usuario_id = auth.uid() and guardado_en < v_ahora - interval '7 days';
  insert into fichas_borradores (optica_id, paciente_id, cita_id, usuario_id, datos_enc, guardado_en)
  values (v_optica, p_paciente_id, p_cita_id, auth.uid(), cifrar_clinico(p_datos::text), v_ahora)
  on conflict (usuario_id, paciente_id, coalesce(cita_id, '00000000-0000-0000-0000-000000000000'::uuid))
  do update set datos_enc = excluded.datos_enc, guardado_en = excluded.guardado_en;
  return v_ahora;
end;
$function$;

create function public.leer_borrador_ficha(p_paciente_id uuid, p_cita_id uuid)
returns table(datos jsonb, guardado_en timestamptz)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid := _optica_de_ficha('crear');
begin
  return query
    select descifrar_clinico(b.datos_enc)::jsonb, b.guardado_en
    from fichas_borradores b
    where b.optica_id = v_optica and b.paciente_id = p_paciente_id
      and coalesce(b.cita_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(p_cita_id, '00000000-0000-0000-0000-000000000000'::uuid)
      and b.guardado_en > now() - interval '7 days'
    order by (b.usuario_id = auth.uid()) desc, b.guardado_en desc
    limit 1; -- el propio; si no hay, el que heredó la cita (otro profesional puede retomarlo)
end;
$function$;

create function public.borrar_borrador_ficha(p_paciente_id uuid, p_cita_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid := _optica_de_ficha('crear');
begin
  delete from fichas_borradores
  where optica_id = v_optica and paciente_id = p_paciente_id
    and coalesce(cita_id, '00000000-0000-0000-0000-000000000000'::uuid) = coalesce(p_cita_id, '00000000-0000-0000-0000-000000000000'::uuid);
end;
$function$;

-- La cita nueva (reagendada) hereda el borrador de la que no se efectuó, de quien lo escribió. Devuelve si había algo que heredar.
create function public.heredar_borrador_ficha(p_cita_origen uuid, p_cita_nueva uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid := _optica_de_ficha('crear');
  v_b fichas_borradores%rowtype;
  v_nueva citas_base%rowtype;
begin
  select * into v_nueva from citas_base where id = p_cita_nueva and optica_id = v_optica;
  if not found then raise exception 'La cita no existe.'; end if;
  select * into v_b from fichas_borradores where optica_id = v_optica and cita_id = p_cita_origen and paciente_id = v_nueva.paciente_id order by guardado_en desc limit 1;
  if not found then return false; end if;
  insert into fichas_borradores (optica_id, paciente_id, cita_id, usuario_id, datos_enc, guardado_en)
  values (v_optica, v_b.paciente_id, p_cita_nueva, v_b.usuario_id, v_b.datos_enc, v_b.guardado_en)
  on conflict (usuario_id, paciente_id, coalesce(cita_id, '00000000-0000-0000-0000-000000000000'::uuid))
  do update set datos_enc = excluded.datos_enc, guardado_en = excluded.guardado_en;
  return true;
end;
$function$;

revoke all on function public.guardar_borrador_ficha(uuid, uuid, jsonb) from public, anon;
revoke all on function public.leer_borrador_ficha(uuid, uuid) from public, anon;
revoke all on function public.borrar_borrador_ficha(uuid, uuid) from public, anon;
revoke all on function public.heredar_borrador_ficha(uuid, uuid) from public, anon;
grant execute on function public.guardar_borrador_ficha(uuid, uuid, jsonb) to authenticated;
grant execute on function public.leer_borrador_ficha(uuid, uuid) to authenticated;
grant execute on function public.borrar_borrador_ficha(uuid, uuid) to authenticated;
grant execute on function public.heredar_borrador_ficha(uuid, uuid) to authenticated;
