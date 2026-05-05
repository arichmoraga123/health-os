import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { timezonePlans } from "@/db/schema";
import { askClaude } from "@/lib/ai";
import { requireApiUser } from "@/lib/api-auth";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { currentTz, homeTz } = await request.json();
  const offsetHours = 2;
  const planMarkdown = await askClaude(
    `Generate jet lag plan with circadian offset explanation, light schedule, sleep window and timeline. home=${homeTz} current=${currentTz} offset=${offsetHours}`,
  );
  const [existing] = await db
    .select()
    .from(timezonePlans)
    .where(and(eq(timezonePlans.userId, auth.userId), eq(timezonePlans.currentTz, currentTz)))
    .limit(1);
  if (existing) {
    await db.update(timezonePlans).set({ planMarkdown, offsetHours }).where(eq(timezonePlans.id, existing.id));
  } else {
    await db.insert(timezonePlans).values({ userId: auth.userId, currentTz, homeTz, offsetHours, planMarkdown });
  }
  return NextResponse.json({ planMarkdown, offsetHours });
}
