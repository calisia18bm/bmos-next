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

// Kirim POLL WhatsApp beneran (bisa di-tap, bukan cuma teks minta
// balas). `pollname` dipake buat identifikasi poll ini pas hasil
// vote-nya balik lewat webhook -- HARUS unik & konsisten sama yang
// dicocokin di app/api/webhooks/fonnte/route.ts.
export async function sendWhatsAppPoll(
  target: string,
  opts: { pollname: string; choices: string[]; select?: "single" | "multiple" }
) {
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
      body: new URLSearchParams({
        target,
        pollname: opts.pollname,
        choices: opts.choices.join(","),
        select: opts.select || "single",
      }),
    });

    const data = await res.json();
    return { success: true, data };
  } catch (error) {
    console.error("Gagal kirim WA poll:", error);
    return { success: false, reason: "fetch_error" };
  }
}

// Format label pilihan poll -- dipake pas KIRIM poll (weeklyChoicePoll.ts)
// dan pas BACA hasil vote (webhook route) supaya string-nya PERSIS sama,
// biar bisa di-match balik ke class_id yang bener.
export function choiceLabel(
  teacherName: string | null,
  dayOfWeek: string | null,
  startTime: string | null
) {
  return `${teacherName || "-"} (${dayOfWeek || "-"}${
    startTime ? `, ${startTime.slice(0, 5)}` : ""
  })`;
}
