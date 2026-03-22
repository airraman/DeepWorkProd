/**
 * AuthContext.js
 * Provides auth state (user, authLoading, userProfile) to the entire app.
 *
 * Key design decisions:
 * - authLoading prevents flash of LoginScreen on app start for logged-in users
 * - userProfile is the Firestore doc, separate from the Firebase Auth user object
 * - onMigrationNeeded callback lets App.js trigger migration without coupling
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { onAuthStateChanged, getUserProfile } from '../services/authService';

const AuthContext = createContext(null);

export const AuthProvider = ({ children, onMigrationNeeded }) => {
  const [user, setUser] = useState(null);           // Firebase Auth user object
  const [userProfile, setUserProfile] = useState(null); // Firestore profile doc
  const [authLoading, setAuthLoading] = useState(true);  // true until first auth state resolves

  const loadUserProfile = useCallback(async (firebaseUser) => {
    if (!firebaseUser) {
      setUserProfile(null);
      return;
    }

    try {
      const profile = await getUserProfile(firebaseUser.uid);
      setUserProfile(profile);
      console.log('✅ [AuthContext] userProfile loaded:', profile?.displayName);
    } catch (error) {
      console.log('❌ [AuthContext] loadUserProfile error:', error.message);
      setUserProfile(null);
    }
  }, []);

  useEffect(() => {
    console.log('🔄 [AuthContext] subscribing to auth state changes');

    const unsubscribe = onAuthStateChanged(async (firebaseUser) => {
      console.log(
        '📦 [AuthContext] auth state changed —',
        firebaseUser ? `logged in as ${firebaseUser.email}` : 'logged out'
      );

      setUser(firebaseUser);
      await loadUserProfile(firebaseUser);

      // Trigger migration check in App.js if a callback was provided
      if (firebaseUser && onMigrationNeeded) {
        onMigrationNeeded(firebaseUser);
      }

      setAuthLoading(false);
    });

    return () => {
      console.log('🔄 [AuthContext] unsubscribing from auth state');
      unsubscribe();
    };
  }, [loadUserProfile, onMigrationNeeded]);

  /**
   * Refresh userProfile from Firestore.
   * Call after migration completes or profile updates.
   */
  const refreshProfile = useCallback(async () => {
    if (!user) return;
    console.log('🔄 [AuthContext] refreshProfile');
    await loadUserProfile(user);
  }, [user, loadUserProfile]);

  const value = {
    user,           // Firebase Auth user | null
    userProfile,    // Firestore profile doc | null
    authLoading,    // true during initial auth resolution
    refreshProfile, // () => Promise<void>
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};