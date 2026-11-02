import React, { useEffect, useState, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../context/ThemeContext';
import { useFocusEffect } from '@react-navigation/native';
import { spacing, radius, typeScale } from '../../theme/insightTokens';
import InsightCarousel from './InsightCarousel';
import InsightsBottomSheet from './InsightsBottomSheet';
import InsightsDetailModal from './InsightsDetailModal';
import { buildInsightCards } from '../../services/insights/insightCardService';
import { getWeeklyOverview, getQuickStartDefaults } from '../../services/insights/overviewService';
import { trackEvent } from '../../services/analytics';

const FIRST_IMPRESSION_KEY = '@insights_first_impression_seen';

export default function InsightsSection({ isPremium, onLockedPress, navigation, autoOpen, onAutoOpenHandled }) {
  const { colors } = useTheme();
  const [cards, setCards] = useState(null);
  const [loading, setLoading] = useState(false);
  const hasExpandedFired = useRef(false);
  const hasAutoOpenedFired = useRef(false);

  const [sheetVisible, setSheetVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
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
    if (card?.type === 'ai_insight') {
      trackEvent('insight_cta_pressed', { cardType: 'insights_detail' });
      setDetailVisible(true);
      return;
    }
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

  // Weekly performance notification tap — open straight into the bottom
  // sheet once cards are loaded, landing on the week-over-week comparison
  // card when one exists. Fires once per navigation (guarded by the ref);
  // MetricsScreen resets autoOpen to false via onAutoOpenHandled so a later
  // unrelated focus doesn't reopen it.
  useEffect(() => {
    if (!autoOpen || !cards || hasAutoOpenedFired.current) return;
    hasAutoOpenedFired.current = true;
    const comparisonIndex = cards.findIndex((c) => c.type === 'comparison');
    handleCardPressed(cards[comparisonIndex !== -1 ? comparisonIndex : 0], comparisonIndex !== -1 ? comparisonIndex : 0);
    onAutoOpenHandled?.();
  }, [autoOpen, cards, handleCardPressed, onAutoOpenHandled]);

  if (!isPremium) {
    return (
      <TouchableOpacity
        style={[styles.locked, { backgroundColor: colors.cardBackground, borderColor: colors.success }]}
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
      <View style={[styles.locked, { backgroundColor: colors.cardBackground, borderColor: colors.success }]}>
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
      <InsightsDetailModal visible={detailVisible} onClose={() => setDetailVisible(false)} />
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
