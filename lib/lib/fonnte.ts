/**
 * Helper buat kirim pesan WhatsApp lewat Fonnte.
 * Butuh env var FONNTE_TOKEN di Vercel.
 */

export async function sendWhatsApp(target: string, message: string) {
  const token = process.env.FONNTE_TOKEN;

  if (!token) {
    console.error("FONNTE_TOKEN belum di-set.");
    return { success: false, reason: "no_token" };
  }

  try {
    const res = await fetch("https://api.fonnte.com/send", {
      method: "POST",
      headers: {
        Authorization: token,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ target, message }),
    });

    const data = await res.json();
    return { success: true, data };
  } catch (error) {
    console.error("Gagal kirim WA:", error);
    return { success: false, reason: "fetch_error" };
  }
}

export function normalizePhone(phone: string): string {
  let p = phone.replace(/\D/g, "");
  if (p.startsWith("0")) p = "62" + p.slice(1);
  if (!p.startsWith("62")) p = "62" + p;
  return p;
}
