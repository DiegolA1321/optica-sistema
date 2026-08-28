-- Canal de mensajes entre administradores de óptica y el superadmin, más
-- avisos generales del superadmin hacia todos los administradores.
-- Correr manualmente en Supabase Studio → SQL Editor, igual que 0001-0004.

create table mensajes (
  id uuid primary key default gen_random_uuid(),
  -- null en mensajes tipo 'anuncio' (van a todos los administradores a la vez)
  optica_id uuid references opticas(id) on delete cascade,
  tipo text not null check (tipo in ('consulta', 'anuncio')),
  remitente_id uuid references perfiles(id) on delete set null,
  remitente_nombre text not null,
  asunto text not null,
  cuerpo text not null,
  estado text not null default 'abierto' check (estado in ('abierto', 'resuelto')),
  respuesta text,
  respondido_at timestamptz,
  created_at timestamptz not null default now()
);
create index mensajes_optica_id_idx on mensajes(optica_id);
create index mensajes_created_at_idx on mensajes(created_at desc);

alter table mensajes enable row level security;

-- El admin crea consultas solo para su propia óptica, a su propio nombre.
create policy mensajes_insert_admin on mensajes
  for insert with check (
    tipo = 'consulta' and remitente_id = auth.uid()
    and optica_id = (select optica_id from perfiles where id = auth.uid())
  );

-- El admin lee lo de su propia óptica (consultas propias, o cualquier
-- anuncio dirigido puntualmente a su óptica) más los avisos generales de
-- verdad (optica_id null = van a todos). Un anuncio con optica_id de OTRA
-- óptica no debe ser visible acá — antes esta policy decía "tipo='anuncio'"
-- sin más, lo que hacía visible cualquier aviso dirigido a cualquier óptica.
create policy mensajes_select_admin on mensajes
  for select using (
    (tipo = 'anuncio' and optica_id is null)
    or optica_id = (select optica_id from perfiles where id = auth.uid())
  );

-- El superadmin tiene control total (mismo patrón que perfiles_superadmin_all
-- y opticas_superadmin_all en la migración 0001).
create policy mensajes_superadmin_all on mensajes
  for all using (es_superadmin()) with check (es_superadmin());
