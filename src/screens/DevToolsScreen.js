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

const DevToolsScreen = ({ navigation }) => {
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [insight, setInsight] = useState(null);

  const handleSeedData = async () => {
    Alert.alert(
      'Seed 90 Days of Data?',
      'This will create realistic test data for the last 90 days.',
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

  // NEW: Debug data function
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
        
        // Show sample session from middle of data
        const middleIndex = Math.floor(dates.length / 2);
        const sampleDate = dates[middleIndex];
        const sampleSessions = sessions[sampleDate];
        
        console.log(`\nSample date: ${sampleDate}`);
        console.log(`Sessions on this date: ${sampleSessions.length}`);
        console.log('Sample session structure:');
        console.log(JSON.stringify(sampleSessions[0], null, 2));
        
        // Count total sessions
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
        
        // Check for required fields
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
            <Text style={styles.buttonText}>🌱 Seed 90 Days of Data</Text>
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