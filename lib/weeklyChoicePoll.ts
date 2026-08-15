import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsApp } from "@/lib/fonnte";

export async function sendWeeklyChoicePolls() {
  const supabase = createAdminClient();

  const { data: classes } = await supabase
    .from("classes")
    .select("*")
    .eq("active", true);

  const byName: Record<string, typeof classes> = {};
  (classes ?? []).forEach((c) => {
    if (!byName[c.name]) byName[c.name] = [];
    byName[c.name]!.push(c);
  });

  const flexibleGroups = Object.entries(byName).filter(([, g]) => (g?.length ?? 0) > 1);

  let sentCount = 0;
  const results: string[] = [];

  for (const [className, group] of flexibleGroups) {
    const waGroupIds = (group ?? [])
      .map((c) => c.wa_group_id)
      .filter((id): id is string => Boolean(id));

    if (waGroupIds.length === 0) {
      results.push(`${className}: dilewati (belum ada ID Grup WA)`);
      continue;
    }

    const teacherOptions = (group ?? [])
      .map((c) => `- Balas "${c.teacher_name}" buat pilih Laoshi ${c.teacher_name} (${c.day_of_week})`)
      .join("\n");

    const message = `🔄 Konfirmasi Pilihan Minggu Ini -- Kelas ${className}\n\nHalo! Kelas ini diajar bergantian minggu ini. Tolong balas chat ini buat konfirmasi mau ikut sesi Laoshi yang mana:\n\n${teacherOptions}`;

    for (const groupId of [...new Set(waGroupIds)]) {
      await sendWhatsApp(groupId, message);
      sentCount++;
    }
    results.push(`${className}: terkirim ke ${waGroupIds.length} grup`);
  }

  return { sentCount, results };
}
