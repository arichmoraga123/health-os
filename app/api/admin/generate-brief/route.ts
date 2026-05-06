import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { createClaudeMessage } from "@/lib/ai";
import { dateKeyInTimeZone } from "@/lib/dates";
import { buildEveningPrompt, buildMorningPrompt, pickLatestWithSleep } from "@/lib/health-agent-prompts";
import { getSnapshotsAsc } from "@/lib/health";
import { requireAdminApi } from "@/lib/require-admin-api";

const bodySchema = z.object({
  userId: z.string().uuid(),
  type: z.enum(["morning", "evening"]),
});

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const [user] = await db.select().from(users).where(eq(users.id, body.userId)).limit(1);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const tz = user.homeTimezone || user.currentTimezone || "UTC";
  const snaps = await getSnapshotsAsc(user.id, 14, tz);
  const todayKey = dateKeyInTimeZone(new Date(), tz);
  const todayRow = snaps.find((s) => String(s.date) === todayKey) ?? snaps[snaps.length - 1];
  const sleepRow = pickLatestWithSleep(snaps);
  const name = user.name || user.email?.split("@")[0] || "there";

  let prompt: string;
  let system: string;
  if (body.type === "morning") {
    prompt = buildMorningPrompt(name, snaps, sleepRow, todayRow);
    system = "Reply with only the brief text — no title, no markdown fences.";
  } else {
    prompt = buildEveningPrompt(name, snaps, todayRow);
    system = "Reply with only the spoken script — no stage directions, no markdown.";
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 503 });
  }

  const msg = await createClaudeMessage({
    system,
    messages: [{ role: "user", content: prompt }],
    maxTokens: 900,
  });
  const text = msg.content.map((c) => ("text" in c ? c.text : "")).join("").trim();

  return NextResponse.json({ text });
}
