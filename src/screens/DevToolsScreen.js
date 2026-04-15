// src/screens/DevToolsScreen.js
// TEMPORARY - Only for testing, remove before production

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { seedData, clearSeedData } from '../utils/seedData';
import { useTheme } from '../context/ThemeContext';
import InsightGenerator from '../services/insights/InsightGenerator';
import SessionRepository from '../services/database/SessionRepository';
import DataAggregator from '../services/insights/DataAggregator';
import PromptBuilder from '../services/insights/PromptBuilder';
import { getSessionsFromFirestore } from '../services/firestoreSessionService';
import {
  testNotification,
  previewNotificationPayload,
} from '../services/personalizedNotificationService';
import { devModalService } from '../services/devModalService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DevToolsScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [insight, setInsight] = useState(null);
  const [notifPreview, setNotifPreview] = useState(null);

  const handleSeedData = async () => {
    Alert.alert(
      'Seed 120 Days of Data?',
      'This will create realistic test data for the last 120 days.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Seed Data',
          onPress: async () => {
            setLoading(true);
            setResult(null);
            try {
              const res = await seedData();
              setResult(res);
              Alert.alert('Success!', `Created ${res.totalSessions} sessions`);
            } catch (error) {
              Alert.alert('Error', error.message);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleGenerateInsight = async (type) => {
    setLoading(true);
    setInsight(null);
    try {
      const result = await InsightGenerator.generate(type, {
        forceRegenerate: true,
      });
      setInsight(result);
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClearData = async () => {
    Alert.alert(
      'Clear All Data?',
      'This will delete all session data. You MUST restart the app after.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await clearSeedData();
              setResult(null);
              setInsight(null);
              
              Alert.alert(
                '✅ Data Cleared!', 
                'Please RESTART the app now:\n\n1. Press Ctrl+C in terminal\n2. Run: npx expo start\n3. Reopen app',
                [{ text: 'OK' }]
              );
            } catch (error) {
              Alert.alert('Error', error.message);
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleDebugData = async () => {
    try {
      setLoading(true);
      
      const { deepWorkStore } = require('../services/deepWorkStore');
      const sessions = await deepWorkStore.getSessions();
      
      console.log('\n📊 ===== DEBUG: ALL SESSIONS =====');
      console.log('Total days with data:', Object.keys(sessions).length);
      
      const dates = Object.keys(sessions).sort();
      
      if (dates.length > 0) {
        console.log('Date range:', dates[0], 'to', dates[dates.length - 1]);
        
        const middleIndex = Math.floor(dates.length / 2);
        const sampleDate = dates[middleIndex];
        const sampleSessions = sessions[sampleDate];
        
        console.log(`\nSample date: ${sampleDate}`);
        console.log(`Sessions on this date: ${sampleSessions.length}`);
        console.log('Sample session structure:');
        console.log(JSON.stringify(sampleSessions[0], null, 2));
        
        let totalSessions = 0;
        let totalMinutes = 0;
        Object.values(sessions).forEach(daySessions => {
          totalSessions += daySessions.length;
          daySessions.forEach(session => {
            totalMinutes += session.duration || 0;
          });
        });
        
        console.log(`\nTotal sessions: ${totalSessions}`);
        console.log(`Total time: ${(totalMinutes / 60).toFixed(1)} hours`);
        console.log(`Average per day: ${(totalMinutes / dates.length / 60).toFixed(1)} hours`);
        
        const hasTimestamp = sampleSessions[0].timestamp !== undefined;
        const hasActivity = sampleSessions[0].activity !== undefined;
        const hasDuration = sampleSessions[0].duration !== undefined;
        
        console.log('\nField check:');
        console.log(`- Has timestamp: ${hasTimestamp ? '✅' : '❌'}`);
        console.log(`- Has activity: ${hasActivity ? '✅' : '❌'}`);
        console.log(`- Has duration: ${hasDuration ? '✅' : '❌'}`);
        
        console.log('\n=====================================\n');
        
        Alert.alert(
          'Debug Info',
          `Days with data: ${dates.length}\n` +
          `Total sessions: ${totalSessions}\n` +
          `Total hours: ${(totalMinutes / 60).toFixed(1)}\n\n` +
          `Check console for detailed output`
        );
      } else {
        console.log('No sessions found in storage');
        Alert.alert('Debug Info', 'No sessions found. Try seeding data first.');
      }
      
    } catch (error) {
      console.error('❌ Debug error:', error);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleInspectStructure = async () => {
    try {
      setLoading(true);
      
      const { deepWorkStore } = require('../services/deepWorkStore');
      
      console.log('\n🔬 ===== STRUCTURE INSPECTION =====');
      console.log('Available methods:', Object.keys(deepWorkStore));
      
      const sessions = await deepWorkStore.getSessions();
      const dateKeys = Object.keys(sessions);
      
      console.log('\nTotal date keys:', dateKeys.length);
      console.log('First 10 dates:', dateKeys.sort().slice(0, 10));
      
      if (dateKeys.length > 0) {
        const firstDate = dateKeys.sort()[0];
        const lastDate = dateKeys.sort()[dateKeys.length - 1];
        
        console.log('\nDate range:', firstDate, 'to', lastDate);
        console.log(`Sessions on ${firstDate}:`, sessions[firstDate].length);
        console.log('\nFirst session structure:');
        console.log(JSON.stringify(sessions[firstDate][0], null, 2));
      }
      
      console.log('=====================================\n');
      
      Alert.alert(
        'Structure Inspected',
        `Date keys: ${dateKeys.length}\n` +
        `Methods: ${Object.keys(deepWorkStore).length}\n\n` +
        'Check console for details'
      );
      
    } catch (error) {
      console.error('❌ Inspection error:', error);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleValidatePipeline = async () => {
    setLoading(true);
    const PASS = '✅';
    const FAIL = '❌';
    const WARN = '⚠️';
    const log = (symbol, label, detail = '') =>
      console.log(`  ${symbol} ${label}${detail ? ': ' + detail : ''}`);

    try {
      console.log('\n🔬 ===== PIPELINE VALIDATION =====');

      // ── Stage 1: AsyncStorage — find most recent session with a rating ──────
      console.log('\n[1] AsyncStorage — most recent rated session');
      const { deepWorkStore: store } = require('../services/deepWorkStore');
      const allSessions = await store.getSessions();
      const allFlat = Object.values(allSessions).flat().sort((a, b) => b.timestamp - a.timestamp);
      const rated = allFlat.find(s => s.rating);

      if (!rated) {
        log(WARN, 'No rated session found', 'complete a session and submit reflection first');
        Alert.alert('No rated session', 'Complete a session and submit the reflection, then run again.');
        return;
      }

      log(PASS, 'Session found', rated.id);
      log(rated.rating?.reflection?.workedOn ? PASS : FAIL, 'workedOn',    rated.rating?.reflection?.workedOn  || 'MISSING');
      log(rated.rating?.reflection?.wentWell  ? PASS : WARN, 'wentWell',   rated.rating?.reflection?.wentWell   || 'empty');
      log(rated.rating?.reflection?.distractions ? PASS : WARN, 'distractions', rated.rating?.reflection?.distractions || 'empty');
      log(rated.rating?.reflection?.nextStep  ? PASS : WARN, 'nextStep',   rated.rating?.reflection?.nextStep   || 'empty');
      log(rated.rating?.focus        != null ? PASS : FAIL, 'focusRating',       String(rated.rating?.focus));
      log(rated.rating?.productivity != null ? PASS : FAIL, 'productivityRating', String(rated.rating?.productivity));

      // ── Stage 2: SessionRepository mapping ───────────────────────────────────
      console.log('\n[2] SessionRepository — field mapping');
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const repoSessions = await SessionRepository.getSessionsByDateRange(weekAgo, Date.now());
      const repoMatch = repoSessions.find(s => s.id === rated.id);

      if (!repoMatch) {
        log(WARN, 'Session outside last-7-day window', 'expanding to 90 days');
        const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
        const wider = await SessionRepository.getSessionsByDateRange(ninetyDaysAgo, Date.now());
        const found = wider.find(s => s.id === rated.id);
        log(found ? PASS : FAIL, 'Found in 90-day range', found ? found.id : 'NOT FOUND');
        if (found) {
          log(found.description ? PASS : FAIL, 'description mapped', found.description || 'NULL');
          log(found.reflection?.workedOn ? PASS : FAIL, 'reflection.workedOn passed through', found.reflection?.workedOn || 'NULL');
        }
      } else {
        log(PASS, 'Session found in repository', repoMatch.id);
        log(repoMatch.description ? PASS : FAIL, 'description mapped', repoMatch.description || 'NULL');
        log(repoMatch.reflection?.workedOn ? PASS : FAIL, 'reflection.workedOn passed through', repoMatch.reflection?.workedOn || 'NULL');
      }

      // ── Stage 3: DataAggregator ───────────────────────────────────────────────
      console.log('\n[3] DataAggregator — reflection buckets');
      const targetSessions = repoSessions.length
        ? repoSessions
        : await SessionRepository.getSessionsByDateRange(Date.now() - 90 * 24 * 60 * 60 * 1000, Date.now());

      const aggregated = DataAggregator.aggregateSessions(targetSessions);
      const activities = Object.entries(aggregated.activitiesBreakdown || {});

      if (activities.length === 0) {
        log(FAIL, 'No activities in aggregated output');
      } else {
        activities.forEach(([name, stats]) => {
          log(PASS, `Activity: ${name}`);
          log(stats.sampleDescriptions?.length  ? PASS : WARN, '  sampleDescriptions',  JSON.stringify(stats.sampleDescriptions));
          log(stats.sampleWentWell?.length       ? PASS : WARN, '  sampleWentWell',      JSON.stringify(stats.sampleWentWell));
          log(stats.sampleDistractions?.length   ? PASS : WARN, '  sampleDistractions',  JSON.stringify(stats.sampleDistractions));
          log(stats.sampleNextSteps?.length      ? PASS : WARN, '  sampleNextSteps',     JSON.stringify(stats.sampleNextSteps));
        });
      }

      // ── Stage 4: PromptBuilder output ─────────────────────────────────────────
      console.log('\n[4] PromptBuilder — prompt content');
      const prompt = PromptBuilder.buildWeeklyPrompt(aggregated);
      const hasWorkedOn    = prompt.includes('Worked on:');
      const hasWentWell    = prompt.includes('Went well:');
      const hasDistracts   = prompt.includes('Distractions:');
      const hasNextSteps   = prompt.includes('Next steps:');

      log(hasWorkedOn  ? PASS : WARN, '"Worked on:" line in prompt',    hasWorkedOn  ? 'present' : 'absent (no workedOn data)');
      log(hasWentWell  ? PASS : WARN, '"Went well:" line in prompt',    hasWentWell  ? 'present' : 'absent');
      log(hasDistracts ? PASS : WARN, '"Distractions:" line in prompt', hasDistracts ? 'present' : 'absent');
      log(hasNextSteps ? PASS : WARN, '"Next steps:" line in prompt',   hasNextSteps ? 'present' : 'absent');
      console.log('\n--- Prompt preview (first 500 chars) ---');
      console.log(prompt.substring(0, 500));

      // ── Stage 5: Firestore ────────────────────────────────────────────────────
      console.log('\n[5] Firestore — synced rating');
      const firestoreSessions = await getSessionsFromFirestore();
      const fsMatch = firestoreSessions.find(s => s.id === rated.id);

      if (!fsMatch) {
        log(WARN, 'Session not found in Firestore', 'user may be logged out or sync pending');
      } else {
        log(PASS, 'Session found in Firestore', fsMatch.id);
        log(fsMatch.rating?.reflection?.workedOn    ? PASS : FAIL, 'reflection.workedOn',    fsMatch.rating?.reflection?.workedOn    || 'MISSING');
        log(fsMatch.rating?.reflection?.wentWell    ? PASS : WARN, 'reflection.wentWell',    fsMatch.rating?.reflection?.wentWell    || 'empty');
        log(fsMatch.rating?.reflection?.distractions ? PASS : WARN, 'reflection.distractions', fsMatch.rating?.reflection?.distractions || 'empty');
        log(fsMatch.rating?.reflection?.nextStep    ? PASS : WARN, 'reflection.nextStep',    fsMatch.rating?.reflection?.nextStep    || 'empty');
      }

      console.log('\n===== VALIDATION COMPLETE =====\n');

      const promptHealth = [hasWorkedOn, hasWentWell, hasDistracts, hasNextSteps].filter(Boolean).length;
      Alert.alert(
        '🔬 Pipeline Validation',
        `AsyncStorage: ${rated.rating?.reflection?.workedOn ? '✅' : '❌'} reflection present\n` +
        `Repository:   ${repoMatch || 'found in wider range' ? '✅' : '❌'} field mapped\n` +
        `Aggregator:   ${activities.length ? '✅' : '❌'} ${activities.length} activities\n` +
        `Prompt:       ${promptHealth}/4 reflection lines present\n` +
        `Firestore:    ${fsMatch ? '✅' : '⚠️'} ${fsMatch ? 'synced' : 'not found (check auth)'}\n\n` +
        'See console for full detail.'
      );

    } catch (error) {
      console.error('❌ Validation error:', error);
      Alert.alert('Validation Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDebugRendering = async () => {
    try {
      setLoading(true);
      const { deepWorkStore } = require('../services/deepWorkStore');
      const sessions = await deepWorkStore.getSessions();
      const settings = await deepWorkStore.getSettings();
      
      console.log('\n🔍 ===== RENDERING DEBUG =====');
      
      // Get October dates
      const octoberDates = Object.keys(sessions)
        .filter(date => date.startsWith('2025-10'))
        .sort();
      
      console.log('October dates with sessions:', octoberDates);
      
      if (octoberDates.length > 0) {
        const sampleDate = octoberDates[0];
        const sampleSessions = sessions[sampleDate];
        
        console.log(`\n📅 Sample date: ${sampleDate}`);
        console.log(`Sessions: ${sampleSessions.length}`);
        console.log('Session activities:', sampleSessions.map(s => s.activity));
        
        console.log('\n🎨 Available activities in settings:');
        settings.activities.forEach(a => {
          console.log(`  - ${a.id}: ${a.name} (${a.color})`);
        });
        
        console.log('\n🔍 Activity matching check:');
        sampleSessions.forEach((session, i) => {
          const match = settings.activities.find(a => a.id === session.activity);
          console.log(`  Session ${i}: "${session.activity}" → ${match ? `✅ ${match.color}` : '❌ NO MATCH'}`);
        });
      } else {
        console.log('⚠️ No October sessions found!');
        
        // Check all dates
        const allDates = Object.keys(sessions).sort();
        console.log('\nAll dates with data:', allDates);
        
        if (allDates.length > 0) {
          const sampleDate = allDates[0];
          const sampleSessions = sessions[sampleDate];
          
          console.log(`\n📅 Sample from ${sampleDate}:`);
          console.log('Session activities:', sampleSessions.map(s => s.activity));
        }
      }
      
      console.log('=====================================\n');
      
      Alert.alert(
        'Rendering Debug',
        `October dates: ${octoberDates.length}\n\nCheck console for details`
      );
    } catch (error) {
      console.error('Debug error:', error);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTestNotification = async (type) => {
    setLoading(true);
    setNotifPreview(null);
    try {
      // Show the payload preview first
      const payload = await previewNotificationPayload(type);
      setNotifPreview(payload);
      console.log(`\n🔔 [DevTools] Notification payload for "${type}":`);
      console.log('  title:', payload.title);
      console.log('  body: ', payload.body);
      console.log('  data: ', JSON.stringify(payload.data));

      // Fire it immediately
      await testNotification(type);
      Alert.alert(
        '🔔 Notification Sent',
        `Type: ${payload.type}\n\n"${payload.title}"\n${payload.body}`,
      );
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>
          🛠️ Dev Tools
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Testing utilities for insights feature
        </Text>

        {/* Data Seeding */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Data Management
          </Text>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={handleSeedData}
            disabled={loading}
          >
            <Text style={styles.buttonText}>🌱 Seed 120 Days of Data</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#3b82f6' }]}
            onPress={handleDebugData}
            disabled={loading}
          >
            <Text style={styles.buttonText}>🔍 Debug Data</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#f59e0b' }]}
            onPress={handleInspectStructure}
            disabled={loading}
          >
            <Text style={styles.buttonText}>🔬 Inspect Structure</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#ec4899' }]}
            onPress={handleDebugRendering}
            disabled={loading}
          >
            <Text style={styles.buttonText}>🎨 Debug Rendering</Text>
          </TouchableOpacity>

          <TouchableOpacity
  style={[styles.button, { backgroundColor: '#10b981' }]}
  onPress={async () => {
    try {
      setLoading(true);
      
      const DataAggregator = require('../services/insights/DataAggregator').default;
      const SessionRepository = require('../services/database/SessionRepository').default;
      
      // Get last 7 days of sessions
      const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const sessions = await SessionRepository.getSessionsByDateRange(weekAgo, Date.now());
      
      console.log('\n🧪 ===== AGGREGATOR TEST =====');
      console.log('Sessions found:', sessions.length);
      console.log('Sample session:', JSON.stringify(sessions[0], null, 2));
      
      // Test aggregation
      const aggregated = DataAggregator.aggregateSessions(sessions);
      console.log('\nAggregated result:');
      console.log(JSON.stringify(aggregated, null, 2));
      console.log('================================\n');
      
      Alert.alert(
        'Aggregator Test',
        `Sessions: ${sessions.length}\n\nCheck console for details`
      );
    } catch (error) {
      console.error('Test error:', error);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  }}
  disabled={loading}
>
  <Text style={styles.buttonText}>🧪 Test Aggregator</Text>
</TouchableOpacity>

<TouchableOpacity
  style={[styles.button, { backgroundColor: '#10b981' }]}
  onPress={() => {
    const { OPENAI_API_KEY } = require('../config/openai');
    
    if (!OPENAI_API_KEY) {
      Alert.alert('❌ Not Configured', 'API key is missing or undefined');
    } else {
      const preview = `${OPENAI_API_KEY.substring(0, 7)}...${OPENAI_API_KEY.substring(OPENAI_API_KEY.length - 4)}`;
      Alert.alert('✅ Key Loaded', preview);
    }
  }}
>
  <Text style={styles.buttonText}>🔑 Verify API Key</Text>
</TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#6366f1' }]}
            onPress={handleValidatePipeline}
            disabled={loading}
          >
            <Text style={styles.buttonText}>🔬 Validate Pipeline</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#ef4444' }]}
            onPress={handleClearData}
            disabled={loading}
          >
            <Text style={styles.buttonText}>🗑️ Clear All Data</Text>
          </TouchableOpacity>

          {result && (
            <View style={[styles.resultBox, { backgroundColor: colors.cardBackground }]}>
              <Text style={[styles.resultText, { color: colors.text }]}>
                ✅ Created {result.totalSessions} sessions
              </Text>
              <Text style={[styles.resultText, { color: colors.textSecondary }]}>
                Total: {result.totalHours} hours
              </Text>
              <Text style={[styles.resultText, { color: colors.textSecondary }]}>
                {result.dateRange.start} to {result.dateRange.end}
              </Text>
            </View>
          )}
        </View>

        {/* Insight Testing */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Test Insights
          </Text>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#8b5cf6' }]}
            onPress={() => handleGenerateInsight('daily')}
            disabled={loading}
          >
            <Text style={styles.buttonText}>📅 Generate Daily Insight</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#8b5cf6' }]}
            onPress={() => handleGenerateInsight('weekly')}
            disabled={loading}
          >
            <Text style={styles.buttonText}>📊 Generate Weekly Insight</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#8b5cf6' }]}
            onPress={() => handleGenerateInsight('monthly')}
            disabled={loading}
          >
            <Text style={styles.buttonText}>📈 Generate Monthly Insight</Text>
          </TouchableOpacity>

          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                {insight ? 'Generating insight...' : 'Processing...'}
              </Text>
            </View>
          )}

          {insight && (
            <View style={[styles.insightBox, { backgroundColor: colors.cardBackground }]}>
              <Text style={[styles.insightType, { color: colors.primary }]}>
                {insight.metadata.insightType.toUpperCase()}
              </Text>
              <Text style={[styles.insightText, { color: colors.text }]}>
                {insight.insightText}
              </Text>
              <Text style={[styles.insightMeta, { color: colors.textSecondary }]}>
                {insight.metadata.fromCache ? '📦 Cached' : '✨ Fresh'} • 
                Generated {new Date(insight.metadata.generatedAt).toLocaleString()}
              </Text>
            </View>
          )}
        </View>

        {/* Notification Testing */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Test Notifications
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary, marginBottom: 12 }]}>
            Fires immediately. Check console for full payload log.
          </Text>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#0ea5e9' }]}
            onPress={() => handleTestNotification('nextStep')}
            disabled={loading}
          >
            <Text style={styles.buttonText}>📋 Next Step Notification</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#0ea5e9' }]}
            onPress={() => handleTestNotification('workedOn')}
            disabled={loading}
          >
            <Text style={styles.buttonText}>🔁 Worked On Notification</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#64748b' }]}
            onPress={() => handleTestNotification('fallback')}
            disabled={loading}
          >
            <Text style={styles.buttonText}>💬 Fallback Notification</Text>
          </TouchableOpacity>

          {notifPreview && (
            <View style={[styles.resultBox, { backgroundColor: colors.cardBackground }]}>
              <Text style={[styles.resultText, { color: colors.primary, fontWeight: '700', marginBottom: 4 }]}>
                {notifPreview.type.toUpperCase()}
              </Text>
              <Text style={[styles.resultText, { color: colors.text, fontWeight: '600' }]}>
                {notifPreview.title}
              </Text>
              <Text style={[styles.resultText, { color: colors.textSecondary }]}>
                {notifPreview.body}
              </Text>
            </View>
          )}
        </View>

        {/* Modal Testing */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Modal Testing
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary, marginBottom: 12 }]}>
            Trigger global modals on demand. Force Update requires dev menu reload to dismiss.
          </Text>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#dc2626' }]}
            onPress={() => devModalService.triggerForceUpdate()}
            disabled={loading}
          >
            <Text style={styles.buttonText}>🚨 Trigger Force Update Modal</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#7c3aed' }]}
            onPress={() => devModalService.triggerWhatsNew()}
            disabled={loading}
          >
            <Text style={styles.buttonText}>✨ Trigger What's New Modal</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, { backgroundColor: '#475569' }]}
            onPress={async () => {
              await AsyncStorage.removeItem('@last_seen_whats_new_version');
              Alert.alert('Reset', "What's New will show again on next launch.");
            }}
            disabled={loading}
          >
            <Text style={styles.buttonText}>🔄 Reset What's New Seen</Text>
          </TouchableOpacity>
        </View>

        {/* Navigation */}
        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.border }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.buttonText, { color: colors.text }]}>
            ← Back to App
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 32,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
  },
  button: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  resultBox: {
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  resultText: {
    fontSize: 14,
    marginBottom: 4,
  },
  loadingContainer: {
    padding: 24,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  insightBox: {
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  insightType: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 1,
  },
  insightText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  insightMeta: {
    fontSize: 12,
  },
});

export default DevToolsScreen;