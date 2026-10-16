-- 0118 · Lo que un rol no debe ver, el servidor no se lo entrega (regla 36 de docs/principios-diseno.md)
-- Decisión de Diego (16 oct. 2026): quien no tiene Ventas "ver" no recibe comprobantes, montos, pagos ni saldos; en el perfil de un paciente recibe
-- solo lo que ese paciente compró (producto y fecha). Antes, las políticas de lectura de los comprobantes también las abrían Pacientes, Fichas clínicas,
-- Inventario y Reportes "ver", así que un Optómetra sin el módulo Ventas igual podía pedir por la API todos los comprobantes de la óptica.
--
--   1. compras_de_paciente(paciente): función nueva. Devuelve [{ id, fecha, productos: [{ descripcion, cantidad }] }] de ESE paciente, sin montos,
--      pagos, saldos, números ni factura electrónica. La puede llamar quien tiene Pacientes "ver" o Ventas "ver" de la misma óptica (o el superadmin).
--   2. Las políticas de lectura de facturas_venta, facturas_venta_lineas, abonos_factura y ventas pasan a exigir Ventas "ver" (el administrador y el
--      superadmin siguen entrando por sus políticas de siempre). Reportes, Inventario y Pacientes ya no abren montos.
--
-- No cambia ninguna escritura ni ningún dato.

create or replace function public.compras_de_paciente(p_paciente_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_optica uuid;
  v_mia uuid;
begin
  if auth.uid() is null or not mfa_satisfecho() then
    return '[]'::jsonb;
  end if;
  select optica_id into v_optica from pacientes where id = p_paciente_id;
  select optica_id into v_mia from perfiles where id = auth.uid();
  if v_optica is null then
    return '[]'::jsonb;
  end if;
  if not es_superadmin() then
    if v_optica is distinct from v_mia or not optica_activa_actual() or not (tiene_permiso('pacientes', 'ver') or tiene_permiso('ventas', 'ver')) then
      return '[]'::jsonb;
    end if;
  end if;
  return coalesce((
    select jsonb_agg(x.compra order by x.fecha desc)
      from (
        select f.created_at as fecha,
               jsonb_build_object(
                 'id', f.id, 'fecha', f.created_at,
                 'productos', coalesce((select jsonb_agg(jsonb_build_object('descripcion', l.descripcion, 'cantidad', l.cantidad) order by l.created_at)
                                          from facturas_venta_lineas l where l.factura_id = f.id), '[]'::jsonb)
               ) as compra
          from facturas_venta f
         where f.paciente_id = p_paciente_id and f.optica_id = v_optica and f.estado <> 'anulada'
        union all
        select v.created_at,
               jsonb_build_object('id', v.id, 'fecha', v.created_at,
                                  'productos', jsonb_build_array(jsonb_build_object('descripcion', v.producto_nombre, 'cantidad', v.cantidad)))
          from ventas v
         where v.paciente_id = p_paciente_id and v.optica_id = v_optica
      ) x
  ), '[]'::jsonb);
end;
$$;
revoke all on function public.compras_de_paciente(uuid) from public, anon;
grant execute on function public.compras_de_paciente(uuid) to authenticated;

-- Lectura de comprobantes, líneas, abonos y ventas: solo con Ventas "ver" (misma óptica y óptica activa, como antes).
drop policy if exists facturas_venta_select on public.facturas_venta;
create policy facturas_venta_select on public.facturas_venta for select
  using (optica_id = (select p.optica_id from perfiles p where p.id = auth.uid()) and optica_activa_actual() and (select tiene_permiso('ventas', 'ver')));

drop policy if exists facturas_venta_lineas_select on public.facturas_venta_lineas;
create policy facturas_venta_lineas_select on public.facturas_venta_lineas for select
  using (exists (
    select 1 from facturas_venta f
     where f.id = facturas_venta_lineas.factura_id
       and f.optica_id = (select p.optica_id from perfiles p where p.id = auth.uid())
       and optica_activa_actual() and (select tiene_permiso('ventas', 'ver'))));

drop policy if exists abonos_factura_select on public.abonos_factura;
create policy abonos_factura_select on public.abonos_factura for select
  using (anulado_en is null
         and optica_id = (select p.optica_id from perfiles p where p.id = auth.uid())
         and optica_activa_actual() and (select tiene_permiso('ventas', 'ver')));

drop policy if exists ventas_select on public.ventas;
create policy ventas_select on public.ventas for select
  using (optica_id = (select p.optica_id from perfiles p where p.id = auth.uid()) and optica_activa_actual() and (select tiene_permiso('ventas', 'ver')));
