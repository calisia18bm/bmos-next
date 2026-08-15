-- ============================================================
-- RLS buat Enrollments (riwayat pindah kelas)
-- ============================================================

alter table enrollments enable row level security;

create policy "Authenticated users can read enrollments"
  on enrollments for select
  using (auth.role() = 'authenticated');

create policy "Authenticated users can insert enrollments"
  on enrollments for insert
  with check (auth.role() = 'authenticated');

create policy "Authenticated users can update enrollments"
  on enrollments for update
  using (auth.role() = 'authenticated');

-- ============================================================
-- Backfill: bikin 1 baris Enrollment ACTIVE buat tiap murid yang
-- SEKARANG udah punya kelas, biar riwayatnya nggak kosong dari awal.
-- Aman dijalanin berkali-kali (skip yang udah ada enrollment aktif).
-- ============================================================

insert into enrollments (student_id, class_id, status, started_at)
select s.id, s.class_id, 'ACTIVE', s.created_at::date
from students s
where s.class_id is not null
  and not exists (
    select 1 from enrollments e
    where e.student_id = s.id and e.status = 'ACTIVE'
  );
