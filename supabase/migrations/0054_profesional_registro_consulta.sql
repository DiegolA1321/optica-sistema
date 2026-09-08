-- Complemento de 0053: además de que el profesional guarde su propio número
-- de registro en "Mi cuenta", cada consulta guarda quién la atendió con su
-- registro de ESE momento (igual que ya hace profesional_nombre desde la
-- 0022) — así la receta impresa muestra el dato correcto de quien realmente
-- atendió esa consulta, no el valor actual de quien esté logueado al
-- imprimir después. Sin cifrar, mismo criterio que profesional_nombre: es un
-- identificador corto, no texto clínico libre.

alter table consultas_base add column if not exists profesional_registro text;

create or replace view consultas
with (security_invoker = true)
as
select
  cb.id, cb.optica_id, cb.paciente_id, cb.paciente, cb.fecha, cb.motivo, cb.usa_lentes,
  descifrar_clinico(cb.antecedentes_enc) as antecedentes,
  descifrar_clinico(cb.alergias_enc) as alergias,
  descifrar_clinico(cb.antecedentes_familiares_enc) as antecedentes_familiares,
  descifrar_clinico(cb.datos_clinicos_enc)::jsonb as datos_clinicos,
  descifrar_clinico(cb.diagnostico_enc) as diagnostico,
  cb.lente_recomendado,
  descifrar_clinico(cb.indicaciones_enc) as indicaciones,
  cb.proximo_control_dias, cb.evolucion_calculada, cb.estado_correccion,
  cb.producto_id, cb.producto_nombre, cb.monto_venta, cb.profesional_nombre, cb.created_at,
  cb.imagenes,
  cb.diagnostico_categorias,
  cb.profesional_registro
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
    diagnostico_categorias, profesional_registro
  ) values (
    new.optica_id, new.paciente_id, new.paciente, new.fecha, new.motivo, new.usa_lentes,
    cifrar_clinico(new.antecedentes), cifrar_clinico(new.alergias), cifrar_clinico(new.antecedentes_familiares),
    cifrar_clinico(new.datos_clinicos::text), cifrar_clinico(new.diagnostico), new.lente_recomendado, cifrar_clinico(new.indicaciones),
    new.proximo_control_dias, new.evolucion_calculada, new.estado_correccion,
    new.producto_id, new.producto_nombre, new.monto_venta, new.profesional_nombre,
    coalesce(new.imagenes, '[]'::jsonb),
    new.diagnostico_categorias, new.profesional_registro
  )
  returning id into v_id;

  select * into new from consultas where id = v_id;
  return new;
end;
$$;
