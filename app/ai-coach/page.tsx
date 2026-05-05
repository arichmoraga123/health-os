"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";

export default function AICoachPage() {
  const [messages, setMessages] = useState<Array<{ role: string; content: string }>>([]);
  const [input, setInput] = useState("");

  async function send() {
    const next = [...messages, { role: "user", content: input }];
    setMessages(next);
    setInput("");
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: next }),
    });
    const text = await res.text();
    setMessages((m) => [...m, { role: "assistant", content: text }]);
  }

  return (
    <AppShell title="AI Coach">
      <section className="panel p-4 h-[65vh] overflow-y-auto space-y-2">
        {messages.map((m, idx) => (
          <div key={idx} className="panel p-2 bg-[var(--surface2)]">
            <span className="text-[var(--muted2)] mr-2">{m.role}:</span>
            {m.content}
          </div>
        ))}
      </section>
      <section className="mt-3 flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} className="flex-1 panel p-2 bg-[var(--surface2)]" />
        <button onClick={send} className="panel px-3 py-2 bg-[var(--ready)] text-black">
          Send
        </button>
      </section>
    </AppShell>
  );
}
