-- ============================================================
-- BMOS Database Schema (Supabase / PostgreSQL)
-- Dirancang berdasarkan struktur Google Sheets BMOS yang lama.
-- Jalankan file ini di Supabase SQL Editor.
-- ============================================================

-- Extension buat generate UUID
create extension if not exists "uuid-ossp";

-- ============================================================
-- PEOPLE — identitas terpusat (dasar dari Students/Teachers/Users)
-- ============================================================
create table people (
  id uuid primary key default uuid_generate_v4(),
  person_code text unique not null, -- e.g. P0001
  name text not null,
  email text,
  phone text,
  roles text[] not null default '{}', -- e.g. {OWNER,STUDENT}
  status text not null default 'ACTIVE', -- ACTIVE / INACTIVE
  created_at timestamptz not null default now()
);

-- ============================================================
-- TEACHERS (Daftar Laoshi)
-- ============================================================
create table teachers (
  id uuid primary key default uuid_generate_v4(),
  teacher_code text unique not null, -- e.g. L001
  person_id uuid references people(id),
  name text not null,
  phone text,
  rate_per_session numeric default 0,
  sessions_per_payout int default 8,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============================================================
-- CLASSES (Daftar Kelas)
-- ============================================================
create table classes (
  id uuid primary key default uuid_generate_v4(),
  class_code text unique not null, -- e.g. K001
  name text not null, -- e.g. "芒果班🥭"
  category text,
  program_name text,
  teacher_id uuid references teachers(id),
  teacher_name text, -- denormalized for quick display
  day_of_week text, -- Senin..Minggu
  start_time time,
  end_time time,
  capacity_max int default 6,
  active boolean not null default true,
  registration_open boolean not null default true,
  needs_weekly_vote boolean not null default false, -- kelas fleksibel (multi-laoshi)
  wa_group_id text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- PRODUCTS (paket harga)
-- ============================================================
create table products (
  id uuid primary key default uuid_generate_v4(),
  product_code text unique not null, -- e.g. PRD001
  name text not null,
  sessions_count int not null,
  price numeric not null,
  active boolean not null default true
);

-- ============================================================
-- STUDENTS (Daftar Murid)
-- ============================================================
create table students (
  id uuid primary key default uuid_generate_v4(),
  student_code text unique not null, -- e.g. M0001
  person_id uuid references people(id),
  name text not null,
  phone text,
  class_id uuid references classes(id),
  class_name text, -- denormalized
  teacher_name text, -- denormalized
  package_product_id uuid references products(id),
  sessions_per_package int default 4,
  package_price numeric default 0,
  sessions_used int default 0,
  payment_status text default 'AKTIF', -- AKTIF / JATUH TEMPO / NON-AKTIF
  status text not null default 'ACTIVE', -- ACTIVE / INACTIVE
  created_at timestamptz not null default now()
);

-- ============================================================
-- ENROLLMENT — riwayat pendaftaran murid per kelas/paket
-- ============================================================
create table enrollments (
  id uuid primary key default uuid_generate_v4(),
  enrollment_code text unique not null, -- e.g. ENR00001
  student_id uuid references students(id) not null,
  class_id uuid references classes(id) not null,
  product_id uuid references products(id),
  status text not null default 'ACTIVE', -- ACTIVE / FINISHED / CANCELLED
  started_at date not null default current_date,
  ended_at date,
  created_at timestamptz not null default now()
);

-- ============================================================
-- SESSION — sesi kelas konkret (tanggal tertentu)
-- ============================================================
create table sessions (
  id uuid primary key default uuid_generate_v4(),
  session_code text unique not null, -- e.g. SES00001
  class_id uuid references classes(id) not null,
  class_name text,
  teacher_planned text, -- laoshi utama terjadwal
  teacher_actual text, -- laoshi yang beneran ngajar (bisa beda kalau gantian)
  session_date date not null,
  start_time time,
  end_time time,
  status text not null default 'UPCOMING', -- UPCOMING/ACTIVE/FINISHED/CANCELLED/RESCHEDULED
  cancel_reason text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- ATTENDANCE (Absensi)
-- ============================================================
create table attendance (
  id uuid primary key default uuid_generate_v4(),
  session_id uuid references sessions(id),
  student_id uuid references students(id) not null,
  class_id uuid references classes(id),
  attendance_date date not null,
  status text not null default 'HADIR', -- HADIR / IZIN / ALPHA
  recorded_by uuid references people(id),
  created_at timestamptz not null default now()
);

-- ============================================================
-- PAYMENTS (PaymentPemasukan)
-- ============================================================
create table payments (
  id uuid primary key default uuid_generate_v4(),
  transaction_code text unique not null,
  student_id uuid references students(id),
  student_name text,
  amount numeric not null,
  payment_date date not null default current_date,
  method text, -- transfer / cash / dll
  status text not null default 'CONFIRMED', -- PENDING/CONFIRMED/REJECTED
  notes text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- EXPENSES (Pengeluaran)
-- ============================================================
create table expenses (
  id uuid primary key default uuid_generate_v4(),
  expense_code text unique not null,
  category text not null, -- Gaji Laoshi / Operasional / dll
  description text,
  amount numeric not null,
  expense_date date not null default current_date,
  created_at timestamptz not null default now()
);

-- ============================================================
-- PAYROLL
-- ============================================================
create table payroll (
  id uuid primary key default uuid_generate_v4(),
  payroll_code text unique not null,
  teacher_id uuid references teachers(id) not null,
  teacher_name text,
  period_start date not null,
  period_end date not null,
  sessions_count int not null default 0,
  rate_per_session numeric not null default 0,
  total_amount numeric not null default 0,
  status text not null default 'DRAFT', -- DRAFT/APPROVED/PAID
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

-- ============================================================
-- LEADS / TRIALS / FOLLOW UP (CRM)
-- ============================================================
create table leads (
  id uuid primary key default uuid_generate_v4(),
  lead_code text unique not null,
  name text not null,
  phone text,
  source text,
  status text not null default 'NEW',
  notes text,
  created_at timestamptz not null default now()
);

create table trials (
  id uuid primary key default uuid_generate_v4(),
  trial_code text unique not null,
  lead_id uuid references leads(id),
  name text not null,
  phone text,
  class_id uuid references classes(id),
  scheduled_date date,
  status text not null default 'SCHEDULED',
  created_at timestamptz not null default now()
);

create table follow_ups (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid references leads(id),
  due_date date not null,
  note text,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- USERS / AUTH — dipetakan ke Supabase Auth (auth.users)
-- Tabel ini nyimpen data TAMBAHAN yang Supabase Auth nggak simpen
-- ============================================================
create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  person_id uuid references people(id),
  email text not null,
  roles text[] not null default '{}',
  active_role text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- AUDIT LOG
-- ============================================================
create table audit_log (
  id uuid primary key default uuid_generate_v4(),
  actor_email text,
  action text not null,
  entity text,
  entity_id text,
  detail text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Indexes penting buat performa
-- ============================================================
create index idx_students_class on students(class_id);
create index idx_attendance_student on attendance(student_id);
create index idx_attendance_date on attendance(attendance_date);
create index idx_sessions_class_date on sessions(class_id, session_date);
create index idx_payments_student on payments(student_id);
create index idx_payroll_teacher on payroll(teacher_id);
