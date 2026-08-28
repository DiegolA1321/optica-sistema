-- Permite que un paciente logueado (sesión local, sin auth.uid() real —
-- mismo caso que crear_cita_publica en 0019) reagende SU PROPIA cita desde
-- el portal. Se valida que paciente_id coincida con la cita antes de tocar
-- nada, para que no sea un simple "cambia cualquier cita si sabes su id".
-- Feedback del ing: el admin decide si se permite reagendar y con cuántas
-- horas de anticipación (parametrizacion.permitirReagendarPaciente /
-- horasAntesReagendar en Configuracion.jsx) — esa ventana se valida en el
-- cliente (PortalPaciente.jsx), no aquí; esta función solo aplica el cambio.

create or replace function public.reagendar_cita_publica(
  p_cita_id uuid,
  p_paciente_id uuid,
  p_fecha date,
  p_hora text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update citas
  set fecha = p_fecha, hora = p_hora, estado = 'Pendiente', updated_at = now()
  where id = p_cita_id and paciente_id = p_paciente_id;
  return found;
end;
$$;

revoke all on function public.reagendar_cita_publica(uuid, uuid, date, text) from public;
grant execute on function public.reagendar_cita_publica(uuid, uuid, date, text) to anon;
grant execute on function public.reagendar_cita_publica(uuid, uuid, date, text) to authenticated;
