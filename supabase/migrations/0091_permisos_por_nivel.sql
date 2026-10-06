-- Bloque D, paso D3: la base hace cumplir los permisos POR NIVEL y corta todo
-- acceso de una cuenta desactivada.
--
-- Se aplica JUNTO con la 0090 (en la misma sesión): la 0090 define "tener un
-- módulo" como el nivel "ver"; sin esta migración, quien solo tiene "ver"
-- podría escribir y una cuenta desactivada seguiría leyendo algunas tablas.
--
-- Qué cambia (el acceso de las personas que ya existen NO cambia: la 0090 les
-- dio todos los niveles de los módulos que tenían):
--   * Cada tabla operativa tiene políticas separadas: ver (lectura), crear
--     (insert), editar (update) y eliminar (delete), cada una con su nivel.
--   * Las dependencias reales entre módulos se conservan (documentadas en la
--     0034): guardar una ficha actualiza el resumen del paciente, agendar una
--     cita puede crear al paciente, vender descuenta inventario.
--   * Vender y anular ventas pasan a funciones con sus propias comprobaciones
--     (módulo "ventas": crear / editar / eliminar). Así quien vende no necesita
--     poder editar el inventario a mano, y nadie puede fabricar facturas o
--     abonos escribiendo directo en las tablas.
--   * Citas y consultas no se borran (R17: se cancelan); solo el superadmin.
--   * Las tablas y buckets que leían sin comprobar la óptica activa o la cuenta
--     activa ahora lo comprueban, y varios que dejaban entrar a cualquier
--     miembro pasan a pedir el permiso de su módulo.
--   * anonimizar_paciente pide el permiso "eliminar" de Pacientes (el
--     administrador siempre lo tiene).

-- ════════════════════════════════════════════════════════════════
-- Ayudas
-- ════════════════════════════════════════════════════════════════
create or replace function public.perfil_activo_actual()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select activo from perfiles where id = auth.uid()), false);
$$;

create or replace function public.permisos_por_nivel_vigentes()
returns boolean
language sql
immutable
as $$
  select true;
$$;
grant execute on function public.permisos_por_nivel_vigentes() to authenticated;

-- La comprobación común de quien vende ahora pide un nivel del módulo "ventas".
-- Se reemplaza la versión sin parámetros (no queda una sobrecarga duplicada).
drop function public.optica_de_vendedor();
create function public.optica_de_vendedor(p_nivel text default 'ver')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_optica uuid;
begin
  select p.optica_id into v_optica
  from perfiles p
  where p.id = auth.uid() and p.rol in ('admin', 'asistente');
  if v_optica is null then
    raise exception 'No tienes acceso a esta óptica.';
  end if;
  if not optica_activa_actual() then
    raise exception 'La óptica está suspendida o tu cuenta está desactivada.';
  end if;
  if not mfa_satisfecho() then
    raise exception 'Verifica tu segundo factor para continuar.';
  end if;
  if not tiene_permiso('ventas', p_nivel) then
    raise exception 'No tienes permiso para esta acción de ventas.';
  end if;
  return v_optica;
end;
$$;
revoke all on function public.optica_de_vendedor(text) from public, anon, authenticated;

-- Cada función de ventas pide el nivel que le corresponde:
--   crear:  proforma, "No compró", reabrir, crear orden de laboratorio
--   editar: corregir/avanzar órdenes, avisar al paciente, abonos y cuotas
do $$
declare
  v_f record;
  v_def text;
  v_nuevo text;
  v_veces integer;
begin
  for v_f in
    select * from (values
      ('registrar_proforma', 'crear'), ('descartar_pase', 'crear'), ('reabrir_pase', 'crear'), ('crear_orden_laboratorio', 'crear'),
      ('actualizar_orden_laboratorio', 'editar'), ('cambiar_estado_orden', 'editar'), ('registrar_aviso_paciente', 'editar'),
      ('registrar_abono', 'editar'), ('registrar_pago_cuota_venta', 'editar')
    ) as t(nombre, nivel)
  loop
    select pg_get_functiondef(p.oid) into v_def from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = v_f.nombre;
    v_veces := (length(v_def) - length(replace(v_def, 'optica_de_vendedor()', ''))) / length('optica_de_vendedor()');
    if v_veces <> 1 then
      raise exception 'La función % debería llamar una vez a optica_de_vendedor() y lo hace % veces.', v_f.nombre, v_veces;
    end if;
    v_nuevo := replace(v_def, 'optica_de_vendedor()', format('optica_de_vendedor(%L)', v_f.nivel));
    execute v_nuevo;
  end loop;
end;
$$;

-- pasar_a_optica: lo hace quien termina una atención (crea consultas) o quien vende.
do $$
declare
  v_def text;
  v_viejo constant text := 'tiene_permiso_modulo(''inventario'') or tiene_permiso_modulo(''pacientes'') or tiene_permiso_modulo(''consultas'')';
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'pasar_a_optica';
  if (length(v_def) - length(replace(v_def, v_viejo, ''))) / length(v_viejo) <> 1 then
    raise exception 'pasar_a_optica no tiene la comprobación de permisos esperada.';
  end if;
  execute replace(v_def, v_viejo, 'tiene_permiso(''consultas'', ''crear'') or tiene_permiso(''ventas'', ''crear'')');
end;
$$;

-- anonimizar_paciente: el permiso "eliminar" de Pacientes (el administrador siempre lo tiene).
do $$
declare
  v_def text;
  v_viejo constant text := 'where p.id = auth.uid() and p.rol = ''admin'';';
  v_msg_viejo constant text := 'Solo el administrador puede eliminar pacientes.';
begin
  select pg_get_functiondef(p.oid) into v_def from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'anonimizar_paciente';
  if (length(v_def) - length(replace(v_def, v_viejo, ''))) / length(v_viejo) <> 1 then
    raise exception 'anonimizar_paciente no tiene la comprobación de permisos esperada.';
  end if;
  v_def := replace(v_def, v_viejo, 'where p.id = auth.uid() and p.rol in (''admin'', ''asistente'') and tiene_permiso(''pacientes'', ''eliminar'');');
  v_def := replace(v_def, v_msg_viejo, 'No tienes permiso para eliminar pacientes.');
  execute v_def;
end;
$$;

-- ════════════════════════════════════════════════════════════════
-- Vender y anular: funciones con sus propias comprobaciones
-- ════════════════════════════════════════════════════════════════
create or replace function public.crear_factura_venta(
  p_optica_id uuid,
  p_paciente_id uuid,
  p_metodo_pago text,
  p_lineas jsonb,
  p_cita_id uuid default null,
  p_consulta_id uuid default null,
  p_cuotas_totales integer default null,
  p_registrado_por uuid default null
) returns table (id uuid, monto_total numeric, estado text, created_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_optica uuid;
  v_linea jsonb;
  v_monto_total numeric := 0;
  v_estado text;
  v_factura_id uuid;
  v_created_at timestamptz;
  v_subtotal numeric;
  v_stock_restante integer;
begin
  -- El superadmin (soporte e impersonación) actúa sobre la óptica indicada; el resto, sobre la suya.
  if es_superadmin() then
    v_optica := p_optica_id;
  else
    v_optica := optica_de_vendedor('crear');
    if p_optica_id is distinct from v_optica then
      raise exception 'No tienes acceso a esta óptica.';
    end if;
  end if;
  if not exists (select 1 from pacientes_base pb where pb.id = p_paciente_id and pb.optica_id = v_optica and pb.anonimizado_en is null) then
    raise exception 'El paciente no existe.';
  end if;
  if p_cita_id is not null and not exists (select 1 from citas_base cb where cb.id = p_cita_id and cb.optica_id = v_optica) then
    raise exception 'La cita no existe.';
  end if;
  if p_consulta_id is not null and not exists (select 1 from consultas_base cs where cs.id = p_consulta_id and cs.optica_id = v_optica) then
    raise exception 'La consulta no existe.';
  end if;
  if jsonb_array_length(p_lineas) = 0 then
    raise exception 'Una factura necesita al menos una línea.';
  end if;

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    v_subtotal := (v_linea->>'cantidad')::integer * (v_linea->>'precio_unitario')::numeric;
    v_monto_total := v_monto_total + v_subtotal;
  end loop;

  v_estado := case when p_metodo_pago in ('cuotas', 'abonos') and v_monto_total > 0 then 'pendiente_pago' else 'pagada' end;

  insert into facturas_venta (
    optica_id, paciente_id, cita_id, consulta_id, metodo_pago,
    cuotas_totales, monto_total, estado, registrado_por
  ) values (
    v_optica, p_paciente_id, p_cita_id, p_consulta_id, p_metodo_pago,
    p_cuotas_totales, v_monto_total, v_estado, auth.uid()
  )
  returning facturas_venta.id, facturas_venta.created_at into v_factura_id, v_created_at;

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    v_subtotal := (v_linea->>'cantidad')::integer * (v_linea->>'precio_unitario')::numeric;

    if (v_linea->>'tipo') = 'producto' and (v_linea->>'producto_id') is not null then
      update inventario
         set stock = inventario.stock - (v_linea->>'cantidad')::integer
       where inventario.id = (v_linea->>'producto_id')::uuid
         and inventario.optica_id = v_optica
         and inventario.stock >= (v_linea->>'cantidad')::integer
      returning inventario.stock into v_stock_restante;

      if not found then
        raise exception 'No hay suficiente stock para "%".', (v_linea->>'descripcion');
      end if;
    end if;

    insert into facturas_venta_lineas (
      factura_id, producto_id, tipo, descripcion, cantidad, precio_unitario, subtotal
    ) values (
      v_factura_id,
      (v_linea->>'producto_id')::uuid,
      v_linea->>'tipo',
      v_linea->>'descripcion',
      (v_linea->>'cantidad')::integer,
      (v_linea->>'precio_unitario')::numeric,
      v_subtotal
    );
  end loop;

  return query select v_factura_id, v_monto_total, v_estado, v_created_at;
end;
$$;
revoke all on function public.crear_factura_venta(uuid, uuid, text, jsonb, uuid, uuid, integer, uuid) from public, anon;
grant execute on function public.crear_factura_venta(uuid, uuid, text, jsonb, uuid, uuid, integer, uuid) to authenticated;

create or replace function public.anular_factura_venta(
  p_factura_id uuid,
  p_motivo text,
  p_anulada_por uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_optica uuid;
  v_actualizado uuid;
  v_linea record;
begin
  if es_superadmin() then
    select f.optica_id into v_optica from facturas_venta f where f.id = p_factura_id;
  else
    v_optica := optica_de_vendedor('eliminar');
  end if;
  update facturas_venta
     set estado = 'anulada', anulada_motivo = p_motivo, anulada_at = now(), anulada_por = auth.uid()
   where facturas_venta.id = p_factura_id
     and facturas_venta.optica_id = v_optica
     and facturas_venta.estado != 'anulada'
  returning facturas_venta.id into v_actualizado;

  if v_actualizado is null then
    raise exception 'La factura no existe o ya estaba anulada.';
  end if;

  for v_linea in
    select producto_id, cantidad from facturas_venta_lineas
    where facturas_venta_lineas.factura_id = p_factura_id and facturas_venta_lineas.tipo = 'producto' and facturas_venta_lineas.producto_id is not null
  loop
    update inventario set stock = inventario.stock + v_linea.cantidad where inventario.id = v_linea.producto_id and inventario.optica_id = v_optica;
  end loop;
end;
$$;
revoke all on function public.anular_factura_venta(uuid, text, uuid) from public, anon;
grant execute on function public.anular_factura_venta(uuid, text, uuid) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- Políticas por nivel
-- (mi óptica = la de mi perfil; "puede(m, n)" = tiene_permiso(m, n), evaluado una vez por consulta)
-- ════════════════════════════════════════════════════════════════

-- ── pacientes ──
drop policy pacientes_staff_select on public.pacientes_base;
drop policy pacientes_staff_write on public.pacientes_base;
drop policy pacientes_citas_insert on public.pacientes_base;
create policy pacientes_select on public.pacientes_base for select
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and ((select tiene_permiso('pacientes', 'ver')) or (select tiene_permiso('consultas', 'ver')) or (select tiene_permiso('citas', 'ver')) or (select tiene_permiso('ventas', 'ver'))));
create policy pacientes_insert on public.pacientes_base for insert
  with check (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and ((select tiene_permiso('pacientes', 'crear')) or (select tiene_permiso('citas', 'crear'))));
-- guardar una ficha actualiza el resumen del paciente (evolución, corrección)
create policy pacientes_update on public.pacientes_base for update
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and ((select tiene_permiso('pacientes', 'editar')) or (select tiene_permiso('consultas', 'crear')) or (select tiene_permiso('consultas', 'editar'))))
  with check (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and ((select tiene_permiso('pacientes', 'editar')) or (select tiene_permiso('consultas', 'crear')) or (select tiene_permiso('consultas', 'editar'))));
create policy pacientes_delete on public.pacientes_base for delete
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and (select tiene_permiso('pacientes', 'eliminar')));

-- ── citas (no se borran: se cancelan) ──
drop policy citas_staff_select on public.citas_base;
drop policy citas_staff_write on public.citas_base;
create policy citas_select on public.citas_base for select
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and ((select tiene_permiso('citas', 'ver')) or (select tiene_permiso('pacientes', 'ver'))));
create policy citas_insert on public.citas_base for insert
  with check (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and ((select tiene_permiso('citas', 'crear')) or (select tiene_permiso('pacientes', 'crear'))));
create policy citas_update on public.citas_base for update
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and ((select tiene_permiso('citas', 'editar')) or (select tiene_permiso('pacientes', 'editar'))))
  with check (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and ((select tiene_permiso('citas', 'editar')) or (select tiene_permiso('pacientes', 'editar'))));

-- ── consultas (las fichas no se borran) ──
drop policy consultas_staff_select on public.consultas_base;
drop policy consultas_staff_write on public.consultas_base;
create policy consultas_select on public.consultas_base for select
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and ((select tiene_permiso('consultas', 'ver')) or (select tiene_permiso('pacientes', 'ver'))));
create policy consultas_insert on public.consultas_base for insert
  with check (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and (select tiene_permiso('consultas', 'crear')));
create policy consultas_update on public.consultas_base for update
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and (select tiene_permiso('consultas', 'editar')))
  with check (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and (select tiene_permiso('consultas', 'editar')));

-- ── inventario ──
drop policy inventario_staff_select on public.inventario;
drop policy inventario_staff_write on public.inventario;
create policy inventario_select on public.inventario for select
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and ((select tiene_permiso('inventario', 'ver')) or (select tiene_permiso('consultas', 'ver')) or (select tiene_permiso('pacientes', 'ver')) or (select tiene_permiso('ventas', 'ver'))));
create policy inventario_insert on public.inventario for insert
  with check (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and (select tiene_permiso('inventario', 'crear')));
create policy inventario_update on public.inventario for update
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and (select tiene_permiso('inventario', 'editar')))
  with check (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and (select tiene_permiso('inventario', 'editar')));
create policy inventario_delete on public.inventario for delete
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and (select tiene_permiso('inventario', 'eliminar')));

-- ── ventas (la tabla antigua de ventas sueltas) ──
drop policy ventas_staff_select on public.ventas;
drop policy ventas_staff_write on public.ventas;
create policy ventas_select on public.ventas for select
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and ((select tiene_permiso('ventas', 'ver')) or (select tiene_permiso('reportes', 'ver')) or (select tiene_permiso('pacientes', 'ver')) or (select tiene_permiso('inventario', 'ver'))));
create policy ventas_insert on public.ventas for insert
  with check (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and (select tiene_permiso('ventas', 'crear')));
create policy ventas_update on public.ventas for update
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and (select tiene_permiso('ventas', 'editar')))
  with check (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and (select tiene_permiso('ventas', 'editar')));
create policy ventas_delete on public.ventas for delete
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and (select tiene_permiso('ventas', 'eliminar')));

-- ── facturas de venta, líneas, abonos, pases y órdenes: solo lectura directa;
--    se escriben con las funciones (crear_factura_venta, registrar_abono, ...) ──
drop policy facturas_venta_staff_select on public.facturas_venta;
drop policy facturas_venta_staff_write on public.facturas_venta;
create policy facturas_venta_select on public.facturas_venta for select
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and ((select tiene_permiso('ventas', 'ver')) or (select tiene_permiso('reportes', 'ver')) or (select tiene_permiso('pacientes', 'ver'))
         or (select tiene_permiso('consultas', 'ver')) or (select tiene_permiso('inventario', 'ver'))));

drop policy facturas_venta_lineas_staff_select on public.facturas_venta_lineas;
drop policy facturas_venta_lineas_staff_write on public.facturas_venta_lineas;
create policy facturas_venta_lineas_select on public.facturas_venta_lineas for select
  using (exists (
    select 1 from public.facturas_venta f
    where f.id = facturas_venta_lineas.factura_id
      and f.optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid())
      and optica_activa_actual()
      and ((select tiene_permiso('ventas', 'ver')) or (select tiene_permiso('reportes', 'ver')) or (select tiene_permiso('pacientes', 'ver'))
           or (select tiene_permiso('consultas', 'ver')) or (select tiene_permiso('inventario', 'ver')))
  ));

drop policy abonos_factura_staff_select on public.abonos_factura;
create policy abonos_factura_select on public.abonos_factura for select
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and ((select tiene_permiso('ventas', 'ver')) or (select tiene_permiso('reportes', 'ver')) or (select tiene_permiso('pacientes', 'ver')) or (select tiene_permiso('consultas', 'ver'))));

drop policy pases_a_venta_staff_select on public.pases_a_venta;
create policy pases_a_venta_select on public.pases_a_venta for select
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and ((select tiene_permiso('ventas', 'ver')) or (select tiene_permiso('pacientes', 'ver')) or (select tiene_permiso('consultas', 'ver')) or (select tiene_permiso('reportes', 'ver'))));

drop policy ordenes_laboratorio_staff_select on public.ordenes_laboratorio;
create policy ordenes_laboratorio_select on public.ordenes_laboratorio for select
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and ((select tiene_permiso('ventas', 'ver')) or (select tiene_permiso('pacientes', 'ver')) or (select tiene_permiso('consultas', 'ver'))));

drop policy ordenes_laboratorio_historial_staff_select on public.ordenes_laboratorio_historial;
create policy ordenes_laboratorio_historial_select on public.ordenes_laboratorio_historial for select
  using (exists (
    select 1 from public.ordenes_laboratorio o
    where o.id = ordenes_laboratorio_historial.orden_id
      and o.optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid())
      and optica_activa_actual()
      and ((select tiene_permiso('ventas', 'ver')) or (select tiene_permiso('pacientes', 'ver')) or (select tiene_permiso('consultas', 'ver')))
  ));

-- ── CRM ──
drop policy avisos_staff_crm on public.avisos;
create policy avisos_select on public.avisos for select
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and (select tiene_permiso('crm', 'ver')));
create policy avisos_insert on public.avisos for insert
  with check (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and (select tiene_permiso('crm', 'crear')));
create policy avisos_update on public.avisos for update
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and (select tiene_permiso('crm', 'editar')))
  with check (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and (select tiene_permiso('crm', 'editar')));
create policy avisos_delete on public.avisos for delete
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and (select tiene_permiso('crm', 'eliminar')));

-- ── Horario de la óptica (la lectura pública del horario sigue: es la página de reservas) ──
drop policy disponibilidad_staff_write on public.disponibilidad;
create policy disponibilidad_insert on public.disponibilidad for insert
  with check (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and (select tiene_permiso('horario', 'editar')));
create policy disponibilidad_update on public.disponibilidad for update
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and (select tiene_permiso('horario', 'editar')))
  with check (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and (select tiene_permiso('horario', 'editar')));
create policy disponibilidad_delete on public.disponibilidad for delete
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and (select tiene_permiso('horario', 'editar')));

-- ── Lecturas que no comprobaban la cuenta o la óptica activa ──
drop policy respuestas_satisfaccion_admin_select on public.respuestas_satisfaccion;
create policy respuestas_satisfaccion_select on public.respuestas_satisfaccion for select
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and (select tiene_permiso('reportes', 'ver')));

drop policy notificaciones_staff_select on public.notificaciones_enviadas;
create policy notificaciones_select on public.notificaciones_enviadas for select
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and ((select tiene_permiso('crm', 'ver')) or (select tiene_permiso('citas', 'ver'))));

drop policy solicitudes_eliminacion_admin_select on public.solicitudes_eliminacion_paciente;
drop policy solicitudes_eliminacion_admin_update on public.solicitudes_eliminacion_paciente;
create policy solicitudes_eliminacion_select on public.solicitudes_eliminacion_paciente for select
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and (select tiene_permiso('pacientes', 'ver')));
create policy solicitudes_eliminacion_update on public.solicitudes_eliminacion_paciente for update
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and (select tiene_permiso('pacientes', 'editar')))
  with check (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and (select tiene_permiso('pacientes', 'editar')));

-- Actividad: la ve el administrador; cualquiera con cuenta activa registra la suya.
drop policy logs_optica_admin_select on public.logs_optica;
drop policy logs_optica_staff_insert on public.logs_optica;
create policy logs_optica_admin_select on public.logs_optica for select
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid())
    and (select perfiles.rol from public.perfiles where perfiles.id = auth.uid()) = 'admin'
    and perfil_activo_actual());
create policy logs_optica_staff_insert on public.logs_optica for insert
  with check (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid())
    and usuario_id = auth.uid() and perfil_activo_actual());

-- Mensajes con soporte: ver y escribir piden el permiso de Mensajes; los anuncios del sistema los ve toda cuenta activa.
drop policy mensajes_select_admin on public.mensajes;
drop policy mensajes_insert_admin on public.mensajes;
create policy mensajes_select on public.mensajes for select
  using ((tipo = 'anuncio' and optica_id is null and perfil_activo_actual())
    or (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
        and (select tiene_permiso('mensajes', 'ver'))));
create policy mensajes_insert on public.mensajes for insert
  with check (tipo = 'consulta' and remitente_id = auth.uid()
    and optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and optica_activa_actual()
    and (select tiene_permiso('mensajes', 'crear')));

-- La óptica: la ve toda cuenta activa (la pantalla necesita saber si está suspendida); la edita quien tiene Configuración.
drop policy opticas_select_own_admin on public.opticas;
drop policy opticas_update_own_admin on public.opticas;
create policy opticas_select_own on public.opticas for select
  using (id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and perfil_activo_actual());
create policy opticas_update_own on public.opticas for update
  using (id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and perfil_activo_actual()
    and (select tiene_permiso('configuracion', 'editar')))
  with check (id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and perfil_activo_actual()
    and (select tiene_permiso('configuracion', 'editar')));

-- Facturas del servicio de la óptica: solo el administrador, aunque la óptica esté suspendida (para poder pagar).
drop policy facturas_select_admin on public.facturas;
create policy facturas_select_admin on public.facturas for select
  using (optica_id = optica_id_admin_actual() and perfil_activo_actual());

-- Roles (0090): solo cuentas activas.
drop policy roles_equipo_select on public.roles;
create policy roles_equipo_select on public.roles for select
  using (optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid()) and perfil_activo_actual());
drop policy perfil_roles_select on public.perfil_roles;
create policy perfil_roles_select on public.perfil_roles for select
  using (perfil_activo_actual() and (
    perfil_id = auth.uid()
    or exists (select 1 from public.perfiles p where p.id = perfil_roles.perfil_id and p.optica_id = optica_id_admin_actual())
  ));

-- ── Archivos: adjuntos clínicos y fotos de productos ──
drop policy consultas_adjuntos_lectura_staff on storage.objects;
drop policy consultas_adjuntos_escritura_staff on storage.objects;
drop policy consultas_adjuntos_borrado_staff on storage.objects;
create policy consultas_adjuntos_lectura_staff on storage.objects for select
  using (bucket_id = 'consultas-adjuntos' and (es_superadmin() or (
    (storage.foldername(name))[1] = (select perfiles.optica_id::text from public.perfiles where perfiles.id = auth.uid())
    and optica_activa_actual() and (select tiene_permiso('consultas', 'ver')))));
create policy consultas_adjuntos_escritura_staff on storage.objects for insert
  with check (bucket_id = 'consultas-adjuntos' and (es_superadmin() or (
    (storage.foldername(name))[1] = (select perfiles.optica_id::text from public.perfiles where perfiles.id = auth.uid())
    and optica_activa_actual() and (select tiene_permiso('consultas', 'crear')))));
create policy consultas_adjuntos_borrado_staff on storage.objects for delete
  using (bucket_id = 'consultas-adjuntos' and (es_superadmin() or (
    (storage.foldername(name))[1] = (select perfiles.optica_id::text from public.perfiles where perfiles.id = auth.uid())
    and optica_activa_actual() and (select tiene_permiso('consultas', 'editar')))));

drop policy productos_escritura_staff_optica on storage.objects;
drop policy productos_actualizacion_staff_optica on storage.objects;
drop policy productos_borrado_staff_optica on storage.objects;
create policy productos_escritura_staff_optica on storage.objects for insert
  with check (bucket_id = 'productos' and (es_superadmin() or (
    (storage.foldername(name))[1] = (select perfiles.optica_id::text from public.perfiles where perfiles.id = auth.uid())
    and optica_activa_actual() and (select tiene_permiso('inventario', 'crear')))));
create policy productos_actualizacion_staff_optica on storage.objects for update
  using (bucket_id = 'productos' and (es_superadmin() or (
    (storage.foldername(name))[1] = (select perfiles.optica_id::text from public.perfiles where perfiles.id = auth.uid())
    and optica_activa_actual() and (select tiene_permiso('inventario', 'editar')))));
create policy productos_borrado_staff_optica on storage.objects for delete
  using (bucket_id = 'productos' and (es_superadmin() or (
    (storage.foldername(name))[1] = (select perfiles.optica_id::text from public.perfiles where perfiles.id = auth.uid())
    and optica_activa_actual() and (select tiene_permiso('inventario', 'eliminar')))));
