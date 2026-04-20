// src/services/personalizedNotificationService.js
//
// Builds and fires personalized re-engagement notifications based on the
// user's most recent session reflection data.
//
// Notification priority chain:
//   1. nextStep  — "Yesterday you wrote: 'finish draft'. Ready to start?"
//   2. workedOn  — "Yesterday you worked on coding. Ready to continue?"
//   3. fallback  — "Ready to focus?"
//
// All payloads are logged to console before scheduling so they can be
// inspected from the Dev Tools screen.

import * as Notifications from 'expo-notifications';
import { deepWorkStore } from './deepWorkStore';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the most recent session that has a non-empty reflection field.
 * Searches up to `lookbackDays` days back (default 14).
 */
async function getMostRecentReflection(lookbackDays = 14) {
  const allSessions = await deepWorkStore.getSessions();
  const cutoff = Date.now() - lookbackDays * 24 * 60 * 60 * 1000;

  const flat = Object.values(allSessions)
    .flat()
    .filter(s => s.timestamp >= cutoff)
    .sort((a, b) => b.timestamp - a.timestamp);

  // Find first session that has at least a non-empty workedOn or nextStep
  for (const session of flat) {
    const r = session.rating?.reflection;
    const workedOn = r?.workedOn?.trim() || null;
    const nextStep = r?.nextStep?.trim() || null;
    if (workedOn || nextStep) {
      return {
        workedOn,
        nextStep,
        activity: session.activity || null,
        timestamp: session.timestamp,
      };
    }
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

function buildNextStepPayload(nextStep) {
  return {
    type: 'nextStep',
    title: 'Your next step is waiting.',
    body:  `You wrote: "${nextStep}". Start your session now.`,
    data:  { type: 'reengagement', subtype: 'nextStep', nextStep },
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

  const trigger = delaySeconds > 0
    ? { seconds: delaySeconds }
    : null; // null = immediate (for manual test triggers)

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

  console.log(`  scheduled id: ${id}\n`);
  return id;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Schedule the best available personalized re-engagement notification.
 * Priority: nextStep → workedOn → fallback.
 * Used by the background task / daily reminder scheduler.
 *
 * @param {number} delaySeconds - seconds until notification fires (0 = immediate)
 */
export async function schedulePersonalizedNotification(delaySeconds = 0) {
  try {
    const reflection = await getMostRecentReflection();
    let payload;

    if (reflection?.nextStep) {
      payload = buildNextStepPayload(reflection.nextStep);
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
 * @param {'workedOn'|'nextStep'|'fallback'} type
 */
export async function testNotification(type) {
  try {
    let payload;

    if (type === 'fallback') {
      payload = buildFallbackPayload();
    } else {
      const reflection = await getMostRecentReflection();

      if (type === 'nextStep') {
        const nextStep = reflection?.nextStep || 'finish your task';
        payload = buildNextStepPayload(nextStep);
      } else {
        // workedOn
        const workedOn = reflection?.workedOn || 'your project';
        payload = buildWorkedOnPayload(workedOn);
      }
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
    const reflection = await getMostRecentReflection();

    if (type === 'nextStep') {
      return buildNextStepPayload(reflection?.nextStep || 'finish your task');
    }
    if (type === 'workedOn') {
      return buildWorkedOnPayload(reflection?.workedOn || 'your project');
    }
    if (type === 'fallback') {
      return buildFallbackPayload();
    }
    // Auto — pick best available
    if (reflection?.nextStep) return buildNextStepPayload(reflection.nextStep);
    if (reflection?.workedOn) return buildWorkedOnPayload(reflection.workedOn);
    return buildFallbackPayload();
  } catch (error) {
    console.error('[PersonalizedNotification] Preview failed:', error);
    return buildFallbackPayload();
  }
}
