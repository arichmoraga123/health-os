import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { initialsFromEmail } from "@/lib/utils";
import { validateOuraToken } from "@/lib/oura";

export async function POST(request: Request) {
  const body = (await request.json()) as { token?: string; email?: string; demo?: boolean };
  const email = body.email ?? "demo@healthos.app";
  let name = "Health OS User";
  const token = body.token ?? null;

  if (!body.demo && token) {
    const personalInfo = await validateOuraToken(token);
    name = personalInfo?.data?.[0]?.first_name ?? name;
  }

  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) {
    await db
      .update(users)
      .set({ ouraToken: body.demo ? null : token, name, currentTimezone: "UTC" })
      .where(eq(users.id, existing.id));
    return NextResponse.json({ ok: true, email });
  }

  await db.insert(users).values({
    email,
    ouraToken: body.demo ? null : token,
    name,
    avatarInitials: initialsFromEmail(email),
    homeTimezone: "UTC",
    currentTimezone: "UTC",
  });

  return NextResponse.json({ ok: true, email });
}
