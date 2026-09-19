-- ============================================================
-- Nomor HP buat akun BM (Owner & Admin) + izin baca semua profile
-- ============================================================
-- Latar belakang: fitur baru "kabarin BM lewat WhatsApp tiap ada Murid/
-- Laoshi kirim bukti transfer" butuh nomor HP tiap akun BM (Owner/Admin)
-- disimpen di database (bukan cuma 1 nomor lewat env var kayak
-- OWNER_WHATSAPP_NUMBER) -- soalnya sekarang bisa ada lebih dari satu
-- akun BM, dan tiap akun BM bisa isi nomor HP-nya sendiri di halaman
-- Accounts.
--
-- Jalankan ini SEKALI di Supabase SQL Editor.
-- ============================================================

alter table user_profiles
  add column if not exists phone text;

-- ============================================================
-- Sebelumnya RLS user_profiles cuma ngizinin tiap user baca profil
-- dia SENDIRI (lihat database/fix_rls.sql: "auth.uid() = id"). Fitur
-- kirim notif WA ke SEMUA akun BM sebenernya jalan lewat service role
-- (createAdminClient(), lewatin RLS) jadi ga kena batasan ini -- tapi
-- policy select di bawah ditambahin juga biar konsisten sama pola
-- "authenticated broadly allowed" yang dipake tabel lain di app ini,
-- kalau-kalau ada fitur lain ke depannya yang perlu baca daftar akun
-- BM dari sisi browser (bukan server action).
-- ============================================================
drop policy if exists "Authenticated users can read user_profiles" on user_profiles;
create policy "Authenticated users can read user_profiles"
  on user_profiles for select
  using (auth.role() = 'authenticated');
