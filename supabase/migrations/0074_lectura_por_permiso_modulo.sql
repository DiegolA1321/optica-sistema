-- Hallazgo real 2026-09-10: revocarle un módulo a un asistente con sesión
-- abierta sí cortaba la ESCRITURA en tiempo real (tiene_permiso_modulo() en
-- las políticas *_staff_write ya se evalúa en cada request), pero la
-- LECTURA de citas_base/pacientes_base/inventario/consultas_base nunca
-- dependió del permiso de módulo, solo de optica_id — cualquier miembro del
-- staff podía leer esos datos sin importar sus `permisos`. Decisión de
-- Diego: unificar el criterio, con cuidado de no romper flujos que hoy
-- dependen de leer una tabla distinta a la de su propio permiso (ver abajo).
--
-- Deliberadamente NO se toca ventas_staff_select ni
-- facturas_venta_staff_select: App.jsx hidrata esas dos tablas para TODO el
-- staff sin filtrar por permiso (alimentan las KPIs de Reportes, que no es
-- soloAdmin — cualquier asistente lo ve por defecto). Gatearlas dejaría en
-- cero las cifras de Reportes para un asistente sin permisos operativos,
-- sin ningún aviso.

-- ─── citas_base: igual que su propio write (citas OR pacientes) ───
drop policy if exists citas_staff_select on public.citas_base;
create policy citas_staff_select on public.citas_base for select
  using (
    optica_id = (select perfiles.optica_id from perfiles where perfiles.id = auth.uid())
    and optica_activa_actual()
    and (tiene_permiso_modulo('citas') or tiene_permiso_modulo('pacientes'))
  );

-- ─── pacientes_base: más amplio que su propio write (que solo exige
-- 'pacientes' o 'consultas') porque citas_staff_write y
-- pacientes_citas_insert ya permiten a un asistente con SOLO 'citas'
-- agendar y crear pacientes desde ahí — sin este permiso extra, ese mismo
-- asistente dejaría de ver el nombre de sus propios pacientes en su
-- agenda. ───
drop policy if exists pacientes_staff_select on public.pacientes_base;
create policy pacientes_staff_select on public.pacientes_base for select
  using (
    optica_id = (select perfiles.optica_id from perfiles where perfiles.id = auth.uid())
    and optica_activa_actual()
    and (tiene_permiso_modulo('pacientes') or tiene_permiso_modulo('consultas') or tiene_permiso_modulo('citas'))
  );

-- ─── inventario: más amplio que su propio write (que solo exige
-- 'inventario' o 'consultas') porque facturas_venta_staff_write y
-- ventas_staff_write ya permiten a un asistente con SOLO 'pacientes'
-- crear una factura (FacturaVentaModal desde Pacientes.jsx, Punto 06) —
-- sin este permiso extra, ese mismo asistente dejaría de poder leer el
-- catálogo de productos para armar la factura. ───
drop policy if exists inventario_staff_select on public.inventario;
create policy inventario_staff_select on public.inventario for select
  using (
    optica_id = (select perfiles.optica_id from perfiles where perfiles.id = auth.uid())
    and optica_activa_actual()
    and (tiene_permiso_modulo('inventario') or tiene_permiso_modulo('consultas') or tiene_permiso_modulo('pacientes'))
  );

-- ─── consultas_base: igual que su propio write (consultas OR pacientes) ───
drop policy if exists consultas_staff_select on public.consultas_base;
create policy consultas_staff_select on public.consultas_base for select
  using (
    optica_id = (select perfiles.optica_id from perfiles where perfiles.id = auth.uid())
    and optica_activa_actual()
    and (tiene_permiso_modulo('consultas') or tiene_permiso_modulo('pacientes'))
  );
