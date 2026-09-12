import { normalizePhone } from "@/lib/fonnte";

// Tombol "Hubungi Admin" cuma muncul kalau ADMIN_WHATSAPP_NUMBER di-set
// di Vercel -- kalau belum di-set, halaman tetap tampil (cuma tanpa
// tombolnya) daripada rusak/error.
export default function NoAccessPage() {
  const adminPhone = process.env.ADMIN_WHATSAPP_NUMBER;
  const waLink = adminPhone
    ? `https://wa.me/${normalizePhone(adminPhone)}?text=${encodeURIComponent(
        "Halo, akun saya di BM Mandarin App belum diaktifkan, mohon dibantu ya"
      )}`
    : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-bmos-primary-soft flex items-center justify-center mx-auto mb-4 text-2xl">
          🔒
        </div>
        <h1 className="text-xl font-bold text-bmos-text mb-2">
          Akun belum diaktifkan
        </h1>
        <p className="text-sm text-bmos-text-light mb-6">
          Akun kamu berhasil login, tapi belum diaktifkan oleh admin.
          Hubungi admin BM Mandarin untuk mengaktifkan akses kamu.
        </p>
        {waLink && (
          <a
            href={waLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 bg-bmos-primary text-white font-semibold rounded-xl px-5 py-3 hover:opacity-90 transition"
          >
            💬 Hubungi Admin via WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}
