import analytics from '@react-native-firebase/analytics';

// Fire-and-forget event tracking. Never awaited at call sites — analytics
// must not add latency to UI interactions.
export function trackEvent(name, params = {}) {
  analytics()
    .logEvent(name, params)
    .catch((error) => {
      console.warn(`[analytics] Failed to log ${name}:`, error.message);
    });
}
