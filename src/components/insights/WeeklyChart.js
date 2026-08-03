import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { spacing, radius } from '../../theme/insightTokens';

const BAR_HEIGHT = 64;

// Purely presentational — `chartData` comes from the shared
// generateWeeklyChartData util (src/utils/weeklyChartData.js), the same
// calculation the in-page Metrics chart uses.
export default function WeeklyChart({ chartData }) {
  const { colors } = useTheme();
  const maxHours = Math.max(...chartData.map((d) => d.hours), 1);
  const lastIndex = chartData.length - 1;

  return (
    <View style={styles.container}>
      {chartData.map((day, index) => {
        const heightPct = day.hours > 0 ? Math.max((day.hours / maxHours) * 100, 8) : 4;
        const isToday = index === lastIndex;
        return (
          <View key={day.date} style={styles.column}>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.bar,
                  {
                    height: `${heightPct}%`,
                    backgroundColor: isToday ? colors.success : colors.cardBorder,
                  },
                ]}
              />
            </View>
            <Text style={[styles.label, { color: colors.subText }]}>{day.day}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    height: BAR_HEIGHT + 20,
  },
  column: {
    flex: 1,
    alignItems: 'center',
  },
  barTrack: {
    width: 24,
    height: BAR_HEIGHT,
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderRadius: radius.button,
  },
  label: {
    marginTop: spacing.xs,
    fontSize: 11,
    fontWeight: '500',
  },
});
