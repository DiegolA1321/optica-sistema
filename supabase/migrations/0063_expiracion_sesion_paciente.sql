-- Hallazgo I3 de la auditoría 2026-09-09: "confirmar duración del token de
-- sesión del paciente y si hay renovación silenciosa" — al verificar, la
-- respuesta real es que NO había ninguna duración: `sesion_token`
-- (migración 0028) es válido para siempre hasta que el paciente cierra
-- sesión manualmente o cambia su contraseña. Un dispositivo perdido o un
-- token filtrado quedaría útil indefinidamente para leer historia clínica,
-- citas y datos personales de ese paciente.
--
-- Se agrega una duración real (30 días desde el login — razonable para un
-- portal de paciente que no se usa a diario, no es una app bancaria) y se
-- centraliza la verificación en una sola función (antes cada uno de los 7
-- RPC que aceptan el token repetía su propia versión del mismo `where`, con
-- el riesgo de que uno quedara desactualizado como ya pasó varias veces en
-- este proyecto con otras funciones duplicadas — ver I11).
--
-- Bug real encontrado de paso (ya estaba roto en producción, sin relación
-- con I3): `mis_citas_paciente` y `mis_consultas_paciente` declaraban
-- `returns setof citas_base`/`consultas_base` pero seleccionaban de las
-- VISTAS `citas`/`consultas` (para traer los datos ya descifrados) — bases
-- y vistas dejaron de tener las mismas columnas en el mismo orden desde que
-- el cifrado (migraciones 0043/0055) movió las columnas cifradas al final
-- de la tabla base. El resultado: "Mis citas" y "Mi receta" del portal del
-- paciente fallaban con "return type mismatch" en cualquier intento real.
-- Se corrige declarando el tipo de retorno como la vista (`setof
-- citas`/`consultas`), que sí coincide con lo que de verdad se selecciona.

alter table pacientes_base add column if not exists sesion_token_creado_en timestamptz;

create or replace function public.sesion_paciente_valida(p_paciente_id uuid, p_token text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from pacientes_base p
    where p.id = p_paciente_id
      and p.sesion_token is not null
      and p.sesion_token = p_token
      and p.sesion_token_creado_en is not null
      and p.sesion_token_creado_en > now() - interval '30 days'
  );
$$;

revoke all on function public.sesion_paciente_valida(uuid, text) from public;
grant execute on function public.sesion_paciente_valida(uuid, text) to anon, authenticated;

-- verificar_login_paciente: además de emitir el token, ahora deja registrado cuándo se emitió.
create or replace function public.verificar_login_paciente(
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
  update pacientes_base
  set intentos_fallidos = 0, bloqueado_hasta = null, sesion_token = v_token, sesion_token_creado_en = now()
  where pacientes_base.id = v_paciente.id;

  return query select
    v_paciente.id, v_paciente.optica_id, v_paciente.nombre, v_paciente.cedula, v_paciente.telefono, v_paciente.correo,
    v_paciente.fecha_nacimiento, v_paciente.ultima_consulta, v_paciente.estado_clinico, v_paciente.referido_por,
    v_paciente.evolucion, v_paciente.estado_correccion, v_paciente.fecha_registro, v_paciente.tiene_cuenta,
    false, null::int, v_token;
end;
$$;

create or replace function public.invalidar_sesion_paciente(p_paciente_id uuid, p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  update pacientes_base set sesion_token = null, sesion_token_creado_en = null
  where id = p_paciente_id and sesion_token = p_token;
$$;

-- Cambia el tipo de retorno (setof consultas_base -> setof consultas) —
-- create or replace no lo permite, hay que dropear primero (I11).
drop function if exists public.mis_consultas_paciente(uuid, text);

create function public.mis_consultas_paciente(p_paciente_id uuid, p_token text default null)
returns setof consultas
language sql
security definer
set search_path = public
as $$
  select c.* from consultas c
  where c.paciente_id = p_paciente_id
    and sesion_paciente_valida(p_paciente_id, p_token)
  order by c.fecha desc;
$$;

-- drop function borra los grants existentes junto con la función — hay que
-- volver a otorgarlos (siempre fueron solo a anon, no a authenticated).
revoke all on function public.mis_consultas_paciente(uuid, text) from public;
grant execute on function public.mis_consultas_paciente(uuid, text) to anon;

drop function if exists public.mis_citas_paciente(uuid, text);

create function public.mis_citas_paciente(p_paciente_id uuid, p_token text default null)
returns setof citas
language sql
security definer
set search_path = public
as $$
  select c.* from citas c
  where c.paciente_id = p_paciente_id
    and sesion_paciente_valida(p_paciente_id, p_token)
  order by c.fecha desc, c.hora desc;
$$;

revoke all on function public.mis_citas_paciente(uuid, text) from public;
grant execute on function public.mis_citas_paciente(uuid, text) to anon;

create or replace function public.obtener_paciente_por_id(p_paciente_id uuid, p_token text default null)
returns table(id uuid, optica_id uuid, nombre text, cedula text, telefono text, correo text, fecha_nacimiento date, ultima_consulta text, estado_clinico text, referido_por text, evolucion text, estado_correccion text, fecha_registro date, tiene_cuenta boolean)
language sql
security definer
set search_path = public
as $$
  select p.id, p.optica_id, p.nombre, p.cedula, p.telefono, p.correo, p.fecha_nacimiento,
         p.ultima_consulta, p.estado_clinico, p.referido_por, p.evolucion, p.estado_correccion,
         p.fecha_registro, p.tiene_cuenta
  from pacientes p
  where p.id = p_paciente_id and p.tiene_cuenta = true
    and sesion_paciente_valida(p_paciente_id, p_token);
$$;

create or replace function public.reagendar_cita_publica(
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
  if not sesion_paciente_valida(p_paciente_id, p_token) then
    return false;
  end if;

  begin
    update citas
    set fecha = p_fecha, hora = p_hora, estado = 'Pendiente', updated_at = now()
    where id = p_cita_id and paciente_id = p_paciente_id;
  exception
    when unique_violation then
      raise exception 'Ese horario ya no está disponible. Elige otro.';
  end;
  return found;
end;
$$;

create or replace function public.cancelar_cita_publica(p_cita_id uuid, p_paciente_id uuid, p_token text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not sesion_paciente_valida(p_paciente_id, p_token) then
    return false;
  end if;

  update citas
  set estado = 'Cancelada', updated_at = now()
  where id = p_cita_id and paciente_id = p_paciente_id and estado = 'Pendiente';
  return found;
end;
$$;

create or replace function public.solicitar_eliminacion_paciente(p_paciente_id uuid, p_token text, p_motivo text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_optica_id uuid;
begin
  if not sesion_paciente_valida(p_paciente_id, p_token) then
    return false;
  end if;

  select optica_id into v_optica_id from pacientes where id = p_paciente_id;

  if exists (select 1 from solicitudes_eliminacion_paciente where paciente_id = p_paciente_id and estado = 'pendiente') then
    return true;
  end if;

  insert into solicitudes_eliminacion_paciente (optica_id, paciente_id, motivo)
  values (v_optica_id, p_paciente_id, left(nullif(trim(p_motivo), ''), 500));
  return true;
end;
$$;

create or replace function public.exportar_mis_datos_paciente(p_paciente_id uuid, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_resultado jsonb;
begin
  if not sesion_paciente_valida(p_paciente_id, p_token) then
    return null;
  end if;

  select jsonb_build_object(
    'perfil', (select to_jsonb(p) - 'clave_temporal' - 'sesion_token' from pacientes p where p.id = p_paciente_id),
    'citas', (select coalesce(jsonb_agg(c), '[]'::jsonb) from citas c where c.paciente_id = p_paciente_id),
    'consultas', (select coalesce(jsonb_agg(co), '[]'::jsonb) from consultas co where co.paciente_id = p_paciente_id),
    'exportado_en', now()
  ) into v_resultado;

  return v_resultado;
end;
$$;
