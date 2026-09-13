-- ============================================================
-- Request Join Kelas (payment-gated) + Kelas Seminar/Sekali Pertemuan
-- Jalankan ini SEKALI di Supabase SQL Editor.
--
-- Latar belakang: sebelumnya klik "Join Kelas" langsung bikin Murid
-- masuk kelas (instant), dan 1 Murid cuma bisa punya 1 kelas aktif
-- (students.class_id). Sekarang:
--   1. Join Kelas ga langsung masuk -- Murid upload bukti transfer,
--      AI baca buktinya (BUKAN auto-approve, cuma bantu baca), Owner/
--      Admin yang approve/reject manual di halaman Class Card.
--   2. Kelas ditandain "Reguler" (mingguan, tetap cuma 1 slot aktif
--      per Murid kayak sebelumnya) atau "Seminar" (sekali pertemuan --
--      Murid BOLEH join lebih dari satu Seminar sekaligus, asal jadwal
--      Seminar itu ga bentrok jam-nya sama kelas aktif Murid yang lain).
-- ============================================================

alter table classes
  add column if not exists class_type text not null default 'REGULAR'; -- REGULAR / SEMINAR

alter table enrollments
  add column if not exists request_status text not null default 'APPROVED', -- PENDING / APPROVED / REJECTED
  add column if not exists payment_proof_url text,
  add column if not exists payment_proof_path text,
  add column if not exists ai_payment_note text, -- ringkasan AI baca bukti bayar (BUKAN keputusan approve/reject)
  add column if not exists reviewed_by_name text,
  add column if not exists rejection_note text,
  add column if not exists requested_at timestamptz not null default now();

create index if not exists idx_classes_class_type on classes(class_type);
create index if not exists idx_enrollments_request_status on enrollments(request_status);
create index if not exists idx_enrollments_student_id on enrollments(student_id);

-- Baris enrollment yang UDAH ADA sebelumnya (dari fitur join yang lama)
-- otomatis kebawa 'APPROVED' dari default di atas, jadi ga ada histori
-- yang keganggu / ilang.

-- ============================================================
-- Storage bucket buat bukti transfer/pembayaran yang diupload Murid.
-- ============================================================
insert into storage.buckets (id, name, public)
values ('payment-proofs', 'payment-proofs', true)
on conflict (id) do nothing;

drop policy if exists "Authenticated users can upload payment-proofs files" on storage.objects;
create policy "Authenticated users can upload payment-proofs files"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'payment-proofs');

drop policy if exists "Anyone can view payment-proofs files" on storage.objects;
create policy "Anyone can view payment-proofs files"
  on storage.objects for select
  using (bucket_id = 'payment-proofs');

drop policy if exists "Authenticated users can delete payment-proofs files" on storage.objects;
create policy "Authenticated users can delete payment-proofs files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'payment-proofs');
