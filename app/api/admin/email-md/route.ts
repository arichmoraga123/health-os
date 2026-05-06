import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { buildComprehensiveDailyMarkdown } from "@/lib/comprehensive-oura-md";
import { dateKeyInTimeZone } from "@/lib/dates";
import { insertMessageLog } from "@/lib/admin-message-log";
import { sendEmail } from "@/lib/messaging";
import { requireAdminApi } from "@/lib/require-admin-api";

const bodySchema = z.object({
  userId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
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

  const [user] = await db.select().from(users).where(eq(users.id, body.userId)).limit(1);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (!user.ouraToken) {
    return NextResponse.json({ error: "User has no Oura token" }, { status: 400 });
  }

  const tz = user.homeTimezone || user.currentTimezone || "UTC";
  const today = dateKeyInTimeZone(new Date(), tz);
  const dateKey = body.date ?? today;

  let md: string;
  try {
    md = await buildComprehensiveDailyMarkdown({
      token: user.ouraToken,
      dateKey,
      userName: user.name ?? user.email,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to build markdown" },
      { status: 502 },
    );
  }

  const to = user.notificationEmail || user.email;
  if (!to) {
    return NextResponse.json({ error: "User has no email address" }, { status: 400 });
  }

  const name = user.name || user.email?.split("@")[0] || "there";
  const b64 = Buffer.from(md, "utf8").toString("base64");
  const base = process.env.NEXTAUTH_URL || "http://localhost:3000";

  const em = await sendEmail({
    to,
    subject: `Your Health Data — ${dateKey} (admin sent)`,
    html: `<p>Hi ${name},</p><p>Your full Oura raw export is attached.</p><p><a href="${base}/dashboard">Open Health OS</a></p>`,
    attachments: [
      {
        content: b64,
        filename: `health-report-${dateKey}.md`,
        type: "text/markdown",
        disposition: "attachment",
      },
    ],
  });

  if (em.error) {
    await insertMessageLog({
      userId: body.userId,
      type: "email",
      content: md.slice(0, 500),
      status: "failed",
      error: em.error,
    });
    return NextResponse.json({ error: em.error }, { status: 502 });
  }

  const messageId = await insertMessageLog({
    userId: body.userId,
    type: "email",
    content: `(Full Oura MD ${dateKey}) ${md.slice(0, 400)}…`,
    status: "sent",
  });

  return NextResponse.json({ ok: true, messageId });
}
