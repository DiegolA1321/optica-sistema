-- Capa de autenticación multi-tenant (superadmin + admin por óptica).
-- Correr manualmente en Supabase Studio → SQL Editor. Ver plan en
-- C:\Users\diego\.claude\plans\keen-twirling-lynx.md para el contexto completo.

create extension if not exists pgcrypto;

-- ─── opticas ───────────────────────────────────────────────────────────────
-- settings/motivos/diagnosticos por defecto replican exactamente lo que hoy
-- vive hardcodeado en App.jsx (PARAMETRIZACION_SEED, MOTIVOS_SEED,
-- DIAGNOSTICOS_SEED), para que una óptica nueva arranque con el mismo
-- comportamiento que el localStorage actual.
create table opticas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  slug text not null unique,
  logo_url text,
  settings jsonb not null default '{"mostrarMedidasPaciente": false, "manejaProgresion": true}'::jsonb,
  motivos_consulta text[] not null default array[
    'Consulta General','Adaptación de Lentes','Examen de Control','Garantía / Ajuste'
  ],
  diagnosticos_rapidos text[] not null default array[
    'Miopía','Hipermetropía','Astigmatismo','Presbicia',
    'Miopía y astigmatismo','Hipermetropía y astigmatismo','Sin alteración refractiva'
  ],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── perfiles (1:1 con auth.users) ─────────────────────────────────────────
create table perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  optica_id uuid references opticas(id) on delete set null,
  rol text not null check (rol in ('superadmin','admin')),
  nombre text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint perfiles_rol_optica_coherente check (
    (rol = 'superadmin' and optica_id is null) or
    (rol = 'admin' and optica_id is not null)
  )
);
create index perfiles_optica_id_idx on perfiles(optica_id);

-- ─── updated_at automático ──────────────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
create trigger opticas_set_updated_at before update on opticas
  for each row execute function set_updated_at();
create trigger perfiles_set_updated_at before update on perfiles
  for each row execute function set_updated_at();

-- ─── helper para RLS: evita recursión al chequear "soy superadmin" dentro
-- de una policy de la propia tabla perfiles (security definer = corre sin RLS) ──
create or replace function es_superadmin()
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from perfiles p where p.id = auth.uid() and p.rol = 'superadmin');
$$;

alter table opticas enable row level security;
alter table perfiles enable row level security;

-- ─── policies: perfiles ─────────────────────────────────────────────────────
create policy perfiles_select_self on perfiles
  for select using (id = auth.uid());

-- Usado por el flujo de alta de admin: tras signUp(), el nuevo admin
-- (autenticado con el cliente temporal) inserta su propia fila. El check
-- impide auto-asignarse rol='superadmin'.
create policy perfiles_insert_self_admin on perfiles
  for insert with check (id = auth.uid() and rol = 'admin');

create policy perfiles_superadmin_all on perfiles
  for all using (es_superadmin()) with check (es_superadmin());

-- ─── policies: opticas ──────────────────────────────────────────────────────
create policy opticas_superadmin_all on opticas
  for all using (es_superadmin()) with check (es_superadmin());

-- El Dashboard del admin necesita leer el nombre de su propia óptica.
create policy opticas_select_own_admin on opticas
  for select using (id = (select optica_id from perfiles where id = auth.uid()));

-- Incluida ahora por compatibilidad futura (migración de Configuracion.jsx en
-- una pasada posterior) — no se ejercita en este slice.
create policy opticas_update_own_admin on opticas
  for update
  using (id = (select optica_id from perfiles where id = auth.uid()))
  with check (id = (select optica_id from perfiles where id = auth.uid()));

-- ─── Bootstrap del superadmin ───────────────────────────────────────────────
-- Correr esto DESPUÉS de crear manualmente el usuario de Diego en
-- Authentication → Users → Add user, reemplazando el UID copiado de ahí:
--
-- insert into perfiles (id, optica_id, rol, nombre)
-- values ('<uid-de-Diego>', null, 'superadmin', 'Diego Alarcón');
