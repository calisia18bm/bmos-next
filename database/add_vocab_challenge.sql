-- ============================================================
-- CHALLENGE 30 HARI + KOSAKATA (Vocab Challenge)
-- Murid belajar 10 kosakata/hari (sesuai level dia: Dasar / Menengah),
-- kudu lulus test 10/10 buat dapet "cap" hari itu. 30 hari = 300 kata.
--
-- Aturan hari & freeze:
-- - Hari (current_day) MAJU TERUS tiap hari kalender, ga peduli
--   kemarin dikerjain apa nggak (misal Day 5 -> besok otomatis
--   jadi Day 6, bukan nunggu Day 5 selesai dulu).
-- - Kalau 1 hari kelewat (ga sempet dapet cap hari itu), hari itu
--   jadi "frozen_day" -- masih bisa dikejar/susul belakangan,
--   selama masih dalam 1 hari batas waktu.
-- - Kalau frozen_day itu ga sempet dikejar dalam batas waktunya
--   (kelewat lagi 1 hari lagi tanpa nyelesaiin), progress RESET ke
--   Day 1.
-- - Begitu frozen_day berhasil dikejar, freeze langsung tersedia
--   lagi (siap dipake kalau ada hari lain kelewat lagi nanti).
-- Jalankan ini SEKALI di Supabase SQL Editor.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Level murid (Dasar / Menengah) -- dipake buat filter kosakata
--    mana yang muncul buat murid itu.
-- ------------------------------------------------------------
alter table students
  add column if not exists level text not null default 'DASAR';

alter table students
  drop constraint if exists students_level_check;
alter table students
  add constraint students_level_check check (level in ('DASAR', 'MENENGAH'));

-- ------------------------------------------------------------
-- 2. Bank kosakata -- diisi/dikelola Owner/Admin dari halaman admin.
--    order_index dipake buat nentuin urutan hari (misal index 0-9 =
--    Day 1, index 10-19 = Day 2, dst per level).
-- ------------------------------------------------------------
create table if not exists vocab_words (
  id uuid primary key default uuid_generate_v4(),
  level text not null check (level in ('DASAR', 'MENENGAH')),
  hanzi text not null,
  pinyin text not null,
  arti text not null,          -- arti Bahasa Indonesia
  audio_url text,              -- opsional, buat soal format audio->jawaban
  order_index int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists idx_vocab_words_level_order
  on vocab_words(level, order_index);

-- ------------------------------------------------------------
-- 3. Progress harian per murid -- 1 baris per murid.
--    current_day = hari yang aktif/kebuka HARI INI (maju terus tiap
--    hari kalender). frozen_day = hari lama yang kelewat & masih
--    bisa dikejar (null kalau ga ada). frozen_day_deadline = tanggal
--    terakhir frozen_day itu masih bisa dikejar sebelum kena reset.
-- ------------------------------------------------------------
create table if not exists vocab_progress (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references students(id) unique,
  current_day int not null default 1,           -- hari yang kebuka hari ini (1-30)
  started_at date not null default current_date,
  freeze_available boolean not null default true, -- masih ada 1x freeze buat dipake?
  frozen_day int,                                -- hari lama yg kelewat, msh bisa dikejar
  frozen_day_deadline date,                      -- batas terakhir buat ngejar frozen_day
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 4. Riwayat cap per hari -- 1 baris tiap murid berhasil lulus test
--    hari itu (skor selalu 10/10 karena syarat lulus emang sempurna).
--    Diary/rekaman/foto sifatnya OPSIONAL, cuma buat direview
--    Admin/Owner, TIDAK menghalangi cap.
-- ------------------------------------------------------------
create table if not exists vocab_day_logs (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid not null references students(id),
  day_number int not null,
  completed_at timestamptz not null default now(),
  used_freeze boolean not null default false, -- ini nyusul karena kena freeze?
  diary_note text,
  diary_attachment_url text,
  diary_attachment_type text,     -- IMAGE / AUDIO / VIDEO
  reviewed_by uuid references people(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (student_id, day_number)
);

create index if not exists idx_vocab_day_logs_student
  on vocab_day_logs(student_id);
create index if not exists idx_vocab_day_logs_completed_at
  on vocab_day_logs(completed_at);

-- ------------------------------------------------------------
-- RLS -- pola yang sama kayak tabel lain di app ini: dibuka broad
-- buat yang udah login, akses SEBENARNYA dicek di server action
-- (getCurrentProfile / getCallerContext), bukan di RLS.
-- ------------------------------------------------------------
alter table vocab_words enable row level security;
alter table vocab_progress enable row level security;
alter table vocab_day_logs enable row level security;

drop policy if exists "Authenticated users can read vocab_words" on vocab_words;
create policy "Authenticated users can read vocab_words"
  on vocab_words for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert vocab_words" on vocab_words;
create policy "Authenticated users can insert vocab_words"
  on vocab_words for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update vocab_words" on vocab_words;
create policy "Authenticated users can update vocab_words"
  on vocab_words for update
  to authenticated
  using (true);

drop policy if exists "Authenticated users can delete vocab_words" on vocab_words;
create policy "Authenticated users can delete vocab_words"
  on vocab_words for delete
  to authenticated
  using (true);

drop policy if exists "Authenticated users can read vocab_progress" on vocab_progress;
create policy "Authenticated users can read vocab_progress"
  on vocab_progress for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert vocab_progress" on vocab_progress;
create policy "Authenticated users can insert vocab_progress"
  on vocab_progress for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update vocab_progress" on vocab_progress;
create policy "Authenticated users can update vocab_progress"
  on vocab_progress for update
  to authenticated
  using (true);

drop policy if exists "Authenticated users can read vocab_day_logs" on vocab_day_logs;
create policy "Authenticated users can read vocab_day_logs"
  on vocab_day_logs for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert vocab_day_logs" on vocab_day_logs;
create policy "Authenticated users can insert vocab_day_logs"
  on vocab_day_logs for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update vocab_day_logs" on vocab_day_logs;
create policy "Authenticated users can update vocab_day_logs"
  on vocab_day_logs for update
  to authenticated
  using (true);
