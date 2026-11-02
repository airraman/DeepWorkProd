/**
 * LoginScreen.js
 * Email + password login and signup.
 * Toggle between modes with a single tap.
 * Handles all loading, error, and keyboard states.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { useTheme, THEMES } from '../context/ThemeContext';
import {
  signIn,
  signUp,
  signInAnonymously,
  signInWithGoogle,
  signInWithApple,
  isAppleSignInAvailable,
} from '../services/authService';

const MODE_LOGIN = 'login';
const MODE_SIGNUP = 'signup';

export default function LoginScreen() {
  const { colors, theme } = useTheme();
  const styles = makeStyles(colors);

  const [mode, setMode] = useState(MODE_LOGIN);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [error, setError] = useState('');

  const passwordRef = useRef(null);
  const displayNameRef = useRef(null);

  const isLogin = mode === MODE_LOGIN;
  const busy = loading || googleLoading || appleLoading;

  useEffect(() => {
    isAppleSignInAvailable().then(setAppleAvailable);
  }, []);

  const toggleMode = useCallback(() => {
    setMode((prev) => (prev === MODE_LOGIN ? MODE_SIGNUP : MODE_LOGIN));
    setError('');
    setEmail('');
    setPassword('');
    setDisplayName('');
  }, []);

  const validate = useCallback(() => {
    if (!email.trim()) return 'Email is required.';
    if (!email.includes('@')) return 'Enter a valid email address.';
    if (!password) return 'Password is required.';
    if (password.length < 6) return 'Password must be at least 6 characters.';
    if (!isLogin && !displayName.trim()) return 'Name is required.';
    return null;
  }, [email, password, displayName, isLogin]);

  const handleSubmit = useCallback(async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setLoading(true);

    try {
      if (isLogin) {
        console.log('🔄 [LoginScreen] attempting sign in');
        await signIn(email.trim().toLowerCase(), password);
        console.log('✅ [LoginScreen] sign in success — auth state will update via listener');
      } else {
        console.log('🔄 [LoginScreen] attempting sign up');
        await signUp(email.trim().toLowerCase(), password, displayName.trim());
        console.log('✅ [LoginScreen] sign up success — auth state will update via listener');
      }
      // Navigation happens automatically — AuthContext updates user → App.js hides LoginScreen
    } catch (err) {
      console.log('❌ [LoginScreen] submit error:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [isLogin, email, password, displayName, validate]);

  const handleGoogleSignIn = useCallback(async () => {
    setError('');
    setGoogleLoading(true);
    try {
      console.log('🔄 [LoginScreen] attempting Google sign-in');
      await signInWithGoogle();
      console.log('✅ [LoginScreen] Google sign-in success — auth state will update via listener');
      // Navigation happens automatically — AuthContext updates user → App.js hides LoginScreen
    } catch (err) {
      if (err.code !== 'CANCELLED') {
        setError(err.message);
      }
    } finally {
      setGoogleLoading(false);
    }
  }, []);

  const handleAppleSignIn = useCallback(async () => {
    if (busy) return;
    setError('');
    setAppleLoading(true);
    try {
      await signInWithApple();
      // Navigation happens automatically — AuthContext updates user → App.js hides LoginScreen
    } catch (err) {
      if (err.code !== 'CANCELLED') {
        setError(err.message);
      }
    } finally {
      setAppleLoading(false);
    }
  }, [busy]);

  const handleSkip = useCallback(async () => {
    try {
      setLoading(true);
      await signInAnonymously();
      // AuthContext picks up the new anonymous user → App.js routes to main app
    } catch (err) {
      setError('Unable to continue. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>⏱</Text>
          <Text style={styles.title}>Lucid</Text>
          <Text style={styles.subtitle}>
            {isLogin
              ? 'Sign in to sync your focus sessions'
              : 'Create an account to back up your progress'}
          </Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          {/* Apple and Google — offered first, above the email/password fields */}
          {appleAvailable && (
            <View style={[styles.appleButtonWrapper, appleLoading && styles.primaryButtonDisabled]}>
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={
                  isLogin
                    ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                    : AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
                }
                buttonStyle={
                  theme === THEMES.DARK
                    ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
                    : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                }
                cornerRadius={14}
                style={styles.appleButton}
                onPress={handleAppleSignIn}
              />
            </View>
          )}

          <TouchableOpacity
            style={[styles.googleButton, googleLoading && styles.primaryButtonDisabled]}
            onPress={handleGoogleSignIn}
            disabled={busy}
            activeOpacity={0.85}
          >
            {googleLoading ? (
              <ActivityIndicator color={colors.text} size="small" />
            ) : (
              <>
                <Text style={styles.googleIcon}>G</Text>
                <Text style={styles.googleButtonText}>
                  {isLogin ? 'Sign in with Google' : 'Sign Up with Google'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border || colors.separator }]} />
            <Text style={styles.dividerText}>or</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border || colors.separator }]} />
          </View>

          {/* Display name — signup only */}
          {!isLogin && (
            <View style={styles.fieldWrapper}>
              <Text style={styles.label}>Your name</Text>
              <TextInput
                ref={displayNameRef}
                style={styles.input}
                placeholder="e.g. Alex"
                placeholderTextColor={colors.textTertiary || colors.textSecondary}
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
                returnKeyType="next"
                onSubmitEditing={() => passwordRef.current?.focus()}
                editable={!loading}
              />
            </View>
          )}

          <View style={styles.fieldWrapper}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor={colors.textTertiary || colors.textSecondary}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              editable={!loading}
            />
          </View>

          <View style={styles.fieldWrapper}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              ref={passwordRef}
              style={styles.input}
              placeholder={isLogin ? '••••••••' : 'Min. 6 characters'}
              placeholderTextColor={colors.textTertiary || colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
              editable={!loading}
            />
          </View>

          {/* Error message */}
          {!!error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Primary CTA */}
          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
            onPress={handleSubmit}
            disabled={busy}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={colors.background} size="small" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {isLogin ? 'Sign In' : 'Create Account'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Mode toggle */}
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={toggleMode}
            disabled={busy}
          >
            <Text style={styles.toggleText}>
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <Text style={styles.toggleLink}>
                {isLogin ? 'Sign Up' : 'Sign In'}
              </Text>
            </Text>
          </TouchableOpacity>

          {/* Skip / continue locally */}
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkip}
            disabled={busy}
          >
            <Text style={styles.skipText}>Continue without account</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <Text style={styles.footerText}>
          Your data stays on your device until you sign in.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      paddingHorizontal: 28,
      paddingVertical: 48,
    },
    header: {
      alignItems: 'center',
      marginBottom: 40,
    },
    logo: {
      fontSize: 48,
      marginBottom: 8,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.5,
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      maxWidth: 280,
    },
    form: {
      width: '100%',
    },
    fieldWrapper: {
      marginBottom: 16,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    input: {
      backgroundColor: colors.surface || colors.card,
      color: colors.text,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 16,
      borderWidth: 1,
      borderColor: colors.border || colors.separator,
    },
    appleButtonWrapper: {
      marginBottom: 12,
    },
    appleButton: {
      width: '100%',
      height: 50,
    },
    googleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface || colors.card,
      borderRadius: 14,
      paddingVertical: 15,
      borderWidth: 1,
      borderColor: colors.border || colors.separator,
      marginBottom: 20,
    },
    googleIcon: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      marginRight: 10,
    },
    googleButtonText: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    dividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 20,
    },
    dividerLine: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
    },
    dividerText: {
      fontSize: 12,
      color: colors.textSecondary,
      marginHorizontal: 10,
    },
    errorBox: {
      backgroundColor: colors.error
        ? `${colors.error}20`
        : 'rgba(255,59,48,0.12)',
      borderRadius: 10,
      padding: 12,
      marginBottom: 12,
    },
    errorText: {
      color: colors.error || '#FF3B30',
      fontSize: 14,
      lineHeight: 20,
    },
    primaryButton: {
      backgroundColor: colors.primary || colors.accent,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
      marginTop: 8,
      marginBottom: 16,
    },
    primaryButtonDisabled: {
      opacity: 0.6,
    },
    primaryButtonText: {
      color: colors.background,
      fontSize: 16,
      fontWeight: '700',
      letterSpacing: 0.2,
    },
    toggleButton: {
      alignItems: 'center',
      paddingVertical: 8,
    },
    toggleText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    toggleLink: {
      color: colors.primary || colors.accent,
      fontWeight: '600',
    },
    skipButton: {
      alignItems: 'center',
      paddingVertical: 12,
      marginTop: 4,
    },
    skipText: {
      fontSize: 13,
      color: colors.textSecondary,
      textDecorationLine: 'underline',
    },
    footerText: {
      fontSize: 12,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: 32,
      opacity: 0.7,
    },
  });