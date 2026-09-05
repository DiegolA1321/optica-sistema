-- Caso "Configuración" de la reunión con el ing (Sexta Mirada, punto 3):
-- pasar el diagnóstico de un solo campo de texto libre a categorías fijas
-- (miopía, astigmatismo, presbicia...) que se pueden marcar varias a la vez,
-- más un detalle libre aparte. El front sigue escribiendo un texto compuesto
-- en `diagnostico` (categorías + detalle) para no romper las pantallas que
-- ya lo muestran tal cual (historial del paciente, receta impresa) — esta
-- columna nueva guarda las categorías por separado, estructuradas, que es lo
-- que habilita después el reporte "cuántos pacientes tengo con miopía".
--
-- `consultas` es una VISTA cifrada desde la migración 0043 (la tabla real es
-- `consultas_base`), con `imagenes` agregada después en 0044 — la columna
-- nueva va sin cifrar a propósito: es un vocabulario fijo y corto (no texto
-- libre), mucho menos sensible que antecedentes/alergias/diagnóstico en
-- detalle, y necesita quedar consultable directo para el reporte futuro.

alter table consultas_base add column if not exists diagnostico_categorias text[];

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
  cb.diagnostico_categorias
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
    diagnostico_categorias
  ) values (
    new.optica_id, new.paciente_id, new.paciente, new.fecha, new.motivo, new.usa_lentes,
    cifrar_clinico(new.antecedentes), cifrar_clinico(new.alergias), cifrar_clinico(new.antecedentes_familiares),
    cifrar_clinico(new.datos_clinicos::text), cifrar_clinico(new.diagnostico), new.lente_recomendado, cifrar_clinico(new.indicaciones),
    new.proximo_control_dias, new.evolucion_calculada, new.estado_correccion,
    new.producto_id, new.producto_nombre, new.monto_venta, new.profesional_nombre,
    coalesce(new.imagenes, '[]'::jsonb),
    new.diagnostico_categorias
  )
  returning id into v_id;

  select * into new from consultas where id = v_id;
  return new;
end;
$$;

-- El catálogo de "diagnósticos rápidos" de Diego Óptica (la óptica de
-- referencia) se actualiza a las categorías clínicas fijas que pidió el ing
-- — antes tenía combos de texto libre ("Miopía y astigmatismo") que ya no
-- hacen falta porque ahora se pueden marcar varias categorías a la vez.
update opticas
set diagnosticos_rapidos = array['Miopía', 'Hipermetropía', 'Astigmatismo', 'Presbicia', 'Ambliopía', 'Sin alteración refractiva']
where diagnosticos_rapidos && array['Miopía y astigmatismo', 'Hipermetropía y astigmatismo'];
