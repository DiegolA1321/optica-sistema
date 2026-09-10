-- Hallazgo real siguiendo el flujo completo "usuario → función → datos →
-- interfaz" del portal del paciente y de la página pública de agendamiento
-- (auditoría de sistema conectado, 2026-09-09): el horario personalizado con
-- duración propia que se agregó esta sesión (migración 0068,
-- disponibilidad.js: finCitaMinutos/haySolapamiento) SÍ bloquea
-- correctamente el horario siguiente en la agenda interna del personal
-- (Citas.jsx, que trabaja con el arreglo completo `citas`), pero el
-- calendario público (AgendarCitaPublica.jsx) y el del propio paciente
-- (PortalPaciente.jsx) calculan disponibilidad a partir de
-- horas_ocupadas_publicas(), que solo devolvía fecha y hora — sin duración
-- ni estado, esa función no tiene cómo saber que una cita se extiende más
-- allá de su slot nominal, ni que una cita sin finalizar debe seguir
-- bloqueando aunque ya haya pasado su hora estimada. Resultado real: un
-- walk-in con duración personalizada que bloquea el siguiente slot para el
-- personal seguía apareciendo "libre" en el calendario público y en el del
-- paciente — riesgo real de doble reserva, no solo un dato faltante en
-- pantalla.
--
-- Se agregan `duracion_minutos` y `estado` al resultado — ninguno de los dos
-- es un dato personal (no hay nombre, cédula, ni nada clínico, que es lo que
-- esta función deliberadamente no expone desde 0062); son exactamente los
-- dos datos que src/utilidades/disponibilidad.js (finCitaMinutos) ya sabe
-- leer de un objeto "cita" — no hace falta ningún cambio de frontend, los
-- nombres de columna ya coinciden con lo que ese código espera.
--
-- Cambia la firma de retorno (agrega columnas) — mismo criterio que I11:
-- drop explícito antes de recrear, no un simple "create or replace".

drop function if exists public.horas_ocupadas_publicas(uuid);

create function public.horas_ocupadas_publicas(p_optica_id uuid)
returns table (fecha date, hora text, duracion_minutos integer, estado text)
language sql
stable
security definer
set search_path = public
as $$
  select fecha, hora, duracion_minutos, estado
  from citas_base
  where optica_id = p_optica_id
    and estado <> 'Cancelada'
    and fecha >= current_date;
$$;

revoke all on function public.horas_ocupadas_publicas(uuid) from public;
grant execute on function public.horas_ocupadas_publicas(uuid) to anon, authenticated;
