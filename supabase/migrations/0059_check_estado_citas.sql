-- Hallazgo I10 de la auditoría 2026-09-09: citas_base.estado es un texto
-- libre sin restricción — un typo en cualquier INSERT/UPDATE (desde código
-- nuevo, una migración futura, o edición manual en el SQL editor) puede
-- dejar una cita en un estado que ninguna pantalla reconoce (los filtros y
-- el kanban de Citas.jsx comparan por texto exacto), sin que la base avise.
-- Se agrega un CHECK con los 6 estados que el frontend realmente usa hoy
-- (confirmado por grep sobre src/: Pendiente, En Espera, En Atención,
-- Atendida, Cancelada, No Asistió — "Confirmada" no es un estado, es el
-- timestamp separado confirmada_at).

alter table citas_base
  add constraint citas_estado_valido
  check (estado in ('Pendiente', 'En Espera', 'En Atención', 'Atendida', 'Cancelada', 'No Asistió'));
