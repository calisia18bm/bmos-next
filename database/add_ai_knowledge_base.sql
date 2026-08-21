-- Nambah kolom buat nyimpen "buku panduan" AI (FAQ, harga, jadwal,
-- kebijakan sekolah, dll) yang Owner tulis/edit sendiri di halaman
-- AI Assistant -- dipakai AI buat jawab calon murid/murid, baik di
-- chat test di website maupun auto-reply WhatsApp.
-- Jalankan ini SEKALI di Supabase SQL Editor.

alter table app_settings
  add column if not exists ai_knowledge_base text;
