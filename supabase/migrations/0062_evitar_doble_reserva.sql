-- Hallazgo E7 de la auditoría 2026-09-09 (confirmado, y peor de lo que
-- decía la sospecha original: "posible doble reserva... casi simultánea").
-- Al verificar a fondo se encontraron DOS problemas reales, no solo el
-- riesgo de carrera:
--
--   1. `SelectorFechaHora.jsx` calcula qué horas están libres a partir del
--      prop `citas` que le pasan AgendarCitaPublica.jsx y PortalPaciente.jsx
--      — pero ese prop es el estado `citas` de App.jsx, que SOLO se llena
--      cuando un admin inicia sesión en ESE MISMO navegador (ver comentario
--      en App.jsx junto a hidratarOpticaId). Un paciente nuevo agendando
--      desde un dispositivo donde nunca se logueó un admin ve el calendario
--      con TODOS los horarios libres, sin importar cuántas citas reales ya
--      existan — no es una condición de carrera rara, es el camino normal.
--   2. Ni `crear_cita_publica` ni el insert directo desde Citas.jsx (personal)
--      revalidaban el cupo en el servidor — nada impedía dos inserts para el
--      mismo optica_id+fecha+hora.
--
-- Esta migración resuelve la parte de servidor (la parte de frontend —
-- traer disponibilidad real para pacientes anónimos/con token— va en el
-- mismo commit, en AgendarCitaPublica.jsx/PortalPaciente.jsx):
--
--   a) Índice único parcial: una sola cita ACTIVA (no cancelada) por
--      optica_id+fecha+hora. Parcial porque cancelar_cita_publica hace
--      UPDATE estado='Cancelada' (no borra la fila) — sin el `where` el
--      horario quedaría bloqueado para siempre después de una cancelación.
--   b) crear_cita_publica y reagendar_cita_publica capturan ahora el
--      unique_violation y devuelven un mensaje claro en vez del error crudo
--      de Postgres, para que el frontend pueda mostrarlo tal cual.
--   c) Nueva función horas_ocupadas_publicas(): expone SOLO fecha/hora (sin
--      nombre, cédula ni nada clínico) de las citas activas futuras de una
--      óptica, para que el calendario público pueda calcular disponibilidad
--      real sin necesitar acceso completo a `citas` (que sí expone datos de
--      pacientes y está protegida por RLS para el personal).

create unique index citas_optica_fecha_hora_activa_idx
  on citas_base (optica_id, fecha, hora)
  where estado <> 'Cancelada';

create or replace function public.horas_ocupadas_publicas(p_optica_id uuid)
returns table (fecha date, hora text)
language sql
stable
security definer
set search_path = public
as $$
  select fecha, hora
  from citas_base
  where optica_id = p_optica_id
    and estado <> 'Cancelada'
    and fecha >= current_date;
$$;

revoke all on function public.horas_ocupadas_publicas(uuid) from public;
grant execute on function public.horas_ocupadas_publicas(uuid) to anon, authenticated;

create or replace function public.crear_cita_publica(
  p_optica_id uuid,
  p_paciente text,
  p_fecha date,
  p_hora text,
  p_paciente_id uuid default null,
  p_cedula text default null,
  p_telefono text default null,
  p_motivo text default null,
  p_motivo_publico text default null,
  p_correo text default null,
  p_triage jsonb default null
) returns table (id uuid, codigo text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_codigo text;
  v_paciente text := trim(p_paciente);
  v_hora text := trim(p_hora);
  v_correo text := nullif(trim(p_correo), '');
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
  if v_correo is not null and v_correo !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'El correo no es válido.';
  end if;

  v_id := gen_random_uuid();
  v_codigo := 'CIT-' || extract(year from p_fecha) || '-' || upper(substring(replace(v_id::text, '-', '') from 1 for 6));

  begin
    insert into citas (id, optica_id, paciente_id, paciente, cedula, telefono, fecha, hora, motivo, motivo_publico, correo, triage, codigo, estado)
    values (
      v_id, p_optica_id, p_paciente_id,
      left(v_paciente, 200),
      left(nullif(trim(p_cedula), ''), 30),
      left(nullif(trim(p_telefono), ''), 30),
      p_fecha,
      left(v_hora, 20),
      left(nullif(trim(p_motivo), ''), 300),
      left(nullif(trim(p_motivo_publico), ''), 300),
      left(v_correo, 200),
      p_triage,
      v_codigo,
      'Pendiente'
    );
  exception
    when unique_violation then
      raise exception 'Ese horario ya no está disponible. Elige otro.';
  end;

  return query select v_id, v_codigo;
end;
$$;

revoke all on function public.crear_cita_publica(uuid, text, date, text, uuid, text, text, text, text, text, jsonb) from public;
grant execute on function public.crear_cita_publica(uuid, text, date, text, uuid, text, text, text, text, text, jsonb) to anon, authenticated;

create or replace function public.reagendar_cita_publica(
  p_cita_id uuid,
  p_paciente_id uuid,
  p_fecha date,
  p_hora text,
  p_token text default null
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from pacientes p
    where p.id = p_paciente_id and p.sesion_token is not null and p.sesion_token = p_token
  ) then
    return false;
  end if;

  begin
    update citas
    set fecha = p_fecha, hora = p_hora, estado = 'Pendiente', updated_at = now()
    where id = p_cita_id and paciente_id = p_paciente_id;
  exception
    when unique_violation then
      raise exception 'Ese horario ya no está disponible. Elige otro.';
  end;
  return found;
end;
$$;

revoke all on function public.reagendar_cita_publica(uuid, uuid, date, text, text) from public;
grant execute on function public.reagendar_cita_publica(uuid, uuid, date, text, text) to anon;
grant execute on function public.reagendar_cita_publica(uuid, uuid, date, text, text) to authenticated;
