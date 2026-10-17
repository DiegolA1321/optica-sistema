-- 0125 · El portal muestra con quién es la cita, deja confirmar la asistencia y calificar la atención
-- Pedido de Diego (17 oct. 2026, portal v2, tercera ronda). Tres funciones nuevas con el mismo token de sesión del paciente (`sesion_paciente_valida`). No cambia ninguna
-- tabla, política, función ni dato existente.
--
--   1. mis_citas_detalle_paciente(paciente, token): por cada cita del paciente, el NOMBRE del profesional (quien la atendió o, si no, a quien está asignada; sin ids del personal),
--      cuándo se confirmó, la receta que salió de esa cita (el id de la consulta enlazada) y su calificación, si ya la dio. Mismo criterio de «Profesional» que Citas.
--   2. confirmar_asistencia_paciente(paciente, token, cita): confirma una cita PENDIENTE y futura del propio paciente (idempotente). En Citas queda «Confirmada» (el mismo
--      confirmada_at del enlace del correo) y en la actividad queda anotado.
--   3. calificar_atencion_paciente(paciente, token, cita, puntaje, comentario): califica una cita ATENDIDA del propio paciente, una sola vez (índice único de respuestas_satisfaccion),
--      en la misma tabla que la encuesta del correo, así que cuenta igual en la satisfacción de Reportes. Comentario de hasta 500 caracteres.

create or replace function public.mis_citas_detalle_paciente(p_paciente_id uuid, p_token text default null)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'cita_id', c.id,
    'profesional', (select pe.nombre from perfiles pe where pe.id = coalesce(c.atendido_por, c.asignado_a)),
    'confirmada_at', c.confirmada_at,
    'consulta_id', (select co.id from consultas_base co where co.cita_id = c.id order by co.created_at desc limit 1),
    'calificacion', (select jsonb_build_object('puntaje', r.puntaje, 'comentario', r.comentario) from respuestas_satisfaccion r where r.cita_id = c.id)
  ) order by c.fecha desc, c.hora desc), '[]'::jsonb)
  from citas c
  where c.paciente_id = p_paciente_id and sesion_paciente_valida(p_paciente_id, p_token);
$function$;
revoke all on function public.mis_citas_detalle_paciente(uuid, text) from public;
grant execute on function public.mis_citas_detalle_paciente(uuid, text) to anon, authenticated;

create or replace function public.confirmar_asistencia_paciente(p_paciente_id uuid, p_token text, p_cita_id uuid)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_cita record;
begin
  if not sesion_paciente_valida(p_paciente_id, p_token) then
    return false;
  end if;
  select c.id, c.optica_id, c.paciente, c.fecha, c.hora, c.confirmada_at into v_cita
    from citas c
   where c.id = p_cita_id and c.paciente_id = p_paciente_id and c.estado = 'Pendiente' and c.fecha >= (now() at time zone 'America/Guayaquil')::date;
  if not found then
    return false;
  end if;
  if v_cita.confirmada_at is null then
    update citas_base set confirmada_at = now() where id = p_cita_id;
    insert into logs_optica (optica_id, usuario_id, usuario_nombre, modulo, accion, detalle)
    values (v_cita.optica_id, null, v_cita.paciente, 'citas', 'El paciente confirmó su asistencia', v_cita.paciente || ' · ' || v_cita.fecha::text || ' ' || v_cita.hora);
  end if;
  return true;
end;
$function$;
revoke all on function public.confirmar_asistencia_paciente(uuid, text, uuid) from public;
grant execute on function public.confirmar_asistencia_paciente(uuid, text, uuid) to anon, authenticated;

create or replace function public.calificar_atencion_paciente(p_paciente_id uuid, p_token text, p_cita_id uuid, p_puntaje smallint, p_comentario text default null)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid;
begin
  if not sesion_paciente_valida(p_paciente_id, p_token) then
    return false;
  end if;
  if p_puntaje is null or p_puntaje < 1 or p_puntaje > 5 then
    raise exception 'El puntaje debe estar entre 1 y 5.';
  end if;
  select optica_id into v_optica from citas where id = p_cita_id and paciente_id = p_paciente_id and estado = 'Atendida';
  if v_optica is null then
    return false;
  end if;
  insert into respuestas_satisfaccion (optica_id, cita_id, puntaje, comentario)
  values (v_optica, p_cita_id, p_puntaje, left(nullif(trim(p_comentario), ''), 500))
  on conflict (cita_id) do nothing;
  return found;
end;
$function$;
revoke all on function public.calificar_atencion_paciente(uuid, text, uuid, smallint, text) from public;
grant execute on function public.calificar_atencion_paciente(uuid, text, uuid, smallint, text) to anon, authenticated;

-- ───────────────────────── Reversión (no se ejecuta) ─────────────────────────
--   drop function public.mis_citas_detalle_paciente(uuid, text); drop function public.confirmar_asistencia_paciente(uuid, text, uuid);
--   drop function public.calificar_atencion_paciente(uuid, text, uuid, smallint, text);
