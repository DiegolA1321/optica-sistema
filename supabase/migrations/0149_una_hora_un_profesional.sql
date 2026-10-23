-- 0149 — Dos personas no pueden quedarse con la misma hora del mismo profesional (Ingreso y agendamiento, punto 20).
--
-- HOY: un índice único parcial (0062) permite UNA sola cita activa por óptica, fecha y hora. Eso impide el doble agendamiento, pero con dos o más profesionales también impide que dos
-- profesionales atiendan a la misma hora. La regla correcta es «una hora, un profesional».
--
-- QUÉ HACE:
--   1. El índice único pasa a ser por óptica + fecha + hora + profesional asignado (sin profesional = un grupo propio, como hasta ahora). Es MÁS FINO que el anterior: ninguna cita que ya
--      existe puede chocar con él (verificado: 0 choques hoy, y el índice viejo ya impedía cualquier choque).
--   2. Un disparador antes de guardar una cita (citas_sin_choque) cierra el caso que el índice no ve: en una óptica con 0 o 1 profesional la hora sigue siendo UNA sola para toda la óptica
--      (una cita sin profesional y otra con profesional, a la misma hora, chocan). Toma un candado por óptica+fecha+hora: dos confirmaciones en el mismo segundo se ordenan y la segunda pierde.
--      Vale para TODO camino de escritura (agendamiento web, portal, y en el personal «Gestionar cita», reagendar, «Atender ahora» y mover citas), porque vive en la tabla.
--   3. crear_cita_publica recibe `p_profesional_id` (opcional). Sin él, la base elige entre quienes atienden esa hora y no tienen otra cita (el primero libre) y lo deja como profesional de la
--      cita; con él, exige que ese profesional atienda a esa hora y esté libre. En una óptica sin profesionales marcados, todo sigue como antes. Cambia de firma: se borra la anterior.
--   4. reagendar_cita_publica conserva al profesional de la cita si está libre en la hora nueva; si no, toma otro libre; si no hay, «Esa hora acaba de ocuparse. Elige otra.».
--   5. horas_ocupadas_publicas entrega además `asignado_a` (qué profesional tiene ocupada cada hora) para que la web ofrezca solo horas realmente libres. Sigue sin nombres ni datos clínicos.
--   6. El mensaje de quien pierde la carrera es el mismo en todas partes: «Esa hora acaba de ocuparse. Elige otra.».
--
-- Qué NO cambia: ninguna cita existente, ningún permiso. Una óptica nueva no necesita nada. Las horas se comparan por su texto de inicio, como hasta ahora (no por solapamiento de duración).
-- Revertir: drop trigger citas_sin_choque_trigger on citas_base; drop function citas_sin_choque(); recrear el índice de 0062; volver crear_cita_publica/reagendar_cita_publica/horas_ocupadas_publicas
--   a sus definiciones de 0134/0070 (drop de las nuevas firmas); drop function _profesionales_libres, _dia_optica, _minutos_hora, _profesional_para_hora; _profesional_disponible a su cuerpo de 0146.

-- ═══ 1. Índice por profesional ═══
drop index if exists public.citas_optica_fecha_hora_activa_idx;
create unique index citas_optica_fecha_hora_profesional_activa_idx
  on public.citas_base (optica_id, fecha, hora, coalesce(asignado_a, '00000000-0000-0000-0000-000000000000'::uuid))
  where estado <> 'Cancelada';

-- ═══ 2. Piezas compartidas ═══
create or replace function public._minutos_hora(p_hora text)
returns int
language sql
immutable
as $$
  select case when m is null then null else ((m[1]::int % 12) + case when upper(m[3]) = 'PM' then 12 else 0 end) * 60 + m[2]::int end
    from (select regexp_match(trim(coalesce(p_hora, '')), '^(0?[1-9]|1[0-2]):([0-5][0-9])\s*(AM|PM)$', 'i') as m) x;
$$;

create or replace function public._dia_optica(p_optica uuid, p_fecha date)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(excepciones -> p_fecha::text,
                  horario_semanal -> (array['domingo','lunes','martes','miercoles','jueves','viernes','sabado'])[extract(dow from p_fecha)::int + 1])
    from disponibilidad where optica_id = p_optica;
$$;
revoke all on function public._dia_optica(uuid, date) from public, anon, authenticated;

-- Quiénes atienden a esa hora (su horario efectivo) y no están ausentes. Es la misma regla de 0146, por profesional.
create or replace function public._profesionales_libres(p_optica uuid, p_fecha date, p_min int, p_dia_optica jsonb)
returns setof uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_p jsonb;
  v_dia jsonb;
  v_turno text;
  v_s jsonb;
  v_a jsonb;
  v_trabaja boolean;
  v_ausente boolean;
  v_nombres text[] := array['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];
  v_ini int;
  v_fin int;
begin
  for v_p in select * from jsonb_array_elements(agenda_profesionales(p_optica)) loop
    v_dia := case when (v_p ->> 'usaOptica')::boolean then p_dia_optica else v_p -> 'horario' -> v_nombres[extract(dow from p_fecha)::int + 1] end;
    v_trabaja := false;
    if v_dia is not null then
      foreach v_turno in array array['manana', 'tarde'] loop
        v_s := v_dia -> v_turno;
        if coalesce((v_s ->> 'activo')::boolean, false)
           and p_min >= split_part(v_s ->> 'inicio', ':', 1)::int * 60 + split_part(v_s ->> 'inicio', ':', 2)::int
           and p_min <  split_part(v_s ->> 'fin', ':', 1)::int * 60 + split_part(v_s ->> 'fin', ':', 2)::int then
          v_trabaja := true;
        end if;
      end loop;
    end if;
    if not v_trabaja then continue; end if;
    v_ausente := false;
    for v_a in select * from jsonb_array_elements(v_p -> 'ausencias') loop
      if p_fecha >= (v_a ->> 'desde')::date and p_fecha <= (v_a ->> 'hasta')::date then
        if v_a ->> 'franja' = 'todo' then v_ausente := true;
        else
          v_s := p_dia_optica -> (v_a ->> 'franja');
          v_ini := split_part(v_s ->> 'inicio', ':', 1)::int * 60 + split_part(v_s ->> 'inicio', ':', 2)::int;
          v_fin := split_part(v_s ->> 'fin', ':', 1)::int * 60 + split_part(v_s ->> 'fin', ':', 2)::int;
          if coalesce((v_s ->> 'activo')::boolean, false) and p_min >= v_ini and p_min < v_fin then v_ausente := true; end if;
        end if;
      end if;
    end loop;
    if not v_ausente then return next (v_p ->> 'id')::uuid; end if;
  end loop;
end;
$$;
revoke all on function public._profesionales_libres(uuid, date, int, jsonb) from public, anon, authenticated;

-- Misma respuesta que antes: sin profesionales marcados la óptica atiende como siempre; con ellos, alguno debe atender y no estar ausente.
create or replace function public._profesional_disponible(p_optica uuid, p_fecha date, p_min int, p_dia_optica jsonb)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_array_length(agenda_profesionales(p_optica)) = 0
      or exists (select 1 from public._profesionales_libres(p_optica, p_fecha, p_min, p_dia_optica));
$$;
revoke all on function public._profesional_disponible(uuid, date, int, jsonb) from public, anon, authenticated;

-- Elige al profesional de una cita nueva o movida. null = la óptica no tiene profesionales marcados (todo como antes).
-- p_preferido: el que pidió la persona (o el que ya tenía la cita). p_estricto: solo ese. p_excluir_cita: la cita que se mueve (no choca consigo misma).
create or replace function public._profesional_para_hora(p_optica uuid, p_fecha date, p_hora text, p_preferido uuid, p_excluir_cita uuid default null, p_estricto boolean default false)
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_min int := public._minutos_hora(p_hora);
  v_dia jsonb := public._dia_optica(p_optica, p_fecha);
  v_id uuid;
begin
  -- Sin profesionales marcados, o sin horario configurado (la reserva web no valida nada en ese caso), todo queda como antes: sin profesional.
  if v_dia is null or jsonb_array_length(agenda_profesionales(p_optica)) = 0 then
    return null;
  end if;
  if p_preferido is not null and p_estricto
     and not exists (select 1 from public._profesionales_libres(p_optica, p_fecha, v_min, v_dia) l where l = p_preferido) then
    raise exception 'Ese profesional no atiende a esa hora. Elige otra.';
  end if;
  -- El preferido primero; luego los demás en el orden de la agenda.
  for v_id in
    select l from public._profesionales_libres(p_optica, p_fecha, v_min, v_dia) l
     order by (l is not distinct from p_preferido) desc
  loop
    if p_preferido is not null and p_estricto and v_id is distinct from p_preferido then
      continue;
    end if;
    if not exists (select 1 from citas_base c where c.optica_id = p_optica and c.fecha = p_fecha and c.hora = trim(p_hora)
                      and c.estado <> 'Cancelada' and c.asignado_a = v_id and c.id is distinct from p_excluir_cita) then
      return v_id;
    end if;
  end loop;
  raise exception 'Esa hora acaba de ocuparse. Elige otra.' using errcode = '23505';
end;
$$;
revoke all on function public._profesional_para_hora(uuid, date, text, uuid, uuid, boolean) from public, anon, authenticated;

-- ═══ 3. Disparador: una hora, un profesional, para todo camino de escritura ═══
create or replace function public.citas_sin_choque()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pros int;
begin
  -- Un candado por óptica + fecha + hora: dos confirmaciones del mismo segundo hacen fila y la segunda ve lo que guardó la primera.
  perform pg_advisory_xact_lock(hashtextextended(new.optica_id::text || '|' || new.fecha::text || '|' || new.hora, 0));
  select count(*) into v_pros from perfiles p
   where p.optica_id = new.optica_id and p.activo and p.rol in ('admin', 'asistente') and coalesce(p.es_optometra, false);
  if exists (
    select 1 from citas_base c
     where c.optica_id = new.optica_id and c.fecha = new.fecha and c.hora = new.hora and c.estado <> 'Cancelada' and c.id <> new.id
       and (v_pros <= 1 or c.asignado_a is not distinct from new.asignado_a)
  ) then
    raise exception 'Esa hora acaba de ocuparse. Elige otra.' using errcode = '23505';
  end if;
  return new;
end;
$$;

drop trigger if exists citas_sin_choque_trigger on public.citas_base;
create trigger citas_sin_choque_trigger
  before insert or update of fecha, hora, estado, asignado_a, optica_id on public.citas_base
  for each row when (new.estado <> 'Cancelada')
  execute function public.citas_sin_choque();

-- ═══ 4. Horas ocupadas: ahora dicen de qué profesional ═══
drop function if exists public.horas_ocupadas_publicas(uuid);
create function public.horas_ocupadas_publicas(p_optica_id uuid)
returns table (fecha date, hora text, duracion_minutos integer, estado text, asignado_a uuid)
language sql
stable
security definer
set search_path = public
as $$
  select fecha, hora, duracion_minutos, estado, asignado_a
  from citas_base
  where optica_id = p_optica_id
    and estado <> 'Cancelada'
    and fecha >= current_date;
$$;
revoke all on function public.horas_ocupadas_publicas(uuid) from public;
grant execute on function public.horas_ocupadas_publicas(uuid) to anon, authenticated;

-- ═══ 5. crear_cita_publica con profesional ═══
drop function public.crear_cita_publica(uuid, text, date, text, text, date, text, text, text, text, jsonb, text);
create function public.crear_cita_publica(
  p_optica_id uuid, p_paciente text, p_fecha date, p_hora text, p_cedula text, p_fecha_nacimiento date,
  p_telefono text default null, p_motivo text default null, p_motivo_publico text default null, p_correo text default null, p_triage jsonb default null,
  p_canal text default 'web', p_profesional_id uuid default null
)
returns table(id uuid, codigo text)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_id uuid;
  v_codigo text;
  v_paciente text := trim(p_paciente);
  v_hora text := trim(p_hora);
  v_correo text := nullif(trim(p_correo), '');
  v_cedula text := trim(p_cedula);
  v_paciente_id uuid;
  v_nombre_final text;
  v_profesional uuid;
begin
  if not exists (select 1 from opticas where opticas.id = p_optica_id and activa) then
    raise exception 'Óptica no válida.';
  end if;
  if v_paciente = '' then
    raise exception 'El nombre del paciente es obligatorio.';
  end if;
  if v_hora = '' then
    raise exception 'La hora es obligatoria.';
  end if;
  if not public.cedula_ecuatoriana_valida(v_cedula) then
    raise exception 'La cédula no es válida.';
  end if;
  if p_fecha_nacimiento is null or p_fecha_nacimiento > current_date then
    raise exception 'La fecha de nacimiento es obligatoria y no puede ser futura.';
  end if;
  if v_correo is not null and v_correo !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'El correo no es válido.';
  end if;

  -- Horario de atención (0103/0146): el día debe ser de atención, admitir reservas web y la hora caer dentro de una sesión activa con algún profesional libre de ausencia.
  perform public.validar_horario_reserva_web(p_optica_id, p_fecha, v_hora);

  -- Una hora, un profesional (0149): el pedido, o el primero que atienda a esa hora y no tenga otra cita. Sin profesionales marcados queda null, como antes.
  v_profesional := public._profesional_para_hora(p_optica_id, p_fecha, v_hora, p_profesional_id, null, p_profesional_id is not null);

  select p.id, p.nombre into v_paciente_id, v_nombre_final
  from pacientes p
  where p.optica_id = p_optica_id and p.cedula = v_cedula
  limit 1;

  if v_paciente_id is null then
    v_nombre_final := left(v_paciente, 200);
    insert into pacientes (
      optica_id, nombre, cedula, telefono, correo, fecha_nacimiento,
      evolucion, ultima_consulta, fecha_registro, estado_clinico, origen
    ) values (
      p_optica_id, v_nombre_final, v_cedula,
      left(nullif(trim(p_telefono), ''), 30), v_correo, p_fecha_nacimiento,
      'Sin evaluación', 'Pendiente', current_date, 'Activo', 'paciente'
    )
    returning pacientes.id into v_paciente_id;
  end if;

  v_id := gen_random_uuid();
  v_codigo := generar_codigo_cita(v_id, p_fecha);

  perform set_config('optica.actor', 'paciente', true);
  perform set_config('optica.actor_nombre', v_nombre_final, true);
  perform set_config('optica.canal', case when p_canal = 'portal' then 'portal' else 'web' end, true);

  begin
    insert into citas (id, optica_id, paciente_id, paciente, cedula, telefono, fecha, hora, motivo, motivo_publico, correo, triage, codigo, estado, origen, asignado_a)
    values (
      v_id, p_optica_id, v_paciente_id,
      v_nombre_final,
      v_cedula,
      left(nullif(trim(p_telefono), ''), 30),
      p_fecha,
      left(v_hora, 20),
      left(nullif(trim(p_motivo), ''), 300),
      left(nullif(trim(p_motivo_publico), ''), 300),
      left(v_correo, 200),
      p_triage,
      v_codigo,
      'Pendiente',
      'paciente',
      v_profesional
    );
  exception
    when unique_violation then
      raise exception 'Esa hora acaba de ocuparse. Elige otra.';
  end;

  return query select v_id, v_codigo;
end;
$function$;
revoke all on function public.crear_cita_publica(uuid, text, date, text, text, date, text, text, text, text, jsonb, text, uuid) from public;
grant execute on function public.crear_cita_publica(uuid, text, date, text, text, date, text, text, text, text, jsonb, text, uuid) to anon, authenticated;

-- ═══ 6. reagendar_cita_publica (misma firma; conserva al profesional si está libre) ═══
create or replace function public.reagendar_cita_publica(p_cita_id uuid, p_paciente_id uuid, p_fecha date, p_hora text, p_token text default null)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid;
  v_nombre text;
  v_actual uuid;
  v_profesional uuid;
begin
  if not sesion_paciente_valida(p_paciente_id, p_token) then
    return false;
  end if;

  perform public.validar_cambio_cita_portal(p_cita_id, p_paciente_id);

  select optica_id, asignado_a into v_optica, v_actual from citas_base where id = p_cita_id and paciente_id = p_paciente_id;
  if v_optica is not null then
    perform public.validar_horario_reserva_web(v_optica, p_fecha, trim(p_hora));
    v_profesional := public._profesional_para_hora(v_optica, p_fecha, trim(p_hora), v_actual, p_cita_id, false);
  end if;

  select pa.nombre into v_nombre from pacientes_base pa where pa.id = p_paciente_id;
  perform set_config('optica.actor', 'paciente', true);
  perform set_config('optica.actor_nombre', coalesce(v_nombre, ''), true);

  begin
    update citas
    set fecha = p_fecha, hora = p_hora, estado = 'Pendiente', updated_at = now(), asignado_a = coalesce(v_profesional, asignado_a)
    where id = p_cita_id and paciente_id = p_paciente_id and estado = 'Pendiente';
  exception
    when unique_violation then
      raise exception 'Esa hora acaba de ocuparse. Elige otra.';
  end;
  return found;
end;
$function$;
