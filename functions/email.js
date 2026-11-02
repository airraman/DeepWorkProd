/* eslint max-len: ["error", {"code": 120}] */ // HTML/email strings read better unwrapped
// functions/email.js - Consent-aware sending, unsubscribe and bounce /
// complaint handling. Decisions live in emailPolicy.js; this file does the
// Firestore / Auth / Resend I/O.
//
// `admin` (and the low-level sender) are passed in so every handler can be
// tested against a fake — see __tests__/email.test.js.
//
// Nothing here sends a campaign. sendPolicyEmail is the only way new code
// should send mail; existing emails (the Chrome welcome email) are unchanged.

const {
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
} = require("./emailPolicy");
const {escapeHtml} = require("./emailTemplates");

const UNSUBSCRIBE_BASE_URL =
  "https://us-central1-deepwork-8416f.cloudfunctions.net/emailUnsubscribe";

const consentRef = (admin, uid) => admin.firestore()
    .collection("users").doc(uid).collection("preferences").doc("email");

/**
 * Signed unsubscribe link for a user.
 * @param {string} uid
 * @param {string} secret EMAIL_UNSUBSCRIBE_SECRET
 * @return {string}
 */
function unsubscribeUrlFor(uid, secret) {
  return `${UNSUBSCRIBE_BASE_URL}?token=${encodeURIComponent(createUnsubscribeToken(uid, secret))}`;
}

/**
 * Send one email if, and only if, policy allows it.
 *
 * @param {object} admin firebase-admin
 * @param {object} input
 * @param {string} input.uid recipient's Firebase Auth uid
 * @param {string} input.category CATEGORIES value
 * @param {string} input.subject
 * @param {string} input.html
 * @param {string} [input.text]
 * @param {function} input.sendEmail emailService.sendEmail
 * @param {string} [input.unsubscribeSecret] required for marketing
 * @return {Promise<{sent: boolean, reason: string}>}
 */
async function sendPolicyEmail(admin, {uid, category, subject, html, text,
  sendEmail, unsubscribeSecret}) {
  let user;
  try {
    user = await admin.auth().getUser(uid);
  } catch (error) {
    return {sent: false, reason: "no_user"};
  }
  const email = normalizeEmail(user.email);
  if (!email) return {sent: false, reason: "no_email"};

  const [consentDoc, suppressionDoc] = await Promise.all([
    consentRef(admin, uid).get(),
    admin.firestore().collection("email_suppressions").doc(suppressionId(email)).get(),
  ]);
  const decision = canSendEmail({
    category,
    consent: consentDoc.exists ? consentDoc.data() : null,
    suppression: suppressionDoc.exists ? suppressionDoc.data() : null,
  });
  if (!decision.allowed) return {sent: false, reason: decision.reason};

  let headers;
  if (category === CATEGORIES.MARKETING) {
    if (!unsubscribeSecret) return {sent: false, reason: "no_unsubscribe_secret"};
    headers = unsubscribeHeaders(unsubscribeUrlFor(uid, unsubscribeSecret));
  }

  await sendEmail({
    to: email,
    subject,
    html,
    ...(text ? {text} : {}),
    ...(headers ? {headers} : {}),
    tags: [{name: "category", value: category}],
  });
  return {sent: true, reason: decision.reason};
}

/**
 * Record (or refresh) an address-level suppression.
 * @param {object} admin
 * @param {{email: string, reason: string, emailId: (string|null)}} input
 * @return {Promise<void>}
 */
async function recordSuppression(admin, {email, reason, emailId}) {
  const id = suppressionId(email);
  if (!id) return;
  await admin.firestore().collection("email_suppressions").doc(id).set({
    reason,
    scope: suppressionScope(reason),
    source: "resend_webhook",
    lastEmailId: emailId || null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});
}

/**
 * Mark a user's marketing consent as denied.
 * @param {object} admin
 * @param {string} uid
 * @param {string} source
 * @return {Promise<void>}
 */
async function denyMarketingConsent(admin, uid, source) {
  await consentRef(admin, uid).set({
    marketingConsent: "denied",
    consentSource: source,
    consentUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});
}

const page = (title, message) => `<!doctype html><html><head><meta charset="utf-8">` +
  `<meta name="viewport" content="width=device-width,initial-scale=1">` +
  `<title>${escapeHtml(title)}</title></head>` +
  `<body style="font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:480px;` +
  `margin:48px auto;padding:0 16px;color:#111827;line-height:24px">` +
  `<h1 style="font-size:20px">${escapeHtml(title)}</h1>${message}</body></html>`;

/**
 * Unsubscribe endpoint.
 *   GET  ?token=  → a confirmation page with an Unsubscribe button (a link
 *                   scanner opening the URL must not unsubscribe anyone)
 *   POST ?token=  → unsubscribe. Covers the page's button and RFC 8058
 *                   one-click (body "List-Unsubscribe=One-Click").
 *
 * @param {object} admin
 * @param {{method: string, query: object, body: *, secret: string}} request
 * @return {Promise<{status: number, contentType: string, body: string}>}
 */
async function handleUnsubscribe(admin, {method, query, body, secret}) {
  const token = query?.token;
  const uid = verifyUnsubscribeToken(token, secret);
  const html = (status, title, message) =>
    ({status, contentType: "text/html; charset=utf-8", body: page(title, message)});

  if (!uid) {
    return html(400, "This link isn't valid",
        "<p>Open Lucid → Settings → Notifications to change your email preferences.</p>");
  }

  if (method === "GET") {
    return html(200, "Unsubscribe from Lucid emails?",
        `<p>You'll stop receiving product and re-engagement emails. Account emails ` +
        `you need, such as receipts, still arrive.</p>` +
        `<form method="POST" action="?token=${escapeHtml(encodeURIComponent(token))}">` +
        `<button type="submit" style="background:#111827;color:#fff;border:0;` +
        `border-radius:8px;padding:12px 20px;font-size:16px;font-weight:600">` +
        `Unsubscribe</button></form>`);
  }

  if (method !== "POST") {
    return {status: 405, contentType: "text/plain", body: "Method not allowed"};
  }

  const oneClick = typeof body === "string" ?
    body.includes("List-Unsubscribe=One-Click") :
    body?.["List-Unsubscribe"] === "One-Click";
  await denyMarketingConsent(admin, uid, oneClick ? "one_click" : "unsubscribe_link");

  if (oneClick) return {status: 200, contentType: "text/plain", body: ""};
  return html(200, "You're unsubscribed",
      "<p>You won't receive product or re-engagement emails from Lucid. " +
      "You can turn them back on any time in Lucid → Settings → Notifications.</p>");
}

/**
 * Resend webhook (delivered via Svix). Hard bounces and complaints add an
 * address-level suppression; a complaint also denies that user's marketing
 * consent. Other event types are acknowledged and ignored.
 *
 * @param {object} admin
 * @param {{headers: object, rawBody: (string|Buffer), secret: string}} request
 * @return {Promise<{status: number, body: object}>}
 */
async function handleResendWebhook(admin, {headers, rawBody, secret}) {
  const header = (name) => headers?.[name] ?? headers?.[name.toLowerCase()];
  const valid = verifySvixSignature({
    secret,
    id: header("svix-id"),
    timestamp: header("svix-timestamp"),
    signature: header("svix-signature"),
    rawBody,
  });
  if (!valid) return {status: 401, body: {error: "Invalid signature"}};

  let event;
  try {
    event = JSON.parse(Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : rawBody);
  } catch (error) {
    return {status: 400, body: {error: "Invalid JSON"}};
  }

  const suppression = suppressionFromWebhook(event);
  if (!suppression) return {status: 200, body: {ignored: event?.type || "unknown"}};

  for (const email of suppression.emails) {
    await recordSuppression(admin, {email, reason: suppression.reason,
      emailId: suppression.emailId});
    if (suppression.reason === "complaint") {
      try {
        const user = await admin.auth().getUserByEmail(email);
        await denyMarketingConsent(admin, user.uid, "complaint");
      } catch (error) {
        // No account for this address: the suppression alone covers it.
      }
    }
  }
  return {status: 200, body: {suppressed: suppression.emails.length, reason: suppression.reason}};
}

module.exports = {
  UNSUBSCRIBE_BASE_URL,
  unsubscribeUrlFor,
  sendPolicyEmail,
  recordSuppression,
  handleUnsubscribe,
  handleResendWebhook,
};
