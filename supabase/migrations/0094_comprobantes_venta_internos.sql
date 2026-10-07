-- Bloque E (R57-R59 y ajuste 6.2 de vision-sistema.md): comprobantes de venta internos y lunas como texto.
-- NO APLICADA TODAVÍA — Diego debe aprobar este SQL antes de correrlo con
-- node scripts/_run-migration.mjs. Backup previo: ~/backups-optica/pre-bloque-e-2026-10-06.dump
-- (pg_dump -Fc del esquema public, hecho el 2026-10-06 antes de proponer esto).
--
-- Qué hace:
--   1. Cada comprobante de venta (tabla facturas_venta, que NO se renombra) recibe un número
--      correlativo interno por óptica ("CV-0001"). Hoy no tiene ninguno, y la orden de laboratorio
--      lo necesita (R36): su impresión lee `facturaNumero`, un dato que nadie llena.
--   2. Campo opcional `factura_electronica`: el número de la factura electrónica que la óptica
--      emitió por fuera (SRI o proveedor). Única por óptica entre las ventas no anuladas.
--   3. Las lunas dejan de ser productos de inventario: pasan a ser una línea de tipo 'luna'
--      (texto + precio, sin producto_id, sin stock) con un `detalle` jsonb opcional (tipo,
--      material, tratamientos) que precarga la orden de laboratorio y alimenta reportes.
--   4. crear_factura_venta cambia de firma (parámetro nuevo, columna nueva en el resultado): se
--      hace `drop function` de la anterior ANTES de crear la nueva (gotcha de la sobrecarga
--      silenciosa) y el único llamador, FacturaVentaModal.jsx, se actualiza en el mismo bloque.
--   5. registrar_factura_electronica: para cargar o corregir ese número después de la venta (la
--      factura electrónica suele emitirse más tarde). Exige nivel 'editar' de Ventas.
--   6. anular_factura_venta: solo cambia el texto del mensaje de error ("comprobante", no "factura").
--
-- Lo que NO toca: ninguna fila de inventario, ninguna línea ni venta existente (salvo darles su
-- número correlativo), ningún dato clínico. El historial de ventas conserva su descripción y
-- precio tal cual. Los nombres técnicos (facturas_venta, crear_factura_venta, abonos_factura)
-- se mantienen: renombrarlos obligaría a recrear políticas, triggers y RPC sin beneficio visible.

-- ════════════════════════════════════════════════════════════════
-- 1. Correlativo interno por óptica
-- ════════════════════════════════════════════════════════════════
create table public.contador_comprobantes_venta (
  optica_id uuid primary key references public.opticas(id) on delete cascade,
  ultimo_numero integer not null default 0
);
alter table public.contador_comprobantes_venta enable row level security;
-- Sin políticas para usuarios: solo las funciones security definer lo tocan (igual que
-- contador_ordenes_laboratorio, 0087).

alter table public.facturas_venta
  add column numero integer,
  add column factura_electronica text;

-- Las ventas existentes se numeran por antigüedad dentro de su óptica. Este UPDATE solo toca
-- `numero`: los triggers de facturas_venta se disparan con "UPDATE OF estado", no con este.
with ordenadas as (
  select id, row_number() over (partition by optica_id order by created_at, id) as n
  from public.facturas_venta
)
update public.facturas_venta f
   set numero = ordenadas.n
  from ordenadas
 where ordenadas.id = f.id;

insert into public.contador_comprobantes_venta (optica_id, ultimo_numero)
select optica_id, max(numero) from public.facturas_venta group by optica_id;

alter table public.facturas_venta alter column numero set not null;
create unique index facturas_venta_numero_unico on public.facturas_venta (optica_id, numero);

-- ════════════════════════════════════════════════════════════════
-- 2. Número de la factura electrónica emitida por fuera (opcional)
-- ════════════════════════════════════════════════════════════════
alter table public.facturas_venta
  add constraint facturas_venta_factura_electronica_valida
  check (factura_electronica is null
         or (factura_electronica = btrim(factura_electronica) and char_length(factura_electronica) between 1 and 60));

-- Un mismo número no puede estar en dos ventas vigentes de la óptica; al anular una venta, su
-- número queda libre para la venta que la reemplace.
create unique index facturas_venta_factura_electronica_unica
  on public.facturas_venta (optica_id, factura_electronica)
  where factura_electronica is not null and estado <> 'anulada';

-- ════════════════════════════════════════════════════════════════
-- 3. Líneas de tipo 'luna' (texto + precio, sin stock)
-- ════════════════════════════════════════════════════════════════
alter table public.facturas_venta_lineas drop constraint facturas_venta_lineas_tipo_check;
alter table public.facturas_venta_lineas
  add constraint facturas_venta_lineas_tipo_check check (tipo in ('producto', 'servicio', 'luna'));
alter table public.facturas_venta_lineas add column detalle jsonb;
alter table public.facturas_venta_lineas
  add constraint facturas_venta_lineas_detalle_objeto check (detalle is null or jsonb_typeof(detalle) = 'object');

-- ════════════════════════════════════════════════════════════════
-- 4. crear_factura_venta: número correlativo, factura electrónica y líneas 'luna'
--    (firma nueva → se elimina la anterior; ver gotcha de sobrecarga silenciosa)
-- ════════════════════════════════════════════════════════════════
drop function public.crear_factura_venta(uuid, uuid, text, jsonb, uuid, uuid, integer, uuid);

create function public.crear_factura_venta(
  p_optica_id uuid,
  p_paciente_id uuid,
  p_metodo_pago text,
  p_lineas jsonb,
  p_cita_id uuid default null,
  p_consulta_id uuid default null,
  p_cuotas_totales integer default null,
  p_registrado_por uuid default null,
  p_factura_electronica text default null
) returns table (id uuid, numero integer, monto_total numeric, estado text, created_at timestamptz)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid;
  v_linea jsonb;
  v_tipo text;
  v_monto_total numeric := 0;
  v_estado text;
  v_factura_id uuid;
  v_numero integer;
  v_created_at timestamptz;
  v_subtotal numeric;
  v_stock_restante integer;
  v_electronica text := nullif(btrim(p_factura_electronica), '');
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
    raise exception 'Un comprobante necesita al menos una línea.';
  end if;
  if v_electronica is not null and char_length(v_electronica) > 60 then
    raise exception 'El número de la factura electrónica es demasiado largo.';
  end if;

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    v_tipo := v_linea->>'tipo';
    if v_tipo is null or v_tipo not in ('producto', 'servicio', 'luna') then
      raise exception 'Tipo de línea no válido.';
    end if;
    if v_linea->'detalle' is not null and jsonb_typeof(v_linea->'detalle') not in ('object', 'null') then
      raise exception 'El detalle de la línea no es válido.';
    end if;
    v_subtotal := (v_linea->>'cantidad')::integer * (v_linea->>'precio_unitario')::numeric;
    v_monto_total := v_monto_total + v_subtotal;
  end loop;

  v_estado := case when p_metodo_pago in ('cuotas', 'abonos') and v_monto_total > 0 then 'pendiente_pago' else 'pagada' end;

  -- Siguiente número de esta óptica (la fila del contador queda bloqueada hasta el commit).
  insert into contador_comprobantes_venta (optica_id, ultimo_numero)
  values (v_optica, 1)
  on conflict (optica_id) do update set ultimo_numero = contador_comprobantes_venta.ultimo_numero + 1
  returning contador_comprobantes_venta.ultimo_numero into v_numero;

  begin
    insert into facturas_venta (
      optica_id, paciente_id, cita_id, consulta_id, metodo_pago,
      cuotas_totales, monto_total, estado, registrado_por, numero, factura_electronica
    ) values (
      v_optica, p_paciente_id, p_cita_id, p_consulta_id, p_metodo_pago,
      p_cuotas_totales, v_monto_total, v_estado, auth.uid(), v_numero, v_electronica
    )
    returning facturas_venta.id, facturas_venta.created_at into v_factura_id, v_created_at;
  exception when unique_violation then
    raise exception 'Ese número de factura electrónica ya está registrado en otra venta.';
  end;

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    v_tipo := v_linea->>'tipo';
    v_subtotal := (v_linea->>'cantidad')::integer * (v_linea->>'precio_unitario')::numeric;

    -- Solo las líneas de producto (monturas y accesorios) descuentan inventario.
    if v_tipo = 'producto' and (v_linea->>'producto_id') is not null then
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
      factura_id, producto_id, tipo, descripcion, cantidad, precio_unitario, subtotal, detalle
    ) values (
      v_factura_id,
      case when v_tipo = 'producto' then (v_linea->>'producto_id')::uuid else null end,
      v_tipo,
      v_linea->>'descripcion',
      (v_linea->>'cantidad')::integer,
      (v_linea->>'precio_unitario')::numeric,
      v_subtotal,
      case when v_tipo = 'luna' and jsonb_typeof(v_linea->'detalle') = 'object' then v_linea->'detalle' else null end
    );
  end loop;

  return query select v_factura_id, v_numero, v_monto_total, v_estado, v_created_at;
end;
$function$;

revoke all on function public.crear_factura_venta(uuid, uuid, text, jsonb, uuid, uuid, integer, uuid, text) from public, anon;
grant execute on function public.crear_factura_venta(uuid, uuid, text, jsonb, uuid, uuid, integer, uuid, text) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- 5. Cargar o corregir el número de la factura electrónica después de la venta
-- ════════════════════════════════════════════════════════════════
create function public.registrar_factura_electronica(p_factura_id uuid, p_numero text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid;
  v_numero text := nullif(btrim(p_numero), '');
  v_actualizado uuid;
begin
  if es_superadmin() then
    select f.optica_id into v_optica from facturas_venta f where f.id = p_factura_id;
  else
    v_optica := optica_de_vendedor('editar');
  end if;
  if v_numero is not null and char_length(v_numero) > 60 then
    raise exception 'El número de la factura electrónica es demasiado largo.';
  end if;

  begin
    update facturas_venta
       set factura_electronica = v_numero
     where facturas_venta.id = p_factura_id
       and facturas_venta.optica_id = v_optica
       and facturas_venta.estado <> 'anulada'
    returning facturas_venta.id into v_actualizado;
  exception when unique_violation then
    raise exception 'Ese número de factura electrónica ya está registrado en otra venta.';
  end;

  if v_actualizado is null then
    raise exception 'La venta no existe o está anulada.';
  end if;
end;
$function$;

revoke all on function public.registrar_factura_electronica(uuid, text) from public, anon;
grant execute on function public.registrar_factura_electronica(uuid, text) to authenticated;

-- ════════════════════════════════════════════════════════════════
-- 6. anular_factura_venta: igual que antes, solo cambia el texto del error
--    (misma firma: create or replace es seguro, no crea sobrecarga)
-- ════════════════════════════════════════════════════════════════
create or replace function public.anular_factura_venta(p_factura_id uuid, p_motivo text, p_anulada_por uuid default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
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
    raise exception 'El comprobante no existe o ya estaba anulado.';
  end if;

  for v_linea in
    select producto_id, cantidad from facturas_venta_lineas
    where facturas_venta_lineas.factura_id = p_factura_id and facturas_venta_lineas.tipo = 'producto' and facturas_venta_lineas.producto_id is not null
  loop
    update inventario set stock = inventario.stock + v_linea.cantidad where inventario.id = v_linea.producto_id and inventario.optica_id = v_optica;
  end loop;
end;
$function$;

-- ════════════════════════════════════════════════════════════════
-- 7. Productos "luna" que hoy están en inventario — DECISIÓN DE DIEGO, no se ejecuta sola.
--    Son 2 y ninguno tiene historial (0 líneas de venta, 0 ventas viejas, 0 consultas):
--      f19f6e79-3243-4dd6-b510-8061b29d010e  Óptica Solna Vision  "Lente Monofocal Antirreflejo QA"  (prueba de QA)
--      a7c05044-1db4-450c-b47d-1f9d8ec5bc6a  Optica Karla V       "Lentes"                           ($20, stock 10)
--    "Descontinuar" (activo = false) ya existe desde 0081: el producto sale de las listas y de los
--    buscadores pero la fila se conserva. Se propone solo el de QA; el de Karla V pertenece a otra
--    óptica y lo decide su administrador desde Inventario → Descontinuar.
-- update public.inventario set activo = false where id = 'f19f6e79-3243-4dd6-b510-8061b29d010e';
