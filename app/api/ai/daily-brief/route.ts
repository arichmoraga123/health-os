import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { dailyAiBriefs, dailySnapshots, journalEntries, users } from "@/db/schema";
import { askClaude } from "@/lib/ai";
import { requireApiUser } from "@/lib/api-auth";
import { dateKeyInTimeZone } from "@/lib/dates";

function parseBriefJson(text: string): {
  briefMarkdown: string;
  keyInsight: string;
  actionItems: string[];
  moodPrompt: string;
} | null {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try {
    const o = JSON.parse(m[0]) as Record<string, unknown>;
    return {
      briefMarkdown: String(o.briefMarkdown ?? ""),
      keyInsight: String(o.keyInsight ?? ""),
      actionItems: Array.isArray(o.actionItems) ? o.actionItems.map(String) : [],
      moodPrompt: String(o.moodPrompt ?? ""),
    };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  let body: { date?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const [user] = await db.select().from(users).where(eq(users.id, auth.userId)).limit(1);
  const tz = user?.currentTimezone || user?.homeTimezone || "UTC";
  const date = body.date ?? dateKeyInTimeZone(new Date(), tz);

  const snapshots = await db
    .select()
    .from(dailySnapshots)
    .where(eq(dailySnapshots.userId, auth.userId))
    .limit(14);
  const [journal] = await db
    .select()
    .from(journalEntries)
    .where(eq(journalEntries.userId, auth.userId))
    .orderBy(desc(journalEntries.createdAt))
    .limit(1);

  const prompt = `You are Health OS. Using this biometric JSON and optional journal, return ONLY valid minified JSON with keys:
briefMarkdown (string, 2-3 sentences markdown),
keyInsight (string, one punchy line),
actionItems (array of exactly 3 short actionable strings),
moodPrompt (string, one journal question).
Data: ${JSON.stringify(snapshots)}. Journal: ${journal?.entry ?? "none"}.`;

  let raw: string;
  try {
    raw = await askClaude(prompt);
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI error";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const parsed = parseBriefJson(raw);
  const out = parsed ?? {
    briefMarkdown: raw,
    keyInsight: "Review your recovery signals today.",
    actionItems: ["Light exposure before noon", "Consistent bedtime", "Easy movement only"],
    moodPrompt: "What is one thing your body is asking for today?",
  };

  const [existing] = await db
    .select()
    .from(dailyAiBriefs)
    .where(and(eq(dailyAiBriefs.userId, auth.userId), eq(dailyAiBriefs.date, date)))
    .limit(1);

  if (existing) {
    await db
      .update(dailyAiBriefs)
      .set({
        briefMarkdown: out.briefMarkdown,
        keyInsight: out.keyInsight,
        actionItems: out.actionItems,
        moodPrompt: out.moodPrompt,
      })
      .where(eq(dailyAiBriefs.id, existing.id));
  } else {
    await db.insert(dailyAiBriefs).values({
      userId: auth.userId,
      date,
      briefMarkdown: out.briefMarkdown,
      keyInsight: out.keyInsight,
      actionItems: out.actionItems,
      moodPrompt: out.moodPrompt,
    });
  }

  return NextResponse.json(out);
}
