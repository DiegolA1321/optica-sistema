-- Ciberseguridad (2026-08-28): verificar_login_paciente no tenía ningún
-- límite de intentos. Como es un RPC público (lo llama un cliente anónimo,
-- el paciente aún no tiene sesión), cualquiera con la anon key —pública en
-- el bundle del sitio— podía probar contraseñas sin freno alguno. El login
-- de Supabase Auth (admin/superadmin) sí trae throttling nativo; este RPC
-- casero necesitaba el suyo propio.
--
-- Estrategia: bloqueo por cuenta (no por IP, que no está disponible desde
-- un RPC de Postgres sin infraestructura extra tipo Edge Function). Tras 5
-- intentos fallidos seguidos se bloquea esa cuenta de paciente 15 minutos;
-- un login exitoso resetea el contador.

alter table pacientes
  add column if not exists intentos_fallidos int not null default 0,
  add column if not exists bloqueado_hasta timestamptz;

-- Cambia el tipo de retorno (se agregan bloqueado/minutos_restantes), así
-- que create or replace no alcanza — hay que borrar la función vieja primero.
drop function if exists public.verificar_login_paciente(text, text);

create function public.verificar_login_paciente(
  p_usuario text,
  p_clave text
) returns table (
  id uuid, optica_id uuid, nombre text, cedula text, telefono text, correo text,
  fecha_nacimiento date, ultima_consulta text, estado_clinico text, referido_por text,
  evolucion text, estado_correccion text, fecha_registro date, tiene_cuenta boolean,
  bloqueado boolean, minutos_restantes int
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_paciente pacientes%rowtype;
  v_clave_ok boolean;
begin
  select * into v_paciente
  from pacientes p
  where p.tiene_cuenta = true
    and (p.usuario = p_usuario or p.cedula = p_usuario)
  limit 1;

  -- Cuenta inexistente: mismo comportamiento de siempre (fila vacía), no se
  -- revela si el usuario existe o no.
  if v_paciente.id is null then
    return;
  end if;

  -- Cuenta bloqueada por demasiados intentos fallidos recientes.
  if v_paciente.bloqueado_hasta is not null and v_paciente.bloqueado_hasta > now() then
    return query select
      null::uuid, null::uuid, null::text, null::text, null::text, null::text,
      null::date, null::text, null::text, null::text, null::text, null::text,
      null::date, null::boolean,
      true, ceil(extract(epoch from (v_paciente.bloqueado_hasta - now())) / 60)::int;
    return;
  end if;

  v_clave_ok := v_paciente.clave_temporal is not null
    and v_paciente.clave_temporal = extensions.crypt(p_clave, v_paciente.clave_temporal);

  if not v_clave_ok then
    update pacientes
    set intentos_fallidos = intentos_fallidos + 1,
        bloqueado_hasta = case when intentos_fallidos + 1 >= 5 then now() + interval '15 minutes' else bloqueado_hasta end
    where pacientes.id = v_paciente.id;
    return;
  end if;

  update pacientes set intentos_fallidos = 0, bloqueado_hasta = null where pacientes.id = v_paciente.id;

  return query select
    v_paciente.id, v_paciente.optica_id, v_paciente.nombre, v_paciente.cedula, v_paciente.telefono, v_paciente.correo,
    v_paciente.fecha_nacimiento, v_paciente.ultima_consulta, v_paciente.estado_clinico, v_paciente.referido_por,
    v_paciente.evolucion, v_paciente.estado_correccion, v_paciente.fecha_registro, v_paciente.tiene_cuenta,
    false, null::int;
end;
$$;

-- El drop se lleva los grants con la función vieja — hay que reponerlos, si
-- no el login de pacientes se queda sin permiso para llamar al RPC.
revoke all on function public.verificar_login_paciente(text, text) from public;
grant execute on function public.verificar_login_paciente(text, text) to anon;
