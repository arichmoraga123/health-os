import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { communityPosts } from "@/db/schema";
import { requireApiUser } from "@/lib/api-auth";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { postId, emoji } = await request.json();
  const [post] = await db.select().from(communityPosts).where(eq(communityPosts.id, postId)).limit(1);
  if (!post) return NextResponse.json({ error: "post not found" }, { status: 404 });
  const reactions = (post.reactions as Record<string, string[]>) ?? {};
  const users = reactions[emoji] ?? [];
  reactions[emoji] = users.includes(auth.userId) ? users.filter((id) => id !== auth.userId) : [...users, auth.userId];
  await db.update(communityPosts).set({ reactions }).where(eq(communityPosts.id, postId));
  return NextResponse.json({ ok: true, reactions });
}
