-- =====================================================================
-- Storage: bucket "fotos" (galería, servicios, logo y portada)
-- Lectura pública (es el portfolio de la web); escritura solo staff.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos', 'fotos', true, 8388608, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy fotos_lectura on storage.objects
  for select to anon, authenticated using (bucket_id = 'fotos');
create policy fotos_alta on storage.objects
  for insert to authenticated with check (bucket_id = 'fotos' and public.es_staff());
create policy fotos_edicion on storage.objects
  for update to authenticated using (bucket_id = 'fotos' and public.es_staff());
create policy fotos_baja on storage.objects
  for delete to authenticated using (bucket_id = 'fotos' and public.es_staff());
