-- Adjuntar imágenes a una consulta — el marco referencial del anteproyecto
-- dice textualmente que la HCE debe soportar "datos estructurados... [y]
-- adjuntos (imágenes)" además del texto. Bucket privado (a diferencia de
-- `logos`, que es público a propósito porque se ve en el login): son fotos
-- clínicas, solo el staff de esa óptica (o el superadmin) puede leerlas o
-- subirlas. Mismo convenio de path que logos (primer segmento = optica_id),
-- para que la policy verifique dueño sin tabla aparte.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('consultas-adjuntos', 'consultas-adjuntos', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

create policy "consultas_adjuntos_lectura_staff" on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'consultas-adjuntos'
    and (
      es_superadmin()
      or (storage.foldername(name))[1] = (select optica_id::text from perfiles where id = auth.uid())
    )
  );

create policy "consultas_adjuntos_escritura_staff" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'consultas-adjuntos'
    and (
      es_superadmin()
      or (storage.foldername(name))[1] = (select optica_id::text from perfiles where id = auth.uid())
    )
  );

create policy "consultas_adjuntos_borrado_staff" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'consultas-adjuntos'
    and (
      es_superadmin()
      or (storage.foldername(name))[1] = (select optica_id::text from perfiles where id = auth.uid())
    )
  );

-- ── Columna nueva: rutas de las imágenes (no el contenido — el archivo
--    vive en Storage, protegido por las policies de arriba). No se cifra
--    con clinical_data_key: son solo referencias, no el dato clínico en
--    sí, igual de sensibles que `motivo` o `lente_recomendado` que ya
--    viven sin cifrar en esta misma tabla. ──
alter table consultas_base add column if not exists imagenes jsonb not null default '[]'::jsonb;

-- La vista y los triggers INSTEAD OF de la migración 0043 hay que
-- recrearlos con la columna nueva agregada (drop+create porque no se puede
-- hacer "create or replace view" cuando cambia la lista de columnas).
drop view consultas;

create view consultas
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
  cb.imagenes
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
    producto_id, producto_nombre, monto_venta, profesional_nombre, imagenes
  ) values (
    new.optica_id, new.paciente_id, new.paciente, new.fecha, new.motivo, new.usa_lentes,
    cifrar_clinico(new.antecedentes), cifrar_clinico(new.alergias), cifrar_clinico(new.antecedentes_familiares),
    cifrar_clinico(new.datos_clinicos::text), cifrar_clinico(new.diagnostico), new.lente_recomendado, cifrar_clinico(new.indicaciones),
    new.proximo_control_dias, new.evolucion_calculada, new.estado_correccion,
    new.producto_id, new.producto_nombre, new.monto_venta, new.profesional_nombre,
    coalesce(new.imagenes, '[]'::jsonb)
  )
  returning id into v_id;

  select * into new from consultas where id = v_id;
  return new;
end;
$$;

create trigger consultas_insert_trigger
  instead of insert on consultas
  for each row execute function public.consultas_instead_insert();

create or replace function public.consultas_instead_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  delete from consultas_base where id = old.id;
  return old;
end;
$$;

create trigger consultas_delete_trigger
  instead of delete on consultas
  for each row execute function public.consultas_instead_delete();

grant select, insert, delete on consultas to authenticated;
