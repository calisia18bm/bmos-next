-- ============================================================
-- Tanggal berlaku buat Pengumuman -- BM bisa atur pengumuman mulai
-- tampil tanggal berapa & auto ilang dari Home Murid/Laoshi setelah
-- tanggal berapa. Kalau valid_from kosong, pengumuman langsung
-- tampil dari sekarang. Kalau valid_until kosong, ga pernah auto
-- ilang (harus dihapus manual).
--
-- Jalankan ini SEKALI di Supabase SQL Editor.
-- ============================================================

alter table announcements
  add column if not exists valid_from date;

alter table announcements
  add column if not exists valid_until date;
