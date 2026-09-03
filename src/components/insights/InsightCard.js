import React, { useState, useCallback, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useTheme } from '../../context/ThemeContext';
import { spacing, radius, typeScale, motion, pressFeedback, shadow, INSIGHT_TYPE_LAYOUT } from '../../theme/insightTokens';
import { trackEvent } from '../../services/analytics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Config shape: { id, type, eyebrow, value, sub?, state, rows?, action? }
// isActive/onExpandChange let a parent carousel (InsightCarousel) grow its
// page height to fit an expanded card and collapse it again when the card is
// swiped away — inline expansion needs more vertical space than a fixed-
// height pager page provides, so the parent must be told when to grow.
export default function InsightCard({ card, onPress, isActive = true, onExpandChange }) {
  const { colors } = useTheme();
  const [truncated, setTruncated] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Auto-collapse when swiped away so a card never sits "expanded" while
  // off-screen — without this, re-visiting it later would try to render at
  // full expanded height again before the parent has grown to match,
  // clipping it exactly like the original bug.
  useEffect(() => {
    if (!isActive && expanded) {
      setExpanded(false);
      onExpandChange?.(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive]);

  const pressed = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 1 - pressed.value * (1 - pressFeedback.opacity),
    transform: [{ scale: 1 - pressed.value * (1 - pressFeedback.scale) }],
  }));

  const handlePressIn = useCallback(() => {
    pressed.value = withTiming(1, { duration: motion.duration });
  }, [pressed]);

  const handlePressOut = useCallback(() => {
    pressed.value = withTiming(0, { duration: motion.duration });
  }, [pressed]);

  const handlePress = useCallback(() => {
    const isExpandable = card.type === 'ai_insight' && truncated;
    if (isExpandable) {
      // Toggle in place only — do not also open the detail sheet below,
      // which was previously firing on every tap via onPress and
      // immediately covering the just-expanded card before it was visible.
      setExpanded((e) => {
        const next = !e;
        onExpandChange?.(next);
        return next;
      });
      trackEvent('insight_cta_pressed', { cardType: card.type });
      return;
    }
    if (card.action) {
      trackEvent('insight_cta_pressed', { cardType: card.type });
    }
    onPress?.(card);
  }, [card, truncated, onPress, onExpandChange]);

  const isLive = card.state === 'live';
  const isEmpty = card.state === 'empty' || card.state === 'offline' || card.state === 'loading';
  const layout = INSIGHT_TYPE_LAYOUT[card.type] || 'text-lead';

  const shadowColor = isLive ? colors.success : '#000000';

  return (
    <View
      style={[
        styles.glow,
        shadow.card.wide,
        { shadowColor },
      ]}
    >
      <AnimatedPressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={!onPress && !(card.type === 'ai_insight' && truncated)}
        style={[
          styles.card,
          shadow.card.tight,
          animatedStyle,
          {
            backgroundColor: colors.cardBackground,
            borderColor: colors.cardBorder,
            shadowColor,
          },
        ]}
      >
        <Text style={[typeScale.eyebrow, { color: colors.subText }]}>{card.eyebrow}</Text>

        {layout === 'rows' && card.rows ? (
          <View style={styles.rows}>
            {card.rows.map((row, i) => (
              <View
                key={row.label}
                style={[
                  styles.row,
                  i > 0 && { borderTopWidth: 1, borderTopColor: colors.cardBorder },
                ]}
              >
                <Text style={[typeScale.subText, { color: colors.subText }]}>{row.label}</Text>
                <Text style={[typeScale.cardValue, { color: colors.text }]}>{row.value}</Text>
              </View>
            ))}
          </View>
        ) : (
          <>
            <Text
              style={[
                layout === 'number-lead' ? typeScale.statLarge : typeScale.cardValue,
                { color: isEmpty ? colors.subText : colors.text, marginTop: spacing.sm },
              ]}
              numberOfLines={card.type === 'ai_insight' && !expanded ? 3 : undefined}
              onTextLayout={(e) => {
                if (card.type === 'ai_insight' && e.nativeEvent.lines.length >= 3 && !truncated) {
                  setTruncated(true);
                }
              }}
            >
              {card.value}
            </Text>
            {card.sub ? (
              <Text
                style={[typeScale.subText, { color: colors.subText, marginTop: spacing.xs }]}
                numberOfLines={card.type === 'ai_insight' ? 2 : undefined}
              >
                {card.sub}
              </Text>
            ) : null}
          </>
        )}
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  glow: {
    borderRadius: radius.card,
    shadowOpacity: shadow.card.wide.shadowOpacity,
  },
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    padding: spacing.lg,
    paddingHorizontal: spacing.xl,
    minHeight: 120,
  },
  rows: {
    marginTop: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
});
