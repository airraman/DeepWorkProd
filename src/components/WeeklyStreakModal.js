// src/components/WeeklyStreakModal.js
//
// Displays a 7-day streak overview and current streak count.
// Computation is synchronous and pure — caller passes sessions in.

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

// ─── Data helpers ─────────────────────────────────────────────────────────────

const utcToday = () => new Date().toISOString().split('T')[0];

/**
 * Derive the last 7 days (oldest → newest) as YYYY-MM-DD strings.
 */
const getLast7Days = () => {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
};

/**
 * Map each of the last 7 days to whether the user completed a session.
 *
 * @param {Object} sessions — result of deepWorkStore.getSessions()
 *   shape: { 'YYYY-MM-DD': [session, ...], ... }
 * @returns {{ date: string, completed: boolean }[]} — 7 entries, oldest first
 */
export const computeWeeklyActivity = (sessions) => {
  const days = getLast7Days();
  return days.map((date) => ({
    date,
    completed: Array.isArray(sessions[date]) && sessions[date].length > 0,
  }));
};

/**
 * Calculate the current streak: consecutive completed days counting backwards
 * from today. A day with no session breaks the chain.
 *
 * @param {Object} sessions — result of deepWorkStore.getSessions()
 * @returns {number}
 */
export const computeCurrentStreak = (sessions) => {
  if (!sessions || Object.keys(sessions).length === 0) return 0;

  let streak = 0;
  const d = new Date();

  while (true) {
    const dateStr = d.toISOString().split('T')[0];
    if (Array.isArray(sessions[dateStr]) && sessions[dateStr].length > 0) {
      streak++;
      d.setUTCDate(d.getUTCDate() - 1);
    } else {
      break;
    }
  }

  return streak;
};

/**
 * Generate one short, actionable insight from session history.
 *
 * Priority order:
 *   1. Week-over-week volume comparison (this week vs last week)
 *   2. Most common hour of day for sessions
 *   3. Motivational fallback for insufficient data
 *
 * @param {Object} sessions — result of deepWorkStore.getSessions()
 * @returns {string} — a single short sentence, always defined
 */
export const computeLightweightInsight = (sessions) => {
  if (!sessions) return "Complete your first session to get insights.";

  const allDates = Object.keys(sessions);
  if (allDates.length === 0) return "Complete your first session to get insights.";

  // ── 1. Week-over-week comparison ──────────────────────────────────────────
  const thisWeekDates = new Set();
  const lastWeekDates = new Set();

  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    thisWeekDates.add(d.toISOString().split('T')[0]);
  }
  for (let i = 7; i < 14; i++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    lastWeekDates.add(d.toISOString().split('T')[0]);
  }

  const thisWeekCount = allDates
    .filter((d) => thisWeekDates.has(d))
    .reduce((sum, d) => sum + sessions[d].length, 0);

  const lastWeekCount = allDates
    .filter((d) => lastWeekDates.has(d))
    .reduce((sum, d) => sum + sessions[d].length, 0);

  if (thisWeekCount > 0 && lastWeekCount > 0) {
    if (thisWeekCount > lastWeekCount) {
      return `You're on a roll — ${thisWeekCount} sessions this week vs ${lastWeekCount} last week.`;
    }
    if (thisWeekCount < lastWeekCount) {
      return `Last week you did ${lastWeekCount} sessions. Try to beat it this week!`;
    }
    return `Consistent! Same number of sessions as last week (${thisWeekCount}).`;
  }

  // ── 2. Most common hour ───────────────────────────────────────────────────
  const hourCounts = {};
  for (const date of allDates) {
    for (const session of sessions[date]) {
      if (session.timestamp) {
        const hour = new Date(session.timestamp).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }
    }
  }

  const hourEntries = Object.entries(hourCounts);
  if (hourEntries.length > 0) {
    const [bestHour] = hourEntries.sort((a, b) => b[1] - a[1])[0];
    const h = parseInt(bestHour, 10);
    const label = h === 0 ? 'midnight'
      : h < 12 ? `${h} am`
      : h === 12 ? 'noon'
      : `${h - 12} pm`;
    return `You focus best around ${label} — keep scheduling sessions then.`;
  }

  // ── 3. Motivational fallback ──────────────────────────────────────────────
  return "Keep it up — consistency beats intensity every time.";
};

// ─── Component ────────────────────────────────────────────────────────────────

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function WeeklyStreakModal({ visible, onClose, onStartSession, sessions = {} }) {
  const { colors } = useTheme();

  const weeklyActivity = computeWeeklyActivity(sessions);
  const streak = computeCurrentStreak(sessions);
  const insight = computeLightweightInsight(sessions);
  const today = utcToday();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.sheet, { backgroundColor: colors.card || '#1a1a1a' }]}>

          {/* Title */}
          <Text style={[styles.title, { color: colors.text }]}>
            {streak > 0 ? `🔥 ${streak}-Day Streak` : 'Your Week'}
          </Text>

          {/* 7-day dot row */}
          <View style={styles.dotsRow}>
            {weeklyActivity.map(({ date, completed }) => {
              const isToday = date === today;
              return (
                <View key={date} style={styles.dayCell}>
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: completed ? '#f97316' : (colors.border || '#3a3a3a') },
                      isToday && styles.dotToday,
                    ]}
                  />
                  <Text style={[styles.dayLabel, { color: colors.textSecondary }]}>
                    {DAY_LABELS[new Date(date + 'T00:00:00Z').getUTCDay()]}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Insight */}
          <Text style={[styles.insight, { color: colors.textSecondary }]}>
            {insight}
          </Text>

          {/* Primary CTA */}
          {onStartSession && (
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => { onClose(); onStartSession(); }}
              activeOpacity={0.85}
            >
              <Text style={styles.primaryBtnText}>Start a Session</Text>
            </TouchableOpacity>
          )}

          {/* Secondary CTA */}
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={[styles.closeBtnText, { color: colors.textSecondary }]}>
              {onStartSession ? 'Not now' : 'Close'}
            </Text>
          </TouchableOpacity>

        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    gap: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  dayCell: {
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  dotToday: {
    borderWidth: 2,
    borderColor: '#2563EB',
  },
  dayLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  insight: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  primaryBtn: {
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  closeBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeBtnText: {
    fontSize: 15,
  },
});
