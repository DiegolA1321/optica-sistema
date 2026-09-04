-- Alias/referencia de rol para un asistente (ej. "Secretaria", "Asesor de
-- ventas") — puramente descriptivo, no cambia sus permisos ni su rol real
-- (rol sigue siendo 'asistente' en todos los casos, esto es solo una
-- etiqueta visible para que el admin recuerde para qué contrató a cada
-- persona). Nullable, sin default: los asistentes existentes quedan sin
-- etiqueta hasta que el admin la agregue.
alter table perfiles add column if not exists etiqueta_rol text;
