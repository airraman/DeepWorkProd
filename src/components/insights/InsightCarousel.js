import React, { useRef, useState, useCallback, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import PagerView from 'react-native-pager-view';
import { useTheme } from '../../context/ThemeContext';
import { spacing, radius, motion } from '../../theme/insightTokens';
import InsightCard from './InsightCard';
import { trackEvent } from '../../services/analytics';

// Fixed default page height (styles.pager below) clips any content taller
// than it, since PagerView clips its pages natively — not a CSS overflow
// issue, so `overflow: visible` on a child can't override it. An expanded
// ai_insight card needs more room than the default, so the pager grows to
// this height only while a card is actually expanded, and returns to the
// default otherwise (see handleExpandChange / handlePageSelected).
const EXPANDED_PAGER_HEIGHT = 280;

export default function InsightCarousel({ cards, onCardPressed, initialIndex = 0 }) {
  const { colors } = useTheme();
  const pagerRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [expandedHeight, setExpandedHeight] = useState(null);
  const currentIndex = useRef(initialIndex);
  const isAutoAdvanceRef = useRef(false);
  const autoAdvanceTimer = useRef(null);
  const resumeTimer = useRef(null);

  const clearTimers = useCallback(() => {
    if (autoAdvanceTimer.current) clearInterval(autoAdvanceTimer.current);
    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    autoAdvanceTimer.current = null;
    resumeTimer.current = null;
  }, []);

  const startAutoAdvance = useCallback(() => {
    if (!cards || cards.length < 2) return;
    clearTimers();
    autoAdvanceTimer.current = setInterval(() => {
      const nextIndex = (currentIndex.current + 1) % cards.length;
      isAutoAdvanceRef.current = true;
      trackEvent('insight_card_auto_rotated', { cardType: cards[nextIndex]?.type, cardIndex: nextIndex });
      pagerRef.current?.setPage(nextIndex);
    }, motion.autoAdvanceMs);
  }, [cards, clearTimers]);

  useEffect(() => {
    startAutoAdvance();
    return clearTimers;
  }, [startAutoAdvance, clearTimers]);

  const handlePageScrollStateChanged = useCallback(
    (e) => {
      const state = e.nativeEvent.pageScrollState;
      if (state === 'dragging') {
        clearTimers();
      } else if (state === 'idle') {
        if (resumeTimer.current) clearTimeout(resumeTimer.current);
        resumeTimer.current = setTimeout(startAutoAdvance, motion.resumeAfterInactivityMs);
      }
    },
    [clearTimers, startAutoAdvance]
  );

  const handleExpandChange = useCallback((isExpanded) => {
    setExpandedHeight(isExpanded ? EXPANDED_PAGER_HEIGHT : null);
  }, []);

  const handlePageSelected = useCallback(
    (e) => {
      const index = e.nativeEvent.position;
      const wasAuto = isAutoAdvanceRef.current;
      isAutoAdvanceRef.current = false;
      currentIndex.current = index;
      setActiveIndex(index);
      // The card being swiped away from auto-collapses itself (InsightCard's
      // isActive effect) and reports that here — reset eagerly too so the
      // pager shrinks back immediately rather than waiting a render cycle.
      setExpandedHeight(null);

      const card = cards[index];
      if (!card) return;

      if (!wasAuto) {
        trackEvent('insight_card_swiped', { cardType: card.type, cardIndex: index });
      }
      trackEvent('insight_card_viewed', { cardType: card.type, cardIndex: index });
    },
    [cards]
  );

  if (!cards || cards.length === 0) return null;

  return (
    <View style={styles.container}>
      <PagerView
        ref={pagerRef}
        style={[styles.pager, expandedHeight ? { height: expandedHeight } : null]}
        initialPage={initialIndex}
        onPageSelected={handlePageSelected}
        onPageScrollStateChanged={handlePageScrollStateChanged}
      >
        {cards.map((card, index) => (
          <View key={card.id} style={styles.page}>
            <InsightCard
              card={card}
              onPress={() => onCardPressed?.(card, index)}
              isActive={index === activeIndex}
              onExpandChange={index === activeIndex ? handleExpandChange : undefined}
            />
          </View>
        ))}
      </PagerView>

      <View style={styles.dots}>
        {cards.map((card, i) => (
          <View
            key={card.id}
            style={[
              styles.dot,
              { backgroundColor: colors.cardBorder },
              i === activeIndex && { backgroundColor: colors.text, opacity: 0.9 },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  pager: {
    height: 160,
  },
  page: {
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
  },
});
