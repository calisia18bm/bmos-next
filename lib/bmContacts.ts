import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsApp, normalizePhone } from "@/lib/fonnte";
import { recordNotificationFailure } from "@/lib/notifyFailure";

// Ambil nomor HP semua akun BM (role OWNER atau ADMIN) yang udah diisi
// nomornya di halaman Accounts -- dipakai buat nge-broadcast notif WA
// (misal: ada Murid/Laoshi kirim bukti transfer) ke SEMUA akun BM
// sekaligus, bukan cuma 1 nomor lewat env var kayak dulu
// (OWNER_WHATSAPP_NUMBER). Pakai service role (createAdminClient) biar
// bisa baca nomor HP akun BM LAIN, bukan cuma akun sendiri.
export async function getBmContacts(): Promise<{ name: string; phone: string }[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("user_profiles")
    .select("full_name, phone, roles");

  return (data ?? [])
    .filter((u: any) => (u.roles || []).some((r: string) => r === "OWNER" || r === "ADMIN"))
    .filter((u: any) => !!u.phone)
    .map((u: any) => ({ name: u.full_name || "BM", phone: u.phone as string }));
}

// Kirim 1 pesan WA yang SAMA ke SEMUA akun BM (Owner + Admin) yang
// udah punya nomor HP di Accounts. Best effort -- kalau belum ada
// satupun akun BM yang punya nomor HP, atau pengirimannya gagal, ga
// bikin proses yang manggil ini gagal (request Murid/Laoshi tetap
// kesimpen), tapi dicatet ke recordNotificationFailure biar BM tetap
// tau lewat widget "Need Attention" di Home walau WA-nya lagi
// bermasalah.
export async function broadcastToBm(message: string, context: string) {
  const contacts = await getBmContacts();

  if (contacts.length === 0) {
    await recordNotificationFailure(
      `Belum ada akun BM (Owner/Admin) yang diisi nomor HP-nya di halaman Accounts, jadi notif WA (${context}) enggak bisa dikirim ke siapa-siapa. Tolong isi nomor HP minimal 1 akun BM di Accounts.`
    );
    return;
  }

  for (const contact of contacts) {
    try {
      const result = await sendWhatsApp(normalizePhone(contact.phone), message);
      console.log(
        `[broadcastToBm] kirim ke ${contact.name} (${contact.phone}):`,
        JSON.stringify(result)
      );
      if (!result.success) {
        await recordNotificationFailure(
          `Gagal kirim notif WA (${context}) ke akun BM ${contact.name} (${contact.phone}). Alasan: ${result.reason || "tidak diketahui"}.`
        );
      }
    } catch (err) {
      console.error("[broadcastToBm] error kirim WA:", err);
      await recordNotificationFailure(
        `Gagal kirim notif WA (${context}) ke akun BM ${contact.name} (${contact.phone}). Error: ${
          err instanceof Error ? err.message : String(err)
        }.`
      );
    }
  }
}
