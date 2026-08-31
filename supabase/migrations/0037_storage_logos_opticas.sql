-- Feedback de Diego (2026-08-30): "URL del logo" en Personalización del login
-- solo aceptaba un link ya alojado en otro lado — inviable para ópticas
-- pequeñas que no tienen dónde subir una imagen y obtener esa URL. Se agrega
-- un bucket de Storage público (los logos se muestran en el login, que es
-- público por definición) donde el superadmin sube el archivo directo desde
-- el navegador y el frontend arma la URL pública.
--
-- Convención de path: logos/{optica_id}/{archivo} — así la policy de
-- escritura puede verificar, por el primer segmento de la ruta, que quien
-- sube el archivo administra esa óptica (o es superadmin), sin necesitar una
-- tabla aparte para relacionar archivos con ópticas.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

drop policy if exists "logos_lectura_publica" on storage.objects;
create policy "logos_lectura_publica" on storage.objects
  for select
  using (bucket_id = 'logos');

drop policy if exists "logos_escritura_admin_optica" on storage.objects;
create policy "logos_escritura_admin_optica" on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'logos'
    and (
      es_superadmin()
      or (storage.foldername(name))[1] = (select optica_id::text from perfiles where id = auth.uid())
    )
  );

drop policy if exists "logos_actualizacion_admin_optica" on storage.objects;
create policy "logos_actualizacion_admin_optica" on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'logos'
    and (
      es_superadmin()
      or (storage.foldername(name))[1] = (select optica_id::text from perfiles where id = auth.uid())
    )
  );

drop policy if exists "logos_borrado_admin_optica" on storage.objects;
create policy "logos_borrado_admin_optica" on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'logos'
    and (
      es_superadmin()
      or (storage.foldername(name))[1] = (select optica_id::text from perfiles where id = auth.uid())
    )
  );
