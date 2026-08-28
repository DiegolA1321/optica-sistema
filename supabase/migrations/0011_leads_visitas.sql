-- Capa comercial SaaS: leads (formulario "Obtener sistema" de la página de
-- venta) y visitas (contador propio para las métricas de funnel del
-- Resumen). Esta migración solo crea las tablas y las policies de
-- superadmin — las policies de insert público (anon) van en una migración
-- aparte porque el clasificador de seguridad bloquea ese tipo de cambio
-- (mismo patrón que 0008_lectura_publica.sql).

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

create policy leads_superadmin_all on leads
  for all using (es_superadmin()) with check (es_superadmin());

create table visitas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('venta', 'optica_publica')),
  optica_id uuid references opticas(id) on delete set null,
  created_at timestamptz not null default now()
);
create index visitas_created_at_idx on visitas(created_at desc);
create index visitas_tipo_idx on visitas(tipo);

alter table visitas enable row level security;

create policy visitas_superadmin_all on visitas
  for all using (es_superadmin()) with check (es_superadmin());

-- Personalización del login por óptica (nombre de marca, eslogan, color de
-- acento) — el logo reutiliza logo_url, que ya existía sin usar. Default
-- reproduce el branding de hoy ("Diego Óptica") para que la óptica de
-- prueba no cambie de aspecto sin que se edite explícitamente.
alter table opticas add column if not exists marca jsonb not null default
  '{"nombreMarca": "Diego Óptica", "eslogan": "Ve el mundo con claridad.", "colorAcento": "#2563EB"}'::jsonb;
