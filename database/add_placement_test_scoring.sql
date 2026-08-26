-- ============================================================
-- Skor per soal buat Placement Test -- sebelumnya tiap soal dianggap
-- sama bobotnya (1 poin), sekarang Owner/Admin bisa atur poin
-- masing-masing soal sendiri (misal soal susah dikasih poin lebih
-- gede). Skor akhir dihitung dari total poin soal yang dijawab bener
-- dibagi total poin semua soal.
-- Jalankan ini SEKALI di Supabase SQL Editor (setelah add_placement_test.sql).
-- ============================================================
alter table placement_test_questions
  add column if not exists points int not null default 1;

alter table placement_test_results
  add column if not exists total_points int;
