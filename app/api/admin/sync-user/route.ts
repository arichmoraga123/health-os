import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/require-admin-api";
import { runOuraSyncForUser } from "@/lib/run-oura-sync";

const bodySchema = z.object({
  userId: z.string().uuid(),
  days: z.number().min(1).max(90).optional(),
});

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if ("error" in auth) return auth.error;

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const result = await runOuraSyncForUser({
    userId: body.userId,
    days: body.days ?? 7,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  return NextResponse.json({
    ok: true,
    syncedDays: result.syncedDays,
    message: result.message,
    range: result.range,
  });
}
