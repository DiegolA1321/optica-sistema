-- Caso "Mi horario" de la Sexta Mirada (reunión con el ing), puntos 5 y 6.
--
-- Hoy "Mi horario" (Horario.jsx) en realidad edita `disponibilidad`, que es
-- el horario GENERAL de la óptica (el que se muestra en la página pública) —
-- no hay ningún concepto de horario individual por usuario. El ing pidió
-- diferenciar ambos claramente, y que cada usuario pueda marcar un día que
-- no podrá asistir, quedando como constancia (hoy solo se avisa por
-- WhatsApp, de forma informal).
--
-- Esta tabla es personal y autogestionada: cada usuario ve y edita solo su
-- propia fila (no hay vista de "ausencias de todo el personal" en este
-- alcance — el admin puede seguir viendo `logs_optica` para auditoría, pero
-- eso es una pieza distinta).
create table if not exists horarios_usuario (
  usuario_id uuid primary key references perfiles(id) on delete cascade,
  optica_id uuid not null references opticas(id) on delete cascade,
  horario_semanal jsonb not null default '{}'::jsonb,
  ausencias jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create index horarios_usuario_optica_id_idx on horarios_usuario(optica_id);

alter table horarios_usuario enable row level security;

create policy horarios_usuario_propio on horarios_usuario
  for all
  using (usuario_id = auth.uid() and optica_id = (select optica_id from perfiles where id = auth.uid()))
  with check (usuario_id = auth.uid() and optica_id = (select optica_id from perfiles where id = auth.uid()));

create policy horarios_usuario_superadmin_all on horarios_usuario
  for all using (es_superadmin()) with check (es_superadmin());
