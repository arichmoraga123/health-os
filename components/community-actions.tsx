"use client";

import { useState } from "react";

export function CommunityActions() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function createCommunity(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await fetch("/api/community/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    });
    const data = await res.json();
    setMsg(res.ok ? `Created · invite ${data.inviteCode}` : data.error ?? "Error");
  }

  async function joinCommunity(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await fetch("/api/community/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteCode: code }),
    });
    const data = await res.json();
    setMsg(res.ok ? "Joined community" : data.error ?? "Error");
  }

  return (
    <div className="space-y-4">
    <section className="grid gap-6 lg:grid-cols-2">
      <form onSubmit={createCommunity} className="panel space-y-4 p-6 md:p-8">
        <h3 className="heading-font text-3xl text-white">Create space</h3>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-white"
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          className="min-h-[100px] w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-white"
        />
        <button
          type="submit"
          className="rounded-full bg-[var(--ready)] px-6 py-3 text-[12px] font-bold uppercase tracking-wide text-black"
        >
          Create
        </button>
      </form>
      <form onSubmit={joinCommunity} className="panel space-y-4 p-6 md:p-8">
        <h3 className="heading-font text-3xl text-white">Join with code</h3>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="6-character invite"
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-white"
        />
        <button
          type="submit"
          className="rounded-full border border-[var(--border)] bg-white/[0.06] px-6 py-3 text-[12px] font-bold uppercase tracking-wide text-white"
        >
          Join
        </button>
      </form>
    </section>
    {msg ? <p className="text-center text-[13px] text-[var(--text-secondary)]">{msg}</p> : null}
    </div>
  );
}
