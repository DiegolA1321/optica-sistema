-- El ing probó "Atender" en Citas médicas y notó que el motivo de la consulta
-- (la categoría fija con la que el paciente agendó) y el detalle específico
-- que cuenta al llegar ("me duelen los ojos...") se estaban tratando como un
-- solo campo — pidió separarlos porque uno es relacional a la cita agendada
-- y el otro es libre y propio de esta visita (transcripción ING7).
-- `detalle_consulta` sigue el mismo patrón cifrado que el resto de texto
-- clínico libre de esta tabla (antecedentes, alergias, indicaciones — 0043).

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'clinical_data_key') then
    raise exception 'Falta el secreto clinical_data_key en Vault (debería existir desde la migración 0043).';
  end if;
end $$;

alter table consultas_base add column if not exists detalle_consulta_enc bytea;

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
  cb.profesional_registro,
  descifrar_clinico(cb.detalle_consulta_enc) as detalle_consulta
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
    diagnostico_categorias, profesional_registro, detalle_consulta_enc
  ) values (
    new.optica_id, new.paciente_id, new.paciente, new.fecha, new.motivo, new.usa_lentes,
    cifrar_clinico(new.antecedentes), cifrar_clinico(new.alergias), cifrar_clinico(new.antecedentes_familiares),
    cifrar_clinico(new.datos_clinicos::text), cifrar_clinico(new.diagnostico), new.lente_recomendado, cifrar_clinico(new.indicaciones),
    new.proximo_control_dias, new.evolucion_calculada, new.estado_correccion,
    new.producto_id, new.producto_nombre, new.monto_venta, new.profesional_nombre,
    coalesce(new.imagenes, '[]'::jsonb),
    new.diagnostico_categorias, new.profesional_registro, cifrar_clinico(new.detalle_consulta)
  )
  returning id into v_id;

  select * into new from consultas where id = v_id;
  return new;
end;
$$;
