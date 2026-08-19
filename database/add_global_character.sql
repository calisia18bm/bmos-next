-- Bikin avatar karakter di sidebar jadi SATU karakter global yang sama
-- buat semua akun (bukan per-user lagi), diatur cuma sama Owner.
-- Jalankan ini SEKALI di Supabase SQL Editor.

alter table app_settings
  add column if not exists global_character_key text;
