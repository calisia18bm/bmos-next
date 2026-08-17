-- ============================================================
-- RLS buat Payments & Payroll
-- ============================================================

alter table payments enable row level security;

create policy "Authenticated users can read payments"
  on payments for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert payments"
  on payments for insert
  with check (auth.role() = 'authenticated');

alter table payroll enable row level security;

create policy "Authenticated users can read payroll"
  on payroll for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert payroll"
  on payroll for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update payroll"
  on payroll for update
  using (auth.role() = 'authenticated');
