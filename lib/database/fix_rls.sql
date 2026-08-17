-- ============================================================
-- Fix: izinkan user yang login baca datanya sendiri di user_profiles
-- ============================================================

alter table user_profiles enable row level security;

create policy "Users can read own profile"
  on user_profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on user_profiles for update
  using (auth.uid() = id);

-- ============================================================
-- Untuk tahap ini, tabel data operasional (students, teachers, dst)
-- kita buka aksesnya buat semua user yang SUDAH LOGIN dulu (biar
-- development lancar). Nanti di tahap berikutnya kita perketat lagi
-- per-role (misal murid cuma bisa baca datanya sendiri).
-- ============================================================

alter table students enable row level security;
create policy "Authenticated users can read students"
  on students for select
  using (auth.role() = 'authenticated');
create policy "Authenticated users can insert students"
  on students for insert
  with check (auth.role() = 'authenticated');
create policy "Authenticated users can update students"
  on students for update
  using (auth.role() = 'authenticated');

alter table teachers enable row level security;
create policy "Authenticated users can read teachers"
  on teachers for select
  using (auth.role() = 'authenticated');

alter table classes enable row level security;
create policy "Authenticated users can read classes"
  on classes for select
  using (auth.role() = 'authenticated');
