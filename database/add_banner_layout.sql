-- Tabel settingan tampilan (dipakai buat atur ukuran & urutan logo/karakter
-- di banner dashboard Home, biar Owner bisa atur sendiri tanpa perlu minta
-- tolong ubah kode lagi). Cuma ada 1 baris (singleton, id selalu 1).
-- Jalankan ini SEKALI di Supabase SQL Editor.

create table if not exists app_settings (
  id int primary key default 1,
  banner_layout jsonb,
  constraint app_settings_singleton check (id = 1)
);

insert into app_settings (id, banner_layout)
values (1, null)
on conflict (id) do nothing;

alter table app_settings enable row level security;

create policy "Authenticated users can read app_settings"
  on app_settings for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can update app_settings"
  on app_settings for update
  using (auth.role() = 'authenticated');

