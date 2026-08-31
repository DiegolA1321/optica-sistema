-- Bug real de aislamiento multi-tenant (encontrado al responder una pregunta
-- de Diego 2026-08-30): verificar_login_paciente buscaba por usuario/cédula
-- en TODA la tabla pacientes, sin filtrar por óptica. Si el mismo paciente
-- (misma cédula) tenía cuenta en dos ópticas distintas del sistema, o dos
-- pacientes de ópticas distintas coincidían en el nombre de usuario elegido,
-- el login desde el portal de una óptica podía autenticar contra el registro
-- de OTRA óptica (cuál de las dos, arbitrario — el que la consulta
-- devolviera primero). Login.jsx ya tenía disponible `opticaPublica.id` (la
-- óptica cuyo login se está usando) pero nunca se lo pasaba a esta función.

drop function if exists public.verificar_login_paciente(text, text);

create function public.verificar_login_paciente(
  p_usuario text,
  p_clave text,
  p_optica_id uuid
) returns table (
  id uuid, optica_id uuid, nombre text, cedula text, telefono text, correo text,
  fecha_nacimiento date, ultima_consulta text, estado_clinico text, referido_por text,
  evolucion text, estado_correccion text, fecha_registro date, tiene_cuenta boolean,
  bloqueado boolean, minutos_restantes int, sesion_token text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_paciente pacientes%rowtype;
  v_clave_ok boolean;
  v_token text;
begin
  select * into v_paciente
  from pacientes p
  where p.tiene_cuenta = true
    and p.optica_id = p_optica_id
    and (p.usuario = p_usuario or p.cedula = p_usuario)
  limit 1;

  if v_paciente.id is null then
    return;
  end if;

  if v_paciente.bloqueado_hasta is not null and v_paciente.bloqueado_hasta > now() then
    return query select
      null::uuid, null::uuid, null::text, null::text, null::text, null::text,
      null::date, null::text, null::text, null::text, null::text, null::text,
      null::date, null::boolean,
      true, ceil(extract(epoch from (v_paciente.bloqueado_hasta - now())) / 60)::int, null::text;
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

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  update pacientes
  set intentos_fallidos = 0, bloqueado_hasta = null, sesion_token = v_token
  where pacientes.id = v_paciente.id;

  return query select
    v_paciente.id, v_paciente.optica_id, v_paciente.nombre, v_paciente.cedula, v_paciente.telefono, v_paciente.correo,
    v_paciente.fecha_nacimiento, v_paciente.ultima_consulta, v_paciente.estado_clinico, v_paciente.referido_por,
    v_paciente.evolucion, v_paciente.estado_correccion, v_paciente.fecha_registro, v_paciente.tiene_cuenta,
    false, null::int, v_token;
end;
$$;

revoke all on function public.verificar_login_paciente(text, text, uuid) from public;
grant execute on function public.verificar_login_paciente(text, text, uuid) to anon;
