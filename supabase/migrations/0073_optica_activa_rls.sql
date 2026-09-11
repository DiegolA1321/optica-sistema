-- Hallazgo real 2026-09-10: suspender una óptica (opticas.activa = false)
-- solo bloqueaba logins NUEVOS (Login.jsx) — una sesión que ya estaba
-- abierta en el momento de la suspensión seguía teniendo acceso normal a
-- pacientes/citas/inventario/etc. indefinidamente, porque ninguna política
-- RLS de esas tablas miraba `opticas.activa`, solo `optica_id`. Decisión de
-- Diego: agregar esa verificación a las tablas que el staff usa día a día,
-- para que una sesión ya abierta pierda acceso real (no solo visual) en el
-- momento en que el superadmin suspende, sin esperar al próximo login.
--
-- optica_activa_actual(): mismo patrón que ya usan es_superadmin() y
-- optica_id_admin_actual() — STABLE SECURITY DEFINER, consulta `perfiles`
-- desde adentro sin recursión (la función corre con permisos propios,
-- saltándose RLS en su propia consulta interna; es el mismo mecanismo que
-- ya resolvió la recursión infinita de `perfiles`, migración 0017).
-- "Fail closed" igual que tiene_permiso_modulo: si no encuentra perfil u
-- óptica, devuelve false en vez de asumir que sí está activa.
create or replace function public.optica_activa_actual()
returns boolean
language sql
stable security definer
set search_path to 'public'
as $$
  select coalesce(
    (select o.activa from perfiles p join opticas o on o.id = p.optica_id where p.id = auth.uid()),
    false
  );
$$;

-- Deliberadamente SIN tocar: perfiles_select_self / perfiles_update_self
-- (la app necesita poder seguir leyendo "quién soy" para mostrar el aviso
-- de suspensión) y opticas_select_own_admin (necesita poder seguir leyendo
-- el estado de SU PROPIA óptica para detectar la suspensión en primer
-- lugar). Tampoco se toca disponibilidad_select_publico (agendamiento
-- público, ya cubierto por la vista opticas_publicas + las RPCs públicas).

-- ─── perfiles: el admin viendo/gestionando sus asistentes ───
drop policy if exists perfiles_admin_gestiona_asistentes on public.perfiles;
create policy perfiles_admin_gestiona_asistentes on public.perfiles for all
  using (rol = 'asistente' and optica_id = optica_id_admin_actual() and optica_activa_actual())
  with check (rol = 'asistente' and optica_id = optica_id_admin_actual() and optica_activa_actual());

-- ─── citas_base ───
drop policy if exists citas_staff_select on public.citas_base;
create policy citas_staff_select on public.citas_base for select
  using (optica_id = (select perfiles.optica_id from perfiles where perfiles.id = auth.uid()) and optica_activa_actual());

drop policy if exists citas_staff_write on public.citas_base;
create policy citas_staff_write on public.citas_base for all
  using (optica_id = (select perfiles.optica_id from perfiles where perfiles.id = auth.uid()) and (tiene_permiso_modulo('citas') or tiene_permiso_modulo('pacientes')) and optica_activa_actual())
  with check (optica_id = (select perfiles.optica_id from perfiles where perfiles.id = auth.uid()) and (tiene_permiso_modulo('citas') or tiene_permiso_modulo('pacientes')) and optica_activa_actual());

-- ─── pacientes_base ───
drop policy if exists pacientes_staff_select on public.pacientes_base;
create policy pacientes_staff_select on public.pacientes_base for select
  using (optica_id = (select perfiles.optica_id from perfiles where perfiles.id = auth.uid()) and optica_activa_actual());

drop policy if exists pacientes_staff_write on public.pacientes_base;
create policy pacientes_staff_write on public.pacientes_base for all
  using (optica_id = (select perfiles.optica_id from perfiles where perfiles.id = auth.uid()) and (tiene_permiso_modulo('pacientes') or tiene_permiso_modulo('consultas')) and optica_activa_actual())
  with check (optica_id = (select perfiles.optica_id from perfiles where perfiles.id = auth.uid()) and (tiene_permiso_modulo('pacientes') or tiene_permiso_modulo('consultas')) and optica_activa_actual());

drop policy if exists pacientes_citas_insert on public.pacientes_base;
create policy pacientes_citas_insert on public.pacientes_base for insert
  with check (optica_id = (select perfiles.optica_id from perfiles where perfiles.id = auth.uid()) and tiene_permiso_modulo('citas') and optica_activa_actual());

-- ─── inventario ───
drop policy if exists inventario_staff_select on public.inventario;
create policy inventario_staff_select on public.inventario for select
  using (optica_id = (select perfiles.optica_id from perfiles where perfiles.id = auth.uid()) and optica_activa_actual());

drop policy if exists inventario_staff_write on public.inventario;
create policy inventario_staff_write on public.inventario for all
  using (optica_id = (select perfiles.optica_id from perfiles where perfiles.id = auth.uid()) and (tiene_permiso_modulo('inventario') or tiene_permiso_modulo('consultas')) and optica_activa_actual())
  with check (optica_id = (select perfiles.optica_id from perfiles where perfiles.id = auth.uid()) and (tiene_permiso_modulo('inventario') or tiene_permiso_modulo('consultas')) and optica_activa_actual());

-- ─── consultas_base ───
drop policy if exists consultas_staff_select on public.consultas_base;
create policy consultas_staff_select on public.consultas_base for select
  using (optica_id = (select perfiles.optica_id from perfiles where perfiles.id = auth.uid()) and optica_activa_actual());

drop policy if exists consultas_staff_write on public.consultas_base;
create policy consultas_staff_write on public.consultas_base for all
  using (optica_id = (select perfiles.optica_id from perfiles where perfiles.id = auth.uid()) and (tiene_permiso_modulo('consultas') or tiene_permiso_modulo('pacientes')) and optica_activa_actual())
  with check (optica_id = (select perfiles.optica_id from perfiles where perfiles.id = auth.uid()) and (tiene_permiso_modulo('consultas') or tiene_permiso_modulo('pacientes')) and optica_activa_actual());

-- ─── ventas ───
drop policy if exists ventas_staff_select on public.ventas;
create policy ventas_staff_select on public.ventas for select
  using (optica_id = (select perfiles.optica_id from perfiles where perfiles.id = auth.uid()) and optica_activa_actual());

drop policy if exists ventas_staff_write on public.ventas;
create policy ventas_staff_write on public.ventas for all
  using (optica_id = (select perfiles.optica_id from perfiles where perfiles.id = auth.uid()) and (tiene_permiso_modulo('inventario') or tiene_permiso_modulo('pacientes') or tiene_permiso_modulo('consultas')) and optica_activa_actual())
  with check (optica_id = (select perfiles.optica_id from perfiles where perfiles.id = auth.uid()) and (tiene_permiso_modulo('inventario') or tiene_permiso_modulo('pacientes') or tiene_permiso_modulo('consultas')) and optica_activa_actual());

-- ─── facturas_venta (facturas_venta_lineas queda protegida en cascada: su
-- propia política hace un EXISTS contra facturas_venta, que ya queda
-- sujeto a esta RLS) ───
drop policy if exists facturas_venta_staff_select on public.facturas_venta;
create policy facturas_venta_staff_select on public.facturas_venta for select
  using (optica_id = (select perfiles.optica_id from perfiles where perfiles.id = auth.uid()) and optica_activa_actual());

drop policy if exists facturas_venta_staff_write on public.facturas_venta;
create policy facturas_venta_staff_write on public.facturas_venta for all
  using (optica_id = (select perfiles.optica_id from perfiles where perfiles.id = auth.uid()) and (tiene_permiso_modulo('inventario') or tiene_permiso_modulo('pacientes') or tiene_permiso_modulo('consultas')) and optica_activa_actual())
  with check (optica_id = (select perfiles.optica_id from perfiles where perfiles.id = auth.uid()) and (tiene_permiso_modulo('inventario') or tiene_permiso_modulo('pacientes') or tiene_permiso_modulo('consultas')) and optica_activa_actual());

-- ─── horarios_usuario ("Mi horario") ───
drop policy if exists horarios_usuario_propio on public.horarios_usuario;
create policy horarios_usuario_propio on public.horarios_usuario for all
  using (usuario_id = auth.uid() and optica_id = (select perfiles.optica_id from perfiles where perfiles.id = auth.uid()) and optica_activa_actual())
  with check (usuario_id = auth.uid() and optica_id = (select perfiles.optica_id from perfiles where perfiles.id = auth.uid()) and optica_activa_actual());

-- ─── mensajes: el filtro de activa solo aplica a los mensajes DE SU
-- óptica — un anuncio global del superadmin (optica_id is null) debe
-- seguir llegando aunque estén suspendidos, es justo el tipo de aviso que
-- más importa en ese momento. ───
drop policy if exists mensajes_select_admin on public.mensajes;
create policy mensajes_select_admin on public.mensajes for select
  using (
    (tipo = 'anuncio' and optica_id is null)
    or (optica_id = (select perfiles.optica_id from perfiles where perfiles.id = auth.uid()) and optica_activa_actual())
  );

drop policy if exists mensajes_insert_admin on public.mensajes;
create policy mensajes_insert_admin on public.mensajes for insert
  with check (tipo = 'consulta' and remitente_id = auth.uid() and optica_id = (select perfiles.optica_id from perfiles where perfiles.id = auth.uid()) and optica_activa_actual());

-- ─── avisos (CRM) ───
drop policy if exists avisos_staff_crm on public.avisos;
create policy avisos_staff_crm on public.avisos for all
  using (optica_id = (select perfiles.optica_id from perfiles where perfiles.id = auth.uid()) and tiene_permiso_modulo('crm') and optica_activa_actual())
  with check (optica_id = (select perfiles.optica_id from perfiles where perfiles.id = auth.uid()) and tiene_permiso_modulo('crm') and optica_activa_actual());
