-- Módulo 1 (Diego, 2026-09-11): soporte visual de productos — fotos de
-- armazones/lentes en Inventario, en el buscador de recomendación de la
-- Ficha Clínica y en los ítems de los modales de Venta/Factura. Columna
-- nueva + bucket de Storage, mismo convenio que `logos` (migración 0037):
-- bucket público (la foto de un armazón no es un dato sensible, igual que
-- un logo) con path {optica_id}/{archivo} para que la policy de escritura
-- verifique dueño por el primer segmento de la ruta sin tabla aparte.

alter table inventario add column if not exists imagen_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('productos', 'productos', true, 3145728, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;

drop policy if exists "productos_lectura_publica" on storage.objects;
create policy "productos_lectura_publica" on storage.objects
  for select
  using (bucket_id = 'productos');

drop policy if exists "productos_escritura_staff_optica" on storage.objects;
create policy "productos_escritura_staff_optica" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'productos'
    and (
      es_superadmin()
      or (storage.foldername(name))[1] = (select optica_id::text from perfiles where id = auth.uid())
    )
  );

drop policy if exists "productos_actualizacion_staff_optica" on storage.objects;
create policy "productos_actualizacion_staff_optica" on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'productos'
    and (
      es_superadmin()
      or (storage.foldername(name))[1] = (select optica_id::text from perfiles where id = auth.uid())
    )
  );

drop policy if exists "productos_borrado_staff_optica" on storage.objects;
create policy "productos_borrado_staff_optica" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'productos'
    and (
      es_superadmin()
      or (storage.foldername(name))[1] = (select optica_id::text from perfiles where id = auth.uid())
    )
  );
