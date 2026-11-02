# Lucid Release Runbook

Cloud commands to run now that all three sprints are implemented locally. Nothing in sections 2–5 has been run yet. A machine-readable summary of the completed work is in `SPRINT_COMPLETION_SUMMARY.json`.

- Firebase project: `deepwork-8416f` (from `.firebaserc`)
- EAS channel / branch: `production` (from `eas.json`)
- Live iOS build: v1.0.12, build 48, runtime `1.0.10`

Status: `[ ]` not started · `[x]` done · `[!]` blocked or needs a decision.

Every deploy, build, submit and publish below needs your explicit approval.

---

## 1. Local checks (safe, nothing leaves the machine)

- [x] `cd functions && npm test` — Functions suite 76/76 (email 27, morningActivation 26, pushTokens 13, weeklySummary 10)
- [x] `node --test src/services/__tests__/streakRiskPolicy.test.mjs` — streak policy (9/9)
- [x] `npm run test:insights` — insights regression (39/39)
- [x] `node --test src/services/__tests__/homeProgress.test.mjs` — Home progress line (15/15)
- [x] `node --test src/services/__tests__/*.test.mjs` — all client tests (112/112 as of quick-restart fix)
- [x] `node --test src/services/__tests__/sessionPrefill.test.mjs` — Start another prefill (7/7)
- [x] `node --test src/services/__tests__/weeklyActivity.test.mjs` — streak modal suppression (10/10)
- [x] `node --test src/services/__tests__/sessionDefaults.test.mjs` — quick-start defaults (18/18)
- [x] `node --test src/services/__tests__/analyticsEvents.test.mjs` — analytics parameters and privacy (11/11)
- [x] `node --test src/services/__tests__/notificationPrefsRules.test.mjs` — notification preferences (7/7)
- [x] `node --test src/services/__tests__/chromeConnection.test.mjs` — Chrome link status (10/10)
- [x] `node --test src/services/__tests__/quickRestartPolicy.test.mjs` — quick-restart entitlement (18/18)
- [x] `cd functions && npx eslint morningActivation.js pushTokens.js emailPolicy.js emailTemplates.js email.js` — clean. (`index.js` has 127 pre-existing lint errors, down from 140; deploy doesn't run lint.)

## 2. Cloud Functions

Deploy one function per command. **Never run a plain `firebase deploy --only functions`.** It would redeploy `sendChromeExtensionWelcomeEmail` (live; its code is unchanged locally, but it's still an open decision) and try to delete `syncEmailToMailchimp`, which is live in production but not in this repo.

| Status | Command | What it changes | When |
| --- | --- | --- | --- |
| [ ] | `firebase deploy --only functions:dailyRemindersBatch --project deepwork-8416f` | Morning activation and re-engagement at 9 am local: loops over `fcm_tokens`, one push per day, suppression rules. **Respects the notification preferences:** every category is on by default (opt-out). Daily reminders stop only on `dailyReminder.enabled: false`, re-engagement only on `reengagement: false` | Any time. It sends nothing until updated apps register a timezone |
| [ ] | `firebase deploy --only functions:weeklySummaryBatch --project deepwork-8416f` | Weekly summary: includes iOS-only users, no UTC fallback | Any time |
| [ ] | `firebase deploy --only functions:unregisterToken --project deepwork-8416f` | **New** endpoint: removes this device's token on sign-out | Any time |
| [!] | `firebase deploy --only functions:registerToken --project deepwork-8416f` | Requires a Firebase ID token. Build 48 apps will get 401 and stop refreshing their tokens | **Only after the new iOS binary is live** |
| [ ] | `firebase deploy --only functions:emailUnsubscribe --project deepwork-8416f` | **New** HTTPS endpoint: GET shows a confirm page; POST (button or RFC 8058 one-click) sets `users/{uid}/preferences/email.marketingConsent = "denied"` | After secret `EMAIL_UNSUBSCRIBE_SECRET` exists (section 3c). Safe on its own: no email links to it until a marketing send exists |
| [ ] | `firebase deploy --only functions:resendWebhook --project deepwork-8416f` | **New** HTTPS endpoint for Resend (Svix-signed): hard bounce or complaint adds `email_suppressions/{sha256(email)}`; a complaint also denies that user's consent | After secret `RESEND_WEBHOOK_SECRET` exists and the Resend webhook is created (section 3c). Safe on its own |
| [!] | `firebase deploy --only functions:sendChromeExtensionWelcomeEmail --project deepwork-8416f` | Welcome email, **already live and sending**. Needs the targeting guard and unsubscribe before any redeploy | Blocked: needs a decision on the email fixes (Sprint 3) |

Not deployed by this repo, never touch: `deliverDeferredWeeklyNotification` (unchanged), `syncEmailToMailchimp` (source not in this repo).

After each deploy, check the logs:

- [ ] `firebase functions:log --only dailyRemindersBatch --project deepwork-8416f` — expect `Activation sent` > 0 once updated apps are out. Production showed `Sent: 0, Skipped: 101` before this sprint.
- [ ] `firebase functions:log --only weeklySummaryBatch --project deepwork-8416f` — Mondays; it showed `Sent: 0, Skipped: 99` before.

## 3. Firestore

- [!] **Check the live security rules in the Firebase Console** (Firestore → Rules). The repo's `firestore.rules` is not the production ruleset, so **do not deploy it**. Confirm:
  - Clients can't write `fcm_tokens/*`. Only Cloud Functions should, otherwise the new token authentication can be bypassed.
  - Clients can read their own `users/{uid}/preferences/notifications` and `users/{uid}/notificationState/dailyActivation`.
  - Clients can **write** their own `users/{uid}/preferences/notifications`. The Settings toggles merge-write single fields there; without this rule, toggles show "Couldn't save".
  - Clients can read and **write** their own `users/{uid}/preferences/email` (Product emails toggle).
  - Clients can read their own `users/{uid}` and query their own `users/{uid}/sessions` with `where("source", "==", "extension")` (Chrome link status). The app already reads both, so this is probably already allowed.
  - Clients can **not** read or write `email_suppressions/*`. Only Cloud Functions should.
- [x] Preference schema change is additive: new optional field `reengagement` (boolean) in `users/{uid}/preferences/notifications`. **No migration**: missing fields resolve to defaults at read time and are never written back over existing docs.
- [x] No new composite indexes are needed. The queries are single-field.

## 3b. Google Analytics 4 (console only, no deploy)

Instrumentation (Sprint 1) sends new events from the app. These console steps make them usable in reports. Nothing here affects the app.

- [ ] **Before the release build:** add your own production-account Firebase Auth uid(s) to `src/config/analyticsInternalUsers.js`. Uids only, never emails. Dev builds and the `.dev` app are always marked internal automatically.
- [ ] GA4 Admin → Custom definitions → **user-scoped** dimension `internal_user`
- [ ] GA4 Admin → Custom definitions → **event-scoped** dimensions `progress_state`, `notification_type`, `notification_category`, `notification_source`, `app_state`
- [ ] GA4 Admin → Custom definitions → **custom metrics** `session_duration_min`, `week_session_count`, `has_next_step`, `start_another_available`, `is_first_session`
- [ ] Product reporting: in every exploration, add the filter **`internal_user` does not exactly match `true`**. This keeps users who don't have the property yet (still on older app versions) and drops only internal ones. Optionally save it as a comparison.
- [ ] Verify (needs verification): DebugView with a dev client launched via `xcrun simctl launch booted com.airraman.deepwork -FIRAnalyticsDebugEnabled`. Confirm the bundle id of the dev client you install first.
- [!] Pre-existing, not changed: `dw_session_start` still sends the user-typed `activity_name` (free text) to GA4. Decide whether to replace it with an activity id. That would change an existing event, so it's left alone.

## 3c. Email (Resend)

Foundation only: consent, unsubscribe, and bounce/complaint suppression. **No campaign is wired up or activated.** Don't activate any marketing send without explicit approval.

Consent model: `users/{uid}/preferences/email` has `marketingConsent: "granted" | "denied"`. A missing value means no consent; an email address is never consent. Users opt in via Settings → Notifications → Product emails. Marketing mail goes only through `sendPolicyEmail` (`functions/email.js`), which checks consent and suppression and adds `List-Unsubscribe` + `List-Unsubscribe-Post`. Transactional mail skips the consent check but not suppression.

- [x] Existing secret `RESEND_API_KEY` (version 1, enabled). No change.
- [ ] `firebase functions:secrets:set EMAIL_UNSUBSCRIBE_SECRET --project deepwork-8416f`: creates the signing key for unsubscribe links. Enter a long random value when prompted; never put it in the repo. Approval required. **Never rotate it casually:** rotating breaks every unsubscribe link already sent.
- [ ] Resend dashboard → Webhooks → add endpoint `https://us-central1-deepwork-8416f.cloudfunctions.net/resendWebhook` with events `email.bounced` and `email.complained`, then copy its signing secret (`whsec_…`)
- [ ] `firebase functions:secrets:set RESEND_WEBHOOK_SECRET --project deepwork-8416f`: paste that signing secret (approval required)
- [ ] Deploy `resendWebhook` and `emailUnsubscribe` (section 2)
- [ ] Verify (needs verification): send a test bounce from the Resend dashboard and confirm one doc appears in `email_suppressions`. Resend's exact bounce payload fields aren't confirmed yet; the handler suppresses every bounce not marked `Transient`/`soft`.
- [ ] Domain: confirm `lucid-app.io` shows SPF, DKIM and DMARC verified in Resend (Domains page)
- [!] Postal address: every marketing email must include a physical mailing address (CAN-SPAM). Decide the address and how it's supplied before the first campaign. The welcome-back template requires it and throws without it.
- [!] **The Chrome welcome email is live and unchanged.** It's promotional, sent automatically when a `users/{uid}` doc is created, with no unsubscribe link and no consent check. Decide whether to treat it as onboarding (transactional) or route it through `sendPolicyEmail` as marketing. Not changed, per the instruction to preserve it.
- [!] `syncEmailToMailchimp` is deployed (Firestore create trigger) but its source isn't in this repo and it has no recent logs. Find its source and confirm Mailchimp respects `marketingConsent` before any Mailchimp campaign.
- Re-engagement template ready but unused: `welcomeBackEmail()` in `functions/emailTemplates.js`

## 4. iOS binary (required before any OTA from this code)

The working tree adds native modules that build 48 doesn't have: Google Sign-In, Apple Authentication, Expo Crypto. It also has widget and entitlement changes.

- [x] `runtimeVersion` bumped to `1.0.11` (`app.config.js` and both `Supporting/Expo.plist` files). No EAS build or update uses 1.0.11, so new OTAs can't reach build 48.
- [x] Versions standardized to **1.0.13 / build 51** for the app target, the widget target and `app.config.js`. Builds 49 and 50 of 1.0.13 were already uploaded to App Store Connect from Xcode (Sept 21 and 28), so 51 is the next free number. `ios/` is checked in and `appVersionSource` is local, so the Xcode values ship.
- [x] Widget restored: the Live Activity and Control widget are registered again (as in build 48); the Focus button and Lock Screen widget open `lucid://start-focus`; all temporary diagnostics removed. The scheme's Run action is back to Debug (Archive was always Release).
- [ ] `aps-environment` in the entitlements file is `development`; App Store export takes it from the distribution profile. Both App Store profiles for `com.airraman.deepwork` on this Mac have `production`. **After the build:** download the IPA and run `codesign -d --entitlements :- Payload/*.app` and confirm `aps-environment` is `production` and `com.apple.developer.applesignin` is present.
- [ ] Consolidated local dev-client build, `npx expo run:ios` (approval required; local only, nothing published). Use it for all deferred visual checks, starting with the Home progress line.
- [ ] `eas build --platform ios --profile production` — new production binary (approval required)
- [ ] Test on TestFlight using the checklist in section 6
- [ ] `eas submit --platform ios --profile production --latest` — submits to App Store review (approval required)

## 5. OTA (EAS Update)

Only after the new binary is live, and only to its runtime.

- [ ] `eas build:list --platform ios --profile production --limit 1 --json --non-interactive` — get the live build ID and runtime
- [ ] `eas fingerprint:compare --build-id <live build id>` — **must report no native differences** before publishing
- [ ] `eas update --channel production --platform ios --message "<sprint summary>"` — publishes the JS (approval required)
- [ ] `eas update:list --branch production --limit 3 --non-interactive` — confirm the update and its runtime

**Never publish this working tree to runtime `1.0.10` / build 48.**

## 6. Final production checks

- [ ] App launches; sign-in works with Apple, Google and anonymous
- [ ] Focus session start, pause, complete; the session-end alert fires with sound
- [ ] Premium state and paywall gates unchanged: 45 min, Focus Lock, quick restart
- [ ] Fresh install: `fcm_tokens/{uid}` has `timezone`; `users/{uid}/preferences/notifications` exists
- [ ] Sign out, then sign in as another account: the token moves to the new uid
- [ ] Morning push arrives at about 9 am local; no second push the same day; none after a completed session
- [ ] 7 pm streak reminder only appears for streaks of 2+ days
- [ ] Monday weekly summary arrives (iOS-only test account)
- [ ] Chrome extension still reflects session start and stop
- [ ] GA4 DebugView: `dw_session_start` and `session_complete` still fire, once each per session
- [ ] GA4 DebugView: `home_progress_viewed` once per Home visit; `session_summary_viewed` once per summary; `session_start_another_tapped` only on tap; `notification_opened` once per tap (background, quit and local), never on a foreground receipt; user id is set and `internal_user` is `true` on a dev build
- [ ] Home progress line: new account shows "A small start counts."; after a session, "Today: 1 session · …"; free and premium accounts both see it; no overflow on iPhone SE
- [ ] Session summary: "BUILD ON IT" shows the real week count; Next step only when written; Done still goes to Metrics; Start another opens Home with activity, duration and music selected and does **not** start until Begin; no "Quick restart?" modal on arrival; free account still hits the 45-min and Focus Lock gates
- [ ] Quick restart: free account gets one restart per day shared across Home's modal, Start another **and** same-day quick-start defaults; when out, the next attempt shows the quick_restart paywall (copy: "Upgrade for 2 quick restarts a day.") and records nothing; "Set up manually" opens an empty Home with no second paywall; premium gets 2/day, then a "Quick restarts used" notice (no paywall); the counter resets the next (UTC) day
- [ ] Quick-start defaults: the day's first session pre-fills the last session for free and premium alike and consumes nothing; after a free user's 2nd session of the day, returning to Home shows the paywall with empty fields; changing any pre-filled field before Begin consumes nothing
- [ ] Streak modal: an account with no sessions in the last 7 days never sees it; after completing one, it appears once that day with that day filled
- [ ] Quick-start defaults: new account has 5 min + first activity + No music selected; returning account has its last session's settings; account idle 7+ days has 5 min; free account whose last session was 45 min gets 30; every field still editable; nothing starts until Begin
- [ ] Notification preferences: each toggle survives an app restart and shows the same on a second device; turning Come-back reminders off stops `re_engagement` pushes; Daily off stops the morning push and the 7 pm note; Weekly recap off skips the Monday push; with iOS notifications off, the notice and Open Settings link appear; session-complete alerts still fire with everything off
- [ ] Email: the Product emails toggle is off for a new account, saves on and off, and shows the same on a second device; a test unsubscribe link's GET shows a confirm page and changes nothing; POST sets consent to `denied`; a test bounce creates one `email_suppressions` doc; the Chrome welcome email still sends for a new Chrome sign-up
- [ ] Chrome link: a Chrome-first account shows Linked; a mobile-first account shows Not linked yet until one Chrome session, then Linked; airplane mode shows Couldn't check (never Not linked); an anonymous account shows Needs an account; Send link opens the share sheet; Chrome sign-in and phone↔laptop session sync behave exactly as before

## 7. Completed work by sprint (local only)

All ten phases are implemented and tested locally. None is deployed or published. Every client change is JS only (OTA-eligible), but **blocked from runtime `1.0.10` / build 48** until the new binary (section 4). On-device and visual checks are deferred to the consolidated dev-client build (section 4) and listed in section 6. The sprint grouping is by theme; full details are in `SPRINT_COMPLETION_SUMMARY.json`.

### Sprint 1: Core activation and experience

| Status | Phase | Cloud step | Tests |
| --- | --- | --- | --- |
| [x] | Home progress line (P0): `homeProgress.js`, `HomeScreen.js` | None | 20/20 |
| [x] | Session summary "Build on it" + Start another (P0): `SessionSummaryScreen.js`, `sessionService.js`, `sessionPrefill.js` | None | 7/7 + recap cases |
| [x] | WeeklyStreakModal suppression (P1): `weeklyActivity.js` | None | 10/10 |
| [x] | Quick-start defaults (P1): `sessionDefaults.js` | None | 18/18 |
| [x] | Fix: one quick-restart rule (`quickRestartPolicy.js`, `monetizationService.checkQuickRestart`) for Home's modal, Start another and same-day quick-start defaults: free 1/day, premium 2/day; paywall copy updated | None | 18/18 |
| [x] | Analytics instrumentation (P1): `analyticsEvents.js`, `analyticsInternalUsers.js` | GA4 console (section 3b) | 11/11 |

### Sprint 2: Retention and personalization

| Status | Phase | Cloud step | Tests |
| --- | --- | --- | --- |
| [x] | Morning activation notifications (P0): `functions/morningActivation.js` | `dailyRemindersBatch` | 26/26 |
| [x] | Notification gaps (P0): authenticated `registerToken`, new `unregisterToken`, 7 pm streak rules, weekly audience | `registerToken`, `unregisterToken`, `weeklySummaryBatch` | 13 + 10 + 9 |
| [x] | Notification preferences (P1): three opt-out toggles in Settings | `dailyRemindersBatch` | 7/7 |

### Sprint 3: Re-engagement and ecosystem

| Status | Phase | Cloud step | Tests |
| --- | --- | --- | --- |
| [x] | Email foundation (P1): consent, unsubscribe, suppression, template; no campaign | `emailUnsubscribe`, `resendWebhook`, two secrets (section 3c) | 27/27 |
| [x] | Lucid for Chrome link status (P2): read-only, existing signals | None; no extension release | 10/10 |

### Not built (from the original plan)

- Local-date session keys (`deepWorkStore` stores UTC dates) with a possible data migration
- Moving notification permission prompts to the first session
- Chrome-connected-but-inactive push and the extension change to write `platforms.chrome` on every sign-in (needs a Web Store release)
- Welcome-back email campaign (template ready; activation needs approval)

## 8. Master execution checklist (in order)

Each line depends on the ones above it unless marked *independent*. Every deploy, build, submit and publish needs your explicit approval.

1. [!] Check App Store Connect crash reports for build 48 since 2026-10-11. The Oct 11 OTA may have shipped sign-in code build 48 can't run.
2. [x] `runtimeVersion` 1.0.11, versions 1.0.13 / 51, widget restored (section 4). Confirm `aps-environment` on the built IPA
3. [!] Check the live Firestore rules against section 3 (don't deploy the repo file)
4. [ ] Add production uids to `src/config/analyticsInternalUsers.js` (section 3b)
5. [ ] Commit the working tree (your step; nothing here commits for you)
6. [ ] Consolidated local dev-client build: `npx expo run:ios`. Run every on-device check in section 6 that doesn't need production.
7. [ ] *Independent:* deploy `dailyRemindersBatch`, `weeklySummaryBatch` and `unregisterToken` (section 2). They send nothing new until updated apps register a timezone.
8. [ ] *Independent:* email setup: `EMAIL_UNSUBSCRIBE_SECRET`, Resend webhook, `RESEND_WEBHOOK_SECRET`, then deploy `resendWebhook` and `emailUnsubscribe` (section 3c)
9. [ ] *Independent:* GA4 custom definitions and the `internal_user` filter (section 3b)
10. [ ] `eas build --platform ios --profile production`, test on TestFlight with section 6, then `eas submit --platform ios --profile production --latest` (section 4)
11. [ ] After the new binary is live: deploy `registerToken` (section 2)
12. [ ] Later JS-only fixes: `eas fingerprint:compare --build-id <new build id>` must be clean, then `eas update --channel production --platform ios --message "…"` (section 5)
13. [ ] Production checks (section 6) and the function logs in section 2
14. [!] Before any marketing email: postal address, Chrome welcome email classification, `syncEmailToMailchimp` consent (section 3c)
