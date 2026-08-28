-- Bug real de seguridad (revisión total 2026-08-28): clave_temporal se
-- guardaba y comparaba en texto plano — verificar_login_paciente hacía
-- `p.clave_temporal = p_clave` directo, y Pacientes.jsx escribía la clave
-- generada tal cual con un update de cliente. Cualquiera con acceso de
-- lectura a la tabla pacientes (o a un backup) veía todas las contraseñas.
-- Se migra a hash bcrypt vía pgcrypto (vive en el schema `extensions` en
-- Supabase, por eso crypt()/gen_salt() van calificados abajo), igual que
-- hace Supabase Auth internamente para sus propias contraseñas.

create extension if not exists pgcrypto with schema extensions;

-- Un solo paso, idempotente: re-hashea cualquier clave_temporal que todavía
-- no tenga forma de hash bcrypt ($2a$/$2b$/$2y$...). Si se corre dos veces
-- no vuelve a hashear lo ya hasheado.
update pacientes
set clave_temporal = extensions.crypt(clave_temporal, extensions.gen_salt('bf'))
where clave_temporal is not null
  and clave_temporal !~ '^\$2[aby]\$';

-- Login: compara con crypt(), no con `=`.
create or replace function public.verificar_login_paciente(
  p_usuario text,
  p_clave text
) returns table (
  id uuid, optica_id uuid, nombre text, cedula text, telefono text, correo text,
  fecha_nacimiento date, ultima_consulta text, estado_clinico text, referido_por text,
  evolucion text, estado_correccion text, fecha_registro date, tiene_cuenta boolean
)
language sql
security definer
set search_path = public, extensions
as $$
  select p.id, p.optica_id, p.nombre, p.cedula, p.telefono, p.correo, p.fecha_nacimiento,
         p.ultima_consulta, p.estado_clinico, p.referido_por, p.evolucion, p.estado_correccion,
         p.fecha_registro, p.tiene_cuenta
  from pacientes p
  where p.tiene_cuenta = true
    and (p.usuario = p_usuario or p.cedula = p_usuario)
    and p.clave_temporal is not null
    and p.clave_temporal = extensions.crypt(p_clave, p.clave_temporal)
  limit 1;
$$;

-- Cambio de clave desde el propio portal: guarda el hash, nunca el texto.
create or replace function public.cambiar_clave_paciente(
  p_paciente_id uuid,
  p_clave_nueva text
) returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  update pacientes set tiene_cuenta = true, clave_temporal = extensions.crypt(p_clave_nueva, extensions.gen_salt('bf')), updated_at = now()
  where id = p_paciente_id;
  return found;
end;
$$;

-- Antes Pacientes.jsx escribía clave_temporal en texto plano con un update
-- directo desde el cliente (guardarCuenta en Pacientes.jsx). Se reemplaza
-- por esta función: el admin/asistente sigue generando y viendo la clave en
-- texto plano una sola vez para copiarla y dársela al paciente (eso es
-- normal, es una clave temporal de un solo uso), pero lo que queda
-- guardado en la base es el hash. security definer porque necesita poder
-- escribir clave_temporal aunque la policy de pacientes no distinga esa
-- columna, pero valida primero que quien llama es admin/asistente/superadmin
-- de la MISMA óptica del paciente (o superadmin), igual que exige la RLS
-- que ya protege el resto de la tabla.
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
  set tiene_cuenta = true, usuario = p_usuario, clave_temporal = extensions.crypt(p_clave, extensions.gen_salt('bf')), updated_at = now()
  where id = p_paciente_id;
  return found;
end;
$$;

revoke all on function public.establecer_clave_paciente(uuid, text, text) from public;
grant execute on function public.establecer_clave_paciente(uuid, text, text) to authenticated;
