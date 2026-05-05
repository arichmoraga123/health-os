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
import { authOptions } from "@/lib/auth";
import { createClaudeMessage } from "@/lib/ai";
import { requireApiUser } from "@/lib/api-auth";
import { dateKey } from "@/lib/utils";
import { getServerSession } from "next-auth";

export async function GET() {
  return NextResponse.json({ status: "ok" });
}

export async function POST(request: Request) {
  console.log("AI route hit", new Date().toISOString());
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
  }
  console.error("API KEY present:", !!process.env.ANTHROPIC_API_KEY);
  try {
    const requestBody = await request.json();
    console.log("AI chat request body:", requestBody);
    const auth = await requireApiUser();
    if ("error" in auth) {
      const session = await getServerSession(authOptions);
      console.error("AI auth failed", { hasSession: !!session, userId: session?.user?.id ?? null });
      return auth.error;
    }
    const { messages } = requestBody as { messages?: Array<{ role?: string; content?: string }> };
    const [user] = await db.select().from(users).where(eq(users.id, auth.userId)).limit(1);
    const snapshots = await db
      .select()
      .from(dailySnapshots)
      .where(gte(dailySnapshots.date, dateKey(subDays(new Date(), 30))))
      .limit(30);
    const recent = [...snapshots].slice(-7);
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

    const tags = recent.flatMap((s) => (Array.isArray(s.tags) ? s.tags : [])).slice(0, 15);
    const avg = (vals: Array<number | null | undefined>) => {
      const present = vals.filter((v): v is number => v != null);
      if (!present.length) return null;
      return Math.round(present.reduce((a, b) => a + b, 0) / present.length);
    };
    const summary = {
      timezone: user?.currentTimezone ?? user?.homeTimezone ?? "UTC",
      days: recent.length,
      averages: {
        sleepScore: avg(recent.map((s) => s.sleepScore)),
        readinessScore: avg(recent.map((s) => s.readinessScore)),
        hrv: avg(recent.map((s) => s.hrv)),
        steps: avg(recent.map((s) => s.steps)),
      },
      daily: recent.map((s) => ({
        date: s.date,
        sleepScore: s.sleepScore,
        readinessScore: s.readinessScore,
        hrv: s.hrv,
        steps: s.steps,
      })),
      tags,
      journalHighlights: journals.slice(0, 3).map((j) => ({
        date: j.date,
        entry: j.entry ? String(j.entry).slice(0, 160) : null,
      })),
      hasTripPlan: !!tripPlan,
      challengeCount: challengeProgress.length,
    };
    const systemPrompt = `You are an elite performance coach and sleep scientist.
Use only provided numbers. Be specific and actionable.
Keep responses under 150 words unless asked for detail.

Health summary (last 7 days):
${JSON.stringify(summary)}`;
    const conversationMessages = (Array.isArray(messages) ? messages : []).map(
      (m: { role?: string; content?: string }) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: String(m.content ?? ""),
      }),
    );
    const message = await createClaudeMessage({
      system: systemPrompt,
      maxTokens: 1024,
      messages: conversationMessages,
    });
    const content = message.content
      .map((c) => ("text" in c ? c.text : ""))
      .join("")
      .trim();
    return Response.json({ content });
  } catch (e) {
    console.error("AI chat route error:", e);
    const message = e instanceof Error ? e.message : "AI chat route failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
