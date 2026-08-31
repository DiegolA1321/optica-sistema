-- El paciente ya podía reagendar su propia cita (reagendar_cita_publica,
-- migración 0021/0028) pero no cancelarla — solo quedaba la opción de
-- reagendar o llamar a la óptica. Se agrega el mismo flujo de cancelar,
-- protegido con el mismo token de sesión que exige reagendar_cita_publica.

create or replace function public.cancelar_cita_publica(
  p_cita_id uuid,
  p_paciente_id uuid,
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

  update citas
  set estado = 'Cancelada', updated_at = now()
  where id = p_cita_id and paciente_id = p_paciente_id and estado = 'Pendiente';
  return found;
end;
$$;

revoke all on function public.cancelar_cita_publica(uuid, uuid, text) from public;
grant execute on function public.cancelar_cita_publica(uuid, uuid, text) to anon;
grant execute on function public.cancelar_cita_publica(uuid, uuid, text) to authenticated;
