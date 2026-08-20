-- ============================================================
-- Materi Ajar -- Laoshi upload bahan ajar per Kelas, Murid di kelas
-- itu bisa lihat & download. Owner/Admin bisa lihat & hapus semua.
-- ============================================================

create table if not exists materials (
  id uuid primary key default uuid_generate_v4(),
  class_id uuid references classes(id) not null,
  class_name text, -- denormalized biar gampang ditampilin
  teacher_id uuid references teachers(id), -- yang upload
  teacher_name text,
  title text not null,
  description text,
  file_url text not null,
  file_name text,
  file_path text, -- path di Supabase Storage, dipakai buat hapus filenya
  created_at timestamptz not null default now()
);

create index if not exists idx_materials_class on materials(class_id);
create index if not exists idx_materials_teacher on materials(teacher_id);

-- Sama kayak tabel operasional lain di app ini: dibuka buat semua user
-- yang udah login, akses per-role dikontrol di level aplikasi (menu +
-- server action), bukan di RLS.
alter table materials enable row level security;

create policy "Authenticated users can read materials"
  on materials for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert materials"
  on materials for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can delete materials"
  on materials for delete
  using (auth.role() = 'authenticated');
