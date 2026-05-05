import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { dailySnapshots, journalEntries } from "@/db/schema";
import { askClaude } from "@/lib/ai";
import { requireApiUser } from "@/lib/api-auth";
import { dateKey } from "@/lib/utils";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const body = await request.json().catch(() => ({}));
  const entry = body.entry ?? "";
  const date = body.date ?? dateKey();

  const [snapshot] = await db
    .select()
    .from(dailySnapshots)
    .where(and(eq(dailySnapshots.userId, auth.userId), eq(dailySnapshots.date, date)))
    .limit(1);
  const reflection = await askClaude(
    `Write a concise reflection connecting this journal to biometrics. entry=${entry}. metrics=${JSON.stringify(
      snapshot ?? {},
    )}`,
  );

  const [existing] = await db
    .select()
    .from(journalEntries)
    .where(and(eq(journalEntries.userId, auth.userId), eq(journalEntries.date, date)))
    .limit(1);
  if (existing) {
    await db
      .update(journalEntries)
      .set({ entry, aiReflection: reflection })
      .where(eq(journalEntries.id, existing.id));
  } else {
    await db.insert(journalEntries).values({ userId: auth.userId, date, entry, aiReflection: reflection });
  }
  return NextResponse.json({ reflection });
}
