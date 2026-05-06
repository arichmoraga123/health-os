import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { requireApiUser } from "@/lib/api-auth";
import { runEveningAgentForUser } from "@/lib/run-health-agents";

export async function POST() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const [user] = await db.select().from(users).where(eq(users.id, auth.userId)).limit(1);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const r = await runEveningAgentForUser(user, {
    now: new Date(),
    bypassTimeWindow: true,
  });

  return NextResponse.json(r);
}
