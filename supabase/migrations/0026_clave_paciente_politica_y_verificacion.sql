-- Ciberseguridad (2026-08-28), dos hallazgos en el mismo RPC:
--
-- 1) Bug de control de acceso real: cambiar_clave_paciente(paciente_id,
--    clave_nueva) no verificaba en ningún momento que quien llama conoce la
--    contraseña ACTUAL de ese paciente. Como está otorgado a `anon` (es un
--    RPC público, el portal de paciente no usa sesión real de Supabase
--    Auth), cualquiera con la anon key —pública, va en el bundle JS del
--    sitio— podía tomar la cuenta de CUALQUIER paciente llamando al RPC
--    directo desde la consola del navegador con su UUID, sin saber su
--    contraseña. Se cierra pidiendo y verificando la clave actual antes de
--    aceptar la nueva (server-side, con crypt()).
--
-- 2) Política de contraseñas: el único chequeo que existía era client-side
--    (longitud >= 4 en PortalPaciente.jsx), fácil de saltarse llamando al
--    RPC directo. Se agrega server-side: mínimo 6 caracteres y que no sea
--    igual a la cédula del paciente (la contraseña débil más obvia posible
--    para este sistema, porque la cédula es dato semi-público que cualquier
--    asistente/admin de la óptica ve a diario).

drop function if exists public.cambiar_clave_paciente(uuid, text);

-- Devuelve null si el cambio fue exitoso, o un mensaje de error si no.
create function public.cambiar_clave_paciente(
  p_paciente_id uuid,
  p_clave_actual text,
  p_clave_nueva text
) returns text
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_paciente pacientes%rowtype;
begin
  select * into v_paciente from pacientes where id = p_paciente_id;
  if v_paciente.id is null then
    return 'No pudimos verificar tu cuenta.';
  end if;

  if v_paciente.clave_temporal is null
     or v_paciente.clave_temporal <> extensions.crypt(p_clave_actual, v_paciente.clave_temporal) then
    return 'La contraseña actual no es correcta.';
  end if;

  if length(p_clave_nueva) < 6 then
    return 'La nueva contraseña debe tener al menos 6 caracteres.';
  end if;

  if p_clave_nueva = v_paciente.cedula then
    return 'La nueva contraseña no puede ser tu número de cédula.';
  end if;

  update pacientes
  set tiene_cuenta = true, clave_temporal = extensions.crypt(p_clave_nueva, extensions.gen_salt('bf')), updated_at = now()
  where id = p_paciente_id;

  return null;
end;
$$;

revoke all on function public.cambiar_clave_paciente(uuid, text, text) from public;
grant execute on function public.cambiar_clave_paciente(uuid, text, text) to anon;
