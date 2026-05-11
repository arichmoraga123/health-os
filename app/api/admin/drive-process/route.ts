import { NextResponse } from "next/server";
import { processNewFiles } from "@/lib/process-drive-files";
import { requireAdminApi } from "@/lib/require-admin-api";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  let body: { userId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const userId = body.userId?.trim();
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  try {
    await processNewFiles(userId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Process failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
