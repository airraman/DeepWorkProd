// Run with: npm test (from functions/)
//
// registerPushToken / unregisterPushToken (pushTokens.js) against the fake
// firebase-admin, plus the HTTP wrappers exported from index.js.

const {test, describe, beforeEach} = require("node:test");
const assert = require("node:assert/strict");

const fake = require("./helpers/fakeAdmin");
const {store, idTokens, fakeAdmin} = fake;
const {registerPushToken, unregisterPushToken} =
  fake.requireWithFakeAdmin("../../pushTokens");
const {registerToken, unregisterToken} =
  fake.requireWithFakeAdmin("../../index");

const bearer = (t) => `Bearer ${t}`;
const register = (authorization, body) =>
  registerPushToken(fakeAdmin, {authorization, body});
const unregister = (authorization, body) =>
  unregisterPushToken(fakeAdmin, {authorization, body});

describe("registerPushToken", () => {
  beforeEach(() => {
    fake.reset();
    idTokens.set("id-alice", "alice");
    idTokens.set("id-bob", "bob");
  });

  test("rejects a missing or invalid ID token", async () => {
    assert.equal((await register(undefined, {fcmToken: "t1"})).status, 401);
    assert.equal((await register("Bearer nope", {fcmToken: "t1"})).status, 401);
    assert.equal((await register("id-alice", {fcmToken: "t1"})).status, 401);
    assert.equal(store.size, 0);
  });

  test("stores the token under the verified uid only", async () => {
    const res = await register(bearer("id-alice"), {fcmToken: "t1", platform: "ios",
      timezone: "America/New_York"});
    assert.equal(res.status, 200);
    assert.deepEqual(
        {token: store.get("fcm_tokens/alice").token, tz: store.get("fcm_tokens/alice").timezone},
        {token: "t1", tz: "America/New_York"});
  });

  test("a body userId must match the caller", async () => {
    const res = await register(bearer("id-alice"), {fcmToken: "t1", userId: "bob"});
    assert.equal(res.status, 403);
    assert.equal(store.has("fcm_tokens/bob"), false);
    assert.equal(store.has("fcm_tokens/alice"), false);
    assert.equal((await register(bearer("id-alice"), {fcmToken: "t1", userId: "alice"})).status, 200);
  });

  test("requires fcmToken; ignores an invalid timezone", async () => {
    assert.equal((await register(bearer("id-alice"), {})).status, 400);
    await register(bearer("id-alice"), {fcmToken: "t1", timezone: "Mars/Base"});
    assert.equal("timezone" in store.get("fcm_tokens/alice"), false);
  });

  test("account switch moves the device token to the new account", async () => {
    await register(bearer("id-alice"), {fcmToken: "device-1"});
    const res = await register(bearer("id-bob"), {fcmToken: "device-1"});
    assert.equal(res.body.reassignedFrom, 1);
    assert.equal(store.has("fcm_tokens/alice"), false);
    assert.equal(store.get("fcm_tokens/bob").token, "device-1");
  });

  test("account switch leaves other accounts' different tokens alone", async () => {
    await register(bearer("id-alice"), {fcmToken: "alice-phone"});
    await register(bearer("id-bob"), {fcmToken: "bob-phone"});
    assert.equal(store.get("fcm_tokens/alice").token, "alice-phone");
    assert.equal(store.get("fcm_tokens/bob").token, "bob-phone");
  });
});

describe("unregisterPushToken", () => {
  beforeEach(() => {
    fake.reset();
    idTokens.set("id-alice", "alice");
    idTokens.set("id-bob", "bob");
  });

  test("rejects unauthenticated callers", async () => {
    store.set("fcm_tokens/alice", {token: "t1"});
    assert.equal((await unregister(undefined, {fcmToken: "t1"})).status, 401);
    assert.equal(store.has("fcm_tokens/alice"), true);
  });

  test("removes the caller's doc when it holds this device's token", async () => {
    store.set("fcm_tokens/alice", {token: "t1"});
    const res = await unregister(bearer("id-alice"), {fcmToken: "t1"});
    assert.deepEqual(res.body, {success: true, removed: true});
    assert.equal(store.has("fcm_tokens/alice"), false);
  });

  test("keeps the doc when the account has moved to another device", async () => {
    store.set("fcm_tokens/alice", {token: "new-phone"});
    const res = await unregister(bearer("id-alice"), {fcmToken: "old-phone"});
    assert.equal(res.body.removed, false);
    assert.equal(store.get("fcm_tokens/alice").token, "new-phone");
  });

  test("never touches another account's token", async () => {
    store.set("fcm_tokens/bob", {token: "t1"});
    await unregister(bearer("id-alice"), {fcmToken: "t1"});
    assert.equal(store.get("fcm_tokens/bob").token, "t1");
  });
});

describe("HTTP wrappers", () => {
  const call = async (fn, {method = "POST", headers = {}, body = {}} = {}) => {
    const res = {statusCode: 200, headers: {}, payload: undefined};
    res.status = (c) => {
      res.statusCode = c;
      return res;
    };
    res.send = (p) => {
      res.payload = p;
      return res;
    };
    res.set = (k, v) => {
      res.headers[k] = v;
      return res;
    };
    res.setHeader = (k, v) => {
      res.headers[k] = v;
    };
    res.getHeader = (k) => res.headers[k];
    res.end = () => res;
    res.on = () => res; // firebase-functions' CORS wrapper listens for finish
    const lower = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
    const req = {method, headers: lower, body, get: (h) => lower[h.toLowerCase()],
      header: (h) => lower[h.toLowerCase()], url: "/", originalUrl: "/"};
    await fn(req, res);
    return res;
  };

  beforeEach(() => {
    fake.reset();
    idTokens.set("id-alice", "alice");
  });

  test("registerToken: 401 without a bearer token, 200 with one", async () => {
    assert.equal((await call(registerToken, {body: {fcmToken: "t1", userId: "alice"}})).statusCode, 401);
    const ok = await call(registerToken,
        {headers: {Authorization: "Bearer id-alice"}, body: {fcmToken: "t1"}});
    assert.equal(ok.statusCode, 200);
    assert.equal(store.get("fcm_tokens/alice").token, "t1");
  });

  test("registerToken: non-POST is rejected", async () => {
    assert.equal((await call(registerToken, {method: "GET"})).statusCode, 405);
  });

  test("unregisterToken: removes only a matching token", async () => {
    store.set("fcm_tokens/alice", {token: "t1"});
    const res = await call(unregisterToken,
        {headers: {Authorization: "Bearer id-alice"}, body: {fcmToken: "t1"}});
    assert.equal(res.statusCode, 200);
    assert.equal(store.has("fcm_tokens/alice"), false);
  });
});
