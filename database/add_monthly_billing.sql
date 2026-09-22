-- ============================================================
-- Sistem pembayaran BULANAN buat Class Card (langganan per bulan +
-- jatuh tempo otomatis), sebagai alternatif dari sistem "harga per
-- paket sesi" yang lama. Kelas LAMA yang udah jalan TETAP pakai sistem
-- sesi (billing_type default 'SESSION'), cuma Class Card BARU yang bisa
-- pilih pakai billing_type 'MONTHLY'.
--
-- Jalankan ini SEKALI di Supabase SQL Editor.
-- ============================================================

-- classes: harga bulanan + opsi bayar 3 bulan sekaligus (dengan diskon)
alter table classes
  add column if not exists billing_type text default 'SESSION'; -- 'SESSION' / 'MONTHLY'
alter table classes
  add column if not exists monthly_price numeric;
alter table classes
  add column if not exists three_month_discount_pct numeric default 0;

-- enrollments: siklus pembayaran Murid yang dipilih pas join (1 atau 3
-- bulan), kapan jatuh tempo berikutnya, & kapan terakhir bayar.
alter table enrollments
  add column if not exists billing_cycle_months integer default 1;
alter table enrollments
  add column if not exists next_due_date date;
alter table enrollments
  add column if not exists last_paid_at date;

-- Riwayat pembayaran bulanan (selain pembayaran PERTAMA yang udah
-- kesimpen di enrollments.payment_proof_url) -- tiap kali Murid bayar
-- lagi buat lanjut kelas, satu baris baru di sini, direview BM kayak
-- request join.
create table if not exists monthly_payments (
  id uuid primary key default uuid_generate_v4(),
  enrollment_id uuid references enrollments(id) on delete cascade not null,
  student_id uuid references students(id) on delete cascade not null,
  class_id uuid references classes(id) on delete cascade not null,
  cycle_months integer not null default 1,
  amount numeric,
  payment_proof_url text,
  payment_proof_path text,
  ai_payment_note text,
  request_status text not null default 'PENDING', -- PENDING / APPROVED / REJECTED
  rejection_note text,
  reviewed_by_name text,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table monthly_payments enable row level security;

drop policy if exists "Authenticated users can read monthly_payments" on monthly_payments;
create policy "Authenticated users can read monthly_payments"
  on monthly_payments for select
  using (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can insert monthly_payments" on monthly_payments;
create policy "Authenticated users can insert monthly_payments"
  on monthly_payments for insert
  with check (auth.role() = 'authenticated');

drop policy if exists "Authenticated users can update monthly_payments" on monthly_payments;
create policy "Authenticated users can update monthly_payments"
  on monthly_payments for update
  using (auth.role() = 'authenticated');

-- app_settings: minimal berapa bulan bahan ajar (PPT) yang wajib dibeli
-- Laoshi dulu sebelum bisa buka Class Card baru -- diatur Owner.
alter table app_settings
  add column if not exists min_teacher_resource_months integer default 3;
