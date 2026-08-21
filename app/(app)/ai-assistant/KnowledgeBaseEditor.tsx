"use client";

import { useState } from "react";
import { saveKnowledgeBase } from "./actions";

export default function KnowledgeBaseEditor({
  initialText,
}: {
  initialText: string;
}) {
  const [text, setText] = useState(initialText);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSave() {
    setSaving(true);
    setMessage("");
    const res = await saveKnowledgeBase(text);
    setSaving(false);
    setMessage(res.message);
  }

  return (
    <div className="bg-white border border-bmos-border rounded-2xl p-6 mb-6">
      <h2 className="font-bold text-bmos-text text-lg mb-1">
        Buku Panduan AI
      </h2>
      <p className="text-xs text-bmos-text-light mb-4">
        Tulis semua info yang AI perlu tau buat jawab calon murid/murid --
        harga paket, jadwal kelas, kurikulum, kebijakan (reschedule, refund,
        dll), FAQ yang sering ditanya, dsb. Semakin lengkap, semakin akurat
        jawaban AI-nya. Ini yang dipakai AI buat auto-reply WhatsApp DAN
        buat jawab di kotak chat test di bawah.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={14}
        placeholder={`Contoh:\n\nHarga Paket:\n- 4 sesi: Rp800.000\n- 8 sesi: Rp1.500.000\n\nJadwal:\n- Kelas Pemula: Senin & Kamis 16:00-17:30\n\nKebijakan:\n- Reschedule maksimal H-1\n- Trial class gratis 1x sebelum daftar\n\nFAQ:\nQ: Metodenya gimana?\nA: ...`}
        className="w-full border border-bmos-border rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
      />
      <div className="flex items-center justify-between mt-3">
        {message && <p className="text-xs text-bmos-text-light">{message}</p>}
        <button
          onClick={handleSave}
          disabled={saving}
          className="ml-auto bg-bmos-primary text-white rounded-xl px-4 py-2 text-sm font-semibold hover:bg-bmos-primary-light transition disabled:opacity-60"
        >
          {saving ? "Menyimpan..." : "Simpan"}
        </button>
      </div>
    </div>
  );
}
