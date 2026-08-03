// Theme-invariant design primitives for the Insight Card system.
// Color hex values live in ThemeContext.js (theme-reactive); these tokens
// describe shape/spacing/motion only and are combined with `colors` at call sites.

export const spacing = { xs: 4, sm: 8, md: 12, lg: 14, xl: 16, xxl: 20, xxxl: 24 };

export const radius = { button: 9, card: 14, pill: 999 };

// Bottom sheet shell (Insights popup recreation) — see insightTokens.js header note.
export const sheet = {
  radius: 18,
  heightPct: 0.88,
  background: '#0f0f0f',
  border: '#1e1e1e',
};

export const typeScale = {
  statLarge: { fontSize: 30, letterSpacing: -1.5, fontWeight: '700' },
  statSmall: { fontSize: 18, letterSpacing: -0.8, fontWeight: '700' },
  cardValue: { fontSize: 13, fontWeight: '600' },
  subText: { fontSize: 11, fontWeight: '400' },
  eyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 0.65, textTransform: 'uppercase' },
};

export const motion = {
  duration: 300,
  swipeBezier: [0.4, 0, 0.2, 1],
  autoAdvanceMs: 8000,
  resumeAfterInactivityMs: 8000,
};

export const pressFeedback = { opacity: 0.7, scale: 0.97 };

// Shadow *shape* only — shadowColor is composed at the call site from
// colors.text/black (default) or colors.success (state === 'live').
export const shadow = {
  card: {
    wide: { shadowOffset: { width: 0, height: 8 }, shadowRadius: 24, shadowOpacity: 0.35, elevation: 8 },
    tight: { shadowOffset: { width: 0, height: 2 }, shadowRadius: 6, shadowOpacity: 0.45, elevation: 4 },
  },
};

// Which card types lead with a big number vs. a text headline.
export const INSIGHT_TYPE_LAYOUT = {
  ai_insight: 'text-lead',
  so_far: 'number-lead',
  comparison: 'number-lead',
  data: 'rows',
  up_next: 'text-lead',
};
