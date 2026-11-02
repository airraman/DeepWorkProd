// Run with: node --test src/services/__tests__/notificationPrefsRules.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  NOTIFICATION_CATEGORIES,
  resolveNotificationCategories,
  categoryUpdate,
} from '../notificationPrefsRules.js';

test('three independent categories with the agreed defaults', () => {
  assert.deepEqual(
    NOTIFICATION_CATEGORIES.map(({ key, defaultEnabled }) => [key, defaultEnabled]),
    [['dailyReminders', true], ['reengagement', true], ['weeklyRecap', true]]);
});

test('missing doc or fields resolve to the defaults', () => {
  const defaults = { dailyReminders: true, reengagement: true, weeklyRecap: true };
  assert.deepEqual(resolveNotificationCategories(null), defaults);
  assert.deepEqual(resolveNotificationCategories({}), defaults);
  // An older doc written before `reengagement` existed keeps its own values.
  assert.deepEqual(
    resolveNotificationCategories({ dailyReminder: { time: '09:00' }, weeklySummary: false }),
    { dailyReminders: true, reengagement: true, weeklyRecap: false });
});

test('stored values always win over defaults', () => {
  assert.deepEqual(
    resolveNotificationCategories({ dailyReminder: { enabled: true }, reengagement: false, weeklySummary: false }),
    { dailyReminders: true, reengagement: false, weeklyRecap: false });
});

test('defaults declared in the list match what resolve() returns for an empty doc', () => {
  const resolved = resolveNotificationCategories(null);
  for (const c of NOTIFICATION_CATEGORIES) assert.equal(resolved[c.key], c.defaultEnabled, c.key);
});

test('categoryUpdate writes only the one field', () => {
  assert.deepEqual(categoryUpdate('dailyReminders', true), { dailyReminder: { enabled: true } });
  assert.deepEqual(categoryUpdate('reengagement', false), { reengagement: false });
  assert.deepEqual(categoryUpdate('weeklyRecap', false), { weeklySummary: false });
  assert.equal(categoryUpdate('sessionComplete', false), null); // not user-controllable here
  assert.equal(categoryUpdate('weeklyRecap', 'yes').weeklySummary, false); // only true is true
});

test('a toggle round-trips through resolve()', () => {
  for (const { key } of NOTIFICATION_CATEGORIES) {
    for (const value of [true, false]) {
      const doc = categoryUpdate(key, value);
      assert.equal(resolveNotificationCategories(doc)[key], value, `${key}=${value}`);
    }
  }
});

test('copy has no emoji or guilt framing', () => {
  for (const { label, description } of NOTIFICATION_CATEGORIES) {
    assert.ok(!/\p{Extended_Pictographic}/u.test(label + description));
    assert.ok(!/streak alive|don't break|lose/i.test(description));
  }
});
