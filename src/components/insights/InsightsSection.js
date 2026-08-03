import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../context/ThemeContext';
import { useFocusEffect } from '@react-navigation/native';
import { spacing, radius, typeScale } from '../../theme/insightTokens';
import InsightCarousel from './InsightCarousel';
import InsightsBottomSheet from './InsightsBottomSheet';
import { buildInsightCards } from '../../services/insights/insightCardService';
import { getWeeklyOverview, getQuickStartDefaults } from '../../services/insights/overviewService';
import { trackEvent } from '../../services/analytics';

const FIRST_IMPRESSION_KEY = '@insights_first_impression_seen';

export default function InsightsSection({ isPremium, onLockedPress, navigation }) {
  const { colors } = useTheme();
  const [cards, setCards] = useState(null);
  const [loading, setLoading] = useState(false);
  const hasExpandedFired = useRef(false);

  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetCardIndex, setSheetCardIndex] = useState(0);
  const [overview, setOverview] = useState(null);
  const [quickStartDefaults, setQuickStartDefaults] = useState(null);

  const load = useCallback(async () => {
    if (!isPremium) return;
    setLoading(true);
    try {
      const result = await buildInsightCards();
      setCards(result);
      if (!hasExpandedFired.current) {
        hasExpandedFired.current = true;
        trackEvent('insights_expanded');
        AsyncStorage.getItem(FIRST_IMPRESSION_KEY).then((seen) => {
          if (!seen) {
            trackEvent('insights_first_impression');
            AsyncStorage.setItem(FIRST_IMPRESSION_KEY, 'true');
          }
        });
      }
    } finally {
      setLoading(false);
    }
  }, [isPremium]);

  const handleCardPressed = useCallback(async (card, index) => {
    setSheetCardIndex(index);
    setSheetVisible(true);
    const [weeklyOverview, quickStart] = await Promise.all([
      getWeeklyOverview(),
      getQuickStartDefaults(),
    ]);
    setOverview(weeklyOverview);
    setQuickStartDefaults(quickStart);
  }, []);

  const handleCloseSheet = useCallback(() => {
    setSheetVisible(false);
  }, []);

  const handleStartSession = useCallback(
    (config) => {
      setSheetVisible(false);
      trackEvent('insight_cta_pressed', { cardType: 'quick_start' });
      navigation?.navigate('DeepWorkSession', {
        duration: String(config.duration),
        activity: config.activity,
        musicChoice: config.musicChoice,
        focusLockEnabled: false,
      });
    },
    [navigation]
  );

  const handleSetUpDifferently = useCallback(() => {
    setSheetVisible(false);
    navigation?.navigate('Home');
  }, [navigation]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!isPremium) {
    return (
      <TouchableOpacity
        style={[styles.locked, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}
        onPress={() => {
          trackEvent('insight_cta_pressed', { cardType: 'paywall' });
          onLockedPress?.();
        }}
      >
        <Text style={[typeScale.eyebrow, { color: colors.subText }]}>AI Insight</Text>
        <Text style={[typeScale.cardValue, { color: colors.text, marginTop: spacing.xs }]}>
          Unlock personalized focus insights
        </Text>
      </TouchableOpacity>
    );
  }

  if (loading && !cards) {
    return (
      <View style={[styles.locked, { backgroundColor: colors.cardBackground, borderColor: colors.cardBorder }]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (!cards) return null;

  return (
    <>
      <InsightCarousel cards={cards} onCardPressed={handleCardPressed} />
      <InsightsBottomSheet
        visible={sheetVisible}
        onClose={handleCloseSheet}
        cards={cards}
        initialCardIndex={sheetCardIndex}
        overview={overview}
        quickStartDefaults={quickStartDefaults}
        onStartSession={handleStartSession}
        onSetUpDifferently={handleSetUpDifferently}
      />
    </>
  );
}

const styles = StyleSheet.create({
  locked: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.xl,
    minHeight: 120,
    justifyContent: 'center',
  },
});
