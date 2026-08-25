-- Registro de auditoría del panel de superadmin: quién creó/suspendió/
-- reactivó qué óptica y cuándo. El anteproyecto de tesis promete trazabilidad
-- de acciones administrativas — hasta ahora no existía en ningún lado.
-- Reutiliza es_superadmin() ya definida en 0001. Correr manualmente en
-- Supabase Studio → SQL Editor, igual que 0001 y 0002.

create table auditoria (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  actor_nombre text not null,
  accion text not null check (accion in ('crear_optica', 'suspender_optica', 'reactivar_optica')),
  optica_id uuid references opticas(id) on delete set null,
  optica_nombre text not null,
  created_at timestamptz not null default now()
);
create index auditoria_created_at_idx on auditoria(created_at desc);

alter table auditoria enable row level security;

create policy auditoria_superadmin_all on auditoria
  for all using (es_superadmin()) with check (es_superadmin());
