import { desc, eq, gte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { subDays } from "date-fns";
import { db } from "@/db/client";
import {
  challengeParticipants,
  dailySnapshots,
  journalEntries,
  timezonePlans,
  users,
} from "@/db/schema";
import { askClaude } from "@/lib/ai";
import { requireApiUser } from "@/lib/api-auth";
import { dateKey } from "@/lib/utils";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { messages } = await request.json();
  const [user] = await db.select().from(users).where(eq(users.id, auth.userId)).limit(1);
  const snapshots = await db
    .select()
    .from(dailySnapshots)
    .where(gte(dailySnapshots.date, dateKey(subDays(new Date(), 30))))
    .limit(30);
  const journals = await db
    .select()
    .from(journalEntries)
    .where(eq(journalEntries.userId, auth.userId))
    .orderBy(desc(journalEntries.createdAt))
    .limit(10);
  const [tripPlan] = await db
    .select()
    .from(timezonePlans)
    .where(eq(timezonePlans.userId, auth.userId))
    .orderBy(desc(timezonePlans.generatedAt))
    .limit(1);
  const challengeProgress = await db
    .select()
    .from(challengeParticipants)
    .where(eq(challengeParticipants.userId, auth.userId))
    .limit(20);

  const tags = snapshots.flatMap((s) => (Array.isArray(s.tags) ? s.tags : []));
  const answer = await askClaude(
    `System:
You are an elite performance coach and sleep scientist with access to the user's complete Oura biometric data. You have expertise in sleep science, HRV, circadian biology, stress physiology, and athletic performance. Be specific, reference actual numbers from their data, give actionable advice. Keep responses under 150 words unless asked for detail. Never be vague.

Context:
timezone=${user?.currentTimezone ?? user?.homeTimezone ?? "UTC"}
snapshots_30d=${JSON.stringify(snapshots)}
journals_recent=${JSON.stringify(journals)}
oura_tags=${JSON.stringify(tags)}
trip_plan=${JSON.stringify(tripPlan)}
community_challenges=${JSON.stringify(challengeProgress)}

Conversation:
${JSON.stringify(messages)}`,
  );
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      answer.split(" ").forEach((word) => controller.enqueue(encoder.encode(`${word} `)));
      controller.close();
    },
  });
  return new NextResponse(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
