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
        className="panel w-full max-w-md p-6 space-y-4"
      >
        <h1 className="heading-font text-6xl leading-none">HEALTH OS</h1>
        <p className="text-sm text-[var(--muted2)]">
          Connect your Oura token to unlock your daily performance operating system.
        </p>
        <input
          className="w-full panel px-3 py-2 bg-[var(--surface2)]"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          type="password"
          className="w-full panel px-3 py-2 bg-[var(--surface2)]"
          placeholder="Oura Personal Access Token"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <button disabled={loading} className="w-full py-2 panel bg-[var(--sleep)] text-black font-semibold">
          {loading ? "Connecting..." : "Connect Oura"}
        </button>
        <button
          type="button"
          onClick={() => login(true)}
          className="w-full py-2 panel"
        >
          Try Demo
        </button>
      </form>
    </main>
  );
}
