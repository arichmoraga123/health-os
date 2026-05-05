import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { communityPosts } from "@/db/schema";
import { requireApiUser } from "@/lib/api-auth";

export async function GET(request: Request) {
  const communityId = new URL(request.url).searchParams.get("communityId");
  if (!communityId) return NextResponse.json([]);
  const rows = await db.select().from(communityPosts).where(eq(communityPosts.communityId, communityId));
  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { communityId, content, parentId } = await request.json();
  const [post] = await db
    .insert(communityPosts)
    .values({ communityId, content, parentId: parentId ?? null, userId: auth.userId, reactions: {} })
    .returning();
  return NextResponse.json(post);
}
