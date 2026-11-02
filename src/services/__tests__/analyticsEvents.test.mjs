// Run with: node --test src/services/__tests__/analyticsEvents.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  EVENTS,
  PRODUCTION_BUNDLE_ID,
  homeProgressViewedParams,
  sessionSummaryViewedParams,
  startAnotherTappedParams,
  notificationOpenedParams,
  isInternalUser,
} from '../analyticsEvents.js';

const SNAKE = /^[a-z][a-z0-9_]*$/;
const GA4_NAME_MAX = 40;
const GA4_STRING_MAX = 100;

test('event names are snake_case, unique, within GA4 limits, and not existing events', () => {
  const names = Object.values(EVENTS);
  assert.equal(new Set(names).size, names.length);
  for (const n of names) {
    assert.match(n, SNAKE);
    assert.ok(n.length <= GA4_NAME_MAX);
  }
  for (const existing of ['dw_session_start', 'session_complete', 'session_abandon',
    'session_pause', 'session_resume', 'notification_scheduled']) {
    assert.ok(!names.includes(existing), `${existing} must not be redefined`);
  }
});

test('home_progress_viewed: known states pass, anything else is "other"', () => {
  for (const state of ['first_session', 'today', 'this_week', 'welcome_back', 'quiet_week']) {
    assert.deepEqual(homeProgressViewedParams(state), { progress_state: state });
  }
  assert.deepEqual(homeProgressViewedParams('Today: 2 sessions · 45m'), { progress_state: 'other' });
});

test('session_summary_viewed: counts and 0/1 flags only', () => {
  assert.deepEqual(sessionSummaryViewedParams({
    durationMinutes: 24.6, weekSessionCount: 3, hasNextStep: true,
    startAnotherAvailable: true, isFirstSession: false,
  }), {
    session_duration_min: 25, week_session_count: 3, has_next_step: 1,
    start_another_available: 1, is_first_session: 0,
  });
});

test('session_summary_viewed: missing recap drops the count rather than sending 0', () => {
  const p = sessionSummaryViewedParams({ durationMinutes: 10, weekSessionCount: null,
    hasNextStep: false, startAnotherAvailable: false, isFirstSession: false });
  assert.equal('week_session_count' in p, false);
  assert.equal(p.has_next_step, 0);
});

test('session_start_another_tapped', () => {
  assert.deepEqual(startAnotherTappedParams({ durationMinutes: 30, weekSessionCount: 4 }),
    { session_duration_min: 30, week_session_count: 4 });
  assert.deepEqual(startAnotherTappedParams({ durationMinutes: 'abc', weekSessionCount: undefined }), {});
});

test('notification_opened: FCM morning activation with segment', () => {
  assert.deepEqual(
    notificationOpenedParams({ type: 'morning_activation', segment: 'consistent' }, 'fcm', 'background'),
    { notification_type: 'morning_activation', notification_category: 'consistent',
      notification_source: 'fcm', app_state: 'background' });
});

test('notification_opened: FCM re-engagement with category, from quit', () => {
  assert.deepEqual(
    notificationOpenedParams({ type: 're_engagement', category: 'one_week_lapse' }, 'fcm', 'quit'),
    { notification_type: 're_engagement', notification_category: 'one_week_lapse',
      notification_source: 'fcm', app_state: 'quit' });
});

test('notification_opened: local session_end has no category or app_state', () => {
  assert.deepEqual(notificationOpenedParams({ type: 'session_end', sessionId: 'abc' }, 'local'),
    { notification_type: 'session_end', notification_source: 'local' });
});

test('notification_opened: never sends free text from the payload', () => {
  const payload = {
    type: 'reengagement', subtype: 'workedOn',
    workedOn: 'my secret novel chapter', insightText: 'You focused best in the morning',
  };
  const p = notificationOpenedParams(payload, 'local');
  assert.deepEqual(p, { notification_type: 'reengagement', notification_category: 'workedOn',
    notification_source: 'local' });
  assert.ok(!JSON.stringify(p).includes('novel'));
  // A free-text value in an allowlisted field is reduced to 'other'.
  assert.equal(notificationOpenedParams({ type: 'my secret type', category: 'free text' }, 'fcm', 'x')
    .notification_type, 'other');
});

test('every string parameter is short enough for GA4', () => {
  const all = [
    homeProgressViewedParams('welcome_back'),
    notificationOpenedParams({ type: 'weekly_performance' }, 'fcm', 'background'),
  ];
  for (const params of all) {
    for (const v of Object.values(params)) {
      if (typeof v === 'string') assert.ok(v.length <= GA4_STRING_MAX);
    }
  }
});

test('isInternalUser: dev builds, non-production bundles, and allowlisted uids', () => {
  const prod = { isDevBuild: false, applicationId: PRODUCTION_BUNDLE_ID, uid: 'u1', internalUids: [] };
  assert.equal(isInternalUser(prod), false);
  assert.equal(isInternalUser({ ...prod, isDevBuild: true }), true);
  assert.equal(isInternalUser({ ...prod, applicationId: 'com.airraman.deepwork.dev' }), true);
  assert.equal(isInternalUser({ ...prod, internalUids: ['u1'] }), true);
  assert.equal(isInternalUser({ ...prod, uid: null, internalUids: ['u1'] }), false);
  assert.equal(isInternalUser({ ...prod, applicationId: null }), false); // unknown → not assumed internal
});
