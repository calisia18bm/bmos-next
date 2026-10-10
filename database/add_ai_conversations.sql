-- Menyimpan setiap tanya-jawab AI di WhatsApp (pertanyaan, jawaban, dan
-- kategorinya) supaya bisa ikut ditarik ke Google Sheets. Jalankan SEKALI
-- di Supabase SQL Editor.
create table if not exists ai_conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source text not null default 'WHATSAPP',
  sender_phone text,
  student_id uuid references students(id) on delete set null,
  sender_name text,
  is_registered_student boolean not null default false,
  question text not null,
  answer text,
  category text,
  forwarded_to_admin boolean not null default false
);

create index if not exists idx_ai_conversations_created on ai_conversations(created_at desc);

-- RLS aktif tanpa policy: hanya server (service role) yang bisa baca/tulis.
alter table ai_conversations enable row level security;
