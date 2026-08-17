"use server";

import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `Kamu adalah asisten AI buat BM Masterclass, sekolah les Mandarin.
Jawab pertanyaan owner/staff berdasarkan data ringkasan yang dikasih.
Jawab singkat, jelas, dalam Bahasa Indonesia. Kalau data nggak cukup buat
jawab, bilang terus terang butuh data apa.`;

export async function askAssistant(question: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      message:
        "ANTHROPIC_API_KEY belum di-set di Vercel. Tambahkan dulu di Project Settings > Environment Variables.",
    };
  }

  const supabase = await createClient();

  const [
    { count: studentCount },
    { count: teacherCount },
    { count: classCount },
    { data: payments },
    { data: expenses },
    { data: pendingFollowUps },
  ] = await Promise.all([
    supabase.from("students").select("*", { count: "exact", head: true }).eq("status", "ACTIVE"),
    supabase.from("teachers").select("*", { count: "exact", head: true }).eq("active", true),
    supabase.from("classes").select("*", { count: "exact", head: true }).eq("active", true),
    supabase.from("payments").select("amount"),
    supabase.from("expenses").select("amount"),
    supabase.from("follow_ups").select("note, due_date").eq("completed", false),
  ]);

  const totalIncome = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const totalExpense = (expenses ?? []).reduce((s, e) => s + Number(e.amount), 0);

  const context = {
    activeStudents: studentCount,
    activeTeachers: teacherCount,
    activeClasses: classCount,
    totalIncome,
    totalExpense,
    netProfit: totalIncome - totalExpense,
    pendingFollowUps: (pendingFollowUps ?? []).length,
  };

  try {
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Data ringkasan sekolah saat ini: ${JSON.stringify(
            context
          )}\n\nPertanyaan: ${question}`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const answer = textBlock && "text" in textBlock ? textBlock.text : "";

    return { success: true, message: answer };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Gagal menghubungi AI.",
    };
  }
}
