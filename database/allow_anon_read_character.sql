-- Halaman Login belum ada yang login (anon), jadi biar logo di sana bisa
-- ikut karakter yang dipilih Owner, app_settings perlu bisa dibaca sama
-- role anon juga (sebelumnya cuma "authenticated" yang boleh SELECT).
-- Datanya ga sensitif (cuma layout banner & karakter avatar), jadi aman
-- dibuka buat publik.
-- Jalankan ini SEKALI di Supabase SQL Editor.

drop policy if exists "app_settings anon select" on app_settings;

create policy "app_settings anon select"
  on app_settings
  for select
  to anon
  using (true);
