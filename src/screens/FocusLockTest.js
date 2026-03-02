import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import focusLockService from '../services/focusLockService';

const AUTH_ICONS = {
  approved:      '✅',
  denied:        '❌',
  notDetermined: '⏳',
  unknown:       '❓',
};

export default function FocusLockTest() {
  const [authStatus, setAuthStatus] = useState(null);
  const [selection, setSelection]   = useState(null);
  const [blocking, setBlocking]     = useState(null);
  const [loading, setLoading]       = useState(true);
  const [lastAction, setLastAction] = useState('Initializing…');
  const [error, setError]           = useState(null);

  // Session 4: single initialize() call replaces three separate calls on mount
  useEffect(() => {
    if (!focusLockService.isSupported) {
      setLoading(false);
      setLastAction(null);
      return;
    }
    focusLockService.initialize()
      .then(state => {
        setAuthStatus(state.authorizationStatus);
        setSelection(state.selection);
        setBlocking(state.blocking);
      })
      .catch(e => setError(e.message))
      .finally(() => {
        setLoading(false);
        setLastAction(null);
      });
  }, []);

  const run = useCallback(async (label, fn) => {
    setLoading(true);
    setError(null);
    setLastAction(label);
    try {
      return await fn();
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRequestAuth = async () => {
    const result = await run('Request Authorization', () =>
      focusLockService.requestAuthorization()
    );
    if (result) {
      const status = await focusLockService.getAuthorizationStatus();
      setAuthStatus(status);
    }
  };

  const handleGetStatus = async () => {
    const status = await run('Get Status', () =>
      focusLockService.getAuthorizationStatus()
    );
    if (status) setAuthStatus(status);
  };

  const handleSelectApps = async () => {
    const result = await run('Select Apps to Block', () =>
      focusLockService.selectAppsToBlock()
    );
    if (result) setSelection(result);
  };

  const handleGetCount = async () => {
    const result = await run('Get Selection Count', () =>
      focusLockService.getSelectionCount()
    );
    if (result) setSelection(result);
  };

  const handleClear = async () => {
    const result = await run('Clear Selection', () =>
      focusLockService.clearSelection()
    );
    if (result) {
      setSelection(result);
      setBlocking(prev => ({ ...prev, isBlocking: false }));
    }
  };

  const handleStartBlocking = async () => {
    const result = await run('Start Blocking', () =>
      focusLockService.startBlocking()
    );
    if (result) setBlocking(result);
  };

  const handleStopBlocking = async () => {
    const result = await run('Stop Blocking', () =>
      focusLockService.stopBlocking()
    );
    if (result) setBlocking(result);
  };

  const handleGetBlockingStatus = async () => {
    const result = await run('Get Blocking Status', () =>
      focusLockService.getBlockingStatus()
    );
    if (result) setBlocking(result);
  };

  const isCurrentlyBlocking = blocking?.isBlocking === true;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Focus Lock</Text>
        <Text style={styles.subtitle}>Sessions 1–4 · Auth + Selection + Blocking + Persistence</Text>

        {/* Auth Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Authorization</Text>
          <Text style={styles.statusText}>
            {authStatus
              ? `${AUTH_ICONS[authStatus] ?? '❓'} ${authStatus}`
              : '— not checked —'}
          </Text>
        </View>

        {/* Selection Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>App Selection</Text>
          {selection ? (
            <>
              <Text style={styles.stat}>📱 Apps: {selection.appTokenCount}</Text>
              <Text style={styles.stat}>🗂 Categories: {selection.categoryTokenCount}</Text>
              <Text style={styles.stat}>🌐 Web Domains: {selection.webDomainTokenCount}</Text>
              <Text style={[styles.stat, styles.total]}>Total: {selection.totalCount}</Text>
            </>
          ) : (
            <Text style={styles.statusText}>— no selection —</Text>
          )}
        </View>

        {/* Blocking Card */}
        <View style={[styles.card, isCurrentlyBlocking && styles.cardActive]}>
          <Text style={styles.cardTitle}>Blocking Status</Text>
          {blocking ? (
            <>
              <Text style={[styles.blockingBadge, isCurrentlyBlocking ? styles.badgeOn : styles.badgeOff]}>
                {isCurrentlyBlocking ? '🔴 BLOCKING ACTIVE' : '⚪ NOT BLOCKING'}
              </Text>
              {isCurrentlyBlocking && (
                <>
                  <Text style={styles.stat}>🛡 Apps: {blocking.shieldedAppCount}</Text>
                  <Text style={styles.stat}>🗂 Categories: {blocking.shieldedCategoryCount}</Text>
                  <Text style={styles.stat}>🌐 Domains: {blocking.shieldedWebDomainCount}</Text>
                </>
              )}
            </>
          ) : (
            <Text style={styles.statusText}>— not checked —</Text>
          )}
        </View>

        {/* Authorization */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>AUTHORIZATION</Text>
          <Button label="Request Authorization" onPress={handleRequestAuth} disabled={loading} />
          <Button label="Get Status" onPress={handleGetStatus} disabled={loading} secondary />
        </View>

        {/* Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>APP SELECTION</Text>
          <Button label="Select Apps to Block" onPress={handleSelectApps} disabled={loading} />
          <Button label="Get Selection Count" onPress={handleGetCount} disabled={loading} secondary />
          <Button label="Clear Selection" onPress={handleClear} disabled={loading} danger />
        </View>

        {/* Blocking */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>BLOCKING</Text>
          <Button
            label="▶ Start Blocking"
            onPress={handleStartBlocking}
            disabled={loading || isCurrentlyBlocking}
            active
          />
          <Button
            label="■ Stop Blocking"
            onPress={handleStopBlocking}
            disabled={loading || !isCurrentlyBlocking}
            danger
          />
          <Button label="Get Blocking Status" onPress={handleGetBlockingStatus} disabled={loading} secondary />
        </View>

        {/* Feedback */}
        {loading && (
          <View style={styles.feedbackRow}>
            <ActivityIndicator color="#6C63FF" />
            <Text style={styles.feedbackText}>{lastAction ?? 'Loading…'}</Text>
          </View>
        )}

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>⚠️ Error</Text>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Button({ label, onPress, disabled, secondary, danger, active }) {
  return (
    <TouchableOpacity
      style={[
        styles.button,
        secondary && styles.buttonSecondary,
        danger && styles.buttonDanger,
        active && styles.buttonActive,
        disabled && styles.buttonDisabled,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
    >
      <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe:                  { flex: 1, backgroundColor: '#0F0F0F' },
  container:             { padding: 20, gap: 16 },
  title:                 { fontSize: 28, fontWeight: '700', color: '#FFFFFF' },
  subtitle:              { fontSize: 13, color: '#888', marginTop: -8 },
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    gap: 6,
  },
  cardActive:            { borderWidth: 1, borderColor: '#FF453A' },
  cardTitle:             { fontSize: 12, fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  statusText:            { fontSize: 16, color: '#FFFFFF' },
  stat:                  { fontSize: 15, color: '#CCCCCC' },
  total:                 { fontWeight: '700', color: '#6C63FF', marginTop: 4 },
  blockingBadge:         { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  badgeOn:               { color: '#FF453A' },
  badgeOff:              { color: '#888' },
  section:               { gap: 10 },
  sectionLabel:          { fontSize: 11, fontWeight: '600', color: '#555', letterSpacing: 0.8 },
  button: {
    backgroundColor: '#6C63FF',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonSecondary:       { backgroundColor: '#2C2C2E' },
  buttonDanger:          { backgroundColor: '#3A1A1A', borderWidth: 1, borderColor: '#FF453A' },
  buttonActive:          { backgroundColor: '#1A3A1A', borderWidth: 1, borderColor: '#32D74B' },
  buttonDisabled:        { opacity: 0.4 },
  buttonText:            { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  buttonTextSecondary:   { color: '#AAAAAA' },
  feedbackRow:           { flexDirection: 'row', alignItems: 'center', gap: 10 },
  feedbackText:          { color: '#888', fontSize: 14 },
  errorBox: {
    backgroundColor: '#2A1A1A',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FF453A',
    gap: 4,
  },
  errorTitle:            { color: '#FF453A', fontWeight: '700', fontSize: 14 },
  errorText:             { color: '#FF9999', fontSize: 13, lineHeight: 18 },
});