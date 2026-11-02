// Run with: npm run test:insights
process.env.TZ = 'America/New_York';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateReports, resolveMonthPeriods, startOfMonth, shiftMonths, reportWindowStart } from '../insightReports.js';
import { generateInsights, normalizeSessions } from '../insightEngine.js';

let seq = 0;
// month is 1-based; `hour` is the local start hour.
function s(year, month, day, hour, minutes, activity = null, note = null) {
  return {
    id: `r${seq++}`,
    activity_name: activity,
    duration: minutes * 60,
    started_at: new Date(year, month - 1, day, hour, 0).getTime(),
    description: note,
  };
}
const text = (segs) => (segs ? segs.map((p) => p.text).join('') : '');
const headlines = (report) => report.observations.map((o) => text(o.headline));
const all = (report) => report.observations.map((o) => `${text(o.headline)} ${text(o.detail)}`).join(' | ');

/** A month of weekday sessions: `perWeek` sessions on Mon–Fri-ish days. */
function month(year, m, { activity, minutes, hour = 9, days = [2, 3, 5, 9, 10, 12, 16, 17, 19, 23], note = null }) {
  return days.map((d) => s(year, m, d, hour, minutes, activity, note));
}

test('month comparison uses the same elapsed span, clamped to shorter months', () => {
  const now = new Date(2026, 2, 31, 15, 0).getTime(); // 31 Mar
  const { current, previous } = resolveMonthPeriods(normalizeSessions([s(2026, 3, 2, 9, 30), s(2026, 3, 3, 9, 30), s(2026, 3, 4, 9, 30)]), now);
  assert.equal(current.start, new Date(2026, 2, 1).getTime());
  assert.equal(previous.start, new Date(2026, 1, 1).getTime());
  assert.equal(previous.end, new Date(2026, 1, 28, 15, 0).getTime());
});

test('early in a month the report falls back to last month vs the month before', () => {
  const now = new Date(2026, 9, 2, 10).getTime();
  const sessions = [...month(2026, 9, { activity: 'Writing', minutes: 30 }), s(2026, 10, 1, 9, 30, 'Writing')];
  const r = generateReports(sessions, { now });
  assert.equal(r.month.title, 'Last month');
  assert.equal(r.month.overview.sessions, 10);
});

test('monthly report compares against the comparable partial month only', () => {
  const now = new Date(2026, 9, 10, 20).getTime(); // 10 Oct
  const sept = [
    ...[2, 3, 4, 8].map((d) => s(2026, 9, d, 9, 30, 'Writing')),
    ...[15, 20, 25, 28].map((d) => s(2026, 9, d, 9, 30, 'Writing')), // after 10 Sep: not comparable
  ];
  const oct = [1, 2, 5, 6, 7, 8, 9].map((d) => s(2026, 10, d, 14, 30, 'Design'));
  const r = generateReports([...sept, ...oct], { now });
  assert.equal(r.month.overview.sessions, 7);
  assert.equal(r.month.overview.comparison, '4 sessions by this point last month');
  assert.ok(headlines(r.month).some((h) => /Design/.test(h)), all(r.month));
});

test('local start time decides the period, not completion time', () => {
  // Starts 23:40 on 30 Sep, completes 00:10 on 1 Oct.
  const late = { id: 'late', activity_name: 'Writing', duration: 30 * 60, started_at: new Date(2026, 8, 30, 23, 40).getTime() };
  const now = new Date(2026, 9, 20, 12).getTime();
  const oct = [5, 6, 7].map((d) => s(2026, 10, d, 9, 30, 'Writing'));
  const r = generateReports([late, ...oct], { now });
  assert.equal(r.month.overview.sessions, 3);
});

test('six months states actual coverage and avoids long-term claims on thin data', () => {
  const now = new Date(2026, 9, 10, 12).getTime();
  const sessions = [s(2026, 9, 15, 9, 30, 'Writing'), s(2026, 9, 22, 9, 30, 'Writing'), s(2026, 10, 2, 9, 30, 'Design')];
  const r = generateReports(sessions, { now }).six_months;
  assert.match(r.coverageNote, /since Sep 15/);
  assert.match(r.coverageNote, /2 months of data/);
  const joined = all(r);
  assert.doesNotMatch(joined, /moved from|busiest|grew|shrank|longest break|days a month/);
});

test('six months describes how the activity mix and session length evolved', () => {
  const now = new Date(2026, 9, 15, 12).getTime(); // window: May–Oct
  const sessions = [
    ...month(2026, 5, { activity: 'Writing', minutes: 15 }),
    ...month(2026, 6, { activity: 'Writing', minutes: 15 }),
    ...month(2026, 7, { activity: 'Design', minutes: 30, hour: 14 }),
    ...month(2026, 8, { activity: 'Design', minutes: 30, hour: 14 }),
    ...month(2026, 9, { activity: 'Code', minutes: 45, hour: 14 }),
    ...month(2026, 10, { activity: 'Code', minutes: 45, hour: 14, days: [1, 2, 5, 6, 7, 8] }),
  ];
  const r = generateReports(sessions, { now }).six_months;
  const joined = all(r);
  assert.equal(r.coverageNote, null);
  assert.match(joined, /main focus moved from Writing to Design to Code/);
  assert.match(joined, /Writing \(May–Jun\) · Design \(Jul–Aug\) · Code \(Sep–Oct\)/);
  assert.match(joined, /average session grew from 15 to 45 minutes between May and Oct/);
  assert.match(joined, /moved from mostly in the morning to mostly in the afternoon/);
});

test('busiest/quietest months use complete months only', () => {
  const now = new Date(2026, 9, 3, 12).getTime(); // October has 1 session so far
  const sessions = [
    ...month(2026, 5, { activity: 'Writing', minutes: 30 }),
    ...month(2026, 6, { activity: 'Writing', minutes: 30, days: [2, 9, 16, 23] }),
    ...month(2026, 7, { activity: 'Writing', minutes: 30 }),
    ...month(2026, 8, { activity: 'Writing', minutes: 30, days: [3, 4, 5, 6, 7, 10, 11, 12, 13, 14, 17, 18, 19, 20, 21] }),
    ...month(2026, 9, { activity: 'Writing', minutes: 30, days: [1, 8, 15, 22, 29] }),
    s(2026, 10, 1, 9, 30, 'Writing'),
  ];
  const r = generateReports(sessions, { now }).six_months;
  const vol = r.observations.find((o) => o.category === 'volume');
  assert.ok(vol, all(r));
  assert.match(text(vol.headline), /Aug was your busiest month with 15 sessions; Jun was the quietest with 4/);
  assert.match(text(vol.detail), /Oct 1 so far/);
});

test('longest break is reported with dates; an ongoing gap is not', () => {
  const now = new Date(2026, 9, 30, 12).getTime();
  const sessions = [
    ...month(2026, 7, { activity: 'Writing', minutes: 30, days: [1, 2, 3, 6, 7, 8, 9] }),
    ...month(2026, 7, { activity: 'Writing', minutes: 30, days: [20, 21, 22, 23] }), // 10-day gap: 10–19 Jul
    ...month(2026, 8, { activity: 'Writing', minutes: 30, days: [3, 4, 5, 6, 7, 10] }),
    // nothing since 10 Aug: an ongoing gap of 80+ days must not be reported
  ];
  const r = generateReports(sessions, { now }).six_months;
  const gap = r.observations.find((o) => o.category === 'gaps');
  assert.ok(gap, all(r));
  assert.match(text(gap.headline), /longest break was 10 days, from Jul 10 to Jul 19/);
  assert.match(text(gap.detail), /4 sessions in the two weeks after it|logged \d+ sessions/);
});

test('recurring note phrases carry counts and the date range they span', () => {
  const now = new Date(2026, 9, 15, 12).getTime();
  const notes = ['Drafted the book cover options', 'Book cover type tweaks', 'Colour pass on the book cover', 'Book cover feedback round', 'Edited chapter two'];
  const sessions = [
    ...month(2026, 8, { activity: 'Design', minutes: 30 }),
    ...notes.map((n, i) => s(2026, 9, 3 + i * 5, 10, 30, 'Design', n)),
    ...month(2026, 10, { activity: 'Design', minutes: 30, days: [1, 2, 5, 6] }),
  ];
  const r = generateReports(sessions, { now }).six_months;
  const theme = r.observations.find((o) => o.category === 'theme');
  assert.ok(theme, all(r));
  assert.match(text(theme.headline), /“book cover” appeared in 4 session notes between Sep 3 and Sep 18/);
});

test('six-month activity-by-time needs at least five sessions per activity', () => {
  const now = new Date(2026, 9, 15, 12).getTime();
  const few = [
    ...[1, 2, 3, 4].map((d) => s(2026, 9, d, 8, 30, 'Writing')),
    ...[8, 9, 10, 11].map((d) => s(2026, 9, d, 18, 30, 'Music')),
    ...[1, 2, 5, 6].map((d) => s(2026, 10, d, 13, 30, 'Code')),
  ];
  assert.doesNotMatch(all(generateReports(few, { now }).six_months), /tended to/);

  const enough = [
    ...[1, 2, 3, 4, 7, 8].map((d) => s(2026, 9, d, 8, 30, 'Writing')),
    ...[9, 10, 11, 14, 15, 16].map((d) => s(2026, 9, d, 18, 30, 'Music')),
    ...[1, 2, 5, 6].map((d) => s(2026, 10, d, 8, 30, 'Writing')),
  ];
  assert.match(all(generateReports(enough, { now }).six_months), /tended to do Writing in the morning and Music in the evening/);
});

test('missing activity names never produce activity claims', () => {
  const now = new Date(2026, 9, 15, 12).getTime();
  const sessions = [
    ...month(2026, 7, { activity: null, minutes: 30 }),
    ...month(2026, 8, { activity: null, minutes: 30 }),
    ...month(2026, 9, { activity: null, minutes: 30 }),
  ];
  const reports = generateReports(sessions, { now });
  for (const r of Object.values(reports)) {
    assert.doesNotMatch(all(r), /null|undefined|main focus|accounted for|tended to do/);
  }
});

test('stable history produces no fabricated trend', () => {
  const now = new Date(2026, 9, 20, 12).getTime();
  const sessions = [5, 6, 7, 8, 9].flatMap((m) => month(2026, m, { activity: 'Writing', minutes: 30 }));
  const r = generateReports(sessions, { now }).six_months;
  assert.doesNotMatch(all(r), /grew|shrank|moved from|days a month recently/);
  assert.ok(r.observations.some((o) => /stayed close to 30 minutes/.test(text(o.headline))), all(r));
});

test('empty data yields no observations for any period', () => {
  const r = generateReports([], { now: new Date(2026, 9, 10).getTime() });
  for (const report of Object.values(r)) {
    assert.deepEqual(report.observations, []);
    assert.equal(report.overview.sessions, 0);
  }
});

test('the compact card shows the top of the weekly report', () => {
  const now = new Date(2026, 9, 7, 18).getTime();
  const sessions = [
    s(2026, 9, 28, 9, 15, 'Writing'), s(2026, 9, 29, 9, 15, 'Writing'), s(2026, 9, 30, 9, 20, 'Writing'),
    s(2026, 10, 5, 9, 30, 'Writing'), s(2026, 10, 6, 14, 45, 'Design'), s(2026, 10, 7, 9, 45, 'Writing'), s(2026, 10, 7, 15, 30, 'Design'),
  ];
  const compact = generateInsights(sessions, { now }).insights.map((i) => i.text);
  const week = headlines(generateReports(sessions, { now }).week);
  assert.ok(week.length >= compact.length);
  assert.deepEqual(week.slice(0, compact.length), compact);
  assert.ok(generateReports(sessions, { now }).week.observations.some((o) => o.detail), 'expanded view adds supporting detail');
});

test('expanded repetition: earlier-shown observations yield to alternatives', () => {
  const now = new Date(2026, 9, 15, 12).getTime();
  const sessions = [
    ...month(2026, 5, { activity: 'Writing', minutes: 15 }),
    ...month(2026, 6, { activity: 'Writing', minutes: 15 }),
    ...month(2026, 7, { activity: 'Design', minutes: 30, hour: 14 }),
    ...month(2026, 8, { activity: 'Design', minutes: 30, hour: 14 }),
    ...month(2026, 9, { activity: 'Code', minutes: 45, hour: 14 }),
  ];
  const first = generateReports(sessions, { now }).six_months.observations;
  const top = first[0];
  const history = ['2026-10-13', '2026-10-14'].map((day) => ({ key: top.key, fingerprint: top.fingerprint, day }));
  const later = generateReports(sessions, { now, history }).six_months.observations;
  assert.notEqual(later[0].key, top.key);
  assert.ok(later.some((o) => o.key === top.key), 'still available further down, not removed');
});

test('report window covers six calendar months', () => {
  const now = new Date(2026, 9, 15).getTime();
  assert.equal(reportWindowStart(now), shiftMonths(startOfMonth(now), -5) - 86400000);
  assert.equal(new Date(shiftMonths(startOfMonth(now), -5)).getMonth(), 4);
});

test('a complete month with no sessions is described plainly', () => {
  const now = new Date(2026, 9, 3, 12).getTime();
  const sessions = [
    ...month(2026, 6, { activity: 'Writing', minutes: 30 }),
    ...month(2026, 7, { activity: 'Writing', minutes: 30, days: [1, 2, 3, 6, 7, 8, 9, 10, 13, 14, 15, 16] }),
    ...month(2026, 9, { activity: 'Writing', minutes: 30 }),
  ];
  const vol = generateReports(sessions, { now }).six_months.observations.find((o) => o.category === 'volume');
  assert.match(text(vol.headline), /Jul was your busiest month with 12 sessions; Aug had none\./);
});

test('no "busiest month" claim when months tie for the most sessions', () => {
  const now = new Date(2026, 9, 3, 12).getTime();
  const sessions = [
    ...month(2026, 6, { activity: 'Writing', minutes: 30 }),
    ...month(2026, 7, { activity: 'Writing', minutes: 30 }),
    ...month(2026, 8, { activity: 'Writing', minutes: 30, days: [3, 10, 17, 24] }),
  ];
  assert.doesNotMatch(all(generateReports(sessions, { now }).six_months), /busiest/);
});
