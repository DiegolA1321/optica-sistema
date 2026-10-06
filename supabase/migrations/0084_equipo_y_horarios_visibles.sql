-- Paso 3 del plan de prioridad 1, parte 2 (R12, R18, R19).
--
-- (1) Quién forma el equipo de la óptica. Hoy `perfiles` solo deja leer el
--     propio perfil (perfiles_select_self) y, al administrador, los
--     asistentes: nadie puede listar a los administradores, y un asistente no
--     puede listar a nadie. Pero "Asignado a" lo elige recepción (que suele ser
--     un asistente) y el nombre de quien atendió lo tiene que ver todo el
--     personal. Esta función devuelve solo lo necesario (id, nombre, rol y si
--     es optómetra) del equipo de la óptica de quien llama; no expone correo,
--     cédula ni permisos.
--
-- (2) R19: el administrador ve el horario personal de cada miembro del
--     personal. `horarios_usuario` solo permitía a cada persona leer y editar
--     el suyo (horarios_usuario_propio). Se agrega una política de LECTURA
--     para el administrador de la misma óptica. Editar sigue siendo solo del
--     dueño del horario.

-- Solo responde si quien llama es personal (admin, asistente o superadmin): una
-- cuenta sin perfil de personal, como la de un paciente, obtiene cero filas.
create or replace function public.equipo_optica()
returns table (id uuid, nombre text, rol text, es_optometra boolean)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.nombre, p.rol, coalesce(p.es_optometra, false)
  from perfiles yo
  join perfiles p on p.optica_id = yo.optica_id
  where yo.id = auth.uid()
    and yo.rol in ('admin', 'asistente', 'superadmin')
    and p.rol in ('admin', 'asistente')
    and optica_activa_actual()
  order by p.nombre;
$$;

revoke all on function public.equipo_optica() from public, anon;
grant execute on function public.equipo_optica() to authenticated;

drop policy if exists horarios_usuario_admin_lee on public.horarios_usuario;
create policy horarios_usuario_admin_lee on public.horarios_usuario
  for select
  to authenticated
  using (optica_id = optica_id_admin_actual() and optica_activa_actual());
