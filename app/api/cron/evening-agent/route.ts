import { isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { verifyCronRequest } from "@/lib/cron-auth";
import { runEveningAgentForUser } from "@/lib/run-health-agents";

export const maxDuration = 60;

export async function GET(req: Request) {
  const deny = verifyCronRequest(req);
  if (deny) return deny;

  const now = new Date();
  const all = await db.select().from(users).where(isNotNull(users.ouraToken));
  const results: { userId: string; ok: boolean; detail?: string }[] = [];

  for (const user of all) {
    const r = await runEveningAgentForUser(user, { now });
    results.push({ userId: user.id, ok: r.ok, detail: r.detail });
  }

  return NextResponse.json({ ok: true, processed: results.length, results });
}
