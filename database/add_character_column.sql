-- Tambah kolom character_key ke user_profiles supaya tiap user bisa pilih
-- karakter maskot favoritnya sendiri (ditampilkan di sidebar & dashboard).
-- Jalankan ini SEKALI di Supabase SQL Editor.

alter table user_profiles
  add column if not exists character_key text;
