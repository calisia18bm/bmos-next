-- Pengumuman/info dari Owner/Admin yang muncul di Home murid & laoshi.
-- Jalankan ini SEKALI di Supabase SQL Editor.

create table if not exists announcements (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  message text not null,
  created_by text, -- nama yang posting, buat ditampilin
  created_at timestamptz not null default now()
);

alter table announcements enable row level security;

create policy "Authenticated users can read announcements"
  on announcements for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert announcements"
  on announcements for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can delete announcements"
  on announcements for delete
  using (auth.role() = 'authenticated');
