-- Bug real (auditoría 2026-08-27): Login.jsx verificaba la contraseña del
-- paciente comparando contra el estado local `pacientes` de React, que solo
-- se hidrata con datos reales de Supabase cuando hay una sesión de ADMIN
-- activa en ese mismo navegador (App.jsx: hidratarOpticaId solo corre
-- `if (esAdmin)`). Un paciente real, en su propio celular, nunca tiene ese
-- estado poblado — así que su cuenta (creada correctamente desde
-- Pacientes.jsx, sí persiste bien) era imposible de usar para entrar a su
-- propio portal. Solo funcionaba la cuenta demo hardcodeada.
--
-- Mismo patrón que crear_cita_publica (0019): funciones SECURITY DEFINER,
-- porque el paciente nunca tiene una sesión real de Supabase Auth (su
-- "sesión" es solo un pacienteId guardado en localStorage, confiado por el
-- resto del sistema igual que ya se confía para reagendar_cita_publica).
-- Nunca se devuelve `clave_temporal` ni `usuario` de vuelta al cliente.

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
set search_path = public
as $$
  select p.id, p.optica_id, p.nombre, p.cedula, p.telefono, p.correo, p.fecha_nacimiento,
         p.ultima_consulta, p.estado_clinico, p.referido_por, p.evolucion, p.estado_correccion,
         p.fecha_registro, p.tiene_cuenta
  from pacientes p
  where p.tiene_cuenta = true
    and (p.usuario = p_usuario or p.cedula = p_usuario)
    and p.clave_temporal = p_clave
  limit 1;
$$;

revoke all on function public.verificar_login_paciente(text, text) from public;
grant execute on function public.verificar_login_paciente(text, text) to anon;

-- Restaurar sesión al recargar la página, sin volver a pedir contraseña
-- (confía en el pacienteId ya guardado localmente, igual que el resto del
-- sistema) — y de paso trae los datos frescos por si cambiaron.
create or replace function public.obtener_paciente_por_id(
  p_paciente_id uuid
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
  where p.id = p_paciente_id and p.tiene_cuenta = true;
$$;

revoke all on function public.obtener_paciente_por_id(uuid) from public;
grant execute on function public.obtener_paciente_por_id(uuid) to anon;

-- "Mis citas" / "Mi receta" del portal tenían el mismo problema: citas y
-- consultas también dependían de la hidratación del admin. Devuelve las
-- filas completas (todas sus propias columnas) — son datos del propio
-- paciente, no hay nada que proteger de él mismo.
create or replace function public.mis_citas_paciente(
  p_paciente_id uuid
) returns setof citas
language sql
security definer
set search_path = public
as $$
  select * from citas where paciente_id = p_paciente_id order by fecha desc, hora desc;
$$;

revoke all on function public.mis_citas_paciente(uuid) from public;
grant execute on function public.mis_citas_paciente(uuid) to anon;

create or replace function public.mis_consultas_paciente(
  p_paciente_id uuid
) returns setof consultas
language sql
security definer
set search_path = public
as $$
  select * from consultas where paciente_id = p_paciente_id order by fecha desc;
$$;

revoke all on function public.mis_consultas_paciente(uuid) from public;
grant execute on function public.mis_consultas_paciente(uuid) to anon;

-- "Cambiar contraseña" en PortalPaciente.jsx solo mutaba el estado local de
-- React (setPacientes) — nunca llamaba a Supabase. El cambio se perdía al
-- recargar o en cualquier otro dispositivo.
create or replace function public.cambiar_clave_paciente(
  p_paciente_id uuid,
  p_clave_nueva text
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update pacientes set tiene_cuenta = true, clave_temporal = p_clave_nueva, updated_at = now()
  where id = p_paciente_id;
  return found;
end;
$$;

revoke all on function public.cambiar_clave_paciente(uuid, text) from public;
grant execute on function public.cambiar_clave_paciente(uuid, text) to anon;

-- ─── Avisos del CRM: hoy viven solo en localStorage (CRM.jsx no llama a
-- Supabase en absoluto) — un aviso publicado por un admin es invisible para
-- un asistente en otra máquina, y se pierde si se limpia el navegador. ───
create table avisos (
  id uuid primary key default gen_random_uuid(),
  optica_id uuid not null references opticas(id) on delete cascade,
  texto text not null,
  destinatario_id uuid references pacientes(id) on delete set null,
  destinatario_nombre text,
  destinatario_telefono text,
  created_at timestamptz not null default now()
);
create index avisos_optica_id_idx on avisos(optica_id);

alter table avisos enable row level security;

create policy avisos_admin_all on avisos
  for all
  using (optica_id = (select optica_id from perfiles where id = auth.uid()))
  with check (optica_id = (select optica_id from perfiles where id = auth.uid()));

create policy avisos_superadmin_all on avisos
  for all using (es_superadmin()) with check (es_superadmin());
