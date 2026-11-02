import React, { useEffect, useState, useCallback } from 'react';
import { Modal, View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { spacing, radius, typeScale } from '../../theme/insightTokens';
import SessionRepository from '../../services/database/SessionRepository';
import { generateReports, reportWindowStart, REPORT_PERIODS, formatMinutes } from '../../services/insights/insightReports';
import { loadInsightHistory, recordShownInsights } from '../../services/insights/insightHistory';
import { localDateKey } from '../../services/insights/insightEngine';
import { trackEvent } from '../../services/analytics';

function SegmentText({ segments, style, accentColor, numberOfLines }) {
  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {segments.map((part, i) => (
        <Text key={i} style={part.accent ? { color: accentColor } : null}>
          {part.text}
        </Text>
      ))}
    </Text>
  );
}

function Stat({ label, value, colors }) {
  return (
    <View style={styles.stat}>
      <Text style={[typeScale.statSmall, { color: colors.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[typeScale.eyebrow, styles.statLabel, { color: colors.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

// Expanded qualitative insights: This Week / This Month / 6 Months. Reports
// are computed once per open from local session data; switching periods
// only changes which precomputed report is shown.
export default function InsightsDetailModal({ visible, onClose }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [periodId, setPeriodId] = useState('week');
  const [state, setState] = useState({ loading: false, reports: null });

  useEffect(() => {
    if (!visible) return undefined;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    (async () => {
      const now = Date.now();
      const [sessions, history] = await Promise.all([
        SessionRepository.getSessionsByDateRange(reportWindowStart(now), now),
        loadInsightHistory(),
      ]);
      if (cancelled) return;
      setState({ loading: false, reports: generateReports(sessions, { now, history }) });
    })().catch(() => {
      if (!cancelled) setState({ loading: false, reports: null });
    });
    return () => { cancelled = true; };
  }, [visible]);

  const report = state.reports?.[periodId] ?? null;

  useEffect(() => {
    if (!visible || !report) return;
    trackEvent('insights_detail_viewed', { period: periodId, observations: report.observations.length });
    recordShownInsights(report.observations, localDateKey(Date.now()));
  }, [visible, report, periodId]);

  const handleClose = useCallback(() => {
    setPeriodId('week');
    onClose?.();
  }, [onClose]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
            Your Insights
          </Text>
          <Pressable
            onPress={handleClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close insights"
          >
            <X size={20} color={colors.textSecondary} />
          </Pressable>
        </View>

        <View style={[styles.segmented, { backgroundColor: colors.track }]} accessibilityRole="tablist">
          {REPORT_PERIODS.map((p) => {
            const selected = p.id === periodId;
            return (
              <Pressable
                key={p.id}
                onPress={() => setPeriodId(p.id)}
                style={[
                  styles.segment,
                  selected && { backgroundColor: colors.cardBackground, borderColor: colors.success },
                ]}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={p.label}
              >
                <Text style={[styles.segmentText, { color: selected ? colors.text : colors.textSecondary }]}>
                  {p.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {state.loading && !state.reports ? (
          <View style={styles.centered}>
            <ActivityIndicator color={colors.success} />
          </View>
        ) : !report ? (
          <View style={styles.centered}>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Insights couldn't be loaded right now.
            </Text>
          </View>
        ) : (
          <ScrollView
            key={periodId}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + spacing.xxxl }]}
            showsVerticalScrollIndicator={false}
          >
            <Text style={[typeScale.eyebrow, { color: colors.textSecondary }]}>
              {report.title} · {report.range}
            </Text>
            {report.coverageNote ? (
              <Text style={[styles.coverage, { color: colors.textSecondary }]}>{report.coverageNote}</Text>
            ) : null}

            <View style={[styles.overview, { backgroundColor: colors.cardBackground, borderColor: colors.success }]}>
              <View style={styles.statsRow}>
                <Stat label="Sessions" value={String(report.overview.sessions)} colors={colors} />
                <Stat label="Focus time" value={formatMinutes(report.overview.focusMinutes)} colors={colors} />
                <Stat label="Avg session" value={report.overview.sessions ? `${report.overview.avgMinutes}m` : '—'} colors={colors} />
                <Stat label="Active days" value={String(report.overview.activeDays)} colors={colors} />
              </View>
              {report.overview.comparison ? (
                <Text style={[styles.comparison, { color: colors.textSecondary }]}>
                  Compared with {report.overview.comparison}.
                </Text>
              ) : null}
            </View>

            {report.observations.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                {report.overview.sessions === 0
                  ? 'No focus sessions in this period yet.'
                  : 'Not enough sessions in this period to point out a pattern yet.'}
              </Text>
            ) : (
              report.observations.map((o) => (
                <View
                  key={o.key}
                  style={[styles.observation, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}
                >
                  <SegmentText segments={o.headline} accentColor={colors.success} style={[styles.headline, { color: colors.text }]} />
                  {o.detail ? (
                    <SegmentText segments={o.detail} accentColor={colors.success} style={[styles.detail, { color: colors.textSecondary }]} />
                  ) : null}
                </View>
              ))
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  segmented: {
    flexDirection: 'row',
    marginHorizontal: spacing.xxl,
    padding: 3,
    borderRadius: radius.button + 3,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xl,
    gap: spacing.md,
  },
  coverage: {
    fontSize: 12,
    marginTop: -spacing.xs,
  },
  overview: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    flex: 1,
    alignItems: 'flex-start',
  },
  statLabel: {
    marginTop: spacing.xs,
  },
  comparison: {
    fontSize: 12,
    marginTop: spacing.md,
  },
  observation: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.lg,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  headline: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
  },
  detail: {
    fontSize: 13,
    lineHeight: 19,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
