-- ============================================================
-- Kolom Email buat data Teachers & Students (kontak, BEDA sama email
-- LOGIN akun di user_profiles) + No. HP Laoshi/Murid di Accounts
-- sekarang diambil LANGSUNG dari data Teachers/Students (bukan diketik
-- ulang terpisah), biar selalu sinkron -- ubah di salah satu tempat
-- (Accounts ATAU Teachers/Students), otomatis kepake di tempat lain
-- juga karena sama-sama baca dari kolom yang SAMA.
--
-- Jalankan ini SEKALI di Supabase SQL Editor.
-- ============================================================

alter table teachers
  add column if not exists email text;

alter table students
  add column if not exists email text;
