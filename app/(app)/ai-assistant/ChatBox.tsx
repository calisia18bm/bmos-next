"use client";

import { useState } from "react";
import { askAssistant } from "./actions";

type Message = { role: "user" | "assistant"; text: string };

export default function ChatBox() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    if (!input.trim()) return;

    const question = input;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", text: question }]);
    setLoading(true);

    const result = await askAssistant(question);

    setLoading(false);
    setMessages((prev) => [
      ...prev,
      { role: "assistant", text: result.message },
    ]);
  }

  return (
    <div className="bg-white border border-bmos-border rounded-2xl flex flex-col h-[600px]">
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.length === 0 && (
          <p className="text-sm text-bmos-text-light text-center mt-10">
            Tanya apa aja soal data sekolah kamu, misal &quot;berapa murid
            aktif sekarang?&quot; atau &quot;berapa profit bulan ini?&quot;
          </p>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${
              m.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                m.role === "user"
                  ? "bg-bmos-primary text-white"
                  : "bg-bmos-primary-soft text-bmos-text"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-bmos-primary-soft text-bmos-text rounded-2xl px-4 py-2.5 text-sm">
              Mengetik...
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-bmos-border p-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          placeholder="Tulis pertanyaan..."
          className="flex-1 border border-bmos-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-bmos-primary-light"
        />
        <button
          onClick={handleSend}
          disabled={loading}
          className="bg-bmos-primary text-white rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-bmos-primary-light transition disabled:opacity-60"
        >
          Kirim
        </button>
      </div>
    </div>
  );
}
