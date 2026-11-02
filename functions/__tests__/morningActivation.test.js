// Run with: npm test (from functions/)
//
// Part 1 covers the pure logic in morningActivation.js. Part 2 runs the real
// dailyRemindersBatch handler from index.js against an in-memory fake of
// firebase-admin, so suppression and dedupe rules are tested end to end.

const {test, describe, beforeEach} = require("node:test");
const assert = require("node:assert/strict");

const ma = require("../morningActivation");

const DAY = 24 * 60 * 60 * 1000;
const TZ = "America/New_York";

describe("morningActivation pure logic", () => {
  test("isValidTimeZone", () => {
    assert.equal(ma.isValidTimeZone("America/Los_Angeles"), true);
    assert.equal(ma.isValidTimeZone("Not/AZone"), false);
    assert.equal(ma.isValidTimeZone(""), false);
    assert.equal(ma.isValidTimeZone(undefined), false);
  });

  test("resolveSchedule prefers the token timezone, then prefs, else null", () => {
    const prefs = {dailyReminder: {timezone: "Europe/London", time: "08:30"}};
    assert.deepEqual(ma.resolveSchedule(prefs, {timezone: TZ}), {timezone: TZ, reminderHour: 8});
    assert.deepEqual(ma.resolveSchedule(prefs, {timezone: "bogus"}),
        {timezone: "Europe/London", reminderHour: 8});
    assert.deepEqual(ma.resolveSchedule(null, {timezone: TZ}), {timezone: TZ, reminderHour: 9});
    assert.equal(ma.resolveSchedule(null, {}), null);
    assert.equal(ma.resolveSchedule({dailyReminder: {time: "99:00"}}, {timezone: TZ}), null);
  });

  test("isDailyReminderEnabled: opt-out, on unless explicitly false", () => {
    assert.equal(ma.isDailyReminderEnabled(null), true);
    assert.equal(ma.isDailyReminderEnabled({}), true);
    assert.equal(ma.isDailyReminderEnabled({dailyReminder: {time: "09:00"}}), true);
    assert.equal(ma.isDailyReminderEnabled({dailyReminder: {enabled: true}}), true);
    assert.equal(ma.isDailyReminderEnabled({dailyReminder: {enabled: false}}), false);
  });

  test("isReengagementEnabled: on unless explicitly false", () => {
    assert.equal(ma.isReengagementEnabled(null), true);
    assert.equal(ma.isReengagementEnabled({dailyReminder: {enabled: false}}), true);
    assert.equal(ma.isReengagementEnabled({reengagement: true}), true);
    assert.equal(ma.isReengagementEnabled({reengagement: false}), false);
  });

  test("classifySegment", () => {
    const now = Date.parse("2026-11-04T14:00:00Z"); // 9 am in New York
    assert.deepEqual(ma.classifySegment([], now, TZ), {segment: "new", activeDaysLast7: 0});
    assert.equal(ma.classifySegment([now - DAY], now, TZ).segment, "active");
    assert.equal(ma.classifySegment([now - 2 * DAY], now, TZ).segment, "active");
    assert.equal(ma.classifySegment([now - 5 * DAY], now, TZ).segment, "returning");
    assert.deepEqual(
        ma.classifySegment([now - DAY, now - 3 * DAY, now - 6 * DAY], now, TZ),
        {segment: "consistent", activeDaysLast7: 3});
    // Two sessions on one day count as one active day; 8+ days ago is out.
    assert.equal(
        ma.classifySegment([now - DAY, now - DAY - 1000, now - 9 * DAY], now, TZ).activeDaysLast7, 1);
  });

  test("copy has no emoji and only real numbers", () => {
    const emoji = /\p{Extended_Pictographic}/u;
    ["new", "active", "returning", "consistent"].forEach((segment) => {
      const m = ma.buildMorningActivationMessage({segment, activeDaysLast7: 4});
      assert.ok(m.title && m.body);
      assert.ok(!emoji.test(m.title + m.body), `${segment} copy contains emoji`);
    });
    assert.match(ma.buildMorningActivationMessage({segment: "consistent", activeDaysLast7: 4}).body,
        /4 of the last 7 days/);
  });

  test("unanswered cap", () => {
    const sent = 1000;
    const capped = {lastSentAtMs: sent, consecutiveUnanswered: 3};
    assert.equal(ma.isUnansweredCapReached(capped, null), true);
    assert.equal(ma.isUnansweredCapReached(capped, sent - 1), true);
    assert.equal(ma.isUnansweredCapReached(capped, sent + 1), false);
    assert.equal(ma.isUnansweredCapReached({}, null), false);
    assert.equal(ma.nextUnansweredCount({lastSentAtMs: sent, consecutiveUnanswered: 2}, null), 3);
    assert.equal(ma.nextUnansweredCount({lastSentAtMs: sent, consecutiveUnanswered: 2}, sent + 1), 1);
    assert.equal(ma.nextUnansweredCount({}, null), 1);
  });

  test("isInvalidTokenError", () => {
    assert.equal(ma.isInvalidTokenError({code: "messaging/registration-token-not-registered"}), true);
    assert.equal(ma.isInvalidTokenError(
        {errorInfo: {code: "messaging/invalid-registration-token"}}), true);
    assert.equal(ma.isInvalidTokenError({code: "messaging/invalid-argument"}), false);
    assert.equal(ma.isInvalidTokenError(new Error("network")), false);
  });
});

// ─── Fake firebase-admin (shared helper) ──────────────────────────────────────

const fake = require("./helpers/fakeAdmin");
const {store, authUsers, sent} = fake;
const {dailyRemindersBatch} = fake.requireWithFakeAdmin("../../index");

// ─── Batch scenarios ──────────────────────────────────────────────────────────

const currentHourIn = (tz) => ma.localHour(Date.now(), tz);
const reminderTimeNow = () => `${String(currentHourIn(TZ)).padStart(2, "0")}:00`;

function addUser(uid, {
  createdMsAgo = 12 * 60 * 60 * 1000, // < 24h: never_started re-engagement not eligible yet
  tokenTz = TZ,
  prefs = {dailyReminder: {enabled: true, time: reminderTimeNow()}},
} = {}) {
  authUsers.set(uid, {metadata: {creationTime: new Date(Date.now() - createdMsAgo).toISOString()}});
  store.set(`fcm_tokens/${uid}`, {token: `tok-${uid}`, platform: "ios",
    ...(tokenTz ? {timezone: tokenTz} : {})});
  if (prefs) store.set(`users/${uid}/preferences/notifications`, prefs);
}

const addSession = (uid, msAgo) => {
  const ts = Date.now() - msAgo;
  store.set(`users/${uid}/sessions/s-${ts}`, {timestamp: ts, date: new Date(ts).toISOString().slice(0, 10)});
};

const run = () => dailyRemindersBatch.run({});
const sentTo = (uid) => sent.filter((m) => m.token === `tok-${uid}`);

describe("dailyRemindersBatch (morning activation)", () => {
  beforeEach(() => {
    fake.reset();
  });

  test("iOS-only user (no users/{uid} root doc) gets one activation push", async () => {
    addUser("u1");
    assert.equal(store.has("users/u1"), false);
    await run();
    assert.equal(sentTo("u1").length, 1);
    assert.equal(sentTo("u1")[0].data.type, "morning_activation");
    assert.equal(sentTo("u1")[0].data.segment, "new");
  });

  test("missing prefs doc uses the token timezone and 09:00 default", async () => {
    // A fixed-offset zone where it is 9 am right now, and one where it isn't.
    const zones = [];
    for (let off = -12; off <= 14; off++) {
      zones.push(off >= 0 ? `Etc/GMT-${off}` : `Etc/GMT+${-off}`);
    }
    const nineAm = zones.find((z) => currentHourIn(z) === 9);
    const notNine = zones.find((z) => currentHourIn(z) === 15);
    // No prefs = defaults: everything on, at 09:00.
    addUser("new9", {prefs: null, tokenTz: nineAm});
    addUser("lapsed9", {prefs: null, tokenTz: nineAm, createdMsAgo: 30 * DAY});
    addSession("lapsed9", 4 * DAY);
    addUser("lapsed15", {prefs: null, tokenTz: notNine, createdMsAgo: 30 * DAY});
    addSession("lapsed15", 4 * DAY);
    await run();
    assert.equal(sentTo("new9").length, 1, "morning activation is on by default");
    assert.equal(sentTo("new9")[0].data.type, "morning_activation");
    assert.equal(sentTo("lapsed9").length, 1);
    assert.equal(sentTo("lapsed9")[0].data.type, "re_engagement");
    assert.equal(sentTo("lapsed15").length, 0, "only at 09:00 local");
  });

  test("no duplicate within the same local day", async () => {
    addUser("u1");
    await run();
    await run();
    assert.equal(sentTo("u1").length, 1);
  });

  test("suppressed after a session completed today", async () => {
    addUser("u1");
    addSession("u1", 60 * 1000);
    await run();
    assert.equal(sentTo("u1").length, 0);
  });

  test("suppressed during an active or paused session", async () => {
    addUser("running");
    store.set("users/running/activeSession/current", {isActive: true, isPaused: false, endsAt: Date.now() + 600000});
    addUser("paused");
    store.set("users/paused/activeSession/current", {isActive: true, isPaused: true, endsAt: Date.now() - 1});
    await run();
    assert.equal(sent.length, 0);
  });

  test("suppressed when the reminder is disabled", async () => {
    addUser("u1", {prefs: {dailyReminder: {enabled: false, time: reminderTimeNow()}}});
    await run();
    assert.equal(sent.length, 0);
  });

  test("never falls back to UTC without a timezone", async () => {
    addUser("u1", {tokenTz: null, prefs: {dailyReminder: {enabled: true, time: reminderTimeNow()}}});
    await run();
    assert.equal(sent.length, 0);
  });

  test("skips token docs that aren't auth users (device-id keyed)", async () => {
    addUser("u1");
    authUsers.delete("u1");
    await run();
    assert.equal(sent.length, 0);
  });

  test("not the user's hour: nothing sent", async () => {
    const otherHour = (currentHourIn(TZ) + 3) % 24;
    addUser("u1", {prefs: {dailyReminder: {enabled: true, time: `${String(otherHour).padStart(2, "0")}:00`}}});
    await run();
    assert.equal(sent.length, 0);
  });

  test("an invalid token is removed and the batch keeps going", async () => {
    addUser("bad");
    addUser("good");
    fake.messagingState.send = async (m) => {
      if (m.token === "tok-bad") {
        throw Object.assign(new Error("gone"), {code: "messaging/registration-token-not-registered"});
      }
      sent.push(m);
    };
    await run();
    assert.equal(store.has("fcm_tokens/bad"), false);
    assert.equal(sentTo("good").length, 1);
  });

  test("consistent user gets behavior-based copy with their real day count", async () => {
    addUser("u1", {createdMsAgo: 30 * DAY});
    addSession("u1", DAY);
    addSession("u1", 2 * DAY);
    addSession("u1", 3 * DAY);
    await run();
    assert.equal(sentTo("u1").length, 1);
    assert.equal(sentTo("u1")[0].data.segment, "consistent");
    assert.match(sentTo("u1")[0].notification.body, /3 of the last 7 days/);
  });

  test("a lapsed user gets re-engagement instead, still only one push", async () => {
    addUser("u1", {createdMsAgo: 30 * DAY});
    addSession("u1", 4 * DAY);
    await run();
    assert.equal(sentTo("u1").length, 1);
    assert.equal(sentTo("u1")[0].data.type, "re_engagement");
  });

  test("lapsed user in re-engagement cooldown falls through to activation", async () => {
    addUser("u1", {createdMsAgo: 30 * DAY});
    addSession("u1", 4 * DAY);
    store.set("users/u1/notificationState/reengagement", {lastSentAt: {toMillis: () => Date.now() - DAY}});
    await run();
    assert.equal(sentTo("u1").length, 1);
    assert.equal(sentTo("u1")[0].data.type, "morning_activation");
    assert.equal(sentTo("u1")[0].data.segment, "returning");
  });

  test("re-engagement off: a lapsed user with daily on gets activation instead", async () => {
    addUser("u1", {createdMsAgo: 30 * DAY,
      prefs: {dailyReminder: {enabled: true, time: reminderTimeNow()}, reengagement: false}});
    addSession("u1", 4 * DAY);
    await run();
    assert.equal(sentTo("u1").length, 1);
    assert.equal(sentTo("u1")[0].data.type, "morning_activation");
  });

  test("daily off: a lapsed user still gets re-engagement", async () => {
    addUser("u1", {createdMsAgo: 30 * DAY,
      prefs: {dailyReminder: {enabled: false, time: reminderTimeNow()}}});
    addSession("u1", 4 * DAY);
    await run();
    assert.equal(sentTo("u1")[0].data.type, "re_engagement");
  });

  test("daily off, nothing eligible: no push and today's claim is released", async () => {
    addUser("u1", {createdMsAgo: 30 * DAY,
      prefs: {dailyReminder: {enabled: false, time: reminderTimeNow()}}});
    addSession("u1", DAY); // active yesterday: not lapsed
    await run();
    assert.equal(sent.length, 0);
    const state = store.get("users/u1/notificationState/dailyActivation");
    assert.equal(state.lastSentDate, null);
    assert.equal(state.consecutiveUnanswered, 0);
  });

  test("both categories off: nothing, and no state written", async () => {
    addUser("u1", {createdMsAgo: 30 * DAY,
      prefs: {dailyReminder: {enabled: false, time: reminderTimeNow()}, reengagement: false}});
    addSession("u1", 4 * DAY);
    await run();
    assert.equal(sent.length, 0);
    assert.equal(store.has("users/u1/notificationState/dailyActivation"), false);
  });

  test("stops after 3 unanswered pushes, resumes after a session", async () => {
    addUser("u1");
    const state = "users/u1/notificationState/dailyActivation";
    store.set(state, {lastSentDate: "2000-01-01", lastSentAtMs: Date.now() - 2 * 60 * 60 * 1000,
      consecutiveUnanswered: 3});
    await run();
    assert.equal(sentTo("u1").length, 0);

    addSession("u1", 2 * DAY); // older than the last send: still unanswered
    await run();
    assert.equal(sentTo("u1").length, 0);

    store.set(state, {...store.get(state), lastSentAtMs: Date.now() - 3 * DAY});
    await run(); // the 2-day-old session now counts as an answer
    assert.equal(sentTo("u1").length, 1);
    assert.equal(store.get(state).consecutiveUnanswered, 1);
  });
});
