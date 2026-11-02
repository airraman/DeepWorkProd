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
// fit the card's actual measured height only while a card is actually
// expanded, and returns to the default otherwise (see handleExpandChange /
// handlePageSelected). A fallback is used for the first frame after
// expanding, before InsightCard's onLayout reports the real height — this
// keeps content readable immediately rather than waiting a render cycle,
// and avoids hardcoding a height that only fits one screen size or one
// insight's length.
const FALLBACK_EXPANDED_PAGER_HEIGHT = 280;
const EXPANDED_HEIGHT_BUFFER = 24;
// Each insight line beyond the second needs room for up to two more lines
// of text plus its gap, or the default page height clips it.
const EXTRA_HEIGHT_PER_INSIGHT = 26;

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

  const handleExpandChange = useCallback((isExpanded, measuredHeight) => {
    if (!isExpanded) {
      setExpandedHeight(null);
      return;
    }
    setExpandedHeight((prev) => {
      const measured = measuredHeight ? measuredHeight + EXPANDED_HEIGHT_BUFFER : null;
      // Only grow, never shrink mid-expansion — successive onLayout calls
      // during the expand animation can report a smaller intermediate
      // height before settling, which would otherwise clip the card again.
      const floor = prev ?? FALLBACK_EXPANDED_PAGER_HEIGHT;
      return measured ? Math.max(measured, floor) : floor;
    });
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

  const maxInsights = Math.max(0, ...cards.map((c) => c.insights?.length || 0));
  const baseHeight = styles.pager.height + Math.max(0, maxInsights - 2) * EXTRA_HEIGHT_PER_INSIGHT;

  return (
    <View style={styles.container}>
      <PagerView
        ref={pagerRef}
        style={[styles.pager, { height: expandedHeight ?? baseHeight }]}
        initialPage={initialIndex}
        onPageSelected={handlePageSelected}
        onPageScrollStateChanged={handlePageScrollStateChanged}
      >
        {cards.map((card, index) => (
          <View key={card.id} style={styles.page}>
            <InsightCard
              card={card}
              onPress={onCardPressed ? () => onCardPressed(card, index) : undefined}
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
