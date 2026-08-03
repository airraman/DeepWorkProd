import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { spacing, typeScale, sheet as sheetTokens } from '../../theme/insightTokens';
import WeeklyChart from './WeeklyChart';

// `overview` shape: { chartData, weeklySessions, weeklyHours, currentStreak }
// — see src/services/insights/overviewService.js#getWeeklyOverview.
export default function WeeklyOverview({ overview }) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[typeScale.eyebrow, { color: colors.subText }]}>This Week</Text>

      <View style={{ marginTop: spacing.lg }}>
        <WeeklyChart chartData={overview.chartData} />
      </View>

      <View style={[styles.divider, { backgroundColor: sheetTokens.border }]} />

      <View style={styles.stats}>
        <View style={styles.statItem}>
          <Text style={[typeScale.statSmall, { color: colors.text }]}>{overview.weeklySessions}</Text>
          <Text style={[typeScale.subText, { color: colors.subText }]}>sessions</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[typeScale.statSmall, { color: colors.text }]}>{overview.weeklyHours}</Text>
          <Text style={[typeScale.subText, { color: colors.subText }]}>hrs focused</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[typeScale.statSmall, { color: colors.text }]}>
            {overview.currentStreak}
            {overview.currentStreak > 0 ? ' 🔥' : ''}
          </Text>
          <Text style={[typeScale.subText, { color: colors.subText }]}>day streak</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.xxl,
  },
  divider: {
    height: 1,
    marginTop: spacing.xl,
  },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.xl,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
});
