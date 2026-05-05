import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { requireApiUser } from "@/lib/api-auth";

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const [user] = await db.select().from(users).where(eq(users.id, auth.userId)).limit(1);
  if (!user?.ouraToken) {
    return NextResponse.json({ error: "No Oura token for user" }, { status: 400 });
  }
  if (!process.env.OURA_WORKER_URL) {
    return NextResponse.json({ error: "OURA_WORKER_URL not set" }, { status: 500 });
  }

  const url = new URL(`${process.env.OURA_WORKER_URL.replace(/\/$/, "")}/v2/usercollection/sleep`);
  url.searchParams.set("start_date", "2026-05-01");
  url.searchParams.set("end_date", "2026-05-05");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${user.ouraToken}` },
    cache: "no-store",
  });
  const json = await response.json().catch(() => ({}));
  return NextResponse.json(
    {
      status: response.status,
      url: url.toString(),
      data: json,
    },
    { status: response.ok ? 200 : response.status },
  );
}
