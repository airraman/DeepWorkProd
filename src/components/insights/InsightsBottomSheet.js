import React, { useEffect } from 'react';
import { Modal, View, Text, TouchableOpacity, Dimensions, StyleSheet } from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import { useTheme } from '../../context/ThemeContext';
import { spacing, typeScale, sheet as sheetTokens } from '../../theme/insightTokens';
import InsightCarousel from './InsightCarousel';
import WeeklyOverview from './WeeklyOverview';
import QuickStartSection from './QuickStartSection';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * sheetTokens.heightPct;

// `cards` / `overview` / `quickStartDefaults` are pre-built by the caller
// (InsightsSection) — this component is presentation-only.
export default function InsightsBottomSheet({
  visible,
  onClose,
  cards,
  initialCardIndex = 0,
  overview,
  quickStartDefaults,
  onStartSession,
  onSetUpDifferently,
}) {
  const { colors } = useTheme();
  const translateY = useSharedValue(SHEET_HEIGHT);

  useEffect(() => {
    translateY.value = withTiming(visible ? 0 : SHEET_HEIGHT, { duration: 300 });
  }, [visible, translateY]);

  const close = () => {
    translateY.value = withTiming(SHEET_HEIGHT, { duration: 250 });
    onClose?.();
  };

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      if (e.translationY > 0) translateY.value = e.translationY;
    })
    .onEnd((e) => {
      if (e.translationY > SHEET_HEIGHT * 0.25 || e.velocityY > 800) {
        translateY.value = withTiming(SHEET_HEIGHT, { duration: 200 });
        runOnJS(close)();
      } else {
        translateY.value = withTiming(0, { duration: 200 });
      }
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
      <View style={styles.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={close} />

        <GestureDetector gesture={pan}>
          <Animated.View
            style={[
              styles.sheet,
              animatedStyle,
              { height: SHEET_HEIGHT, backgroundColor: sheetTokens.background, borderColor: sheetTokens.border },
            ]}
          >
            <View style={styles.grabber} />

            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.text }]}>Lucid</Text>
              <TouchableOpacity onPress={close} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <X size={20} color={colors.subText} />
              </TouchableOpacity>
            </View>

            {overview ? <WeeklyOverview overview={overview} /> : null}

            <View style={styles.carouselWrap}>
              {cards ? <InsightCarousel cards={cards} initialIndex={initialCardIndex} /> : null}
            </View>

            {quickStartDefaults ? (
              <QuickStartSection
                quickStartDefaults={quickStartDefaults}
                onStartSession={onStartSession}
                onSetUpDifferently={onSetUpDifferently}
              />
            ) : null}
          </Animated.View>
        </GestureDetector>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: sheetTokens.radius,
    borderTopRightRadius: sheetTokens.radius,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    marginBottom: spacing.xl,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  carouselWrap: {
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
});
