-- ============================================================
-- Bahan Ajar Berbayar (Laoshi beli PPT/materi dari Admin/Owner)
-- Jalankan ini SEKALI di Supabase SQL Editor.
--
-- Owner/Admin bisa kasih harga (atau Rp 0 / Gratis) pas upload bahan ajar
-- ke teacher_resources. Kalau harganya > 0, Laoshi WAJIB transfer + upload
-- bukti dulu (mirip alur Join Kelas Murid) sebelum bisa lihat/download
-- PDF-nya -- request-nya di-review manual sama Owner/Admin (AI cuma bantu
-- baca bukti transfer, BUKAN yang mutusin approve/reject).
-- ============================================================

alter table teacher_resources
  add column if not exists price numeric not null default 0; -- 0 = Gratis

create table if not exists teacher_resource_purchases (
  id uuid primary key default uuid_generate_v4(),
  teacher_id uuid references teachers(id) not null,
  resource_id uuid references teacher_resources(id) not null,
  request_status text not null default 'PENDING', -- PENDING / APPROVED / REJECTED
  status text not null default 'PENDING', -- PENDING / ACTIVE / CANCELLED
  payment_proof_url text,
  payment_proof_path text,
  ai_payment_note text, -- ringkasan AI baca bukti bayar (BUKAN keputusan approve/reject)
  reviewed_by_name text,
  rejection_note text,
  requested_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_teacher_resource_purchases_teacher on teacher_resource_purchases(teacher_id);
create index if not exists idx_teacher_resource_purchases_resource on teacher_resource_purchases(resource_id);
create index if not exists idx_teacher_resource_purchases_status on teacher_resource_purchases(request_status);

alter table teacher_resource_purchases enable row level security;

drop policy if exists "Authenticated users can read teacher_resource_purchases" on teacher_resource_purchases;
create policy "Authenticated users can read teacher_resource_purchases"
  on teacher_resource_purchases for select
  using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can insert teacher_resource_purchases" on teacher_resource_purchases;
create policy "Authenticated users can insert teacher_resource_purchases"
  on teacher_resource_purchases for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can update teacher_resource_purchases" on teacher_resource_purchases;
create policy "Authenticated users can update teacher_resource_purchases"
  on teacher_resource_purchases for update
  using (auth.role() = 'authenticated');

-- Bukti transfer bahan ajar dipakai bucket "payment-proofs" yang sama
-- kayak fitur Join Kelas (lihat database/add_class_join_requests.sql) --
-- ga perlu bucket baru.
