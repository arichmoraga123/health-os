import { isNotNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { dailyAiBriefs, users } from "@/db/schema";
import { askClaude } from "@/lib/ai";
import { ouraFetch } from "@/lib/oura";
import { sendPush } from "@/lib/push";
import { dateKey } from "@/lib/utils";

export async function GET() {
  const allUsers = await db.select().from(users).where(isNotNull(users.ouraToken));
  for (const user of allUsers) {
    try {
      await Promise.all([
        ouraFetch("v2/usercollection/daily_sleep", user.ouraToken!),
        ouraFetch("v2/usercollection/daily_readiness", user.ouraToken!),
        ouraFetch("v2/usercollection/daily_activity", user.ouraToken!),
      ]);
      const brief = await askClaude("Generate daily brief in 2 sentences.");
      await db.insert(dailyAiBriefs).values({ userId: user.id, date: dateKey(), briefMarkdown: brief });
      await sendPush(user.pushSubscription, { title: "Health OS Brief Ready", body: "Your daily brief has been generated." });
    } catch {
      continue;
    }
  }
  return NextResponse.json({ ok: true });
}
