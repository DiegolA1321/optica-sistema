-- 0123 · El portal del paciente muestra el estado de sus lentes y cuándo le toca el control
-- Pedido de Diego (17 oct. 2026, portal v2): el paciente de una óptica pregunta «¿cuándo están mis lentes?» y «¿cuándo me toca el control?».
-- Hoy el portal no tiene ninguna función para eso (docs/revision-portal-y-superadmin.md, P3). Se agregan DOS funciones de solo lectura, con el mismo
-- token de sesión que las demás del portal (`sesion_paciente_valida`). No cambia ninguna tabla, política, función ni dato existente.
--
--   1. mis_ordenes_paciente(paciente, token): las órdenes de laboratorio de ESE paciente (no las canceladas), con lo que el paciente entiende:
--      número, estado, fecha estimada, tipo de lente, montura, comprobante al que pertenecen y cuándo quedaron listas o entregadas.
--      NO entrega el laboratorio, las observaciones, la receta de la orden, quién la creó ni ningún costo (decisión 4 del 9 oct.: «no ve el
--      laboratorio ni los costos internos»; regla 36).
--   2. mi_control_paciente(paciente, token): lo mínimo para calcular su próximo control con la MISMA función del sistema del personal
--      (`fechaProximoControl`): la fecha de su última consulta, los días que fijó el optómetra y si el paciente está «De alta». No entrega
--      ningún dato clínico más (regla 29: lo que el paciente necesita para actuar se le entrega; nada de lo demás).

create or replace function public.mis_ordenes_paciente(p_paciente_id uuid, p_token text default null)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select coalesce(jsonb_agg(x.fila order by x.creada_en desc, x.numero desc), '[]'::jsonb)
  from (
    select o.creada_en, o.numero,
      jsonb_build_object(
        'id', o.id,
        'numero', o.numero,
        'estado', o.estado,
        'fecha_prometida', o.fecha_prometida,
        'tipo_lente', o.tipo_lente,
        'montura', o.montura,
        'factura_id', o.factura_id,
        'creada_en', o.creada_en,
        'lista_el', (select max(h.cambiado_en) from ordenes_laboratorio_historial h where h.orden_id = o.id and h.estado = 'lista'),
        'entregada_el', (select max(h.cambiado_en) from ordenes_laboratorio_historial h where h.orden_id = o.id and h.estado = 'entregada')
      ) as fila
    from ordenes_laboratorio o
    where o.paciente_id = p_paciente_id and o.estado <> 'cancelada' and sesion_paciente_valida(p_paciente_id, p_token)
  ) x;
$function$;
revoke all on function public.mis_ordenes_paciente(uuid, text) from public;
grant execute on function public.mis_ordenes_paciente(uuid, text) to anon, authenticated;

create or replace function public.mi_control_paciente(p_paciente_id uuid, p_token text default null)
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $function$
  select jsonb_build_object(
    'ultima_consulta', (select c.fecha from consultas c where c.paciente_id = p_paciente_id order by c.fecha desc, c.created_at desc limit 1),
    'proximo_control_dias', (select c.proximo_control_dias from consultas c where c.paciente_id = p_paciente_id order by c.fecha desc, c.created_at desc limit 1),
    'de_alta', coalesce((select p.estado_clinico = 'De alta' from pacientes p where p.id = p_paciente_id), false)
  )
  where sesion_paciente_valida(p_paciente_id, p_token);
$function$;
revoke all on function public.mi_control_paciente(uuid, text) from public;
grant execute on function public.mi_control_paciente(uuid, text) to anon, authenticated;

-- ───────────────────────── Reversión (no se ejecuta) ─────────────────────────
--   drop function public.mis_ordenes_paciente(uuid, text); drop function public.mi_control_paciente(uuid, text);
