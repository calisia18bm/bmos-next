"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { sendWhatsApp, normalizePhone } from "@/lib/fonnte";
import { recordNotificationFailure } from "@/lib/notifyFailure";
import { SITE_URL } from "@/lib/site";

// PENTING: dulu tiap fungsi di file ini nembak auth.getUser() + query
// user_profiles-nya SENDIRI-SENDIRI, padahal getCurrentProfile() (yang
// di-cache per request di lib/auth.ts) udah nyimpen hasil yang SAMA
// PERSIS. Ganti ke getCurrentProfile() di sini ngilangin panggilan
// auth+DB yang dobel-dobel itu -- kerasa lumayan di halaman Home yang
// manggil getUnreadAnnouncementCount() & markAnnouncementsRead() sekali
// jalan.
async function requireOwnerOrAdmin(): Promise<string | null> {
  const profile = await getCurrentProfile();
  if (!profile) return "Belum login.";

  if (!profile.roles.includes("OWNER") && !profile.roles.includes("ADMIN")) {
    return "Cuma Owner/Admin yang bisa posting pengumuman.";
  }
  return null;
}

// audienceFilter dipakai buat Home murid/laoshi -- cuma ambil pengumuman
// yang emang buat mereka ('ALL' + role mereka sendiri). Owner/Admin (di
// widget kelola) manggil tanpa filter biar liat SEMUA pengumuman.
export async function getAnnouncements(
  limit = 5,
  audienceFilter?: string[],
  opts?: { activeOnly?: boolean }
) {
  const supabase = await createClient();
  let query = supabase
    .from("announcements")
    .select("id, title, message, audience, created_by, created_at, valid_from, valid_until")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (audienceFilter) {
    query = query.in("audience", audienceFilter);
  }

  // Home Murid/Laoshi/Admin CUMA boleh liat pengumuman yang lagi
  // "berlaku" (udah lewat valid_from-nya, belum lewat valid_until-nya).
  // Widget kelola punya BM (activeOnly enggak di-set) sengaja TETAP
  // nampilin SEMUA termasuk yang udah lewat/belum mulai, biar BM masih
  // bisa liat & hapus riwayatnya.
  if (opts?.activeOnly) {
    const today = new Date().toISOString().slice(0, 10);
    query = query
      .or(`valid_from.is.null,valid_from.lte.${today}`)
      .or(`valid_until.is.null,valid_until.gte.${today}`);
  }

  const { data } = await query;
  return data ?? [];
}

// Berapa banyak pengumuman yang belum pernah dibuka user yang lagi login
// -- dipakai buat badge notif angka di sidebar (menu "Home"). Owner ga
// dihitung (dashboard Owner sendiri ga nampilin widget Pengumuman, jadi
// ga relevan buat dia).
export async function getUnreadAnnouncementCount(): Promise<number> {
  const profile = await getCurrentProfile();
  if (!profile) return 0;
  if (profile.roles.includes("OWNER")) return 0;

  const isTeacher = profile.roles.includes("TEACHER");
  const isStudent = profile.roles.includes("STUDENT");
  const audience = isTeacher
    ? ["ALL", "TEACHER"]
    : isStudent
    ? ["ALL", "STUDENT"]
    : ["ALL"];

  const supabase = await createClient();
  const { count } = await supabase
    .from("announcements")
    .select("*", { count: "exact", head: true })
    .in("audience", audience)
    .gt("created_at", profile.last_announcement_read_at);

  return count ?? 0;
}

// Dipanggil dari Home (SimpleHome) tiap kali user (Laoshi/Murid/Admin)
// buka halaman itu & lihat widget Pengumuman -- nandain "udah dibaca
// sampai sekarang", biar badge notif di sidebar ilang.
export async function markAnnouncementsRead() {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const supabase = await createClient();
  await supabase
    .from("user_profiles")
    .update({ last_announcement_read_at: new Date().toISOString() })
    .eq("id", profile.id);
}

export async function createAnnouncement(input: {
  title: string;
  message: string;
  audience: "ALL" | "TEACHER" | "STUDENT";
  validFrom?: string;
  validUntil?: string;
}) {
  const authError = await requireOwnerOrAdmin();
  if (authError) return { success: false, message: authError };

  const profile = await getCurrentProfile();

  const title = input.title.trim();
  const message = input.message.trim();
  if (!title || !message) {
    return { success: false, message: "Judul dan isi pengumuman wajib diisi." };
  }

  if (
    input.validFrom &&
    input.validUntil &&
    input.validFrom > input.validUntil
  ) {
    return {
      success: false,
      message: "Tanggal mulai enggak boleh setelah tanggal berakhir.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("announcements").insert({
    title,
    message,
    audience: input.audience,
    created_by: profile?.full_name || "BM",
    valid_from: input.validFrom || null,
    valid_until: input.validUntil || null,
  });

  if (error) return { success: false, message: error.message };

  // Kabarin Laoshi/Murid yang jadi target lewat WhatsApp begitu ada
  // pengumuman baru diposting -- CUMA info singkat "ada pengumuman
  // baru, cek di web", isi pengumumannya SENGAJA GA ditulis di WA (biar
  // orangnya buka web buat baca lengkapnya, dan biar pesan WA-nya tetap
  // pendek walau isi pengumumannya panjang).
  await notifyAnnouncementTargets(input.audience);

  revalidatePath("/", "layout");
  return { success: true, message: "Pengumuman berhasil diposting." };
}

// Kirim WA "ada pengumuman baru" ke semua Laoshi dan/atau Murid yang
// jadi target (sesuai audience yang dipilih BM pas posting), yang udah
// punya nomor HP di data Teachers/Students. Best effort -- gagal kirim
// ke satu orang ga bikin posting pengumumannya gagal, cuma dicatet ke
// recordNotificationFailure.
async function notifyAnnouncementTargets(audience: "ALL" | "TEACHER" | "STUDENT") {
  const supabase = await createClient();
  const notifyMsg = `📢 Ada pengumuman baru dari BM! Cek di ${SITE_URL} ya.`;

  if (audience === "ALL" || audience === "TEACHER") {
    const { data: teachers } = await supabase.from("teachers").select("name, phone");
    for (const t of teachers ?? []) {
      if (!t.phone) continue;
      try {
        const result = await sendWhatsApp(normalizePhone(t.phone), notifyMsg);
        if (!result.success) {
          await recordNotificationFailure(
            `Gagal kirim notif "pengumuman baru" ke Laoshi ${t.name || "-"} (${t.phone}). Alasan: ${result.reason || "tidak diketahui"}.`
          );
        }
      } catch (err) {
        await recordNotificationFailure(
          `Gagal kirim notif "pengumuman baru" ke Laoshi ${t.name || "-"} (${t.phone}). Error: ${err instanceof Error ? err.message : String(err)}.`
        );
      }
    }
  }

  if (audience === "ALL" || audience === "STUDENT") {
    const { data: students } = await supabase.from("students").select("name, phone");
    for (const s of students ?? []) {
      if (!s.phone) continue;
      try {
        const result = await sendWhatsApp(normalizePhone(s.phone), notifyMsg);
        if (!result.success) {
          await recordNotificationFailure(
            `Gagal kirim notif "pengumuman baru" ke Murid ${s.name || "-"} (${s.phone}). Alasan: ${result.reason || "tidak diketahui"}.`
          );
        }
      } catch (err) {
        await recordNotificationFailure(
          `Gagal kirim notif "pengumuman baru" ke Murid ${s.name || "-"} (${s.phone}). Error: ${err instanceof Error ? err.message : String(err)}.`
        );
      }
    }
  }
}

export async function deleteAnnouncement(id: string) {
  const authError = await requireOwnerOrAdmin();
  if (authError) return { success: false, message: authError };

  const supabase = await createClient();
  const { error } = await supabase.from("announcements").delete().eq("id", id);
  if (error) return { success: false, message: error.message };

  revalidatePath("/", "layout");
  return { success: true, message: "Pengumuman dihapus." };
}
