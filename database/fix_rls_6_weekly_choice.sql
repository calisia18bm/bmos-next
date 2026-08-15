-- ============================================================
-- Tabel baru: Weekly Choice (konfirmasi mingguan buat kelas
-- fleksibel -- kelas dengan nama sama tapi diajar >1 laoshi
-- bergantian, murid pilih ikut sesi siapa tiap minggu)
-- ============================================================

create table weekly_choices (
  id uuid primary key default uuid_generate_v4(),
  student_id uuid references students(id) not null,
  class_group_name text not null, -- nama kelas fleksibel, e.g. "香蕉班🍌"
  chosen_class_id uuid references classes(id),
  week_start date not null, -- Senin dari minggu yang dipilih
  confirmed boolean not null default false,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (student_id, class_group_name, week_start)
);

alter table weekly_choices enable row level security;

create policy "Authenticated users can read weekly_choices"
  on weekly_choices for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert weekly_choices"
  on weekly_choices for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update weekly_choices"
  on weekly_choices for update
  using (auth.role() = 'authenticated');
