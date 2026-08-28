-- Los permisos de un asistente (qué módulos ve: pacientes, consultas,
-- citas, horario, inventario, crm, reportes) solo se aplicaban en la
-- interfaz (Dashboard.jsx oculta el nav) — a nivel de base de datos, un
-- asistente y el admin de la misma óptica tenían exactamente el mismo
-- acceso vía las policies "*_admin_all". Alguien con las credenciales
-- reales de un asistente podía llamar la API de Supabase directo y
-- leer/escribir un módulo que su panel le tenía oculto (ej. Inventario
-- desactivado, pero igual insert/update/delete por API).
--
-- Mapeo de qué módulo puede ESCRIBIR en qué tabla — no es 1:1 porque hay
-- dependencias reales entre módulos (verificadas en el código, no
-- supuestas): ConsultaMedica.jsx actualiza pacientes.evolucion y
-- descuenta inventario.stock al vincular un producto; Pacientes.jsx borra
-- citas/consultas en cascada al eliminar un paciente. Si el escritura se
-- limitara estrictamente 1:1 por tabla, esos flujos reales se romperían
-- para un asistente con permisos parciales:
--   pacientes  -> permiso 'pacientes' o 'consultas'
--   citas      -> permiso 'citas' o 'pacientes'
--   consultas  -> permiso 'consultas' o 'pacientes'
--   inventario -> permiso 'inventario' o 'consultas'
--   disponibilidad -> permiso 'horario' (sin dependencias cruzadas)
--   avisos     -> permiso 'crm' (módulo aislado, nada más lo toca)
--
-- La LECTURA se deja igual que hoy (cualquier miembro de la óptica lee
-- todo lo operativo de su óptica) — está comprobado que Inicio.jsx (que
-- ve cualquier asistente, no es un módulo desactivable) depende de leer
-- `inventario` completo para su KPI de alertas de stock, y patrones
-- similares se repiten con pacientes/citas/consultas desde varias
-- pantallas. Restringir la lectura por módulo rompería esas pantallas sin
-- ganar seguridad real (todos son empleados de la misma óptica; el límite
-- que sí importa —aislar una óptica de otra— ya está resuelto). avisos es
-- la única tabla sin ninguna dependencia cruzada verificada, así que ahí
-- sí se restringe lectura y escritura juntas.
--
-- admin y superadmin no tienen restricción — permisos solo aplica a
-- rol='asistente' (para admin/superadmin la función siempre da true).

create or replace function public.tiene_permiso_modulo(p_modulo text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_rol text;
  v_permisos jsonb;
begin
  select rol, permisos into v_rol, v_permisos from perfiles where id = auth.uid();
  if v_rol is null then return false; end if;
  if v_rol in ('admin', 'superadmin') then return true; end if;
  if v_rol = 'asistente' then return coalesce((v_permisos->>p_modulo)::boolean, false); end if;
  return false;
end;
$$;

-- ── pacientes ──
drop policy if exists pacientes_admin_all on pacientes;
create policy pacientes_staff_select on pacientes
  for select using (optica_id = (select optica_id from perfiles where id = auth.uid()));
create policy pacientes_staff_write on pacientes
  for all
  using (optica_id = (select optica_id from perfiles where id = auth.uid()) and (tiene_permiso_modulo('pacientes') or tiene_permiso_modulo('consultas')))
  with check (optica_id = (select optica_id from perfiles where id = auth.uid()) and (tiene_permiso_modulo('pacientes') or tiene_permiso_modulo('consultas')));

-- ── citas ──
drop policy if exists citas_admin_all on citas;
create policy citas_staff_select on citas
  for select using (optica_id = (select optica_id from perfiles where id = auth.uid()));
create policy citas_staff_write on citas
  for all
  using (optica_id = (select optica_id from perfiles where id = auth.uid()) and (tiene_permiso_modulo('citas') or tiene_permiso_modulo('pacientes')))
  with check (optica_id = (select optica_id from perfiles where id = auth.uid()) and (tiene_permiso_modulo('citas') or tiene_permiso_modulo('pacientes')));

-- ── consultas ──
drop policy if exists consultas_admin_all on consultas;
create policy consultas_staff_select on consultas
  for select using (optica_id = (select optica_id from perfiles where id = auth.uid()));
create policy consultas_staff_write on consultas
  for all
  using (optica_id = (select optica_id from perfiles where id = auth.uid()) and (tiene_permiso_modulo('consultas') or tiene_permiso_modulo('pacientes')))
  with check (optica_id = (select optica_id from perfiles where id = auth.uid()) and (tiene_permiso_modulo('consultas') or tiene_permiso_modulo('pacientes')));

-- ── inventario ──
drop policy if exists inventario_admin_all on inventario;
create policy inventario_staff_select on inventario
  for select using (optica_id = (select optica_id from perfiles where id = auth.uid()));
create policy inventario_staff_write on inventario
  for all
  using (optica_id = (select optica_id from perfiles where id = auth.uid()) and (tiene_permiso_modulo('inventario') or tiene_permiso_modulo('consultas')))
  with check (optica_id = (select optica_id from perfiles where id = auth.uid()) and (tiene_permiso_modulo('inventario') or tiene_permiso_modulo('consultas')));

-- ── disponibilidad ──
drop policy if exists disponibilidad_admin_all on disponibilidad;
create policy disponibilidad_staff_select on disponibilidad
  for select using (optica_id = (select optica_id from perfiles where id = auth.uid()));
create policy disponibilidad_staff_write on disponibilidad
  for all
  using (optica_id = (select optica_id from perfiles where id = auth.uid()) and tiene_permiso_modulo('horario'))
  with check (optica_id = (select optica_id from perfiles where id = auth.uid()) and tiene_permiso_modulo('horario'));

-- ── avisos: único módulo sin dependencias cruzadas, se restringe también la lectura ──
drop policy if exists avisos_admin_all on avisos;
create policy avisos_staff_crm on avisos
  for all
  using (optica_id = (select optica_id from perfiles where id = auth.uid()) and tiene_permiso_modulo('crm'))
  with check (optica_id = (select optica_id from perfiles where id = auth.uid()) and tiene_permiso_modulo('crm'));
