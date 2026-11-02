// Run with: npm test (from functions/)
//
// weeklySummaryBatch audience selection: runs the real handler from index.js
// against the fake firebase-admin. The handler itself only checks the local
// hour (Mondays come from the cron schedule), so tests pick timezones where
// it is 9 am right now.

const {test, describe, beforeEach} = require("node:test");
const assert = require("node:assert/strict");

const fake = require("./helpers/fakeAdmin");
const {store, authUsers, sent} = fake;
const {weeklySummaryBatch} = fake.requireWithFakeAdmin("../../index");
const {localHour, localDateLabel} = require("../morningActivation");

const DAY = 24 * 60 * 60 * 1000;

const fixedZones = [];
for (let off = -12; off <= 14; off++) {
  fixedZones.push(off >= 0 ? `Etc/GMT-${off}` : `Etc/GMT+${-off}`);
}
const zoneAtHour = (h) => fixedZones.find((z) => localHour(Date.now(), z) === h);
const NINE_AM = zoneAtHour(9);
const NOT_NINE = zoneAtHour(15);

function addUser(uid, {tokenTz = NINE_AM, prefs} = {}) {
  authUsers.set(uid, {metadata: {creationTime: new Date(Date.now() - 30 * DAY).toISOString()}});
  store.set(`fcm_tokens/${uid}`, {token: `tok-${uid}`, ...(tokenTz ? {timezone: tokenTz} : {})});
  if (prefs !== undefined) store.set(`users/${uid}/preferences/notifications`, prefs);
}

const run = () => weeklySummaryBatch.run({});
const sentTo = (uid) => sent.filter((m) => m.token === `tok-${uid}`);

describe("weeklySummaryBatch audience", () => {
  beforeEach(() => fake.reset());

  test("iOS-only user with no users/{uid} doc and no prefs doc gets the summary", async () => {
    addUser("u1");
    assert.equal(store.has("users/u1"), false);
    await run();
    assert.equal(sentTo("u1").length, 1);
    assert.equal(sentTo("u1")[0].data.type, "weekly_performance");
  });

  test("weeklySummary explicitly false opts out", async () => {
    addUser("u1", {prefs: {weeklySummary: false}});
    await run();
    assert.equal(sent.length, 0);
  });

  test("never sends without a timezone (no UTC fallback)", async () => {
    addUser("u1", {tokenTz: null, prefs: {weeklySummary: true}});
    await run();
    assert.equal(sent.length, 0);
  });

  test("prefs timezone is used when the token has none", async () => {
    addUser("u1", {tokenTz: null, prefs: {weeklySummary: true, dailyReminder: {timezone: NINE_AM}}});
    await run();
    assert.equal(sentTo("u1").length, 1);
  });

  test("only at 9 am local", async () => {
    addUser("u1", {tokenTz: NOT_NINE});
    await run();
    assert.equal(sent.length, 0);
  });

  test("skips token docs that aren't auth users", async () => {
    addUser("u1");
    authUsers.delete("u1");
    await run();
    assert.equal(sent.length, 0);
  });

  test("idempotent per week (existing rule preserved)", async () => {
    addUser("u1");
    await run();
    await run();
    assert.equal(sentTo("u1").length, 1);
  });

  test("deferred during an active session (existing rule preserved)", async () => {
    addUser("u1");
    store.set("users/u1/activeSession/current", {isActive: true, isPaused: false, endsAt: Date.now() + 600000});
    await run();
    assert.equal(sent.length, 0);
    assert.equal(store.has("users/u1/pendingWeeklyNotification/current"), true);
  });

  test("still sends with zero sessions last week (existing rule preserved)", async () => {
    addUser("u1");
    await run();
    assert.match(sentTo("u1")[0].notification.title, /fresh week/i);
  });

  test("reports real session counts", async () => {
    addUser("u1");
    // A session 7 days ago falls in the previous Monday–Sunday week.
    const ts = Date.now() - 7 * DAY;
    store.set(`users/u1/sessions/s1`, {timestamp: ts, duration: 25, date: localDateLabel(ts, NINE_AM)});
    await run();
    assert.equal(sentTo("u1")[0].data.prevSessions, "1");
    assert.equal(sentTo("u1")[0].data.prevMinutes, "25");
  });
});
