// chromeConnection.js — what the Settings "Lucid for Chrome" row says.
//
// Pure module (no React Native imports) so it can be unit-tested with
// `node --test` (see __tests__/chromeConnection.test.mjs).
//
// SOURCE OF TRUTH: existing Firestore data written only by the signed-in
// Chrome extension (DeepWorkChromeExtension) — no new connection field:
//   1. users/{uid}.platforms.chrome === true
//        profileService.createProfileIfMissing / markOnboardingComplete.
//        Only written for accounts that started in Chrome: an existing
//        mobile user signing in to the extension skips both.
//   2. a users/{uid}/sessions doc with source === 'extension'
//        sessionHistoryService.writeSessionToCloud, after a Chrome session.
//        Covers mobile-first users once they finish one session in Chrome.
// Either proves the extension has synced with THIS account. Neither proves
// it is signed in right now, so the copy says "linked", never "online".

export const CHROME_WEB_STORE_URL =
  'https://chromewebstore.google.com/detail/lucid-%E2%80%93-creative-focus/kjhmjfnodmankioppjmblompjlnoldfo';

/**
 * @param {object} input
 * @param {boolean} input.signedIn
 * @param {boolean} input.isAnonymous
 * @param {boolean} input.loading
 * @param {{platformsChrome: boolean|null, extensionSession: boolean|null}|null} input.signals
 *   null fields = that read failed
 * @returns {{ state: 'signed_out'|'anonymous'|'loading'|'linked'|'not_linked'|'unavailable',
 *             title: string, detail: string, showGetExtension: boolean }}
 */
export function resolveChromeConnection({ signedIn, isAnonymous, loading, signals }) {
  if (!signedIn) {
    return {
      state: 'signed_out',
      title: 'Not signed in',
      detail: 'Sign in to link Lucid on this phone with Lucid for Chrome.',
      showGetExtension: false,
    };
  }
  if (isAnonymous) {
    return {
      state: 'anonymous',
      title: 'Needs an account',
      detail: 'Lucid for Chrome links through your account. Sign in with an email or Google account to use it on your computer.',
      showGetExtension: false,
    };
  }
  if (loading || signals === undefined) {
    return { state: 'loading', title: 'Checking…', detail: '', showGetExtension: false };
  }

  const platformsChrome = signals?.platformsChrome ?? null;
  const extensionSession = signals?.extensionSession ?? null;

  // Positive evidence from either source is enough, even if the other read failed.
  if (platformsChrome === true || extensionSession === true) {
    return {
      state: 'linked',
      title: 'Linked to this account',
      detail: 'Lucid for Chrome has synced with this account. Sessions you start on either device show up on both.',
      showGetExtension: false,
    };
  }
  // A failed read must never be shown as "not linked".
  if (platformsChrome === null || extensionSession === null) {
    return {
      state: 'unavailable',
      title: "Couldn't check right now",
      detail: 'Check your connection and open Settings again.',
      showGetExtension: false,
    };
  }
  return {
    state: 'not_linked',
    title: 'Not linked yet',
    detail: 'On your computer, add Lucid for Chrome and sign in with this same account. It links after you sign in, and shows here once you finish a session in Chrome.',
    showGetExtension: true,
  };
}
