import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/api-auth";
import { deleteCalendarEvent, userHasGoogleCalendarTokens } from "@/lib/google-calendar";

export async function DELETE(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireApiUser();
  if ("error" in auth) return auth.error;

  const has = await userHasGoogleCalendarTokens(auth.userId);
  if (!has) {
    return NextResponse.json(
      { error: "Connect Google Calendar in Settings first." },
      { status: 400 },
    );
  }

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const ok = await deleteCalendarEvent(auth.userId, id);
  return NextResponse.json({ ok });
}
