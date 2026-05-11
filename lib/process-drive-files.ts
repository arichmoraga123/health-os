import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { attentionLogs, driveProcessedFiles, driveWatchChannels } from "@/db/schema";
import { ATTENTION_CATEGORIES, type AttentionCategory } from "@/lib/attention";
import { createAttentionEvent } from "@/lib/google-calendar";
import { listNewFilesInFolder, readDriveFile } from "@/lib/google-drive";
import { parseAttentionMarkdown } from "@/lib/parse-attention-md";

function normalizeCategory(raw: string): AttentionCategory {
  const t = raw.trim();
  return (ATTENTION_CATEGORIES as readonly string[]).includes(t)
    ? (t as AttentionCategory)
    : "Other";
}

function parseAttentionUtc(entry: {
  dateUtc: string;
  startUtc: string;
  endUtc: string;
}): { startUtc: Date; endUtc: Date } {
  const startUtc = new Date(`${entry.dateUtc}T${entry.startUtc}:00Z`);
  let endUtc = new Date(`${entry.dateUtc}T${entry.endUtc}:00Z`);
  if (endUtc.getTime() <= startUtc.getTime()) {
    endUtc = new Date(endUtc.getTime() + 86_400_000);
  }
  return { startUtc, endUtc };
}

export async function logProcessed(
  userId: string,
  file: { id: string; name: string },
  eventsCreated: number,
  status: string,
  error: string | null,
) {
  await db
    .insert(driveProcessedFiles)
    .values({
      userId,
      fileId: file.id,
      fileName: file.name,
      eventsCreated,
      status,
      error,
    })
    .onConflictDoUpdate({
      target: [driveProcessedFiles.userId, driveProcessedFiles.fileId],
      set: {
        fileName: file.name,
        eventsCreated,
        status,
        error,
        processedAt: new Date(),
      },
    });
}

export async function processNewFiles(userId: string): Promise<void> {
  console.log("[drive-webhook] processing files for user", userId);

  const [channel] = await db
    .select()
    .from(driveWatchChannels)
    .where(eq(driveWatchChannels.userId, userId))
    .orderBy(desc(driveWatchChannels.createdAt))
    .limit(1);

  if (!channel) return;

  const files = await listNewFilesInFolder(userId, channel.folderId);

  for (const file of files) {
    const [existing] = await db
      .select()
      .from(driveProcessedFiles)
      .where(and(eq(driveProcessedFiles.userId, userId), eq(driveProcessedFiles.fileId, file.id)))
      .limit(1);

    if (existing?.status === "success") continue;

    try {
      const content = await readDriveFile(userId, file.id);
      const entries = parseAttentionMarkdown(content);

      if (entries.length === 0) {
        await logProcessed(userId, file, 0, "skipped", "No entries found");
        continue;
      }

      let eventsCreated = 0;
      const now = new Date();

      for (const entry of entries) {
        const category = normalizeCategory(entry.category);
        const { startUtc, endUtc } = parseAttentionUtc(entry);

        const [inserted] = await db
          .insert(attentionLogs)
          .values({
            userId,
            date: entry.localDate,
            startUtc,
            endUtc,
            startLocal: entry.startLocal,
            endLocal: entry.endLocal,
            location: entry.location?.trim() || null,
            timezone: entry.timezone,
            withPerson: entry.withPerson?.trim() || null,
            activity: entry.activity,
            category,
            notes: entry.notes?.trim() || null,
            createdAt: now,
            updatedAt: now,
          })
          .returning();

        if (!inserted) continue;

        try {
          const eventId = await createAttentionEvent(userId, inserted);
          if (eventId) {
            eventsCreated++;
            await db
              .update(attentionLogs)
              .set({ googleEventId: eventId, updatedAt: new Date() })
              .where(eq(attentionLogs.id, inserted.id));
          }
        } catch (err) {
          console.error("[drive-webhook] calendar event creation failed", err);
        }
      }

      await logProcessed(userId, file, eventsCreated, "success", null);
      console.log(
        `[drive-webhook] processed ${file.name}: ${entries.length} entries, ${eventsCreated} calendar events`,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      await logProcessed(userId, file, 0, "failed", message);
      console.error("[drive-webhook] file processing failed", file.name, err);
    }
  }
}
