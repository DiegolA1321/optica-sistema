-- Dos protecciones para la hora de las citas.
--
-- Por qué: el proceso automático "No asistió" (cada 5 minutos) convierte la hora de
-- cada cita pendiente con to_timestamp(hora, 'HH12:MI AM'). Una sola fila con la hora
-- mal escrita (por ejemplo "16:00" en vez de "04:00 PM") hace que el proceso falle
-- entero, para todas las ópticas, cada 5 minutos, hasta que alguien lo note. Pasó el
-- 6 de octubre con una cita de prueba cargada por script.
--
--   1. marcar_no_asistio_automatico() ya no se detiene por una fila mala: la salta,
--      deja una línea en la actividad de esa óptica ("Cita con hora no válida", una sola
--      vez por cita) y sigue con las demás. Cualquier otro error en una fila también se
--      aísla a esa fila.
--   2. Las citas nuevas y las que se editen solo aceptan el formato que usa el
--      sistema: "hh:mm AM/PM" (01-12 : 00-59, con cero a la izquierda). La restricción
--      se agrega primero NOT VALID, luego se corrige la única fila antigua que estaba en
--      24 horas ("10:00" pasa a "10:00 AM", decisión de Diego del 7 de octubre) y por
--      último se VALIDA contra todas las filas: si quedara alguna mal, la migración se
--      revierte entera.

create or replace function public.marcar_no_asistio_automatico()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ahora timestamp := (now() at time zone 'America/Guayaquil');
  v_cita record;
begin
  for v_cita in
    select c.id, c.optica_id, c.paciente, c.fecha, c.hora
    from citas_base c
    where c.estado = 'Pendiente' and c.fecha <= v_ahora::date
  loop
    begin
      if v_cita.hora !~ '^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$' then
        -- Hora mal escrita: se salta y se avisa una sola vez por cita.
        if not exists (
          select 1 from logs_optica l
          where l.optica_id = v_cita.optica_id and l.accion = 'Cita con hora no válida' and l.detalle like '%' || v_cita.id::text || '%'
        ) then
          insert into logs_optica (optica_id, usuario_id, usuario_nombre, modulo, accion, detalle)
          values (v_cita.optica_id, null, 'Sistema', 'citas', 'Cita con hora no válida',
                  format('%s · %s · hora «%s» · id %s: corrígela para que se marque "No asistió" sola', v_cita.paciente, v_cita.fecha, v_cita.hora, v_cita.id));
        end if;
        continue;
      end if;
      if (v_cita.fecha + to_timestamp(v_cita.hora, 'HH12:MI AM')::time + interval '10 minutes') < v_ahora then
        update citas_base set estado = 'No Asistió' where id = v_cita.id and estado = 'Pendiente';
      end if;
    exception when others then
      -- Cualquier otro problema con esta cita no frena a las demás.
      raise warning 'marcar_no_asistio_automatico: la cita % se omitió (%)', v_cita.id, sqlerrm;
    end;
  end loop;
end;
$$;

alter table public.citas_base
  add constraint citas_hora_formato check (hora ~ '^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$') not valid;

-- Corrección de las horas guardadas en 24 horas: "10:00" -> "10:00 AM", "16:00" -> "04:00 PM".
update public.citas_base
   set hora = to_char(hora::time, 'HH12:MI AM')
 where hora ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$';

-- Ahora que ninguna fila queda fuera de formato, se exige también a las ya guardadas.
alter table public.citas_base validate constraint citas_hora_formato;
