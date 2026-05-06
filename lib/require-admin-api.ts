import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";

export async function requireAdminApi() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;
  if (!email || !isAdminEmail(email)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { session };
}
