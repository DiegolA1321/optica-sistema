-- Caso "Usuarios y permisos" de la Sexta Mirada (reunión con el ing), puntos
-- 1 y 8 — los dos únicos que seguían pendientes de ese módulo.

-- ── Punto 1: ¿el administrador es también el optómetra/licenciado? ──
-- Dato puramente informativo (el propio ing lo dejó así: "o está bien así
-- como está, muchas veces los administradores son los mismos optómetras") —
-- no cambia permisos por sí solo, solo le da a Diego visibilidad de si ese
-- admin va a manejar el sistema él mismo o delegarlo. Nullable: los admins ya
-- existentes quedan "sin especificar" hasta que alguien lo marque.
alter table perfiles add column if not exists es_optometra boolean;

-- ── Punto 8: log de actividad por usuario, visible al administrador ──
-- Ejemplo del propio ing: "tengo tres asistentes, un elemento de inventario
-- fue eliminado, ¿cómo sé quién lo hizo?". Mismo patrón de RLS que el resto
-- (staff scoped a su optica_id vía perfiles). Cada fila la inserta el propio
-- usuario que hizo la acción (usuario_id = auth.uid()) — nunca se inserta a
-- nombre de otro. La lectura queda reservada al administrador principal de
-- esa óptica (y al superadmin) — un asistente no ve el log de sus propios
-- compañeros, ver Sexta Mirada: "eso se lo puede dar el admin, no todos".
create table if not exists logs_optica (
  id uuid primary key default gen_random_uuid(),
  optica_id uuid not null references opticas(id) on delete cascade,
  usuario_id uuid references perfiles(id) on delete set null,
  usuario_nombre text not null,
  modulo text not null,
  accion text not null,
  detalle text,
  created_at timestamptz not null default now()
);
create index logs_optica_optica_id_idx on logs_optica(optica_id);
create index logs_optica_created_at_idx on logs_optica(created_at desc);

alter table logs_optica enable row level security;

create policy logs_optica_staff_insert on logs_optica
  for insert
  with check (
    optica_id = (select optica_id from perfiles where id = auth.uid())
    and usuario_id = auth.uid()
  );

create policy logs_optica_admin_select on logs_optica
  for select
  using (
    optica_id = (select optica_id from perfiles where id = auth.uid())
    and (select rol from perfiles where id = auth.uid()) = 'admin'
  );

create policy logs_optica_superadmin_all on logs_optica
  for all using (es_superadmin()) with check (es_superadmin());
