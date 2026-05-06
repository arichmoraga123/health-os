import { isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { verifyCronRequest } from "@/lib/cron-auth";
import { runMorningAgentForUser } from "@/lib/run-health-agents";

export const maxDuration = 60;

export async function GET(req: Request) {
  const deny = verifyCronRequest(req);
  if (deny) return deny;

  const appUrl =
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const now = new Date();
  const rows = await db.select().from(users).where(isNotNull(users.ouraToken));
  const results: { userId: string; ok: boolean; detail?: string }[] = [];

  for (const user of rows) {
    const r = await runMorningAgentForUser(user, { now, appUrl });
    results.push({ userId: user.id, ok: r.ok, detail: r.detail });
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
