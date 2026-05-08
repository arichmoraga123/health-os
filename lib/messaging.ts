import sgMail from "@sendgrid/mail";
import twilio from "twilio";

export function configureSendGrid() {
  const key = process.env.SENDGRID_API_KEY;
  if (key) sgMail.setApiKey(key);
}

export function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return twilio(sid, token);
}

export function escapeSayText(script: string): string {
  return script
    .replace(/&/g, " and ")
    .replace(/</g, " ")
    .replace(/>/g, " ")
    .replace(/"/g, " ");
}

export function buildEveningTwiML(script: string): string {
  const safe = escapeSayText(script);
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Joanna" rate="95%">${safe}</Say></Response>`;
}

export async function sendSms(to: string, body: string): Promise<{ sid?: string; error?: string }> {
  const from = process.env.TWILIO_PHONE_NUMBER;
  const client = getTwilioClient();
  if (!client || !from) {
    return { error: "Twilio not configured" };
  }
  try {
    const msg = await client.messages.create({ body, from, to });
    return { sid: msg.sid };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "SMS failed" };
  }
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: { content: string; filename: string; type: string; disposition: string }[];
}): Promise<{ error?: string }> {
  const key = process.env.SENDGRID_API_KEY;
  const from = process.env.SENDGRID_FROM_EMAIL;
  if (!key || !from) {
    return { error: "SendGrid not configured" };
  }
  configureSendGrid();
  try {
    await sgMail.send({
      to: opts.to,
      from,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      attachments: opts.attachments,
    });
    return {};
  } catch (e) {
    const err = e as { response?: { body?: unknown } };
    return { error: JSON.stringify(err.response?.body ?? e) };
  }
}

export function generateMorningEmailHtml(
  brief: string,
  cards: { sleep?: number | null; readiness?: number | null; hrv?: number | null },
  appUrl: string,
): string {
  const card = (label: string, v: number | null | undefined) =>
    `<td style="padding:16px 24px;background:#111827;border-radius:12px;text-align:center;color:#e5e7eb;font-family:system-ui,sans-serif;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#9ca3af;">${label}</div>
      <div style="font-size:28px;font-weight:700;margin-top:8px;color:#fff;">${v ?? "—"}</div>
    </td>`;
  return `<!DOCTYPE html><html><body style="margin:0;background:#030712;padding:24px;">
  <table width="100%" style="max-width:560px;margin:0 auto;background:#0f172a;border-radius:16px;padding:32px;border:1px solid #1f2937;">
    <tr><td style="color:#f9fafb;font-family:system-ui,sans-serif;font-size:20px;font-weight:700;">Health OS</td></tr>
    <tr><td style="padding-top:24px;">
      <table cellpadding="0" cellspacing="8"><tr>
        ${card("Sleep", cards.sleep)}${card("Readiness", cards.readiness)}${card("HRV", cards.hrv)}
      </tr></table>
    </td></tr>
    <tr><td style="padding-top:24px;color:#d1d5db;font-family:system-ui,sans-serif;font-size:15px;line-height:1.6;white-space:pre-wrap;">${brief.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td></tr>
    <tr><td style="padding-top:18px;color:#9ca3af;font-family:system-ui,sans-serif;font-size:13px;line-height:1.6;">
      Your sleep data and attention log from yesterday are attached.
    </td></tr>
    <tr><td style="padding-top:24px;">
      <a href="${appUrl.replace(/\/$/, "")}/dashboard" style="display:inline-block;background:#22c55e;color:#052e16;font-weight:600;padding:12px 20px;border-radius:10px;text-decoration:none;font-family:system-ui,sans-serif;font-size:14px;">View full dashboard →</a>
    </td></tr>
    <tr><td style="padding-top:24px;font-size:11px;color:#6b7280;font-family:system-ui,sans-serif;">
      <a href="${appUrl}/settings" style="color:#9ca3af;">Notification settings</a>
      · <a href="${appUrl}/settings" style="color:#9ca3af;">Unsubscribe / adjust emails</a>
    </td></tr>
  </table></body></html>`;
}

export async function twilioVoiceCall(to: string, script: string): Promise<{ sid?: string; error?: string }> {
  const from = process.env.TWILIO_PHONE_NUMBER;
  const client = getTwilioClient();
  if (!client || !from) {
    return { error: "Twilio not configured" };
  }
  const twiml = buildEveningTwiML(script);
  try {
    const call = await client.calls.create({ twiml, to, from });
    return { sid: call.sid };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Call failed" };
  }
}
