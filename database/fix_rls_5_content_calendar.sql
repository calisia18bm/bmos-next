-- ============================================================
-- Tabel baru: Content Calendar (jadwal posting media sosial)
-- ============================================================

create table content_calendar (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  platform text not null default 'Instagram', -- Instagram/TikTok/WhatsApp/dll
  scheduled_date date not null,
  status text not null default 'PLANNED', -- PLANNED/DONE/CANCELLED
  notes text,
  created_at timestamptz not null default now()
);

alter table content_calendar enable row level security;

create policy "Authenticated users can read content_calendar"
  on content_calendar for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert content_calendar"
  on content_calendar for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update content_calendar"
  on content_calendar for update
  using (auth.role() = 'authenticated');

-- ============================================================
-- Sekalian RLS buat Trials & Follow Ups
-- ============================================================

alter table trials enable row level security;

create policy "Authenticated users can read trials"
  on trials for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert trials"
  on trials for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update trials"
  on trials for update
  using (auth.role() = 'authenticated');

alter table follow_ups enable row level security;

create policy "Authenticated users can read follow_ups"
  on follow_ups for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert follow_ups"
  on follow_ups for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update follow_ups"
  on follow_ups for update
  using (auth.role() = 'authenticated');
