-- 0131 · Pagar por transferencia desde el portal (con comprobante) y verificarlo en Ventas
-- Pedido de Diego (18 oct. 2026, ronda 8, punto 8). El pago con tarjeta en línea queda como trabajo futuro (hace falta un proveedor de pagos).
--
-- Cómo funciona:
--   1. El administrador escribe los datos bancarios de la óptica en Configuración (opticas.datos_bancarios).
--   2. El paciente, en el detalle de su saldo, ve esos datos, hace la transferencia por su banco y sube la foto o el PDF del comprobante con el monto: reportar_pago_transferencia().
--      Queda «Por verificar» (nada cambia todavía en lo que debe).
--   3. Ventas lo ve en «Cobros y saldos» («Pago por verificar») y el Inicio lo cuenta en «Requiere tu atención». Quien tiene permiso de editar Ventas abre el comprobante
--      (archivo_pago_transferencia) y lo CONFIRMA —se registra como un abono con el método «Transferencia», con las mismas reglas de siempre (registrar_abono)— o lo RECHAZA con un motivo.
--   4. El paciente ve «Pago en verificación» y después «Pago confirmado» o el motivo del rechazo.
--
-- Decisiones:
--   * El archivo se guarda en la base (base64, hasta ~2 MB: la pantalla reduce las fotos antes de enviarlas), en una tabla aparte para que las listas no lo arrastren, y solo sale por
--     archivo_pago_transferencia() a quien puede ver Ventas. El paciente no tiene sesión de Supabase (su sesión es un token), así que no puede subir a Storage directamente;
--     con esto no hace falta una función de servidor nueva.
--   * Los datos bancarios solo salen por datos_transferencia_paciente() con la sesión del paciente: no están en nada público.
--   * Nadie escribe en las tablas directamente: solo por estas funciones.

-- ═══════════════════════════════════════════════════════
-- 1. Datos bancarios de la óptica
-- ═══════════════════════════════════════════════════════
-- {"banco": "...", "tipo_cuenta": "...", "numero": "...", "titular": "...", "documento": "...", "correo": "...", "instrucciones": "..."}
alter table public.opticas add column datos_bancarios jsonb;

-- ═══════════════════════════════════════════════════════
-- 2. Los pagos reportados
-- ═══════════════════════════════════════════════════════
create table public.pagos_transferencia (
  id uuid primary key default gen_random_uuid(),
  optica_id uuid not null references public.opticas(id) on delete cascade,
  paciente_id uuid not null references public.pacientes_base(id) on delete cascade,
  factura_id uuid not null references public.facturas_venta(id) on delete cascade,
  monto numeric(10, 2) not null check (monto > 0 and monto <= 100000),
  estado text not null default 'por_verificar' check (estado in ('por_verificar', 'confirmado', 'rechazado')),
  motivo_rechazo text check (motivo_rechazo is null or length(motivo_rechazo) between 3 and 300),
  archivo_nombre text not null check (length(archivo_nombre) between 1 and 120),
  archivo_tipo text not null check (archivo_tipo in ('image/jpeg', 'image/png', 'application/pdf')),
  creado_en timestamptz not null default now(),
  revisado_por uuid references public.perfiles(id) on delete set null,
  revisado_en timestamptz,
  abono_id uuid references public.abonos_factura(id) on delete set null,
  constraint pagos_transferencia_rechazo_con_motivo check (estado <> 'rechazado' or motivo_rechazo is not null)
);
create index pagos_transferencia_cola_idx on public.pagos_transferencia (optica_id, estado, creado_en desc);
create index pagos_transferencia_paciente_idx on public.pagos_transferencia (paciente_id, creado_en desc);

create table public.pagos_transferencia_archivos (
  pago_id uuid primary key references public.pagos_transferencia(id) on delete cascade,
  contenido_base64 text not null check (length(contenido_base64) between 100 and 3000000)
);

alter table public.pagos_transferencia enable row level security;
alter table public.pagos_transferencia_archivos enable row level security;

create policy pagos_transferencia_staff_select on public.pagos_transferencia for select
  using (
    optica_id = (select perfiles.optica_id from public.perfiles where perfiles.id = auth.uid())
    and optica_activa_actual()
    and tiene_permiso('ventas', 'ver')
  );
create policy pagos_transferencia_superadmin_all on public.pagos_transferencia for all using (es_superadmin()) with check (es_superadmin());
create policy exige_aal2_si_mfa_activo on public.pagos_transferencia as restrictive for all using (mfa_satisfecho()) with check (mfa_satisfecho());
-- El archivo no tiene política de lectura para nadie más que el superadmin: sale solo por archivo_pago_transferencia().
create policy pagos_transferencia_archivos_superadmin_all on public.pagos_transferencia_archivos for all using (es_superadmin()) with check (es_superadmin());

-- ═══════════════════════════════════════════════════════
-- 3. El paciente: ver los datos para transferir y reportar su pago
-- ═══════════════════════════════════════════════════════
-- { datos_bancarios: {...} | null, pagos: [{ id, factura_id, monto, estado, motivo_rechazo, creado_en, revisado_en }] }; null si la sesión no es válida.
create or replace function public.datos_transferencia_paciente(p_paciente_id uuid, p_token text default null)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select case when sesion_paciente_valida(p_paciente_id, p_token) then jsonb_build_object(
    'datos_bancarios', (select o.datos_bancarios from opticas o join pacientes_base p on p.optica_id = o.id where p.id = p_paciente_id),
    'pagos', coalesce((
      select jsonb_agg(jsonb_build_object('id', t.id, 'factura_id', t.factura_id, 'monto', t.monto, 'estado', t.estado, 'motivo_rechazo', t.motivo_rechazo, 'creado_en', t.creado_en, 'revisado_en', t.revisado_en) order by t.creado_en desc)
      from (select * from pagos_transferencia where paciente_id = p_paciente_id order by creado_en desc limit 30) t
    ), '[]'::jsonb)
  ) end;
$function$;
revoke all on function public.datos_transferencia_paciente(uuid, text) from public;
grant execute on function public.datos_transferencia_paciente(uuid, text) to anon, authenticated;

create or replace function public.reportar_pago_transferencia(
  p_paciente_id uuid, p_token text, p_factura_id uuid, p_monto numeric, p_archivo_nombre text, p_archivo_tipo text, p_archivo_base64 text
) returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid;
  v_factura record;
  v_pagado numeric;
  v_saldo numeric;
  v_pendiente numeric;
  v_monto numeric := round(coalesce(p_monto, 0), 2);
  v_id uuid;
begin
  if not sesion_paciente_valida(p_paciente_id, p_token) then
    raise exception 'Tu sesión venció. Vuelve a iniciar sesión.';
  end if;
  select p.optica_id into v_optica from pacientes_base p where p.id = p_paciente_id and p.anonimizado_en is null;
  if v_optica is null then raise exception 'No encontramos tu ficha.'; end if;
  if (select o.datos_bancarios from opticas o where o.id = v_optica) is null then
    raise exception 'La óptica todavía no recibe pagos por transferencia.';
  end if;
  if v_monto <= 0 then raise exception 'Indica el monto que transferiste.'; end if;
  if p_archivo_tipo is null or p_archivo_tipo not in ('image/jpeg', 'image/png', 'application/pdf') then
    raise exception 'El comprobante debe ser una foto (JPG o PNG) o un PDF.';
  end if;
  if p_archivo_base64 is null or length(p_archivo_base64) < 100 or length(p_archivo_base64) > 3000000 then
    raise exception 'El comprobante es demasiado grande (máximo 2 MB) o está vacío.';
  end if;
  if p_archivo_nombre is null or length(btrim(p_archivo_nombre)) = 0 then raise exception 'El comprobante no tiene nombre.'; end if;

  select f.id, f.estado, f.monto_total into v_factura from facturas_venta f where f.id = p_factura_id and f.paciente_id = p_paciente_id and f.optica_id = v_optica for update;
  if not found then raise exception 'No encontramos esa compra.'; end if;
  if v_factura.estado <> 'pendiente_pago' then raise exception 'Esa compra no tiene saldo por pagar.'; end if;
  select coalesce(sum(a.monto), 0) into v_pagado from abonos_factura a where a.factura_id = p_factura_id and a.anulado_en is null;
  v_saldo := v_factura.monto_total - v_pagado;
  select coalesce(sum(t.monto), 0) into v_pendiente from pagos_transferencia t where t.factura_id = p_factura_id and t.estado = 'por_verificar';
  if v_monto + v_pendiente > v_saldo then
    raise exception 'El monto supera lo que debes ($%).', to_char(greatest(v_saldo - v_pendiente, 0), 'FM999990.00');
  end if;
  if (select count(*) from pagos_transferencia t where t.paciente_id = p_paciente_id and t.estado = 'por_verificar') >= 3 then
    raise exception 'Ya tienes tres pagos en verificación. Espera a que la óptica los revise.';
  end if;

  insert into pagos_transferencia (optica_id, paciente_id, factura_id, monto, archivo_nombre, archivo_tipo)
  values (v_optica, p_paciente_id, p_factura_id, v_monto, left(btrim(p_archivo_nombre), 120), p_archivo_tipo)
  returning id into v_id;
  insert into pagos_transferencia_archivos (pago_id, contenido_base64) values (v_id, p_archivo_base64);
  insert into logs_optica (optica_id, usuario_id, usuario_nombre, modulo, accion, detalle)
  select v_optica, null, p.nombre, 'ventas', 'El paciente reportó un pago por transferencia', p.nombre || ' · $' || to_char(v_monto, 'FM999990.00') || ' (desde el portal del paciente)'
  from pacientes_base p where p.id = p_paciente_id;
  return v_id;
end;
$function$;
revoke all on function public.reportar_pago_transferencia(uuid, text, uuid, numeric, text, text, text) from public;
grant execute on function public.reportar_pago_transferencia(uuid, text, uuid, numeric, text, text, text) to anon, authenticated;

-- ═══════════════════════════════════════════════════════
-- 4. Ventas: ver el comprobante, confirmar o rechazar
-- ═══════════════════════════════════════════════════════
create or replace function public.archivo_pago_transferencia(p_pago_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid := optica_de_vendedor('ver');
  v_r jsonb;
begin
  select jsonb_build_object('nombre', t.archivo_nombre, 'tipo', t.archivo_tipo, 'base64', a.contenido_base64) into v_r
  from pagos_transferencia t join pagos_transferencia_archivos a on a.pago_id = t.id
  where t.id = p_pago_id and t.optica_id = v_optica;
  if v_r is null then raise exception 'El comprobante no existe.'; end if;
  return v_r;
end;
$function$;
revoke all on function public.archivo_pago_transferencia(uuid) from public, anon;
grant execute on function public.archivo_pago_transferencia(uuid) to authenticated;

create or replace function public.confirmar_pago_transferencia(p_pago_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid := optica_de_vendedor('editar');
  v_pago record;
  v_abono uuid;
begin
  select * into v_pago from pagos_transferencia where id = p_pago_id and optica_id = v_optica for update;
  if not found then raise exception 'El pago no existe.'; end if;
  if v_pago.estado <> 'por_verificar' then raise exception 'Este pago ya fue revisado.'; end if;
  -- Se registra como un abono más, con el método «Transferencia» y con todas las reglas de siempre (no pasa del saldo, no en una venta anulada, etc.).
  select r.abono_id into v_abono from registrar_abono(
    v_pago.factura_id, v_pago.monto, null, 'Transferencia verificada desde el portal',
    jsonb_build_array(jsonb_build_object('metodo', 'transferencia', 'monto', v_pago.monto))
  ) r;
  update pagos_transferencia set estado = 'confirmado', abono_id = v_abono, revisado_por = auth.uid(), revisado_en = now() where id = p_pago_id;
  insert into logs_optica (optica_id, usuario_id, usuario_nombre, modulo, accion, detalle)
  select v_optica, auth.uid(), pf.nombre, 'ventas', 'Confirmó un pago por transferencia', pa.nombre || ' · $' || to_char(v_pago.monto, 'FM999990.00')
  from perfiles pf, pacientes_base pa where pf.id = auth.uid() and pa.id = v_pago.paciente_id;
  return v_abono;
end;
$function$;
revoke all on function public.confirmar_pago_transferencia(uuid) from public, anon;
grant execute on function public.confirmar_pago_transferencia(uuid) to authenticated;

create or replace function public.rechazar_pago_transferencia(p_pago_id uuid, p_motivo text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_optica uuid := optica_de_vendedor('editar');
  v_motivo text := left(btrim(coalesce(p_motivo, '')), 300);
  v_pago record;
begin
  if length(v_motivo) < 3 then raise exception 'Escribe el motivo del rechazo.'; end if;
  select * into v_pago from pagos_transferencia where id = p_pago_id and optica_id = v_optica for update;
  if not found then raise exception 'El pago no existe.'; end if;
  if v_pago.estado <> 'por_verificar' then raise exception 'Este pago ya fue revisado.'; end if;
  update pagos_transferencia set estado = 'rechazado', motivo_rechazo = v_motivo, revisado_por = auth.uid(), revisado_en = now() where id = p_pago_id;
  insert into logs_optica (optica_id, usuario_id, usuario_nombre, modulo, accion, detalle)
  select v_optica, auth.uid(), pf.nombre, 'ventas', 'Rechazó un pago por transferencia', pa.nombre || ' · $' || to_char(v_pago.monto, 'FM999990.00') || ' · ' || v_motivo
  from perfiles pf, pacientes_base pa where pf.id = auth.uid() and pa.id = v_pago.paciente_id;
  return true;
end;
$function$;
revoke all on function public.rechazar_pago_transferencia(uuid, text) from public, anon;
grant execute on function public.rechazar_pago_transferencia(uuid, text) to authenticated;

-- ───────────────────────── Reversión (no se ejecuta) ─────────────────────────
--   drop function rechazar_pago_transferencia(uuid, text); drop function confirmar_pago_transferencia(uuid); drop function archivo_pago_transferencia(uuid);
--   drop function reportar_pago_transferencia(uuid, text, uuid, numeric, text, text, text); drop function datos_transferencia_paciente(uuid, text);
--   drop table pagos_transferencia_archivos; drop table pagos_transferencia; alter table opticas drop column datos_bancarios;
--   (Los abonos que se hayan creado al confirmar quedan: son cobros reales.)
