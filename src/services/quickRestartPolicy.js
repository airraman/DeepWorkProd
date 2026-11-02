// quickRestartPolicy.js — the one quick-restart entitlement rule, shared by
// every entry point that re-loads the previous session's settings in one tap:
//   - Home's "Quick restart?" modal  (HomeScreen.handleQuickRestart)
//   - Session summary "Start another" (SessionSummaryScreen.handleStartAnother)
//   - Home's quick-start defaults, when they re-load a session already done
//     today (sessionDefaults.js isQuickRestart; consumed on Begin)
//
// Pure module (no React Native imports) so it can be unit-tested with
// `node --test` (see __tests__/quickRestartPolicy.test.mjs).
//
// Product rule: free users get 1 quick restart per day, premium users get 2.
// Only free users are shown the paywall when out — premium users already
// have the upgrade. isPremium always comes from SubscriptionContext; this
// module never decides premium itself.
//
// A quick restart is consumed when the user accepts the prefill, not when a
// session starts; a denied attempt consumes nothing. Neither entry point
// ever starts a session — the user still presses Begin.

export const FREE_DAILY_QUICK_RESTARTS = 1;
export const PREMIUM_DAILY_QUICK_RESTARTS = 2;

/**
 * Quick restarts already used today, from the stored date + count
 * (monetizationService's @last_quick_restart_date / @quick_restart_count).
 * A stored date other than today means the counter has reset.
 */
export function quickRestartsUsedToday({ storedDate, storedCount, today }) {
  if (typeof storedDate !== 'string' || storedDate !== today) return 0;
  const n = parseInt(storedCount || '0', 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function dailyQuickRestartLimit(isPremium) {
  return isPremium === true ? PREMIUM_DAILY_QUICK_RESTARTS : FREE_DAILY_QUICK_RESTARTS;
}

/**
 * @param {{ isPremium: boolean, usedToday: number }} input
 * @returns {{ allowed: boolean, consume: boolean, showPaywall: boolean }}
 *   consume = record one quick restart now; only ever true when allowed
 *   showPaywall = denied and free (a premium user at the cap is told, not sold)
 */
export function decideQuickRestart({ isPremium, usedToday }) {
  const used = Number.isFinite(usedToday) && usedToday > 0 ? usedToday : 0;
  const allowed = used < dailyQuickRestartLimit(isPremium);
  return { allowed, consume: allowed, showPaywall: !allowed && isPremium !== true };
}

/**
 * Whether Begin is starting the quick-restart defaults exactly as Home
 * pre-selected them. Any change the user made means they set the session up
 * themselves, so no quick restart is consumed.
 *
 * @param {{activity: string, duration: string, musicChoice: string}|null} restartDefaults
 * @param {{activity: string, duration: string, musicChoice: string}} selected
 */
export function isUntouchedRestart(restartDefaults, selected) {
  if (!restartDefaults) return false;
  return ['activity', 'duration', 'musicChoice'].every(
    (k) => String(restartDefaults[k]) === String(selected?.[k]),
  );
}
