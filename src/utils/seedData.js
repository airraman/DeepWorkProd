// src/utils/seedData.js
// Seeds 120 days of realistic session data with full reflection fields.
// Sessions include rating.reflection.workedOn/nextStep/wentWell/distractions
// so the AI insight pipeline and personalized notifications have real data.

import { deepWorkStore } from '../services/deepWorkStore';
import { saveSessionToFirestore } from '../services/firestoreSessionService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Activity definitions ────────────────────────────────────────────────────

const ACTIVITIES = [
  { id: 'deep-work',  name: 'Deep Work',  color: '#2563eb' },
  { id: 'reading',    name: 'Reading',    color: '#10b981' },
  { id: 'learning',   name: 'Learning',   color: '#8b5cf6' },
  { id: 'writing',    name: 'Writing',    color: '#f59e0b' },
  { id: 'planning',   name: 'Planning',   color: '#06b6d4' },
];

const ACTIVITY_IDS = ACTIVITIES.map(a => a.id);
const MUSIC_CHOICES = ['lofi', 'classical', 'ambient', 'none'];

// ─── Reflection content pools ─────────────────────────────────────────────────

const WORKED_ON = {
  'deep-work': [
    'coding', 'feature implementation', 'bug fixes', 'code review',
    'refactoring', 'API integration', 'database design', 'architecture planning',
  ],
  'reading': [
    'technical documentation', 'research papers', 'design patterns book',
    'startup memoir', 'psychology of focus', 'systems thinking',
  ],
  'learning': [
    'React Native course', 'system design concepts', 'TypeScript fundamentals',
    'machine learning basics', 'Swift UI', 'cloud architecture',
  ],
  'writing': [
    'pitch deck', 'blog post', 'project proposal', 'technical spec',
    'email drafts', 'essay outline', 'research summary',
  ],
  'planning': [
    'sprint planning', 'quarterly goals', 'roadmap review',
    'task prioritisation', 'project breakdown', 'OKR draft',
  ],
};

const NEXT_STEPS = {
  'deep-work': [
    'finish draft', 'continue feature', 'refactor code',
    'write tests', 'review PR', 'fix edge cases', 'deploy to staging',
  ],
  'reading': [
    'review notes', 'finish chapter', 'summarise key points',
    'apply concept in code', 'share with team',
  ],
  'learning': [
    'complete next module', 'build practice project', 'revisit flashcards',
    'implement what I learned', 'watch follow-up lecture',
  ],
  'writing': [
    'edit draft', 'add citations', 'finish introduction',
    'send for review', 'publish post', 'incorporate feedback',
  ],
  'planning': [
    'assign tasks', 'schedule follow-up', 'update Notion',
    'share with team', 'review with manager', 'set deadlines',
  ],
};

const WENT_WELL = [
  'stayed focused the whole session', 'hit flow state quickly',
  'finished more than expected', 'no phone distractions',
  'clear thinking throughout', 'good energy level',
  'completed the main goal', 'got unstuck on a hard problem',
];

const DISTRACTIONS = [
  'phone notifications', 'Slack messages', 'background noise',
  'wandering thoughts', 'email checking', 'social media urge',
  'unexpected interruptions', 'low energy mid-session',
  '', '', '', // ~30% chance of no distraction
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randBetween = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

function sessionsForDay(dow) {
  if (dow === 0 || dow === 6) return Math.random() < 0.45 ? 0 : randBetween(1, 2);
  if (dow === 1)              return Math.random() < 0.15 ? 0 : randBetween(1, 2);
  if (dow >= 2 && dow <= 4)  return Math.random() < 0.08 ? 0 : randBetween(1, 3);
  /* dow === 5 */             return Math.random() < 0.25 ? 0 : randBetween(1, 2);
}

function buildReflection(activityId) {
  // ~85% of seeded sessions have reflection data (simulates real engaged users)
  if (Math.random() > 0.85) return null;

  return {
    focus:       randBetween(3, 5),
    productivity: randBetween(3, 5),
    ratedAt:     new Date().toISOString(),
    reflection: {
      workedOn:    pick(WORKED_ON[activityId] || WORKED_ON['deep-work']),
      wentWell:    Math.random() > 0.2 ? pick(WENT_WELL)       : '',
      distractions: Math.random() > 0.3 ? pick(DISTRACTIONS)   : '',
      nextStep:    Math.random() > 0.25 ? pick(NEXT_STEPS[activityId] || NEXT_STEPS['deep-work']) : '',
    },
  };
}

// ─── Main seed function ───────────────────────────────────────────────────────

export async function seedData() {
  console.log('🌱 Starting 120-day data seed...\n');

  try {
    // Step 1 — Reset activities to match seed data
    console.log('📝 Resetting activities...');
    await deepWorkStore.updateActivities(ACTIVITIES);

    // Step 2 — Clear existing sessions
    console.log('🗑️  Clearing old sessions...');
    await deepWorkStore.clearSessions();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allSessions = {};
    let totalSessions = 0;
    let totalMinutes  = 0;
    let daysWithData  = 0;
    const firestoreBatch = []; // collect for Firestore sync after AsyncStorage write

    console.log(`📅 Generating 120 days ending ${today.toISOString().split('T')[0]}\n`);

    for (let daysAgo = 119; daysAgo >= 0; daysAgo--) {
      const date = new Date(today);
      date.setDate(today.getDate() - daysAgo);
      date.setHours(0, 0, 0, 0);

      const dow = date.getDay();
      const numSessions = sessionsForDay(dow);
      if (numSessions === 0) continue;

      daysWithData++;
      const dateStr = date.toISOString().split('T')[0];
      if (!allSessions[dateStr]) allSessions[dateStr] = [];

      for (let i = 0; i < numSessions; i++) {
        const activityId = pick(
          dow === 0 || dow === 6
            ? ['reading', 'learning']
            : ACTIVITY_IDS
        );

        const duration  = dow === 0 || dow === 6
          ? randBetween(25, 60)
          : randBetween(45, 120);

        const hourStart = 8 + i * 3;
        const sessionDate = new Date(date);
        sessionDate.setHours(hourStart, randBetween(0, 45), 0, 0);
        const timestamp = sessionDate.getTime();

        const rating = buildReflection(activityId);

        const session = {
          id:          `${dateStr}-${timestamp}`,
          date:        dateStr,
          activity:    activityId,
          duration,
          musicChoice: pick(MUSIC_CHOICES),
          notes:       rating?.reflection?.workedOn || '',
          timestamp,
          completedAt: new Date(timestamp).toISOString(),
          syncStatus:  'synced',
          ...(rating && { rating }),
          metadata: {
            appVersion: '1.0.0',
            created:    timestamp,
            modified:   timestamp,
          },
        };

        allSessions[dateStr].push(session);
        firestoreBatch.push(session);
        totalSessions++;
        totalMinutes += duration;
      }

      if (daysWithData % 20 === 0) {
        console.log(`  ✓ ${daysWithData} days generated...`);
      }
    }

    // Step 3 — Write to AsyncStorage in one shot
    console.log('\n💾 Writing to AsyncStorage...');
    await AsyncStorage.setItem('@deep_work_sessions', JSON.stringify(allSessions));

    // Verify
    const raw = await AsyncStorage.getItem('@deep_work_sessions');
    const verified = JSON.parse(raw);
    console.log(`✅ Verified: ${Object.keys(verified).length} dates in AsyncStorage`);

    // Step 4 — Sync to Firestore (fire-and-forget batched; failures are non-critical)
    console.log(`\n🔄 Syncing ${firestoreBatch.length} sessions to Firestore...`);
    let firestoreOk = 0;
    for (const session of firestoreBatch) {
      try {
        const saved = await saveSessionToFirestore(session);
        if (saved) firestoreOk++;
      } catch (_) { /* non-critical */ }
    }
    console.log(`✅ Firestore: ${firestoreOk}/${firestoreBatch.length} saved`);

    const dateRange = {
      start: new Date(today.getTime() - 119 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      end:   today.toISOString().split('T')[0],
    };

    console.log('\n✅ Seed complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  Sessions:      ${totalSessions}`);
    console.log(`  Days with data: ${daysWithData} / 120`);
    console.log(`  Total time:    ${(totalMinutes / 60).toFixed(1)} hours`);
    console.log(`  Date range:    ${dateRange.start} → ${dateRange.end}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    return {
      success: true,
      totalSessions,
      daysWithSessions: daysWithData,
      totalHours: (totalMinutes / 60).toFixed(1),
      dateRange,
    };

  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  }
}

export async function clearSeedData() {
  console.log('🗑️  Clearing all session data...');
  try {
    const success = await deepWorkStore.clearSessions();
    if (success) {
      console.log('✅ Sessions cleared');
      return { success: true };
    }
    throw new Error('clearSessions returned false');
  } catch (error) {
    console.error('❌ Clear failed:', error);
    // Fallback: direct AsyncStorage wipe
    await AsyncStorage.setItem('@deep_work_sessions', JSON.stringify({}));
    console.log('✅ Cleared via fallback');
    return { success: true };
  }
}
