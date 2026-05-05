import { NextResponse } from "next/server";
import { db } from "@/db/client";
import { communities, communityMembers } from "@/db/schema";
import { requireApiUser } from "@/lib/api-auth";
import { randomInviteCode } from "@/lib/community";

export async function POST(request: Request) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;
  const body = await request.json().catch(() => ({}));
  const inviteCode = randomInviteCode();
  const [community] = await db
    .insert(communities)
    .values({
      name: body.name ?? "My Community",
      description: body.description ?? "",
      inviteCode,
      createdBy: auth.userId,
    })
    .returning();
  await db.insert(communityMembers).values({ communityId: community.id, userId: auth.userId, role: "admin" });
  return NextResponse.json({ community, inviteCode });
}
