"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type UserRow = {
  id: string;
  name: string;
  email: string;
  phoneMasked: string;
  tokenMasked: string;
  lastSyncAt: string | null;
};

type LogRow = {
  id: string;
  sentAt: string | null;
  user: string;
  type: string;
  status: string;
  preview: string;
  error: string | null;
};

export function AdminDashboard() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [selectedUserId, setSelectedUserId] = useState("");
  const [messageType, setMessageType] = useState<"sms" | "email" | "both" | "voice">("sms");
  const [content, setContent] = useState("");
  const [preview, setPreview] = useState("");
  const [sending, setSending] = useState(false);
  const [genBusy, setGenBusy] = useState<null | "morning" | "evening">(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalUserId, setModalUserId] = useState<string | null>(null);
  const [modalMd, setModalMd] = useState("");
  const [modalDate, setModalDate] = useState("");
  const [modalBusy, setModalBusy] = useState(false);

  const selectedEmail = useMemo(() => {
    const u = users.find((x) => x.id === selectedUserId);
    return u?.email ?? "";
  }, [users, selectedUserId]);

  const load = useCallback(async () => {
    setLoadErr(null);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Failed to load users");
      setUsers(j.users ?? []);
      setLogs(j.logs ?? []);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : "Load failed");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedUserId && users[0]?.id) setSelectedUserId(users[0].id);
  }, [users, selectedUserId]);

  useEffect(() => {
    setPreview(content);
  }, [content]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4200);
  };

  const syncUser = async (userId: string) => {
    try {
      const res = await fetch("/api/admin/sync-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, days: 7 }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Sync failed");
      showToast(`Synced ${j.syncedDays ?? "?"} days — ${j.message ?? "ok"}`);
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Sync failed");
    }
  };

  const generateBrief = async (kind: "morning" | "evening") => {
    if (!selectedUserId) {
      showToast("Select a user first");
      return;
    }
    setGenBusy(kind);
    try {
      const res = await fetch("/api/admin/generate-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: selectedUserId, type: kind }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Generate failed");
      setContent(j.text ?? "");
      setPreview(j.text ?? "");
      showToast(`${kind === "morning" ? "Morning" : "Evening"} brief generated — edit and send when ready`);
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Generate failed");
    } finally {
      setGenBusy(null);
    }
  };

  const sendNow = async () => {
    if (!selectedUserId || !content.trim()) {
      showToast("Select user and enter message content");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/admin/send-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUserId,
          messageType,
          content: content.trim(),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Send failed");
      if (!j.success && j.errors?.length) throw new Error(j.errors.join("; "));
      showToast("Sent successfully");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  const openMdModal = async (userId: string) => {
    setModalUserId(userId);
    setModalOpen(true);
    setModalBusy(true);
    setModalMd("");
    try {
      const res = await fetch(`/api/admin/preview-md?userId=${encodeURIComponent(userId)}`, {
        cache: "no-store",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "No markdown");
      setModalMd(j.markdown ?? "");
      setModalDate(j.date ?? "");
    } catch (e) {
      setModalMd(`Error: ${e instanceof Error ? e.message : "failed"}`);
      setModalDate("");
    } finally {
      setModalBusy(false);
    }
  };

  const downloadMd = () => {
    const blob = new Blob([modalMd], { type: "text/markdown;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `health-report-${modalDate || "export"}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const emailMd = async () => {
    if (!modalUserId) return;
    setModalBusy(true);
    try {
      const res = await fetch("/api/admin/email-md", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: modalUserId, date: modalDate || undefined }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(j.error ?? "Email failed");
      showToast("Markdown emailed");
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Email failed");
    } finally {
      setModalBusy(false);
    }
  };

  return (
    <div className="space-y-10">
      {toast ? (
        <div className="fixed bottom-6 right-6 z-[100] max-w-sm rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[13px] text-white shadow-xl">
          {toast}
        </div>
      ) : null}

      <section className="panel p-5 md:p-8">
        <h2 className="text-[16px] font-semibold text-white">Users</h2>
        <p className="mt-1 text-[12px] text-[var(--text-secondary)]">
          Oura tokens are masked. Last sync is the newest snapshot row timestamp.
        </p>
        {loadErr ? <p className="mt-2 text-[13px] text-[var(--warn)]">{loadErr}</p> : null}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                <th className="py-2 pr-3 font-medium">Name</th>
                <th className="py-2 pr-3 font-medium">Email</th>
                <th className="py-2 pr-3 font-medium">Phone</th>
                <th className="py-2 pr-3 font-medium">Oura token</th>
                <th className="py-2 pr-3 font-medium">Last sync</th>
                <th className="py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-[var(--border)]/60 text-[var(--text-secondary)]">
                  <td className="py-2 pr-3 text-white">{u.name}</td>
                  <td className="py-2 pr-3">{u.email}</td>
                  <td className="py-2 pr-3 font-mono text-[11px]">{u.phoneMasked}</td>
                  <td className="py-2 pr-3 font-mono text-[11px]">{u.tokenMasked}</td>
                  <td className="py-2 pr-3">
                    {u.lastSyncAt
                      ? new Date(u.lastSyncAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })
                      : "—"}
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        className="rounded-lg border border-[var(--border)] bg-white/[0.04] px-2 py-1 text-[11px] text-white hover:bg-white/[0.08]"
                        onClick={() => void syncUser(u.id)}
                      >
                        Sync now
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-[var(--border)] bg-white/[0.04] px-2 py-1 text-[11px] text-white hover:bg-white/[0.08]"
                        onClick={() => {
                          setSelectedUserId(u.id);
                          document.getElementById("admin-send")?.scrollIntoView({ behavior: "smooth" });
                        }}
                      >
                        Send message
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border border-[var(--border)] bg-white/[0.04] px-2 py-1 text-[11px] text-white hover:bg-white/[0.08]"
                        onClick={() => void openMdModal(u.id)}
                      >
                        View MD
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section id="admin-send" className="panel p-5 md:p-8">
        <h2 className="text-[16px] font-semibold text-white">Manual message sender</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="block text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
            User
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[13px] text-white"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </label>
          <div className="text-[12px] text-[var(--text-secondary)]">
            <div className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">Routing</div>
            <p className="mt-1">
              SMS → user&apos;s saved phone · Email → notification email or login email ({selectedEmail})
            </p>
          </div>
        </div>

        <fieldset className="mt-4 space-y-2">
          <legend className="text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
            Message type
          </legend>
          {(
            [
              ["sms", "SMS only"],
              ["email", "Email only"],
              ["both", "SMS + Email"],
              ["voice", "Voice call"],
            ] as const
          ).map(([v, label]) => (
            <label key={v} className="flex items-center gap-2 text-[13px] text-[var(--text-secondary)]">
              <input
                type="radio"
                name="mt"
                checked={messageType === v}
                onChange={() => setMessageType(v)}
                className="accent-[var(--ready)]"
              />
              {label}
            </label>
          ))}
        </fieldset>

        <label className="mt-4 block text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
          Message / script
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={10}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 font-mono text-[13px] text-white"
            placeholder="Paste your SMS, email body, or voice script…"
          />
        </label>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!!genBusy || !selectedUserId}
            onClick={() => void generateBrief("morning")}
            className="btn btn-outline !px-4 !py-2 !text-[11px] disabled:opacity-40"
          >
            {genBusy === "morning" ? "Generating…" : "Generate morning brief"}
          </button>
          <button
            type="button"
            disabled={!!genBusy || !selectedUserId}
            onClick={() => void generateBrief("evening")}
            className="btn btn-outline !px-4 !py-2 !text-[11px] disabled:opacity-40"
          >
            {genBusy === "evening" ? "Generating…" : "Generate evening brief"}
          </button>
        </div>

        <label className="mt-4 block text-[11px] uppercase tracking-wider text-[var(--text-muted)]">
          Preview (read-only)
          <textarea
            readOnly
            value={preview}
            rows={6}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-[13px] text-[var(--text-secondary)]"
          />
        </label>

        <button
          type="button"
          disabled={sending}
          onClick={() => void sendNow()}
          className="btn btn-primary mt-4 !px-6 !py-2 !text-[12px] disabled:opacity-50"
        >
          {sending ? "Sending…" : "Send now"}
        </button>
      </section>

      <section className="panel p-5 md:p-8">
        <h2 className="text-[16px] font-semibold text-white">Message log (last 10)</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-[12px]">
            <thead>
              <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
                <th className="py-2 pr-3 font-medium">Time</th>
                <th className="py-2 pr-3 font-medium">User</th>
                <th className="py-2 pr-3 font-medium">Type</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 font-medium">Preview</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-[var(--border)]/60">
                  <td className="py-2 pr-3 text-[var(--text-secondary)]">
                    {l.sentAt ? new Date(l.sentAt).toLocaleString() : "—"}
                  </td>
                  <td className="py-2 pr-3 text-white">{l.user}</td>
                  <td className="py-2 pr-3">{l.type}</td>
                  <td className="py-2 pr-3">
                    <span className={l.status === "sent" ? "text-[var(--ready)]" : "text-[var(--warn)]"}>
                      {l.status}
                    </span>
                    {l.error ? (
                      <span className="ml-2 text-[11px] text-[var(--warn)]" title={l.error}>
                        ({l.error.slice(0, 40)}…)
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 text-[var(--text-secondary)]">{l.preview}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!logs.length ? <p className="mt-2 text-[13px] text-[var(--text-muted)]">No messages yet.</p> : null}
        </div>
      </section>

      {modalOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--sidebar-bg)] shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <h3 className="text-[15px] font-semibold text-white">Markdown report {modalDate ? `— ${modalDate}` : ""}</h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="rounded-lg px-2 py-1 text-[12px] text-[var(--text-secondary)] hover:bg-white/[0.06] hover:text-white"
              >
                Close
              </button>
            </div>
            <div className="max-h-[55vh] overflow-auto p-4">
              {modalBusy ? (
                <p className="text-[13px] text-[var(--text-secondary)]">Loading…</p>
              ) : (
                <pre className="whitespace-pre-wrap font-mono text-[12px] text-[var(--text-secondary)]">{modalMd}</pre>
              )}
            </div>
            <div className="flex flex-wrap gap-2 border-t border-[var(--border)] px-4 py-3">
              <button
                type="button"
                disabled={modalBusy || !modalUserId}
                onClick={() => void emailMd()}
                className="btn btn-primary !px-4 !py-2 !text-[11px] disabled:opacity-40"
              >
                Send to email
              </button>
              <button
                type="button"
                disabled={!modalMd}
                onClick={downloadMd}
                className="btn btn-outline !px-4 !py-2 !text-[11px]"
              >
                Download
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
