// insightEngine.js — deterministic qualitative insights for the Insights card.
//
// Pure module (no React Native imports) so it can be unit-tested with
// `node --test`. All numbers are computed here; nothing is inferred beyond
// what session records support. Input sessions use the SessionRepository
// shape: { id, activity_type, activity_name, duration (seconds),
// started_at (ms), description }.
//
// Time-of-day buckets match DataAggregator: morning 05:00–11:59,
// afternoon 12:00–16:59, evening 17:00–20:59, night 21:00–04:59, using the
// device's local time at session start.

const MAX_INSIGHTS = 3;
const MIN_SCORE = 40;
const REPEAT_WINDOW_DAYS = 7;

// ─── Time helpers (local calendar arithmetic, DST-safe) ──────────────────────

export function startOfWeek(ms) {
  const d = new Date(ms);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function shiftDays(ms, days) {
  const d = new Date(ms);
  d.setDate(d.getDate() + days);
  return d.getTime();
}

export function localDateKey(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function timeOfDay(ms) {
  const h = new Date(ms).getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 21) return 'evening';
  return 'night';
}

export const TOD_PHRASE = { morning: 'in the morning', afternoon: 'in the afternoon', evening: 'in the evening', night: 'at night' };
export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// ─── Periods ─────────────────────────────────────────────────────────────────

/**
 * Reporting period = this week so far (Monday start, matching the other
 * cards), compared with the same elapsed span of last week. Early in the
 * week (< 2 sessions so far) the engine reports on last full week instead,
 * compared with the full week before it.
 */
export function resolvePeriods(sessions, now) {
  const weekStart = startOfWeek(now);
  const current = { start: weekStart, end: now, label: 'this week' };
  const previous = { start: shiftDays(weekStart, -7), end: shiftDays(now, -7), label: 'the same point last week', short: 'last week', than: 'at this point last week', by: 'by this point last week' };

  if (inPeriod(sessions, current).length >= 2) return { current, previous };

  const lastWeek = { start: shiftDays(weekStart, -7), end: weekStart - 1, label: 'last week' };
  const weekBefore = { start: shiftDays(weekStart, -14), end: shiftDays(weekStart, -7) - 1, label: 'the week before', short: 'the week before', than: 'the week before', by: 'the week before' };
  if (inPeriod(sessions, lastWeek).length >= 2) return { current: lastWeek, previous: weekBefore };

  return { current, previous };
}

function inPeriod(sessions, p) {
  return sessions.filter((s) => s.started_at >= p.start && s.started_at <= p.end);
}

// ─── Normalisation ───────────────────────────────────────────────────────────

export function normalizeSessions(raw) {
  const seen = new Set();
  return (raw || [])
    .filter((s) => s && Number.isFinite(s.started_at) && Number.isFinite(s.duration) && s.duration > 0)
    .filter((s) => (s.id ? (seen.has(s.id) ? false : seen.add(s.id)) : true))
    .map((s) => ({
      id: s.id,
      minutes: s.duration / 60,
      startedAt: s.started_at,
      tod: timeOfDay(s.started_at),
      day: localDateKey(s.started_at),
      activity: typeof s.activity_name === 'string' && s.activity_name.trim() ? s.activity_name.trim() : null,
      note: typeof s.description === 'string' && s.description.trim().length >= 3 ? s.description.trim() : null,
    }));
}

// ─── Stats ───────────────────────────────────────────────────────────────────

const sum = (a) => a.reduce((x, y) => x + y, 0);
const median = (a) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
export const round = (n) => Math.round(n);
export const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function formatMinutes(m) {
  const total = Math.round(m);
  if (total < 60) return `${total}m`;
  const h = Math.floor(total / 60);
  const rest = total % 60;
  return rest ? `${h}h ${rest}m` : `${h}h`;
}

const TOD_ORDER = ['morning', 'afternoon', 'evening', 'night'];
const TOD_LABEL = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', night: 'Night' };

export function todBreakdown(stats) {
  return TOD_ORDER.filter((t) => stats.byTod[t]).map((t) => `${TOD_LABEL[t]} ${stats.byTod[t]}`).join(' · ');
}

export function activityBreakdown(stats, n = 3) {
  return Object.values(stats.byActivity)
    .sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name))
    .slice(0, n)
    .map((a) => `${a.name} ${formatMinutes(a.minutes)} (${plural(a.count, 'session')})`)
    .join(' · ');
}

const shortDate = (ms) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
export { shortDate };

export function periodStats(list) {
  const minutes = list.map((s) => s.minutes);
  const byActivity = {};
  const byTod = {};
  list.forEach((s) => {
    byTod[s.tod] = (byTod[s.tod] || 0) + 1;
    if (!s.activity) return;
    const key = s.activity.toLowerCase();
    const a = (byActivity[key] ||= { name: s.activity, count: 0, minutes: 0, tod: {} });
    a.count++;
    a.minutes += s.minutes;
    a.tod[s.tod] = (a.tod[s.tod] || 0) + 1;
  });
  return {
    count: list.length,
    totalMinutes: sum(minutes),
    avgMinutes: list.length ? sum(minutes) / list.length : 0,
    medianMinutes: median(minutes),
    activeDays: new Set(list.map((s) => s.day)).size,
    namedCount: list.filter((s) => s.activity).length,
    byActivity,
    byTod,
  };
}

// ─── Text building with accent segments ──────────────────────────────────────

export const hi = (text) => ({ accent: String(text) });

export function seg(strings, ...vals) {
  const out = [];
  strings.forEach((str, i) => {
    if (str) out.push({ text: str, accent: false });
    if (i < vals.length) {
      const v = vals[i];
      if (v && typeof v === 'object' && 'accent' in v) out.push({ text: v.accent, accent: true });
      else if (v !== undefined && v !== null && v !== '') out.push({ text: String(v), accent: false });
    }
  });
  return out;
}

export function shortQuote(text, max = 42) {
  const clean = text.replace(/\s+/g, ' ').replace(/[.!?]+$/, '');
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 20 ? cut.lastIndexOf(' ') : max).trim()}…`;
}

// ─── Work themes from notes ──────────────────────────────────────────────────

const STOPWORDS = new Set(('a about after again all also am an and any are as at back be been before being bit but by can could did do done for from get got had has have how i if in into is it its just last like lot made make more most much my need next no not of on one only or out over really so some still than that the their them then there these this through time to today too up very was way we went were what when which while with work worked working would yet ' +
  'session sessions focus focused finally started start quick tried trying try kept little first third second new fine good okay ok ' +
  'few day days week weeks month months year thing things something everything while').split(' '));

function tokens(text) {
  return text.toLowerCase().replace(/[^a-z0-9#\s'-]/g, ' ').split(/\s+/)
    .map((w) => w.replace(/^['-]+|['-]+$/g, ''))
    .filter(Boolean);
}

/** Most repeated note phrase (bigram preferred) across distinct sessions. */
export function findNoteTheme(list) {
  const withNotes = list.filter((s) => s.note);
  if (withNotes.length < 2) return null;
  const bigrams = {};
  const unigrams = {};
  const matchesFor = (term) => withNotes.filter((s) => {
    const words = tokens(s.note).map((w) => w.replace(/s$/, ''));
    const parts = term.split(' ').map((w) => w.replace(/s$/, ''));
    return parts.length === 1 ? words.includes(parts[0]) : words.some((w, i) => w === parts[0] && words[i + 1] === parts[1]);
  });
  const describe = (term, count) => {
    const hits = matchesFor(term).sort((a, b) => a.startedAt - b.startedAt);
    return { term, sessions: count, notes: withNotes.length, firstAt: hits[0]?.startedAt ?? null, lastAt: hits[hits.length - 1]?.startedAt ?? null, example: hits[hits.length - 1]?.note ?? null };
  };
  withNotes.forEach((s) => {
    const words = tokens(s.note);
    const seenB = new Set();
    const seenU = new Set();
    words.forEach((w, i) => {
      const content = !STOPWORDS.has(w) && w.length >= 4 && !/^\d+$/.test(w);
      if (content) seenU.add(w.replace(/s$/, ''));
      const next = words[i + 1];
      if (next && !STOPWORDS.has(w) && !STOPWORDS.has(next) && (w.length >= 3 || next.length >= 3)) {
        const b = `${w} ${next}`;
        if (!/^[\d#]+ [\d#]+$/.test(b)) seenB.add(b);
      }
    });
    seenB.forEach((b) => { bigrams[b] = (bigrams[b] || 0) + 1; });
    seenU.forEach((u) => { unigrams[u] = (unigrams[u] || 0) + 1; });
  });
  const best = (m, min) => Object.entries(m).filter(([, c]) => c >= min).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  const b = best(bigrams, 2);
  if (b) return describe(b[0], b[1]);
  const u = best(unigrams, 3);
  if (u) return describe(u[0], u[1]);
  return null;
}

// ─── Candidate generation ────────────────────────────────────────────────────

/**
 * Two activities that each start in a different part of the day at least
 * two-thirds of the time, with 3+ sessions each. Null when the evidence
 * isn't there or too many sessions lack an activity name.
 */
export function findActivityTimePair(stats, minCount = 3) {
  if (!stats.count || stats.namedCount / stats.count < 0.6) return null;
  const patterns = Object.values(stats.byActivity)
    .filter((a) => a.count >= minCount)
    .map((a) => {
      const [tod, n] = Object.entries(a.tod).sort((x, y) => y[1] - x[1])[0];
      return { name: a.name, tod, share: n / a.count, count: a.count, inTod: n };
    })
    .filter((p) => p.share >= 2 / 3)
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  const pair = patterns.find((p, i) => patterns.slice(i + 1).some((q) => q.tod !== p.tod));
  if (!pair) return null;
  return { pair, other: patterns.find((q) => q !== pair && q.tod !== pair.tod) };
}

function rangeDetail(list) {
  const mins = list.map((x) => x.minutes);
  const lo = Math.min(...mins);
  const hiMin = Math.max(...mins);
  return lo === hiMin
    ? seg`All ${plural(list.length, 'session')} were ${formatMinutes(lo)}.`
    : seg`Sessions ranged from ${formatMinutes(lo)} to ${formatMinutes(hiMin)} across ${plural(list.length, 'session')}.`;
}

export function activeWeekdays(list) {
  const days = [...new Set(list.map((x) => x.day))].sort();
  if (days.length > 7) return `${days.length} days`;
  return days.map((d) => WEEKDAYS[new Date(`${d}T12:00:00`).getDay()].slice(0, 3)).join(', ');
}

export function candidate(key, group, score, segments, fingerprintParts, detail = null) {
  const groups = Array.isArray(group) ? group : [group];
  return { key, group: groups[0], groups, score, segments, detail, text: segments.map((s) => s.text).join(''), fingerprint: `${key}|${fingerprintParts.join('|')}` };
}

export function topBy(obj, field) {
  return Object.values(obj).sort((a, b) => b[field] - a[field] || a.name.localeCompare(b.name))[0] || null;
}

export function buildCandidates(cur, prev, curList, prevList, periods, options = {}) {
  const patternList = options.patternList || [...curList, ...prevList];
  const patternLabel = options.patternLabel || 'Over the past two weeks';
  const out = [];
  const label = periods.current.label;
  const cmp = periods.previous.label;

  // Sparse period: direct facts about the sessions only, no patterns.
  if (cur.count > 0 && cur.count <= 2) {
    const latestNoted = [...curList].reverse().find((s) => s.note);
    if (latestNoted) {
      out.push(candidate('sparse:note', 'sparse', 60,
        seg`You spent ${hi(`${round(latestNoted.minutes)} minutes`)} on “${hi(shortQuote(latestNoted.note))}”.`,
        [latestNoted.id]));
    } else if (cur.count === 2 && curList[0].activity && curList[0].activity === curList[1].activity) {
      out.push(candidate('sparse:same', 'sparse', 58,
        seg`Both of your sessions ${label} were ${hi(curList[0].activity)}, ${hi(`${round(cur.totalMinutes)} minutes`)} in total.`,
        [curList[0].activity, round(cur.totalMinutes)]));
    } else if (cur.count === 1 && curList[0].activity) {
      out.push(candidate('sparse:one', 'sparse', 56,
        seg`You logged one ${hi(`${round(curList[0].minutes)}-minute`)} ${hi(curList[0].activity)} session ${label}.`,
        [curList[0].id]));
    } else {
      out.push(candidate('sparse:count', 'sparse', 45,
        seg`You logged ${hi(plural(cur.count, 'focus session'))} ${label}, ${hi(`${round(cur.totalMinutes)} minutes`)} in total.`,
        [cur.count, round(cur.totalMinutes)]));
    }
    return out;
  }
  if (cur.count === 0) return out;

  const hasPrev = prev.count >= 3;

  // 1. Session duration
  const useMedian = cur.count >= 5 && Math.abs(cur.avgMinutes - cur.medianMinutes) >= 5;
  if (hasPrev && Math.abs(cur.avgMinutes - prev.avgMinutes) >= 5 && Math.abs(cur.avgMinutes - prev.avgMinutes) / prev.avgMinutes >= 0.2) {
    const dir = cur.avgMinutes > prev.avgMinutes ? 'rose' : 'fell';
    out.push(candidate(`duration:change:${dir}`, 'duration', 78,
      seg`Your average session ${dir} from ${hi(round(prev.avgMinutes))} to ${hi(`${round(cur.avgMinutes)} minutes`)} compared with ${cmp}.`,
      [round(prev.avgMinutes / 5), round(cur.avgMinutes / 5)],
      seg`Based on ${plural(cur.count, 'session')} ${label} and ${prev.count} ${periods.previous.by}. Your longest ${label} ran ${hi(formatMinutes(Math.max(...curList.map((x) => x.minutes))))}.`));
  } else if (cur.count >= 3) {
    const top = topBy(cur.byActivity, 'minutes');
    const topShare = top && cur.totalMinutes ? top.minutes / cur.totalMinutes : 0;
    if (top && topShare >= 0.4 && top.count >= 2) {
      out.push(candidate('duration:avg+activity', ['duration', 'mix'], 54,
        seg`Your sessions averaged ${hi(`${round(cur.avgMinutes)} minutes`)}, with ${hi(top.name)} taking the largest share of your time.`,
        [round(cur.avgMinutes / 5), top.name],
        seg`${top.name}: ${plural(top.count, 'session')}, ${hi(formatMinutes(top.minutes))} of ${formatMinutes(cur.totalMinutes)} in total.`));
    }
    {
      const value = useMedian ? cur.medianMinutes : cur.avgMinutes;
      out.push(candidate('duration:avg', 'duration', useMedian ? 50 : 46,
        useMedian
          ? seg`A typical session ran about ${hi(`${round(value)} minutes`)} ${label}.`
          : seg`Your focus sessions averaged ${hi(`${round(value)} minutes`)} ${label}.`,
        [round(value / 5)],
        rangeDetail(curList)));
    }
  }

  // 2. Time of day
  if (cur.count >= 4) {
    const [topTod, topCount] = Object.entries(cur.byTod).sort((a, b) => b[1] - a[1])[0];
    const share = topCount / cur.count;
    const prevTop = prev.count >= 4 ? Object.entries(prev.byTod).sort((a, b) => b[1] - a[1])[0] : null;
    if (share >= 0.6 && prevTop && prevTop[0] !== topTod && prevTop[1] / prev.count >= 0.6) {
      out.push(candidate(`timing:shift:${topTod}`, 'timing', 72,
        seg`Most sessions started ${hi(TOD_PHRASE[topTod])} ${label}, versus ${TOD_PHRASE[prevTop[0]]} ${periods.previous.short}.`,
        [topTod, prevTop[0]],
        seg`Start times ${label}: ${todBreakdown(cur)}. ${periods.previous.short[0].toUpperCase()}${periods.previous.short.slice(1)}: ${todBreakdown(prev)}.`));
    } else if (share >= 0.6) {
      out.push(candidate(`timing:concentration:${topTod}`, 'timing', 62,
        seg`${hi(topCount)} of your ${cur.count} sessions started ${hi(TOD_PHRASE[topTod])} ${label}.`,
        [topTod, round(share * 10)],
        seg`Start times: ${todBreakdown(cur)}.`));
    } else if (Object.keys(cur.byTod).length >= 3 && share <= 0.45) {
      out.push(candidate('timing:spread', 'timing', 42,
        seg`Your sessions were spread across the day ${label}, with no single time dominating.`,
        [Object.keys(cur.byTod).sort().join(',')],
        seg`Start times: ${todBreakdown(cur)}.`));
    }
  }

  // 3. Activity distribution
  const named = Object.values(cur.byActivity);
  const namedReliable = cur.namedCount / cur.count >= 0.6;
  if (namedReliable && named.length) {
    const topTime = topBy(cur.byActivity, 'minutes');
    const topFreq = topBy(cur.byActivity, 'count');
    const share = topTime.minutes / cur.totalMinutes;
    if (named.length === 1 && cur.count >= 3 && cur.namedCount === cur.count) {
      out.push(candidate(`mix:single:${topTime.name}`, 'mix', 60,
        seg`All ${hi(cur.count)} sessions ${label} were ${hi(topTime.name)}.`,
        [topTime.name, cur.count],
        seg`${hi(formatMinutes(cur.totalMinutes))} in total.`));
    } else if (topFreq.name !== topTime.name && topFreq.count >= 2 && topTime.count >= 2 && topFreq.count > topTime.count) {
      out.push(candidate(`mix:freq-vs-time:${topFreq.name}:${topTime.name}`, 'mix', 69,
        seg`${hi(topFreq.name)} came up most often (${topFreq.count} sessions), but ${hi(topTime.name)} took the most time.`,
        [topFreq.name, topTime.name],
        seg`${activityBreakdown(cur)}.`));
    } else if (share >= 0.45 && topTime.count >= 2) {
      out.push(candidate(`mix:share:${topTime.name}`, 'mix', 66,
        seg`${hi(topTime.name)} accounted for ${hi(`${round(share * 100)}%`)} of your focus time ${label}.`,
        [topTime.name, round(share * 10)],
        seg`${activityBreakdown(cur)}.`));
    } else if (topFreq.count >= 3) {
      out.push(candidate(`mix:freq:${topFreq.name}`, 'mix', 58,
        seg`${hi(topFreq.name)} showed up in ${hi(topFreq.count)} of your ${cur.count} sessions ${label}.`,
        [topFreq.name, topFreq.count],
        seg`${activityBreakdown(cur)}.`));
    }

    // Week-over-week activity shift
    if (hasPrev && prev.namedCount / prev.count >= 0.6) {
      const prevTop = topBy(prev.byActivity, 'minutes');
      const prevShareOfCur = prev.byActivity[topTime.name.toLowerCase()]
        ? prev.byActivity[topTime.name.toLowerCase()].minutes / prev.totalMinutes : 0;
      if (prevTop && prevTop.name !== topTime.name && share - prevShareOfCur >= 0.2 && topTime.count >= 2) {
        out.push(candidate(`mix:shift:${topTime.name}`, 'mix', 80,
          prevShareOfCur === 0
            ? seg`${hi(topTime.name)} made up ${hi(`${round(share * 100)}%`)} of your focus time ${label}; it hadn't appeared ${periods.previous.by}.`
            : seg`Your focus time shifted toward ${hi(topTime.name)}: ${hi(`${round(share * 100)}%`)} ${label}, up from ${round(prevShareOfCur * 100)}% ${periods.previous.short}.`,
          [topTime.name, prevTop.name],
          seg`${periods.previous.short[0].toUpperCase()}${periods.previous.short.slice(1)} your largest share went to ${prevTop.name} (${round((prevTop.minutes / prev.totalMinutes) * 100)}%).`));
      }
    }
  }

  // 4. Activity by time of day (needs volume: uses both compared periods)
  const timePair = findActivityTimePair(periodStats(patternList));
  if (timePair) {
    const { pair, other } = timePair;
    out.push(candidate(`activity-time:${pair.name}:${other.name}`, 'activity-time', 75,
      seg`${patternLabel} you tended to do ${hi(pair.name)} ${TOD_PHRASE[pair.tod]} and ${hi(other.name)} ${TOD_PHRASE[other.tod]}.`,
      [pair.name, pair.tod, other.name, other.tod],
      seg`${pair.name}: ${hi(`${pair.inTod} of ${pair.count}`)} sessions started ${TOD_PHRASE[pair.tod]}. ${other.name}: ${hi(`${other.inTod} of ${other.count}`)} ${TOD_PHRASE[other.tod]}.`));
  }

  // 5. Week-over-week volume
  if (prev.count > 0) {
    const diff = cur.count - prev.count;
    const minDiff = cur.totalMinutes - prev.totalMinutes;
    if (Math.abs(diff) >= 3 && Math.abs(diff) / Math.max(prev.count, 1) >= 0.3) {
      out.push(candidate(`volume:count:${diff > 0 ? 'up' : 'down'}`, 'volume', diff > 0 ? 70 : 64,
        diff > 0
          ? seg`You completed ${hi(diff)} more sessions than ${periods.previous.than}.`
          : seg`You completed ${hi(Math.abs(diff))} fewer sessions than ${periods.previous.than}.`,
        [Math.sign(diff), Math.round(Math.abs(diff) / 2)],
        seg`${plural(cur.count, 'session')} (${formatMinutes(cur.totalMinutes)}) ${label}, versus ${prev.count} (${formatMinutes(prev.totalMinutes)}) ${periods.previous.by}.`));
    } else if (Math.abs(minDiff) >= 60 && prev.totalMinutes > 0 && Math.abs(minDiff) / prev.totalMinutes >= 0.3) {
      out.push(candidate(`volume:time:${minDiff > 0 ? 'up' : 'down'}`, 'volume', 66,
        seg`You logged ${hi(formatMinutes(cur.totalMinutes))} of focus time, compared with ${formatMinutes(prev.totalMinutes)} ${periods.previous.by}.`,
        [Math.sign(minDiff), Math.round(cur.totalMinutes / 60)],
        seg`${plural(cur.count, 'session')} ${label}, versus ${prev.count} ${periods.previous.by}.`));
    }
  }

  // 6. Consistency
  if (cur.count >= 3 && cur.activeDays === 1) {
    out.push(candidate('days:one', 'days', 50,
      seg`All ${cur.count} sessions ${label} happened on ${hi(WEEKDAYS[new Date(curList[0].startedAt).getDay()])}.`,
      [curList[0].day],
      null));
  } else if (prev.count > 0 && Math.abs(cur.activeDays - prev.activeDays) >= 2) {
    out.push(candidate(`days:change:${cur.activeDays > prev.activeDays ? 'up' : 'down'}`, 'days', 64,
      seg`You focused on ${hi(plural(cur.activeDays, 'day'))} ${label}, compared with ${prev.activeDays} ${periods.previous.by}.`,
      [cur.activeDays, prev.activeDays],
      seg`Days with a session ${label}: ${activeWeekdays(curList)}.`));
  } else if (cur.activeDays >= 3) {
    out.push(candidate('days:count', 'days', 45,
      seg`You completed focus sessions on ${hi(`${cur.activeDays} different days`)} ${label}.`,
      [cur.activeDays],
      seg`Days with a session: ${activeWeekdays(curList)}.`));
  }

  // 7. Recurring work theme from notes
  const theme = findNoteTheme(curList);
  if (theme) {
    out.push(candidate(`theme:${theme.term}`, 'theme', 74,
      seg`“${hi(theme.term)}” came up in ${hi(theme.sessions)} of your session notes ${label}.`,
      [theme.term, theme.sessions],
      theme.example
        ? seg`Between ${shortDate(theme.firstAt)} and ${shortDate(theme.lastAt)}, out of ${plural(theme.notes, 'note')}. Most recent: “${shortQuote(theme.example, 60)}”.`
        : null));
  }

  return out;
}

// ─── Selection ───────────────────────────────────────────────────────────────

/**
 * history: [{ key, fingerprint, day }] — insights shown on previous days.
 * A candidate whose exact fingerprint was shown on an earlier day within the
 * repeat window is down-weighted so a fresh, valid alternative wins. If the
 * underlying values change materially the fingerprint changes and the
 * observation can return at full weight. Nothing is penalised for having been
 * shown earlier the same day, so the card stays stable across screen visits.
 * With demoteOnly (the expanded view, which has room for more), repeats move
 * down the list instead of dropping out.
 */
export function selectInsights(candidates, history = [], today, max = MAX_INSIGHTS, { demoteOnly = false } = {}) {
  const cutoff = today ? shiftDays(new Date(`${today}T00:00:00`).getTime(), -REPEAT_WINDOW_DAYS) : -Infinity;
  const recent = history.filter((h) => h.day !== today && new Date(`${h.day}T00:00:00`).getTime() >= cutoff);

  const scored = candidates.map((c) => {
    const repeats = new Set(recent.filter((h) => h.fingerprint === c.fingerprint).map((h) => h.day)).size;
    const factor = repeats === 0 ? 1 : repeats === 1 ? 0.6 : 0.45;
    return { ...c, adjusted: c.score * factor, repeated: repeats > 0 };
  }).sort((a, b) => b.adjusted - a.adjusted || a.key.localeCompare(b.key));

  const chosen = [];
  const groups = new Set();
  for (const c of scored) {
    if (chosen.length >= max) break;
    if (c.groups.some((g) => groups.has(g)) || (demoteOnly ? c.score : c.adjusted) < MIN_SCORE) continue;
    chosen.push(c);
    c.groups.forEach((g) => groups.add(g));
  }

  // Don't manufacture novelty: if repetition filtering removed everything,
  // still show the strongest valid observation.
  if (chosen.length === 0) {
    const best = scored.filter((c) => c.score >= MIN_SCORE).sort((a, b) => b.score - a.score)[0];
    if (best) chosen.push(best);
  }
  return chosen;
}

// ─── Entry point ─────────────────────────────────────────────────────────────

/**
 * @returns {{ insights: Array<{key, text, segments, category}>, period }}
 */
export function generateInsights(rawSessions, { now = Date.now(), history = [] } = {}) {
  const sessions = normalizeSessions(rawSessions);
  const periods = resolvePeriods(sessions.map((s) => ({ started_at: s.startedAt })), now);
  const curList = sessions.filter((s) => s.startedAt >= periods.current.start && s.startedAt <= periods.current.end)
    .sort((a, b) => a.startedAt - b.startedAt);
  const prevList = sessions.filter((s) => s.startedAt >= periods.previous.start && s.startedAt <= periods.previous.end);
  const cur = periodStats(curList);
  const prev = periodStats(prevList);

  const candidates = buildCandidates(cur, prev, curList, prevList, periods);
  const selected = selectInsights(candidates, history, localDateKey(now));

  return {
    period: periods.current,
    insights: selected.map((c) => ({ key: c.key, category: c.group, text: c.text, segments: c.segments, fingerprint: c.fingerprint })),
  };
}

export const __test__ = { seg, hi, shortQuote, tokens, MIN_SCORE };
