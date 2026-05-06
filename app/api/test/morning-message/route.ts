import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { requireApiUser } from "@/lib/api-auth";
import { runMorningAgentForUser } from "@/lib/run-health-agents";

export async function POST() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const [user] = await db.select().from(users).where(eq(users.id, auth.userId)).limit(1);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const appUrl =
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

  const r = await runMorningAgentForUser(user, {
    now: new Date(),
    appUrl,
    bypassTimeWindow: true,
  });

  return NextResponse.json(r);
}
