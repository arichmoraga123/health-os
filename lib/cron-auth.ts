import { NextResponse } from "next/server";

/** Vercel Cron and manual triggers must send CRON_SECRET as Bearer or x-cron-secret. */
export function verifyCronRequest(req: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.warn("[cron] CRON_SECRET not set — rejecting cron request");
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 });
  }
  const auth = req.headers.get("authorization");
  const header = req.headers.get("x-cron-secret");
  if (auth === `Bearer ${secret}` || header === secret) {
    return null;
  }
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}
