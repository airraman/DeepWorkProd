// Run with: npm run test:insights
process.env.TZ = 'America/New_York';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateInsights,
  timeOfDay,
  startOfWeek,
  shiftDays,
  resolvePeriods,
  periodStats,
  normalizeSessions,
  findNoteTheme,
  selectInsights,
} from '../insightEngine.js';
import { resolveActivityName } from '../activityNames.js';
import { buildAiInsightCard } from '../cardBuilders.js';

// Wednesday 7 Oct 2026, 18:00 local. This week = Mon 5 Oct → now.
const NOW = new Date(2026, 9, 7, 18, 0).getTime();
let seq = 0;
function s(month, day, hour, minutes, activity = null, note = null, minute = 0) {
  return {
    id: `s${seq++}`,
    activity_type: activity ? activity.toLowerCase() : '1',
    activity_name: activity,
    duration: minutes * 60,
    started_at: new Date(2026, month - 1, day, hour, minute).getTime(),
    description: note,
  };
}
const texts = (r) => r.insights.map((i) => i.text);
const GENERIC = /habit|great job|keep it up|productive|consistent progress|creative goals|variety/i;

test('time-of-day buckets use local start time and existing boundaries', () => {
  const at = (h, m = 0) => new Date(2026, 9, 7, h, m).getTime();
  assert.equal(timeOfDay(at(4, 59)), 'night');
  assert.equal(timeOfDay(at(5)), 'morning');
  assert.equal(timeOfDay(at(11, 59)), 'morning');
  assert.equal(timeOfDay(at(12)), 'afternoon');
  assert.equal(timeOfDay(at(16, 59)), 'afternoon');
  assert.equal(timeOfDay(at(17)), 'evening');
  assert.equal(timeOfDay(at(20, 59)), 'evening');
  assert.equal(timeOfDay(at(21)), 'night');
});

test('week boundaries are local midnights across a DST change', () => {
  const wed = new Date(2026, 10, 4, 12).getTime(); // 4 Nov 2026, after DST ends 1 Nov
  const monday = new Date(startOfWeek(wed));
  assert.equal(monday.getDay(), 1);
  assert.equal(monday.getHours(), 0);
  const prevMonday = new Date(shiftDays(startOfWeek(wed), -7));
  assert.equal(prevMonday.getDate(), 26);
  assert.equal(prevMonday.getHours(), 0);
});

test('week-over-week compares the same elapsed span of last week', () => {
  const { current, previous } = resolvePeriods([{ started_at: NOW - 3600e3 }, { started_at: NOW - 7200e3 }], NOW);
  assert.equal(current.start, new Date(2026, 9, 5).getTime());
  assert.equal(previous.start, new Date(2026, 8, 28).getTime());
  assert.equal(previous.end, new Date(2026, 8, 30, 18, 0).getTime());
});

test('average duration and totals are computed from durations', () => {
  const st = periodStats(normalizeSessions([s(10, 5, 9, 15), s(10, 6, 9, 30), s(10, 7, 9, 45)]));
  assert.equal(st.count, 3);
  assert.equal(st.totalMinutes, 90);
  assert.equal(st.avgMinutes, 30);
  assert.equal(st.medianMinutes, 30);
});

test('empty period produces no insights and the card shows the empty state', () => {
  const r = generateInsights([], { now: NOW });
  assert.deepEqual(r.insights, []);
  const card = buildAiInsightCard({ insightResult: r });
  assert.equal(card.state, 'empty');
  assert.equal(card.insights, undefined);
});

test('sparse: one titled session yields a direct fact, not a trend', () => {
  const r = generateInsights([s(10, 6, 10, 30, 'Design', 'Portfolio redesign')], { now: NOW });
  assert.equal(r.insights.length, 1);
  assert.match(r.insights[0].text, /30 minutes on “Portfolio redesign”/);
  assert.doesNotMatch(r.insights[0].text, /tend|usually|habit|consistent|more|fewer/i);
});

test('sparse: two unlabeled sessions never invent activities or preferences', () => {
  const r = generateInsights([s(10, 5, 9, 20), s(10, 6, 19, 25)], { now: NOW });
  assert.equal(r.insights.length, 1);
  assert.match(r.insights[0].text, /2 focus sessions/);
  assert.doesNotMatch(r.insights[0].text, /null|undefined|tend|morning|evening/);
});

test('specific labels without notes produce specific insights', () => {
  const sessions = [
    s(10, 5, 10, 20, 'Decks'), s(10, 5, 14, 30, 'Decks'), s(10, 6, 10, 20, 'Decks'),
    s(10, 7, 9, 20, 'Decks'), s(10, 7, 15, 25, 'Writing'),
  ];
  const r = generateInsights(sessions, { now: NOW });
  assert.ok(r.insights.length >= 1 && r.insights.length <= 3);
  assert.ok(texts(r).some((t) => t.includes('Decks')), texts(r).join(' / '));
  texts(r).forEach((t) => assert.doesNotMatch(t, GENERIC));
});

test('frequency is distinguished from focus time', () => {
  const sessions = [
    s(10, 5, 9, 15, 'Reading'), s(10, 5, 20, 15, 'Reading'), s(10, 6, 20, 15, 'Reading'), s(10, 7, 9, 15, 'Reading'),
    s(10, 6, 10, 45, 'Writing'), s(10, 7, 10, 45, 'Writing'),
  ];
  const r = generateInsights(sessions, { now: NOW });
  assert.ok(texts(r).some((t) => /Reading came up most often \(4 sessions\), but Writing took the most time/.test(t)), texts(r).join(' / '));
});

test('activity-by-time pattern appears only with enough observations', () => {
  const supported = [
    s(9, 28, 8, 30, 'Writing'), s(9, 29, 8, 30, 'Writing'), s(10, 5, 8, 30, 'Writing'), s(10, 6, 8, 30, 'Writing'),
    s(9, 28, 18, 30, 'Design'), s(9, 30, 18, 30, 'Design'), s(10, 6, 18, 30, 'Design'), s(10, 7, 17, 0, 'Design'),
  ];
  const all = generateInsights(supported, { now: NOW });
  assert.ok(texts(all).some((t) => /Writing in the morning and Design in the evening/.test(t)), texts(all).join(' / '));

  const thin = [
    s(10, 5, 8, 30, 'Writing'), s(10, 6, 8, 30, 'Writing'), s(10, 7, 8, 30, 'Writing'), s(10, 7, 18, 0, 'Design'),
  ];
  const r = generateInsights(thin, { now: NOW });
  texts(r).forEach((t) => assert.doesNotMatch(t, /tended to/));
});

test('meaningful week-over-week change is prioritised', () => {
  const prev = [s(9, 28, 9, 15, 'Writing'), s(9, 29, 9, 15, 'Writing'), s(9, 30, 9, 20, 'Writing')];
  const cur = [s(10, 5, 9, 30, 'Writing'), s(10, 6, 9, 45, 'Writing'), s(10, 7, 9, 45, 'Writing')];
  const r = generateInsights([...prev, ...cur], { now: NOW });
  assert.match(r.insights[0].text, /average session rose from 17 to 40 minutes/);
});

test('sessions after the equivalent point last week are not compared', () => {
  // Thursday/Friday last week fall outside "at this point last week".
  const prev = [s(10, 1, 9, 15, 'Writing'), s(10, 2, 9, 15, 'Writing'), s(10, 2, 11, 15, 'Writing'), s(10, 1, 13, 15, 'Writing')];
  const cur = [s(10, 5, 9, 30, 'Writing'), s(10, 6, 9, 30, 'Writing'), s(10, 7, 9, 30, 'Writing')];
  const r = generateInsights([...prev, ...cur], { now: NOW });
  texts(r).forEach((t) => assert.doesNotMatch(t, /rose|fell|more sessions|fewer sessions|compared with/));
});

test('stable data does not fabricate changes', () => {
  const week = (d0) => [s(9, d0, 9, 30, 'Writing'), s(9, d0 + 1, 9, 30, 'Writing'), s(9, d0 + 2, 14, 30, 'Design')];
  const prev = week(28);
  const cur = [s(10, 5, 9, 30, 'Writing'), s(10, 6, 9, 30, 'Writing'), s(10, 7, 14, 30, 'Design')];
  const r = generateInsights([...prev, ...cur], { now: NOW });
  texts(r).forEach((t) => assert.doesNotMatch(t, /rose|fell|more sessions|fewer sessions|shifted|versus/));
});

test('missing activity details are handled without invented labels', () => {
  const sessions = [s(10, 5, 9, 25), s(10, 5, 14, 25), s(10, 6, 9, 25, 'Code'), s(10, 7, 9, 25)];
  const r = generateInsights(sessions, { now: NOW });
  texts(r).forEach((t) => {
    assert.doesNotMatch(t, /null|undefined|Code accounted|Code showed up|All 4/);
  });
});

test('recurring note theme is identified when it repeats', () => {
  const list = normalizeSessions([
    s(10, 5, 9, 45, 'Writing', 'Drafted chapter 6 of the book'),
    s(10, 6, 9, 45, 'Writing', 'Revised chapter 6, mostly dialogue'),
    s(10, 7, 9, 30, 'Writing', 'Outlined the next section'),
  ]);
  assert.equal(findNoteTheme(list)?.term, 'chapter 6');
  assert.equal(findNoteTheme(normalizeSessions([s(10, 5, 9, 30, 'Writing', 'Edited the intro')])), null);
});

test('insights stay short: at most three, two sentences, about 25 words', () => {
  const sessions = [];
  for (let d = 28; d <= 30; d++) sessions.push(s(9, d, 9, 20, 'Writing', 'Book chapter edits'), s(9, d, 19, 15, 'Music'));
  for (let d = 5; d <= 7; d++) sessions.push(s(10, d, 8, 45, 'Writing', 'Book chapter draft'), s(10, d, 13, 30, 'Design'), s(10, d, 19, 30, 'Music'));
  const r = generateInsights(sessions, { now: NOW });
  assert.ok(r.insights.length <= 3);
  r.insights.forEach((i) => {
    assert.ok(i.text.split(/\s+/).length <= 26, i.text);
    assert.ok((i.text.match(/[.!?](\s|$)/g) || []).length <= 2, i.text);
    assert.doesNotMatch(i.text, /\bAI\b|insight/i);
  });
  assert.equal(new Set(r.insights.map((i) => i.category)).size, r.insights.length);
});

test('repetition: a previously shown observation yields to a valid alternative', () => {
  const sessions = [
    s(10, 5, 10, 20, 'Decks'), s(10, 5, 14, 30, 'Decks'), s(10, 6, 10, 20, 'Decks'),
    s(10, 7, 9, 20, 'Decks'), s(10, 7, 15, 25, 'Writing'),
  ];
  const first = generateInsights(sessions, { now: NOW });
  const top = first.insights[0];

  const sameDay = generateInsights(sessions, { now: NOW, history: [{ key: top.key, fingerprint: top.fingerprint, day: '2026-10-07' }] });
  assert.equal(sameDay.insights[0].key, top.key, 'same-day history must not reshuffle the card');

  const history = [
    { key: top.key, fingerprint: top.fingerprint, day: '2026-10-05' },
    { key: top.key, fingerprint: top.fingerprint, day: '2026-10-06' },
  ];
  const later = generateInsights(sessions, { now: NOW, history });
  assert.notEqual(later.insights[0].key, top.key);
});

test('repetition: changed underlying data lets an observation return', () => {
  const c = { key: 'mix:share:Decks', group: 'mix', groups: ['mix'], score: 66, segments: [], text: 'x', fingerprint: 'mix:share:Decks|Decks|8' };
  const alt = { key: 'days:count', group: 'days', groups: ['days'], score: 45, segments: [], text: 'y', fingerprint: 'days:count|4' };
  const history = [{ key: c.key, fingerprint: 'mix:share:Decks|Decks|5', day: '2026-10-06' }];
  const picked = selectInsights([c, alt], history, '2026-10-07');
  assert.equal(picked[0].key, c.key);
});

test('repetition never manufactures novelty when nothing else is valid', () => {
  const c = { key: 'days:count', group: 'days', groups: ['days'], score: 45, segments: [], text: 'y', fingerprint: 'f' };
  const history = [{ key: c.key, fingerprint: 'f', day: '2026-10-05' }, { key: c.key, fingerprint: 'f', day: '2026-10-06' }];
  assert.equal(selectInsights([c], history, '2026-10-07').length, 1);
});

test('activity names resolve from settings without inventing labels', () => {
  const activities = [{ id: '1', name: 'Deep Work' }, { id: 'writing', name: 'Writing' }];
  assert.equal(resolveActivityName('1', activities), 'Deep Work');
  assert.equal(resolveActivityName('writing', activities), 'Writing');
  assert.equal(resolveActivityName('2', activities), null);
  assert.equal(resolveActivityName('essay-draft', activities), 'Essay draft');
  assert.equal(resolveActivityName(undefined, activities), null);
});

test('insights card carries accent segments for the green highlights', () => {
  const r = generateInsights([s(10, 6, 10, 30, 'Design', 'Portfolio redesign')], { now: NOW });
  const card = buildAiInsightCard({ insightResult: r });
  assert.equal(card.state, 'default');
  assert.equal(card.insights.length, 1);
  const accents = card.insights[0].segments.filter((p) => p.accent).map((p) => p.text);
  assert.deepEqual(accents, ['30 minutes', 'Portfolio redesign']);
});
