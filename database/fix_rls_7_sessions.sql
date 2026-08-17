-- ============================================================
-- RLS buat Sessions (jadwal bertanggal)
-- ============================================================

alter table sessions enable row level security;

create policy "Authenticated users can read sessions"
  on sessions for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert sessions"
  on sessions for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update sessions"
  on sessions for update
  using (auth.role() = 'authenticated');
