-- Nyambungin akun login (user_profiles) ke data Teacher/Student yang
-- udah ada di Master Data -- biar sistem tau "akun laoshi ini ngajar
-- kelas apa aja" dan "akun murid ini di kelas mana". Dipakai buat home
-- page yang disederhanakan per role, dan buat fitur materi nanti.
-- Jalankan ini SEKALI di Supabase SQL Editor.

alter table user_profiles
  add column if not exists teacher_id uuid references teachers(id),
  add column if not exists student_id uuid references students(id);
