// src/utils/seedData.js

import { deepWorkStore } from '../services/deepWorkStore';

const ACTIVITIES = ['Deep Work', 'Reading', 'Learning', 'Writing', 'Planning'];
const MUSIC_CHOICES = ['lofi', 'classical', 'ambient', 'none'];
const SAMPLE_NOTES = [
  'Worked on React Native project',
  'Read technical documentation',
  'Studied new framework',
  'Wrote blog post',
  'Planned next sprint',
  'Fixed critical bugs',
  'Designed new feature',
  'Code review session',
  null,
  null,
];

function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getSessionsForDay(dayOfWeek) {
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    const rand = Math.random();
    if (rand < 0.4) return 0;
    if (rand < 0.7) return 1;
    return 2;
  }
  
  if (dayOfWeek === 1) {
    const rand = Math.random();
    if (rand < 0.2) return 0;
    if (rand < 0.6) return 1;
    return 2;
  }
  
  if (dayOfWeek >= 2 && dayOfWeek <= 4) {
    const rand = Math.random();
    if (rand < 0.1) return 0;
    if (rand < 0.3) return 1;
    if (rand < 0.7) return 2;
    return 3;
  }
  
  if (dayOfWeek === 5) {
    const rand = Math.random();
    if (rand < 0.3) return 0;
    if (rand < 0.7) return 1;
    return 2;
  }
  
  return 1;
}

function generateSession(dayOfWeek) {
  let duration;
  let activity;
  
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    duration = randomBetween(30, 60);
    activity = randomItem(['Reading', 'Learning']);
  } else {
    duration = randomBetween(45, 120);
    activity = randomItem(ACTIVITIES);
  }
  
  return {
    activity,
    duration,
    musicChoice: randomItem(MUSIC_CHOICES),
    notes: randomItem(SAMPLE_NOTES) || '',
  };
}

export async function seedData() {
  console.log('🌱 Starting data seed...\n');
  
  try {
    const settings = await deepWorkStore.getSettings();
    if (!settings.activities || settings.activities.length === 0) {
      console.log('📝 Creating default activities...');
      await deepWorkStore.updateActivities([
        { id: 'deep-work', name: 'Deep Work', color: '#2563eb', icon: '💻' },
        { id: 'reading', name: 'Reading', color: '#10b981', icon: '📚' },
        { id: 'learning', name: 'Learning', color: '#8b5cf6', icon: '🎓' },
        { id: 'writing', name: 'Writing', color: '#f59e0b', icon: '✍️' },
        { id: 'planning', name: 'Planning', color: '#06b6d4', icon: '📋' },
      ]);
    }
    
    let totalSessionsCreated = 0;
    let totalMinutes = 0;
    let daysWithSessions = 0;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    console.log(`📅 Generating data for 90 days (ending ${today.toISOString().split('T')[0]})\n`);
    
    // Generate data for each of the last 90 days
    for (let daysAgo = 89; daysAgo >= 0; daysAgo--) {
      const date = new Date(today);
      date.setDate(today.getDate() - daysAgo);
      date.setHours(0, 0, 0, 0);
      
      const dayOfWeek = date.getDay();
      const numSessions = getSessionsForDay(dayOfWeek);
      
      if (numSessions === 0) {
        continue;
      }
      
      daysWithSessions++;
      const dateString = date.toISOString().split('T')[0];
      
      console.log(`Adding ${numSessions} session(s) for ${dateString}`);
      
      // Create sessions for this day
      for (let i = 0; i < numSessions; i++) {
        const session = generateSession(dayOfWeek);
        
        // Create timestamp for this specific session
        const hourOffset = 9 + (i * 3);
        const sessionDate = new Date(date);
        sessionDate.setHours(hourOffset, 0, 0, 0);
        const timestamp = sessionDate.getTime();
        
        // Simple session data - just what addSession needs
        const sessionData = {
          activity: session.activity,
          duration: session.duration,
          musicChoice: session.musicChoice,
          notes: session.notes || '',
          timestamp: timestamp, // This is what addSession uses for the date
        };
        
        // Use the standard addSession method
        await deepWorkStore.addSession(sessionData);
        
        totalSessionsCreated++;
        totalMinutes += session.duration;
      }
    }
    
    console.log('\n✅ Seed complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📊 Total sessions created: ${totalSessionsCreated}`);
    console.log(`📅 Days with data: ${daysWithSessions} out of 90`);
    console.log(`⏱️  Total time: ${(totalMinutes / 60).toFixed(1)} hours`);
    console.log(`📈 Average per day: ${(totalSessionsCreated / 90).toFixed(1)} sessions`);
    console.log(`📈 Average per active day: ${(totalSessionsCreated / daysWithSessions).toFixed(1)} sessions`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    return {
      success: true,
      totalSessions: totalSessionsCreated,
      daysWithSessions: daysWithSessions,
      totalHours: (totalMinutes / 60).toFixed(1),
      dateRange: {
        start: new Date(today.getTime() - 89 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        end: today.toISOString().split('T')[0],
      },
    };
    
  } catch (error) {
    console.error('❌ Seed failed:', error);
    console.error('Stack:', error.stack);
    throw error;
  }
}

export async function clearSeedData() {
  console.log('🗑️  Clearing all session data...');
  
  try {
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    
    // Method 1: Set to empty object
    await AsyncStorage.setItem('sessions', JSON.stringify({}));
    
    // Method 2: Also try removing the key entirely
    await AsyncStorage.removeItem('sessions');
    
    // Method 3: Re-initialize with empty
    await AsyncStorage.setItem('sessions', JSON.stringify({}));
    
    console.log('✅ Storage cleared using multiple methods');
    console.log('⚠️  YOU MUST RESTART THE APP for changes to take effect');
    
    return { success: true };
  } catch (error) {
    console.error('❌ Clear failed:', error);
    throw error;
  }
}