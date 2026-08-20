-- ============================================================
-- Storage bucket buat file Materi Ajar (PDF, gambar, dll).
-- Jalankan ini SEKALI di Supabase SQL Editor (setelah add_materials.sql).
-- ============================================================

insert into storage.buckets (id, name, public)
values ('materials', 'materials', true)
on conflict (id) do nothing;

create policy "Authenticated users can upload materials files"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'materials');

create policy "Anyone can view materials files"
  on storage.objects for select
  using (bucket_id = 'materials');

create policy "Authenticated users can delete materials files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'materials');
