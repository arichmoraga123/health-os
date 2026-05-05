"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  ts: string;
};

const quickPrompts = [
  "Why was my sleep low?",
  "When should I train?",
  "Am I overtraining?",
  "Analyze my week",
  "Help me beat jet lag",
  "What should I focus on?",
];

export default function AICoachPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "I am your Health OS coach. Ask me about recovery, training, sleep, stress, or travel.",
      ts: "now",
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const initials = useMemo(() => "YU", []);

  useEffect(() => {
    containerRef.current?.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, typing]);

  async function send(custom?: string) {
    const text = (custom ?? input).trim();
    if (!text) return;
    const userMessage: ChatMessage = {
      role: "user",
      content: text,
      ts: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
    };
    const next = [...messages, userMessage];
    setMessages(next);
    setInput("");
    setTyping(true);
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: next.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    const reply = await res.text();
    setMessages((m) => [
      ...m,
      {
        role: "assistant",
        content: reply,
        ts: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      },
    ]);
    setTyping(false);
  }

  return (
    <AppShell title="AI Coach" headerExtra={<span className="label-caps">Biometric-aware coaching</span>}>
      <section className="mb-3 flex flex-wrap gap-2">
        {quickPrompts.map((p) => (
          <button key={p} type="button" className="btn btn-outline !min-w-0 !px-4 !py-2 !text-[11px]" onClick={() => send(p)}>
            {p}
          </button>
        ))}
      </section>
      <section ref={containerRef} className="panel h-[65vh] overflow-y-auto p-4 space-y-4">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`flex items-end gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {m.role === "assistant" && (
              <div className="size-8 rounded-full bg-gradient-to-br from-[var(--sleep)] to-[var(--hrv)] shrink-0" />
            )}
            <div
              className={`max-w-[78%] rounded-2xl px-4 py-3 ${
                m.role === "user"
                  ? "bg-gradient-to-br from-[#6c63ff] to-[#8b5cf6] text-white rounded-br-sm"
                  : "bg-[#1a1a2e] text-[var(--text-secondary)] rounded-bl-sm"
              }`}
            >
              <p className="text-[13px] whitespace-pre-wrap">{m.content}</p>
              <p className="mt-1 text-[10px] opacity-70">
                {m.ts}
              </p>
            </div>
            {m.role === "user" && (
              <div className="size-8 rounded-full bg-white/[0.12] text-white text-[10px] grid place-items-center shrink-0">
                {initials}
              </div>
            )}
          </div>
        ))}
        {typing && (
          <div className="flex items-end gap-2">
            <div className="size-8 rounded-full bg-gradient-to-br from-[var(--sleep)] to-[var(--hrv)] shrink-0" />
            <div className="rounded-2xl rounded-bl-sm bg-[#1a1a2e] px-4 py-3 text-[var(--text-secondary)]">
              <div className="flex gap-1">
                <span className="size-2 rounded-full bg-[var(--text-secondary)] animate-bounce [animation-delay:0ms]" />
                <span className="size-2 rounded-full bg-[var(--text-secondary)] animate-bounce [animation-delay:150ms]" />
                <span className="size-2 rounded-full bg-[var(--text-secondary)] animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
      </section>
      <section className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
          className="flex-1"
          placeholder="Ask about your recovery, training, sleep, or stress..."
        />
        <button onClick={() => send()} className="btn btn-primary">
          Send
        </button>
      </section>
    </AppShell>
  );
}
