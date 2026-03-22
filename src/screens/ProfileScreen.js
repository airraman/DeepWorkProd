/**
 * ProfileScreen.js
 * Displays user profile info and focus stats pulled from Firestore.
 * Accessible from SettingsScreen when logged in.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { signOut } from '../services/authService';
import { getUserStats } from '../services/firestoreSessionService';

export default function ProfileScreen({ navigation }) {
  const { colors } = useTheme();
  const { user, userProfile, refreshProfile } = useAuth();
  const styles = makeStyles(colors);

  const [stats, setStats] = useState({ totalSessions: 0, totalMinutes: 0 });
  const [statsLoading, setStatsLoading] = useState(true);
  const [signingOut, setSigningOut] = useState(false);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const result = await getUserStats();
      setStats(result);
    } catch (error) {
      console.log('❌ [ProfileScreen] loadStats error:', error.message);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleSignOut = useCallback(() => {
    Alert.alert(
      'Sign Out',
      'Your session data will remain on this device. Sign back in anytime to sync.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            setSigningOut(true);
            try {
              await signOut();
              console.log('✅ [ProfileScreen] signed out — navigating back');
              navigation.goBack();
            } catch (error) {
              console.log('❌ [ProfileScreen] sign out error:', error.message);
              Alert.alert('Error', 'Could not sign out. Please try again.');
              setSigningOut(false);
            }
          },
        },
      ]
    );
  }, [navigation]);

  const totalHours = Math.floor(stats.totalMinutes / 60);
  const remainingMinutes = stats.totalMinutes % 60;
  const focusTimeDisplay = totalHours > 0
    ? `${totalHours}h ${remainingMinutes}m`
    : `${stats.totalMinutes}m`;

  const displayName = userProfile?.displayName || user?.displayName || 'DeepWorker';
  const email = userProfile?.email || user?.email || '';
  const memberSince = userProfile?.createdAt
    ? new Date(userProfile.createdAt.toDate()).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : null;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Avatar + Identity */}
        <View style={styles.identitySection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.displayName}>{displayName}</Text>
          <Text style={styles.email}>{email}</Text>
          {memberSince && (
            <Text style={styles.memberSince}>Member since {memberSince}</Text>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            {statsLoading ? (
              <ActivityIndicator size="small" color={colors.primary || colors.accent} />
            ) : (
              <Text style={styles.statValue}>{stats.totalSessions}</Text>
            )}
            <Text style={styles.statLabel}>Sessions</Text>
          </View>

          <View style={styles.statDivider} />

          <View style={styles.statCard}>
            {statsLoading ? (
              <ActivityIndicator size="small" color={colors.primary || colors.accent} />
            ) : (
              <Text style={styles.statValue}>{focusTimeDisplay}</Text>
            )}
            <Text style={styles.statLabel}>Focus Time</Text>
          </View>
        </View>

        {/* Sync status */}
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Sync</Text>
          <Text style={styles.infoValue}>
            {userProfile?.migrated ? '✅ Data synced to cloud' : '🔄 Sync pending'}
          </Text>
        </View>

        {/* Sign out */}
        <TouchableOpacity
          style={[styles.signOutButton, signingOut && styles.buttonDisabled]}
          onPress={handleSignOut}
          disabled={signingOut}
          activeOpacity={0.85}
        >
          {signingOut ? (
            <ActivityIndicator size="small" color="#FF3B30" />
          ) : (
            <Text style={styles.signOutText}>Sign Out</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.footerNote}>
          Your session data is always saved locally, even when signed out.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border || colors.separator,
    },
    backButton: {
      width: 60,
    },
    backButtonText: {
      fontSize: 17,
      color: colors.primary || colors.accent,
    },
    headerTitle: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
    },
    scrollContent: {
      paddingHorizontal: 24,
      paddingTop: 32,
      paddingBottom: 48,
    },
    identitySection: {
      alignItems: 'center',
      marginBottom: 32,
    },
    avatar: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.primary || colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    avatarText: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.background,
    },
    displayName: {
      fontSize: 22,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    email: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    memberSince: {
      fontSize: 12,
      color: colors.textSecondary,
      opacity: 0.7,
    },
    statsRow: {
      flexDirection: 'row',
      backgroundColor: colors.surface || colors.card,
      borderRadius: 16,
      padding: 24,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border || colors.separator,
    },
    statCard: {
      flex: 1,
      alignItems: 'center',
    },
    statValue: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    statDivider: {
      width: 1,
      backgroundColor: colors.border || colors.separator,
      marginHorizontal: 16,
    },
    infoCard: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: colors.surface || colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 32,
      borderWidth: 1,
      borderColor: colors.border || colors.separator,
    },
    infoLabel: {
      fontSize: 15,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    infoValue: {
      fontSize: 14,
      color: colors.text,
    },
    signOutButton: {
      borderWidth: 1,
      borderColor: '#FF3B30',
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: 'center',
      marginBottom: 16,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    signOutText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FF3B30',
    },
    footerNote: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
      opacity: 0.7,
      lineHeight: 18,
    },
  });