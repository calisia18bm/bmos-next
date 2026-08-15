import ChatBox from "./ChatBox";

export default function AIAssistantPage() {
  return (
    <div>
      <p className="text-xs font-bold tracking-wide text-bmos-primary uppercase mb-1">
        System
      </p>
      <h1 className="text-3xl font-extrabold text-bmos-text mb-1">
        AI Assistant
      </h1>
      <p className="text-bmos-text-light text-sm mb-6">
        Tanya apa aja soal data operasional sekolah.
      </p>

      <ChatBox />
    </div>
  );
}
