-- Ciberseguridad (2026-08-28): hallazgo más serio que el de
-- cambiar_clave_paciente (0026). obtener_paciente_por_id, mis_citas_paciente
-- y mis_consultas_paciente son RPC públicos que solo reciben el UUID del
-- paciente — sin contraseña, sin nada — porque el portal de paciente nunca
-- tuvo una sesión real de Supabase Auth, solo un pacienteId guardado en
-- localStorage que el resto del sistema confía a ciegas. Cualquiera que
-- consiga ese UUID (visible en el localStorage de un dispositivo
-- compartido) puede leer para siempre el nombre, cédula, teléfono, correo,
-- diagnóstico, evolución clínica y el historial completo de citas/consultas
-- de ese paciente, sin volver a autenticarse nunca. reagendar_cita_publica
-- tenía el mismo hueco para escritura (podía reagendar la cita de cualquiera
-- sabiendo su UUID).
--
-- Se agrega una sesión real: un token aleatorio (32 bytes) que
-- verificar_login_paciente emite en cada login exitoso y guarda en
-- pacientes.sesion_token. Los cuatro RPC de arriba ahora exigen ese token,
-- no solo el id. Cambiar la contraseña o que un admin la restablezca
-- invalida el token (fuerza a re-loguearse en todos los dispositivos). Se
-- agrega invalidar_sesion_paciente para que el botón "Cerrar sesión" lo
-- invalide también del lado del servidor, no solo lo borre del navegador.

alter table pacientes add column if not exists sesion_token text;

-- ── verificar_login_paciente: emite el token en cada login exitoso ──
drop function if exists public.verificar_login_paciente(text, text);

create function public.verificar_login_paciente(
  p_usuario text,
  p_clave text
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

revoke all on function public.verificar_login_paciente(text, text) from public;
grant execute on function public.verificar_login_paciente(text, text) to anon;

-- ── obtener_paciente_por_id: ahora exige el token ──
drop function if exists public.obtener_paciente_por_id(uuid);

create function public.obtener_paciente_por_id(
  p_paciente_id uuid,
  p_token text default null
) returns table (
  id uuid, optica_id uuid, nombre text, cedula text, telefono text, correo text,
  fecha_nacimiento date, ultima_consulta text, estado_clinico text, referido_por text,
  evolucion text, estado_correccion text, fecha_registro date, tiene_cuenta boolean
)
language sql
security definer
set search_path = public
as $$
  select p.id, p.optica_id, p.nombre, p.cedula, p.telefono, p.correo, p.fecha_nacimiento,
         p.ultima_consulta, p.estado_clinico, p.referido_por, p.evolucion, p.estado_correccion,
         p.fecha_registro, p.tiene_cuenta
  from pacientes p
  where p.id = p_paciente_id and p.tiene_cuenta = true
    and p.sesion_token is not null and p.sesion_token = p_token;
$$;

revoke all on function public.obtener_paciente_por_id(uuid, text) from public;
grant execute on function public.obtener_paciente_por_id(uuid, text) to anon;

-- ── mis_citas_paciente: ahora exige el token ──
drop function if exists public.mis_citas_paciente(uuid);

create function public.mis_citas_paciente(
  p_paciente_id uuid,
  p_token text default null
) returns setof citas
language sql
security definer
set search_path = public
as $$
  select c.* from citas c
  where c.paciente_id = p_paciente_id
    and exists (
      select 1 from pacientes p
      where p.id = p_paciente_id and p.sesion_token is not null and p.sesion_token = p_token
    )
  order by c.fecha desc, c.hora desc;
$$;

revoke all on function public.mis_citas_paciente(uuid, text) from public;
grant execute on function public.mis_citas_paciente(uuid, text) to anon;

-- ── mis_consultas_paciente: ahora exige el token ──
drop function if exists public.mis_consultas_paciente(uuid);

create function public.mis_consultas_paciente(
  p_paciente_id uuid,
  p_token text default null
) returns setof consultas
language sql
security definer
set search_path = public
as $$
  select c.* from consultas c
  where c.paciente_id = p_paciente_id
    and exists (
      select 1 from pacientes p
      where p.id = p_paciente_id and p.sesion_token is not null and p.sesion_token = p_token
    )
  order by c.fecha desc;
$$;

revoke all on function public.mis_consultas_paciente(uuid, text) from public;
grant execute on function public.mis_consultas_paciente(uuid, text) to anon;

-- ── reagendar_cita_publica: ahora exige el token además del paciente_id ──
drop function if exists public.reagendar_cita_publica(uuid, uuid, date, text);

create function public.reagendar_cita_publica(
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

  update citas
  set fecha = p_fecha, hora = p_hora, estado = 'Pendiente', updated_at = now()
  where id = p_cita_id and paciente_id = p_paciente_id;
  return found;
end;
$$;

revoke all on function public.reagendar_cita_publica(uuid, uuid, date, text, text) from public;
grant execute on function public.reagendar_cita_publica(uuid, uuid, date, text, text) to anon;
grant execute on function public.reagendar_cita_publica(uuid, uuid, date, text, text) to authenticated;

-- ── cambiar_clave_paciente: invalida el token al cambiar la clave (fuerza
--    a volver a entrar en todos los dispositivos, incluido este) ──
create or replace function public.cambiar_clave_paciente(
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
  set tiene_cuenta = true,
      clave_temporal = extensions.crypt(p_clave_nueva, extensions.gen_salt('bf')),
      sesion_token = null,
      updated_at = now()
  where id = p_paciente_id;

  return null;
end;
$$;

-- ── establecer_clave_paciente (admin crea/restablece): invalida cualquier
--    sesión previa de ese paciente, misma razón ──
create or replace function public.establecer_clave_paciente(
  p_paciente_id uuid,
  p_usuario text,
  p_clave text
) returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_optica_id uuid;
  v_llamador_optica uuid;
  v_es_superadmin boolean;
begin
  select optica_id into v_optica_id from pacientes where id = p_paciente_id;
  if v_optica_id is null then return false; end if;

  select optica_id into v_llamador_optica from perfiles where id = auth.uid();
  select es_superadmin() into v_es_superadmin;

  if not v_es_superadmin and (v_llamador_optica is null or v_llamador_optica <> v_optica_id) then
    raise exception 'No autorizado';
  end if;

  update pacientes
  set tiene_cuenta = true, usuario = p_usuario,
      clave_temporal = extensions.crypt(p_clave, extensions.gen_salt('bf')),
      sesion_token = null,
      updated_at = now()
  where id = p_paciente_id;
  return found;
end;
$$;

-- ── invalidar_sesion_paciente: para que "Cerrar sesión" invalide el token
--    en el servidor, no solo lo borre del navegador ──
create or replace function public.invalidar_sesion_paciente(
  p_paciente_id uuid,
  p_token text
) returns void
language sql
security definer
set search_path = public
as $$
  update pacientes set sesion_token = null
  where id = p_paciente_id and sesion_token = p_token;
$$;

revoke all on function public.invalidar_sesion_paciente(uuid, text) from public;
grant execute on function public.invalidar_sesion_paciente(uuid, text) to anon;
