// Helper buat nyatet & ngabarin BM tiap kali notifikasi
// WhatsApp ke Laoshi/Murid/BM GAGAL terkirim -- entah karena nomor
// HP-nya kosong di data, atau errornya dari Fonnte sendiri. Dipanggil
// dari mana aja yang ngirim WA proaktif ke orang lain (bukan cuma
// Class Card, biar gampang dipake lagi kalau ada fitur WA baru nanti).
//
// Kenapa dicatet ke DB (bukan cuma dikirim WA doang): kalau yang lagi
// bermasalah itu WhatsApp-nya sendiri (misal device Fonnte disconnect),
// alert WA ke BM juga ikut gagal terkirim -- jadi BM
// ga akan pernah tau ada yang gagal. Catatan di DB tetep muncul di
// widget "Need Attention" Home BM walau semua WA lagi mati.
import { createClient } from "@/lib/supabase/server";
import { sendWhatsApp } from "@/lib/fonnte";
import { SITE_URL } from "@/lib/site";

export async function recordNotificationFailure(message: string) {
  try {
    const supabase = await createClient();
    await supabase.from("notification_failures").insert({ message });
  } catch (err) {
    console.error("[recordNotificationFailure] gagal simpan ke DB:", err);
  }

  // Best effort -- kirim juga ke WA BM & (kalau di-set) BM. Kalau
  // dua-duanya kosong atau gagal, ga masalah, catatan di DB tetap ada.
  const alertNumbers = [
    process.env.OWNER_WHATSAPP_NUMBER,
    process.env.ADMIN_WHATSAPP_NUMBER,
  ].filter((n): n is string => Boolean(n));

  for (const number of alertNumbers) {
    try {
      const result = await sendWhatsApp(
        number,
        `⚠️ Notifikasi WA gagal terkirim:\n\n${message}\n\nCek: ${SITE_URL}`
      );
      console.log(
        "[recordNotificationFailure] hasil kirim alert WA:",
        JSON.stringify(result)
      );
    } catch (err) {
      console.error("[recordNotificationFailure] gagal kirim alert WA:", err);
    }
  }
}
