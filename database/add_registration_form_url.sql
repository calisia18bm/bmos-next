-- ============================================================
-- Kuisioner Pendaftaran Murid Baru -- dipakai Google Form (bukan
-- kuisioner chat custom), linknya diatur Owner dari halaman Class Card
-- lalu ditampilin ke calon murid biar diarahkan ke kelas yang cocok
-- sebelum join lewat Class Card.
-- Jalankan ini SEKALI di Supabase SQL Editor.
-- ============================================================
alter table app_settings
  add column if not exists registration_form_url text;
