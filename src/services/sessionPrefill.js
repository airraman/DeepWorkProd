// sessionPrefill.js — which "Start another" values Home may apply.
//
// Pure module (no React Native imports) so it can be unit-tested with
// `node --test` (see __tests__/sessionPrefill.test.mjs). A value is applied
// only if it is still valid on Home; anything else is left for the user to
// pick, rather than guessed.

/**
 * @param {{activity?: string, duration?: number|string, musicChoice?: string}|null} prefill
 * @param {{activityIds: string[], durations: number[], musicValues: string[]}} options
 * @returns {{activity: string|null, duration: string|null, musicChoice: string|null}}
 */
export function resolveSessionPrefill(prefill, { activityIds, durations, musicValues }) {
  const d = parseFloat(prefill?.duration);
  return {
    activity: prefill?.activity && activityIds.includes(prefill.activity) ? prefill.activity : null,
    // Home stores the selected duration as the option's string form.
    duration: durations.includes(d) ? d.toString() : null,
    musicChoice: musicValues.includes(prefill?.musicChoice) ? prefill.musicChoice : null,
  };
}

/**
 * Navigation state for the session summary's "Start another": Home with the
 * prefill, or Home with nothing pre-filled when `session` is null ("Set up
 * manually" — `manualSetup` also stops Home's quick-start defaults from
 * re-loading the session, which would be a second quick restart). Always
 * Home — never the DeepWorkSession screen — so nothing starts until the user
 * presses Begin.
 */
export function startAnotherNavigationState(session) {
  const home = session
    ? {
      name: 'Home',
      params: {
        prefill: {
          activity: session.activity,
          duration: session.duration,
          musicChoice: session.musicChoice,
        },
      },
    }
    : { name: 'Home', params: { manualSetup: true } };
  return {
    index: 0,
    routes: [{ name: 'MainApp', state: { routes: [home], index: 0 } }],
  };
}
