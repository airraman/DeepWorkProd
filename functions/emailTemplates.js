/* eslint max-len: ["error", {"code": 120}] */ // HTML/email strings read better unwrapped
// functions/emailTemplates.js - Reusable marketing email templates.
//
// Pure builders: { subject, html, text } from real values only. Nothing in
// this file sends or schedules anything, and no trigger calls it yet — a
// campaign must be wired up (and approved) separately. Every marketing
// template carries the unsubscribe link and postal address in its footer.

const escapeHtml = (value) => String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * "5h 20m" / "45m" from minutes.
 * @param {number} minutes
 * @return {string}
 */
function formatMinutes(minutes) {
  const total = Math.round(minutes);
  if (total < 60) return `${total}m`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Footer required on every marketing email.
 * @param {{unsubscribeUrl: string, postalAddress: string}} input
 * @return {{html: string, text: string}}
 */
function marketingFooter({unsubscribeUrl, postalAddress}) {
  return {
    html: `<p style="color:#6b7280;font-size:12px;line-height:18px;margin-top:32px">` +
      `You're receiving this because you turned on product emails in Lucid. ` +
      `<a href="${escapeHtml(unsubscribeUrl)}" style="color:#6b7280">Unsubscribe</a>` +
      `<br>${escapeHtml(postalAddress)}</p>`,
    text: `\n\n—\nYou're receiving this because you turned on product emails in Lucid.\n` +
      `Unsubscribe: ${unsubscribeUrl}\n${postalAddress}`,
  };
}

/**
 * Welcome-back email for a user who has been away. Every number and quote
 * comes from the caller, from the user's own sessions; optional lines are
 * left out when their value is missing rather than filled in.
 *
 * @param {object} input
 * @param {number} input.totalMinutes lifetime focus minutes (> 0)
 * @param {number} input.sessionCount lifetime completed sessions (> 0)
 * @param {string} [input.topActivity] the user's own activity name
 * @param {string} [input.nextStep] the user's last next-step reflection
 * @param {string} input.openAppUrl link that opens Lucid
 * @param {string} input.unsubscribeUrl signed unsubscribe link
 * @param {string} input.postalAddress sender's physical address
 * @return {{subject: string, html: string, text: string}}
 */
function welcomeBackEmail({totalMinutes, sessionCount, topActivity, nextStep,
  openAppUrl, unsubscribeUrl, postalAddress}) {
  if (!(totalMinutes > 0) || !(sessionCount > 0)) {
    throw new Error("welcomeBackEmail needs real, positive totals");
  }
  if (!unsubscribeUrl || !postalAddress) {
    throw new Error("welcomeBackEmail needs an unsubscribe link and postal address");
  }

  const time = formatMinutes(totalMinutes);
  const sessions = `${sessionCount} session${sessionCount === 1 ? "" : "s"}`;
  const activity = topActivity ? `, most of it on ${topActivity}` : "";
  const footer = marketingFooter({unsubscribeUrl, postalAddress});

  const subject = `Your ${time} of focus are still here`;
  const lines = [
    `You've spent ${time} in focus with Lucid across ${sessions}${activity}.`,
    ...(nextStep ? [`The last thing you planned was "${nextStep}".`] : []),
    "If today has room for ten minutes, that's enough to pick it back up.",
  ];

  const html = `<div style="font-family:-apple-system,Helvetica,Arial,sans-serif;` +
    `color:#111827;font-size:16px;line-height:24px;max-width:520px">` +
    lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("") +
    `<p><a href="${escapeHtml(openAppUrl)}" style="display:inline-block;` +
    `background:#111827;color:#ffffff;padding:12px 20px;border-radius:8px;` +
    `text-decoration:none;font-weight:600">Start a 10-minute session</a></p>` +
    `<p>— Lucid</p>${footer.html}</div>`;

  const text = `${lines.join("\n\n")}\n\nStart a 10-minute session: ${openAppUrl}\n\n— Lucid` +
    footer.text;

  return {subject, html, text};
}

module.exports = {
  escapeHtml,
  formatMinutes,
  marketingFooter,
  welcomeBackEmail,
};
