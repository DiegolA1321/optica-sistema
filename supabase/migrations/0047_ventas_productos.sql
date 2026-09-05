-- Caso "Inventario" de la reunión con el ing (Sexta Mirada, punto 7): hoy no
-- existe ninguna forma de vender un producto con métodos de pago/cuotas —
-- lo único parecido es la columna suelta consultas.monto_venta (0040), que
-- vincula un solo producto a una consulta puntual y no soporta cuotas, ni
-- estado de pago, ni consultarse desde el perfil del paciente o Inventario.
--
-- Esta tabla es la pieza base que destraba, además del punto 7: el reporte
-- por producto (punto 4), los pagos pendientes visibles en el perfil del
-- paciente (punto 5) y "vender producto" desde Inventario o desde la
-- búsqueda de paciente (punto 6). No reemplaza ni toca monto_venta — son dos
-- flujos de venta distintos (uno ligado a una consulta puntual, este nuevo
-- para ventas de mostrador con más de un producto y con seguimiento de pago).
--
-- Mismo patrón de RLS que ya usa 0034 (permisos_asistente_en_rls): lectura
-- abierta a cualquier miembro de la óptica, escritura gateada por
-- tiene_permiso_modulo(). Una venta puede iniciarse desde Inventario o desde
-- la ficha de un paciente, así que se acepta cualquiera de esos tres
-- permisos (mismo criterio ya usado para inventario_staff_write).

create table if not exists ventas (
  id uuid primary key default gen_random_uuid(),
  optica_id uuid not null references opticas(id) on delete cascade,
  paciente_id uuid not null references pacientes(id) on delete cascade,
  producto_id uuid references inventario(id) on delete set null,
  producto_nombre text not null,
  cantidad integer not null default 1 check (cantidad > 0),
  precio_unitario numeric(10,2) not null check (precio_unitario >= 0),
  monto_total numeric(10,2) not null check (monto_total >= 0),
  metodo_pago text not null default 'directo' check (metodo_pago in ('directo', 'tarjeta', 'cuotas')),
  cuotas_totales integer check (cuotas_totales is null or cuotas_totales > 0),
  cuotas_pagadas integer not null default 0 check (cuotas_pagadas >= 0),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'completado')),
  registrado_por uuid references perfiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index ventas_optica_id_idx on ventas(optica_id);
create index ventas_paciente_id_idx on ventas(paciente_id);
create index ventas_producto_id_idx on ventas(producto_id);

alter table ventas enable row level security;

create policy ventas_staff_select on ventas
  for select using (optica_id = (select optica_id from perfiles where id = auth.uid()));

create policy ventas_staff_write on ventas
  for all
  using (
    optica_id = (select optica_id from perfiles where id = auth.uid())
    and (tiene_permiso_modulo('inventario') or tiene_permiso_modulo('pacientes') or tiene_permiso_modulo('consultas'))
  )
  with check (
    optica_id = (select optica_id from perfiles where id = auth.uid())
    and (tiene_permiso_modulo('inventario') or tiene_permiso_modulo('pacientes') or tiene_permiso_modulo('consultas'))
  );

create policy ventas_superadmin_all on ventas
  for all using (es_superadmin()) with check (es_superadmin());
