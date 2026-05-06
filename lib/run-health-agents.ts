import type { InferSelectModel } from "drizzle-orm";
import type { users } from "@/db/schema";
import { isWithinLocalTimeWindow } from "@/lib/agent-schedule";
import { createClaudeMessage } from "@/lib/ai";
import { dateKeyInTimeZone } from "@/lib/dates";
import { buildComprehensiveDailyMarkdown } from "@/lib/comprehensive-oura-md";
import { generateDailyMarkdown } from "@/lib/generate-daily-md";
import { buildEveningPrompt, buildMorningPrompt, pickLatestWithSleep } from "@/lib/health-agent-prompts";
import { getSnapshotsAsc } from "@/lib/health";
import { buildEveningTwiML, generateMorningEmailHtml, sendEmail, sendSms, twilioVoiceCall } from "@/lib/messaging";
import { runOuraSyncForUser } from "@/lib/run-oura-sync";

export type UserRow = InferSelectModel<typeof users>;

export async function runMorningAgentForUser(
  user: UserRow,
  ctx: { now: Date; appUrl: string; bypassTimeWindow?: boolean },
): Promise<{ ok: boolean; brief?: string; detail?: string }> {
  if (!user.smsEnabled && !user.emailEnabled) {
    return { ok: true, detail: "skipped: notifications off" };
  }
  const tz = user.homeTimezone || user.currentTimezone || "UTC";
  if (
    !ctx.bypassTimeWindow &&
    !isWithinLocalTimeWindow(ctx.now, tz, user.morningMessageTime ?? "10:00", 14)
  ) {
    return { ok: true, detail: "skipped: not local morning window" };
  }

  try {
    const sync = await runOuraSyncForUser({ userId: user.id, days: 3, timeZone: tz });
    if (!sync.ok) return { ok: false, detail: sync.error };

    const snaps = await getSnapshotsAsc(user.id, 14, tz);
    const sleepRow = pickLatestWithSleep(snaps);
    const todayKey = dateKeyInTimeZone(ctx.now, tz);
    const todayRow = snaps.find((s) => String(s.date) === todayKey) ?? snaps[snaps.length - 1];

    const name = user.name || user.email?.split("@")[0] || "there";
    const prompt = buildMorningPrompt(name, snaps, sleepRow, todayRow);

    if (!process.env.ANTHROPIC_API_KEY) return { ok: false, detail: "no ANTHROPIC_API_KEY" };

    const msg = await createClaudeMessage({
      system: "Reply with only the brief text — no title, no markdown fences.",
      messages: [{ role: "user", content: prompt }],
      maxTokens: 900,
    });
    const brief = msg.content.map((c) => ("text" in c ? c.text : "")).join("").trim();

    const appBase = ctx.appUrl.startsWith("http") ? ctx.appUrl : `https://${ctx.appUrl}`;
    let channels = 0;
    let failures = 0;

    if (user.smsEnabled && user.phoneNumber) {
      channels += 1;
      const sms = await sendSms(user.phoneNumber, brief.slice(0, 1500));
      if (sms.error) failures += 1;
    }

    if (user.emailEnabled) {
      const to = user.notificationEmail || user.email;
      if (to) {
        channels += 1;
        const html = generateMorningEmailHtml(
          brief,
          {
            sleep: sleepRow?.sleepScore ?? todayRow?.sleepScore,
            readiness: todayRow?.readinessScore,
            hrv: todayRow?.hrv ?? sleepRow?.hrv,
          },
          appBase,
        );
        const subj = `Good morning ${name} — Your Health Brief for ${todayKey}`;
        const em = await sendEmail({ to, subject: subj, html, text: brief });
        if (em.error) failures += 1;
      }
    }

    if (channels === 0) return { ok: true, brief, detail: "no delivery channels (add phone or notification email)" };
    return {
      ok: failures === 0,
      brief,
      detail: failures ? "one or more delivery failures" : "sent",
    };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "error" };
  }
}

export async function runEveningAgentForUser(
  user: UserRow,
  ctx: { now: Date; bypassTimeWindow?: boolean },
): Promise<{ ok: boolean; script?: string; twiml?: string; detail?: string }> {
  const tz = user.homeTimezone || user.currentTimezone || "UTC";
  if (
    !ctx.bypassTimeWindow &&
    !isWithinLocalTimeWindow(ctx.now, tz, user.eveningCallTime ?? "21:00", 14)
  ) {
    return { ok: true, detail: "skipped: not local evening window" };
  }

  const wantsCall = user.eveningCallEnabled && !!user.phoneNumber;
  const wantsNightEmail = user.nightlyEmailEnabled;
  const wantsEveningSms = user.smsEnabled && !!user.phoneNumber;
  if (!wantsCall && !wantsNightEmail && !wantsEveningSms) {
    return { ok: true, detail: "skipped: evening channels off" };
  }

  try {
    const sync = await runOuraSyncForUser({ userId: user.id, days: 3, timeZone: tz });
    if (!sync.ok) return { ok: false, detail: sync.error };

    const snaps = await getSnapshotsAsc(user.id, 14, tz);
    const todayKey = dateKeyInTimeZone(ctx.now, tz);
    const todayRow = snaps.find((s) => String(s.date) === todayKey) ?? snaps[snaps.length - 1];
    const name = user.name || user.email?.split("@")[0] || "there";
    const prompt = buildEveningPrompt(name, snaps, todayRow);

    let script = "";
    if (wantsCall) {
      if (!process.env.ANTHROPIC_API_KEY) return { ok: false, detail: "no ANTHROPIC_API_KEY" };
      const msg = await createClaudeMessage({
        system: "Reply with only the spoken script — no stage directions, no markdown.",
        messages: [{ role: "user", content: prompt }],
        maxTokens: 900,
      });
      script = msg.content.map((c) => ("text" in c ? c.text : "")).join("").trim();
    }

    const twiml = script ? buildEveningTwiML(script) : undefined;

    let failures = 0;
    if (wantsCall && user.phoneNumber) {
      const call = await twilioVoiceCall(user.phoneNumber, script);
      if (call.error) failures += 1;
    }

    const sleepRow = pickLatestWithSleep(snaps);
    const targetBed =
      sleepRow?.optimalBedtimeStart && sleepRow?.optimalBedtimeEnd
        ? `${sleepRow.optimalBedtimeStart}–${sleepRow.optimalBedtimeEnd}`
        : "your usual wind-down";

    if (wantsEveningSms) {
      const smsBody = `${name}, your evening brief is ready. Steps: ${todayRow?.steps ?? "—"} | Readiness: ${todayRow?.readinessScore ?? "—"} | Target bedtime: ${targetBed}. Sleep well 🌙`;
      const sms = await sendSms(user.phoneNumber!, smsBody.slice(0, 1500));
      if (sms.error) failures += 1;
    }

    if (wantsNightEmail) {
      const to = user.notificationEmail || user.email;
      if (to && (user.ouraToken || todayRow)) {
        let md: string;
        if (user.ouraToken) {
          try {
            md = await buildComprehensiveDailyMarkdown({
              token: user.ouraToken,
              dateKey: todayKey,
              userName: user.name ?? user.email,
            });
          } catch {
            md = todayRow
              ? generateDailyMarkdown(user, todayRow)
              : `# Health OS — ${todayKey}\n\n_Comprehensive Oura export failed; no snapshot fallback available._\n`;
          }
        } else if (todayRow) {
          md = generateDailyMarkdown(user, todayRow);
        } else {
          md = `# Health OS — ${todayKey}\n\n_No Oura token or snapshot._\n`;
        }
        const b64 = Buffer.from(md, "utf8").toString("base64");
        const base = process.env.NEXTAUTH_URL || "http://localhost:3000";
        const em = await sendEmail({
          to,
          subject: `Your Health Data — ${todayKey}`,
          html: `<p>Hi ${name},</p><p>Your daily Oura health report is attached (full raw API export). See you on your morning brief tomorrow.</p><p><a href="${base}/dashboard">Open Health OS</a></p>`,
          attachments: [
            {
              content: b64,
              filename: `health-report-${todayKey}.md`,
              type: "text/markdown",
              disposition: "attachment",
            },
          ],
        });
        if (em.error) failures += 1;
      }
    }

    const tried =
      (wantsCall ? 1 : 0) +
      (wantsEveningSms ? 1 : 0) +
      (wantsNightEmail && !!(user.notificationEmail || user.email) && !!(user.ouraToken || todayRow) ? 1 : 0);
    return {
      ok: tried === 0 || failures === 0,
      script: script || undefined,
      twiml,
      detail:
        tried === 0
          ? "nothing to send"
          : failures
            ? "one or more delivery failures"
            : "evening complete",
    };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : "error" };
  }
}
