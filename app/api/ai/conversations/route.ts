import { and, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { aiConversations } from "@/db/schema";
import { requireApiUser } from "@/lib/api-auth";
import { dateKey } from "@/lib/utils";

type ConversationMessage = {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
};

export async function GET() {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const rows = await db
    .select()
    .from(aiConversations)
    .where(eq(aiConversations.userId, auth.userId))
    .orderBy(desc(aiConversations.updatedAt));
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const body = await request.json().catch(() => ({}));
  const first = String(body.firstMessage ?? "").trim();
  const title = first ? first.slice(0, 50) : "New Chat";
  const [created] = await db
    .insert(aiConversations)
    .values({
      userId: auth.userId,
      date: dateKey(),
      title,
      messages: [],
    })
    .returning();
  return NextResponse.json(created);
}

export async function PUT(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const body = await request.json().catch(() => ({}));
  const id = String(body.id ?? "");
  const messages = (body.messages ?? []) as ConversationMessage[];
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const [updated] = await db
    .update(aiConversations)
    .set({
      messages,
      updatedAt: new Date(),
      title:
        typeof body.title === "string"
          ? body.title.slice(0, 50)
          : messages.find((m) => m.role === "user")?.content.slice(0, 50) ?? "New Chat",
    })
    .where(and(eq(aiConversations.id, id), eq(aiConversations.userId, auth.userId)))
    .returning();
  if (!updated) return NextResponse.json({ error: "conversation not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db
    .delete(aiConversations)
    .where(and(eq(aiConversations.id, id), eq(aiConversations.userId, auth.userId)));
  return NextResponse.json({ ok: true });
}
