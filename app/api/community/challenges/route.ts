import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { challengeParticipants, challenges } from "@/db/schema";
import { requireApiUser } from "@/lib/api-auth";

export async function GET(request: Request) {
  const communityId = new URL(request.url).searchParams.get("communityId");
  if (!communityId) return NextResponse.json([]);
  const rows = await db.select().from(challenges).where(eq(challenges.communityId, communityId));
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const body = await request.json();
  const [challenge] = await db
    .insert(challenges)
    .values({
      communityId: body.communityId,
      createdBy: auth.userId,
      title: body.title,
      type: body.type,
      targetValue: Number(body.targetValue),
      startDate: body.startDate,
      endDate: body.endDate,
    })
    .returning();
  return NextResponse.json(challenge);
}

export async function PUT(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { challengeId, action, currentValue = 0 } = await request.json();
  if (action === "join") {
    await db.insert(challengeParticipants).values({ challengeId, userId: auth.userId });
  } else if (action === "leave") {
    await db
      .delete(challengeParticipants)
      .where(and(eq(challengeParticipants.challengeId, challengeId), eq(challengeParticipants.userId, auth.userId)));
  } else if (action === "update_progress") {
    await db
      .update(challengeParticipants)
      .set({ currentValue, completed: currentValue > 0 })
      .where(and(eq(challengeParticipants.challengeId, challengeId), eq(challengeParticipants.userId, auth.userId)));
  }
  return NextResponse.json({ ok: true });
}
