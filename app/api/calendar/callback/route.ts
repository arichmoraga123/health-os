import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { googleCalendarTokens } from "@/db/schema";
import { getOAuthClient } from "@/lib/google";
import { requireApiUser } from "@/lib/api-auth";

export async function GET(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const code = new URL(request.url).searchParams.get("code");
  if (!code) return NextResponse.json({ error: "missing code" }, { status: 400 });
  const client = getOAuthClient(`${process.env.NEXTAUTH_URL}/api/calendar/callback`);
  const { tokens } = await client.getToken(code);

  const [existing] = await db.select().from(googleCalendarTokens).where(eq(googleCalendarTokens.userId, auth.userId)).limit(1);
  if (existing) {
    await db
      .update(googleCalendarTokens)
      .set({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? existing.refreshToken,
        expiry: tokens.expiry_date ? new Date(tokens.expiry_date) : existing.expiry,
      })
      .where(eq(googleCalendarTokens.id, existing.id));
  } else {
    await db.insert(googleCalendarTokens).values({
      userId: auth.userId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    });
  }

  return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/calendar`);
}
