-- ============================================================
-- Submit Materi dari Laoshi -> Admin/Owner -> publish balik ke Laoshi
--
-- Alurnya:
-- 1) Laoshi upload draft materi (file asli, misal PPT) + judul/keterangan
--    lewat halaman Materi -- masuk sebagai submission status PENDING.
-- 2) Admin/Owner lihat submission yang PENDING di halaman Materi,
--    download file draft-nya, cek/edit sendiri di luar (misal di
--    PowerPoint), lalu upload versi PDF final buat di-publish balik.
-- 3) Begitu di-approve, materi itu otomatis masuk ke tabel
--    teacher_resources (yang sudah ada) sebagai PDF -- jadi bisa dipakai
--    SEMUA Laoshi (bukan cuma yang submit), sama seperti bahan ajar yang
--    diupload langsung oleh Admin/Owner. Laoshi tetap CUMA bisa lihat/
--    download versi PDF-nya, ga bisa edit lagi.
-- 4) Admin/Owner juga bisa REJECT submission dengan catatan alasan,
--    biar Laoshi bisa perbaiki & submit ulang.
-- ============================================================
create table if not exists teacher_resource_submissions (
  id uuid primary key default uuid_generate_v4(),
  teacher_id uuid references teachers(id) not null,
  teacher_name text,
  title text not null,
  description text,
  submitted_file_url text not null,   -- file draft asli dari Laoshi (PPT/dll)
  submitted_file_name text,
  submitted_file_path text,
  status text not null default 'PENDING', -- PENDING / APPROVED / REJECTED
  rejection_note text,
  published_resource_id uuid references teacher_resources(id),
  reviewed_at timestamptz,
  reviewed_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists idx_teacher_resource_submissions_teacher on teacher_resource_submissions(teacher_id);
create index if not exists idx_teacher_resource_submissions_status on teacher_resource_submissions(status);

alter table teacher_resource_submissions enable row level security;

drop policy if exists "Authenticated users can read teacher_resource_submissions" on teacher_resource_submissions;
create policy "Authenticated users can read teacher_resource_submissions"
  on teacher_resource_submissions for select
  using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can insert teacher_resource_submissions" on teacher_resource_submissions;
create policy "Authenticated users can insert teacher_resource_submissions"
  on teacher_resource_submissions for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can update teacher_resource_submissions" on teacher_resource_submissions;
create policy "Authenticated users can update teacher_resource_submissions"
  on teacher_resource_submissions for update
  using (auth.role() = 'authenticated');
-- (pola sama kayak tabel lain di app ini: RLS dibuka broad, kontrol akses
-- sebenarnya dicek role-nya di server action app/(app)/materials/actions.ts
-- -- cuma TEACHER yang bisa insert punya sendiri, cuma OWNER/ADMIN yang
-- bisa approve/reject)

-- File draft dari Laoshi dipakai bucket storage yang SUDAH ADA
-- ('teacher-resources', dibuat di add_teacher_resources_and_homework.sql)
-- -- policy-nya udah broad authenticated insert/select/delete, jadi ga
-- perlu bucket baru.
