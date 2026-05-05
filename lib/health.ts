import { desc, eq, gte } from "drizzle-orm";
import { subDays } from "date-fns";
import { db } from "@/db/client";
import { dailyAiBriefs, dailySnapshots, journalEntries } from "@/db/schema";
import { makeMockSnapshots } from "@/lib/mock-data";
import { dateKey } from "@/lib/utils";

export async function getSnapshots(userId: string, days = 30) {
  try {
    const rows = await db
      .select()
      .from(dailySnapshots)
      .where(gte(dailySnapshots.date, dateKey(subDays(new Date(), days))))
      .orderBy(desc(dailySnapshots.date))
      .limit(days);
    if (rows.length) return rows.reverse();
  } catch {
    // fall through to mock data for local setup
  }
  return makeMockSnapshots(days);
}

export async function getTodayBrief(userId: string) {
  try {
    const [brief] = await db
      .select()
      .from(dailyAiBriefs)
      .where(eq(dailyAiBriefs.userId, userId))
      .orderBy(desc(dailyAiBriefs.date))
      .limit(1);
    if (brief?.briefMarkdown) return brief;
  } catch {}
  return {
    briefMarkdown:
      "You are carrying strong momentum. Protect evening wind-down and keep intensity moderate if HRV dips below baseline.",
    keyInsight: "Your consistency drives readiness.",
    actionItems: ["Morning light within 30 min of wake", "End caffeine by 2 PM", "20-minute walk post dinner"],
    moodPrompt: "What helped you feel calm yesterday?",
  };
}

export async function getRecentJournal(userId: string) {
  try {
    return await db
      .select()
      .from(journalEntries)
      .where(eq(journalEntries.userId, userId))
      .orderBy(desc(journalEntries.date))
      .limit(14);
  } catch {
    return [];
  }
}
