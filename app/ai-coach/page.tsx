"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  ts: string;
};

type Conversation = {
  id: string;
  date: string;
  title: string | null;
  messages: ChatMessage[];
  updatedAt: string;
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
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);

  async function loadConversations() {
    const res = await fetch("/api/ai/conversations");
    const data = await res.json().catch(() => []);
    if (Array.isArray(data)) {
      setConversations(
        data.map((c) => ({
          id: c.id as string,
          date: String(c.date ?? ""),
          title: (c.title as string | null) ?? "New Chat",
          messages: Array.isArray(c.messages) ? (c.messages as ChatMessage[]) : [],
          updatedAt: String(c.updatedAt ?? c.createdAt ?? ""),
        })),
      );
    }
  }

  useEffect(() => {
    void loadConversations();
    containerRef.current?.scrollTo({
      top: containerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, typing]);

  async function createConversation(firstMessage?: string) {
    const res = await fetch("/api/ai/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ firstMessage }),
    });
    const created = await res.json();
    setConversationId(created.id as string);
    await loadConversations();
    return created.id as string;
  }

  async function saveConversation(nextMessages: ChatMessage[], forcedId?: string) {
    const id = forcedId ?? conversationId ?? (await createConversation(nextMessages.find((m) => m.role === "user")?.content));
    await fetch("/api/ai/conversations", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id,
        title: nextMessages.find((m) => m.role === "user")?.content.slice(0, 50) ?? "New Chat",
        messages: nextMessages.map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.ts,
        })),
      }),
    });
    setConversationId(id);
    await loadConversations();
  }

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
    let partial = "";
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: next.map((m) => ({ role: m.role, content: m.content })),
      }),
    });
    if (!res.body) {
      setTyping(false);
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let pushed = false;
    const ts = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    setMessages((m) => [...m, { role: "assistant", content: "", ts }]);
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      partial += decoder.decode(value, { stream: true });
      pushed = true;
      setMessages((m) => {
        const cloned = [...m];
        const last = cloned[cloned.length - 1];
        if (last?.role === "assistant") {
          cloned[cloned.length - 1] = { ...last, content: partial };
        }
        return cloned;
      });
    }
    if (!pushed) {
      setMessages((m) => {
        const cloned = [...m];
        const last = cloned[cloned.length - 1];
        if (last?.role === "assistant") cloned[cloned.length - 1] = { ...last, content: "No response generated." };
        return cloned;
      });
    }
    setTyping(false);
    const finalMessages = [
      ...next,
      { role: "assistant" as const, content: partial || "No response generated.", ts },
    ];
    await saveConversation(finalMessages);
  }

  function groupLabel(updatedAt: string) {
    const d = new Date(updatedAt);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 86400000);
    if (diff <= 0) return "Today";
    if (diff === 1) return "Yesterday";
    if (diff < 7) return "This Week";
    return "Earlier";
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
      <section className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-3">
        <aside className="panel p-3 h-[65vh] overflow-y-auto">
          <button
            type="button"
            className="btn btn-primary w-full !min-w-0"
            onClick={() => {
              setConversationId(null);
              setMessages([
                {
                  role: "assistant",
                  content: "I am your Health OS coach. Ask me about recovery, training, sleep, stress, or travel.",
                  ts: "now",
                },
              ]);
            }}
          >
            New Chat
          </button>
          <div className="mt-3 space-y-3">
            {["Today", "Yesterday", "This Week", "Earlier"].map((group) => {
              const rows = conversations.filter((c) => groupLabel(c.updatedAt) === group);
              if (!rows.length) return null;
              return (
                <div key={group}>
                  <p className="label-caps mb-1">{group}</p>
                  <div className="space-y-1">
                    {rows.map((c) => (
                      <button
                        key={c.id}
                        className={`w-full text-left btn btn-outline !min-w-0 !px-3 !py-2 ${
                          conversationId === c.id ? "!text-white !border-white/40" : ""
                        }`}
                        onClick={() => {
                          setConversationId(c.id);
                          setMessages(c.messages.length ? c.messages : []);
                        }}
                      >
                        {(c.title ?? "New Chat").slice(0, 50)}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
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
