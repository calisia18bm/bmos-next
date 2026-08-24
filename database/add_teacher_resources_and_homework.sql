-- ============================================================
-- 1) Bahan Ajar dari Admin/Owner ke Laoshi -- Laoshi bisa lihat & pakai
--    tapi CUMA bisa download versi PDF-nya (bukan file asli PPT/dll),
--    biar ga gampang disalahgunakan/disebar kalau Laoshi udah keluar
--    dari BM. File asli cuma bisa diakses/didownload Owner & Admin.
-- ============================================================
create table if not exists teacher_resources (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  description text,
  pdf_file_url text not null,       -- yang boleh dilihat/didownload Laoshi
  pdf_file_name text,
  pdf_file_path text,
  original_file_url text,           -- file asli (PPT/dll), cuma buat Owner/Admin
  original_file_name text,
  original_file_path text,
  uploaded_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists idx_teacher_resources_created_at on teacher_resources(created_at);

alter table teacher_resources enable row level security;

drop policy if exists "Authenticated users can read teacher_resources" on teacher_resources;
create policy "Authenticated users can read teacher_resources"
  on teacher_resources for select
  using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can insert teacher_resources" on teacher_resources;
create policy "Authenticated users can insert teacher_resources"
  on teacher_resources for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can delete teacher_resources" on teacher_resources;
create policy "Authenticated users can delete teacher_resources"
  on teacher_resources for delete
  using (auth.role() = 'authenticated');
-- Catatan: RLS di sini dibuka broad (pola yang sama kayak tabel lain di
-- app ini) -- yang BENERAN ngebatesin "Laoshi cuma boleh liat PDF, ga
-- boleh liat file asli" adalah query di server component (app/(app)/materials/page.tsx)
-- yang SENGAJA ga nge-select kolom original_file_* sama sekali pas yang
-- buka halamannya Laoshi. Insert/delete juga dicek role-nya di server
-- action (cuma OWNER/ADMIN).

-- Storage bucket buat file bahan ajar (PDF + file asli).
insert into storage.buckets (id, name, public)
values ('teacher-resources', 'teacher-resources', true)
on conflict (id) do nothing;

drop policy if exists "Authenticated users can upload teacher-resources files" on storage.objects;
create policy "Authenticated users can upload teacher-resources files"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'teacher-resources');

drop policy if exists "Anyone can view teacher-resources files" on storage.objects;
create policy "Anyone can view teacher-resources files"
  on storage.objects for select
  using (bucket_id = 'teacher-resources');

drop policy if exists "Authenticated users can delete teacher-resources files" on storage.objects;
create policy "Authenticated users can delete teacher-resources files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'teacher-resources');

-- ============================================================
-- 2) PR (Pekerjaan Rumah) -- Laoshi bikin PR per kelas, Murid submit
--    lewat website (bisa teks, suara, video, atau file lain).
-- ============================================================
create table if not exists homework (
  id uuid primary key default uuid_generate_v4(),
  class_id uuid references classes(id) not null,
  class_name text,
  teacher_id uuid references teachers(id),
  teacher_name text,
  title text not null,
  description text,
  due_date date,
  created_at timestamptz not null default now()
);

create index if not exists idx_homework_class on homework(class_id);

create table if not exists homework_submissions (
  id uuid primary key default uuid_generate_v4(),
  homework_id uuid references homework(id) not null,
  student_id uuid references students(id) not null,
  student_name text,
  submission_type text not null default 'TEXT', -- TEXT / AUDIO / VIDEO / FILE
  answer_text text,
  file_url text,
  file_name text,
  file_path text,
  teacher_feedback text,
  submitted_at timestamptz not null default now(),
  unique (homework_id, student_id) -- submit ulang = update baris yang sama
);

create index if not exists idx_homework_submissions_homework on homework_submissions(homework_id);
create index if not exists idx_homework_submissions_student on homework_submissions(student_id);

alter table homework enable row level security;
alter table homework_submissions enable row level security;

drop policy if exists "Authenticated users can read homework" on homework;
create policy "Authenticated users can read homework"
  on homework for select
  using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can insert homework" on homework;
create policy "Authenticated users can insert homework"
  on homework for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can delete homework" on homework;
create policy "Authenticated users can delete homework"
  on homework for delete
  using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can read homework_submissions" on homework_submissions;
create policy "Authenticated users can read homework_submissions"
  on homework_submissions for select
  using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can insert homework_submissions" on homework_submissions;
create policy "Authenticated users can insert homework_submissions"
  on homework_submissions for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can update homework_submissions" on homework_submissions;
create policy "Authenticated users can update homework_submissions"
  on homework_submissions for update
  using (auth.role() = 'authenticated');
-- (sama kayak tabel lain: RLS broad, kontrol akses sebenarnya di server
-- action app/(app)/homework/actions.ts)

-- Storage bucket buat file jawaban PR (suara/video/file lain).
insert into storage.buckets (id, name, public)
values ('homework-submissions', 'homework-submissions', true)
on conflict (id) do nothing;

drop policy if exists "Authenticated users can upload homework-submissions files" on storage.objects;
create policy "Authenticated users can upload homework-submissions files"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'homework-submissions');

drop policy if exists "Anyone can view homework-submissions files" on storage.objects;
create policy "Anyone can view homework-submissions files"
  on storage.objects for select
  using (bucket_id = 'homework-submissions');

drop policy if exists "Authenticated users can delete homework-submissions files" on storage.objects;
create policy "Authenticated users can delete homework-submissions files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'homework-submissions');
