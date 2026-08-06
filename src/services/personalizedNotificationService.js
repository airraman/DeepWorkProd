// src/services/personalizedNotificationService.js
//
// Builds and fires personalized re-engagement notifications based on the
// user's most recent session data.
//
// Notification priority chain:
//   1. aiSuggestion — AI-generated insight text (same pipeline as the in-app
//                      Insights card), e.g. "Yesterday you focused best in
//                      the morning. Ready to start there again?"
//   2. workedOn     — "Yesterday you worked on coding. Ready to continue?"
//   3. fallback     — "Ready to focus?"
//
// All payloads are logged to console before scheduling so they can be
// inspected from the Dev Tools screen.

import * as Notifications from 'expo-notifications';
import { deepWorkStore } from './deepWorkStore';
import InsightGenerator from './insights/InsightGenerator';
import { truncate } from './insights/cardBuilders';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the most recent session that has a non-empty `workedOn` reflection.
 * Searches up to `lookbackDays` days back (default 14).
 */
async function getMostRecentReflection(lookbackDays = 14) {
  const allSessions = await deepWorkStore.getSessions();
  const cutoff = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;

  const flat = Object.values(allSessions)
    .flat()
    .filter(s => s.timestamp >= cutoff)
    .sort((a, b) => b.timestamp - a.timestamp);

  for (const session of flat) {
    const workedOn = session.rating?.reflection?.workedOn?.trim() || null;
    if (workedOn) {
      return {
        workedOn,
        activity: session.activity || null,
        timestamp: session.timestamp,
      };
    }
  }
  return null;
}

/**
 * Reuses the same daily AI insight the in-app Insights card generates
 * (cached, ~1 call/day via InsightGenerator's CacheManager). Returns null
 * if generation failed or there's no data to generate from.
 */
async function getAiSuggestion() {
  const insight = await InsightGenerator.generate('daily', { referenceDate: new Date() }).catch(() => null);
  if (insight?.success && !insight.metadata?.isEmpty) {
    return insight.insightText;
  }
  return null;
}

// ─── Payload builders ─────────────────────────────────────────────────────────

function buildWorkedOnPayload(workedOn) {
  return {
    type: 'workedOn',
    title: 'Ready to keep going?',
    body:  `Last session you worked on ${workedOn}. Pick up where you left off.`,
    data:  { type: 'reengagement', subtype: 'workedOn', workedOn },
  };
}

function buildAiSuggestionPayload(insightText) {
  const body = truncate(insightText, 120);
  return {
    type: 'aiSuggestion',
    title: 'Your focus insight is ready.',
    body,
    data:  { type: 'reengagement', subtype: 'aiSuggestion', insightText: body },
  };
}

function buildFallbackPayload() {
  return {
    type: 'fallback',
    title: 'Ready to focus?',
    body:  'Start a deep work session and make progress today.',
    data:  { type: 'reengagement', subtype: 'fallback' },
  };
}

// ─── Schedule helper ──────────────────────────────────────────────────────────

async function schedulePayload(payload, delaySeconds = 0) {
  console.log(`\n[PersonalizedNotification] Scheduling "${payload.type}" notification`);
  console.log('  title:', payload.title);
  console.log('  body: ', payload.body);
  console.log('  data: ', JSON.stringify(payload.data));

  // { seconds: N } without a 'type' field throws TypeError in expo-notifications >= 0.20
  // and is silently caught by the outer try/catch — notifications never schedule.
  const trigger = delaySeconds > 0
    ? {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: delaySeconds,
        repeats: false,
      }
    : null; // null = fire immediately

  console.log(`  trigger: ${trigger ? `TIME_INTERVAL ${delaySeconds}s` : 'immediate (null)'}`);

  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: payload.title,
      body:  payload.body,
      data:  payload.data,
      sound: true,
      badge: 1,
    },
    trigger,
  });

  console.log(`  scheduled id: ${id}`);

  const pending = await Notifications.getAllScheduledNotificationsAsync();
  const confirmed = pending.some(n => n.identifier === id);
  console.log(`  confirmed in OS queue: ${confirmed} | total pending: ${pending.length}\n`);

  return id;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Schedule the best available personalized re-engagement notification.
 * Priority: aiSuggestion → workedOn → fallback.
 * Used by the background task / daily reminder scheduler.
 *
 * @param {number} delaySeconds - seconds until notification fires (0 = immediate)
 */
export async function schedulePersonalizedNotification(delaySeconds = 0) {
  try {
    const [reflection, aiSuggestion] = await Promise.all([
      getMostRecentReflection(),
      getAiSuggestion(),
    ]);
    let payload;

    if (aiSuggestion) {
      payload = buildAiSuggestionPayload(aiSuggestion);
    } else if (reflection?.workedOn) {
      payload = buildWorkedOnPayload(reflection.workedOn);
    } else {
      payload = buildFallbackPayload();
    }

    return await schedulePayload(payload, delaySeconds);
  } catch (error) {
    console.error('[PersonalizedNotification] Failed to schedule:', error);
    return null;
  }
}

/**
 * Immediately fire a specific notification type for manual testing.
 * Logs the full payload before sending.
 *
 * @param {'workedOn'|'aiSuggestion'|'fallback'} type
 */
export async function testNotification(type) {
  try {
    let payload;

    if (type === 'fallback') {
      payload = buildFallbackPayload();
    } else if (type === 'aiSuggestion') {
      const aiSuggestion = await getAiSuggestion();
      payload = buildAiSuggestionPayload(aiSuggestion || 'You showed up for your focus practice yesterday.');
    } else {
      // workedOn
      const reflection = await getMostRecentReflection();
      const workedOn = reflection?.workedOn || 'your project';
      payload = buildWorkedOnPayload(workedOn);
    }

    return await schedulePayload(payload, 0); // immediate
  } catch (error) {
    console.error('[PersonalizedNotification] Test failed:', error);
    return null;
  }
}

/**
 * Returns the notification payload that WOULD be sent right now,
 * without actually scheduling it. Used by Dev Tools to preview.
 */
export async function previewNotificationPayload(type) {
  try {
    if (type === 'aiSuggestion') {
      const aiSuggestion = await getAiSuggestion();
      return buildAiSuggestionPayload(aiSuggestion || 'You showed up for your focus practice yesterday.');
    }
    const reflection = await getMostRecentReflection();
    if (type === 'workedOn') {
      return buildWorkedOnPayload(reflection?.workedOn || 'your project');
    }
    if (type === 'fallback') {
      return buildFallbackPayload();
    }
    // Auto — pick best available
    const aiSuggestion = await getAiSuggestion();
    if (aiSuggestion) return buildAiSuggestionPayload(aiSuggestion);
    if (reflection?.workedOn) return buildWorkedOnPayload(reflection.workedOn);
    return buildFallbackPayload();
  } catch (error) {
    console.error('[PersonalizedNotification] Preview failed:', error);
    return buildFallbackPayload();
  }
}
