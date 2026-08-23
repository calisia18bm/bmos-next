-- ============================================================
-- Kelas by Card -- Laoshi bikin kelas sendiri (kartu: nama, jadwal,
-- harga, kuota, tujuan belajar/HSK dll), submit buat di-approve Owner,
-- baru muncul di halaman Classes (Admin) & bisa dipilih Murid buat join.
-- Jalankan ini SEKALI di Supabase SQL Editor.
-- ============================================================

alter table classes
  add column if not exists approval_status text not null default 'APPROVED', -- DRAFT/PENDING/APPROVED/REJECTED
  add column if not exists created_by_teacher_id uuid references teachers(id), -- Laoshi yang submit kartu ini
  add column if not exists is_private boolean not null default false,
  add column if not exists registration_start date,
  add column if not exists registration_end date,
  add column if not exists price numeric, -- harga per paket, ditentukan Laoshi sendiri
  add column if not exists sessions_count int, -- jumlah sesi per paket
  add column if not exists goal_tags text[] not null default '{}', -- HSK1..6, PERCAKAPAN, dll (lihat lib/classCards.ts)
  add column if not exists description text,
  add column if not exists rejection_note text, -- alasan Owner kalau reject
  add column if not exists ai_note text; -- catatan/saran otomatis buat Owner pas approval

-- Kelas yang UDAH ADA sebelumnya (dibikin manual sama Admin lewat halaman
-- Classes) otomatis kebawa 'APPROVED' dari default di atas, jadi ga ada
-- yang keganggu / ilang dari halaman Classes.

create index if not exists idx_classes_approval_status on classes(approval_status);
create index if not exists idx_classes_created_by_teacher on classes(created_by_teacher_id);

-- Laoshi butuh bisa UPDATE baris kelas kartu miliknya sendiri (misal edit
-- ulang abis di-reject Owner), Owner butuh update buat approve/reject.
-- Ikut pola tabel lain di app ini: RLS dibuka broad buat semua yang udah
-- login, kontrol akses SEBENARNYA dicek di server action
-- (app/(app)/class-cards/actions.ts), bukan di RLS.
drop policy if exists "Authenticated users can update classes" on classes;
create policy "Authenticated users can update classes"
  on classes for update
  using (auth.role() = 'authenticated');

-- ============================================================
-- Pengaturan potongan komisi BM per tier harga, diatur Owner dari
-- halaman "Buat Kelas" (bagian Owner). Default: <=100rb potong 20%,
-- <=200rb potong 15%, di atas itu potong 10%.
-- ============================================================
alter table app_settings
  add column if not exists commission_tiers jsonb not null default
  '[{"maxPrice":100000,"pct":20},{"maxPrice":200000,"pct":15},{"maxPrice":null,"pct":10}]'::jsonb;

-- ============================================================
-- Katalog Tujuan Belajar (badge kayak HSK, China Buddy, dll) yang
-- muncul di kartu kelas -- sekarang diatur Owner sendiri (bisa
-- nambah/hapus/edit dari halaman Class Card bagian Owner), bukan
-- di-hardcode di kode lagi.
-- ============================================================
alter table app_settings
  add column if not exists goal_tags jsonb not null default
  '["HSK 1","HSK 2","HSK 3","HSK 4","HSK 5","HSK 6","Percakapan Sehari-hari","Pasangan Bicara / China Buddy","Mandarin Bisnis","Anak-anak","Persiapan Sekolah / Ujian"]'::jsonb;
