-- Reunión 29 sept., punto 3 del plan (docs/feedback-ing/plan-reunion-29sep.md):
-- registrar la fecha real de atención sin duplicar la cita. consultas.fecha
-- ya es un campo editable que arranca en la fecha real (ConsultaMedica.jsx,
-- hoyISO()), independiente de la fecha/hora agendada de la cita — lo único
-- que faltaba era el vínculo: qué cita específica produjo esa consulta.
-- facturas_venta ya tiene cita_id (migración 0072); consultas nunca lo tuvo.
--
-- Sin backfill: consultas ya existentes quedan con cita_id = null, que es
-- el estado correcto (no había vínculo antes de esta migración).
--
-- consultas_base se edita a través de la vista `consultas` con triggers
-- "instead of" (solo insert/delete — la app nunca hace UPDATE sobre
-- consultas). La vista y el trigger de abajo se extrajeron con
-- pg_get_viewdef/pg_get_functiondef directo de la base principal antes de
-- escribir esta migración, para no reconstruirlos de memoria.

alter table public.consultas_base
  add column if not exists cita_id uuid references public.citas_base(id) on delete set null;

create or replace view public.consultas
with (security_invoker = true)
as
select
  id, optica_id, paciente_id, paciente, fecha, motivo, usa_lentes,
  descifrar_clinico(antecedentes_enc) as antecedentes,
  descifrar_clinico(alergias_enc) as alergias,
  descifrar_clinico(antecedentes_familiares_enc) as antecedentes_familiares,
  descifrar_clinico(datos_clinicos_enc)::jsonb as datos_clinicos,
  descifrar_clinico(diagnostico_enc) as diagnostico,
  lente_recomendado,
  descifrar_clinico(indicaciones_enc) as indicaciones,
  proximo_control_dias, evolucion_calculada, estado_correccion,
  producto_id, producto_nombre, monto_venta, profesional_nombre, created_at,
  imagenes, diagnostico_categorias, profesional_registro,
  descifrar_clinico(detalle_consulta_enc) as detalle_consulta,
  cita_id
from consultas_base cb;

create or replace function public.consultas_instead_insert()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into consultas_base (
    optica_id, paciente_id, paciente, fecha, motivo, usa_lentes,
    antecedentes_enc, alergias_enc, antecedentes_familiares_enc,
    datos_clinicos_enc, diagnostico_enc, lente_recomendado, indicaciones_enc,
    proximo_control_dias, evolucion_calculada, estado_correccion,
    producto_id, producto_nombre, monto_venta, profesional_nombre, imagenes,
    diagnostico_categorias, profesional_registro, detalle_consulta_enc, cita_id
  ) values (
    new.optica_id, new.paciente_id, new.paciente, new.fecha, new.motivo, new.usa_lentes,
    cifrar_clinico(new.antecedentes), cifrar_clinico(new.alergias), cifrar_clinico(new.antecedentes_familiares),
    cifrar_clinico(new.datos_clinicos::text), cifrar_clinico(new.diagnostico), new.lente_recomendado, cifrar_clinico(new.indicaciones),
    new.proximo_control_dias, new.evolucion_calculada, new.estado_correccion,
    new.producto_id, new.producto_nombre, new.monto_venta, new.profesional_nombre,
    coalesce(new.imagenes, '[]'::jsonb),
    new.diagnostico_categorias, new.profesional_registro, cifrar_clinico(new.detalle_consulta), new.cita_id
  )
  returning id into v_id;

  select * into new from consultas where id = v_id;
  return new;
end;
$$;
