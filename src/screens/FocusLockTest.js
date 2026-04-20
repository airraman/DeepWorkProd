// src/screens/FocusLockTest.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import focusLockService from '../services/focusLockService';

export default function FocusLockTest({ navigation }) {
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(false);

  const addLog = (message, isError = false) => {
    const timestamp = new Date().toLocaleTimeString();
    setLog(prev => [`[${timestamp}] ${isError ? '❌' : '✅'} ${message}`, ...prev]);
  };

  const run = async (label, fn) => {
    setLoading(true);
    try {
      addLog(`Running: ${label}...`);
      const result = await fn();
      addLog(`${label}: ${JSON.stringify(result)}`);
    } catch (err) {
      addLog(`${label}: ${err.message}`, true);
    } finally {
      setLoading(false);
    }
  };

  const buttons = [
    {
      label: '1. Initialize',
      color: '#2563eb',
      onPress: () => run('Initialize', () => focusLockService.initialize()),
    },
    {
      label: '2. Request Authorization',
      color: '#7c3aed',
      onPress: () => run('Request Authorization', () => focusLockService.requestAuthorization()),
    },
    {
      label: '3. Get Auth Status',
      color: '#0891b2',
      onPress: () => run('Get Auth Status', () => focusLockService.getAuthorizationStatus()),
    },
    {
      label: '4. Select Apps to Block',
      color: '#059669',
      onPress: () => run('Select Apps', () => focusLockService.selectAppsToBlock()),
    },
    {
      label: '5. Get Selection Count',
      color: '#0891b2',
      onPress: () => run('Get Selection Count', () => focusLockService.getSelectionCount()),
    },
    {
      label: '6. Start Blocking',
      color: '#dc2626',
      onPress: () => run('Start Blocking', () => focusLockService.startBlocking()),
    },
    {
      label: '7. Stop Blocking',
      color: '#16a34a',
      onPress: () => run('Stop Blocking', () => focusLockService.stopBlocking()),
    },
    {
      label: '8. Force Stop Blocking',
      color: '#b45309',
      onPress: () => run('Force Stop Blocking', () => focusLockService.forceStopBlocking()),
    },
    {
      label: '9. Clear Selection',
      color: '#6b7280',
      onPress: () => run('Clear Selection', () => focusLockService.clearSelection()),
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>🔒 Focus Lock Test</Text>
        {loading && <ActivityIndicator size="small" color="#fff" />}
      </View>

      <View style={styles.supported}>
        <Text style={styles.supportedText}>
          {focusLockService.isSupported
            ? '✅ FocusLockModule detected'
            : '❌ FocusLockModule NOT found — dev build required'}
        </Text>
      </View>

      <ScrollView style={styles.buttons} contentContainerStyle={{ gap: 10, padding: 16 }}>
        {buttons.map((btn) => (
          <TouchableOpacity
            key={btn.label}
            style={[styles.button, { backgroundColor: btn.color }]}
            onPress={btn.onPress}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{btn.label}</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[styles.button, { backgroundColor: '#1f2937' }]}
          onPress={() => setLog([])}
        >
          <Text style={styles.buttonText}>Clear Log</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={styles.logContainer}>
        <Text style={styles.logTitle}>Log</Text>
        <ScrollView style={styles.log}>
          {log.length === 0 ? (
            <Text style={styles.logEmpty}>Tap a button to begin testing.</Text>
          ) : (
            log.map((entry, i) => (
              <Text key={i} style={[styles.logEntry, entry.includes('❌') && styles.logError]}>
                {entry}
              </Text>
            ))
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  backButton: {
    padding: 4,
  },
  backText: {
    color: '#60a5fa',
    fontSize: 16,
  },
  title: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  supported: {
    padding: 12,
    backgroundColor: '#1f2937',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  supportedText: {
    color: '#d1d5db',
    fontSize: 13,
  },
  buttons: {
    flex: 1,
    maxHeight: 340,
  },
  button: {
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  logContainer: {
    flex: 1,
    borderTopWidth: 1,
    borderTopColor: '#374151',
    padding: 12,
  },
  logTitle: {
    color: '#9ca3af',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  log: {
    flex: 1,
  },
  logEmpty: {
    color: '#6b7280',
    fontSize: 13,
    fontStyle: 'italic',
  },
  logEntry: {
    color: '#d1d5db',
    fontSize: 12,
    marginBottom: 4,
    fontFamily: 'Courier',
  },
  logError: {
    color: '#f87171',
  },
});