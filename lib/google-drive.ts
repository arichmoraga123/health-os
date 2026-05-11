import { and, desc, eq, ne } from "drizzle-orm";
import { google } from "googleapis";
import { db } from "@/db/client";
import { driveWatchChannels } from "@/db/schema";
import { getGoogleOAuth2ClientForUserOrThrow } from "@/lib/google-calendar";

function streamToString(stream: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    let content = "";
    stream.on("data", (chunk: Buffer | string) => {
      content += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    });
    stream.on("end", () => resolve(content));
    stream.on("error", reject);
  });
}

export async function getDriveClient(userId: string) {
  const auth = await getGoogleOAuth2ClientForUserOrThrow(userId);
  return google.drive({ version: "v3", auth });
}

export async function getOrCreateAttentionFolder(userId: string): Promise<string> {
  const drive = await getDriveClient(userId);

  const res = await drive.files.list({
    q: "name='attention tracker' and mimeType='application/vnd.google-apps.folder' and trashed=false",
    fields: "files(id, name)",
    pageSize: 10,
  });

  if (res.data.files?.length) {
    const parentId = res.data.files[0].id!;
    const subRes = await drive.files.list({
      q: `name='files' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: "files(id, name)",
      pageSize: 10,
    });
    if (subRes.data.files?.length) return subRes.data.files[0].id!;

    const created = await drive.files.create({
      requestBody: {
        name: "files",
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId],
      },
      fields: "id",
    });
    return created.data.id!;
  }

  const parent = await drive.files.create({
    requestBody: { name: "attention tracker", mimeType: "application/vnd.google-apps.folder" },
    fields: "id",
  });
  const child = await drive.files.create({
    requestBody: {
      name: "files",
      mimeType: "application/vnd.google-apps.folder",
      parents: [parent.data.id!],
    },
    fields: "id",
  });
  return child.data.id!;
}

async function stopPreviousWatchIfAny(userId: string, folderId: string): Promise<void> {
  const [prev] = await db
    .select()
    .from(driveWatchChannels)
    .where(eq(driveWatchChannels.userId, userId))
    .orderBy(desc(driveWatchChannels.createdAt))
    .limit(1);

  if (!prev || prev.folderId !== folderId) return;
  if (prev.expiration.getTime() <= Date.now()) return;

  try {
    const drive = await getDriveClient(userId);
    await drive.channels.stop({
      requestBody: { id: prev.channelId, resourceId: prev.resourceId },
    });
  } catch (e) {
    console.warn("[google-drive] channels.stop failed (non-fatal)", e);
  }
}

export async function watchDriveFolder(userId: string, folderId: string): Promise<string> {
  const baseUrl = (process.env.NEXTAUTH_URL || "").replace(/\/$/, "");
  if (!baseUrl) {
    throw new Error("NEXTAUTH_URL must be set for Drive push notifications.");
  }

  await stopPreviousWatchIfAny(userId, folderId);

  const drive = await getDriveClient(userId);
  const channelId = crypto.randomUUID();
  const expirationMs = Date.now() + 7 * 24 * 60 * 60 * 1000 - 60_000;

  const res = await drive.files.watch({
    fileId: folderId,
    requestBody: {
      id: channelId,
      type: "web_hook",
      address: `${baseUrl}/api/drive/webhook`,
      token: userId,
      expiration: String(expirationMs),
    },
  });

  const expRaw = res.data.expiration;
  const expiration =
    expRaw != null && expRaw !== ""
      ? new Date(Number(expRaw))
      : new Date(expirationMs);

  await db.insert(driveWatchChannels).values({
    userId,
    channelId,
    resourceId: res.data.resourceId ?? "",
    folderId,
    expiration,
  });

  await db
    .delete(driveWatchChannels)
    .where(
      and(
        eq(driveWatchChannels.userId, userId),
        eq(driveWatchChannels.folderId, folderId),
        ne(driveWatchChannels.channelId, channelId),
      ),
    );

  return channelId;
}

export async function readDriveFile(userId: string, fileId: string): Promise<string> {
  const drive = await getDriveClient(userId);

  const meta = await drive.files.get({
    fileId,
    fields: "mimeType, name",
  });
  const mime = meta.data.mimeType ?? "";

  if (mime === "application/vnd.google-apps.document") {
    const exported = await drive.files.export(
      { fileId, mimeType: "text/plain" },
      { responseType: "stream" },
    );
    return streamToString(exported.data as NodeJS.ReadableStream);
  }

  const media = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "stream" },
  );
  return streamToString(media.data as NodeJS.ReadableStream);
}

export async function listNewFilesInFolder(
  userId: string,
  folderId: string,
): Promise<Array<{ id: string; name: string; modifiedTime: string }>> {
  const drive = await getDriveClient(userId);

  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false and (mimeType='text/plain' or mimeType='text/markdown' or mimeType='application/octet-stream' or mimeType='application/vnd.google-apps.document')`,
    fields: "files(id, name, modifiedTime, mimeType)",
    orderBy: "modifiedTime desc",
    pageSize: 100,
  });

  return (
    res.data.files?.map((f) => ({
      id: f.id!,
      name: f.name!,
      modifiedTime: f.modifiedTime!,
    })) ?? []
  );
}
