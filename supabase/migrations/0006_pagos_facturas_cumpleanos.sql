-- Seguimiento manual de pago por óptica, historial de facturas, y cumpleaños
-- del administrador (lo carga el superadmin desde el detalle de la óptica —
-- Dashboard.jsx todavía no tiene un "Mi cuenta" propio para que el admin lo
-- autocomplete). Correr manualmente en Supabase Studio → SQL Editor, igual
-- que 0001-0005.

alter table opticas add column if not exists estado_pago text not null default 'al_dia' check (estado_pago in ('al_dia', 'pendiente', 'vencido'));
alter table opticas add column if not exists monto_mensual numeric(10,2);
alter table opticas add column if not exists proximo_vencimiento date;

alter table perfiles add column if not exists fecha_nacimiento date;

create table facturas (
  id uuid primary key default gen_random_uuid(),
  optica_id uuid not null references opticas(id) on delete cascade,
  numero text not null,
  periodo text not null, -- 'YYYY-MM'
  monto numeric(10,2) not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'pagada')),
  emitida_at timestamptz not null default now(),
  pagada_at timestamptz
);
create index facturas_optica_id_idx on facturas(optica_id);

alter table facturas enable row level security;

create policy facturas_select_admin on facturas
  for select using (optica_id = (select optica_id from perfiles where id = auth.uid()));

create policy facturas_superadmin_all on facturas
  for all using (es_superadmin()) with check (es_superadmin());
