import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { communities, communityMembers } from "@/db/schema";
import { requireApiUser } from "@/lib/api-auth";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const { inviteCode } = await request.json().catch(() => ({ inviteCode: "" }));
  const [community] = await db.select().from(communities).where(eq(communities.inviteCode, inviteCode)).limit(1);
  if (!community) return NextResponse.json({ error: "invalid invite code" }, { status: 404 });
  const [existing] = await db
    .select()
    .from(communityMembers)
    .where(and(eq(communityMembers.communityId, community.id), eq(communityMembers.userId, auth.userId)))
    .limit(1);
  if (!existing) {
    await db.insert(communityMembers).values({ communityId: community.id, userId: auth.userId, role: "member" });
  }
  return NextResponse.json({ joined: true, communityId: community.id });
}
