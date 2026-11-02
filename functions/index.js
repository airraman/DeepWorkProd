// functions/index.js - Cloud Functions for DeepWork re-engagement notifications
//
// PHASE 3: triggerSessionEndNotification removed. Session completion is no
// longer routed through Firebase — the OS-scheduled local notification fires
// reliably at endTime regardless of network or JS state. Firebase is now
// scoped exclusively to re-engagement (dailyRemindersBatch, weeklySummaryBatch)
// and FCM token registration (registerToken). The onCall import was only used
// by the deleted function and has been removed.
const {onRequest} = require("firebase-functions/v2/https");
const {onSchedule} = require("firebase-functions/v2/scheduler");
const {
  onDocumentCreated,
  onDocumentUpdated,
} = require("firebase-functions/v2/firestore");

const {
  resendApiKey,
  sendEmail,
} = require("./emailService");
const admin = require("firebase-admin");
const {
  localDateLabel,
  localHour,
  resolveTimezone,
  resolveSchedule,
  isDailyReminderEnabled,
  isReengagementEnabled,
  isWeeklySummaryEnabled,
  classifySegment,
  buildMorningActivationMessage,
  isUnansweredCapReached,
  nextUnansweredCount,
  isInvalidTokenError,
} = require("./morningActivation");
const {
  registerPushToken,
  unregisterPushToken,
} = require("./pushTokens");
const {defineSecret} = require("firebase-functions/params");
const {
  handleUnsubscribe,
  handleResendWebhook,
} = require("./email");

// Initialize Firebase Admin SDK
admin.initializeApp();

/**
 * Sends the Chrome extension invitation when a new user profile
 * is created in Firestore.
 */
exports.sendChromeExtensionWelcomeEmail = onDocumentCreated(
  {
    document: "users/{userId}",
    secrets: [resendApiKey],
  },
  async (event) => {
    const userId = event.params.userId;

    try {
      const userRecord = await admin.auth().getUser(userId);
      const email = userRecord.email;

      if (!email) {
        console.warn(
            `No email found for new user ${userId}; skipping welcome email.`,
        );
        return;
      }

      await sendEmail({
        to: email,
        subject: "Get more out of Lucid with the Chrome extension",
        html: `
          <h1>Stay focused wherever you work.</h1>
          <p>
            Your Lucid account is ready. You can also use Lucid in Chrome
            to block distracting websites and keep your focus sessions
            connected across devices.
          </p>
          <p>
            <a href="https://chromewebstore.google.com/detail/lucid-%E2%80%93-creative-focus/kjhmjfnodmankioppjmblompjlnoldfo">
              Download the Lucid Chrome extension
            </a>
          </p>
          <p>
            Once you sign in with the same Lucid account, your extension
            will connect automatically.
          </p>
          <p>— Lucid</p>
        `,
      });

      await admin.firestore().collection("users").doc(userId).set({
        chromeExtension: {
          inviteSent: true,
          inviteSentAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      }, {merge: true});

      console.log(
          `Chrome extension welcome email sent to ${email} for ${userId}`,
      );
    } catch (error) {
      console.error(
          `Failed to send Chrome extension welcome email for ${userId}:`,
          error,
      );
      throw error;
    }
  },
);

/**
 * ============================================================================
 * DAILY MORNING ACTIVATION (Scheduled - Hourly Batch)
 * ============================================================================
 *
 * WHEN: Every hour; each user is evaluated only at their local reminder hour
 *   (dailyReminder.time, default 09:00).
 * WHO: Everyone with a registered FCM token whose token doc id is a real
 *   Firebase Auth uid. Iterates fcm_tokens, not users: only the Chrome
 *   extension ever creates users/{uid} root docs, so iterating users skipped
 *   every iOS-only user.
 * WHAT (at most one push per user per local day, in priority order):
 *   1. Behavior-based re-engagement (lapsed 3+ days / never started), with
 *      its own cooldown and caps — see evaluateReengagement below. Only if
 *      `reengagement` isn't false (default on).
 *   2. Otherwise, a morning activation push for anyone who hasn't completed
 *      a session yet today, with copy chosen from their real history
 *      (new / active / consistent / returning — morningActivation.js). Only
 *      if `dailyReminder.enabled` isn't false (opt-out, default on).
 * SKIP: no valid timezone (never fall back to UTC), both categories off,
 *   an active/paused session, a session already completed
 *   today, a push already sent today, or 3 daily pushes in a row with no
 *   session in between (resets once the user completes a session).
 * INVALID TOKENS: deleted from fcm_tokens; the app re-registers on launch.
 */
exports.dailyRemindersBatch = onSchedule(
    {
      schedule: "0 * * * *", // Every hour at :00
      timeZone: "UTC",
    },
    async (event) => {
      console.log("⏰ Starting hourly morning activation batch...");

      const counts = {sent: 0, reengagement: 0, skipped: 0, errors: 0};

      try {
        const tokensSnapshot = await admin.firestore()
            .collection("fcm_tokens")
            .get();

        const sendPromises = tokensSnapshot.docs.map(async (tokenDoc) => {
          const userId = tokenDoc.id;
          try {
            const outcome =
                await processDailyActivation(userId, tokenDoc.data());
            if (outcome === "activation") counts.sent++;
            else if (outcome === "reengagement") counts.reengagement++;
            else counts.skipped++;
          } catch (error) {
            counts.errors++;
            if (isInvalidTokenError(error)) {
              console.warn(`🧹 Invalid FCM token for ${userId} — removing`);
              await admin.firestore().collection("fcm_tokens").doc(userId)
                  .delete().catch(() => {});
            } else {
              console.error(`❌ Error for user ${userId}:`, error);
            }
          }
        });

        await Promise.all(sendPromises);

        console.log(`
📊 Morning activation batch complete:
   ✅ Activation sent: ${counts.sent}
   🔁 Re-engagement sent: ${counts.reengagement}
   ⏭️  Skipped / not their hour: ${counts.skipped}
   ❌ Errors: ${counts.errors}
        `);

        return {success: true, ...counts};
      } catch (error) {
        console.error("❌ Morning activation batch failed:", error);
        throw error;
      }
    });

/**
 * Evaluate and (maybe) send one user's daily push. Returns what was sent:
 * "activation", "reengagement", or a skip reason string.
 *
 * @param {string} userId fcm_tokens doc id
 * @param {object} tokenData fcm_tokens doc data
 * @return {Promise<string>}
 */
async function processDailyActivation(userId, tokenData) {
  const nowMs = Date.now();
  const userRef = admin.firestore().collection("users").doc(userId);

  const prefsDoc = await userRef
      .collection("preferences").doc("notifications").get();
  const prefs = prefsDoc.exists ? prefsDoc.data() : null;

  // Two independently controlled categories share this hourly slot.
  const dailyOn = isDailyReminderEnabled(prefs);
  const reengagementOn = isReengagementEnabled(prefs);
  if (!dailyOn && !reengagementOn) return "disabled";

  const schedule = resolveSchedule(prefs, tokenData);
  if (!schedule) return "no_timezone";
  const {timezone, reminderHour} = schedule;

  if (localHour(nowMs, timezone) !== reminderHour) return "not_their_hour";

  if (!tokenData?.token) return "no_token";

  // Token docs keyed by a device id (registered before auth was ready) can
  // never be matched to sessions — skip rather than guess.
  try {
    await admin.auth().getUser(userId);
  } catch (error) {
    return "not_an_auth_user";
  }

  const todayLabel = localDateLabel(nowMs, timezone);
  const stateRef = userRef
      .collection("notificationState").doc("dailyActivation");
  const stateDoc = await stateRef.get();
  const state = stateDoc.exists ? stateDoc.data() : {};
  if (state.lastSentDate === todayLabel) return "already_sent_today";

  if (await isSessionCurrentlyBlocking(userId)) return "session_active";

  const sessionsSnap = await userRef.collection("sessions")
      .orderBy("timestamp", "desc")
      .limit(REENGAGEMENT_SESSION_HISTORY_LIMIT)
      .get();
  const sessionTimestamps = sessionsSnap.docs
      .map((d) => d.data().timestamp)
      .filter((t) => typeof t === "number");
  const lastSessionMs = sessionTimestamps.length ?
    Math.max(...sessionTimestamps) : null;

  // "Today" is the user's local calendar day — compared by timestamp, not
  // the session's stored `date`, which the app derives from UTC.
  if (lastSessionMs !== null &&
      localDateLabel(lastSessionMs, timezone) === todayLabel) {
    return "completed_today";
  }

  if (isUnansweredCapReached(state, lastSessionMs)) return "unanswered_cap";

  // Claim today's slot before sending, so an overlapping run (e.g. a DST
  // repeated hour) can't send a second push the same local day.
  const claimed = await admin.firestore().runTransaction(async (tx) => {
    const fresh = await tx.get(stateRef);
    if (fresh.exists && fresh.data().lastSentDate === todayLabel) return false;
    tx.set(stateRef, {
      lastSentDate: todayLabel,
      lastSentAtMs: nowMs,
      consecutiveUnanswered: nextUnansweredCount(state, lastSessionMs),
      lastEvaluatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});
    return true;
  });
  if (!claimed) return "already_sent_today";

  // Lapsed users get the existing re-engagement message instead, under its
  // own cooldown and caps. If it's blocked or turned off, fall through to
  // activation — if daily reminders are on.
  if (reengagementOn) {
    const reengagementDecision = await evaluateReengagement(userId, timezone);
    if (reengagementDecision &&
        await trySendReengagement(userId, reengagementDecision, timezone)) {
      await stateRef.set(
          {lastType: `reengagement:${reengagementDecision.type}`},
          {merge: true});
      return "reengagement";
    }
  }

  if (!dailyOn) {
    // Nothing was sent: release today's claim, so the app's 7 pm check and
    // the unanswered counter don't treat this as a sent push.
    await stateRef.set({
      lastSentDate: state.lastSentDate ?? null,
      lastSentAtMs: state.lastSentAtMs ?? null,
      consecutiveUnanswered: state.consecutiveUnanswered ?? 0,
    }, {merge: true});
    return "daily_reminders_off";
  }

  const classification = classifySegment(sessionTimestamps, nowMs, timezone);
  const message = buildMorningActivationMessage(classification);

  await admin.messaging().send({
    token: tokenData.token,
    notification: {title: message.title, body: message.body},
    data: {
      type: "morning_activation",
      segment: classification.segment,
    },
    apns: {
      payload: {
        aps: {
          sound: "default",
        },
      },
    },
  });

  await stateRef.set(
      {lastType: `activation:${classification.segment}`}, {merge: true});
  console.log(
      `✅ Morning activation (${classification.segment}) sent to: ${userId}`);
  return "activation";
}

/**
 * ============================================================================
 * WEEKLY PERFORMANCE (Scheduled - Monday 9 AM local time)
 * ============================================================================
 *
 * WHEN: Every Monday at 9:00 AM in each user's local timezone
 * WHO: Everyone with an fcm_tokens doc keyed by a real Auth uid, a known
 *   timezone, and weeklySummary not explicitly false (no prefs doc = on)
 * CONTENT: Previous completed week vs. the week before it — sessions, focused
 *   minutes, and streak — with a tap target that opens Metrics -> Analytics.
 *
 * Replaces the old weeklySummaryBatch. That version read from
 * users/{uid}/weekly_aggregates, a collection nothing in this codebase ever
 * writes to — it silently never sent a real notification. This version reads
 * directly from users/{uid}/sessions (written by every completed session via
 * firestoreSessionService.saveSessionToFirestore), the one collection that
 * actually has data.
 *
 * NEVER sent while the user has an active/paused DeepWork session — checked
 * against users/{uid}/activeSession/current, the same doc the Chrome bridge
 * uses. If a session is running at 9 AM, delivery is deferred until it ends
 * (see deliverDeferredWeeklyNotification below) rather than skipped outright.
 *
 * Sends even when the user had zero sessions last week — the report is about
 * the previous completed week regardless of activity level; it is never
 * suppressed for that reason.
 */
exports.weeklySummaryBatch = onSchedule(
    {
      schedule: "0 * * * 1", // Every hour on Mondays — matched against each user's local 9 AM below
      timeZone: "UTC",
    },
    async (event) => {
      console.log("📊 Starting weekly performance batch...");

      try {
        // Audience = everyone with a registered push token, as in
        // dailyRemindersBatch. Iterating users skipped every iOS-only user:
        // only the Chrome extension ever creates users/{uid} root docs.
        const tokensSnapshot = await admin.firestore()
            .collection("fcm_tokens")
            .get();

        let sentCount = 0;
        let deferredCount = 0;
        let skippedCount = 0;

        const sendPromises = tokensSnapshot.docs.map(async (tokenDoc) => {
          const userId = tokenDoc.id;

          try {
            const prefsDoc = await admin.firestore()
                .collection("users")
                .doc(userId)
                .collection("preferences")
                .doc("notifications")
                .get();

            // A missing prefs doc means the app's defaults (weekly summary
            // on); only an explicit weeklySummary === false opts out.
            const prefs = prefsDoc.exists ? prefsDoc.data() : null;
            if (!isWeeklySummaryEnabled(prefs)) {
              skippedCount++;
              return;
            }

            // Never fall back to UTC: 9 AM UTC is the middle of the night
            // for most users.
            const timezone = resolveTimezone(prefs, tokenDoc.data());
            if (!timezone) {
              skippedCount++;
              return;
            }

            if (localHour(Date.now(), timezone) !== 9) {
              return; // Not 9 AM yet in their timezone
            }

            // Token docs keyed by a device id can't be matched to sessions.
            try {
              await admin.auth().getUser(userId);
            } catch (authError) {
              skippedCount++;
              return;
            }

            const {startMs: prevStart, endMs: prevEnd, weekStartLabel} =
                getLocalWeekBoundaries(timezone, 1);
            const {startMs: compStart, endMs: compEnd} =
                getLocalWeekBoundaries(timezone, 2);

            // Idempotency — never send twice for the same user/week, even if
            // this hourly cron matches 9 AM more than once (DST edge cases)
            // or races with the deferred-delivery trigger below.
            const markerRef = admin.firestore()
                .collection("users").doc(userId)
                .collection("weeklyPerformanceNotifications").doc(weekStartLabel);
            const markerDoc = await markerRef.get();
            if (markerDoc.exists) {
              skippedCount++;
              return;
            }

            // Active-session deferral — never interrupt a running session.
            const activeSessionDoc = await admin.firestore()
                .collection("users").doc(userId)
                .collection("activeSession").doc("current")
                .get();

            if (activeSessionDoc.exists) {
              const active = activeSessionDoc.data();
              // Paused sessions can resume at any moment — treat them as
              // still blocking regardless of the (possibly stale) endsAt.
              // Running sessions block only while endsAt hasn't passed yet;
              // this also protects against a bridge doc left stale forever
              // by an app that was killed without going through cleanup().
              const stillBlocking = active.isActive === true && (
                active.isPaused === true ||
                (typeof active.endsAt === "number" && active.endsAt > Date.now())
              );

              if (stillBlocking) {
                await admin.firestore()
                    .collection("users").doc(userId)
                    .collection("pendingWeeklyNotification").doc("current")
                    .set({
                      weekStartLabel,
                      prevStart, prevEnd, compStart, compEnd,
                      timezone,
                      queuedAt: admin.firestore.FieldValue.serverTimestamp(),
                    });
                console.log(`⏸️  Deferring weekly performance notification for ${userId} — session in progress`);
                deferredCount++;
                return;
              }
            }

            const sent = await sendWeeklyPerformanceNotification(userId, {
              weekStartLabel, prevStart, prevEnd, compStart, compEnd, timezone,
            });
            if (sent) {
              sentCount++;
            } else {
              skippedCount++;
            }
          } catch (error) {
            console.error(`❌ Error for user ${userId}:`, error);
            skippedCount++;
          }
        });

        await Promise.all(sendPromises);

        console.log(`
📊 Weekly performance batch complete:
   ✅ Sent: ${sentCount}
   ⏸️  Deferred (active session): ${deferredCount}
   ⏭️  Skipped: ${skippedCount}
        `);

        return {success: true, sent: sentCount, deferred: deferredCount, skipped: skippedCount};
      } catch (error) {
        console.error("❌ Weekly performance batch failed:", error);
        throw error;
      }
    });

/**
 * ============================================================================
 * DEFERRED WEEKLY PERFORMANCE DELIVERY
 * ============================================================================
 *
 * Fires whenever users/{uid}/activeSession/current transitions isActive
 * true -> false (session completed, cancelled, or abandoned via cleanup()).
 * If a weekly performance notification was queued because that session was
 * running at 9 AM Monday, deliver it now — as soon as practical after the
 * session ends, rather than losing it.
 */
exports.deliverDeferredWeeklyNotification = onDocumentUpdated(
    "users/{userId}/activeSession/current",
    async (event) => {
      const before = event.data.before.data();
      const after = event.data.after.data();

      if (!(before?.isActive === true && after?.isActive === false)) {
        return;
      }

      const {userId} = event.params;

      const pendingRef = admin.firestore()
          .collection("users").doc(userId)
          .collection("pendingWeeklyNotification").doc("current");
      const pendingDoc = await pendingRef.get();
      if (!pendingDoc.exists) return;

      const ctx = pendingDoc.data();

      const markerDoc = await admin.firestore()
          .collection("users").doc(userId)
          .collection("weeklyPerformanceNotifications").doc(ctx.weekStartLabel)
          .get();
      if (markerDoc.exists) {
        // Already sent by another path — just clear the queue.
        await pendingRef.delete();
        return;
      }

      try {
        await sendWeeklyPerformanceNotification(userId, ctx);
        console.log(`✅ Deferred weekly performance notification delivered to: ${userId}`);
      } finally {
        await pendingRef.delete();
      }
    });

/**
 * ============================================================================
 * HTTP ENDPOINTS: Register / Unregister FCM Token
 * ============================================================================
 *
 * Both require `Authorization: Bearer <Firebase ID token>`; the uid comes
 * from that token, never the request body (see pushTokens.js). Called from
 * the app on launch, sign-in and token refresh (register) and just before
 * sign-out (unregister). Older app versions that don't send the header get
 * 401 and keep whatever token doc they already have.
 */
const handleTokenRequest = (handler) => async (req, res) => {
  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    return res.status(204).send("");
  }
  if (req.method !== "POST") {
    return res.status(405).send({error: "Method not allowed"});
  }

  try {
    const result = await handler(admin, {
      authorization: req.get("Authorization"),
      body: req.body,
    });
    return res.status(result.status).send(result.body);
  } catch (error) {
    console.error("❌ FCM token request failed:", error);
    return res.status(500).send({error: "Token request failed"});
  }
};

exports.registerToken = onRequest(
    {cors: true},
    handleTokenRequest(registerPushToken),
);

exports.unregisterToken = onRequest(
    {cors: true},
    handleTokenRequest(unregisterPushToken),
);

/**
 * ============================================================================
 * EMAIL: unsubscribe + Resend bounce/complaint webhook
 * ============================================================================
 *
 * Foundation only — no campaign sends from here (see email.js). Each uses
 * its own secret:
 *   EMAIL_UNSUBSCRIBE_SECRET  signs unsubscribe links (any long random value)
 *   RESEND_WEBHOOK_SECRET     the "whsec_..." signing secret of the Resend
 *                             webhook pointed at resendWebhook
 */
const emailUnsubscribeSecret = defineSecret("EMAIL_UNSUBSCRIBE_SECRET");
const resendWebhookSecret = defineSecret("RESEND_WEBHOOK_SECRET");

exports.emailUnsubscribe = onRequest(
    {secrets: [emailUnsubscribeSecret]},
    async (req, res) => {
      try {
        const result = await handleUnsubscribe(admin, {
          method: req.method,
          query: req.query,
          body: req.body,
          secret: emailUnsubscribeSecret.value(),
        });
        res.set("Content-Type", result.contentType);
        return res.status(result.status).send(result.body);
      } catch (error) {
        console.error("❌ Unsubscribe failed:", error);
        return res.status(500).send("Something went wrong. Please try again.");
      }
    },
);

exports.resendWebhook = onRequest(
    {secrets: [resendWebhookSecret]},
    async (req, res) => {
      if (req.method !== "POST") {
        return res.status(405).send({error: "Method not allowed"});
      }
      try {
        const result = await handleResendWebhook(admin, {
          headers: req.headers,
          rawBody: req.rawBody,
          secret: resendWebhookSecret.value(),
        });
        return res.status(result.status).send(result.body);
      } catch (error) {
        console.error("❌ Resend webhook failed:", error);
        // 5xx makes Svix retry, which is what we want for a transient failure.
        return res.status(500).send({error: "Webhook handling failed"});
      }
    },
);

/**
 * ============================================================================
 * HELPER FUNCTIONS
 * ============================================================================
 */

/**
 * ============================================================================
 * WEEKLY PERFORMANCE HELPERS
 * ============================================================================
 */

/**
 * Convert a local calendar date+time in `timezone` to a UTC epoch ms value,
 * without relying on the Cloud Functions container's own local timezone
 * (which is not the user's timezone). Handles DST correctly by measuring the
 * target timezone's actual offset at that instant.
 */
function localDateToUtcMs(y, m, d, hh, mm, ss, timezone) {
  const naiveUtc = Date.UTC(y, m - 1, d, hh, mm, ss);
  const asIfUtc = new Date(naiveUtc);

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    hour12: false,
  }).formatToParts(asIfUtc);

  const map = {};
  parts.forEach((p) => { map[p.type] = p.value; });
  // Some ICU implementations render midnight as "24" under hour12: false.
  const hour = parseInt(map.hour, 10) === 24 ? 0 : parseInt(map.hour, 10);

  const tzAsUtcMs = Date.UTC(
      parseInt(map.year, 10), parseInt(map.month, 10) - 1, parseInt(map.day, 10),
      hour, parseInt(map.minute, 10), parseInt(map.second, 10),
  );

  const offsetMs = tzAsUtcMs - naiveUtc;
  return naiveUtc - offsetMs;
}

/**
 * [start, end] epoch ms (inclusive) for the Monday-Sunday week `weeksAgo`
 * weeks before the current week, evaluated in the user's local timezone.
 * weeksAgo = 1 -> the most recently completed week; 2 -> the week before that.
 */
function getLocalWeekBoundaries(timezone, weeksAgo) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
  }).formatToParts(now);

  const map = {};
  parts.forEach((p) => { map[p.type] = p.value; });
  const localY = parseInt(map.year, 10);
  const localM = parseInt(map.month, 10);
  const localD = parseInt(map.day, 10);

  const weekdayIndex = {Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6}[map.weekday];
  const daysSinceMonday = weekdayIndex === 0 ? 6 : weekdayIndex - 1;
  const totalDaysBack = daysSinceMonday + (weeksAgo * 7);

  const mondayAnchor = new Date(Date.UTC(localY, localM - 1, localD));
  mondayAnchor.setUTCDate(mondayAnchor.getUTCDate() - totalDaysBack);
  const mondayY = mondayAnchor.getUTCFullYear();
  const mondayM = mondayAnchor.getUTCMonth() + 1;
  const mondayD = mondayAnchor.getUTCDate();

  const sundayAnchor = new Date(Date.UTC(mondayY, mondayM - 1, mondayD));
  sundayAnchor.setUTCDate(sundayAnchor.getUTCDate() + 6);

  const startMs = localDateToUtcMs(mondayY, mondayM, mondayD, 0, 0, 0, timezone);
  const endMs = localDateToUtcMs(
      sundayAnchor.getUTCFullYear(), sundayAnchor.getUTCMonth() + 1, sundayAnchor.getUTCDate(),
      23, 59, 59, timezone,
  );

  const weekStartLabel = `${mondayY}-${String(mondayM).padStart(2, "0")}-${String(mondayD).padStart(2, "0")}`;
  return {startMs, endMs, weekStartLabel};
}

/**
 * Real session totals for a user in [startMs, endMs], read from
 * users/{uid}/sessions — the collection every completed session actually
 * writes to (unlike weekly_aggregates, which nothing writes).
 */
async function getSessionStatsInRange(userId, startMs, endMs) {
  const snapshot = await admin.firestore()
      .collection("users").doc(userId)
      .collection("sessions")
      .where("timestamp", ">=", startMs)
      .where("timestamp", "<=", endMs)
      .get();

  let totalMinutes = 0;
  snapshot.docs.forEach((doc) => {
    const duration = doc.data().duration;
    if (typeof duration === "number") totalMinutes += duration;
  });

  const totalSessions = snapshot.size;
  const avgMinutes = totalSessions > 0 ? totalMinutes / totalSessions : 0;

  return {totalSessions, totalMinutes, avgMinutes};
}

function getLocalDateString(timezone, msOffset) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(Date.now() + msOffset));
  const map = {};
  parts.forEach((p) => { map[p.type] = p.value; });
  return `${map.year}-${map.month}-${map.day}`;
}

function shiftDateString(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Current consecutive-day streak, computed from real session dates in
 * users/{uid}/sessions (mirrors the client's streakService.js semantics:
 * still counts as live if the most recent active day was today or
 * yesterday). Real data only — returns 0 rather than fabricating anything
 * when there's no session history.
 */
async function computeCurrentStreak(userId, timezone) {
  const sixtyDaysAgoMs = Date.now() - 60 * 24 * 60 * 60 * 1000;
  const snapshot = await admin.firestore()
      .collection("users").doc(userId)
      .collection("sessions")
      .where("timestamp", ">=", sixtyDaysAgoMs)
      .get();

  const activeDates = new Set();
  snapshot.docs.forEach((doc) => {
    const date = doc.data().date;
    if (date) activeDates.add(date);
  });

  if (activeDates.size === 0) return 0;

  const today = getLocalDateString(timezone, 0);
  const yesterday = getLocalDateString(timezone, -24 * 60 * 60 * 1000);

  let cursor = activeDates.has(today) ? today : yesterday;
  if (!activeDates.has(cursor)) return 0;

  let streak = 0;
  while (activeDates.has(cursor)) {
    streak++;
    cursor = shiftDateString(cursor, -1);
  }
  return streak;
}

function formatDuration(totalMinutes) {
  const mins = Math.round(totalMinutes);
  const hours = Math.floor(mins / 60);
  const remainder = mins % 60;
  if (hours > 0 && remainder > 0) return `${hours}h ${remainder}m`;
  if (hours > 0) return `${hours}h`;
  return `${remainder}m`;
}

/**
 * Build the weekly performance title/body.
 * - Previous week had zero sessions: always sent (never suppressed), framed
 *   as a fresh start rather than a decline.
 * - Comparison week had zero sessions: no percentage (would be meaningless/
 *   divide-by-zero) — absolute language instead.
 * - Otherwise: percentage for improvement, plain counts for decline (honest,
 *   not softened into a misleading percentage), "same as" for no change.
 * Streak is appended only when >= 2 (a 1-day "streak" isn't meaningful) and
 * never replaces the core comparison.
 */
function buildWeeklyPerformanceMessage(prev, comp, streak) {
  const streakSuffix = streak >= 2 ? ` You're on a ${streak}-day streak.` : "";

  if (prev.totalSessions === 0) {
    return {
      title: "A fresh week starts now 🧠",
      body: "You didn't log a focus session last week. Start with a few this week and build your momentum.",
    };
  }

  const prevTimeLabel = formatDuration(prev.totalMinutes);
  const sessionWord = prev.totalSessions === 1 ? "session" : "sessions";

  if (comp.totalSessions === 0) {
    return {
      title: "Your week in focus 📈",
      body: `You logged ${prev.totalSessions} ${sessionWord} and ${prevTimeLabel} of focused work last week.${streakSuffix} See your full breakdown.`,
    };
  }

  const sessionDiff = prev.totalSessions - comp.totalSessions;

  if (sessionDiff > 0) {
    const pctChange = Math.round((sessionDiff / comp.totalSessions) * 100);
    return {
      title: "Your week in focus 📈",
      body: `You logged ${prev.totalSessions} sessions last week — up ${pctChange}% from the week before.${streakSuffix} See what changed.`,
    };
  }

  if (sessionDiff < 0) {
    return {
      title: "Your week in focus",
      body: `You logged ${prev.totalSessions} sessions last week, down from ${comp.totalSessions} the week before.${streakSuffix} See your trends and reset this week.`,
    };
  }

  return {
    title: "Your week in focus 🧠",
    body: `You logged ${prev.totalSessions} ${sessionWord} and ${prevTimeLabel} last week — same as the week before.${streakSuffix} See your full breakdown.`,
  };
}

/**
 * Compute stats, build the message, send via FCM, and write the
 * per-user/per-week idempotency marker. Shared by the on-time send path and
 * the deferred-delivery trigger so both paths behave identically.
 *
 * @return {Promise<boolean>} true if a notification was actually sent
 */
async function sendWeeklyPerformanceNotification(userId, ctx) {
  const {weekStartLabel, prevStart, prevEnd, compStart, compEnd, timezone} = ctx;

  const [prevStats, compStats, streak] = await Promise.all([
    getSessionStatsInRange(userId, prevStart, prevEnd),
    getSessionStatsInRange(userId, compStart, compEnd),
    computeCurrentStreak(userId, timezone),
  ]);

  const tokenDoc = await admin.firestore().collection("fcm_tokens").doc(userId).get();
  if (!tokenDoc.exists) {
    console.warn(`⚠️ No FCM token for user: ${userId}`);
    return false;
  }
  const fcmToken = tokenDoc.data().token;

  const message = buildWeeklyPerformanceMessage(prevStats, compStats, streak);

  await admin.messaging().send({
    token: fcmToken,
    notification: {title: message.title, body: message.body},
    data: {
      type: "weekly_performance",
      weekStart: weekStartLabel,
      prevSessions: String(prevStats.totalSessions),
      prevMinutes: String(Math.round(prevStats.totalMinutes)),
      prevAvgMinutes: String(Math.round(prevStats.avgMinutes)),
      compSessions: String(compStats.totalSessions),
      compMinutes: String(Math.round(compStats.totalMinutes)),
      compAvgMinutes: String(Math.round(compStats.avgMinutes)),
      streak: String(streak),
    },
    apns: {
      payload: {
        aps: {
          sound: "default",
          badge: 1,
        },
      },
    },
  });

  await admin.firestore()
      .collection("users").doc(userId)
      .collection("weeklyPerformanceNotifications").doc(weekStartLabel)
      .set({sentAt: admin.firestore.FieldValue.serverTimestamp()});

  console.log(`✅ Weekly performance notification sent to: ${userId}`);
  return true;
}

/**
 * ============================================================================
 * BEHAVIOR-BASED RE-ENGAGEMENT
 * ============================================================================
 *
 * Evaluated once per user, inside the existing dailyRemindersBatch hourly
 * pass, at the user's local reminder hour — no second scheduler. Priority
 * order (first match wins, at most one decision per evaluation):
 *
 *   currently_active > never_started > high_engagement_lapse >
 *   one_week_lapse > started_once_then_lapsed > no_notification_eligible
 *
 * All eligibility is computed from real Firestore records — users/{uid}/
 * sessions (the collection every completed session actually writes to) and
 * Firebase Auth's own account-creation metadata. No dead/never-written
 * fields (users/{uid}.currentStreak, weekly_aggregates, daily_aggregates)
 * are read here.
 */

const REENGAGEMENT_GLOBAL_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;
const REENGAGEMENT_WEEKLY_MAX = 2;
const REENGAGEMENT_NEVER_STARTED_MAX_NUDGES = 2;
const REENGAGEMENT_MIN_SIGNUP_AGE_MS = 24 * 60 * 60 * 1000;
const REENGAGEMENT_SESSION_HISTORY_LIMIT = 200; // bounded scan, not a full-history pipeline

/**
 * True if the user's active-session bridge doc indicates a session that
 * should currently suppress notifications. Same semantics as the weekly
 * performance deferral check: paused sessions always block (could resume any
 * moment, and endsAt isn't refreshed on pause so it can't be trusted while
 * paused); running sessions block only while endsAt hasn't passed yet, which
 * also protects against a bridge doc left stale by an app killed without
 * going through cleanup().
 */
async function isSessionCurrentlyBlocking(userId) {
  const activeDoc = await admin.firestore()
      .collection("users").doc(userId)
      .collection("activeSession").doc("current")
      .get();

  if (!activeDoc.exists) return false;

  const active = activeDoc.data();
  if (active.isActive !== true) return false;
  if (active.isPaused === true) return true;
  return typeof active.endsAt === "number" && active.endsAt > Date.now();
}

/**
 * Consecutive-day streak, rolling 7-day session volume, and distinct active
 * weeks — all derived from real session dates, used to decide whether a
 * lapsed user previously showed "meaningful engagement" worth calling out.
 */
function computeEngagementProfile(sessions) {
  const dateSet = new Set();
  const dateCounts = {};
  sessions.forEach((s) => {
    if (s.date) {
      dateSet.add(s.date);
      dateCounts[s.date] = (dateCounts[s.date] || 0) + 1;
    }
  });

  const sortedDates = Array.from(dateSet).sort();

  let maxStreak = 0;
  let currentStreak = 0;
  let prevDate = null;
  sortedDates.forEach((dateStr) => {
    currentStreak = (prevDate && shiftDateString(prevDate, 1) === dateStr) ? currentStreak + 1 : 1;
    maxStreak = Math.max(maxStreak, currentStreak);
    prevDate = dateStr;
  });

  let maxSevenDayCount = 0;
  for (let i = 0; i < sortedDates.length; i++) {
    const windowEndExclusive = shiftDateString(sortedDates[i], 7);
    let count = 0;
    for (let j = i; j < sortedDates.length && sortedDates[j] < windowEndExclusive; j++) {
      count += dateCounts[sortedDates[j]];
    }
    maxSevenDayCount = Math.max(maxSevenDayCount, count);
  }

  const weekStarts = new Set(sortedDates.map(mondayOfDateString));

  const hadMeaningfulEngagement =
      maxStreak >= 3 || maxSevenDayCount >= 3 || weekStarts.size >= 2;

  return {maxStreak, maxSevenDayCount, distinctActiveWeeks: weekStarts.size, hadMeaningfulEngagement};
}

function mondayOfDateString(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const weekday = dt.getUTCDay();
  const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;
  dt.setUTCDate(dt.getUTCDate() - daysSinceMonday);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Signed up but has never completed a session. Uses Firebase Auth's own
 * account-creation timestamp — no separate signup-tracking doc needed.
 */
async function evaluateNeverStarted(userId) {
  let userRecord;
  try {
    userRecord = await admin.auth().getUser(userId);
  } catch (error) {
    console.warn(`⚠️ Could not resolve auth record for ${userId} (never_started check):`, error.message);
    return null;
  }

  const createdMs = new Date(userRecord.metadata.creationTime).getTime();
  if (Date.now() - createdMs < REENGAGEMENT_MIN_SIGNUP_AGE_MS) return null;

  return {type: "never_started"};
}

/**
 * Full eligibility evaluation for one user, in priority order. Returns null
 * when no re-engagement notification is warranted (including: currently in
 * a session, or recent activity within the last 3 days).
 */
async function evaluateReengagement(userId, timezone) {
  if (await isSessionCurrentlyBlocking(userId)) return null;

  const sessionsSnap = await admin.firestore()
      .collection("users").doc(userId)
      .collection("sessions")
      .orderBy("timestamp", "desc")
      .limit(REENGAGEMENT_SESSION_HISTORY_LIMIT)
      .get();

  if (sessionsSnap.empty) {
    return evaluateNeverStarted(userId);
  }

  const sessions = sessionsSnap.docs.map((d) => d.data());
  const mostRecentTimestamp = sessions[0].timestamp;
  if (typeof mostRecentTimestamp !== "number") return null;

  const daysSinceLastSession = (Date.now() - mostRecentTimestamp) / (24 * 60 * 60 * 1000);

  // Recent activity (< 3 days) suppresses re-engagement entirely.
  if (daysSinceLastSession < 3) return null;

  const daysSinceLastSessionFloor = Math.floor(daysSinceLastSession);

  if (daysSinceLastSession >= 7) {
    const engagement = computeEngagementProfile(sessions);
    if (engagement.hadMeaningfulEngagement) {
      return {type: "high_engagement_lapse", daysSinceLastSession: daysSinceLastSessionFloor, ...engagement};
    }
    return {type: "one_week_lapse", daysSinceLastSession: daysSinceLastSessionFloor};
  }

  // 3 <= days < 7
  return {type: "started_once_then_lapsed", daysSinceLastSession: daysSinceLastSessionFloor};
}

function buildReengagementMessage(decision, neverStartedNudgeIndex) {
  switch (decision.type) {
    case "never_started":
      return neverStartedNudgeIndex === 0 ?
        {
          title: "Ready to focus?",
          body: "You haven't started your first focus session yet. Pick something to work on and give yourself a few focused minutes.",
        } :
        {
          title: "Your first session is waiting.",
          body: "Set aside a few focused minutes today and start building your momentum.",
        };

    case "started_once_then_lapsed":
      return {
        title: "Ready for another session?",
        body: "You've already put in the work. Come back for another focused session today.",
      };

    case "one_week_lapse":
      return {
        title: "It's been a minute.",
        body: "You haven't logged a focus session in a week. Come back and get one done today.",
      };

    case "high_engagement_lapse": {
      const streakNote = decision.maxStreak >= 3 ?
        ` You had a ${decision.maxStreak}-day streak going.` :
        " You had a strong run of focused work.";
      return {
        title: "Let's get your momentum back.",
        body: `${streakNote} Come back for one session and start building momentum again.`,
      };
    }

    default:
      return null;
  }
}

/**
 * Enforces the global cooldown (3 days between any re-engagement sends),
 * weekly cap (max 2/week), and the never_started-specific lifetime cap
 * (max 2 nudges ever), then sends and persists state.
 *
 * @return {Promise<boolean>} true if a notification was actually sent
 */
async function trySendReengagement(userId, decision, timezone) {
  const stateRef = admin.firestore()
      .collection("users").doc(userId)
      .collection("notificationState").doc("reengagement");
  const stateDoc = await stateRef.get();
  const state = stateDoc.exists ? stateDoc.data() : {};

  const lastSentMs = state.lastSentAt?.toMillis ? state.lastSentAt.toMillis() : 0;
  if (lastSentMs && (Date.now() - lastSentMs) < REENGAGEMENT_GLOBAL_COOLDOWN_MS) {
    await stateRef.set({lastEvaluatedAt: admin.firestore.FieldValue.serverTimestamp()}, {merge: true});
    return false;
  }

  const currentWeekLabel = getLocalWeekBoundaries(timezone, 0).weekStartLabel;
  const sentThisWeekCount = state.weekStartLabel === currentWeekLabel ? (state.sentThisWeekCount || 0) : 0;
  if (sentThisWeekCount >= REENGAGEMENT_WEEKLY_MAX) {
    await stateRef.set({lastEvaluatedAt: admin.firestore.FieldValue.serverTimestamp()}, {merge: true});
    return false;
  }

  const neverStartedNudgeIndex = state.neverStartedNudgeCount || 0;
  if (decision.type === "never_started" && neverStartedNudgeIndex >= REENGAGEMENT_NEVER_STARTED_MAX_NUDGES) {
    await stateRef.set({lastEvaluatedAt: admin.firestore.FieldValue.serverTimestamp()}, {merge: true});
    return false;
  }

  const tokenDoc = await admin.firestore().collection("fcm_tokens").doc(userId).get();
  if (!tokenDoc.exists) {
    console.warn(`⚠️ No FCM token for user: ${userId}`);
    return false;
  }
  const fcmToken = tokenDoc.data().token;

  const message = buildReengagementMessage(decision, neverStartedNudgeIndex);
  if (!message) return false;

  await admin.messaging().send({
    token: fcmToken,
    notification: {title: message.title, body: message.body},
    data: {
      type: "re_engagement",
      category: decision.type,
    },
    apns: {
      payload: {
        aps: {
          sound: "default",
          badge: 1,
        },
      },
    },
  });

  await stateRef.set({
    lastSentAt: admin.firestore.FieldValue.serverTimestamp(),
    lastEvaluatedAt: admin.firestore.FieldValue.serverTimestamp(),
    lastNotificationType: decision.type,
    weekStartLabel: currentWeekLabel,
    sentThisWeekCount: sentThisWeekCount + 1,
    neverStartedNudgeCount: decision.type === "never_started" ? neverStartedNudgeIndex + 1 : (state.neverStartedNudgeCount || 0),
  }, {merge: true});

  console.log(`✅ Re-engagement notification (${decision.type}) sent to: ${userId}`);
  return true;
}