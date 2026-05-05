"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function Home() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function login(demo = false) {
    setLoading(true);
    try {
      const accountEmail = email || "demo@healthos.app";
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: accountEmail, token, demo }),
      });
      if (!res.ok) throw new Error("Unable to validate Oura token");
      const auth = await signIn("credentials", {
        email: accountEmail,
        token: demo ? "" : token,
        redirect: false,
      });
      if (auth?.ok) router.push("/dashboard");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          login(false);
        }}
        className="panel w-full max-w-md space-y-4 p-8"
      >
        <h1 className="heading-font text-6xl leading-none text-white">HEALTH OS</h1>
        <p className="text-[13px] text-[var(--text-secondary)]">
          Connect your Oura token to unlock your daily performance operating system.
        </p>
        <input
          className="panel w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-white"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          className="panel w-full rounded-xl border border-[var(--border)] bg-[var(--bg)] px-4 py-3 text-white"
          placeholder="Oura Personal Access Token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <button disabled={loading} className="btn btn-primary w-full disabled:opacity-50">
          {loading ? "Connecting..." : "Connect Oura"}
        </button>
        <button
          type="button"
          onClick={() => login(true)}
          className="btn btn-outline w-full"
        >
          Try Demo
        </button>
      </form>
    </main>
  );
}
