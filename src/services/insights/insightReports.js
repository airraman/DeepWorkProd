// insightReports.js — period reports for the expanded "Your Insights" view.
//
// Pure module built on insightEngine's helpers, so the compact card and the
// expanded view share one set of calculations. Each report has an overview
// of measured stats plus observations made of a headline and optional
// supporting detail, all as accent segments ({ text, accent }).

import {
  normalizeSessions,
  resolvePeriods,
  periodStats,
  buildCandidates,
  selectInsights,
  findNoteTheme,
  findActivityTimePair,
  candidate,
  seg,
  hi,
  shortQuote,
  shortDate,
  formatMinutes,
  plural,
  round,
  topBy,
  todBreakdown,
  localDateKey,
  TOD_PHRASE,
  WEEKDAYS,
} from './insightEngine.js';

export const REPORT_PERIODS = [
  { id: 'week', label: 'This Week' },
  { id: 'month', label: 'This Month' },
  { id: 'six_months', label: '6 Months' },
];

const MAX_OBSERVATIONS = { week: 5, month: 5, six_months: 6 };
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ─── Calendar helpers ────────────────────────────────────────────────────────

export function startOfMonth(ms) {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
}

export function shiftMonths(ms, months) {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth() + months, 1).getTime();
}

const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
const monthKey = (ms) => { const d = new Date(ms); return `${d.getFullYear()}-${d.getMonth()}`; };
const monthName = (ms) => MONTH_NAMES[new Date(ms).getMonth()];
const capitalize = (t) => t.charAt(0).toUpperCase() + t.slice(1);

/**
 * This month so far vs the same elapsed span of last month. The comparison
 * end is clamped to the shorter month (e.g. 31 Mar → 28/29 Feb). With fewer
 * than 3 sessions so far, report on last month vs the month before.
 */
export function resolveMonthPeriods(sessions, now) {
  const monthStart = startOfMonth(now);
  const n = new Date(now);
  const prevStart = shiftMonths(monthStart, -1);
  const p = new Date(prevStart);
  const prevEnd = new Date(p.getFullYear(), p.getMonth(), Math.min(n.getDate(), daysInMonth(p.getFullYear(), p.getMonth())),
    n.getHours(), n.getMinutes(), n.getSeconds(), n.getMilliseconds()).getTime();

  const current = { start: monthStart, end: now, label: 'this month' };
  const previous = { start: prevStart, end: prevEnd, label: 'the same point last month', short: 'last month', than: 'at this point last month', by: 'by this point last month' };
  const count = (pr) => sessions.filter((s) => s.startedAt >= pr.start && s.startedAt <= pr.end).length;

  if (count(current) >= 3) return { current, previous };

  const lastMonth = { start: prevStart, end: monthStart - 1, label: 'last month' };
  const monthBefore = { start: shiftMonths(monthStart, -2), end: prevStart - 1, label: 'the month before', short: 'the month before', than: 'the month before', by: 'the month before' };
  if (count(lastMonth) >= 3) return { current: lastMonth, previous: monthBefore };
  return { current, previous };
}

// ─── Shared pieces ───────────────────────────────────────────────────────────

const inRange = (list, p) => list.filter((s) => s.startedAt >= p.start && s.startedAt <= p.end).sort((a, b) => a.startedAt - b.startedAt);

function overview(stats, prevStats, prevBy) {
  return {
    sessions: stats.count,
    focusMinutes: Math.round(stats.totalMinutes),
    avgMinutes: stats.count ? Math.round(stats.avgMinutes) : 0,
    activeDays: stats.activeDays,
    comparison: prevStats && prevStats.count > 0 ? `${plural(prevStats.count, 'session')} ${prevBy}` : null,
  };
}

function rangeLabel(p, now) {
  const end = Math.min(p.end, now);
  return shortDate(p.start) === shortDate(end) ? shortDate(p.start) : `${shortDate(p.start)} – ${shortDate(end)}`;
}

function toObservations(selected, periodId) {
  return selected.map((c) => ({
    key: c.key,
    category: c.group,
    headline: c.segments,
    detail: c.detail,
    text: c.text,
    fingerprint: `${periodId}:${c.fingerprint}`,
  }));
}

function selectFor(periodId, candidates, history, today) {
  const scoped = candidates.map((c) => ({ ...c, fingerprint: `${periodId}:${c.fingerprint}` }));
  return selectInsights(scoped, history, today, MAX_OBSERVATIONS[periodId], { demoteOnly: true })
    .map((c) => ({ ...c, fingerprint: c.fingerprint.slice(periodId.length + 1) }));
}

// ─── Week ────────────────────────────────────────────────────────────────────

function weekReport(sessions, now, history) {
  const periods = resolvePeriods(sessions.map((s) => ({ started_at: s.startedAt })), now);
  const curList = inRange(sessions, periods.current);
  const prevList = inRange(sessions, periods.previous);
  const cur = periodStats(curList);
  const prev = periodStats(prevList);
  const candidates = buildCandidates(cur, prev, curList, prevList, periods);
  return {
    id: 'week',
    title: capitalize(periods.current.label),
    range: rangeLabel(periods.current, now),
    coverageNote: null,
    overview: overview(cur, prev, periods.previous.by),
    observations: toObservations(selectFor('week', candidates, history, localDateKey(now)), 'week'),
  };
}

// ─── Month ───────────────────────────────────────────────────────────────────

function weekdayCandidate(stats, list, label) {
  if (stats.count < 10) return null;
  const counts = {};
  list.forEach((s) => { const d = new Date(s.startedAt).getDay(); counts[d] = (counts[d] || 0) + 1; });
  const [day, n] = Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0];
  if (n / stats.count < 0.25) return null;
  const breakdown = [1, 2, 3, 4, 5, 6, 0].filter((d) => counts[d]).map((d) => `${WEEKDAYS[d].slice(0, 3)} ${counts[d]}`).join(' · ');
  return candidate(`weekday:${day}`, 'weekday', 56,
    seg`${hi(`${WEEKDAYS[day]}s`)} were your most active day ${label}, with ${hi(n)} of ${stats.count} sessions.`,
    [day, round((n / stats.count) * 10)],
    seg`Sessions by weekday: ${breakdown}.`);
}

function monthReport(sessions, now, history) {
  const periods = resolveMonthPeriods(sessions, now);
  const curList = inRange(sessions, periods.current);
  const prevList = inRange(sessions, periods.previous);
  const cur = periodStats(curList);
  const prev = periodStats(prevList);
  const label = periods.current.label;
  const candidates = buildCandidates(cur, prev, curList, prevList, periods, {
    patternList: curList,
    patternLabel: capitalize(label),
  });
  if (cur.count > 2) {
    const weekday = weekdayCandidate(cur, curList, label);
    if (weekday) candidates.push(weekday);
  }
  return {
    id: 'month',
    title: capitalize(label),
    range: rangeLabel(periods.current, now),
    coverageNote: null,
    overview: overview(cur, prev, periods.previous.by),
    observations: toObservations(selectFor('month', candidates, history, localDateKey(now)), 'month'),
  };
}

// ─── Six months ──────────────────────────────────────────────────────────────

function monthlyBuckets(list, firstAt, now) {
  const buckets = [];
  for (let m = startOfMonth(firstAt); m <= now; m = shiftMonths(m, 1)) {
    const end = Math.min(shiftMonths(m, 1) - 1, now);
    const items = list.filter((s) => s.startedAt >= m && s.startedAt <= end);
    const isCurrent = monthKey(m) === monthKey(now);
    const startsLate = monthKey(m) === monthKey(firstAt) && new Date(firstAt).getDate() > 7;
    buckets.push({ start: m, name: monthName(m), list: items, stats: periodStats(items), complete: !isCurrent && !startsLate, isCurrent });
  }
  return buckets;
}

function runsOf(values) {
  const runs = [];
  values.forEach((v) => {
    const last = runs[runs.length - 1];
    if (last && last.value === v.value) { last.to = v.name; last.count++; } else runs.push({ value: v.value, from: v.name, to: v.name, count: 1 });
  });
  return runs;
}

const span = (r) => (r.from === r.to ? r.from : `${r.from}–${r.to}`);
const avg = (arr) => arr.reduce((a, b) => a + b, 0) / arr.length;

function sixMonthCandidates(list, buckets, coverage) {
  const out = [];
  const active = buckets.filter((b) => b.stats.count >= 5);
  const complete = buckets.filter((b) => b.complete);

  // Activity evolution: the activity with the most focus time each month.
  const leaders = active
    .filter((b) => b.stats.namedCount / b.stats.count >= 0.6)
    .map((b) => ({ name: b.name, value: topBy(b.stats.byActivity, 'minutes')?.name }))
    .filter((v) => v.value);
  const runs = runsOf(leaders);
  if (runs.length >= 2) {
    const path = runs.length <= 3 ? runs : [runs[0], runs[runs.length - 1]];
    const names = path.map((r) => r.value);
    const headline = names.length === 2
      ? seg`Your main focus moved from ${hi(names[0])} to ${hi(names[1])} over these months.`
      : seg`Your main focus moved from ${hi(names[0])} to ${hi(names[1])} to ${hi(names[2])} over these months.`;
    out.push(candidate(`evolution:${names.join('>')}`, 'evolution', 82, headline, names,
      seg`Largest share of focus time by month: ${runs.map((r) => `${r.value} (${span(r)})`).join(' · ')}.`));
  } else if (runs.length === 1 && runs[0].count >= 3) {
    out.push(candidate(`evolution:steady:${runs[0].value}`, 'evolution', 60,
      seg`${hi(runs[0].value)} took the largest share of your focus time in every month from ${runs[0].from} to ${runs[0].to}.`,
      [runs[0].value, runs[0].count], null));
  }

  // Session length over time (first vs last two months with enough sessions).
  if (active.length >= 3) {
    const early = active.slice(0, 2);
    const late = active.slice(-2);
    const e = avg(early.flatMap((b) => b.list.map((s) => s.minutes)));
    const l = avg(late.flatMap((b) => b.list.map((s) => s.minutes)));
    const perMonth = active.map((b) => `${b.name} ${round(b.stats.avgMinutes)}m`).join(' · ');
    if (Math.abs(l - e) >= 5 && Math.abs(l - e) / e >= 0.2) {
      out.push(candidate(`duration:trend:${l > e ? 'up' : 'down'}`, 'duration', 76,
        seg`Your average session ${l > e ? 'grew' : 'shrank'} from ${hi(round(e))} to ${hi(`${round(l)} minutes`)} between ${early[0].name} and ${late[late.length - 1].name}.`,
        [round(e / 5), round(l / 5)],
        seg`Average session by month: ${perMonth}.`));
    } else {
      const overall = avg(list.map((s) => s.minutes));
      if (active.every((b) => Math.abs(b.stats.avgMinutes - overall) <= 5)) {
        out.push(candidate('duration:steady', 'duration', 46,
          seg`Your sessions stayed close to ${hi(`${round(overall)} minutes`)} on average throughout this period.`,
          [round(overall / 5)],
          seg`Average session by month: ${perMonth}.`));
      }
    }
  }

  // Busiest and quietest complete months.
  if (complete.length >= 3) {
    const sorted = [...complete].sort((a, b) => b.stats.count - a.stats.count || a.start - b.start);
    const top = sorted[0];
    const low = sorted[sorted.length - 1];
    if (top.stats.count > sorted[1].stats.count && top.stats.count >= low.stats.count * 1.5 && top.stats.count >= 5) {
      const perMonth = buckets.map((b) => `${b.name} ${b.stats.count}${b.isCurrent ? ' so far' : ''}`).join(' · ');
      out.push(candidate(`volume:range:${top.name}:${low.name}`, 'volume', 66,
        low.stats.count === 0
          ? seg`${hi(top.name)} was your busiest month with ${hi(top.stats.count)} sessions; ${low.name} had none.`
          : seg`${hi(top.name)} was your busiest month with ${hi(top.stats.count)} sessions; ${low.name} was the quietest with ${low.stats.count}.`,
        [top.name, low.name],
        seg`Sessions by month: ${perMonth}.`));
    }
  }

  // Activity by time of day across the whole window.
  const all = periodStats(list);
  const timePair = findActivityTimePair(all, 5);
  if (timePair) {
    const { pair, other } = timePair;
    out.push(candidate(`activity-time:${pair.name}:${other.name}`, 'activity-time', 74,
      seg`Since ${coverage}, you tended to do ${hi(pair.name)} ${TOD_PHRASE[pair.tod]} and ${hi(other.name)} ${TOD_PHRASE[other.tod]}.`,
      [pair.name, pair.tod, other.name, other.tod],
      seg`${pair.name}: ${hi(`${pair.inTod} of ${pair.count}`)} sessions started ${TOD_PHRASE[pair.tod]}. ${other.name}: ${hi(`${other.inTod} of ${other.count}`)} ${TOD_PHRASE[other.tod]}.`));
  }

  // Recurring note theme with its actual date range.
  const theme = findNoteTheme(list);
  if (theme && theme.sessions >= 4) {
    out.push(candidate(`theme:${theme.term}`, 'theme', 70,
      seg`“${hi(theme.term)}” appeared in ${hi(theme.sessions)} session notes between ${shortDate(theme.firstAt)} and ${shortDate(theme.lastAt)}.`,
      [theme.term, round(theme.sessions / 3)],
      theme.example ? seg`Most recent: “${shortQuote(theme.example, 60)}”.` : null));
  }

  // Longest break between active days (ongoing gaps are left out).
  const days = [...new Set(list.map((s) => s.day))].sort();
  let gap = null;
  for (let i = 1; i < days.length; i++) {
    const a = new Date(`${days[i - 1]}T12:00:00`).getTime();
    const b = new Date(`${days[i]}T12:00:00`).getTime();
    const length = Math.round((b - a) / 86400000) - 1;
    if (length >= 5 && (!gap || length > gap.length)) gap = { length, from: a + 86400000, to: b - 86400000, resumed: b };
  }
  if (gap) {
    const after = list.filter((s) => s.startedAt >= gap.resumed - 43200000 && s.startedAt < gap.resumed + 14 * 86400000).length;
    out.push(candidate(`gap:${localDateKey(gap.from)}`, 'gaps', 60,
      seg`Your longest break was ${hi(`${gap.length} days`)}, from ${shortDate(gap.from)} to ${shortDate(gap.to)}.`,
      [localDateKey(gap.from), gap.length],
      seg`You logged ${plural(after, 'session')} in the two weeks after it.`));
  }

  // Active days per month, early vs recent complete months.
  if (complete.length >= 4) {
    const e = avg(complete.slice(0, 2).map((b) => b.stats.activeDays));
    const l = avg(complete.slice(-2).map((b) => b.stats.activeDays));
    if (Math.abs(l - e) >= 3) {
      out.push(candidate(`days:trend:${l > e ? 'up' : 'down'}`, 'days', 58,
        seg`You were active on about ${hi(round(l))} days a month recently, compared with ${round(e)} in ${complete[0].name} and ${complete[1].name}.`,
        [round(e / 2), round(l / 2)],
        seg`Active days by month: ${complete.map((b) => `${b.name} ${b.stats.activeDays}`).join(' · ')}.`));
    }
  }

  // Time-of-day shift between early and recent months.
  if (active.length >= 4) {
    const dominant = (bs) => {
      const s = periodStats(bs.flatMap((b) => b.list));
      const [tod, n] = Object.entries(s.byTod).sort((a, b) => b[1] - a[1])[0];
      return { tod, share: n / s.count, stats: s };
    };
    const e = dominant(active.slice(0, 2));
    const l = dominant(active.slice(-2));
    if (e.tod !== l.tod && e.share >= 0.45 && l.share >= 0.45) {
      out.push(candidate(`timing:trend:${e.tod}:${l.tod}`, 'timing', 62,
        seg`Your sessions moved from mostly ${TOD_PHRASE[e.tod]} to mostly ${hi(TOD_PHRASE[l.tod])} over this period.`,
        [e.tod, l.tod],
        seg`Early months: ${todBreakdown(e.stats)}. Recent months: ${todBreakdown(l.stats)}.`));
    }
  }

  return out;
}

function sixMonthReport(sessions, now, history) {
  const windowStart = shiftMonths(startOfMonth(now), -5);
  const list = sessions.filter((s) => s.startedAt >= windowStart && s.startedAt <= now).sort((a, b) => a.startedAt - b.startedAt);
  const stats = periodStats(list);

  if (list.length === 0) {
    return { id: 'six_months', title: 'Last 6 months', range: `${monthName(windowStart)} – ${monthName(now)}`, coverageNote: null, overview: overview(stats), observations: [] };
  }

  const firstAt = list[0].startedAt;
  const startsLate = firstAt - windowStart > 7 * 86400000;
  const buckets = monthlyBuckets(list, startsLate ? firstAt : windowStart, now);
  const monthsWithData = buckets.filter((b) => b.stats.count > 0).length;
  const coverage = startsLate ? shortDate(firstAt) : monthName(windowStart);
  const coverageNote = startsLate
    ? `Based on ${plural(monthsWithData, 'month')} of data, since ${shortDate(firstAt)}.`
    : null;

  let candidates;
  if (monthsWithData < 2 || list.length < 8) {
    // Too little history for longitudinal claims: describe the period itself.
    const period = { start: list[0].startedAt, end: now, label: `since ${shortDate(firstAt)}` };
    const none = { start: 0, end: -1, label: '', short: '', than: '', by: '' };
    candidates = buildCandidates(stats, periodStats([]), list, [], { current: period, previous: none }, {
      patternList: list,
      patternLabel: `Since ${shortDate(firstAt)}`,
    });
  } else {
    candidates = sixMonthCandidates(list, buckets, coverage);
  }

  return {
    id: 'six_months',
    title: 'Last 6 months',
    range: `${monthName(startsLate ? firstAt : windowStart)} – ${monthName(now)}`,
    coverageNote,
    overview: overview(stats),
    observations: toObservations(selectFor('six_months', candidates, history, localDateKey(now)), 'six_months'),
  };
}

// ─── Entry point ─────────────────────────────────────────────────────────────

/**
 * Build all three reports from one pass over the sessions so switching
 * periods in the UI needs no further reads or recomputation.
 */
export function generateReports(rawSessions, { now = Date.now(), history = [] } = {}) {
  const sessions = normalizeSessions(rawSessions);
  return {
    week: weekReport(sessions, now, history),
    month: monthReport(sessions, now, history),
    six_months: sixMonthReport(sessions, now, history),
  };
}

export function reportWindowStart(now = Date.now()) {
  return shiftMonths(startOfMonth(now), -5) - 86400000;
}

export { formatMinutes };
