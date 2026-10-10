-- La anticipación mínima para cambiar o cancelar una cita desde el portal se valida también en el servidor.
--
-- Hasta hoy solo la pantalla del portal respetaba la política de la óptica ("permitir reagendar" y "horas antes", Configuración →
-- Políticas hacia el paciente): quien llamaba a `reagendar_cita_publica` o `cancelar_cita_publica` directamente podía cambiar o cancelar
-- una cita a minutos de empezar, con la política apagada, o incluso reagendar una cita ya atendida o cancelada (la función ponía el
-- estado en 'Pendiente' sin mirar el que tenía). Esta migración lleva esas reglas al servidor, con la hora de Ecuador:
--
--   1. La óptica debe permitirlo (`settings.permitirReagendarPaciente`; sin ese dato, no se permite, igual que la pantalla).
--   2. La cita debe seguir 'Pendiente'.
--   3. Deben faltar al menos `settings.horasAntesReagendar` horas (2 si la óptica no lo cambió) para la hora de la cita.
--
-- Si no se cumple, la función rechaza con un mensaje claro que la pantalla muestra tal cual. Además `cancelar_cita_publica` pasa a usar
-- `sesion_paciente_valida` (la misma verificación de sesión de las demás funciones del portal, que además vence a los 30 días).
--
-- Mismas firmas que las funciones actuales (no se crea ninguna sobrecarga) y mismo comportamiento fuera de estas reglas, incluidas las
-- reglas de horario de la migración 0103 al reagendar. La función de apoyo es interna: no se puede llamar desde la API.

create or replace function public.validar_cambio_cita_portal(p_cita_id uuid, p_paciente_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cita record;
  v_ajustes jsonb;
  v_horas numeric;
  v_partes text[];
  v_min int;
  v_inicio timestamp;
  v_ahora timestamp := (now() at time zone 'America/Guayaquil');
begin
  select cb.optica_id, cb.fecha, cb.hora, cb.estado into v_cita
    from citas_base cb where cb.id = p_cita_id and cb.paciente_id = p_paciente_id;
  if not found then
    return; -- la cita no es de este paciente: la función que llama no encontrará nada y devolverá false, como siempre
  end if;

  select settings into v_ajustes from opticas where id = v_cita.optica_id;
  if coalesce(v_ajustes ->> 'permitirReagendarPaciente', 'false') <> 'true' then
    raise exception 'Esta óptica no permite cambiar ni cancelar citas desde el portal. Comunícate con la óptica.';
  end if;
  if v_cita.estado <> 'Pendiente' then
    raise exception 'Esa cita ya no se puede cambiar ni cancelar.';
  end if;

  v_horas := coalesce(nullif(v_ajustes ->> 'horasAntesReagendar', '')::numeric, 2);
  v_partes := regexp_match(trim(coalesce(v_cita.hora, '')), '^(0?[1-9]|1[0-2]):([0-5][0-9])\s*(AM|PM)$', 'i');
  if v_partes is null then
    raise exception 'No pudimos verificar la hora de esta cita. Comunícate con la óptica.';
  end if;
  v_min := ((v_partes[1]::int % 12) + case when upper(v_partes[3]) = 'PM' then 12 else 0 end) * 60 + v_partes[2]::int;
  v_inicio := v_cita.fecha::timestamp + make_interval(mins => v_min);

  if v_inicio - v_ahora < make_interval(secs => (v_horas * 3600)::double precision) then
    raise exception 'Solo puedes cambiar o cancelar tu cita hasta % hora% antes. Comunícate con la óptica.',
      regexp_replace(v_horas::text, '\.0+$', ''), case when v_horas = 1 then '' else 's' end;
  end if;
end;
$$;
revoke all on function public.validar_cambio_cita_portal(uuid, uuid) from public, anon, authenticated;

create or replace function public.reagendar_cita_publica(
  p_cita_id uuid, p_paciente_id uuid, p_fecha date, p_hora text, p_token text default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_optica uuid;
begin
  if not sesion_paciente_valida(p_paciente_id, p_token) then
    return false;
  end if;

  -- Política de la óptica y anticipación mínima (0106), con la hora de Ecuador.
  perform public.validar_cambio_cita_portal(p_cita_id, p_paciente_id);

  -- Horario de atención (0103): la nueva fecha y hora deben cumplir las mismas reglas que una reserva nueva.
  select optica_id into v_optica from citas_base where id = p_cita_id and paciente_id = p_paciente_id;
  if v_optica is not null then
    perform public.validar_horario_reserva_web(v_optica, p_fecha, trim(p_hora));
  end if;

  begin
    update citas
    set fecha = p_fecha, hora = p_hora, estado = 'Pendiente', updated_at = now()
    where id = p_cita_id and paciente_id = p_paciente_id and estado = 'Pendiente';
  exception
    when unique_violation then
      raise exception 'Ese horario ya no está disponible. Elige otro.';
  end;
  return found;
end;
$$;

create or replace function public.cancelar_cita_publica(
  p_cita_id uuid, p_paciente_id uuid, p_token text default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not sesion_paciente_valida(p_paciente_id, p_token) then
    return false;
  end if;

  -- Política de la óptica y anticipación mínima (0106), con la hora de Ecuador.
  perform public.validar_cambio_cita_portal(p_cita_id, p_paciente_id);

  update citas
  set estado = 'Cancelada', cancelada_por = 'paciente', updated_at = now()
  where id = p_cita_id and paciente_id = p_paciente_id and estado = 'Pendiente';
  return found;
end;
$$;

-- Los permisos de las dos funciones no cambian: `create or replace` conserva los que ya tienen (anon, authenticated y service_role).
