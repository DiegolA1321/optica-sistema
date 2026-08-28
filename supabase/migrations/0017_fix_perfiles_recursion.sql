-- Bug real encontrado en vivo (2026-08-25): CUALQUIER SELECT a perfiles,
-- para CUALQUIER rol (superadmin incluido), devolvía 500 Internal Server
-- Error — confirmado en el Network tab del navegador, no era un tema de
-- credenciales. Causa: la policy perfiles_admin_gestiona_asistentes (0010)
-- tiene un subquery crudo `(select ... from perfiles p2 where ...)` DENTRO
-- de una policy sobre la propia tabla perfiles — evaluar la policy exige
-- evaluar el subquery, que vuelve a disparar RLS sobre perfiles, que vuelve
-- a evaluar la policy... recursión infinita (Postgres error 42P17,
-- "infinite recursion detected in policy for relation perfiles"), que
-- PostgREST expone como 500. Pasaba SIEMPRE, no solo para admins con
-- asistentes — cualquier intento de leer perfiles alcanza para dispararla.
--
-- Mismo patrón que ya se usó para es_superadmin(): envolver la lectura
-- recursiva en una función SECURITY DEFINER, que corre como dueño de la
-- función y por lo tanto NO pasa por RLS al consultar perfiles
-- internamente — rompe el ciclo sin cambiar el alcance de la policy.

create or replace function public.optica_id_admin_actual()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select optica_id from perfiles where id = auth.uid() and rol = 'admin';
$$;

drop policy if exists perfiles_admin_gestiona_asistentes on perfiles;

create policy perfiles_admin_gestiona_asistentes on perfiles
  for all
  using (
    rol = 'asistente'
    and optica_id = optica_id_admin_actual()
  )
  with check (
    rol = 'asistente'
    and optica_id = optica_id_admin_actual()
  );
