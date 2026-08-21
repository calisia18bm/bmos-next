import { createAdminClient } from "@/lib/supabase/admin";
import { sendWhatsAppPoll, choiceLabel } from "@/lib/fonnte";

// pollname dipake buat "nametag" poll ini pas hasil votenya balik lewat
// webhook (app/api/webhooks/fonnte/route.ts) -- formatnya:
// WC|{nama kelas}|{week_start (YYYY-MM-DD)}
// Dipisah pake "|" karena nama kelas sering ada emoji, tapi ga pernah
// ada karakter "|".
export function buildPollName(className: string, weekStart: string) {
  return `WC|${className}|${weekStart}`;
}

export function parsePollName(pollname: string) {
  const parts = pollname.split("|");
  if (parts.length !== 3 || parts[0] !== "WC") return null;
  return { className: parts[1], weekStart: parts[2] };
}

function getMondayOfWeek(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday.toISOString().slice(0, 10);
}

export async function sendWeeklyChoicePolls() {
  const supabase = createAdminClient();
  const weekStart = getMondayOfWeek();

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

    // Choice-nya HARUS persis sama formatnya kayak yang dipake buat
    // matching balik di webhook (choiceLabel di lib/fonnte.ts) --
    // jangan diubah salah satu doang, ntar votenya ga ke-match.
    const choices = (group ?? []).map((c) => choiceLabel(c.teacher_name, c.day_of_week, c.start_time));

    const pollname = buildPollName(className, weekStart);

    for (const groupId of [...new Set(waGroupIds)]) {
      await sendWhatsAppPoll(groupId, {
        pollname,
        choices,
        select: "single",
      });
      sentCount++;
    }
    results.push(`${className}: poll terkirim ke ${waGroupIds.length} grup`);
  }

  return { sentCount, results };
}
