import ChatBox from "./ChatBox";
import KnowledgeBaseEditor from "./KnowledgeBaseEditor";
import { getKnowledgeBase } from "./actions";

export const dynamic = "force-dynamic";

export default async function AIAssistantPage() {
  const knowledgeBase = await getKnowledgeBase();

  return (
    <div>
      <p className="text-xs font-bold tracking-wide text-bmos-primary uppercase mb-1">
        System
      </p>
      <h1 className="text-3xl font-extrabold text-bmos-text mb-1">
        AI Assistant
      </h1>
      <p className="text-bmos-text-light text-sm mb-6">
        Latih AI buat jawab calon murid/murid otomatis lewat WhatsApp --
        tulis info sekolahnya di bawah, terus tes hasilnya di kotak chat.
      </p>

      <KnowledgeBaseEditor initialText={knowledgeBase} />

      <div className="mb-2">
        <p className="text-sm font-semibold text-bmos-text">
          Tes Chat (simulasi jawaban AI)
        </p>
        <p className="text-xs text-bmos-text-light">
          Coba tanya kayak calon murid buat cek jawaban AI-nya udah bener
          apa belum, sebelum beneran dipakai auto-reply di WhatsApp.
        </p>
      </div>
      <ChatBox />
    </div>
  );
}
