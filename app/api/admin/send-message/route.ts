import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { insertMessageLog } from "@/lib/admin-message-log";
import { sendEmail, sendSms, twilioVoiceCall } from "@/lib/messaging";
import { requireAdminApi } from "@/lib/require-admin-api";

const bodySchema = z.object({
  userId: z.string().uuid(),
  messageType: z.enum(["sms", "email", "both", "voice"]),
  content: z.string().min(1).max(32000),
});

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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

  const appUrl =
    process.env.NEXTAUTH_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
  const appBase = appUrl.startsWith("http") ? appUrl : `https://${appUrl}`;
  const emailTo = user.notificationEmail || user.email;

  const ids: string[] = [];
  const errors: string[] = [];

  const sendSmsLeg = async () => {
    if (!user.phoneNumber) {
      errors.push("No phone number on file");
      await insertMessageLog({
        userId: body.userId,
        type: "sms",
        content: body.content.slice(0, 2000),
        status: "failed",
        error: "No phone number",
      });
      return;
    }
    const r = await sendSms(user.phoneNumber, body.content.slice(0, 1600));
    if (r.error) {
      errors.push(r.error);
      ids.push(
        await insertMessageLog({
          userId: body.userId,
          type: "sms",
          content: body.content.slice(0, 2000),
          status: "failed",
          error: r.error,
        }),
      );
    } else {
      ids.push(
        await insertMessageLog({
          userId: body.userId,
          type: "sms",
          content: body.content.slice(0, 2000),
          status: "sent",
        }),
      );
    }
  };

  const sendEmailLeg = async () => {
    if (!emailTo) {
      errors.push("No email on file");
      await insertMessageLog({
        userId: body.userId,
        type: "email",
        content: body.content.slice(0, 2000),
        status: "failed",
        error: "No email",
      });
      return;
    }
    const name = user.name || user.email?.split("@")[0] || "there";
    const dash = `${appBase.replace(/\/$/, "")}/dashboard`;
    const html = `<!DOCTYPE html><html><body style="margin:0;background:#030712;padding:24px;">
<table width="100%" style="max-width:560px;margin:0 auto;background:#0f172a;border-radius:16px;padding:32px;border:1px solid #1f2937;">
<tr><td style="color:#f9fafb;font-family:system-ui,sans-serif;font-size:18px;font-weight:700;">Health OS — manual message</td></tr>
<tr><td style="padding-top:20px;color:#d1d5db;font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;">
<pre style="white-space:pre-wrap;font-family:inherit;margin:0;">${escapeHtml(body.content)}</pre>
</td></tr>
<tr><td style="padding-top:24px;"><a href="${dash}" style="color:#22c55e;font-family:system-ui,sans-serif;font-size:14px;">View dashboard →</a></td></tr>
</table></body></html>`;

    const r = await sendEmail({
      to: emailTo,
      subject: `${name} — Health OS (manual send)`,
      html,
      text: body.content,
    });
    if (r.error) {
      errors.push(r.error);
      ids.push(
        await insertMessageLog({
          userId: body.userId,
          type: "email",
          content: body.content.slice(0, 2000),
          status: "failed",
          error: r.error,
        }),
      );
    } else {
      ids.push(
        await insertMessageLog({
          userId: body.userId,
          type: "email",
          content: body.content.slice(0, 2000),
          status: "sent",
        }),
      );
    }
  };

  const sendVoiceLeg = async () => {
    if (!user.phoneNumber) {
      errors.push("No phone number on file");
      await insertMessageLog({
        userId: body.userId,
        type: "call",
        content: body.content.slice(0, 2000),
        status: "failed",
        error: "No phone number",
      });
      return;
    }
    const r = await twilioVoiceCall(user.phoneNumber, body.content);
    if (r.error) {
      errors.push(r.error);
      ids.push(
        await insertMessageLog({
          userId: body.userId,
          type: "call",
          content: body.content.slice(0, 2000),
          status: "failed",
          error: r.error,
        }),
      );
    } else {
      ids.push(
        await insertMessageLog({
          userId: body.userId,
          type: "call",
          content: body.content.slice(0, 2000),
          status: "sent",
        }),
      );
    }
  };

  switch (body.messageType) {
    case "sms":
      await sendSmsLeg();
      break;
    case "email":
      await sendEmailLeg();
      break;
    case "both":
      await sendSmsLeg();
      await sendEmailLeg();
      break;
    case "voice":
      await sendVoiceLeg();
      break;
    default:
      break;
  }

  const ok = errors.length === 0;
  return NextResponse.json({
    success: ok,
    messageId: ids[0] ?? null,
    messageIds: ids,
    errors: errors.length ? errors : undefined,
  });
}
