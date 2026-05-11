import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { driveProcessedFiles } from "@/db/schema";
import { requireAdminApi } from "@/lib/require-admin-api";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("userId")?.trim();
  if (!userId) {
    return NextResponse.json({ error: "userId query required" }, { status: 400 });
  }

  const rows = await db
    .select()
    .from(driveProcessedFiles)
    .where(eq(driveProcessedFiles.userId, userId))
    .orderBy(desc(driveProcessedFiles.processedAt))
    .limit(50);

  return NextResponse.json({
    files: rows.map((r) => ({
      id: r.id,
      fileId: r.fileId,
      fileName: r.fileName,
      processedAt: r.processedAt?.toISOString() ?? null,
      eventsCreated: r.eventsCreated,
      status: r.status,
      error: r.error,
    })),
  });
}
