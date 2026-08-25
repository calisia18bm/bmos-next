-- ============================================================
-- Placement Test -- soal diatur Owner/Admin, bisa diakses SIAPA AJA di
-- website (public, ga perlu login -- calon murid/murid bisa langsung tes),
-- hasilnya kesimpen & bisa dipantau Owner/Admin dari halaman Placement Test.
-- Jalankan ini SEKALI di Supabase SQL Editor.
-- ============================================================
create table if not exists placement_test_questions (
  id uuid primary key default uuid_generate_v4(),
  question_text text not null,
  options jsonb not null,        -- array pilihan, misal ["你好","再见","谢谢","对不起"]
  correct_index int not null,    -- index (mulai 0) pilihan yang bener di `options`
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists placement_test_results (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  phone text,
  email text,
  answers jsonb not null,        -- array index jawaban yang dipilih, sejajar urutan soal
  score int not null,
  total_questions int not null,
  level_suggestion text,
  student_id uuid references students(id), -- diisi kalau yang tes murid yang udah login
  created_at timestamptz not null default now()
);

create index if not exists idx_placement_results_created_at on placement_test_results(created_at);

alter table placement_test_questions enable row level security;
alter table placement_test_results enable row level security;

-- Soal boleh dibaca SIAPA AJA (termasuk yang belum login) karena testnya
-- public di website. Insert/update/delete soal cuma boleh dari akun yang
-- udah login (role Owner/Admin-nya dicek di server action, BUKAN di RLS
-- -- pola yang sama kayak tabel lain di app ini).
drop policy if exists "Anyone can read placement_test_questions" on placement_test_questions;
create policy "Anyone can read placement_test_questions"
  on placement_test_questions for select
  using (true);

drop policy if exists "Authenticated users can insert placement_test_questions" on placement_test_questions;
create policy "Authenticated users can insert placement_test_questions"
  on placement_test_questions for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update placement_test_questions" on placement_test_questions;
create policy "Authenticated users can update placement_test_questions"
  on placement_test_questions for update
  to authenticated
  using (true);

drop policy if exists "Authenticated users can delete placement_test_questions" on placement_test_questions;
create policy "Authenticated users can delete placement_test_questions"
  on placement_test_questions for delete
  to authenticated
  using (true);

-- Siapa aja (termasuk yang belum login) boleh INSERT hasil test-nya
-- sendiri, tapi cuma akun yang udah login yang boleh BACA daftar hasil
-- (dibatesin ke Owner/Admin di server action halaman Placement Test).
drop policy if exists "Anyone can insert placement_test_results" on placement_test_results;
create policy "Anyone can insert placement_test_results"
  on placement_test_results for insert
  with check (true);

drop policy if exists "Authenticated users can read placement_test_results" on placement_test_results;
create policy "Authenticated users can read placement_test_results"
  on placement_test_results for select
  to authenticated
  using (true);
