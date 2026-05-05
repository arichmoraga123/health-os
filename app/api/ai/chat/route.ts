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
    const systemPrompt = `You are an elite performance coach and sleep scientist with access to the user's complete Oura biometric data. You have expertise in sleep science, HRV, circadian biology, stress physiology, and athletic performance. Be specific, reference actual numbers from their data, give actionable advice. Keep responses under 150 words unless asked for detail. Never be vague.

Context:
timezone=${user?.currentTimezone ?? user?.homeTimezone ?? "UTC"}
snapshots_30d=${JSON.stringify(snapshots)}
journals_recent=${JSON.stringify(journals)}
oura_tags=${JSON.stringify(tags)}
trip_plan=${JSON.stringify(tripPlan)}
community_challenges=${JSON.stringify(challengeProgress)}`;
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
