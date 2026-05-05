import { and, eq, gte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { nudges, users } from "@/db/schema";
import { requireApiUser } from "@/lib/api-auth";
import { sendPush } from "@/lib/push";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { toUserId, communityId, type, message } = await request.json();

  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const today = await db
    .select()
    .from(nudges)
    .where(and(eq(nudges.fromUserId, auth.userId), eq(nudges.toUserId, toUserId), gte(nudges.createdAt, since)));
  if (today.length >= 3) return NextResponse.json({ error: "Rate limit exceeded (3/day)" }, { status: 429 });

  const [nudge] = await db
    .insert(nudges)
    .values({ fromUserId: auth.userId, toUserId, communityId, type, message })
    .returning();
  const [recipient] = await db.select().from(users).where(eq(users.id, toUserId)).limit(1);
  await sendPush(recipient?.pushSubscription, { title: `New ${type}`, body: message ?? "You received a nudge." });
  return NextResponse.json(nudge);
}
