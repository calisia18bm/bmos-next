-- Tambah kolom full_name ke user_profiles supaya sapaan "Selamat Datang"
-- bisa nampilin nama asli orang yang login (bukan cuma email).
-- Jalankan ini SEKALI di Supabase SQL Editor.

alter table user_profiles
  add column if not exists full_name text;
