// src/hooks/useSessionTimer.js
// Timestamp-based timer — derives remaining time from endTime rather than
// counting down a variable, so setInterval drift and app reloads are harmless.
import { useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_END_TIME_KEY = '@session_end_time';
const SESSION_REMAINING_KEY = '@session_remaining_ms'; // written on pause, cleared on resume

export const useSessionTimer = (totalDurationMs) => {
  const [timeLeft, setTimeLeft] = useState(totalDurationMs);
  const [isPaused, setIsPaused] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  const intervalRef = useRef(null);
  // endTimeRef is the single source of truth while running
  const endTimeRef = useRef(null);
  // track remaining while paused so resume can reconstruct endTime
  const remainingAtPauseRef = useRef(null);

  const clearInterval_ = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Called every ~1 s — reads endTime, computes remaining, never accumulates error
  const tick = useCallback(() => {
    if (!endTimeRef.current) return;
    const remaining = Math.max(0, endTimeRef.current - Date.now());
    setTimeLeft(remaining);
    if (remaining <= 0) {
      clearInterval_();
      setIsExpired(true);
    }
  }, [clearInterval_]);

  const startInterval = useCallback(() => {
    clearInterval_();
    tick(); // fire immediately so UI doesn't wait 1 s for first update
    intervalRef.current = setInterval(tick, 1000);
  }, [clearInterval_, tick]);

  // Call once when the session screen mounts.
  // Restores an in-progress or paused session from AsyncStorage on reload.
  // Returns the effective endTime (ms) so callers can schedule OS notifications.
  const start = useCallback(async () => {
    try {
      const storedEndTime = await AsyncStorage.getItem(SESSION_END_TIME_KEY);
      if (storedEndTime) {
        const endTime = parseInt(storedEndTime, 10);
        if (endTime > Date.now()) {
          // Active session survived a reload — pick up where we left off
          endTimeRef.current = endTime;
          startInterval();
          return endTime; // caller: notification already scheduled by OS, re-pass same endTime
        }
        // endTime already elapsed — treat as expired
        await AsyncStorage.multiRemove([SESSION_END_TIME_KEY, SESSION_REMAINING_KEY]);
        setTimeLeft(0);
        setIsExpired(true);
        return null;
      }

      const storedRemaining = await AsyncStorage.getItem(SESSION_REMAINING_KEY);
      if (storedRemaining) {
        // Session was paused before the reload — restore paused state
        const remaining = parseInt(storedRemaining, 10);
        remainingAtPauseRef.current = remaining;
        setTimeLeft(remaining);
        setIsPaused(true);
        return null; // paused — no OS notification to schedule until resume
      }
    } catch (_) {
      // AsyncStorage unavailable — fall through to fresh start
    }

    // Fresh start
    const endTime = Date.now() + totalDurationMs;
    endTimeRef.current = endTime;
    try {
      await AsyncStorage.multiSet([
        [SESSION_END_TIME_KEY, String(endTime)],
      ]);
      await AsyncStorage.removeItem(SESSION_REMAINING_KEY);
    } catch (_) {}

    startInterval();
    return endTime; // caller: schedule OS notification for this endTime
  }, [totalDurationMs, startInterval]);

  const pause = useCallback(async () => {
    const remaining = endTimeRef.current
      ? Math.max(0, endTimeRef.current - Date.now())
      : timeLeft;

    clearInterval_();
    remainingAtPauseRef.current = remaining;
    setTimeLeft(remaining);
    setIsPaused(true);

    try {
      await AsyncStorage.setItem(SESSION_REMAINING_KEY, String(remaining));
      await AsyncStorage.removeItem(SESSION_END_TIME_KEY);
    } catch (_) {}
  }, [clearInterval_, timeLeft]);

  // Returns the new endTime so the caller can reschedule the OS notification
  const resume = useCallback(async () => {
    const remaining = remainingAtPauseRef.current ?? timeLeft;
    const endTime = Date.now() + remaining;
    endTimeRef.current = endTime;
    remainingAtPauseRef.current = null;

    try {
      await AsyncStorage.setItem(SESSION_END_TIME_KEY, String(endTime));
      await AsyncStorage.removeItem(SESSION_REMAINING_KEY);
    } catch (_) {}

    setIsPaused(false);
    startInterval();
    return endTime;
  }, [timeLeft, startInterval]);

  // Call when the session is abandoned or saved — clears persisted state
  const stop = useCallback(async () => {
    clearInterval_();
    endTimeRef.current = null;
    remainingAtPauseRef.current = null;
    try {
      await AsyncStorage.multiRemove([SESSION_END_TIME_KEY, SESSION_REMAINING_KEY]);
    } catch (_) {}
  }, [clearInterval_]);

  // Cleanup on unmount (interval only; AsyncStorage keys are cleared by stop())
  useEffect(() => {
    return () => clearInterval_();
  }, [clearInterval_]);

  return { timeLeft, isPaused, isExpired, start, pause, resume, stop };
};
