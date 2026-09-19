-- ============================================================
-- Fix: pastikan RLS enrollments beneran ngizinin Murid (authenticated)
-- insert request join kelas.
--
-- Kenapa ini perlu: policy insert enrollments awalnya cuma ada di
-- database/fix_enrollments.sql (dibikin sebelum fitur "Request Join
-- Kelas" payment-gated ada). Kalau file itu belum pernah dijalanin di
-- Supabase (atau kepencet skip), insert ke enrollments bakal ditolak
-- RLS persis kayak error "new row violates row-level security policy
-- for table enrollments" yang muncul pas Murid klik "Kirim Request
-- Join".
--
-- Script ini AMAN dijalanin berkali-kali (drop policy if exists dulu
-- sebelum create), jadi walaupun fix_enrollments.sql versi lama udah
-- pernah jalan sebelumnya, jalanin ini sekali lagi ga bakal error.
-- ============================================================

alter table enrollments enable row level security;

drop policy if exists "Authenticated users can read enrollments" on enrollments;
create policy "Authenticated users can read enrollments"
  on enrollments for select
  using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can insert enrollments" on enrollments;
create policy "Authenticated users can insert enrollments"
  on enrollments for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can update enrollments" on enrollments;
create policy "Authenticated users can update enrollments"
  on enrollments for update
  using (auth.role() = 'authenticated');
