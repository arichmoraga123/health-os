import { desc, eq, max } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { dailySnapshots, messagesLog, users } from "@/db/schema";
import { maskOuraToken, maskPhone } from "@/lib/admin";
import { requireAdminApi } from "@/lib/require-admin-api";

export async function GET() {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  const allUsers = await db.select().from(users).orderBy(users.email);

  const agg = await db
    .select({
      userId: dailySnapshots.userId,
      lastSync: max(dailySnapshots.createdAt),
    })
    .from(dailySnapshots)
    .groupBy(dailySnapshots.userId);

  const syncMap = new Map(agg.map((r) => [r.userId, r.lastSync]));

  const payload = allUsers.map((u) => ({
    id: u.id,
    name: u.name ?? "—",
    email: u.email ?? "—",
    phoneMasked: maskPhone(u.phoneNumber),
    tokenMasked: maskOuraToken(u.ouraToken),
    lastSyncAt: syncMap.get(u.id)?.toISOString() ?? null,
  }));

  const logs = await db
    .select({
      id: messagesLog.id,
      sentAt: messagesLog.sentAt,
      type: messagesLog.type,
      status: messagesLog.status,
      content: messagesLog.content,
      error: messagesLog.error,
      userEmail: users.email,
      userName: users.name,
    })
    .from(messagesLog)
    .innerJoin(users, eq(messagesLog.userId, users.id))
    .orderBy(desc(messagesLog.sentAt))
    .limit(10);

  const logPayload = logs.map((l) => ({
    id: l.id,
    sentAt: l.sentAt?.toISOString() ?? null,
    user: l.userName || l.userEmail || "—",
    type: l.type,
    status: l.status,
    preview: l.content.slice(0, 120) + (l.content.length > 120 ? "…" : ""),
    error: l.error,
  }));

  return NextResponse.json({ users: payload, logs: logPayload });
}
