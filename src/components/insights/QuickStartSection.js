import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { spacing, radius, typeScale } from '../../theme/insightTokens';

// `quickStartDefaults` shape: { duration, activity, musicChoice } — see
// src/services/insights/overviewService.js#getQuickStartDefaults.
export default function QuickStartSection({ quickStartDefaults, onStartSession, onSetUpDifferently }) {
  const { colors } = useTheme();

  return (
    <View style={styles.container}>
      <Text style={[typeScale.eyebrow, { color: colors.subText }]}>Quick Start</Text>

      <View style={styles.durationRow}>
        <Text style={[typeScale.statLarge, { color: colors.success }]}>
          {quickStartDefaults.duration}
          <Text style={[typeScale.cardValue, { color: colors.success }]}> min</Text>
        </Text>
        <Text style={[typeScale.subText, { color: colors.subText, marginLeft: spacing.md }]}>
          Your most common focus block
        </Text>
      </View>

      <TouchableOpacity
        style={[styles.startButton, { backgroundColor: colors.success }]}
        onPress={() => onStartSession(quickStartDefaults)}
        activeOpacity={0.85}
      >
        <Text style={styles.startButtonText}>Start Session</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryAction} onPress={onSetUpDifferently}>
        <Text style={[typeScale.subText, { color: colors.subText }]}>Set up differently</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xl,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  startButton: {
    borderRadius: radius.button,
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  startButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryAction: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
});
