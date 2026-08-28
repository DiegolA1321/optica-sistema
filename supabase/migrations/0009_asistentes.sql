-- Asistentes pasan a ser cuentas reales de Supabase Auth, igual que
-- administradores — antes eran filas locales (localStorage) con contraseña
-- en texto plano y sin auth.uid() real, por lo que no podían tener RLS ni
-- sincronizar entre dispositivos.

alter table perfiles drop constraint perfiles_rol_check;
alter table perfiles add constraint perfiles_rol_check
  check (rol in ('superadmin', 'admin', 'asistente'));

alter table perfiles drop constraint perfiles_rol_optica_coherente;
alter table perfiles add constraint perfiles_rol_optica_coherente check (
  (rol = 'superadmin' and optica_id is null) or
  (rol in ('admin', 'asistente') and optica_id is not null)
);

-- Mapa de módulos habilitados (mismo shape que antes vivía en el objeto
-- local del asistente) — null/vacío para superadmin/admin, no se usa.
alter table perfiles add column if not exists permisos jsonb;

-- Mismo patrón que perfiles_insert_self_admin: tras signUp(), el nuevo
-- asistente (autenticado con el cliente temporal) inserta su propia fila.
create policy perfiles_insert_self_asistente on perfiles
  for insert with check (id = auth.uid() and rol = 'asistente');

-- Nota: no se agregan policies nuevas en pacientes/citas/consultas/
-- inventario/disponibilidad/opticas/mensajes/facturas — las que ya existen
-- filtran por optica_id sin distinguir rol, así que un asistente con su
-- propia optica_id ya queda correctamente scoped por las policies
-- existentes (mismo nivel de acceso que un admin a nivel de base de datos;
-- la separación fina por módulo sigue siendo, como hoy, a nivel de interfaz
-- vía perfiles.permisos, no a nivel de RLS).
