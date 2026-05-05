import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { requireApiUser } from "@/lib/api-auth";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { subscription } = await request.json();
  await db.update(users).set({ pushSubscription: subscription }).where(eq(users.id, auth.userId));
  return NextResponse.json({ ok: true });
}
