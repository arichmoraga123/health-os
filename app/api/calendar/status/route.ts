import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { googleCalendarTokens } from "@/db/schema";
import { requireApiUser } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const [row] = await db.select().from(googleCalendarTokens).where(eq(googleCalendarTokens.userId, auth.userId)).limit(1);

  const connected = !!(row?.accessToken || row?.refreshToken);
  return NextResponse.json({ connected });
}
