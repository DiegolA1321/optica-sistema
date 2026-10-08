-- Error real encontrado por las pruebas de Playwright (7 de octubre): crear o editar un rol desde "Usuarios y permisos > Roles"
-- falla para el administrador con
--   42501 permission denied for function _catalogo_permisos
-- Causa: el disparador roles_valida() (0090) corre con los permisos de quien guarda el rol y llama a _catalogo_permisos(),
-- a la que 0090 le quitó EXECUTE a `authenticated`. Solo el superadmin (o postgres) podía guardar roles; la pantalla nunca se
-- había probado con una cuenta de administrador.
--
-- Corrección: que la validación corra como su dueño (SECURITY DEFINER), con search_path fijo. No cambia lo que valida ni a quién
-- se lo permite: la política roles_admin_write sigue exigiendo ser administrador de esa óptica, y la función solo lee NEW y el
-- catálogo (no usa auth.uid() ni ninguna tabla).
--
-- Revisado en la base: es la única función INVOKER de `public` que llama a otra sin EXECUTE para authenticated.

alter function public.roles_valida() security definer;
alter function public.roles_valida() set search_path = public;

-- Reversión (no se ejecuta):
-- alter function public.roles_valida() security invoker;
