import { eq, gte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { subDays } from "date-fns";
import { db } from "@/db/client";
import { dailySnapshots, journalEntries, users } from "@/db/schema";
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
  const journals = await db.select().from(journalEntries).where(eq(journalEntries.userId, auth.userId)).limit(5);
  const answer = await askClaude(
    `You are Health OS coach. timezone_offset_context=${
      user?.homeTimezone ?? "UTC"
    }. snapshots=${JSON.stringify(snapshots)} journals=${JSON.stringify(journals)} chat=${JSON.stringify(messages)}`,
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
