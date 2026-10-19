-- 0132 · La solicitud de «medidas de montaje» del portal tiene respuesta de la óptica
-- Pedido de Diego (19 oct. 2026, punto 2): hoy el paciente pide sus medidas (0080: pacientes.medidas_solicitadas_en) y la óptica solo puede borrar la marca; el paciente
-- nunca se entera de qué pasó. Ahora la óptica cierra la solicitud de dos maneras y el paciente lo ve en su portal:
--   · «enviadas»: se le enviaron su distancia pupilar y su altura (se guardan los valores que se enviaron) → «Tu óptica te envió tus medidas».
--   · «cita»: faltaban medidas y se le agendó una cita para tomarlas (se guarda la fecha y la hora) → «Te esperamos para tomarlas».
-- Cerrar la solicitud la quita de «Requiere tu atención» (porque borra medidas_solicitadas_en) y queda en la actividad, igual que pedirla.
--
--   1. solicitudes_medidas: una fila por solicitud ya cerrada. Nadie escribe directamente: solo por cerrar_solicitud_medidas().
--   2. cerrar_solicitud_medidas(paciente, resultado, dp, altura, cita_fecha, cita_hora): solo el personal con permiso de editar Pacientes.
--   3. mi_solicitud_medidas_paciente(paciente, token): lo que ve el paciente (si hay una abierta y la última respuesta).
--   4. solicitar_medidas_paciente: mismo cuerpo de la 0080 (misma firma) y además deja «El paciente pidió sus medidas de montaje» en la actividad la primera vez.
-- No cambia ningún dato existente: las solicitudes abiertas hoy siguen abiertas.

-- ═══════════════════════════════════════════════════════
-- 1. Solicitudes ya respondidas
-- ═══════════════════════════════════════════════════════
create table public.solicitudes_medidas (
  id uuid primary key default gen_random_uuid(),
  optica_id uuid not null references public.opticas(id) on delete cascade,
  paciente_id uuid not null references public.pacientes_base(id) on delete cascade,
  solicitada_en timestamptz not null,
  cerrada_en timestamptz not null default clock_timestamp(),
  cerrada_por uuid references public.perfiles(id) on delete set null,
  resultado text not null check (resultado in ('enviadas', 'cita')),
  dp text check (dp is null or length(dp) <= 20),
  altura text check (altura is null or length(altura) <= 20),
  cita_fecha date,
  cita_hora text check (cita_hora is null or length(cita_hora) <= 10),
  constraint solicitudes_medidas_coherente check (
    (resultado = 'enviadas' and (dp is not null or altura is not null))
    or (resultado = 'cita' and cita_fecha is not null and cita_hora is not null)
  )
);
create index solicitudes_medidas_paciente_idx on public.solicitudes_medidas (paciente_id, cerrada_en desc);

alter table public.solicitudes_medidas enable row level security;
create policy solicitudes_medidas_staff_select on public.solicitudes_medidas for select
  using (
    optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid())
    and optica_activa_actual()
    and tiene_permiso('pacientes', 'ver')
  );
create policy solicitudes_medidas_superadmin_all on public.solicitudes_medidas for all
  using (es_superadmin()) with check (es_superadmin());
create policy exige_aal2_si_mfa_activo on public.solicitudes_medidas
  as restrictive for all
  using (mfa_satisfecho())
  with check (mfa_satisfecho());

-- ═══════════════════════════════════════════════════════
-- 2. El personal responde
-- ═══════════════════════════════════════════════════════
create or replace function public.cerrar_solicitud_medidas(
  p_paciente_id uuid,
  p_resultado text,
  p_dp text default null,
  p_altura text default null,
  p_cita_fecha date default null,
  p_cita_hora text default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_optica uuid;
  v_nombre_staff text;
  v_nombre_paciente text;
  v_pedida timestamptz;
  v_dp text := nullif(btrim(p_dp), '');
  v_altura text := nullif(btrim(p_altura), '');
begin
  select p.optica_id, p.nombre into v_optica, v_nombre_staff from perfiles p where p.id = auth.uid() and p.rol in ('admin', 'asistente');
  if v_optica is null then raise exception 'No tienes acceso a esta óptica.'; end if;
  if not optica_activa_actual() then raise exception 'La óptica está suspendida.'; end if;
  if not mfa_satisfecho() then raise exception 'Verifica tu segundo factor para continuar.'; end if;
  if not tiene_permiso('pacientes', 'editar') then raise exception 'No tienes permiso para editar pacientes.'; end if;
  if p_resultado not in ('enviadas', 'cita') then raise exception 'Resultado no válido.'; end if;
  if p_resultado = 'enviadas' and v_dp is null and v_altura is null then raise exception 'No hay medidas que enviar.'; end if;
  if p_resultado = 'cita' and (p_cita_fecha is null or nullif(btrim(p_cita_hora), '') is null) then raise exception 'Falta la fecha y la hora de la cita.'; end if;

  select medidas_solicitadas_en, nombre into v_pedida, v_nombre_paciente
    from pacientes_base where id = p_paciente_id and optica_id = v_optica for update;
  if v_pedida is null then return false; end if;   -- ya estaba cerrada (otra persona se adelantó) o no existe

  insert into solicitudes_medidas (optica_id, paciente_id, solicitada_en, cerrada_por, resultado, dp, altura, cita_fecha, cita_hora)
  values (v_optica, p_paciente_id, v_pedida, auth.uid(), p_resultado, v_dp, v_altura,
          case when p_resultado = 'cita' then p_cita_fecha end, case when p_resultado = 'cita' then btrim(p_cita_hora) end);
  update pacientes_base set medidas_solicitadas_en = null where id = p_paciente_id;

  insert into logs_optica (optica_id, usuario_id, usuario_nombre, modulo, accion, detalle)
  values (v_optica, auth.uid(), v_nombre_staff, 'pacientes',
          case p_resultado when 'enviadas' then 'Envió las medidas de montaje al paciente' else 'Agendó la toma de medidas de montaje' end,
          v_nombre_paciente);
  return true;
end;
$function$;
revoke all on function public.cerrar_solicitud_medidas(uuid, text, text, text, date, text) from public, anon;
grant execute on function public.cerrar_solicitud_medidas(uuid, text, text, text, date, text) to authenticated;

-- ═══════════════════════════════════════════════════════
-- 3. Lo que ve el paciente
-- ═══════════════════════════════════════════════════════
create or replace function public.mi_solicitud_medidas_paciente(p_paciente_id uuid, p_token text default null)
returns jsonb
language sql
stable
security definer
set search_path = public
as $function$
  select case when not sesion_paciente_valida(p_paciente_id, p_token) then null else jsonb_build_object(
    'abierta_desde', (select medidas_solicitadas_en from pacientes_base where id = p_paciente_id),
    'ultima', (select jsonb_build_object('resultado', s.resultado, 'solicitada', s.solicitada_en, 'cerrada', s.cerrada_en,
                                         'dp', s.dp, 'altura', s.altura, 'cita_fecha', s.cita_fecha, 'cita_hora', s.cita_hora)
                 from solicitudes_medidas s where s.paciente_id = p_paciente_id order by s.cerrada_en desc limit 1)
  ) end;
$function$;
revoke all on function public.mi_solicitud_medidas_paciente(uuid, text) from public;
grant execute on function public.mi_solicitud_medidas_paciente(uuid, text) to anon, authenticated;

-- ═══════════════════════════════════════════════════════
-- 4. Pedirla queda en la actividad (cuerpo de la 0080 + la anotación)
-- ═══════════════════════════════════════════════════════
create or replace function public.solicitar_medidas_paciente(
  p_paciente_id uuid,
  p_token text
) returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_p record;
begin
  if not sesion_paciente_valida(p_paciente_id, p_token) then
    return false;
  end if;

  select optica_id, nombre, medidas_solicitadas_en into v_p from pacientes_base where id = p_paciente_id;
  if v_p.medidas_solicitadas_en is not null then
    return true;   -- ya la había pedido y sigue abierta: no se anota otra vez
  end if;

  update pacientes_base set medidas_solicitadas_en = now() where id = p_paciente_id;
  insert into logs_optica (optica_id, usuario_id, usuario_nombre, modulo, accion, detalle)
  values (v_p.optica_id, null, v_p.nombre, 'pacientes', 'El paciente pidió sus medidas de montaje', v_p.nombre);
  return true;
end;
$function$;
