import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { driveProcessedFiles, driveWatchChannels } from "@/db/schema";
import { requireApiUser } from "@/lib/api-auth";
import { getOrCreateAttentionFolder, watchDriveFolder } from "@/lib/google-drive";

export const dynamic = "force-dynamic";

export async function POST() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const userId = auth.userId;

  try {
    const folderId = await getOrCreateAttentionFolder(userId);
    const channelId = await watchDriveFolder(userId, folderId);

    return NextResponse.json({
      success: true,
      folderId,
      channelId,
      message: 'Now watching "attention tracker/files" folder in your Google Drive',
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Drive setup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const [channel] = await db
    .select()
    .from(driveWatchChannels)
    .where(eq(driveWatchChannels.userId, auth.userId))
    .orderBy(desc(driveWatchChannels.createdAt))
    .limit(1);

  const recentFiles = await db
    .select()
    .from(driveProcessedFiles)
    .where(eq(driveProcessedFiles.userId, auth.userId))
    .orderBy(desc(driveProcessedFiles.processedAt))
    .limit(10);

  return NextResponse.json({
    connected: !!channel,
    channelExpiry: channel?.expiration?.toISOString() ?? null,
    recentFiles: recentFiles.map((r) => ({
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
