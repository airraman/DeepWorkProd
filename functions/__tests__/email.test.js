// Run with: npm test (from functions/)
//
// Email foundation: policy (emailPolicy.js), templates (emailTemplates.js)
// and the consent / unsubscribe / webhook handlers (email.js) against the
// fake firebase-admin. Nothing here talks to Resend: sends go to a stub.

const {test, describe, beforeEach} = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");

const fake = require("./helpers/fakeAdmin");
const {store, authUsers, fakeAdmin} = fake;
const policy = require("../emailPolicy");
const templates = require("../emailTemplates");
const email = fake.requireWithFakeAdmin("../../email");

const SECRET = "unsubscribe-test-secret";
const WEBHOOK_SECRET = "whsec_" + Buffer.from("webhook-test-key").toString("base64");

// ─── Policy ───────────────────────────────────────────────────────────────────

describe("canSendEmail", () => {
  const {MARKETING, TRANSACTIONAL} = policy.CATEGORIES;
  const send = (category, consent, suppression) =>
    policy.canSendEmail({category, consent, suppression});

  test("having an email address is not marketing consent", () => {
    assert.deepEqual(send(MARKETING, null, null), {allowed: false, reason: "no_marketing_consent"});
    assert.equal(send(MARKETING, {}, null).allowed, false);
    assert.equal(send(MARKETING, {marketingConsent: "denied"}, null).allowed, false);
    assert.equal(send(MARKETING, {marketingConsent: true}, null).allowed, false); // only "granted"
  });

  test("explicit consent allows marketing", () => {
    assert.deepEqual(send(MARKETING, {marketingConsent: "granted"}, null),
        {allowed: true, reason: "consented"});
  });

  test("transactional needs no consent", () => {
    assert.equal(send(TRANSACTIONAL, null, null).allowed, true);
    assert.equal(send(TRANSACTIONAL, {marketingConsent: "denied"}, null).allowed, true);
  });

  test("hard bounce and complaint block everything, even with consent", () => {
    for (const reason of ["hard_bounce", "complaint"]) {
      const supp = {reason, scope: "all"};
      assert.equal(send(MARKETING, {marketingConsent: "granted"}, supp).allowed, false);
      assert.deepEqual(send(TRANSACTIONAL, null, supp), {allowed: false, reason: `suppressed_${reason}`});
    }
  });

  test("unknown category is refused", () => {
    assert.equal(send("newsletter", {marketingConsent: "granted"}, null).allowed, false);
  });
});

describe("unsubscribe tokens", () => {
  test("round-trip", () => {
    const t = policy.createUnsubscribeToken("uid-1", SECRET);
    assert.equal(policy.verifyUnsubscribeToken(t, SECRET), "uid-1");
  });

  test("tampered, wrong-secret, malformed and missing tokens are rejected", () => {
    const t = policy.createUnsubscribeToken("uid-1", SECRET);
    const [payload, sig] = t.split(".");
    const forged = Buffer.from(JSON.stringify({u: "uid-2", c: "marketing"})).toString("base64url");
    assert.equal(policy.verifyUnsubscribeToken(`${forged}.${sig}`, SECRET), null);
    assert.equal(policy.verifyUnsubscribeToken(t, "other-secret"), null);
    assert.equal(policy.verifyUnsubscribeToken(payload, SECRET), null);
    assert.equal(policy.verifyUnsubscribeToken("", SECRET), null);
    assert.equal(policy.verifyUnsubscribeToken(t, ""), null);
  });
});

describe("suppression ids and webhook mapping", () => {
  test("suppression id is a hash of the normalized address, never the address", () => {
    const id = policy.suppressionId("  Person@Example.COM ");
    assert.equal(id, crypto.createHash("sha256").update("person@example.com").digest("hex"));
    assert.ok(!id.includes("@"));
    assert.equal(policy.suppressionId("not-an-email"), null);
  });

  test("bounce → hard_bounce, complaint → complaint, transient bounce and others ignored", () => {
    const ev = (type, extra = {}) => ({type, data: {email_id: "e1", to: ["A@x.com"], ...extra}});
    assert.deepEqual(policy.suppressionFromWebhook(ev("email.bounced")),
        {reason: "hard_bounce", emails: ["a@x.com"], emailId: "e1"});
    assert.equal(policy.suppressionFromWebhook(ev("email.complained")).reason, "complaint");
    assert.equal(policy.suppressionFromWebhook(ev("email.bounced", {bounce: {type: "Transient"}})), null);
    assert.equal(policy.suppressionFromWebhook(ev("email.delivered")), null);
    assert.equal(policy.suppressionFromWebhook({type: "email.bounced", data: {}}), null);
  });
});

// ─── Templates ────────────────────────────────────────────────────────────────

describe("welcomeBackEmail", () => {
  const base = {totalMinutes: 380, sessionCount: 14, openAppUrl: "deepworkapp://",
    unsubscribeUrl: "https://example.test/u?token=t", postalAddress: "123 Example St, City"};

  test("uses only real values and includes the required footer", () => {
    const m = templates.welcomeBackEmail({...base, topActivity: "Writing", nextStep: "finish draft two"});
    assert.equal(m.subject, "Your 6h 20m of focus are still here");
    for (const part of [m.html, m.text]) {
      assert.match(part, /14 sessions/);
      assert.match(part, /Writing/);
      assert.match(part, /finish draft two/);
      assert.match(part, /Unsubscribe/);
      assert.match(part, /123 Example St/);
    }
  });

  test("optional lines are left out, not invented", () => {
    const m = templates.welcomeBackEmail(base);
    assert.ok(!/most of it on/.test(m.text));
    assert.ok(!/last thing you planned/.test(m.text));
  });

  test("user text is HTML-escaped", () => {
    const m = templates.welcomeBackEmail({...base, nextStep: "<script>x</script>"});
    assert.ok(!m.html.includes("<script>"));
    assert.ok(m.html.includes("&lt;script&gt;"));
  });

  test("refuses to build without real totals or the compliance footer", () => {
    assert.throws(() => templates.welcomeBackEmail({...base, totalMinutes: 0}));
    assert.throws(() => templates.welcomeBackEmail({...base, unsubscribeUrl: ""}));
    assert.throws(() => templates.welcomeBackEmail({...base, postalAddress: ""}));
  });
});

// ─── Handlers ─────────────────────────────────────────────────────────────────

describe("sendPolicyEmail", () => {
  let sends;
  const sendEmail = async (msg) => {
    sends.push(msg);
  };
  beforeEach(() => {
    fake.reset();
    sends = [];
    authUsers.set("u1", {email: "Person@Example.com"});
  });
  const send = (category, extra = {}) => email.sendPolicyEmail(fakeAdmin, {
    uid: "u1", category, subject: "S", html: "<p>H</p>", sendEmail, unsubscribeSecret: SECRET, ...extra,
  });

  test("marketing without consent is not sent", async () => {
    assert.deepEqual(await send("marketing"), {sent: false, reason: "no_marketing_consent"});
    assert.equal(sends.length, 0);
  });

  test("marketing with consent is sent with one-click unsubscribe headers", async () => {
    store.set("users/u1/preferences/email", {marketingConsent: "granted"});
    assert.equal((await send("marketing")).sent, true);
    assert.equal(sends[0].to, "person@example.com");
    assert.equal(sends[0].headers["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");
    const url = sends[0].headers["List-Unsubscribe"].slice(1, -1);
    const token = new URL(url).searchParams.get("token");
    assert.equal(policy.verifyUnsubscribeToken(token, SECRET), "u1");
    assert.deepEqual(sends[0].tags, [{name: "category", value: "marketing"}]);
  });

  test("transactional is sent without consent and without unsubscribe headers", async () => {
    assert.equal((await send("transactional")).sent, true);
    assert.equal(sends[0].headers, undefined);
  });

  test("a suppressed address gets nothing", async () => {
    store.set(`email_suppressions/${policy.suppressionId("person@example.com")}`,
        {reason: "hard_bounce", scope: "all"});
    store.set("users/u1/preferences/email", {marketingConsent: "granted"});
    assert.equal((await send("marketing")).reason, "suppressed_hard_bounce");
    assert.equal((await send("transactional")).reason, "suppressed_hard_bounce");
    assert.equal(sends.length, 0);
  });

  test("no account, no address, or no unsubscribe secret: not sent", async () => {
    assert.equal((await send("transactional", {uid: "ghost"})).reason, "no_user");
    authUsers.set("anon", {});
    assert.equal((await send("transactional", {uid: "anon"})).reason, "no_email");
    store.set("users/u1/preferences/email", {marketingConsent: "granted"});
    assert.equal((await send("marketing", {unsubscribeSecret: ""})).reason, "no_unsubscribe_secret");
    assert.equal(sends.length, 0);
  });
});

describe("handleUnsubscribe", () => {
  beforeEach(() => fake.reset());
  const token = () => policy.createUnsubscribeToken("u1", SECRET);
  const call = (method, query, body) => email.handleUnsubscribe(fakeAdmin, {method, query, body, secret: SECRET});

  test("GET only shows a confirmation page; nothing changes", async () => {
    store.set("users/u1/preferences/email", {marketingConsent: "granted"});
    const res = await call("GET", {token: token()});
    assert.equal(res.status, 200);
    assert.match(res.body, /<form method="POST"/);
    assert.equal(store.get("users/u1/preferences/email").marketingConsent, "granted");
  });

  test("POST from the page unsubscribes", async () => {
    store.set("users/u1/preferences/email", {marketingConsent: "granted"});
    const res = await call("POST", {token: token()}, {});
    assert.equal(res.status, 200);
    assert.match(res.body, /You&#39;re unsubscribed/); // title is HTML-escaped
    const doc = store.get("users/u1/preferences/email");
    assert.equal(doc.marketingConsent, "denied");
    assert.equal(doc.consentSource, "unsubscribe_link");
  });

  test("RFC 8058 one-click POST unsubscribes with an empty 200", async () => {
    const res = await call("POST", {token: token()}, {"List-Unsubscribe": "One-Click"});
    assert.deepEqual([res.status, res.body], [200, ""]);
    assert.equal(store.get("users/u1/preferences/email").consentSource, "one_click");
    const raw = await call("POST", {token: token()}, "List-Unsubscribe=One-Click");
    assert.equal(raw.status, 200);
  });

  test("an invalid token changes nothing", async () => {
    const res = await call("POST", {token: "forged.token"}, {});
    assert.equal(res.status, 400);
    assert.equal(store.size, 0);
  });

  test("after unsubscribing, marketing is no longer sent", async () => {
    authUsers.set("u1", {email: "p@example.com"});
    store.set("users/u1/preferences/email", {marketingConsent: "granted"});
    await call("POST", {token: token()}, {});
    const sends = [];
    const r = await email.sendPolicyEmail(fakeAdmin, {uid: "u1", category: "marketing", subject: "S",
      html: "H", sendEmail: async (m) => sends.push(m), unsubscribeSecret: SECRET});
    assert.equal(r.reason, "no_marketing_consent");
    assert.equal(sends.length, 0);
  });
});

describe("handleResendWebhook", () => {
  beforeEach(() => fake.reset());

  const signed = (event, {secret = WEBHOOK_SECRET, ts = Math.floor(Date.now() / 1000)} = {}) => {
    const rawBody = JSON.stringify(event);
    const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
    const sig = crypto.createHmac("sha256", key).update(`msg_1.${ts}.${rawBody}`).digest("base64");
    return {rawBody, headers: {"svix-id": "msg_1", "svix-timestamp": String(ts), "svix-signature": `v1,${sig}`}};
  };
  const call = (req) => email.handleResendWebhook(fakeAdmin, {...req, secret: WEBHOOK_SECRET});

  test("rejects a bad signature, a wrong secret and a stale timestamp", async () => {
    const event = {type: "email.bounced", data: {to: ["a@x.com"]}};
    const req = signed(event);
    assert.equal((await call({...req, headers: {...req.headers, "svix-signature": "v1,AAAA"}})).status, 401);
    assert.equal((await call(signed(event, {secret: "whsec_" + Buffer.from("other").toString("base64")}))).status, 401);
    assert.equal((await call(signed(event, {ts: Math.floor(Date.now() / 1000) - 3600}))).status, 401);
    assert.equal(store.size, 0);
  });

  test("hard bounce adds an address-level suppression", async () => {
    const res = await call(signed({type: "email.bounced", data: {email_id: "e1", to: ["A@x.com"]}}));
    assert.equal(res.status, 200);
    const doc = store.get(`email_suppressions/${policy.suppressionId("a@x.com")}`);
    assert.deepEqual({reason: doc.reason, scope: doc.scope, lastEmailId: doc.lastEmailId},
        {reason: "hard_bounce", scope: "all", lastEmailId: "e1"});
  });

  test("complaint suppresses the address and denies that user's consent", async () => {
    authUsers.set("u1", {email: "a@x.com"});
    store.set("users/u1/preferences/email", {marketingConsent: "granted"});
    await call(signed({type: "email.complained", data: {to: ["a@x.com"]}}));
    assert.equal(store.get(`email_suppressions/${policy.suppressionId("a@x.com")}`).reason, "complaint");
    assert.equal(store.get("users/u1/preferences/email").marketingConsent, "denied");
  });

  test("other events are acknowledged and ignored; a duplicate delivery is harmless", async () => {
    assert.equal((await call(signed({type: "email.delivered", data: {to: ["a@x.com"]}}))).status, 200);
    assert.equal(store.size, 0);
    const req = signed({type: "email.bounced", data: {email_id: "e1", to: ["a@x.com"]}});
    await call(req);
    await call(req);
    assert.equal([...store.keys()].filter((k) => k.startsWith("email_suppressions/")).length, 1);
  });
});
