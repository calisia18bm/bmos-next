-- ============================================================
-- RLS buat Leads & Expenses (Reports cuma baca dari tabel yang
-- udah ada policy-nya, nggak butuh tabel baru)
-- ============================================================

alter table leads enable row level security;

create policy "Authenticated users can read leads"
  on leads for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert leads"
  on leads for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update leads"
  on leads for update
  using (auth.role() = 'authenticated');

alter table expenses enable row level security;

create policy "Authenticated users can read expenses"
  on expenses for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert expenses"
  on expenses for insert
  with check (auth.role() = 'authenticated');
