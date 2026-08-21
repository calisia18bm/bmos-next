"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT_BASE = `Kamu adalah admin virtual BM Masterclass, sekolah les Mandarin.
Jawab pesan dari murid/calon murid dengan ramah, singkat, dan jelas dalam
Bahasa Indonesia. Kalau pertanyaannya di luar konteks sekolah atau kamu
nggak yakin jawabannya, bilang akan diteruskan ke admin manusia, jangan
ngarang jawaban.`;

async function requireOwner(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Belum login.";

  const { data: myProfile } = await supabase
    .from("user_profiles")
    .select("roles")
    .eq("id", user.id)
    .maybeSingle();

  const myRoles = myProfile?.roles || [];
  if (!myRoles.includes("OWNER")) {
    return "Cuma Owner yang bisa ubah buku panduan AI.";
  }
  return null;
}

export async function getKnowledgeBase() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("ai_knowledge_base")
    .eq("id", 1)
    .maybeSingle();
  return data?.ai_knowledge_base || "";
}

export async function saveKnowledgeBase(text: string) {
  const authError = await requireOwner();
  if (authError) return { success: false, message: authError };

  const supabase = await createClient();
  const { error } = await supabase
    .from("app_settings")
    .upsert({ id: 1, ai_knowledge_base: text }, { onConflict: "id" });

  if (error) return { success: false, message: error.message };

  revalidatePath("/ai-assistant", "layout");
  return { success: true, message: "Buku panduan AI berhasil disimpan." };
}

// Chat test di halaman ini -- pakai system prompt & knowledge base yang
// PERSIS SAMA kayak yang dipakai buat auto-reply WhatsApp beneran
// (app/api/webhook/fonnte/route.ts), jadi apa yang Owner liat di sini itu
// yang bakal beneran dijawab AI ke calon murid/murid di WA.
export async function askAssistant(question: string) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      message:
        "ANTHROPIC_API_KEY belum di-set di Vercel. Tambahkan dulu di Project Settings > Environment Variables.",
    };
  }

  const knowledgeBase = (await getKnowledgeBase()).trim();

  const systemPrompt = knowledgeBase
    ? `${SYSTEM_PROMPT_BASE}\n\nBerikut info resmi sekolah yang HARUS kamu pakai buat jawab (harga paket, jadwal, kebijakan, FAQ, dll). Kalau pertanyaan ga kejawab dari info ini, bilang terus terang akan diteruskan ke admin manusia -- jangan ngarang:\n\n${knowledgeBase}`
    : SYSTEM_PROMPT_BASE;

  try {
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Pesan dari calon murid/murid (ini cuma simulasi test, bukan pesan WA beneran): "${question}"`,
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
