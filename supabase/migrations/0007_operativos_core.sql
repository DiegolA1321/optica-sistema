-- Aislamiento multi-óptica de los datos operativos que hasta ahora vivían
-- solo en localStorage (sin optica_id, sin backend real). Mismo patrón de
-- RLS que ya usan mensajes/facturas: el admin queda scoped a su propia
-- optica_id vía perfiles, el superadmin tiene control total vía
-- es_superadmin(). Correr manualmente (o vía la conexión directa ya
-- configurada), igual que 0001-0006.
--
-- parametrizacion / motivos_consulta / diagnosticos_rapidos NO se tocan acá
-- — ya existen como columnas de `opticas` desde la migración 0001
-- (settings, motivos_consulta, diagnosticos_rapidos) y solo falta conectar
-- el frontend.
--
-- Esta migración crea las 5 tablas (disponibilidad, inventario, pacientes,
-- citas, consultas). El frontend de pacientes/citas/consultas se conecta en
-- una ronda aparte (sub-fase B) — acá solo se deja el esquema listo.

-- ─── disponibilidad: una fila por óptica (el horario del optómetra) ───
create table disponibilidad (
  optica_id uuid primary key references opticas(id) on delete cascade,
  horario_semanal jsonb not null,
  excepciones jsonb not null default '{}'::jsonb,
  duracion_cita integer not null default 40,
  updated_at timestamptz not null default now()
);

alter table disponibilidad enable row level security;

create policy disponibilidad_admin_all on disponibilidad
  for all
  using (optica_id = (select optica_id from perfiles where id = auth.uid()))
  with check (optica_id = (select optica_id from perfiles where id = auth.uid()));

create policy disponibilidad_superadmin_all on disponibilidad
  for all using (es_superadmin()) with check (es_superadmin());

-- ─── inventario ───
create table inventario (
  id uuid primary key default gen_random_uuid(),
  optica_id uuid not null references opticas(id) on delete cascade,
  nombre text not null,
  categoria text not null,
  stock integer not null default 0,
  precio numeric(10,2) not null default 0,
  observacion text,
  critico integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index inventario_optica_id_idx on inventario(optica_id);

alter table inventario enable row level security;

create policy inventario_admin_all on inventario
  for all
  using (optica_id = (select optica_id from perfiles where id = auth.uid()))
  with check (optica_id = (select optica_id from perfiles where id = auth.uid()));

create policy inventario_superadmin_all on inventario
  for all using (es_superadmin()) with check (es_superadmin());

-- ─── pacientes ───
create table pacientes (
  id uuid primary key default gen_random_uuid(),
  optica_id uuid not null references opticas(id) on delete cascade,
  nombre text not null,
  cedula text,
  telefono text,
  correo text,
  fecha_nacimiento date,
  ultima_consulta text,
  estado_clinico text,
  referido_por text,
  evolucion text,
  estado_correccion text,
  fecha_registro date not null default current_date,
  tiene_cuenta boolean not null default false,
  usuario text,
  clave_temporal text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index pacientes_optica_id_idx on pacientes(optica_id);

alter table pacientes enable row level security;

create policy pacientes_admin_all on pacientes
  for all
  using (optica_id = (select optica_id from perfiles where id = auth.uid()))
  with check (optica_id = (select optica_id from perfiles where id = auth.uid()));

create policy pacientes_superadmin_all on pacientes
  for all using (es_superadmin()) with check (es_superadmin());

-- ─── citas ───
-- paciente_id opcional: las reservas públicas (sin cuenta) y registros
-- viejos pueden no tener un paciente real vinculado, igual que hoy.
create table citas (
  id uuid primary key default gen_random_uuid(),
  optica_id uuid not null references opticas(id) on delete cascade,
  paciente_id uuid references pacientes(id) on delete set null,
  paciente text not null,
  cedula text,
  telefono text,
  fecha date not null,
  hora text not null,
  motivo text,
  motivo_publico text,
  estado text not null default 'Pendiente',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index citas_optica_id_idx on citas(optica_id);
create index citas_fecha_idx on citas(fecha);

alter table citas enable row level security;

create policy citas_admin_all on citas
  for all
  using (optica_id = (select optica_id from perfiles where id = auth.uid()))
  with check (optica_id = (select optica_id from perfiles where id = auth.uid()));

create policy citas_superadmin_all on citas
  for all using (es_superadmin()) with check (es_superadmin());

-- Nota: falta la policy de inserción pública (reserva de cita sin cuenta,
-- AgendarCitaPublica.jsx) — se agrega junto con el trabajo de sub-fase B,
-- porque requiere resolver antes cómo una página pública sabe a qué
-- optica_id pertenece (hoy la app no tiene ruteo por óptica).

-- ─── consultas (fichas clínicas) ───
-- Los sub-objetos del examen (retinoscopia/od/oi/medidas/examen) van en una
-- sola columna jsonb: nada los filtra ni ordena individualmente hoy.
create table consultas (
  id uuid primary key default gen_random_uuid(),
  optica_id uuid not null references opticas(id) on delete cascade,
  paciente_id uuid references pacientes(id) on delete set null,
  paciente text not null,
  fecha date not null,
  motivo text,
  usa_lentes boolean,
  antecedentes text,
  alergias text,
  antecedentes_familiares text,
  datos_clinicos jsonb not null default '{}'::jsonb,
  diagnostico text,
  lente_recomendado text,
  indicaciones text,
  proximo_control_dias integer,
  evolucion_calculada text,
  estado_correccion text,
  producto_id uuid references inventario(id) on delete set null,
  producto_nombre text,
  created_at timestamptz not null default now()
);
create index consultas_optica_id_idx on consultas(optica_id);
create index consultas_paciente_id_idx on consultas(paciente_id);

alter table consultas enable row level security;

create policy consultas_admin_all on consultas
  for all
  using (optica_id = (select optica_id from perfiles where id = auth.uid()))
  with check (optica_id = (select optica_id from perfiles where id = auth.uid()));

create policy consultas_superadmin_all on consultas
  for all using (es_superadmin()) with check (es_superadmin());
