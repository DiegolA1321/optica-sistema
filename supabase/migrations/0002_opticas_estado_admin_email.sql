-- Habilita suspender/reactivar ópticas desde el panel de superadmin, y guarda
-- el correo del admin en perfiles (el cliente anon no puede leer auth.users,
-- así que sin esto la tabla de ópticas no podría mostrar el correo del admin).
-- Correr manualmente en Supabase Studio → SQL Editor, igual que 0001.

alter table opticas add column if not exists activa boolean not null default true;
alter table perfiles add column if not exists email text;
