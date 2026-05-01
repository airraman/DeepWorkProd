// src/hooks/useSessionTimer.js
//
// PHASE 2: Stateless, deterministic timer.
//
// All persistence has moved to sessionStateService. This hook holds only
// in-memory state — endTimeRef and remainingAtPauseRef — and derives every
// display value from Date.now() vs endTime. setInterval drift is harmless
// because each tick recomputes from the timestamp.
//
// External shape is unchanged for callers (start/pause/resume/stop) except
// that start() now accepts an options object so DeepWorkSession can hand in
// a restored endTime (running) or restored remainingAtPause (paused).

import { useState, useEffect, useRef, useCallback } from 'react';

export const useSessionTimer = (totalDurationMs) => {
  const [timeLeft, setTimeLeft] = useState(totalDurationMs);
  const [isPaused, setIsPaused] = useState(false);
  const [isExpired, setIsExpired] = useState(false);

  const intervalRef = useRef(null);
  const endTimeRef = useRef(null);
  const remainingAtPauseRef = useRef(null);

  const clearInterval_ = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

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

  // start({ endTime, pausedRemaining })
  //   - both omitted          → fresh session, endTime = now + totalDurationMs
  //   - endTime provided      → restore a running session at the given endTime
  //   - pausedRemaining given → restore a paused session with that remaining time
  // Returns the effective endTime (or null when paused / already expired).
  const start = useCallback(({ endTime, pausedRemaining } = {}) => {
    if (pausedRemaining != null) {
      remainingAtPauseRef.current = pausedRemaining;
      setTimeLeft(pausedRemaining);
      setIsPaused(true);
      return null;
    }

    if (endTime != null) {
      if (endTime > Date.now()) {
        endTimeRef.current = endTime;
        startInterval();
        return endTime;
      }
      setTimeLeft(0);
      setIsExpired(true);
      return null;
    }

    const fresh = Date.now() + totalDurationMs;
    endTimeRef.current = fresh;
    startInterval();
    return fresh;
  }, [totalDurationMs, startInterval]);

  // Returns remaining ms at the moment of pause so the caller can persist it.
  const pause = useCallback(() => {
    const remaining = endTimeRef.current
      ? Math.max(0, endTimeRef.current - Date.now())
      : timeLeft;
    clearInterval_();
    remainingAtPauseRef.current = remaining;
    setTimeLeft(remaining);
    setIsPaused(true);
    return remaining;
  }, [clearInterval_, timeLeft]);

  // Returns the new endTime so the caller can persist it + reschedule the OS notif.
  const resume = useCallback(() => {
    const remaining = remainingAtPauseRef.current ?? timeLeft;
    const endTime = Date.now() + remaining;
    endTimeRef.current = endTime;
    remainingAtPauseRef.current = null;
    setIsPaused(false);
    startInterval();
    return endTime;
  }, [timeLeft, startInterval]);

  const stop = useCallback(() => {
    clearInterval_();
    endTimeRef.current = null;
    remainingAtPauseRef.current = null;
  }, [clearInterval_]);

  useEffect(() => {
    return () => clearInterval_();
  }, [clearInterval_]);

  return { timeLeft, isPaused, isExpired, start, pause, resume, stop };
};
