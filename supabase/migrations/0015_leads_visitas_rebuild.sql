-- Después de agotar todo diagnóstico posible (policy verificada al nivel de
-- AST interno de Postgres como TRUE puro, grants correctos, roles correctos,
-- reinicio del proyecto sin efecto, y una tabla de prueba con estructura
-- idéntica funcionando perfecto), leads/visitas seguían rechazando el INSERT
-- de anon con "violates row-level security policy" sin ninguna causa visible
-- a nivel de su definición actual. Ambas tablas están vacías (0 filas) — se
-- recrean de cero para eliminar cualquier estado interno corrupto ligado al
-- objeto original, que pasó por tres migraciones distintas (0011/0012/0014).

drop table if exists leads;
drop table if exists visitas;

create table leads (
  id uuid primary key default gen_random_uuid(),
  nombre_optica text not null,
  slug_deseado text,
  nombre_admin text not null,
  email_admin text not null,
  telefono text,
  mensaje text,
  estado text not null default 'nuevo' check (estado in ('nuevo', 'contactado', 'convertido', 'descartado')),
  optica_id uuid references opticas(id) on delete set null,
  created_at timestamptz not null default now()
);
create index leads_created_at_idx on leads(created_at desc);
create index leads_estado_idx on leads(estado);

alter table leads enable row level security;

create policy leads_insert_publico on leads
  for insert to anon with check (true);
create policy leads_superadmin_select on leads
  for select using (es_superadmin());
create policy leads_superadmin_update on leads
  for update using (es_superadmin()) with check (es_superadmin());
create policy leads_superadmin_delete on leads
  for delete using (es_superadmin());

create table visitas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('venta', 'optica_publica')),
  optica_id uuid references opticas(id) on delete set null,
  created_at timestamptz not null default now()
);
create index visitas_created_at_idx on visitas(created_at desc);
create index visitas_tipo_idx on visitas(tipo);

alter table visitas enable row level security;

create policy visitas_insert_publico on visitas
  for insert to anon with check (true);
create policy visitas_superadmin_select on visitas
  for select using (es_superadmin());
create policy visitas_superadmin_delete on visitas
  for delete using (es_superadmin());
