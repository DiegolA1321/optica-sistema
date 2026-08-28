-- Bug real: AgendarCitaPublica.jsx (reserva sin cuenta) y PortalPaciente.jsx
-- (reserva desde el portal del paciente) solo hacían setCitas(...) en el
-- estado local de React — nunca escribían en Supabase. El panel del
-- optómetra (Citas.jsx) hidrata `citas` desde la tabla real solo al hacer
-- login, así que esas citas jamás le llegaban: existían nada más en la
-- pestaña de quien las creó, y desaparecían al recargar.
--
-- Mismo patrón que crear_lead/registrar_visita (ver 0016_leads_visitas_rpc):
-- ni el visitante público ni el paciente logueado tienen una fila en
-- `perfiles` con auth.uid(), así que ninguna policy de `citas_admin_all`
-- los cubre. En vez de agregar una policy de INSERT público (que además
-- exigiría una de SELECT público por el wrapping de PostgREST, exponiendo
-- todas las citas de la óptica a cualquiera), se usa una función
-- SECURITY DEFINER: el insert corre como dueño de la función, sin pasar
-- por RLS, y devuelve solo el id de la fila recién creada.

create or replace function public.crear_cita_publica(
  p_optica_id uuid,
  p_paciente text,
  p_fecha date,
  p_hora text,
  p_paciente_id uuid default null,
  p_cedula text default null,
  p_telefono text default null,
  p_motivo text default null,
  p_motivo_publico text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into citas (optica_id, paciente_id, paciente, cedula, telefono, fecha, hora, motivo, motivo_publico, estado)
  values (p_optica_id, p_paciente_id, p_paciente, p_cedula, p_telefono, p_fecha, p_hora, p_motivo, p_motivo_publico, 'Pendiente')
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.crear_cita_publica(uuid, text, date, text, uuid, text, text, text, text) from public;
grant execute on function public.crear_cita_publica(uuid, text, date, text, uuid, text, text, text, text) to anon;
grant execute on function public.crear_cita_publica(uuid, text, date, text, uuid, text, text, text, text) to authenticated;
