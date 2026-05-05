import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { dailyAiBriefs, dailySnapshots, journalEntries } from "@/db/schema";
import { askClaude } from "@/lib/ai";
import { requireApiUser } from "@/lib/api-auth";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { date } = await request.json();

  const snapshots = await db
    .select()
    .from(dailySnapshots)
    .where(eq(dailySnapshots.userId, auth.userId))
    .limit(7);
  const [journal] = await db
    .select()
    .from(journalEntries)
    .where(eq(journalEntries.userId, auth.userId))
    .limit(1);

  const brief = await askClaude(
    `Create a daily health brief in markdown, include one insight, action items and mood prompt. Data: ${JSON.stringify(
      snapshots,
    )}. Latest journal: ${journal?.entry ?? "none"}`,
  );

  const [existing] = await db
    .select()
    .from(dailyAiBriefs)
    .where(and(eq(dailyAiBriefs.userId, auth.userId), eq(dailyAiBriefs.date, date)))
    .limit(1);
  if (existing) {
    await db
      .update(dailyAiBriefs)
      .set({ briefMarkdown: brief })
      .where(eq(dailyAiBriefs.id, existing.id));
  } else {
    await db.insert(dailyAiBriefs).values({ userId: auth.userId, date, briefMarkdown: brief });
  }

  return NextResponse.json({ brief });
}
