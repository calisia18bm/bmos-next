-- ============================================================
-- Tambahan RLS: izinkan tambah data di Teachers, Classes,
-- dan izinkan baca/tambah/hapus di Attendance.
-- ============================================================

create policy "Authenticated users can insert teachers"
  on teachers for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can insert classes"
  on classes for insert
  with check (auth.role() = 'authenticated');

alter table attendance enable row level security;

create policy "Authenticated users can read attendance"
  on attendance for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert attendance"
  on attendance for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can delete attendance"
  on attendance for delete
  using (auth.role() = 'authenticated');
