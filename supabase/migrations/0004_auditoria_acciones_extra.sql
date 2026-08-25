-- Amplía auditoria para cubrir renombrar óptica, altas/bajas de
-- administradores y de otros superadmins — el panel de superadmin ahora
-- soporta esas acciones y todas deben quedar trazadas, no solo crear/
-- suspender/reactivar óptica. Correr manualmente en Supabase Studio → SQL
-- Editor, igual que 0001/0002/0003.

alter table auditoria add column if not exists detalle text;

alter table auditoria drop constraint if exists auditoria_accion_check;
alter table auditoria add constraint auditoria_accion_check check (accion in (
  'crear_optica', 'suspender_optica', 'reactivar_optica', 'renombrar_optica',
  'agregar_administrador', 'eliminar_administrador',
  'crear_superadmin', 'eliminar_superadmin'
));
