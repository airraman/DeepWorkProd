// Run with: node --test src/services/__tests__/sessionPrefill.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSessionPrefill } from '../sessionPrefill.js';

const options = {
  activityIds: ['a1', 'a2'],
  durations: [5, 10, 15, 20, 30, 45],
  musicValues: ['none', 'white-noise', 'lofi'],
};

test('applies a fully valid previous config, duration as Home\'s string form', () => {
  assert.deepEqual(
    resolveSessionPrefill({ activity: 'a2', duration: 30, musicChoice: 'lofi' }, options),
    { activity: 'a2', duration: '30', musicChoice: 'lofi' });
});

test('accepts a string duration (sessions may store either)', () => {
  assert.equal(resolveSessionPrefill({ duration: '45' }, options).duration, '45');
});

test('a deleted activity is not selected', () => {
  assert.equal(resolveSessionPrefill({ activity: 'gone', duration: 10 }, options).activity, null);
});

test('a duration no longer offered (e.g. dev-only 15 s) is not selected', () => {
  assert.equal(resolveSessionPrefill({ duration: 0.25 }, options).duration, null);
  assert.equal(resolveSessionPrefill({ duration: 25 }, options).duration, null);
});

test('unknown or missing music is not selected', () => {
  assert.equal(resolveSessionPrefill({ musicChoice: 'jazz' }, options).musicChoice, null);
  assert.equal(resolveSessionPrefill({}, options).musicChoice, null);
});

test('null prefill selects nothing', () => {
  assert.deepEqual(resolveSessionPrefill(null, options), { activity: null, duration: null, musicChoice: null });
});

test('never carries Focus Lock or anything else', () => {
  const r = resolveSessionPrefill({ activity: 'a1', duration: 5, musicChoice: 'none', focusLockEnabled: true }, options);
  assert.deepEqual(Object.keys(r).sort(), ['activity', 'duration', 'musicChoice']);
});
