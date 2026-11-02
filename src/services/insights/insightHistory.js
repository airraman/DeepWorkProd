// insightHistory.js — small on-device record of which insights were shown on
// which day, used by insightEngine.selectInsights to avoid repeating the same
// observation across days. Failures are non-fatal: without history the engine
// simply ranks by evidence alone.

import AsyncStorage from '@react-native-async-storage/async-storage';

const HISTORY_KEY = '@insight_history_v1';
const MAX_ENTRIES = 200;

export async function loadInsightHistory() {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function recordShownInsights(insights, day) {
  try {
    const history = await loadInsightHistory();
    const shown = new Set(history.filter((h) => h.day === day).map((h) => h.fingerprint));
    const additions = insights
      .filter((i) => !shown.has(i.fingerprint))
      .map((i) => ({ key: i.key, fingerprint: i.fingerprint, day }));
    if (additions.length === 0) return;
    const next = [...history, ...additions].slice(-MAX_ENTRIES);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  } catch {
    // History is a ranking hint only.
  }
}
