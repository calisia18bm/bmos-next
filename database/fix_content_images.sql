-- ============================================================
-- Tambah kolom buat foto di Content Calendar
-- ============================================================

alter table content_calendar add column if not exists image_url text;

-- ============================================================
-- Storage bucket buat foto konten -- HARUS dibuat manual dulu
-- lewat Supabase Dashboard > Storage > New Bucket, nama: "content-images"
-- centang "Public bucket" biar foto bisa diakses langsung.
-- Setelah bucket dibuat, jalanin policy di bawah ini.
-- ============================================================

create policy "Authenticated users can upload content images"
  on storage.objects for insert
  with check (bucket_id = 'content-images' and auth.role() = 'authenticated');

create policy "Anyone can view content images"
  on storage.objects for select
  using (bucket_id = 'content-images');
