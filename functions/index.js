// functions/index.js
const functions = require("firebase-functions");
const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
admin.initializeApp();

/**
 * HTTP endpoint to register FCM tokens
 *
 * WHAT THIS DOES:
 * - Receives FCM token from client
 * - Stores it in Firestore under user's ID
 * - Allows backend to send notifications to this device later
 *
 * WHY FIRESTORE:
 * - Persists across server restarts
 * - Allows querying (e.g., "find all tokens for user X")
 * - Scales automatically
 *
 * CALLED FROM: useNotificationSetup.js on client
 */
exports.registerToken = functions.https.onRequest(async (req, res) => {
  // Enable CORS for your app
  res.set("Access-Control-Allow-Origin", "*");

  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    return res.status(204).send("");
  }

  const {fcmToken, platform, userId} = req.body;

  // Validate required fields
  if (!fcmToken || !userId) {
    return res.status(400).send({
      error: "Missing required fields: fcmToken and userId",
    });
  }

  try {
    // Store token in Firestore
    await admin.firestore().collection("fcm_tokens").doc(userId).set({
      token: fcmToken,
      platform,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, {merge: true});

    console.log(`✅ Registered FCM token for user: ${userId}`);
    return res.status(200).send({success: true});
  } catch (error) {
    console.error("❌ Error storing FCM token:", error);
    return res.status(500).send({
      error: "Failed to store token",
      details: error.message,
    });
  }
});

/**
 * Callable function to trigger session-end notification
 *
 * WHEN TO CALL: When a user's session timer reaches 0
 *
 * WHAT THIS DOES:
 * 1. Gets user's FCM token from Firestore
 * 2. Builds notification payload
 * 3. Sends via Firebase Cloud Messaging
 * 4. FCM routes to APNs (for iOS)
 * 5. APNs delivers to device (even if app is killed!)
 *
 * REPLACES: Your current local notification in SessionScreen.js
 */
exports.triggerSessionEndNotification = functions.https.onCall(
    async (data, context) => {
      const {userId, sessionDuration, activityName} = data;

      console.log(
          `🔔 Session end notification requested for user: ${userId}`,
      );

      // Get user's FCM token from Firestore
      const tokenDoc = await admin.firestore()
          .collection("fcm_tokens").doc(userId).get();

      if (!tokenDoc.exists) {
        throw new functions.https.HttpsError(
            "not-found",
            "No FCM token found for this user",
        );
      }

      const fcmToken = tokenDoc.data().token;

      // Build FCM message payload
      const message = {
        token: fcmToken,

        // Notification payload (what shows in notification tray)
        notification: {
          title: "🎉 Session Complete!",
          body: `Great work! You focused for ${sessionDuration} minutes` +
            ` on ${activityName}.`,
        },

        // Data payload (for app to handle navigation/logic)
        data: {
          type: "session_end",
          duration: sessionDuration.toString(),
          activity: activityName,
        },

        // iOS-specific configuration
        apns: {
          payload: {
            aps: {
              sound: "default",
              badge: 1,
            },
          },
        },
      };

      // Send via FCM
      try {
        await admin.messaging().send(message);
        console.log(`✅ Session-end notification sent to user: ${userId}`);
        return {success: true};
      } catch (error) {
        console.error("❌ Failed to send notification:", error);
        throw new functions.https.HttpsError(
            "internal",
            "Failed to send notification",
            error.message,
        );
      }
    },
);

// ========== SMART RE-ENGAGEMENT SYSTEM ==========

// Constants
const NOTIFICATION_LIMITS = {
  MIN_HOURS_BETWEEN_REMINDERS: 8,
  MAX_PER_WEEK: 3,
  RANDOM_SEND_PROBABILITY: 0.5,
};

// Scheduled functions
exports.morningReEngagement = functions.pubsub
    .schedule("0 9 * * *")
    .timeZone("America/New_York")
    .onRun(async (context) => {
      await sendSmartReminders("morning");
      return null;
    });

exports.afternoonReEngagement = functions.pubsub
    .schedule("0 14 * * *")
    .timeZone("America/New_York")
    .onRun(async (context) => {
      await sendSmartReminders("afternoon");
      return null;
    });

exports.eveningReEngagement = functions.pubsub
    .schedule("0 19 * * *")
    .timeZone("America/New_York")
    .onRun(async (context) => {
      await sendSmartReminders("evening");
      return null;
    });

// Main reminder function
async function sendSmartReminders(timeWindow) {
  const tokensSnapshot = await admin.firestore()
      .collection("fcm_tokens")
      .get();

  let sentCount = 0;
  let skippedCount = 0;

  const sendPromises = tokensSnapshot.docs.map(async (doc) => {
    const userId = doc.id;
    const fcmToken = doc.data().token;

    try {
      const shouldSend = await shouldSendReminder(userId, timeWindow);
      if (!shouldSend) {
        skippedCount++;
        return;
      }

      const message = await buildPersonalizedMessage(userId, timeWindow);

      await admin.messaging().send({
        token: fcmToken,
        notification: {
          title: message.title,
          body: message.body,
        },
        data: {
          type: "re_engagement",
          timeWindow,
          strategy: message.strategy,
        },
        apns: {payload: {aps: {sound: "default"}}},
      });

      await recordNotificationSent(userId);
      sentCount++;
    } catch (error) {
      console.error(`Error for user ${userId}:`, error);
    }
  });

  await Promise.all(sendPromises);
  console.log(`${timeWindow}: ${sentCount} sent, ${skippedCount} skipped`);
}

// Decision logic
async function shouldSendReminder(userId, timeWindow) {
  // Rule 1: Already focused today
  const hasSessionToday = await checkSessionToday(userId);
  if (hasSessionToday) return false;

  // Rule 2: Got notification recently
  const lastNotif = await getLastNotificationTime(userId);
  const hoursSince = (Date.now() - lastNotif) / (1000 * 60 * 60);
  if (hoursSince < NOTIFICATION_LIMITS.MIN_HOURS_BETWEEN_REMINDERS) {
    return false;
  }

  // Rule 3: Weekly limit
  const remindersThisWeek = await getRemindersThisWeek(userId);
  if (remindersThisWeek >= NOTIFICATION_LIMITS.MAX_PER_WEEK) {
    return false;
  }

  // Rule 4: Streak at risk (high priority)
  const streak = await getCurrentStreak(userId);
  if (streak >= 3) return true;

  // Rule 5: Random 50%
  return Math.random() > 0.5;
}

// Helper functions
async function checkSessionToday(userId) {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const snapshot = await admin.firestore()
      .collection("users")
      .doc(userId)
      .collection("sessions")
      .where("createdAt", ">=", todayStart)
      .limit(1)
      .get();

  return !snapshot.empty;
}

async function getLastNotificationTime(userId) {
  const doc = await admin.firestore()
      .collection("users")
      .doc(userId)
      .collection("metadata")
      .doc("notifications")
      .get();

  return doc.data()?.lastReminderSentAt?.toMillis() || 0;
}

async function getRemindersThisWeek(userId) {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const doc = await admin.firestore()
      .collection("users")
      .doc(userId)
      .collection("metadata")
      .doc("notifications")
      .get();

  const reminders = doc.data()?.weeklyReminders || [];
  return reminders.filter((t) => t.toDate() >= weekAgo).length;
}

async function getCurrentStreak(userId) {
  const doc = await admin.firestore()
      .collection("users")
      .doc(userId)
      .get();

  return doc.data()?.currentStreak || 0;
}

async function recordNotificationSent(userId) {
  await admin.firestore()
      .collection("users")
      .doc(userId)
      .collection("metadata")
      .doc("notifications")
      .set({
        lastReminderSentAt: admin.firestore.FieldValue.serverTimestamp(),
        weeklyReminders: admin.firestore.FieldValue.arrayUnion(
            admin.firestore.Timestamp.now(),
        ),
      }, {merge: true});
}

async function buildPersonalizedMessage(userId, timeWindow) {
  const streak = await getCurrentStreak(userId);

  // Strategy 1: Streak-based
  if (streak >= 3) {
    return {
      title: `${streak}-day streak! 🔥`,
      body: "Keep it going with a quick focus session",
      strategy: "streak",
    };
  }

  // Strategy 2: Time-based default
  const messages = {
    morning: {
      title: "Good morning! ☀️",
      body: "Start your day with focused work",
    },
    afternoon: {
      title: "Afternoon focus time 🎯",
      body: "Beat the slump with a quick session",
    },
    evening: {
      title: "Wind down with focus 🌙",
      body: "One more session before the day ends?",
    },
  };

  return {
    ...messages[timeWindow],
    strategy: "time_based",
  };
}

// ========== END SMART RE-ENGAGEMENT ==========
