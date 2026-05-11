import { desc, lte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { driveWatchChannels } from "@/db/schema";
import { verifyCronRequest } from "@/lib/cron-auth";
import { watchDriveFolder } from "@/lib/google-drive";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const deny = verifyCronRequest(req);
  if (deny) return deny;

  const renewBefore = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const candidates = await db
    .select()
    .from(driveWatchChannels)
    .where(lte(driveWatchChannels.expiration, renewBefore))
    .orderBy(desc(driveWatchChannels.createdAt));

  const seen = new Set<string>();
  const results: { userId: string; folderId: string; ok: boolean; detail?: string }[] = [];

  for (const row of candidates) {
    const key = `${row.userId}:${row.folderId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    try {
      await watchDriveFolder(row.userId, row.folderId);
      results.push({ userId: row.userId, folderId: row.folderId, ok: true });
    } catch (e) {
      results.push({
        userId: row.userId,
        folderId: row.folderId,
        ok: false,
        detail: e instanceof Error ? e.message : String(e),
      });
    }
  }

  const now = new Date();
  await db.delete(driveWatchChannels).where(lte(driveWatchChannels.expiration, now));

  return NextResponse.json({ ok: true, renewed: results.length, results });
}
