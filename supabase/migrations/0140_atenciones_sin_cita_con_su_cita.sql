-- 0140 — Toda atención guardada tiene su cita (SIN APLICAR: esperando la aprobación de Diego).
--
-- Qué arregla: antes de que «Atender» creara siempre una cita presencial, una ficha clínica podía guardarse sin cita (consultas.cita_id nulo). Esas atenciones salen en el historial
-- del paciente pero no cuentan en «Asistencia a sus citas», en el perfil ni en Reportes (que cuentan citas): el historial y los números no cuadran.
--
-- Qué hace: por cada consulta sin cita crea UNA cita con
--   · la misma fecha de la consulta y el mismo profesional (asignado_a y atendido_por; nulo si esa persona ya no está en la óptica),
--   · origen «presencial» y estado «Atendida» (se inserta ya atendida: no dispara la encuesta de satisfacción, que solo corre al actualizar),
--   · la hora en que se guardó la ficha (hora de Ecuador, formato «HH:MM AM/PM»); si esa hora ya la ocupa otra cita activa de la óptica ese día, se corre de minuto en minuto hasta una libre
--     (el índice único citas_optica_fecha_hora_activa_idx lo exige),
--   · el motivo de la consulta, y la cédula y el teléfono actuales del paciente.
-- y enlaza la consulta con su cita nueva (consultas_base.cita_id). No borra, no cambia ni una columna clínica. Repetirla no hace nada (ya no queda ninguna sin cita).
--
-- Efecto conocido: la cita nace con el evento «agendada · presencial» en su seguimiento (no se inventa un «atendida» con la fecha de hoy).
--
-- Verificación después de aplicar:
--   select count(*) from consultas_base where cita_id is null;                       -- debe ser 0
--   select count(*) from citas_base where origen = 'presencial' and estado = 'Atendida' and created_at > now() - interval '1 hour';  -- = las afectadas

do $$
declare
  k record;
  v_ts timestamptz;
  v_hora text;
  v_id uuid;
  v_cedula text;
  v_tel text;
  v_prof uuid;
  v_n int := 0;
begin
  for k in
    select id, optica_id, paciente_id, paciente, fecha, motivo, profesional_id, created_at
    from consultas_base
    where cita_id is null
    order by created_at, id
  loop
    v_ts := k.created_at;
    loop
      v_hora := to_char(v_ts at time zone 'America/Guayaquil', 'HH12:MI AM');
      exit when not exists (
        select 1 from citas_base b
        where b.optica_id = k.optica_id and b.fecha = k.fecha and b.hora = v_hora and b.estado <> 'Cancelada'
      );
      v_ts := v_ts + interval '1 minute';
    end loop;

    select p.cedula, p.telefono into v_cedula, v_tel from pacientes p where p.id = k.paciente_id;
    v_prof := case
      when k.profesional_id is not null and exists (select 1 from perfiles f where f.id = k.profesional_id and f.optica_id = k.optica_id) then k.profesional_id
      else null
    end;
    v_id := gen_random_uuid();

    insert into citas (id, optica_id, paciente_id, paciente, cedula, telefono, fecha, hora, motivo, estado, origen, asignado_a, atendido_por)
    values (v_id, k.optica_id, k.paciente_id, k.paciente, v_cedula, v_tel, k.fecha, v_hora, k.motivo, 'Atendida', 'presencial', v_prof, v_prof);

    update consultas_base set cita_id = v_id where id = k.id;
    v_n := v_n + 1;
  end loop;
  raise notice 'Atenciones sin cita que ahora tienen su cita: %', v_n;
end $$;
