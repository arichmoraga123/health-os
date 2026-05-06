import { db } from "@/db/client";
import { messagesLog } from "@/db/schema";

export async function insertMessageLog(opts: {
  userId: string;
  type: string;
  content: string;
  status: "sent" | "failed";
  error?: string | null;
}): Promise<string> {
  const [row] = await db
    .insert(messagesLog)
    .values({
      userId: opts.userId,
      type: opts.type,
      content: opts.content.slice(0, 16000),
      status: opts.status,
      error: opts.error ?? null,
    })
    .returning({ id: messagesLog.id });
  return row!.id;
}
