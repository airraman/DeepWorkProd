/* eslint max-len: ["error", {"code": 120}] */ // HTML/email strings read better unwrapped
// functions/emailPolicy.js - Who may receive which email, and the signed
// tokens and headers that make unsubscribing work.
//
// Pure (no firebase-admin, no Resend) so it can be unit tested with
// node:test (see __tests__/emailPolicy.test.js). email.js does the I/O.
//
// CATEGORIES
//   transactional  Account and product-function mail the user needs (e.g. a
//                  receipt, a sign-in problem). Sent without marketing
//                  consent, but never to a hard-bounced or complaining
//                  address.
//   marketing      Re-engagement, welcome-back, product updates, newsletters.
//                  Requires explicit consent. Having an email address is
//                  NOT consent.
//
// CONSENT (users/{uid}/preferences/email, written by the app or by the
// unsubscribe endpoint):
//   marketingConsent  "granted" | "denied"   missing = no consent
//   consentSource     "app_settings" | "unsubscribe_link" | "one_click" | ...
//   consentUpdatedAt  timestamp
//
// UNSUBSCRIBE sets marketingConsent "denied" for that user (per uid), so a
// later opt-in from the app cleanly re-enables marketing.
//
// SUPPRESSION (email_suppressions/{sha256(normalized email)}): address-level,
// written by the Resend webhook. Blocks every category, transactional too.
//   reason  "hard_bounce" | "complaint"
//   scope   "all"

const crypto = require("crypto");

const CATEGORIES = {TRANSACTIONAL: "transactional", MARKETING: "marketing"};

const SVIX_TOLERANCE_SECONDS = 5 * 60;

/**
 * Lowercased, trimmed address, or null.
 * @param {*} email
 * @return {string|null}
 */
function normalizeEmail(email) {
  if (typeof email !== "string") return null;
  const e = email.trim().toLowerCase();
  return e.includes("@") ? e : null;
}

/**
 * Suppression doc id: a SHA-256 of the normalized address, so the
 * collection never stores addresses in plain text as document ids.
 * @param {string} email
 * @return {string|null}
 */
function suppressionId(email) {
  const e = normalizeEmail(email);
  return e ? crypto.createHash("sha256").update(e).digest("hex") : null;
}

/**
 * Suppression scope for a reason.
 * @param {string} reason
 * @return {"all"|"marketing"}
 */
function suppressionScope(reason) {
  return reason === "unsubscribe" ? "marketing" : "all";
}

/**
 * The single send decision.
 * @param {object} input
 * @param {string} input.category CATEGORIES value
 * @param {object|null} input.consent preferences/email data
 * @param {object|null} input.suppression email_suppressions doc data
 * @return {{allowed: boolean, reason: string}}
 */
function canSendEmail({category, consent, suppression}) {
  if (category !== CATEGORIES.TRANSACTIONAL &&
      category !== CATEGORIES.MARKETING) {
    return {allowed: false, reason: "unknown_category"};
  }
  if (suppression && suppression.scope === "all") {
    return {allowed: false, reason: `suppressed_${suppression.reason}`};
  }
  if (category === CATEGORIES.TRANSACTIONAL) {
    return {allowed: true, reason: "transactional"};
  }
  if (suppression) {
    return {allowed: false, reason: `suppressed_${suppression.reason}`};
  }
  if (consent?.marketingConsent !== "granted") {
    return {allowed: false, reason: "no_marketing_consent"};
  }
  return {allowed: true, reason: "consented"};
}

const b64url = (buf) => Buffer.from(buf).toString("base64url");

/**
 * Signed, non-expiring unsubscribe token for one user + category. Links must
 * keep working long after sending (CAN-SPAM requires at least 30 days).
 * @param {string} uid
 * @param {string} secret EMAIL_UNSUBSCRIBE_SECRET
 * @return {string}
 */
function createUnsubscribeToken(uid, secret) {
  const payload = b64url(JSON.stringify({u: uid, c: CATEGORIES.MARKETING}));
  const sig = b64url(crypto.createHmac("sha256", secret).update(payload).digest());
  return `${payload}.${sig}`;
}

/**
 * The uid in a valid token, or null.
 * @param {*} token
 * @param {string} secret
 * @return {string|null}
 */
function verifyUnsubscribeToken(token, secret) {
  if (typeof token !== "string" || !secret) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest();
  let given;
  try {
    given = Buffer.from(sig, "base64url");
  } catch (error) {
    return null;
  }
  if (given.length !== expected.length ||
      !crypto.timingSafeEqual(given, expected)) {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof data.u === "string" && data.u ? data.u : null;
  } catch (error) {
    return null;
  }
}

/**
 * RFC 8058 one-click headers for a marketing email.
 * @param {string} unsubscribeUrl
 * @return {object}
 */
function unsubscribeHeaders(unsubscribeUrl) {
  return {
    "List-Unsubscribe": `<${unsubscribeUrl}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/**
 * Verify a Resend (Svix) webhook signature over the RAW request body.
 * @param {object} input
 * @param {string} input.secret RESEND_WEBHOOK_SECRET ("whsec_...")
 * @param {string} input.id svix-id header
 * @param {string} input.timestamp svix-timestamp header (seconds)
 * @param {string} input.signature svix-signature header ("v1,<b64> ...")
 * @param {string|Buffer} input.rawBody
 * @param {number} [input.nowSeconds]
 * @return {boolean}
 */
function verifySvixSignature({secret, id, timestamp, signature, rawBody,
  nowSeconds = Math.floor(Date.now() / 1000)}) {
  if (!secret || !id || !timestamp || !signature || rawBody === undefined) {
    return false;
  }
  const ts = parseInt(timestamp, 10);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > SVIX_TOLERANCE_SECONDS) {
    return false;
  }
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const signed = `${id}.${timestamp}.${Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : rawBody}`;
  const expected = crypto.createHmac("sha256", key).update(signed).digest();
  return signature.split(" ").some((part) => {
    const [version, value] = part.split(",");
    if (version !== "v1" || !value) return false;
    const given = Buffer.from(value, "base64");
    return given.length === expected.length &&
      crypto.timingSafeEqual(given, expected);
  });
}

/**
 * Map a Resend webhook event to a suppression, or null to ignore it.
 * Bounces count as hard unless the payload marks them transient. Resend's
 * exact bounce field names are not yet verified (see RELEASE_RUNBOOK.md),
 * so this errs toward suppressing.
 * @param {object} event parsed webhook JSON
 * @return {{reason: string, emails: string[], emailId: (string|null)}|null}
 */
function suppressionFromWebhook(event) {
  const type = event?.type;
  const data = event?.data || {};
  const emails = (Array.isArray(data.to) ? data.to : [data.to])
      .map(normalizeEmail).filter(Boolean);
  if (emails.length === 0) return null;
  const emailId = data.email_id || null;

  if (type === "email.complained") return {reason: "complaint", emails, emailId};
  if (type === "email.bounced") {
    const bounceType = String(data.bounce?.type || "").toLowerCase();
    if (bounceType === "transient" || bounceType === "soft") return null;
    return {reason: "hard_bounce", emails, emailId};
  }
  return null;
}

module.exports = {
  CATEGORIES,
  normalizeEmail,
  suppressionId,
  suppressionScope,
  canSendEmail,
  createUnsubscribeToken,
  verifyUnsubscribeToken,
  unsubscribeHeaders,
  verifySvixSignature,
  suppressionFromWebhook,
};
